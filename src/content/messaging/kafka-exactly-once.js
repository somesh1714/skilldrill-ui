export default {
  id: 'kafka-exactly-once',
  title: 'Transactions & Exactly-Once Semantics',
  short: 'Exactly-Once',
  icon: 'LockRounded',
  tier: 'Core',
  order: 10,
  estHours: 5,
  prereqs: ['kafka-producer', 'kafka-consumer'],
  tagline: 'Real, powerful, and narrower than the marketing suggests.',
  mentalModel:
    'Kafka transactions make **consume → process → produce** atomic, as long as every side of it is Kafka. The offset commit and the output messages land in one atomic unit. The moment a side effect is a database row, an HTTP call or an email, you are outside the boundary and back to at-least-once.',
  whyItMatters:
    'Exactly-once is the most misunderstood feature in Kafka. Teams enable it, assume their database writes are now safe, and are surprised by duplicates. Knowing precisely what it covers — and what it does not — is what the interview question is really testing.',

  reference: {
    title: 'What is and is not covered',
    head: ['Pipeline', 'Exactly-once?', 'Why'],
    rows: [
      ['Kafka → process → Kafka', '**Yes**', 'Offsets and output in one transaction'],
      ['Kafka → process → database', 'No', 'Two systems, no shared commit'],
      ['Kafka → process → HTTP call', 'No', 'You cannot roll back someone else’s system'],
      ['Kafka → process → email', 'No', 'Definitely not'],
      ['Database → Kafka', 'No', 'Use the outbox pattern'],
      ['Kafka Streams end to end', '**Yes**', 'Built on the same transactions'],
    ],
  },

  sections: [
    {
      id: 'the-problem',
      title: 'The problem transactions solve',
      blocks: [
        {
          t: 'ascii',
          caption: 'A stream processor: read, transform, write, commit. Four things that must agree.',
          code: `
  topic "orders"                                    topic "enriched-orders"
       │                                                     ▲
       │ 1. consume offset 100                               │
       ▼                                                     │
  ┌─────────────────────────────────────────────────────┐    │
  │  enrich the order with customer data                │    │
  │                                    3. produce ──────┼────┘
  │                                                     │
  │  4. commit offset 101                               │
  └─────────────────────────────────────────────────────┘

  Crash between 3 and 4:
      the enriched message was written, the offset was not
      → reprocess offset 100 → a SECOND enriched message

  Crash between 4 and 3:
      the offset advanced, the output was never written
      → the enriched message is lost forever

  A Kafka transaction makes 3 and 4 one atomic unit: either both
  happen or neither does.`,
        },
        {
          t: 'key',
          title: 'The offset commit is itself a Kafka write',
          text: 'This is the insight that makes it possible. Committed offsets live in the `__consumer_offsets` topic — they are ordinary Kafka messages. So "produce the output" and "commit the offset" are both writes to Kafka, and Kafka can make two of its own writes atomic. That is the entire trick, and it is also exactly why a database write cannot join in.',
        },
      ],
    },
    {
      id: 'how',
      title: 'How a transaction works',
      blocks: [
        {
          t: 'ascii',
          caption: 'The transaction coordinator and the two-phase commit.',
          code: `
  PRODUCER                  COORDINATOR              PARTITIONS
     │                           │                        │
     │─ initTransactions() ─────▶│  assigns a PID and
     │                           │  fences older sessions
     │                           │  with the same
     │                           │  transactional.id
     │
     │─ beginTransaction() ──────│
     │
     │─ send(enriched) ──────────┼───────────────────────▶│ written, but
     │                           │                        │ marked UNCOMMITTED
     │
     │─ sendOffsetsToTransaction ┼───────────────────────▶│ __consumer_offsets
     │      (offset 101, group)  │                        │ also uncommitted
     │
     │─ commitTransaction() ────▶│
     │                           │ 1. write PREPARE_COMMIT
     │                           │ 2. write a COMMIT MARKER
     │                           │    into every touched partition ──▶│
     │                           │ 3. write COMPLETE_COMMIT
     │◀── done ──────────────────│

  A consumer with isolation.level=read_committed only returns records
  once it has seen the commit marker for them. Aborted records are
  filtered out and never delivered.`,
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'The full pattern, by hand',
          code: `
props.put(ProducerConfig.TRANSACTIONAL_ID_CONFIG, "enricher-" + instanceId);
props.put(ProducerConfig.ENABLE_IDEMPOTENCE_CONFIG, true);

consumerProps.put(ConsumerConfig.ISOLATION_LEVEL_CONFIG, "read_committed");
consumerProps.put(ConsumerConfig.ENABLE_AUTO_COMMIT_CONFIG, false);  // required

producer.initTransactions();                       // once, at startup

while (running) {
    var records = consumer.poll(Duration.ofMillis(100));
    if (records.isEmpty()) continue;

    producer.beginTransaction();
    try {
        for (var record : records) {
            producer.send(new ProducerRecord<>("enriched-orders",
                    record.key(), enrich(record.value())));
        }

        // The offsets join the SAME transaction — this is the key call
        producer.sendOffsetsToTransaction(
                offsetsFrom(records), consumer.groupMetadata());

        producer.commitTransaction();               // atomic: output + offsets
    } catch (ProducerFencedException | OutOfOrderSequenceException e) {
        producer.close();                           // another instance took over
        throw e;
    } catch (KafkaException e) {
        producer.abortTransaction();                // nothing is visible
    }
}`,
        },
        {
          t: 'key',
          title: 'transactional.id must be stable and unique per instance',
          text: 'It is how Kafka **fences** a zombie. If an old instance hangs and a new one starts with the same `transactional.id`, the coordinator bumps an epoch and the old producer gets `ProducerFencedException` on its next write — it cannot corrupt anything. A random id per start defeats fencing entirely; a shared id across instances makes them fence each other in a loop.',
        },
      ],
    },
    {
      id: 'read-committed',
      title: 'read_committed and what it costs',
      blocks: [
        {
          t: 'ascii',
          caption: 'The Last Stable Offset is why transactions add latency.',
          code: `
  partition, with two transactions in flight

  ┌────┬────┬────┬────┬────┬────┬────┬────┐
  │ 40 │ 41 │ 42 │ 43 │ 44 │ 45 │ 46 │ 47 │
  │ T1 │ T1 │ ✔C │ T2 │ T2 │ T2 │    │    │
  └────┴────┴────┴────┴────┴────┴────┴────┘
                 ▲                       ▲
           commit marker for T1    log end offset
                 │
           LAST STABLE OFFSET = 43

  read_uncommitted: sees 40..46 immediately, including T2's
                    records that may yet be ABORTED
  read_committed:   sees only 40,41 (T1, committed).
                    43-45 are INVISIBLE until T2 commits or aborts.

  So a long-running transaction blocks read_committed consumers on that
  partition — not just for its own records, but for everything after it.`,
        },
        {
          t: 'warn',
          title: 'Keep transactions short',
          text: 'An open transaction holds back the last stable offset, so every downstream `read_committed` consumer stalls behind it. `transaction.timeout.ms` (default 60s) is the hard limit — exceed it and the coordinator aborts your transaction for you. Batch a poll’s worth of records, not a minute’s worth of work.',
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'The costs, stated honestly',
          code: `
// Throughput:  typically 3-20% lower. Extra coordinator round trips,
//              commit markers written into every touched partition.
// Latency:     read_committed consumers wait for the commit marker,
//              so end-to-end latency rises by roughly the transaction
//              duration.
// Complexity:  transactional.id management, fencing, zombie handling,
//              and a whole new class of exception to handle.
// Scope:       Kafka-to-Kafka only.

// So use it when the pipeline really is Kafka→Kafka and duplicates are
// expensive. For everything else, at-least-once plus an idempotent
// consumer is simpler, faster and covers more ground.`,
        },
      ],
    },
    {
      id: 'streams',
      title: 'The easy way: let Kafka Streams do it',
      blocks: [
        { t: 'p', text: 'Almost nobody should write the transactional loop by hand. Kafka Streams implements exactly this — transactions, offsets, state store changelogs and fencing — behind one configuration property.' },
        {
          t: 'code',
          lang: 'java',
          caption: 'One line replaces the whole pattern',
          code: `
Properties props = new Properties();
props.put(StreamsConfig.APPLICATION_ID_CONFIG, "order-enricher");
props.put(StreamsConfig.PROCESSING_GUARANTEE_CONFIG,
          StreamsConfig.EXACTLY_ONCE_V2);          // that is it

StreamsBuilder builder = new StreamsBuilder();
builder.stream("orders", Consumed.with(Serdes.String(), orderSerde))
       .mapValues(this::enrich)
       .to("enriched-orders");

// Streams now guarantees, atomically:
//   • the output records
//   • the consumed offsets
//   • any state store updates (via their changelog topics)
// all commit together, or none of them do.`,
        },
        {
          t: 'key',
          title: '`exactly_once_v2` is strictly better than the original',
          text: 'The first implementation used one producer per input partition, which did not scale. `exactly_once_v2` (Kafka 2.5+) uses a single producer per instance with the consumer group as the fencing mechanism. It is faster, uses far fewer resources, and is what you should use. The older `exactly_once` value is deprecated.',
        },
        {
          t: 'ascii',
          caption: 'Where the boundary really sits, in a realistic pipeline.',
          code: `
   ┌──────────────── EXACTLY-ONCE ZONE ────────────────┐
   │                                                   │
   │  orders ──▶ Streams app ──▶ enriched ──▶ Streams  │
   │             (state store)                 app     │
   │                                            │      │
   └────────────────────────────────────────────┼──────┘
                                                │
                                                ▼
                                    ┌────────────────────────┐
                                    │  sink connector /      │  ◀── AT LEAST ONCE
                                    │  your consumer writing │      from here on
                                    │  to Postgres, S3, an   │
                                    │  API, an email…        │
                                    └────────────────────────┘
                                          needs idempotency

  The guarantee ends the moment data leaves Kafka.`,
        },
      ],
    },
  ],

  patterns: [
    {
      id: 'eos-for-streams',
      name: 'Exactly-Once for Kafka-to-Kafka Pipelines',
      oneLiner: 'Enable it where it applies; do not pretend it covers the rest.',
      useWhen: ['Stream processing whose input and output are both Kafka.', 'Aggregations where a duplicate corrupts the result.'],
      recognize: ['Counts that drift after a rebalance.', 'Duplicate enriched records downstream.'],
      steps: [
        'Use Kafka Streams with `EXACTLY_ONCE_V2` rather than a hand-written loop.',
        'Set downstream consumers to `read_committed`.',
        'Keep the commit interval modest so latency stays acceptable.',
      ],
      complexity: 'Roughly 3–20% throughput cost and added end-to-end latency.',
      gotchas: [
        'Downstream consumers at `read_uncommitted` (the default) see aborted records — the guarantee needs both halves.',
        'It does not extend to any external system.',
      ],
      problems: ['Duplicate a count without EOS', 'Enable EOS and confirm it stops'],
    },
    {
      id: 'stable-transactional-id',
      name: 'Stable transactional.id per Instance',
      oneLiner: 'Fencing only works if the id survives a restart.',
      useWhen: ['Writing a transactional producer by hand.'],
      recognize: ['`transactional.id` built from a UUID or a timestamp.', 'Zombie instances still writing after being replaced.'],
      steps: [
        'Derive the id from a stable identity — the pod ordinal in a StatefulSet, or the assigned partition.',
        'One id per concurrent producer, never shared.',
        'Treat `ProducerFencedException` as fatal: close and exit.',
      ],
      template: {
        lang: 'java',
        caption: 'A StatefulSet ordinal gives you stability for free',
        code: `
// pod name: enricher-0, enricher-1, ...  → stable across restarts
String txId = "enricher-" + System.getenv("POD_NAME");
props.put(ProducerConfig.TRANSACTIONAL_ID_CONFIG, txId);

// Fenced means another producer with this id took over. Do not retry.
catch (ProducerFencedException e) {
    log.error("Fenced — another instance owns {}", txId);
    producer.close();
    System.exit(1);          // let the orchestrator restart us cleanly
}`,
      },
      complexity: 'Configuration, plus one exception path.',
      gotchas: [
        'A random id per start means an old hung instance is never fenced and can keep writing.',
        'A shared id across instances makes them fence each other repeatedly.',
      ],
      problems: ['Fence a zombie producer', 'Break fencing with a random id'],
    },
    {
      id: 'idempotent-at-the-edge',
      name: 'Idempotency Where the Guarantee Ends',
      oneLiner: 'The last Kafka hop is exactly-once; the sink is not.',
      useWhen: ['Any consumer writing to a database, an API or a file.'],
      recognize: ['A team believing EOS protects their database writes.'],
      steps: [
        'Identify precisely where data leaves Kafka.',
        'From that point on, apply de-duplication or upserts.',
        'Document the boundary so nobody assumes otherwise.',
      ],
      template: {
        lang: 'java',
        caption: 'The sink must defend itself',
        code: `
// Inside Kafka: exactly-once, handled by Streams.
// Leaving Kafka: at-least-once. This consumer must be idempotent.
@KafkaListener(topics = "enriched-orders", groupId = "warehouse-sink")
@Transactional
public void sink(EnrichedOrder order, Acknowledgment ack) {
    repo.upsert(order);          // idempotent by construction
    ack.acknowledge();
}`,
      },
      complexity: 'The usual de-duplication cost, at one clearly defined place.',
      gotchas: [
        'Kafka Connect sink connectors vary — check whether yours is genuinely idempotent.',
        '"We use exactly-once" is not an answer to "how do you handle duplicates in the database?".',
      ],
      problems: ['Duplicate a database row despite EOS', 'Make the sink idempotent'],
    },
  ],

  pitfalls: [
    { title: 'Believing EOS covers database writes', text: 'It covers Kafka writes and offsets. Nothing else.' },
    { title: 'Downstream consumers left at read_uncommitted', text: 'They see records from transactions that later abort.' },
    { title: 'Random transactional.id', text: 'Fencing stops working and zombies can keep producing.' },
    { title: 'Sharing a transactional.id across instances', text: 'They fence each other in a loop and nothing progresses.' },
    { title: 'Long-running transactions', text: 'They hold back the last stable offset and stall every read_committed consumer on that partition.' },
    { title: 'Auto-commit with transactions', text: 'Incompatible — offsets must go through sendOffsetsToTransaction.' },
    { title: 'Retrying after ProducerFencedException', text: 'It is fatal. Close and let the process restart.' },
    { title: 'Using `exactly_once` instead of `exactly_once_v2`', text: 'The original is deprecated and far more resource-hungry.' },
    { title: 'Enabling EOS to avoid writing idempotent consumers', text: 'It does not remove that requirement outside Kafka.' },
  ],

  cheatsheet: [
    { label: 'Scope', value: 'Kafka → Kafka only' },
    { label: 'Makes atomic', value: 'output records + offset commit' },
    { label: 'Why possible', value: 'offsets are Kafka writes too' },
    { label: 'Producer needs', value: 'transactional.id' },
    { label: 'Consumer needs', value: 'isolation.level=read_committed' },
    { label: 'Auto-commit', value: 'must be off' },
    { label: 'Offsets join via', value: 'sendOffsetsToTransaction' },
    { label: 'Zombie defence', value: 'fencing by transactional.id epoch' },
    { label: 'ProducerFenced', value: 'fatal — close and exit' },
    { label: 'Read blocking', value: 'last stable offset' },
    { label: 'Timeout', value: 'transaction.timeout.ms (60s)' },
    { label: 'Easy path', value: 'Streams EXACTLY_ONCE_V2' },
    { label: 'Cost', value: '~3-20% throughput, more latency' },
    { label: 'Outside Kafka', value: 'still at-least-once' },
  ],

  problems: [
    { name: 'Duplicate output without transactions', difficulty: 'Medium', pattern: 'The problem', insight: 'Consume, produce, then crash before committing the offset. The output topic now has the same enriched record twice.' },
    { name: 'Fix it with a transaction', difficulty: 'Medium', pattern: 'Transactions', insight: 'Wrap the produce and sendOffsetsToTransaction in one transaction, repeat the crash, and confirm exactly one output record.' },
    { name: 'See uncommitted records', difficulty: 'Medium', pattern: 'Isolation', insight: 'Consume with read_uncommitted while a transaction is open. You see records that later abort and should never have existed.' },
    { name: 'Block on the last stable offset', difficulty: 'Hard', pattern: 'Latency cost', insight: 'Open a transaction and hold it for 30 seconds. A read_committed consumer on that partition stalls completely.' },
    { name: 'Fence a zombie producer', difficulty: 'Hard', pattern: 'Fencing', insight: 'Start two producers with the same transactional.id. The older one gets ProducerFencedException on its next write.' },
    { name: 'Break fencing with a random id', difficulty: 'Hard', pattern: 'Fencing', insight: 'Use a UUID per start, simulate a hung instance, and confirm both instances happily write — the failure EOS was meant to prevent.' },
    { name: 'Enable EOS in Kafka Streams', difficulty: 'Medium', pattern: 'Streams', insight: 'Set `EXACTLY_ONCE_V2`, kill the app mid-processing repeatedly, and verify the aggregate count is exact every time.' },
    { name: 'Measure the throughput cost', difficulty: 'Hard', pattern: 'Trade-offs', insight: 'Benchmark the same pipeline with and without EOS. Record the throughput and p99 difference so you can justify the choice.' },
    { name: 'Duplicate a database row despite EOS', difficulty: 'Hard', pattern: 'Boundary', insight: 'Run EOS end to end but write to Postgres from the final consumer. Crash after the insert and before the ack — the row is duplicated.' },
    { name: 'Draw your own boundary', difficulty: 'Medium', pattern: 'Architecture', insight: 'Take a real pipeline and mark exactly where the exactly-once zone ends. Everything past that line needs idempotency.' },
  ],
}
