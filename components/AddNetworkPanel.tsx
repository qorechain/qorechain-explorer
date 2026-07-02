// components/AddNetworkPanel.tsx
// "Add QoreChain to your wallet" — Cosmos rail (Keplr/Leap/Cosmostation via
// suggestChain), EVM rail (MetaMask/Rabby/Trust/Coinbase/OKX via EIP-3085),
// SVM rail (custom RPC), and WalletConnect v2 pairing for mobile wallets.
// Account-scoped flows (Phantom authenticator linking) live in the dashboard.

"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Check,
  Copy,
  ExternalLink,
  Globe,
  Loader2,
  PlugZap,
  Smartphone,
} from "lucide-react";

import { useNetwork } from "@/lib/network-provider";
import { DASHBOARD_ORIGIN } from "@/lib/registry";
import {
  addCosmosChain,
  addEvmChain,
  detectWalletProviders,
  type CosmosWalletId,
  type DetectedProviders,
} from "@/lib/wallet";
import {
  createWalletConnectPairing,
  walletConnectConfigured,
} from "@/lib/walletconnect";
import { CARD } from "@/components/ui";

type ActionState =
  | { kind: "idle" }
  | { kind: "busy"; id: string }
  | { kind: "done"; id: string; message: string }
  | { kind: "error"; id: string; message: string };

const COSMOS_WALLETS: Array<{ id: CosmosWalletId; label: string; install: string }> = [
  { id: "keplr", label: "Keplr", install: "https://www.keplr.app/download" },
  { id: "leap", label: "Leap", install: "https://www.leapwallet.io/download" },
  { id: "cosmostation", label: "Cosmostation", install: "https://cosmostation.io/products/cosmostation_extension" },
];

const EVM_WALLET_LABELS: Record<string, string> = {
  metamask: "MetaMask",
  rabby: "Rabby",
  trust: "Trust Wallet",
  coinbase: "Coinbase Wallet",
  okx: "OKX Wallet",
  unknown: "EVM wallet",
};

