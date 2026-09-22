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
    // Shown on the track home page under "how to use this track".
    habits: [
      {
        icon: 'MenuBookRounded',
        title: 'Read the chapter like a textbook',
        text: 'Each topic opens with a mental model and the "why", not a wall of code. Work through the sections in order — they build on each other deliberately.',
      },
      {
        icon: 'PatternRounded',
        title: 'Learn patterns, not solutions',
        text: 'Every pattern states when to use it, how to recognise it in a problem statement, a reusable template, and the gotchas that fail hidden tests.',
      },
      {
        icon: 'FormatListNumberedRounded',
        title: 'Drill the sorted problem list',
        text: 'Problems are ordered Easy → Hard and tagged with the pattern they exercise. Each one carries the single insight that unlocks it.',
      },
      {
        icon: 'BoltRounded',
        title: 'Revise from the cheat sheet',
        text: 'The night before an interview, read only the cheat sheet and the pattern index. Everything compresses down to a page per topic.',
      },
    ],
    // What this track calls its practice page, and how it describes it.
    practice: {
      label: 'Problems',
      path: 'problems',
      title: 'Problem tracker',
      eyebrow: 'Practice',
      lead: 'Every problem in the curriculum, sorted Easy → Hard, tagged with its pattern and the single insight that unlocks it. Tick them off as you solve them — progress is stored in this browser.',
      noun: 'problems',
    },
    hasRoadmap: true,
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
    status: 'Available now',
    ready: true,
    tags: ['Java', 'Backend', 'Spring', 'JVM'],
    blurb:
      'The backend track: core Java and the JVM memory model, collections internals, concurrency, then Spring Boot — dependency injection, JPA, REST design, security, testing and observability.',
    bullets: [
      'Java core, the JVM and how memory really behaves',
      'Concurrency without the folklore',
      'Spring Boot from the container to production',
    ],
    habits: [
      {
        icon: 'MenuBookRounded',
        title: 'Read it before you need it',
        text: 'Every chapter explains the machinery before the annotation. Knowing what Spring does on your behalf is what stops the framework feeling like magic.',
      },
      {
        icon: 'TerminalRounded',
        title: 'Type the code out',
        text: 'The snippets are small on purpose. Run them, break them, and watch what changes — backend behaviour is much easier to remember once you have seen it fail.',
      },
      {
        icon: 'BugReportRounded',
        title: 'Collect the failure modes',
        text: 'Each chapter ends with the mistakes that actually cause production incidents. Those are the questions interviewers ask, because they are the ones that cost money.',
      },
      {
        icon: 'ScienceRounded',
        title: 'Do the exercises',
        text: 'Every chapter has hands-on tasks with the outcome you should see. Reading about the N+1 problem teaches far less than watching 200 queries appear in your logs.',
      },
    ],
    practice: {
      label: 'Exercises',
      path: 'exercises',
      title: 'Hands-on exercises',
      eyebrow: 'Practice',
      lead: 'Concrete tasks for every chapter, ordered from warm-up to hard. Each one names what you should build and what you should observe when it works — or when it deliberately breaks.',
      noun: 'exercises',
    },
    hasRoadmap: false,
    hero: {
      eyebrow: 'Track · Java & Spring Boot',
      headline: ['Know what the framework does.', 'Then the magic stops being magic.'],
      lead:
        'The backend track, written to the same standard as the DSA chapters: how the JVM actually behaves, what Spring is really doing when it wires your beans, and the production practices that keep a service healthy once real traffic arrives.',
    },
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
    habits: [
      {
        icon: 'MenuBookRounded',
        title: 'Learn the building blocks first',
        text: 'Designs are assembled from a small number of components. Know each one\u2019s failure modes before trying to combine them.',
      },
      {
        icon: 'FunctionsRounded',
        title: 'Estimate out loud',
        text: 'Most design answers turn on a number. Practise back-of-the-envelope maths until it is automatic.',
      },
      {
        icon: 'PatternRounded',
        title: 'Name the trade-off',
        text: 'There is no right architecture. Say what you are buying and what you are paying, every time.',
      },
      {
        icon: 'ScienceRounded',
        title: 'Work through real designs',
        text: 'Case studies are where the vocabulary turns into judgement.',
      },
    ],
    practice: {
      label: 'Case studies',
      path: 'case-studies',
      title: 'Design case studies',
      eyebrow: 'Practice',
      lead: 'Worked designs, from a URL shortener to a ride-matching service, each one exercising a different set of building blocks.',
      noun: 'case studies',
    },
    hasRoadmap: false,
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
