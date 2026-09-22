export default {
  id: 'mq-why',
  title: 'Why Messaging? Synchronous vs Asynchronous',
  short: 'Why Messaging',
  icon: 'CompareArrowsRounded',
  tier: 'Foundations',
  order: 1,
  estHours: 4,
  prereqs: [],
  tagline: 'A queue turns "wait for me" into "I will get to it". Everything good and everything hard follows from that.',
  mentalModel:
    'A synchronous call couples two services in **time**: both must be up, and the caller waits. A message decouples them: the producer hands the message to a broker and walks away. You have bought availability and independence, and paid in ordering, duplicates, and the ability to know whether the work actually succeeded.',
  whyItMatters:
    'Most teams adopt messaging because "microservices need it", then spend a year discovering the costs. Knowing what you are trading *before* you add a broker is the difference between a system that scales and one that is merely harder to debug.',

  reference: {
    title: 'What changes when you go asynchronous',
    head: ['Property', 'Synchronous call', 'Asynchronous message'],
    rows: [
      ['Caller waits?', 'Yes — blocked until a reply', 'No — returns immediately'],
      ['Both services up?', '**Both** must be available', 'Only the producer and the broker'],
      ['Failure visible?', 'Immediately, to the caller', 'Later, somewhere else'],
      ['Ordering', 'Trivially sequential', 'Only per partition/queue, if at all'],
      ['Duplicates', 'None', '**Expect them** — at-least-once is the norm'],
      ['Load spikes', 'Passed straight through', 'Absorbed by the queue'],
      ['Adding a consumer', 'Change the producer', 'Subscribe — producer unchanged'],
      ['Debugging', 'One stack trace', 'Correlate across services and time'],
    ],
  },

  sections: [
    {
      id: 'the-problem',
      title: 'The problem, drawn',
      blocks: [
        { t: 'lead', text: 'We will follow one example for the whole track: a customer places an order. Everything that follows is a variation on this picture.' },
        {
          t: 'ascii',
          caption: 'Synchronous: the customer waits for every downstream service, in series.',
          code: `
  CUSTOMER
     │  POST /orders
     ▼
  ┌──────────────┐
  │ Order Service│
  └──────┬───────┘
         │ 1. charge card        ──▶ ┌─────────┐   180 ms
         │ ◀──────────────────────── │ Payment │
         │                           └─────────┘
         │ 2. reserve stock      ──▶ ┌───────────┐  120 ms
         │ ◀──────────────────────── │ Inventory │
         │                           └───────────┘
         │ 3. create shipment    ──▶ ┌──────────┐   200 ms
         │ ◀──────────────────────── │ Shipping │
         │                           └──────────┘
         │ 4. send email         ──▶ ┌───────────────┐  400 ms
         │ ◀──────────────────────── │ Notifications │
         ▼                           └───────────────┘
   201 Created                       TOTAL: ~900 ms

  And: if ANY of the four is down, the customer's order fails —
  even though the money was taken and the stock was reserved.`,
        },
        {
          t: 'p',
          text: 'Two separate problems are visible here. The **latency** is the sum of every call. The **availability** is the product of every dependency: four services at 99.9% each gives the order endpoint 99.6%, which is roughly three hours of downtime a month caused entirely by other teams.',
        },
        {
          t: 'ascii',
          caption: 'Asynchronous: the order is durable after one write, and everything else happens on its own time.',
          code: `
  CUSTOMER
     │  POST /orders
     ▼
  ┌──────────────┐   save order + publish event
  │ Order Service│ ──────────────┐
  └──────┬───────┘               │
         ▼                       ▼
   201 Created            ┌─────────────┐
   (~40 ms)               │   BROKER    │  topic: orders
                          │  OrderPlaced│
                          └──────┬──────┘
                                 │  fan-out: each consumer reads independently
             ┌───────────────────┼───────────────────┬───────────────┐
             ▼                   ▼                   ▼               ▼
       ┌─────────┐        ┌───────────┐       ┌──────────┐   ┌───────────────┐
       │ Payment │        │ Inventory │       │ Shipping │   │ Notifications │
       └─────────┘        └───────────┘       └──────────┘   └───────────────┘

  Customer sees 40 ms. Notifications can be down for an hour and
  nothing is lost — the messages wait.`,
        },
        {
          t: 'key',
          title: 'The three real wins',
          text: '**Latency** — the customer waits for one write, not four network calls. **Availability** — a consumer being down delays work instead of failing it. **Extensibility** — adding a fifth consumer (fraud scoring, analytics) requires no change to the Order Service at all. That last one is usually the biggest long-term benefit.',
        },
      ],
    },
    {
      id: 'the-cost',
      title: 'What it costs you — the scenarios nobody mentions',
      blocks: [
        { t: 'p', text: 'Each of these is a real situation you will hit. They are the reason the rest of this track exists.' },
        { t: 'h', text: 'Scenario 1 — the customer asks "did my order go through?"' },
        {
          t: 'ascii',
          caption: 'The 201 no longer means the order is complete.',
          code: `
  t=0ms    POST /orders          ──▶  201 Created   "Order #4471 placed"
  t=40ms   OrderPlaced published
  t=3s     Payment consumer picks it up ──▶  CARD DECLINED

  The customer has a confirmation page and an order id.
  The order is not actually paid for.

  You now need:
   • an explicit order STATUS (PENDING → CONFIRMED → FAILED)
   • a way to tell the customer later (email, push, polling, websocket)
   • a UI that does not promise more than the 201 actually means`,
        },
        {
          t: 'key',
          title: 'Asynchrony leaks into your domain model',
          text: 'The moment you go async, "the order exists" and "the order is paid" become different states, and your API has to expose that. This is not a technical detail you can hide — it changes what the product means. Teams that try to hide it end up with customers refreshing a page that never updates.',
        },
        { t: 'h', text: 'Scenario 2 — the same message arrives twice' },
        {
          t: 'ascii',
          caption: 'The classic at-least-once redelivery, step by step.',
          code: `
  BROKER                    PAYMENT CONSUMER
    │                              │
    │──── OrderPlaced #4471 ──────▶│
    │                              │  charge the card  ✔  (₹2,400 taken)
    │                              │
    │                              ✘  CRASH before acknowledging
    │
    │  no ack received → redeliver after the visibility timeout
    │                              │
    │──── OrderPlaced #4471 ──────▶│  (new instance)
    │                              │  charge the card  ✔  (₹2,400 taken AGAIN)
    │                              │
    │◀──── ack ────────────────────│

  The customer has been charged twice. The broker did nothing wrong:
  it could not tell "crashed before doing the work" from
  "crashed after doing the work".`,
        },
        {
          t: 'warn',
          title: 'This is not a rare edge case',
          text: 'It happens on every deploy, every pod eviction, every consumer-group rebalance and every network blip. In a busy system it happens daily. **Every consumer must be idempotent** — that is not advice, it is a requirement, and it gets its own chapter.',
        },
        { t: 'h', text: 'Scenario 3 — the events arrive out of order' },
        {
          t: 'ascii',
          caption: 'Two events about one order, processed by two consumer threads.',
          code: `
  Producer publishes, in order:
      1. OrderPlaced    (#4471, status PENDING)
      2. OrderCancelled (#4471, status CANCELLED)

  If they land on DIFFERENT partitions, two consumer threads race:

      thread A ── OrderCancelled ──▶ set status = CANCELLED   (t = 100ms)
      thread B ── OrderPlaced    ──▶ set status = PENDING     (t = 120ms)

  Final state: PENDING.
  A cancelled order is now live, and will be shipped.`,
        },
        {
          t: 'tip',
          title: 'The fix, previewed',
          text: 'Give every message a **key** — here, the order id. A broker routes all messages with the same key to the same partition, and one partition is processed in order by one consumer. Different orders still run in parallel. This is covered properly in the ordering chapter, but it is worth knowing now that "ordering" is a per-key property you have to ask for.',
        },
        { t: 'h', text: 'Scenario 4 — the database commits and the publish fails' },
        {
          t: 'ascii',
          caption: 'The dual-write problem: two systems, no shared transaction.',
          code: `
  Order Service
      │
      ├── BEGIN TRANSACTION
      ├── INSERT INTO orders ...          ✔
      ├── COMMIT                          ✔   the order now exists
      │
      └── broker.publish(OrderPlaced)     ✘   broker unreachable

  Result: an order in the database that nobody was ever told about.
  Not paid, not shipped, not cancelled. It simply sits there.

  Swapping the order does not help:
      publish ✔ then COMMIT ✘   →  an event for an order that does not exist`,
        },
        {
          t: 'key',
          title: 'There is no "just use a distributed transaction"',
          text: 'Your database and your broker are separate systems with no shared commit. The real fix is the **transactional outbox** — write the event into your own database in the same transaction, and publish it from there afterwards. It has its own chapter, and it is the single most important correctness pattern in this track.',
        },
      ],
    },
    {
      id: 'when',
      title: 'When to use messaging — and when not to',
      blocks: [
        {
          t: 'compare',
          left: {
            title: 'Use a message when',
            items: [
              'The caller does not need the result to continue',
              'The work can happen seconds or minutes later',
              'Several consumers care about the same fact',
              'You need to absorb traffic spikes',
              'The consumer may be down and that is tolerable',
              'The producer should not know who consumes',
            ],
          },
          right: {
            title: 'Use a direct call when',
            items: [
              'The caller needs the answer to proceed',
              'A human is waiting for the outcome',
              'You need a single transaction across both sides',
              'Strict global ordering is required',
              'There is exactly one consumer, forever',
              'The operational cost is not worth it',
            ],
          },
        },
        {
          t: 'ascii',
          caption: 'The most common real design: synchronous where it must be, asynchronous where it can be.',
          code: `
  POST /orders
      │
      ├─ SYNCHRONOUS (the customer is waiting, and these must be certain)
      │     ├── validate the request
      │     ├── check the inventory count
      │     └── save the order  (status = PENDING)
      │
      │     ◀── 201 Created, order #4471, status PENDING
      │
      └─ ASYNCHRONOUS (nobody is waiting; failures are recoverable)
            └── publish OrderPlaced
                  ├──▶ Payment        (may retry for minutes)
                  ├──▶ Inventory      (reserve stock)
                  ├──▶ Shipping       (create a label)
                  ├──▶ Notifications  (email, SMS)
                  └──▶ Analytics      (added later, nobody asked permission)`,
        },
        {
          t: 'trap',
          title: 'Do not use a queue as slow RPC',
          text: 'Publishing a `SendEmail` command to a queue and then polling another queue for the reply is a synchronous call wearing a costume. You get all the complexity of messaging and none of the decoupling. If the caller needs an answer, make the call.',
        },
        {
          t: 'note',
          title: 'The honest cost',
          text: 'A broker is another system to run, monitor, upgrade and page someone about at 3am. It needs a schema strategy, a dead-letter strategy and a replay strategy. For a small system with two services, a direct HTTP call with a retry is often the better engineering decision — and being able to say that is a sign of judgement, not laziness.',
        },
      ],
    },
    {
      id: 'shapes',
      title: 'The three shapes of messaging',
      blocks: [
        {
          t: 'ascii',
          caption: 'Point-to-point: one message, exactly one consumer gets it.',
          code: `
                       ┌───────────────────────┐
   Producer ─────────▶ │  QUEUE                │
                       │  [m1][m2][m3][m4]     │
                       └────┬─────────┬────────┘
                            │         │   competing consumers
                            ▼         ▼
                      Consumer A   Consumer B
                      gets m1,m3   gets m2,m4

  Used for: work distribution. Each task done once, by whoever is free.
  Scaling = add consumers. Order is NOT preserved across consumers.`,
        },
        {
          t: 'ascii',
          caption: 'Publish-subscribe: one message, every subscriber gets a copy.',
          code: `
                       ┌───────────────────────┐
   Producer ─────────▶ │  TOPIC: orders        │
                       │  OrderPlaced #4471    │
                       └──┬────────┬────────┬──┘
                          │        │        │   each gets its OWN copy
                          ▼        ▼        ▼
                     Payment  Shipping  Analytics

  Used for: broadcasting facts. Adding a subscriber changes nothing upstream.
  This is what makes event-driven architecture extensible.`,
        },
        {
          t: 'ascii',
          caption: 'Log-based (Kafka): a durable, replayable sequence that consumers read at their own position.',
          code: `
   TOPIC: orders, partition 0
   ┌────┬────┬────┬────┬────┬────┬────┬────┐
   │ 0  │ 1  │ 2  │ 3  │ 4  │ 5  │ 6  │ 7  │ ◀── append only, never mutated
   └────┴────┴────┴────┴────┴────┴────┴────┘
                  ▲              ▲         ▲
                  │              │         │
            Analytics       Payment    Shipping
            offset 2        offset 5   offset 7

  Each consumer group tracks its OWN offset. Messages are not deleted
  when read — they expire by time or size. So you can:
    • add a consumer tomorrow and replay everything from offset 0
    • rewind after a bug and reprocess
    • have a slow consumer without blocking a fast one`,
        },
        {
          t: 'key',
          title: 'Kafka’s big idea: the message is not consumed, it is read',
          text: 'In a classic queue, reading a message removes it — the broker holds the state of who has what. In a log, the message stays and the *consumer* holds a position. That single inversion is what gives you replay, multiple independent consumers, and the ability to fix a bug by rewinding. It is also why Kafka behaves differently from RabbitMQ or SQS in almost every way that matters.',
        },
      ],
    },
  ],

  patterns: [
    {
      id: 'sync-boundary',
      name: 'Draw the Synchronous Boundary Deliberately',
      oneLiner: 'Keep in the request only what must be true before you answer; publish the rest.',
      useWhen: ['Designing any write endpoint that triggers downstream work.'],
      recognize: ['An endpoint whose latency is the sum of three service calls.', 'An order failing because the email service was down.'],
      steps: [
        'List everything the operation does.',
        'For each item ask: if this failed, must the customer see an error *now*?',
        'Yes → keep it synchronous. No → publish an event.',
        'Give the resource an explicit status so the caller can see the async part complete.',
      ],
      template: {
        lang: 'java',
        caption: 'Validate and persist synchronously; announce asynchronously',
        code: `
@PostMapping("/orders")
public ResponseEntity<OrderDto> place(@Valid @RequestBody CreateOrderRequest req) {
    // SYNCHRONOUS — must be certain before we answer
    Order order = orderService.create(req);        // validates, saves, status PENDING

    // ASYNCHRONOUS — nobody is waiting on these
    events.publish(new OrderPlaced(order.id(), order.items(), order.total()));

    return ResponseEntity.created(location(order))
                         .body(OrderDto.from(order));   // status: PENDING
}`,
      },
      complexity: 'Latency becomes one database write; availability stops depending on downstream services.',
      gotchas: [
        'The API must expose the pending state honestly — a 201 that implies completion is a lie.',
        'Publishing after the commit is the dual-write problem; use an outbox.',
      ],
      problems: ['Split an endpoint into sync and async halves', 'Model the pending state in the API'],
    },
    {
      id: 'events-not-commands',
      name: 'Publish Facts, Not Instructions',
      oneLiner: 'An event says what happened; a command says what to do. Only one of them decouples.',
      useWhen: ['Deciding what to put on a topic.'],
      recognize: ['Messages named `SendEmail` or `ReserveStock`.', 'The producer needing a change every time a consumer is added.'],
      steps: [
        'Name the message in the past tense, after something that is now true.',
        'Include the data a consumer needs to act, not instructions about what to do.',
        'Let each consumer decide what the fact means for it.',
      ],
      template: {
        lang: 'java',
        caption: 'The difference is who owns the decision',
        code: `
// COMMAND — the producer decides what happens. One handler. Coupled.
record SendOrderConfirmationEmail(Long orderId, String to, String template) { }

// EVENT — the producer states a fact. Any number of consumers. Decoupled.
record OrderPlaced(Long orderId, String customerId,
                   List<Item> items, BigDecimal total, Instant placedAt) { }

// Notifications decides to send an email.
// Analytics decides to count revenue.
// Fraud decides to score the customer.
// The Order Service knows about none of them.`,
      },
      complexity: 'No runtime cost; a large difference in how the system evolves.',
      gotchas: [
        'Commands are legitimate — just be honest that they are point-to-point, and put them on a queue, not a broadcast topic.',
        'An event carrying a field only one consumer uses is a command in disguise.',
      ],
      problems: ['Convert a command topic to an event topic', 'Add a consumer without touching the producer'],
    },
    {
      id: 'design-for-redelivery',
      name: 'Assume Every Message Arrives Twice',
      oneLiner: 'Redelivery is normal operation, not a failure mode.',
      useWhen: ['Writing any consumer.'],
      recognize: ['Duplicate charges or duplicate rows after a deploy.', 'A consumer that assumes it sees each message once.'],
      steps: [
        'Prefer operations that are naturally idempotent (set a status, upsert).',
        'Otherwise record the message id and reject repeats.',
        'Test it by deliberately redelivering.',
      ],
      complexity: 'One extra check or insert per message.',
      gotchas: [
        '"Add 1 to the count" is not idempotent; "set the count to N" is.',
        'The de-duplication record must commit in the same transaction as the work.',
      ],
      problems: ['Force a redelivery and observe the duplicate', 'Make a consumer idempotent'],
    },
  ],

  pitfalls: [
    { title: 'Adopting messaging for its own sake', text: 'A broker is a system to operate. Two services and one HTTP call may be the better design.' },
    { title: 'Returning 201 as if the work is done', text: 'The customer sees success for an order that may fail three seconds later. Expose the status.' },
    { title: 'Assuming messages arrive once', text: 'At-least-once is the practical guarantee. Duplicates happen on every deploy.' },
    { title: 'Assuming messages arrive in order', text: 'Ordering is per partition or per queue, and only if you key correctly.' },
    { title: 'Publishing after a database commit', text: 'The dual-write problem — the event can be lost permanently.' },
    { title: 'Using a queue for request/response', text: 'Synchronous coupling with asynchronous complexity. The worst of both.' },
    { title: 'Ignoring the consumer being down', text: '"The queue will hold it" is true until the retention window expires.' },
    { title: 'No correlation id', text: 'Debugging across four services and three seconds without one is nearly impossible.' },
  ],

  cheatsheet: [
    { label: 'Sync couples in', value: 'time — both must be up' },
    { label: 'Async couples in', value: 'schema — both agree on the message' },
    { label: 'You gain', value: 'latency, availability, extensibility' },
    { label: 'You pay in', value: 'ordering, duplicates, debuggability' },
    { label: 'Delivery reality', value: 'at least once' },
    { label: 'Ordering reality', value: 'per key, per partition' },
    { label: 'Queue', value: 'one message → one consumer' },
    { label: 'Topic', value: 'one message → every subscriber' },
    { label: 'Log (Kafka)', value: 'consumers hold their own offset' },
    { label: 'Event', value: 'past tense, a fact' },
    { label: 'Command', value: 'imperative, one handler' },
    { label: 'DB + broker write', value: 'needs an outbox' },
    { label: 'Async changes', value: 'your domain model, not just the plumbing' },
  ],

  problems: [
    { name: 'Measure the synchronous chain', difficulty: 'Easy', pattern: 'Latency', insight: 'Build an endpoint calling three services that each sleep 200ms. Measure the p99, then compute the combined availability if each is 99.9%.' },
    { name: 'Split it into sync and async', difficulty: 'Easy', pattern: 'Boundary design', insight: 'Keep validation and the save synchronous; publish the rest. Measure the new p99 and note what the 201 now means.' },
    { name: 'Model the pending state', difficulty: 'Easy', pattern: 'API honesty', insight: 'Add a status field and an endpoint to poll it. Decide what the UI shows between PENDING and CONFIRMED.' },
    { name: 'Force a duplicate delivery', difficulty: 'Medium', pattern: 'At-least-once', insight: 'Process a message, kill the consumer before acknowledging, restart. Confirm the side effect happened twice.' },
    { name: 'Make that consumer idempotent', difficulty: 'Medium', pattern: 'Idempotency', insight: 'Add a processed-message table with a unique constraint and repeat the crash test. The second delivery should be a no-op.' },
    { name: 'Reorder two events about one entity', difficulty: 'Medium', pattern: 'Ordering', insight: 'Publish OrderPlaced and OrderCancelled with no key across three partitions. Run it fifty times and count how often the final status is wrong.' },
    { name: 'Fix it with a key', difficulty: 'Medium', pattern: 'Ordering', insight: 'Key both events by order id, repeat, and confirm the final status is now always correct.' },
    { name: 'Lose an event with a dual write', difficulty: 'Hard', pattern: 'Dual write', insight: 'Commit the order, then stop the broker before publishing. You are left with an order nobody was told about.' },
    { name: 'Add a consumer with no producer change', difficulty: 'Medium', pattern: 'Pub/sub', insight: 'Subscribe a new analytics service to the existing topic. The Order Service should require no deployment.' },
    { name: 'Replay from the beginning', difficulty: 'Hard', pattern: 'Log-based messaging', insight: 'Reset a consumer group to offset 0 and reprocess every order. Note that this is impossible with a classic queue.' },
  ],
}
