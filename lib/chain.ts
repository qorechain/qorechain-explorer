/**
 * Client-side chain data fetchers — everything goes through the app's own
 * read-only proxies (/api/lcd, /api/status, /api/evm, /api/svm), which
 * resolve the active network from the qore-network cookie.
 *
 * @file lib/chain.ts
 */

export interface ChainStatus {
  ok: boolean;
  chainId?: string;
  height?: string;
  blockTime?: string;
  catchingUp?: boolean;
  error?: string;
}

export interface BlockSummary {
  height: string;
  hash: string;
  time: string;
  proposer: string;
  txCount: number;
  rawTxs: string[];
}

export interface TxSummary {
  hash: string;
  height: string;
  time: string;
  code: number;
  messages: Array<{ type: string }>;
  gasUsed: string;
  gasWanted: string;
  fee: string;
  memo: string;
  hasPqcExtension: boolean;
  raw: unknown;
}

async function lcd<T>(path: string): Promise<T> {
  const res = await fetch(`/api/lcd/${path}`, { cache: "no-store" });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(body?.message || body?.error || `LCD HTTP ${res.status}`);
  }
  return body as T;
}

export async function fetchStatus(): Promise<ChainStatus> {
  const res = await fetch("/api/status", { cache: "no-store" });
  return (await res.json()) as ChainStatus;
}

interface LcdBlock {
  block_id: { hash: string };
  block: {
    header: { height: string; time: string; proposer_address: string };
    data: { txs: string[] };
  };
}

function toBlockSummary(b: LcdBlock): BlockSummary {
  return {
    height: b.block.header.height,
    hash: b.block_id.hash,
    time: b.block.header.time,
    proposer: b.block.header.proposer_address,
    txCount: b.block.data.txs?.length ?? 0,
    rawTxs: b.block.data.txs ?? [],
  };
}

export async function fetchLatestBlock(): Promise<BlockSummary> {
  const b = await lcd<LcdBlock>("cosmos/base/tendermint/v1beta1/blocks/latest");
  return toBlockSummary(b);
}

export async function fetchBlock(height: string): Promise<BlockSummary> {
  const b = await lcd<LcdBlock>(
    `cosmos/base/tendermint/v1beta1/blocks/${height}`,
  );
  return toBlockSummary(b);
}

export async function fetchLatestBlocks(count = 10): Promise<BlockSummary[]> {
  const latest = await fetchLatestBlock();
  const h = BigInt(latest.height);
  const prev = await Promise.all(
    Array.from({ length: Math.min(count - 1, Number(h - 1n)) }, (_, i) =>
      fetchBlock((h - BigInt(i + 1)).toString()).catch(() => null),
    ),
  );
  return [latest, ...prev.filter((b): b is BlockSummary => b !== null)];
}

interface LcdTxResponse {
  tx: {
    body: {
      messages: Array<{ "@type": string }>;
      memo: string;
      extension_options?: Array<{ "@type": string }>;
    };
    auth_info: { fee: { amount: Array<{ denom: string; amount: string }> } };
  };
  tx_response: {
    txhash: string;
    height: string;
    timestamp: string;
    code: number;
    gas_used: string;
    gas_wanted: string;
  };
}

function toTxSummary(r: LcdTxResponse): TxSummary {
  const feeAmount =
    r.tx.auth_info.fee.amount?.map((a) => `${a.amount}${a.denom}`).join(", ") ||
    "0uqor";
  return {
    hash: r.tx_response.txhash,
    height: r.tx_response.height,
    time: r.tx_response.timestamp,
    code: r.tx_response.code,
    messages: (r.tx.body.messages ?? []).map((m) => ({
      type: m["@type"].split(".").pop() ?? m["@type"],
    })),
    gasUsed: r.tx_response.gas_used,
    gasWanted: r.tx_response.gas_wanted,
    fee: feeAmount,
    memo: r.tx.body.memo ?? "",
    hasPqcExtension: Boolean(r.tx.body.extension_options?.length),
    raw: r,
  };
}

