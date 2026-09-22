export default {
  id: 'caching',
  title: 'Caching',
  short: 'Caching',
  icon: 'BoltOutlined',
  tier: 'Elite',
  order: 19,
  estHours: 5,
  prereqs: ['spring-ioc', 'spring-data-jpa'],
  tagline: 'The fastest query is the one you never send. The hardest problem is knowing when to stop trusting the answer.',
  mentalModel:
    'A cache trades **freshness** for **speed**. Every caching decision is really a decision about how stale an answer you can tolerate, and what happens on the unlucky request that finds the cache empty. If you cannot answer both, you are not ready to add a cache.',
  whyItMatters:
    'Caching is the cheapest large performance win available — and the most common source of "why is this user seeing yesterday’s data?". It is also where a small mistake turns into a thundering herd that takes the database down.',

  reference: {
    title: 'Where to cache, and what it costs',
    head: ['Layer', 'Latency', 'Shared across instances?', 'Watch out for'],
    rows: [
      ['**In-process** (Caffeine)', '~100ns', 'No — each pod has its own', 'Inconsistency between instances, heap usage'],
      ['**Distributed** (Redis)', '~1ms', 'Yes', 'Network hop, serialisation, another thing to operate'],
      ['**Database buffer pool**', '~1ms', 'Yes', 'Not under your control'],
      ['**HTTP / CDN**', '0 — never reaches you', 'Yes', 'Only for cacheable GETs; invalidation is hard'],
    ],
  },

  sections: [
    {
      id: 'when',
      title: 'Decide before you cache',
      blocks: [
        {
          t: 'steps',
          items: [
            { title: 'Is it actually slow?', text: 'Measure first. Caching a 2ms query to save 1.9ms while adding an invalidation bug is a bad trade.' },
            { title: 'Is it read far more than written?', text: 'Caching pays off at high read-to-write ratios. Write-heavy data mostly produces invalidations.' },
            { title: 'How stale can it be?', text: 'A product catalogue: minutes. An account balance: not at all. This answer *is* your TTL.' },
            { title: 'What happens on a miss?', text: 'If a hundred requests miss at once and all hit the database, you have built an amplifier, not a cache.' },
            { title: 'What happens if the cache is wrong?', text: 'A stale product description is untidy. A stale permission check is a security incident.' },
          ],
        },
        {
          t: 'key',
          title: 'Never cache authorization decisions',
          text: 'Permissions, roles and ownership checks must be evaluated fresh. A revoked admin who keeps their access for the next ten minutes is a security failure, not a performance optimisation.',
        },
      ],
    },
    {
      id: 'spring-cache',
      title: 'Spring’s caching abstraction',
      blocks: [
        {
          t: 'code',
          lang: 'java',
          caption: 'The three annotations',
          code: `
@Configuration
@EnableCaching
public class CacheConfig {

    @Bean
    CacheManager cacheManager() {
        CaffeineCacheManager m = new CaffeineCacheManager("products", "users");
        m.setCaffeine(Caffeine.newBuilder()
                .maximumSize(10_000)                       // bounded
                .expireAfterWrite(Duration.ofMinutes(10))  // TTL
                .recordStats());                           // hit rate in metrics
        return m;
    }
}

@Service
public class ProductService {

    @Cacheable(value = "products", key = "#id")
    public Product findById(Long id) {
        return repository.findById(id).orElseThrow();      // only runs on a miss
    }

    @CachePut(value = "products", key = "#product.id")     // always runs, updates cache
    public Product update(Product product) {
        return repository.save(product);
    }

    @CacheEvict(value = "products", key = "#id")
    public void delete(Long id) { repository.deleteById(id); }

    @CacheEvict(value = "products", allEntries = true)
    public void reindexAll() { }                            // blunt but sometimes right
}`,
        },
        {
          t: 'trap',
          title: 'The same proxy rules apply',
          text: '`@Cacheable` works through a proxy, exactly like `@Transactional`. Calling a cached method **from inside the same class** bypasses the cache entirely, with no error. And a `private` or `final` method is never cached.',
        },
        {
          t: 'warn',
          title: 'A cache with no bound and no TTL is a memory leak',
          text: 'Spring’s default `ConcurrentMapCacheManager` has **neither**. It grows forever. Always configure Caffeine or Redis with an explicit maximum size and expiry — the default is only suitable for a demo.',
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'Conditional caching — do not cache what is not worth it',
          code: `
@Cacheable(value = "search",
           key = "#query + ':' + #page",
           condition = "#page < 5",              // checked BEFORE the call
           unless = "#result.isEmpty()")         // checked AFTER — can see the result
public List<Product> search(String query, int page) { }`,
        },
      ],
    },
    {
      id: 'invalidation',
      title: 'Invalidation, and the two hard cases',
      blocks: [
        {
          t: 'dl',
          items: [
            { term: 'TTL (expire after write)', def: 'Simplest and most robust. You accept staleness up to the TTL and never have to reason about which writes affect which keys.' },
            { term: 'Explicit eviction', def: 'Precise, and fragile — every code path that writes must remember to evict. One missed path is a permanently stale entry.' },
            { term: 'Write-through', def: 'Update the cache as part of the write (`@CachePut`). Keeps it fresh but only helps if you write the same shape you read.' },
            { term: 'Versioned keys', def: 'Include a version or updated-at in the key. Old entries become unreachable and expire naturally — no eviction logic at all.' },
          ],
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'Thundering herd: many misses, one database',
          code: `
// PROBLEM: a popular key expires. 500 concurrent requests all miss and all
// query the database at once, which is exactly when it is least able to cope.

// FIX 1 — Caffeine's loading cache: only ONE thread computes per key,
// the rest wait for its result.
LoadingCache<Long, Product> cache = Caffeine.newBuilder()
        .maximumSize(10_000)
        .expireAfterWrite(Duration.ofMinutes(10))
        .refreshAfterWrite(Duration.ofMinutes(5))   // refresh in the background,
        .build(this::loadFromDb);                   // serving the stale value meanwhile

// FIX 2 — Redis: a short lock so one caller repopulates
if (redis.setIfAbsent("lock:" + key, "1", Duration.ofSeconds(5))) {
    try { value = loadFromDb(key); redis.set(key, value, ttl); }
    finally { redis.delete("lock:" + key); }
}`,
        },
        {
          t: 'key',
          title: 'refreshAfterWrite is the underrated setting',
          text: 'With `expireAfterWrite` alone, an expired key means every caller blocks on the reload. `refreshAfterWrite` set shorter than the expiry means one caller triggers an asynchronous refresh while everyone else keeps getting the slightly stale value. Latency stays flat instead of spiking.',
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'Cache penetration and stampede on missing keys',
          code: `
// PROBLEM: requests for ids that do not exist never populate the cache,
// so every one of them reaches the database. An attacker can exploit this.

// FIX: cache the absence too, with a short TTL
@Cacheable(value = "products", key = "#id")          // Optional.empty() IS cached
public Optional<Product> findById(Long id) {
    return repository.findById(id);
}
// Be careful: with 'unless = "#result == null"' you would skip caching misses
// and reintroduce the problem.`,
        },
      ],
    },
    {
      id: 'distributed',
      title: 'Redis and multi-instance caches',
      blocks: [
        {
          t: 'code',
          lang: 'java',
          caption: 'Redis with per-cache TTLs and safe serialisation',
          code: `
@Bean
RedisCacheManager cacheManager(RedisConnectionFactory factory) {
    RedisCacheConfiguration base = RedisCacheConfiguration.defaultCacheConfig()
            .entryTtl(Duration.ofMinutes(10))
            .disableCachingNullValues()
            .serializeValuesWith(SerializationPair.fromSerializer(
                    new GenericJackson2JsonRedisSerializer()));   // JSON, not Java

    return RedisCacheManager.builder(factory)
            .cacheDefaults(base)
            .withCacheConfiguration("products", base.entryTtl(Duration.ofHours(1)))
            .withCacheConfiguration("sessions", base.entryTtl(Duration.ofMinutes(30)))
            .build();
}`,
        },
        {
          t: 'warn',
          title: 'Never use Java serialization for cache values',
          text: 'It is slow, produces large payloads, breaks the moment a class changes, and deserializing untrusted bytes is a well-known remote-code-execution vector. Use JSON. Also version your cache key prefix so a deployment with a changed DTO shape does not read old entries.',
        },
        {
          t: 'compare',
          left: {
            title: 'Local (Caffeine)',
            items: [
              'Nanoseconds, no network',
              'No extra infrastructure',
              'Each instance caches separately',
              'Cold after every restart and deploy',
              'Cannot be invalidated across instances',
            ],
          },
          right: {
            title: 'Distributed (Redis)',
            items: [
              'One shared view, consistent across pods',
              'Survives restarts',
              'Invalidate once for everyone',
              '~1ms plus serialisation on every hit',
              'Another system that can fail — degrade gracefully',
            ],
          },
        },
        {
          t: 'tip',
          title: 'Two layers often beat one',
          text: 'A small, short-TTL Caffeine cache in front of Redis absorbs the hottest keys at nanosecond latency while Redis provides the shared, invalidatable layer. Keep the local TTL short — it is the window during which instances can disagree.',
        },
      ],
    },
  ],

  patterns: [
    {
      id: 'ttl-first',
      name: 'TTL First, Eviction Only If You Must',
      oneLiner: 'A short expiry is almost always safer than explicit invalidation.',
      useWhen: ['Reference data, catalogues, configuration, anything with tolerable staleness.'],
      recognize: ['Eviction logic scattered through several services.', 'A stale entry nobody can explain.'],
      steps: ['Decide the acceptable staleness.', 'Set that as the TTL.', 'Add explicit eviction only for the few cases that must be immediate.'],
      complexity: 'Bounded staleness, no invalidation bugs.',
      gotchas: [
        'One missed write path makes explicit eviction worse than useless — you trust a stale value.',
        'Always pair a TTL with a maximum size; a TTL alone does not bound memory.',
      ],
      problems: ['Replace manual eviction with a TTL', 'Find a write path that forgets to evict'],
    },
    {
      id: 'prevent-stampede',
      name: 'Prevent the Thundering Herd',
      oneLiner: 'Make sure one miss means one database query, not five hundred.',
      useWhen: ['Any hot key.', 'Expensive computations behind a cache.'],
      recognize: ['Database load spikes on a regular cycle matching your TTL.'],
      steps: [
        'Use a loading cache so concurrent misses collapse into one load.',
        'Add `refreshAfterWrite` shorter than the expiry to refresh in the background.',
        'Jitter the TTL so many keys do not expire at the same instant.',
      ],
      template: {
        lang: 'java',
        caption: 'Jitter avoids synchronised expiry',
        code: `
Duration ttl = Duration.ofMinutes(10)
        .plusSeconds(ThreadLocalRandom.current().nextInt(120));   // ±2 minutes
redis.opsForValue().set(key, value, ttl);`,
      },
      complexity: 'Flattens the load spike; latency stays predictable.',
      gotchas: [
        '`refreshAfterWrite` serves stale data while refreshing — make sure that is acceptable.',
        'A lock-based approach needs a timeout, or one crashed holder blocks the key forever.',
      ],
      problems: ['Reproduce a thundering herd', 'Fix it with a loading cache'],
    },
    {
      id: 'degrade-gracefully',
      name: 'Treat the Cache as Optional',
      oneLiner: 'If Redis is down, the service should be slow — not broken.',
      useWhen: ['Any distributed cache.'],
      recognize: ['A Redis outage causing 500s rather than higher latency.'],
      steps: ['Set short connect and read timeouts.', 'Catch cache errors and fall through to the source.', 'Emit a metric so silent degradation is visible.'],
      template: {
        lang: 'java',
        caption: 'Log the failure, serve the request',
        code: `
@Bean
CacheErrorHandler cacheErrorHandler() {
    return new SimpleCacheErrorHandler() {
        @Override
        public void handleCacheGetError(RuntimeException e, Cache cache, Object key) {
            log.warn("Cache unavailable for {} — falling through", cache.getName(), e);
            meterRegistry.counter("cache.error", "cache", cache.getName()).increment();
            // swallow: the method runs and hits the database
        }
    };
}`,
      },
      complexity: 'Higher latency during an outage instead of an outage of your own.',
      gotchas: [
        'Without a short timeout, "degraded" becomes "every request waits five seconds".',
        'Falling through en masse can overload the database — combine with a bulkhead.',
      ],
      problems: ['Kill Redis and keep serving', 'Add cache failure metrics'],
    },
  ],

  pitfalls: [
    { title: 'Caching before measuring', text: 'You add staleness and complexity for an unknown gain.' },
    { title: 'Unbounded caches', text: 'The default ConcurrentMapCacheManager has no size limit and no TTL.' },
    { title: 'Self-invocation of a @Cacheable method', text: 'Bypasses the proxy; the cache is never consulted.' },
    { title: 'Caching authorization decisions', text: 'Revoked permissions stay live until expiry.' },
    { title: 'Java serialization in Redis', text: 'Slow, brittle across versions, and a deserialization attack vector.' },
    { title: 'Forgetting to evict on one write path', text: 'A permanently stale entry that nobody can reproduce.' },
    { title: 'Every key expiring at the same moment', text: 'A synchronised stampede onto the database. Add jitter.' },
    { title: 'Not caching misses', text: 'Requests for non-existent ids hit the database every time.' },
    { title: 'Treating the cache as required', text: 'A cache outage becomes a service outage.' },
    { title: 'No hit-rate metric', text: 'A cache with a 3% hit rate is pure overhead, and you would never know.' },
  ],

  cheatsheet: [
    { label: 'Enable', value: '@EnableCaching' },
    { label: 'Read-through', value: '@Cacheable' },
    { label: 'Write-through', value: '@CachePut' },
    { label: 'Invalidate', value: '@CacheEvict' },
    { label: 'Local cache', value: 'Caffeine' },
    { label: 'Shared cache', value: 'Redis' },
    { label: 'Always set', value: 'maximumSize + TTL' },
    { label: 'Avoid stampede', value: 'loading cache + refreshAfterWrite' },
    { label: 'Avoid synchronised expiry', value: 'TTL jitter' },
    { label: 'Missing keys', value: 'cache the absence, short TTL' },
    { label: 'Redis values', value: 'JSON, never Java serialization' },
    { label: 'Never cache', value: 'authorization decisions' },
    { label: 'Cache down', value: 'degrade, do not fail' },
    { label: 'Must measure', value: 'hit rate' },
  ],

  problems: [
    { name: 'Add @Cacheable and prove it works', difficulty: 'Easy', pattern: 'Basics', insight: 'Put a log line in the method. Call it twice with the same argument — it should print once.' },
    { name: 'Bypass the cache with self-invocation', difficulty: 'Easy', pattern: 'Proxies', insight: 'Call the cached method from another method in the same class. It prints every time — the proxy was skipped.' },
    { name: 'Fill an unbounded cache', difficulty: 'Medium', pattern: 'Bounds', insight: 'Use the default cache manager, loop over a million distinct keys with -Xmx128m, and watch the heap die.' },
    { name: 'Measure the hit rate', difficulty: 'Medium', pattern: 'Observability', insight: 'Enable recordStats and expose it via Micrometer. A low hit rate means the cache is costing more than it saves.' },
    { name: 'Reproduce a thundering herd', difficulty: 'Hard', pattern: 'Stampede', insight: 'Short TTL, 200 concurrent requests for one hot key, and count the database queries at the moment it expires.' },
    { name: 'Fix it with a loading cache', difficulty: 'Hard', pattern: 'Stampede', insight: 'Switch to Caffeine build(loader) and repeat. The query count at expiry drops to one.' },
    { name: 'Create a stale entry', difficulty: 'Medium', pattern: 'Invalidation', insight: 'Write through a path that forgets to evict, then read. Fix it with a TTL and note that the bug becomes time-bounded.' },
    { name: 'Cache a miss', difficulty: 'Medium', pattern: 'Penetration', insight: 'Request a non-existent id repeatedly and count the queries. Cache Optional.empty() and the count drops to one.' },
    { name: 'Survive a Redis outage', difficulty: 'Hard', pattern: 'Degradation', insight: 'Stop the container mid-load-test. With a CacheErrorHandler and short timeouts, latency rises but requests still succeed.' },
    { name: 'Compare local and distributed caching', difficulty: 'Hard', pattern: 'Trade-offs', insight: 'Run two instances with Caffeine and observe them disagreeing after a write. Switch to Redis and confirm they agree.' },
  ],
}
