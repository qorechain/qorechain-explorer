///// Date : 2026-08-18 | Changes : Shared token/asset listing (SCRUM-223) | Who : Liviu Epure
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Coins } from "lucide-react";

import { fetchTokenList, type DenomSupply } from "@/lib/chain";
import { formatQor } from "@/lib/format";
import { CARD, ErrorBanner, Spinner } from "@/components/ui";

function supplyLabel(t: DenomSupply): string {
  if (t.denom === "uqor") return `${formatQor(t.amount)} QOR`;
  return t.amount;
}

export function TokenListPage({ title }: { title: string }) {
  const [tokens, setTokens] = useState<DenomSupply[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchTokenList()
      .then((t) => !cancelled && setTokens(t))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : String(e)));
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="space-y-6 pb-8">
      <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
        <Coins className="h-6 w-6 text-emerald-500" /> {title}
      </h1>
      {error && <ErrorBanner message={`Token list unavailable: ${error}`} />}
      {!error && tokens === null && <Spinner />}
      {tokens && (
        <div className={`${CARD} overflow-x-auto`}>
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wider text-slate-400 dark:border-[#1a1f2e] dark:text-slate-500">
                <th className="px-5 py-3">Denom</th>
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3 text-right">On-chain supply</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#1a1f2e]">
              {tokens.map((t) => (
                <tr key={t.denom}>
                  <td className="px-5 py-3">
                    <Link href={`/token/${encodeURIComponent(t.denom)}`} className="font-mono text-xs text-emerald-600 hover:underline dark:text-emerald-400">
                      {t.denom.length > 40 ? `${t.denom.slice(0, 40)}…` : t.denom}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-slate-600 dark:text-slate-300">
                    {t.name || t.symbol || (t.denom === "uqor" ? "QOR (native)" : "—")}
                  </td>
                  <td className="px-5 py-3 text-right font-mono text-xs">{supplyLabel(t)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
