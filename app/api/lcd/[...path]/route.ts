/**
 * Read-only proxy to the active network's REST/LCD — keeps the browser free
 * of CORS concerns and never forwards anything but GET.
 *
 * GET /api/lcd/<lcd path>?<query>  →  {rest}/<lcd path>?<query>
 */

import { NextRequest, NextResponse } from "next/server";

import { getActiveNetworkId, getNetwork, NETWORK_COOKIE } from "@/lib/registry";

export const dynamic = "force-dynamic";

const ALLOWED_PREFIXES = ["cosmos/", "cosmwasm/", "qorechain/"];

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const lcdPath = path.join("/");
  if (!ALLOWED_PREFIXES.some((p) => lcdPath.startsWith(p))) {
    return NextResponse.json({ error: "path not allowed" }, { status: 400 });
  }
  const net = getNetwork(
    getActiveNetworkId(req.cookies.get(NETWORK_COOKIE)?.value),
  );
  const qs = new URL(req.url).search;
  try {
    const res = await fetch(`${net.rest}/${lcdPath}${qs}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    const body = await res.json();
    // CosmWasm txs embed the full contract bytecode (`wasm_byte_code`) as
    // multi-MB base64 — a single MsgStoreCode tx can be 2–7 MB, and a page of
    // them blows past the platform's response-size cap (→ HTTP 413, empty body,
    // "No indexed transactions yet"). The explorer never renders raw bytecode,
    // so strip it before returning. Cheap and universal across all LCD paths.
    const cleaned = JSON.stringify(body, (key, value) =>
      key === "wasm_byte_code" && typeof value === "string" ? "" : value,
    );
    const out = new NextResponse(cleaned, {
      status: res.status,
      headers: { "content-type": "application/json" },
    });
    // Defense-in-depth against edge caching: this response is network-specific
    // (chosen by the `qore-network` cookie), so it must never be cached under a
    // cookie-agnostic key. Belt-and-braces with customHttp.yml.
    out.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
    out.headers.set("CDN-Cache-Control", "no-store");
    out.headers.set("Vary", "Cookie");
    return out;
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "upstream error" },
      { status: 502 },
    );
  }
}
