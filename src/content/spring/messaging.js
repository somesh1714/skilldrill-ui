export default {
  id: 'messaging',
  title: 'Messaging & Event-Driven Services',
  short: 'Messaging',
  icon: 'SendRounded',
  tier: 'Elite',
  order: 22,
  estHours: 6,
  prereqs: ['transactions', 'resilience'],
  tagline: 'Asynchronous messaging buys decoupling and pays for it in ordering, duplicates and debugging.',
  mentalModel:
    'A queue turns a synchronous call into a promise. The caller stops waiting, which is the benefit — and immediately loses the ability to know whether the work succeeded, which is the cost. Every messaging problem is a consequence of that trade.',
  whyItMatters:
    'Messaging is how services stay available when their collaborators are not. It is also where the hardest production bugs live: messages processed twice, processed out of order, or lost between the database and the broker.',

  reference: {
    title: 'Delivery guarantees',
    head: ['Guarantee', 'Means', 'Reality'],
    rows: [
      ['**At most once**', 'Never duplicated, may be lost', 'Acknowledge before processing. Rarely acceptable'],
      ['**At least once**', 'Never lost, may be duplicated', '**What you will actually use.** Acknowledge after processing'],
      ['**Exactly once**', 'Neither lost nor duplicated', 'Not achievable end-to-end. Approximated with at-least-once + idempotency'],
    ],
  },

  sections: [
    {
      id: 'when',
      title: 'When a message beats a call',
      blocks: [
        {
          t: 'compare',
          left: {
            title: 'Use messaging when',
            items: [
              'The caller does not need the result',
              'The work can happen later — emails, reports, indexing',
              'Several consumers care about the same event',
              'You need to absorb bursts',
              'The consumer may be down and that is acceptable',
            ],
          },
          right: {
            title: 'Use a direct call when',
            items: [
              'The caller needs the answer to continue',
              'The user is waiting for the outcome',
              'Strict ordering matters and you cannot partition for it',
              'You need a transaction across both sides',
              'The added operational complexity is not worth it',
            ],
          },
        },
        {
          t: 'key',
          title: 'Events describe what happened, commands ask for something',
          text: '`OrderPlaced` is an event: a fact, past tense, with possibly many interested consumers. `SendEmail` is a command: an instruction with exactly one handler. Publishing events keeps services decoupled; sending commands over a queue is really just asynchronous RPC, and it is worth being honest about which one you are doing.',
        },
      ],
    },
    {
      id: 'kafka',
      title: 'Kafka in Spring',
      blocks: [
        {
          t: 'code',
          lang: 'java',
          caption: 'Producing, with the key that controls ordering',
          code: `
@Service
public class OrderEventPublisher {
    private final KafkaTemplate<String, OrderPlaced> template;

    public void publish(Order order) {
        // The KEY decides the partition. All events for one order go to the
        // same partition, and a partition is ordered — so ordering per order
        // is guaranteed, while different orders are processed in parallel.
        template.send("orders", order.id().toString(), OrderPlaced.from(order))
                .whenComplete((result, ex) -> {
                    if (ex != null) log.error("Publish failed for {}", order.id(), ex);
                });
    }
}

spring:
  kafka:
    producer:
      acks: all                        # wait for all in-sync replicas
      retries: 3
      properties:
        enable.idempotence: true       # broker de-duplicates producer retries
        max.in.flight.requests.per.connection: 5`,
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'Consuming, with manual acknowledgement',
          code: `
@Component
public class OrderEventListener {

    @KafkaListener(topics = "orders", groupId = "notifications",
                   concurrency = "3")           // 3 threads, up to 3 partitions
    public void onOrderPlaced(OrderPlaced event, Acknowledgment ack) {
        try {
            if (processed.contains(event.eventId())) {   // idempotency check
                ack.acknowledge();
                return;
            }
            notificationService.send(event);
            processed.record(event.eventId());
            ack.acknowledge();                   // acknowledge AFTER success
        } catch (TransientException e) {
            // do not acknowledge — it will be redelivered
            throw e;
        }
    }
}

spring:
  kafka:
    consumer:
      enable-auto-commit: false        # manual acknowledgement
      auto-offset-reset: earliest
      max-poll-records: 50
    listener:
      ack-mode: manual`,
        },
        {
          t: 'trap',
          title: 'Acknowledging before processing loses messages',
          text: 'With auto-commit, the offset advances on a schedule regardless of whether your handler succeeded. Crash mid-processing and the message is gone. Turn auto-commit off and acknowledge only after the work is durably done — that is what makes it at-least-once.',
        },
        {
          t: 'note',
          title: 'Ordering is per partition, not per topic',
          text: 'Kafka guarantees order within a partition only. If you need events for one entity in order, key by that entity id. If you key randomly for throughput, you must design consumers that tolerate out-of-order delivery — usually with a version number or timestamp check.',
        },
      ],
    },
    {
      id: 'idempotency',
      title: 'Duplicates are not an edge case',
      blocks: [
        { t: 'p', text: 'At-least-once delivery means your consumer **will** see the same message more than once: after a rebalance, after a redeploy, after a network blip between processing and acknowledging. Designing for it is not optional.' },
        {
          t: 'code',
          lang: 'java',
          caption: 'The consumer-side idempotency table',
          code: `
@Transactional
public void handle(OrderPlaced event) {
    // Insert first. A unique constraint on event_id makes this the
    // de-duplication mechanism — and it is in the SAME transaction as the work,
    // so a crash cannot leave one without the other.
    try {
        processedRepo.save(new ProcessedEvent(event.eventId(), Instant.now()));
    } catch (DataIntegrityViolationException e) {
        log.debug("Duplicate event {}, skipping", event.eventId());
        return;
    }

    inventoryService.reserve(event.items());
}`,
        },
        {
          t: 'key',
          title: 'Naturally idempotent operations need no table',
          text: '"Set status to SHIPPED" is idempotent — doing it twice is harmless. "Add 1 to the count" is not. Where you can, design the operation so repetition does not matter; it is far simpler than tracking every event id.',
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'The transactional outbox: the fix for the dual-write problem',
          code: `
// THE PROBLEM: you cannot atomically write to the database AND publish to a
// broker. If the publish fails after the commit, the event is lost forever.
@Transactional
public void place(Order order) {
    repo.save(order);
    kafka.send("orders", event);      // ← if this fails, the order exists
}                                     //   but nobody was ever told

// THE FIX: write the event to an outbox TABLE in the same transaction.
@Transactional
public void place(Order order) {
    repo.save(order);
    outbox.save(new OutboxEvent("orders", order.id().toString(), toJson(event)));
}   // one atomic commit — both rows or neither

// A separate poller (or change-data-capture, e.g. Debezium) publishes
// from the outbox and marks rows as sent. Publishing may duplicate,
// which is fine — the consumer is idempotent.
@Scheduled(fixedDelay = 500)
public void drainOutbox() {
    for (OutboxEvent e : outbox.findUnsentLimit(100)) {
        kafka.send(e.topic(), e.key(), e.payload());
        outbox.markSent(e.id());
    }
}`,
        },
        {
          t: 'warn',
          title: 'Never publish inside a transaction and hope',
          text: 'The dual-write problem is the most common correctness bug in event-driven systems, and it is invisible until the broker has a bad minute. Either use an outbox, or accept and document that events can be lost.',
        },
      ],
    },
    {
      id: 'failures',
      title: 'Poison messages and dead letters',
      blocks: [
        { t: 'p', text: 'One message that always fails will block its partition forever if you keep retrying it. You need a way to set it aside and keep going.' },
        {
          t: 'code',
          lang: 'java',
          caption: 'Retry a few times, then dead-letter',
          code: `
@Bean
DefaultErrorHandler errorHandler(KafkaTemplate<String, Object> template) {
    // After the retries are exhausted, send to <topic>.DLT
    var recoverer = new DeadLetterPublishingRecoverer(template);

    var handler = new DefaultErrorHandler(recoverer,
            new ExponentialBackOff(1000L, 2.0));     // 1s, 2s, 4s…

    // Never retry something that can never succeed
    handler.addNotRetryableExceptions(
            JsonProcessingException.class,           // malformed payload
            IllegalArgumentException.class);
    return handler;
}

@KafkaListener(topics = "orders.DLT", groupId = "dlt-monitor")
public void onDeadLetter(ConsumerRecord<String, String> record) {
    log.error("Dead letter: topic={} key={} reason={}",
              record.topic(), record.key(),
              new String(record.headers().lastHeader("kafka_dlt-exception-message").value()));
    alerting.notify("Message dead-lettered");        // a human must look
}`,
        },
        {
          t: 'trap',
          title: 'A dead-letter queue nobody watches is a data-loss queue',
          text: 'Messages land there silently and accumulate. Alert on the DLT depth, keep the original headers so you know why it failed, and have a documented replay procedure. A DLT is a pause button, not a bin.',
        },
        {
          t: 'tip',
          title: 'Consumer lag is the metric that matters',
          text: 'Lag is how many messages are waiting. Growing lag means consumers cannot keep up — scale them out (up to the partition count), increase `max-poll-records`, or make the handler faster. It is the single best early-warning signal for a messaging system.',
        },
      ],
    },
  ],

  patterns: [
    {
      id: 'outbox',
      name: 'Transactional Outbox',
      oneLiner: 'Write the event to your own database in the same transaction, publish it separately.',
      useWhen: ['Any time a state change must produce an event reliably.'],
      recognize: ['A `kafka.send` inside a `@Transactional` method.', 'Events missing for records that definitely exist.'],
      steps: [
        'Create an outbox table with topic, key, payload and a sent flag.',
        'Insert into it in the same transaction as the business write.',
        'A poller or CDC process publishes and marks rows sent.',
        'Consumers must be idempotent, because publishing can duplicate.',
      ],
      complexity: 'One extra insert per event plus a background poller.',
      gotchas: [
        'The poller must handle its own crash — publish, then mark sent, and accept duplicates.',
        'Index the sent flag or the poll query becomes a table scan.',
        'Prune old rows, or the table grows forever.',
      ],
      problems: ['Lose an event with a dual write', 'Implement an outbox and prove nothing is lost'],
    },
    {
      id: 'idempotent-consumer',
      name: 'Idempotent Consumer',
      oneLiner: 'Assume every message arrives at least twice.',
      useWhen: ['Every consumer, without exception.'],
      recognize: ['Duplicate records after a rebalance or a redeploy.'],
      steps: [
        'Prefer naturally idempotent operations.',
        'Otherwise record the event id with a unique constraint, in the same transaction as the work.',
        'Expire old ids so the table stays bounded.',
      ],
      complexity: 'One insert per message.',
      gotchas: [
        'Checking "have I seen this?" then inserting is a race — rely on the unique constraint instead.',
        'The de-duplication record and the work must commit together, or a crash between them breaks the guarantee.',
      ],
      problems: ['Redeliver a message and observe the duplicate', 'Fix it with a unique constraint'],
    },
    {
      id: 'key-for-ordering',
      name: 'Key by Entity for Ordering',
      oneLiner: 'Same key, same partition, same order — different keys run in parallel.',
      useWhen: ['Events about an entity that must be applied in sequence.'],
      recognize: ['A status regressing because an older event arrived later.'],
      steps: ['Key messages by the entity id.', 'Set consumer concurrency no higher than the partition count.', 'Where ordering cannot be guaranteed, carry a version and ignore older events.'],
      template: {
        lang: 'java',
        caption: 'Defending against out-of-order delivery anyway',
        code: `
@Transactional
public void apply(OrderStatusChanged event) {
    Order order = repo.findById(event.orderId()).orElseThrow();

    if (event.version() <= order.getVersion()) {      // stale event
        log.debug("Ignoring out-of-order event v{} for order at v{}",
                  event.version(), order.getVersion());
        return;
    }
    order.applyStatus(event.status(), event.version());
}`,
      },
      complexity: 'Ordering per key while keeping parallelism across keys.',
      gotchas: [
        'Adding partitions later changes the key-to-partition mapping and breaks ordering during the transition.',
        'A hot key becomes a bottleneck — one partition, one consumer thread.',
      ],
      problems: ['Show out-of-order processing', 'Fix it with keying and a version check'],
    },
  ],

  pitfalls: [
    { title: 'Publishing inside a transaction', text: 'The dual-write problem. A broker failure after commit loses the event permanently.' },
    { title: 'Auto-commit offsets', text: 'Acknowledges before processing, so a crash loses messages.' },
    { title: 'Assuming exactly-once delivery', text: 'It does not exist end-to-end. Build idempotent consumers.' },
    { title: 'Assuming topic-wide ordering', text: 'Kafka orders within a partition only.' },
    { title: 'Retrying a poison message forever', text: 'Blocks the partition and stops all progress behind it.' },
    { title: 'An unmonitored dead-letter topic', text: 'Silent data loss that accumulates.' },
    { title: 'Not monitoring consumer lag', text: 'You discover you are hours behind when a user complains.' },
    { title: 'More consumers than partitions', text: 'The extra consumers sit idle — partitions are the unit of parallelism.' },
    { title: 'Putting entities in message payloads', text: 'Couples producer and consumer to one schema. Publish a versioned event contract.' },
    { title: 'Using messaging where a call would do', text: 'Asynchrony has a real operational cost; do not pay it for nothing.' },
  ],

  cheatsheet: [
    { label: 'Realistic guarantee', value: 'at least once' },
    { label: 'So consumers must be', value: 'idempotent' },
    { label: 'Ordering', value: 'per partition, via the key' },
    { label: 'Parallelism limit', value: 'the partition count' },
    { label: 'Acknowledge', value: 'after processing, manually' },
    { label: 'Dual write fix', value: 'transactional outbox' },
    { label: 'De-duplication', value: 'unique constraint on event id' },
    { label: 'Same transaction', value: 'the work and the dedup row' },
    { label: 'Poison message', value: 'retry, then dead-letter' },
    { label: 'DLT', value: 'must be monitored and replayable' },
    { label: 'Key metric', value: 'consumer lag' },
    { label: 'Producer safety', value: 'acks=all + enable.idempotence' },
    { label: 'Event vs command', value: 'a fact vs an instruction' },
  ],

  problems: [
    { name: 'Publish and consume a message', difficulty: 'Easy', pattern: 'Basics', insight: 'KafkaTemplate plus @KafkaListener with Testcontainers. Confirm the round trip in an integration test.' },
    { name: 'Lose a message with auto-commit', difficulty: 'Medium', pattern: 'Acknowledgement', insight: 'Enable auto-commit, throw from the handler, restart the consumer. The message is gone. Switch to manual ack and it is redelivered.' },
    { name: 'Observe a duplicate delivery', difficulty: 'Medium', pattern: 'At-least-once', insight: 'Process a message, kill the consumer before acknowledging, and restart. The same message arrives again.' },
    { name: 'Make the consumer idempotent', difficulty: 'Medium', pattern: 'Idempotency', insight: 'Add a processed_events table with a unique constraint and confirm the duplicate is now a no-op.' },
    { name: 'Break ordering with random keys', difficulty: 'Medium', pattern: 'Ordering', insight: 'Publish status changes for one order with null keys and three partitions. Watch the status regress.' },
    { name: 'Fix ordering by keying', difficulty: 'Medium', pattern: 'Ordering', insight: 'Key by order id and repeat. All events for that order land on one partition and arrive in order.' },
    { name: 'Lose an event with a dual write', difficulty: 'Hard', pattern: 'Outbox', insight: 'Publish inside a transaction, make the broker unavailable at the right moment, and end up with a record and no event.' },
    { name: 'Implement a transactional outbox', difficulty: 'Hard', pattern: 'Outbox', insight: 'Insert to the outbox in the same transaction, publish from a poller, and repeat the failure test. Nothing is lost.' },
    { name: 'Block a partition with a poison message', difficulty: 'Hard', pattern: 'Poison messages', insight: 'Send a malformed payload with infinite retries. Nothing behind it is processed. Add a DLT and progress resumes.' },
    { name: 'Watch consumer lag grow', difficulty: 'Medium', pattern: 'Monitoring', insight: 'Slow the consumer, publish faster than it consumes, and chart the lag. Then scale up to the partition count and watch it drain.' },
  ],
}
