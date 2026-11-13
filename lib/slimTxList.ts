/**
 * Shrinks a transaction LIST response from the LCD before the proxy returns it.
 *
 * One batch transaction (250 MsgSend in one tx) is about 435 KB in the LCD:
 * every message, every transfer event, and the whole tx a second time inside
 * tx_response.tx. A page of 20 such transactions passes the platform's
 * response-size cap and comes back as HTTP 413 with an empty body, which the
 * pages used to show as "no transactions".
 *
 * Lists only need the header of each transaction, so this keeps:
 *  - the first LIST_MESSAGES_KEPT messages, plus message_count and
 *    message_type_counts computed over ALL messages (so the list can say
 *    "MsgSend ×250" and the security shield still sees every message type);
 *  - only the events the list views read (refused executions, the EVM
 *    post-quantum window, PQC verification);
 * and drops tx_response.tx (a duplicate of txs[i]) and tx_response.logs.
 *
 * The single-transaction route (/cosmos/tx/v1beta1/txs/{hash}) is not touched:
 * the transaction page shows everything.
 */

export const LIST_MESSAGES_KEPT = 5;

export const LIST_EVENT_TYPES = new Set([
  "abstractaccount_execution_failed",
  "pqc_evm_window_used",
  "pqc_hybrid_verify",
  "pqc_verify",
]);

const RAW_LOG_MAX = 2000;

/** True only for the list route, never for /txs/{hash}. */
export function isTxListPath(segments: string[]): boolean {
  return segments.join("/") === "cosmos/tx/v1beta1/txs";
}

type Json = Record<string, unknown>;

function slimTx(tx: unknown): unknown {
  if (!tx || typeof tx !== "object") return tx;
  const t = tx as Json;
  const body = t.body as Json | undefined;
  if (!body || !Array.isArray(body.messages)) return tx;
  const messages = body.messages as Json[];
  const counts = new Map<string, number>();
  for (const m of messages) {
    const type = String(m?.["@type"] ?? "");
    counts.set(type, (counts.get(type) ?? 0) + 1);
  }
  return {
    ...t,
    body: {
      ...body,
      messages: messages.slice(0, LIST_MESSAGES_KEPT),
      message_count: messages.length,
      message_type_counts: [...counts].map(([type_url, count]) => ({ type_url, count })),
    },
  };
}

function slimResponse(resp: unknown): unknown {
  if (!resp || typeof resp !== "object") return resp;
  const { tx: _dup, logs: _logs, ...r } = resp as Json;
  void _dup;
  void _logs;
  if (Array.isArray(r.events)) {
    r.events = (r.events as Json[]).filter((e) => LIST_EVENT_TYPES.has(String(e?.type)));
  }
  if (typeof r.raw_log === "string" && r.raw_log.length > RAW_LOG_MAX) {
    r.raw_log = r.raw_log.slice(0, RAW_LOG_MAX) + "…";
  }
  return r;
}

export function slimTxList(body: unknown): unknown {
  if (!body || typeof body !== "object") return body;
  const b = body as Json;
  return {
    ...b,
    ...(Array.isArray(b.txs) ? { txs: b.txs.map(slimTx) } : {}),
    ...(Array.isArray(b.tx_responses) ? { tx_responses: b.tx_responses.map(slimResponse) } : {}),
  };
}
