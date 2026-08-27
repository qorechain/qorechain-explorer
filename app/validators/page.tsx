///// Date : 2026-08-27 | Changes : Validator set with rank, self-bond, delegators and signing record (SCRUM-243) | Who : Liviu Epure
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShieldCheck, ShieldAlert, Users } from "lucide-react";

import { formatQor, truncateMiddle } from "@/lib/format";
import { useNetwork } from "@/lib/network-provider";
import { CARD, ErrorBanner, Spinner } from "@/components/ui";
import type { ValidatorListResponse, ValidatorRow } from "@/app/api/validators/route";

/**
 * A validator has not "missed 0 of 10,000" if it has only existed for 470
 * blocks. Reporting uptime against a window the validator has not lived through
 * flatters newcomers and hides nothing about anyone else, so the denominator
 * here is always the number of blocks actually observed.
 */
function uptime(v: ValidatorRow): { label: string; pct: number | null; partial: boolean } {
  if (v.missedBlocks === null || v.observedBlocks === null || v.observedBlocks === 0) {
    return { label: "—", pct: null, partial: false };
  }
  const pct = Math.max(0, (1 - v.missedBlocks / v.observedBlocks) * 100);
  return {
    label: `${v.missedBlocks} / ${v.observedBlocks.toLocaleString()}`,
    pct,
    partial: v.windowBlocks !== null && v.observedBlocks < v.windowBlocks,
  };
}

function StatusBadge({ v }: { v: ValidatorRow }) {
  const cls = v.jailed
    ? "bg-red-500/10 text-red-500"
    : v.status === "BONDED"
      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
      : "bg-slate-500/10 text-slate-500";
  return (
    <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${cls}`}>
      {v.jailed ? "jailed" : v.status.toLowerCase()}
    </span>
  );
}

export default function ValidatorsPage() {
  const { network } = useNetwork();
  const [data, setData] = useState<ValidatorListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);
    fetch("/api/validators", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => !cancelled && (d.error ? setError(d.error) : setData(d)))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      cancelled = true;
    };
  }, [network]);

  return (
    <div className="space-y-6 pb-8">
      <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
        <Users className="h-6 w-6 text-emerald-500" /> Validators
      </h1>

      {error && <ErrorBanner message={`Validator set unavailable: ${error}`} />}
      {!error && data === null && <Spinner />}

      {data && (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Summary label="Active set" value={`${data.activeCount}${data.maxValidators ? ` / ${data.maxValidators}` : ""}`} />
            <Summary label="Bonded" value={`${formatQor(data.bondedTokens, 0)} QOR`} />
            <Summary
              label="Signing window"
              value={data.signedBlocksWindow.toLocaleString()}
              sub={`must sign ≥ ${(Number(data.minSignedPerWindow) * 100).toFixed(0)}%`}
            />
            <Summary
              label="Slash: downtime / double-sign"
              value={`${(Number(data.slashFractionDowntime) * 100).toFixed(0)}% / ${(Number(data.slashFractionDoubleSign) * 100).toFixed(0)}%`}
            />
          </div>

          <div className={`${CARD} overflow-hidden`}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wider text-slate-400 dark:border-[#1a1f2e] dark:text-slate-500">
                    <th className="px-4 py-3 text-right">#</th>
                    <th className="px-4 py-3">Validator</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Voting power</th>
                    <th className="px-4 py-3 text-right">Share</th>
                    <th className="px-4 py-3 text-right">Cumulative</th>
                    <th className="px-4 py-3 text-right">Self-bond</th>
                    <th className="px-4 py-3 text-right">Deleg.</th>
                    <th className="px-4 py-3 text-right">Commission</th>
                    <th className="px-4 py-3 text-right">Missed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#1a1f2e]">
                  {data.validators.map((v) => {
                    const up = uptime(v);
                    return (
                      <tr
                        key={v.operatorAddress}
                        className="hover:bg-slate-50/60 dark:hover:bg-white/[0.02]"
                      >
                        <td className="px-4 py-3 text-right text-slate-400">{v.rank}</td>
                        <td className="px-4 py-3">
                          <Link
                            href={`/validator/${v.operatorAddress}`}
                            className="flex items-center gap-2 font-medium text-emerald-600 hover:underline dark:text-emerald-400"
                          >
                            {v.jailed ? (
                              <ShieldAlert className="h-4 w-4 text-red-500" />
                            ) : (
                              <ShieldCheck className="h-4 w-4 text-emerald-500" />
                            )}
                            {v.moniker || truncateMiddle(v.operatorAddress, 10)}
                          </Link>
                          <div className="mt-0.5 font-mono text-xs text-slate-400">
                            {truncateMiddle(v.operatorAddress, 12)}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge v={v} />
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-slate-700 dark:text-slate-300">
                          {formatQor(v.tokens, 0)}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-500 dark:text-slate-400">
                          {v.sharePct.toFixed(2)}%
                        </td>
                        <td className="px-4 py-3 text-right text-slate-400">
                          {v.cumulativePct.toFixed(2)}%
                        </td>
                        <td className="px-4 py-3 text-right text-slate-500 dark:text-slate-400">
                          {v.selfBondPct !== null ? `${v.selfBondPct.toFixed(2)}%` : "—"}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-500 dark:text-slate-400">
                          {v.delegators ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-500 dark:text-slate-400">
                          {(Number(v.commissionRate) * 100).toFixed(0)}%
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span
                            className={
                              up.pct !== null && up.pct < 99
                                ? "text-amber-500"
                                : "text-slate-500 dark:text-slate-400"
                            }
                            title={
                              up.partial
                                ? `Only ${v.observedBlocks?.toLocaleString()} blocks observed of the ${v.windowBlocks?.toLocaleString()}-block window — this validator is new.`
                                : undefined
                            }
                          >
                            {up.label}
                            {up.partial && <span className="ml-1 text-xs text-slate-400">new</span>}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <p className="text-xs text-slate-400">
            Missed blocks are counted over the slashing window ({data.signedBlocksWindow.toLocaleString()}{" "}
            blocks). Validators marked <span className="font-medium">new</span> have existed for
            less than a full window, so their denominator is the blocks they have actually seen.
          </p>
        </>
      )}
    </div>
  );
}

function Summary({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className={`${CARD} p-4`}>
      <div className="text-xs uppercase tracking-wider text-slate-400">{label}</div>
      <div className="mt-1 font-mono text-lg text-slate-900 dark:text-white">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-slate-400">{sub}</div>}
    </div>
  );
}