export async function fetchTx(hash: string): Promise<TxSummary> {
  const r = await lcd<LcdTxResponse>(`cosmos/tx/v1beta1/txs/${hash}`);
  return toTxSummary(r);
}

export async function fetchTxs(
  query: string,
  limit = 15,
): Promise<TxSummary[]> {
  const r = await lcd<{ txs: LcdTxResponse["tx"][]; tx_responses: LcdTxResponse["tx_response"][] }>(
    `cosmos/tx/v1beta1/txs?query=${encodeURIComponent(query)}&order_by=ORDER_BY_DESC&pagination.limit=${limit}`,
  );
  const txs = r.tx_responses ?? [];
  return txs.map((resp, i) =>
    toTxSummary({ tx: r.txs[i], tx_response: resp }),
  );
}

export interface ValidatorSummary {
  operatorAddress: string;
  moniker: string;
  status: string;
  jailed: boolean;
  tokens: string;
  commission: string;
  website: string;
  details: string;
}

export async function fetchValidators(): Promise<ValidatorSummary[]> {
  const r = await lcd<{
    validators: Array<{
      operator_address: string;
      description: { moniker: string; website: string; details: string };
      status: string;
      jailed: boolean;
      tokens: string;
      commission: { commission_rates: { rate: string } };
    }>;
  }>("cosmos/staking/v1beta1/validators?pagination.limit=200");
  return (r.validators ?? [])
    .map((v) => ({
      operatorAddress: v.operator_address,
      moniker: v.description.moniker,
      status: v.status.replace("BOND_STATUS_", ""),
      jailed: v.jailed,
      tokens: v.tokens,
      commission: v.commission.commission_rates.rate,
      website: v.description.website,
      details: v.description.details,
    }))
    .sort((a, b) => (BigInt(b.tokens) > BigInt(a.tokens) ? 1 : -1));
}

export async function fetchSupply(): Promise<string> {
  const r = await lcd<{ amount: { amount: string } }>(
    "cosmos/bank/v1beta1/supply/by_denom?denom=uqor",
  );
  return r.amount.amount;
}

export async function fetchBondedTokens(): Promise<string> {
  const r = await lcd<{ pool: { bonded_tokens: string } }>(
    "cosmos/staking/v1beta1/pool",
  );
  return r.pool.bonded_tokens;
}

export async function fetchBankBalance(qorAddress: string): Promise<string> {
  const r = await lcd<{ balances: Array<{ denom: string; amount: string }> }>(
    `cosmos/bank/v1beta1/balances/${qorAddress}`,
  );
  return r.balances.find((b) => b.denom === "uqor")?.amount ?? "0";
}

export async function fetchAccountInfo(
  qorAddress: string,
): Promise<{ accountNumber: string; sequence: string } | null> {
  try {
    const r = await lcd<{
      account: {
        account_number?: string;
        sequence?: string;
        base_account?: { account_number: string; sequence: string };
      };
    }>(`cosmos/auth/v1beta1/accounts/${qorAddress}`);
    const acc = r.account.base_account ?? r.account;
    return {
      accountNumber: acc.account_number ?? "0",
      sequence: acc.sequence ?? "0",
    };
  } catch {
    return null;
  }
}

export async function evmCall<T>(
  method: string,
  params: unknown[] = [],
): Promise<T> {
  const res = await fetch("/api/evm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ method, params }),
  });
  const body = await res.json();
  if (body.error) {
    throw new Error(
      typeof body.error === "string" ? body.error : body.error.message,
    );
  }
  return body.result as T;
}

export async function svmCall<T>(
  method: string,
  params: unknown[] = [],
): Promise<T> {
  const res = await fetch("/api/svm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ method, params }),
  });
  const body = await res.json();
  if (body.error) {
    throw new Error(
      typeof body.error === "string" ? body.error : body.error.message,
    );
  }
  return body.result as T;
}

/** SHA-256 of base64 tx bytes → uppercase hex tx hash (for block tx lists). */
export async function txHashFromBase64(b64: string): Promise<string> {
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0"),
  )
    .join("")
    .toUpperCase();
}
