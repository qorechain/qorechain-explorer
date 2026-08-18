///// Date : 2026-08-18 | Changes : Blocks listing page (SCRUM-223 — routes linked externally) | Who : Liviu Epure
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Boxes } from "lucide-react";

import { fetchLatestBlocks, type BlockSummary } from "@/lib/chain";
import { timeAgo, truncateMiddle } from "@/lib/format";
import { CARD, ErrorBanner, Spinner } from "@/components/ui";

export default function BlocksPage() {
  const [blocks, setBlocks] = useState<BlockSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchLatestBlocks(20)
      .then((b) => !cancelled && setBlocks(b))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : String(e)));
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="space-y-6 pb-8">
      <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
        <Boxes className="h-6 w-6 text-emerald-500" /> Latest blocks
      </h1>
      {error && <ErrorBanner message={`Blocks unavailable: ${error}`} />}
      {!error && blocks === null && <Spinner />}
      {blocks && (
        <div className={`${CARD} overflow-x-auto`}>
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
              {blocks.map((b) => (
                <tr key={b.height}>
                  <td className="px-5 py-3">
                    <Link href={`/block/${b.height}`} className="font-medium text-emerald-600 hover:underline dark:text-emerald-400">
                      {b.height}
                    </Link>
                  </td>
                  <td className="px-5 py-3 font-mono text-xs text-slate-500">{truncateMiddle(b.hash, 20)}</td>
                  <td className="px-5 py-3 text-right">{b.txCount}</td>
                  <td className="px-5 py-3 text-right text-slate-500">{timeAgo(b.time)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
