///// Date : 2026-08-27 | Changes : Full validator detail, server-side (SCRUM-243) | Who : Liviu Epure

/**
 * Everything about one validator that a delegator would want before trusting it
 * with money: who runs it, how much of its own stake is behind it, what it
 * charges, whether it has been signing, and whether it has ever been punished.
 */

import { NextRequest, NextResponse } from "next/server";

import { getActiveNetworkId, getNetwork, NETWORK_COOKIE } from "@/lib/registry";
import { consensusAddress, valoperToAccount } from "@/lib/valcons";

export const dynamic = "force-dynamic";

export interface DelegatorRow {
  address: string;
  amount: string;
  sharePct: number;
}

export interface ValidatorDetail {
  operatorAddress: string;
  accountAddress: string | null;
  consensusAddress: string | null;
  consensusPubkey: string | null;
  moniker: string;
  identity: string;
  website: string;
  securityContact: string;
  details: string;
  status: string;
  jailed: boolean;
  tokens: string;
  sharePct: number;
  rank: number | null;
  selfBond: string | null;
  selfBondPct: number | null;
  minSelfDelegation: string;
  delegators: number | null;
  topDelegators: DelegatorRow[];
  unbondingCount: number;
  commission: {
    rate: string;
    maxRate: string;
    maxChangeRate: string;
    updateTime: string | null;
  };
  outstandingRewards: string | null;
  accumulatedCommission: string | null;
  signing: {
    startHeight: number | null;
    missedBlocks: number | null;
    windowBlocks: number;
    observedBlocks: number | null;
    tombstoned: boolean | null;
    jailedUntil: string | null;
  };
  slashing: {
    minSignedPerWindow: string;
    downtimeJailDuration: string;
    slashFractionDowntime: string;
    slashFractionDoubleSign: string;
  };
  unbondingHeight: string | null;
  unbondingTime: string | null;
  chainHeight: number;
  computedAt: string;
  incomplete?: boolean;
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ addr: string }> },
) {
  const { addr } = await ctx.params;
  const netId = getActiveNetworkId(req.cookies.get(NETWORK_COOKIE)?.value);
  const net = getNetwork(netId);

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

  const vRes = await get<{ validator: RawValidator }>(
    `cosmos/staking/v1beta1/validators/${addr}`,
  );
  if (!vRes?.validator) {
    return NextResponse.json({ error: "validator not found" }, { status: 404 });
  }
  const v = vRes.validator;
  const acct = valoperToAccount(v.operator_address);
  const cons = consensusAddress(v.consensus_pubkey);

  const [pool, slash, allVals, signing, selfDel, dels, unbond, rewards, comm] =
    await Promise.all([
      get<{ pool: { bonded_tokens: string } }>("cosmos/staking/v1beta1/pool"),
      get<{ params: RawSlashParams }>("cosmos/slashing/v1beta1/params"),
      get<{ validators: Array<{ operator_address: string; tokens: string; status: string }> }>(
        "cosmos/staking/v1beta1/validators?pagination.limit=500",
      ),
      cons
        ? get<{ val_signing_info: RawSigningInfo }>(
            `cosmos/slashing/v1beta1/signing_infos/${cons}`,
          )
        : Promise.resolve(null),
      acct
        ? get<{ delegation_response: { balance: { amount: string } } }>(
            `cosmos/staking/v1beta1/validators/${addr}/delegations/${acct}`,
          )
        : Promise.resolve(null),
      get<{
        delegation_responses: Array<{
          delegation: { delegator_address: string };
          balance: { amount: string };
        }>;
        pagination: { total: string };
      }>(
        `cosmos/staking/v1beta1/validators/${addr}/delegations?pagination.limit=200&pagination.count_total=true`,
      ),
      get<{ pagination: { total: string } }>(
        `cosmos/staking/v1beta1/validators/${addr}/unbonding_delegations?pagination.limit=1&pagination.count_total=true`,
      ),
      get<{ rewards: { rewards: Array<{ denom: string; amount: string }> } }>(
        `cosmos/distribution/v1beta1/validators/${addr}/outstanding_rewards`,
      ),
      get<{ commission: { commission: Array<{ denom: string; amount: string }> } }>(
        `cosmos/distribution/v1beta1/validators/${addr}/commission`,
      ),
    ]);

  const height = seenHeight;
  const window = Number(slash?.params?.signed_blocks_window ?? 0);
  const totalBonded = BigInt(pool?.pool?.bonded_tokens ?? "0");
  const tokens = BigInt(v.tokens);

  // Rank is over the bonded set only: an unbonded validator has no position in
  // the active ordering, and giving it one would imply it is competing.
  let rank: number | null = null;
  if (allVals?.validators) {
    const bonded = allVals.validators
      .filter((x) => x.status === "BOND_STATUS_BONDED")
      .sort((a, b) => (BigInt(b.tokens) > BigInt(a.tokens) ? 1 : -1));
    const i = bonded.findIndex((x) => x.operator_address === addr);
    rank = i >= 0 ? i + 1 : null;
  }

  const si = signing?.val_signing_info ?? null;
  const startHeight = si ? Number(si.start_height) : null;
  const observed =
    startHeight !== null && height > 0
      ? Math.max(0, Math.min(height - startHeight, window))
      : null;

  const self = selfDel?.delegation_response?.balance?.amount ?? null;

  const topDelegators: DelegatorRow[] = (dels?.delegation_responses ?? [])
    .map((d) => ({
      address: d.delegation.delegator_address,
      amount: d.balance.amount,
      sharePct: tokens > 0n ? Number((BigInt(d.balance.amount) * 1000000n) / tokens) / 10000 : 0,
    }))
    .sort((a, b) => (BigInt(b.amount) > BigInt(a.amount) ? 1 : -1))
    .slice(0, 25);

  const uqor = (list: Array<{ denom: string; amount: string }> | undefined) => {
    const c = (list ?? []).find((x) => x.denom === "uqor");
    // Distribution amounts are high-precision decimals; the fractional part is
    // dust and would only add noise to a displayed figure.
    return c ? c.amount.split(".")[0] : null;
  };

  const body: ValidatorDetail = {
    operatorAddress: v.operator_address,
    accountAddress: acct,
    consensusAddress: cons,
    consensusPubkey: v.consensus_pubkey?.key ?? null,
    moniker: v.description?.moniker ?? "",
    identity: v.description?.identity ?? "",
    website: v.description?.website ?? "",
    securityContact: v.description?.security_contact ?? "",
    details: v.description?.details ?? "",
    status: v.status.replace("BOND_STATUS_", ""),
    jailed: v.jailed,
    tokens: v.tokens,
    sharePct: totalBonded > 0n ? Number((tokens * 1000000n) / totalBonded) / 10000 : 0,
    rank,
    selfBond: self,
    selfBondPct:
      self && tokens > 0n ? Number((BigInt(self) * 1000000n) / tokens) / 10000 : null,
    minSelfDelegation: v.min_self_delegation ?? "0",
    delegators: dels?.pagination?.total ? Number(dels.pagination.total) : null,
    topDelegators,
    unbondingCount: Number(unbond?.pagination?.total ?? 0),
    commission: {
      rate: v.commission?.commission_rates?.rate ?? "0",
      maxRate: v.commission?.commission_rates?.max_rate ?? "0",
      maxChangeRate: v.commission?.commission_rates?.max_change_rate ?? "0",
      updateTime: v.commission?.update_time ?? null,
    },
    outstandingRewards: uqor(rewards?.rewards?.rewards),
    accumulatedCommission: uqor(comm?.commission?.commission),
    signing: {
      startHeight,
      missedBlocks: si ? Number(si.missed_blocks_counter) : null,
      windowBlocks: window,
      observedBlocks: observed,
      tombstoned: si ? si.tombstoned : null,
      jailedUntil: si ? si.jailed_until : null,
    },
    slashing: {
      minSignedPerWindow: slash?.params?.min_signed_per_window ?? "0",
      downtimeJailDuration: slash?.params?.downtime_jail_duration ?? "",
      slashFractionDowntime: slash?.params?.slash_fraction_downtime ?? "0",
      slashFractionDoubleSign: slash?.params?.slash_fraction_double_sign ?? "0",
    },
    unbondingHeight: v.unbonding_height ?? null,
    unbondingTime: v.unbonding_time ?? null,
    chainHeight: height,
    computedAt: new Date().toISOString(),
    ...(incomplete ? { incomplete: true } : {}),
  };

  return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
}

interface RawValidator {
  operator_address: string;
  consensus_pubkey: { "@type": string; key: string };
  status: string;
  jailed: boolean;
  tokens: string;
  min_self_delegation: string;
  unbonding_height: string;
  unbonding_time: string;
  description: {
    moniker: string;
    identity: string;
    website: string;
    security_contact: string;
    details: string;
  };
  commission: {
    commission_rates: { rate: string; max_rate: string; max_change_rate: string };
    update_time: string;
  };
}

interface RawSigningInfo {
  start_height: string;
  missed_blocks_counter: string;
  tombstoned: boolean;
  jailed_until: string;
}

interface RawSlashParams {
  signed_blocks_window: string;
  min_signed_per_window: string;
  downtime_jail_duration: string;
  slash_fraction_downtime: string;
  slash_fraction_double_sign: string;
}
