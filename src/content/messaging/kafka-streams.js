export default {
  id: 'kafka-streams',
  title: 'Kafka Streams & Stateful Processing',
  short: 'Kafka Streams',
  icon: 'TimelineRounded',
  tier: 'Elite',
  order: 16,
  estHours: 6,
  prereqs: ['kafka-exactly-once', 'kafka-storage'],
  tagline: 'A library, not a cluster. Your service does the processing; Kafka holds the state.',
  mentalModel:
    'Kafka Streams turns a topic into something you can `map`, `filter`, `join` and `aggregate` — but the state lives in a **local store backed by a Kafka topic**. That changelog is the trick: state is fast because it is local, and durable because it is replicated to Kafka. Lose the instance and the store is rebuilt from the changelog.',
  whyItMatters:
    'The moment you need "count per customer in the last hour" or "join orders with customers", a plain consumer forces you to invent state management, windowing and recovery. Streams gives you all three, with exactly-once, in a library you deploy like any other service.',

  reference: {
    title: 'Streams and tables',
    head: ['Abstraction', 'Is', 'A record means', 'Example'],
    rows: [
      ['**KStream**', 'An unbounded sequence of events', 'Something happened', '`OrderPlaced`'],
      ['**KTable**', 'The latest value per key', 'This key is now *X*', '`CustomerTier`'],
      ['**GlobalKTable**', 'A full copy on every instance', 'Reference data', 'Country codes'],
      ['**State store**', 'A local RocksDB or in-memory map', 'Working state', 'Running totals'],
      ['**Changelog topic**', 'A compacted topic backing a store', 'Durability', '`app-store-changelog`'],
    ],
  },

  sections: [
    {
      id: 'duality',
      title: 'Stream-table duality',
      blocks: [
        {
          t: 'ascii',
          caption: 'The same records, read two ways. This is the central idea.',
          code: `
  Records arriving on a topic, keyed by customer:

     ("c-1", 100)   ("c-2", 50)   ("c-1", 175)   ("c-2", 50)

  AS A KSTREAM — four independent events
     c-1 spent 100
     c-2 spent 50
     c-1 spent 175
     c-2 spent 50
     (a log of what happened)

  AS A KTABLE — an upsert per key, latest wins
     ┌───────┬───────┐        ┌───────┬───────┐
     │ c-1   │  100  │  ───▶  │ c-1   │  175  │   ← overwritten
     │ c-2   │   50  │        │ c-2   │   50  │
     └───────┴───────┘        └───────┴───────┘
     (the current state)

  A stream aggregated becomes a table.
  A table's changes emitted become a stream.
  That symmetry is why Kafka can be both transport and state.`,
        },
        {
          t: 'key',
          title: 'Choose the abstraction by what a record means',
          text: 'If a record is a **fact that happened** — a click, a payment, an order — it is a stream. If it is **the new value of something** — a customer’s tier, a product’s price — it is a table. Getting this wrong produces code that fights you: summing a table gives nonsense, and looking up "the current value" in a stream is impossible.',
        },
      ],
    },
    {
      id: 'topology',
      title: 'Building a topology',
      blocks: [
        {
          t: 'code',
          lang: 'java',
          caption: 'Filter, map, aggregate — with the state store implied',
          code: `
StreamsBuilder builder = new StreamsBuilder();

KStream<String, OrderPlaced> orders =
        builder.stream("orders", Consumed.with(Serdes.String(), orderSerde));

// Stateless
orders.filter((key, order) -> order.total().compareTo(THRESHOLD) > 0)
      .mapValues(OrderPlaced::toSummary)
      .to("large-orders");

// Stateful — Streams creates a state store AND a changelog topic for you
KTable<String, Long> ordersPerCustomer = orders
        .groupByKey()
        .count(Materialized.as("orders-per-customer"));
//               ▲
//   creates: local RocksDB store "orders-per-customer"
//            changelog topic "app-id-orders-per-customer-changelog"
//            (compacted, so the store can always be rebuilt)

ordersPerCustomer.toStream().to("order-counts",
        Produced.with(Serdes.String(), Serdes.Long()));

KafkaStreams streams = new KafkaStreams(builder.build(), props);
streams.start();
Runtime.getRuntime().addShutdownHook(new Thread(streams::close));`,
        },
        {
          t: 'ascii',
          caption: 'Where state actually lives, and how it survives a crash.',
          code: `
  INSTANCE 1                              KAFKA
  ┌────────────────────────┐
  │ partition 0, 1         │
  │                        │   writes    ┌──────────────────────────┐
  │  RocksDB state store ──┼────────────▶│ …-changelog (compacted)  │
  │  (on local disk)       │             └──────────────────────────┘
  └────────────────────────┘                        │
                                                    │ on restart or
  INSTANCE 1 CRASHES                                │ reassignment
                                                    ▼
  INSTANCE 2 takes over partitions 0,1     replay the changelog
  ┌────────────────────────┐               into a fresh local store
  │  rebuild store from ◀──┼───────────────────────┘
  │  the changelog         │
  └────────────────────────┘

  Fast because reads are local. Durable because writes are replicated.
  Rebuild time is the main operational cost — see standby replicas.`,
        },
        {
          t: 'tip',
          title: 'Standby replicas make failover fast',
          text: 'Rebuilding a large store from its changelog can take minutes, during which those partitions are not processed. `num.standby.replicas=1` keeps a warm copy on another instance, so takeover is near-instant. It costs disk and a little network, and it is almost always worth it for large stores.',
        },
      ],
    },
    {
      id: 'joins-windows',
      title: 'Joins and windows',
      blocks: [
        {
          t: 'code',
          lang: 'java',
          caption: 'The three joins you will actually use',
          code: `
// 1. STREAM-TABLE — enrich each event with current reference data.
//    The most common join by far. No window: the table is always "now".
KTable<String, Customer> customers =
        builder.table("customers", Consumed.with(Serdes.String(), customerSerde));

orders.selectKey((k, order) -> order.customerId())     // rekey to join
      .join(customers, (order, customer) ->
              new EnrichedOrder(order, customer.name(), customer.tier()))
      .to("enriched-orders");

// 2. STREAM-STREAM — correlate two event streams, which REQUIRES a window
//    because you must decide how long to wait for the other side.
KStream<String, Payment> payments = builder.stream("payments");

orders.join(payments,
        (order, payment) -> new OrderPayment(order, payment),
        JoinWindows.ofTimeDifferenceWithNoGrace(Duration.ofMinutes(5)))
      .to("order-payments");

// 3. GLOBAL TABLE — small reference data, fully copied to every instance.
//    No rekeying needed, no co-partitioning required.
GlobalKTable<String, Country> countries = builder.globalTable("countries");
orders.join(countries, (k, order) -> order.countryCode(), OrderPlaced::withCountry);`,
        },
        {
          t: 'warn',
          title: 'Co-partitioning is the requirement people trip over',
          text: 'A `KStream`-`KTable` join needs both topics to have the **same number of partitions** and the **same key**, so matching records land on the same instance. If they do not, Streams throws at startup — which is the good case. Rekey with `selectKey` followed by a repartition, and accept that this writes a new internal topic.',
        },
        {
          t: 'ascii',
          caption: 'Windowing: tumbling, hopping, session.',
          code: `
  TUMBLING — fixed, non-overlapping. "Orders per hour."
   ├────────┤├────────┤├────────┤
   09:00    10:00     11:00     12:00

  HOPPING — fixed size, advancing by less. "Last hour, every 10 min."
   ├────────┤
       ├────────┤
           ├────────┤     windows overlap; one record lands in several

  SESSION — driven by inactivity. "One user's browsing session."
   ├──┤  ├─────────┤        ├──┤
       gap      gap > inactivity → a new session begins

  Code:
    .windowedBy(TimeWindows.ofSizeWithNoGrace(Duration.ofHours(1)))
    .windowedBy(TimeWindows.ofSizeAndGrace(Duration.ofHours(1),
                                           Duration.ofMinutes(5)))
    .windowedBy(SessionWindows.ofInactivityGapWithNoGrace(Duration.ofMinutes(30)))`,
        },
        {
          t: 'key',
          title: 'Event time, not processing time',
          text: 'Streams windows by the **timestamp in the record**, not when it was processed. A message delayed by a retry still lands in the window it belongs to. `grace` decides how long a window stays open for late arrivals — after that, late records are dropped. Set it from how late your data realistically gets, and monitor the dropped-records metric.',
        },
      ],
    },
    {
      id: 'when',
      title: 'When Streams is and is not the answer',
      blocks: [
        {
          t: 'compare',
          left: {
            title: 'Use Kafka Streams',
            items: [
              'Stateful processing: aggregations, counts, running totals',
              'Joining two Kafka topics',
              'Windowed analytics on event time',
              'Exactly-once inside Kafka',
              'You want a library, not a cluster to operate',
            ],
          },
          right: {
            title: 'Use a plain consumer',
            items: [
              'Stateless processing — call an API, write a row',
              'The sink is a database, not a topic',
              'You need per-message retry and DLQ semantics',
              'The logic is simple and a topology adds only indirection',
              'You need to call slow external services per message',
            ],
          },
        },
        {
          t: 'note',
          title: 'Interactive queries: the state store as a read model',
          text: 'A store is queryable from inside the application, so a Streams app can serve HTTP requests directly from its aggregates — no separate database. `streams.store(...)` plus a metadata lookup to find which instance owns a key. It is elegant, and it means your service now owns state, with all the rebalancing and rebuild-time consequences that implies.',
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'Serving a query from the local store',
          code: `
ReadOnlyKeyValueStore<String, Long> store = streams.store(
        StoreQueryParameters.fromNameAndType(
                "orders-per-customer", QueryableStoreTypes.keyValueStore()));

@GetMapping("/customers/{id}/order-count")
public long orderCount(@PathVariable String id) {
    // This instance may not own the key — find who does
    KeyQueryMetadata metadata =
            streams.queryMetadataForKey("orders-per-customer", id, Serdes.String().serializer());

    if (!metadata.activeHost().equals(thisHost)) {
        return remoteCall(metadata.activeHost(), id);     // forward it
    }
    return store.get(id);
}`,
        },
      ],
    },
  ],

  patterns: [
    {
      id: 'stream-table-join',
      name: 'Enrich a Stream From a Table',
      oneLiner: 'Join events against the current state of reference data, locally.',
      useWhen: ['Adding customer, product or pricing detail to an event stream.'],
      recognize: ['A consumer calling another service once per message.', 'N+1 over HTTP.'],
      steps: [
        'Publish the reference data to a compacted topic keyed by id.',
        'Read it as a `KTable` (or `GlobalKTable` if small).',
        'Rekey the stream to match, then join.',
      ],
      complexity: 'Local lookups instead of network calls; the table is replicated to each instance.',
      gotchas: [
        'Co-partitioning is required for a `KTable` join — same partition count, same key.',
        '`GlobalKTable` avoids that but copies the whole table to every instance; keep it small.',
        'The join sees the table as of the event’s time, which is usually what you want.',
      ],
      problems: ['Replace an HTTP enrichment with a join', 'Trigger a co-partitioning error'],
    },
    {
      id: 'windowed-aggregate',
      name: 'Windowed Aggregation on Event Time',
      oneLiner: 'Count, sum or detect patterns over a time window that respects when things happened.',
      useWhen: ['Rate limiting, fraud detection, per-period metrics.'],
      recognize: ['Aggregations computed with wall-clock time that break when messages are delayed.'],
      steps: [
        'Choose the window type — tumbling for reporting periods, hopping for rolling metrics, session for user activity.',
        'Set `grace` from how late your data realistically arrives.',
        'Emit with `suppress` if you only want the final result per window.',
      ],
      template: {
        lang: 'java',
        caption: 'Suppress so you emit once per window, not on every update',
        code: `
orders.groupByKey()
      .windowedBy(TimeWindows.ofSizeAndGrace(
              Duration.ofHours(1), Duration.ofMinutes(5)))
      .count()
      .suppress(Suppressed.untilWindowCloses(
              Suppressed.BufferConfig.unbounded()))     // one result per window
      .toStream()
      .to("hourly-order-counts");`,
      },
      complexity: 'State proportional to the number of open windows × keys.',
      gotchas: [
        '`suppress` with an unbounded buffer can grow large — bound it and decide what happens when it is full.',
        'Records later than the grace period are dropped silently. Monitor the dropped-records metric.',
      ],
      problems: ['Count orders per hour', 'Drop a late record and detect it'],
    },
    {
      id: 'standby-replicas',
      name: 'Standby Replicas for Fast Failover',
      oneLiner: 'Keep a warm copy of each state store so takeover does not mean a rebuild.',
      useWhen: ['Any Streams app with a large state store.'],
      recognize: ['Minutes of unavailability after a deploy or an instance failure.'],
      steps: ['Set `num.standby.replicas=1`.', 'Size disk for the extra copies.', 'Measure recovery time before and after.'],
      complexity: 'Extra disk and replication traffic; near-instant failover.',
      gotchas: [
        'Standbys consume changelog partitions continuously, so they add network load.',
        'Standbys do not help the very first startup — that is always a full rebuild.',
      ],
      problems: ['Time a rebuild without standbys', 'Add one and compare'],
    },
  ],

  pitfalls: [
    { title: 'Using a KStream where a KTable is meant', text: 'Aggregating a stream of "new values" double-counts. Read state as a table.' },
    { title: 'Joining topics that are not co-partitioned', text: 'Fails at startup, or silently misses matches if you force it.' },
    { title: 'GlobalKTable on a large topic', text: 'Every instance holds a full copy. It will not fit.' },
    { title: 'No grace period', text: 'Late records are dropped immediately, silently skewing every aggregate.' },
    { title: 'Unbounded suppress buffers', text: 'Memory grows with the number of open windows.' },
    { title: 'No standby replicas with a large store', text: 'Every deploy causes minutes of unavailability.' },
    { title: 'Calling slow external services in a topology', text: 'It blocks the processing thread. Use a plain consumer for that.' },
    { title: 'Changing the topology without thinking about state', text: 'Some changes invalidate the store and force a full rebuild from the changelog.' },
    { title: 'Forgetting streams.close()', text: 'A missing shutdown hook means an unclean exit and a rebalance on every restart.' },
  ],

  cheatsheet: [
    { label: 'KStream', value: 'events — facts that happened' },
    { label: 'KTable', value: 'latest value per key' },
    { label: 'GlobalKTable', value: 'full copy per instance; keep it small' },
    { label: 'State lives', value: 'locally, in RocksDB' },
    { label: 'Durability', value: 'a compacted changelog topic' },
    { label: 'Fast failover', value: 'num.standby.replicas=1' },
    { label: 'Stream-table join', value: 'enrichment, no window' },
    { label: 'Stream-stream join', value: 'requires a window' },
    { label: 'Join requires', value: 'co-partitioning' },
    { label: 'Windows use', value: 'event time, not clock time' },
    { label: 'Late data', value: 'grace period, then dropped' },
    { label: 'One result per window', value: 'suppress(untilWindowCloses)' },
    { label: 'Exactly-once', value: 'EXACTLY_ONCE_V2' },
    { label: 'Query the store', value: 'interactive queries' },
    { label: 'Not for', value: 'slow external calls per message' },
  ],

  problems: [
    { name: 'Build a filter-and-map topology', difficulty: 'Easy', pattern: 'Stateless', insight: 'Filter large orders into a new topic. Note that no state store is created for stateless operations.' },
    { name: 'Count events per key', difficulty: 'Medium', pattern: 'Stateful', insight: 'groupByKey().count() and then find the auto-created changelog topic. Confirm it is compacted.' },
    { name: 'Rebuild state after a crash', difficulty: 'Medium', pattern: 'Recovery', insight: 'Kill the app, delete the local state directory, restart, and watch it replay the changelog to rebuild.' },
    { name: 'Time a rebuild with a large store', difficulty: 'Hard', pattern: 'Standbys', insight: 'Build a store with a million keys and measure the restore time. Add num.standby.replicas=1 and measure failover again.' },
    { name: 'Enrich a stream from a table', difficulty: 'Medium', pattern: 'Joins', insight: 'Join orders to customers. Compare the latency with making an HTTP call per order.' },
    { name: 'Trigger a co-partitioning error', difficulty: 'Medium', pattern: 'Joins', insight: 'Join topics with different partition counts and read the startup exception. Fix it by rekeying.' },
    { name: 'Window a count per hour', difficulty: 'Medium', pattern: 'Windowing', insight: 'Tumbling windows on event time. Publish a record with an old timestamp and confirm it lands in the correct window.' },
    { name: 'Drop a late record', difficulty: 'Hard', pattern: 'Grace', insight: 'Publish a record later than the grace period and find it in the dropped-records metric rather than in the aggregate.' },
    { name: 'Emit once per window with suppress', difficulty: 'Hard', pattern: 'Suppression', insight: 'Compare output with and without suppress. Without it you get an update per input record.' },
    { name: 'Serve HTTP from a state store', difficulty: 'Hard', pattern: 'Interactive queries', insight: 'Query the store directly, then handle the case where another instance owns the key by forwarding the request.' },
  ],
}
