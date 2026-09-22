export default {
  id: 'mq-spring',
  title: 'Spring for Apache Kafka in Practice',
  short: 'Spring Kafka',
  icon: 'CoffeeRounded',
  tier: 'Advanced',
  order: 15,
  estHours: 5,
  prereqs: ['kafka-consumer', 'mq-errors'],
  tagline: 'Everything from the last nine chapters, wired up the way you will actually write it.',
  mentalModel:
    'Spring Kafka is a thin, opinionated layer over the plain clients. `KafkaTemplate` wraps a producer; a **listener container** runs the poll loop and calls your `@KafkaListener`. Every configuration you have learned still applies — Spring just gives it better defaults and somewhere sensible to put it.',
  whyItMatters:
    'Most of the correctness work is configuration, and Spring’s defaults are not all the ones you want. Knowing which to change — acknowledgement mode, error handler, deserialization safety — is what turns a demo into something you can run.',

  reference: {
    title: 'The configuration that actually matters',
    head: ['Property', 'Default', 'Set it to', 'Why'],
    rows: [
      ['`consumer.enable-auto-commit`', 'true', '**false**', 'Auto-commit loses messages'],
      ['`listener.ack-mode`', 'BATCH', '**MANUAL**', 'Acknowledge after your work is durable'],
      ['`producer.acks`', '1 (Boot default)', '**all**', 'Durability'],
      ['`consumer.auto-offset-reset`', 'latest', 'Decide deliberately', '`earliest` replays everything'],
      ['`consumer.max-poll-records`', '500', 'Match your handler speed', 'Avoid poll-interval eviction'],
      ['`listener.concurrency`', '1', '≤ partition count', 'Parallelism'],
      ['Value deserializer', 'raw', '`ErrorHandlingDeserializer`', 'Makes bad payloads routable'],
    ],
  },

  sections: [
    {
      id: 'setup',
      title: 'A configuration you can ship',
      blocks: [
        {
          t: 'ascii',
          caption: 'Where Spring\u2019s pieces sit on top of the plain Kafka clients.',
          code: `
  YOUR CODE                    SPRING KAFKA                 PLAIN CLIENT
  ─────────────────            ──────────────────────       ──────────────

  kafkaTemplate.send() ──────▶ KafkaTemplate          ────▶ KafkaProducer
                               • serializers                • RecordAccumulator
                               • CompletableFuture          • sender thread


                               ┌──────────────────────────────────────────┐
                               │ MessageListenerContainer                 │
                               │  (one per concurrency, each own thread)  │
                               │                                          │
                               │   while (running) {                      │
                               │       records = consumer.poll()  ────────┼──▶ KafkaConsumer
                               │       for (record : records)             │
  @KafkaListener  ◀────────────┼───────── invoke your method              │
  public void handle(...)      │       errorHandler on throw ──┐          │
        │                      │       ack.acknowledge()       │          │
        │                      └───────────────────────────────┼──────────┘
        │                                                      │
        └─ ack ────────────────────▶ commit offset             ▼
                                                    DeadLetterPublishingRecoverer
                                                        │
                                                        ▼
                                                    <topic>.DLT

  Every setting from the earlier chapters still applies — Spring just
  chooses where you write it down, and supplies some defaults you must
  change.`,
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'application.yml, with every non-default explained',
          code: `
spring:
  kafka:
    bootstrap-servers: \${KAFKA_BROKERS}

    producer:
      acks: all                      # durability (with min.insync.replicas=2)
      properties:
        enable.idempotence: true     # no duplicates from producer retries
        linger.ms: 10                # batching — large throughput win
        compression.type: lz4
      key-serializer: org.apache.kafka.common.serialization.StringSerializer
      value-serializer: org.springframework.kafka.support.serializer.JsonSerializer

    consumer:
      group-id: payment-service      # PER SERVICE, never per instance
      enable-auto-commit: false      # we acknowledge explicitly
      auto-offset-reset: earliest    # a new group reads history
      max-poll-records: 50           # keeps each poll cycle short
      key-deserializer: org.apache.kafka.common.serialization.StringDeserializer
      # Wrap the real deserializer so a bad payload is a routable error
      # rather than an exception that kills the container
      value-deserializer: org.springframework.kafka.support.serializer.ErrorHandlingDeserializer
      properties:
        spring.deserializer.value.delegate.class: org.springframework.kafka.support.serializer.JsonDeserializer
        spring.json.trusted.packages: "com.acme.events"   # never "*"
        isolation.level: read_committed

    listener:
      ack-mode: MANUAL
      concurrency: 3                 # ≤ partition count
      observation-enabled: true      # traces and metrics via Micrometer`,
        },
        {
          t: 'trap',
          title: 'spring.json.trusted.packages must never be "*"',
          text: 'The JSON deserializer can be told to instantiate the class named in a message header. With `"*"`, anyone who can write to the topic can make your service construct arbitrary classes — a deserialization gadget attack. List your event packages explicitly.',
        },
      ],
    },
    {
      id: 'producing',
      title: 'Producing',
      blocks: [
        {
          t: 'code',
          lang: 'java',
          caption: 'KafkaTemplate, with the result actually handled',
          code: `
@Service
public class OrderEventPublisher {
    private final KafkaTemplate<String, Object> kafka;

    public void publish(Order order) {
        var record = new ProducerRecord<String, Object>(
                "orders",
                order.id().toString(),        // key → partition → ordering
                OrderPlaced.from(order));

        record.headers()
              .add("eventId", UUID.randomUUID().toString().getBytes(UTF_8))
              .add("eventType", "OrderPlaced".getBytes(UTF_8));

        kafka.send(record).whenComplete((result, ex) -> {
            if (ex != null) {
                log.error("Publish failed for order {}", order.id(), ex);
                failures.increment();          // and let the outbox retry
            }
        });
    }
}`,
        },
        {
          t: 'key',
          title: 'Publish from the outbox, not from the service method',
          text: 'Even with Spring, `kafka.send()` inside a `@Transactional` method is the dual-write problem. The publisher above should be called by the outbox relay, not by the business logic. Spring makes producing convenient; it does not make it atomic with your database.',
        },
      ],
    },
    {
      id: 'consuming',
      title: 'Consuming, with errors handled',
      blocks: [
        {
          t: 'code',
          lang: 'java',
          caption: 'A listener that is idempotent, acknowledges last, and routes failures',
          code: `
@Component
public class PaymentListener {

    @RetryableTopic(
            attempts = "4",
            backoff = @Backoff(delay = 5_000, multiplier = 6.0),
            exclude = { DeserializationException.class,
                        IllegalArgumentException.class })
    @KafkaListener(topics = "orders", groupId = "payment-service")
    @Transactional
    public void onOrderPlaced(
            @Payload OrderPlaced event,
            @Header(name = "eventId", required = false) String eventId,
            @Header(KafkaHeaders.RECEIVED_PARTITION) int partition,
            @Header(KafkaHeaders.OFFSET) long offset,
            Acknowledgment ack) {

        MDC.put("eventId", eventId);
        try {
            if (!processed.record(eventId)) {      // de-duplicate
                ack.acknowledge();
                return;
            }
            gateway.charge(event.orderId(), event.total(), "order-" + event.orderId());
            ack.acknowledge();                      // LAST
        } finally {
            MDC.clear();                            // pooled thread — mandatory
        }
    }

    @DltHandler
    public void onDeadLetter(OrderPlaced event,
            @Header(KafkaHeaders.EXCEPTION_MESSAGE) String reason) {
        log.error("Order {} dead-lettered: {}", event.orderId(), reason);
        alerting.notify("Payment failed permanently for " + event.orderId());
    }
}`,
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'Container-level error handling, when you are not using retry topics',
          code: `
@Bean
DefaultErrorHandler errorHandler(KafkaTemplate<String, Object> template) {
    var recoverer = new DeadLetterPublishingRecoverer(template,
            (record, ex) -> new TopicPartition(record.topic() + ".DLT", -1));

    var handler = new DefaultErrorHandler(recoverer,
            new ExponentialBackOffWithMaxRetries(3));

    handler.addNotRetryableExceptions(
            DeserializationException.class,
            MethodArgumentNotValidException.class);

    handler.setRetryListeners((record, ex, attempt) ->
            log.warn("Retry {} for {}-{}@{}", attempt,
                     record.topic(), record.partition(), record.offset(), ex));
    return handler;
}`,
        },
        {
          t: 'warn',
          title: 'Container retries block the partition; retry topics do not',
          text: '`DefaultErrorHandler` with a backoff retries **in place**, so the partition is stalled for the whole backoff. That is fine for three quick attempts and wrong for a three-minute ladder. Use in-place retries for short transient blips, and retry topics when the delays are long.',
        },
      ],
    },
    {
      id: 'operating',
      title: 'Operating a Spring Kafka service',
      blocks: [
        {
          t: 'code',
          lang: 'java',
          caption: 'Pause, resume and inspect listeners at runtime',
          code: `
@Service
public class ListenerAdmin {
    private final KafkaListenerEndpointRegistry registry;

    // Stop consuming without redeploying — useful during an incident
    public void pause(String listenerId) {
        registry.getListenerContainer(listenerId).pause();
    }
    public void resume(String listenerId) {
        registry.getListenerContainer(listenerId).resume();
    }

    // Which partitions is this instance actually assigned?
    public Collection<TopicPartition> assignment(String listenerId) {
        return registry.getListenerContainer(listenerId).getAssignedPartitions();
    }
}

@KafkaListener(id = "payment-listener", topics = "orders", groupId = "payment-service")
public void handle(OrderPlaced event, Acknowledgment ack) { }`,
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'Testing with an embedded broker, and with the real thing',
          code: `
// Fast, in-process — good for wiring and serialization tests
@SpringBootTest
@EmbeddedKafka(partitions = 3, topics = { "orders" })
class PaymentListenerTest {

    @Autowired KafkaTemplate<String, Object> template;
    @Autowired PaymentRepository payments;

    @Test
    void chargesOnce_evenWhenRedelivered() {
        var event = new OrderPlaced(4471L, "c-902", items, total);
        template.send("orders", "4471", event);
        template.send("orders", "4471", event);          // duplicate

        await().atMost(10, SECONDS).untilAsserted(() ->
                assertThat(payments.countByOrderId(4471L)).isEqualTo(1));
    }
}

// Slower, realistic — catches broker behaviour the embedded one does not
@Testcontainers
class PaymentIT {
    @Container
    static KafkaContainer kafka =
            new KafkaContainer(DockerImageName.parse("confluentinc/cp-kafka:7.6.0"));

    @DynamicPropertySource
    static void props(DynamicPropertyRegistry r) {
        r.add("spring.kafka.bootstrap-servers", kafka::getBootstrapServers);
    }
}`,
        },
        {
          t: 'tip',
          title: 'Use Awaitility, never sleep',
          text: 'Asynchronous tests that `Thread.sleep(2000)` are simultaneously slow and flaky. `await().atMost(...).untilAsserted(...)` polls and passes the instant the condition holds — usually in milliseconds.',
        },
      ],
    },
  ],

  patterns: [
    {
      id: 'safe-defaults',
      name: 'Override Spring’s Unsafe Defaults',
      oneLiner: 'Auto-commit off, manual acknowledgement, acks=all, error-handling deserializer.',
      useWhen: ['Every Spring Kafka service.'],
      recognize: ['A configuration block with only `bootstrap-servers` and `group-id`.'],
      steps: [
        'Disable auto-commit and set `ack-mode: MANUAL`.',
        'Set `acks: all` and enable producer idempotence.',
        'Wrap the value deserializer in `ErrorHandlingDeserializer`.',
        'Restrict `spring.json.trusted.packages`.',
      ],
      complexity: 'Configuration only.',
      gotchas: [
        'Manual acknowledgement without an idempotent handler just relocates the bug.',
        'A deserialization failure without the wrapper stops the container entirely, and the poison message is unroutable.',
      ],
      problems: ['Lose a message with auto-commit', 'Kill a container with a bad payload'],
    },
    {
      id: 'listener-with-dlt',
      name: 'Listener With Retry Topics and a DLT Handler',
      oneLiner: 'Transient failures retry off the main partition; permanent ones alert a human.',
      useWhen: ['Any consumer that can fail.'],
      recognize: ['A listener with no error handler.', 'Exceptions logged and swallowed.'],
      steps: ['`@RetryableTopic` with an exclude list.', '`@DltHandler` that alerts.', 'Alert on DLT depth as well.'],
      complexity: 'Two annotations; the main partition never blocks.',
      gotchas: [
        'Retry topics lose per-key ordering for the retried message.',
        'Without `exclude`, permanent failures waste the whole ladder.',
      ],
      problems: ['Add retry topics and a DLT handler', 'Verify a permanent failure skips the ladder'],
    },
    {
      id: 'observable-listener',
      name: 'Make the Listener Observable',
      oneLiner: 'Trace id in the MDC, lag in metrics, and a way to pause without deploying.',
      useWhen: ['Any consumer you will have to debug at 3am.'],
      recognize: ['Log lines with no correlation id.', 'No way to stop consuming during an incident.'],
      steps: [
        'Enable `listener.observation-enabled` for Micrometer tracing.',
        'Put the event id and trace id in the MDC, cleared in a `finally`.',
        'Give each listener an `id` so it can be paused via the registry.',
      ],
      complexity: 'Small; pays back on the first incident.',
      gotchas: [
        'The MDC must be cleared — listener threads are pooled and reused.',
        'Pausing stops consumption but the group still heartbeats, so no rebalance is triggered. That is usually what you want.',
      ],
      problems: ['Propagate a trace id through a listener', 'Pause a listener at runtime'],
    },
  ],

  pitfalls: [
    { title: 'Leaving auto-commit on', text: 'Spring’s default. It commits on a timer regardless of success.' },
    { title: 'Acknowledging in a finally block', text: 'It advances the offset even when the handler threw.' },
    { title: 'No ErrorHandlingDeserializer', text: 'A malformed payload kills the container and cannot be routed to a DLT.' },
    { title: 'spring.json.trusted.packages = "*"', text: 'Lets a message dictate which class to instantiate.' },
    { title: 'concurrency above the partition count', text: 'The extra containers consume nothing.' },
    { title: 'Group id per instance', text: 'Every pod processes every message.' },
    { title: 'kafka.send inside a transactional method', text: 'The dual-write problem. Use the outbox.' },
    { title: 'Long in-place retries', text: 'They block the partition for the whole backoff.' },
    { title: 'Thread.sleep in async tests', text: 'Slow and flaky. Use Awaitility.' },
  ],

  cheatsheet: [
    { label: 'Auto-commit', value: 'false' },
    { label: 'Ack mode', value: 'MANUAL' },
    { label: 'Acknowledge', value: 'after the work, never in finally' },
    { label: 'Producer', value: 'acks=all + idempotence' },
    { label: 'Deserializer', value: 'ErrorHandlingDeserializer wrapper' },
    { label: 'Trusted packages', value: 'explicit, never "*"' },
    { label: 'Concurrency', value: '≤ partition count' },
    { label: 'Group id', value: 'per service' },
    { label: 'Retry topics', value: '@RetryableTopic + exclude' },
    { label: 'Dead letters', value: '@DltHandler, and alert' },
    { label: 'In-place retry', value: 'blocks the partition' },
    { label: 'Runtime control', value: 'KafkaListenerEndpointRegistry' },
    { label: 'Fast tests', value: '@EmbeddedKafka' },
    { label: 'Real tests', value: 'Testcontainers KafkaContainer' },
    { label: 'Async assertions', value: 'Awaitility' },
  ],

  problems: [
    { name: 'Produce and consume end to end', difficulty: 'Easy', pattern: 'Setup', insight: 'KafkaTemplate plus @KafkaListener against Testcontainers. Assert with Awaitility rather than a sleep.' },
    { name: 'Lose a message with auto-commit', difficulty: 'Easy', pattern: 'Defaults', insight: 'Leave the default on, throw from the handler, restart, and confirm the message never returns.' },
    { name: 'Kill a container with a bad payload', difficulty: 'Medium', pattern: 'Deserialization', insight: 'Publish invalid JSON without ErrorHandlingDeserializer and watch the listener container stop. Add the wrapper and it routes instead.' },
    { name: 'Acknowledge in a finally block', difficulty: 'Medium', pattern: 'Ack placement', insight: 'Move ack.acknowledge() into a finally and confirm a failed message is never redelivered — a silent loss.' },
    { name: 'Set concurrency above the partition count', difficulty: 'Medium', pattern: 'Parallelism', insight: 'concurrency=6 on a 3-partition topic. Log the assignment and find three containers with nothing.' },
    { name: 'Add retry topics and a DLT', difficulty: 'Medium', pattern: 'Error handling', insight: 'Use @RetryableTopic, confirm the generated topics, and watch a permanent failure skip the ladder via exclude.' },
    { name: 'Compare in-place retries with retry topics', difficulty: 'Hard', pattern: 'Blocking', insight: 'DefaultErrorHandler with a 30-second backoff versus retry topics. Measure how long the partition stalls in each.' },
    { name: 'Propagate a trace id', difficulty: 'Medium', pattern: 'Observability', insight: 'Enable observation, produce with a trace, and confirm the consumer log lines carry the same trace id.' },
    { name: 'Pause a listener at runtime', difficulty: 'Medium', pattern: 'Operations', insight: 'Expose an endpoint that pauses and resumes via the registry. Verify no rebalance is triggered while paused.' },
    { name: 'Test idempotency under redelivery', difficulty: 'Hard', pattern: 'Testing', insight: 'Send the same event twice with @EmbeddedKafka and assert exactly one side effect.' },
  ],
}
