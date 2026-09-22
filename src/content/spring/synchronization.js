export default {
  id: 'synchronization',
  title: 'Synchronization & the Java Memory Model',
  short: 'Synchronization',
  icon: 'LockRounded',
  tier: 'Core',
  order: 8,
  estHours: 7,
  prereqs: ['threads-executors'],
  tagline: 'Two threads, one variable, and no guarantee the second one ever sees the first one’s write.',
  mentalModel:
    'Concurrency has **two** problems, and people only remember one. **Atomicity**: an operation can be interrupted half-way. **Visibility**: a write by one thread may never become visible to another, because each CPU core has its own cache and the compiler is free to reorder. `synchronized` fixes both; `volatile` fixes only the second.',
  whyItMatters:
    'Race conditions do not throw exceptions. They produce a slightly wrong number once a week, on one server, under load — and they are effectively impossible to reproduce locally. Getting this right by construction is the only strategy that works.',

  reference: {
    title: 'Which tool solves which problem',
    head: ['Tool', 'Atomicity', 'Visibility', 'Use it for'],
    rows: [
      ['`volatile`', 'No', 'Yes', 'A flag written by one thread, read by others'],
      ['`synchronized`', 'Yes', 'Yes', 'Compound operations on shared mutable state'],
      ['`ReentrantLock`', 'Yes', 'Yes', 'When you need tryLock, timeouts or fairness'],
      ['`AtomicInteger` etc.', 'Yes (single variable)', 'Yes', 'Counters and single-value updates'],
      ['Immutability', 'N/A', 'N/A', '**The best answer** — nothing to synchronise'],
      ['Confinement', 'N/A', 'N/A', 'Keep the state inside one thread'],
    ],
  },

  sections: [
    {
      id: 'two-problems',
      title: 'The two problems, demonstrated',
      blocks: [
        { t: 'h', text: 'Problem 1 — atomicity' },
        {
          t: 'code',
          lang: 'java',
          caption: '`count++` is three operations, not one',
          code: `
class Counter {
    private int count = 0;
    public void increment() { count++; }     // READ, ADD 1, WRITE — interruptible
    public int get() { return count; }
}

// Two threads, 10,000 increments each. Expected 20,000.
// Actual: something less, and different every run.
//
//   Thread A: read count (5)
//   Thread B: read count (5)        <- both read the same value
//   Thread A: write 6
//   Thread B: write 6               <- one increment vanished`,
        },
        { t: 'h', text: 'Problem 2 — visibility' },
        {
          t: 'code',
          lang: 'java',
          caption: 'A loop that never ends, even though the flag was set',
          code: `
class Worker {
    private boolean running = true;          // no volatile

    public void run() {
        while (running) {                    // may be hoisted out of the loop
            doWork();
        }
        // The JIT is allowed to rewrite this as:
        //   if (running) { while (true) doWork(); }
        // because within this thread, nothing changes 'running'.
    }

    public void stop() { running = false; }  // another thread — may never be seen
}`,
        },
        {
          t: 'key',
          title: 'Why visibility is not obvious',
          text: 'Each core has its own cache, and both the compiler and the CPU may reorder instructions as long as *single-threaded* behaviour is preserved. Without a synchronisation point, there is no rule that says another thread must ever see your write. Adding `volatile` to `running` fixes exactly this.',
        },
      ],
    },
    {
      id: 'happens-before',
      title: 'Happens-before: the rule that makes it all precise',
      blocks: [
        { t: 'p', text: 'The Java Memory Model does not say "writes become visible quickly". It defines a **happens-before** relationship: if action A happens-before action B, then everything A did is visible to B. Without such a relationship, there is no guarantee at all.' },
        {
          t: 'dl',
          items: [
            { term: 'Program order', def: 'Within one thread, earlier statements happen-before later ones.' },
            { term: 'Monitor lock', def: 'Unlocking a monitor happens-before any later lock of the *same* monitor. This is why `synchronized` gives visibility as well as mutual exclusion.' },
            { term: 'Volatile', def: 'A write to a volatile field happens-before every later read of it.' },
            { term: 'Thread start', def: 'Everything before `t.start()` happens-before anything in the new thread.' },
            { term: 'Thread join', def: 'Everything in a thread happens-before `t.join()` returns.' },
            { term: 'Final fields', def: 'Final fields set in a constructor are visible to any thread that sees the fully constructed object — provided `this` did not escape during construction.' },
          ],
        },
        {
          t: 'ascii',
          caption: 'The lock creates the edge that makes the write visible.',
          code: `
  Thread A                           Thread B
  ─────────────────────              ─────────────────────
  synchronized (lock) {
      data = compute();      ──┐
  }   // unlock                │  happens-before
                               └──▶  synchronized (lock) {
                                         read(data);   ← guaranteed to see it
                                     }

  Without the shared lock (or volatile) there is NO edge,
  and B may read a stale value forever.`,
        },
        {
          t: 'note',
          title: 'Double-checked locking needs volatile',
          text: 'The classic lazy-singleton idiom is broken without `volatile`, because another thread can see a *non-null but not yet fully constructed* object — the constructor’s writes may be reordered after the reference assignment. `volatile` forbids that reordering. In practice, prefer an enum or a Spring bean and avoid the whole puzzle.',
        },
      ],
    },
    {
      id: 'synchronized',
      title: 'synchronized, and how to use it well',
      blocks: [
        {
          t: 'code',
          lang: 'java',
          caption: 'Three forms — and why the third is best',
          code: `
class Account {
    private final Object lock = new Object();     // private lock object
    private double balance;

    // 1. Method-level: locks on 'this' — anyone can also lock on your object
    public synchronized void deposit(double amt) { balance += amt; }

    // 2. Static: locks on Account.class
    public static synchronized void resetStats() { }

    // 3. Block with a private lock — PREFERRED: nobody outside can interfere,
    //    and the critical section is as small as possible
    public void withdraw(double amt) {
        expensiveAuditLog(amt);                   // outside the lock
        synchronized (lock) {
            if (balance < amt) throw new InsufficientFundsException();
            balance -= amt;                       // the only part that needs it
        }
        notifyAsync();                            // outside the lock
    }
}`,
        },
        {
          t: 'key',
          title: 'Hold the lock for as little as possible',
          text: 'Every instruction inside a `synchronized` block is time no other thread can make progress. Never do IO, call a remote service, or log to disk while holding a lock — that is how a 5ms database hiccup becomes a 30-second application freeze.',
        },
        {
          t: 'warn',
          title: 'Never synchronize on a String literal or a boxed value',
          text: '`synchronized("lock")` and `synchronized(Integer.valueOf(1))` lock on interned, JVM-wide shared objects. Completely unrelated code can deadlock with you. Always use a `private final Object`.',
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'Deadlock, and the ordering rule that prevents it',
          code: `
// DEADLOCK: two threads take the same two locks in opposite orders
void transfer(Account from, Account to, double amt) {
    synchronized (from) {
        synchronized (to) { from.debit(amt); to.credit(amt); }
    }
}
// transfer(A, B) and transfer(B, A) running concurrently will hang forever.

// FIX: always acquire locks in a globally consistent order
void safeTransfer(Account from, Account to, double amt) {
    Account first  = from.id() < to.id() ? from : to;
    Account second = from.id() < to.id() ? to : from;
    synchronized (first) {
        synchronized (second) { from.debit(amt); to.credit(amt); }
    }
}`,
        },
        {
          t: 'tip',
          title: 'Diagnosing a deadlock takes ten seconds',
          text: 'Run `jcmd <pid> Thread.print`. The JVM detects cycles and prints "Found one Java-level deadlock" with both threads and both locks named. You do not need to guess.',
        },
      ],
    },
    {
      id: 'locks-atomics',
      title: 'ReentrantLock and the atomic classes',
      blocks: [
        { t: 'p', text: '`synchronized` cannot time out, cannot be interrupted, and cannot be acquired tentatively. `ReentrantLock` can do all three — at the cost of a mandatory `finally`.' },
        {
          t: 'code',
          lang: 'java',
          caption: 'Use a lock when you need what synchronized cannot do',
          code: `
private final ReentrantLock lock = new ReentrantLock();

public void update() {
    lock.lock();
    try {
        mutate();
    } finally {
        lock.unlock();            // MUST be in finally, or an exception leaks the lock
    }
}

// Give up rather than block forever
public boolean tryUpdate() {
    if (!lock.tryLock(100, TimeUnit.MILLISECONDS)) return false;
    try { mutate(); return true; } finally { lock.unlock(); }
}

// Many readers, one writer — when reads vastly outnumber writes
private final ReadWriteLock rw = new ReentrantReadWriteLock();
public String read()  { rw.readLock().lock();  try { return data; } finally { rw.readLock().unlock(); } }
public void write(String v) { rw.writeLock().lock(); try { data = v; } finally { rw.writeLock().unlock(); } }`,
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'Atomics: lock-free updates to a single variable',
          code: `
AtomicInteger counter = new AtomicInteger();
counter.incrementAndGet();                       // atomic, no lock
counter.addAndGet(5);
counter.compareAndSet(expected, newValue);       // the CAS primitive underneath

// Atomically derive a new value from the old one
AtomicReference<Config> config = new AtomicReference<>(initial);
config.updateAndGet(c -> c.withTimeout(5000));   // retries until it wins

// Very high contention counters: LongAdder beats AtomicLong
LongAdder requests = new LongAdder();
requests.increment();                            // striped across cells
long total = requests.sum();                     // only accurate when quiet`,
        },
        {
          t: 'note',
          title: 'How compare-and-swap works',
          text: 'CAS is a single CPU instruction: "if this memory still holds X, replace it with Y, and tell me whether you succeeded". Atomics loop on it — read, compute, try to swap, repeat if someone else won. Under low contention this is much faster than a lock because no thread is ever suspended. Under very high contention the retries dominate, which is exactly when `LongAdder` wins.',
        },
      ],
    },
    {
      id: 'avoid',
      title: 'The strategies that beat synchronisation entirely',
      blocks: [
        { t: 'lead', text: 'The fastest lock is the one you never take. Most well-written concurrent code contains very little explicit synchronisation.' },
        {
          t: 'ol',
          items: [
            '**Immutability.** An object that never changes cannot race. Make fields `final`, use records, return new instances. This is the single most effective technique.',
            '**Thread confinement.** Keep mutable state inside one thread. Local variables are automatically confined — this is why most Spring services are safe despite being shared singletons: they hold no mutable state, only local variables per request.',
            '**Concurrent collections.** `ConcurrentHashMap` handles its own locking, far better than you wrapping a `HashMap`.',
            '**Atomics.** For a single counter or reference, an atomic is simpler and faster than a lock.',
            '**Copy-on-write.** For read-heavy, rarely-written lists, `CopyOnWriteArrayList` removes read-side locking entirely.',
          ],
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'Why a Spring @Service is thread-safe — and how to break it',
          code: `
@Service
public class OrderService {
    private final OrderRepository repo;          // final, injected once — safe

    // SAFE: every variable here is local to the calling thread
    public Order place(OrderRequest req) {
        Order order = new Order(req);            // local
        return repo.save(order);
    }

    // UNSAFE: shared mutable state on a singleton bean
    private int orderCount = 0;                  // ← every request shares this
    public void countIt() { orderCount++; }      // ← race condition

    // If you truly need a counter, use an atomic:
    private final AtomicInteger safeCount = new AtomicInteger();
}`,
        },
        {
          t: 'key',
          title: 'The rule for Spring beans',
          text: 'Singleton beans must be **stateless**. Inject dependencies as `final` fields set in the constructor, keep everything else local to the method, and you never think about synchronisation again. The moment you add a mutable field to a `@Service`, you have created a concurrency bug.',
        },
      ],
    },
  ],

  patterns: [
    {
      id: 'immutable-or-confined',
      name: 'Immutable or Confined — Synchronise Only as a Last Resort',
      oneLiner: 'Remove the sharing before you try to manage it.',
      useWhen: ['Any state reachable from more than one thread.'],
      recognize: ['A mutable field on a singleton bean.', '`synchronized` appearing in application service code.'],
      steps: [
        'Can this be immutable? Make the fields final and return new instances.',
        'Can it live inside one thread? Make it a local variable.',
        'Is it a single value? Use an atomic.',
        'Only then reach for a lock.',
      ],
      template: {
        lang: 'java',
        caption: 'The same requirement, three ways',
        code: `
// Worst: shared mutable state + a lock
private final List<Event> events = new ArrayList<>();
public synchronized void add(Event e) { events.add(e); }

// Better: a concurrent collection handles its own locking
private final Queue<Event> events = new ConcurrentLinkedQueue<>();
public void add(Event e) { events.add(e); }

// Best: no shared state at all — return the result instead
public List<Event> process(List<Input> inputs) {
    return inputs.stream().map(Event::from).toList();   // all local
}`,
      },
      complexity: 'Usually faster than locking, and always easier to reason about.',
      gotchas: [
        'Immutability only helps if the reference is safely published — a `final` field or a `volatile` one.',
        'A concurrent collection makes each *operation* atomic, not your multi-step logic.',
      ],
      problems: ['Find the mutable field on a singleton bean', 'Convert a synchronized list to a concurrent one'],
    },
    {
      id: 'volatile-flag',
      name: 'Volatile Flag for Visibility Only',
      oneLiner: 'One thread writes, others read — and no compound update.',
      useWhen: ['A shutdown or feature flag.', 'A reference swapped wholesale, such as a reloaded config.'],
      recognize: ['A `boolean` loop condition set by another thread.'],
      steps: ['Mark the field `volatile`.', 'Confirm every update is a single write, not a read-modify-write.', 'If it is compound, you need an atomic or a lock instead.'],
      template: {
        lang: 'java',
        caption: 'Correct use, and the case where volatile is not enough',
        code: `
// CORRECT: a single write, many reads
private volatile boolean running = true;
public void run()  { while (running) doWork(); }
public void stop() { running = false; }

// CORRECT: swapping a whole immutable object
private volatile Config config;
public void reload() { config = loadConfig(); }   // one assignment

// WRONG: volatile does NOT make this atomic
private volatile int count;
public void inc() { count++; }                     // still a race
// Use AtomicInteger instead.`,
      },
      complexity: 'Cheaper than a lock; a memory barrier, not a suspension.',
      gotchas: [
        'Volatile gives visibility, never atomicity.',
        '`volatile` on an array reference protects the reference, not the elements.',
      ],
      problems: ['Fix a non-terminating loop with volatile', 'Show volatile failing to fix count++'],
    },
    {
      id: 'lock-ordering',
      name: 'Global Lock Ordering',
      oneLiner: 'If every thread takes locks in the same order, a deadlock cycle cannot form.',
      useWhen: ['Any code path that holds two or more locks at once.'],
      recognize: ['Nested `synchronized` blocks on caller-supplied objects.'],
      steps: [
        'Define a total order — an id, a hash, anything stable.',
        'Sort the locks before acquiring.',
        'Better: redesign so only one lock is ever held.',
      ],
      complexity: 'One comparison; prevents an entire failure class.',
      gotchas: [
        '`System.identityHashCode` can collide — add a tie-breaker lock for that rare case.',
        '`tryLock` with a timeout plus backoff is an alternative when no natural order exists.',
      ],
      problems: ['Create a deadlock and find it with jcmd', 'Fix it with lock ordering'],
    },
  ],

  pitfalls: [
    { title: 'Thinking volatile makes operations atomic', text: 'It only guarantees visibility. `count++` is still a race.' },
    { title: 'Synchronizing on a String, boxed Integer or class literal', text: 'Those objects are shared JVM-wide; unrelated code can deadlock with you.' },
    { title: 'Doing IO inside a lock', text: 'One slow call blocks every other thread waiting on that lock.' },
    { title: 'Forgetting finally with ReentrantLock', text: 'An exception leaks the lock and every other thread hangs forever.' },
    { title: 'Wrapping a HashMap with Collections.synchronizedMap', text: 'Every operation takes one global lock, and compound operations are still racy. Use ConcurrentHashMap.' },
    { title: 'Mutable fields on a singleton Spring bean', text: 'Shared across every concurrent request. The most common concurrency bug in Spring applications.' },
    { title: 'Assuming a "rare" race will not happen', text: 'At a thousand requests per second, one-in-a-million is several times a day.' },
    { title: 'Testing concurrency once and calling it correct', text: 'A race that passes 999 runs will fail the 1000th, in production.' },
  ],

  cheatsheet: [
    { label: 'Two problems', value: 'atomicity + visibility' },
    { label: 'volatile', value: 'visibility only' },
    { label: 'synchronized', value: 'both' },
    { label: 'count++', value: 'three operations — not atomic' },
    { label: 'Visibility rule', value: 'happens-before' },
    { label: 'Lock on', value: 'a private final Object' },
    { label: 'Never lock on', value: 'String, Integer, this (if public)' },
    { label: 'Deadlock fix', value: 'consistent global lock order' },
    { label: 'Find a deadlock', value: 'jcmd <pid> Thread.print' },
    { label: 'Single counter', value: 'AtomicInteger' },
    { label: 'Hot counter', value: 'LongAdder' },
    { label: 'Need a timeout', value: 'ReentrantLock.tryLock' },
    { label: 'ReentrantLock', value: 'unlock in finally, always' },
    { label: 'Best strategy', value: 'immutability + confinement' },
    { label: 'Spring beans', value: 'must be stateless' },
  ],

  problems: [
    { name: 'Lose increments in a race', difficulty: 'Easy', pattern: 'Atomicity', insight: 'Two threads, 100k increments each on a plain int. Print the total — it is always less than 200,000 and different every run.' },
    { name: 'Fix it three ways', difficulty: 'Easy', pattern: 'Atomicity', insight: 'Solve the same counter with synchronized, AtomicInteger and LongAdder. Benchmark all three under 8 threads.' },
    { name: 'Write a loop that never stops', difficulty: 'Medium', pattern: 'Visibility', insight: 'A non-volatile boolean flag set from another thread. Run with -server and enough iterations for the JIT to hoist the read. Add volatile and it terminates.' },
    { name: 'Show volatile not fixing count++', difficulty: 'Medium', pattern: 'Visibility vs atomicity', insight: 'Mark the counter volatile and rerun the race. It still loses increments — proof the two problems are separate.' },
    { name: 'Create a deadlock deliberately', difficulty: 'Medium', pattern: 'Deadlock', insight: 'Two accounts, two threads, opposite lock orders. Then run jcmd Thread.print and read the deadlock report.' },
    { name: 'Fix the deadlock with ordering', difficulty: 'Medium', pattern: 'Lock ordering', insight: 'Sort the two locks by id before acquiring. Run the same test 10,000 times without a hang.' },
    { name: 'Break a singleton Spring bean', difficulty: 'Medium', pattern: 'Shared state', insight: 'Add an int counter to a @Service, hit the endpoint with 50 concurrent requests, and compare the count with the request total.' },
    { name: 'Measure lock contention', difficulty: 'Hard', pattern: 'Performance', insight: 'Benchmark synchronized vs AtomicInteger vs LongAdder at 1, 4 and 32 threads. The winner changes with contention.' },
    { name: 'Hold a lock across IO', difficulty: 'Hard', pattern: 'Lock scope', insight: 'Put a 200ms sleep inside a synchronized block and send concurrent requests. Throughput collapses to 5/sec. Move the sleep outside and it recovers.' },
    { name: 'Break double-checked locking', difficulty: 'Hard', pattern: 'Safe publication', insight: 'Implement the lazy singleton without volatile. Reason about why another thread could observe a partially constructed object, then add volatile.' },
  ],
}
