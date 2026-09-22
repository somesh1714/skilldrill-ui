export default {
  id: 'collections',
  title: 'Collections: Choosing the Right One',
  short: 'Collections',
  icon: 'InventoryRounded',
  tier: 'Foundations',
  order: 3,
  estHours: 8,
  prereqs: ['objects-equality'],
  tagline: 'Ten interfaces, forty implementations, and about six you should ever use.',
  mentalModel:
    'Ask three questions in order: do I need **order**, do I need **uniqueness**, do I need **key lookup**? The answers pick the interface. Only then pick an implementation, and the default is nearly always `ArrayList`, `HashMap` or `HashSet`.',
  whyItMatters:
    'Collections are the most-used API in Java and the easiest place to accidentally write quadratic code. Knowing why `ArrayList.remove(0)` is slow and `HashMap.get` is fast is also the bridge between your DSA knowledge and your day job.',

  reference: {
    title: 'Cost of the operations you actually use',
    head: ['Implementation', 'get / contains', 'add', 'remove', 'Keeps order?'],
    rows: [
      ['**ArrayList**', 'O(1) by index, O(n) by value', 'O(1) amortised at end', 'O(n) — shifts elements', 'Insertion order'],
      ['**LinkedList**', 'O(n)', 'O(1) at either end', 'O(1) with an iterator', 'Insertion order'],
      ['**ArrayDeque**', 'O(n)', 'O(1) at either end', 'O(1) at either end', 'Insertion order'],
      ['**HashMap / HashSet**', 'O(1) average', 'O(1) average', 'O(1) average', 'No order at all'],
      ['**LinkedHashMap / Set**', 'O(1) average', 'O(1)', 'O(1)', 'Insertion (or access) order'],
      ['**TreeMap / TreeSet**', 'O(log n)', 'O(log n)', 'O(log n)', 'Sorted'],
      ['**PriorityQueue**', 'O(1) peek min', 'O(log n)', 'O(log n) poll', 'Heap order only'],
    ],
  },

  sections: [
    {
      id: 'choosing',
      title: 'The decision, in three questions',
      blocks: [
        {
          t: 'ascii',
          caption: 'Almost every choice falls out of this.',
          code: `
  Do I look things up BY KEY?
    │
    ├── yes ──▶ Map
    │             ├── plain fast lookup ........... HashMap        ← default
    │             ├── need insertion order ........ LinkedHashMap
    │             ├── need sorted keys / ranges ... TreeMap
    │             └── need thread safety .......... ConcurrentHashMap
    │
    └── no ──▶ Do I need DUPLICATES?
                  │
                  ├── no ──▶ Set
                  │            ├── plain ........... HashSet       ← default
                  │            ├── insertion order . LinkedHashSet
                  │            └── sorted .......... TreeSet
                  │
                  └── yes ─▶ List / Queue
                               ├── index access .... ArrayList     ← default
                               ├── stack or queue .. ArrayDeque
                               └── priority ........ PriorityQueue`,
        },
        {
          t: 'key',
          title: 'Three defaults cover most code',
          text: '`ArrayList`, `HashMap`, `HashSet`. Reach past them only when you can name the reason — "I need the keys sorted", "I need O(1) at both ends", "this is shared between threads". If you cannot name the reason, the default is right.',
        },
      ],
    },
    {
      id: 'lists',
      title: 'Lists: ArrayList versus LinkedList',
      blocks: [
        { t: 'p', text: 'This is the classic interview question, and the honest answer surprises people: **use `ArrayList` almost always**, including for queues of moderate size.' },
        {
          t: 'compare',
          left: {
            title: 'ArrayList — a growable array',
            items: [
              'O(1) access by index',
              'Elements sit next to each other in memory, so scanning is very fast (CPU cache)',
              '12–16 bytes overhead for the whole list',
              'Insert/remove in the middle shifts everything after it',
            ],
          },
          right: {
            title: 'LinkedList — a chain of nodes',
            items: [
              'O(n) access by index — it walks the chain',
              'Every element is a separate object; scanning jumps around memory',
              '~40 bytes of overhead per element',
              'O(1) insert/remove only if you already hold the node',
            ],
          },
        },
        {
          t: 'trap',
          title: 'LinkedList.get(i) in a loop is quadratic',
          text: '`for (int i = 0; i < list.size(); i++) list.get(i)` is O(n) on an ArrayList and **O(n²)** on a LinkedList, because each `get` walks from the head. Use a for-each loop (which uses the iterator) or, better, use an ArrayList.',
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'How ArrayList grows, and why you should presize it',
          code: `
// Default capacity 10. When full it allocates a new array 1.5x the size
// and copies everything across. That copy is O(n), but it happens rarely
// enough that add() is amortised O(1).

List<String> bad  = new ArrayList<>();            // will resize ~13 times for 10k
List<String> good = new ArrayList<>(10_000);      // one allocation, no copying

// Removing from the front shifts every remaining element:
list.remove(0);          // O(n) — fine once, terrible in a loop

// Need a queue? Use ArrayDeque, not LinkedList:
Deque<Task> queue = new ArrayDeque<>();
queue.addLast(task);     // O(1)
Task next = queue.pollFirst();   // O(1), no per-node allocation`,
        },
        {
          t: 'warn',
          title: 'Arrays.asList and List.of are not ArrayLists',
          text: '`Arrays.asList(1,2,3)` returns a fixed-size view — `add` throws `UnsupportedOperationException`. `List.of(...)` is fully immutable and also rejects nulls. Both are great as inputs; neither is a list you can build up. Wrap with `new ArrayList<>(List.of(...))` when you need to modify.',
        },
      ],
    },
    {
      id: 'maps',
      title: 'How HashMap actually works',
      blocks: [
        { t: 'p', text: 'A `HashMap` is an array of buckets. `hash(key)` picks the bucket; entries that land in the same bucket form a short chain. Since Java 8, a bucket that grows past 8 entries converts into a balanced tree, so even a pathological hash degrades to O(log n) rather than O(n).' },
        {
          t: 'ascii',
          caption: 'Load factor 0.75: at 12 entries in 16 buckets it doubles and rehashes.',
          code: `
  buckets (size 16)
   0 │
   1 │ ("dog", 4)
   2 │
   3 │ ("cat", 1) ──▶ ("emu", 7)        ← collision: same bucket, short chain
   …  │
  15 │

  entries / buckets  >  0.75   ──▶  resize to 32 buckets and rehash everything`,
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'The four idioms that replace most map boilerplate',
          code: `
Map<String, Integer> counts = new HashMap<>();
Map<String, List<Order>> byCustomer = new HashMap<>();

counts.merge(word, 1, Integer::sum);                 // count occurrences
counts.getOrDefault(word, 0);                        // read without null checks
byCustomer.computeIfAbsent(id, k -> new ArrayList<>()).add(order);   // group
counts.putIfAbsent(word, 0);                         // only if missing

// Iterate entries — never keySet() plus get(), that is two lookups per item
for (Map.Entry<String, Integer> e : counts.entrySet()) {
    System.out.println(e.getKey() + " = " + e.getValue());
}

// Remove while iterating: only through the iterator, or you get a
// ConcurrentModificationException
counts.entrySet().removeIf(e -> e.getValue() == 0);`,
        },
        {
          t: 'tip',
          title: 'Presize maps too',
          text: 'If you know you will hold `n` entries, construct with `new HashMap<>((int)(n / 0.75f) + 1)` to avoid repeated resizing and rehashing. It matters when n is large and the map is built in a hot path.',
        },
        {
          t: 'note',
          title: 'LinkedHashMap gives you an LRU cache in one override',
          text: 'Construct it with access-order enabled and override `removeEldestEntry` to cap the size. It is the shortest correct LRU in Java — though for anything production-grade, use Caffeine, which adds concurrency, TTL and statistics.',
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'A 20-line LRU cache',
          code: `
class LruCache<K, V> extends LinkedHashMap<K, V> {
    private final int capacity;

    LruCache(int capacity) {
        super(16, 0.75f, true);        // true = ACCESS order, not insertion order
        this.capacity = capacity;
    }

    @Override
    protected boolean removeEldestEntry(Map.Entry<K, V> eldest) {
        return size() > capacity;      // evict the least recently accessed
    }
}`,
        },
      ],
    },
    {
      id: 'sorted-and-queues',
      title: 'When you need order: TreeMap and the queues',
      blocks: [
        { t: 'p', text: '`TreeMap` and `TreeSet` keep keys sorted using a red-black tree. You pay `O(log n)` instead of `O(1)`, and in exchange you get range queries and nearest-neighbour lookups that a `HashMap` simply cannot do.' },
        {
          t: 'code',
          lang: 'java',
          caption: 'The TreeMap methods that justify the cost',
          code: `
TreeMap<LocalDate, Reading> readings = new TreeMap<>();

readings.firstKey();  readings.lastKey();
readings.floorKey(d);          // greatest key <= d   (most recent reading at or before)
readings.ceilingKey(d);        // smallest key >= d
readings.higherKey(d);         // strictly greater
readings.headMap(d);           // everything before d
readings.subMap(from, true, to, true);   // an inclusive range view

// The classic use: "what was the value at this point in time?"
Reading atTime = readings.floorEntry(when).getValue();`,
        },
        {
          t: 'dl',
          items: [
            { term: '`ArrayDeque`', def: 'The correct stack *and* queue. O(1) at both ends, no per-node allocation. Use it instead of `Stack` (which is synchronised and iterates in the wrong direction) and instead of `LinkedList`.' },
            { term: '`PriorityQueue`', def: 'A binary heap. `peek` is O(1), `offer`/`poll` are O(log n). It is **not sorted** — iterating it gives heap order, not ascending order. Only `poll` returns things in order.' },
            { term: '`BlockingQueue`', def: 'The handoff between producer and consumer threads. `ArrayBlockingQueue` is bounded (which is what you want — see the concurrency chapters).' },
          ],
        },
        {
          t: 'trap',
          title: 'Printing a PriorityQueue does not show sorted order',
          text: '`System.out.println(pq)` prints the backing array, which only guarantees that each parent is smaller than its children. To get sorted output you must drain it with repeated `poll()`.',
        },
      ],
    },
    {
      id: 'pitfalls-in-practice',
      title: 'The mistakes that actually reach production',
      blocks: [
        {
          t: 'code',
          lang: 'java',
          caption: 'Modifying a collection while iterating it',
          code: `
// WRONG — throws ConcurrentModificationException
for (Order o : orders) {
    if (o.isCancelled()) orders.remove(o);
}

// RIGHT — removeIf, clear and readable
orders.removeIf(Order::isCancelled);

// RIGHT — explicit iterator when you need more control
Iterator<Order> it = orders.iterator();
while (it.hasNext()) {
    if (it.next().isCancelled()) it.remove();
}`,
        },
        {
          t: 'note',
          title: 'The exception name is misleading',
          text: '`ConcurrentModificationException` has nothing to do with threads. It means the collection changed structurally while an iterator was open — usually on a single thread, in the loop you are reading right now.',
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'The accidental O(n²) that hides in plain sight',
          code: `
// Looks linear. Is quadratic: contains() on a List is O(n).
List<String> seen = new ArrayList<>();
for (String id : ids) {
    if (!seen.contains(id)) seen.add(id);      // O(n) inside an O(n) loop
}

// Linear, because contains() on a HashSet is O(1)
Set<String> seenFast = new HashSet<>();
for (String id : ids) {
    seenFast.add(id);                          // add returns false if already there
}`,
        },
        {
          t: 'key',
          title: 'The rule: if you call contains() in a loop, you want a Set',
          text: 'This single substitution is the most common real-world performance fix in Java code. At 10,000 items it turns 50 million comparisons into 10,000.',
        },
        {
          t: 'warn',
          title: 'null handling differs and it will catch you',
          text: '`HashMap` allows one null key and many null values. `TreeMap` throws on a null key (it cannot compare it). `List.of`, `Map.of` and `Set.of` reject nulls entirely. `Collections.unmodifiableList` allows them. Know which one you are holding.',
        },
      ],
    },
  ],

  patterns: [
    {
      id: 'set-for-membership',
      name: 'Set for Membership, Map for Lookup',
      oneLiner: 'Any repeated "have I seen this?" or "find by id" belongs in a hash structure.',
      useWhen: ['`contains` inside a loop.', 'Joining two lists on a field.', 'De-duplicating.'],
      recognize: ['Nested loops over two collections.', '`list.stream().filter(x -> x.getId().equals(id)).findFirst()` called repeatedly.'],
      steps: [
        'Build a `Set` or `Map` once, outside the loop.',
        'Look up inside the loop.',
        'Confirm the key type has correct `equals`/`hashCode`.',
      ],
      template: {
        lang: 'java',
        caption: 'Turning an O(n·m) join into O(n + m)',
        code: `
// Before: for every order, scan all customers — O(n·m)
for (Order o : orders) {
    Customer c = customers.stream()
        .filter(x -> x.id().equals(o.customerId()))
        .findFirst().orElseThrow();
}

// After: index once, then look up — O(n + m)
Map<String, Customer> byId = customers.stream()
        .collect(Collectors.toMap(Customer::id, c -> c));

for (Order o : orders) {
    Customer c = byId.get(o.customerId());
}`,
      },
      complexity: 'O(n + m) instead of O(n·m); O(n) extra memory.',
      gotchas: [
        '`Collectors.toMap` throws on duplicate keys — pass a merge function `(a, b) -> a` if duplicates are possible.',
        'It also throws a NullPointerException on a null value, unlike `HashMap.put`.',
      ],
      problems: ['Replace a nested-loop join with a map', 'Fix a quadratic dedup'],
    },
    {
      id: 'pick-by-guarantee',
      name: 'Pick the Implementation by the Guarantee You Need',
      oneLiner: 'Order, uniqueness, sorting and thread safety are four separate questions.',
      useWhen: ['Declaring any field or local collection.'],
      recognize: ['Code that relies on `HashMap` iteration order — which is unspecified and changes between runs.'],
      steps: [
        'Declare the variable as the **interface** (`List`, `Map`, `Set`).',
        'Choose the implementation from the guarantee you actually need.',
        'Document the reason if it is not one of the three defaults.',
      ],
      template: {
        lang: 'java',
        caption: 'Program to the interface, choose the implementation deliberately',
        code: `
List<Order> orders   = new ArrayList<>();        // default
Deque<Task> stack    = new ArrayDeque<>();       // O(1) both ends
Map<String,User> ix  = new HashMap<>();          // default
Map<String,User> ordered = new LinkedHashMap<>();// stable iteration for output
NavigableMap<LocalDate,Rate> rates = new TreeMap<>();  // needs floorEntry`,
      },
      complexity: 'Free — it is a declaration choice.',
      gotchas: [
        'Never depend on `HashMap` iteration order, even if it looks stable in a test.',
        'Declaring as `ArrayList` rather than `List` makes the implementation impossible to change later.',
      ],
      problems: ['Find code relying on HashMap order', 'Swap ArrayList for ArrayDeque in a queue'],
    },
    {
      id: 'immutable-collections',
      name: 'Return Immutable Collections',
      oneLiner: 'Hand out something callers cannot corrupt.',
      useWhen: ['Getters that expose an internal collection.', 'Constants and lookup tables.'],
      recognize: ['A getter returning the live `ArrayList` field.'],
      steps: ['Build with `List.of` / `Map.of` for constants.', 'Use `List.copyOf` when copying caller input.', 'Use `Collectors.toUnmodifiableList()` at the end of a stream.'],
      complexity: 'One copy; usually negligible.',
      gotchas: [
        '`Map.of` is limited to 10 pairs — use `Map.ofEntries(entry(k, v), ...)` beyond that.',
        '`List.of` rejects null elements; `Arrays.asList` allows them.',
      ],
      problems: ['Make a getter safe', 'Replace a static mutable map with Map.of'],
    },
  ],

  pitfalls: [
    { title: 'Using LinkedList as a general-purpose list', text: 'Worse cache behaviour, more memory, and O(n) indexing. ArrayList or ArrayDeque wins nearly every time.' },
    { title: 'contains() on a List inside a loop', text: 'Silent O(n²). Switch to a Set.' },
    { title: 'Removing from a collection inside a for-each', text: 'ConcurrentModificationException. Use removeIf or an explicit iterator.' },
    { title: 'Relying on HashMap iteration order', text: 'It is unspecified and changes when the map resizes. Use LinkedHashMap if order matters.' },
    { title: 'Treating PriorityQueue as sorted', text: 'Only poll() is ordered; iteration and toString are not.' },
    { title: 'Using a mutable object as a map key', text: 'Mutate it and the entry becomes unreachable.' },
    { title: 'Collectors.toMap with duplicate keys', text: 'Throws IllegalStateException. Supply a merge function.' },
    { title: 'Using Vector, Hashtable or Stack', text: 'Legacy, synchronised on every call, and slower. Use ArrayList, HashMap, ArrayDeque — or the concurrent versions when you truly share across threads.' },
  ],

  cheatsheet: [
    { label: 'Default list', value: 'ArrayList' },
    { label: 'Default map', value: 'HashMap' },
    { label: 'Default set', value: 'HashSet' },
    { label: 'Stack or queue', value: 'ArrayDeque' },
    { label: 'Keep insertion order', value: 'LinkedHashMap / LinkedHashSet' },
    { label: 'Sorted / ranges', value: 'TreeMap / TreeSet' },
    { label: 'Count', value: 'map.merge(k, 1, Integer::sum)' },
    { label: 'Group', value: 'computeIfAbsent(k, x -> new ArrayList<>())' },
    { label: 'Safe read', value: 'getOrDefault(k, def)' },
    { label: 'Remove while looping', value: 'removeIf(...)' },
    { label: 'Nearest key ≤ x', value: 'treeMap.floorKey(x)' },
    { label: 'LRU cache', value: 'LinkedHashMap(cap, 0.75f, true)' },
    { label: 'Immutable', value: 'List.of / List.copyOf' },
    { label: 'Load factor', value: '0.75 — resizes and rehashes' },
  ],

  problems: [
    { name: 'Time ArrayList against LinkedList', difficulty: 'Easy', pattern: 'List choice', insight: 'Index-loop over 100k elements in both. ArrayList finishes instantly; LinkedList takes seconds because every get() walks the chain.' },
    { name: 'Count word frequencies in one line each way', difficulty: 'Easy', pattern: 'Map idioms', insight: 'Do it with get/put, then with merge, then with a stream groupingBy counting collector. Compare readability.' },
    { name: 'Trigger ConcurrentModificationException', difficulty: 'Easy', pattern: 'Iteration', insight: 'Remove inside a for-each, watch it throw, then fix it with removeIf.' },
    { name: 'Turn a quadratic dedup into a linear one', difficulty: 'Medium', pattern: 'Set membership', insight: 'Start with list.contains in a loop over 50k items, time it, then swap in a HashSet. Expect a 1000x improvement.' },
    { name: 'Build an LRU cache with LinkedHashMap', difficulty: 'Medium', pattern: 'Access order', insight: 'Extend LinkedHashMap with accessOrder true and override removeEldestEntry. Verify that reading an entry moves it to the back.' },
    { name: 'Use TreeMap for a time-series lookup', difficulty: 'Medium', pattern: 'Sorted map', insight: 'Store readings by timestamp and answer "value as of time T" with floorEntry. A HashMap cannot do this at all.' },
    { name: 'Replace a nested-loop join', difficulty: 'Medium', pattern: 'Indexing', insight: 'Join 5k orders to 5k customers with nested loops, then with a pre-built map. Compare the operation count.' },
    { name: 'Show HashMap iteration order changing', difficulty: 'Medium', pattern: 'Ordering guarantees', insight: 'Insert enough entries to force a resize and print the keys before and after. The order changes — proof you cannot depend on it.' },
    { name: 'Break Collectors.toMap with duplicates', difficulty: 'Medium', pattern: 'Collectors', insight: 'Collect a list with repeated keys and watch IllegalStateException. Fix it with a merge function and decide which value should win.' },
    { name: 'Measure the cost of not presizing', difficulty: 'Hard', pattern: 'Resizing', insight: 'Build a 1M-entry ArrayList and HashMap with and without an initial capacity. Measure both time and allocation with -Xlog:gc.' },
    { name: 'Make a HashMap degenerate', difficulty: 'Hard', pattern: 'Hash quality', insight: 'Write a key class whose hashCode always returns 1, insert 10k entries and time lookups. Then observe that Java 8+ treeifies the bucket, so it degrades to O(log n) rather than O(n).' },
  ],
}
