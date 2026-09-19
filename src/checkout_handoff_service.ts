import { createServer } from "node:http";
import { z } from "zod";
import { InfraiError, infrai } from "./infrai.js";
import { buyerText, handoffKey, shouldNotifyBuyer, type BuyerUpdate } from "./order_handoff.js";

const handoffInput = z.object({
  orderId: z.string().min(1),
  buyerPhone: z.string().min(1),
  sellerName: z.string().min(1),
  assetName: z.string().min(1),
  handoffState: z.enum(["ready", "shipped"]),
}).strict();

export async function handOffOrder(update: BuyerUpdate) {
  if (!shouldNotifyBuyer(update)) return { notified: false, reason: "handoff is still shipping" };
  const key = handoffKey(update.orderId);
  const sent = await infrai.sms.batch.send({
    messages: [{ to: update.buyerPhone, text: buyerText(update) }],
    idempotency_key: key,
  });
  const delivery = sent.message_id ? await infrai.sms.events(sent.message_id) : undefined;
  await infrai.metrics.report({
    name: "marketplace.buyer_handoffs",
    value: 1,
    type: "counter",
    tags: { state: update.handoffState, message_id: sent.message_id ?? "pending" },
    idempotency_key: `${key}-metric`,
  });
  return { notified: true, messageId: sent.message_id, delivery };
}

async function readBody(request: import("node:http").IncomingMessage): Promise<unknown> {
  let raw = "";
  for await (const chunk of request) raw += chunk;
  return JSON.parse(raw);
}

const server = createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/order-handoff") {
    response.writeHead(404).end();
    return;
  }
  try {
    const parsed = handoffInput.safeParse(await readBody(request));
    if (!parsed.success) {
      response.writeHead(400, { "Content-Type": "application/json" }).end(JSON.stringify({ error: parsed.error.flatten() }));
      return;
    }
    const result = await handOffOrder(parsed.data);
    response.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify(result));
  } catch (error) {
    const status = error instanceof InfraiError && error.status < 500 ? error.status : 502;
    response.writeHead(status, { "Content-Type": "application/json" }).end(JSON.stringify({ error: error instanceof Error ? error.message : "request failed" }));
  }
});

if (process.argv[1]?.endsWith("checkout_handoff_service.ts")) {
  server.listen(3000, () => console.log("Marketplace handoff service listening on http://localhost:3000"));
}
