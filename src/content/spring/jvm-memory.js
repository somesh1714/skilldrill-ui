export default {
  id: 'jvm-memory',
  title: 'How Java Runs: the JVM, Memory & Garbage Collection',
  short: 'JVM & Memory',
  icon: 'DeveloperBoardRounded',
  tier: 'Foundations',
  order: 1,
  estHours: 8,
  prereqs: [],
  tagline: 'Before you tune anything, know where your objects live and who cleans them up.',
  mentalModel:
    'Your code does not run on the machine — it runs on the JVM, a program pretending to be a machine. It hands you memory without asking, takes it back without telling you, and rewrites your code while it runs. Almost every "weird" Java behaviour comes from one of those three facts.',
  whyItMatters:
    'Every production incident that starts with "the service got slow and then died" is a memory or garbage-collection story. And the interview question "what happens when you run `java MyApp`?" is really asking whether you understand the layer you build everything on.',

  reference: {
    title: 'Where things live',
    head: ['Memory area', 'What lives there', 'Shared?', 'What goes wrong'],
    rows: [
      ['**Heap**', 'All objects and arrays', 'Shared by all threads', '`OutOfMemoryError: Java heap space`'],
      ['**Stack**', 'Local variables, method call frames, references', 'One per thread', '`StackOverflowError` from deep recursion'],
      ['**Metaspace**', 'Class definitions, method bytecode', 'Shared', '`OutOfMemoryError: Metaspace` — usually a classloader leak'],
      ['**Code cache**', 'Machine code compiled by the JIT', 'Shared', 'Fills up, JIT stops, everything slows down'],
      ['**Direct / off-heap**', 'NIO buffers, some caches', 'Shared', 'Leaks invisible to heap dumps'],
    ],
  },

  sections: [
    {
      id: 'lifecycle',
      title: 'What actually happens when you run a Java program',
      blocks: [
        { t: 'lead', text: 'Four steps. Being able to say them in order answers a very common opening interview question.' },
        {
          t: 'steps',
          items: [
            { title: 'Compile', text: '`javac` turns your `.java` files into `.class` files containing **bytecode** — instructions for the JVM, not for your CPU. This is why the same jar runs on Windows, Linux and a Mac.' },
            { title: 'Load', text: 'The classloader finds each class, verifies the bytecode is not malicious or malformed, and puts the class definition in **Metaspace**. Classes are loaded lazily — the first time they are actually needed.' },
            { title: 'Interpret', text: 'The JVM starts by reading bytecode one instruction at a time. This is correct but slow. Your application is at its slowest in the first few seconds of life.' },
            { title: 'Compile again (JIT)', text: 'The JVM counts how often each method runs. Once a method gets hot, the **Just-In-Time compiler** turns it into real machine code and swaps it in. After warm-up, Java runs close to C speed — which is why benchmarking a cold JVM gives meaningless numbers.' },
          ],
        },
        {
          t: 'key',
          title: 'Java is both interpreted and compiled',
          text: 'It compiles to bytecode ahead of time, then compiles the hot parts to machine code while running. If someone asks "is Java interpreted or compiled?", the correct answer is "both, in that order" — and the follow-up they want is that the JIT can optimise using information a static compiler never has, like which branch actually gets taken in production.',
        },
      ],
    },
    {
      id: 'stack-heap',
      title: 'Stack and heap — the distinction everything rests on',
      blocks: [
        { t: 'p', text: 'This is the single most useful mental picture in Java. **Objects always live on the heap. Variables always live on the stack.** A variable that "holds an object" actually holds a *reference* — an arrow pointing into the heap.' },
        {
          t: 'ascii',
          caption: 'Two variables, one object. Changing it through one arrow changes what the other sees.',
          code: `
  STACK  (per thread)                HEAP  (shared)
  ┌──────────────────────┐          ┌───────────────────────────┐
  │ main()               │          │                           │
  │   int count = 5      │          │   ┌───────────────────┐   │
  │   User a ──────────┐ │          │   │ User              │   │
  │   User b ──────────┼─┼──────────┼──▶│  name = "Somesh"  │   │
  │                    └─┼──────────┼──▶│  age  = 30        │   │
  └──────────────────────┘          │   └───────────────────┘   │
                                    └───────────────────────────┘

  count is a value on the stack.  a and b are arrows to the SAME object.
  a.setAge(31) changes what b sees, because there is only one object.`,
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'The consequence everyone meets eventually',
          code: `
User a = new User("Somesh", 30);
User b = a;                 // copies the ARROW, not the object
b.setAge(31);
System.out.println(a.getAge());   // 31 — same object

// To get a real copy you must make one:
User c = new User(a.getName(), a.getAge());
c.setAge(99);
System.out.println(a.getAge());   // still 31`,
        },
        { t: 'h', text: 'Java is pass-by-value — always' },
        { t: 'p', text: 'People argue about this endlessly, and the confusion is worth clearing up because it is a favourite interview trap. Java **always** copies the value of the variable into the method. For an object variable, the value *is* the arrow — so the copy points at the same object.' },
        {
          t: 'code',
          lang: 'java',
          caption: 'Why you can change an object inside a method but cannot replace it',
          code: `
void rename(User u) {
    u.setName("Changed");        // follows the arrow — the caller SEES this
    u = new User("New", 1);      // re-points the LOCAL copy of the arrow only
    u.setName("Invisible");      // caller never sees this
}

User user = new User("Original", 30);
rename(user);
System.out.println(user.getName());   // "Changed", not "New"`,
        },
        {
          t: 'trap',
          title: 'The right words to use',
          text: 'Say "Java is pass-by-value; for objects, the value being passed is the reference." Saying "Java is pass-by-reference for objects" is wrong, and interviewers listen for exactly this sentence.',
        },
        {
          t: 'note',
          title: 'Why the stack is small and fast',
          text: 'A stack frame is pushed on method entry and popped on return — no searching, no cleanup. But each thread gets a fixed stack (around 512KB–1MB by default), which is why ~10,000 nested calls blows up with `StackOverflowError`. The heap is large and flexible, but allocating from it costs more and somebody has to clean it up.',
        },
      ],
    },
    {
      id: 'gc',
      title: 'Garbage collection, explained simply',
      blocks: [
        { t: 'p', text: 'You never free memory in Java. The garbage collector does, and its rule is simple: **an object is garbage when no live reference can reach it.** Not "when it goes out of scope" and definitely not "when you set it to null".' },
        { t: 'p', text: 'The GC starts from a set of **GC roots** — local variables on every thread stack, static fields, and a few others — and walks every reference it can follow. Anything it never reaches is unreachable, and unreachable memory is free to take back.' },
        {
          t: 'ascii',
          caption: 'Reachability, not scope, decides what survives.',
          code: `
   GC ROOTS
   (stack vars, statics)
        │
        ▼
     [ A ] ──▶ [ B ] ──▶ [ C ]          reachable — all three survive

                 [ D ] ──▶ [ E ]         unreachable — both collected
                   ▲         │            (even though they reference
                   └─────────┘             each other — cycles are fine)`,
        },
        {
          t: 'key',
          title: 'Cycles are not a leak in Java',
          text: 'Two objects pointing at each other with nothing else pointing at them are both collected. Java uses reachability, not reference counting, so circular references are a non-issue. If you have ever used a language where cycles leak, unlearn that worry here.',
        },
        { t: 'h', text: 'The generational idea' },
        { t: 'p', text: 'Almost all objects die young — a request object, a DTO, the strings inside a loop. The JVM exploits this by splitting the heap:' },
        {
          t: 'ascii',
          caption: 'Objects are born in Eden and promoted only if they keep surviving.',
          code: `
  ┌──────────────── YOUNG GENERATION ────────────────┐  ┌── OLD GEN ──┐
  │  Eden            │ Survivor 0  │ Survivor 1      │  │             │
  │  (new objects)   │             │                 │  │  long-lived │
  └──────────────────┴─────────────┴─────────────────┘  └─────────────┘
         │                    │                                ▲
         └── minor GC ────────┘                                │
             survivors copied between S0/S1 ───── promoted ────┘
             (frequent, fast, milliseconds)        after N survivals`,
        },
        {
          t: 'dl',
          items: [
            { term: 'Minor GC', def: 'Cleans the young generation only. Frequent and fast because almost everything in Eden is already dead, and the collector only copies the few survivors.' },
            { term: 'Major / Full GC', def: 'Cleans the old generation too. Much slower, because long-lived objects really are still in use and must be traced and often moved.' },
            { term: 'Stop-the-world', def: 'A pause where all application threads freeze so the collector can work safely. Modern collectors make these short, not zero.' },
            { term: 'Promotion', def: 'An object that survives enough minor GCs is moved to the old generation. A steadily growing old generation is the classic signature of a memory leak.' },
          ],
        },
        {
          t: 'table',
          head: ['Collector', 'Optimises for', 'Use it when'],
          rows: [
            ['**Serial**', 'Simplicity, tiny heaps', 'Small containers, single CPU'],
            ['**Parallel**', 'Raw throughput', 'Batch jobs where a long pause is acceptable'],
            ['**G1** (default since Java 9)', 'Balanced, predictable pauses', 'Almost every normal service — start here'],
            ['**ZGC / Shenandoah**', 'Very short pauses on huge heaps', 'Latency-critical services, heaps above ~16GB'],
          ],
        },
        {
          t: 'tip',
          title: 'The honest answer about GC tuning',
          text: 'Do not tune the garbage collector. Set a sensible maximum heap, use G1, and measure. In real services, almost every "GC problem" turns out to be an application problem — an unbounded cache, an oversized query result, a leaking listener. Fix the allocation, not the collector.',
        },
      ],
    },
    {
      id: 'leaks',
      title: 'Memory leaks in a language with no manual free',
      blocks: [
        { t: 'p', text: 'A Java leak is not forgotten memory — it is **memory you are still accidentally holding on to**. The GC is working perfectly; you are the one keeping the reference alive.' },
        {
          t: 'code',
          lang: 'java',
          caption: 'The four leaks you will actually meet',
          code: `
// 1. A static collection that only ever grows.
//    Static fields are GC roots, so nothing in here is ever collected.
public class Cache {
    private static final Map<String, User> CACHE = new HashMap<>();
    public static void put(String k, User v) { CACHE.put(k, v); }   // never evicted
}

// 2. A listener that is registered and never removed.
service.addListener(this);      // 'this' is now held by the service, forever

// 3. An unclosed resource holding native memory and buffers.
InputStream in = new FileInputStream(path);   // leaks on exception
// FIX: try-with-resources closes it on every path, including exceptions
try (InputStream ok = new FileInputStream(path)) {
    read(ok);
}

// 4. A ThreadLocal that is never removed, on a pooled thread.
//    The thread lives for the life of the app, so the value does too.
private static final ThreadLocal<Context> CTX = new ThreadLocal<>();
try {
    CTX.set(context);
    handle();
} finally {
    CTX.remove();               // mandatory in any thread pool, including Tomcat
}`,
        },
        {
          t: 'trap',
          title: 'The ThreadLocal leak is the one that bites in Spring',
          text: 'Web servers reuse threads across requests. A `ThreadLocal` you set on request 1 is still there on request 500 unless you remove it — so you leak memory *and* risk leaking one user’s data into another user’s request. Always clear it in a `finally`.',
        },
        {
          t: 'h',
          text: 'How to actually find a leak',
        },
        {
          t: 'ol',
          items: [
            'Confirm it is a leak: watch old-generation usage **after** full GCs. If the floor keeps rising, memory is being retained.',
            'Take a heap dump: `jcmd <pid> GC.heap_dump /tmp/dump.hprof`, or run with `-XX:+HeapDumpOnOutOfMemoryError` so you get one automatically when it dies.',
            'Open it in Eclipse MAT or VisualVM and look at the **dominator tree** — it shows which few objects are keeping the most memory alive.',
            'Follow the "path to GC roots" for the biggest retainer. That path *is* the bug.',
          ],
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'The JVM commands worth memorising',
          code: `
jps -l                              # list running JVMs and their main classes
jcmd <pid> VM.flags                 # what flags is it actually running with?
jcmd <pid> GC.heap_info             # current heap usage by region
jcmd <pid> GC.heap_dump /tmp/d.hprof
jcmd <pid> Thread.print             # full thread dump — for deadlocks and hangs
jstat -gcutil <pid> 1000            # GC activity, once per second`,
        },
      ],
    },
    {
      id: 'flags',
      title: 'The handful of JVM flags worth knowing',
      blocks: [
        {
          t: 'code',
          lang: 'java',
          caption: 'Sensible defaults for a containerised service',
          code: `
-XX:MaxRAMPercentage=75.0     // use 75% of the CONTAINER limit as max heap
-XX:+UseG1GC                  // default since Java 9; state it anyway
-XX:+HeapDumpOnOutOfMemoryError
-XX:HeapDumpPath=/tmp
-XX:+ExitOnOutOfMemoryError   // die fast and let the orchestrator restart you

// Old advice you should NOT copy blindly:
-Xmx2g -Xms2g                 // fine on a VM, wrong in a container that may resize`,
        },
        {
          t: 'key',
          title: 'Containers: use percentages, not fixed sizes',
          text: 'Modern JVMs read the container memory limit, so `-XX:MaxRAMPercentage` adapts automatically when you change the pod limit. Hard-coding `-Xmx` means every resize needs a code change — and if you set it above the container limit, the kernel kills the process with an OOMKill that leaves no heap dump and no stack trace.',
        },
        {
          t: 'warn',
          title: 'Heap is not the whole story',
          text: 'A JVM needs heap **plus** metaspace, thread stacks, code cache, direct buffers and GC structures. Setting max heap equal to the container limit guarantees an eventual OOMKill. Leave headroom — 75% is a good starting point.',
        },
      ],
    },
  ],

  patterns: [
    {
      id: 'right-size-heap',
      name: 'Size the Heap From the Container, Not From Memory',
      oneLiner: 'Let the JVM read the limit and take a percentage of it.',
      useWhen: ['Any service running in Docker or Kubernetes.', 'You want one config that works across environments.'],
      recognize: ['Pods being OOMKilled with no Java stack trace.', 'The same `-Xmx` copied into every service regardless of its limit.'],
      steps: [
        'Set the container memory limit first — that is the real budget.',
        'Use `-XX:MaxRAMPercentage=75.0` instead of `-Xmx`.',
        'Always add `-XX:+HeapDumpOnOutOfMemoryError` so a failure leaves evidence.',
      ],
      template: {
        lang: 'java',
        caption: 'A Dockerfile entrypoint that behaves',
        code: `
ENTRYPOINT ["java", \\
  "-XX:MaxRAMPercentage=75.0", \\
  "-XX:+HeapDumpOnOutOfMemoryError", \\
  "-XX:HeapDumpPath=/tmp", \\
  "-XX:+ExitOnOutOfMemoryError", \\
  "-jar", "/app.jar"]`,
      },
      complexity: 'Costs nothing; prevents the most common container failure mode.',
      gotchas: [
        'An OOMKill (exit code 137) is the **kernel**, not the JVM — you get no heap dump. That means your heap was allowed to grow past the container limit.',
        'A JVM `OutOfMemoryError` is different: it comes from inside, and with the flag above it leaves a dump you can analyse.',
      ],
      problems: ['Trigger and diagnose a heap OOM', 'Compare OOMKill vs OutOfMemoryError'],
    },
    {
      id: 'find-the-retainer',
      name: 'Find the Retainer, Not the Allocation',
      oneLiner: 'A leak is whoever is still holding the reference — start from the dominator tree.',
      useWhen: ['Memory grows steadily and never returns after a full GC.', 'The service restarts itself every few days.'],
      recognize: ['Old-generation usage trending up over hours or days.', 'Full GCs that free almost nothing.'],
      steps: [
        'Prove retention: watch heap usage immediately after full GCs, not the sawtooth.',
        'Take a heap dump at a high-water mark.',
        'Open the dominator tree and look at the top few entries.',
        'Trace the path to GC roots — that chain names the offending field.',
      ],
      complexity: 'Minutes with a heap dump; days without one.',
      gotchas: [
        'Taking a heap dump pauses the JVM and writes a file the size of your heap — do it on one instance, not all of them.',
        'Do not chase allocation rate. High allocation of short-lived objects is normal and cheap.',
      ],
      problems: ['Build a leaking cache and find it in a heap dump', 'Diagnose a ThreadLocal leak'],
    },
    {
      id: 'bound-everything',
      name: 'Bound Every Collection That Grows',
      oneLiner: 'Any collection whose size is driven by traffic needs an explicit limit.',
      useWhen: ['Caches, in-memory queues, dedup sets, request-keyed maps.'],
      recognize: ['A `static Map` used as a cache.', '"We only store a few of these" with no eviction anywhere.'],
      steps: [
        'Ask what bounds this collection. If the answer is "traffic", it is unbounded.',
        'Replace it with a cache that has a maximum size and a TTL.',
        'Prefer a real cache library over hand-rolled eviction.',
      ],
      template: {
        lang: 'java',
        caption: 'Caffeine gives you bounds, expiry and stats in four lines',
        code: `
Cache<String, User> cache = Caffeine.newBuilder()
        .maximumSize(10_000)                          // hard bound
        .expireAfterWrite(Duration.ofMinutes(10))     // freshness
        .recordStats()                                // hit rate in your metrics
        .build();

User u = cache.get(id, this::loadFromDb);   // load-through, no race`,
      },
      complexity: 'Bounded memory in exchange for occasional recomputation.',
      gotchas: [
        'A `HashMap` used as a cache is a leak with extra steps.',
        'Weak references are not an eviction policy — they only help when the key is genuinely unreferenced elsewhere.',
      ],
      problems: ['Replace an unbounded map with Caffeine', 'Measure cache hit rate'],
    },
  ],

  pitfalls: [
    { title: 'Calling System.gc()', text: 'It is a suggestion, not a command, and it usually triggers an expensive full GC at the worst moment. There is no legitimate reason to call it in application code.' },
    { title: 'Believing setting a variable to null frees memory', text: 'It only removes one reference. If anything else still points at the object, nothing is freed.' },
    { title: 'Thinking finalize() or finalizers will clean up', text: 'They are deprecated, may never run, and delay collection. Use try-with-resources.' },
    { title: 'Benchmarking a cold JVM', text: 'The first few thousand iterations run interpreted. Warm up properly, or use JMH, or your numbers mean nothing.' },
    { title: 'Setting -Xmx equal to the container limit', text: 'Leaves no room for metaspace, stacks and buffers. The kernel kills you and you get no dump.' },
    { title: 'Treating "high memory usage" as a bug', text: 'A JVM is designed to use the heap you gave it. Rising usage between GCs is normal; rising usage *after* GCs is the problem.' },
  ],

  cheatsheet: [
    { label: 'Objects live', value: 'on the heap' },
    { label: 'Variables live', value: 'on the stack (per thread)' },
    { label: 'Java passing', value: 'pass-by-value, always' },
    { label: 'Object "value"', value: 'the reference itself' },
    { label: 'Garbage =', value: 'unreachable from GC roots' },
    { label: 'Reference cycles', value: 'collected fine' },
    { label: 'Most objects', value: 'die young → generational GC' },
    { label: 'Default collector', value: 'G1 (Java 9+)' },
    { label: 'Huge heap, low pause', value: 'ZGC / Shenandoah' },
    { label: 'Container heap', value: '-XX:MaxRAMPercentage=75' },
    { label: 'Leak signature', value: 'old gen rises after full GC' },
    { label: 'Heap dump', value: 'jcmd <pid> GC.heap_dump' },
    { label: 'Thread dump', value: 'jcmd <pid> Thread.print' },
    { label: 'Exit 137', value: 'kernel OOMKill, not the JVM' },
  ],

  problems: [
    { name: 'Print the memory the JVM thinks it has', difficulty: 'Easy', pattern: 'Runtime basics', insight: 'Call Runtime.getRuntime().maxMemory()/totalMemory()/freeMemory(). Run it with different -Xmx and MaxRAMPercentage values and confirm which one the JVM actually honours.' },
    { name: 'Cause a StackOverflowError on purpose', difficulty: 'Easy', pattern: 'Stack', insight: 'Write infinite recursion and count the frames before it throws. Then rerun with -Xss1m and watch the count roughly double — proof that stacks are per-thread and fixed.' },
    { name: 'Prove Java is pass-by-value', difficulty: 'Easy', pattern: 'References', insight: 'Write a method that both mutates its argument and reassigns it. The mutation is visible to the caller; the reassignment is not.' },
    { name: 'Watch a minor GC happen', difficulty: 'Easy', pattern: 'GC observation', insight: 'Run with -Xlog:gc and allocate short-lived objects in a loop. You should see frequent young collections that reclaim nearly everything.' },
    { name: 'Build an unbounded cache and blow the heap', difficulty: 'Medium', pattern: 'Leak by design', insight: 'Fill a static HashMap in a loop with -Xmx128m and -XX:+HeapDumpOnOutOfMemoryError. You get an OutOfMemoryError and a .hprof file — this is the artefact you want in production.' },
    { name: 'Find that leak in a heap dump', difficulty: 'Medium', pattern: 'Heap analysis', insight: 'Open the dump in Eclipse MAT, read the dominator tree, and follow the path to GC roots. It should point straight at your static field.' },
    { name: 'Leak a ThreadLocal across a pooled thread', difficulty: 'Medium', pattern: 'ThreadLocal hygiene', insight: 'Set a ThreadLocal in a task submitted to a fixed pool and never remove it. Submit a second task on the same thread and read the value — it is still there.' },
    { name: 'Compare OOMKill with OutOfMemoryError', difficulty: 'Medium', pattern: 'Container limits', insight: 'Run the same leak in Docker with -Xmx above and then below the container limit. Above: exit code 137, no dump. Below: a Java error and a usable dump.' },
    { name: 'Measure JIT warm-up', difficulty: 'Medium', pattern: 'JIT', insight: 'Time the same method over 100,000 iterations, printing every 10,000. The first batches are far slower. Rerun with -Xint to force interpretation and see the difference the JIT makes.' },
    { name: 'Diagnose a hang with a thread dump', difficulty: 'Hard', pattern: 'Thread dump analysis', insight: 'Create a deadlock between two synchronized blocks, then run jcmd Thread.print. The JVM detects and names the deadlock cycle for you.' },
    { name: 'Compare G1 with Parallel on a real workload', difficulty: 'Hard', pattern: 'GC selection', insight: 'Run an allocation-heavy benchmark under -XX:+UseG1GC and -XX:+UseParallelGC with -Xlog:gc. Parallel usually wins on total throughput; G1 wins on worst-case pause.' },
  ],
}
