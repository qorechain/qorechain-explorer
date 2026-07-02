/**
 * Read-only JSON-RPC proxy to the active network's EVM endpoint.
 * POST /api/evm  { method, params }  — allow-listed eth_* read methods only.
 */

import { NextRequest, NextResponse } from "next/server";

import { getActiveNetworkId, getNetwork, NETWORK_COOKIE } from "@/lib/registry";

export const dynamic = "force-dynamic";

const ALLOWED_METHODS = new Set([
  "eth_chainId",
  "eth_blockNumber",
  "eth_gasPrice",
  "eth_getBalance",
  "eth_getTransactionCount",
  "eth_getCode",
  "eth_getBlockByNumber",
  "eth_getBlockByHash",
  "eth_getTransactionByHash",
  "eth_getTransactionReceipt",
  "eth_call",
  "net_version",
]);

export async function POST(req: NextRequest) {
  const { method, params } = (await req.json().catch(() => ({}))) as {
    method?: string;
    params?: unknown[];
  };
  if (!method || !ALLOWED_METHODS.has(method)) {
    return NextResponse.json({ error: "method not allowed" }, { status: 400 });
  }
  const net = getNetwork(
    getActiveNetworkId(req.cookies.get(NETWORK_COOKIE)?.value),
  );
  try {
    const res = await fetch(net.evmRpc, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params: params ?? [] }),
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    return NextResponse.json(await res.json(), { status: res.status });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "upstream error" },
      { status: 502 },
    );
  }
}
