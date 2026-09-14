import test from "node:test";
import assert from "node:assert/strict";

function maxTransferAllowed(balance, fairMode) {
  if (fairMode) return balance;
  return balance * 0.1;
}

test("fair mode removes 10 percent cap for vault and goal", () => {
  assert.equal(maxTransferAllowed(1000, true), 1000);
  assert.equal(maxTransferAllowed(1000, false), 100);
});
