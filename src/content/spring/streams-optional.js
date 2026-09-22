export default {
  id: 'streams-optional',
  title: 'Lambdas, Streams & Optional',
  short: 'Streams & Optional',
  icon: 'FilterAltRounded',
  tier: 'Foundations',
  order: 6,
  estHours: 6,
  prereqs: ['collections'],
  tagline: 'Describe what you want, not how to loop. Then know when a plain for-loop is still better.',
  mentalModel:
    'A stream is a **pipeline**, not a collection. It holds no data, it changes nothing, and it does no work at all until a terminal operation pulls values through it. `Optional` is the same idea applied to one value: a box that makes "might be absent" impossible to ignore.',
  whyItMatters:
    'Streams are everywhere in modern Java and Spring code, and used well they make intent obvious. Used badly they hide N+1 queries, allocate needlessly, and turn a simple loop into something nobody can debug.',

  reference: {
    title: 'Operations you will actually use',
    head: ['Operation', 'Kind', 'What it does'],
    rows: [
      ['`filter(pred)`', 'Intermediate', 'Keeps elements matching the predicate'],
      ['`map(fn)`', 'Intermediate', 'Transforms each element one-to-one'],
      ['`flatMap(fn)`', 'Intermediate', 'Each element becomes a stream; they are flattened into one'],
      ['`distinct()` / `sorted()`', 'Intermediate (stateful)', 'Needs to see elements before emitting — buffers'],
      ['`limit(n)` / `skip(n)`', 'Intermediate (short-circuiting)', 'Stops early; works on infinite streams'],
      ['`peek(fn)`', 'Intermediate', 'For debugging only — never for side effects'],
      ['`collect(...)` / `toList()`', 'Terminal', 'Gathers into a collection'],
      ['`reduce(...)`', 'Terminal', 'Folds into a single value'],
      ['`anyMatch` / `findFirst`', 'Terminal (short-circuiting)', 'Stops at the first answer'],
      ['`forEach(fn)`', 'Terminal', 'Side effects only; returns nothing'],
    ],
  },

  sections: [
    {
      id: 'lambdas',
      title: 'Lambdas and the interfaces behind them',
      blocks: [
        { t: 'p', text: 'A lambda is an implementation of a **functional interface** — an interface with exactly one abstract method. There is no new runtime concept here; the compiler is matching your lambda to that single method.' },
        {
          t: 'code',
          lang: 'java',
          caption: 'The four you will use constantly',
          code: `
Function<String, Integer> length   = s -> s.length();        // T -> R
Predicate<String> isEmpty          = s -> s.isEmpty();       // T -> boolean
Consumer<String> print             = s -> System.out.println(s);  // T -> void
Supplier<LocalDate> today          = () -> LocalDate.now();  // () -> T

// Method references are shorter when the lambda just calls one method
Function<String, Integer> len2 = String::length;     // instance method of the arg
Consumer<String> print2       = System.out::println; // instance method of an object
Supplier<ArrayList<String>> s = ArrayList::new;      // constructor
Function<User, String> name   = User::getName;

// Others worth knowing
BiFunction<Integer, Integer, Integer> add = Integer::sum;   // (T,U) -> R
UnaryOperator<String> upper = String::toUpperCase;          // T -> T
BinaryOperator<Integer> max = Integer::max;                 // (T,T) -> T`,
        },
        {
          t: 'note',
          title: 'Effectively final',
          text: 'A lambda can only use local variables that never change after assignment. This is not arbitrary: the lambda may outlive the method that created it, so the value is captured by copy. Fields have no such restriction, because the lambda captures `this` and reads the field live.',
        },
      ],
    },
    {
      id: 'pipeline',
      title: 'How a stream actually executes',
      blocks: [
        { t: 'p', text: 'The most useful thing to understand is that streams are **lazy** and **vertical**. Nothing runs until the terminal operation, and then each element is pushed all the way through the pipeline before the next one starts.' },
        {
          t: 'code',
          lang: 'java',
          caption: 'The output order surprises almost everyone the first time',
          code: `
List<String> result = Stream.of("a", "bb", "ccc")
        .filter(s -> { System.out.println("filter: " + s); return s.length() > 1; })
        .map(s    -> { System.out.println("map:    " + s); return s.toUpperCase(); })
        .toList();

// filter: a          <- "a" is rejected, map never sees it
// filter: bb
// map:    bb         <- bb goes all the way through before ccc starts
// filter: ccc
// map:    ccc

// NOT: all filters, then all maps.`,
        },
        {
          t: 'key',
          title: 'Laziness enables short-circuiting',
          text: 'Because elements flow one at a time, `findFirst` and `anyMatch` can stop the whole pipeline the moment they have an answer. It is also why an infinite stream works: `Stream.iterate(1, n -> n * 2).limit(10)` terminates.',
        },
        {
          t: 'warn',
          title: 'A stream is single-use',
          text: 'Once a terminal operation runs, the stream is consumed. Touching it again throws `IllegalStateException: stream has already been operated upon or closed`. If you need two results, either collect once and reuse the collection, or build the stream twice from a `Supplier<Stream<T>>`.',
        },
      ],
    },
    {
      id: 'collectors',
      title: 'Collectors: where most real work happens',
      blocks: [
        {
          t: 'code',
          lang: 'java',
          caption: 'The collectors that cover the vast majority of cases',
          code: `
List<User> users = repository.findAll();

// To collections
List<String> names = users.stream().map(User::name).toList();          // immutable
Set<String> unique = users.stream().map(User::city).collect(toSet());

// To a map — watch for duplicate keys
Map<Long, User> byId = users.stream()
        .collect(toMap(User::id, u -> u));
Map<String, User> byEmail = users.stream()
        .collect(toMap(User::email, u -> u, (a, b) -> a));   // keep the first

// Grouping — the one you will use most
Map<String, List<User>> byCity = users.stream()
        .collect(groupingBy(User::city));

Map<String, Long> countByCity = users.stream()
        .collect(groupingBy(User::city, counting()));

Map<String, List<String>> namesByCity = users.stream()
        .collect(groupingBy(User::city, mapping(User::name, toList())));

// Partition — grouping by a boolean, always exactly two keys
Map<Boolean, List<User>> split = users.stream()
        .collect(partitioningBy(u -> u.age() >= 18));

// Aggregates
IntSummaryStatistics stats = users.stream()
        .mapToInt(User::age).summaryStatistics();   // count, sum, min, max, average
String joined = users.stream().map(User::name).collect(joining(", ", "[", "]"));`,
        },
        {
          t: 'trap',
          title: 'toMap throws on duplicate keys — and on null values',
          text: '`Collectors.toMap` throws `IllegalStateException` on a duplicate key and `NullPointerException` on a null value, both unlike `HashMap.put`. Always supply a merge function when keys might repeat, and filter nulls first.',
        },
        {
          t: 'tip',
          title: 'toList() versus collect(toList())',
          text: 'Since Java 16, `stream.toList()` returns an **unmodifiable** list and is shorter. `collect(Collectors.toList())` returns a mutable `ArrayList`. Prefer `toList()` unless you specifically need to modify the result.',
        },
      ],
    },
    {
      id: 'optional',
      title: 'Optional, used properly',
      blocks: [
        { t: 'p', text: '`Optional` exists for one purpose: **a return type that may legitimately have no value**. It is not a general-purpose null wrapper, and using it everywhere makes code worse, not better.' },
        {
          t: 'code',
          lang: 'java',
          caption: 'Using it as a box you unwrap defeats the point',
          code: `
// POINTLESS — this is an if-null check with extra allocation
Optional<User> opt = repository.findById(id);
if (opt.isPresent()) {
    return opt.get().name();
}
return "unknown";

// IDIOMATIC — chain, then supply a default at the end
return repository.findById(id)
        .map(User::name)
        .orElse("unknown");

// Throw instead of defaulting
User user = repository.findById(id)
        .orElseThrow(() -> new NoSuchElementException("No user " + id));

// Lazy default — the expensive call only runs if absent
Config config = cache.lookup(key)
        .orElseGet(() -> loadFromDisk(key));      // NOT orElse(loadFromDisk(key))`,
        },
        {
          t: 'trap',
          title: 'orElse evaluates eagerly',
          text: '`orElse(expensive())` calls `expensive()` **even when the value is present** — it is just a method argument. `orElseGet(() -> expensive())` only calls it when needed. If the default has a side effect or costs anything, this is a real bug.',
        },
        {
          t: 'table',
          head: ['Use Optional for', 'Do NOT use Optional for'],
          rows: [
            ['A return type that may have no result', 'Fields — it is not serialisable and adds a wrapper per object'],
            ['Chaining a maybe-absent value', 'Method parameters — overload or accept null instead'],
            ['Ending a lookup chain safely', 'Collections — return an empty list, never `Optional<List<T>>`'],
          ],
        },
        {
          t: 'key',
          title: 'Never call get() without checking',
          text: '`optional.get()` on an empty `Optional` throws `NoSuchElementException` — you have reintroduced the NPE with extra steps. Use `orElse`, `orElseGet`, `orElseThrow` or `ifPresent`. Modern Java even renamed the safe version to `orElseThrow()` to discourage `get()`.',
        },
      ],
    },
    {
      id: 'when-not',
      title: 'When a loop is the better answer',
      blocks: [
        { t: 'p', text: 'Streams are a readability tool. When they stop being more readable than a loop, stop using them.' },
        {
          t: 'compare',
          left: {
            title: 'Stream wins',
            items: [
              'Filter, map and collect in a clear sequence',
              'Grouping and aggregating',
              'The logic reads like a sentence',
              'You want parallelism for a genuinely CPU-bound job',
            ],
          },
          right: {
            title: 'Loop wins',
            items: [
              'You need the index',
              'You need to mutate something outside the loop',
              'You need to break out on a complex condition',
              'Hot path where allocation matters',
              'The stream needs a try/catch inside a lambda',
            ],
          },
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'Two stream mistakes worth recognising',
          code: `
// 1. Side effects in a stream — works, but defeats the model and breaks
//    immediately if anyone makes it parallel
List<String> out = new ArrayList<>();
users.stream().forEach(u -> out.add(u.name()));       // don't
List<String> better = users.stream().map(User::name).toList();

// 2. parallelStream() on a small or IO-bound task — usually SLOWER.
//    It uses the shared ForkJoinPool.commonPool, so one slow parallel stream
//    can stall every other one in the JVM.
users.parallelStream().map(this::callRemoteApi).toList();   // bad idea

// Parallel is worth it only for large, CPU-bound, stateless work:
long count = IntStream.rangeClosed(1, 50_000_000)
        .parallel()
        .filter(this::isPrime)
        .count();`,
        },
        {
          t: 'warn',
          title: 'The N+1 query hiding in a stream',
          text: 'A stream over entities that calls a repository inside `map` issues one query per element. It looks elegant and is catastrophically slow. Fetch the whole set in one query first, index it in a map, then stream over that.',
        },
      ],
    },
  ],

  patterns: [
    {
      id: 'group-and-aggregate',
      name: 'Group and Aggregate',
      oneLiner: 'groupingBy with a downstream collector replaces most manual map-building loops.',
      useWhen: ['"Count per category", "sum per customer", "latest per key".'],
      recognize: ['A loop with `computeIfAbsent` building a `Map<K, List<V>>`.'],
      steps: ['Choose the key function.', 'Choose the downstream collector for what you want per group.', 'Use `TreeMap::new` as the map factory if you need sorted keys.'],
      template: {
        lang: 'java',
        caption: 'Downstream collectors compose',
        code: `
// count per city
Map<String, Long> counts = users.stream()
        .collect(groupingBy(User::city, counting()));

// total revenue per customer, sorted by customer id
Map<String, BigDecimal> revenue = orders.stream()
        .collect(groupingBy(Order::customerId, TreeMap::new,
                 mapping(Order::total,
                         reducing(BigDecimal.ZERO, BigDecimal::add))));

// the most recent order per customer
Map<String, Optional<Order>> latest = orders.stream()
        .collect(groupingBy(Order::customerId,
                 maxBy(comparing(Order::placedAt))));`,
      },
      complexity: 'O(n) with one pass over the data.',
      gotchas: [
        'The default map is a `HashMap`, so iteration order is unspecified — pass a map factory if you need order.',
        'Downstream collectors nest, but three levels deep is usually less readable than a loop.',
      ],
      problems: ['Group orders by customer and sum totals', 'Find the newest record per key'],
    },
    {
      id: 'optional-chain',
      name: 'Chain Optionals Instead of Unwrapping',
      oneLiner: 'map, flatMap and filter until the very end, then supply a default or throw.',
      useWhen: ['Repository lookups, configuration reads, anything that may be absent.'],
      recognize: ['`isPresent()` followed by `get()` — the anti-pattern this replaces.'],
      steps: ['`map` for a plain transform.', '`flatMap` when the transform itself returns an `Optional`.', 'Terminate with `orElse`, `orElseGet` or `orElseThrow`.'],
      template: {
        lang: 'java',
        caption: 'One expression, no unwrapping',
        code: `
String city = repository.findById(userId)      // Optional<User>
        .map(User::address)                     // Optional<Address>
        .flatMap(Address::city)                 // city() returns Optional<String>
        .filter(c -> !c.isBlank())
        .map(String::toUpperCase)
        .orElse("UNKNOWN");`,
      },
      complexity: 'Negligible; one small object per step.',
      gotchas: [
        '`map` on a function returning `Optional` gives you `Optional<Optional<T>>` — use `flatMap`.',
        '`orElse` is eager; use `orElseGet` for anything expensive.',
      ],
      problems: ['Refactor isPresent/get into a chain', 'Show orElse evaluating eagerly'],
    },
    {
      id: 'index-then-stream',
      name: 'Fetch Once, Index, Then Stream',
      oneLiner: 'Never put a repository call inside a stream operation.',
      useWhen: ['Enriching a list of entities with related data.'],
      recognize: ['`findById` inside `map`.', 'Query counts that scale with result size.'],
      steps: [
        'Collect the ids you need.',
        'Fetch them all in one `findAllById`.',
        'Index into a map, then stream over the original list.',
      ],
      template: {
        lang: 'java',
        caption: 'Two queries instead of N + 1',
        code: `
// BEFORE: one query per order
List<OrderDto> bad = orders.stream()
        .map(o -> new OrderDto(o, customerRepo.findById(o.customerId()).orElseThrow()))
        .toList();

// AFTER: one query for all customers
Set<Long> ids = orders.stream().map(Order::customerId).collect(toSet());
Map<Long, Customer> byId = customerRepo.findAllById(ids).stream()
        .collect(toMap(Customer::id, c -> c));

List<OrderDto> good = orders.stream()
        .map(o -> new OrderDto(o, byId.get(o.customerId())))
        .toList();`,
      },
      complexity: 'Two queries instead of N + 1; O(n) memory for the index.',
      gotchas: [
        'Watch the size of the id set — some databases limit the number of `IN` parameters.',
        'Handle a missing id explicitly rather than letting `byId.get` return null silently.',
      ],
      problems: ['Fix an N+1 inside a stream', 'Count queries with Hibernate statistics'],
    },
  ],

  pitfalls: [
    { title: 'Reusing a consumed stream', text: 'IllegalStateException. Streams are one-shot.' },
    { title: 'Side effects in map or filter', text: 'Breaks under parallelism and makes the pipeline impossible to reason about. Collect instead.' },
    { title: 'orElse with an expensive default', text: 'It is evaluated even when the value is present. Use orElseGet.' },
    { title: 'Optional.get() without a check', text: 'The NPE you were avoiding, wearing a different name.' },
    { title: 'Optional as a field or parameter', text: 'Not serialisable, extra allocation, and it does not remove the null check — it moves it.' },
    { title: 'Returning Optional<List<T>>', text: 'Return an empty list. Absence and emptiness are the same thing for a collection.' },
    { title: 'parallelStream() by default', text: 'Uses the shared common pool, is slower for small or IO-bound work, and can stall unrelated code.' },
    { title: 'A repository call inside map()', text: 'The N+1 query problem, dressed up as functional style.' },
    { title: 'peek() for real work', text: 'It is a debugging hook and may be skipped entirely when the pipeline can optimise it away.' },
  ],

  cheatsheet: [
    { label: 'Nothing runs until', value: 'a terminal operation' },
    { label: 'Execution order', value: 'element by element, vertically' },
    { label: 'Stream reuse', value: 'not allowed — one shot' },
    { label: 'One-to-many', value: 'flatMap' },
    { label: 'Immutable result', value: '.toList() (Java 16+)' },
    { label: 'Mutable result', value: 'collect(toList())' },
    { label: 'Group', value: 'groupingBy(key, downstream)' },
    { label: 'Two buckets', value: 'partitioningBy(pred)' },
    { label: 'Duplicate keys', value: 'toMap needs a merge function' },
    { label: 'Numeric stats', value: 'mapToInt(...).summaryStatistics()' },
    { label: 'Lazy default', value: 'orElseGet, not orElse' },
    { label: 'Optional in a chain', value: 'flatMap' },
    { label: 'Optional for', value: 'return types only' },
    { label: 'Parallel', value: 'large + CPU-bound + stateless only' },
  ],

  problems: [
    { name: 'Print the real execution order', difficulty: 'Easy', pattern: 'Laziness', insight: 'Add printlns to filter and map. The output interleaves per element rather than running each stage to completion.' },
    { name: 'Show a stream is single-use', difficulty: 'Easy', pattern: 'Stream lifecycle', insight: 'Call count() then toList() on the same stream and read the IllegalStateException message.' },
    { name: 'Rewrite a loop as a stream, and back', difficulty: 'Easy', pattern: 'Readability', insight: 'Take a filter-map-collect loop, convert it, then convert a loop that needs an index and decide which version you would keep.' },
    { name: 'Group orders by customer and sum', difficulty: 'Medium', pattern: 'Collectors', insight: 'groupingBy with a mapping + reducing downstream. Then get the keys sorted with a TreeMap factory.' },
    { name: 'Break toMap with duplicate keys', difficulty: 'Medium', pattern: 'Collectors', insight: 'Collect a list with repeated keys, read the IllegalStateException, then add a merge function and decide which value wins.' },
    { name: 'Prove orElse is eager', difficulty: 'Medium', pattern: 'Optional', insight: 'Put a println in the default supplier. With orElse it prints even when the value is present; with orElseGet it does not.' },
    { name: 'Refactor isPresent/get into a chain', difficulty: 'Medium', pattern: 'Optional', insight: 'Take a three-level nested null check and reduce it to one map/flatMap chain ending in orElse.' },
    { name: 'Flatten nested lists with flatMap', difficulty: 'Medium', pattern: 'flatMap', insight: 'Turn List<Order> with items into a flat List<Item>, then count distinct products across all orders.' },
    { name: 'Find the N+1 inside a stream', difficulty: 'Hard', pattern: 'N+1', insight: 'Enable Hibernate statistics, run a map() containing findById over 100 records, and count the queries. Then fix it with findAllById and a map index.' },
    { name: 'Measure parallelStream honestly', difficulty: 'Hard', pattern: 'Parallelism', insight: 'Benchmark sequential vs parallel for a 100-element IO-bound task and a 50-million-element CPU-bound task. Only the second one wins.' },
  ],
}
