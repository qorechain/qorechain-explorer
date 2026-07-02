"use client";

/**
 * Active-network context: cookie-backed (qore-network), full reload on switch
 * so every data hook re-fetches against the right endpoints — same semantics
 * as the QoreChain dashboard.
 *
 * @file lib/network-provider.tsx
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import {
  DEFAULT_NETWORK,
  NETWORK_COOKIE,
  NETWORKS,
  getActiveNetworkId,
  type NetworkId,
  type QoreNetwork,
} from "@/lib/registry";

interface NetworkContextValue {
  network: QoreNetwork;
  networkId: NetworkId;
  setNetwork: (id: NetworkId) => void;
}

const NetworkContext = createContext<NetworkContextValue>({
  network: NETWORKS[DEFAULT_NETWORK],
  networkId: DEFAULT_NETWORK,
  setNetwork: () => undefined,
});

function readNetworkCookie(): NetworkId {
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${NETWORK_COOKIE}=([^;]*)`),
  );
  return getActiveNetworkId(match?.[1]);
}

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const [networkId, setNetworkId] = useState<NetworkId>(DEFAULT_NETWORK);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      if (!cancelled) setNetworkId(readNetworkCookie());
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const setNetwork = useCallback((id: NetworkId) => {
    document.cookie = `${NETWORK_COOKIE}=${id};path=/;max-age=${60 * 60 * 24 * 365};SameSite=Lax`;
    window.location.reload();
  }, []);

  return (
    <NetworkContext.Provider
      value={{ network: NETWORKS[networkId], networkId, setNetwork }}
    >
      {children}
    </NetworkContext.Provider>
  );
}

export function useNetwork(): NetworkContextValue {
  return useContext(NetworkContext);
}
