///// Date : 2026-08-27 | Changes : Circulating supply, computed server-side and cached (SCRUM-242) | Who : Liviu Epure

/**
 * Circulating supply.
 *
 * Definition in force (owner's, 2026-08-27): circulating is what sits unlocked
 * in ordinary accounts. Excluded are
 *   1. the allocation buckets — allocations that have not been distributed yet,
 *   2. protocol-owned module accounts,
 *   3. the still-locked portion of every vesting account,
 *   4. staking rewards earned but not yet withdrawn.
 *
 * Staked coins ARE circulating: they belong to whoever delegated them, and the
 * bonded pool is only holding them in transit.
 *
 * This costs ~120 upstream requests, so it is computed here and cached rather
 * than run in every visitor's browser.
 */

import { NextRequest, NextResponse } from "next/server";

import { getActiveNetworkId, getNetwork, NETWORK_COOKIE } from "@/lib/registry";
import { ALLOCATION_ADDRESSES, PROTOCOL_MODULE_NAMES } from "@/lib/allocations";

export const dynamic = "force-dynamic";

const CACHE_MS = 5 * 60 * 1000;
const cache = new Map<string, { at: number; body: SupplyBreakdown }>();

export interface SupplyBreakdown {
  denom: string;
  total: string;
  circulating: string;
  nonCirculating: string;
  breakdown: {
    allocationBuckets: string;
    protocolModules: string;
    lockedInVesting: string;
    unclaimedRewards: string;
  };
  counts: { buckets: number; modules: number; vestingLocked: number };
  computedAt: string;
  /** Set when part of the walk failed, so a partial figure is never passed off as exact. */
  incomplete?: boolean;
}

const UQOR = "uqor";
const sumUqor = (coins: Array<{ denom: string; amount: string }> | undefined) =>
  (coins ?? []).reduce((a, c) => (c.denom === UQOR ? a + BigInt(c.amount) : a), 0n);

export async function GET(req: NextRequest) {
  const netId = getActiveNetworkId(req.cookies.get(NETWORK_COOKIE)?.value);
  const net = getNetwork(netId);

  const hit = cache.get(netId);
  if (hit && Date.now() - hit.at < CACHE_MS) {
    return NextResponse.json(hit.body, {
      headers: { "Cache-Control": "no-store", "x-qore-cache": "hit" },
    });
  }

  let incomplete = false;
  const get = async <T,>(path: string): Promise<T | null> => {
    try {
      const r = await fetch(`${net.rest}/${path}`, {
        cache: "no-store",
        signal: AbortSignal.timeout(12000),
      });
      if (!r.ok) throw new Error(String(r.status));
      return (await r.json()) as T;
    } catch {
      incomplete = true;
      return null;
    }
  };

  const balanceOf = async (addr: string) => {
    const r = await get<{ balances: Array<{ denom: string; amount: string }> }>(
      `cosmos/bank/v1beta1/balances/${addr}`,
    );
    return sumUqor(r?.balances);
  };

  const supplyRes = await get<{ amount: { amount: string } }>(
    `cosmos/bank/v1beta1/supply/by_denom?denom=${UQOR}`,
  );
  const total = BigInt(supplyRes?.amount?.amount ?? "0");

  const accountsRes = await get<{
    accounts: Array<Record<string, unknown>>;
  }>("cosmos/auth/v1beta1/accounts?pagination.limit=1000");
  const accounts = accountsRes?.accounts ?? [];

  // Buckets, in parallel.
  const bucketList = [...ALLOCATION_ADDRESSES];
  const bucketAmounts = await Promise.all(bucketList.map(balanceOf));
  const allocationBuckets = bucketAmounts.reduce((a, v) => a + v, 0n);

  // Protocol-owned modules. Anything not on the list (the bonded pools) is left
  // in circulation on purpose.
  const moduleAddrs: string[] = [];
  const vestingAddrs: string[] = [];
  for (const a of accounts) {
    const type = String(a["@type"] ?? "");
    if (type.includes("ModuleAccount")) {
      const name = String(a["name"] ?? "");
      const addr = String(
        (a["base_account"] as Record<string, unknown> | undefined)?.["address"] ?? "",
      );
      if (addr && PROTOCOL_MODULE_NAMES.has(name)) moduleAddrs.push(addr);
    } else if (type.includes("Vesting")) {
      const base = (a["base_vesting_account"] as Record<string, unknown> | undefined)?.[
        "base_account"
      ] as Record<string, unknown> | undefined;
      const addr = String(base?.["address"] ?? a["address"] ?? "");
      // A vesting account that is also a bucket is already counted above;
      // counting it twice would understate circulating supply.
      if (addr && !ALLOCATION_ADDRESSES.has(addr)) vestingAddrs.push(addr);
    }
  }

  const moduleAmounts = await Promise.all(
    moduleAddrs.map(async (addr) => ({ addr, amount: await balanceOf(addr) })),
  );
  const unclaimedRewards =
    moduleAmounts.find((m) => m.addr === distributionAddr(accounts))?.amount ?? 0n;
  const protocolModules =
    moduleAmounts.reduce((a, m) => a + m.amount, 0n) - unclaimedRewards;

  // Locked = balance − spendable, per vesting account.
  const lockedAmounts = await Promise.all(
    vestingAddrs.map(async (addr) => {
      const [bal, spend] = await Promise.all([
        balanceOf(addr),
        get<{ balances: Array<{ denom: string; amount: string }> }>(
          `cosmos/bank/v1beta1/spendable_balances/${addr}`,
        ).then((r) => sumUqor(r?.balances)),
      ]);
      return bal > spend ? bal - spend : 0n;
    }),
  );
  const lockedInVesting = lockedAmounts.reduce((a, v) => a + v, 0n);
  const vestingLockedCount = lockedAmounts.filter((v) => v > 0n).length;

  const nonCirculating =
    allocationBuckets + protocolModules + lockedInVesting + unclaimedRewards;
  const circulating = total > nonCirculating ? total - nonCirculating : 0n;

  const body: SupplyBreakdown = {
    denom: UQOR,
    total: total.toString(),
    circulating: circulating.toString(),
    nonCirculating: nonCirculating.toString(),
    breakdown: {
      allocationBuckets: allocationBuckets.toString(),
      protocolModules: protocolModules.toString(),
      lockedInVesting: lockedInVesting.toString(),
      unclaimedRewards: unclaimedRewards.toString(),
    },
    counts: {
      buckets: bucketList.length,
      modules: moduleAddrs.length,
      vestingLocked: vestingLockedCount,
    },
    computedAt: new Date().toISOString(),
    ...(incomplete ? { incomplete: true } : {}),
  };

  // A partial walk is never cached — otherwise one bad minute upstream would be
  // served as the answer for the next five.
  if (!incomplete) cache.set(netId, { at: Date.now(), body });

  return NextResponse.json(body, {
    headers: { "Cache-Control": "no-store", "x-qore-cache": incomplete ? "skip" : "miss" },
  });
}

/** Address of the `distribution` module account, if present. */
function distributionAddr(accounts: Array<Record<string, unknown>>): string {
  for (const a of accounts) {
    if (String(a["@type"] ?? "").includes("ModuleAccount") && a["name"] === "distribution") {
      return String(
        (a["base_account"] as Record<string, unknown> | undefined)?.["address"] ?? "",
      );
    }
  }
  return "";
}
