// components/SearchBar.tsx
// Height / tx hash / address search with client-side kind detection.

"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

import { searchRoute } from "@/lib/format";

export function SearchBar() {
  const router = useRouter();
  const [term, setTerm] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const route = searchRoute(term);
      if (route) {
        setError(null);
        router.push(route);
      } else {
        setError(
          "Enter a block height, a transaction hash, or a qor1… / 0x… address",
        );
      }
    },
    [term, router],
  );

  return (
    <form onSubmit={submit} className="w-full">
      <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm dark:border-[#1a1f2e] dark:bg-[#171925]">
        <Search className="ml-2 h-5 w-5 shrink-0 text-slate-400" />
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Search by block height, tx hash, or address (qor1… / 0x…)"
          className="w-full bg-transparent py-1.5 text-sm text-slate-800 outline-none placeholder:text-slate-400 dark:text-slate-200"
        />
        <button
          type="submit"
          className="cursor-pointer rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-500"
        >
          Search
        </button>
      </div>
      {error && (
        <p className="mt-1.5 text-xs text-red-500">{error}</p>
      )}
    </form>
  );
}
