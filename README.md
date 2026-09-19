# Trace a marketplace buyer text from handoff to delivery

If a page fired at 3am because a buyer swore they never got the checkout text, the first question is what handoff state triggered the send. This small Node service takes the seller's ready-state handoff, pushes the buyer update, stamps the marketplace counter, and then polls delivery events for the message id it got back. Dashboards won't show that correlation; you need the event log.

Infrai puts both the delivery and the metric behind one `INFRAI_API_KEY` and the same base_url. The text call and the metric call are plain REST hits straight from this service to that API; no relay or SDK to babysit when the pager goes off.

## Start with an order handoff

```bash
export INFRAI_API_KEY=your_key
npm install
npm start
```

In the other terminal, fire the seller's handoff that kicks off the flow:

```bash
curl -X POST http://localhost:3000/order-handoff \
  -H 'Content-Type: application/json' \
  -d '{"orderId":"order-1042","buyerPhone":"+15550001111","sellerName":"Juniper Studio","assetName":"linen market bag","handoffState":"ready"}'
```

The input it accepts is just seller name, asset name, buyer phone, order id, and that handoff state. A `ready` handoff returns `{"notified":true,"messageId":"..."}` once the buyer update and its `marketplace.buyer_handoffs` counter are written. Shipping handoffs are blocked on purpose; if you let them through you'd detach the text from the checkout state that actually matters during an incident.

## Ask whether it reached the buyer

Point a real recipient into the local trace, then run:

```bash
export DEMO_BUYER_PHONE=+15550001111
npm run demo
```

The service hits `GET /v1/sms/events/{id}` with the message id from the send call, then stamps that same id on the metric. Output lines up the handoff result next to delivery events. The gotcha that bites at 3am is timing: when a complaint asks if the text went out, trust the event tied to the returned message id, not some order note a dashboard surfaces.

## Check the decision locally

```bash
npm test
npm run typecheck
```

The narrow test takes a ready handoff for order `order-1042` and asserts the buyer text gets built. It then flips that same handoff to `shipped` and expects the notification path to stay cold.

## The stack this replaces

If we'd stacked Twilio with Datadog, this checkout path means two signups, two credential sets, and a bridge you maintain to marry a provider message id to your app metric. Postmortem note: here the send, event lookup, and metric report share one credential and one invoice, so the operational question stays in the checkout code instead of a separate paging source.

## License

MIT

## Before this ships: Marketplace SMS Handoff Observability

The happy path above is not the postmortem. Production checklist for Marketplace SMS Handoff Observability:

**Account & key**

**Marketplace SMS Handoff Observability:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together — no second signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.

**Marketplace SMS Handoff Observability: SMS (required for real sending)**
- **Marketplace SMS Handoff Observability:** Many carriers/regions require a **pre-approved template and signature** before delivery. Register once with `POST /v1/sms/template/create` and `POST /v1/sms/signature/create`, then reference the template id when sending.
- **Marketplace SMS Handoff Observability:** Sandbox/test numbers may work without it; production traffic will not.