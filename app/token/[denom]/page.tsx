///// Date : 2026-08-18 | Changes : Token detail by denom (SCRUM-223) | Who : Liviu Epure
"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { Coins } from "lucide-react";

import { fetchDenomSupply, type DenomSupply } from "@/lib/chain";
import { formatQor } from "@/lib/format";
import { CARD, CopyValue, ErrorBanner, FactRow, Spinner } from "@/components/ui";

export default function TokenPage({ params }: { params: Promise<{ denom: string }> }) {
  const { denom } = use(params);
  const decoded = decodeURIComponent(denom);
  const [token, setToken] = useState<DenomSupply | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchDenomSupply(decoded)
      .then((t) => !cancelled && setToken(t))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : String(e)));
    return () => { cancelled = true; };
  }, [decoded]);

  return (
    <div className="space-y-6 pb-8">
      <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
        <Coins className="h-6 w-6 text-emerald-500" /> Token
      </h1>
      {error && <ErrorBanner message={`Token unavailable: ${error}`} />}
      {!error && token === undefined && <Spinner />}
      {token === null && !error && (
        <div className={`${CARD} p-6 text-sm text-slate-600 dark:text-slate-300`}>
          No on-chain supply found for this denom on the selected network.{" "}
          <Link href="/tokens" className="text-emerald-600 hover:underline dark:text-emerald-400">Browse all tokens</Link>
        </div>
      )}
      {token && (
        <div className={CARD}>
          <FactRow label="Denom"><CopyValue value={token.denom} /></FactRow>
          <FactRow label="On-chain supply">
            <span className="font-mono">{token.denom === "uqor" ? `${formatQor(token.amount)} QOR` : token.amount}</span>
          </FactRow>
        </div>
      )}
    </div>
  );
}
