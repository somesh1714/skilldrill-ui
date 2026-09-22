export default {
  id: 'completable-future',
  title: 'CompletableFuture & Async Composition',
  short: 'CompletableFuture',
  icon: 'AllInclusiveRounded',
  tier: 'Core',
  order: 10,
  estHours: 5,
  prereqs: ['threads-executors'],
  tagline: 'Run independent calls at the same time, and describe what happens next instead of waiting.',
  mentalModel:
    'A `Future` is a receipt you must queue up to redeem — `get()` blocks. A `CompletableFuture` lets you staple instructions to the receipt: "when this arrives, do that". Nobody blocks until the very end, so three 100ms calls take 100ms instead of 300ms.',
  whyItMatters:
    'Most backend latency is waiting on other systems. If an endpoint makes three independent calls sequentially, you are three times slower than you need to be — and fixing it is usually a ten-line change.',

  reference: {
    title: 'The method families',
    head: ['Method', 'Takes', 'Returns', 'Use for'],
    rows: [
      ['`supplyAsync(sup)`', '`Supplier<T>`', '`CF<T>`', 'Start async work that produces a value'],
      ['`runAsync(run)`', '`Runnable`', '`CF<Void>`', 'Start async work with no result'],
      ['`thenApply(fn)`', '`T -> R`', '`CF<R>`', 'Transform the result'],
      ['`thenCompose(fn)`', '`T -> CF<R>`', '`CF<R>`', 'Chain another async call (flatMap)'],
      ['`thenCombine(other, fn)`', '`(T,U) -> R`', '`CF<R>`', 'Join two independent results'],
      ['`allOf(...)` / `anyOf(...)`', '`CF...`', '`CF<Void>` / `CF<Object>`', 'Wait for all, or for the first'],
      ['`exceptionally(fn)`', '`Throwable -> T`', '`CF<T>`', 'Recover with a fallback'],
      ['`handle(fn)`', '`(T, Throwable) -> R`', '`CF<R>`', 'Handle success and failure together'],
      ['`orTimeout(d, unit)`', '—', '`CF<T>`', 'Fail if it takes too long (Java 9+)'],
    ],
  },

  sections: [
    {
      id: 'parallel',
      title: 'The win: independent calls in parallel',
      blocks: [
        {
          t: 'code',
          lang: 'java',
          caption: '300ms becomes 100ms',
          code: `
// SEQUENTIAL — each call waits for the previous one. 300ms total.
Profile profile = profileClient.fetch(userId);      // 100ms
Orders orders   = orderClient.fetch(userId);        // 100ms
Prefs prefs     = prefsClient.fetch(userId);        // 100ms
return new Dashboard(profile, orders, prefs);

// PARALLEL — all three start immediately. ~100ms total.
CompletableFuture<Profile> p = supplyAsync(() -> profileClient.fetch(userId), pool);
CompletableFuture<Orders>  o = supplyAsync(() -> orderClient.fetch(userId), pool);
CompletableFuture<Prefs>   f = supplyAsync(() -> prefsClient.fetch(userId), pool);

return allOf(p, o, f)                 // completes when all three do
        .thenApply(v -> new Dashboard(p.join(), o.join(), f.join()))
        .join();                      // join() only at the very end`,
        },
        {
          t: 'key',
          title: 'Only parallelise things that are genuinely independent',
          text: 'If call B needs the result of call A, you cannot run them at the same time — use `thenCompose` to chain instead. The gain comes purely from the calls that could always have happened simultaneously.',
        },
        {
          t: 'warn',
          title: 'Always pass your own executor',
          text: 'Without an executor argument, `supplyAsync` uses `ForkJoinPool.commonPool()`, which is sized for CPU-bound work (cores − 1) and **shared by the entire JVM**, including parallel streams. Blocking IO on it starves everything else. For IO work, always pass a dedicated pool.',
        },
      ],
    },
    {
      id: 'composing',
      title: 'Composing: apply, compose, combine',
      blocks: [
        {
          t: 'code',
          lang: 'java',
          caption: 'The distinction that trips everyone up',
          code: `
// thenApply — the function returns a plain value
CompletableFuture<String> name = userFuture.thenApply(User::name);

// thenCompose — the function returns ANOTHER future (this is flatMap)
CompletableFuture<Orders> orders = userFuture
        .thenCompose(user -> orderClient.fetchAsync(user.id()));

// Using thenApply here would give you CompletableFuture<CompletableFuture<Orders>>
// — the same nesting mistake as map vs flatMap on Optional and Stream.

// thenCombine — two independent futures, joined when both finish
CompletableFuture<Dashboard> dash = profileFuture
        .thenCombine(ordersFuture, (profile, ords) -> new Dashboard(profile, ords));`,
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'The Async suffix decides which thread runs the callback',
          code: `
future.thenApply(fn);              // runs on whichever thread completed the future
future.thenApplyAsync(fn);         // runs on the common pool
future.thenApplyAsync(fn, myPool); // runs on your pool  ← usually what you want

// This matters: without Async, a slow callback runs on the caller's
// completing thread — which might be a Netty IO thread or an HTTP client
// thread you absolutely must not block.`,
        },
        {
          t: 'tip',
          title: 'A rule of thumb',
          text: 'Use the plain form for cheap, non-blocking transforms (mapping a field). Use the `Async` form with an explicit executor for anything that blocks or takes real time.',
        },
      ],
    },
    {
      id: 'errors',
      title: 'Failure handling',
      blocks: [
        {
          t: 'code',
          lang: 'java',
          caption: 'Three ways to deal with a failed stage',
          code: `
// exceptionally — recover with a fallback value
CompletableFuture<Prefs> safe = prefsFuture
        .exceptionally(ex -> {
            log.warn("prefs unavailable, using defaults", ex);
            return Prefs.defaults();
        });

// handle — see both outcomes, always runs
CompletableFuture<String> result = future
        .handle((value, ex) -> ex != null ? "fallback" : value.toString());

// whenComplete — observe without changing the outcome (logging, metrics)
future.whenComplete((value, ex) -> {
    if (ex != null) metrics.counter("call.failed").increment();
});

// Timeouts (Java 9+)
future.orTimeout(2, TimeUnit.SECONDS)                    // fail after 2s
      .completeOnTimeout(Prefs.defaults(), 2, SECONDS);  // or default after 2s`,
        },
        {
          t: 'trap',
          title: 'Exceptions are wrapped, and a dropped future is silent',
          text: 'A failure inside a stage surfaces as `CompletionException` wrapping the real cause — always unwrap with `ex.getCause()` before checking the type. And if you never call `join`, `get` or a handler, the exception is simply never reported. A `CompletableFuture` you do not consume is a silently swallowed error.',
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'allOf does not fail fast — decide what you want',
          code: `
// allOf completes exceptionally only when everything has finished.
// If one call fails, join() throws and the others still ran.
CompletableFuture<Void> all = allOf(a, b, c);

// Often you want partial results instead: give each one a fallback first
CompletableFuture<Dashboard> resilient = allOf(
        a.exceptionally(e -> Profile.empty()),
        b.exceptionally(e -> Orders.empty()),
        c.exceptionally(e -> Prefs.defaults()))
    .thenApply(v -> new Dashboard(a.join(), b.join(), c.join()));`,
        },
      ],
    },
    {
      id: 'spring',
      title: 'In a Spring application',
      blocks: [
        {
          t: 'code',
          lang: 'java',
          caption: '@Async returning a CompletableFuture',
          code: `
@Service
public class ProfileService {

    @Async("ioExecutor")                     // always name the executor
    public CompletableFuture<Profile> fetchAsync(Long userId) {
        return CompletableFuture.completedFuture(client.fetch(userId));
    }
}

@RestController
public class DashboardController {

    @GetMapping("/dashboard/{id}")
    public Dashboard get(@PathVariable Long id) {
        var p = profileService.fetchAsync(id);
        var o = orderService.fetchAsync(id);
        return p.thenCombine(o, Dashboard::new)
                .orTimeout(3, TimeUnit.SECONDS)
                .join();
    }
}`,
        },
        {
          t: 'warn',
          title: 'Context does not follow the thread',
          text: 'Security context, MDC logging fields, request-scoped beans and transactions all live in `ThreadLocal`s. When work moves to a pool thread, they are gone — your logs lose the trace id and `SecurityContextHolder.getContext()` is empty. Either propagate explicitly (`DelegatingSecurityContextExecutor`, an MDC-copying task decorator) or capture what you need **before** going async.',
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'Propagating MDC so your logs stay traceable',
          code: `
executor.setTaskDecorator(runnable -> {
    Map<String, String> context = MDC.getCopyOfContextMap();   // on the caller
    return () -> {
        if (context != null) MDC.setContextMap(context);       // on the worker
        try { runnable.run(); } finally { MDC.clear(); }
    };
});`,
        },
        {
          t: 'note',
          title: 'Virtual threads change the calculus',
          text: 'On Java 21+, plain blocking code on virtual threads gives you most of this benefit with none of the composition complexity — see the next chapter. `CompletableFuture` remains the right tool when you genuinely need to fan out, combine results and apply per-call fallbacks.',
        },
      ],
    },
  ],

  patterns: [
    {
      id: 'fan-out-join',
      name: 'Fan Out, Then Join',
      oneLiner: 'Start every independent call at once and combine at the end.',
      useWhen: ['An endpoint aggregates several downstream services.', 'Latency is dominated by waiting, not computing.'],
      recognize: ['Sequential client calls whose inputs do not depend on each other.'],
      steps: [
        'Start each call with `supplyAsync(..., ioPool)`.',
        'Combine with `thenCombine` for two, `allOf` for more.',
        'Apply a timeout, then `join` once at the end.',
      ],
      template: {
        lang: 'java',
        caption: 'Fan out with per-call fallbacks and an overall timeout',
        code: `
var profile = supplyAsync(() -> profileClient.fetch(id), ioPool)
        .exceptionally(e -> Profile.empty());
var orders  = supplyAsync(() -> orderClient.fetch(id), ioPool)
        .exceptionally(e -> Orders.empty());

return allOf(profile, orders)
        .orTimeout(3, TimeUnit.SECONDS)
        .thenApply(v -> new Dashboard(profile.join(), orders.join()))
        .join();`,
      },
      complexity: 'Latency becomes the slowest call rather than the sum.',
      gotchas: [
        'Always pass an executor; never use the common pool for IO.',
        '`join` inside `thenApply` is safe because the futures are already complete.',
        'Give the whole aggregate a timeout, not just the individual calls.',
      ],
      problems: ['Parallelise three sequential client calls', 'Add per-call fallbacks'],
    },
    {
      id: 'compose-chain',
      name: 'Chain Dependent Calls with thenCompose',
      oneLiner: 'When the next call needs the previous result, flatten rather than nest.',
      useWhen: ['Lookup, then fetch by the id you just found.'],
      recognize: ['`CompletableFuture<CompletableFuture<T>>` in a type signature.'],
      steps: ['Use `thenCompose` when the function returns a future.', 'Use `thenApply` when it returns a plain value.'],
      complexity: 'Still sequential — the dependency is real; you just avoid blocking a thread between steps.',
      gotchas: ['Mixing up `thenApply` and `thenCompose` compiles but gives you a nested future you then have to unwrap twice.'],
      problems: ['Chain a lookup into a fetch', 'Fix a nested CompletableFuture'],
    },
    {
      id: 'timeout-fallback',
      name: 'Timeout Plus Fallback on Every External Call',
      oneLiner: 'A call with no timeout is a call that can hang forever.',
      useWhen: ['Every network call, without exception.'],
      recognize: ['`join()` or `get()` with no timeout anywhere in the chain.'],
      steps: ['`orTimeout` to fail, or `completeOnTimeout` to degrade.', 'Add `exceptionally` for a fallback value.', 'Record a metric so you can see how often it fires.'],
      complexity: 'One extra scheduled task per call.',
      gotchas: [
        '`orTimeout` does not cancel the underlying work — the HTTP call keeps running. Set a client-level timeout too.',
        'Unwrap `CompletionException` before inspecting the cause.',
      ],
      problems: ['Add orTimeout and observe it fire', 'Show the underlying call continuing after a timeout'],
    },
  ],

  pitfalls: [
    { title: 'Using the common ForkJoinPool for blocking IO', text: 'It is sized for CPU work and shared JVM-wide. One blocked stage starves parallel streams everywhere.' },
    { title: 'Calling join() in the middle of a chain', text: 'It blocks, which defeats the point. Join once, at the end.' },
    { title: 'thenApply where thenCompose is needed', text: 'Produces a nested future.' },
    { title: 'Never consuming a future', text: 'Its exception is never reported. The failure is completely silent.' },
    { title: 'Forgetting exceptions arrive wrapped', text: 'You get CompletionException; check getCause().' },
    { title: 'Assuming allOf fails fast', text: 'It waits for everything. Add per-future fallbacks if you want partial results.' },
    { title: 'Losing MDC, security context or transactions', text: 'ThreadLocals do not cross to pool threads. Propagate deliberately.' },
    { title: 'Parallelising dependent calls', text: 'No gain, and a race if you get it wrong.' },
  ],

  cheatsheet: [
    { label: 'Start async', value: 'supplyAsync(sup, pool)' },
    { label: 'Transform', value: 'thenApply' },
    { label: 'Chain a future', value: 'thenCompose' },
    { label: 'Join two', value: 'thenCombine' },
    { label: 'Wait for all', value: 'allOf(...)' },
    { label: 'First to finish', value: 'anyOf(...)' },
    { label: 'Fallback', value: 'exceptionally' },
    { label: 'Both outcomes', value: 'handle' },
    { label: 'Observe only', value: 'whenComplete' },
    { label: 'Timeout', value: 'orTimeout / completeOnTimeout' },
    { label: 'Callback thread', value: 'the Async suffix + your pool' },
    { label: 'Never use', value: 'the common pool for IO' },
    { label: 'Exception type', value: 'CompletionException — unwrap it' },
    { label: 'Block', value: 'once, at the end' },
  ],

  problems: [
    { name: 'Turn three sequential calls into one parallel batch', difficulty: 'Easy', pattern: 'Fan out', insight: 'Three 300ms sleeps. Sequential takes 900ms, parallel about 300ms. Measure both.' },
    { name: 'Nest a future by accident', difficulty: 'Easy', pattern: 'compose vs apply', insight: 'Use thenApply with a function returning a future and read the resulting type. Switch to thenCompose.' },
    { name: 'Lose an exception silently', difficulty: 'Medium', pattern: 'Silent failure', insight: 'Throw inside supplyAsync and never join. Nothing is printed. Add whenComplete and it appears.' },
    { name: 'Unwrap CompletionException', difficulty: 'Medium', pattern: 'Error handling', insight: 'Catch around join() and print the class. It is CompletionException; getCause() gives your real exception.' },
    { name: 'Starve the common pool', difficulty: 'Medium', pattern: 'Executor choice', insight: 'Submit more blocking tasks than commonPool has threads, then run a parallel stream. It stalls. Pass a dedicated pool and it recovers.' },
    { name: 'Get partial results from allOf', difficulty: 'Medium', pattern: 'Resilience', insight: 'Make one of three calls fail. Plain allOf throws; per-future exceptionally gives you a degraded dashboard.' },
    { name: 'Add a timeout that fires', difficulty: 'Medium', pattern: 'Timeouts', insight: 'orTimeout(1s) on a 3s call. Observe TimeoutException, and also that the underlying call keeps running to completion.' },
    { name: 'Lose the MDC trace id', difficulty: 'Hard', pattern: 'Context propagation', insight: 'Log inside and outside an async stage. The trace id is missing on the pool thread. Add a TaskDecorator that copies MDC.' },
    { name: 'Lose the security context', difficulty: 'Hard', pattern: 'Context propagation', insight: 'Read SecurityContextHolder inside supplyAsync — it is empty. Wrap the executor in DelegatingSecurityContextExecutor.' },
    { name: 'Compare with virtual threads', difficulty: 'Hard', pattern: 'Alternatives', insight: 'Implement the same fan-out with plain blocking calls on a virtual-thread executor. Compare the latency and the amount of code.' },
  ],
}
