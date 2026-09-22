export default {
  id: 'spring-data-jpa',
  title: 'Spring Data JPA & Hibernate',
  short: 'JPA & Hibernate',
  icon: 'StorageRounded',
  tier: 'Advanced',
  order: 15,
  estHours: 9,
  prereqs: ['spring-ioc', 'collections'],
  tagline: 'The ORM writes your SQL. If you do not know what it wrote, it will write a thousand queries.',
  mentalModel:
    'Hibernate keeps a **persistence context** — a map of every entity it has loaded in the current transaction. It tracks changes automatically, writes them at flush time, and returns the same object for the same id. Almost every JPA surprise comes from not knowing that this cache exists and when it flushes.',
  whyItMatters:
    'JPA makes the easy 80% trivial and the remaining 20% mysterious. The N+1 query problem alone is responsible for more slow endpoints than any other single cause in Spring applications, and it is invisible until you look at the SQL.',

  reference: {
    title: 'Entity states',
    head: ['State', 'Meaning', 'Changes tracked?'],
    rows: [
      ['**Transient**', 'A new object, never persisted, no id', 'No'],
      ['**Managed**', 'In the persistence context, inside a transaction', '**Yes** — dirty checking writes them automatically'],
      ['**Detached**', 'Was managed; the transaction ended', 'No — lazy loading now throws'],
      ['**Removed**', 'Marked for deletion, not yet flushed', 'Yes'],
    ],
  },

  sections: [
    {
      id: 'persistence-context',
      title: 'The persistence context, and dirty checking',
      blocks: [
        {
          t: 'code',
          lang: 'java',
          caption: 'The save() you did not need to write',
          code: `
@Transactional
public void renameUser(Long id, String newName) {
    User user = repository.findById(id).orElseThrow();   // now MANAGED
    user.setName(newName);                               // just a setter
    // no save() call — Hibernate compares the object with its loaded snapshot
    // at flush time and issues the UPDATE itself. This is dirty checking.
}`,
        },
        {
          t: 'key',
          title: 'Inside a transaction, loaded entities are live objects',
          text: 'Changing a managed entity changes the database. That is convenient and occasionally alarming — an accidental setter inside a transaction becomes an UPDATE. It also means the same id loaded twice returns the *same object instance*, because the context is an identity map.',
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'When flush happens',
          code: `
// Hibernate flushes (writes pending changes) at:
//   1. transaction commit
//   2. before a query that might be affected by the pending changes
//   3. an explicit entityManager.flush()

@Transactional
public void example() {
    User u = repo.findById(1L).orElseThrow();
    u.setName("changed");                    // no SQL yet

    repo.findByName("changed");              // Hibernate flushes FIRST so the
                                             // query sees the pending change
}                                            // commit — flush if not already done`,
        },
        {
          t: 'warn',
          title: 'save() on an existing entity may issue a SELECT first',
          text: '`JpaRepository.save()` calls `merge()` when the entity has an id, and merge loads the current row to compare. In a loop over existing entities you get one extra SELECT per item. Inside a transaction you usually do not need `save()` at all — dirty checking handles it.',
        },
      ],
    },
    {
      id: 'n-plus-one',
      title: 'The N+1 problem',
      blocks: [
        { t: 'lead', text: 'This is the single most important thing in the chapter. If you learn nothing else, learn to recognise and fix this.' },
        {
          t: 'code',
          lang: 'java',
          caption: 'One query becomes 101',
          code: `
@Entity
public class Order {
    @ManyToOne(fetch = FetchType.LAZY)
    private Customer customer;
}

@Transactional(readOnly = true)
public List<OrderDto> listOrders() {
    List<Order> orders = repository.findAll();       // 1 query: SELECT * FROM orders

    return orders.stream()
            .map(o -> new OrderDto(o.getId(),
                                   o.getCustomer().getName()))   // ← N queries!
            .toList();
}
// Each getCustomer() triggers SELECT * FROM customers WHERE id = ?
// 100 orders = 101 queries. Locally with 5 rows you never notice.`,
        },
        {
          t: 'ascii',
          caption: 'What the database sees.',
          code: `
  WITHOUT a join fetch          WITH a join fetch
  ───────────────────────       ──────────────────────────────
  SELECT * FROM orders          SELECT o.*, c.*
  SELECT * FROM customers        FROM orders o
         WHERE id = 1            JOIN customers c ON c.id = o.customer_id
  SELECT * FROM customers
         WHERE id = 2            ── one query, every time ──
  … 98 more …`,
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'Three fixes, in order of preference',
          code: `
// 1. JOIN FETCH in the query — precise and explicit
@Query("SELECT o FROM Order o JOIN FETCH o.customer")
List<Order> findAllWithCustomer();

// 2. An entity graph — declarative, works with derived query methods
@EntityGraph(attributePaths = {"customer", "items"})
List<Order> findByStatus(OrderStatus status);

// 3. A projection — fetch ONLY the columns you need, no entities at all
public interface OrderSummary {
    Long getId();
    String getCustomerName();      // maps to o.customer.name
}
List<OrderSummary> findByStatus(OrderStatus status);`,
        },
        {
          t: 'trap',
          title: 'Never use FetchType.EAGER to fix it',
          text: 'Eager fetching applies to *every* query touching that entity, whether you need the association or not — so you trade N+1 in one place for unnecessary joins everywhere. **Make every association LAZY** and fetch explicitly where you need it. `@ManyToOne` and `@OneToOne` default to EAGER; override them.',
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'Make N+1 impossible to miss',
          code: `
# Development only — see and count the SQL
spring:
  jpa:
    show-sql: true
    properties:
      hibernate:
        format_sql: true
        generate_statistics: true      # logs the query count per session

# Even better: fail the build. datasource-proxy or a test that asserts
# the query count catches an N+1 before it reaches production.`,
        },
      ],
    },
    {
      id: 'mapping',
      title: 'Mapping entities sensibly',
      blocks: [
        {
          t: 'code',
          lang: 'java',
          caption: 'A well-behaved entity',
          code: `
@Entity
@Table(name = "orders", indexes = @Index(name = "ix_orders_customer",
                                         columnList = "customer_id"))
public class Order {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)   // ALWAYS lazy
    @JoinColumn(name = "customer_id")
    private Customer customer;

    @OneToMany(mappedBy = "order",
               cascade = CascadeType.ALL,
               orphanRemoval = true)                       // removing = deleting
    private List<OrderItem> items = new ArrayList<>();

    @Enumerated(EnumType.STRING)                           // never ORDINAL
    private OrderStatus status;

    @Version
    private long version;                                  // optimistic locking

    @CreationTimestamp
    private Instant createdAt;

    protected Order() { }                                  // JPA needs a no-arg ctor

    // Keep both sides of the relationship consistent
    public void addItem(OrderItem item) {
        items.add(item);
        item.setOrder(this);
    }
}`,
        },
        {
          t: 'trap',
          title: 'EnumType.ORDINAL will corrupt your data',
          text: 'The default stores the enum’s *position*. Insert a new constant in the middle and every existing row now means something different. Always `@Enumerated(EnumType.STRING)`.',
        },
        {
          t: 'warn',
          title: 'equals and hashCode on entities',
          text: 'Do not use the generated id — it is null before persist, so an entity added to a `HashSet` becomes unfindable after saving. Use a business key, or accept identity equality. Never include lazy associations, or equals triggers a query.',
        },
        {
          t: 'note',
          title: 'Let Flyway or Liquibase own the schema',
          text: '`spring.jpa.hibernate.ddl-auto` should be `validate` in production and `none` everywhere else. `update` silently makes changes it cannot reverse, and `create-drop` will one day be pointed at the wrong database.',
        },
      ],
    },
    {
      id: 'queries',
      title: 'Queries: derived, JPQL and native',
      blocks: [
        {
          t: 'code',
          lang: 'java',
          caption: 'Four ways to ask, from most to least magical',
          code: `
public interface OrderRepository extends JpaRepository<Order, Long> {

    // 1. Derived from the method name — great until the name gets silly
    List<Order> findByStatusAndCreatedAtAfter(OrderStatus status, Instant since);
    Optional<Order> findFirstByCustomerIdOrderByCreatedAtDesc(Long customerId);
    boolean existsByReference(String reference);
    long countByStatus(OrderStatus status);

    // 2. JPQL — operates on entities, portable across databases
    @Query("SELECT o FROM Order o WHERE o.total > :min AND o.status = :status")
    List<Order> findLargeOrders(@Param("min") BigDecimal min,
                                @Param("status") OrderStatus status);

    // 3. Projection — only the columns you need
    @Query("SELECT new com.acme.OrderSummary(o.id, o.total) FROM Order o")
    List<OrderSummary> findSummaries();

    // 4. Native SQL — for database-specific features
    @Query(value = "SELECT * FROM orders WHERE data @> :json", nativeQuery = true)
    List<Order> findByJsonb(@Param("json") String json);

    // Bulk update — bypasses the persistence context, so clear it
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE Order o SET o.status = :status WHERE o.createdAt < :before")
    int expireOldOrders(@Param("status") OrderStatus status,
                        @Param("before") Instant before);
}`,
        },
        {
          t: 'key',
          title: 'Bulk updates do not go through the persistence context',
          text: 'A `@Modifying` query changes rows directly. Entities already loaded in the context keep their stale values, and dirty checking may then overwrite your bulk change on commit. `clearAutomatically = true` evicts them; `flushAutomatically = true` writes pending changes first.',
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'Pagination, and the count query you forgot about',
          code: `
Page<Order> page = repository.findByStatus(status, PageRequest.of(0, 20,
        Sort.by("createdAt").descending()));

page.getTotalElements();     // triggers a SECOND query: SELECT count(*)
page.getContent();

// If you do not need the total, use Slice — it fetches size+1 rows to know
// whether there is a next page, and runs no count query at all.
Slice<Order> slice = repository.findByStatusOrderByIdAsc(status, pageable);

// Never combine JOIN FETCH on a collection with Pageable: Hibernate cannot
// paginate in SQL, so it loads EVERYTHING and paginates in memory —
// with a warning you will not see. Use @EntityGraph or a two-query approach.`,
        },
      ],
    },
    {
      id: 'pitfalls-prod',
      title: 'The settings and habits that keep it fast',
      blocks: [
        {
          t: 'code',
          lang: 'java',
          caption: 'Configuration worth copying',
          code: `
spring:
  jpa:
    open-in-view: false             # default is TRUE — turn it off
    hibernate:
      ddl-auto: validate
    properties:
      hibernate:
        jdbc:
          batch_size: 50            # batch inserts and updates
        order_inserts: true
        order_updates: true
        default_batch_fetch_size: 20   # turns an N+1 into ceil(N/20) queries
  datasource:
    hikari:
      maximum-pool-size: 20
      connection-timeout: 3000`,
        },
        {
          t: 'key',
          title: 'Turn off open-in-view',
          text: 'With it enabled (the default), the persistence context stays open for the whole HTTP request, including view rendering. That holds a database connection far longer than needed and lets lazy loading happen during JSON serialisation — the N+1 you cannot see in any service method. Turning it off surfaces those bugs immediately, which is exactly what you want.',
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'Optimistic locking: handling concurrent edits',
          code: `
@Version
private long version;

// Hibernate adds "AND version = ?" to the UPDATE and increments it.
// If another transaction got there first, 0 rows match and it throws
// OptimisticLockingFailureException.

@ExceptionHandler(OptimisticLockingFailureException.class)
public ProblemDetail onConflict(OptimisticLockingFailureException e) {
    return ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT,
            "This record was modified by someone else. Please reload and retry.");
}`,
        },
        {
          t: 'tip',
          title: 'Read-only transactions are worth it',
          text: '`@Transactional(readOnly = true)` lets Hibernate skip dirty checking entirely — no snapshots, no flush — and lets the driver route to a read replica. For query-only service methods it is a free improvement.',
        },
      ],
    },
  ],

  patterns: [
    {
      id: 'fetch-explicitly',
      name: 'Lazy Everywhere, Fetch Explicitly',
      oneLiner: 'Default to lazy, then join-fetch exactly what each use case needs.',
      useWhen: ['Every entity association.'],
      recognize: ['`FetchType.EAGER`.', 'A query count that grows with the result size.'],
      steps: [
        'Set `fetch = FetchType.LAZY` on every `@ManyToOne` and `@OneToOne`.',
        'Add `JOIN FETCH` or `@EntityGraph` per query that needs the association.',
        'Assert the query count in a test.',
      ],
      template: {
        lang: 'java',
        caption: 'Different queries, different fetch plans',
        code: `
// The list view needs the customer but not the items
@EntityGraph(attributePaths = "customer")
List<Order> findByStatus(OrderStatus status);

// The detail view needs both
@Query("SELECT o FROM Order o JOIN FETCH o.customer LEFT JOIN FETCH o.items WHERE o.id = :id")
Optional<Order> findDetailById(@Param("id") Long id);`,
      },
      complexity: 'One query per use case instead of N+1.',
      gotchas: [
        'Fetching two collections in one query multiplies rows (a cartesian product) — fetch one, or use `default_batch_fetch_size`.',
        '`JOIN FETCH` plus `Pageable` paginates in memory. Avoid it.',
      ],
      problems: ['Count queries before and after a join fetch', 'Trigger a cartesian product'],
    },
    {
      id: 'projections',
      name: 'Project Instead of Loading Entities',
      oneLiner: 'For read-only screens, select the columns you need and skip the ORM entirely.',
      useWhen: ['List views, reports, dropdowns, exports.'],
      recognize: ['Loading full entities to use two fields.', 'Slow list endpoints on wide tables.'],
      steps: ['Define an interface or record with just the fields.', 'Return it from the repository method.', 'No persistence context, no dirty checking, no lazy loading.'],
      template: {
        lang: 'java',
        caption: 'Interface and DTO projections',
        code: `
// Interface projection — Spring Data generates the implementation
public interface OrderRow {
    Long getId();
    String getStatus();
    String getCustomerName();          // resolves o.customer.name
}
List<OrderRow> findByStatus(OrderStatus status);

// Constructor projection — explicit, and works for records
@Query("SELECT new com.acme.OrderRow(o.id, o.status, c.name) " +
       "FROM Order o JOIN o.customer c WHERE o.status = :s")
List<OrderRow> rows(@Param("s") OrderStatus status);`,
      },
      complexity: 'Far less memory and no entity tracking.',
      gotchas: [
        'Projections are read-only — you cannot modify and expect a save.',
        'Nested interface projections can quietly reintroduce extra queries; verify the SQL.',
      ],
      problems: ['Replace an entity list with a projection', 'Compare memory and query time'],
    },
    {
      id: 'batch-writes',
      name: 'Batch Inserts and Updates',
      oneLiner: 'One round trip per 50 rows instead of one per row.',
      useWhen: ['Bulk imports, migrations, anything writing thousands of rows.'],
      recognize: ['A loop calling `save()` and taking minutes.'],
      steps: [
        'Set `hibernate.jdbc.batch_size` and the ordering properties.',
        'Use `saveAll` in chunks.',
        'Flush and clear periodically so the context does not grow unbounded.',
      ],
      template: {
        lang: 'java',
        caption: 'Chunked writes that do not exhaust memory',
        code: `
@Transactional
public void importAll(List<Order> orders) {
    for (int i = 0; i < orders.size(); i++) {
        entityManager.persist(orders.get(i));
        if (i % 50 == 0) {
            entityManager.flush();      // send the batch
            entityManager.clear();      // detach — otherwise the context grows
        }
    }
}`,
      },
      complexity: 'Typically 10–50× faster for bulk writes.',
      gotchas: [
        '`GenerationType.IDENTITY` **disables batching** — Hibernate must fetch each generated id. Use `SEQUENCE` with an allocation size if you need batching.',
        'Without `clear()` the persistence context holds every entity and you run out of heap.',
      ],
      problems: ['Batch a 10k-row import', 'Show IDENTITY defeating batching'],
    },
  ],

  pitfalls: [
    { title: 'FetchType.EAGER', text: 'Fetches the association on every query whether you need it or not. Always lazy.' },
    { title: 'Leaving open-in-view on', text: 'Holds a connection for the whole request and hides lazy loading in serialisation.' },
    { title: 'EnumType.ORDINAL', text: 'Stores positions. Reordering the enum silently corrupts existing rows.' },
    { title: 'ddl-auto=update in production', text: 'Makes unreviewable schema changes. Use a migration tool and validate.' },
    { title: 'JOIN FETCH with Pageable', text: 'Loads the whole result set and paginates in memory.' },
    { title: 'save() inside a transaction on a managed entity', text: 'Unnecessary, and may issue an extra SELECT via merge.' },
    { title: 'equals/hashCode based on a generated id', text: 'The id is null before persist, so the entity is lost from hash collections.' },
    { title: 'Bulk @Modifying without clearing', text: 'Stale entities in the context can overwrite the bulk change.' },
    { title: 'Bidirectional relationships updated on one side only', text: 'The in-memory object graph and the database disagree.' },
  ],

  cheatsheet: [
    { label: 'Managed entity changes', value: 'written automatically (dirty checking)' },
    { label: 'N+1 cause', value: 'lazy association in a loop' },
    { label: 'N+1 fix', value: 'JOIN FETCH / @EntityGraph / projection' },
    { label: 'Never', value: 'FetchType.EAGER' },
    { label: 'Enums', value: 'EnumType.STRING' },
    { label: 'Schema', value: 'Flyway + ddl-auto: validate' },
    { label: 'open-in-view', value: 'set it to false' },
    { label: 'Read-only method', value: '@Transactional(readOnly = true)' },
    { label: 'Concurrent edits', value: '@Version → 409' },
    { label: 'Page vs Slice', value: 'Page runs an extra count query' },
    { label: 'Batching needs', value: 'SEQUENCE, not IDENTITY' },
    { label: 'Bulk update', value: '@Modifying(clearAutomatically = true)' },
    { label: 'See the SQL', value: 'show-sql + generate_statistics' },
    { label: 'Soften N+1 globally', value: 'default_batch_fetch_size' },
  ],

  problems: [
    { name: 'Watch dirty checking write for you', difficulty: 'Easy', pattern: 'Persistence context', insight: 'Load an entity in a transactional method, call a setter, never call save. Enable show-sql and find the UPDATE.' },
    { name: 'Create an N+1 and count the queries', difficulty: 'Easy', pattern: 'N+1', insight: 'Load 100 orders and touch order.getCustomer() in a loop with generate_statistics on. Read the query count in the log.' },
    { name: 'Fix it with JOIN FETCH', difficulty: 'Medium', pattern: 'Fetching', insight: 'Rewrite the query and confirm the count drops from 101 to 1.' },
    { name: 'Fix it with @EntityGraph', difficulty: 'Medium', pattern: 'Fetching', insight: 'Same result without writing JPQL. Compare the generated SQL of both approaches.' },
    { name: 'Break data with EnumType.ORDINAL', difficulty: 'Medium', pattern: 'Mapping', insight: 'Save rows, insert a new constant at the start of the enum, reload, and watch every row mean something else.' },
    { name: 'Trigger LazyInitializationException', difficulty: 'Medium', pattern: 'Entity states', insight: 'Return an entity with a lazy collection from a service, access it in the controller with open-in-view=false, and read the error.' },
    { name: 'Make a cartesian product', difficulty: 'Hard', pattern: 'Fetching', insight: 'JOIN FETCH two collections at once. Count the rows the database returns versus the entities you get back.' },
    { name: 'Paginate with JOIN FETCH', difficulty: 'Hard', pattern: 'Pagination', insight: 'Combine them and find the HHH000104 warning about applying pagination in memory. Then fix it with @EntityGraph.' },
    { name: 'Batch a 10,000-row import', difficulty: 'Hard', pattern: 'Batching', insight: 'Time it with IDENTITY ids, then with SEQUENCE plus batch_size=50 and periodic flush/clear. Expect a large improvement.' },
    { name: 'Handle an optimistic lock conflict', difficulty: 'Hard', pattern: 'Concurrency', insight: 'Load the same entity in two transactions, update both, and map the resulting exception to a 409 with a useful message.' },
  ],
}
