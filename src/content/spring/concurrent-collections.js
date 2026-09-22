export default {
  id: 'concurrent-collections',
  title: 'Concurrent Collections & Atomics',
  short: 'Concurrent Collections',
  icon: 'SyncAltRounded',
  tier: 'Core',
  order: 9,
  estHours: 5,
  prereqs: ['synchronization', 'collections'],
  tagline: 'Purpose-built thread-safe collections beat anything you wrap in a lock.',
  mentalModel:
    'A synchronized wrapper puts **one** lock around the whole collection, so every thread queues. A concurrent collection is designed from the inside out for concurrency — fine-grained locking or none at all. Same interface, completely different behaviour under load.',
  whyItMatters:
    'Shared caches, registries, counters and queues appear in every real service. Choosing the right structure removes whole categories of bug, and knowing why `ConcurrentHashMap` scales while `synchronizedMap` does not is a standard senior interview question.',

  reference: {
    title: 'Which concurrent collection, and when',
    head: ['Need', 'Use', 'How it achieves safety'],
    rows: [
      ['Shared map', '`ConcurrentHashMap`', 'Per-bin locking; reads are lock-free'],
      ['Shared list, read-heavy', '`CopyOnWriteArrayList`', 'Writes copy the whole array; reads never lock'],
      ['Shared set', '`ConcurrentHashMap.newKeySet()`', 'Backed by a ConcurrentHashMap'],
      ['Producer → consumer handoff', '`ArrayBlockingQueue` (bounded)', 'Blocks producers when full — backpressure'],
      ['Unbounded queue', '`ConcurrentLinkedQueue`', 'Lock-free, but can grow without limit'],
      ['Sorted shared map', '`ConcurrentSkipListMap`', 'Lock-free skip list'],
      ['Delayed / scheduled items', '`DelayQueue`', 'Elements become available at a time'],
      ['Single counter', '`AtomicLong` / `LongAdder`', 'Compare-and-swap; no locks'],
    ],
  },

  sections: [
    {
      id: 'why-not-wrappers',
      title: 'Why synchronizedMap is not the answer',
      blocks: [
        {
          t: 'code',
          lang: 'java',
          caption: 'Thread-safe, and still broken',
          code: `
Map<String, Integer> map = Collections.synchronizedMap(new HashMap<>());

// Each call is atomic. The SEQUENCE is not.
if (!map.containsKey(key)) {        // thread A checks — absent
    map.put(key, 1);                // thread B does the same, both put
}

// Every read and write serialises on ONE lock, so 16 threads take turns.
// And iteration needs manual synchronisation:
synchronized (map) {                // easy to forget
    for (var e : map.entrySet()) { }
}`,
        },
        {
          t: 'key',
          title: 'Individually atomic operations do not compose',
          text: 'This is the central insight. Making each method thread-safe does not make your *logic* thread-safe — check-then-act and read-modify-write are still races. Concurrent collections solve this by giving you **compound operations that are themselves atomic**.',
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'The same intent, done correctly',
          code: `
ConcurrentHashMap<String, Integer> map = new ConcurrentHashMap<>();

map.putIfAbsent(key, 1);                          // atomic check-then-act
map.merge(key, 1, Integer::sum);                  // atomic increment
map.computeIfAbsent(key, k -> expensiveLoad(k));  // atomic load-once
map.compute(key, (k, v) -> v == null ? 1 : v + 1);

// Iteration is safe with no external locking — the iterator is weakly
// consistent: it never throws ConcurrentModificationException and may or
// may not reflect concurrent changes.
for (var e : map.entrySet()) { }`,
        },
      ],
    },
    {
      id: 'chm',
      title: 'ConcurrentHashMap in practice',
      blocks: [
        { t: 'p', text: 'Since Java 8 it locks only the individual bin being modified, and reads are entirely lock-free using volatile reads. Many threads reading and writing different keys never contend at all.' },
        {
          t: 'code',
          lang: 'java',
          caption: 'computeIfAbsent is the one to reach for',
          code: `
private final ConcurrentHashMap<String, Connection> pool = new ConcurrentHashMap<>();

public Connection get(String host) {
    // Guaranteed: the mapping function runs AT MOST ONCE per absent key,
    // even with 100 threads racing for the same host.
    return pool.computeIfAbsent(host, this::openConnection);
}`,
        },
        {
          t: 'trap',
          title: 'Never recursively update the same map inside computeIfAbsent',
          text: 'The mapping function runs while the bin is locked. If it calls back into the *same* map for a key in the same bin, you get a deadlock or, on older versions, an infinite loop. Keep the mapping function simple and self-contained — and never make it do IO that might touch the same cache.',
        },
        {
          t: 'warn',
          title: 'null is not allowed',
          text: '`ConcurrentHashMap` rejects null keys and null values, unlike `HashMap`. The reason is ambiguity: with concurrent access you could not distinguish "absent" from "present but null" without locking. Use a sentinel or `Optional` as the value if you genuinely need to record absence.',
        },
      ],
    },
    {
      id: 'queues',
      title: 'Blocking queues: the producer-consumer handoff',
      blocks: [
        { t: 'p', text: 'A `BlockingQueue` is how one set of threads hands work to another. The blocking behaviour is the feature: a full queue makes producers wait, which is backpressure applied automatically.' },
        {
          t: 'code',
          lang: 'java',
          caption: 'The four flavours of every operation',
          code: `
BlockingQueue<Task> queue = new ArrayBlockingQueue<>(1000);   // BOUNDED

// Insert                          Remove              Behaviour when impossible
queue.add(task);      //           queue.remove()      throws an exception
queue.offer(task);    //           queue.poll()        returns false / null
queue.put(task);      //           queue.take()        BLOCKS until possible
queue.offer(t, 5, SECONDS);  //    queue.poll(5, SECONDS)   blocks with a timeout

// A consumer loop that shuts down cleanly
while (!Thread.currentThread().isInterrupted()) {
    try {
        Task t = queue.take();        // blocks; throws on interrupt
        process(t);
    } catch (InterruptedException e) {
        Thread.currentThread().interrupt();
        break;
    }
}`,
        },
        {
          t: 'key',
          title: 'Always bound the queue',
          text: 'A `LinkedBlockingQueue` with no capacity accepts work forever. When consumers fall behind, memory grows until the JVM dies — and you lose everything in the queue. A bounded queue turns "we ran out of memory" into "producers slowed down", which is a far better failure.',
        },
        {
          t: 'dl',
          items: [
            { term: '`ArrayBlockingQueue`', def: 'Fixed capacity, one lock, array-backed. The sensible default for a bounded handoff.' },
            { term: '`LinkedBlockingQueue`', def: 'Optionally bounded, separate head and tail locks so producers and consumers contend less. Pass a capacity.' },
            { term: '`SynchronousQueue`', def: 'Zero capacity — a producer blocks until a consumer takes the item. Direct handoff, used by `newCachedThreadPool`.' },
            { term: '`PriorityBlockingQueue`', def: 'Unbounded, ordered by comparator. Useful for prioritised work, but watch the memory.' },
          ],
        },
      ],
    },
    {
      id: 'others',
      title: 'Copy-on-write, and when atomics win',
      blocks: [
        {
          t: 'code',
          lang: 'java',
          caption: 'CopyOnWriteArrayList: perfect for listeners, terrible for anything else',
          code: `
// Every write copies the entire backing array. Reads never lock at all.
private final List<Listener> listeners = new CopyOnWriteArrayList<>();

public void register(Listener l) { listeners.add(l); }     // O(n) — rare

public void publish(Event e) {
    for (Listener l : listeners) l.onEvent(e);             // lock-free — frequent
}
// The iterator sees a snapshot, so a listener may register during iteration
// without any exception — and simply will not receive this event.`,
        },
        {
          t: 'note',
          title: 'The rule for copy-on-write',
          text: 'Use it when reads outnumber writes by orders of magnitude and the collection is small — listener lists, configuration lists, route tables. Using it for anything that is written in a loop turns O(n) work into O(n²).',
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'Atomics: the right tool for one variable',
          code: `
// Counters
private final AtomicLong requests = new AtomicLong();
requests.incrementAndGet();

// Very hot counters: LongAdder keeps per-thread cells and sums on read
private final LongAdder hits = new LongAdder();
hits.increment();                     // scales far better under contention
long total = hits.sum();

// Swapping an immutable object atomically
private final AtomicReference<RouteTable> routes =
        new AtomicReference<>(RouteTable.empty());

public void addRoute(Route r) {
    routes.updateAndGet(table -> table.with(r));   // retries until it wins
}
// The lambda may run MORE THAN ONCE — it must be pure and side-effect free.`,
        },
        {
          t: 'trap',
          title: 'CAS lambdas must be side-effect free',
          text: '`updateAndGet` and `compute` retry when another thread wins the race, so your function can run several times for one logical update. If it increments a counter, writes a log line or calls a service, that happens repeatedly. Keep it a pure function of the old value.',
        },
      ],
    },
  ],

  patterns: [
    {
      id: 'atomic-compound-ops',
      name: 'Use the Atomic Compound Operation',
      oneLiner: 'merge, computeIfAbsent and putIfAbsent replace check-then-act races.',
      useWhen: ['Counting, caching, or lazily initialising entries in a shared map.'],
      recognize: ['`if (!map.containsKey(k)) map.put(...)`.', '`map.put(k, map.getOrDefault(k, 0) + 1)`.'],
      steps: ['Identify the check-then-act or read-modify-write.', 'Replace it with the single atomic method that expresses the same intent.'],
      template: {
        lang: 'java',
        caption: 'Four races, four one-line fixes',
        code: `
map.putIfAbsent(k, v);                         // insert only if absent
map.merge(k, 1, Integer::sum);                 // counter
map.computeIfAbsent(k, this::load);            // load exactly once
map.compute(k, (key, old) -> transform(old));  // read-modify-write
map.remove(k, expectedValue);                  // conditional remove`,
      },
      complexity: 'Lock-free reads; per-bin locking on write.',
      gotchas: [
        'The mapping function must not touch the same map.',
        'Null values are rejected — a mapping function returning null removes the entry instead.',
      ],
      problems: ['Fix a check-then-act race', 'Prove computeIfAbsent loads once under contention'],
    },
    {
      id: 'bounded-handoff',
      name: 'Bounded Producer-Consumer Handoff',
      oneLiner: 'A bounded BlockingQueue gives you backpressure for free.',
      useWhen: ['Ingest pipelines, batch writers, anything where producers can outpace consumers.'],
      recognize: ['An unbounded queue or list used as a work buffer.', 'Memory growing when a downstream slows down.'],
      steps: [
        'Size the queue from how much work you can afford to lose or buffer.',
        'Producers use `put` (blocks) or `offer` with a timeout (sheds load).',
        'Consumers use `take` in an interruptible loop.',
        'Use a poison pill or interruption to stop cleanly.',
      ],
      template: {
        lang: 'java',
        caption: 'A complete, shutdown-safe pipeline',
        code: `
private final BlockingQueue<Record> queue = new ArrayBlockingQueue<>(10_000);
private static final Record POISON = new Record();

// producer — blocks when full, which slows ingestion instead of exploding
void ingest(Record r) throws InterruptedException { queue.put(r); }

// consumer
void consume() {
    try {
        while (true) {
            Record r = queue.take();
            if (r == POISON) break;
            write(r);
        }
    } catch (InterruptedException e) {
        Thread.currentThread().interrupt();
    }
}

void shutdown() throws InterruptedException {
    for (int i = 0; i < consumerCount; i++) queue.put(POISON);
}`,
      },
      complexity: 'O(1) per item; memory bounded by the capacity.',
      gotchas: [
        'One poison pill per consumer, or some consumers never stop.',
        '`offer` returning false is a load-shedding decision — log and count it.',
      ],
      problems: ['Build a bounded pipeline', 'Watch an unbounded queue exhaust the heap'],
    },
    {
      id: 'atomic-reference-swap',
      name: 'Immutable State Behind an AtomicReference',
      oneLiner: 'Publish a whole new immutable snapshot instead of mutating shared state.',
      useWhen: ['Hot-reloadable configuration, routing tables, feature flags, rate-limit rules.'],
      recognize: ['A shared mutable object guarded by a lock that readers must also take.'],
      steps: ['Make the state object immutable.', 'Hold it in an `AtomicReference` or a `volatile` field.', 'Update by building a new instance and swapping.'],
      complexity: 'Readers are completely lock-free; writers allocate one object.',
      gotchas: [
        'Readers must take a single local copy — reading the field twice can see two different snapshots.',
        '`updateAndGet` may retry, so the function must be pure.',
      ],
      problems: ['Hot-reload config with AtomicReference', 'Show a torn read from two field accesses'],
    },
  ],

  pitfalls: [
    { title: 'Collections.synchronizedMap as a concurrency strategy', text: 'One global lock and no atomic compound operations. Use ConcurrentHashMap.' },
    { title: 'Compound operations on a concurrent collection', text: 'containsKey followed by put is still a race, even on a ConcurrentHashMap.' },
    { title: 'Putting null in a ConcurrentHashMap', text: 'NullPointerException. It is deliberate, not an oversight.' },
    { title: 'Unbounded blocking queues', text: 'Removes the backpressure that makes the pattern safe.' },
    { title: 'CopyOnWriteArrayList for write-heavy data', text: 'Every write copies the array — quadratic behaviour.' },
    { title: 'Side effects inside a CAS lambda', text: 'It can run several times per logical update.' },
    { title: 'Recursive updates inside computeIfAbsent', text: 'Deadlock, because the bin is locked while the function runs.' },
    { title: 'Assuming size() is exact', text: 'On concurrent collections it is an estimate taken without locking.' },
  ],

  cheatsheet: [
    { label: 'Shared map', value: 'ConcurrentHashMap' },
    { label: 'Atomic counter in a map', value: 'merge(k, 1, Integer::sum)' },
    { label: 'Load once', value: 'computeIfAbsent' },
    { label: 'Shared set', value: 'ConcurrentHashMap.newKeySet()' },
    { label: 'Handoff', value: 'ArrayBlockingQueue (bounded)' },
    { label: 'Blocking ops', value: 'put / take' },
    { label: 'Non-blocking ops', value: 'offer / poll' },
    { label: 'Read-heavy list', value: 'CopyOnWriteArrayList' },
    { label: 'Counter', value: 'AtomicLong' },
    { label: 'Hot counter', value: 'LongAdder' },
    { label: 'Swap whole state', value: 'AtomicReference + immutable' },
    { label: 'CAS lambda', value: 'must be pure — may retry' },
    { label: 'No nulls in', value: 'ConcurrentHashMap' },
    { label: 'Iterators', value: 'weakly consistent, never throw CME' },
  ],

  problems: [
    { name: 'Break a synchronizedMap with check-then-act', difficulty: 'Easy', pattern: 'Compound ops', insight: 'Run containsKey/put from 10 threads on the same key and count how many times the value was overwritten. Fix with putIfAbsent.' },
    { name: 'Count safely in a shared map', difficulty: 'Easy', pattern: 'merge', insight: 'Count word frequencies from 8 threads. get/put loses counts; merge does not.' },
    { name: 'Prove computeIfAbsent runs once', difficulty: 'Medium', pattern: 'Load-once', insight: 'Put a counter inside the mapping function and hit the same key from 100 threads. The counter reaches exactly 1.' },
    { name: 'Benchmark ConcurrentHashMap vs synchronizedMap', difficulty: 'Medium', pattern: 'Contention', insight: 'Mixed read/write load at 1, 8 and 32 threads. The gap widens dramatically with thread count.' },
    { name: 'Build a bounded producer-consumer pipeline', difficulty: 'Medium', pattern: 'Blocking queue', insight: 'Fast producer, slow consumer, capacity 100. Watch the producer block instead of memory growing.' },
    { name: 'Exhaust the heap with an unbounded queue', difficulty: 'Medium', pattern: 'Backpressure', insight: 'Same pipeline with LinkedBlockingQueue and no capacity. -Xmx128m gets you an OutOfMemoryError in seconds.' },
    { name: 'Show CopyOnWriteArrayList degrading', difficulty: 'Medium', pattern: 'Copy-on-write', insight: 'Add 100,000 elements to one, and to an ArrayList under a lock. The copy-on-write version is orders of magnitude slower.' },
    { name: 'Hot-reload config with AtomicReference', difficulty: 'Medium', pattern: 'Snapshot swap', insight: 'Readers take one local copy and use it throughout. Swap the reference from another thread and confirm no reader sees a mix.' },
    { name: 'Make a CAS lambda run twice', difficulty: 'Hard', pattern: 'CAS retries', insight: 'Put a print inside updateAndGet and hammer it from 16 threads. The print count exceeds the update count.' },
    { name: 'Compare AtomicLong with LongAdder', difficulty: 'Hard', pattern: 'Contention', insight: 'Increment from 32 threads. LongAdder wins by a wide margin; at one thread AtomicLong is slightly better.' },
  ],
}
