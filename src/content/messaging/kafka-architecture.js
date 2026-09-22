export default {
  id: 'kafka-architecture',
  title: 'Kafka Architecture: Brokers, Partitions & the Log',
  short: 'Kafka Architecture',
  icon: 'AccountTreeRounded',
  tier: 'Core',
  order: 6,
  estHours: 6,
  prereqs: ['mq-primitives'],
  tagline: 'It is a distributed, replicated, append-only file. Everything clever follows from that.',
  mentalModel:
    'Kafka is not a queue that happens to be fast. It is a **commit log** spread across machines. Writes append to the end of a file, reads are sequential scans from a position, and nothing is ever modified in place. Every performance and durability property comes from that single design decision.',
  whyItMatters:
    'You cannot reason about ordering, throughput, rebalances or data loss without the picture of brokers, partitions, leaders and replicas in your head. Every later chapter assumes it.',

  reference: {
    title: 'The moving parts',
    head: ['Component', 'What it is', 'How many'],
    rows: [
      ['**Broker**', 'One Kafka server process', '3 minimum for production'],
      ['**Cluster**', 'The set of brokers working together', 'One'],
      ['**Controller**', 'The broker that manages metadata and leader election', 'One, elected'],
      ['**Topic**', 'A named logical stream', 'As many as you like'],
      ['**Partition**', 'One ordered log; the unit of parallelism', 'Chosen per topic'],
      ['**Leader replica**', 'Handles all reads and writes for a partition', 'One per partition'],
      ['**Follower replica**', 'Copies the leader, ready to take over', '`replication.factor − 1`'],
      ['**ISR**', 'In-sync replicas — those caught up with the leader', 'Varies; watch it'],
      ['**Segment**', 'One file on disk holding part of a partition', 'Rolls by size or time'],
    ],
  },

  sections: [
    {
      id: 'cluster',
      title: 'The cluster, drawn',
      blocks: [
        {
          t: 'ascii',
          caption: 'One topic with 3 partitions and replication factor 3, spread across 3 brokers.',
          code: `
  TOPIC "orders": 3 partitions, replication.factor = 3

  ┌──────────── BROKER 1 ────────────┐
  │  P0  LEADER      ◀── writes      │
  │  P1  follower                    │
  │  P2  follower                    │
  └──────────────────────────────────┘

  ┌──────────── BROKER 2 ────────────┐
  │  P0  follower                    │
  │  P1  LEADER      ◀── writes      │
  │  P2  follower                    │
  └──────────────────────────────────┘

  ┌──────────── BROKER 3 ────────────┐
  │  P0  follower                    │
  │  P1  follower                    │
  │  P2  LEADER      ◀── writes      │
  └──────────────────────────────────┘

  • Every partition has exactly ONE leader. All client traffic for that
    partition goes to its leader — followers serve nobody.
  • Leadership is spread across brokers so the load is balanced.
  • Lose broker 2 and P1's leadership moves to broker 1 or 3.
    Data is intact because two copies survive.`,
        },
        {
          t: 'key',
          title: 'Partitions are the unit of everything',
          text: 'Parallelism (one consumer per partition per group), ordering (guaranteed within a partition only), replication (per partition, not per topic) and leadership (per partition) are all defined at this level. When you hear "topic", picture the partitions underneath it.',
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'Seeing it for real',
          code: `
kafka-topics --bootstrap-server localhost:9092 \\
             --create --topic orders \\
             --partitions 3 --replication-factor 3

kafka-topics --bootstrap-server localhost:9092 --describe --topic orders

# Topic: orders  PartitionCount: 3  ReplicationFactor: 3
#   Partition: 0  Leader: 1  Replicas: 1,2,3  Isr: 1,2,3
#   Partition: 1  Leader: 2  Replicas: 2,3,1  Isr: 2,3,1
#   Partition: 2  Leader: 3  Replicas: 3,1,2  Isr: 3,1,2
#                 ▲          ▲              ▲
#            who serves  who has a copy  who is CAUGHT UP
#
# Isr shorter than Replicas = a broker is lagging or down.
# This is the single most useful line in Kafka operations.`,
        },
      ],
    },
    {
      id: 'the-log',
      title: 'Why an append-only log is so fast',
      blocks: [
        { t: 'p', text: 'Kafka regularly handles millions of messages per second on ordinary disks. Not by being clever in memory — by never doing anything a disk is bad at.' },
        {
          t: 'ascii',
          caption: 'A partition on disk: segments, each with an index.',
          code: `
  /var/lib/kafka/orders-0/
  ┌─────────────────────────────────────────────────────────────┐
  │ 00000000000000000000.log     ← segment: offsets 0 .. 9999   │
  │ 00000000000000000000.index   ← offset → byte position       │
  │ 00000000000000000000.timeindex ← timestamp → offset         │
  ├─────────────────────────────────────────────────────────────┤
  │ 00000000000000010000.log     ← segment: offsets 10000 ..    │
  │ 00000000000000010000.index                                  │
  ├─────────────────────────────────────────────────────────────┤
  │ 00000000000000020000.log     ← ACTIVE segment, being        │
  │ 00000000000000020000.index      appended to right now       │
  └─────────────────────────────────────────────────────────────┘

  • Writes: append to the end of the active segment. Sequential.
  • Reads:  look up the offset in .index, seek once, then read forward.
  • Deletes: unlink a whole old segment file. No compaction scan,
             no row-by-row deletion.
  • Segments roll at segment.bytes (1GB) or segment.ms (7 days).`,
        },
        {
          t: 'dl',
          items: [
            { term: 'Sequential disk IO', def: 'Appending to the end of a file is dramatically faster than random writes — on spinning disks by orders of magnitude, and still substantially faster on SSDs. Kafka never updates a message in place, so it never needs a random write.' },
            { term: 'The page cache does the caching', def: 'Kafka does not maintain its own message cache. It writes to the OS page cache and lets the kernel flush. Recent messages are served from RAM without Kafka managing a single buffer — and the cache survives a Kafka restart.' },
            { term: 'Zero-copy', def: 'For a consumer read, `sendfile()` moves bytes from the page cache to the network socket **without passing through the JVM heap**. No deserialization, no garbage. This is why a Kafka broker uses so little heap for so much throughput.' },
            { term: 'Batching and compression', def: 'Producers group messages into batches and compress the whole batch. The broker stores it compressed and hands it to consumers still compressed — it is decompressed once, at the consumer.' },
          ],
        },
        {
          t: 'key',
          title: 'The broker does almost nothing per message',
          text: 'It validates the batch, appends it, and updates an index. It does not parse your payload, does not track per-message state, and does not know which consumers exist. That deliberate laziness is the throughput.',
        },
      ],
    },
    {
      id: 'write-path',
      title: 'The write path, step by step',
      blocks: [
        {
          t: 'ascii',
          caption: 'What happens between send() and an acknowledgement, with acks=all.',
          code: `
  PRODUCER                    LEADER (broker 1)      FOLLOWERS (2, 3)
     │
     │ 1. serialize key + value
     │ 2. partitioner: hash(key) % 3  ──▶ partition 0
     │ 3. append to the in-memory batch for partition 0
     │      (waits up to linger.ms, or until batch.size)
     │
     │───── 4. send the batch ──────────▶│
     │                                   │ 5. append to the active
     │                                   │    segment (page cache)
     │                                   │
     │                                   │◀── 6. followers FETCH ──┤
     │                                   │                         │
     │                                   │    7. they append too   │
     │                                   │                         │
     │                                   │◀── 8. fetch again,      │
     │                                   │    confirming offset ───┤
     │                                   │
     │                                   │ 9. all ISR have it
     │◀──── 10. ack (offset 4711) ───────│
     │
     │ 11. your callback fires

  Note step 6: followers PULL from the leader. The leader never pushes.
  One mechanism serves both replication and consumption.`,
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'The three durability levels, and what each risks',
          code: `
// acks = 0   — fire and forget. The producer does not wait at all.
//              Fastest. Messages are lost on any failure, silently.

// acks = 1   — the LEADER has written it. Default in older clients.
//              Lost if the leader dies before followers catch up.

// acks = all — every in-sync replica has it. The only safe setting.
props.put(ProducerConfig.ACKS_CONFIG, "all");
props.put(ProducerConfig.ENABLE_IDEMPOTENCE_CONFIG, true);  // no dup on retry
props.put(ProducerConfig.RETRIES_CONFIG, Integer.MAX_VALUE);
props.put(ProducerConfig.MAX_IN_FLIGHT_REQUESTS_PER_CONNECTION, 5);

// Broker side — acks=all is meaningless without this:
// min.insync.replicas = 2
//   With replication.factor=3 and min.insync.replicas=2, a write needs
//   2 copies. You can lose one broker and keep writing; lose two and
//   writes fail loudly instead of silently losing data.`,
        },
        {
          t: 'trap',
          title: 'acks=all alone does not protect you',
          text: 'If `min.insync.replicas` is 1, then "all in-sync replicas" can mean *just the leader* when the followers have fallen behind — and you are back to `acks=1` without knowing it. The safe pairing is **replication.factor = 3, min.insync.replicas = 2, acks = all**. Anything less is a data-loss configuration wearing a safe-looking flag.',
        },
      ],
    },
    {
      id: 'read-path',
      title: 'The read path, and why consumers pull',
      blocks: [
        {
          t: 'ascii',
          caption: 'Consumers ask; the broker never pushes.',
          code: `
  CONSUMER                                    LEADER
     │
     │─── fetch(partition 0, from offset 42, ─▶│
     │      max.bytes, wait up to fetch.max.wait.ms)
     │                                         │
     │                                         │ look up 42 in .index
     │                                         │ seek, read forward
     │                                         │ sendfile() → socket
     │                                         │   (zero-copy: the bytes
     │                                         │    never enter the heap)
     │◀──── batch: offsets 42..97 ─────────────│
     │
     │ process them
     │
     │─── commit offset 98 ───────────────────▶│  stored in the internal
     │                                         │  topic __consumer_offsets
     │
     │─── fetch(from 98) ─────────────────────▶│  and around again

  Why PULL and not push:
   • a slow consumer cannot be overwhelmed — it simply asks less often
   • the consumer controls batch size and therefore its own memory
   • the broker holds no per-consumer state beyond a stored offset
   • replaying is just asking from an older offset`,
        },
        {
          t: 'key',
          title: 'Offsets live in a Kafka topic',
          text: 'Committed offsets are written to an internal compacted topic called `__consumer_offsets`, keyed by (group, topic, partition). So offset storage uses the same replication and durability machinery as your data — and it is why a consumer group’s position survives a broker restart.',
        },
      ],
    },
    {
      id: 'controller',
      title: 'Metadata, the controller, and what happens when a broker dies',
      blocks: [
        { t: 'p', text: 'Something has to decide which broker leads which partition. That is the **controller** — one elected broker. Historically this used ZooKeeper; modern Kafka uses KRaft, where the controllers form their own Raft quorum and the dependency is gone.' },
        {
          t: 'ascii',
          caption: 'Broker failure, from failure to recovery.',
          code: `
  t=0    P1 leader = broker 2, ISR = {2, 3, 1}, producers writing fine

  t=5s   broker 2 dies (kernel panic, no warning)

  t=5s   producers and consumers get errors:
             NOT_LEADER_OR_FOLLOWER / connection refused

  t=~10s controller notices the session is gone
         ──▶ elects a new leader for every partition broker 2 led
         ──▶ picks from the ISR only  (no data loss)
         ──▶ P1 leader = broker 3, ISR = {3, 1}

  t=~10s controller broadcasts the new metadata

  t=~11s clients refresh metadata, reconnect to broker 3, resume

  Total disruption: a few seconds of retries. Clients handle this
  automatically — which is why producer retries must be enabled.

  If min.insync.replicas = 2 and only ONE replica were left,
  writes would REJECT rather than proceed unsafely. That is correct
  behaviour: fail loudly rather than lose data quietly.`,
        },
        {
          t: 'warn',
          title: 'unclean.leader.election.enable',
          text: 'If every in-sync replica is gone, Kafka can either stop serving that partition or promote an out-of-sync replica — which **silently discards** every message the old leader had that the new one never received. The default is `false`, meaning availability is sacrificed for correctness. Turning it on trades data loss for uptime. Know which you have chosen, and why.',
        },
        {
          t: 'note',
          title: 'KRaft versus ZooKeeper',
          text: 'ZooKeeper was a separate cluster to run, monitor and upgrade, and it limited how many partitions a cluster could hold. KRaft moves metadata into Kafka itself as a Raft-replicated log, giving faster failover, far higher partition counts and one fewer system to operate. New clusters should use KRaft; ZooKeeper support has been removed in Kafka 4.',
        },
      ],
    },
  ],

  patterns: [
    {
      id: 'durable-topic-config',
      name: 'The Durable Topic Configuration',
      oneLiner: 'Replication 3, min in-sync 2, acks all — and none of them works alone.',
      useWhen: ['Any topic carrying data you cannot regenerate.'],
      recognize: ['`replication.factor = 1`.', '`acks = 1` on a producer of business events.', '`min.insync.replicas` left at the default.'],
      steps: [
        'Create topics with `--replication-factor 3` across at least 3 brokers.',
        'Set `min.insync.replicas = 2` on the topic.',
        'Set `acks = all` and enable idempotence on the producer.',
        'Leave `unclean.leader.election.enable = false`.',
      ],
      template: {
        lang: 'java',
        caption: 'The three settings must agree',
        code: `
kafka-topics --create --topic orders \\
  --partitions 12 --replication-factor 3 \\
  --config min.insync.replicas=2 \\
  --config unclean.leader.election.enable=false

# Producer
acks=all
enable.idempotence=true
retries=2147483647
delivery.timeout.ms=120000

# The contract this gives you:
#   tolerate 1 broker down  → writes continue
#   tolerate 2 brokers down → writes FAIL (correct: no silent loss)`,
      },
      complexity: 'Three copies of every byte; a small latency cost for the extra round trip.',
      gotchas: [
        '`replication.factor = 3` with `min.insync.replicas = 3` means any single broker restart stops all writes. Two is the right number.',
        'Replication factor cannot exceed the broker count.',
      ],
      problems: ['Kill a broker and keep writing', 'Kill two and watch writes reject'],
    },
    {
      id: 'partition-count',
      name: 'Choose the Partition Count Deliberately',
      oneLiner: 'It is your consumer parallelism ceiling, and you can only ever increase it.',
      useWhen: ['Creating any topic.'],
      recognize: ['A topic with 1 partition and a scaling problem.', 'A topic with 500 partitions and slow rebalances.'],
      steps: [
        'Estimate peak throughput and per-consumer throughput.',
        'partitions ≥ peak / per-consumer, rounded up.',
        'Add headroom — 2–3× your expected maximum consumers.',
        'Sanity-check the total partition count across the cluster.',
      ],
      template: {
        lang: 'java',
        caption: 'Working it out',
        code: `
// Target:      50,000 messages/sec at peak
// One consumer: 5,000 messages/sec measured
// Minimum:      50,000 / 5,000 = 10 partitions
// With headroom for growth and uneven keys: 24

// Costs of too many:
//   • file handles and memory per partition on each broker
//   • longer rebalances (every partition must be reassigned)
//   • more end-to-end latency for acks=all
// A few thousand partitions per broker is a practical ceiling.`,
      },
      complexity: 'A planning decision with long-lived consequences.',
      gotchas: [
        'Adding partitions rehashes keys, so per-key ordering breaks for keys in flight.',
        'You cannot reduce the count — you would have to create a new topic and migrate.',
      ],
      problems: ['Size partitions from a measured rate', 'Observe rebalance time versus partition count'],
    },
    {
      id: 'watch-isr',
      name: 'Watch the ISR, Not Just the Broker Count',
      oneLiner: 'A shrinking in-sync replica set is the earliest warning of trouble.',
      useWhen: ['Operating any cluster.'],
      recognize: ['`Isr` shorter than `Replicas` in a describe output.', 'Under-replicated partition metrics above zero.'],
      steps: [
        'Alert on `UnderReplicatedPartitions > 0` sustained.',
        'Alert on `OfflinePartitionsCount > 0` immediately — that is an outage.',
        'Investigate the lagging broker: disk, network or GC.',
      ],
      complexity: 'Two alerts; catches most cluster problems before users do.',
      gotchas: [
        'A brief shrink during a rolling restart is normal; a sustained one is not.',
        'If the ISR drops below `min.insync.replicas`, producers with `acks=all` start failing — which looks like a producer bug but is not.',
      ],
      problems: ['Shrink the ISR deliberately', 'Alert on under-replicated partitions'],
    },
  ],

  pitfalls: [
    { title: 'replication.factor = 1', text: 'One broker failure loses the data permanently. Fine for a laptop, never for production.' },
    { title: 'acks=all with min.insync.replicas=1', text: '"All replicas" can mean just the leader. You have the latency cost and none of the safety.' },
    { title: 'Assuming followers serve reads', text: 'All traffic goes to the leader (unless you explicitly enable follower fetching for rack locality).' },
    { title: 'Too few partitions', text: 'A hard ceiling on consumer parallelism that you cannot lower later.' },
    { title: 'Far too many partitions', text: 'Slow rebalances, high broker memory, longer failover.' },
    { title: 'Enabling unclean leader election without deciding', text: 'It silently discards committed messages to regain availability.' },
    { title: 'Ignoring the ISR', text: 'It shrinks before anything visibly breaks.' },
    { title: 'Treating a topic as ordered', text: 'Only partitions are ordered.' },
  ],

  cheatsheet: [
    { label: 'Kafka is', value: 'a replicated append-only log' },
    { label: 'Partition', value: 'unit of ordering and parallelism' },
    { label: 'Leader', value: 'one per partition, serves all traffic' },
    { label: 'ISR', value: 'replicas caught up with the leader' },
    { label: 'Durable trio', value: 'RF=3, min.isr=2, acks=all' },
    { label: 'Tolerates', value: '1 broker down; 2 = writes reject' },
    { label: 'Why fast', value: 'sequential IO + page cache + zero-copy' },
    { label: 'Consumers', value: 'pull, never pushed to' },
    { label: 'Offsets stored in', value: '__consumer_offsets' },
    { label: 'Segments', value: 'roll by size or time; deleted whole' },
    { label: 'Failover', value: 'controller elects from the ISR' },
    { label: 'Unclean election', value: 'availability at the cost of data' },
    { label: 'Metadata', value: 'KRaft (ZooKeeper is gone)' },
    { label: 'Key describe line', value: 'Isr shorter than Replicas' },
  ],

  problems: [
    { name: 'Start a 3-broker cluster', difficulty: 'Easy', pattern: 'Setup', insight: 'Docker Compose with three KRaft brokers. Create a topic with RF=3 and read the describe output line by line.' },
    { name: 'Find the leader for each partition', difficulty: 'Easy', pattern: 'Topology', insight: 'Use --describe and note that leadership is spread across brokers. Produce and confirm traffic goes only to leaders.' },
    { name: 'Look at the files on disk', difficulty: 'Easy', pattern: 'The log', insight: 'Exec into a broker and list the partition directory. Identify the .log, .index and .timeindex files and the active segment.' },
    { name: 'Kill a broker and keep writing', difficulty: 'Medium', pattern: 'Failover', insight: 'With RF=3 and min.isr=2, stop one broker. Producers see brief errors then recover. Watch the leader change in --describe.' },
    { name: 'Kill two and watch writes reject', difficulty: 'Medium', pattern: 'Durability', insight: 'Stop a second broker. Producers with acks=all now fail with `NOT_ENOUGH_REPLICAS` — correct behaviour, not a bug.' },
    { name: 'Compare acks settings', difficulty: 'Medium', pattern: 'Durability vs latency', insight: 'Benchmark acks=0, 1 and all. Then kill the leader immediately after a write and see which settings lost messages.' },
    { name: 'Shrink the ISR deliberately', difficulty: 'Hard', pattern: 'Operations', insight: 'Pause a broker container to make it lag. Watch Isr shrink in --describe and the under-replicated metric rise.' },
    { name: 'Force an unclean leader election', difficulty: 'Hard', pattern: 'Data loss', insight: 'Enable it, kill the ISR, promote a stale replica, and count exactly how many committed messages disappeared.' },
    { name: 'Measure rebalance time versus partitions', difficulty: 'Hard', pattern: 'Sizing', insight: 'Time a consumer restart on topics with 3, 30 and 300 partitions. The relationship is why "more partitions" is not free.' },
    { name: 'Inspect __consumer_offsets', difficulty: 'Hard', pattern: 'Offsets', insight: 'Consume the internal topic with the offsets formatter and watch your commits appear as ordinary Kafka messages.' },
  ],
}
