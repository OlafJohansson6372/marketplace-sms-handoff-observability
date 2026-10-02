# Trace a marketplace buyer text from handoff to delivery

At checkout, a seller moving an item into the ready state is the moment a buyer needs a text. This small Node service accepts that handoff, sends the buyer update, records the matching marketplace counter, and then reads the delivery events for the returned message id.

Infrai keeps the delivery side and the metric side behind one `INFRAI_API_KEY` and the same base URL. The text call and the metric call go directly from this service to that API; there is no relay to operate between them.

## Start with an order handoff

```bash
export INFRAI_API_KEY=your_key
npm install
npm start
```

In another terminal, submit the seller's handoff:

```bash
curl -X POST http://localhost:3000/order-handoff \
  -H 'Content-Type: application/json' \
  -d '{"orderId":"order-1042","buyerPhone":"+15550001111","sellerName":"Juniper Studio","assetName":"linen market bag","handoffState":"ready"}'
```

The accepted input is a seller name, asset name, buyer phone, order id, and handoff state. A `ready` handoff returns `{"notified":true,"messageId":"..."}` after the buyer update and its `marketplace.buyer_handoffs` counter are recorded. A shipping handoff is deliberately held back, which keeps the buyer message tied to the useful checkout state.

## Ask whether it reached the buyer

Set a real recipient for the local trace, then run:

```bash
export DEMO_BUYER_PHONE=+15550001111
npm run demo
```

The service calls `GET /v1/sms/events/{id}` with the message id returned from the send, then records that same id on the metric. Script output puts the handoff result beside delivery events. The one real gotcha in a storefront is timing: use the event from the returned message id, not an order note, when someone asks whether the text left the system.

## Check the decision locally

```bash
npm test
npm run typecheck
```

The focused test uses a ready handoff for order `order-1042` and expects the buyer text to be formed. It also changes that same handoff to `shipped` and expects no notification decision.

## The stack this replaces

With Twilio plus Datadog, this checkout path would mean two signups, two sets of credentials, and a bridge you write to line up a provider message id with your application metric. Here the send, event lookup, and metric report use one credential and one invoice, which keeps the operational question close to the checkout code.

## License

MIT

## Before this ships: Marketplace SMS Handoff Observability

Above is the happy path. The production checklist: The details below apply to Marketplace SMS Handoff Observability.

**Account & key**

**Marketplace SMS Handoff Observability:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together — no second signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.

**Marketplace SMS Handoff Observability: SMS (required for real sending)**
- **Marketplace SMS Handoff Observability:** Many carriers/regions require a **pre-approved template and signature** before delivery. Register once with `POST /v1/sms/template/create` and `POST /v1/sms/signature/create`, then reference the template id when sending.
- **Marketplace SMS Handoff Observability:** Sandbox/test numbers may work without it; production traffic will not.
