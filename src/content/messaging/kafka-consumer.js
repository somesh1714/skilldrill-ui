export default {
  id: 'kafka-consumer',
  title: 'Consumers, Groups & Rebalancing',
  short: 'Consumers',
  icon: 'DownloadRounded',
  tier: 'Core',
  order: 8,
  estHours: 6,
  prereqs: ['kafka-architecture'],
  tagline: 'The poll loop is a heartbeat. Miss it and the broker decides you are dead.',
  mentalModel:
    'A consumer is a loop that asks for messages, processes them, and asks again. Calling `poll()` does two jobs at once: it fetches data **and** tells the group coordinator you are alive. Almost every consumer problem is a poll that did not come back in time.',
  whyItMatters:
    'Rebalances cause duplicates, pauses and — in the worst case — two consumers processing the same partition simultaneously. Understanding when they fire and how to avoid them is the difference between a stable pipeline and one that mysteriously reprocesses work every afternoon.',

  reference: {
    title: 'The timeouts that govern a consumer',
    head: ['Setting', 'Default', 'Meaning', 'Fails when'],
    rows: [
      ['`max.poll.interval.ms`', '300000 (5 min)', 'Maximum time **between** poll calls', 'Your handler is too slow'],
      ['`session.timeout.ms`', '45000', 'Time without a heartbeat before eviction', 'The process is hung or GC-stalled'],
      ['`heartbeat.interval.ms`', '3000', 'How often the background thread pings', 'Should be ~⅓ of session timeout'],
      ['`max.poll.records`', '500', 'Messages returned per poll', 'A big batch makes the interval too slow'],
      ['`fetch.min.bytes`', '1', 'Wait for this much data', 'Raise it to batch more'],
      ['`fetch.max.wait.ms`', '500', 'How long to wait for `fetch.min.bytes`', 'Latency versus efficiency'],
      ['`auto.offset.reset`', '`latest`', 'Where a brand-new group starts', '`earliest` replays everything'],
    ],
  },

  sections: [
    {
      id: 'poll-loop',
      title: 'The poll loop, and the two clocks',
      blocks: [
        {
          t: 'ascii',
          caption: 'Two independent liveness checks, and they fail for different reasons.',
          code: `
  YOUR THREAD                        HEARTBEAT THREAD (background)
  ─────────────────────────────      ──────────────────────────────
  while (true) {                     every heartbeat.interval.ms (3s):
      records = poll(Duration)  ───▶      send a heartbeat
      │                                   │
      │  ← resets the                     │ ← resets the
      │    max.poll.interval clock        │   session.timeout clock
      │
      process(records)   ← if this takes longer than
      │                    max.poll.interval.ms (5 min),
      │                    the broker evicts you EVEN THOUGH
      │                    heartbeats are still arriving
      commitSync()
  }

  So there are two distinct failure modes:
    • process too slowly  → max.poll.interval exceeded → evicted
    • process hangs / long GC → heartbeats stop → session timeout → evicted

  The first is far more common and much more confusing, because the
  consumer looks perfectly healthy from the outside.`,
        },
        {
          t: 'key',
          title: 'The dangerous part of a poll-interval eviction',
          text: 'Your consumer does not know it has been evicted until its **next** poll. So between the broker reassigning the partition and your handler finishing, **two consumers are processing the same messages at the same time**. If the work is not idempotent, that is a double charge — and it is triggered by nothing more exotic than a slow afternoon.',
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'Two ways to stay inside the interval',
          code: `
// OPTION 1 — process fewer messages per poll
props.put(ConsumerConfig.MAX_POLL_RECORDS_CONFIG, 50);   // default 500
// 50 records × 200ms each = 10s per loop. Comfortably inside 5 minutes.

// OPTION 2 — raise the interval, if the work really is slow
props.put(ConsumerConfig.MAX_POLL_INTERVAL_MS_CONFIG, 600_000);  // 10 min
// But now a genuinely dead consumer takes 10 minutes to be detected.

// OPTION 3 — pause, hand off, resume. Keeps polling on time.
records = consumer.poll(Duration.ofMillis(100));
consumer.pause(consumer.assignment());          // stop fetching more
executor.submit(() -> processSlowly(records));  // work elsewhere
// ... poll() still called on schedule, returning nothing ...
consumer.resume(consumer.assignment());         // when the work is done
// Note: you must manage offsets yourself with this pattern.`,
        },
      ],
    },
    {
      id: 'rebalance',
      title: 'Rebalancing, step by step',
      blocks: [
        { t: 'p', text: 'A rebalance redistributes partitions among group members. It is triggered by a member joining, leaving, dying, or being evicted — and also by a topic gaining partitions.' },
        {
          t: 'ascii',
          caption: 'Eager rebalancing (the old default): everybody stops.',
          code: `
  t=0    group: A→[p0,p1]  B→[p2,p3]     both consuming happily

  t=10s  consumer C joins the group

  t=10s  ┌─────────────────────────────────────────────┐
         │  STOP THE WORLD                             │
         │  A revokes p0, p1    B revokes p2, p3       │
         │  NOBODY IS CONSUMING ANYTHING               │
         └─────────────────────────────────────────────┘

  t=11s  coordinator computes the new assignment
         A→[p0,p1]   B→[p2]   C→[p3]

  t=11s  everyone resumes, from the last COMMITTED offset
         ← anything processed but not committed is redelivered

  Cost: a full pause for every group member, on every deploy.
  With a rolling deploy of 6 pods, that is 6 pauses.`,
        },
        {
          t: 'ascii',
          caption: 'Cooperative rebalancing (modern default): only what must move, moves.',
          code: `
  t=0    group: A→[p0,p1]  B→[p2,p3]

  t=10s  consumer C joins

  t=10s  round 1: only B revokes p3.  A KEEPS CONSUMING p0,p1.
                                       B KEEPS CONSUMING p2.
  t=11s  round 2: p3 assigned to C

  Only partition p3 paused. Everything else never stopped.

  Enable with:
     partition.assignment.strategy = CooperativeStickyAssignor
  (the default in recent clients; check yours)`,
        },
        {
          t: 'key',
          title: 'Cooperative rebalancing is the single best consumer setting',
          text: 'It turns a full-group pause into a partition-level one. On a service that deploys several times a day with a rolling restart, this removes most of the reprocessing and most of the latency spikes. If you are on an older client, upgrading for this alone is worth it.',
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'Commit before losing a partition',
          code: `
consumer.subscribe(List.of("orders"), new ConsumerRebalanceListener() {

    @Override
    public void onPartitionsRevoked(Collection<TopicPartition> revoked) {
        // Last chance: commit what we have processed, so the consumer
        // that inherits this partition does not redo it.
        consumer.commitSync(currentOffsets);
        log.info("Revoked {}", revoked);
    }

    @Override
    public void onPartitionsAssigned(Collection<TopicPartition> assigned) {
        log.info("Assigned {}", assigned);
        // Load any per-partition state you keep here.
    }

    @Override
    public void onPartitionsLost(Collection<TopicPartition> lost) {
        // We were evicted — do NOT commit, another consumer already owns
        // these partitions and committing would corrupt its position.
        log.warn("Lost {} — evicted", lost);
    }
});`,
        },
        {
          t: 'trap',
          title: 'onPartitionsLost is not onPartitionsRevoked',
          text: '**Revoked** means a graceful handover — committing is correct and helpful. **Lost** means you were already evicted and someone else owns those partitions — committing would overwrite their progress. Treating them the same is a subtle and damaging bug.',
        },
      ],
    },
    {
      id: 'offsets',
      title: 'Committing offsets',
      blocks: [
        {
          t: 'code',
          lang: 'java',
          caption: 'Four strategies, in increasing order of control',
          code: `
// 1. AUTO COMMIT — commits every auto.commit.interval.ms (5s), on a timer,
//    regardless of whether your processing succeeded. Can LOSE messages.
props.put(ENABLE_AUTO_COMMIT_CONFIG, true);        // ✘ not for real work

// 2. commitSync() — blocks until the broker confirms. Safe, slow.
process(records);
consumer.commitSync();                              // retries internally

// 3. commitAsync() — fire and forget with a callback. Fast, can fail silently.
process(records);
consumer.commitAsync((offsets, ex) -> {
    if (ex != null) log.warn("Commit failed", ex);  // does NOT retry
});

// 4. THE STANDARD PATTERN — async in the loop, sync on the way out
try {
    while (running) {
        var records = consumer.poll(Duration.ofMillis(100));
        process(records);
        consumer.commitAsync();                     // fast, and a later
    }                                               // commit supersedes it
} finally {
    try {
        consumer.commitSync();                      // make the last one certain
    } finally {
        consumer.close();
    }
}`,
        },
        {
          t: 'key',
          title: 'Why async-then-sync is the idiom',
          text: '`commitAsync` does not retry, because a retry could overwrite a newer commit with an older offset. That is fine during the loop — the next commit covers the same ground anyway. But on shutdown there is no next commit, so you need one `commitSync` to make the final position durable.',
        },
        {
          t: 'ascii',
          caption: 'Where auto-commit loses data.',
          code: `
  t=0.0s  poll returns offsets 100..199
  t=0.1s  processed 100..149
  t=5.0s  AUTO-COMMIT FIRES → commits offset 200
                              ("we polled up to 199, so commit 200")
  t=5.1s  ✘ CRASH while processing 150

  On restart the consumer resumes from offset 200.
  Messages 150..199 were never processed and never will be.
  No error, no log line, no way to know.`,
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'Seeking: replay, skip, or start from a timestamp',
          code: `
// Replay a partition from the beginning
consumer.seekToBeginning(List.of(new TopicPartition("orders", 0)));

// Skip to the newest message, abandoning the backlog
consumer.seekToEnd(consumer.assignment());

// Start from a point in time — "reprocess everything since the deploy"
long since = Instant.now().minus(Duration.ofHours(2)).toEpochMilli();
Map<TopicPartition, Long> query = consumer.assignment().stream()
        .collect(toMap(tp -> tp, tp -> since));

consumer.offsetsForTimes(query).forEach((tp, offsetAndTime) -> {
    if (offsetAndTime != null) consumer.seek(tp, offsetAndTime.offset());
});`,
        },
      ],
    },
    {
      id: 'scaling',
      title: 'Scaling consumers, and the ceiling',
      blocks: [
        {
          t: 'ascii',
          caption: 'Partitions are a hard limit on group parallelism.',
          code: `
  TOPIC with 4 partitions

  1 consumer   → [p0,p1,p2,p3]              1× throughput
  2 consumers  → [p0,p1] [p2,p3]            2×
  4 consumers  → [p0] [p1] [p2] [p3]        4×  ← maximum
  6 consumers  → [p0] [p1] [p2] [p3] [] []  4×  ← two are IDLE

  To go beyond 4 you must either:
    • add partitions (breaks per-key ordering for keys in flight), or
    • process asynchronously within each consumer (you then own
      offset management and ordering)`,
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'Spring Kafka: concurrency is consumers, not threads on one consumer',
          code: `
@KafkaListener(topics = "orders", groupId = "payment", concurrency = "4")
public void handle(OrderPlaced event) { charge(event); }

// concurrency = 4 creates FOUR consumers in the group, each with its own
// poll loop. With 4 partitions each gets one. With 3 partitions the
// fourth is idle — concurrency above the partition count buys nothing.

@Bean
ConcurrentKafkaListenerContainerFactory<String, Object> factory(
        ConsumerFactory<String, Object> cf) {
    var f = new ConcurrentKafkaListenerContainerFactory<String, Object>();
    f.setConsumerFactory(cf);
    f.setConcurrency(4);
    f.getContainerProperties().setAckMode(AckMode.MANUAL);   // you acknowledge
    f.setCommonErrorHandler(new DefaultErrorHandler(
            new FixedBackOff(1000L, 3)));                     // then DLT
    return f;
}`,
        },
        {
          t: 'tip',
          title: 'Lag is the metric that tells you to scale',
          text: '`records-lag-max` per partition, or `kafka-consumer-groups --describe`. Rising lag means consumers cannot keep up. Falling lag after a deploy is normal catch-up. Flat, high lag on **one** partition is a hot key, and adding consumers will not fix it.',
        },
      ],
    },
  ],

  patterns: [
    {
      id: 'poll-on-time',
      name: 'Keep the Poll Loop Fast',
      oneLiner: 'Whatever you do, come back to poll() before max.poll.interval.ms.',
      useWhen: ['Any handler that might be slow, or whose duration varies.'],
      recognize: ['Rebalances with no deploy.', 'Log lines showing the same message processed by two instances.'],
      steps: [
        'Measure the worst-case time to process one full batch.',
        'Reduce `max.poll.records` until that is comfortably inside the interval.',
        'If the work is genuinely long, pause the consumer and hand off.',
      ],
      complexity: 'Configuration, or a small restructure.',
      gotchas: [
        'Raising `max.poll.interval.ms` also delays detection of a genuinely dead consumer.',
        'A long GC pause can trip the *session* timeout instead — that is a different fix.',
      ],
      problems: ['Trigger a poll-interval eviction', 'Fix it with max.poll.records'],
    },
    {
      id: 'cooperative-rebalance',
      name: 'Use Cooperative Rebalancing',
      oneLiner: 'Move only the partitions that must move.',
      useWhen: ['Any consumer group that deploys or scales regularly.'],
      recognize: ['Every pod pausing during a rolling deploy.', 'Latency spikes correlated with deployments.'],
      steps: ['Set `CooperativeStickyAssignor`.', 'Handle `onPartitionsLost` separately from `onPartitionsRevoked`.', 'Measure the pause during a deploy before and after.'],
      complexity: 'One setting; a large operational improvement.',
      gotchas: [
        'All group members must support it — a mixed-version group falls back to eager.',
        'It reduces pauses but does not eliminate redelivery of uncommitted messages.',
      ],
      problems: ['Compare eager and cooperative during a rolling restart', 'Measure the pause'],
    },
    {
      id: 'commit-after-work',
      name: 'Commit After the Work Is Durable',
      oneLiner: 'Disable auto-commit; commit once you can prove the side effect happened.',
      useWhen: ['Every consumer of anything that matters.'],
      recognize: ['`enable.auto.commit = true` in production.', 'Gaps in processed data after a crash.'],
      steps: [
        'Disable auto-commit.',
        '`commitAsync` in the loop, `commitSync` in the finally.',
        'Pair with an idempotent handler, because redelivery is now guaranteed.',
      ],
      template: {
        lang: 'java',
        caption: 'Spring Kafka, manual acknowledgement',
        code: `
@KafkaListener(topics = "orders", groupId = "payment")
public void handle(OrderPlaced event, Acknowledgment ack) {
    processIdempotently(event);      // the work, safely repeatable
    ack.acknowledge();               // only now
}
// with: spring.kafka.listener.ack-mode=MANUAL
//       spring.kafka.consumer.enable-auto-commit=false`,
      },
      complexity: 'At-least-once delivery, which is what you want.',
      gotchas: [
        'Acknowledging in a `finally` defeats the point — a failure would still advance the offset.',
        'Manual acknowledgement without an idempotent handler simply moves the bug.',
      ],
      problems: ['Lose a message with auto-commit', 'Switch to manual and confirm redelivery'],
    },
  ],

  pitfalls: [
    { title: 'Auto-commit in production', text: 'Commits on a timer regardless of success. Silently loses messages.' },
    { title: 'Slow handlers exceeding max.poll.interval.ms', text: 'Eviction while still processing — two consumers on one partition.' },
    { title: 'Treating onPartitionsLost like onPartitionsRevoked', text: 'Committing after eviction overwrites the new owner’s progress.' },
    { title: 'More consumers than partitions', text: 'The extras idle. Partitions are the ceiling.' },
    { title: 'Blocking inside the poll loop', text: 'Anything slow there is counted against the poll interval.' },
    { title: 'commitAsync as the only commit', text: 'It does not retry; a failure at shutdown loses the position.' },
    { title: 'Changing the group id to "reset"', text: 'The new group starts at `auto.offset.reset` — either replaying everything or skipping the backlog entirely.' },
    { title: 'Ignoring lag', text: 'It is the earliest and clearest signal that something is wrong.' },
    { title: 'Sharing one consumer across threads', text: 'KafkaConsumer is **not** thread-safe. One consumer, one thread.' },
  ],

  cheatsheet: [
    { label: 'poll() does', value: 'fetch + liveness' },
    { label: 'Too slow to poll', value: 'max.poll.interval eviction' },
    { label: 'Hung or GC', value: 'session.timeout eviction' },
    { label: 'Fix slow handlers', value: 'lower max.poll.records' },
    { label: 'Rebalance strategy', value: 'CooperativeStickyAssignor' },
    { label: 'Revoked', value: 'graceful — commit' },
    { label: 'Lost', value: 'evicted — do NOT commit' },
    { label: 'Commit idiom', value: 'async in loop, sync in finally' },
    { label: 'Auto-commit', value: 'off, always' },
    { label: 'Parallelism ceiling', value: 'partition count' },
    { label: 'Spring concurrency', value: 'N consumers, not N threads' },
    { label: 'Replay', value: 'seekToBeginning / offsetsForTimes' },
    { label: 'New group starts at', value: 'auto.offset.reset' },
    { label: 'Consumer object', value: 'NOT thread-safe' },
  ],

  problems: [
    { name: 'Watch a group assign partitions', difficulty: 'Easy', pattern: 'Groups', insight: 'Start one consumer on a 3-partition topic, then a second and a third. Log the assignment each time and watch it redistribute.' },
    { name: 'Start a consumer that never gets work', difficulty: 'Easy', pattern: 'Parallelism', insight: 'Four consumers, three partitions. Use --describe to find the one with no assignment.' },
    { name: 'Lose messages with auto-commit', difficulty: 'Medium', pattern: 'Offsets', insight: 'Auto-commit on, sleep past the commit interval, then crash mid-batch. Confirm the skipped messages never return.' },
    { name: 'Trigger a poll-interval eviction', difficulty: 'Medium', pattern: 'Poll loop', insight: 'Sleep longer than max.poll.interval.ms in the handler. Watch the rebalance fire while your handler is still running.' },
    { name: 'Catch two consumers on one partition', difficulty: 'Hard', pattern: 'Eviction', insight: 'During that eviction, log the message id in both instances. The same id is processed twice, concurrently.' },
    { name: 'Compare eager and cooperative rebalancing', difficulty: 'Hard', pattern: 'Rebalancing', insight: 'Roll-restart a 4-pod group under each strategy and measure total consumption downtime.' },
    { name: 'Commit in onPartitionsRevoked', difficulty: 'Medium', pattern: 'Rebalance listener', insight: 'Without it, count how many messages are redelivered after a rebalance. With it, the count drops to near zero.' },
    { name: 'Replay from a timestamp', difficulty: 'Medium', pattern: 'Seeking', insight: 'Use offsetsForTimes to reprocess the last two hours, and confirm you did not have to change the group id.' },
    { name: 'Reset a group the right way', difficulty: 'Medium', pattern: 'Offsets', insight: 'Use kafka-consumer-groups --reset-offsets --to-earliest --execute. Then try it by changing the group id and note the difference in behaviour.' },
    { name: 'Chart lag under load', difficulty: 'Hard', pattern: 'Monitoring', insight: 'Produce faster than you consume, chart lag per partition, then scale consumers to the partition count and watch it drain.' },
  ],
}
