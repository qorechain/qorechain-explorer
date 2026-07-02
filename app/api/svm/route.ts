/**
 * Read-only JSON-RPC proxy to the active network's SVM endpoint (writes are
 * disabled at the public edge by design — this proxy allows reads only).
 * POST /api/svm  { method, params }
 */

import { NextRequest, NextResponse } from "next/server";

import { getActiveNetworkId, getNetwork, NETWORK_COOKIE } from "@/lib/registry";

export const dynamic = "force-dynamic";

const ALLOWED_METHODS = new Set([
  "getVersion",
  "getSlot",
  "getBalance",
  "getAccountInfo",
  "getLatestBlockhash",
  "getSignaturesForAddress",
  "getTransaction",
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
  if (!net.svmRpc) {
    return NextResponse.json(
      { error: "SVM endpoint not available on this network" },
      { status: 503 },
    );
  }
  try {
    const res = await fetch(net.svmRpc, {
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
