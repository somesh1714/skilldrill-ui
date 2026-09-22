export default {
  id: 'mq-outbox',
  title: 'The Transactional Outbox & Change Data Capture',
  short: 'Outbox & CDC',
  icon: 'OutboxRounded',
  tier: 'Advanced',
  order: 11,
  estHours: 5,
  prereqs: ['mq-delivery', 'kafka-producer'],
  tagline: 'The single most important correctness pattern in event-driven systems.',
  mentalModel:
    'You cannot atomically write to your database and to a broker — they are two systems with no shared commit. So do not try. Write the event **into your own database**, in the same transaction as the business change, and let a separate process publish it. One atomic write, one unreliable step that can safely retry.',
  whyItMatters:
    'Without it, every service that saves data and publishes an event has a window in which the data exists and the event does not. It is invisible in testing, happens during any broker blip, and produces orders nobody was told about. This is the pattern that separates systems that are eventually consistent from systems that are eventually wrong.',

  reference: {
    title: 'Publishing strategies compared',
    head: ['Approach', 'Can lose events?', 'Duplicates?', 'Complexity'],
    rows: [
      ['Publish inside the transaction', '**Yes** — broker failure loses it', 'Possible', 'Low'],
      ['Publish after commit', '**Yes** — a crash between loses it', 'Possible', 'Low'],
      ['**Outbox + poller**', 'No', 'Yes — handled by consumers', 'Medium'],
      ['**Outbox + CDC (Debezium)**', 'No', 'Yes', 'Medium-high (another system)'],
      ['Kafka transactions', 'No, but Kafka-only', 'No, within Kafka', 'High, and does not cover the DB'],
    ],
  },

  sections: [
    {
      id: 'dual-write',
      title: 'The dual-write problem, precisely',
      blocks: [
        {
          t: 'ascii',
          caption: 'Both orderings fail. There is no third ordering.',
          code: `
  ATTEMPT 1 — commit, then publish
  ┌──────────────────────────────────────────────────────┐
  │ BEGIN                                                │
  │   INSERT INTO orders ...                             │
  │ COMMIT                                      ✔        │  order exists
  └──────────────────────────────────────────────────────┘
         │
         ▼
    kafka.send(OrderPlaced)                      ✘ broker down

    RESULT: an order in the database that no other service
            will ever hear about. Never paid, never shipped,
            never cancelled. It simply sits there.


  ATTEMPT 2 — publish, then commit
    kafka.send(OrderPlaced)                      ✔
  ┌──────────────────────────────────────────────────────┐
  │ BEGIN                                                │
  │   INSERT INTO orders ...                             │
  │ COMMIT                                      ✘ crash  │
  └──────────────────────────────────────────────────────┘

    RESULT: Payment charges a card for an order that does
            not exist. Worse than the first case.`,
        },
        {
          t: 'trap',
          title: 'Retrying the publish does not fix it',
          text: 'A retry loop helps only while the process is alive. If the pod is evicted between the commit and the successful publish — which is exactly what happens during a deploy — the retry state dies with it. The event is gone and nothing in the system knows it should have existed.',
        },
      ],
    },
    {
      id: 'outbox',
      title: 'The outbox, drawn',
      blocks: [
        {
          t: 'ascii',
          caption: 'One atomic write. The unreliable step happens later and can retry forever.',
          code: `
   ORDER SERVICE
  ┌──────────────────────────────────────────────────────┐
  │ BEGIN TRANSACTION                                    │
  │                                                      │
  │   INSERT INTO orders (id, customer, total, status)   │
  │   INSERT INTO outbox (id, aggregate_id, type,        │
  │                       payload, created_at)           │
  │                                                      │
  │ COMMIT                     ← BOTH or NEITHER         │
  └──────────────────────────────────────────────────────┘
                     │
                     │  the database is now the source of truth
                     │  for "this event must be published"
                     ▼
   ┌────────────────────────────────────────────────┐
   │  RELAY  (a poller, or Debezium reading the WAL)│
   │                                                │
   │  1. SELECT * FROM outbox WHERE sent_at IS NULL │
   │  2. publish to Kafka                           │
   │  3. UPDATE outbox SET sent_at = now()          │
   └────────────────────────────────────────────────┘
                     │
                     ▼
                   KAFKA

  Crash between 2 and 3?  → republished on the next pass.
                             A DUPLICATE, which consumers handle.
  Crash before 2?         → still unsent, picked up next pass.
  Broker down for an hour? → rows accumulate, then drain. Nothing lost.`,
        },
        {
          t: 'key',
          title: 'The pattern converts "may be lost" into "may be duplicated"',
          text: 'That is the whole point, and it is a very good trade. A lost event is unrecoverable and usually undetectable. A duplicate is handled by the idempotent consumers you already needed for at-least-once delivery. You are not adding a new requirement — you are making an existing one sufficient.',
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'The table and the write',
          code: `
CREATE TABLE outbox (
    id            UUID PRIMARY KEY,
    aggregate_id  VARCHAR(64)  NOT NULL,   -- becomes the Kafka key
    aggregate_type VARCHAR(64) NOT NULL,   -- selects the topic
    event_type    VARCHAR(64)  NOT NULL,
    payload       JSONB        NOT NULL,
    headers       JSONB,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    sent_at       TIMESTAMPTZ
);

-- The index the poller lives on. Partial, so it stays tiny.
CREATE INDEX ix_outbox_unsent ON outbox (created_at)
    WHERE sent_at IS NULL;

@Transactional
public Order place(OrderRequest request) {
    Order order = orderRepository.save(Order.from(request));

    outboxRepository.save(new OutboxEvent(
            UUID.randomUUID(),
            order.id().toString(),        // aggregate id → Kafka key → ordering
            "order",
            "OrderPlaced",
            json(OrderPlaced.from(order))));

    return order;                          // ONE commit covers both
}`,
        },
      ],
    },
    {
      id: 'relay',
      title: 'The relay: polling versus change data capture',
      blocks: [
        {
          t: 'code',
          lang: 'java',
          caption: 'The polling relay — simple, and adequate for most systems',
          code: `
@Scheduled(fixedDelay = 500)
@Transactional
public void publishOutbox() {
    // SKIP LOCKED lets several instances poll concurrently without
    // stepping on each other or blocking.
    List<OutboxEvent> batch = outboxRepository.claimUnsent(100);

    for (OutboxEvent e : batch) {
        try {
            kafka.send(topicFor(e.aggregateType()),
                       e.aggregateId(),          // key preserves per-entity order
                       e.payload())
                 .get(5, TimeUnit.SECONDS);      // synchronous: we must know

            e.markSent(Instant.now());
        } catch (Exception ex) {
            log.warn("Publish failed for outbox {}, will retry", e.id(), ex);
            break;   // STOP — publishing later rows would reorder this aggregate
        }
    }
}

// The claim query
@Query(value = """
    SELECT * FROM outbox
    WHERE sent_at IS NULL
    ORDER BY created_at
    LIMIT :limit
    FOR UPDATE SKIP LOCKED
    """, nativeQuery = true)
List<OutboxEvent> claimUnsent(int limit);`,
        },
        {
          t: 'warn',
          title: 'Break the loop on failure, or you reorder events',
          text: 'If the publish of event 3 fails and you continue to event 4, then event 4 reaches Kafka before event 3 does. For the same aggregate that is an ordering violation — `OrderCancelled` arriving before `OrderPlaced`. Stop the batch at the first failure and let the next pass retry from there.',
        },
        {
          t: 'ascii',
          caption: 'CDC: no poller at all — read the database’s own replication log.',
          code: `
   ORDER SERVICE
        │ INSERT orders + INSERT outbox, one transaction
        ▼
   ┌─────────────────────────────────────────┐
   │  POSTGRES                               │
   │    tables ──▶ WAL (write-ahead log)     │
   └────────────────────┬────────────────────┘
                        │  logical replication slot
                        ▼
              ┌───────────────────┐
              │  DEBEZIUM         │  reads committed changes in order
              │  (Kafka Connect)  │  transforms outbox rows into events
              └─────────┬─────────┘
                        ▼
                      KAFKA

  Advantages over polling:
   • near-zero latency — no poll interval
   • no load on the table from repeated SELECTs
   • ordering comes free, from the WAL itself
   • the service does not run any publishing code at all

  Costs:
   • Kafka Connect and Debezium to operate
   • replication slots that will fill the disk if a connector stalls
   • schema and configuration to manage`,
        },
        {
          t: 'tip',
          title: 'Start with polling',
          text: 'A 500ms poll with `SKIP LOCKED` handles thousands of events per second and needs no new infrastructure. Move to CDC when the latency or the table load genuinely justifies operating Debezium. Both implement the same pattern — the correctness is in the outbox table, not in how you drain it.',
        },
      ],
    },
    {
      id: 'operating',
      title: 'Operating an outbox',
      blocks: [
        {
          t: 'code',
          lang: 'java',
          caption: 'The three jobs an outbox needs',
          code: `
// 1. PRUNE — otherwise the table grows forever
@Scheduled(cron = "0 0 3 * * *")
public void prune() {
    outboxRepository.deleteSentBefore(Instant.now().minus(Duration.ofDays(7)));
}

// 2. MONITOR — unsent depth and age are your early warning
@Scheduled(fixedDelay = 10_000)
public void reportDepth() {
    meterRegistry.gauge("outbox.unsent", outboxRepository.countUnsent());
    outboxRepository.oldestUnsent().ifPresent(oldest ->
        meterRegistry.gauge("outbox.oldest.seconds",
            Duration.between(oldest, Instant.now()).toSeconds()));
}
// Alert on outbox.oldest.seconds > 60. A rising age means the relay
// is stuck — and every second is events the rest of the system
// has not been told about.

// 3. RECONCILE — occasionally prove nothing is stranded
// SELECT count(*) FROM outbox WHERE sent_at IS NULL
//   AND created_at < now() - interval '5 minutes';
// This should always be zero.`,
        },
        {
          t: 'key',
          title: 'Age matters more than depth',
          text: 'A thousand unsent rows that drain in two seconds is healthy. Ten unsent rows where the oldest is twenty minutes old is an outage — something is stuck and the rest of your system is operating on stale information. Alert on the age of the oldest unsent row.',
        },
        {
          t: 'ascii',
          caption: 'Where the outbox sits in the running example.',
          code: `
  POST /orders
        │
        ▼
  ┌──────────────────────────────────────────────┐
  │ ONE TRANSACTION                              │
  │   orders:  #4471 PENDING                     │
  │   outbox:  OrderPlaced(#4471)   unsent       │
  └──────────────────────────────────────────────┘
        │
        ▼  201 Created — the customer is done here
        │
        ⋮  (relay, within ~500ms)
        ▼
      KAFKA  topic "orders", key "4471"
        │
        ├──▶ Payment       charges, publishes PaymentCaptured
        │       (also via ITS OWN outbox — every service needs one)
        ├──▶ Inventory     reserves stock
        └──▶ Notifications sends the email

  Note: every service that both writes data and publishes events
  needs its own outbox. It is not a pattern you apply once.`,
        },
      ],
    },
  ],

  patterns: [
    {
      id: 'outbox-table',
      name: 'Transactional Outbox',
      oneLiner: 'Write the event to your database in the same transaction; publish it separately.',
      useWhen: ['Any service that persists a change and must announce it.'],
      recognize: ['`kafka.send` inside or immediately after a `@Transactional` method.', 'Events missing for records that definitely exist.'],
      steps: [
        'Create an outbox table with the aggregate id, type, payload and a sent marker.',
        'Insert into it inside the business transaction.',
        'Drain it with a poller or CDC.',
        'Prune sent rows and alert on the oldest unsent.',
      ],
      complexity: 'One extra insert per event, plus a background job.',
      gotchas: [
        'Use the aggregate id as the Kafka key, or you lose per-entity ordering.',
        'Stop a batch at the first failure to preserve order.',
        'A partial index on unsent rows keeps the poll query fast as the table grows.',
      ],
      problems: ['Lose an event with a dual write', 'Implement the outbox and repeat the test'],
    },
    {
      id: 'skip-locked-relay',
      name: 'Concurrent Relay with SKIP LOCKED',
      oneLiner: 'Several instances drain the outbox without blocking or duplicating each other.',
      useWhen: ['The service runs more than one replica — which it does.'],
      recognize: ['A relay that only works when exactly one instance is running.', 'Lock contention on the outbox table.'],
      steps: ['`SELECT ... FOR UPDATE SKIP LOCKED` to claim a batch.', 'Publish and mark sent inside that transaction.', 'Keep batches small so locks are held briefly.'],
      template: {
        lang: 'java',
        caption: 'Each instance claims a disjoint batch',
        code: `
-- instance A and instance B run this simultaneously.
-- Neither blocks; neither sees the other's rows.
SELECT * FROM outbox
WHERE sent_at IS NULL
ORDER BY created_at
LIMIT 100
FOR UPDATE SKIP LOCKED;`,
      },
      complexity: 'Scales the relay horizontally with the service.',
      gotchas: [
        'Ordering is only preserved per aggregate, because two instances may publish different aggregates concurrently — which is fine, since the key gives you per-aggregate order.',
        'Long batches hold locks and stall other instances.',
      ],
      problems: ['Run two relays concurrently', 'Prove no row is published twice'],
    },
    {
      id: 'monitor-oldest',
      name: 'Alert on the Oldest Unsent Event',
      oneLiner: 'Depth tells you volume; age tells you whether you are stuck.',
      useWhen: ['Any outbox in production.'],
      recognize: ['A relay that silently stopped and nobody noticed for a day.'],
      steps: ['Gauge the age of the oldest unsent row.', 'Alert above a threshold — one minute is usually generous.', 'Include the count as context, not as the alert.'],
      complexity: 'One query and one gauge.',
      gotchas: [
        'A healthy system has a near-zero age and a fluctuating count.',
        'If the relay dies entirely, depth grows slowly at low traffic but age grows immediately — which is why age is the better signal.',
      ],
      problems: ['Stop the relay and watch the age climb', 'Write the alert rule'],
    },
  ],

  pitfalls: [
    { title: 'Publishing inside the transaction', text: 'The classic dual write. A broker failure loses the event permanently.' },
    { title: 'Publishing after the commit with a retry loop', text: 'The retry state dies with the process. Deploys lose events.' },
    { title: 'Continuing a batch after a failure', text: 'Later events overtake the failed one and arrive out of order.' },
    { title: 'Not using the aggregate id as the key', text: 'Per-entity ordering is lost the moment the relay is concurrent.' },
    { title: 'Never pruning the outbox', text: 'The table grows forever and the poll query degrades.' },
    { title: 'No index on unsent rows', text: 'The poller does a full scan of a growing table every 500ms.' },
    { title: 'One outbox for the whole system', text: 'Every service that writes and publishes needs its own.' },
    { title: 'Alerting on depth instead of age', text: 'A stalled relay at low traffic looks fine by depth for hours.' },
    { title: 'Assuming the outbox removes duplicates', text: 'It converts loss into duplication. Consumers must still be idempotent.' },
  ],

  cheatsheet: [
    { label: 'Problem', value: 'DB and broker have no shared commit' },
    { label: 'Solution', value: 'event row in the same transaction' },
    { label: 'Converts', value: 'possible loss → possible duplication' },
    { label: 'So consumers must be', value: 'idempotent' },
    { label: 'Kafka key', value: 'the aggregate id' },
    { label: 'On failure', value: 'stop the batch — preserve order' },
    { label: 'Concurrent relay', value: 'FOR UPDATE SKIP LOCKED' },
    { label: 'Index', value: 'partial, WHERE sent_at IS NULL' },
    { label: 'Prune', value: 'sent rows older than a few days' },
    { label: 'Alert on', value: 'age of the oldest unsent' },
    { label: 'Low latency option', value: 'CDC (Debezium) over the WAL' },
    { label: 'Start with', value: 'a 500ms poller' },
    { label: 'Scope', value: 'one outbox per service' },
  ],

  problems: [
    { name: 'Lose an event with a dual write', difficulty: 'Medium', pattern: 'The problem', insight: 'Commit the order, stop the broker, then publish. You are left with an order nobody was told about — and no error anywhere.' },
    { name: 'Build the outbox table', difficulty: 'Medium', pattern: 'Outbox', insight: 'Insert the event in the same transaction as the order. Kill the app between commit and publish and confirm the event still goes out on restart.' },
    { name: 'Write the polling relay', difficulty: 'Medium', pattern: 'Relay', insight: 'A 500ms scheduled job with SKIP LOCKED. Measure the end-to-end latency from commit to Kafka.' },
    { name: 'Run two relays at once', difficulty: 'Hard', pattern: 'Concurrency', insight: 'Two instances polling the same table. Verify with a unique constraint on the consumer side that no event is published twice.' },
    { name: 'Reorder events by not breaking the loop', difficulty: 'Hard', pattern: 'Ordering', insight: 'Fail the publish of event 3 and continue to 4. Watch OrderCancelled arrive before OrderPlaced on the consumer.' },
    { name: 'Survive an hour-long broker outage', difficulty: 'Medium', pattern: 'Durability', insight: 'Stop Kafka, keep placing orders, restart it. Every event should drain in order with nothing lost.' },
    { name: 'Watch the outbox age climb', difficulty: 'Medium', pattern: 'Monitoring', insight: 'Stop the relay and chart the oldest-unsent gauge. Note how much sooner it signals trouble than the row count does.' },
    { name: 'Degrade the poll query', difficulty: 'Hard', pattern: 'Performance', insight: 'Grow the outbox to a million sent rows with no partial index and time the poll. Add the index and compare.' },
    { name: 'Replace the poller with Debezium', difficulty: 'Hard', pattern: 'CDC', insight: 'Run Debezium against Postgres logical replication and compare end-to-end latency with the poller.' },
    { name: 'Fill a replication slot', difficulty: 'Hard', pattern: 'CDC risks', insight: 'Stop the Debezium connector while writes continue and watch the Postgres WAL grow. This is the main operational hazard of CDC.' },
  ],
}
