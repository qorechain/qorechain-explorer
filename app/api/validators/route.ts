///// Date : 2026-08-27 | Changes : Enriched validator list, server-side and cached (SCRUM-243) | Who : Liviu Epure

/**
 * The validator set with the numbers people actually judge a validator by:
 * stake and share, self-bond, commission, delegator count, and signing record.
 *
 * Assembled here rather than in the browser because the signing record is not
 * reachable in one query — see `lib/valcons.ts` for why each validator needs a
 * derived consensus address before its uptime can be looked up at all.
 */

import { NextRequest, NextResponse } from "next/server";

import { getActiveNetworkId, getNetwork, NETWORK_COOKIE } from "@/lib/registry";
import { consensusAddress, valoperToAccount } from "@/lib/valcons";

export const dynamic = "force-dynamic";

const CACHE_MS = 60 * 1000;
const cache = new Map<string, { at: number; body: ValidatorListResponse }>();

export interface ValidatorRow {
  rank: number;
  operatorAddress: string;
  accountAddress: string | null;
  consensusAddress: string | null;
  moniker: string;
  identity: string;
  website: string;
  details: string;
  status: string;
  jailed: boolean;
  tokens: string;
  sharePct: number;
  cumulativePct: number;
  commissionRate: string;
  commissionMaxRate: string;
  selfBond: string | null;
  selfBondPct: number | null;
  delegators: number | null;
  /** Missed blocks inside the slashing window, and how much of that window this
   *  validator has actually existed for. A validator bonded 100 blocks ago has
   *  not earned "100% uptime" over a 10,000-block window. */
  missedBlocks: number | null;
  windowBlocks: number | null;
  observedBlocks: number | null;
  tombstoned: boolean | null;
  jailedUntil: string | null;
  startHeight: number | null;
}

