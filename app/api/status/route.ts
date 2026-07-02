/**
 * Consensus /status of the active network (chain id, height, catching_up)
 * plus a reachability verdict the UI can trust.
 *
 * GET /api/status
 */

import { NextRequest, NextResponse } from "next/server";

import { getActiveNetworkId, getNetwork, NETWORK_COOKIE } from "@/lib/registry";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const networkId = getActiveNetworkId(req.cookies.get(NETWORK_COOKIE)?.value);
  const net = getNetwork(networkId);
  try {
    const res = await fetch(`${net.rpc}/status`, {
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = (await res.json()) as {
      result: {
        node_info: { network: string };
        sync_info: {
          latest_block_height: string;
          latest_block_time: string;
          catching_up: boolean;
        };
      };
    };
    return NextResponse.json({
      ok: true,
      network: networkId,
      chainId: body.result.node_info.network,
      height: body.result.sync_info.latest_block_height,
      blockTime: body.result.sync_info.latest_block_time,
      catchingUp: body.result.sync_info.catching_up,
    });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        network: networkId,
        error: e instanceof Error ? e.message : "unreachable",
      },
      { status: 502 },
    );
  }
}
