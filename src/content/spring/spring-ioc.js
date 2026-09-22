export default {
  id: 'spring-ioc',
  title: 'The Spring Container: Beans, Injection & Proxies',
  short: 'Spring IoC',
  icon: 'AutoAwesomeRounded',
  tier: 'Core',
  order: 12,
  estHours: 8,
  prereqs: ['objects-equality'],
  tagline: 'Spring builds your objects and wires them together. Knowing how removes every surprise.',
  mentalModel:
    'Spring is a factory that reads your class declarations, decides what to build, in what order, and hands each object its dependencies. You never call `new` for anything it manages. Almost all "why did Spring do that?" questions are answered by two facts: **it builds a graph**, and **it often hands you a proxy rather than your object**.',
  whyItMatters:
    'Inversion of control is the reason Spring exists. Once you understand beans, scopes and proxies, transactions, caching, security and `@Async` all stop being magic — because they are all the same proxying mechanism with different behaviour attached.',

  reference: {
    title: 'Bean scopes',
    head: ['Scope', 'One instance per', 'Use for'],
    rows: [
      ['`singleton` (default)', 'The whole application', 'Almost everything — services, repositories, clients'],
      ['`prototype`', 'Every injection or lookup', 'Stateful helpers you want fresh each time'],
      ['`request`', 'HTTP request', 'Per-request context objects'],
      ['`session`', 'HTTP session', 'User-scoped state (use sparingly)'],
      ['`application`', 'ServletContext', 'Rare'],
    ],
  },

  sections: [
    {
      id: 'ioc',
      title: 'What inversion of control actually changes',
      blocks: [
        {
          t: 'code',
          lang: 'java',
          caption: 'Who decides what your object depends on',
          code: `
// WITHOUT IoC — the class picks its own collaborators. Untestable, rigid.
public class OrderService {
    private final OrderRepository repo = new JdbcOrderRepository(
            new HikariDataSource(hardcodedConfig()));     // baked in forever
}

// WITH IoC — the class declares what it needs; something else supplies it.
@Service
public class OrderService {
    private final OrderRepository repo;

    public OrderService(OrderRepository repo) {           // Spring passes it in
        this.repo = repo;
    }
}
// In a test you pass a stub. In production Spring passes the real one.
// The class does not know or care which.`,
        },
        {
          t: 'key',
          title: 'The benefit is a seam',
          text: 'Constructor injection creates a seam where you can substitute an implementation — for tests, for a different environment, for a decorated version. That is the whole point. Dependency injection is not about configuration files; it is about not hard-coding your collaborators.',
        },
      ],
    },
    {
      id: 'defining',
      title: 'Defining beans: @Component versus @Bean',
      blocks: [
        {
          t: 'code',
          lang: 'java',
          caption: 'Two mechanisms, two different jobs',
          code: `
// 1. @Component (and its specialisations) — for YOUR classes.
//    Found by component scanning of your package tree.
@Service      // business logic
@Repository   // data access — also translates exceptions to DataAccessException
@Controller   // web layer
@Component    // anything else
public class OrderService { }

// 2. @Bean inside @Configuration — for classes you do NOT own,
//    or when construction needs logic.
@Configuration
public class ClientConfig {

    @Bean
    public RestClient paymentClient(PaymentProperties props) {   // args are injected
        return RestClient.builder()
                .baseUrl(props.baseUrl())
                .requestFactory(timeouts(props.timeout()))
                .build();
    }
}`,
        },
        {
          t: 'note',
          title: 'Why @Configuration classes are proxied',
          text: 'Inside a `@Configuration` class, calling another `@Bean` method does **not** run it again — Spring proxies the class so the second call returns the existing singleton. With `@Configuration(proxyBeanMethods = false)` (which Spring Boot uses internally) that interception is disabled and each call really does construct a new object. Know which you are using.',
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'Choosing between several candidates',
          code: `
public interface PaymentGateway { }

@Component("stripe")  class StripeGateway implements PaymentGateway { }
@Component("razorpay") @Primary
class RazorpayGateway implements PaymentGateway { }

// @Primary wins when nothing else is specified
@Service
public class Checkout {
    Checkout(PaymentGateway gateway) { }             // gets Razorpay
}

// @Qualifier picks explicitly
@Service
public class Refunds {
    Refunds(@Qualifier("stripe") PaymentGateway gateway) { }
}

// Inject ALL of them
@Service
public class GatewayHealthCheck {
    GatewayHealthCheck(List<PaymentGateway> all,            // every implementation
                       Map<String, PaymentGateway> byName) { }   // keyed by bean name
}`,
        },
        {
          t: 'tip',
          title: 'Injecting a List is an underrated pattern',
          text: 'Declaring `List<Validator>` gives you every implementation in the context. Adding a new validator becomes a matter of adding a class — no registration, no switch statement. Order them with `@Order` or by implementing `Ordered`.',
        },
      ],
    },
    {
      id: 'injection',
      title: 'Constructor injection, and why the alternatives are worse',
      blocks: [
        {
          t: 'compare',
          left: {
            title: 'Constructor injection — use this',
            items: [
              'Dependencies can be `final` — genuinely immutable',
              'The object is never in a half-built state',
              'Circular dependencies fail loudly at startup',
              'Trivial to instantiate in a plain unit test',
              'A constructor with eight arguments *looks* wrong, which is useful feedback',
            ],
          },
          right: {
            title: 'Field injection — avoid',
            items: [
              'Cannot be `final`',
              'Needs reflection or a Spring context to test',
              'Hides how many dependencies the class really has',
              'Lets circular dependencies survive to runtime',
            ],
          },
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'No annotation needed for a single constructor',
          code: `
@Service
public class OrderService {
    private final OrderRepository repo;
    private final PaymentGateway gateway;

    // Since Spring 4.3, @Autowired is optional when there is exactly one constructor
    public OrderService(OrderRepository repo, PaymentGateway gateway) {
        this.repo = repo;
        this.gateway = gateway;
    }
}

// With Lombok, if your team uses it:
@Service
@RequiredArgsConstructor           // generates the constructor for final fields
public class OrderService {
    private final OrderRepository repo;
    private final PaymentGateway gateway;
}`,
        },
        {
          t: 'trap',
          title: 'Circular dependencies are a design smell, not a puzzle to solve',
          text: 'A needs B and B needs A. Spring Boot 2.6+ rejects this at startup by default. The temptation is `@Lazy` or `spring.main.allow-circular-references=true`; the correct fix is to extract the shared behaviour into a third bean, or publish an event instead of calling back.',
        },
      ],
    },
    {
      id: 'lifecycle',
      title: 'Bean lifecycle and scopes',
      blocks: [
        {
          t: 'ascii',
          caption: 'The lifecycle, and where you can hook in.',
          code: `
  scan / read configuration
        │
        ▼
  instantiate  ──▶  inject dependencies  ──▶  @PostConstruct
        │                                          │
        │                                          ▼
        │                                  BeanPostProcessors
        │                                  (this is where PROXIES are created)
        ▼                                          │
     ready for use  ◀────────────────────────────┘
        │
        ▼
  context shutdown  ──▶  @PreDestroy`,
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'Init and destroy hooks',
          code: `
@Component
public class ConnectionManager {

    @PostConstruct                 // after injection, before the bean is used
    void init() {
        pool = createPool();       // do NOT do this in the constructor —
    }                              // dependencies may not be ready there

    @PreDestroy                    // on graceful shutdown
    void close() {
        pool.shutdown();
    }
}`,
        },
        {
          t: 'warn',
          title: 'The scope mismatch that silently breaks things',
          text: 'Injecting a **prototype** bean into a **singleton** gives you one instance, created once, for the singleton’s entire life — the prototype scope is effectively ignored. If you genuinely need a fresh instance per call, inject an `ObjectProvider<T>` and call `getObject()`, or use a scoped proxy.',
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'Getting a fresh prototype from a singleton',
          code: `
@Service
public class ReportService {
    private final ObjectProvider<ReportBuilder> builders;   // prototype-scoped

    public ReportService(ObjectProvider<ReportBuilder> builders) {
        this.builders = builders;
    }

    public Report build(Data data) {
        return builders.getObject().with(data).build();     // new one each call
    }
}`,
        },
        {
          t: 'key',
          title: 'Singleton beans must be stateless',
          text: 'One instance serves every concurrent request. A mutable field on a `@Service` is shared across all of them — a race condition by construction. Keep dependencies in `final` fields and everything else in local variables.',
        },
      ],
    },
    {
      id: 'proxies',
      title: 'Proxies: the mechanism behind every Spring annotation',
      blocks: [
        { t: 'p', text: 'When you annotate a method with `@Transactional`, `@Cacheable`, `@Async` or `@PreAuthorize`, Spring does not modify your class. It wraps it in a **proxy** — a generated subclass or interface implementation that runs extra logic before and after delegating to your object.' },
        {
          t: 'ascii',
          caption: 'The caller never touches your object directly.',
          code: `
  caller ──▶ [ Proxy ] ──▶ [ Your OrderService ]
                 │
                 ├── open transaction
                 ├── check cache
                 ├── delegate  ─────────────▶ your actual method
                 └── commit / populate cache

  Calling one of your own methods from inside your object goes
  straight to the object — the proxy is BYPASSED entirely.`,
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'The self-invocation bug, which every Spring developer hits once',
          code: `
@Service
public class OrderService {

    @Transactional
    public void placeOrder(Order o) {
        validate(o);
        save(o);                     // ✔ transaction is active
    }

    public void placeAll(List<Order> orders) {
        for (Order o : orders) {
            placeOrder(o);           // ✘ NO transaction — internal call,
        }                            //   so the proxy is never involved
    }
}

// Fixes, in order of preference:
// 1. Move placeOrder into a separate bean and inject it.
// 2. Inject a self-reference:  @Lazy OrderService self;  then self.placeOrder(o);
// 3. TransactionTemplate — explicit, no proxy needed at all.`,
        },
        {
          t: 'table',
          head: ['Proxy type', 'Used when', 'Limitation'],
          rows: [
            ['**JDK dynamic proxy**', 'The bean implements an interface', 'Only interface methods are proxied'],
            ['**CGLIB subclass**', 'No interface (Spring Boot default)', '`final` classes and `final` methods cannot be proxied'],
          ],
        },
        {
          t: 'trap',
          title: 'final and private break proxying silently',
          text: 'A `final` method cannot be overridden, so CGLIB cannot intercept it — your `@Transactional` simply does nothing, with no error. The same applies to `private` methods and to calls made from a constructor. If an annotation "is not working", this is the first thing to check.',
        },
      ],
    },
  ],

  patterns: [
    {
      id: 'constructor-injection',
      name: 'Constructor Injection with final Fields',
      oneLiner: 'Declare what you need in the constructor and make it immutable.',
      useWhen: ['Every Spring bean, every time.'],
      recognize: ['`@Autowired` on fields.', 'Setters that exist only for wiring.'],
      steps: ['Make each dependency a `private final` field.', 'Take them all in one constructor.', 'Drop `@Autowired` — a single constructor needs no annotation.'],
      template: {
        lang: 'java',
        caption: 'The default shape for every service you write',
        code: `
@Service
public class InvoiceService {
    private final InvoiceRepository repo;
    private final TaxCalculator tax;
    private final Clock clock;                 // inject the clock — testable time

    public InvoiceService(InvoiceRepository repo, TaxCalculator tax, Clock clock) {
        this.repo = repo;
        this.tax = tax;
        this.clock = clock;
    }
}

// The unit test needs no Spring at all:
var service = new InvoiceService(stubRepo, stubTax, Clock.fixed(instant, UTC));`,
      },
      complexity: 'No runtime cost; large testability gain.',
      gotchas: [
        'More than about five dependencies means the class does too much — listen to that signal.',
        'Inject `Clock` rather than calling `Instant.now()`, or time-dependent logic is untestable.',
      ],
      problems: ['Convert field injection to constructor injection', 'Test a service without a Spring context'],
    },
    {
      id: 'strategy-by-injection',
      name: 'Strategy via Injected Collection',
      oneLiner: 'Inject every implementation and pick at runtime — no switch statement.',
      useWhen: ['Multiple handlers, validators, payment providers, importers.'],
      recognize: ['A growing `switch` or `if/else` chain over a type enum.'],
      steps: [
        'Define the interface with a `supports(...)` method.',
        'Inject `List<Interface>` — Spring supplies every implementation.',
        'Select the first that supports the input.',
      ],
      template: {
        lang: 'java',
        caption: 'Adding a provider becomes adding a class',
        code: `
public interface PaymentHandler {
    boolean supports(PaymentType type);
    Receipt handle(Payment payment);
}

@Service
public class PaymentRouter {
    private final List<PaymentHandler> handlers;      // all of them, injected

    public PaymentRouter(List<PaymentHandler> handlers) { this.handlers = handlers; }

    public Receipt route(Payment p) {
        return handlers.stream()
                .filter(h -> h.supports(p.type()))
                .findFirst()
                .orElseThrow(() -> new UnsupportedPaymentException(p.type()))
                .handle(p);
    }
}`,
      },
      complexity: 'O(handlers) per call — index into a map if that ever matters.',
      gotchas: [
        'Control ordering with `@Order`; do not rely on classpath order.',
        'An empty list is silently valid — assert in `@PostConstruct` if at least one is required.',
      ],
      problems: ['Replace a switch with injected strategies', 'Order handlers with @Order'],
    },
    {
      id: 'avoid-self-invocation',
      name: 'Never Rely on a Proxy for an Internal Call',
      oneLiner: 'An annotation only applies when the call comes from outside the object.',
      useWhen: ['`@Transactional`, `@Cacheable`, `@Async`, `@PreAuthorize` — all of them.'],
      recognize: ['An annotated method that "does nothing" when called from the same class.'],
      steps: [
        'Move the annotated method to a separate bean and inject it.',
        'Or use the programmatic equivalent (`TransactionTemplate`, `CacheManager`).',
        'Check the method is `public` and the class and method are not `final`.',
      ],
      complexity: 'Structural — usually results in cleaner separation anyway.',
      gotchas: [
        'Self-injection with `@Lazy` works but hides the problem; prefer extracting a collaborator.',
        'Private and final methods are never proxied, and you get no warning.',
      ],
      problems: ['Reproduce the self-invocation bug', 'Fix it by extracting a bean'],
    },
  ],

  pitfalls: [
    { title: 'Field injection', text: 'Not final, hard to test, hides dependency count, and lets circular references survive to runtime.' },
    { title: 'Mutable state on a singleton bean', text: 'Shared across every concurrent request. The most common Spring concurrency bug.' },
    { title: 'Self-invocation of an annotated method', text: 'The proxy is bypassed, silently.' },
    { title: 'final classes or methods with @Transactional', text: 'CGLIB cannot proxy them, so the annotation does nothing.' },
    { title: 'Injecting a prototype into a singleton', text: 'You get exactly one instance. Use ObjectProvider.' },
    { title: 'Heavy work in a constructor', text: 'Runs before other beans may be ready and slows startup. Use @PostConstruct.' },
    { title: 'Enabling allow-circular-references', text: 'Silences a design problem rather than fixing it.' },
    { title: 'Component-scanning too broadly', text: 'Scanning a wide base package pulls in unexpected beans and slows startup.' },
  ],

  cheatsheet: [
    { label: 'Your classes', value: '@Component / @Service / @Repository' },
    { label: 'Third-party classes', value: '@Bean in @Configuration' },
    { label: 'Injection style', value: 'constructor, final fields' },
    { label: '@Autowired needed?', value: 'no, for a single constructor' },
    { label: 'Several candidates', value: '@Primary or @Qualifier' },
    { label: 'All implementations', value: 'inject List<T> or Map<String,T>' },
    { label: 'Default scope', value: 'singleton — must be stateless' },
    { label: 'Fresh prototype', value: 'ObjectProvider.getObject()' },
    { label: 'After injection', value: '@PostConstruct' },
    { label: 'On shutdown', value: '@PreDestroy' },
    { label: 'Annotations work via', value: 'proxies' },
    { label: 'Internal call', value: 'bypasses the proxy' },
    { label: 'Not proxyable', value: 'final, private, static' },
    { label: 'Circular deps', value: 'redesign, do not allow them' },
  ],

  problems: [
    { name: 'Convert field injection to constructor injection', difficulty: 'Easy', pattern: 'Injection', insight: 'Take a class with three @Autowired fields, convert it, make the fields final, then write a unit test with no Spring context.' },
    { name: 'Inject every implementation of an interface', difficulty: 'Easy', pattern: 'Strategy', insight: 'Declare List<Validator> and print the size. Add another @Component and watch it grow without registering anything.' },
    { name: 'Break a singleton with a mutable field', difficulty: 'Medium', pattern: 'Statelessness', insight: 'Add an int counter to a @Service, hit the endpoint with 100 concurrent requests, and compare the count to the request total.' },
    { name: 'Reproduce the self-invocation bug', difficulty: 'Medium', pattern: 'Proxies', insight: 'Call an @Transactional method from another method in the same class and confirm no transaction is active with TransactionSynchronizationManager.' },
    { name: 'Make @Transactional silently do nothing', difficulty: 'Medium', pattern: 'Proxy limits', insight: 'Mark the method final. No error, no transaction. Remove final and it works.' },
    { name: 'Prove prototype-into-singleton gives one instance', difficulty: 'Medium', pattern: 'Scopes', insight: 'Inject a @Scope("prototype") bean into a singleton and print its identity hash across calls. It never changes. Fix with ObjectProvider.' },
    { name: 'Create a circular dependency', difficulty: 'Medium', pattern: 'Design', insight: 'Two services depending on each other. Read the startup failure, then fix it by extracting the shared logic into a third bean.' },
    { name: 'Observe @Configuration proxying', difficulty: 'Hard', pattern: 'Configuration', insight: 'Call one @Bean method from another and print identity hashes. With proxyBeanMethods=true you get the same instance; with false you get two.' },
    { name: 'Replace a switch with injected strategies', difficulty: 'Medium', pattern: 'Strategy', insight: 'Refactor a five-branch switch into handler beans with supports(). Adding a sixth type should require no edits to the router.' },
    { name: 'Inspect the proxy class', difficulty: 'Hard', pattern: 'Proxies', insight: 'Print getClass().getName() on an @Transactional bean. You see $$SpringCGLIB$$. Add an interface and it becomes a JDK proxy instead.' },
  ],
}
