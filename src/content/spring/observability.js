export default {
  id: 'observability',
  title: 'Observability: Logs, Metrics & Tracing',
  short: 'Observability',
  icon: 'MonitorHeartRounded',
  tier: 'Elite',
  order: 20,
  estHours: 5,
  prereqs: ['spring-boot-config'],
  tagline: 'You cannot fix what you cannot see. Instrument before the incident, not during it.',
  mentalModel:
    'Three signals, three different questions. **Metrics** tell you *something is wrong* — they are cheap, aggregated and alertable. **Traces** tell you *where* — which service and which call. **Logs** tell you *why* — the detail for one specific request. Reaching for logs first is why debugging takes hours.',
  whyItMatters:
    'At 3am the difference between a ten-minute incident and a four-hour one is whether the service was instrumented beforehand. This is also the area juniors most often skip and seniors are most often asked about.',

  reference: {
    title: 'The three signals',
    head: ['Signal', 'Answers', 'Cost', 'Cardinality'],
    rows: [
      ['**Metrics**', 'Is something wrong? How much?', 'Very cheap — aggregated', 'Must stay low'],
      ['**Traces**', 'Where is the time going?', 'Moderate — usually sampled', 'One per request'],
      ['**Logs**', 'What exactly happened?', 'Expensive at volume', 'Unbounded'],
    ],
  },

  sections: [
    {
      id: 'logging',
      title: 'Logging that is actually searchable',
      blocks: [
        {
          t: 'code',
          lang: 'java',
          caption: 'Structured logging with context',
          code: `
private static final Logger log = LoggerFactory.getLogger(OrderService.class);

public void place(Order order) {
    // Placeholders, not concatenation — the string is only built if the
    // level is enabled, and log aggregators can index the parameters.
    log.info("Placing order id={} customer={} total={}",
             order.id(), order.customerId(), order.total());

    try {
        gateway.charge(order);
    } catch (PaymentException e) {
        // The exception goes LAST, with no placeholder — this is what
        // gives you the stack trace.
        log.error("Payment failed for order id={}", order.id(), e);
        throw e;
    }
}`,
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'MDC: attach context once, get it on every line',
          code: `
@Component
public class RequestContextFilter extends OncePerRequestFilter {

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res,
                                    FilterChain chain) throws IOException, ServletException {
        String requestId = Optional.ofNullable(req.getHeader("X-Request-Id"))
                                   .orElseGet(() -> UUID.randomUUID().toString());
        MDC.put("requestId", requestId);
        MDC.put("path", req.getRequestURI());
        try {
            res.setHeader("X-Request-Id", requestId);      // give it back to the caller
            chain.doFilter(req, res);
        } finally {
            MDC.clear();                                    // MANDATORY on a pooled thread
        }
    }
}`,
        },
        {
          t: 'trap',
          title: 'MDC must be cleared, and does not cross threads',
          text: 'Web servers reuse threads. Not clearing the MDC leaks one request’s context onto the next — including into logs you later use as evidence. And MDC is a `ThreadLocal`, so it vanishes the moment work moves to an executor; propagate it with a `TaskDecorator` (see the CompletableFuture chapter).',
        },
        {
          t: 'dl',
          items: [
            { term: 'ERROR', def: 'Something is broken and a human should look. If it fires routinely, it is not an error.' },
            { term: 'WARN', def: 'Unexpected but handled — a retry, a fallback, a deprecated call.' },
            { term: 'INFO', def: 'Significant business events: order placed, user registered. Should be readable as a narrative.' },
            { term: 'DEBUG', def: 'Developer detail, off in production by default.' },
            { term: 'TRACE', def: 'Very fine-grained; rarely enabled anywhere.' },
          ],
        },
        {
          t: 'warn',
          title: 'Never log secrets or personal data',
          text: 'Passwords, tokens, card numbers, full request bodies. Logs are copied to aggregators, backed up, and read by many people. `log.debug("request: {}", requestBody)` is how credentials end up in a search index. Mask at the point of logging, not afterwards.',
        },
      ],
    },
    {
      id: 'metrics',
      title: 'Metrics with Micrometer',
      blocks: [
        {
          t: 'code',
          lang: 'java',
          caption: 'The four instrument types',
          code: `
private final MeterRegistry registry;

// COUNTER — a number that only goes up. Rates and totals.
registry.counter("orders.placed", "channel", "web").increment();

// GAUGE — a value sampled right now. Queue depth, pool size, cache size.
registry.gauge("queue.depth", queue, Queue::size);

// TIMER — duration plus a count. The workhorse.
Timer.Sample sample = Timer.start(registry);
try {
    gateway.charge(order);
} finally {
    sample.stop(registry.timer("payment.duration", "gateway", "stripe"));
}

// Or declaratively:
@Timed(value = "orders.place", percentiles = {0.5, 0.95, 0.99})
public void place(Order order) { }

// DISTRIBUTION SUMMARY — for sizes rather than durations
registry.summary("order.items").record(order.items().size());`,
        },
        {
          t: 'trap',
          title: 'Cardinality is the way metrics kill your monitoring bill',
          text: 'Every unique combination of tag values creates a separate time series. `registry.counter("requests", "userId", userId)` with a million users creates a million series and will take down Prometheus. **Tags must be low-cardinality**: status code, endpoint *template*, region — never ids, emails or raw URLs.',
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'What Boot gives you for free',
          code: `
management:
  endpoints:
    web:
      exposure:
        include: health,info,metrics,prometheus
  metrics:
    tags:
      application: \${spring.application.name}    # tag everything consistently
  endpoint:
    health:
      probes:
        enabled: true
      show-details: when-authorized

# Out of the box you already get:
#   http.server.requests   — latency and count per endpoint, method and status
#   jvm.memory.used        — heap and non-heap by area
#   jvm.gc.pause           — collection pauses
#   hikaricp.connections   — pool usage, pending threads, timeouts
#   system.cpu.usage`,
        },
        {
          t: 'key',
          title: 'The four signals worth alerting on',
          text: 'Latency (p99, not the mean), traffic (requests per second), errors (5xx rate) and saturation (thread pool and connection pool usage). These are the "golden signals", and they catch most incidents. Alert on the user-visible symptom, not on individual causes.',
        },
      ],
    },
    {
      id: 'tracing',
      title: 'Distributed tracing',
      blocks: [
        { t: 'p', text: 'Once a request crosses services, no single log file tells the story. A trace stitches the whole journey together: one **trace id** shared across services, and a **span** per operation, each with a parent.' },
        {
          t: 'ascii',
          caption: 'One trace, several spans — the gap is immediately visible.',
          code: `
  trace 7f3a...
  ├── gateway            [====================================] 320ms
  │   └── orders-service [=============================]        290ms
  │       ├── db query   [==]                                    18ms
  │       └── payments   [========================]             250ms  ← the problem
  │           └── db     [=]                                      9ms
  └── total 320ms`,
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'Micrometer Tracing, and putting the ids in your logs',
          code: `
implementation 'io.micrometer:micrometer-tracing-bridge-otel'
implementation 'io.opentelemetry:opentelemetry-exporter-otlp'

management:
  tracing:
    sampling:
      probability: 0.1          # 10% in production; 1.0 in development

logging:
  pattern:
    level: "%5p [\${spring.application.name},%X{traceId:-},%X{spanId:-}]"
    # every log line now carries the trace id, so a slow trace leads
    # straight to the relevant logs`,
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'Adding your own span with business context',
          code: `
private final ObservationRegistry observations;

public Order place(OrderRequest request) {
    return Observation.createNotStarted("order.place", observations)
            .lowCardinalityKeyValue("channel", request.channel())   // safe as a tag
            .highCardinalityKeyValue("orderId", request.id())       // trace only
            .observe(() -> doPlace(request));
}`,
        },
        {
          t: 'tip',
          title: 'Low versus high cardinality keys',
          text: 'Micrometer distinguishes them deliberately: low-cardinality keys become metric tags, high-cardinality ones stay on the trace. That is exactly the right split — you want to *filter metrics* by channel and *find one specific trace* by order id.',
        },
      ],
    },
    {
      id: 'health',
      title: 'Health checks that mean something',
      blocks: [
        {
          t: 'code',
          lang: 'java',
          caption: 'Liveness and readiness are different questions',
          code: `
// LIVENESS  — "is this process broken beyond recovery?"
//             Failing it RESTARTS the pod. Keep it almost always true.
// READINESS — "should traffic be sent here right now?"
//             Failing it removes the pod from the load balancer. Temporary.

// /actuator/health/liveness   and   /actuator/health/readiness

@Component
public class PaymentGatewayHealth implements HealthIndicator {
    @Override
    public Health health() {
        try {
            gateway.ping();
            return Health.up().build();
        } catch (Exception e) {
            // DOWN here makes readiness fail, so traffic stops arriving.
            // Ask first: can this service do anything useful without payments?
            return Health.down(e).withDetail("gateway", "unreachable").build();
        }
    }
}`,
        },
        {
          t: 'trap',
          title: 'A dependency check in liveness causes cascading restarts',
          text: 'If the database is briefly unavailable and liveness includes a database check, Kubernetes restarts every pod — which makes recovery slower and can turn a blip into an outage. Liveness should only fail when the process itself is unrecoverable. Dependencies belong in readiness, and often not even there.',
        },
        {
          t: 'warn',
          title: 'Do not expose actuator wholesale',
          text: '`include: "*"` publishes `/env`, `/configprops`, `/beans`, `/threaddump` and `/heapdump`. A heap dump contains everything in memory, including credentials. Expose only what you need, and put the management port behind your internal network.',
        },
      ],
    },
  ],

  patterns: [
    {
      id: 'correlate-everything',
      name: 'One Id Through Everything',
      oneLiner: 'A request id in the MDC, in the response header, and in every log line.',
      useWhen: ['Any service, from day one.'],
      recognize: ['Debugging by grepping timestamps.', 'Cannot connect a customer complaint to a log entry.'],
      steps: [
        'Accept or generate a request id in a filter.',
        'Put it in the MDC and include it in the log pattern.',
        'Return it in a response header and pass it to downstream calls.',
        'Clear the MDC in a `finally`.',
      ],
      complexity: 'One filter; transforms every future investigation.',
      gotchas: [
        'Clear the MDC or it leaks between requests on pooled threads.',
        'Propagate it to async work with a `TaskDecorator`.',
        'If you have tracing, use the trace id rather than inventing a second one.',
      ],
      problems: ['Add a request id filter', 'Propagate it through an async call'],
    },
    {
      id: 'golden-signals',
      name: 'Alert on Symptoms, Not Causes',
      oneLiner: 'Page on latency, errors and saturation — the things users feel.',
      useWhen: ['Designing alerts.'],
      recognize: ['Alerts for "CPU above 80%" that fire constantly and mean nothing.', 'An incident found by a customer, not a monitor.'],
      steps: [
        'Define what "broken" means for a user: p99 latency and 5xx rate.',
        'Alert on those, with a duration so a brief spike does not page anyone.',
        'Keep cause-level metrics as dashboards for diagnosis, not as alerts.',
      ],
      template: {
        lang: 'java',
        caption: 'Symptom-based Prometheus alerts',
        code: `
# 5xx rate above 1% for five minutes
- alert: HighErrorRate
  expr: |
    sum(rate(http_server_requests_seconds_count{status=~"5.."}[5m]))
    / sum(rate(http_server_requests_seconds_count[5m])) > 0.01
  for: 5m

# p99 latency above one second
- alert: SlowRequests
  expr: histogram_quantile(0.99,
          sum(rate(http_server_requests_seconds_bucket[5m])) by (le)) > 1
  for: 10m

# Saturation: connection pool nearly exhausted
- alert: ConnectionPoolSaturated
  expr: hikaricp_connections_pending > 0
  for: 2m`,
      },
      complexity: 'Fewer alerts, each of which matters.',
      gotchas: [
        'Alerting on the mean hides the tail; use percentiles.',
        'Every alert that does not require action trains people to ignore alerts.',
      ],
      problems: ['Write an error-rate alert', 'Show why the mean hides a problem'],
    },
    {
      id: 'low-cardinality-tags',
      name: 'Keep Metric Tags Low-Cardinality',
      oneLiner: 'Tag by category, never by identity.',
      useWhen: ['Adding any custom metric.'],
      recognize: ['A user id, order id, email or raw URL used as a tag.', 'A monitoring bill that grows with traffic.'],
      steps: ['Ask how many distinct values this tag can take.', 'More than a few hundred means it belongs on a trace or a log, not a metric.', 'Use the URI *template*, not the resolved path.'],
      template: {
        lang: 'java',
        caption: 'The difference is one line and several orders of magnitude',
        code: `
// WRONG — one time series per order
registry.counter("orders.processed", "orderId", order.id()).increment();

// RIGHT — a handful of series, still useful
registry.counter("orders.processed",
                 "status", order.status().name(),
                 "channel", order.channel()).increment();

// Put the identity on the trace instead, where it belongs
Observation.createNotStarted("order.process", observations)
           .highCardinalityKeyValue("orderId", order.id());`,
      },
      complexity: 'Bounded storage; dashboards that still load.',
      gotchas: [
        'Spring already uses the URI template for `http.server.requests` — do not replace it with the raw path.',
        'Cardinality multiplies across tags: 10 statuses × 100 endpoints × 50 regions is 50,000 series.',
      ],
      problems: ['Explode cardinality on purpose', 'Convert an id tag to a trace attribute'],
    },
  ],

  pitfalls: [
    { title: 'String concatenation in log calls', text: 'The string is built even when the level is disabled. Use placeholders.' },
    { title: 'Not clearing the MDC', text: 'One request’s context leaks onto the next on a pooled thread.' },
    { title: 'Logging secrets or request bodies', text: 'Credentials and personal data end up permanently in a search index.' },
    { title: 'High-cardinality metric tags', text: 'One series per id. This is how you take down Prometheus.' },
    { title: 'Alerting on causes instead of symptoms', text: 'CPU alerts fire constantly and mean nothing to users.' },
    { title: 'Using the mean latency', text: 'It hides the tail that users actually experience.' },
    { title: 'Dependency checks in liveness', text: 'A brief database blip restarts every pod.' },
    { title: 'Exposing all actuator endpoints', text: '/heapdump alone is a full credential leak.' },
    { title: 'Tracing at 100% in production', text: 'Enormous volume and cost. Sample, and always keep the errors.' },
    { title: 'Logging and rethrowing', text: 'The same failure appears three times in the logs.' },
  ],

  cheatsheet: [
    { label: 'Something is wrong', value: 'metrics' },
    { label: 'Where', value: 'traces' },
    { label: 'Why', value: 'logs' },
    { label: 'Log args', value: 'placeholders, exception last' },
    { label: 'Per-request context', value: 'MDC, cleared in finally' },
    { label: 'Counter', value: 'monotonic count' },
    { label: 'Gauge', value: 'current value' },
    { label: 'Timer', value: 'duration + count' },
    { label: 'Metric tags', value: 'low cardinality only' },
    { label: 'Ids belong on', value: 'traces, not metrics' },
    { label: 'Alert on', value: 'latency, errors, saturation' },
    { label: 'Use', value: 'p99, not the mean' },
    { label: 'Liveness', value: 'process health only' },
    { label: 'Readiness', value: 'can I serve traffic now' },
    { label: 'Sampling', value: '~10% in production' },
  ],

  problems: [
    { name: 'Add a request id to every log line', difficulty: 'Easy', pattern: 'Correlation', insight: 'A filter that sets the MDC and a log pattern that prints it. Confirm two concurrent requests never share an id.' },
    { name: 'Leak the MDC between requests', difficulty: 'Easy', pattern: 'MDC hygiene', insight: 'Remove the finally clear, send two requests, and find the first request’s id on the second one’s log lines.' },
    { name: 'Expose Prometheus metrics', difficulty: 'Easy', pattern: 'Metrics', insight: 'Enable the endpoint and find `http_server_requests_seconds_bucket`. Compute p99 from it.' },
    { name: 'Explode metric cardinality', difficulty: 'Medium', pattern: 'Cardinality', insight: 'Tag a counter with a UUID per request, generate 10,000 requests, and count the series on /actuator/prometheus.' },
    { name: 'Show the mean hiding the tail', difficulty: 'Medium', pattern: 'Percentiles', insight: 'Ninety-nine fast requests and one very slow one. The mean looks fine; p99 does not.' },
    { name: 'Add a custom timer', difficulty: 'Medium', pattern: 'Metrics', insight: 'Time an external call with sensible tags, then chart the p95 alongside the endpoint latency.' },
    { name: 'Trace across two services', difficulty: 'Hard', pattern: 'Tracing', insight: 'Two Boot apps with tracing enabled. Confirm the trace id propagates and appears in both services’ logs.' },
    { name: 'Break liveness with a dependency check', difficulty: 'Hard', pattern: 'Health checks', insight: 'Put a database check in liveness, stop the database, and watch the pod restart loop. Move it to readiness and compare.' },
    { name: 'Find what /actuator/env leaks', difficulty: 'Medium', pattern: 'Security', insight: 'Expose it and look for a custom property whose name does not match the masking patterns.' },
    { name: 'Write a symptom-based alert', difficulty: 'Medium', pattern: 'Alerting', insight: 'A 5xx rate alert with a five-minute window. Verify a single failed request does not page anyone.' },
  ],
}
