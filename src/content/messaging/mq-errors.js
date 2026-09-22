export default {
  id: 'mq-errors',
  title: 'Retries, Dead Letters & Poison Messages',
  short: 'Errors & DLQ',
  icon: 'ReportProblemRounded',
  tier: 'Advanced',
  order: 13,
  estHours: 5,
  prereqs: ['kafka-consumer', 'mq-delivery'],
  tagline: 'One message that always fails will stop a partition forever unless you plan for it.',
  mentalModel:
    'Sort every failure into one of two boxes. **Transient** — the network blipped, the database was briefly unavailable — retry and it will work. **Permanent** — the JSON is malformed, the referenced order does not exist — retrying a thousand times changes nothing. Retrying a permanent failure is how a partition stops moving.',
  whyItMatters:
    'In a queue broker, a bad message is set aside and everything else flows. In Kafka, the partition is strictly ordered, so message 47 blocks 48 through infinity. Without an explicit strategy, one malformed payload halts a shard of your pipeline — and the symptom is "lag on one partition", not an error anyone notices.',

  reference: {
    title: 'Classify before you retry',
    head: ['Failure', 'Type', 'Action'],
    rows: [
      ['Connection refused, timeout', 'Transient', 'Retry with backoff'],
      ['Database deadlock, lock timeout', 'Transient', 'Retry'],
      ['HTTP 503, 429', 'Transient', 'Retry, honour `Retry-After`'],
      ['Malformed JSON, deserialization error', '**Permanent**', 'Straight to the DLQ'],
      ['Validation failure, unknown enum', '**Permanent**', 'Straight to the DLQ'],
      ['HTTP 400, 404', '**Permanent**', 'DLQ — the request is wrong'],
      ['Referenced entity missing', 'Ambiguous', 'Retry briefly — it may arrive'],
      ['Business rule violated', '**Permanent**', 'DLQ, and usually alert'],
    ],
  },

  sections: [
    {
      id: 'blocking',
      title: 'How one message stops a partition',
      blocks: [
        {
          t: 'ascii',
          caption: 'The failure mode that makes Kafka different.',
          code: `
  partition 3
  ┌────┬────┬────┬────┬────┬────┬────┬────┬────┐
  │ 45 │ 46 │ 47 │ 48 │ 49 │ 50 │ 51 │ 52 │ …  │
  └────┴────┴────┴────┴────┴────┴────┴────┴────┘
                 ▲
                 │  offset 47: malformed JSON
                 │  handler throws, offset not committed
                 │  ── poll returns 47 again ──
                 │  handler throws again
                 │  ...forever...

  48 onwards are NEVER processed. The other partitions are fine,
  so throughput drops by 1/N and nothing alerts.

  What you actually see in monitoring:
     partition 0  lag: 12
     partition 1  lag: 8
     partition 2  lag: 20
     partition 3  lag: 148,302   ◀── the only clue`,
        },
        {
          t: 'key',
          title: 'Alert on per-partition lag, not total lag',
          text: 'Aggregate lag across twelve partitions hides one stuck partition for a long time. `max(lag) by partition` catches it in minutes. This single alert finds more real incidents than almost anything else in a Kafka deployment.',
        },
      ],
    },
    {
      id: 'retry-topics',
      title: 'Retry topics: the Kafka answer',
      blocks: [
        { t: 'p', text: 'Since you cannot set one message aside inside a partition, you move it to a different topic. That keeps the main partition flowing while the failure is retried on its own schedule.' },
        {
          t: 'ascii',
          caption: 'The message walks down a ladder of increasing delays.',
          code: `
                  ┌──────────────┐
   ──────────────▶│    orders    │  main topic — never blocked
                  └──────┬───────┘
                         │ handler throws (transient)
                         ▼
                  ┌──────────────────┐
                  │ orders-retry-5s  │  consumer waits 5s, republishes
                  └──────┬───────────┘
                         │ fails again
                         ▼
                  ┌──────────────────┐
                  │ orders-retry-30s │
                  └──────┬───────────┘
                         │ fails again
                         ▼
                  ┌──────────────────┐
                  │ orders-retry-5m  │
                  └──────┬───────────┘
                         │ fails again — attempts exhausted
                         ▼
                  ┌──────────────────┐
                  │   orders-DLT     │  a human looks at this
                  └──────────────────┘

  Trade-off: a message that goes down the ladder LOSES ITS ORDERING
  relative to later messages for the same key. Fine for independent
  tasks; not acceptable for state transitions on one entity.`,
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'Spring Kafka builds the whole ladder from one annotation',
          code: `
@RetryableTopic(
        attempts = "4",
        backoff = @Backoff(delay = 5_000, multiplier = 6.0),   // 5s, 30s, 3m
        autoCreateTopics = "true",
        dltStrategy = DltStrategy.FAIL_ON_ERROR,
        // PERMANENT failures skip the ladder entirely and go straight to the DLT
        exclude = {
            DeserializationException.class,
            MethodArgumentNotValidException.class,
            IllegalArgumentException.class
        })
@KafkaListener(topics = "orders", groupId = "payment")
public void handle(OrderPlaced event) {
    gateway.charge(event);         // may throw transiently
}

@DltHandler
public void onDeadLetter(OrderPlaced event,
        @Header(KafkaHeaders.ORIGINAL_TOPIC) String topic,
        @Header(KafkaHeaders.EXCEPTION_MESSAGE) String reason) {
    log.error("Dead-lettered order {} from {}: {}", event.orderId(), topic, reason);
    alerting.notify("Order " + event.orderId() + " needs manual review");
}`,
        },
        {
          t: 'trap',
          title: 'Always populate `exclude`',
          text: 'Without it, malformed JSON is retried four times over three minutes before reaching the DLT — for a failure that could never have succeeded. Worse, a deserialization error often cannot even be retried meaningfully because the payload never became an object. List your permanent exceptions explicitly.',
        },
      ],
    },
    {
      id: 'dlq',
      title: 'Dead letters: a pause button, not a bin',
      blocks: [
        {
          t: 'ascii',
          caption: 'A DLQ only works if something happens after a message lands in it.',
          code: `
  message fails permanently
        │
        ▼
  ┌──────────────────────────────────────────────────┐
  │  orders-DLT                                      │
  │   • the original payload, unchanged              │
  │   • headers: original topic, partition, offset,  │
  │     exception class, exception message, stack    │
  └──────────────────┬───────────────────────────────┘
                     │
        ┌────────────┼──────────────┐
        ▼            ▼              ▼
    ALERT        DASHBOARD       REPLAY TOOL
   (someone      (how many,     (fix the bug,
    is paged)     which type)    republish to
                                 the main topic)

  Without all three, the DLT is a queue where data goes to be
  forgotten. "We have a DLQ" is not a strategy; "we alert on it
  and we can replay from it" is.`,
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'Preserve the context, or you cannot diagnose anything',
          code: `
// Spring adds these headers automatically — read them in the DLT handler
KafkaHeaders.ORIGINAL_TOPIC
KafkaHeaders.ORIGINAL_PARTITION
KafkaHeaders.ORIGINAL_OFFSET
KafkaHeaders.EXCEPTION_FQCN
KafkaHeaders.EXCEPTION_MESSAGE
KafkaHeaders.EXCEPTION_STACKTRACE

// A replay tool reads the DLT and republishes to the original topic
public void replay(String dltTopic, int max) {
    for (ConsumerRecord<String, byte[]> record : poll(dltTopic, max)) {
        String original = header(record, KafkaHeaders.ORIGINAL_TOPIC);
        producer.send(new ProducerRecord<>(original, record.key(), record.value()));
        log.info("Replayed {} back to {}", record.key(), original);
    }
}
// Replay AFTER deploying the fix, and expect duplicates — the consumer
// is idempotent, so that is safe.`,
        },
        {
          t: 'warn',
          title: 'The DLQ needs its own monitoring and retention',
          text: 'Alert on the message count and the age of the oldest entry. Give it a longer retention than the main topic — you need time to notice, diagnose, fix and replay. A DLT with seven-day retention and a bug found on day eight has quietly deleted the evidence and the data.',
        },
      ],
    },
  ],

  patterns: [
    {
      id: 'classify-then-retry',
      name: 'Classify the Failure Before Retrying',
      oneLiner: 'Transient failures go down the ladder; permanent ones go straight to the DLQ.',
      useWhen: ['Every consumer.'],
      recognize: ['Malformed JSON retried four times.', 'A blanket `catch (Exception e) { throw e; }` with retries.'],
      steps: [
        'List the exceptions your handler can throw.',
        'Mark each transient or permanent.',
        'Configure `exclude` (or `addNotRetryableExceptions`) with the permanent ones.',
      ],
      template: {
        lang: 'java',
        caption: 'Make the classification explicit in code',
        code: `
@Bean
DefaultErrorHandler errorHandler(KafkaTemplate<String, Object> template) {
    var recoverer = new DeadLetterPublishingRecoverer(template);
    var handler = new DefaultErrorHandler(recoverer,
            new ExponentialBackOffWithMaxRetries(3));

    handler.addNotRetryableExceptions(          // permanent
            DeserializationException.class,
            JsonProcessingException.class,
            IllegalArgumentException.class,
            ValidationException.class);

    handler.addRetryableExceptions(             // transient
            TransientDataAccessException.class,
            ResourceAccessException.class);
    return handler;
}`,
      },
      complexity: 'Configuration; saves minutes of pointless retrying per bad message.',
      gotchas: [
        'A deserialization failure happens before your handler runs — use `ErrorHandlingDeserializer` so it is catchable rather than fatal.',
        'Unclassified exceptions take the default path; decide what that should be.',
      ],
      problems: ['Retry malformed JSON four times', 'Exclude it and send it straight to the DLT'],
    },
    {
      id: 'retry-ladder',
      name: 'Retry Topics With Exponential Backoff',
      oneLiner: 'Move the failure off the main partition so everything else keeps moving.',
      useWhen: ['Kafka consumers whose work depends on something that can be briefly unavailable.'],
      recognize: ['Lag concentrated on one partition.', 'A pipeline halted by one message.'],
      steps: ['Use `@RetryableTopic` with a small number of attempts.', 'Exclude permanent failures.', 'Handle the DLT explicitly.'],
      complexity: 'Extra topics and consumers; the main partition never blocks.',
      gotchas: [
        'Ordering for that key is lost once a message takes the ladder.',
        'Too many attempts with long delays keeps a message alive for hours — bound it.',
        'Each retry topic is a real topic that must be created and monitored.',
      ],
      problems: ['Block a partition, then fix it with retry topics', 'Show the ordering loss'],
    },
    {
      id: 'dlq-with-replay',
      name: 'Dead Letter Queue With Alerting and Replay',
      oneLiner: 'A DLQ is only useful if a human is told and the data can come back.',
      useWhen: ['Any pipeline with a DLT.'],
      recognize: ['A DLT nobody has looked at.', 'No way to reprocess after a fix.'],
      steps: [
        'Alert on DLT depth and oldest-message age.',
        'Preserve the original headers.',
        'Build a replay tool that republishes to the original topic.',
        'Give the DLT generous retention.',
      ],
      complexity: 'One alert and a small tool; turns data loss into a delay.',
      gotchas: [
        'Replay before deploying the fix just re-fills the DLT.',
        'Replay produces duplicates — which is fine, because consumers are idempotent.',
        'A DLT with short retention silently deletes the evidence.',
      ],
      problems: ['Alert on DLT depth', 'Fix a bug and replay the DLT'],
    },
  ],

  pitfalls: [
    { title: 'Retrying forever in place', text: 'The partition stops and nothing behind it is processed.' },
    { title: 'Retrying permanent failures', text: 'Wasted time and a delayed DLT entry for something that could never succeed.' },
    { title: 'No DLQ at all', text: 'The only options become "block forever" or "skip and lose".' },
    { title: 'An unmonitored DLQ', text: 'Silent data loss that accumulates for weeks.' },
    { title: 'Short DLQ retention', text: 'The evidence expires before you find the bug.' },
    { title: 'Losing the original headers', text: 'You cannot tell which topic, partition or offset it came from.' },
    { title: 'No replay path', text: 'Every dead letter becomes permanent data loss.' },
    { title: 'Ignoring the ordering loss from retry topics', text: 'Acceptable for tasks; wrong for entity state transitions.' },
    { title: 'Alerting on total lag only', text: 'One stuck partition hides inside an aggregate for a long time.' },
  ],

  cheatsheet: [
    { label: 'Kafka failure mode', value: 'one message blocks a partition' },
    { label: 'Best alert', value: 'max lag BY PARTITION' },
    { label: 'Transient', value: 'retry with backoff' },
    { label: 'Permanent', value: 'straight to the DLQ' },
    { label: 'Spring', value: '@RetryableTopic + @DltHandler' },
    { label: 'Always set', value: 'exclude / addNotRetryableExceptions' },
    { label: 'Deserialization errors', value: 'ErrorHandlingDeserializer' },
    { label: 'Retry ladder cost', value: 'loses per-key ordering' },
    { label: 'DLT must have', value: 'alerts + dashboard + replay' },
    { label: 'DLT retention', value: 'longer than the main topic' },
    { label: 'Preserve', value: 'original topic/partition/offset headers' },
    { label: 'Replay order', value: 'fix first, then replay' },
    { label: 'Replay produces', value: 'duplicates — that is fine' },
  ],

  problems: [
    { name: 'Block a partition with one bad message', difficulty: 'Easy', pattern: 'Poison messages', insight: 'Throw unconditionally for one payload. Watch that partition stop while the others continue, and see how invisible it is in aggregate lag.' },
    { name: 'Alert on per-partition lag', difficulty: 'Medium', pattern: 'Monitoring', insight: 'Chart max lag by partition and confirm it spots the block within a minute, unlike the total.' },
    { name: 'Add retry topics', difficulty: 'Medium', pattern: 'Retry ladder', insight: 'Use @RetryableTopic, confirm the generated topics exist, and watch the failing message move through them while the main partition flows.' },
    { name: 'Retry a permanent failure', difficulty: 'Medium', pattern: 'Classification', insight: 'Send malformed JSON with no exclude list. Time how long it spends on the ladder before reaching the DLT.' },
    { name: 'Exclude it', difficulty: 'Medium', pattern: 'Classification', insight: 'Add the exception to exclude and confirm it reaches the DLT on the first attempt.' },
    { name: 'Catch a deserialization error', difficulty: 'Hard', pattern: 'Deserialization', insight: 'Without ErrorHandlingDeserializer the consumer cannot even start the handler. Add it and the failure becomes routable.' },
    { name: 'Show the ordering loss', difficulty: 'Hard', pattern: 'Trade-offs', insight: 'Two events for one key; fail the first. The second is processed while the first is on the retry ladder. Decide whether that is acceptable.' },
    { name: 'Inspect DLT headers', difficulty: 'Medium', pattern: 'Diagnostics', insight: 'Read the original topic, partition, offset and exception message from a dead-lettered record.' },
    { name: 'Build a replay tool', difficulty: 'Hard', pattern: 'Recovery', insight: 'Consume the DLT and republish to the original topic. Fix the bug first, then replay, and verify idempotency handles the duplicates.' },
    { name: 'Expire the evidence', difficulty: 'Medium', pattern: 'Retention', insight: 'Set a one-hour DLT retention, dead-letter a message, wait, and discover you can no longer replay it.' },
  ],
}
