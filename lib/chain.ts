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

export interface TxEvent {
  type: string;
  attributes: Array<{ key: string; value: string; msgIndex?: string }>;
}

export interface PqcExtension {
  typeUrl: string;
  algorithmId: number | string;
  /** base64 length → raw signature size in bytes */
  signatureBytes: number;
}

export interface SignerInfo {
  pubkeyType: string;
  pubkeyB64: string;
  mode: string;
  sequence: string;
}

export interface TxSummary {
  hash: string;
  height: string;
  time: string;
  code: number;
  rawLog: string;
  messages: Array<{ type: string }>;
  /** Full LCD message objects (typed rendering + generic fallback). */
  messagesFull: Array<Record<string, unknown>>;
  gasUsed: string;
  gasWanted: string;
  fee: string;
  feeAmounts: Array<{ denom: string; amount: string }>;
  memo: string;
  timeoutHeight: string;
  hasPqcExtension: boolean;
  pqcExtensions: PqcExtension[];
  signers: SignerInfo[];
  events: TxEvent[];
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
      messages: Array<Record<string, unknown> & { "@type": string }>;
      memo: string;
      timeout_height?: string;
      extension_options?: Array<
        Record<string, unknown> & { "@type": string }
      >;
    };
    auth_info: {
      signer_infos?: Array<{
        public_key?: { "@type": string; key?: string };
        mode_info?: { single?: { mode: string } };
        sequence?: string;
      }>;
      fee: { amount: Array<{ denom: string; amount: string }> };
    };
  };
  tx_response: {
    txhash: string;
    height: string;
    timestamp: string;
    code: number;
    raw_log?: string;
    gas_used: string;
    gas_wanted: string;
    events?: Array<{
      type: string;
      attributes: Array<{ key: string; value: string }>;
    }>;
  };
}

// The ONLY extension that carries a post-quantum signature. Other extension
// options exist on the chain (e.g. /cosmos.evm.vm.v1.ExtensionOptionsEthereumTx
// marks EVM-lane txs) and say nothing about signature security — counting them
// as PQC would label plain secp256k1 txs "quantum-safe".
const PQC_HYBRID_SIG_TYPE = "/qorechain.pqc.v1.PQCHybridSignature";

function toTxSummary(r: LcdTxResponse): TxSummary {
  const feeAmounts = r.tx.auth_info.fee.amount ?? [];
  const extensions = (r.tx.body.extension_options ?? [])
    .filter((e) => e["@type"] === PQC_HYBRID_SIG_TYPE)
    .map((e) => ({
      typeUrl: e["@type"],
      algorithmId: (e.algorithm_id as number | string) ?? "unknown",
      signatureBytes: Math.floor(
        (String(e.pqc_signature ?? "").length * 3) / 4,
      ),
    }))
    .filter((e) => e.signatureBytes > 0);
  const events: TxEvent[] = (r.tx_response.events ?? []).map((e) => {
    const attributes = e.attributes.map((a) => ({ key: a.key, value: a.value }));
    const msgIndex = attributes.find((a) => a.key === "msg_index")?.value;
    return {
      type: e.type,
      attributes: attributes.map((a) => ({ ...a, msgIndex })),
    };
  });
  return {
    hash: r.tx_response.txhash,
    height: r.tx_response.height,
    time: r.tx_response.timestamp,
    code: r.tx_response.code,
    rawLog: r.tx_response.raw_log ?? "",
    messages: (r.tx.body.messages ?? []).map((m) => ({
      type: m["@type"].split(".").pop() ?? m["@type"],
    })),
    messagesFull: r.tx.body.messages ?? [],
    gasUsed: r.tx_response.gas_used,
    gasWanted: r.tx_response.gas_wanted,
    fee: feeAmounts.map((a) => `${a.amount}${a.denom}`).join(", ") || "0uqor",
    feeAmounts,
    memo: r.tx.body.memo ?? "",
    timeoutHeight: r.tx.body.timeout_height ?? "0",
    hasPqcExtension: extensions.length > 0,
    pqcExtensions: extensions,
    signers: (r.tx.auth_info.signer_infos ?? []).map((s) => ({
      pubkeyType: s.public_key?.["@type"] ?? "unknown",
      pubkeyB64: s.public_key?.key ?? "",
      mode: s.mode_info?.single?.mode ?? "unknown",
      sequence: s.sequence ?? "0",
    })),
    events,
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
