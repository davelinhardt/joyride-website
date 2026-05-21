/**
 * Unit tests for the /rides card-variant decision logic.
 * Run: node --test joyride-website/js/ride-card-variant.test.cjs
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { displayStatus, cardVariant, tapDestination, displayFare } = require("./ride-card-variant.js");

// ─── displayStatus ─────────────────────────────────────────────────

test("status=cancelled → cancelled", () => {
  assert.equal(displayStatus({ status: "cancelled" }), "cancelled");
});

test("status=completed → completed", () => {
  assert.equal(displayStatus({ status: "completed" }), "completed");
});

test("status=no_match → expired", () => {
  assert.equal(displayStatus({ status: "no_match" }), "expired");
});

test("status=expired → expired", () => {
  assert.equal(displayStatus({ status: "expired" }), "expired");
});

test("driver attached, status not terminal → scheduled", () => {
  assert.equal(displayStatus({ status: "matched", driverId: 42 }), "scheduled");
});

test("driver in nested form → scheduled", () => {
  assert.equal(displayStatus({ status: "confirmed", driver: { id: 7 } }), "scheduled");
});

test("no driver, not terminal → pending", () => {
  assert.equal(displayStatus({ status: "pending" }), "pending");
});

test("null row → pending (defensive)", () => {
  assert.equal(displayStatus(null), "pending");
});

test("uppercase status normalized", () => {
  assert.equal(displayStatus({ status: "CANCELLED" }), "cancelled");
});

// ─── cardVariant ───────────────────────────────────────────────────

test("pending with 0 bids → 'Waiting for driver…', no price, no highlight", () => {
  const v = cardVariant({ status: "pending", bidCount: 0 });
  assert.equal(v.status, "pending");
  assert.equal(v.hasBids, false);
  assert.equal(v.showPrice, false);
  assert.equal(v.highlight, false);
  assert.equal(v.headlineRightText, "Waiting for driver…");
});

test("pending with 1 bid → '1 offer' singular + highlight", () => {
  const v = cardVariant({ status: "pending", bidCount: 1 });
  assert.equal(v.hasBids, true);
  assert.equal(v.highlight, true);
  assert.equal(v.headlineRightText, "1 offer");
  assert.equal(v.showPrice, false, "VIEW BIDS pill replaces the price");
});

test("pending with 3 bids → '3 offers' plural + highlight", () => {
  const v = cardVariant({ status: "pending", bidCount: 3 });
  assert.equal(v.headlineRightText, "3 offers");
  assert.equal(v.highlight, true);
});

test("scheduled (driver assigned) → no highlight, shows price, no headline-right text", () => {
  const v = cardVariant({ status: "matched", driverId: 42 });
  assert.equal(v.status, "scheduled");
  assert.equal(v.highlight, false);
  assert.equal(v.showPrice, true);
  assert.equal(v.hasDriver, true);
  assert.equal(v.headlineRightText, null);
});

test("completed → shows price, has driver", () => {
  const v = cardVariant({ status: "completed", driverId: 99 });
  assert.equal(v.status, "completed");
  assert.equal(v.showPrice, true);
  assert.equal(v.hasDriver, true);
});

test("cancelled with driver → shows driver row, NO price", () => {
  const v = cardVariant({ status: "cancelled", driverId: 12 });
  assert.equal(v.status, "cancelled");
  assert.equal(v.showPrice, false, "Rider didn't complete the ride — price would mislead");
  // hasDriver is "status !== pending && driver attached" — for cancelled it's still true if driver was assigned.
  // The app shows the driver row on cancelled cards when a driver was attached.
});

test("cancelled with no driver → no price, no driver row", () => {
  const v = cardVariant({ status: "cancelled" });
  assert.equal(v.showPrice, false);
  assert.equal(v.hasDriver, false);
});

test("expired → shows price (estimatedFare), no driver row", () => {
  const v = cardVariant({ status: "expired", estimatedFare: "12.50" });
  assert.equal(v.status, "expired");
  assert.equal(v.showPrice, true);
});

// ─── tapDestination ────────────────────────────────────────────────

test("tap on completed → /receipt?id=N", () => {
  assert.equal(tapDestination({ id: 42, status: "completed" }), "/receipt?id=42");
});

test("tap on pending → /receipt?id=N (placeholder until ride-details page exists)", () => {
  assert.equal(tapDestination({ id: 7, status: "pending" }), "/receipt?id=7");
});

test("tap on row with no id → null", () => {
  assert.equal(tapDestination({ status: "pending" }), null);
});

test("tap on null row → null", () => {
  assert.equal(tapDestination(null), null);
});

test("tap encodes special chars in id (defensive)", () => {
  assert.equal(tapDestination({ id: "ab/cd" }), "/receipt?id=ab%2Fcd");
});

// ─── displayFare ───────────────────────────────────────────────────

test("completed fare = subtotal + tax + fees + tip", () => {
  const r = {
    status: "completed",
    totalFare: "10.00",
    salesTax: "0.75",
    govFees: "0.50",
    tipAmount: "2.00",
  };
  assert.equal(displayFare(r), "$13.25");
});

test("completed with no extras = subtotal", () => {
  assert.equal(displayFare({ status: "completed", totalFare: "8.50" }), "$8.50");
});

test("scheduled fare = estimatedFare", () => {
  assert.equal(displayFare({ status: "matched", driverId: 1, estimatedFare: "15.00" }), "$15.00");
});

test("pending → no fare displayed", () => {
  assert.equal(displayFare({ status: "pending", estimatedFare: "12.00" }), null);
});

test("cancelled → no fare displayed (even if totalFare set)", () => {
  assert.equal(displayFare({ status: "cancelled", totalFare: "10.00" }), null);
});

test("zero fare → null (don't display $0.00)", () => {
  assert.equal(displayFare({ status: "completed", totalFare: "0" }), null);
});

test("missing/null row → null", () => {
  assert.equal(displayFare(null), null);
});
