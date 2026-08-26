///// Date : 2026-08-14 | Changes : Explorer home — last 20 blocks + 20 txs (both networks) | Who : Liviu Epure
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeftRight,
  Box,
  Coins,
  FileCode2,
  KeyRound,
  Landmark,
  Send,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Vote,
  Zap,
} from "lucide-react";

import {
  fetchBondedTokens,
  fetchLatestBlocks,
  fetchNetworkStats,
  fetchStatus,
  fetchTxs,
  fetchValidators,
  fetchSupply,
  txSecurityTier,
  type BlockSummary,
  type ChainStatus,
  type NetworkStats,
  type TxSummary,
} from "@/lib/chain";
import { formatQor, timeAgo, truncateMiddle } from "@/lib/format";
import { useNetwork } from "@/lib/network-provider";
import { CARD, ErrorBanner, Spinner } from "@/components/ui";
import { SearchBar } from "@/components/SearchBar";
import { NetworkInfoPanel } from "@/components/NetworkInfoPanel";
import { AddNetworkPanel } from "@/components/AddNetworkPanel";

const REFRESH_MS = 6000;

// Icon per message type — keyed on the short type name (last proto segment).
function MessageTypeIcon({ type }: { type: string }) {
  const cls = "h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500";
  if (type.startsWith("MsgRegisterPQCKey") || type.startsWith("MsgRotatePQCKey"))
    return <KeyRound className={cls} aria-label="PQC key" />;
  if (type === "MsgEthereumTx")
    return <FileCode2 className={cls} aria-label="EVM transaction" />;
  if (type === "MsgSend" || type === "MsgMultiSend")
    return <Send className={cls} aria-label="transfer" />;
  if (type.startsWith("MsgDelegate") || type.startsWith("MsgUndelegate") || type.startsWith("MsgBeginRedelegate"))
    return <Landmark className={cls} aria-label="staking" />;
  if (type.startsWith("MsgVote") || type.startsWith("MsgSubmitProposal"))
    return <Vote className={cls} aria-label="governance" />;
  return <ArrowLeftRight className={cls} aria-label="transaction" />;
}

// Three-tier post-quantum security shield. Honest by construction:
// green only when a real PQC signature is present.
const SECURITY_SHIELD = {
  pqc: {
    Icon: ShieldCheck,
    cls: "text-emerald-500",
    title: "Quantum-safe — signed with a post-quantum ML-DSA-87 signature",
  },
  enrollment: {
    Icon: KeyRound,
    cls: "text-sky-500",
    title:
      "Post-quantum key enrollment — a one-time classically-signed bootstrap that turns on PQC signing for this account",
  },
  shake: {
    Icon: Shield,
    cls: "text-amber-500",
    title:
      "Not quantum-safe — classical secp256k1 signature over SHAKE-256 (FIPS 202) native sign-bytes",
  },
  classical: {
    Icon: ShieldAlert,
    cls: "text-red-500",
    title:
      "Not quantum-safe — fully classical EVM signature (keccak256 + secp256k1)",
  },
} as const;

function SecurityShield({ tx }: { tx: TxSummary }) {
  const { Icon, cls, title } = SECURITY_SHIELD[txSecurityTier(tx)];
  return <Icon className={`h-4 w-4 shrink-0 ${cls}`} aria-label={title} />;
}

function StatCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className={`${CARD} flex items-center gap-4 p-5`}>
      <div className="rounded-xl bg-emerald-500/10 p-3 text-emerald-500">{icon}</div>
      <div className="min-w-0">
        <div className="text-xs uppercase tracking-wider text-slate-400 dark:text-slate-500">
          {label}
        </div>
        <div className="truncate text-xl font-bold text-slate-900 dark:text-slate-100">
          {value}
        </div>
        {sub && <div className="text-xs text-slate-400 dark:text-slate-500">{sub}</div>}
      </div>
    </div>
  );
}

