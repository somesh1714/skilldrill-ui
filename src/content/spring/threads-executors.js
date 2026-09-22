export default {
  id: 'threads-executors',
  title: 'Threads, Executors & Thread Pools',
  short: 'Threads & Executors',
  icon: 'CallSplitRounded',
  tier: 'Core',
  order: 7,
  estHours: 7,
  prereqs: ['jvm-memory'],
  tagline: 'Never create a thread by hand. Create a pool, size it deliberately, and always bound the queue.',
  mentalModel:
    'A thread is an expensive, OS-level resource — roughly 1MB of stack and a scheduling slot. A thread pool rents you one for the duration of a task and takes it back. Everything that goes wrong in production comes from a pool that is the wrong size or a queue that has no limit.',
  whyItMatters:
    'Every Spring application is already multi-threaded: Tomcat handles each request on a pool thread. Understanding pools is how you reason about "why does the service stop responding under load?" — which is almost always thread starvation, not CPU.',

  reference: {
    title: 'Thread pool sizing, by workload',
    head: ['Workload', 'Formula', 'Why'],
    rows: [
      ['**CPU-bound** (computation)', '`cores` or `cores + 1`', 'More threads just add context switching; the CPU is already busy'],
      ['**IO-bound** (DB, HTTP calls)', '`cores × (1 + wait/compute)`', 'Threads spend most of their time blocked, so you need many more'],
      ['**Mixed**', 'Measure, then tune', 'Separate the two into different pools instead of guessing'],
      ['**Database calls**', '≤ connection pool size', 'More threads than connections means threads queue for a connection anyway'],
    ],
  },

  sections: [
    {
      id: 'why-pools',
      title: 'Why you never write `new Thread()`',
      blocks: [
        { t: 'p', text: 'Creating a thread asks the operating system for a real thread: stack memory, a kernel structure, a scheduling entry. It costs roughly a millisecond and about 1MB. Creating one per task means you pay that repeatedly, and — far worse — nothing limits how many you create.' },
        {
          t: 'code',
          lang: 'java',
          caption: 'The failure mode of unbounded thread creation',
          code: `
// Under load this creates one OS thread per request.
// At 10,000 concurrent requests that is ~10GB of stack. The JVM dies with
// OutOfMemoryError: unable to create new native thread
for (Request r : incoming) {
    new Thread(() -> handle(r)).start();
}

// A pool caps concurrency. Extra work waits instead of exploding.
ExecutorService pool = Executors.newFixedThreadPool(20);
for (Request r : incoming) {
    pool.submit(() -> handle(r));
}`,
        },
        {
          t: 'key',
          title: 'A pool is a rate limiter you get for free',
          text: 'The pool size is the maximum number of things happening at once. That is not just a performance setting — it is the main thing protecting your database, your downstream services and your memory from a traffic spike.',
        },
      ],
    },
    {
      id: 'executors',
      title: 'ExecutorService and the factory methods',
      blocks: [
        {
          t: 'code',
          lang: 'java',
          caption: 'The core API',
          code: `
ExecutorService pool = Executors.newFixedThreadPool(10);

// Runnable — no result, cannot throw a checked exception
pool.execute(() -> log.info("fire and forget"));

// Callable — returns a value, may throw
Future<Integer> future = pool.submit(() -> computeSomething());
Integer result = future.get();              // BLOCKS until done
Integer safe   = future.get(5, TimeUnit.SECONDS);   // blocks with a timeout

// Run many and wait for all
List<Future<Integer>> all = pool.invokeAll(tasks);

// Shutdown is two-phase and both parts matter
pool.shutdown();                            // stop accepting, finish what is queued
if (!pool.awaitTermination(30, TimeUnit.SECONDS)) {
    pool.shutdownNow();                     // interrupt the stragglers
}`,
        },
        {
          t: 'trap',
          title: 'A failure in `execute` is loud; a failure in `submit` is silent',
          text: 'An exception thrown by a task given to `execute` goes to the thread’s uncaught-exception handler and gets logged. The same exception in `submit` is captured in the `Future` and **only surfaces when you call `get()`**. If you never call `get()`, the error vanishes completely. This is one of the most common silent-failure bugs in Java.',
        },
        {
          t: 'table',
          head: ['Factory method', 'What it really is', 'Verdict'],
          rows: [
            ['`newFixedThreadPool(n)`', 'n threads, **unbounded** queue', 'Fine, but the queue can grow until OOM'],
            ['`newCachedThreadPool()`', 'Unbounded threads, no queue', '**Dangerous** — same explosion as `new Thread()`'],
            ['`newSingleThreadExecutor()`', '1 thread, unbounded queue', 'Good for strict ordering'],
            ['`newScheduledThreadPool(n)`', 'Delayed and periodic tasks', 'Use for scheduling, not throughput'],
            ['`newVirtualThreadPerTaskExecutor()`', 'One virtual thread per task (Java 21+)', 'Excellent for IO-bound work — see the virtual threads chapter'],
            ['`new ThreadPoolExecutor(...)`', 'You control every parameter', '**What you should use in production**'],
          ],
        },
      ],
    },
    {
      id: 'tpe',
      title: 'ThreadPoolExecutor: the parameters that matter',
      blocks: [
        { t: 'p', text: 'The convenience factories hide the two decisions that cause outages: how big the queue is, and what happens when everything is full. Constructing the executor yourself forces you to answer both.' },
        {
          t: 'code',
          lang: 'java',
          caption: 'A production-shaped pool',
          code: `
ThreadPoolExecutor pool = new ThreadPoolExecutor(
        10,                                  // corePoolSize — kept alive
        50,                                  // maximumPoolSize — the hard ceiling
        60L, TimeUnit.SECONDS,               // idle timeout for threads above core
        new ArrayBlockingQueue<>(1000),      // BOUNDED queue — this is the key line
        new ThreadFactoryBuilder()
            .setNameFormat("orders-%d")      // named threads: readable thread dumps
            .build(),
        new ThreadPoolExecutor.CallerRunsPolicy());   // backpressure when full`,
        },
        {
          t: 'ascii',
          caption: 'The counter-intuitive order in which a pool grows.',
          code: `
  task arrives
      │
      ├── fewer than corePoolSize threads?   ──▶ create a new thread
      │
      ├── queue has room?                    ──▶ QUEUE IT  ← happens BEFORE
      │                                                       growing the pool
      ├── fewer than maximumPoolSize?        ──▶ create a new thread
      │
      └── otherwise                          ──▶ RejectedExecutionHandler`,
        },
        {
          t: 'trap',
          title: 'An unbounded queue means maximumPoolSize is ignored',
          text: 'Because the pool queues before it grows, a `LinkedBlockingQueue` with no capacity never fills — so the pool never grows past `corePoolSize`, and the queue grows until you run out of memory. That is exactly what `newFixedThreadPool` does. **Always pass a bounded queue.**',
        },
        {
          t: 'dl',
          items: [
            { term: '`AbortPolicy` (default)', def: 'Throws `RejectedExecutionException`. Honest — the caller learns immediately that you are overloaded.' },
            { term: '`CallerRunsPolicy`', def: 'The submitting thread runs the task itself. This is **backpressure**: the producer is slowed down because it is busy doing the work. Usually the best default for a web app.' },
            { term: '`DiscardPolicy`', def: 'Silently drops the task. Almost never what you want.' },
            { term: '`DiscardOldestPolicy`', def: 'Drops the oldest queued task. Only sensible for things like live metrics where stale data is worthless.' },
          ],
        },
        {
          t: 'key',
          title: 'Name your threads',
          text: 'A default pool produces `pool-1-thread-7`. When you take a thread dump at 3am, `orders-7` versus `email-3` is the difference between a diagnosis and a guess. It costs one line.',
        },
      ],
    },
    {
      id: 'spring',
      title: 'Thread pools in Spring',
      blocks: [
        {
          t: 'code',
          lang: 'java',
          caption: 'A named, bounded @Async executor',
          code: `
@Configuration
@EnableAsync
public class AsyncConfig {

    @Bean("emailExecutor")
    public Executor emailExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(5);
        executor.setMaxPoolSize(20);
        executor.setQueueCapacity(500);              // bounded
        executor.setThreadNamePrefix("email-");
        executor.setRejectedExecutionHandler(
                new ThreadPoolExecutor.CallerRunsPolicy());
        executor.setWaitForTasksToCompleteOnShutdown(true);
        executor.setAwaitTerminationSeconds(30);     // finish in-flight work on stop
        executor.initialize();
        return executor;
    }
}

@Service
public class EmailService {
    @Async("emailExecutor")                          // always name the executor
    public void sendWelcome(User user) { /* ... */ }
}`,
        },
        {
          t: 'warn',
          title: 'Two @Async traps that bite everyone',
          text: '**(1)** `@Async` works through a proxy, so calling an `@Async` method from *another method in the same class* runs it synchronously — the call never leaves the object. **(2)** Without naming an executor, Spring Boot uses a default whose queue is effectively unbounded. Always pass the bean name.',
        },
        {
          t: 'note',
          title: 'Your web server is already a thread pool',
          text: 'Tomcat defaults to 200 worker threads (`server.tomcat.threads.max`). If every request makes a slow downstream call, all 200 threads block and the service stops responding even though the CPU is idle. Fixing this means either lowering the latency, isolating slow calls into their own pool, or moving to virtual threads.',
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'Bulkheads: separate pools so one slow dependency cannot sink everything',
          code: `
// One pool per downstream dependency. If the payment gateway is slow,
// only 'payments' threads block — reports and emails keep working.
@Bean("payments") Executor payments() { return pool("payments-", 10, 100); }
@Bean("reports")  Executor reports()  { return pool("reports-",  4,  50); }
@Bean("emails")   Executor emails()   { return pool("emails-",   5, 500); }`,
        },
      ],
    },
    {
      id: 'lifecycle',
      title: 'Interruption and shutdown',
      blocks: [
        { t: 'p', text: 'You cannot force a thread to stop in Java — `Thread.stop()` was removed because it left objects half-modified. Instead, you **ask**, by setting an interrupt flag, and the task is responsible for noticing.' },
        {
          t: 'code',
          lang: 'java',
          caption: 'A task that can actually be cancelled',
          code: `
public void process(List<Item> items) {
    for (Item item : items) {
        if (Thread.currentThread().isInterrupted()) {   // check periodically
            log.info("Cancelled after {} items", processed);
            return;                                     // exit cleanly
        }
        handle(item);
    }
}

// Blocking calls throw InterruptedException instead of setting the flag
try {
    queue.take();                      // blocks
} catch (InterruptedException e) {
    Thread.currentThread().interrupt();  // RESTORE the flag — mandatory
    return;                              // then stop
}`,
        },
        {
          t: 'trap',
          title: 'Catching InterruptedException and continuing destroys shutdown',
          text: 'Catching it clears the flag. If you then carry on, the thread has silently ignored a cancellation request and your `awaitTermination` will time out. The rule is absolute: **either rethrow it, or restore the flag and stop.**',
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'The graceful shutdown idiom, in full',
          code: `
void shutdownGracefully(ExecutorService pool) {
    pool.shutdown();                                   // no new tasks
    try {
        if (!pool.awaitTermination(30, TimeUnit.SECONDS)) {
            pool.shutdownNow();                        // interrupt the rest
            if (!pool.awaitTermination(10, TimeUnit.SECONDS)) {
                log.error("Pool did not terminate — tasks ignore interruption");
            }
        }
    } catch (InterruptedException e) {
        pool.shutdownNow();
        Thread.currentThread().interrupt();
    }
}`,
        },
        {
          t: 'tip',
          title: 'Spring does this for you if you let it',
          text: 'Set `spring.task.execution.shutdown.await-termination=true` and an await timeout, and Spring drains its task executors during context shutdown. Without it, a rolling deploy can kill in-flight background work mid-way.',
        },
      ],
    },
  ],

  patterns: [
    {
      id: 'bounded-pool',
      name: 'Bounded Pool, Bounded Queue, Explicit Rejection',
      oneLiner: 'Decide in advance what happens when you are overloaded — because you will be.',
      useWhen: ['Every production executor, without exception.'],
      recognize: ['`Executors.newFixedThreadPool` or `newCachedThreadPool` in production code.', 'A queue with no capacity argument.'],
      steps: [
        'Construct `ThreadPoolExecutor` directly, or `ThreadPoolTaskExecutor` in Spring.',
        'Set a bounded queue whose size you can justify.',
        'Pick a rejection policy — `CallerRunsPolicy` for backpressure, `AbortPolicy` to fail loudly.',
        'Name the threads.',
      ],
      template: {
        lang: 'java',
        caption: 'A helper you can reuse for every pool',
        code: `
static ThreadPoolExecutor pool(String name, int core, int max, int queue) {
    ThreadFactory tf = r -> {
        Thread t = new Thread(r, name + "-" + COUNTER.incrementAndGet());
        t.setUncaughtExceptionHandler((th, e) ->
                log.error("Uncaught in {}", th.getName(), e));
        return t;
    };
    return new ThreadPoolExecutor(core, max, 60L, TimeUnit.SECONDS,
            new ArrayBlockingQueue<>(queue), tf,
            new ThreadPoolExecutor.CallerRunsPolicy());
}`,
      },
      complexity: 'Bounded memory and bounded concurrency, by construction.',
      gotchas: [
        'An unbounded queue makes `maximumPoolSize` dead code.',
        '`CallerRunsPolicy` blocks the caller — on a web thread that is backpressure, which is usually what you want, but be deliberate about it.',
      ],
      problems: ['Replace newFixedThreadPool with a bounded pool', 'Trigger and handle a rejection'],
    },
    {
      id: 'size-by-workload',
      name: 'Size the Pool From the Workload',
      oneLiner: 'CPU-bound pools are small; IO-bound pools are large; never use one pool for both.',
      useWhen: ['Choosing any pool size.'],
      recognize: ['Every pool in the codebase set to the same number.', 'Threads mostly sitting in `WAITING` in a thread dump.'],
      steps: [
        'Classify the work: computing, or waiting?',
        'CPU-bound → `availableProcessors()`. IO-bound → `cores × (1 + wait/compute)`.',
        'Cap IO pools at the downstream limit — usually the connection pool size.',
        'Verify with a thread dump under load.',
      ],
      template: {
        lang: 'java',
        caption: 'Working the numbers',
        code: `
int cores = Runtime.getRuntime().availableProcessors();   // say 8

// CPU-bound: 8 threads
ExecutorService cpu = pool("cpu", cores, cores, 100);

// IO-bound: 10ms compute, 90ms waiting  ->  8 * (1 + 90/10) = 80
// ...but if the DB pool only has 20 connections, 20 is the real ceiling.
ExecutorService io = pool("io", 20, 20, 500);`,
      },
      complexity: 'Correct sizing is usually worth more than any code optimisation.',
      gotchas: [
        'More threads than database connections just moves the queue.',
        'Thread dumps are the evidence: lots of `RUNNABLE` means CPU-bound, lots of `WAITING` means IO-bound.',
      ],
      problems: ['Size a pool from measured wait/compute', 'Read a thread dump to classify a workload'],
    },
    {
      id: 'bulkhead',
      name: 'Bulkhead: One Pool per Dependency',
      oneLiner: 'Isolate slow dependencies so they cannot consume every thread you have.',
      useWhen: ['A service calls several downstreams with different latency profiles.'],
      recognize: ['One slow API making the whole application unresponsive.'],
      steps: ['Give each downstream its own small pool.', 'Set timeouts on the calls themselves.', 'Let the slow pool reject rather than grow.'],
      complexity: 'More threads overall, but the failure stays contained.',
      gotchas: [
        'A bulkhead without a timeout only delays the problem.',
        'Do not create dozens of pools — group dependencies by criticality.',
      ],
      problems: ['Isolate a slow dependency into its own pool', 'Show one slow call exhausting Tomcat threads'],
    },
  ],

  pitfalls: [
    { title: 'new Thread() per task', text: 'Unbounded resource use. The JVM dies with "unable to create new native thread".' },
    { title: 'newCachedThreadPool in production', text: 'Unbounded thread creation with a different name.' },
    { title: 'Unbounded queues', text: 'Turns an overload into an OutOfMemoryError, and prevents the pool from ever growing.' },
    { title: 'submit() without ever calling get()', text: 'Exceptions disappear into the Future and are never seen.' },
    { title: 'Swallowing InterruptedException', text: 'Breaks cancellation and graceful shutdown.' },
    { title: 'Calling an @Async method from the same class', text: 'The proxy is bypassed and it runs synchronously, with no warning.' },
    { title: 'Unnamed threads', text: 'Makes thread dumps nearly useless under pressure.' },
    { title: 'Forgetting to shut the pool down', text: 'Non-daemon pool threads keep the JVM alive after main() returns.' },
    { title: 'Sharing one pool for fast and slow work', text: 'The slow work starves the fast work. Use bulkheads.' },
  ],

  cheatsheet: [
    { label: 'Never', value: 'new Thread() per task' },
    { label: 'CPU-bound size', value: 'cores' },
    { label: 'IO-bound size', value: 'cores × (1 + wait/compute)' },
    { label: 'Growth order', value: 'core → queue → max → reject' },
    { label: 'Unbounded queue', value: 'max pool size is ignored' },
    { label: 'Backpressure', value: 'CallerRunsPolicy' },
    { label: 'Fail loudly', value: 'AbortPolicy' },
    { label: 'execute()', value: 'exception → uncaught handler' },
    { label: 'submit()', value: 'exception → hidden in the Future' },
    { label: 'Cancel', value: 'interrupt + check the flag' },
    { label: 'Caught InterruptedException', value: 'restore the flag, then stop' },
    { label: 'Shutdown', value: 'shutdown → await → shutdownNow' },
    { label: 'Tomcat default', value: '200 worker threads' },
    { label: '@Async self-call', value: 'runs synchronously' },
  ],

  problems: [
    { name: 'Exhaust the JVM with raw threads', difficulty: 'Easy', pattern: 'Thread cost', insight: 'Loop creating threads that sleep. Count how many you get before OutOfMemoryError. Then set -Xss256k and watch the number roughly quadruple.' },
    { name: 'Lose an exception in submit()', difficulty: 'Easy', pattern: 'Silent failure', insight: 'Submit a task that throws and never call get(). Nothing is printed. Switch to execute() and the stack trace appears.' },
    { name: 'Name your pool threads', difficulty: 'Easy', pattern: 'Observability', insight: 'Run with default naming, take a thread dump, then add a ThreadFactory with a prefix and compare how readable the dump is.' },
    { name: 'Prove the queue fills before the pool grows', difficulty: 'Medium', pattern: 'Pool mechanics', insight: 'core=2, max=10, queue=100. Submit 50 slow tasks and print getPoolSize(). It stays at 2 — the queue absorbed everything.' },
    { name: 'Compare rejection policies', difficulty: 'Medium', pattern: 'Backpressure', insight: 'Fill a tiny bounded pool under AbortPolicy and then CallerRunsPolicy. The first throws; the second slows the submitting thread down.' },
    { name: 'Size a pool from real measurements', difficulty: 'Medium', pattern: 'Sizing', insight: 'Time the compute and wait portions of a task, apply the formula, then verify with a load test that throughput actually improves.' },
    { name: 'Catch the @Async self-invocation bug', difficulty: 'Medium', pattern: 'Proxies', insight: 'Call an @Async method from another method in the same bean and print the thread name. It is the caller thread — the proxy was bypassed.' },
    { name: 'Break graceful shutdown', difficulty: 'Hard', pattern: 'Interruption', insight: 'Write a task that swallows InterruptedException and loops. shutdownNow() cannot stop it and awaitTermination times out.' },
    { name: 'Exhaust Tomcat with one slow dependency', difficulty: 'Hard', pattern: 'Bulkhead', insight: 'Make an endpoint sleep 5 seconds, set server.tomcat.threads.max=10, and send 20 concurrent requests. Every other endpoint stops responding too.' },
    { name: 'Fix it with a bulkhead', difficulty: 'Hard', pattern: 'Bulkhead', insight: 'Move the slow call to its own bounded pool with a timeout. Fast endpoints stay responsive while the slow pool rejects.' },
  ],
}
