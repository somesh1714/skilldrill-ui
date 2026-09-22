export default {
  id: 'kafka-producer',
  title: 'The Producer in Depth',
  short: 'Producers',
  icon: 'UploadRounded',
  tier: 'Core',
  order: 7,
  estHours: 5,
  prereqs: ['kafka-architecture'],
  tagline: 'send() does not send. It puts a message in a buffer and a background thread does the rest.',
  mentalModel:
    'The producer is an **asynchronous batching machine**. Your call to `send()` appends to an in-memory buffer keyed by partition; a separate IO thread drains those buffers into network requests. Latency, throughput, ordering and durability are all just settings on that machine.',
  whyItMatters:
    'Almost every "we lost messages" incident traces back to producer configuration — fire-and-forget acks, retries disabled, or a `send()` whose failure nobody ever looked at. And almost every "Kafka is slow" complaint is a producer sending one message per request.',

  reference: {
    title: 'The settings that matter, and what each trades',
    head: ['Setting', 'Default', 'Set it to', 'Trades'],
    rows: [
      ['`acks`', '`all` (modern clients)', '`all`', 'Latency for durability'],
      ['`enable.idempotence`', '`true`', '`true`', 'Nothing — always on'],
      ['`retries`', '`Integer.MAX_VALUE`', 'leave it', 'Bounded by `delivery.timeout.ms`'],
      ['`delivery.timeout.ms`', '120000', 'Your real deadline', 'How long before you give up'],
      ['`linger.ms`', '0', '5–20', 'A little latency for much better batching'],
      ['`batch.size`', '16384', '32768–131072', 'Memory for throughput'],
      ['`compression.type`', '`none`', '`lz4` or `zstd`', 'CPU for network and disk'],
      ['`max.in.flight.requests`', '5', '≤ 5 with idempotence', 'Ordering safety'],
      ['`buffer.memory`', '33554432', 'Raise if you block', 'Memory for burst tolerance'],
    ],
  },

  sections: [
    {
      id: 'internals',
      title: 'What actually happens inside send()',
      blocks: [
        {
          t: 'ascii',
          caption: 'Your thread never touches the network.',
          code: `
  YOUR THREAD                          │  SENDER THREAD (background)
  ───────────────────────────────────  │  ──────────────────────────────
                                       │
  producer.send(record, callback)      │
      │                                │
      ├─ 1. serialize key and value    │
      ├─ 2. partitioner picks a        │
      │     partition                  │
      ├─ 3. append to the RecordAccumulator
      │        ┌──────────────────────┐│
      │        │ P0: [m][m][m]  ◀─────┼┤
      │        │ P1: [m]              ││
      │        │ P2: [m][m]           ││
      │        └──────────────────────┘│
      └─ 4. RETURN a Future immediately│
         (nothing has been sent yet)   │
                                       │  5. a batch is full (batch.size)
                                       │     OR linger.ms has elapsed
                                       │        │
                                       │  6. group batches by broker
                                       │  7. one request per broker
                                       │        │
                                       │  8. ◀── ack from the leader
                                       │        │
                                       │  9. complete the Future,
                                       │     invoke your callback
                                       │     ON THE SENDER THREAD

  Two consequences that surprise people:
   • send() returning does NOT mean the message is safe
   • your callback runs on the sender thread — blocking it stalls
     ALL production`,
        },
        {
          t: 'trap',
          title: 'The single most common bug: ignoring the result',
          text: '`producer.send(record)` with no callback and no `get()` throws nothing when the send fails. The exception is delivered to the callback you did not provide. Teams discover this when they notice messages missing and every log line says success. **Always** pass a callback, or handle the `Future`.',
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'The three ways to send, and when each is right',
          code: `
// 1. FIRE AND FORGET — failures are invisible. Almost never correct.
producer.send(record);

// 2. ASYNCHRONOUS WITH CALLBACK — the normal choice.
producer.send(record, (metadata, exception) -> {
    if (exception != null) {
        log.error("Failed to publish order {}", order.id(), exception);
        metrics.counter("publish.failed").increment();
        // The message is lost unless YOU do something here.
    } else {
        log.debug("Published to {}-{} at offset {}",
                  metadata.topic(), metadata.partition(), metadata.offset());
    }
});

// 3. SYNCHRONOUS — blocks until acked. Use when you must not proceed
//    without knowing, e.g. inside a transaction you may need to roll back.
try {
    RecordMetadata md = producer.send(record).get(5, TimeUnit.SECONDS);
} catch (ExecutionException e) {
    throw new PublishFailedException("Could not publish order " + id, e.getCause());
}
// Cost: this serialises production. Throughput drops enormously.`,
        },
        {
          t: 'warn',
          title: 'Never block inside the callback',
          text: 'The callback runs on the single sender thread. A database write or an HTTP call there stops every partition’s production for the whole client. Do the minimum — log, increment a counter, hand off to an executor.',
        },
      ],
    },
    {
      id: 'batching',
      title: 'Batching: where the throughput comes from',
      blocks: [
        {
          t: 'ascii',
          caption: 'linger.ms = 0 versus linger.ms = 10, same 1000 messages.',
          code: `
  linger.ms = 0  (send as soon as possible)
   msg ──▶ request  ──▶ broker      1000 messages
   msg ──▶ request  ──▶ broker      ≈ 1000 network round trips
   msg ──▶ request  ──▶ broker      high latency per message? no.
   ...                              high CPU and network overhead? YES.

  linger.ms = 10  (wait up to 10ms to fill a batch)
   msg ┐
   msg ├──▶ [ batch of 200 ] ──▶ request ──▶ broker
   msg ┘                          1000 messages
   ...                            ≈ 5 network round trips
                                  +10ms worst-case latency
                                  compression works far better on a batch

  A batch is sent when EITHER:
     • it reaches batch.size bytes, OR
     • linger.ms has elapsed since the first message in it`,
        },
        {
          t: 'key',
          title: 'linger.ms = 0 is not "fast"',
          text: 'It minimises latency for a single message and wrecks throughput for many. Under load, a tiny linger actually *reduces* latency, because fewer, larger requests queue less. Setting it to 5–20ms is one of the highest-value single changes you can make to a busy producer.',
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'Compression is applied per batch, and it matters',
          code: `
props.put(ProducerConfig.COMPRESSION_TYPE_CONFIG, "lz4");
props.put(ProducerConfig.LINGER_MS_CONFIG, 10);
props.put(ProducerConfig.BATCH_SIZE_CONFIG, 65536);     // 64KB

// JSON with repeated field names compresses extremely well —
// 3-5x is typical. The broker stores it compressed and ships it
// compressed, so you save network AND disk AND consumer bandwidth.
//
//   none   — no CPU cost, largest payloads
//   lz4    — fast, good ratio. The usual default.
//   snappy — similar to lz4
//   zstd   — best ratio, more CPU. Good when network is the constraint.
//   gzip   — high CPU, rarely the right choice today`,
        },
        {
          t: 'tip',
          title: 'Compression only works if batches are big enough',
          text: 'Compressing a single small message saves nothing and costs CPU. With `linger.ms = 0` you are compressing one message at a time. Compression and batching are one decision, not two.',
        },
      ],
    },
    {
      id: 'idempotent-producer',
      title: 'The idempotent producer',
      blocks: [
        { t: 'p', text: 'Retries create duplicates. A producer sends a batch, the broker writes it, the acknowledgement is lost in the network, and the producer retries the same batch — which the broker writes again. The idempotent producer removes exactly this.' },
        {
          t: 'ascii',
          caption: 'How the broker recognises a retry.',
          code: `
  Producer gets a PID (producer id) and a sequence number per partition.

  PRODUCER                                  BROKER (partition 0)
     │                                         │  last seen seq for PID=7: 40
     │── PID=7 seq=41 [batch] ────────────────▶│
     │                                         │  41 == 40+1  ✔ append
     │                    ✘ ack lost in network│  last seen: 41
     │                                         │
     │── PID=7 seq=41 [batch] (retry) ────────▶│
     │                                         │  41 <= 41  ✘ DUPLICATE
     │◀── ack (the original offset) ───────────│  do not append; ack anyway
     │
  Result: exactly one copy on the broker, and the producer is satisfied.

  Also gives you ordering: a batch with seq 43 arriving before 42 is
  rejected, so retries cannot reorder messages within a partition.`,
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'It is on by default in modern clients — do not turn it off',
          code: `
props.put(ProducerConfig.ENABLE_IDEMPOTENCE_CONFIG, true);

// Enabling it forces these, and the client will refuse conflicting values:
//   acks                                   = all
//   retries                                > 0
//   max.in.flight.requests.per.connection  <= 5

// Why in-flight must be bounded: with 6+ concurrent requests the broker
// cannot maintain the sequence window, so a retry could be reordered.`,
        },
        {
          t: 'warn',
          title: 'What it does NOT solve',
          text: 'Idempotence is **per producer session, per partition**. If your application restarts, it gets a new producer id and the broker cannot tell that the resent message is the same one. It also does nothing about your *application* publishing the same logical event twice. That is what the outbox pattern and consumer-side de-duplication are for.',
        },
      ],
    },
    {
      id: 'partitioning',
      title: 'Partitioning strategy and hot keys',
      blocks: [
        {
          t: 'code',
          lang: 'java',
          caption: 'How the partition is chosen, and when to override it',
          code: `
// Default behaviour:
//   key != null  →  murmur2(key) % numPartitions     deterministic
//   key == null  →  "sticky" — fill one batch, then switch partitions
//                   (better batching than round-robin, still no ordering)

// A custom partitioner, for when hashing is not what you want
public class TenantPartitioner implements Partitioner {
    @Override
    public int partition(String topic, Object key, byte[] keyBytes,
                         Object value, byte[] valueBytes, Cluster cluster) {
        int n = cluster.partitionCountForTopic(topic);
        String tenant = ((String) key).split(":")[0];

        // Give the biggest tenant its own dedicated partitions
        if (tenant.equals("enterprise-1")) return Math.abs(key.hashCode()) % 4;
        return 4 + Math.abs(tenant.hashCode()) % (n - 4);
    }
}`,
        },
        {
          t: 'ascii',
          caption: 'A hot key is the most common Kafka performance problem.',
          code: `
  Keys: one customer generates 60% of all events.

   partition 0  ████████████████████████████  lag: 240,000   ← "enterprise-1"
   partition 1  ███                           lag: 400
   partition 2  ██                            lag: 250
   partition 3  ███                           lag: 380

  Adding consumers does NOT help. Partition 0 has exactly one
  consumer, by definition, and that is the ceiling.

  Options:
   • change the key to spread that tenant:  "enterprise-1:" + orderId
     (you lose per-tenant ordering; keep per-order ordering)
   • give the hot tenant its own topic
   • custom partitioner with dedicated partitions, as above`,
        },
        {
          t: 'key',
          title: 'Check your key distribution before you go live',
          text: 'Ordering per key is only useful if the keys are reasonably balanced. Measure the per-partition message rate in a load test. A single dominant key turns a twelve-partition topic into a one-partition topic with eleven idle consumers.',
        },
      ],
    },
  ],

  patterns: [
    {
      id: 'always-handle-the-result',
      name: 'Never Fire and Forget',
      oneLiner: 'A send whose failure nobody observes is a message you have silently lost.',
      useWhen: ['Every producer call.'],
      recognize: ['`producer.send(record);` on a line by itself.', 'Missing messages with no errors in the logs.'],
      steps: [
        'Pass a callback that logs and counts failures.',
        'Decide what a failure means — retry, outbox, alert.',
        'Keep the callback non-blocking.',
      ],
      template: {
        lang: 'java',
        caption: 'Spring wraps it in a CompletableFuture, with the same obligation',
        code: `
kafkaTemplate.send("orders", order.id().toString(), event)
    .whenComplete((result, ex) -> {
        if (ex != null) {
            log.error("Publish failed for order {}", order.id(), ex);
            failedPublishes.increment();
            outbox.markForRetry(order.id());      // do something about it
        }
    });`,
      },
      complexity: 'One lambda; turns silent loss into a visible failure.',
      gotchas: [
        'Do not block in the callback — it runs on the sender thread.',
        'A callback is not durability. If the process dies before the retry, the message is still gone. That is why the outbox exists.',
      ],
      problems: ['Lose messages with fire-and-forget', 'Add a callback and count the failures'],
    },
    {
      id: 'tune-for-throughput',
      name: 'Batch, Linger, Compress',
      oneLiner: 'Three settings that routinely give an order of magnitude.',
      useWhen: ['Any high-volume producer.'],
      recognize: ['`linger.ms = 0` with compression enabled.', 'Network saturated by small requests.'],
      steps: [
        'Set `linger.ms` to 5–20.',
        'Raise `batch.size` to 32–128KB.',
        'Enable `lz4` or `zstd`.',
        'Measure throughput and p99 before and after.',
      ],
      complexity: 'A few milliseconds of added latency for a large throughput gain.',
      gotchas: [
        'If `buffer.memory` fills, `send()` **blocks** for up to `max.block.ms` — your producing thread stalls. Monitor `buffer-available-bytes`.',
        'Compression on tiny batches is pure cost.',
      ],
      problems: ['Benchmark linger 0 vs 10', 'Fill the buffer and watch send() block'],
    },
    {
      id: 'spread-hot-keys',
      name: 'Detect and Spread Hot Keys',
      oneLiner: 'One dominant key turns your partition count into 1.',
      useWhen: ['Multi-tenant systems, or any key space with a power-law distribution.'],
      recognize: ['Lag concentrated on one partition.', 'Adding consumers changing nothing.'],
      steps: [
        'Chart lag and message rate per partition.',
        'Identify whether one key dominates.',
        'Sub-key it, or give it dedicated partitions, accepting the ordering change.',
      ],
      template: {
        lang: 'java',
        caption: 'Trade coarse ordering for parallelism, deliberately',
        code: `
// Before: per-tenant ordering, one partition for the big tenant
String key = tenantId;

// After: per-ORDER ordering, spread across partitions.
// Only valid if nothing needs tenant-wide ordering — check first.
String key = tenantId + ":" + orderId;`,
      },
      complexity: 'Restores parallelism; narrows the ordering guarantee.',
      gotchas: [
        'Confirm nothing depends on the ordering you are giving up.',
        'Changing the key strategy means old and new messages are keyed differently during the transition.',
      ],
      problems: ['Create a hot partition', 'Spread it and measure the change'],
    },
  ],

  pitfalls: [
    { title: 'send() with no callback', text: 'Failures are invisible and messages are lost silently.' },
    { title: 'Blocking inside the callback', text: 'The sender thread stalls and all production stops.' },
    { title: 'Calling get() on every send', text: 'Correct but serialises production. Throughput collapses.' },
    { title: 'linger.ms = 0 with compression', text: 'Compressing one message at a time — all cost, no benefit.' },
    { title: 'Disabling idempotence', text: 'A lost acknowledgement becomes a duplicate on the broker.' },
    { title: 'max.in.flight above 5 with retries', text: 'Retries can reorder messages within a partition.' },
    { title: 'Not monitoring buffer.memory', text: 'When it fills, send() blocks and your request threads stall.' },
    { title: 'Ignoring key distribution', text: 'A hot key silently caps your throughput at one partition.' },
    { title: 'Creating a producer per message', text: 'It is thread-safe and expensive to construct. Create one and share it.' },
  ],

  cheatsheet: [
    { label: 'send() is', value: 'asynchronous — buffers, does not send' },
    { label: 'Failure arrives in', value: 'the callback' },
    { label: 'Callback runs on', value: 'the sender thread — never block' },
    { label: 'Batch sent when', value: 'batch.size full OR linger.ms elapsed' },
    { label: 'Throughput trio', value: 'linger + batch.size + compression' },
    { label: 'Good default', value: 'linger 10ms, batch 64KB, lz4' },
    { label: 'Durability', value: 'acks=all + min.insync.replicas=2' },
    { label: 'Idempotence', value: 'on by default — keep it' },
    { label: 'Gives', value: 'no duplicates on retry, order preserved' },
    { label: 'Scope', value: 'per session, per partition' },
    { label: 'max.in.flight', value: '≤ 5 with idempotence' },
    { label: 'Buffer full', value: 'send() blocks up to max.block.ms' },
    { label: 'Producer object', value: 'thread-safe — share one' },
    { label: 'Hot key', value: 'caps you at one partition' },
  ],

  problems: [
    { name: 'Lose messages with fire-and-forget', difficulty: 'Easy', pattern: 'Error handling', insight: 'Stop the broker, send 100 messages with no callback, and confirm the application logs nothing. Add a callback and the failures appear.' },
    { name: 'Compare the three send styles', difficulty: 'Easy', pattern: 'Async', insight: 'Benchmark fire-and-forget, callback and get() for 100,000 messages. The synchronous version is dramatically slower.' },
    { name: 'Benchmark linger.ms', difficulty: 'Medium', pattern: 'Batching', insight: 'Send 1M messages with linger 0, 5 and 50. Chart throughput and p99 latency. Note that under load linger 5 can beat linger 0 on both.' },
    { name: 'Measure compression', difficulty: 'Medium', pattern: 'Compression', insight: 'Produce identical JSON with none, lz4 and zstd. Compare on-disk segment size and producer CPU.' },
    { name: 'Compress with no batching', difficulty: 'Medium', pattern: 'Interaction', insight: 'Enable compression with linger.ms=0 and measure the ratio. It is close to nothing — compression needs batches.' },
    { name: 'Fill the producer buffer', difficulty: 'Hard', pattern: 'Backpressure', insight: 'Slow the broker, produce hard, and watch send() block for max.block.ms. Chart buffer-available-bytes as it drains.' },
    { name: 'Create a duplicate with idempotence off', difficulty: 'Hard', pattern: 'Idempotent producer', insight: 'Disable idempotence, force a retry by dropping the ack, and find the same message twice in the log.' },
    { name: 'Reorder with too many in-flight requests', difficulty: 'Hard', pattern: 'Ordering', insight: 'Disable idempotence, set max.in.flight to 10, force a retry on the first batch, and observe messages out of order in the partition.' },
    { name: 'Create a hot partition', difficulty: 'Medium', pattern: 'Partitioning', insight: 'Send 80% of messages with one key. Chart per-partition lag and confirm adding consumers does not help.' },
    { name: 'Write a custom partitioner', difficulty: 'Hard', pattern: 'Partitioning', insight: 'Give one tenant dedicated partitions and verify the spread with a per-partition count.' },
  ],
}