/** A headline number with two supporting facts underneath. */
function StatPanel({
  label,
  value,
  accent,
  right,
  rows,
}: {
  label: string;
  value: string;
  accent?: boolean;
  right?: React.ReactNode;
  rows: Array<{ k: string; v: string; k2?: string; v2?: string }>;
}) {
  return (
    <div className={`${CARD} p-5`}>
      <div className="flex items-start justify-between gap-3">
        <div className="text-sm text-slate-500 dark:text-slate-400">{label}</div>
        {right}
      </div>
      <div
        className={`mt-1 text-2xl font-semibold tracking-tight ${
          accent ? "text-emerald-600 dark:text-emerald-400" : "text-slate-900 dark:text-white"
        }`}
      >
        {value}
      </div>
      <div className="mt-4 rounded-xl bg-slate-50 p-3 dark:bg-white/[0.03]">
        {rows.map((r, i) => (
          <div
            key={r.k}
            className={`grid grid-cols-2 gap-3 py-1.5 ${
              i > 0 ? "border-t border-slate-100 dark:border-white/[0.05]" : ""
            }`}
          >
            <div>
              <div className="text-xs text-slate-400">{r.k}</div>
              <div className="text-sm text-slate-700 dark:text-slate-200">{r.v}</div>
            </div>
            {r.k2 !== undefined && (
              <div>
                <div className="text-xs text-slate-400">{r.k2}</div>
                <div className="text-sm text-slate-700 dark:text-slate-200">{r.v2}</div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/** "1d 18h 51m 3s" from seconds; empty when the input is not usable. */
function durationLabel(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "—";
  const s = Math.floor(seconds);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  return [d ? `${d}d` : "", h ? `${h}h` : "", `${m}m`].filter(Boolean).join(" ");
}

function pct(part: string, whole: string): string {
  try {
    const w = BigInt(whole);
    if (w === 0n) return "—";
    return `${(Number((BigInt(part) * 10000n) / w) / 100).toFixed(2)}%`;
  } catch {
    return "—";
  }
}

export default function HomePage() {
  const { network } = useNetwork();
  const [stats, setStats] = useState<NetworkStats | null>(null);
  const [supplyBreakdown, setSupplyBreakdown] = useState<{
    total: string;
    circulating: string;
    nonCirculating: string;
    incomplete?: boolean;
  } | null>(null);
  const [status, setStatus] = useState<ChainStatus | null>(null);
  const [blocks, setBlocks] = useState<BlockSummary[] | null>(null);
  const [txs, setTxs] = useState<TxSummary[] | null>(null);
  const [validatorCount, setValidatorCount] = useState<number | null>(null);
  const [supply, setSupply] = useState<string | null>(null);
  const [bonded, setBonded] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const s = await fetchStatus().catch(
        (e): ChainStatus => ({ ok: false, error: String(e) }),
      );
      if (cancelled) return;
      setStatus(s);
      if (!s.ok) {
        // Endpoints down: resolve the lists to an honest empty state instead
        // of leaving them on a spinner forever.
        setBlocks([]);
        setTxs([]);
        return;
      }
      await Promise.all([
        fetchLatestBlocks(20).then((b) => !cancelled && setBlocks(b)).catch(() => undefined),
        fetchTxs("tx.height>0", 20).then((t) => !cancelled && setTxs(t)).catch(() => !cancelled && setTxs([])),
        fetchNetworkStats().then((n) => !cancelled && setStats(n)).catch(() => !cancelled && setStats(null)),
        // Server-computed and cached: ~120 upstream calls, not something to run
        // in every visitor's browser.
        fetch("/api/supply", { cache: "no-store" })
          .then((r) => r.json())
          .then((v) => !cancelled && setSupplyBreakdown(v))
          .catch(() => !cancelled && setSupplyBreakdown(null)),
        fetchValidators().then((v) => !cancelled && setValidatorCount(v.length)).catch(() => undefined),
        fetchSupply().then((v) => !cancelled && setSupply(v)).catch(() => undefined),
        fetchBondedTokens().then((v) => !cancelled && setBonded(v)).catch(() => undefined),
      ]);
    };
    load();
    const t = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  return (
    <div className="space-y-6 pb-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
          QoreChain Explorer
        </h1>
        <p className="mt-2 text-slate-500">
          Live view of {network.data.chainName} (
          <span className="font-mono">{network.data.chainId.cosmos}</span>) —
          straight from the chain&apos;s public endpoints.
        </p>
      </div>

      <SearchBar />

      {status && !status.ok && (
        <ErrorBanner
          message={`The ${network.label.toLowerCase()} public endpoints are not reachable right now (${status.error ?? "unknown error"}). Data will appear as soon as they respond.`}
        />
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatPanel
          label="QOR Supply"
          value={stats ? `${formatQor(stats.supply, 2)}` : supply ? formatQor(supply, 2) : "—"}
          rows={[
            {
              k: "Circulating Supply",
              v: supplyBreakdown
                ? `${formatQor(supplyBreakdown.circulating, 2)} QOR (${pct(
                    supplyBreakdown.circulating,
                    supplyBreakdown.total,
                  )})`
                : "—",
            },
            {
              k: "Non-circulating Supply",
              v: supplyBreakdown
                ? `${formatQor(supplyBreakdown.nonCirculating, 2)} QOR (${pct(
                    supplyBreakdown.nonCirculating,
                    supplyBreakdown.total,
                  )})`
                : "—",
            },
          ]}
        />

        <StatPanel
          label="Current Epoch"
          accent
          value={stats ? stats.epoch.toLocaleString() : "—"}
          right={
            stats ? (
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
                  <div
                    className="h-full rounded-full bg-emerald-500"
                    style={{ width: `${Math.min(100, stats.epochProgress * 100).toFixed(2)}%` }}
                  />
                </div>
                <span className="text-xs text-slate-400">
                  {(stats.epochProgress * 100).toFixed(2)}%
                </span>
              </div>
            ) : undefined
          }
          rows={[
            {
              k: "Block Range",
              v: stats
                ? `${stats.epochFirstBlock.toLocaleString()} to ${stats.epochLastBlock.toLocaleString()}`
                : "—",
            },
            {
              k: "Time Remain",
              v: stats ? durationLabel(stats.epochSecondsRemaining) : "—",
            },
          ]}
        />

        <StatPanel
          label="Network (Transactions)"
          value={stats ? stats.totalTxs.toLocaleString() : "—"}
          rows={[
            {
              k: "Block Height",
              v: stats ? stats.height.toLocaleString() : "—",
              k2: "Chain",
              v2: status?.chainId ?? "—",
            },
            {
              k: "TPS",
              v: stats ? stats.tps.toFixed(4) : "—",
              k2: "Block time",
              v2: stats && stats.blockSeconds > 0 ? `${stats.blockSeconds.toFixed(3)}s` : "—",
            },
          ]}
        />

        <StatPanel
          label="Total Stake (QOR)"
          value={stats ? formatQor(stats.bonded, 2) : bonded ? formatQor(bonded, 2) : "—"}
          rows={[
            {
              k: "Active Stake",
              v: stats
                ? `${formatQor(
                    (BigInt(stats.bonded) - BigInt(stats.delinquentStake)).toString(),
                    2,
                  )} QOR (${pct(
                    (BigInt(stats.bonded) - BigInt(stats.delinquentStake)).toString(),
                    stats.bonded,
                  )})`
                : "—",
            },
            {
              k: "Delinquent Stake",
              v: stats
                ? `${formatQor(stats.delinquentStake, 2)} QOR (${pct(stats.delinquentStake, stats.bonded)})`
                : "—",
              k2: "Validators",
              v2: stats ? `${stats.validatorCount - stats.jailedCount}/${stats.validatorCount} active` : "—",
            },
          ]}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className={`${CARD} p-5`}>
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
              <Box className="h-4 w-4 text-emerald-500" /> Latest blocks
            </div>
            <Link
              href="/blocks"
              className="text-xs font-medium text-emerald-600 hover:underline dark:text-emerald-400"
            >
              View all →
            </Link>
          </div>
          {blocks === null ? (
            <Spinner />
          ) : blocks.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">
              {status && !status.ok
                ? "Unavailable — the network endpoints are not responding."
                : "No blocks yet."}
            </p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-[#1a1f2e]">
              {blocks.map((b) => (
                <li key={b.height} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <Link
                    href={`/block/${b.height}`}
                    className="cursor-pointer font-mono font-semibold text-emerald-600 hover:underline dark:text-emerald-400"
                  >
                    #{Number(b.height).toLocaleString()}
                  </Link>
                  <span className="hidden font-mono text-xs text-slate-400 sm:inline">
                    {truncateMiddle(b.hash, 10)}
                  </span>
                  <span className="text-slate-500 dark:text-slate-400">
                    {b.txCount} tx{b.txCount === 1 ? "" : "s"}
                  </span>
                  <span className="text-xs text-slate-400">{timeAgo(b.time)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className={`${CARD} p-5`}>
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
              <Zap className="h-4 w-4 text-emerald-500" /> Latest transactions
            </div>
            <Link
              href="/txs"
              className="text-xs font-medium text-emerald-600 hover:underline dark:text-emerald-400"
            >
              View all →
            </Link>
          </div>
          {txs === null ? (
            <Spinner />
          ) : txs.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">
              {status && !status.ok
                ? "Unavailable — the network endpoints are not responding."
                : "No indexed transactions yet on this network."}
            </p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-[#1a1f2e]">
              {txs.map((t) => (
                <li key={t.hash} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <Link
                    href={`/tx/${t.hash}`}
                    className="cursor-pointer font-mono text-emerald-600 hover:underline dark:text-emerald-400"
                  >
                    {truncateMiddle(t.hash, 8)}
                  </Link>
                  <span className="flex min-w-0 flex-1 items-center gap-2">
                    <MessageTypeIcon type={t.messages[0]?.type ?? ""} />
                    <span className="truncate text-slate-500 dark:text-slate-400">
                      {t.messages.map((m) => m.type).join(", ") || "—"}
                    </span>
                    <SecurityShield tx={t} />
                  </span>
                  <span
                    className={`rounded-md px-1.5 py-0.5 text-xs font-semibold ${
                      t.code === 0
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : "bg-red-500/10 text-red-500"
                    }`}
                  >
                    {t.code === 0 ? "success" : `code ${t.code}`}
                  </span>
                  <span className="hidden text-xs text-slate-400 sm:inline">
                    {timeAgo(t.time)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <NetworkInfoPanel />
      <AddNetworkPanel />
    </div>
  );
}
