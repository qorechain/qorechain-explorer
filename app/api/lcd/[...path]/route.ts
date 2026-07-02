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
    return NextResponse.json(body, { status: res.status });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "upstream error" },
      { status: 502 },
    );
  }
}
