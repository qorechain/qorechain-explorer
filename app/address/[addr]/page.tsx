///// Date : 2026-07-02 | Changes : Address page — unified identity + balances across the 3 VMs | Who : Liviu Epure
"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { Boxes, Landmark, ShieldCheck, Wallet } from "lucide-react";

import {
  evmCall,
  fetchAccountInfo,
  fetchBankBalance,
  fetchTxs,
  svmCall,
  type TxSummary,
} from "@/lib/chain";
import { formatQor, timeAgo, truncateMiddle } from "@/lib/format";
import { useNetwork } from "@/lib/network-provider";
import {
  bech32FromEvmAddress,
  evmAddressFromBech32,
  svmAddressFromBech32,
} from "@/lib/wallet";
import { moduleLabel } from "@/lib/modules";
import { CARD, CopyValue, ErrorBanner, FactRow, Spinner } from "@/components/ui";

interface Balances {
  uqor: string | null;
  wei: string | null;
  lamports: string | null;
}

export default function AddressPage({
  params,
}: {
  params: Promise<{ addr: string }>;
}) {
  const { addr } = use(params);
  const { network } = useNetwork();
  const [error, setError] = useState<string | null>(null);
  const [qorAddress, setQorAddress] = useState<string | null>(null);
  const [balances, setBalances] = useState<Balances | null>(null);
  const [account, setAccount] = useState<{ accountNumber: string; sequence: string } | null>(null);
  const [txs, setTxs] = useState<TxSummary[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setBalances(null);
    setTxs(null);
    try {
      const decoded = decodeURIComponent(addr);
      const qor = decoded.startsWith("0x")
        ? bech32FromEvmAddress(decoded)
        : decoded;
      // validates + derives the other representations
      evmAddressFromBech32(qor);
      setQorAddress(qor);

      const load = async () => {
        const [uqor, acc, wei, lamports, list] = await Promise.all([
          // null (not "0") when the LCD is unreachable — zeros would lie.
          fetchBankBalance(qor).catch(() => null),
          fetchAccountInfo(qor),
          evmCall<string>("eth_getBalance", [evmAddressFromBech32(qor), "latest"])
            .then((h) => BigInt(h).toString())
            .catch(() => null),
          svmCall<{ value: number | string }>("getBalance", [svmAddressFromBech32(qor)])
            .then((r) => String(r.value))
            .catch(() => null),
          fetchTxs(`message.sender='${qor}'`, 10).catch(() => []),
        ]);
        if (cancelled) return;
        setBalances({ uqor, wei, lamports });
        setAccount(acc);
        setTxs(list);
      };
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    return () => {
      cancelled = true;
    };
  }, [addr]);

  if (error) {
    return (
      <div className="space-y-6 pb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">Address</h1>
        <ErrorBanner message={`Not a valid QoreChain address: ${error}`} />
      </div>
    );
  }

  const evmAddr = qorAddress ? evmAddressFromBech32(qorAddress) : null;
  const svmAddr = qorAddress ? svmAddressFromBech32(qorAddress) : null;
  const parity =
    balances?.lamports != null &&
    balances?.uqor != null &&
    BigInt(balances.lamports) ===
      BigInt(balances.uqor) * BigInt(network.data.currency.svm.lamportsPerUqor);

  return (
    <div className="space-y-6 pb-8">
      <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
        <Wallet className="h-6 w-6 text-emerald-500" /> Account
      </h1>

      {qorAddress && moduleLabel(qorAddress) && (
        <div className="flex items-start gap-2 rounded-xl border border-sky-500/30 bg-sky-500/10 p-4 text-sm text-sky-700 dark:text-sky-300">
          <Boxes className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <span className="font-semibold">
              {moduleLabel(qorAddress)} module account
            </span>{" "}
            — this is a protocol-owned account, not a user wallet. It has no
            private key and no one can spend from it directly; its balance is
            moved only by chain logic (e.g. escrow during EVM transfers, fee
            collection, staking pools).
          </div>
        </div>
      )}

      {!qorAddress || !balances ? (
        <Spinner />
      ) : (
        <>
          <div className={`${CARD} p-5`}>
            <div className="mb-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
              One account, three representations
            </div>
            <FactRow label="Cosmos (bech32)">
              <CopyValue value={qorAddress} display={truncateMiddle(qorAddress, 14)} />
            </FactRow>
            <FactRow label="EVM (hex)">
              <CopyValue value={evmAddr!} display={truncateMiddle(evmAddr!, 12)} />
            </FactRow>
            <FactRow label="SVM (base58)">
              <CopyValue value={svmAddr!} display={truncateMiddle(svmAddr!, 12)} />
            </FactRow>
            {account && (
              <>
                <FactRow label="Account number">
                  <span className="font-mono text-slate-700 dark:text-slate-300">{account.accountNumber}</span>
                </FactRow>
                <FactRow label="Sequence">
                  <span className="font-mono text-slate-700 dark:text-slate-300">{account.sequence}</span>
                </FactRow>
              </>
            )}
          </div>

          <div className={`${CARD} p-5`}>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
              <Landmark className="h-4 w-4 text-emerald-500" /> One balance, read by every VM
            </div>
            <FactRow label={`Cosmos (${network.data.currency.cosmos.denom}, 6 dec)`}>
              <span className="font-mono text-slate-700 dark:text-slate-300">
                {balances.uqor != null
                  ? `${formatQor(balances.uqor, 6)} QOR`
                  : "endpoint unavailable"}
              </span>
            </FactRow>
            <FactRow label="EVM (wei, 18 dec)">
              <span className="font-mono text-slate-700 dark:text-slate-300">
                {balances.wei != null ? balances.wei : "endpoint unavailable"}
              </span>
            </FactRow>
            <FactRow label="SVM (lamports, 9 dec)">
              <span className="font-mono text-slate-700 dark:text-slate-300">
                {balances.lamports != null ? balances.lamports : "endpoint unavailable"}
              </span>
            </FactRow>
            {balances.lamports != null && balances.uqor != null && (
              <div
                className={`mt-3 flex items-center gap-2 rounded-lg p-3 text-xs ${
                  parity
                    ? "bg-emerald-500/5 text-slate-500 dark:text-slate-400"
                    : "bg-amber-500/10 text-amber-700 dark:text-amber-300"
                }`}
              >
                <ShieldCheck className={`h-4 w-4 shrink-0 ${parity ? "text-emerald-500" : "text-amber-500"}`} />
                {parity
                  ? "Cross-VM parity verified: lamports = uqor × 1000."
                  : "Cross-VM parity mismatch — values read at slightly different heights; refresh to re-check."}
              </div>
            )}
          </div>

          <div className={`${CARD} p-5`}>
            <div className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">
              Recent transactions (as sender)
            </div>
            {txs === null ? (
              <Spinner />
            ) : txs.length === 0 ? (
              <p className="py-4 text-sm text-slate-400">No indexed transactions from this account.</p>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-[#1a1f2e]">
                {txs.map((t) => (
                  <li key={t.hash} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <Link
                      href={`/tx/${t.hash}`}
                      className="cursor-pointer font-mono text-emerald-600 hover:underline dark:text-emerald-400"
                    >
                      {truncateMiddle(t.hash, 8)}
                    </Link>
                    <span className="truncate text-slate-500 dark:text-slate-400">
                      {t.messages.map((m) => m.type).join(", ")}
                    </span>
                    <span className="text-xs text-slate-400">{timeAgo(t.time)}</span>
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
