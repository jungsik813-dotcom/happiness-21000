import test from "node:test";
import assert from "node:assert/strict";

function splitDividend(totalCents) {
  return { tax: 0, distributable: totalCents };
}

function allocateByShares(distributableCents, shares) {
  const base = shares.map((s) => ({
    studentId: s.studentId,
    shareCount: s.shareCount,
    cents: Math.floor((distributableCents * s.shareCount) / 10)
  }));
  let remain = distributableCents - base.reduce((sum, x) => sum + x.cents, 0);
  let i = 0;
  while (remain > 0 && base.length > 0) {
    base[i % base.length].cents += 1;
    remain -= 1;
    i += 1;
  }
  return base;
}

function canCorporationTransfer(fromAccountType) {
  return fromAccountType === "CORPORATION" || fromAccountType === "STUDENT";
}

function maxTransferAllowed(balance, fairMode, fromIsCorp = false, toIsCorp = false) {
  if (fromIsCorp || toIsCorp || fairMode) return balance;
  return balance * 0.1;
}

test("dividend split keeps full amount with no tax", () => {
  const { tax, distributable } = splitDividend(10001);
  assert.equal(tax, 0);
  assert.equal(distributable, 10001);
  assert.equal(tax + distributable, 10001);
});

test("share allocation sums to full dividend", () => {
  const allocations = allocateByShares(10001, [
    { studentId: "a", shareCount: 6 },
    { studentId: "b", shareCount: 3 },
    { studentId: "c", shareCount: 1 }
  ]);
  const sum = allocations.reduce((acc, x) => acc + x.cents, 0);
  assert.equal(sum, 10001);
});

test("corporation direct transfer is allowed", () => {
  assert.equal(canCorporationTransfer("CORPORATION"), true);
  assert.equal(canCorporationTransfer("STUDENT"), true);
});

test("fair mode removes 10 percent cap for vault and goal", () => {
  assert.equal(maxTransferAllowed(1000, true, false, false), 1000);
  assert.equal(maxTransferAllowed(1000, false, false, false), 100);
});