export interface ValidatorListResponse {
  height: number;
  bondedTokens: string;
  notBondedTokens: string;
  signedBlocksWindow: number;
  minSignedPerWindow: string;
  slashFractionDowntime: string;
  slashFractionDoubleSign: string;
  activeCount: number;
  maxValidators: number | null;
  validators: ValidatorRow[];
  computedAt: string;
  incomplete?: boolean;
}

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
  // Every LCD response carries the height it was served at. Reading it from the
  // header costs nothing and is more truthful than a separate "latest block"
  // call, which would report a height the other answers were never taken at.
  let seenHeight = 0;
  const get = async <T,>(path: string): Promise<T | null> => {
    try {
      const r = await fetch(`${net.rest}/${path}`, {
        cache: "no-store",
        signal: AbortSignal.timeout(12000),
      });
      if (!r.ok) throw new Error(String(r.status));
      const h = Number(r.headers.get("x-cosmos-block-height") ?? 0);
      if (h > seenHeight) seenHeight = h;
      return (await r.json()) as T;
    } catch {
      incomplete = true;
      return null;
    }
  };

  const [valRes, poolRes, slashRes, stakeRes] = await Promise.all([
    get<{ validators: RawValidator[] }>(
      "cosmos/staking/v1beta1/validators?pagination.limit=500",
    ),
    get<{ pool: { bonded_tokens: string; not_bonded_tokens: string } }>(
      "cosmos/staking/v1beta1/pool",
    ),
    get<{
      params: {
        signed_blocks_window: string;
        min_signed_per_window: string;
        slash_fraction_downtime: string;
        slash_fraction_double_sign: string;
      };
    }>("cosmos/slashing/v1beta1/params"),
    get<{ params: { max_validators: number } }>("cosmos/staking/v1beta1/params"),
  ]);

  const raw = valRes?.validators ?? [];
  const height = seenHeight;
  const window = Number(slashRes?.params?.signed_blocks_window ?? 0);

  const bonded = raw.filter((v) => v.status === "BOND_STATUS_BONDED");
  const totalBonded = bonded.reduce((a, v) => a + BigInt(v.tokens), 0n);

  const sorted = [...raw].sort((a, b) => (BigInt(b.tokens) > BigInt(a.tokens) ? 1 : -1));

  const rows = await Promise.all(
    sorted.map(async (v, i): Promise<ValidatorRow> => {
      const cons = consensusAddress(v.consensus_pubkey);
      const acct = valoperToAccount(v.operator_address);

      const [signing, selfDel, dels] = await Promise.all([
        cons
          ? get<{ val_signing_info: RawSigningInfo }>(
              `cosmos/slashing/v1beta1/signing_infos/${cons}`,
            )
          : Promise.resolve(null),
        acct
          ? get<{ delegation_response: { balance: { amount: string } } }>(
              `cosmos/staking/v1beta1/validators/${v.operator_address}/delegations/${acct}`,
            )
          : Promise.resolve(null),
        get<{ pagination: { total: string } }>(
          `cosmos/staking/v1beta1/validators/${v.operator_address}/delegations?pagination.limit=1&pagination.count_total=true`,
        ),
      ]);

      const si = signing?.val_signing_info ?? null;
      const startHeight = si ? Number(si.start_height) : null;
      const observed =
        startHeight !== null && height > 0
          ? Math.max(0, Math.min(height - startHeight, window))
          : null;

      const self = selfDel?.delegation_response?.balance?.amount ?? null;
      const tokens = BigInt(v.tokens);

      return {
        rank: i + 1,
        operatorAddress: v.operator_address,
        accountAddress: acct,
        consensusAddress: cons,
        moniker: v.description?.moniker ?? "",
        identity: v.description?.identity ?? "",
        website: v.description?.website ?? "",
        details: v.description?.details ?? "",
        status: v.status.replace("BOND_STATUS_", ""),
        jailed: v.jailed,
        tokens: v.tokens,
        sharePct: totalBonded > 0n ? Number((tokens * 1000000n) / totalBonded) / 10000 : 0,
        cumulativePct: 0, // filled below, once the whole list is ordered
        commissionRate: v.commission?.commission_rates?.rate ?? "0",
        commissionMaxRate: v.commission?.commission_rates?.max_rate ?? "0",
        selfBond: self,
        selfBondPct:
          self && tokens > 0n ? Number((BigInt(self) * 1000000n) / tokens) / 10000 : null,
        delegators: dels?.pagination?.total ? Number(dels.pagination.total) : null,
        missedBlocks: si ? Number(si.missed_blocks_counter) : null,
        windowBlocks: window || null,
        observedBlocks: observed,
        tombstoned: si ? si.tombstoned : null,
        jailedUntil: si ? si.jailed_until : null,
        startHeight,
      };
    }),
  );

  let running = 0;
  for (const r of rows) {
    if (r.status === "BONDED") running += r.sharePct;
    r.cumulativePct = Math.min(100, running);
  }

  const body: ValidatorListResponse = {
    height,
    bondedTokens: poolRes?.pool?.bonded_tokens ?? "0",
    notBondedTokens: poolRes?.pool?.not_bonded_tokens ?? "0",
    signedBlocksWindow: window,
    minSignedPerWindow: slashRes?.params?.min_signed_per_window ?? "0",
    slashFractionDowntime: slashRes?.params?.slash_fraction_downtime ?? "0",
    slashFractionDoubleSign: slashRes?.params?.slash_fraction_double_sign ?? "0",
    activeCount: bonded.length,
    maxValidators: stakeRes?.params?.max_validators ?? null,
    validators: rows,
    computedAt: new Date().toISOString(),
    ...(incomplete ? { incomplete: true } : {}),
  };

  if (!incomplete) cache.set(netId, { at: Date.now(), body });

  return NextResponse.json(body, {
    headers: { "Cache-Control": "no-store", "x-qore-cache": incomplete ? "skip" : "miss" },
  });
}

interface RawValidator {
  operator_address: string;
  consensus_pubkey: { "@type": string; key: string };
  status: string;
  jailed: boolean;
  tokens: string;
  description: { moniker: string; identity: string; website: string; details: string };
  commission: { commission_rates: { rate: string; max_rate: string } };
}

interface RawSigningInfo {
  start_height: string;
  missed_blocks_counter: string;
  tombstoned: boolean;
  jailed_until: string;
}
