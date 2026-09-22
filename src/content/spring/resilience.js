export default {
  id: 'resilience',
  title: 'Resilience: Timeouts, Retries & Circuit Breakers',
  short: 'Resilience',
  icon: 'HealthAndSafetyRounded',
  tier: 'Elite',
  order: 21,
  estHours: 5,
  prereqs: ['threads-executors', 'rest-apis'],
  tagline: 'Everything you call will fail eventually. Decide now what happens when it does.',
  mentalModel:
    'Resilience is four decisions, applied in order: **how long will I wait** (timeout), **will I try again** (retry), **when do I stop trying** (circuit breaker), and **what do I serve instead** (fallback). Skipping the first makes the other three pointless.',
  whyItMatters:
    'A single slow dependency, with no timeout, will consume every thread you have and take your service down with it. That is the most common way a distributed system fails — not a crash, but a slow call nobody bounded.',

  reference: {
    title: 'The patterns, in the order you should apply them',
    head: ['Pattern', 'Protects against', 'Cost if misused'],
    rows: [
      ['**Timeout**', 'Hanging forever', 'Too short: you fail calls that would have worked'],
      ['**Retry**', 'Transient blips', 'Amplifies load exactly when the dependency is struggling'],
      ['**Circuit breaker**', 'Hammering a dead service', 'Trips on normal variance if tuned too tightly'],
      ['**Bulkhead**', 'One dependency eating all threads', 'Under-sized limits reject healthy traffic'],
      ['**Rate limiter**', 'Overwhelming a downstream', 'Rejects legitimate bursts'],
      ['**Fallback**', 'Any of the above firing', 'Silently serving wrong data'],
    ],
  },

  sections: [
    {
      id: 'timeouts',
      title: 'Timeouts first, and everywhere',
      blocks: [
        { t: 'p', text: 'This is the one that matters most, and the one most often missing. Spring sets **no default timeout** on its HTTP clients. A downstream that stops responding without closing the connection will hold your thread until the OS gives up — which can be minutes.' },
        {
          t: 'code',
          lang: 'java',
          caption: 'Every client needs both a connect and a read timeout',
          code: `
@Bean
RestClient paymentClient(RestClient.Builder builder) {
    var factory = new SimpleClientHttpRequestFactory();
    factory.setConnectTimeout(Duration.ofSeconds(2));   // TCP handshake
    factory.setReadTimeout(Duration.ofSeconds(5));      // waiting for the response
    return builder.baseUrl(url).requestFactory(factory).build();
}

// Database — a query with no timeout can hold a connection indefinitely
spring:
  jpa:
    properties:
      jakarta.persistence.query.timeout: 5000      # milliseconds
  datasource:
    hikari:
      connection-timeout: 3000      # waiting for a connection FROM THE POOL
      validation-timeout: 2000
      max-lifetime: 1800000`,
        },
        {
          t: 'key',
          title: 'Timeouts must decrease as you go deeper',
          text: 'If your endpoint has a 10-second budget and calls three services, each cannot have a 10-second timeout — the total would be 30. Give the caller a budget, subtract as you descend, and make the inner timeouts strictly smaller. Otherwise the outer timeout fires first and the inner work continues pointlessly.',
        },
        {
          t: 'warn',
          title: 'A timeout does not cancel the work',
          text: 'When an HTTP read times out, the downstream service is usually still processing your request. If it was a write, it may well succeed *after* you gave up. This is precisely why unsafe operations need idempotency keys — a timeout is ambiguous, not a failure.',
        },
      ],
    },
    {
      id: 'retries',
      title: 'Retries, and how they cause outages',
      blocks: [
        {
          t: 'code',
          lang: 'java',
          caption: 'Resilience4j retry with exponential backoff and jitter',
          code: `
resilience4j:
  retry:
    instances:
      payment:
        max-attempts: 3
        wait-duration: 200ms
        exponential-backoff-multiplier: 2      # 200ms, 400ms, 800ms
        randomized-wait-factor: 0.5            # ±50% jitter
        retry-exceptions:
          - java.io.IOException
          - java.util.concurrent.TimeoutException
        ignore-exceptions:
          - com.acme.PaymentDeclinedException  # a business NO — never retry

@Retry(name = "payment", fallbackMethod = "chargeFallback")
public Receipt charge(Payment p) { return gateway.charge(p); }

private Receipt chargeFallback(Payment p, Exception e) {
    return Receipt.pending(p.id());            // queue it for later
}`,
        },
        {
          t: 'trap',
          title: 'Retries multiply load at the worst possible moment',
          text: 'A service starts failing. Every caller retries three times. The struggling service now receives **three times** the traffic — and if its callers also retry, the multiplication compounds through every layer. This is a retry storm, and it turns a partial degradation into a total outage. Retry at one layer only, and always with backoff and jitter.',
        },
        {
          t: 'dl',
          items: [
            { term: 'Retry only idempotent operations', def: 'GET, PUT and DELETE are safe. Retrying a POST can charge a customer twice — unless you use an idempotency key.' },
            { term: 'Retry only transient failures', def: 'Connection refused, timeout, 503. Never retry a 400 or a 401 — the answer will not change.' },
            { term: 'Always back off exponentially', def: 'Immediate retries hit a struggling service hardest.' },
            { term: 'Always add jitter', def: 'Without it, every client retries in lockstep and you get synchronised waves.' },
          ],
        },
      ],
    },
    {
      id: 'circuit-breaker',
      title: 'Circuit breakers: stop asking',
      blocks: [
        { t: 'p', text: 'When a dependency is clearly down, continuing to call it wastes threads, adds latency to every request, and delays the dependency’s recovery. A circuit breaker notices the failure rate, **opens**, and fails fast without making the call at all.' },
        {
          t: 'ascii',
          caption: 'Three states, and the probe that decides recovery.',
          code: `
              failure rate > threshold
   ┌────────┐ ──────────────────────────▶ ┌────────┐
   │ CLOSED │                             │  OPEN  │  fail fast, no call made
   │ normal │ ◀────────────────────────── │        │
   └────────┘      probes succeeded       └────────┘
        ▲                                      │ after waitDuration
        │                                      ▼
        │                               ┌─────────────┐
        └───────────────────────────────│  HALF-OPEN  │ allow a few test calls
                                        └─────────────┘
                                               │ they fail
                                               └──▶ back to OPEN`,
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'A configuration that does not trip on normal variance',
          code: `
resilience4j:
  circuitbreaker:
    instances:
      payment:
        sliding-window-type: COUNT_BASED
        sliding-window-size: 20
        minimum-number-of-calls: 10        # do not judge on 2 calls
        failure-rate-threshold: 50         # percent
        slow-call-duration-threshold: 3s
        slow-call-rate-threshold: 50       # slow counts as failing
        wait-duration-in-open-state: 30s
        permitted-number-of-calls-in-half-open-state: 3

@CircuitBreaker(name = "payment", fallbackMethod = "unavailable")
@Retry(name = "payment")                    // retry INSIDE the breaker
@TimeLimiter(name = "payment")
public Receipt charge(Payment p) { return gateway.charge(p); }`,
        },
        {
          t: 'key',
          title: 'Order matters: Retry inside, CircuitBreaker outside',
          text: 'Resilience4j applies them in a fixed order, and the sensible one is `Retry(CircuitBreaker(supplier))` — the breaker sees individual call outcomes, and the retry re-enters through it. Getting this backwards means the breaker counts a whole retry sequence as one result and reacts far too slowly.',
        },
        {
          t: 'warn',
          title: 'minimum-number-of-calls is the setting people forget',
          text: 'Without it, two failures out of two is a 100% failure rate and the breaker opens immediately — including during a quiet period where those were the only calls. Require a meaningful sample before judging.',
        },
      ],
    },
    {
      id: 'fallbacks',
      title: 'Fallbacks and graceful degradation',
      blocks: [
        { t: 'p', text: 'Failing fast is only useful if you know what to do instead. A good fallback keeps the user moving; a bad one hides a problem or returns something wrong.' },
        {
          t: 'table',
          head: ['Strategy', 'Good for', 'Watch out'],
          rows: [
            ['Cached / stale value', 'Recommendations, catalogues, config', 'Say it is stale if it matters'],
            ['A sensible default', 'Feature flags, preferences, limits', 'The default must be the safe choice'],
            ['Degraded response', 'Omit the non-essential section', 'Tell the client what is missing'],
            ['Queue for later', 'Writes that can be deferred', 'Needs durable storage and a retry worker'],
            ['Fail explicitly', 'Payments, anything about money', '**Better than guessing**'],
          ],
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'Degrade the page rather than failing it',
          code: `
public Dashboard build(Long userId) {
    Profile profile = profileService.get(userId);            // essential — let it throw

    List<Recommendation> recs;
    try {
        recs = recommendationService.get(userId);            // optional
    } catch (Exception e) {
        log.warn("Recommendations unavailable for {}", userId, e);
        meterRegistry.counter("dashboard.degraded", "part", "recs").increment();
        recs = List.of();                                     // degrade, do not fail
    }

    return new Dashboard(profile, recs, recs.isEmpty());      // flag it to the client
}`,
        },
        {
          t: 'trap',
          title: 'A silent fallback is an invisible outage',
          text: 'If recommendations have been failing for three weeks and every request quietly returns an empty list, nobody notices until someone asks why engagement dropped. **Every fallback must increment a metric and ideally trigger an alert** when its rate is high. A fallback that fires constantly is a broken feature, not resilience.',
        },
        {
          t: 'tip',
          title: 'Load shedding beats queueing',
          text: 'When you are past capacity, rejecting a request quickly with 503 and `Retry-After` is kinder than queueing it. A queued request still consumes memory, and by the time it runs the client has usually given up and retried — so you do the work twice and nobody sees the result.',
        },
      ],
    },
  ],

  patterns: [
    {
      id: 'timeout-everything',
      name: 'Timeout Every External Call',
      oneLiner: 'Nothing that leaves the process may be unbounded.',
      useWhen: ['HTTP clients, database queries, cache calls, message sends, lock acquisition.'],
      recognize: ['A client built with no request factory configuration.', 'Threads stuck in `socketRead` in a thread dump.'],
      steps: [
        'Set a connect timeout and a read timeout on every client.',
        'Set a query timeout and a connection-acquisition timeout on the database.',
        'Derive inner timeouts from the caller’s budget so they are strictly smaller.',
      ],
      template: {
        lang: 'java',
        caption: 'A deadline propagated down the call chain',
        code: `
public Dashboard build(Long id, Duration budget) {
    Instant deadline = Instant.now().plus(budget);

    Profile p = profileClient.get(id, remaining(deadline));
    Orders  o = orderClient.get(id, remaining(deadline));    // less time left
    return new Dashboard(p, o);
}

private Duration remaining(Instant deadline) {
    Duration left = Duration.between(Instant.now(), deadline);
    if (left.isNegative() || left.isZero()) throw new TimeoutException("budget spent");
    return left;
}`,
      },
      complexity: 'Bounds the worst case; nothing else works without it.',
      gotchas: [
        'A read timeout does not cancel the downstream work.',
        'The connection-pool acquisition timeout is separate from the query timeout — set both.',
      ],
      problems: ['Find an unbounded client', 'Propagate a deadline through two calls'],
    },
    {
      id: 'retry-safely',
      name: 'Retry Only What Is Safe, With Backoff and Jitter',
      oneLiner: 'Idempotent operations, transient failures, exponential backoff, randomised.',
      useWhen: ['Transient network failures on safe operations.'],
      recognize: ['Retries on POST without an idempotency key.', 'A fixed retry delay with no jitter.'],
      steps: [
        'Confirm the operation is idempotent, or add an idempotency key.',
        'List exactly which exceptions and status codes are retryable.',
        'Exponential backoff plus jitter, and a small maximum attempt count.',
        'Retry at one layer only.',
      ],
      complexity: 'Recovers from blips; multiplies load if misapplied.',
      gotchas: [
        'Never retry a 4xx — the request itself is wrong.',
        'Retrying at several layers multiplies: 3 × 3 × 3 is 27 calls for one request.',
        'Respect `Retry-After` when the downstream sends it.',
      ],
      problems: ['Cause a retry storm', 'Add jitter and measure the difference'],
    },
    {
      id: 'breaker-plus-fallback',
      name: 'Circuit Breaker With an Observable Fallback',
      oneLiner: 'Stop calling a dead dependency, serve something sensible, and count it.',
      useWhen: ['Any call to a service that can be down for minutes.'],
      recognize: ['Every request slow because they all wait for the same dead dependency.'],
      steps: [
        'Configure the breaker with a realistic window and a minimum call count.',
        'Provide a fallback appropriate to the data.',
        'Increment a metric in the fallback and alert on its rate.',
      ],
      template: {
        lang: 'java',
        caption: 'The fallback is where you make the failure visible',
        code: `
@CircuitBreaker(name = "recs", fallbackMethod = "noRecommendations")
public List<Recommendation> get(Long userId) {
    return client.fetch(userId);
}

private List<Recommendation> noRecommendations(Long userId, Throwable t) {
    meterRegistry.counter("recs.fallback",
            "reason", t.getClass().getSimpleName()).increment();
    return List.of();
}`,
      },
      complexity: 'Fails in microseconds instead of seconds while the breaker is open.',
      gotchas: [
        'The fallback signature must match the method plus a `Throwable` parameter.',
        'A fallback that throws defeats the whole purpose.',
        'Do not use a breaker on something with no meaningful fallback — failing fast with a clear error is better than a wrong answer.',
      ],
      problems: ['Trip a breaker and watch it recover', 'Alert on fallback rate'],
    },
  ],

  pitfalls: [
    { title: 'No timeout at all', text: 'The default for most Spring HTTP clients. One hung dependency takes every thread.' },
    { title: 'Inner timeouts larger than the outer budget', text: 'The outer call gives up while the inner one keeps working.' },
    { title: 'Retrying non-idempotent operations', text: 'Duplicate charges, duplicate orders.' },
    { title: 'Retrying 4xx responses', text: 'The request is wrong; repeating it changes nothing.' },
    { title: 'Retries at every layer', text: 'Multiplicative load during an incident.' },
    { title: 'No jitter', text: 'Synchronised retry waves hit the recovering service together.' },
    { title: 'Breaker with no minimum call count', text: 'Trips on two unlucky calls during a quiet period.' },
    { title: 'Silent fallbacks', text: 'A feature can be broken for weeks with nobody noticing.' },
    { title: 'Fallbacks that hide real errors', text: 'Returning an empty list for a database failure looks like "no data".' },
    { title: 'Unbounded queues as a resilience strategy', text: 'Defers the failure and turns it into an OutOfMemoryError.' },
  ],

  cheatsheet: [
    { label: 'First, always', value: 'timeouts' },
    { label: 'Spring HTTP default', value: 'no timeout' },
    { label: 'Two timeouts', value: 'connect + read' },
    { label: 'Inner timeout', value: 'strictly smaller than outer' },
    { label: 'Retry only', value: 'idempotent + transient' },
    { label: 'Never retry', value: '4xx' },
    { label: 'Backoff', value: 'exponential + jitter' },
    { label: 'Retry layers', value: 'exactly one' },
    { label: 'Breaker states', value: 'closed → open → half-open' },
    { label: 'Order', value: 'Retry inside CircuitBreaker' },
    { label: 'Breaker needs', value: 'minimum-number-of-calls' },
    { label: 'Bulkhead', value: 'a pool or semaphore per dependency' },
    { label: 'Every fallback', value: 'increments a metric' },
    { label: 'Overloaded', value: 'shed with 503 + Retry-After' },
  ],

  problems: [
    { name: 'Hang a service with no timeout', difficulty: 'Easy', pattern: 'Timeouts', insight: 'Call an endpoint that sleeps 60 seconds from a client with no read timeout. Take a thread dump and find them all in socketRead.' },
    { name: 'Add timeouts and watch it recover', difficulty: 'Easy', pattern: 'Timeouts', insight: 'Set a 2-second read timeout and repeat. Requests fail quickly and the other endpoints stay responsive.' },
    { name: 'Cause a retry storm', difficulty: 'Medium', pattern: 'Retry amplification', insight: 'Three layers, three retries each. Count the requests the bottom service receives for one top-level call. It is 27.' },
    { name: 'Compare backoff with and without jitter', difficulty: 'Medium', pattern: 'Jitter', insight: 'Fifty clients retrying a failed call. Without jitter the retries arrive in synchronised spikes; with jitter they spread out.' },
    { name: 'Trip a circuit breaker', difficulty: 'Medium', pattern: 'Circuit breaker', insight: 'Make the dependency fail, watch the state transition to OPEN, and confirm subsequent calls return in microseconds without a network call.' },
    { name: 'Watch half-open recovery', difficulty: 'Medium', pattern: 'Circuit breaker', insight: 'Restore the dependency and observe the probe calls in HALF_OPEN before it closes.' },
    { name: 'Trip a breaker on two calls', difficulty: 'Medium', pattern: 'Tuning', insight: 'Remove minimum-number-of-calls and send exactly two failing calls during a quiet period. It opens on a sample of two.' },
    { name: 'Degrade a dashboard', difficulty: 'Medium', pattern: 'Fallback', insight: 'Make one of three sections fail. The page still renders, with a flag telling the client which part is missing.' },
    { name: 'Alert on fallback rate', difficulty: 'Hard', pattern: 'Observable degradation', insight: 'Increment a counter in the fallback, then write an alert for when more than 5% of calls take it.' },
    { name: 'Show a timeout that still succeeded downstream', difficulty: 'Hard', pattern: 'Ambiguity', insight: 'Time out a write after 1 second while the downstream takes 3. The record is created anyway — which is why you need idempotency keys.' },
  ],
}
