///// Date : 2026-08-26 | Changes : Blocks listing paginated, 100 per page, fetched per page (SCRUM-241) | Who : Liviu Epure
"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Boxes } from "lucide-react";

import { fetchBlocksFrom, fetchLatestBlock, type BlockSummary } from "@/lib/chain";
import { timeAgo, truncateMiddle } from "@/lib/format";
import { useNetwork } from "@/lib/network-provider";
import { CARD, ErrorBanner, Spinner } from "@/components/ui";
import { Pager } from "@/components/Pager";

const PAGE_SIZE = 100;

function BlocksInner() {
  const params = useSearchParams();
  const { network } = useNetwork();
  const page = Math.max(1, Number(params.get("page") ?? "1") || 1);

  const [blocks, setBlocks] = useState<BlockSummary[] | null>(null);
  const [tipHeight, setTipHeight] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setBlocks(null);
    setError(null);
    // Blocks have no list endpoint, so the page is a height window: the tip is
    // read once, then only the 100 heights on this page are requested.
    fetchLatestBlock()
      .then(async (tip) => {
        if (cancelled) return;
        setTipHeight(Number(tip.height));
        const top = BigInt(tip.height) - BigInt((page - 1) * PAGE_SIZE);
        if (top <= 0n) {
          setBlocks([]);
          return;
        }
        const b = await fetchBlocksFrom(top.toString(), PAGE_SIZE);
        if (!cancelled) setBlocks(b);
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      cancelled = true;
    };
  }, [page, network]);

  return (
    <div className="space-y-6 pb-8">
      <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
        <Boxes className="h-6 w-6 text-emerald-500" /> Blocks
      </h1>

      {error && <ErrorBanner message={`Blocks unavailable: ${error}`} />}
      {!error && blocks === null && <Spinner />}

      {blocks && (
        <div className={`${CARD} overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wider text-slate-400 dark:border-[#1a1f2e] dark:text-slate-500">
                  <th className="px-5 py-3">Height</th>
                  <th className="px-5 py-3">Hash</th>
                  <th className="px-5 py-3 text-right">Txs</th>
                  <th className="px-5 py-3 text-right">Age</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#1a1f2e]">
                {blocks.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-5 py-8 text-center text-slate-400">
                      No blocks on this page.
                    </td>
                  </tr>
                )}
                {blocks.map((b) => (
                  <tr key={b.height} className="hover:bg-slate-50/60 dark:hover:bg-white/[0.02]">
                    <td className="px-5 py-3">
                      <Link
                        href={`/block/${b.height}`}
                        className="font-medium text-emerald-600 hover:underline dark:text-emerald-400"
                      >
                        {Number(b.height).toLocaleString()}
                      </Link>
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-slate-500">
                      {truncateMiddle(b.hash, 20)}
                    </td>
                    <td className="px-5 py-3 text-right">{b.txCount}</td>
                    <td className="px-5 py-3 text-right text-slate-500">{timeAgo(b.time)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-slate-100 dark:border-[#1a1f2e]">
            <Pager
              page={page}
              pageSize={PAGE_SIZE}
              total={tipHeight}
              hrefFor={(p) => `/blocks?page=${p}`}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default function BlocksPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <BlocksInner />
    </Suspense>
  );
}
