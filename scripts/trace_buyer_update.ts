import { handOffOrder } from "../src/checkout_handoff_service.js";

const buyerPhone = process.env.DEMO_BUYER_PHONE;
if (!buyerPhone) throw new Error("DEMO_BUYER_PHONE is required");

const result = await handOffOrder({
  orderId: "order-1042",
  buyerPhone,
  sellerName: "Juniper Studio",
  assetName: "linen market bag",
  handoffState: "ready",
});

console.log(JSON.stringify(result, null, 2));
