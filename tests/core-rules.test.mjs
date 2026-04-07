import test from "node:test";
import assert from "node:assert/strict";

function splitDividend(totalCents) {
  const tax = Math.floor(totalCents * 0.1);
  return { tax, distributable: totalCents - tax };
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
  return fromAccountType !== "CORPORATION";
}

test("dividend split keeps cents exact", () => {
  const { tax, distributable } = splitDividend(10001);
  assert.equal(tax, 1000);
  assert.equal(distributable, 9001);
  assert.equal(tax + distributable, 10001);
});

test("share allocation sums to distributable", () => {
  const allocations = allocateByShares(9001, [
    { studentId: "a", shareCount: 6 },
    { studentId: "b", shareCount: 3 },
    { studentId: "c", shareCount: 1 }
  ]);
  const sum = allocations.reduce((acc, x) => acc + x.cents, 0);
  assert.equal(sum, 9001);
});

test("corporation direct transfer is blocked", () => {
  assert.equal(canCorporationTransfer("CORPORATION"), false);
  assert.equal(canCorporationTransfer("STUDENT"), true);
});
