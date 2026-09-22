export default {
  id: 'mq-testing',
  title: 'Testing Event-Driven Systems',
  short: 'Testing',
  icon: 'ScienceRounded',
  tier: 'Elite',
  order: 19,
  estHours: 4,
  prereqs: ['mq-spring', 'mq-errors'],
  tagline: 'The happy path is easy. Test the crash, the duplicate and the reorder.',
  mentalModel:
    'An event-driven test has a shape the request/response world does not: you publish, then **wait** for something to become true. Most flakiness comes from testing that wrongly. And most missing coverage comes from only testing the path where everything works.',
  whyItMatters:
    'The failures that matter in messaging — redelivery, out-of-order arrival, a consumer crashing mid-handler — never occur in a happy-path test. If you do not deliberately inject them, you will meet them in production instead.',

  reference: {
    title: 'What to test at each level',
    head: ['Level', 'Tool', 'Tests', 'Speed'],
    rows: [
      ['Handler logic', 'Plain JUnit', 'The method, called directly', '~1ms'],
      ['Serialization', '`@JsonTest` / Avro', 'Schema compatibility both ways', '~0.5s'],
      ['Listener wiring', '`@EmbeddedKafka`', 'Deserialization, ack, error routing', '~2s'],
      ['Real broker behaviour', 'Testcontainers', 'Rebalance, lag, transactions', '~10s'],
      ['Contract between teams', 'Pact / schema registry', 'Producer and consumer agree', 'CI'],
      ['Failure injection', 'Testcontainers + Toxiproxy', 'Broker down, network slow', 'Slow, rare'],
    ],
  },

  sections: [
    {
      id: 'levels',
      title: 'Test the handler without a broker',
      blocks: [
        { t: 'p', text: 'The most valuable and fastest tests involve no Kafka at all. A listener method is an ordinary method — call it.' },
        {
          t: 'code',
          lang: 'java',
          caption: 'No broker, no Spring, milliseconds',
          code: `
class PaymentListenerTest {

    private final FakeGateway gateway = new FakeGateway();
    private final InMemoryProcessedEvents processed = new InMemoryProcessedEvents();
    private final PaymentListener listener = new PaymentListener(gateway, processed);
    private final RecordingAck ack = new RecordingAck();

    @Test
    void chargesOnceForOneEvent() {
        listener.onOrderPlaced(orderPlaced("evt-1", 4471L, "2400.00"), ack);

        assertThat(gateway.charges()).hasSize(1);
        assertThat(ack.acknowledged()).isTrue();
    }

    @Test
    void ignoresARedeliveredEvent() {
        var event = orderPlaced("evt-1", 4471L, "2400.00");

        listener.onOrderPlaced(event, ack);
        listener.onOrderPlaced(event, ack);      // the SAME eventId

        assertThat(gateway.charges()).hasSize(1);   // idempotency proven
    }

    @Test
    void doesNotAcknowledgeWhenTheGatewayFails() {
        gateway.failNext(new TransientGatewayException());

        assertThatThrownBy(() -> listener.onOrderPlaced(orderPlaced("evt-2"), ack))
                .isInstanceOf(TransientGatewayException.class);

        assertThat(ack.acknowledged()).isFalse();   // so it will be redelivered
    }
}`,
        },
        {
          t: 'key',
          title: 'Assert on the acknowledgement, not just the side effect',
          text: '"Did the work happen?" and "did we acknowledge?" are two different questions, and getting the second wrong is what causes silent message loss. A test that acknowledges on failure passes the side-effect assertion and hides the bug.',
        },
      ],
    },
    {
      id: 'integration',
      title: 'Integration tests, and how to stop them flaking',
      blocks: [
        {
          t: 'code',
          lang: 'java',
          caption: 'Awaitility instead of sleep — the single biggest flakiness fix',
          code: `
@SpringBootTest
@Testcontainers
class OrderFlowIT {

    @Container
    static KafkaContainer kafka =
            new KafkaContainer(DockerImageName.parse("confluentinc/cp-kafka:7.6.0"));

    @DynamicPropertySource
    static void props(DynamicPropertyRegistry r) {
        r.add("spring.kafka.bootstrap-servers", kafka::getBootstrapServers);
    }

    @Autowired KafkaTemplate<String, Object> template;
    @Autowired PaymentRepository payments;

    @Test
    void chargesTheCardWhenAnOrderIsPlaced() {
        template.send("orders", "4471", new OrderPlaced(4471L, "c-902", total));

        // Polls until true, or fails at the deadline. Fast when it works,
        // and it tells you WHAT was still wrong when it does not.
        await().atMost(Duration.ofSeconds(10))
               .untilAsserted(() ->
                   assertThat(payments.findByOrderId(4471L))
                           .isPresent()
                           .get()
                           .extracting(Payment::status)
                           .isEqualTo(CAPTURED));
    }
}`,
        },
        {
          t: 'trap',
          title: 'Three causes of flaky messaging tests',
          text: '**(1)** `Thread.sleep` — too short on CI, too long everywhere. **(2)** Shared topics between tests, so one test consumes another’s messages. **(3)** Consumers still running from a previous test, because the container was not stopped. Use unique topic names per test, and let Spring manage the listener lifecycle.',
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'Isolate tests with unique topics and groups',
          code: `
@DynamicPropertySource
static void isolate(DynamicPropertyRegistry r) {
    String suffix = UUID.randomUUID().toString().substring(0, 8);
    r.add("app.topics.orders", () -> "orders-" + suffix);
    r.add("spring.kafka.consumer.group-id", () -> "test-" + suffix);
    r.add("spring.kafka.consumer.auto-offset-reset", () -> "earliest");
}
// auto-offset-reset=earliest matters: a brand-new group defaults to
// "latest", so a message published before the listener is assigned
// is never seen — and the test fails intermittently depending on
// startup timing.`,
        },
      ],
    },
    {
      id: 'failures',
      title: 'Testing the failures that actually happen',
      blocks: [
        {
          t: 'ascii',
          caption: 'The scenarios worth a test each.',
          code: `
  1. DUPLICATE          publish the same event twice
                        ──▶ exactly one side effect

  2. OUT OF ORDER       publish v2 then v1 for one key
                        ──▶ final state reflects v2, not v1

  3. CRASH MID-HANDLER  fail after the side effect, before the ack
                        ──▶ redelivered, and idempotency absorbs it

  4. POISON MESSAGE     publish malformed JSON
                        ──▶ goes to the DLT, partition keeps flowing

  5. BROKER DOWN        stop the container mid-test
                        ──▶ producer retries or the outbox holds it;
                            nothing is lost

  6. SLOW CONSUMER      handler exceeds max.poll.interval.ms
                        ──▶ rebalance observed; no double side effect

  7. SCHEMA CHANGE      old consumer reads a new message
                        ──▶ ignores the unknown field, keeps working`,
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'Two of them, written out',
          code: `
@Test
void poisonMessageGoesToTheDltAndDoesNotBlockThePartition() {
    template.send("orders", "bad", "{ not valid json");      // poison
    template.send("orders", "4471", validOrder());           // behind it

    // the good message must still be processed
    await().atMost(15, SECONDS).untilAsserted(() ->
            assertThat(payments.findByOrderId(4471L)).isPresent());

    // and the bad one must be in the DLT
    await().atMost(15, SECONDS).untilAsserted(() ->
            assertThat(consumeFrom("orders-dlt")).hasSize(1));
}

@Test
void survivesABrokerOutage() throws Exception {
    orderService.place(request);              // writes order + outbox row

    kafka.stop();                             // broker down
    Thread.sleep(2000);                       // the relay fails and retries
    kafka.start();

    await().atMost(60, SECONDS).untilAsserted(() ->
            assertThat(outboxRepository.countUnsent()).isZero());
    // nothing lost — the outbox held it until the broker returned
}`,
        },
        {
          t: 'key',
          title: 'A test for redelivery is the highest-value test you can write',
          text: 'Duplicates are guaranteed by the delivery model, so idempotency is load-bearing — and it is easy to break accidentally while refactoring. One test that publishes the same event twice and asserts a single side effect protects the property that everything else depends on.',
        },
      ],
    },
  ],

  patterns: [
    {
      id: 'await-not-sleep',
      name: 'Await, Never Sleep',
      oneLiner: 'Poll for the condition; fail at a deadline with a useful message.',
      useWhen: ['Every asynchronous assertion.'],
      recognize: ['`Thread.sleep` in a test.', 'Tests that pass locally and fail in CI.'],
      steps: ['Use `await().atMost(...).untilAsserted(...)`.', 'Assert the final state, not an intermediate step.', 'Set the timeout generously; it costs nothing when the test passes.'],
      complexity: 'Faster and more reliable than any sleep.',
      gotchas: [
        '`untilAsserted` reports the last assertion failure, which is far more useful than a bare timeout.',
        'Polling a stale cached object never converges — re-read from the repository inside the block.',
      ],
      problems: ['Replace a sleep with Awaitility', 'Measure the test time difference'],
    },
    {
      id: 'isolate-topics',
      name: 'Unique Topics and Groups per Test',
      oneLiner: 'Tests that share topics interfere with each other unpredictably.',
      useWhen: ['Any integration test suite with more than one Kafka test.'],
      recognize: ['Tests passing alone and failing together.', 'Order-dependent test results.'],
      steps: ['Generate a suffix per test class.', 'Inject it into topic names and the group id.', 'Set `auto-offset-reset=earliest`.'],
      complexity: 'A few lines; removes a whole category of flakiness.',
      gotchas: [
        'A new group defaults to `latest` and misses anything published before assignment completes.',
        'Reuse one Kafka container across the suite; only the topics need to be unique.',
      ],
      problems: ['Make two tests interfere', 'Isolate them and confirm they pass together'],
    },
    {
      id: 'test-the-failures',
      name: 'A Test per Failure Mode',
      oneLiner: 'Duplicate, reorder, crash, poison, outage — one test each.',
      useWhen: ['Any consumer whose correctness matters.'],
      recognize: ['A test suite where every test is a happy path.'],
      steps: [
        'Publish the same event twice → assert one side effect.',
        'Publish events for one key out of order → assert the final state is correct.',
        'Throw after the side effect → assert redelivery is absorbed.',
        'Publish a malformed payload → assert the DLT and that the partition still flows.',
      ],
      complexity: 'Four or five extra tests; they protect the properties everything else assumes.',
      gotchas: [
        'Test idempotency at the level that enforces it — the database constraint, not a mock.',
        'Reordering tests need a deterministic way to control arrival order; publishing to one partition and controlling the handler is easier than fighting the broker.',
      ],
      problems: ['Write the duplicate test', 'Write the poison-message test'],
    },
  ],

  pitfalls: [
    { title: 'Thread.sleep in async tests', text: 'Simultaneously slow and flaky.' },
    { title: 'Shared topics across tests', text: 'One test consumes another’s messages; failures depend on order.' },
    { title: 'auto-offset-reset left at latest', text: 'A new group misses messages published before assignment.' },
    { title: 'Only testing the happy path', text: 'Every failure mode that matters is untested.' },
    { title: 'Mocking the broker entirely', text: 'You test your mock’s behaviour, not Kafka’s.' },
    { title: 'Asserting on a stale in-memory object', text: 'Re-read from the store inside the await block.' },
    { title: 'A Kafka container per test class', text: 'Startup dominates the suite. Share one and isolate by topic.' },
    { title: 'Testing idempotency against a mock', text: 'The real enforcement is a unique constraint; test that.' },
  ],

  cheatsheet: [
    { label: 'Fastest tests', value: 'call the handler directly' },
    { label: 'Assert', value: 'side effect AND acknowledgement' },
    { label: 'Async assertions', value: 'Awaitility, never sleep' },
    { label: 'Best failure report', value: 'untilAsserted' },
    { label: 'Isolation', value: 'unique topic + group per test' },
    { label: 'New group', value: 'set auto-offset-reset=earliest' },
    { label: 'Container', value: 'one per suite, static' },
    { label: 'Must test', value: 'duplicate delivery' },
    { label: 'Must test', value: 'out-of-order arrival' },
    { label: 'Must test', value: 'poison message → DLT' },
    { label: 'Must test', value: 'broker outage → nothing lost' },
    { label: 'Idempotency', value: 'test the real constraint' },
    { label: 'Fast wiring tests', value: '@EmbeddedKafka' },
    { label: 'Real behaviour', value: 'Testcontainers' },
  ],

  problems: [
    { name: 'Test a handler with no broker', difficulty: 'Easy', pattern: 'Unit test', insight: 'Call the listener method directly with a stub gateway. Assert both the charge and the acknowledgement.' },
    { name: 'Catch an acknowledgement bug', difficulty: 'Easy', pattern: 'Ack assertions', insight: 'Acknowledge in a finally block and confirm your side-effect assertion still passes — proving why you must assert the ack too.' },
    { name: 'Replace a sleep with Awaitility', difficulty: 'Easy', pattern: 'Async testing', insight: 'Take a test with sleep(3000) and convert it. Compare the runtime and the failure message quality.' },
    { name: 'Make two tests interfere', difficulty: 'Medium', pattern: 'Isolation', insight: 'Share a topic and group between two tests. Run them together and watch one consume the other’s messages.' },
    { name: 'Miss a message with auto-offset-reset', difficulty: 'Medium', pattern: 'Isolation', insight: 'Publish before the listener is assigned with the default latest. The test fails intermittently; earliest fixes it.' },
    { name: 'Test duplicate delivery', difficulty: 'Medium', pattern: 'Idempotency', insight: 'Publish the same eventId twice and assert exactly one row, enforced by the unique constraint.' },
    { name: 'Test out-of-order arrival', difficulty: 'Hard', pattern: 'Ordering', insight: 'Deliver a v2 event before v1 for one key and assert the final state reflects v2. Then remove the version guard and watch it regress.' },
    { name: 'Test a poison message', difficulty: 'Hard', pattern: 'Error handling', insight: 'Publish malformed JSON followed by a valid message. Assert the DLT received one record and the valid one was still processed.' },
    { name: 'Test a broker outage', difficulty: 'Hard', pattern: 'Durability', insight: 'Stop the Kafka container mid-test, keep writing, restart it, and assert the outbox fully drains with nothing lost.' },
    { name: 'Test schema tolerance', difficulty: 'Hard', pattern: 'Evolution', insight: 'Publish a payload with an extra field and a new enum value. The old consumer must keep working rather than throwing.' },
  ],
}
