///// Date : 2026-08-27 | Changes : Validator detail — identity, stake, commission, signing record, delegators (SCRUM-243) | Who : Liviu Epure
"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Coins,
  Globe,
  Mail,
  Percent,
  ShieldAlert,
  ShieldCheck,
  Users,
} from "lucide-react";

import { formatQor, truncateMiddle } from "@/lib/format";
import { useNetwork } from "@/lib/network-provider";
import { CARD, CopyValue, ErrorBanner, FactRow, Spinner } from "@/components/ui";
import type { ValidatorDetail } from "@/app/api/validators/[addr]/route";

export default function ValidatorPage({ params }: { params: Promise<{ addr: string }> }) {
  const { addr } = use(params);
  const { network } = useNetwork();
  const [v, setV] = useState<ValidatorDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setV(null);
    setError(null);
    fetch(`/api/validators/${addr}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => !cancelled && (d.error ? setError(d.error) : setV(d)))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      cancelled = true;
    };
  }, [addr, network]);

  if (error) return <ErrorBanner message={`Validator unavailable: ${error}`} />;
  if (!v) return <Spinner />;

  const missed = v.signing.missedBlocks;
  const observed = v.signing.observedBlocks;
  const partialWindow = observed !== null && observed < v.signing.windowBlocks;
  const uptimePct =
    missed !== null && observed !== null && observed > 0
      ? Math.max(0, (1 - missed / observed) * 100)
      : null;

  // How many blocks it may still miss inside the window before being jailed.
  const allowedMisses =
    v.signing.windowBlocks > 0
      ? Math.floor(v.signing.windowBlocks * (1 - Number(v.slashing.minSignedPerWindow)))
      : null;

  return (
    <div className="space-y-6 pb-8">
      {/* header */}
      <div className={`${CARD} p-5`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
              {v.jailed ? (
                <ShieldAlert className="h-6 w-6 text-red-500" />
              ) : (
                <ShieldCheck className="h-6 w-6 text-emerald-500" />
              )}
              {v.moniker || truncateMiddle(v.operatorAddress, 14)}
            </h1>
            {v.details && (
              <p className="mt-2 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
                {v.details}
              </p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
              {v.website && (
                <a
                  href={v.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-emerald-600 hover:underline dark:text-emerald-400"
                >
                  <Globe className="h-4 w-4" /> {v.website.replace(/^https?:\/\//, "")}
                </a>
              )}
              {v.securityContact && (
                <span className="flex items-center gap-1 text-slate-500">
                  <Mail className="h-4 w-4" /> {v.securityContact}
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <span
              className={`rounded-md px-2.5 py-1 text-xs font-semibold ${
                v.jailed
                  ? "bg-red-500/10 text-red-500"
                  : v.status === "BONDED"
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : "bg-slate-500/10 text-slate-500"
              }`}
            >
              {v.jailed ? "jailed" : v.status.toLowerCase()}
            </span>
            {v.rank && <span className="text-sm text-slate-400">rank #{v.rank}</span>}
          </div>
        </div>
      </div>

      {v.signing.tombstoned && (
        <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-500">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <strong>Tombstoned.</strong> This validator double-signed. The status is permanent:
            it can never rejoin the active set, and its stake was slashed by{" "}
            {(Number(v.slashing.slashFractionDoubleSign) * 100).toFixed(0)}%.
          </span>
        </div>
      )}

      {/* headline numbers */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat
          icon={<Coins className="h-4 w-4" />}
          label="Voting power"
          value={`${formatQor(v.tokens, 0)} QOR`}
          sub={`${v.sharePct.toFixed(2)}% of bonded stake`}
        />
        <Stat
          icon={<ShieldCheck className="h-4 w-4" />}
          label="Self-bond"
          value={v.selfBond ? `${formatQor(v.selfBond, 0)} QOR` : "—"}
          sub={v.selfBondPct !== null ? `${v.selfBondPct.toFixed(2)}% of its own stake` : undefined}
        />
        <Stat
          icon={<Percent className="h-4 w-4" />}
          label="Commission"
          value={`${(Number(v.commission.rate) * 100).toFixed(1)}%`}
          sub={`max ${(Number(v.commission.maxRate) * 100).toFixed(0)}%, moves ≤ ${(Number(v.commission.maxChangeRate) * 100).toFixed(1)}%/day`}
        />
        <Stat
          icon={<Users className="h-4 w-4" />}
          label="Delegators"
          value={v.delegators !== null ? v.delegators.toLocaleString() : "—"}
          sub={v.unbondingCount > 0 ? `${v.unbondingCount} unbonding` : undefined}
        />
      </div>

      {/* signing record */}
      <div className={`${CARD} p-5`}>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">
          Signing record
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <div className="text-xs text-slate-400">Missed blocks</div>
            <div className="mt-1 font-mono text-2xl text-slate-900 dark:text-white">
              {missed !== null ? missed.toLocaleString() : "—"}
              <span className="text-base text-slate-400">
                {observed !== null ? ` / ${observed.toLocaleString()}` : ""}
              </span>
            </div>
            {uptimePct !== null && (
              <div className="mt-1 text-xs text-slate-500">{uptimePct.toFixed(3)}% signed</div>
            )}
          </div>
          <div>
            <div className="text-xs text-slate-400">Jailing threshold</div>
            <div className="mt-1 font-mono text-2xl text-slate-900 dark:text-white">
              {allowedMisses !== null ? allowedMisses.toLocaleString() : "—"}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              misses allowed per {v.signing.windowBlocks.toLocaleString()}-block window
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-400">Signing since</div>
            <div className="mt-1 font-mono text-2xl text-slate-900 dark:text-white">
              {v.signing.startHeight !== null ? v.signing.startHeight.toLocaleString() : "—"}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              chain is at {v.chainHeight.toLocaleString()}
            </div>
          </div>
        </div>
        {partialWindow && (
          <p className="mt-4 text-xs text-slate-400">
            This validator has existed for {observed?.toLocaleString()} blocks, less than the full{" "}
            {v.signing.windowBlocks.toLocaleString()}-block window. Its record is measured over the
            blocks it has actually seen, not over a window it was absent for.
          </p>
        )}
      </div>

      {/* addresses and parameters */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className={`${CARD} p-5`}>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">
            Addresses
          </h2>
          <div className="space-y-1">
            <FactRow label="Operator">
              <CopyValue value={v.operatorAddress} display={truncateMiddle(v.operatorAddress, 16)} />
            </FactRow>
            {v.accountAddress && (
              <FactRow label="Account">
                <Link
                  href={`/address/${v.accountAddress}`}
                  className="font-mono text-emerald-600 hover:underline dark:text-emerald-400"
                >
                  {truncateMiddle(v.accountAddress, 16)}
                </Link>
              </FactRow>
            )}
            {v.consensusAddress && (
              <FactRow label="Consensus">
                <CopyValue
                  value={v.consensusAddress}
                  display={truncateMiddle(v.consensusAddress, 16)}
                />
              </FactRow>
            )}
            {v.identity && <FactRow label="Identity">{v.identity}</FactRow>}
          </div>
        </div>

        <div className={`${CARD} p-5`}>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">
            Parameters and earnings
          </h2>
          <div className="space-y-1">
            <FactRow label="Min self-delegation">
              {formatQor(v.minSelfDelegation, 6)} QOR
            </FactRow>
            <FactRow label="Commission last changed">
              {v.commission.updateTime
                ? new Date(v.commission.updateTime).toLocaleDateString()
                : "—"}
            </FactRow>
            <FactRow label="Outstanding rewards">
              {v.outstandingRewards ? `${formatQor(v.outstandingRewards, 6)} QOR` : "—"}
            </FactRow>
            <FactRow label="Accrued commission">
              {v.accumulatedCommission ? `${formatQor(v.accumulatedCommission, 6)} QOR` : "—"}
            </FactRow>
            {v.jailed && v.signing.jailedUntil && (
              <FactRow label="Jailed until">
                {new Date(v.signing.jailedUntil).toLocaleString()}
              </FactRow>
            )}
          </div>
        </div>
      </div>

      {/* delegators */}
      {v.topDelegators.length > 0 && (
        <div className={`${CARD} overflow-hidden`}>
          <h2 className="px-5 pt-5 text-sm font-semibold uppercase tracking-wider text-slate-400">
            Largest delegators
          </h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wider text-slate-400 dark:border-[#1a1f2e] dark:text-slate-500">
                  <th className="px-5 py-3">Delegator</th>
                  <th className="px-5 py-3 text-right">Amount</th>
                  <th className="px-5 py-3 text-right">Share of validator</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#1a1f2e]">
                {v.topDelegators.map((d) => (
                  <tr key={d.address} className="hover:bg-slate-50/60 dark:hover:bg-white/[0.02]">
                    <td className="px-5 py-3">
                      <Link
                        href={`/address/${d.address}`}
                        className="font-mono text-emerald-600 hover:underline dark:text-emerald-400"
                      >
                        {truncateMiddle(d.address, 14)}
                      </Link>
                      {d.address === v.accountAddress && (
                        <span className="ml-2 rounded bg-emerald-500/10 px-1.5 py-0.5 text-xs text-emerald-600 dark:text-emerald-400">
                          self
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right font-mono text-slate-700 dark:text-slate-300">
                      {formatQor(d.amount, 2)} QOR
                    </td>
                    <td className="px-5 py-3 text-right text-slate-500 dark:text-slate-400">
                      {d.sharePct.toFixed(2)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {v.delegators !== null && v.delegators > v.topDelegators.length && (
            <p className="px-5 py-3 text-xs text-slate-400">
              Showing the {v.topDelegators.length} largest of {v.delegators.toLocaleString()}{" "}
              delegators.
            </p>
          )}
        </div>
      )}

      <div>
        <Link
          href="/validators"
          className="text-sm text-emerald-600 hover:underline dark:text-emerald-400"
        >
          ← All validators
        </Link>
      </div>
    </div>
  );
}

function Stat({
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
    <div className={`${CARD} p-4`}>
      <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-slate-400">
        {icon} {label}
      </div>
      <div className="mt-1.5 font-mono text-lg text-slate-900 dark:text-white">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-slate-400">{sub}</div>}
    </div>
  );
}
