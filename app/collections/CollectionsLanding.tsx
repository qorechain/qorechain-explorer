///// Date : 2026-08-18 | Changes : Graceful landing for collection/NFT links (SCRUM-223 — iOS wallet linked a 404) | Who : Liviu Epure
import Link from "next/link";
import { Images } from "lucide-react";

export function CollectionsLanding() {
  const CARD = "rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-[#1a1f2e] dark:bg-[#10131c]";
  return (
    <div className="space-y-6 pb-8">
      <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
        <Images className="h-6 w-6 text-emerald-500" /> Collections
      </h1>
      <div className={`${CARD} p-6 text-sm leading-6 text-slate-600 dark:text-slate-300`}>
        <p>
          Collection browsing is coming to the explorer. Until then you can look up any
          account&apos;s full on-chain activity and holdings:
        </p>
        <ul className="mt-3 list-disc pl-5">
          <li><Link href="/" className="text-emerald-600 hover:underline dark:text-emerald-400">Search an address, tx, or block</Link></li>
          <li><Link href="/tokens" className="text-emerald-600 hover:underline dark:text-emerald-400">Browse on-chain tokens</Link></li>
          <li><Link href="/contracts" className="text-emerald-600 hover:underline dark:text-emerald-400">Browse smart contracts</Link></li>
        </ul>
      </div>
    </div>
  );
}
