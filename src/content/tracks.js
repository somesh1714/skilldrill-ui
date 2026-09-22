/**
 * The track registry. The app home page is a picker over this list, and each
 * track's own home page takes its headline copy from here — so the copy for a
 * track lives with the track, not on the app home page.
 */
export const tracks = [
  {
    id: 'dsa',
    to: '/dsa',
    title: 'Data Structures & Algorithms',
    navLabel: 'DSA',
    icon: 'HubRounded',
    color: '#4f46e5',
    status: 'Available now',
    ready: true,
    tags: ['Algorithms', 'Interviews', 'Java', 'Patterns'],
    blurb:
      'Twenty-one chapters from complexity analysis to segment trees. Professor-style notes, every famous pattern with its "when to apply" rules, and a curated, sorted problem set for each topic.',
    bullets: [
      'Complexity analysis through segment trees',
      'Every pattern with its when-to-apply rules',
      'A sorted problem set per chapter',
    ],
    hero: {
      eyebrow: 'Track · Data Structures & Algorithms',
      headline: ['Learn the patterns.', 'Then the problems get easy.'],
      lead:
        'Deep, opinionated notes on data structures and algorithms — written the way a good professor teaches: the intuition first, the pattern second, the code third, and a sorted problem set to make it stick.',
    },
  },
  {
    id: 'spring',
    to: '/spring',
    title: 'Java & Spring Boot',
    icon: 'CoffeeRounded',
    color: '#0f766e',
    status: 'Planned',
    ready: false,
    tags: ['Java', 'Backend', 'Spring', 'JVM'],
    blurb:
      'The backend track: core Java and the JVM memory model, collections internals, concurrency, then Spring Boot — dependency injection, JPA, REST design, security, testing and observability.',
    bullets: ['Java core & the JVM', 'Concurrency without the folklore', 'Spring Boot end to end'],
    hero: {
      eyebrow: 'Track · Java & Spring Boot',
      headline: ['Know what the framework does.', 'Then the magic stops being magic.'],
      lead:
        'The backend track, written to the same standard as the DSA chapters: how the JVM actually behaves, what Spring is really doing when it wires your beans, and the production practices that keep a service healthy once real traffic arrives.',
    },
    outline: [
      {
        group: 'Java core',
        items: [
          'JVM memory model: heap, stack, metaspace, and what actually causes an OOM',
          'Collections internals — how HashMap resizes and treeifies, when ArrayDeque beats LinkedList',
          'equals / hashCode / Comparable contracts and the bugs that follow from breaking them',
          'Generics, type erasure, wildcards and why `List<Object>` is not a `List<String>` supertype',
          'Streams and Optional: where they help, and where they quietly cost you',
          'Exceptions, try-with-resources, and designing failure modes',
        ],
      },
      {
        group: 'Concurrency',
        items: [
          'Threads, executors and the thread pool sizing question interviewers love',
          'synchronized vs ReentrantLock vs atomics vs volatile — and the happens-before relation',
          'ConcurrentHashMap, CopyOnWriteArrayList and when lock-free actually wins',
          'CompletableFuture composition and structured concurrency',
          'Virtual threads: what changes, and what does not',
          'Classic hazards: deadlock, livelock, race conditions, false sharing',
        ],
      },
      {
        group: 'Spring Boot',
        items: [
          'The container: beans, scopes, the lifecycle, and why field injection is discouraged',
          'Auto-configuration — how starters actually decide what to wire up',
          'Configuration, profiles, and externalised secrets done properly',
          'REST API design: versioning, status codes, idempotency, pagination, error contracts',
          'Spring Data JPA: entity mapping, the N+1 problem, fetch strategies, transactions',
          'Spring Security: filter chain, JWT and OAuth2 flows, method-level authorisation',
          'Testing: slice tests, @SpringBootTest, Testcontainers, and what to mock',
          'Observability: Actuator, metrics, structured logging, tracing',
        ],
      },
      {
        group: 'Production practice',
        items: [
          'Caching layers and invalidation strategies',
          'Database migrations and zero-downtime deploys',
          'Resilience: timeouts, retries with backoff, circuit breakers, bulkheads',
          'Message-driven services with Kafka or RabbitMQ',
          'Performance profiling and the JVM flags that matter',
        ],
      },
    ],
  },
  {
    id: 'system-design',
    to: '/system-design',
    title: 'System Design',
    icon: 'ArchitectureRounded',
    color: '#9333ea',
    status: 'Planned',
    ready: false,
    tags: ['Architecture', 'Scale', 'Distributed systems'],
    blurb:
      'Scaling fundamentals, caching strategies, databases and consistency models, queues and event-driven design, plus a library of worked design walkthroughs.',
    bullets: ['The building blocks', 'Frameworks for trade-offs', 'Worked case studies'],
    hero: {
      eyebrow: 'Track · System Design',
      headline: ['Name the trade-off.', 'Then the design defends itself.'],
      lead:
        'There is no single right architecture, only trade-offs you can justify. This track builds the vocabulary — the building blocks, their failure modes, and the numbers behind them — then applies it to worked designs.',
    },
    outline: [
      {
        group: 'Fundamentals',
        items: [
          'Latency numbers every engineer should know, and back-of-the-envelope estimation',
          'Vertical vs horizontal scaling, and where each one stops working',
          'Load balancing: L4 vs L7, health checks, and sticky sessions',
          'CAP and PACELC, stated precisely rather than as a slogan',
          'Consistency models: strong, eventual, read-your-writes, monotonic reads',
        ],
      },
      {
        group: 'Data',
        items: [
          'Choosing a database: relational, document, key-value, wide-column, graph',
          'Indexing, query plans, and why your query got slow',
          'Replication, partitioning and resharding without downtime',
          'Caching: read-through, write-through, write-behind, and invalidation',
          'Search and analytics stores alongside a primary database',
        ],
      },
      {
        group: 'Communication',
        items: [
          'Synchronous vs asynchronous, and when a queue is the wrong answer',
          'Message brokers, delivery guarantees, and idempotent consumers',
          'Event-driven design, outbox pattern, and change data capture',
          'API gateways, rate limiting, and backpressure',
          'Idempotency keys and exactly-once as an illusion',
        ],
      },
      {
        group: 'Operating it',
        items: [
          'Observability: metrics, logs, traces, and what to alert on',
          'Failure injection, graceful degradation, and blast radius',
          'Deployment strategies: blue-green, canary, feature flags',
          'Cost as a design constraint',
        ],
      },
      {
        group: 'Worked designs',
        items: [
          'A URL shortener, done properly',
          'A news feed with fan-out trade-offs',
          'A chat system with presence and delivery receipts',
          'A rate limiter, four ways',
          'A ride-matching service with geospatial indexing',
        ],
      },
    ],
  },
]

export const tracksById = Object.fromEntries(tracks.map((t) => [t.id, t]))

/**
 * Short form for nav tabs and breadcrumbs, falling back to the full title.
 * Everything that names a track goes through here, so renaming one is a
 * single edit in this file.
 */
export const trackLabel = (id) => tracksById[id]?.navLabel ?? tracksById[id]?.title ?? id

/** Ready-made breadcrumb entry for a track. */
export const trackCrumb = (id) => ({ label: trackLabel(id), to: tracksById[id].to })
