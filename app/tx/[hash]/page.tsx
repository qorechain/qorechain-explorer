///// Date : 2026-07-02 | Changes : Rich tx detail — token movements, typed messages, quantum-security card, events | Who : Liviu Epure
"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Boxes,
  Coins,
  FileText,
  ListTree,
  Lock,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";

import { fetchTx, type TxEvent, type TxSummary } from "@/lib/chain";
import { moduleLabel } from "@/lib/modules";
import { formatQor, timeAgo, truncateMiddle } from "@/lib/format";
import { CARD, CopyValue, ErrorBanner, FactRow, Spinner } from "@/components/ui";

// ── helpers ─────────────────────────────────────────────────────────────────

/** "1000000000uqor" | {denom,amount} → "1,000 QOR" (falls back verbatim). */
function coinDisplay(v: unknown): string {
  const list = Array.isArray(v) ? v : [v];
  return list
    .map((c) => {
      if (typeof c === "string") {
        const m = c.match(/^(\d+)(uqor)$/);
        return m ? `${formatQor(m[1], 6)} QOR` : c;
      }
      if (c && typeof c === "object" && "denom" in c && "amount" in c) {
        const cc = c as { denom: string; amount: string };
        return cc.denom === "uqor"
          ? `${formatQor(cc.amount, 6)} QOR`
          : `${cc.amount}${cc.denom}`;
      }
      return String(c);
    })
    .join(", ");
}

function isAccountAddress(v: string): boolean {
  return /^qor1[a-z0-9]{20,}$/.test(v);
}

function AddrLink({ value }: { value: string }) {
  const mod = moduleLabel(value);
  if (isAccountAddress(value)) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <Link
          href={`/address/${value}`}
          className="cursor-pointer font-mono text-emerald-600 hover:underline dark:text-emerald-400"
          title={mod ? `${mod} module account — ${value}` : value}
        >
          {truncateMiddle(value, 10)}
        </Link>
        {mod && (
          <span
            className="inline-flex items-center gap-1 rounded bg-sky-500/10 px-1.5 py-0.5 text-xs font-medium text-sky-600 dark:text-sky-400"
            title={`${mod} module account — no private key, controlled by chain logic`}
          >
            <Boxes className="h-3 w-3" />
            {mod}
          </span>
        )}
      </span>
    );
  }
  return <CopyValue value={value} display={truncateMiddle(value, 12)} />;
}

/** Human field renderer for message values (addresses linked, coins formatted). */
function FieldValue({ k, v }: { k: string; v: unknown }) {
  if (typeof v === "string") {
    if (isAccountAddress(v) || /^qorvaloper1[a-z0-9]{20,}$/.test(v)) {
      return <AddrLink value={v} />;
    }
    return <CopyValue value={v} display={v.length > 40 ? truncateMiddle(v, 14) : v} />;
  }
  if (
    (Array.isArray(v) && v.every((x) => x && typeof x === "object" && "denom" in x)) ||
    (v && typeof v === "object" && "denom" in (v as object))
  ) {
    return (
      <span className="font-mono text-slate-700 dark:text-slate-300">{coinDisplay(v)}</span>
    );
  }
  if (v === null || v === undefined) {
    return <span className="text-slate-400">—</span>;
  }
  if (typeof v === "object") {
    return (
      <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
        {JSON.stringify(v).slice(0, 120)}
      </span>
    );
  }
  return <span className="font-mono text-slate-700 dark:text-slate-300">{String(v)}</span>;
}

function labelize(key: string): string {
  return key.replace(/_/g, " ");
}

const ALGO_INFO: Record<string, { name: string; detail: string }> = {
  "1": { name: "ML-DSA-87 (Dilithium-5)", detail: "FIPS 204 · NIST security category 5 (highest)" },
  dilithium5: { name: "ML-DSA-87 (Dilithium-5)", detail: "FIPS 204 · NIST security category 5 (highest)" },
};

// ── page ────────────────────────────────────────────────────────────────────

