///// Date : 2026-08-26 | Changes : All-transactions listing, 100 per page, server-paged (SCRUM-241) | Who : Liviu Epure
"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Zap } from "lucide-react";

import { fetchTxPage, type TxSummary } from "@/lib/chain";
import { timeAgo, truncateMiddle } from "@/lib/format";
import { useNetwork } from "@/lib/network-provider";
import { CARD, ErrorBanner, Spinner } from "@/components/ui";
import { Pager } from "@/components/Pager";

const PAGE_SIZE = 100;

function TxsInner() {
  const params = useSearchParams();
  const { network } = useNetwork();
  const page = Math.max(1, Number(params.get("page") ?? "1") || 1);

  const [txs, setTxs] = useState<TxSummary[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setTxs(null);
    setError(null);
    // One request, one page. Nothing outside the visible 100 is fetched.
    fetchTxPage(page, PAGE_SIZE)
      .then((r) => {
        if (cancelled) return;
        setTxs(r.txs);
        setTotal(r.total);
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      cancelled = true;
    };
  }, [page, network]);

  return (
    <div className="space-y-6 pb-8">
      <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
        <Zap className="h-6 w-6 text-emerald-500" /> Transactions
      </h1>

      {error && <ErrorBanner message={`Transactions unavailable: ${error}`} />}
      {!error && txs === null && <Spinner />}

      {txs && (
        <div className={`${CARD} overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wider text-slate-400 dark:border-[#1a1f2e] dark:text-slate-500">
                  <th className="px-5 py-3">Hash</th>
                  <th className="px-5 py-3">Type</th>
                  <th className="px-5 py-3 text-right">Height</th>
                  <th className="px-5 py-3 text-right">Result</th>
                  <th className="px-5 py-3 text-right">Fee</th>
                  <th className="px-5 py-3 text-right">Age</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#1a1f2e]">
                {txs.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-slate-400">
                      No transactions on this page.
                    </td>
                  </tr>
                )}
                {txs.map((t) => (
                  <tr key={t.hash} className="hover:bg-slate-50/60 dark:hover:bg-white/[0.02]">
                    <td className="px-5 py-3">
                      <Link
                        href={`/tx/${t.hash}`}
                        className="font-mono text-emerald-600 hover:underline dark:text-emerald-400"
                      >
                        {truncateMiddle(t.hash, 10)}
                      </Link>
                    </td>
                    <td className="max-w-[280px] truncate px-5 py-3 text-slate-500 dark:text-slate-400">
                      {t.messages.map((m) => m.type).join(", ") || "—"}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Link
                        href={`/block/${t.height}`}
                        className="text-emerald-600 hover:underline dark:text-emerald-400"
                      >
                        {Number(t.height).toLocaleString()}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <span
                        className={`rounded-md px-1.5 py-0.5 text-xs font-semibold ${
                          t.code === 0
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : "bg-red-500/10 text-red-500"
                        }`}
                      >
                        {t.code === 0 ? "success" : `code ${t.code}`}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right font-mono text-xs text-slate-500">
                      {t.fee || "—"}
                    </td>
                    <td className="px-5 py-3 text-right text-slate-500">{timeAgo(t.time)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-slate-100 dark:border-[#1a1f2e]">
            <Pager
              page={page}
              pageSize={PAGE_SIZE}
              total={total}
              hrefFor={(p) => `/txs?page=${p}`}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default function TxsPage() {
  // useSearchParams needs a Suspense boundary for static generation.
  return (
    <Suspense fallback={<Spinner />}>
      <TxsInner />
    </Suspense>
  );
}
