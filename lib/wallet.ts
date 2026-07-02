/**
 * Wallet integration for the explorer's "Add QoreChain" panel: address
 * conversion across VMs, Keplr/Leap/Cosmostation ChainInfo, EIP-3085 params,
 * and injected-provider actions. Generated from chain-data via the registry —
 * mirrors the dashboard's lib/wallet.
 *
 * @file lib/wallet.ts
 */

import { fromBech32 } from "@cosmjs/encoding";
import { base58Encode } from "@qorechain/wallet-adapter";

import { getNetwork, type NetworkId } from "@/lib/registry";

// ── Unified identity ────────────────────────────────────────────────────────

export function svmAddressFromBech32(qorAddress: string): string {
  const { prefix, data } = fromBech32(qorAddress);
  if (prefix !== "qor" || data.length !== 20) {
    throw new Error(`not a qor account address: ${qorAddress}`);
  }
  const padded = new Uint8Array(32);
  padded.set(data);
  return base58Encode(padded);
}

export function evmAddressFromBech32(qorAddress: string): string {
  const { data } = fromBech32(qorAddress);
  return "0x" + Array.from(data, (b) => b.toString(16).padStart(2, "0")).join("");
}

const BECH32_CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";

function bech32Polymod(values: number[]): number {
  const GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
  let chk = 1;
  for (const v of values) {
    const b = chk >> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ v;
    for (let i = 0; i < 5; i++) if ((b >> i) & 1) chk ^= GEN[i];
  }
  return chk;
}

function bech32HrpExpand(hrp: string): number[] {
  return [
    ...Array.from(hrp, (c) => c.charCodeAt(0) >> 5),
    0,
    ...Array.from(hrp, (c) => c.charCodeAt(0) & 31),
  ];
}

/** 0x address (20 bytes) → qor1… bech32. */
export function bech32FromEvmAddress(evmAddress: string): string {
  const hex = evmAddress.replace(/^0x/, "");
  const bytes = Array.from({ length: 20 }, (_, i) =>
    parseInt(hex.slice(i * 2, i * 2 + 2), 16),
  );
  // 8-bit → 5-bit groups
  const words: number[] = [];
  let acc = 0;
  let bits = 0;
  for (const b of bytes) {
    acc = (acc << 8) | b;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      words.push((acc >> bits) & 31);
    }
  }
  if (bits > 0) words.push((acc << (5 - bits)) & 31);
  const hrp = "qor";
  const poly =
    bech32Polymod([...bech32HrpExpand(hrp), ...words, 0, 0, 0, 0, 0, 0]) ^ 1;
  const checksum = Array.from(
    { length: 6 },
    (_, i) => (poly >> (5 * (5 - i))) & 31,
  );
  return `${hrp}1${[...words, ...checksum].map((w) => BECH32_CHARSET[w]).join("")}`;
}

// ── Wallet configs ──────────────────────────────────────────────────────────

export function getCosmosChainInfo(id: NetworkId) {
  const net = getNetwork(id);
  const data = net.data;
  const currency = {
    coinDenom: data.currency.display,
    coinMinimalDenom: data.currency.cosmos.denom,
    coinDecimals: data.currency.cosmos.decimals,
    coinImageUrl: data.assets.icon,
  };
  return {
    chainId: data.chainId.cosmos,
    chainName: data.chainName,
    rpc: net.rpc,
    rest: net.rest,
    chainSymbolImageUrl: data.assets.icon,
    bip44: { coinType: data.slip44 },
    bech32Config: {
      bech32PrefixAccAddr: data.bech32.account,
      bech32PrefixAccPub: data.bech32.accountPub,
      bech32PrefixValAddr: data.bech32.validator,
      bech32PrefixValPub: data.bech32.validatorPub,
      bech32PrefixConsAddr: data.bech32.consensus,
      bech32PrefixConsPub: data.bech32.consensusPub,
    },
    currencies: [currency],
    feeCurrencies: [{ ...currency, gasPriceStep: data.fees.gasPriceStep }],
    stakeCurrency: currency,
    features: data.features,
  };
}

export interface AddEthereumChainParams {
  chainId: string;
  chainName: string;
  nativeCurrency: { name: string; symbol: string; decimals: number };
  rpcUrls: string[];
  blockExplorerUrls?: string[];
  iconUrls?: string[];
}