export default function TxPage({
  params,
}: {
  params: Promise<{ hash: string }>;
}) {
  const { hash } = use(params);
  const [tx, setTx] = useState<TxSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setTx(null);
    setError(null);
    fetchTx(hash)
      .then((t) => !cancelled && setTx(t))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      cancelled = true;
    };
  }, [hash]);

  return (
    <div className="space-y-6 pb-8">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
        Transaction
      </h1>

      {error && <ErrorBanner message={`Transaction not found: ${error}. Hash: ${hash}`} />}
      {!error && !tx && <Spinner />}

      {tx && (
        <>
          <Overview tx={tx} />
          <TokenMovements tx={tx} />
          <Messages tx={tx} />
          <QuantumSecurity tx={tx} />
          <Events events={tx.events} />
          <details className={`${CARD} p-5`}>
            <summary className="cursor-pointer text-sm font-semibold text-slate-900 dark:text-slate-100">
              Raw response
            </summary>
            <pre className="mt-3 max-h-96 overflow-auto rounded-lg bg-slate-50 p-3 text-xs text-slate-600 dark:bg-[#0f1620] dark:text-slate-400">
              {JSON.stringify(tx.raw, null, 2)}
            </pre>
          </details>
        </>
      )}
    </div>
  );
}

function Overview({ tx }: { tx: TxSummary }) {
  const gasPct =
    Number(tx.gasWanted) > 0 ? (Number(tx.gasUsed) / Number(tx.gasWanted)) * 100 : 0;
  return (
    <div className={`${CARD} p-5`}>
      <FactRow label="Hash">
        <CopyValue value={tx.hash} display={truncateMiddle(tx.hash, 16)} />
      </FactRow>
      <FactRow label="Status">
        <span
          className={`rounded-md px-2 py-0.5 text-xs font-semibold ${
            tx.code === 0
              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              : "bg-red-500/10 text-red-500"
          }`}
        >
          {tx.code === 0 ? "success" : `failed (code ${tx.code})`}
        </span>
      </FactRow>
      {tx.code !== 0 && tx.rawLog && (
        <FactRow label="Error log">
          <span className="text-xs text-red-500">{tx.rawLog.slice(0, 200)}</span>
        </FactRow>
      )}
      <FactRow label="Block">
        <Link
          href={`/block/${tx.height}`}
          className="cursor-pointer font-mono text-emerald-600 hover:underline dark:text-emerald-400"
        >
          #{Number(tx.height).toLocaleString()}
        </Link>
      </FactRow>
      <FactRow label="Time">
        <span className="text-slate-700 dark:text-slate-300">
          {tx.time ? `${new Date(tx.time).toLocaleString()} (${timeAgo(tx.time)})` : "—"}
        </span>
      </FactRow>
      <FactRow label="Fee">
        <span className="font-mono text-slate-700 dark:text-slate-300">
          {coinDisplay(tx.feeAmounts)}{" "}
          <span className="text-xs text-slate-400">({tx.fee})</span>
        </span>
      </FactRow>
      <FactRow label="Gas (used / wanted)">
        <span className="font-mono text-slate-700 dark:text-slate-300">
          {Number(tx.gasUsed).toLocaleString()} / {Number(tx.gasWanted).toLocaleString()}{" "}
          <span className="text-xs text-slate-400">({gasPct.toFixed(1)}%)</span>
        </span>
      </FactRow>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-[#0f1620]">
        <div
          className="h-full rounded-full bg-emerald-500/70"
          style={{ width: `${Math.min(100, gasPct)}%` }}
        />
      </div>
      {tx.memo && (
        <FactRow label="Memo">
          <span className="text-slate-700 dark:text-slate-300">{tx.memo}</span>
        </FactRow>
      )}
      {tx.timeoutHeight !== "0" && (
        <FactRow label="Timeout height">
          <span className="font-mono text-slate-700 dark:text-slate-300">{tx.timeoutHeight}</span>
        </FactRow>
      )}
    </div>
  );
}

function TokenMovements({ tx }: { tx: TxSummary }) {
  const transfers = tx.events.filter((e) => e.type === "transfer");
  if (transfers.length === 0) return null;
  const rows = transfers.map((e) => {
    const attr = (k: string) => e.attributes.find((a) => a.key === k)?.value ?? "";
    const isFee = e.attributes.every((a) => a.msgIndex === undefined);
    return { sender: attr("sender"), recipient: attr("recipient"), amount: attr("amount"), isFee };
  });
  const routesThroughModule = rows.some(
    (r) => moduleLabel(r.sender) || moduleLabel(r.recipient),
  );
  return (
    <div className={`${CARD} p-5`}>
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
        <Coins className="h-4 w-4 text-emerald-500" /> Token movements
      </div>
      {routesThroughModule && (
        <p className="mb-3 rounded-lg bg-sky-500/10 p-3 text-xs text-sky-700 dark:text-sky-300">
          Some legs pass through a <span className="font-semibold">module account</span>{" "}
          (a chain-controlled escrow with no private key, tagged below). EVM
          transfers, for example, route value through the EVM module, so a
          single payment appears as two bank legs — into the module, then out to
          the recipient. It is one transfer, not two.
        </p>
      )}
      <ul className="divide-y divide-slate-100 dark:divide-[#1a1f2e]">
        {rows.map((r, i) => (
          <li key={i} className="flex flex-wrap items-center gap-2 py-2.5 text-sm">
            <AddrLink value={r.sender} />
            <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            <AddrLink value={r.recipient} />
            <span className="ml-auto font-mono font-semibold text-slate-800 dark:text-slate-200">
              {coinDisplay(r.amount)}
            </span>
            {r.isFee && (
              <span className="rounded bg-slate-500/10 px-1.5 py-0.5 text-xs text-slate-500">
                fee
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Messages({ tx }: { tx: TxSummary }) {
  return (
    <div className={`${CARD} p-5`}>
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
        <FileText className="h-4 w-4 text-emerald-500" /> Messages ({tx.messagesFull.length})
      </div>
      <div className="space-y-4">
        {tx.messagesFull.map((m, i) => {
          const typeUrl = String(m["@type"] ?? "");
          const shortType = typeUrl.split(".").pop() ?? typeUrl;
          const fields = Object.entries(m).filter(([k]) => k !== "@type");
          return (
            <div
              key={i}
              className="rounded-xl border border-slate-100 p-4 dark:border-[#1a1f2e]"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="font-mono text-sm font-semibold text-slate-800 dark:text-slate-200">
                  {shortType}
                </span>
                <span className="truncate font-mono text-xs text-slate-400">{typeUrl}</span>
              </div>
              {fields.map(([k, v]) => (
                <FactRow key={k} label={labelize(k)}>
                  <FieldValue k={k} v={v} />
                </FactRow>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function QuantumSecurity({ tx }: { tx: TxSummary }) {
  const pqcVerify = tx.events.find((e) => e.type === "pqc_verify");
  const pqcHybrid = tx.events.find((e) => e.type === "pqc_hybrid_verify");
  const attr = (e: TxEvent | undefined, k: string) =>
    e?.attributes.find((a) => a.key === k)?.value;
  const chainAlgo = attr(pqcHybrid, "algorithm_id") ?? attr(pqcVerify, "algorithm_id");
  const verified = attr(pqcHybrid, "status") === "verified";
  const hybridMode = attr(pqcVerify, "hybrid_mode");
  const keyType = attr(pqcVerify, "key_type");

  return (
    <div className={`${CARD} p-5`}>
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
        {tx.hasPqcExtension ? (
          <ShieldCheck className="h-4 w-4 text-emerald-500" />
        ) : (
          <ShieldAlert className="h-4 w-4 text-amber-500" />
        )}
        Signature security
        {tx.hasPqcExtension ? (
          <span className="ml-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            quantum-safe
          </span>
        ) : (
          <span className="ml-1 rounded-md bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
            not quantum-safe
          </span>
        )}
        {verified && (
          <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            verified on-chain
          </span>
        )}
      </div>

      {tx.hasPqcExtension ? (
        <>
          {tx.pqcExtensions.map((ext, i) => {
            const info =
              ALGO_INFO[String(chainAlgo ?? ext.algorithmId)] ??
              ALGO_INFO[String(ext.algorithmId)];
            return (
              <div key={i}>
                <FactRow label="Post-quantum algorithm">
                  <span className="text-slate-700 dark:text-slate-300">
                    {info?.name ?? `algorithm ${ext.algorithmId}`}
                  </span>
                </FactRow>
                {info && (
                  <FactRow label="Standard / strength">
                    <span className="text-slate-700 dark:text-slate-300">{info.detail}</span>
                  </FactRow>
                )}
                <FactRow label="PQC signature size">
                  <span className="font-mono text-slate-700 dark:text-slate-300">
                    {ext.signatureBytes.toLocaleString()} bytes
                  </span>
                </FactRow>
                <FactRow label="Extension type">
                  <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                    {ext.typeUrl}
                  </span>
                </FactRow>
              </div>
            );
          })}
          {keyType && (
            <FactRow label="Registered key type">
              <span className="text-slate-700 dark:text-slate-300">{keyType}</span>
            </FactRow>
          )}
          {hybridMode && (
            <FactRow label="Chain policy">
              <span className="text-slate-700 dark:text-slate-300">
                hybrid signatures {hybridMode}
              </span>
            </FactRow>
          )}
        </>
      ) : (
        <>
          <p className="mb-2 flex items-start gap-2 rounded-lg bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
            <Lock className="mt-0.5 h-4 w-4 shrink-0" />
            This transaction carries no post-quantum signature. It is signed
            with classical ECDSA (secp256k1) only and is not protected against
            quantum attacks. EVM-lane transactions are standard
            secp256k1/EIP-155 by design.
          </p>
          <FactRow label="Chain hashing">
            <span className="text-slate-700 dark:text-slate-300">
              SHAKE-256 (FIPS 202) at the application layer
            </span>
          </FactRow>
        </>
      )}

      <div className="mt-3 border-t border-slate-100 pt-3 dark:border-[#1a1f2e]">
        <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          Classical layer
        </div>
        {tx.signers.length === 0 &&
          tx.messagesFull.some((m) =>
            String(m["@type"] ?? "").endsWith("MsgEthereumTx"),
          ) && (
            <FactRow label="Signature scheme">
              <span className="text-slate-700 dark:text-slate-300">
                secp256k1 (ECDSA, EIP-155) — signature carried inside the
                Ethereum transaction envelope
              </span>
            </FactRow>
          )}
        {tx.signers.map((s, i) => (
          <div key={i}>
            <FactRow label="Signature scheme">
              <span className="text-slate-700 dark:text-slate-300">
                {s.pubkeyType.includes("secp256k1") ? "secp256k1 (ECDSA)" : s.pubkeyType}
              </span>
            </FactRow>
            <FactRow label="Sign mode">
              <span className="font-mono text-slate-700 dark:text-slate-300">{s.mode}</span>
            </FactRow>
            <FactRow label="Public key">
              <CopyValue value={s.pubkeyB64} display={truncateMiddle(s.pubkeyB64, 12)} />
            </FactRow>
            <FactRow label="Sequence">
              <span className="font-mono text-slate-700 dark:text-slate-300">{s.sequence}</span>
            </FactRow>
          </div>
        ))}
      </div>
    </div>
  );
}

function Events({ events }: { events: TxEvent[] }) {
  if (events.length === 0) return null;
  return (
    <details className={`${CARD} p-5`}>
      <summary className="cursor-pointer flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
        <ListTree className="h-4 w-4 text-emerald-500" /> Events ({events.length})
      </summary>
      <div className="mt-3 space-y-3">
        {events.map((e, i) => (
          <div key={i} className="rounded-xl border border-slate-100 p-3 dark:border-[#1a1f2e]">
            <div className="mb-1 font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              {e.type}
            </div>
            {e.attributes
              .filter((a) => a.key !== "msg_index")
              .map((a, j) => (
                <div key={j} className="flex items-start justify-between gap-3 py-0.5 text-xs">
                  <span className="shrink-0 text-slate-400">{a.key}</span>
                  <span className="break-all text-right font-mono text-slate-600 dark:text-slate-300">
                    {isAccountAddress(a.value) ? <AddrLink value={a.value} /> : a.value}
                  </span>
                </div>
              ))}
          </div>
        ))}
      </div>
    </details>
  );
}
