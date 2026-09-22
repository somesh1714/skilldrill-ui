export default {
  id: 'mq-primitives',
  title: 'Queues, Topics, Brokers: the Building Blocks',
  short: 'Primitives',
  icon: 'InboxRounded',
  tier: 'Foundations',
  order: 2,
  estHours: 4,
  prereqs: ['mq-why'],
  tagline: 'Six words — producer, broker, topic, partition, consumer, offset — explain almost everything.',
  mentalModel:
    'A broker is a durable postbox that also remembers the order things arrived in. Producers put messages in, consumers take them out, and the only real design questions are: **how is the mail sorted** (topics, partitions, routing keys) and **who remembers what has been read** (the broker, or the consumer).',
  whyItMatters:
    'Every broker — Kafka, RabbitMQ, SQS, Pulsar — is a different arrangement of the same primitives. Learn the primitives once and switching brokers becomes a matter of syntax rather than relearning the subject.',

  reference: {
    title: 'The vocabulary',
    head: ['Term', 'What it is', 'Who owns it'],
    rows: [
      ['**Message / Event**', 'A key, a value, a timestamp and headers', 'Produced once, read many times'],
      ['**Producer**', 'Anything that publishes', 'Your service'],
      ['**Broker**', 'The server that stores and serves messages', 'Infrastructure'],
      ['**Topic**', 'A named stream — a category of message', 'Logical, shared'],
      ['**Partition**', 'One ordered log inside a topic', 'The unit of parallelism **and** of ordering'],
      ['**Offset**', 'A message’s position in its partition', 'Immutable, assigned by the broker'],
      ['**Consumer**', 'Anything that reads', 'Your service'],
      ['**Consumer group**', 'A set of consumers sharing the work', 'Each group reads every message once'],
      ['**Acknowledgement**', '"I am finished with this"', 'The consumer decides when'],
    ],
  },

  sections: [
    {
      id: 'anatomy',
      title: 'Anatomy of a message',
      blocks: [
        {
          t: 'ascii',
          caption: 'Every message has four parts, and three of them are usually underused.',
          code: `
  ┌──────────────────────────────────────────────────────────────┐
  │ KEY        "4471"                                            │  ← decides the
  │                                                              │    partition
  ├──────────────────────────────────────────────────────────────┤
  │ VALUE      { "orderId": 4471,                                │  ← the payload
  │              "customerId": "c-902",                          │
  │              "total": 2400.00,                               │
  │              "items": [ ... ] }                              │
  ├──────────────────────────────────────────────────────────────┤
  │ HEADERS    eventId:     8f2c-...      ← de-duplication       │
  │            eventType:   OrderPlaced   ← routing, versioning  │
  │            schemaVer:   3             ← schema evolution     │
  │            traceId:     7f3a...       ← debugging across     │
  │            producedAt:  2026-09-22..     services            │
  ├──────────────────────────────────────────────────────────────┤
  │ TIMESTAMP  broker or producer time                           │
  └──────────────────────────────────────────────────────────────┘`,
        },
        {
          t: 'key',
          title: 'Put the metadata in headers, not the payload',
          text: 'Event id, type, schema version and trace id belong in headers. That way a consumer can decide whether to process a message — or route it, or de-duplicate it — **without deserializing the body**. It also means the payload stays a clean domain object, and infrastructure concerns do not leak into your schema.',
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'Producing with headers that make everything downstream easier',
          code: `
ProducerRecord<String, OrderPlaced> record = new ProducerRecord<>(
        "orders",                        // topic
        order.id().toString(),           // KEY — all events for this order together
        new OrderPlaced(order));         // value

record.headers()
      .add("eventId",   UUID.randomUUID().toString().getBytes(UTF_8))
      .add("eventType", "OrderPlaced".getBytes(UTF_8))
      .add("schemaVer", "3".getBytes(UTF_8))
      .add("traceId",   MDC.get("traceId").getBytes(UTF_8));

producer.send(record);`,
        },
      ],
    },
    {
      id: 'topics-partitions',
      title: 'Topics and partitions, drawn',
      blocks: [
        { t: 'p', text: 'A topic is a name. The actual storage is its **partitions**, and a partition is an append-only log. Understanding this one picture explains ordering, parallelism and scaling all at once.' },
        {
          t: 'ascii',
          caption: 'One topic, three partitions. The key decides which log a message lands in.',
          code: `
  TOPIC: orders   (3 partitions)

  partition 0   ┌────┬────┬────┬────┬────┐
   key "4471"   │ 0  │ 1  │ 2  │ 3  │ 4  │ ◀── append only
                └────┴────┴────┴────┴────┘
                  A    B    C    D    E        ordered: A before B before C

  partition 1   ┌────┬────┬────┐
   key "4472"   │ 0  │ 1  │ 2  │
                └────┴────┴────┘
                  F    G    H

  partition 2   ┌────┬────┬────┬────┐
   key "4473"   │ 0  │ 1  │ 2  │ 3  │
                └────┴────┴────┴────┘
                  I    J    K    L

  Guaranteed:      A → B → C → D → E   (within partition 0)
  NOT guaranteed:  any relationship between A and F or A and I

  How the partition is chosen:
      key present  ──▶  hash(key) % partitionCount      ← deterministic
      key null     ──▶  sticky / round-robin            ← ordering is lost`,
        },
        {
          t: 'key',
          title: 'Partitions are ordering and parallelism, and you cannot have both without a key',
          text: 'More partitions means more consumers can work at once. But ordering only exists *inside* one partition. The key is how you buy ordering where you need it while keeping parallelism everywhere else: all events for order 4471 go to one partition, while orders 4472 and 4473 are processed simultaneously.',
        },
        { t: 'h', text: 'Scenario: what happens when you add a partition' },
        {
          t: 'ascii',
          caption: 'Adding partitions breaks the key-to-partition mapping. This surprises people in production.',
          code: `
  BEFORE — 3 partitions
      hash("4471") % 3 = 1   ──▶  partition 1

  AFTER  — 4 partitions
      hash("4471") % 4 = 3   ──▶  partition 3   ← DIFFERENT partition

  So during the transition:
      old events for order 4471 sit in partition 1
      new events for order 4471 go to partition 3
      two consumers process them with NO ordering between them

  Consequence: plan partition counts up front. You can add partitions,
  but you cannot remove them, and adding them breaks per-key ordering
  for any key already in flight.`,
        },
        {
          t: 'warn',
          title: 'Choose the partition count with room to grow',
          text: 'Partitions are cheap up to a point (each costs file handles and memory on the broker, and adds to rebalance time). A common starting point is two to three times the maximum number of consumers you expect. Too few and you cannot scale consumers; far too many and rebalances become slow and the broker struggles.',
        },
      ],
    },
    {
      id: 'consumer-groups',
      title: 'Consumer groups: the mechanism behind both models',
      blocks: [
        { t: 'p', text: 'This is the single most elegant idea in Kafka. There is no separate "queue mode" and "topic mode" — there are only consumer groups, and the two behaviours fall out of how you use them.' },
        {
          t: 'ascii',
          caption: 'Within a group, partitions are divided up. Each partition goes to exactly one member.',
          code: `
  TOPIC: orders (3 partitions)          GROUP: "payment-service"

   partition 0 ──────────────────────▶  consumer A
   partition 1 ──────────────────────▶  consumer B
   partition 2 ──────────────────────▶  consumer C

  Each message is handled by exactly ONE member of the group.
  This is the QUEUE behaviour — work is shared.

  Add a 4th consumer to the same group:
   partition 0 ──▶ A     partition 1 ──▶ B     partition 2 ──▶ C
                                                consumer D ──▶ IDLE

  You cannot have more active consumers than partitions.
  Partitions are the hard ceiling on parallelism.`,
        },
        {
          t: 'ascii',
          caption: 'Multiple groups on the same topic: each group gets every message.',
          code: `
  TOPIC: orders
  ┌────┬────┬────┬────┬────┬────┬────┐
  │ 0  │ 1  │ 2  │ 3  │ 4  │ 5  │ 6  │
  └────┴────┴────┴────┴────┴────┴────┘
        ▲                   ▲       ▲
        │                   │       │
   group "analytics"   group    group "shipping"
   offset 1            "payment"  offset 6
                       offset 4

  Each GROUP has its own offset. All three read every message,
  independently, at their own pace.
  This is the PUB/SUB behaviour — broadcast.

  So:  one group  = queue semantics  (work sharing)
       many groups = pub/sub semantics (broadcast)
  Same topic. Same messages. No configuration change.`,
        },
        {
          t: 'key',
          title: 'One group per logical service, never per instance',
          text: 'If you accidentally give each pod its own group id, every pod processes every message — you will send three confirmation emails per order. The group id names the *service*; the instances are members of it. This is a genuinely common production bug.',
        },
        { t: 'h', text: 'Scenario: a consumer dies mid-work' },
        {
          t: 'ascii',
          caption: 'Rebalancing, step by step.',
          code: `
  t=0    group "payment": A→p0, B→p1, C→p2, all healthy

  t=10s  consumer B crashes (pod evicted)

  t=10s  B stops sending heartbeats

  t=20s  broker's group coordinator notices (session.timeout.ms)
         ──▶ triggers a REBALANCE

  t=20s  ALL consumers briefly stop:  A→(none), C→(none)
         ("stop-the-world" rebalance — cooperative rebalancing
           reduces this, see the consumer chapter)

  t=21s  new assignment: A→p0,p1   C→p2

  t=21s  A resumes p1 FROM THE LAST COMMITTED OFFSET.
         Any messages B processed but did not commit are
         redelivered to A.  ← this is where duplicates come from`,
        },
        {
          t: 'trap',
          title: 'Rebalances are the main source of duplicates',
          text: 'They happen on every deploy, every scale-up, every pod eviction, and whenever a consumer is too slow to poll. Each one redelivers whatever was in flight. This is precisely why idempotent consumers are mandatory rather than optional.',
        },
      ],
    },
    {
      id: 'offsets-acks',
      title: 'Who remembers what has been read',
      blocks: [
        { t: 'p', text: 'This is the deepest difference between broker families, and it determines nearly everything else about how they behave.' },
        {
          t: 'compare',
          left: {
            title: 'Broker-tracked (RabbitMQ, SQS)',
            items: [
              'The broker knows which messages are unacknowledged',
              'A message is deleted once acknowledged',
              'Per-message acknowledgement and redelivery',
              'Easy selective retry of one bad message',
              'No replay — once it is gone, it is gone',
              'Broker state grows with in-flight messages',
            ],
          },
          right: {
            title: 'Consumer-tracked (Kafka)',
            items: [
              'The consumer group stores an offset',
              'Messages persist until retention expires',
              'Acknowledgement means "advance my offset"',
              'Replay by moving the offset backwards',
              'One stuck message blocks its partition',
              'Broker state is just a number per partition',
            ],
          },
        },
        {
          t: 'ascii',
          caption: 'The offset is a bookmark, not a deletion.',
          code: `
   partition 0
   ┌────┬────┬────┬────┬────┬────┬────┬────┬────┐
   │ 0  │ 1  │ 2  │ 3  │ 4  │ 5  │ 6  │ 7  │ 8  │
   └────┴────┴────┴────┴────┴────┴────┴────┴────┘
                       ▲         ▲              ▲
                       │         │              │
              committed offset   current      log end
                   = 3         position=5    offset = 9
                                              (next write)

   • messages 0-2 are done (committed)
   • 3 and 4 have been read but not committed — a crash redelivers them
   • 5-8 are waiting
   • LAG = log end offset − committed offset = 9 − 3 = 6

   Nothing is deleted. Set the committed offset back to 0 and the
   consumer replays the whole partition.`,
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'When you commit determines your delivery guarantee',
          code: `
// AT MOST ONCE — commit first. A crash loses the message.
consumer.commitSync();
process(record);                 // ✘ crash here = message lost forever

// AT LEAST ONCE — commit after. A crash redelivers. (Use this.)
process(record);
consumer.commitSync();           // ✘ crash here = message redelivered

// There is no third option that removes the risk entirely: the gap
// between "work done" and "offset stored" always exists, because they
// are two different systems. Exactly-once is achieved by making the
// duplicate harmless, not by removing it.`,
        },
        {
          t: 'key',
          title: 'Always choose at-least-once, then make duplicates harmless',
          text: 'Losing a message is almost always worse than processing one twice, because a duplicate can be defended against and a loss cannot be recovered. Commit after processing, and make the processing idempotent. That combination is what people actually mean when they say "exactly-once".',
        },
      ],
    },
  ],

  patterns: [
    {
      id: 'key-by-entity',
      name: 'Key Every Message by Its Entity',
      oneLiner: 'The key buys you ordering for one entity while everything else runs in parallel.',
      useWhen: ['Any topic carrying multiple events about the same thing.'],
      recognize: ['A status regressing because an older event was applied later.', 'Producers sending with a null key.'],
      steps: [
        'Pick the id whose events must stay ordered — order id, account id, device id.',
        'Use it as the message key on every event about that entity.',
        'Check the key distribution so one entity does not dominate a partition.',
      ],
      template: {
        lang: 'java',
        caption: 'One key, one partition, guaranteed order',
        code: `
// Every event about order 4471 lands in the same partition,
// so they are consumed in the order they were produced.
producer.send(new ProducerRecord<>("orders", order.id().toString(), placed));
producer.send(new ProducerRecord<>("orders", order.id().toString(), confirmed));
producer.send(new ProducerRecord<>("orders", order.id().toString(), shipped));

// A null key gives you round-robin and no ordering at all:
producer.send(new ProducerRecord<>("orders", null, placed));   // ✘`,
      },
      complexity: 'No cost. Ordering per key, parallelism across keys.',
      gotchas: [
        'A hot key (one huge customer) makes one partition a bottleneck.',
        'Changing the partition count changes the mapping and breaks ordering for keys in flight.',
      ],
      problems: ['Prove ordering with and without a key', 'Detect a hot partition'],
    },
    {
      id: 'group-per-service',
      name: 'One Consumer Group per Logical Service',
      oneLiner: 'The group id names the service; instances join it.',
      useWhen: ['Configuring any consumer.'],
      recognize: ['A group id containing a hostname, pod name or random UUID.', 'Three emails sent for one order.'],
      steps: [
        'Set `group.id` to a stable service name.',
        'Scale by adding instances, not groups.',
        'Add a *new* group only when a genuinely different service needs the same data.',
      ],
      complexity: 'Configuration only.',
      gotchas: [
        'A group id per instance turns work-sharing into broadcast.',
        'Changing the group id resets the offsets — the new group starts from `auto.offset.reset`, which may replay everything or skip everything.',
      ],
      problems: ['Break it with a per-instance group id', 'Add a second group and watch both receive everything'],
    },
    {
      id: 'headers-for-metadata',
      name: 'Metadata in Headers, Domain Data in the Payload',
      oneLiner: 'Event id, type, version and trace id belong outside the body.',
      useWhen: ['Designing any message contract.'],
      recognize: ['A payload with `eventType` and `version` fields mixed in with domain data.', 'Having to deserialize a message just to decide whether to skip it.'],
      steps: ['Put id, type, schema version and trace id in headers.', 'Keep the payload a clean domain object.', 'Read headers for routing, de-duplication and filtering.'],
      template: {
        lang: 'java',
        caption: 'Skip a message without paying to deserialize it',
        code: `
@KafkaListener(topics = "orders", groupId = "payment")
public void onMessage(ConsumerRecord<String, byte[]> record) {
    String type = header(record, "eventType");
    if (!"OrderPlaced".equals(type)) return;          // no deserialization at all

    String eventId = header(record, "eventId");
    if (alreadyProcessed(eventId)) return;            // de-duplicate cheaply

    OrderPlaced event = deserialize(record.value());  // only now
    handle(event);
}`,
      },
      complexity: 'A few bytes per message; avoids deserializing what you will discard.',
      gotchas: [
        'Headers are bytes — encode and decode consistently, usually UTF-8.',
        'Not every broker supports headers; SQS uses message attributes instead.',
      ],
      problems: ['Filter by header without deserializing', 'Propagate a trace id end to end'],
    },
  ],

  pitfalls: [
    { title: 'Producing with a null key', text: 'Round-robin partitioning, so no ordering for anything.' },
    { title: 'A consumer group per instance', text: 'Every instance processes every message. Duplicate emails, duplicate charges.' },
    { title: 'More consumers than partitions', text: 'The extras sit idle. Partitions are the ceiling on parallelism.' },
    { title: 'Adding partitions to a live topic', text: 'Rehashes the key mapping and breaks ordering for keys already in flight.' },
    { title: 'Committing before processing', text: 'At-most-once. A crash silently loses the message.' },
    { title: 'Assuming topic-wide ordering', text: 'Order exists per partition only.' },
    { title: 'Putting infrastructure fields in the payload', text: 'Forces deserialization for routing and pollutes the domain schema.' },
    { title: 'Ignoring consumer lag', text: 'It is the earliest signal that consumers cannot keep up.' },
  ],

  cheatsheet: [
    { label: 'Topic', value: 'a named stream' },
    { label: 'Partition', value: 'one ordered append-only log' },
    { label: 'Ordering', value: 'per partition only' },
    { label: 'Partition choice', value: 'hash(key) % partitions' },
    { label: 'Null key', value: 'round-robin, no ordering' },
    { label: 'Parallelism ceiling', value: 'the partition count' },
    { label: 'One group', value: 'queue semantics' },
    { label: 'Many groups', value: 'pub/sub semantics' },
    { label: 'Group id', value: 'per service, never per instance' },
    { label: 'Offset', value: 'a bookmark, not a deletion' },
    { label: 'Lag', value: 'log end offset − committed offset' },
    { label: 'Commit after processing', value: 'at least once' },
    { label: 'Commit before processing', value: 'at most once' },
    { label: 'Headers', value: 'eventId, type, version, traceId' },
  ],

  problems: [
    { name: 'Create a topic and inspect it', difficulty: 'Easy', pattern: 'Basics', insight: 'Start Kafka in Docker, create a 3-partition topic, and use kafka-topics --describe to see the leader and replicas per partition.' },
    { name: 'Watch keys route to partitions', difficulty: 'Easy', pattern: 'Partitioning', insight: 'Produce 100 messages with 10 distinct keys and print the partition of each. Confirm one key always lands in the same partition.' },
    { name: 'Produce with a null key', difficulty: 'Easy', pattern: 'Partitioning', insight: 'Repeat with no key and observe the round-robin spread — and that the same logical entity is now split across partitions.' },
    { name: 'Share work with one group', difficulty: 'Medium', pattern: 'Consumer groups', insight: 'Run three consumers in one group against three partitions. Each gets one partition; each message is handled once.' },
    { name: 'Broadcast with two groups', difficulty: 'Medium', pattern: 'Consumer groups', insight: 'Add a second group id. Both groups now receive every message, at independent offsets.' },
    { name: 'Break it with a per-instance group', difficulty: 'Medium', pattern: 'Group ids', insight: 'Give each instance a UUID group id. Every instance processes every message — the classic duplicate-email bug.' },
    { name: 'Start a consumer you cannot use', difficulty: 'Medium', pattern: 'Parallelism limits', insight: 'Four consumers, three partitions. Use kafka-consumer-groups --describe to find the one with no assignment.' },
    { name: 'Watch a rebalance happen', difficulty: 'Hard', pattern: 'Rebalancing', insight: 'Kill one consumer mid-consumption and watch the reassignment in the logs. Note which messages are redelivered.' },
    { name: 'Measure consumer lag', difficulty: 'Medium', pattern: 'Lag', insight: 'Slow the consumer with a sleep, produce faster than it consumes, and chart lag from kafka-consumer-groups --describe.' },
    { name: 'Replay from offset zero', difficulty: 'Hard', pattern: 'Offsets', insight: 'Use kafka-consumer-groups --reset-offsets --to-earliest and confirm the whole partition is reprocessed.' },
    { name: 'Lose a message with early commit', difficulty: 'Hard', pattern: 'Delivery semantics', insight: 'Commit before processing, crash in between, and confirm the message is never seen again. Then move the commit after and confirm redelivery.' },
  ],
}
