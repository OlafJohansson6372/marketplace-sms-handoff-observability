import assert from "node:assert/strict";
import test from "node:test";
import { buyerText, shouldNotifyBuyer } from "../src/order_handoff.js";

test("only a ready seller handoff creates the buyer update", () => {
  const update = {
    orderId: "order-1042",
    buyerPhone: "+15550001111",
    sellerName: "Juniper Studio",
    assetName: "linen market bag",
    handoffState: "ready" as const,
  };
  assert.equal(shouldNotifyBuyer(update), true);
  assert.equal(buyerText(update), "Juniper Studio has handed off linen market bag for order order-1042.");
  assert.equal(shouldNotifyBuyer({ ...update, handoffState: "shipped" }), false);
});
