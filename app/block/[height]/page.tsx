///// Date : 2026-07-02 | Changes : Block detail page | Who : Liviu Epure
"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { fetchBlock, txHashFromBase64, type BlockSummary } from "@/lib/chain";
import { timeAgo, truncateMiddle } from "@/lib/format";
import { CARD, CopyValue, ErrorBanner, FactRow, Spinner } from "@/components/ui";

export default function BlockPage({
  params,
}: {
  params: Promise<{ height: string }>;
}) {
  const { height } = use(params);
  const [block, setBlock] = useState<BlockSummary | null>(null);
  const [txHashes, setTxHashes] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setBlock(null);
    setError(null);
    setTxHashes(null);
    fetchBlock(height)
      .then(async (b) => {
        if (cancelled) return;
        setBlock(b);
        const hashes = await Promise.all(b.rawTxs.map(txHashFromBase64));
        if (!cancelled) setTxHashes(hashes);
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      cancelled = true;
    };
  }, [height]);

  return (
    <div className="space-y-6 pb-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
          Block <span className="font-mono">#{Number(height).toLocaleString()}</span>
        </h1>
        <div className="flex gap-2">
          <Link
            href={`/block/${Math.max(1, Number(height) - 1)}`}
            className="cursor-pointer rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-black/5 dark:border-[#1a1f2e] dark:hover:bg-white/10"
            aria-label="Previous block"
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <Link
            href={`/block/${Number(height) + 1}`}
            className="cursor-pointer rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-black/5 dark:border-[#1a1f2e] dark:hover:bg-white/10"
            aria-label="Next block"
          >
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {error && (
        <ErrorBanner message={`Block not available: ${error}. It may not be minted yet on this network.`} />
      )}
      {!error && !block && <Spinner />}

      {block && (
        <>
          <div className={`${CARD} p-5`}>
            <FactRow label="Height">
              <span className="font-mono text-slate-700 dark:text-slate-300">
                {Number(block.height).toLocaleString()}
              </span>
            </FactRow>
            <FactRow label="Hash">
              <CopyValue value={block.hash} display={truncateMiddle(block.hash, 16)} />
            </FactRow>
            <FactRow label="Time">
              <span className="text-slate-700 dark:text-slate-300">
                {new Date(block.time).toLocaleString()} ({timeAgo(block.time)})
              </span>
            </FactRow>
            <FactRow label="Proposer">
              <CopyValue value={block.proposer} display={truncateMiddle(block.proposer, 12)} />
            </FactRow>
            <FactRow label="Transactions">
              <span className="text-slate-700 dark:text-slate-300">{block.txCount}</span>
            </FactRow>
          </div>

          <div className={`${CARD} p-5`}>
            <div className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">
              Transactions in this block
            </div>
            {block.txCount === 0 ? (
              <p className="py-4 text-sm text-slate-400">No transactions.</p>
            ) : txHashes === null ? (
              <Spinner />
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-[#1a1f2e]">
                {txHashes.map((h) => (
                  <li key={h} className="py-2.5">
                    <Link
                      href={`/tx/${h}`}
                      className="cursor-pointer font-mono text-sm text-emerald-600 hover:underline dark:text-emerald-400"
                    >
                      {h}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
