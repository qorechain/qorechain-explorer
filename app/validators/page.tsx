///// Date : 2026-07-02 | Changes : Validators page | Who : Liviu Epure
"use client";

import { useEffect, useState } from "react";
import { ShieldCheck, Users } from "lucide-react";

import { fetchValidators, type ValidatorSummary } from "@/lib/chain";
import { formatQor, truncateMiddle } from "@/lib/format";
import { CARD, CopyValue, ErrorBanner, Spinner } from "@/components/ui";

export default function ValidatorsPage() {
  const [validators, setValidators] = useState<ValidatorSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchValidators()
      .then((v) => !cancelled && setValidators(v))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      cancelled = true;
    };
  }, []);

  const total = validators?.reduce((acc, v) => acc + BigInt(v.tokens), 0n) ?? 0n;

  return (
    <div className="space-y-6 pb-8">
      <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
        <Users className="h-6 w-6 text-emerald-500" /> Validators
      </h1>

      {error && <ErrorBanner message={`Validator set unavailable: ${error}`} />}
      {!error && validators === null && <Spinner />}

      {validators && (
        <div className={`${CARD} overflow-x-auto`}>
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wider text-slate-400 dark:border-[#1a1f2e] dark:text-slate-500">
                <th className="px-5 py-3">Validator</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Voting power</th>
                <th className="px-5 py-3 text-right">Share</th>
                <th className="px-5 py-3 text-right">Commission</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#1a1f2e]">
              {validators.map((v) => {
                const share =
                  total > 0n ? Number((BigInt(v.tokens) * 10000n) / total) / 100 : 0;
                return (
                  <tr key={v.operatorAddress}>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2 font-medium text-slate-800 dark:text-slate-200">
                        <ShieldCheck className="h-4 w-4 text-emerald-500" />
                        {v.moniker}
                      </div>
                      <div className="mt-0.5 text-xs">
                        <CopyValue
                          value={v.operatorAddress}
                          display={truncateMiddle(v.operatorAddress, 14)}
                        />
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`rounded-md px-2 py-0.5 text-xs font-semibold ${
                          v.jailed
                            ? "bg-red-500/10 text-red-500"
                            : v.status === "BONDED"
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                              : "bg-slate-500/10 text-slate-500"
                        }`}
                      >
                        {v.jailed ? "jailed" : v.status.toLowerCase()}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right font-mono text-slate-700 dark:text-slate-300">
                      {formatQor(v.tokens, 0)} QOR
                    </td>
                    <td className="px-5 py-3 text-right text-slate-500 dark:text-slate-400">
                      {share.toFixed(2)}%
                    </td>
                    <td className="px-5 py-3 text-right text-slate-500 dark:text-slate-400">
                      {(Number(v.commission) * 100).toFixed(0)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
