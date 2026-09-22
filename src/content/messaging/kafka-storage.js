export default {
  id: 'kafka-storage',
  title: 'Storage, Retention & Log Compaction',
  short: 'Storage & Retention',
  icon: 'StorageRounded',
  tier: 'Core',
  order: 9,
  estHours: 4,
  prereqs: ['kafka-architecture'],
  tagline: 'Kafka is not just a pipe. Configured correctly, it is a database of the latest value per key.',
  mentalModel:
    'Every partition is a sequence of segment files. **Retention** decides when whole segments are deleted — by age or by size. **Compaction** is different: it keeps the newest record for every key forever, so the topic becomes a durable changelog you can replay into a fresh service.',
  whyItMatters:
    'Retention decides how far back you can replay, which decides whether a bug is recoverable. Compaction is what turns Kafka from a transport into a source of truth — and it is how Kafka Streams, Connect and consumer offsets themselves all work.',

  reference: {
    title: 'The two cleanup policies',
    head: ['', '`cleanup.policy=delete`', '`cleanup.policy=compact`'],
    rows: [
      ['Keeps', 'Everything within the window', 'The latest record per key, forever'],
      ['Removes', 'Whole segments past `retention.ms`/`bytes`', 'Superseded values for a key'],
      ['Replay gives you', 'Events in the window', 'Current state of every key'],
      ['Needs a key?', 'No', '**Yes** — null keys are never compacted'],
      ['Typical use', 'Event streams, logs, metrics', 'Changelogs, config, lookup tables'],
      ['Delete a key', 'Wait for expiry', 'Publish a **tombstone** (null value)'],
    ],
  },

  sections: [
    {
      id: 'segments',
      title: 'Segments and retention',
      blocks: [
        {
          t: 'ascii',
          caption: 'Deletion happens a whole file at a time — never message by message.',
          code: `
  partition orders-0, retention.ms = 7 days

  ┌─────────────────────┬─────────────────────┬─────────────────────┐
  │ segment 0           │ segment 10000       │ segment 20000       │
  │ offsets 0-9999      │ offsets 10000-19999 │ offsets 20000-...   │
  │ newest msg: 9d ago  │ newest msg: 3d ago  │ ACTIVE (being       │
  │                     │                     │ appended to now)    │
  └─────────────────────┴─────────────────────┴─────────────────────┘
        ▲                                             ▲
        │                                             │
   ENTIRE SEGMENT eligible                      never deleted while
   for deletion — its newest                    it is the active segment
   record is older than 7 days

  Consequences:
   • a message can outlive retention.ms — its segment is kept until
     EVERY message in it has expired
   • retention is a floor, not a promise of prompt deletion
   • a very large segment.ms means data lingers far longer than expected`,
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'The settings, and how they interact',
          code: `
# Time-based: keep 7 days
retention.ms = 604800000

# Size-based: keep at most 50GB PER PARTITION (not per topic)
retention.bytes = 53687091200

# Whichever limit is hit FIRST triggers deletion.
# retention.bytes = -1 (default) means size is unlimited.

# How often a new segment is started
segment.bytes = 1073741824    # 1GB
segment.ms    = 604800000     # or 7 days, whichever comes first

# Rule of thumb: segment.ms should be well below retention.ms, or the
# active segment keeps data alive long past the retention window.`,
        },
        {
          t: 'warn',
          title: 'retention.bytes is per partition',
          text: 'Setting 50GB on a topic with 24 partitions means up to **1.2TB** on disk, spread across brokers, multiplied again by the replication factor. Teams size a disk for the topic figure and run out of space. Multiply by partitions, then by replication factor.',
        },
        {
          t: 'key',
          title: 'Retention is your replay window',
          text: 'If retention is 7 days and you discover a consumer bug that has been corrupting data for 10, you cannot replay your way out of it. For topics that feed derived state, longer retention — or compaction — is cheap insurance.',
        },
      ],
    },
    {
      id: 'compaction',
      title: 'Log compaction, drawn',
      blocks: [
        {
          t: 'ascii',
          caption: 'Compaction keeps the last value per key and discards the rest.',
          code: `
  BEFORE compaction — the full history
  ┌──────┬──────┬──────┬──────┬──────┬──────┬──────┬──────┐
  │ off0 │ off1 │ off2 │ off3 │ off4 │ off5 │ off6 │ off7 │
  │ K1:A │ K2:B │ K1:C │ K3:D │ K2:E │ K1:F │ K3:∅ │ K4:G │
  └──────┴──────┴──────┴──────┴──────┴──────┴──────┴──────┘
                                              ▲
                                       tombstone: null value

  AFTER compaction
  ┌──────┬──────┬──────┬──────┐
  │ off5 │ off4 │ off6 │ off7 │      offsets are NOT renumbered —
  │ K1:F │ K2:E │ K3:∅ │ K4:G │      there are now gaps, which is fine
  └──────┴──────┴──────┴──────┘

  • K1:A and K1:C are gone; only the newest K1 survives
  • K3's tombstone is kept for delete.retention.ms, then removed
    entirely — so consumers have a window to observe the deletion
  • The ACTIVE segment is never compacted, so recent history is intact`,
        },
        {
          t: 'key',
          title: 'A compacted topic is a durable key-value store you can replay',
          text: 'Replay it from offset 0 and you receive the current value of every key exactly once. That is how a new service bootstraps its local state, how Kafka Streams restores a state store after a crash, and how `__consumer_offsets` itself works. The topic *is* the table.',
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'Configuring a compacted topic',
          code: `
kafka-topics --create --topic customer-profiles \\
  --partitions 12 --replication-factor 3 \\
  --config cleanup.policy=compact \\
  --config min.cleanable.dirty.ratio=0.5 \\
  --config delete.retention.ms=86400000 \\
  --config min.compaction.lag.ms=0

# min.cleanable.dirty.ratio — compact once 50% of the log is superseded.
#   Lower = more aggressive, more IO. Higher = more disk, less CPU.
# delete.retention.ms — how long tombstones survive so consumers can see them.
# You can also combine: cleanup.policy=compact,delete
#   → compacted, AND anything older than retention.ms is removed entirely.`,
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'Deleting a key means publishing nothing',
          code: `
// Update
producer.send(new ProducerRecord<>("customer-profiles", "c-902", profile));

// DELETE — a null VALUE is a tombstone. The key must still be present.
producer.send(new ProducerRecord<>("customer-profiles", "c-902", null));

// Consumers must handle it explicitly, or they will NPE:
if (record.value() == null) {
    localStore.remove(record.key());       // the key was deleted
} else {
    localStore.put(record.key(), record.value());
}`,
        },
        {
          t: 'trap',
          title: 'Compaction requires keys, and does not guarantee promptness',
          text: 'Messages with a null key are never compacted — they accumulate forever on a compacted topic. And compaction is a background process: a superseded value can survive for hours depending on `min.cleanable.dirty.ratio` and broker load. Never assume a duplicate key is gone the moment you write the newer one.',
        },
      ],
    },
    {
      id: 'worked',
      title: 'Worked example: bootstrapping a new service',
      blocks: [
        { t: 'p', text: 'This is where compaction earns its place, using the running example. A new pricing service needs every customer’s current tier — and there are five million customers.' },
        {
          t: 'ascii',
          caption: 'Without compaction versus with it.',
          code: `
  WITHOUT COMPACTION (cleanup.policy = delete, 7 days)
    The new service subscribes and gets... the last 7 days of changes.
    Customers who have not changed tier in a year are invisible.
    ──▶ you must ALSO call the customer service REST API for a full
        dump, page through 5M records, and reconcile with the stream.
        Two code paths, a race between them, and a load spike.

  WITH COMPACTION (cleanup.policy = compact)
    topic "customer-tiers", keyed by customerId

    new service:
        seekToBeginning()
        consume until caught up          ──▶ 5M records, one per customer,
                                             each the CURRENT value
        keep consuming                    ──▶ stays up to date forever

    One code path. No API. No reconciliation. No race.`,
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'Bootstrapping from a compacted topic',
          code: `
@Component
public class TierCache {
    private final Map<String, Tier> tiers = new ConcurrentHashMap<>();
    private volatile boolean ready = false;

    @KafkaListener(topics = "customer-tiers", groupId = "pricing-service")
    public void onTier(ConsumerRecord<String, Tier> record) {
        if (record.value() == null) tiers.remove(record.key());   // tombstone
        else                        tiers.put(record.key(), record.value());
    }

    // Do not serve traffic until the backlog is drained, or you will
    // price requests against a half-loaded cache.
    public Tier of(String customerId) {
        if (!ready) throw new ServiceNotReadyException();
        return tiers.getOrDefault(customerId, Tier.STANDARD);
    }
}`,
        },
        {
          t: 'tip',
          title: 'Gate readiness on catching up',
          text: 'Compare your committed offset against the log-end offset and only report readiness when the gap is near zero. Otherwise Kubernetes sends traffic to a pod whose cache is 3% loaded, and most requests get the default answer. This is a very common bug in services that bootstrap from a topic.',
        },
      ],
    },
  ],

  patterns: [
    {
      id: 'compacted-changelog',
      name: 'Compacted Topic as a Changelog',
      oneLiner: 'Publish state changes keyed by entity id; replay gives you the whole table.',
      useWhen: ['Reference data, configuration, entitlements, any slowly changing dimension.', 'A service that needs a local copy of another service’s data.'],
      recognize: ['A nightly full-dump job.', 'Services calling each other for reference data on every request.'],
      steps: [
        'Key the topic by entity id.',
        'Set `cleanup.policy=compact`.',
        'Publish the full current state, not deltas.',
        'Consumers replay from the beginning to build local state.',
      ],
      template: {
        lang: 'java',
        caption: 'Absolute state is what makes replay idempotent',
        code: `
// ✔ full current state — replaying in any order converges correctly
record CustomerTier(String customerId, Tier tier, Instant effectiveFrom) { }
producer.send(new ProducerRecord<>("customer-tiers", customerId, tier));

// ✘ a delta — replay would apply it repeatedly and corrupt the value
record TierUpgraded(String customerId, int levelsGained) { }`,
      },
      complexity: 'Disk proportional to the number of keys, not the number of events.',
      gotchas: [
        'Null keys are never compacted.',
        'Tombstones vanish after `delete.retention.ms` — a consumer offline longer than that never learns about the deletion.',
        'Compaction is asynchronous; duplicates linger.',
      ],
      problems: ['Bootstrap a cache from a compacted topic', 'Delete a key with a tombstone'],
    },
    {
      id: 'retention-as-replay-window',
      name: 'Set Retention From Your Recovery Needs',
      oneLiner: 'Retention is how far back you can fix a mistake.',
      useWhen: ['Creating any topic.'],
      recognize: ['A bug found on day 10 on a topic with 7-day retention.', 'Retention left at the default with no thought.'],
      steps: [
        'Ask: how long might a consumer bug go unnoticed?',
        'Set retention to comfortably exceed that.',
        'Multiply by partitions and replication factor to size the disk.',
      ],
      complexity: 'Disk, which is cheap compared with unrecoverable data.',
      gotchas: [
        '`retention.bytes` is per partition — the topic total is far larger.',
        'A large `segment.ms` keeps data well past `retention.ms`.',
        'Regulatory retention limits may cap this from the other direction.',
      ],
      problems: ['Compute real disk usage', 'Find data surviving past retention'],
    },
    {
      id: 'ready-when-caught-up',
      name: 'Report Ready Only When Caught Up',
      oneLiner: 'A service bootstrapping from a topic must not serve traffic mid-replay.',
      useWhen: ['Any consumer that builds local state before it can answer.'],
      recognize: ['Wrong answers immediately after a deploy that correct themselves a minute later.'],
      steps: [
        'Compare committed offset with the log-end offset per partition.',
        'Expose readiness only when the lag is below a small threshold.',
        'Fail the readiness probe, not the liveness probe.',
      ],
      template: {
        lang: 'java',
        caption: 'A readiness indicator driven by lag',
        code: `
@Component
public class CatchUpHealth implements HealthIndicator {
    @Override public Health health() {
        long lag = consumer.endOffsets(assignment).entrySet().stream()
                .mapToLong(e -> e.getValue() - consumer.position(e.getKey()))
                .sum();
        return lag < 100
             ? Health.up().withDetail("lag", lag).build()
             : Health.down().withDetail("lag", lag).build();
    }
}`,
      },
      complexity: 'Slower startup; correct answers from the first request.',
      gotchas: [
        'Put it in readiness, not liveness — a slow bootstrap should delay traffic, not restart the pod.',
        'Allow enough startup time in the orchestrator, or it will kill the pod mid-replay forever.',
      ],
      problems: ['Serve traffic mid-bootstrap and see wrong answers', 'Gate on lag and fix it'],
    },
  ],

  pitfalls: [
    { title: 'Assuming retention.bytes is per topic', text: 'It is per partition. Multiply by partitions and replication factor.' },
    { title: 'Retention shorter than your detection time', text: 'You cannot replay your way out of a bug you found too late.' },
    { title: 'Compaction with null keys', text: 'Those records are never compacted and accumulate forever.' },
    { title: 'Expecting compaction to be immediate', text: 'It is a background process governed by the dirty ratio.' },
    { title: 'Consumers that NPE on tombstones', text: 'A null value is a legitimate record on a compacted topic.' },
    { title: 'Publishing deltas to a compacted topic', text: 'Only the last delta survives, so replay produces nonsense.' },
    { title: 'segment.ms larger than retention.ms', text: 'The active segment keeps everything alive far past the window.' },
    { title: 'Serving traffic before the bootstrap completes', text: 'Wrong answers that quietly correct themselves.' },
  ],

  cheatsheet: [
    { label: 'delete policy', value: 'drop whole expired segments' },
    { label: 'compact policy', value: 'keep the newest per key, forever' },
    { label: 'retention.bytes', value: 'PER PARTITION' },
    { label: 'Real disk', value: '× partitions × replication factor' },
    { label: 'Deletion granularity', value: 'a whole segment' },
    { label: 'Active segment', value: 'never deleted or compacted' },
    { label: 'Compaction needs', value: 'a non-null key' },
    { label: 'Delete a key', value: 'publish a null value (tombstone)' },
    { label: 'Tombstone lifetime', value: 'delete.retention.ms' },
    { label: 'Compaction trigger', value: 'min.cleanable.dirty.ratio' },
    { label: 'Both policies', value: 'compact,delete' },
    { label: 'Compacted topic =', value: 'a replayable key-value table' },
    { label: 'Bootstrap rule', value: 'ready only when lag ≈ 0' },
  ],

  problems: [
    { name: 'Watch segments roll', difficulty: 'Easy', pattern: 'Storage', insight: 'Set segment.bytes small, produce steadily, and list the partition directory as new .log files appear.' },
    { name: 'Expire data with retention', difficulty: 'Easy', pattern: 'Retention', insight: 'Set retention.ms to 60 seconds, produce, wait, and confirm old segments disappear — but that the active one survives.' },
    { name: 'Compute real disk usage', difficulty: 'Easy', pattern: 'Sizing', insight: 'For 24 partitions, RF 3 and retention.bytes 50GB, work out the cluster total. Compare with what people assume.' },
    { name: 'Compact a topic', difficulty: 'Medium', pattern: 'Compaction', insight: 'Publish K1 five times with different values, force compaction with a low dirty ratio, then replay from zero and confirm you see only the newest.' },
    { name: 'Delete a key with a tombstone', difficulty: 'Medium', pattern: 'Tombstones', insight: 'Publish a null value and confirm a replaying consumer receives a record with a null value — then that it disappears after delete.retention.ms.' },
    { name: 'NPE on a tombstone', difficulty: 'Medium', pattern: 'Consumer robustness', insight: 'Write a consumer that assumes a non-null value and watch it fail on the delete. Then handle it properly.' },
    { name: 'Bootstrap a cache from a compacted topic', difficulty: 'Hard', pattern: 'Changelog', insight: 'Load 100k keys from offset 0 into a local map and verify the count matches the distinct key count, not the message count.' },
    { name: 'Serve traffic mid-bootstrap', difficulty: 'Hard', pattern: 'Readiness', insight: 'Answer queries while still replaying and count the wrong answers. Then gate readiness on lag and repeat.' },
    { name: 'Break compaction with null keys', difficulty: 'Medium', pattern: 'Compaction rules', insight: 'Produce null-keyed records to a compacted topic and confirm they never disappear regardless of how much you compact.' },
    { name: 'Combine compact and delete', difficulty: 'Hard', pattern: 'Policies', insight: 'Set cleanup.policy=compact,delete with a short retention and observe both behaviours: latest-per-key, and old data removed entirely.' },
  ],
}
