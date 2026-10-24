// node --experimental-strip-types --test tests/lcdTarget.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { lcdTarget } from "../lib/lcdTarget.ts";

const REST = "https://api.qore.host";
const seg = (p: string) => p.split("/");

test("ordinary explorer paths pass and keep their query", () => {
  const u = lcdTarget(REST, seg("cosmos/tx/v1beta1/txs"), "?query=tx.height%3E0&limit=1");
  assert.equal(u?.toString(), "https://api.qore.host/cosmos/tx/v1beta1/txs?query=tx.height%3E0&limit=1");
  assert.ok(lcdTarget(REST, seg("qorechain/license/v1/check/qor1abc/lightnode_operator"), ""));
  assert.ok(lcdTarget(REST, seg("cosmwasm/wasm/v1/code"), ""));
});

test("dot segments are refused in every encoding (QSR-2026-0619)", () => {
  for (const p of [
    "cosmos/..%2fibc/core/channel/v1/channels",
    "cosmos/%2e%2e%2fibc/core/channel/v1/channels",
    "cosmos/%2E%2E/ibc/core",
    "cosmos/%252e%252e/ibc/core",
    "cosmos/../ibc/core",
    "cosmos/./bank",
  ]) assert.equal(lcdTarget(REST, seg(p), ""), null, p);
});

test("encoded slashes and backslashes inside a segment are refused", () => {
  assert.equal(lcdTarget(REST, ["cosmos", "a%2fb"], ""), null);
  assert.equal(lcdTarget(REST, ["cosmos", "a%5cb"], ""), null);
  assert.equal(lcdTarget(REST, ["cosmos", "a\\..\\b"], ""), null);
});

test("paths outside the allowlist are refused", () => {
  assert.equal(lcdTarget(REST, seg("ibc/core/channel/v1/channels"), ""), null);
  assert.equal(lcdTarget(REST, seg("cosmosx/bank"), ""), null);
  assert.equal(lcdTarget(REST, [], ""), null);
});

test("the target never leaves the REST origin", () => {
  assert.equal(lcdTarget(REST, ["cosmos", "%2f%2fevil.example"], ""), null);
  const u = lcdTarget("https://api.qore.host/", seg("cosmos/bank/v1beta1/supply"), "");
  assert.equal(u?.origin, "https://api.qore.host");
});
