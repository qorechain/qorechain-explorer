///// Date : 2026-07-02 | Changes : Explorer home — stats, latest blocks/txs, network info, add-to-wallet | Who : Liviu Epure
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Activity, Box, Coins, Landmark, Users, Zap } from "lucide-react";

import {
  fetchBondedTokens,
  fetchLatestBlocks,
  fetchStatus,
  fetchTxs,
  fetchValidators,
  fetchSupply,
  type BlockSummary,
  type ChainStatus,
  type TxSummary,
} from "@/lib/chain";
import { formatQor, timeAgo, truncateMiddle } from "@/lib/format";
import { useNetwork } from "@/lib/network-provider";
import { CARD, ErrorBanner, Spinner } from "@/components/ui";
import { SearchBar } from "@/components/SearchBar";
import { NetworkInfoPanel } from "@/components/NetworkInfoPanel";
import { AddNetworkPanel } from "@/components/AddNetworkPanel";

const REFRESH_MS = 6000;

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

export default function HomePage() {
  const { network } = useNetwork();
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
      if (!s.ok) return;
      await Promise.all([
        fetchLatestBlocks(8).then((b) => !cancelled && setBlocks(b)).catch(() => undefined),
        fetchTxs("tx.height>0", 10).then((t) => !cancelled && setTxs(t)).catch(() => !cancelled && setTxs([])),
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          icon={<Box className="h-5 w-5" />}
          label="Block height"
          value={status?.height ? Number(status.height).toLocaleString() : "—"}
          sub={status?.blockTime ? timeAgo(status.blockTime) : undefined}
        />
        <StatCard
          icon={<Activity className="h-5 w-5" />}
          label="Chain"
          value={status?.chainId ?? "—"}
          sub={status?.catchingUp ? "syncing" : status?.ok ? "live" : undefined}
        />
        <StatCard
          icon={<Users className="h-5 w-5" />}
          label="Validators"
          value={validatorCount !== null ? String(validatorCount) : "—"}
        />
        <StatCard
          icon={<Coins className="h-5 w-5" />}
          label="Supply"
          value={supply ? `${formatQor(supply, 0)} QOR` : "—"}
        />
        <StatCard
          icon={<Landmark className="h-5 w-5" />}
          label="Bonded"
          value={bonded ? `${formatQor(bonded, 0)} QOR` : "—"}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className={`${CARD} p-5`}>
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
            <Box className="h-4 w-4 text-emerald-500" /> Latest blocks
          </div>
          {blocks === null ? (
            <Spinner />
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
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
            <Zap className="h-4 w-4 text-emerald-500" /> Latest transactions
          </div>
          {txs === null ? (
            <Spinner />
          ) : txs.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">
              No indexed transactions yet on this network.
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
                  <span className="truncate text-slate-500 dark:text-slate-400">
                    {t.messages.map((m) => m.type).join(", ") || "—"}
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
