export default {
  id: 'performance',
  title: 'Performance & JVM Tuning',
  short: 'Performance',
  icon: 'TuneRounded',
  tier: 'Elite',
  order: 23,
  estHours: 5,
  prereqs: ['jvm-memory', 'observability'],
  tagline: 'Measure, find the bottleneck, fix that one thing, measure again. Everything else is guessing.',
  mentalModel:
    'Performance work is a search, not a set of tricks. At any moment one resource is the constraint — CPU, memory, IO, locks, or a downstream service. Optimising anything else changes nothing. Your job is to identify which, fix it, and then find the new one.',
  whyItMatters:
    'Most "we need to tune the JVM" conversations end with an unindexed query or an N+1. Knowing how to find the real bottleneck saves weeks of speculative work — and knowing that most JVM flags are unnecessary is itself valuable.',

  reference: {
    title: 'Symptom → likely cause → tool',
    head: ['Symptom', 'Usually is', 'Look with'],
    rows: [
      ['Slow endpoint, low CPU', 'Waiting on IO or a lock', 'Thread dump, tracing'],
      ['High CPU', 'A hot loop or excessive allocation', 'Profiler (async-profiler, JFR)'],
      ['Memory grows over time', 'A leak — something retains references', 'Heap dump, dominator tree'],
      ['Periodic latency spikes', 'GC pauses or cache expiry', '`-Xlog:gc`, GC metrics'],
      ['Falls over under load, CPU idle', 'Thread or connection pool exhaustion', 'Thread dump, pool metrics'],
      ['Slow only in production', 'Data volume, missing index, cold cache', '`EXPLAIN ANALYZE`, query logs'],
      ['One slow request in a hundred', 'The tail — GC, a retry, a cold path', 'p99 metrics, tracing'],
    ],
  },

  sections: [
    {
      id: 'method',
      title: 'The method',
      blocks: [
        {
          t: 'steps',
          items: [
            { title: 'Define the target', text: '"p99 under 200ms at 500 requests per second." Without a number you cannot tell when you are finished, and you will optimise forever.' },
            { title: 'Measure the current state', text: 'Under realistic load, with realistic data volumes. A benchmark on an empty database tells you nothing.' },
            { title: 'Find the bottleneck', text: 'Use a profiler or a trace. Do not guess — intuition about performance is wrong more often than it is right.' },
            { title: 'Fix one thing', text: 'One change, so you can attribute the difference.' },
            { title: 'Measure again', text: 'Confirm it helped. Often it does not, and that is useful information.' },
            { title: 'Stop when you hit the target', text: 'Further optimisation is cost with no benefit.' },
          ],
        },
        {
          t: 'key',
          title: 'Look at the database first',
          text: 'In a typical Spring service, the ranked causes of slowness are: (1) N+1 queries, (2) a missing index, (3) fetching far more data than needed, (4) no caching where it would obviously help, (5) everything else. Check the SQL before you touch a JVM flag.',
        },
        {
          t: 'warn',
          title: 'Benchmark the warmed-up JVM',
          text: 'The first few thousand iterations run interpreted before the JIT compiles them. A microbenchmark without warm-up can be off by a factor of ten. Use JMH for microbenchmarks and a sustained load test for services.',
        },
      ],
    },
    {
      id: 'database',
      title: 'Database: where the time usually is',
      blocks: [
        {
          t: 'code',
          lang: 'java',
          caption: 'Find the slow queries, then read the plan',
          code: `
-- Postgres: the slowest statements by total time
SELECT calls, mean_exec_time, total_exec_time, query
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 20;

-- Then read the actual plan, not the estimate
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM orders WHERE customer_id = 42 AND status = 'PENDING';

-- Seq Scan on orders (cost=... rows=100000 ... actual time=245ms)
--   ← a sequential scan on a large table means a missing index

CREATE INDEX CONCURRENTLY ix_orders_customer_status
    ON orders (customer_id, status);
-- CONCURRENTLY avoids locking the table in production`,
        },
        {
          t: 'dl',
          items: [
            { term: 'Index the columns you filter and join on', def: 'Not every column — each index slows writes and takes space.' },
            { term: 'Composite index order matters', def: 'An index on `(a, b)` helps queries filtering on `a`, or on `a AND b`, but not on `b` alone. Put the most selective, most-often-filtered column first.' },
            { term: 'Select only what you need', def: '`SELECT *` on a wide table moves far more bytes than the three columns you use. Projections, from the JPA chapter.' },
            { term: 'Paginate everything', def: 'An unbounded list query works fine on 100 rows and falls over at a million.' },
          ],
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'Make the query count visible in tests',
          code: `
spring:
  jpa:
    properties:
      hibernate:
        generate_statistics: true

// Then assert it, so an N+1 can never be reintroduced
@Test
void listEndpointIssuesOneQuery() {
    statistics.clear();
    service.listOrders();
    assertThat(statistics.getPrepareStatementCount()).isEqualTo(1);
}`,
        },
      ],
    },
    {
      id: 'profiling',
      title: 'Profiling the JVM',
      blocks: [
        {
          t: 'code',
          lang: 'java',
          caption: 'Java Flight Recorder — built in, safe to run in production',
          code: `
# Start a recording on a running process
jcmd <pid> JFR.start duration=60s filename=/tmp/rec.jfr settings=profile

# Or from the command line
-XX:StartFlightRecording=duration=60s,filename=/tmp/rec.jfr

# Open rec.jfr in JDK Mission Control. The overhead of the default
# settings is around 1%, which is low enough to leave on.

# async-profiler produces flame graphs and also sees native frames
./profiler.sh -d 30 -f /tmp/flame.html <pid>     # CPU
./profiler.sh -e alloc -d 30 -f /tmp/alloc.html <pid>   # allocation
./profiler.sh -e lock -d 30 -f /tmp/lock.html <pid>     # lock contention`,
        },
        {
          t: 'key',
          title: 'Read a flame graph by width, not height',
          text: 'Width is time spent. Height is only stack depth. The widest frame at any level is where the time goes — find the widest plateau and that is your bottleneck. A tall narrow spike is deep recursion, not a problem.',
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'Thread dumps diagnose hangs in seconds',
          code: `
jcmd <pid> Thread.print > dump.txt

# What to look for:
#   BLOCKED     — waiting for a monitor. Many of these means lock contention.
#   WAITING     — usually normal (an idle pool thread)
#   RUNNABLE in socketRead — waiting on the network, not actually running
#   "Found one Java-level deadlock" — the JVM tells you outright

# Take three dumps ten seconds apart. Threads stuck in the same frame
# across all three are genuinely stuck, not just sampled mid-work.`,
        },
      ],
    },
    {
      id: 'jvm',
      title: 'The small number of JVM settings worth touching',
      blocks: [
        {
          t: 'code',
          lang: 'java',
          caption: 'Sensible, boring configuration',
          code: `
-XX:MaxRAMPercentage=75.0          # container-aware heap sizing
-XX:+UseG1GC                       # already the default; state it anyway
-XX:+HeapDumpOnOutOfMemoryError
-XX:HeapDumpPath=/tmp
-XX:+ExitOnOutOfMemoryError
-XX:StartFlightRecording=disk=true,maxsize=200m,settings=profile

# For a latency-critical service on a large heap:
-XX:+UseZGC                        # sub-millisecond pauses, more CPU and memory

# What NOT to do: copy a list of twenty flags from a blog post. Most tuning
# guides were written for Java 8 and CMS, which no longer exists.`,
        },
        {
          t: 'warn',
          title: 'GC tuning is almost never the answer',
          text: 'If GC pauses are hurting you, the usual cause is excessive allocation or an oversized live set — both application problems. Reducing allocation fixes it properly; changing collector flags usually moves the pain somewhere else. Measure pause times before assuming they are the issue.',
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'Pool sizing: usually the real limit',
          code: `
spring:
  datasource:
    hikari:
      maximum-pool-size: 20      # NOT 200. More connections than the database
                                 # can usefully run just moves the queue,
                                 # and each one costs memory on the server.
      connection-timeout: 3000

server:
  tomcat:
    threads:
      max: 200

# A useful starting point for the connection pool:
#   pool size = cores × 2 + effective spindle count
# Then measure hikaricp_connections_pending — if it is above zero
# under load, the pool is the bottleneck.`,
        },
        {
          t: 'tip',
          title: 'Startup time, if that is what you care about',
          text: 'Class Data Sharing (`-XX:+AutoCreateSharedArchive`) cuts JVM startup noticeably. Lazy initialisation (`spring.main.lazy-initialization=true`) helps but defers failures to the first request. For genuinely fast startup, GraalVM native images start in milliseconds — at the cost of longer builds and reflection configuration.',
        },
      ],
    },
  ],

  patterns: [
    {
      id: 'measure-first',
      name: 'Profile Before You Optimise',
      oneLiner: 'Find the actual bottleneck instead of the one you assume.',
      useWhen: ['Any performance work.'],
      recognize: ['"It must be the garbage collector."', 'A pull request optimising a method that runs once per hour.'],
      steps: [
        'Reproduce the slowness under realistic load.',
        'Take a flame graph or a trace.',
        'Find the widest frame or the longest span.',
        'Fix that, and only that.',
      ],
      complexity: 'Minutes of measurement; saves days of speculative work.',
      gotchas: [
        'Profile with production-like data volumes — algorithms that are fine at 1,000 rows are not at 10 million.',
        'A CPU profiler shows nothing useful when the bottleneck is waiting; use a thread dump or tracing for that.',
      ],
      problems: ['Take a flame graph and find the hot method', 'Diagnose a low-CPU slowdown'],
    },
    {
      id: 'fix-the-query',
      name: 'Look at the SQL First',
      oneLiner: 'In a typical service, the database is the bottleneck far more often than the JVM.',
      useWhen: ['Any slow endpoint that touches persistence.'],
      recognize: ['Slowness proportional to result size.', 'A query count that grows with rows returned.'],
      steps: [
        'Log the SQL and count the queries for one request.',
        'Fix N+1 with a join fetch or a projection.',
        'Run `EXPLAIN ANALYZE` on anything still slow and check for sequential scans.',
        'Add the index, re-measure.',
      ],
      complexity: 'Usually the single largest available improvement.',
      gotchas: [
        'Indexes speed reads and slow writes — do not add one per column.',
        'Use `CREATE INDEX CONCURRENTLY` in production to avoid locking the table.',
        'Confirm the plan actually uses the new index; sometimes the optimiser declines.',
      ],
      problems: ['Find and fix an N+1', 'Add an index and compare the plan'],
    },
    {
      id: 'reduce-allocation',
      name: 'Allocate Less in Hot Paths',
      oneLiner: 'GC pressure is a symptom; allocation rate is the cause.',
      useWhen: ['Frequent young collections, or an allocation profile dominated by one call site.'],
      recognize: ['High GC frequency with a small live set.', 'String concatenation or boxing inside a loop.'],
      steps: [
        'Take an allocation profile to find the call site.',
        'Presize collections, use `StringBuilder`, avoid boxing in hot loops.',
        'Re-measure — this should reduce GC frequency, not pause duration.',
      ],
      template: {
        lang: 'java',
        caption: 'Small changes, large effect in a hot loop',
        code: `
// Allocates a new String every iteration — O(n²) copying plus GC pressure
String out = "";
for (String s : items) out += s;

// One buffer, presized
StringBuilder sb = new StringBuilder(items.size() * 16);
for (String s : items) sb.append(s);

// Presize collections when the size is known
List<Order> list = new ArrayList<>(expectedSize);
Map<String, Order> map = new HashMap<>((int)(expectedSize / 0.75f) + 1);

// Avoid boxing in numeric hot loops
long total = 0;                       // not Long — that boxes on every add
for (int i = 0; i < n; i++) total += values[i];`,
      },
      complexity: 'Fewer young collections; often a large tail-latency win.',
      gotchas: [
        'Short-lived allocation is cheap — do not contort readable code for it outside a genuine hot path.',
        'Object pooling is almost always counterproductive on a modern JVM.',
      ],
      problems: ['Profile allocation and find the top site', 'Fix a quadratic string build'],
    },
  ],

  pitfalls: [
    { title: 'Optimising without measuring', text: 'You almost certainly fix something that was not the problem.' },
    { title: 'Benchmarking a cold JVM', text: 'Results can be an order of magnitude wrong before the JIT warms up.' },
    { title: 'Testing with unrealistic data volumes', text: 'Everything is fast with a thousand rows.' },
    { title: 'Copying JVM flags from a blog', text: 'Most tuning advice predates G1 and modern container support.' },
    { title: 'Blaming the garbage collector', text: 'Usually an application allocation or retention problem.' },
    { title: 'Oversizing the connection pool', text: 'More connections than the database can use just moves the queue and costs memory.' },
    { title: 'Using a CPU profiler for an IO problem', text: 'It will show almost nothing. Use a thread dump or tracing.' },
    { title: 'Optimising the mean', text: 'Users feel the tail. Optimise p99.' },
    { title: 'Micro-optimising cold code', text: 'A method that runs once per hour does not matter, however inefficient.' },
    { title: 'Premature caching', text: 'Adds staleness and invalidation bugs before you know it helps.' },
  ],

  cheatsheet: [
    { label: 'Rule', value: 'measure, fix one thing, measure' },
    { label: 'Check first', value: 'the SQL' },
    { label: 'Slow + low CPU', value: 'IO or lock wait' },
    { label: 'Slow + high CPU', value: 'profile it' },
    { label: 'Memory grows', value: 'heap dump, dominator tree' },
    { label: 'Latency spikes', value: 'GC log or cache expiry' },
    { label: 'Flame graph', value: 'read width, not height' },
    { label: 'Hang', value: 'three thread dumps, 10s apart' },
    { label: 'Profiler', value: 'JFR or async-profiler' },
    { label: 'Slow queries', value: 'pg_stat_statements' },
    { label: 'Query plan', value: 'EXPLAIN (ANALYZE, BUFFERS)' },
    { label: 'Heap', value: '-XX:MaxRAMPercentage=75' },
    { label: 'Pool saturated', value: 'hikaricp_connections_pending > 0' },
    { label: 'Optimise', value: 'p99, not the mean' },
  ],

  problems: [
    { name: 'Benchmark a cold versus warm JVM', difficulty: 'Easy', pattern: 'JIT', insight: 'Time the same method in batches of 10,000. The first batches are far slower. Then do it properly with JMH.' },
    { name: 'Find a slow query', difficulty: 'Easy', pattern: 'Database', insight: 'Enable `pg_stat_statements`, run a load test, and rank statements by total time rather than by mean.' },
    { name: 'Read an EXPLAIN plan', difficulty: 'Medium', pattern: 'Database', insight: 'Find a Seq Scan on a large table, add the index, and compare actual times before and after.' },
    { name: 'Take a flame graph', difficulty: 'Medium', pattern: 'Profiling', insight: 'Run async-profiler against a loaded service for 30 seconds and identify the widest frame.' },
    { name: 'Diagnose a slowdown with idle CPU', difficulty: 'Medium', pattern: 'Thread dumps', insight: 'Add a slow downstream call, load the service, and find every thread blocked in socketRead.' },
    { name: 'Find an allocation hot spot', difficulty: 'Medium', pattern: 'Allocation', insight: 'Profile allocation on a loop building strings with +=. Fix it with StringBuilder and compare GC frequency.' },
    { name: 'Show pool exhaustion', difficulty: 'Hard', pattern: 'Saturation', insight: 'Pool of 5, 50 concurrent slow queries. `hikaricp_connections_pending` goes above zero and latency climbs while CPU stays low.' },
    { name: 'Catch an N+1 with a test', difficulty: 'Hard', pattern: 'Regression prevention', insight: 'Assert the Hibernate statement count in a test so the fix cannot be undone by a later change.' },
    { name: 'Correlate GC pauses with latency spikes', difficulty: 'Hard', pattern: 'GC', insight: 'Enable -Xlog:gc, run a load test, and line the pause timestamps up against the p99 chart.' },
    { name: 'Measure the effect of MaxRAMPercentage', difficulty: 'Medium', pattern: 'Container tuning', insight: 'Run the same container at 50% and 90%. The second gets more heap but risks an OOMKill from non-heap memory.' },
  ],
}
