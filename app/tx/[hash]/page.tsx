///// Date : 2026-07-02 | Changes : Transaction detail page | Who : Liviu Epure
"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";

import { fetchTx, type TxSummary } from "@/lib/chain";
import { timeAgo, truncateMiddle } from "@/lib/format";
import { CARD, CopyValue, ErrorBanner, FactRow, Spinner } from "@/components/ui";

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

      {error && (
        <ErrorBanner message={`Transaction not found: ${error}. Hash: ${hash}`} />
      )}
      {!error && !tx && <Spinner />}

      {tx && (
        <>
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
              <span className="font-mono text-slate-700 dark:text-slate-300">{tx.fee}</span>
            </FactRow>
            <FactRow label="Gas (used / wanted)">
              <span className="font-mono text-slate-700 dark:text-slate-300">
                {Number(tx.gasUsed).toLocaleString()} / {Number(tx.gasWanted).toLocaleString()}
              </span>
            </FactRow>
            {tx.memo && (
              <FactRow label="Memo">
                <span className="text-slate-700 dark:text-slate-300">{tx.memo}</span>
              </FactRow>
            )}
            {tx.hasPqcExtension && (
              <div className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-500/5 p-3 text-xs text-slate-500 dark:text-slate-400">
                <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-500" />
                Carries a hybrid post-quantum signature extension (ML-DSA-87 +
                secp256k1).
              </div>
            )}
          </div>

          <div className={`${CARD} p-5`}>
            <div className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">
              Messages ({tx.messages.length})
            </div>
            <ul className="divide-y divide-slate-100 dark:divide-[#1a1f2e]">
              {tx.messages.map((m, i) => (
                <li key={i} className="py-2.5 font-mono text-sm text-slate-700 dark:text-slate-300">
                  {m.type}
                </li>
              ))}
            </ul>
          </div>

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
