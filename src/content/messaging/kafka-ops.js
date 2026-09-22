export default {
  id: 'kafka-ops',
  title: 'Operating & Tuning Kafka',
  short: 'Operations',
  icon: 'MonitorHeartRounded',
  tier: 'Elite',
  order: 18,
  estHours: 5,
  prereqs: ['kafka-architecture', 'kafka-consumer'],
  tagline: 'Four metrics catch most incidents. Learn those before you learn the other four hundred.',
  mentalModel:
    'A Kafka deployment fails in a small number of ways: consumers fall behind, replicas fall behind, a partition has no leader, or one partition is hot. Everything else is detail. Monitor those four, and tune only after you have measured which one is binding.',
  whyItMatters:
    'Kafka rarely fails loudly. It degrades — lag creeps up, a replica drops out, one partition stalls — and the first sign is usually a customer complaint. The alerts in this chapter are what turn that into a page at 2am instead of an incident review on Monday.',

  reference: {
    title: 'The metrics that matter, in priority order',
    head: ['Metric', 'Healthy', 'Alert when', 'Means'],
    rows: [
      ['**Consumer lag (max by partition)**', 'Low and flat', 'Rising for 5+ min', 'Consumers cannot keep up, or one is stuck'],
      ['**UnderReplicatedPartitions**', '0', '> 0 for 5+ min', 'A broker is lagging or down'],
      ['**OfflinePartitionsCount**', '0', '> 0 immediately', 'Partitions unavailable — an outage'],
      ['**ActiveControllerCount**', 'Exactly 1 cluster-wide', '≠ 1', 'Split brain or no controller'],
      ['Request handler idle ratio', '> 0.3', '< 0.2', 'Brokers are saturated'],
      ['Produce/fetch p99 latency', 'Stable', 'Sustained rise', 'Disk, network or GC pressure'],
      ['Disk usage per broker', '< 70%', '> 80%', 'Retention or partition growth'],
      ['DLQ depth and oldest age', '0', 'Any sustained value', 'Messages failing permanently'],
    ],
  },

  sections: [
    {
      id: 'lag',
      title: 'Lag: the one metric to get right',
      blocks: [
        {
          t: 'ascii',
          caption: 'Four lag shapes, four different problems.',
          code: `
  A. HEALTHY                      B. UNDER-PROVISIONED
     lag                             lag
      │  ╱╲    ╱╲   ╱╲                │           ╱
      │ ╱  ╲  ╱  ╲ ╱  ╲               │       ╱─╯
      │╱    ╲╱    ╲    ╲              │   ╱─╯
      └──────────────── time          └──────────── time
     spikes and drains              never drains → add consumers
                                    (up to the partition count)

  C. ONE STUCK PARTITION           D. SAWTOOTH ON DEPLOY
     lag by partition                 lag
      p0 ▏                             │    ╱╲      ╱╲
      p1 ▏                             │   ╱  ╲    ╱  ╲
      p2 ████████████████              │  ╱    ╲──╯    ╲──
      p3 ▎                             └──────────────── time
     poison message or hot key        rebalance pauses — normal,
     → aggregate lag hides this       unless the spikes grow

  This is why the alert must be max(lag) BY PARTITION.
  Case C is invisible in the aggregate until it is very large.`,
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'Reading lag, three ways',
          code: `
# CLI — the quickest answer during an incident
kafka-consumer-groups --bootstrap-server localhost:9092 \\
    --describe --group payment-service

# GROUP  TOPIC  PARTITION  CURRENT-OFFSET  LOG-END-OFFSET  LAG  CONSUMER-ID
# payment orders  0          148302          148310          8    consumer-1
# payment orders  1          148295          148310         15    consumer-2
# payment orders  2           12043          148310     136267    consumer-3  ◀──
#                                                                   stuck

# From the client — records-lag-max is exposed per partition
management.metrics.export.prometheus.enabled=true
# kafka_consumer_fetch_manager_records_lag_max{partition="2"}

# Alert rule
- alert: KafkaConsumerLagStuck
  expr: max by (group, topic, partition) (kafka_consumer_lag) > 10000
  for: 5m`,
        },
        {
          t: 'key',
          title: 'Lag in messages, time-to-drain in seconds',
          text: 'A lag of 100,000 on a topic doing a million a second is four seconds behind. A lag of 500 on a topic doing ten a second is nearly a minute behind. The number that matters to a human is **estimated time to drain** — lag divided by consumption rate. Alert on that where you can.',
        },
      ],
    },
    {
      id: 'cluster',
      title: 'Cluster health and the operations you will actually run',
      blocks: [
        {
          t: 'code',
          lang: 'java',
          caption: 'The commands worth knowing before you need them',
          code: `
# Is anything under-replicated right now?
kafka-topics --bootstrap-server localhost:9092 --describe --under-replicated-partitions

# Is anything offline? (this is an outage)
kafka-topics --bootstrap-server localhost:9092 --describe --unavailable-partitions

# Add partitions — remember this breaks per-key ordering for keys in flight
kafka-topics --alter --topic orders --partitions 24

# Change a topic config without a restart
kafka-configs --alter --entity-type topics --entity-name orders \\
    --add-config retention.ms=1209600000

# Move partitions between brokers (after adding one)
kafka-reassign-partitions --generate --topics-to-move-json-file topics.json \\
    --broker-list "1,2,3,4"
kafka-reassign-partitions --execute --reassignment-json-file plan.json
kafka-reassign-partitions --verify  --reassignment-json-file plan.json

# Reset a consumer group (the group must be STOPPED)
kafka-consumer-groups --group payment-service --topic orders \\
    --reset-offsets --to-datetime 2026-09-22T10:00:00.000 --execute`,
        },
        {
          t: 'warn',
          title: 'Reassignment is not free',
          text: 'Moving a partition copies its entire log across the network while the cluster is still serving traffic. On a large topic that is hours of saturated network. Always throttle it (`--throttle`), run it off-peak, and move a few partitions at a time. An unthrottled reassignment is a self-inflicted outage.',
        },
        {
          t: 'ascii',
          caption: 'A rolling restart, done safely.',
          code: `
  For each broker, one at a time:

   1. check UnderReplicatedPartitions == 0      ← do not start if unhealthy
   2. move leadership off this broker
        kafka-leader-election --election-type PREFERRED
   3. stop the broker gracefully (controlled.shutdown.enable=true)
   4. upgrade / restart
   5. WAIT for UnderReplicatedPartitions to return to 0
        ← this is the step people skip, and it is the one that matters
   6. next broker

  Skipping step 5 with replication.factor=3 means two brokers are
  behind at once. One more failure and partitions go offline.`,
        },
      ],
    },
    {
      id: 'tuning',
      title: 'Tuning, in the order that pays',
      blocks: [
        {
          t: 'ol',
          items: [
            '**Fix the application first.** A slow handler, an N+1 query in a consumer, or a synchronous call per message will dominate anything you change in Kafka.',
            '**Batch on the producer.** `linger.ms` 5–20 plus compression is routinely an order of magnitude.',
            '**Scale consumers to the partition count.** Free, until you hit the ceiling.',
            '**Add partitions.** Only then, and knowing it breaks per-key ordering for keys in flight.',
            '**Tune the broker.** Almost never the answer, and easy to make worse.',
          ],
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'The consumer-side settings worth changing',
          code: `
# Fetch more per round trip — fewer, larger requests
fetch.min.bytes: 65536            # wait for 64KB…
fetch.max.wait.ms: 100            # …but no longer than 100ms

# Keep each poll cycle short enough to stay inside max.poll.interval.ms
max.poll.records: 100

# Cooperative rebalancing — much shorter pauses on deploy
partition.assignment.strategy: org.apache.kafka.clients.consumer.CooperativeStickyAssignor

# Broker side, the few that matter:
num.io.threads: 8                 # ≈ number of disks
num.network.threads: 3
num.replica.fetchers: 4           # raise if replication lags
# Leave log.flush.* alone — let the OS page cache do its job.`,
        },
        {
          t: 'key',
          title: 'The broker wants RAM for page cache, not for heap',
          text: 'A Kafka broker heap of 6–8GB is plenty; everything above that should be left to the operating system’s page cache, which is what serves recent reads without touching disk. Giving the JVM 48GB of a 64GB machine is a common and counterproductive mistake — you get longer GC pauses and less caching.',
        },
        {
          t: 'note',
          title: 'Sizing, roughly',
          text: 'Start from throughput: messages per second × average size × replication factor gives write bandwidth per broker. Then retention × that gives disk. Then partitions ≥ peak throughput ÷ per-consumer throughput. Measure the real per-consumer rate rather than guessing it — it is almost always lower than people expect.',
        },
      ],
    },
  ],

  patterns: [
    {
      id: 'four-alerts',
      name: 'The Four Alerts',
      oneLiner: 'Per-partition lag, under-replicated, offline partitions, controller count.',
      useWhen: ['Day one of running Kafka.'],
      recognize: ['A dashboard with forty panels and no alerts.', 'Incidents found by users.'],
      steps: [
        'Alert on `max by partition (lag)` sustained.',
        'Alert on `UnderReplicatedPartitions > 0` for five minutes.',
        'Page immediately on `OfflinePartitionsCount > 0`.',
        'Alert on `ActiveControllerCount != 1`.',
      ],
      complexity: 'Four rules; catches the overwhelming majority of real incidents.',
      gotchas: [
        'Aggregate lag hides a single stuck partition — always group by partition.',
        'Brief under-replication during a rolling restart is expected; alert on duration.',
      ],
      problems: ['Write the four alert rules', 'Trigger each one deliberately'],
    },
    {
      id: 'safe-rolling-restart',
      name: 'Rolling Restart With a Health Gate',
      oneLiner: 'One broker at a time, and wait for full replication before the next.',
      useWhen: ['Upgrades, config changes, node replacement.'],
      recognize: ['A restart script with a fixed sleep between brokers.'],
      steps: [
        'Verify zero under-replicated partitions before starting.',
        'Move preferred leadership off the broker.',
        'Graceful shutdown, restart, then **wait** for replication to catch up.',
        'Only then move to the next.',
      ],
      complexity: 'Slower restarts; no self-inflicted outages.',
      gotchas: [
        '`controlled.shutdown.enable` must be true or leadership moves abruptly.',
        'A fixed sleep is not a health check — large partitions take much longer to catch up than small ones.',
      ],
      problems: ['Script a gated rolling restart', 'Show what a fast restart does to the ISR'],
    },
    {
      id: 'capacity-from-measurement',
      name: 'Size From Measurement, Not From Guesses',
      oneLiner: 'Measure per-consumer throughput, then derive partitions and brokers.',
      useWhen: ['Creating a topic, or planning growth.'],
      recognize: ['Partition counts chosen because they looked reasonable.', 'Disk filling unexpectedly.'],
      steps: [
        'Measure one consumer’s real throughput under production-like work.',
        'partitions ≥ peak rate ÷ that, with headroom.',
        'disk = rate × size × retention × replication factor, per broker, plus 30%.',
      ],
      complexity: 'An afternoon of measurement; avoids a migration later.',
      gotchas: [
        '`retention.bytes` is per partition — multiply it out.',
        'Partitions can be added but never removed.',
        'Leave disk headroom; a full disk takes a broker offline.',
      ],
      problems: ['Measure per-consumer throughput', 'Compute disk for a real topic'],
    },
  ],

  pitfalls: [
    { title: 'Alerting on aggregate lag', text: 'One stuck partition hides inside the total for a long time.' },
    { title: 'No alert on offline partitions', text: 'That is an outage, and it is silent from the application side.' },
    { title: 'Unthrottled partition reassignment', text: 'Saturates the network and degrades the whole cluster.' },
    { title: 'Rolling restart without waiting for the ISR', text: 'Two brokers behind at once; one more failure takes partitions offline.' },
    { title: 'A huge broker heap', text: 'Starves the page cache and lengthens GC pauses.' },
    { title: 'Tuning the broker before the application', text: 'The handler is almost always the bottleneck.' },
    { title: 'Adding partitions casually', text: 'Rehashes keys and breaks per-key ordering during the transition.' },
    { title: 'Letting a disk fill', text: 'The broker stops. Alert at 80%, not at 95%.' },
    { title: 'Resetting offsets on a running group', text: 'It is rejected — the group must be stopped first.' },
  ],

  cheatsheet: [
    { label: 'Alert 1', value: 'max lag BY PARTITION' },
    { label: 'Alert 2', value: 'UnderReplicatedPartitions > 0' },
    { label: 'Alert 3', value: 'OfflinePartitionsCount > 0' },
    { label: 'Alert 4', value: 'ActiveControllerCount != 1' },
    { label: 'Human metric', value: 'time to drain = lag ÷ rate' },
    { label: 'Inspect a group', value: 'kafka-consumer-groups --describe' },
    { label: 'Under-replicated', value: '--under-replicated-partitions' },
    { label: 'Reassignment', value: 'always --throttle' },
    { label: 'Rolling restart', value: 'wait for ISR between brokers' },
    { label: 'Broker heap', value: '6-8GB; rest to page cache' },
    { label: 'Tune first', value: 'the application handler' },
    { label: 'Then', value: 'linger + compression' },
    { label: 'Then', value: 'consumers up to partition count' },
    { label: 'Disk alert', value: 'at 80%' },
    { label: 'Reset offsets', value: 'group must be stopped' },
  ],

  problems: [
    { name: 'Read a consumer group description', difficulty: 'Easy', pattern: 'Diagnostics', insight: 'Run --describe under load and identify current offset, log-end offset, lag and which consumer owns each partition.' },
    { name: 'Hide a stuck partition in aggregate lag', difficulty: 'Medium', pattern: 'Alerting', insight: 'Block one partition and chart both total lag and max-by-partition. Note how much later the total reacts.' },
    { name: 'Write the four alert rules', difficulty: 'Medium', pattern: 'Alerting', insight: 'Prometheus rules with sensible for-durations. Then trigger each one deliberately and confirm it fires.' },
    { name: 'Compute time to drain', difficulty: 'Medium', pattern: 'Metrics', insight: 'Divide lag by consumption rate and present it in seconds. Compare how differently two equal lag numbers read.' },
    { name: 'Break replication deliberately', difficulty: 'Hard', pattern: 'Cluster health', insight: 'Pause a broker container and watch UnderReplicatedPartitions rise, then recover when you unpause it.' },
    { name: 'Take partitions offline', difficulty: 'Hard', pattern: 'Outage', insight: 'With RF=3 and min.isr=2, stop two brokers. Observe offline partitions and producer failures — and that failing is the correct behaviour.' },
    { name: 'Do a gated rolling restart', difficulty: 'Hard', pattern: 'Operations', insight: 'Script it with an ISR health check between brokers. Then do it without the check and compare the ISR graphs.' },
    { name: 'Reassign partitions with and without a throttle', difficulty: 'Hard', pattern: 'Reassignment', insight: 'Add a broker and move partitions to it. Measure produce latency during an unthrottled move versus a throttled one.' },
    { name: 'Measure per-consumer throughput', difficulty: 'Medium', pattern: 'Sizing', insight: 'Benchmark one consumer doing realistic work, then compute the partition count you actually need.' },
    { name: 'Compute disk for a real topic', difficulty: 'Medium', pattern: 'Sizing', insight: 'Rate × size × retention × replication factor, divided across brokers. Compare with what the topic config implies.' },
  ],
}
