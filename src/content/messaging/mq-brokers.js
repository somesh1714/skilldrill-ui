export default {
  id: 'mq-brokers',
  title: 'Choosing a Broker: Kafka, RabbitMQ, SQS & Friends',
  short: 'Choosing a Broker',
  icon: 'BalanceRounded',
  tier: 'Foundations',
  order: 5,
  estHours: 4,
  prereqs: ['mq-primitives'],
  tagline: 'They are not competitors. They are different shapes, and picking the wrong shape is expensive.',
  mentalModel:
    'Two questions decide almost everything. **Who remembers what has been read** — the broker, or the consumer? And **is a message deleted once handled, or retained for anyone to re-read?** Kafka answers "the consumer" and "retained". RabbitMQ and SQS answer "the broker" and "deleted". Everything else follows.',
  whyItMatters:
    'Teams adopt Kafka for a task queue and then fight it for two years — no per-message retry, no priorities, one stuck message blocking a partition. Or they adopt RabbitMQ for an event backbone and discover they cannot replay. The mismatch is expensive and hard to undo.',

  reference: {
    title: 'The comparison that actually matters',
    head: ['', 'Kafka', 'RabbitMQ', 'SQS', 'Pulsar'],
    rows: [
      ['Model', 'Distributed log', 'Queue + exchange routing', 'Managed queue', 'Log + queue'],
      ['Who tracks position', '**Consumer** (offset)', 'Broker (per message)', 'Broker (per message)', 'Broker (cursor)'],
      ['Message after read', 'Retained until expiry', 'Deleted on ack', 'Deleted on delete', 'Retained or acked'],
      ['Replay', '**Yes** — move the offset', 'No', 'No', 'Yes'],
      ['Ordering', 'Per partition', 'Per queue', 'FIFO queues only', 'Per partition'],
      ['Per-message retry', 'Awkward — blocks the partition', '**Native**', '**Native**', 'Native'],
      ['Priorities', 'No', '**Yes**', 'No', 'No'],
      ['Routing', 'Topic + key', '**Rich** (direct, topic, fanout, headers)', 'Basic (SNS fan-out)', 'Topic'],
      ['Throughput', 'Very high (millions/s)', 'High (tens of thousands/s)', 'High, managed', 'Very high'],
      ['Ops burden', 'High (or use a managed one)', 'Medium', '**None**', 'High'],
    ],
  },

  sections: [
    {
      id: 'two-shapes',
      title: 'The two shapes, drawn side by side',
      blocks: [
        {
          t: 'ascii',
          caption: 'Broker-tracked: the broker holds per-message state and deletes on acknowledgement.',
          code: `
  RabbitMQ / SQS

   producer ──▶ ┌───────────────────────────────────┐
                │ QUEUE  [m1][m2][m3][m4][m5]       │
                └──────────────┬────────────────────┘
                               │ deliver m1
                               ▼
                          consumer  ── processes ──▶ ack
                               │
                ┌──────────────▼────────────────────┐
                │ QUEUE  [m2][m3][m4][m5]           │  m1 is GONE
                └───────────────────────────────────┘

  The broker knows m1 was delivered and unacknowledged.
  If the consumer dies, the broker redelivers m1 — and ONLY m1.
  m3 can be nacked and retried while m2 and m4 proceed normally.

  ✔ per-message retry, DLQ, priorities, delays
  ✘ no replay — once acked it is gone forever
  ✘ broker state grows with in-flight messages`,
        },
        {
          t: 'ascii',
          caption: 'Consumer-tracked: an immutable log, and a bookmark per group.',
          code: `
  Kafka

   producer ──▶ partition 0
                ┌────┬────┬────┬────┬────┬────┬────┐
                │ 0  │ 1  │ 2  │ 3  │ 4  │ 5  │ 6  │  append only
                └────┴────┴────┴────┴────┴────┴────┘
                            ▲         ▲            ▲
                            │         │            │
                     analytics    payment      shipping
                     offset 2     offset 4     offset 6

  Nothing is deleted. Each group moves its own bookmark.

  ✔ replay by moving an offset backwards
  ✔ many independent consumers, no broker state per message
  ✔ enormous throughput — sequential disk writes
  ✘ message 3 cannot be "retried later" on its own: to reach
    message 4 you must get past 3. ONE POISON MESSAGE BLOCKS
    THE WHOLE PARTITION.
  ✘ no priorities, no per-message delay`,
        },
        {
          t: 'key',
          title: 'The single most consequential difference',
          text: 'In RabbitMQ, a failing message can be set aside while everything else flows. In Kafka, the partition is a queue of one — you either process message 3, skip it, or stop. This is why Kafka needs an explicit retry-topic and dead-letter-topic strategy, and why using Kafka as a task queue with heterogeneous work is painful.',
        },
      ],
    },
    {
      id: 'rabbit-routing',
      title: 'What RabbitMQ gives you that Kafka does not',
      blocks: [
        { t: 'p', text: 'RabbitMQ separates *where a message is sent* from *which queues receive it*. Producers publish to an **exchange**, and bindings decide the rest.' },
        {
          t: 'ascii',
          caption: 'Exchange types: the routing is declarative, and consumers own their bindings.',
          code: `
   producer ──▶ EXCHANGE "orders" (topic)
                      │
        routing key: "order.placed.in"
                      │
      ┌───────────────┼──────────────────┬────────────────┐
      │ binding:      │ binding:         │ binding:       │
      │ "order.*.in"  │ "order.placed.#" │ "#"            │
      ▼               ▼                  ▼                ▼
  ┌────────┐    ┌───────────┐     ┌──────────┐    ┌───────────┐
  │payment │    │ inventory │     │ audit    │    │ (no match)│
  └────────┘    └───────────┘     └──────────┘    └───────────┘

  direct  — exact routing key match
  topic   — wildcard patterns (* = one word, # = zero or more)
  fanout  — every bound queue, routing key ignored
  headers — match on header values instead of the key

  A consumer subscribes to exactly the slice it cares about, and the
  producer never knows. Kafka has nothing equivalent — you filter
  client-side, or use separate topics.`,
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'Features that simply do not exist in Kafka',
          code: `
// PRIORITY — urgent messages jump the queue
@Bean Queue orders() {
    return QueueBuilder.durable("orders")
            .withArgument("x-max-priority", 10)
            .build();
}
rabbit.convertAndSend("orders", msg, m -> {
    m.getMessageProperties().setPriority(9);     // processed before priority 1
    return m;
});

// DELAY / TTL — "retry this in 30 seconds" without blocking anything
.withArgument("x-message-ttl", 30_000)
.withArgument("x-dead-letter-exchange", "orders.retry")

// PER-MESSAGE NACK — set one message aside, keep the rest flowing
channel.basicNack(deliveryTag, false, /* requeue */ false);   // → DLQ`,
        },
        {
          t: 'tip',
          title: 'A useful rule of thumb',
          text: 'If you find yourself wanting priorities, per-message delays, or "retry just this one in five minutes", you want a queue broker — and forcing Kafka to do it means building retry topics, delay topics and a scheduler you will have to maintain.',
        },
      ],
    },
    {
      id: 'choosing',
      title: 'Choosing, with the running example',
      blocks: [
        {
          t: 'ascii',
          caption: 'One system, three workloads, three correct answers.',
          code: `
  ORDER EVENTS  (OrderPlaced, PaymentCaptured, OrderShipped)
     • many consumers, some added later
     • need replay when a consumer has a bug
     • need per-order ordering
     • high volume
     ──▶ KAFKA.  Log semantics are exactly this shape.


  EMAIL / SMS SENDING  (one worker pool, heterogeneous tasks)
     • one consumer group, work-sharing
     • one bad address must not block the others
     • "retry in 5 minutes, then 30, then give up"
     • priority: password resets before marketing
     ──▶ RABBITMQ (or SQS).  Per-message retry and priorities.


  IMAGE THUMBNAILING  (bursty, stateless, AWS-hosted)
     • no replay needed, no ordering needed
     • do not want to operate a broker at all
     ──▶ SQS.  Managed, cheap, scales to zero.`,
        },
        {
          t: 'key',
          title: 'Using two brokers is a legitimate architecture',
          text: 'It is not a failure of decisiveness. Kafka as the event backbone plus a queue for task distribution is an extremely common and sensible pairing. The mistake is using one for both jobs and then building the missing half yourself.',
        },
        {
          t: 'table',
          head: ['If you need…', 'Choose'],
          rows: [
            ['Replay, event sourcing, stream processing', 'Kafka'],
            ['Many independent consumers of the same stream', 'Kafka'],
            ['Very high throughput with ordering per key', 'Kafka'],
            ['Per-message retry and dead-lettering', 'RabbitMQ / SQS'],
            ['Priorities or delayed delivery', 'RabbitMQ'],
            ['Complex routing rules owned by consumers', 'RabbitMQ'],
            ['Zero operational burden on AWS', 'SQS + SNS'],
            ['Strict FIFO with de-duplication, managed', 'SQS FIFO'],
            ['Multi-tenancy and geo-replication built in', 'Pulsar'],
          ],
        },
      ],
    },
    {
      id: 'costs',
      title: 'The operational reality',
      blocks: [
        {
          t: 'compare',
          left: {
            title: 'What running Kafka actually involves',
            items: [
              'A cluster of brokers, plus KRaft or ZooKeeper',
              'Partition counts you must plan and cannot reduce',
              'Replication factor, min in-sync replicas, unclean leader election',
              'Retention, compaction and disk sizing',
              'Rebalance storms during deploys',
              'A schema registry if you want safe evolution',
              'Consumer lag monitoring on everything',
            ],
          },
          right: {
            title: 'What managed gives you',
            items: [
              'MSK, Confluent Cloud, Redpanda, CloudKarafka',
              'You still own partitions, schemas and consumer behaviour',
              'You stop owning upgrades, disks and broker failure',
              'Substantially more expensive per message',
              'Usually the right call below a certain scale',
            ],
          },
        },
        {
          t: 'trap',
          title: 'The hidden cost is not the broker',
          text: 'It is everything around it: schema management, a dead-letter strategy, replay tooling, correlation ids, lag alerts, and a team that understands rebalancing. Teams budget for the cluster and are surprised by the ecosystem. If you are adopting Kafka, budget for that work explicitly.',
        },
        {
          t: 'note',
          title: 'The smallest thing that could work',
          text: 'Before reaching for a broker at all: a database table used as a queue (`SELECT ... FOR UPDATE SKIP LOCKED`) is genuinely adequate for modest volumes, needs no new infrastructure, and gives you transactional writes for free. It stops scaling eventually — but "eventually" is further away than most teams assume, and you can move to a broker when the numbers say so rather than when the architecture diagram does.',
        },
      ],
    },
  ],

  patterns: [
    {
      id: 'shape-first',
      name: 'Match the Broker to the Workload Shape',
      oneLiner: 'Decide by replay and per-message retry before anything else.',
      useWhen: ['Choosing a broker, or questioning an existing choice.'],
      recognize: ['Building retry topics and a scheduler on top of Kafka.', 'Wanting to replay from a queue that deletes on ack.'],
      steps: [
        'Ask: will anyone need to re-read these messages later? Yes → log.',
        'Ask: must one failing message be retried without blocking others? Yes → queue.',
        'Ask: do consumers need different slices of the stream? Yes → rich routing.',
        'If the answers conflict, use both brokers for their respective jobs.',
      ],
      complexity: 'A design decision; expensive to reverse later.',
      gotchas: [
        'Kafka can do task queues, badly. RabbitMQ can do event streams, badly. Neither is a bug.',
        'Choosing by throughput benchmark alone almost always picks the wrong shape.',
      ],
      problems: ['Classify three workloads', 'Justify a two-broker architecture'],
    },
    {
      id: 'retry-topics',
      name: 'Retry Topics When You Must Use Kafka for Tasks',
      oneLiner: 'Move the failing message off the main partition instead of blocking it.',
      useWhen: ['Kafka is the only broker available and you need per-message retry.'],
      recognize: ['A poison message halting an entire partition.'],
      steps: [
        'On failure, publish the message to `topic.retry.5s`, then `topic.retry.1m`, and so on.',
        'A consumer per retry topic waits the delay, then republishes to the main topic.',
        'After the final attempt, publish to `topic.DLT`.',
      ],
      template: {
        lang: 'java',
        caption: 'Spring Kafka builds the topic chain for you',
        code: `
@RetryableTopic(
        attempts = "4",
        backoff = @Backoff(delay = 5_000, multiplier = 4.0),   // 5s, 20s, 80s
        dltStrategy = DltStrategy.FAIL_ON_ERROR,
        exclude = { JsonProcessingException.class })           // never retry these
@KafkaListener(topics = "orders", groupId = "payment")
public void handle(OrderPlaced event) { charge(event); }

@DltHandler
public void dlt(OrderPlaced event,
                @Header(KafkaHeaders.EXCEPTION_MESSAGE) String reason) {
    alerting.notify("Order " + event.orderId() + " dead-lettered: " + reason);
}
// Creates: orders-retry-0, orders-retry-1, orders-retry-2, orders-dlt`,
      },
      complexity: 'Extra topics and consumers; keeps the main partition flowing.',
      gotchas: [
        'Retrying on a separate topic **loses ordering** for that key — acceptable for tasks, not for state transitions.',
        'Exclude non-retryable exceptions or you will retry malformed JSON four times for nothing.',
      ],
      problems: ['Block a partition with a poison message', 'Add retry topics and watch it recover'],
    },
    {
      id: 'db-as-queue',
      name: 'Start With the Database',
      oneLiner: 'For modest volumes, a table plus SKIP LOCKED beats a new piece of infrastructure.',
      useWhen: ['Early-stage systems, low volume, or work that must be transactional with your data.'],
      recognize: ['Adding Kafka for a few hundred messages a minute.', 'The outbox pattern you already need looking a lot like a queue.'],
      steps: ['A table with status and attempt columns.', 'Workers claim rows with `FOR UPDATE SKIP LOCKED`.', 'Move to a broker when volume or fan-out justifies it.'],
      template: {
        lang: 'java',
        caption: 'SKIP LOCKED gives you competing consumers with no extra infrastructure',
        code: `
-- Each worker claims a distinct batch; no worker blocks another.
UPDATE jobs
SET status = 'PROCESSING', claimed_at = now(), worker = :worker
WHERE id IN (
    SELECT id FROM jobs
    WHERE status = 'PENDING' AND run_after <= now()
    ORDER BY priority DESC, run_after
    LIMIT 10
    FOR UPDATE SKIP LOCKED          -- the important clause
)
RETURNING *;`,
      },
      complexity: 'Comfortably handles thousands per minute; transactional for free.',
      gotchas: [
        'Needs a reaper for rows stuck in PROCESSING after a crash.',
        'Polling adds latency; long-polling or LISTEN/NOTIFY helps.',
        'It will not fan out to many independent consumers — that is when you graduate to a broker.',
      ],
      problems: ['Build a SKIP LOCKED queue', 'Find where it stops scaling'],
    },
  ],

  pitfalls: [
    { title: 'Using Kafka as a task queue', text: 'No priorities, no per-message delay, and one bad message blocks the partition.' },
    { title: 'Using RabbitMQ as an event store', text: 'Acked messages are gone. You cannot add a consumer that needs history.' },
    { title: 'Choosing on throughput benchmarks', text: 'Almost nobody is limited by broker throughput. Shape matters more.' },
    { title: 'Underestimating the ecosystem cost', text: 'Schema registry, DLQ strategy, replay tooling and lag alerts are the real work.' },
    { title: 'Assuming SQS gives you ordering', text: 'Standard queues are explicitly unordered. Only FIFO queues are, at lower throughput.' },
    { title: 'Adding a broker before you need one', text: 'A database table is often enough for far longer than expected.' },
    { title: 'Running your own cluster without the expertise', text: 'Managed Kafka is expensive; an outage caused by an unclean leader election is more so.' },
    { title: 'One broker forced to do both jobs', text: 'You end up rebuilding the missing half yourself.' },
  ],

  cheatsheet: [
    { label: 'Kafka', value: 'log — consumer holds the offset' },
    { label: 'RabbitMQ / SQS', value: 'queue — broker tracks each message' },
    { label: 'Need replay?', value: 'Kafka' },
    { label: 'Need per-message retry?', value: 'RabbitMQ / SQS' },
    { label: 'Need priorities or delays?', value: 'RabbitMQ' },
    { label: 'Need rich routing?', value: 'RabbitMQ exchanges' },
    { label: 'Need zero ops on AWS?', value: 'SQS + SNS' },
    { label: 'Kafka ordering', value: 'per partition, via the key' },
    { label: 'Kafka weakness', value: 'one poison message blocks a partition' },
    { label: 'Kafka workaround', value: 'retry topics + DLT' },
    { label: 'SQS standard', value: 'unordered, at-least-once' },
    { label: 'SQS FIFO', value: 'ordered, lower throughput' },
    { label: 'Smallest option', value: 'DB table + SKIP LOCKED' },
    { label: 'Two brokers', value: 'a legitimate answer' },
  ],

  problems: [
    { name: 'Run Kafka and RabbitMQ side by side', difficulty: 'Easy', pattern: 'Setup', insight: 'Docker Compose with both. Publish the same message to each and compare what the management UIs show you about state.' },
    { name: 'Replay in Kafka, fail to replay in Rabbit', difficulty: 'Easy', pattern: 'Log vs queue', insight: 'Consume and ack in both. Reset the Kafka offset and reprocess; then try to get the RabbitMQ message back.' },
    { name: 'Block a Kafka partition', difficulty: 'Medium', pattern: 'Poison messages', insight: 'Make one message always throw with infinite retries. Nothing behind it is processed, even though the other partitions are fine.' },
    { name: 'Nack one RabbitMQ message', difficulty: 'Medium', pattern: 'Per-message retry', insight: 'Reject a single message to a DLQ and confirm the rest of the queue keeps flowing.' },
    { name: 'Use RabbitMQ topic routing', difficulty: 'Medium', pattern: 'Routing', insight: 'Bind three queues with order.*.in, order.placed.# and #. Publish several routing keys and predict which queues receive what.' },
    { name: 'Add priorities', difficulty: 'Medium', pattern: 'Queue features', insight: 'Publish low-priority messages, then a high-priority one, and confirm it is consumed first. Then try to express the same thing in Kafka.' },
    { name: 'Add retry topics to Kafka', difficulty: 'Hard', pattern: 'Retry topics', insight: 'Use @RetryableTopic, confirm the generated topics, and watch a failing message move through them without blocking the main partition.' },
    { name: 'Lose ordering via a retry topic', difficulty: 'Hard', pattern: 'Trade-offs', insight: 'Send two events for one key; fail the first. The second overtakes it. Decide whether that is acceptable for your use case.' },
    { name: 'Build a SKIP LOCKED queue', difficulty: 'Medium', pattern: 'Database queue', insight: 'Three workers claiming batches concurrently. Verify no row is claimed twice and no worker blocks another.' },
    { name: 'Write the decision down', difficulty: 'Medium', pattern: 'Architecture', insight: 'For three real workloads, pick a broker and justify it in two sentences each using replay and per-message retry.' },
  ],
}