export function AddNetworkPanel() {
  const { network, networkId } = useNetwork();
  const [providers, setProviders] = useState<DetectedProviders | null>(null);
  const [action, setAction] = useState<ActionState>({ kind: "idle" });
  const [wcQr, setWcQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      if (!cancelled) setProviders(detectWalletProviders());
    });
    return () => {
      cancelled = true;
    };
  }, [networkId]);

  const run = useCallback(async (id: string, fn: () => Promise<string>) => {
    setAction({ kind: "busy", id });
    try {
      const message = await fn();
      setAction({ kind: "done", id, message });
    } catch (e) {
      setAction({
        kind: "error",
        id,
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }, []);

  const feedbackFor = (prefix: string) =>
    action.kind !== "idle" && action.id.startsWith(prefix) ? action : null;

  const copySvmRpc = useCallback(async () => {
    if (!network.svmRpc) return;
    await navigator.clipboard.writeText(network.svmRpc);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [network.svmRpc]);

  return (
    <div className={`${CARD} p-5`}>
      <div className="mb-1 flex items-center gap-2">
        <PlugZap className="h-5 w-5 text-emerald-500" />
        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
          Add {network.data.chainName} to your wallet
        </h3>
      </div>
      <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
        Chain ID <code className="font-mono">{network.data.chainId.cosmos}</code> · EVM{" "}
        <code className="font-mono">{network.data.chainId.evm}</code> · QOR
      </p>

      <Section title="Cosmos wallets" subtitle="Adds the chain via suggestChain">
        <div className="flex flex-wrap gap-2">
          {COSMOS_WALLETS.map(({ id, label, install }) =>
            providers?.cosmos.includes(id) ? (
              <ActionButton
                key={id}
                id={`cosmos:${id}`}
                label={`Add to ${label}`}
                action={action}
                onClick={() =>
                  run(`cosmos:${id}`, async () => {
                    await addCosmosChain(id, networkId);
                    return `${network.data.chainId.cosmos} added to ${label}`;
                  })
                }
              />
            ) : (
              <a
                key={id}
                href={install}
                target="_blank"
                rel="noopener noreferrer"
                className="cursor-pointer rounded-lg border border-dashed border-slate-300 px-3 py-1.5 text-sm text-slate-500 hover:border-slate-400 dark:border-slate-700 dark:text-slate-400"
              >
                Install {label}
              </a>
            ),
          )}
        </div>
        <Feedback state={feedbackFor("cosmos:")} />
      </Section>

      <Section
        title="EVM wallets"
        subtitle="MetaMask, Rabby, Trust, Coinbase Wallet, OKX — one add-chain call"
      >
        <div className="flex flex-wrap items-center gap-2">
          <ActionButton
            id="evm"
            label={
              providers?.evm.length
                ? `Add to ${providers.evm.map((f) => EVM_WALLET_LABELS[f]).join(" / ")}`
                : "Add to EVM wallet"
            }
            disabled={!providers?.evm.length}
            action={action}
            onClick={() =>
              run("evm", async () => {
                await addEvmChain(networkId);
                return `EVM chain ${network.data.chainId.evm} added`;
              })
            }
          />
          {!providers?.evm.length && (
            <span className="text-sm text-slate-500 dark:text-slate-400">
              No EVM wallet extension detected
            </span>
          )}
        </div>
        <Feedback state={feedbackFor("evm")} />
      </Section>

      <Section
        title="SVM wallets"
        subtitle="Solflare / Backpack / Phantom — custom RPC, reads only"
      >
        {network.svmRpc ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-slate-400" />
              <code className="rounded bg-slate-100 px-2 py-0.5 font-mono text-sm dark:bg-[#0f1620]">
                {network.svmRpc}
              </code>
              <button
                type="button"
                onClick={copySvmRpc}
                className="cursor-pointer rounded p-1 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                aria-label="Copy SVM RPC URL"
              >
                {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Set as a custom RPC in Solflare, Backpack, or Phantom developer
              settings. Your SVM address is your account&apos;s 20 bytes,
              base58-encoded — the same balance as your qor1… / 0x… address.
              Linking Phantom as an account authenticator happens in the{" "}
              <a
                href={`${DASHBOARD_ORIGIN}/wallet`}
                target="_blank"
                rel="noopener noreferrer"
                className="cursor-pointer inline-flex items-center gap-0.5 text-emerald-600 hover:underline dark:text-emerald-400"
              >
                dashboard <ExternalLink className="h-3 w-3" />
              </a>
              .
            </p>
          </div>
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Not available on this network yet.
          </p>
        )}
      </Section>

      <Section
        title="Mobile wallets (WalletConnect)"
        subtitle="Pair the mobile versions over WalletConnect v2"
        last
      >
        {walletConnectConfigured() ? (
          <div className="space-y-3">
            <ActionButton
              id="wc"
              label="Create pairing QR"
              icon={<Smartphone className="h-3.5 w-3.5" />}
              action={action}
              onClick={() =>
                run("wc", async () => {
                  const { uri, approval } = await createWalletConnectPairing(networkId);
                  const { toDataURL } = await import("qrcode");
                  setWcQr(await toDataURL(uri, { margin: 1, width: 220 }));
                  approval
                    .then(() =>
                      setAction({ kind: "done", id: "wc", message: "Wallet paired" }),
                    )
                    .catch(() =>
                      setAction({ kind: "error", id: "wc", message: "Pairing declined" }),
                    )
                    .finally(() => setWcQr(null));
                  return "Scan the QR with your mobile wallet";
                })
              }
            />
            {wcQr && (
              // eslint-disable-next-line @next/next/no-img-element -- data URL QR
              <img
                src={wcQr}
                alt="WalletConnect pairing QR"
                className="rounded-lg border border-slate-200 dark:border-slate-700"
              />
            )}
          </div>
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            WalletConnect is not configured on this deployment.
          </p>
        )}
        <Feedback state={feedbackFor("wc")} />
      </Section>
    </div>
  );
}

function Section({
  title,
  subtitle,
  children,
  last = false,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div className={last ? "" : "mb-4 border-b border-slate-100 pb-4 dark:border-[#1a1f2e]"}>
      <div className="mb-0.5 text-sm font-medium text-slate-800 dark:text-slate-200">{title}</div>
      {subtitle && (
        <div className="mb-2 text-xs text-slate-500 dark:text-slate-400">{subtitle}</div>
      )}
      {children}
    </div>
  );
}

function ActionButton({
  id,
  label,
  onClick,
  action,
  disabled = false,
  icon,
}: {
  id: string;
  label: string;
  onClick: () => void;
  action: ActionState;
  disabled?: boolean;
  icon?: React.ReactNode;
}) {
  const busy = action.kind === "busy" && action.id === id;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : icon}
      {label}
    </button>
  );
}

function Feedback({ state }: { state: ActionState | null }) {
  if (!state || state.kind === "idle" || state.kind === "busy") return null;
  return (
    <p
      className={`mt-2 text-xs ${
        state.kind === "done"
          ? "text-emerald-600 dark:text-emerald-400"
          : "text-red-600 dark:text-red-400"
      }`}
    >
      {state.message}
    </p>
  );
}
