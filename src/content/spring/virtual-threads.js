export default {
  id: 'virtual-threads',
  title: 'Virtual Threads',
  short: 'Virtual Threads',
  icon: 'RocketLaunchRounded',
  tier: 'Core',
  order: 11,
  estHours: 4,
  prereqs: ['threads-executors'],
  tagline: 'Blocking code that scales. The simplest style becomes the fastest one again.',
  mentalModel:
    'A platform thread is an OS thread — expensive, and you can afford a few hundred. A virtual thread is a Java object the JVM parks and unparks on a small pool of carrier threads. When it blocks on IO, the JVM detaches it and reuses the carrier for someone else. You can have millions.',
  whyItMatters:
    'For fifteen years the answer to "our service blocks on IO" was reactive programming, with all its complexity. Virtual threads (Java 21) give you most of that scalability while keeping straightforward blocking code, readable stack traces and a working debugger.',

  reference: {
    title: 'Platform threads versus virtual threads',
    head: ['', 'Platform thread', 'Virtual thread'],
    rows: [
      ['Backed by', 'An OS thread', 'A JVM object on a carrier thread'],
      ['Memory', '~1MB stack, fixed', 'A few hundred bytes, grows on demand'],
      ['Create cost', '~1ms', 'About a microsecond'],
      ['Practical count', 'Thousands', 'Millions'],
      ['Blocking on IO', 'Wastes the OS thread', 'Detaches; carrier is reused'],
      ['Pooling', 'Essential', '**Never pool them** — create one per task'],
      ['Good for', 'CPU-bound work', 'IO-bound work'],
    ],
  },

  sections: [
    {
      id: 'problem',
      title: 'The problem they solve',
      blocks: [
        { t: 'p', text: 'A typical request spends 1ms computing and 100ms waiting on a database and two HTTP calls. With platform threads, each waiting request holds a whole OS thread doing nothing. Tomcat’s default 200 threads means at most 200 concurrent requests, no matter how idle the CPU is.' },
        {
          t: 'ascii',
          caption: 'The carrier thread is released while you wait.',
          code: `
  PLATFORM THREADS (200 available)
  req 1  ████░░░░░░░░░░░░░░░░████    thread held for the whole 100ms
  req 2  ████░░░░░░░░░░░░░░░░████
  ...                                request 201 waits for a free thread

  VIRTUAL THREADS (millions)
  vt 1   ████                ████    carrier released during the wait
  vt 2       ████                ████
  vt 3           ████                ████
         └── one carrier thread serves all of them ──┘`,
        },
        {
          t: 'key',
          title: 'Only IO-bound work benefits',
          text: 'Virtual threads do not make anything faster — they stop threads being wasted while blocked. For CPU-bound work you are still limited by cores, and a virtual thread gives you nothing. The gain is purely in concurrency for work that waits.',
        },
      ],
    },
    {
      id: 'using',
      title: 'Using them',
      blocks: [
        {
          t: 'code',
          lang: 'java',
          caption: 'The API is deliberately boring',
          code: `
// One-off
Thread.startVirtualThread(() -> handle(request));

// An executor that creates a NEW virtual thread per task — no pooling
try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
    for (Request r : requests) {
        executor.submit(() -> handle(r));      // 1,000,000 of these is fine
    }
}   // close() waits for all tasks — it is AutoCloseable

// Check what you are on
Thread.currentThread().isVirtual();`,
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'Turning it on in Spring Boot 3.2+',
          code: `
# application.yml — this single line moves Tomcat, @Async and @Scheduled
# onto virtual threads
spring:
  threads:
    virtual:
      enabled: true`,
        },
        {
          t: 'trap',
          title: 'Never pool virtual threads',
          text: '`Executors.newFixedThreadPool(200, virtualThreadFactory)` is a contradiction — you have reintroduced the exact limit you were trying to remove, while adding overhead. Virtual threads are cheap precisely so you can create one per task and throw it away.',
        },
        {
          t: 'warn',
          title: 'And stop sizing your thread pool for IO',
          text: 'With virtual threads the limiting resource moves elsewhere — usually to your database connection pool. Ten thousand concurrent virtual threads all waiting for 20 connections is still 20 concurrent queries; you have just moved the queue. Size the connection pool deliberately and add a semaphore or bulkhead in front of downstream calls.',
        },
      ],
    },
    {
      id: 'pinning',
      title: 'Pinning: the one thing that breaks the model',
      blocks: [
        { t: 'p', text: 'A virtual thread can usually be unmounted when it blocks. In two situations it cannot, and it **pins** the carrier thread — blocking a real OS thread and undoing the benefit.' },
        {
          t: 'ol',
          items: [
            'Blocking inside a `synchronized` block or method.',
            'Blocking inside a native call (JNI).',
          ],
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'The fix is usually a one-word change',
          code: `
// PINS the carrier — the virtual thread cannot unmount while inside
public synchronized Response call() {
    return httpClient.send(request);        // blocking IO inside synchronized
}

// Does NOT pin — ReentrantLock is virtual-thread aware
private final ReentrantLock lock = new ReentrantLock();

public Response call() {
    lock.lock();
    try {
        return httpClient.send(request);
    } finally {
        lock.unlock();
    }
}`,
        },
        {
          t: 'tip',
          title: 'Find pinning before it finds you',
          text: 'Run with `-Djdk.tracePinnedThreads=full` and it prints a stack trace every time a virtual thread pins. Do this once when you enable virtual threads — old libraries with `synchronized` around IO are the usual culprits. (Note that JDK 24 removed most pinning from `synchronized`, so on newer JDKs this matters far less.)',
        },
        {
          t: 'note',
          title: 'ThreadLocal still works, but think about cost',
          text: 'Virtual threads support `ThreadLocal`, but a million virtual threads each holding a large thread-local value is a million copies. Java 21 introduces `ScopedValue` as a cheaper, immutable, explicitly-scoped alternative for passing context down a call chain.',
        },
      ],
    },
    {
      id: 'structured',
      title: 'Structured concurrency',
      blocks: [
        { t: 'p', text: 'The companion feature: if you start several subtasks, they should all finish — or all be cancelled — before the method returns. No leaked threads, no orphaned work.' },
        {
          t: 'code',
          lang: 'java',
          caption: 'Fan-out where failure cancels the siblings automatically',
          code: `
// Preview API — the exact shape varies by JDK version
try (var scope = new StructuredTaskScope.ShutdownOnFailure()) {
    Subtask<Profile> profile = scope.fork(() -> profileClient.fetch(id));
    Subtask<Orders>  orders  = scope.fork(() -> orderClient.fetch(id));

    scope.join();              // wait for both
    scope.throwIfFailed();     // if either failed, the other was cancelled

    return new Dashboard(profile.get(), orders.get());
}   // leaving the block guarantees nothing is still running`,
        },
        {
          t: 'key',
          title: 'Why this is better than CompletableFuture for fan-out',
          text: 'The lifetime of the subtasks is bounded by the block, exactly like a `try-with-resources`. If one fails, the others are cancelled rather than left running. And stack traces show the real call hierarchy instead of a pool thread with no context.',
        },
      ],
    },
  ],

  patterns: [
    {
      id: 'thread-per-task',
      name: 'Thread Per Task',
      oneLiner: 'Create a virtual thread for every unit of work and let it block freely.',
      useWhen: ['IO-bound request handling, fan-out to many services, high-concurrency clients.'],
      recognize: ['A fixed pool sized far above the core count purely because the work blocks.'],
      steps: ['Use `newVirtualThreadPerTaskExecutor`.', 'Write plain blocking code.', 'Move the concurrency limit to the real bottleneck — usually the connection pool.'],
      template: {
        lang: 'java',
        caption: 'Ten thousand concurrent calls, no pool sizing',
        code: `
try (var exec = Executors.newVirtualThreadPerTaskExecutor()) {
    List<Future<Result>> futures = ids.stream()
            .map(id -> exec.submit(() -> client.fetch(id)))   // blocking is fine
            .toList();

    for (var f : futures) results.add(f.get());
}   // close() blocks until everything finishes`,
      },
      complexity: 'Concurrency limited by the downstream, not by threads.',
      gotchas: [
        'Never pool them.',
        'Put an explicit limit in front of shared resources, or you will overwhelm the database.',
        'CPU-bound work gains nothing — keep a small platform pool for that.',
      ],
      problems: ['Run 100k concurrent sleeps', 'Compare against a fixed platform pool'],
    },
    {
      id: 'avoid-pinning',
      name: 'Avoid Pinning Around IO',
      oneLiner: 'Replace synchronized with ReentrantLock anywhere a blocking call happens inside.',
      useWhen: ['Enabling virtual threads on an existing codebase.'],
      recognize: ['`-Djdk.tracePinnedThreads` output.', 'Throughput that does not improve after switching.'],
      steps: ['Run with pinning tracing under load.', 'For each hit, either move the IO outside the lock or switch to `ReentrantLock`.', 'Re-measure.'],
      complexity: 'Restores the unmounting behaviour that makes virtual threads worthwhile.',
      gotchas: [
        'Third-party libraries are often the offenders — check driver and client versions first.',
        'Do not remove synchronisation you actually need; change the lock type, not the correctness.',
      ],
      problems: ['Detect pinning with tracePinnedThreads', 'Fix it with ReentrantLock'],
    },
    {
      id: 'limit-downstream',
      name: 'Put the Limit Where the Resource Is',
      oneLiner: 'Unlimited threads means the database becomes the thing that falls over.',
      useWhen: ['Any virtual-thread service talking to a database or rate-limited API.'],
      recognize: ['Connection pool timeouts appearing right after enabling virtual threads.'],
      steps: ['Size the connection pool for what the database can take.', 'Add a `Semaphore` or bulkhead around each downstream.', 'Fail fast when the permit is unavailable.'],
      template: {
        lang: 'java',
        caption: 'A semaphore is the simplest bulkhead',
        code: `
private final Semaphore paymentPermits = new Semaphore(50);

public Receipt charge(Payment p) throws InterruptedException {
    if (!paymentPermits.tryAcquire(200, TimeUnit.MILLISECONDS))
        throw new ServiceBusyException("payment gateway saturated");
    try {
        return gateway.charge(p);         // at most 50 concurrent
    } finally {
        paymentPermits.release();
    }
}`,
      },
      complexity: 'One permit check per call.',
      gotchas: [
        'Always use `tryAcquire` with a timeout — an unbounded wait is the queue you were avoiding.',
        'Release in a `finally`, or you leak permits and the service seizes up.',
      ],
      problems: ['Overwhelm a connection pool with virtual threads', 'Add a semaphore bulkhead'],
    },
  ],

  pitfalls: [
    { title: 'Pooling virtual threads', text: 'Reintroduces the limit and adds overhead. One per task, always.' },
    { title: 'Expecting CPU-bound speedups', text: 'They only help work that blocks.' },
    { title: 'Blocking inside synchronized', text: 'Pins the carrier and undoes the benefit on older JDKs.' },
    { title: 'Forgetting the database is still finite', text: 'A million virtual threads and 20 connections is still 20 concurrent queries — plus timeouts.' },
    { title: 'Large ThreadLocals at high thread counts', text: 'One copy per thread. Consider ScopedValue.' },
    { title: 'Assuming every library is ready', text: 'Old drivers and clients may synchronize around IO. Test under load before trusting it.' },
    { title: 'Using them to avoid fixing latency', text: 'More concurrency hides a slow dependency; it does not make it fast.' },
  ],

  cheatsheet: [
    { label: 'Create', value: 'Thread.startVirtualThread(run)' },
    { label: 'Executor', value: 'newVirtualThreadPerTaskExecutor()' },
    { label: 'Spring Boot', value: 'spring.threads.virtual.enabled=true' },
    { label: 'Pooling', value: 'never' },
    { label: 'Helps', value: 'IO-bound only' },
    { label: 'Cost', value: '~hundreds of bytes each' },
    { label: 'Pinned by', value: 'synchronized + blocking, JNI' },
    { label: 'Pinning fix', value: 'ReentrantLock' },
    { label: 'Detect pinning', value: '-Djdk.tracePinnedThreads=full' },
    { label: 'Am I virtual?', value: 'Thread.currentThread().isVirtual()' },
    { label: 'Context passing', value: 'ScopedValue over ThreadLocal' },
    { label: 'Fan-out', value: 'StructuredTaskScope' },
    { label: 'Real limit becomes', value: 'the connection pool' },
  ],

  problems: [
    { name: 'Create a million virtual threads', difficulty: 'Easy', pattern: 'Cost', insight: 'Start 1,000,000 virtual threads that sleep one second. It works. Try 100,000 platform threads and watch it die.' },
    { name: 'Confirm which kind you are on', difficulty: 'Easy', pattern: 'Basics', insight: 'Print Thread.currentThread() inside a controller before and after enabling spring.threads.virtual.enabled.' },
    { name: 'Compare throughput under IO load', difficulty: 'Medium', pattern: 'Scalability', insight: 'An endpoint that sleeps 200ms, with tomcat max-threads=50. Load test at 500 concurrent with and without virtual threads.' },
    { name: 'Show no gain on CPU work', difficulty: 'Medium', pattern: 'Limits', insight: 'Replace the sleep with a tight computation. Virtual threads make no difference — the cores are the limit.' },
    { name: 'Detect pinning', difficulty: 'Medium', pattern: 'Pinning', insight: 'Put a blocking call inside a synchronized method and run with -Djdk.tracePinnedThreads=full. Read the stack trace it prints.' },
    { name: 'Fix pinning with ReentrantLock', difficulty: 'Medium', pattern: 'Pinning', insight: 'Swap synchronized for ReentrantLock, rerun, and confirm the pinning traces stop and throughput recovers.' },
    { name: 'Exhaust the connection pool', difficulty: 'Hard', pattern: 'Downstream limits', insight: 'With virtual threads on and a HikariCP pool of 10, send 1000 concurrent DB requests. You get connection timeouts, not thread exhaustion.' },
    { name: 'Add a semaphore bulkhead', difficulty: 'Hard', pattern: 'Bulkhead', insight: 'tryAcquire with a timeout in front of the downstream call. Excess requests fail fast with a clear error instead of piling up.' },
    { name: 'Use StructuredTaskScope for fan-out', difficulty: 'Hard', pattern: 'Structured concurrency', insight: 'Fork two calls, fail one, and verify the sibling was cancelled and the scope exits cleanly.' },
    { name: 'Compare stack traces', difficulty: 'Medium', pattern: 'Debuggability', insight: 'Throw from inside a CompletableFuture chain, then from inside a virtual thread. The virtual-thread trace shows the real call hierarchy.' },
  ],
}
