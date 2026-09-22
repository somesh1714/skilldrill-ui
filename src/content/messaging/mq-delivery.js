export default {
  id: 'mq-delivery',
  title: 'Delivery Guarantees & Idempotency',
  short: 'Delivery & Idempotency',
  icon: 'VerifiedRounded',
  tier: 'Foundations',
  order: 4,
  estHours: 5,
  prereqs: ['mq-primitives'],
  tagline: 'Exactly-once does not exist end to end. Here is what you build instead.',
  mentalModel:
    'Doing the work and recording that you did it are **two separate writes**. A crash can land between them, and no broker can tell "crashed before" from "crashed after". So you choose which risk you prefer — losing a message, or repeating one — and then you make the repeat harmless.',
  whyItMatters:
    'Every duplicate charge, double-shipped order and doubled counter comes from this one gap. It is also the interview question that most reliably separates people who have run an event-driven system from people who have read about one.',

  reference: {
    title: 'The three guarantees',
    head: ['Guarantee', 'How you get it', 'Risk', 'Use for'],
    rows: [
      ['**At most once**', 'Acknowledge *before* processing', 'Message lost on a crash', 'Metrics, logs — data you can afford to drop'],
      ['**At least once**', 'Acknowledge *after* processing', 'Duplicates on a crash', '**Almost everything.** The default'],
      ['**Effectively once**', 'At-least-once + idempotent consumer', 'None, if done properly', 'Payments, orders, anything that counts'],
    ],
  },

  sections: [
    {
      id: 'the-gap',
      title: 'The gap that cannot be closed',
      blocks: [
        {
          t: 'ascii',
          caption: 'Two writes, two systems, one crash window. This is the whole problem.',
          code: `
  CONSUMER                              SIDE EFFECT        OFFSET STORE
     │                                       │                   │
     │─── poll message #42 ─────────────────▶│                   │
     │                                       │                   │
     │─── charge the card ──────────────────▶│  ✔ money moved    │
     │                                       │                   │
     │                    ◀──── CRASH HERE ────────────────────  │
     │                                       │                   │
     │─── commit offset 42 ──────────────────┼──────────────────▶│
                                             │
  If it crashes in the gap:
      the money moved, the offset did not advance
      → message #42 is redelivered → charged AGAIN

  Swap the order and the gap simply moves:
      commit offset 42 ──▶ CRASH ──▶ charge never happens
      → the message is lost forever

  There is no ordering of these two writes that removes the window,
  because they are two different systems with no shared transaction.`,
        },
        {
          t: 'key',
          title: 'So the real question is never "how do I get exactly-once?"',
          text: 'It is "**which failure can my business tolerate?**" Losing a payment message is unrecoverable — nobody ever finds out. Processing it twice is detectable and preventable. That is why at-least-once plus idempotency is the universal answer, and why "exactly-once" is best described as *effectively once*.',
        },
        {
          t: 'note',
          title: 'What Kafka’s "exactly-once" actually means',
          text: 'Kafka does offer exactly-once semantics, and it is real — but it is scoped to **read from Kafka, process, write back to Kafka**, all inside one Kafka transaction. The moment your side effect is a database write, an HTTP call or an email, you are outside that boundary and back to at-least-once. That chapter comes later; the distinction matters now.',
        },
      ],
    },
    {
      id: 'sources',
      title: 'Where duplicates actually come from',
      blocks: [
        { t: 'p', text: 'People treat duplicates as exotic. In a real system they arrive from five ordinary directions, several of which happen every single deploy.' },
        {
          t: 'ascii',
          caption: 'Five routine causes. None of them is a bug.',
          code: `
  1. CONSUMER REBALANCE            ← happens on EVERY deploy
     pod restarts → partition reassigned → uncommitted messages redelivered

  2. PROCESSING SLOWER THAN max.poll.interval.ms
     broker assumes the consumer is dead → rebalance → redelivery
     (and the "dead" consumer is still happily processing)

  3. PRODUCER RETRY
     broker wrote the message but the ack was lost in the network
     → producer retries → the SAME message is stored twice

  4. NETWORK TIMEOUT ON THE ACK
     consumer committed, the commit response never arrived
     → consumer retries the commit, or restarts from the older offset

  5. DELIBERATE REPLAY
     you reset an offset to reprocess after fixing a bug
     → everything after that point arrives again, by design`,
        },
        {
          t: 'warn',
          title: 'Cause 2 is the one that catches teams out',
          text: 'A consumer that takes longer than `max.poll.interval.ms` (five minutes by default) between polls is presumed dead. The broker rebalances, another consumer picks up the same messages, and now **two consumers are processing the same work simultaneously** — the original has not stopped. If your handler can be slow, either reduce `max.poll.records` or process asynchronously and poll on time.',
        },
      ],
    },
    {
      id: 'idempotency',
      title: 'Making the duplicate harmless',
      blocks: [
        { t: 'lead', text: 'There are three techniques, in increasing order of cost. Always try them in this order.' },
        { t: 'h', text: 'Technique 1 — make the operation naturally idempotent' },
        {
          t: 'code',
          lang: 'java',
          caption: 'The cheapest solution: nothing to track at all',
          code: `
// NOT idempotent — running twice gives the wrong answer
order.setItemCount(order.getItemCount() + 1);
balance = balance - amount;
inventory.decrement(sku, 1);

// IDEMPOTENT — running twice gives the same answer
order.setStatus(CONFIRMED);                      // set, do not toggle
order.setItemCount(event.itemCount());           // absolute, not relative
inventory.setReserved(sku, event.totalReserved()); // state, not delta

// Upsert is idempotent by construction
INSERT INTO order_status (order_id, status, updated_at)
VALUES (?, ?, ?)
ON CONFLICT (order_id) DO UPDATE
SET status = EXCLUDED.status, updated_at = EXCLUDED.updated_at;`,
        },
        {
          t: 'key',
          title: 'Prefer absolute state over deltas in event payloads',
          text: 'An event saying "quantity is now 7" can be applied any number of times. An event saying "add 1" cannot. This is a schema design decision that removes an entire class of bug before it exists — and it costs nothing.',
        },
        { t: 'h', text: 'Technique 2 — a de-duplication table' },
        {
          t: 'code',
          lang: 'java',
          caption: 'The insert IS the check — never check-then-act',
          code: `
@Transactional
public void handle(OrderPlaced event) {
    try {
        // A unique constraint on event_id does the de-duplication.
        // This is in the SAME transaction as the work, so a crash
        // cannot leave one without the other.
        processed.save(new ProcessedEvent(event.eventId(), Instant.now()));
    } catch (DataIntegrityViolationException duplicate) {
        log.debug("Event {} already processed, skipping", event.eventId());
        return;
    }

    paymentGateway.charge(event.orderId(), event.total());
}

// WRONG — a race between the check and the insert:
// if (processed.exists(id)) return;      ← two consumers both see "no"
// doWork();
// processed.save(id);                    ← both do the work`,
        },
        {
          t: 'ascii',
          caption: 'Why the unique constraint has to be inside the transaction.',
          code: `
  SAFE — one transaction
  ┌──────────────────────────────────────────┐
  │ BEGIN                                    │
  │   INSERT INTO processed_events (id)      │ ← unique constraint
  │   INSERT INTO payments (...)             │
  │ COMMIT                                   │   both or neither
  └──────────────────────────────────────────┘

  BROKEN — two transactions
  ┌──────────────────────┐   ┌──────────────────────┐
  │ INSERT processed     │   │ INSERT payment       │
  │ COMMIT               │   │ COMMIT               │
  └──────────────────────┘   └──────────────────────┘
            ✔                        ✘ crash
  Result: marked as processed, but the payment never happened.
  The retry is skipped. The message is silently lost.`,
        },
        {
          t: 'warn',
          title: 'The de-duplication table needs a retention policy',
          text: 'It grows with every message forever. Delete rows older than your maximum possible redelivery window — usually the topic retention plus a margin, so a few days. Index the timestamp or the cleanup job becomes a table scan.',
        },
        { t: 'h', text: 'Technique 3 — an idempotency key at the external boundary' },
        {
          t: 'code',
          lang: 'java',
          caption: 'When the side effect is someone else’s system',
          code: `
// A de-duplication table cannot help if the duplicate reaches the
// payment provider. Push the key outward instead — every serious
// payment API supports this.
public Receipt charge(OrderPlaced event) {
    return stripe.charges()
        .create(ChargeParams.builder()
                .amount(event.total())
                .customer(event.customerId())
                .build(),
                RequestOptions.builder()
                        // Same key = same charge. Stripe returns the
                        // ORIGINAL receipt instead of charging again.
                        .setIdempotencyKey("order-" + event.orderId())
                        .build());
}`,
        },
        {
          t: 'tip',
          title: 'Derive the key from the business fact, not from the message',
          text: '`"order-" + orderId` is stable across redeliveries, retries and even a full replay. A random UUID generated per attempt is not — it changes on every retry, so it de-duplicates nothing. The key should answer "which real-world operation is this?", not "which delivery attempt is this?".',
        },
      ],
    },
    {
      id: 'worked',
      title: 'Worked example: making the payment consumer safe',
      blocks: [
        { t: 'p', text: 'Putting it together on the running example. Every line here exists because of a specific failure.' },
        {
          t: 'ascii',
          caption: 'The order of operations, and what each one defends against.',
          code: `
  message OrderPlaced #4471 arrives (possibly for the 2nd time)
        │
        ▼
  ┌─────────────────────────────────────────────────────────────┐
  │ BEGIN TRANSACTION                                           │
  │                                                             │
  │  1. INSERT processed_events(event_id)     ← unique key      │
  │       duplicate? → ROLLBACK, ack, done    ← defends against │
  │                                              redelivery      │
  │  2. charge via gateway WITH idempotency key "order-4471"    │
  │       ← defends against a duplicate that got past step 1,   │
  │         e.g. a crash after the gateway call but before commit│
  │                                                             │
  │  3. INSERT payment(order_id, amount, receipt_id)            │
  │                                                             │
  │ COMMIT                                                      │
  └─────────────────────────────────────────────────────────────┘
        │
        ▼
  4. acknowledge the message  ← LAST. A crash before this
                                 redelivers, and step 1 catches it.`,
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'The consumer, with the defences labelled',
          code: `
@KafkaListener(topics = "orders", groupId = "payment-service")
@Transactional
public void onOrderPlaced(OrderPlaced event, Acknowledgment ack) {
    try {
        processedRepo.save(new ProcessedEvent(event.eventId()));   // (1)
    } catch (DataIntegrityViolationException duplicate) {
        ack.acknowledge();                                          // already done
        return;
    }

    // (2) external idempotency key derived from the business fact
    Receipt receipt = gateway.charge(event.total(), event.customerId(),
                                     "order-" + event.orderId());

    paymentRepo.save(Payment.from(event, receipt));                 // (3)

    ack.acknowledge();                                              // (4) LAST
}`,
        },
        {
          t: 'trap',
          title: 'The external call is still outside your transaction',
          text: 'Step 2 talks to a third party and cannot be rolled back. If the transaction fails after the charge succeeds, the money has moved but your database does not know. The gateway’s idempotency key is what saves you: the redelivery calls again with the same key and gets the *original* receipt back rather than a second charge. This is why both defences are needed, not one.',
        },
        {
          t: 'note',
          title: 'Acknowledging a duplicate is correct',
          text: 'When step 1 detects a repeat, you acknowledge and return. Not acknowledging would redeliver it forever. The message has genuinely been handled — just not by this delivery.',
        },
      ],
    },
  ],

  patterns: [
    {
      id: 'at-least-once-plus-idempotent',
      name: 'At-Least-Once Plus an Idempotent Consumer',
      oneLiner: 'Never lose a message; make repeating one a no-op.',
      useWhen: ['Every consumer of anything that matters.'],
      recognize: ['Auto-commit enabled.', 'A consumer that assumes single delivery.'],
      steps: [
        'Disable auto-commit; acknowledge after the work is durable.',
        'Make the operation naturally idempotent if you can.',
        'Otherwise add a de-duplication row in the same transaction.',
        'Push an idempotency key to any external system.',
      ],
      complexity: 'One insert per message, plus a cleanup job.',
      gotchas: [
        'Check-then-act is a race; rely on the unique constraint.',
        'The de-duplication row and the work must commit together.',
        'Acknowledge a detected duplicate, or it redelivers forever.',
      ],
      problems: ['Force a duplicate and defend against it', 'Show check-then-act racing'],
    },
    {
      id: 'absolute-state',
      name: 'Carry Absolute State, Not Deltas',
      oneLiner: 'Design the payload so applying it twice changes nothing.',
      useWhen: ['Designing any event schema.'],
      recognize: ['Fields named `increment`, `delta`, `adjustBy`.', 'Counters that drift over time.'],
      steps: ['Express the new state rather than the change.', 'Include a version or timestamp so stale events can be ignored.'],
      template: {
        lang: 'java',
        caption: 'The version field also defends against out-of-order delivery',
        code: `
record StockChanged(String sku, int quantityNow, long version) { }   // ✔
record StockAdjusted(String sku, int delta) { }                      // ✘

@Transactional
public void apply(StockChanged e) {
    Stock stock = repo.findBySku(e.sku()).orElseThrow();
    if (e.version() <= stock.getVersion()) return;    // stale or duplicate
    stock.setQuantity(e.quantityNow());
    stock.setVersion(e.version());
}`,
      },
      complexity: 'Free at design time; expensive to retrofit.',
      gotchas: [
        'Absolute state means larger payloads — usually worth it.',
        'Without a version you cannot distinguish a duplicate from a genuine later change.',
      ],
      problems: ['Drift a counter with delta events', 'Fix it with absolute state and a version'],
    },
    {
      id: 'business-idempotency-key',
      name: 'Idempotency Key Derived From the Business Fact',
      oneLiner: 'The key must be the same on every attempt at the same real operation.',
      useWhen: ['Calling any external system that can charge, send or create.'],
      recognize: ['A UUID generated inside the retry loop.', 'Duplicate charges despite retries being "idempotent".'],
      steps: ['Build the key from stable ids: `order-4471`, `invoice-88-refund`.', 'Pass it to the provider.', 'Store the returned reference so you can reconcile later.'],
      complexity: 'One header on the outbound call.',
      gotchas: [
        'A per-attempt UUID de-duplicates nothing.',
        'Providers expire idempotency keys — typically 24 hours. Beyond that a replay really will charge again.',
      ],
      problems: ['Double-charge with a random key', 'Fix it with a derived key'],
    },
  ],

  pitfalls: [
    { title: 'Believing exactly-once is available end to end', text: 'It is not, once a non-Kafka side effect is involved.' },
    { title: 'Auto-commit', text: 'Commits on a timer regardless of whether your handler succeeded.' },
    { title: 'Check-then-act de-duplication', text: 'Two consumers both see "not processed" and both do the work.' },
    { title: 'De-duplication row in a separate transaction', text: 'A crash between them silently loses the message.' },
    { title: 'Random idempotency keys', text: 'They change per attempt, so they prevent nothing.' },
    { title: 'Delta events', text: 'Every duplicate corrupts the total, permanently.' },
    { title: 'An unbounded de-duplication table', text: 'It grows forever. Add retention and an index.' },
    { title: 'Slow handlers exceeding max.poll.interval.ms', text: 'The broker rebalances while you are still working, so two consumers process the same message at once.' },
    { title: 'Not acknowledging a detected duplicate', text: 'It is redelivered forever and blocks the partition.' },
  ],

  cheatsheet: [
    { label: 'Ack before work', value: 'at most once — can lose' },
    { label: 'Ack after work', value: 'at least once — can duplicate' },
    { label: 'Practical answer', value: 'at-least-once + idempotent' },
    { label: 'Kafka exactly-once', value: 'Kafka→Kafka only' },
    { label: 'Cheapest defence', value: 'a naturally idempotent operation' },
    { label: 'Next defence', value: 'unique constraint on event id' },
    { label: 'Must be', value: 'in the same transaction as the work' },
    { label: 'Never', value: 'check-then-act' },
    { label: 'External systems', value: 'idempotency key from the business id' },
    { label: 'Payload rule', value: 'absolute state, plus a version' },
    { label: 'Duplicate sources', value: 'rebalance, slow poll, retry, replay' },
    { label: 'Dedup table', value: 'needs retention + an index' },
    { label: 'Detected duplicate', value: 'acknowledge it and move on' },
  ],

  problems: [
    { name: 'Lose a message with auto-commit', difficulty: 'Easy', pattern: 'At most once', insight: 'Enable auto-commit, throw from the handler, restart. The message never comes back.' },
    { name: 'Duplicate a message with manual ack', difficulty: 'Easy', pattern: 'At least once', insight: 'Process, then kill the consumer before acknowledging. On restart the same message arrives again and the side effect happens twice.' },
    { name: 'Add a de-duplication table', difficulty: 'Medium', pattern: 'Idempotency', insight: 'Unique constraint on event_id, inserted in the same transaction. Repeat the crash test and confirm the second delivery is a no-op.' },
    { name: 'Race check-then-act', difficulty: 'Medium', pattern: 'Idempotency', insight: 'Two consumers, same message, an exists() check before the insert. Under concurrency both pass the check and both do the work.' },
    { name: 'Split the dedup row into its own transaction', difficulty: 'Hard', pattern: 'Transactional boundary', insight: 'Commit the marker first, then crash before the work. The message is marked done and never retried — a silent loss.' },
    { name: 'Double-charge with a random key', difficulty: 'Medium', pattern: 'External idempotency', insight: 'Generate the idempotency key inside the retry. Two attempts, two charges. Derive it from the order id and the second returns the original receipt.' },
    { name: 'Drift a counter with deltas', difficulty: 'Medium', pattern: 'Payload design', insight: 'Publish "add 1" events and redeliver ten of them. The total is wrong and unrecoverable. Switch to absolute state and repeat.' },
    { name: 'Trigger a rebalance with a slow handler', difficulty: 'Hard', pattern: 'Poll interval', insight: 'Sleep longer than max.poll.interval.ms inside the handler. The broker reassigns the partition while you are still processing it.' },
    { name: 'Grow a dedup table until it hurts', difficulty: 'Medium', pattern: 'Retention', insight: 'Insert a million rows with no cleanup and time the duplicate check before and after adding an index and a retention job.' },
    { name: 'Build the full safe consumer', difficulty: 'Hard', pattern: 'End to end', insight: 'Dedup row, external idempotency key, work and ack in the right order. Kill it at four different points and confirm the outcome is correct every time.' },
  ],
}
