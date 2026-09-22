export default {
  id: 'mq-cqrs',
  title: 'CQRS & Event Sourcing',
  short: 'CQRS & Event Sourcing',
  icon: 'CallSplitRounded',
  tier: 'Elite',
  order: 17,
  estHours: 6,
  prereqs: ['mq-eda', 'kafka-storage'],
  tagline: 'Two patterns that are usually confused, frequently over-applied, and occasionally exactly right.',
  mentalModel:
    '**CQRS** separates the model you write through from the models you read from. **Event sourcing** stores the sequence of changes instead of the current state, and derives the state by replaying them. They are independent — you can do either alone — and they are both a significant increase in complexity that must be justified.',
  whyItMatters:
    'Used where they fit — auditable domains, wildly asymmetric read/write loads, many different views of the same data — they are transformative. Applied to a CRUD service because they sounded sophisticated, they produce a system nobody can debug or change.',

  reference: {
    title: 'What each one actually is',
    head: ['', 'CQRS', 'Event sourcing'],
    rows: [
      ['Separates', 'Write model from read models', 'Stored facts from derived state'],
      ['Source of truth', 'Still the write database', '**The event log**'],
      ['Current state', 'Stored directly', 'Derived by replaying events'],
      ['History', 'Only if you add auditing', '**Inherent** — every change is kept'],
      ['Can undo?', 'No', 'Replay to any point in time'],
      ['Needs the other?', 'No', 'Almost always used with CQRS'],
      ['Main cost', 'Eventual consistency between models', 'Schema evolution of events, forever'],
    ],
  },

  sections: [
    {
      id: 'cqrs',
      title: 'CQRS: separate the write model from the read models',
      blocks: [
        {
          t: 'ascii',
          caption: 'One write model, several purpose-built read models.',
          code: `
  COMMANDS (writes)                     QUERIES (reads)
       │                                      ▲
       ▼                                      │
  ┌──────────────┐                    ┌───────┴────────┐
  │ Write model  │                    │ Read models    │
  │ • normalised │                    │ • denormalised │
  │ • validates  │                    │ • no joins     │
  │ • one truth  │                    │ • one per view │
  └──────┬───────┘                    └────────────────┘
         │ publishes events                   ▲
         ▼                                    │
   ╔═══════════════╗    projections    ┌──────┴──────┬──────────────┐
   ║  event topic  ║ ─────────────────▶│ Postgres    │ Elasticsearch│
   ╚═══════════════╝                   │ order list  │ search index │
                                       └─────────────┴──────────────┘
                                             │              │
                                       ┌─────┴────┐   ┌─────┴─────┐
                                       │ Redis    │   │ ClickHouse│
                                       │ cache    │   │ analytics │
                                       └──────────┘   └───────────┘

  Each read model is shaped for ONE question and can be rebuilt from
  the event topic at any time. A bad projection is not a data loss —
  it is a rebuild.`,
        },
        {
          t: 'key',
          title: 'The cost is a visible consistency gap',
          text: 'The user writes, gets a 200, then reads — and sees the old value, because the projection has not caught up yet. That is not a bug you can fix; it is the trade you made. You handle it in the product: return the new value from the write response, show an optimistic update, or make the UI poll. Pretending it will not happen is how CQRS gets a bad reputation.',
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'A projection is just an idempotent consumer',
          code: `
@Component
public class OrderListProjection {

    @KafkaListener(topics = "orders", groupId = "order-list-projection")
    @Transactional
    public void on(OrderEvent event, Acknowledgment ack) {
        switch (event) {
            case OrderPlaced e -> readModel.upsert(new OrderRow(
                    e.orderId(), e.customerId(), e.customerName(),   // denormalised
                    e.total(), "PENDING", e.placedAt()));

            case OrderConfirmed e -> readModel.setStatus(e.orderId(), "CONFIRMED");
            case OrderCancelled e -> readModel.setStatus(e.orderId(), "CANCELLED");
            default -> { }                    // unknown event types: ignore
        }
        ack.acknowledge();
    }
}
// Upserts and status assignments are idempotent, so redelivery is safe.
// The read model has no joins — the query is a single indexed lookup.`,
        },
      ],
    },
    {
      id: 'event-sourcing',
      title: 'Event sourcing: store the changes, derive the state',
      blocks: [
        {
          t: 'ascii',
          caption: 'The events are the truth; the object is a cache of them.',
          code: `
  TRADITIONAL — the row IS the truth, history is gone
  ┌────────────────────────────────────────────┐
  │ orders: id=4471  status=SHIPPED  total=2400│
  └────────────────────────────────────────────┘
     You cannot answer: when was it confirmed? who cancelled the
     first attempt? what did it look like on Tuesday?


  EVENT SOURCED — the log is the truth
  ┌──────────────────────────────────────────────────────────┐
  │ 1. OrderPlaced    { items, total: 2400 }       10:00     │
  │ 2. PaymentFailed  { reason: "declined" }       10:01     │
  │ 3. PaymentRetried { method: "upi" }            10:04     │
  │ 4. PaymentCaptured{ paymentId: p-88 }          10:04     │
  │ 5. OrderShipped   { tracking: "TRK-1" }        14:20     │
  └──────────────────────────────────────────────────────────┘
                          │ replay (fold)
                          ▼
     current state: SHIPPED, total 2400, tracking TRK-1

  Every question is answerable, including ones nobody thought to
  ask when the schema was designed.`,
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'An aggregate rebuilt by folding its events',
          code: `
public class Order {
    private Long id;
    private OrderStatus status;
    private BigDecimal total;
    private long version;

    public static Order replay(List<OrderEvent> events) {
        Order order = new Order();
        events.forEach(order::apply);            // fold
        return order;
    }

    private void apply(OrderEvent event) {
        switch (event) {
            case OrderPlaced e     -> { id = e.orderId(); total = e.total();
                                        status = PENDING; }
            case PaymentCaptured e -> status = CONFIRMED;
            case OrderShipped e    -> status = SHIPPED;
            case OrderCancelled e  -> status = CANCELLED;
            default -> { }
        }
        version++;
    }

    // Commands VALIDATE, then emit — they never mutate directly
    public List<OrderEvent> cancel(String reason) {
        if (status == SHIPPED) throw new IllegalStateException("already shipped");
        if (status == CANCELLED) return List.of();        // idempotent
        return List.of(new OrderCancelled(id, reason, Instant.now()));
    }
}`,
        },
        {
          t: 'warn',
          title: 'Replaying from the beginning does not scale, so you snapshot',
          text: 'An aggregate with 50,000 events cannot be rebuilt on every request. Periodically store a snapshot of the state plus the version it covers, then replay only the events after it. This is essential in practice, and it introduces its own problem: a snapshot is a serialized old version of your state model, so it needs schema management too.',
        },
        {
          t: 'trap',
          title: 'Events are immutable — and so are their bugs',
          text: 'A traditional system fixes bad data with an `UPDATE`. An event-sourced system cannot: the event happened and rewriting history destroys the audit trail that justified the pattern. You fix it by appending a **corrective event** (`OrderTotalCorrected`). This means every projection must handle corrections, and your event schema must stay readable forever — not for seven days, forever.',
        },
      ],
    },
    {
      id: 'when',
      title: 'When these are worth it',
      blocks: [
        {
          t: 'compare',
          left: {
            title: 'Genuinely justified when',
            items: [
              'Audit is a regulatory requirement — finance, healthcare',
              'You must answer "what did this look like at time T?"',
              'Reads vastly outnumber writes, in different shapes',
              'Many teams need different views of one dataset',
              'The domain is naturally a sequence of events — ledgers, bookings',
              'Temporal queries and replay have real business value',
            ],
          },
          right: {
            title: 'Almost certainly not when',
            items: [
              'It is a CRUD service with one screen',
              'One team owns both reads and writes',
              'Users expect read-after-write consistency',
              'Nobody has asked for history',
              'The team has not run an event-driven system before',
              'The reason is "it is a modern architecture"',
            ],
          },
        },
        {
          t: 'key',
          title: 'Apply them per aggregate, not per system',
          text: 'The most common successful pattern is a narrow one. Event-source the **ledger** because you must audit every movement; leave the customer profile as ordinary CRUD. CQRS the **product catalogue** because it is read a thousand times more than written; leave the admin screens alone. Systems that apply these patterns everywhere become unmaintainable; systems that apply them to the two aggregates that need them do very well.',
        },
        {
          t: 'ascii',
          caption: 'A realistic hybrid.',
          code: `
  ORDER SERVICE
    • ordinary tables, ordinary transactions
    • publishes events via the outbox           ← CQRS-lite, no ES

  LEDGER SERVICE
    • event sourced — every debit and credit is an immutable event
    • balance is a fold, snapshotted every 1000 events
    • regulators can reconstruct any account at any date

  SEARCH SERVICE
    • pure read model, projected from the order topic
    • rebuilt from scratch whenever the mapping changes

  Three services, three different levels of sophistication,
  each matched to what that domain actually requires.`,
        },
      ],
    },
  ],

  patterns: [
    {
      id: 'projection-rebuild',
      name: 'Rebuildable Projections',
      oneLiner: 'A read model you can throw away and regenerate is a read model you can change.',
      useWhen: ['Any CQRS read model.'],
      recognize: ['Being unable to add a column without a migration and a backfill script.', 'Fear of changing the search index mapping.'],
      steps: [
        'Keep the projection a pure function of the event stream.',
        'Version the read model (a new table or index per version).',
        'Rebuild by resetting the consumer group to offset 0.',
        'Switch reads over once it has caught up.',
      ],
      template: {
        lang: 'java',
        caption: 'Blue-green projections',
        code: `
// Build v2 alongside v1, from the beginning of the topic
kafka-consumer-groups --group order-projection-v2 \\
  --topic orders --reset-offsets --to-earliest --execute

// When v2's lag reaches zero, flip the read path and drop v1.
// No migration script, no backfill, no downtime — and if v2 is
// wrong, you still have v1.`,
      },
      complexity: 'Storage for two models during the transition.',
      gotchas: [
        'Rebuild time is bounded by topic retention — a compacted or infinite-retention topic is what makes this genuinely possible.',
        'Projections must be idempotent; a rebuild reprocesses everything.',
      ],
      problems: ['Rebuild a read model from scratch', 'Run two projection versions side by side'],
    },
    {
      id: 'snapshotting',
      name: 'Snapshot Event-Sourced Aggregates',
      oneLiner: 'Fold from the last snapshot, not from the beginning of time.',
      useWhen: ['Any aggregate whose event count grows without bound.'],
      recognize: ['Load times that grow with the age of the entity.'],
      steps: [
        'Every N events, persist the state and the version it covers.',
        'On load, read the newest snapshot and replay only later events.',
        'Treat snapshots as a cache — deletable and rebuildable.',
      ],
      complexity: 'Constant-time loads instead of linear in history.',
      gotchas: [
        'A snapshot is a serialized version of your state model, so it needs its own schema handling — or make it disposable and regenerate on a version change.',
        'Never treat a snapshot as the source of truth; the events are.',
      ],
      problems: ['Load a 50k-event aggregate', 'Add snapshots and compare'],
    },
    {
      id: 'corrective-events',
      name: 'Correct Forward, Never Rewrite',
      oneLiner: 'Fix bad data by appending a correction, not by editing history.',
      useWhen: ['Any event-sourced system, eventually.'],
      recognize: ['A proposal to "just fix the event in the topic".'],
      steps: [
        'Define explicit corrective events.',
        'Make every projection handle them.',
        'Keep the original event — the mistake is part of the record.',
      ],
      template: {
        lang: 'java',
        caption: 'The correction is itself an auditable fact',
        code: `
record OrderTotalCorrected(Long orderId, BigDecimal wasTotal,
                           BigDecimal nowTotal, String reason,
                           String correctedBy, Instant at) { }

// The projection applies it like any other event
case OrderTotalCorrected e -> readModel.setTotal(e.orderId(), e.nowTotal());`,
      },
      complexity: 'One more event type and one more projection branch.',
      gotchas: [
        'Rewriting events breaks every consumer that already processed the original.',
        'Corrections must carry who and why, or you have lost the audit value.',
      ],
      problems: ['Correct a wrong total forward', 'Show why rewriting breaks consumers'],
    },
  ],

  pitfalls: [
    { title: 'Applying CQRS to a CRUD service', text: 'Two models, eventual consistency and more moving parts for no benefit.' },
    { title: 'Confusing CQRS with event sourcing', text: 'They are independent. You can and often should do CQRS alone.' },
    { title: 'Promising read-after-write consistency', text: 'The projection lags. Design the product around it.' },
    { title: 'Replaying from zero on every load', text: 'Load time grows forever. Snapshot.' },
    { title: 'Editing events to fix data', text: 'Destroys the audit trail and breaks consumers that already read them.' },
    { title: 'Short retention on an event-sourced topic', text: 'Your source of truth expires. It must be compacted or infinite.' },
    { title: 'No versioning strategy for events', text: 'You must read every version you have ever written, forever.' },
    { title: 'Event sourcing the whole system', text: 'Apply it to the aggregates that need audit, not to everything.' },
    { title: 'Projections that are not idempotent', text: 'A rebuild produces different data from the original.' },
  ],

  cheatsheet: [
    { label: 'CQRS', value: 'separate write model from read models' },
    { label: 'Event sourcing', value: 'store changes, derive state' },
    { label: 'Independent?', value: 'yes — CQRS alone is common' },
    { label: 'Read models are', value: 'disposable and rebuildable' },
    { label: 'Rebuild by', value: 'resetting the group to offset 0' },
    { label: 'CQRS cost', value: 'a visible consistency lag' },
    { label: 'ES truth', value: 'the event log' },
    { label: 'Load an aggregate', value: 'snapshot + later events' },
    { label: 'Fix bad data', value: 'a corrective event' },
    { label: 'Never', value: 'rewrite an event' },
    { label: 'ES topic retention', value: 'compacted or infinite' },
    { label: 'Schema lifetime', value: 'forever' },
    { label: 'Scope', value: 'per aggregate, not per system' },
    { label: 'Justify with', value: 'audit, temporal queries, read asymmetry' },
  ],

  problems: [
    { name: 'Build a read-model projection', difficulty: 'Medium', pattern: 'CQRS', insight: 'Denormalise orders with customer names into one table. Compare the query with the equivalent three-table join.' },
    { name: 'Observe the consistency lag', difficulty: 'Medium', pattern: 'CQRS cost', insight: 'Write then immediately read. Measure how often you see stale data and decide how the UI should handle it.' },
    { name: 'Rebuild a projection from scratch', difficulty: 'Medium', pattern: 'Rebuildability', insight: 'Drop the read model, reset the group to earliest, and confirm it regenerates identically.' },
    { name: 'Run two projection versions', difficulty: 'Hard', pattern: 'Blue-green', insight: 'Build v2 with an extra column alongside v1, wait for it to catch up, then switch reads with no downtime.' },
    { name: 'Event-source an aggregate', difficulty: 'Hard', pattern: 'Event sourcing', insight: 'Store events, rebuild the order by folding them, and confirm the state matches what a CRUD version would hold.' },
    { name: 'Answer a temporal question', difficulty: 'Hard', pattern: 'Event sourcing', insight: 'Reconstruct the order as it was at 11:00 by replaying only events before that timestamp — impossible in the CRUD version.' },
    { name: 'Load a 50,000-event aggregate', difficulty: 'Hard', pattern: 'Snapshots', insight: 'Measure the load time, add snapshots every 1000 events, and measure again.' },
    { name: 'Correct bad data forward', difficulty: 'Medium', pattern: 'Corrections', insight: 'Append a corrective event and confirm every projection converges. Then reason about what rewriting the original would have broken.' },
    { name: 'Expire your source of truth', difficulty: 'Medium', pattern: 'Retention', insight: 'Set a 1-hour retention on an event-sourced topic, wait, and try to rebuild. The data is gone.' },
    { name: 'Decide honestly', difficulty: 'Medium', pattern: 'Judgement', insight: 'Take a service you have built and write two paragraphs on whether CQRS or event sourcing would have helped. "No" is usually the right answer.' },
  ],
}
