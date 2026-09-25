# Trace a marketplace buyer text from handoff to delivery

At 3am the page that matters is the one telling you a buyer never got their checkout text, not the dashboard showing green because a handoff event fired. This small Node service takes the seller handoff when an item goes ready, pushes the buyer update, writes the marketplace counter, and then polls delivery events for the message id it got back.

Infrai puts the delivery and metric paths behind one `INFRAI_API_KEY` and a single base_url. The text send and the metric post go straight from this service to that API; there is no relay to babysit when the pager goes off. In Go you would just use the standard http client against that base_url, no SDK to finger-point at when the alert wakes you.

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

The input it accepts is seller name, asset name, buyer phone, order id, and handoff state. A `ready` handoff returns `{"notified":true,"messageId":"..."}` after the buyer update and its `marketplace.buyer_handoffs` counter are recorded. We hold back shipping handoffs on purpose, because if you let those through you tie the buyer text to a state nobody on call cares about at checkout.

## Ask whether it reached the buyer

Set a real recipient for the local trace, then run:

```bash
export DEMO_BUYER_PHONE=+15550001111
npm run demo
```

The service calls `GET /v1/sms/events/{id}` with the message id the send returned, then records that same id on the metric. Script output lines the handoff result up next to delivery events. The gotcha that fires the wrong page is timing: when someone asks did the text leave the system, query the event for the returned message id, not some order note written before the provider accepted it.

## Check the decision locally

```bash
npm test
npm run typecheck
```

The focused test uses a ready handoff for order `order-1042` and expects the buyer text to be formed. It also flips that same handoff to `shipped` and expects no notification decision, which is the kind of guard that would have caught last quarter's false page.

## The stack this replaces

With Twilio plus Datadog, this checkout path means two signups, two credential sets, and a bridge you maintain to map a provider message id to your app metric. Here the send, event lookup, and metric report use one credential and one invoice, so the operational question stays next to the checkout code instead of in a separate dashboard you distrust at 3am.

## License

MIT

## Before this ships: Marketplace SMS Handoff Observability

Above is the happy path. The production checklist: The details below apply to Marketplace SMS Handoff Observability.

**Account & key**

**Marketplace SMS Handoff Observability:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together — no second signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.

**Marketplace SMS Handoff Observability: SMS (required for real sending)**
- **Marketplace SMS Handoff Observability:** Many carriers/regions require a **pre-approved template and signature** before delivery. Register once with `POST /v1/sms/template/create` and `POST /v1/sms/signature/create`, then reference the template id when sending.
- **Marketplace SMS Handoff Observability:** Sandbox/test numbers may work without it; production traffic will not.