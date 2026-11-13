// node --experimental-strip-types --test tests/slimTxList.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { isTxListPath, LIST_MESSAGES_KEPT, slimTxList } from "../lib/slimTxList.ts";

const send = { "@type": "/cosmos.bank.v1beta1.MsgSend", from_address: "a", to_address: "b", amount: [] };

test("only the list route is slimmed, never a single tx", () => {
  assert.equal(isTxListPath("cosmos/tx/v1beta1/txs".split("/")), true);
  assert.equal(isTxListPath("cosmos/tx/v1beta1/txs/ABCD".split("/")), false);
  assert.equal(isTxListPath("cosmos/bank/v1beta1/balances/x".split("/")), false);
});

test("a 250-message batch keeps 5 messages and the full counts", () => {
  const body = {
    txs: [{ body: { messages: [...Array(250)].map(() => send), memo: "m" }, auth_info: {}, signatures: ["s"] }],
    tx_responses: [{
      txhash: "H", height: "1", code: 0, raw_log: "",
      tx: { huge: true },
      logs: [{ huge: true }],
      events: [
        { type: "transfer", attributes: [] },
        { type: "abstractaccount_execution_failed", attributes: [{ key: "reason", value: "r" }] },
        { type: "pqc_evm_window_used", attributes: [] },
      ],
    }],
    pagination: { total: "59" },
  };
  const out = slimTxList(body) as typeof body & { txs: Array<{ body: Record<string, unknown> }> };
  const b = out.txs[0].body;
  assert.equal((b.messages as unknown[]).length, LIST_MESSAGES_KEPT);
  assert.equal(b.message_count, 250);
  assert.deepEqual(b.message_type_counts, [{ type_url: "/cosmos.bank.v1beta1.MsgSend", count: 250 }]);
  assert.equal(b.memo, "m");
  const r = out.tx_responses[0] as Record<string, unknown>;
  assert.equal("tx" in r, false);
  assert.equal("logs" in r, false);
  assert.deepEqual((r.events as Array<{ type: string }>).map((e) => e.type), ["abstractaccount_execution_failed", "pqc_evm_window_used"]);
  assert.deepEqual(out.pagination, { total: "59" });
});

test("odd shapes pass through untouched", () => {
  assert.equal(slimTxList(null), null);
  assert.deepEqual(slimTxList({ code: 3, message: "x" }), { code: 3, message: "x" });
});