export function getEvmChainParams(id: NetworkId): AddEthereumChainParams {
  const net = getNetwork(id);
  const data = net.data;
  const params: AddEthereumChainParams = {
    chainId: data.chainId.evmHex,
    chainName: data.chainName,
    nativeCurrency: {
      name: data.currency.evm.name,
      symbol: data.currency.evm.symbol,
      decimals: data.currency.evm.decimals,
    },
    rpcUrls: [net.evmRpc],
    iconUrls: [data.assets.icon],
  };
  // This app IS the explorer — its short /tx /block /address routes are the
  // EIP-3085 base.
  if (typeof window !== "undefined") {
    params.blockExplorerUrls = [window.location.origin];
  }
  return params;
}

// ── Injected providers ──────────────────────────────────────────────────────

type SuggestChainProvider = {
  experimentalSuggestChain: (chainInfo: unknown) => Promise<void>;
  enable: (chainId: string) => Promise<void>;
};

type Eip1193Provider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  isMetaMask?: boolean;
  isRabby?: boolean;
  isTrust?: boolean;
  isTrustWallet?: boolean;
  isCoinbaseWallet?: boolean;
  isOkxWallet?: boolean;
  providers?: Eip1193Provider[];
};

declare global {
  interface Window {
    keplr?: SuggestChainProvider;
    leap?: SuggestChainProvider;
    cosmostation?: { providers?: { keplr?: SuggestChainProvider } };
    ethereum?: Eip1193Provider;
    okxwallet?: Eip1193Provider;
    phantom?: { solana?: { isPhantom?: boolean } };
    solflare?: { isSolflare?: boolean };
    backpack?: { isBackpack?: boolean };
  }
}

export type CosmosWalletId = "keplr" | "leap" | "cosmostation";
export type EvmWalletFlavor =
  | "metamask"
  | "rabby"
  | "trust"
  | "coinbase"
  | "okx"
  | "unknown";

export interface DetectedProviders {
  cosmos: CosmosWalletId[];
  evm: EvmWalletFlavor[];
  svm: Array<"phantom" | "solflare" | "backpack">;
}

function cosmosProvider(id: CosmosWalletId): SuggestChainProvider | null {
  if (typeof window === "undefined") return null;
  switch (id) {
    case "keplr":
      return window.keplr ?? null;
    case "leap":
      return window.leap ?? null;
    case "cosmostation":
      return window.cosmostation?.providers?.keplr ?? null;
  }
}

function evmProviders(): Eip1193Provider[] {
  if (typeof window === "undefined") return [];
  const root = window.ethereum;
  const list: Eip1193Provider[] = [];
  if (root) list.push(...(root.providers?.length ? root.providers : [root]));
  if (window.okxwallet) list.push(window.okxwallet);
  return list;
}

function evmFlavor(p: Eip1193Provider): EvmWalletFlavor {
  if (p.isRabby) return "rabby";
  if (p.isOkxWallet) return "okx";
  if (p.isTrust || p.isTrustWallet) return "trust";
  if (p.isCoinbaseWallet) return "coinbase";
  if (p.isMetaMask) return "metamask";
  return "unknown";
}

export function detectWalletProviders(): DetectedProviders {
  const cosmos = (["keplr", "leap", "cosmostation"] as const).filter((id) =>
    Boolean(cosmosProvider(id)),
  );
  const evm = [...new Set(evmProviders().map(evmFlavor))];
  const svm: DetectedProviders["svm"] = [];
  if (typeof window !== "undefined") {
    if (window.phantom?.solana?.isPhantom) svm.push("phantom");
    if (window.solflare) svm.push("solflare");
    if (window.backpack) svm.push("backpack");
  }
  return { cosmos, evm, svm };
}

export async function addCosmosChain(
  wallet: CosmosWalletId,
  networkId: NetworkId,
): Promise<void> {
  const provider = cosmosProvider(wallet);
  if (!provider) throw new Error(`${wallet} extension not detected`);
  const chainInfo = getCosmosChainInfo(networkId);
  await provider.experimentalSuggestChain(chainInfo);
  await provider.enable(chainInfo.chainId);
}

export async function addEvmChain(networkId: NetworkId): Promise<void> {
  const target = evmProviders()[0];
  if (!target) throw new Error("No EVM wallet extension detected");
  const params = getEvmChainParams(networkId);
  await target.request({
    method: "wallet_addEthereumChain",
    params: [params],
  });
  await target.request({
    method: "wallet_switchEthereumChain",
    params: [{ chainId: params.chainId }],
  });
}
