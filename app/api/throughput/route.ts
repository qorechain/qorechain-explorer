///// Date : 2026-11-13 | Changes : Message throughput for the home TPS figure, computed server-side and cached | Who : Liviu Epure

/**
 * Messages (operations) committed over the last WINDOW_BLOCKS blocks, for the
 * home page TPS figure.
 *
 * Owner's decision (2026-11-13): TPS counts MESSAGES, not transactions, over
 * the same 500-block window, and excludes nothing (batch tests included). One
 * transaction carrying 250 MsgSend counts 250.
 *
 * The LCD only reports a transaction total, so the messages have to be counted
 * one transaction at a time. That is far too heavy for every visitor's browser
 * (a window of batch transactions is tens of MB), so it is done here, in pages
 * small enough for the node's 10 MB gRPC cap, ordered ASC within a fixed
 * height range so that new blocks cannot shift the pages, and cached.
 *
 * Above MAX_TXS transactions in the window only the newest MAX_TXS are read,
 * and the window shrinks to the full blocks they cover (fromHeight moves up).
 * The rate stays exact for the window it reports; it is never extrapolated.
 */

import { NextRequest, NextResponse } from "next/server";

import { getActiveNetworkId, getNetwork, NETWORK_COOKIE } from "@/lib/registry";

export const dynamic = "force-dynamic";

const WINDOW_BLOCKS = 500;
const PAGE = 25; // ~6 MB per page at 250 messages per tx; the node caps at 10 MB
const MAX_TXS = 1000;
const PARALLEL = 4;
const CACHE_MS = 45 * 1000;

export interface Throughput {
  /** Messages in transactions with fromHeight < height <= toHeight. */
  messages: number;
  txs: number;
  fromHeight: number;
  toHeight: number;
  computedAt: string;
}

const cache = new Map<string, { at: number; body: Throughput }>();
const inflight = new Map<string, Promise<Throughput>>();

type TxPage = {
  txs?: Array<{ body?: { messages?: unknown[] } }>;
  tx_responses?: Array<{ height: string }>;
  total?: string;
};

async function compute(rest: string): Promise<Throughput> {
  const get = async <T,>(path: string): Promise<T> => {
    const r = await fetch(`${rest}/${path}`, { cache: "no-store", signal: AbortSignal.timeout(12000) });
    const body = await r.json();
    if (!r.ok) throw new Error(body?.message || `LCD HTTP ${r.status}`);
    return body as T;
  };

  const tip = await get<{ height: string }>("cosmos/base/node/v1beta1/status");
  const toHeight = Number(tip.height);
  if (!Number.isFinite(toHeight) || toHeight <= 0) throw new Error("no chain height");
  let fromHeight = Math.max(0, toHeight - WINDOW_BLOCKS);
  const query = encodeURIComponent(`tx.height>${fromHeight} AND tx.height<=${toHeight}`);
  const pagePath = (page: number, limit: number) =>
    `cosmos/tx/v1beta1/txs?query=${query}&order_by=ORDER_BY_ASC&limit=${limit}&page=${page}`;

  const head = await get<TxPage>(pagePath(1, 1));
  const total = Number(head.total ?? 0);
  const lastPage = Math.ceil(total / PAGE);
  const firstPage = Math.max(1, lastPage - Math.ceil(MAX_TXS / PAGE) + 1);
  const truncated = firstPage > 1;

  const rows: Array<{ height: number; messages: number }> = [];
  for (let p = firstPage; p <= lastPage; p += PARALLEL) {
    const pages = await Promise.all(
      Array.from({ length: Math.min(PARALLEL, lastPage - p + 1) }, (_, k) => get<TxPage>(pagePath(p + k, PAGE))),
    );
    for (const pg of pages) {
      (pg.tx_responses ?? []).forEach((resp, i) =>
        rows.push({ height: Number(resp.height), messages: pg.txs?.[i]?.body?.messages?.length ?? 0 }),
      );
    }
  }

  // Truncated: the oldest block read may be partial, so the window starts at it
  // and only the full blocks after it are counted.
  let counted = rows;
  if (truncated && rows.length > 0) {
    fromHeight = rows[0].height;
    counted = rows.filter((r) => r.height > fromHeight);
  }
  return {
    messages: counted.reduce((a, r) => a + r.messages, 0),
    txs: counted.length,
    fromHeight,
    toHeight,
    computedAt: new Date().toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const netId = getActiveNetworkId(req.cookies.get(NETWORK_COOKIE)?.value);
  const net = getNetwork(netId);

  const hit = cache.get(netId);
  if (hit && Date.now() - hit.at < CACHE_MS) {
    return NextResponse.json(hit.body, { headers: { "Cache-Control": "no-store", "x-qore-cache": "hit" } });
  }
  try {
    let p = inflight.get(netId);
    if (!p) {
      p = compute(net.rest).finally(() => inflight.delete(netId));
      inflight.set(netId, p);
    }
    const body = await p;
    cache.set(netId, { at: Date.now(), body });
    return NextResponse.json(body, { headers: { "Cache-Control": "no-store", "x-qore-cache": "miss" } });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "upstream error" },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
