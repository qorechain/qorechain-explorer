/**
 * WalletConnect v2 pairing (mobile wallets). Namespaces per network:
 * eip155:9800|9801 and cosmos:qorechain-diana|qorechain-vladi.
 * Disabled unless NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is set (never commit
 * a project id).
 *
 * @file lib/walletconnect.ts
 */

import type SignClient from "@walletconnect/sign-client";
import type { SessionTypes } from "@walletconnect/types";

import { CHAIN_DATA, type NetworkId } from "@/lib/registry";

const PROJECT_ID = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "";

export function walletConnectConfigured(): boolean {
  return Boolean(PROJECT_ID);
}

let clientPromise: Promise<SignClient> | null = null;

async function getClient(): Promise<SignClient> {
  if (!PROJECT_ID) {
    throw new Error(
      "WalletConnect is not configured (NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID)",
    );
  }
  if (!clientPromise) {
    clientPromise = import("@walletconnect/sign-client").then((m) =>
      m.default.init({
        projectId: PROJECT_ID,
        metadata: {
          name: "QoreChain Explorer",
          description: "QoreChain public block explorer",
          url: "https://explore.qore.network",
          icons: ["https://www.qorechain.io/assets/icon.png"],
        },
      }),
    );
  }
  return clientPromise;
}

export interface WalletConnectPairing {
  uri: string;
  approval: Promise<SessionTypes.Struct>;
}

export async function createWalletConnectPairing(
  networkId: NetworkId,
): Promise<WalletConnectPairing> {
  const client = await getClient();
  const ns = CHAIN_DATA[networkId].walletconnect.namespaces;
  const { uri, approval } = await client.connect({
    optionalNamespaces: {
      eip155: {
        chains: [ns.eip155],
        methods: [
          "eth_sendTransaction",
          "eth_signTransaction",
          "eth_sign",
          "personal_sign",
          "eth_signTypedData",
          "wallet_addEthereumChain",
          "wallet_switchEthereumChain",
        ],
        events: ["chainChanged", "accountsChanged"],
      },
      cosmos: {
        chains: [ns.cosmos],
        methods: ["cosmos_getAccounts", "cosmos_signDirect", "cosmos_signAmino"],
        events: [],
      },
    },
  });
  if (!uri) throw new Error("WalletConnect returned no pairing URI");
  return { uri, approval: approval() };
}
