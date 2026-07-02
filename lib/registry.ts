/**
 * Network registry — endpoints resolved from env with the verified public
 * hosts as fallbacks; chain facts come from chain-data/*.json.
 *
 * @file lib/registry.ts
 */

import diana from "@/chain-data/qorechain-diana.json";
import vladi from "@/chain-data/qorechain-vladi.json";

export type NetworkId = "testnet" | "mainnet";

export interface ChainData {
  networkId: NetworkId;
  chainName: string;
  chainId: { cosmos: string; evm: number; evmHex: string };
  bech32: {
    account: string;
    accountPub: string;
    validator: string;
    validatorPub: string;
    consensus: string;
    consensusPub: string;
  };
  slip44: number;
  currency: {
    display: string;
    cosmos: { denom: string; decimals: number };
    evm: { name: string; symbol: string; decimals: number; weiPerUqor: string };
    svm: { decimals: number; lamportsPerUqor: number };
  };
  fees: {
    minGasPrice: string;
    gasPriceStep: { low: number; average: number; high: number };
  };
  endpoints: {
    rpc: string;
    rest: string;
    evmRpc: string;
    svmRpc: string | null;
    ws: string;
    evmWs: string | null;
  };
  assets: { logo: string; icon: string };
  features: string[];
  walletconnect: { namespaces: { eip155: string; cosmos: string } };
}

export const CHAIN_DATA: Record<NetworkId, ChainData> = {
  testnet: diana as unknown as ChainData,
  mainnet: vladi as unknown as ChainData,
};

export interface QoreNetwork {
  id: NetworkId;
  label: string;
  data: ChainData;
  rpc: string;
  rest: string;
  evmRpc: string;
  svmRpc: string | null;
  ws: string;
  evmWs: string | null;
}

function endpoints(id: NetworkId): QoreNetwork {
  const data = CHAIN_DATA[id];
  const p = id === "mainnet" ? "MAINNET" : "TESTNET";
  const env = (k: string) => process.env[`NEXT_PUBLIC_${p}_${k}`];
  return {
    id,
    label: id === "mainnet" ? "Mainnet" : "Testnet",
    data,
    rpc: env("RPC") || data.endpoints.rpc,
    rest: env("REST") || data.endpoints.rest,
    evmRpc: env("EVM_RPC") || data.endpoints.evmRpc,
    svmRpc: env("SVM_RPC") || data.endpoints.svmRpc,
    ws: env("WS") || data.endpoints.ws,
    evmWs: env("EVM_WS") || data.endpoints.evmWs,
  };
}

export const NETWORKS: Record<NetworkId, QoreNetwork> = {
  testnet: endpoints("testnet"),
  mainnet: endpoints("mainnet"),
};

export const NETWORK_COOKIE = "qore-network";
/** The public explorer shows the live network by default. */
export const DEFAULT_NETWORK: NetworkId = "mainnet";

export function isNetworkId(v: unknown): v is NetworkId {
  return v === "testnet" || v === "mainnet";
}

export function getNetwork(id: NetworkId): QoreNetwork {
  return NETWORKS[id];
}

export function getActiveNetworkId(cookieVal?: string | null): NetworkId {
  return isNetworkId(cookieVal) ? cookieVal : DEFAULT_NETWORK;
}

export const DASHBOARD_ORIGIN =
  process.env.NEXT_PUBLIC_DASHBOARD_ORIGIN || "https://dashboard.qorechain.io";
