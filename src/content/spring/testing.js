export default {
  id: 'testing',
  title: 'Testing Spring Applications',
  short: 'Testing',
  icon: 'ScienceRounded',
  tier: 'Advanced',
  order: 18,
  estHours: 7,
  prereqs: ['spring-ioc', 'spring-data-jpa'],
  tagline: 'Most of your tests should not start Spring at all.',
  mentalModel:
    'Think of a pyramid. A wide base of plain unit tests that construct objects with `new` and run in milliseconds. A narrower band of **slice** tests that start just one layer. A handful of full integration tests with a real database. Inverting that pyramid gives you a suite that takes twenty minutes and still misses bugs.',
  whyItMatters:
    'Test speed determines whether people run the tests. A suite that takes ten minutes gets skipped, and a suite that gets skipped catches nothing. The Spring test annotations exist precisely to let you load less.',

  reference: {
    title: 'What each annotation loads',
    head: ['Annotation', 'Loads', 'Typical time', 'Use for'],
    rows: [
      ['*(none — plain JUnit)*', 'Nothing', '~1ms', 'Services, domain logic, mappers'],
      ['`@ExtendWith(MockitoExtension)`', 'Mockito only', '~5ms', 'A class with mocked collaborators'],
      ['`@WebMvcTest`', 'The web layer only', '~1s', 'Controllers, validation, JSON, security rules'],
      ['`@DataJpaTest`', 'JPA + an in-memory or test DB', '~2s', 'Repositories and queries'],
      ['`@JsonTest`', 'Jackson only', '~0.5s', 'Serialisation contracts'],
      ['`@SpringBootTest`', 'The whole application', '~5–30s', 'End-to-end paths, wiring'],
      ['`@Testcontainers`', 'A real database in Docker', '+3–10s', 'Anything database-specific'],
    ],
  },

  sections: [
    {
      id: 'unit',
      title: 'Unit tests: no Spring, no mocks where you can avoid them',
      blocks: [
        { t: 'p', text: 'Constructor injection means your services are plain objects. A unit test constructs one directly and runs instantly — this is the payoff for not using field injection.' },
        {
          t: 'code',
          lang: 'java',
          caption: 'A fast, readable service test',
          code: `
class PricingServiceTest {

    private final TaxRates rates = new FixedTaxRates(new BigDecimal("0.18"));
    private final PricingService service = new PricingService(rates,
            Clock.fixed(Instant.parse("2026-01-01T00:00:00Z"), ZoneOffset.UTC));

    @Test
    void appliesTaxToSubtotal() {
        Money total = service.total(List.of(item("100.00"), item("50.00")));

        assertThat(total).isEqualTo(Money.of("177.00"));
    }

    @Test
    void rejectsEmptyBasket() {
        assertThatThrownBy(() -> service.total(List.of()))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("at least one item");
    }
}`,
        },
        {
          t: 'key',
          title: 'Prefer a real simple implementation over a mock',
          text: '`new FixedTaxRates(...)` is clearer than `when(rates.forCountry(any())).thenReturn(...)`, does not break when you refactor a method signature, and actually exercises the interface. Reserve mocks for things that are slow, non-deterministic, or have side effects — network calls, email, clocks.',
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'Mockito, used where it earns its place',
          code: `
@ExtendWith(MockitoExtension.class)
class OrderServiceTest {

    @Mock  PaymentGateway gateway;          // external, slow, has side effects
    @Mock  OrderRepository repository;
    @InjectMocks OrderService service;

    @Test
    void doesNotSaveWhenPaymentFails() {
        when(gateway.charge(any())).thenThrow(new PaymentDeclinedException());

        assertThatThrownBy(() -> service.place(request))
                .isInstanceOf(PaymentDeclinedException.class);

        verify(repository, never()).save(any());     // assert the interaction
    }
}`,
        },
        {
          t: 'warn',
          title: 'Inject a Clock rather than calling Instant.now()',
          text: 'Time-dependent logic that reads the system clock is untestable — you cannot assert what happens at a month boundary or after a token expires. Inject `Clock` and use `Clock.fixed(...)` in tests. It costs one constructor parameter.',
        },
      ],
    },
    {
      id: 'slices',
      title: 'Slice tests: load one layer',
      blocks: [
        {
          t: 'code',
          lang: 'java',
          caption: '@WebMvcTest — the controller, validation, JSON and security rules',
          code: `
@WebMvcTest(OrderController.class)
class OrderControllerTest {

    @Autowired MockMvc mvc;
    @MockitoBean OrderService service;          // @MockBean before Spring Boot 3.4

    @Test
    void returns404WhenMissing() throws Exception {
        when(service.findById(99L)).thenThrow(new NoSuchElementException("nope"));

        mvc.perform(get("/api/v1/orders/99"))
           .andExpect(status().isNotFound())
           .andExpect(jsonPath("$.detail").value("nope"));
    }

    @Test
    void rejectsInvalidBody() throws Exception {
        mvc.perform(post("/api/v1/orders")
                .contentType(APPLICATION_JSON)
                .content("""
                    { "customerId": null, "items": [] }
                    """))
           .andExpect(status().isBadRequest())
           .andExpect(jsonPath("$.errors.customerId").exists());
    }

    @Test
    @WithMockUser(roles = "USER")
    void forbidsNonAdminDelete() throws Exception {
        mvc.perform(delete("/api/v1/orders/1").with(csrf()))
           .andExpect(status().isForbidden());
    }
}`,
        },
        {
          t: 'code',
          lang: 'java',
          caption: '@DataJpaTest — repositories, and catching N+1',
          code: `
@DataJpaTest
@AutoConfigureTestDatabase(replace = NONE)     // use the real DB, not H2
@Testcontainers
class OrderRepositoryTest {

    @Container
    static PostgreSQLContainer<?> db = new PostgreSQLContainer<>("postgres:16");

    @DynamicPropertySource
    static void props(DynamicPropertyRegistry r) {
        r.add("spring.datasource.url", db::getJdbcUrl);
        r.add("spring.datasource.username", db::getUsername);
        r.add("spring.datasource.password", db::getPassword);
    }

    @Autowired OrderRepository repository;
    @Autowired EntityManager em;

    @Test
    void joinFetchAvoidsNPlusOne() {
        var stats = em.getEntityManagerFactory()
                      .unwrap(SessionFactory.class).getStatistics();
        stats.clear();

        List<Order> orders = repository.findAllWithCustomer();
        orders.forEach(o -> o.getCustomer().getName());     // would trigger N+1

        assertThat(stats.getPrepareStatementCount()).isEqualTo(1);
    }
}`,
        },
        {
          t: 'key',
          title: 'Test against the database you actually run',
          text: 'H2 accepts SQL that Postgres rejects, has different locking, no `jsonb`, and different behaviour for upserts and sequences. Testcontainers starts a real Postgres in Docker in a few seconds and removes an entire class of "worked in tests, failed in production".',
        },
        {
          t: 'note',
          title: 'Slice tests are transactional and roll back',
          text: '`@DataJpaTest` wraps each test in a transaction and rolls it back afterwards, so tests do not interfere. That also means the changes are never actually committed — if you need to assert commit behaviour, you need `@SpringBootTest` without the rollback.',
        },
      ],
    },
    {
      id: 'integration',
      title: 'Integration tests: a few, and worth their cost',
      blocks: [
        {
          t: 'code',
          lang: 'java',
          caption: 'The full path, on a real port, against a real database',
          code: `
@SpringBootTest(webEnvironment = RANDOM_PORT)
@Testcontainers
@ActiveProfiles("test")
class OrderFlowIT {

    @Container
    static PostgreSQLContainer<?> db = new PostgreSQLContainer<>("postgres:16");

    @Autowired TestRestTemplate rest;
    @Autowired OrderRepository repository;

    @Test
    void placesAnOrderEndToEnd() {
        var request = new CreateOrderRequest(1L, List.of(new ItemRequest(7L, 2)), null);

        ResponseEntity<OrderDto> response =
                rest.postForEntity("/api/v1/orders", request, OrderDto.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(response.getHeaders().getLocation()).isNotNull();
        assertThat(repository.findById(response.getBody().id())).isPresent();
    }
}`,
        },
        {
          t: 'tip',
          title: 'Reuse the context, or your suite crawls',
          text: 'Spring caches an application context per unique configuration. Every distinct combination of `@MockitoBean`, `@ActiveProfiles` or `@TestPropertySource` creates a **new** context and another startup. Keep the configurations uniform — often by putting the container setup in one shared abstract base class — and the whole suite reuses a single context.',
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'A shared base class keeps the context count at one',
          code: `
@SpringBootTest(webEnvironment = RANDOM_PORT)
@Testcontainers
@ActiveProfiles("test")
public abstract class IntegrationTestBase {

    @Container
    static final PostgreSQLContainer<?> DB = new PostgreSQLContainer<>("postgres:16");

    static { DB.start(); }      // static: started once for the whole JVM

    @DynamicPropertySource
    static void props(DynamicPropertyRegistry r) {
        r.add("spring.datasource.url", DB::getJdbcUrl);
        r.add("spring.datasource.username", DB::getUsername);
        r.add("spring.datasource.password", DB::getPassword);
    }
}

class OrderFlowIT extends IntegrationTestBase { }
class PaymentFlowIT extends IntegrationTestBase { }   // same context, reused`,
        },
      ],
    },
    {
      id: 'quality',
      title: 'Writing tests worth keeping',
      blocks: [
        {
          t: 'compare',
          left: {
            title: 'A good test',
            items: [
              'Has a name that states the behaviour',
              'Asserts one outcome',
              'Fails for exactly one reason',
              'Reads as arrange, act, assert',
              'Does not depend on other tests or on ordering',
            ],
          },
          right: {
            title: 'A test that will be deleted',
            items: [
              'Named `test1` or `testOrderService`',
              'Twenty assertions covering four behaviours',
              'Verifies every mock interaction, so any refactor breaks it',
              'Depends on data another test created',
              'Uses `Thread.sleep` to wait for something',
            ],
          },
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'Test the behaviour, not the implementation',
          code: `
// BRITTLE — breaks whenever the internals change, without a real bug
@Test
void savesOrder() {
    service.place(request);
    verify(repository).save(any());
    verify(validator).validate(any());
    verify(auditLog).record(anyString());       // now coupled to every collaborator
}

// ROBUST — describes what the caller observes
@Test
void placedOrderIsRetrievableAndPending() {
    Order placed = service.place(request);

    assertThat(service.findById(placed.id()))
            .extracting(Order::status)
            .isEqualTo(OrderStatus.PENDING);
}`,
        },
        {
          t: 'warn',
          title: 'Never use Thread.sleep in a test',
          text: 'It is either too short (flaky) or too long (slow), usually both on different machines. Use Awaitility: `await().atMost(5, SECONDS).untilAsserted(() -> assertThat(...))`. It polls and passes the moment the condition holds.',
        },
        {
          t: 'note',
          title: 'Coverage is a signal, not a target',
          text: 'Eighty percent coverage with assertion-free tests is worse than forty percent with sharp ones, because it creates false confidence. Use coverage to *find untested branches*, then decide whether each one deserves a test.',
        },
      ],
    },
  ],

  patterns: [
    {
      id: 'test-pyramid',
      name: 'Load the Least You Can',
      oneLiner: 'Pick the narrowest test type that can actually catch the bug.',
      useWhen: ['Deciding how to test anything.'],
      recognize: ['`@SpringBootTest` on a class that tests one pure method.', 'A suite that takes minutes.'],
      steps: [
        'Pure logic → plain JUnit, no annotations.',
        'Controller concerns → `@WebMvcTest`.',
        'Queries → `@DataJpaTest` with Testcontainers.',
        'Wiring and the full path → a handful of `@SpringBootTest`.',
      ],
      complexity: 'Often turns a ten-minute suite into a one-minute one.',
      gotchas: [
        'Every distinct test configuration costs another context startup.',
        'Slice tests do not load your `@Service` beans — mock them.',
      ],
      problems: ['Convert a SpringBootTest to a slice test', 'Measure the suite time before and after'],
    },
    {
      id: 'testcontainers',
      name: 'Real Dependencies with Testcontainers',
      oneLiner: 'Run the actual database, broker or cache in Docker for the test.',
      useWhen: ['Any test touching SQL, migrations, or database-specific features.'],
      recognize: ['H2 in the test profile and Postgres in production.', 'Bugs that only appear after deployment.'],
      steps: ['Add a static container in a shared base class.', 'Wire it with `@DynamicPropertySource`.', 'Let Flyway run the real migrations against it.'],
      template: {
        lang: 'java',
        caption: 'Containers for more than just the database',
        code: `
@Container static final KafkaContainer KAFKA =
        new KafkaContainer(DockerImageName.parse("confluentinc/cp-kafka:7.6.0"));

@Container static final GenericContainer<?> REDIS =
        new GenericContainer<>("redis:7").withExposedPorts(6379);

@DynamicPropertySource
static void props(DynamicPropertyRegistry r) {
    r.add("spring.kafka.bootstrap-servers", KAFKA::getBootstrapServers);
    r.add("spring.data.redis.host", REDIS::getHost);
    r.add("spring.data.redis.port", () -> REDIS.getMappedPort(6379));
}`,
      },
      complexity: 'A few seconds of startup, reused across the whole suite.',
      gotchas: [
        'Make the container `static` or you start one per test class.',
        'CI needs a Docker daemon available.',
        'Pin image versions so tests are reproducible.',
      ],
      problems: ['Replace H2 with Testcontainers', 'Find SQL that H2 accepts and Postgres rejects'],
    },
    {
      id: 'assert-behaviour',
      name: 'Assert Outcomes, Not Interactions',
      oneLiner: 'Verify what the caller can observe, not which methods were called.',
      useWhen: ['Almost always. Interaction verification is for side effects you cannot otherwise see.'],
      recognize: ['Tests that break on every refactor despite no behaviour change.', 'More `verify` calls than assertions.'],
      steps: [
        'Ask what the caller would notice if this worked.',
        'Assert that.',
        'Use `verify` only for true side effects — an email sent, a message published.',
      ],
      complexity: 'Fewer, more durable tests.',
      gotchas: [
        '`verify(mock, never())` is legitimate — asserting something did **not** happen is often the point.',
        'Avoid `any()` everywhere; asserting the actual argument catches real bugs.',
      ],
      problems: ['Rewrite a verify-heavy test', 'Refactor code and confirm the tests survive'],
    },
  ],

  pitfalls: [
    { title: '@SpringBootTest for everything', text: 'Starts the whole application for a test that needed none of it.' },
    { title: 'H2 in tests, Postgres in production', text: 'Different SQL dialects, locking and types. Bugs appear only after deploy.' },
    { title: 'Thread.sleep to wait for async work', text: 'Flaky and slow. Use Awaitility.' },
    { title: 'Tests that depend on execution order', text: 'They pass locally and fail in CI where the order differs.' },
    { title: 'Over-mocking', text: 'You end up testing the mocks. Prefer real simple implementations.' },
    { title: 'Verifying every interaction', text: 'Couples the test to the implementation; every refactor becomes a rewrite.' },
    { title: 'Many different test configurations', text: 'Each unique one starts another Spring context.' },
    { title: 'Reading the system clock', text: 'Untestable. Inject a Clock.' },
    { title: 'Treating coverage as the goal', text: 'Assertion-free tests inflate the number and catch nothing.' },
  ],

  cheatsheet: [
    { label: 'Pure logic', value: 'plain JUnit, no Spring' },
    { label: 'Controller', value: '@WebMvcTest + MockMvc' },
    { label: 'Repository', value: '@DataJpaTest + Testcontainers' },
    { label: 'Full path', value: '@SpringBootTest(RANDOM_PORT)' },
    { label: 'Mock a bean', value: '@MockitoBean (was @MockBean)' },
    { label: 'Security in tests', value: '@WithMockUser' },
    { label: 'Real database', value: '@Testcontainers + @DynamicPropertySource' },
    { label: 'Container scope', value: 'static — one per JVM' },
    { label: 'Async waits', value: 'Awaitility, never sleep' },
    { label: 'Time', value: 'inject Clock.fixed' },
    { label: 'Context reuse', value: 'keep configurations identical' },
    { label: 'Assert', value: 'behaviour, not interactions' },
    { label: 'Count queries', value: 'Hibernate Statistics' },
  ],

  problems: [
    { name: 'Test a service with no Spring context', difficulty: 'Easy', pattern: 'Unit test', insight: 'Construct it with new and stub implementations. Time it — single-digit milliseconds.' },
    { name: 'Write a @WebMvcTest for validation', difficulty: 'Easy', pattern: 'Slice test', insight: 'Post an invalid body and assert both the 400 status and the specific field in the error map.' },
    { name: 'Replace @SpringBootTest with a slice', difficulty: 'Medium', pattern: 'Test pyramid', insight: 'Take a controller test that boots everything, convert it, and compare the runtimes.' },
    { name: 'Swap H2 for Testcontainers', difficulty: 'Medium', pattern: 'Realistic tests', insight: 'Point @DataJpaTest at real Postgres and let Flyway run. Note the first-run cost and that later runs reuse the container.' },
    { name: 'Find SQL H2 accepts but Postgres rejects', difficulty: 'Hard', pattern: 'Dialect differences', insight: 'Try a jsonb column, ON CONFLICT, or a case-sensitive identifier. H2 is forgiving in ways production is not.' },
    { name: 'Assert a query count', difficulty: 'Hard', pattern: 'N+1 prevention', insight: 'Use Hibernate Statistics to fail the test when a repository method issues more than one query. This catches N+1 permanently.' },
    { name: 'Test security rules', difficulty: 'Medium', pattern: 'Security testing', insight: '@WithMockUser with different roles. Assert 401 with no user and 403 with the wrong role.' },
    { name: 'Fix a flaky async test', difficulty: 'Medium', pattern: 'Async testing', insight: 'Replace Thread.sleep(2000) with Awaitility. The test gets faster and stops failing intermittently.' },
    { name: 'Count Spring contexts in your suite', difficulty: 'Hard', pattern: 'Test performance', insight: 'Enable DEBUG on org.springframework.test.context.cache and count the starts. Unify the configurations and watch it drop to one.' },
    { name: 'Make a test survive a refactor', difficulty: 'Medium', pattern: 'Behaviour testing', insight: 'Write a verify-heavy test, rename an internal method, and watch it break. Rewrite it to assert outcomes and repeat the refactor.' },
  ],
}
