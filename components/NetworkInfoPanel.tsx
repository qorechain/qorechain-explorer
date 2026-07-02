// components/NetworkInfoPanel.tsx
// Chain facts, public endpoints (copyable) and task-oriented docs links for
// the active network — every value from chain-data via the registry.

"use client";

import { BookOpen, Globe, Info, Layers, ShieldCheck } from "lucide-react";

import { useNetwork } from "@/lib/network-provider";
import { DOCS_LINK_GROUPS, docsUrl } from "@/lib/docs-links";
import { CARD, CopyValue, FactRow } from "@/components/ui";

export function NetworkInfoPanel() {
  const { network } = useNetwork();
  const data = network.data;

  const endpoints: Array<{ label: string; value: string | null }> = [
    { label: "Consensus RPC", value: network.rpc },
    { label: "REST / LCD", value: network.rest },
    { label: "EVM JSON-RPC", value: network.evmRpc },
    { label: "SVM JSON-RPC (read-only)", value: network.svmRpc },
    { label: "WebSocket", value: network.ws },
    { label: "EVM WebSocket", value: network.evmWs },
  ];

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
      <div className={`${CARD} p-5`}>
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
          <Info className="h-4 w-4 text-emerald-500" /> Chain facts — {data.chainName}
        </div>
        <FactRow label="Chain ID">
          <CopyValue value={data.chainId.cosmos} />
        </FactRow>
        <FactRow label="EVM chain ID">
          <CopyValue value={`${data.chainId.evm}`} display={`${data.chainId.evm} (${data.chainId.evmHex})`} />
        </FactRow>
        <FactRow label="Token">
          <span className="text-slate-700 dark:text-slate-300">
            {data.currency.display} (<span className="font-mono">{data.currency.cosmos.denom}</span>)
          </span>
        </FactRow>
        <FactRow label="Decimals">
          <span className="text-slate-700 dark:text-slate-300">
            {data.currency.cosmos.decimals} native · {data.currency.evm.decimals} EVM · {data.currency.svm.decimals} SVM
          </span>
        </FactRow>
        <FactRow label="Address prefix">
          <CopyValue value={data.bech32.account} />
        </FactRow>
        <FactRow label="Coin type (BIP-44)">
          <span className="font-mono text-slate-700 dark:text-slate-300">{data.slip44}</span>
        </FactRow>
        <FactRow label="Min gas price">
          <span className="font-mono text-slate-700 dark:text-slate-300">{data.fees.minGasPrice}</span>
        </FactRow>
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-emerald-500/5 p-3 text-xs text-slate-500 dark:text-slate-400">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
          <span>
            Hybrid post-quantum signatures (ML-DSA-87 + secp256k1) are enforced
            by default. One account, one balance across Cosmos / EVM / SVM: the
            qor1…, 0x…, and SVM addresses are the same 20 bytes.
          </span>
        </div>
      </div>

      <div className={`${CARD} p-5`}>
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
          <Globe className="h-4 w-4 text-emerald-500" /> Public endpoints — {network.label}
        </div>
        {endpoints.map(({ label, value }) => (
          <FactRow key={label} label={label}>
            {value ? (
              <CopyValue value={value} />
            ) : (
              <span className="text-slate-400 dark:text-slate-500">not available yet</span>
            )}
          </FactRow>
        ))}
        <p className="mt-3 text-xs text-slate-400 dark:text-slate-500">
          SVM writes are disabled at the public edge — state changes go through
          the chain (relayed transactions). See the API reference below for
          available methods.
        </p>
      </div>

      <div className={`${CARD} p-5`}>
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
          <BookOpen className="h-4 w-4 text-emerald-500" /> Guides & docs
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {DOCS_LINK_GROUPS.map((group) => (
            <div key={group.title}>
              <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                <Layers className="h-3 w-3" /> {group.title}
              </div>
              <ul className="space-y-1">
                {group.links.slice(0, 4).map((link) => (
                  <li key={link.path}>
                    <a
                      href={docsUrl(link.path)}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={link.description}
                      className="cursor-pointer text-sm text-slate-600 transition-colors hover:text-emerald-600 dark:text-slate-300 dark:hover:text-emerald-400"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
