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
    const out = NextResponse.json(body, { status: res.status });
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
