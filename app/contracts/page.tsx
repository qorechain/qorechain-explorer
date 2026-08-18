///// Date : 2026-08-18 | Changes : CosmWasm contracts (uploaded codes) listing (SCRUM-223) | Who : Liviu Epure
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FileCode2 } from "lucide-react";

import { fetchWasmCodes, type WasmCodeInfo } from "@/lib/chain";
import { truncateMiddle } from "@/lib/format";
import { CARD, ErrorBanner, Spinner } from "@/components/ui";

export default function ContractsPage() {
  const [codes, setCodes] = useState<WasmCodeInfo[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchWasmCodes()
      .then((c) => !cancelled && setCodes(c))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : String(e)));
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="space-y-6 pb-8">
      <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
        <FileCode2 className="h-6 w-6 text-emerald-500" /> Smart contracts
      </h1>
      <p className="text-sm text-slate-500 dark:text-slate-400">
        CosmWasm code uploaded on the selected network, newest first.
      </p>
      {error && <ErrorBanner message={`Contract list unavailable: ${error}`} />}
      {!error && codes === null && <Spinner />}
      {codes && codes.length === 0 && (
        <div className={`${CARD} p-6 text-sm text-slate-600 dark:text-slate-300`}>No contract code uploaded yet on this network.</div>
      )}
      {codes && codes.length > 0 && (
        <div className={`${CARD} overflow-x-auto`}>
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wider text-slate-400 dark:border-[#1a1f2e] dark:text-slate-500">
                <th className="px-5 py-3">Code ID</th>
                <th className="px-5 py-3">Creator</th>
                <th className="px-5 py-3">Checksum</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#1a1f2e]">
              {codes.map((c) => (
                <tr key={c.codeId}>
                  <td className="px-5 py-3 font-medium">{c.codeId}</td>
                  <td className="px-5 py-3">
                    <Link href={`/address/${c.creator}`} className="font-mono text-xs text-emerald-600 hover:underline dark:text-emerald-400">
                      {truncateMiddle(c.creator, 24)}
                    </Link>
                  </td>
                  <td className="px-5 py-3 font-mono text-xs text-slate-500">{truncateMiddle(c.dataHash, 20)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
