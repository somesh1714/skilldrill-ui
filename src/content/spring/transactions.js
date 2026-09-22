export default {
  id: 'transactions',
  title: 'Transactions',
  short: 'Transactions',
  icon: 'ReceiptLongRounded',
  tier: 'Advanced',
  order: 16,
  estHours: 6,
  prereqs: ['spring-data-jpa', 'spring-ioc'],
  tagline: 'One annotation, a dozen ways to get it silently wrong.',
  mentalModel:
    '`@Transactional` does not change your method. It wraps your bean in a proxy that opens a transaction before the call and commits or rolls back after it. Every surprising behaviour — self-calls doing nothing, checked exceptions not rolling back, `readOnly` being ignored — follows from that one fact.',
  whyItMatters:
    'A transaction bug does not throw. It leaves half-written data, and you find out days later when the numbers do not add up. Transactions are also where the proxy mechanics from the IoC chapter become load-bearing.',

  reference: {
    title: 'Propagation, in the order you will need it',
    head: ['Propagation', 'If a transaction exists', 'If none exists'],
    rows: [
      ['`REQUIRED` (default)', 'Join it', 'Start a new one'],
      ['`REQUIRES_NEW`', '**Suspend** it, start a new independent one', 'Start a new one'],
      ['`SUPPORTS`', 'Join it', 'Run without one'],
      ['`NOT_SUPPORTED`', 'Suspend it, run without', 'Run without one'],
      ['`MANDATORY`', 'Join it', '**Throw** — the caller must provide one'],
      ['`NEVER`', '**Throw**', 'Run without one'],
      ['`NESTED`', 'Create a savepoint', 'Start a new one'],
    ],
  },

  sections: [
    {
      id: 'basics',
      title: 'What the proxy does',
      blocks: [
        {
          t: 'code',
          lang: 'java',
          caption: 'The generated wrapper, roughly',
          code: `
// You write:
@Transactional
public void transfer(Long from, Long to, BigDecimal amount) {
    accounts.debit(from, amount);
    accounts.credit(to, amount);
}

// The proxy effectively does:
public void transfer(Long from, Long to, BigDecimal amount) {
    TransactionStatus tx = txManager.getTransaction(definition);
    try {
        target.transfer(from, to, amount);     // your actual method
        txManager.commit(tx);
    } catch (RuntimeException | Error e) {
        txManager.rollback(tx);                // note: only unchecked, by default
        throw e;
    }
}`,
        },
        {
          t: 'key',
          title: 'Put @Transactional on the service, not the repository',
          text: 'A transaction should span one complete business operation. Spring Data repository methods are already transactional individually, so annotating them achieves nothing useful — and if your service calls three repositories, you want one transaction around all three, not three separate ones.',
        },
      ],
    },
    {
      id: 'traps',
      title: 'The four ways it silently does nothing',
      blocks: [
        {
          t: 'code',
          lang: 'java',
          caption: 'Trap 1 — self-invocation',
          code: `
@Service
public class OrderService {

    @Transactional
    public void save(Order o) { repo.save(o); }

    public void saveAll(List<Order> orders) {
        for (Order o : orders) {
            save(o);          // ✘ internal call — the proxy is bypassed,
        }                     //   so there is NO transaction at all
    }
}
// Fix: move save() to another bean, or inject a self-reference, or use
// TransactionTemplate.`,
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'Trap 2 — checked exceptions do not roll back',
          code: `
@Transactional
public void process() throws IOException {
    repo.save(entity);
    throw new IOException("boom");     // COMMITS — checked exceptions do not
}                                      // trigger rollback by default

// Fix: declare it
@Transactional(rollbackFor = Exception.class)
public void process() throws IOException { }`,
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'Trap 3 — catching the exception yourself',
          code: `
@Transactional
public void process() {
    try {
        repo.save(entity);
        riskyOperation();
    } catch (Exception e) {
        log.error("failed", e);        // swallowed — so the proxy sees no exception
    }                                  // and COMMITS the partial work
}

// Fix: rethrow, or mark the transaction explicitly
catch (Exception e) {
    TransactionAspectSupport.currentTransactionStatus().setRollbackOnly();
}`,
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'Trap 4 — private, final or non-public methods',
          code: `
@Transactional
private void save(Order o) { }         // ✘ CGLIB cannot proxy private

@Transactional
public final void save(Order o) { }    // ✘ cannot override a final method

// Both compile, produce no warning, and have no transaction.`,
        },
        {
          t: 'trap',
          title: 'None of these fail loudly',
          text: 'All four compile and run. You discover them when data is half-written. Spring Boot can warn about some cases if you enable `spring.aop.proxy-target-class` diagnostics, but the reliable defence is an integration test that asserts the rollback actually happens.',
        },
      ],
    },
    {
      id: 'propagation',
      title: 'Propagation, and the one case you really need',
      blocks: [
        { t: 'p', text: 'The default, `REQUIRED`, is right nearly always: nested service calls join one transaction, and the whole operation succeeds or fails together. The exception is work that must survive a rollback — typically audit logging.' },
        {
          t: 'code',
          lang: 'java',
          caption: 'REQUIRES_NEW so the audit record survives the failure',
          code: `
@Service
public class OrderService {
    @Transactional
    public void place(Order order) {
        audit.record("placing order " + order.id());   // separate transaction
        repo.save(order);
        charge(order);                                  // throws -> rollback
    }
}

@Service
public class AuditService {
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void record(String message) {
        auditRepo.save(new AuditEntry(message));       // commits independently
    }
}`,
        },
        {
          t: 'warn',
          title: 'REQUIRES_NEW uses a second connection',
          text: 'The outer transaction is suspended but keeps its connection while the inner one takes another. If your pool has 10 connections and 10 threads each do this, every thread holds one and waits for another — a classic pool deadlock. Use it sparingly and make sure the pool is bigger than your nesting depth × concurrency.',
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'Isolation levels — usually leave them alone',
          code: `
@Transactional(isolation = Isolation.READ_COMMITTED)    // most databases' default

// READ_UNCOMMITTED — dirty reads. Effectively never used.
// READ_COMMITTED   — no dirty reads. The sane default.
// REPEATABLE_READ  — same row reads the same twice (MySQL InnoDB default).
// SERIALIZABLE     — full isolation, heavy locking, real deadlock risk.

// In practice: prefer optimistic locking (@Version) over raising the
// isolation level. It scales better and the failure is explicit.`,
        },
      ],
    },
    {
      id: 'boundaries',
      title: 'Keeping transactions short and honest',
      blocks: [
        {
          t: 'code',
          lang: 'java',
          caption: 'Never do IO inside a transaction',
          code: `
// BAD — a database connection is held for the whole HTTP call.
// If the gateway hangs for 30 seconds, so does the connection.
@Transactional
public void placeOrder(Order o) {
    repo.save(o);
    paymentGateway.charge(o);      // ← external call inside the transaction
    emailClient.sendConfirmation(o);
}

// BETTER — commit first, then do the IO
public void placeOrder(Order o) {
    Order saved = orderService.saveOrder(o);   // @Transactional, short
    paymentGateway.charge(saved);              // outside
    events.publish(new OrderPlaced(saved.id()));
}`,
        },
        {
          t: 'key',
          title: 'A transaction holds a connection for its whole duration',
          text: 'Connections are your scarcest resource — a pool of 20 means at most 20 concurrent transactions. Every millisecond of network call inside a transaction is a millisecond another request cannot get a connection. Long transactions are the most common cause of "the service hangs under load".',
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'Run side effects only after a successful commit',
          code: `
@Service
public class OrderService {
    @Transactional
    public void place(Order order) {
        repo.save(order);
        events.publishEvent(new OrderPlacedEvent(order.id()));   // deferred
    }
}

@Component
public class OrderNotifier {
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onPlaced(OrderPlacedEvent e) {
        emailClient.sendConfirmation(e.orderId());   // only if the commit succeeded
    }
}`,
        },
        {
          t: 'tip',
          title: 'TransactionTemplate when the boundary is not a whole method',
          text: 'If only part of a method needs a transaction — or you need one inside a loop, or you are fighting self-invocation — `TransactionTemplate` gives you an explicit, proxy-free boundary: `txTemplate.execute(status -> { ... })`.',
        },
      ],
    },
  ],

  patterns: [
    {
      id: 'short-transactions',
      name: 'Short Transactions, IO Outside',
      oneLiner: 'Open late, commit early, and never wait on the network while holding a connection.',
      useWhen: ['Any operation that both writes to the database and calls another service.'],
      recognize: ['An HTTP or queue call inside a `@Transactional` method.', 'Connection pool timeouts under load.'],
      steps: [
        'Identify the smallest set of writes that must be atomic.',
        'Put only those in the transactional method.',
        'Move external calls after the commit, ideally via an after-commit event.',
      ],
      template: {
        lang: 'java',
        caption: 'The boundary is the unit of atomicity, nothing more',
        code: `
@Transactional                       // short: two writes, one commit
public Order reserve(OrderRequest r) {
    Order o = repo.save(Order.from(r));
    inventory.decrement(r.items());
    return o;
}

// caller — outside any transaction
Order order = service.reserve(request);
gateway.charge(order);               // slow, external, retryable`,
      },
      complexity: 'Frees connections sooner; higher throughput under the same pool size.',
      gotchas: [
        'After the commit you may need compensation if the external call fails — decide that deliberately.',
        '`readOnly = true` on query methods skips dirty checking and can route to a replica.',
      ],
      problems: ['Move a gateway call out of a transaction', 'Measure connection hold time'],
    },
    {
      id: 'after-commit-events',
      name: 'After-Commit Events for Side Effects',
      oneLiner: 'Publish inside the transaction, act after it commits.',
      useWhen: ['Emails, notifications, cache invalidation, publishing to a queue.'],
      recognize: ['An email sent for an order whose transaction later rolled back.'],
      steps: ['Publish a domain event in the transactional method.', 'Listen with `@TransactionalEventListener(AFTER_COMMIT)`.', 'Keep the listener idempotent — it may be retried.'],
      complexity: 'Decouples the write from its consequences.',
      gotchas: [
        'An exception in an AFTER_COMMIT listener cannot roll anything back — the data is already committed.',
        'For guaranteed delivery you need the transactional outbox pattern, not just an event.',
      ],
      problems: ['Send an email only after commit', 'Show an email sent for a rolled-back order'],
    },
    {
      id: 'rollback-rules',
      name: 'Make the Rollback Rules Explicit',
      oneLiner: 'Do not rely on the default — say what should roll back.',
      useWhen: ['Any method that can throw a checked exception.', 'Any method with a `try/catch`.'],
      recognize: ['Partial writes surviving a failure.'],
      steps: [
        'Add `rollbackFor = Exception.class` when checked exceptions are possible.',
        'If you must catch, call `setRollbackOnly()` or rethrow.',
        'Write a test that asserts the rollback.',
      ],
      template: {
        lang: 'java',
        caption: 'A test is the only reliable proof',
        code: `
@Test
void rollsBackWhenPaymentFails() {
    when(gateway.charge(any())).thenThrow(new PaymentException());

    assertThatThrownBy(() -> service.place(request))
            .isInstanceOf(PaymentException.class);

    assertThat(orderRepository.count()).isZero();   // nothing was committed
}`,
      },
      complexity: 'One annotation attribute and one test.',
      gotchas: [
        'Rollback rules apply to what escapes the *proxied* method; an exception caught inside is invisible to it.',
        '`setRollbackOnly` makes the commit throw `UnexpectedRollbackException` — handle it or the caller sees a confusing error.',
      ],
      problems: ['Prove a checked exception commits', 'Fix it with rollbackFor'],
    },
  ],

  pitfalls: [
    { title: 'Self-invocation', text: 'An internal call bypasses the proxy, so there is no transaction at all.' },
    { title: 'Checked exceptions not rolling back', text: 'The default only rolls back on RuntimeException and Error.' },
    { title: 'Catching the exception inside the method', text: 'The proxy never sees it and commits the partial work.' },
    { title: 'private or final annotated methods', text: 'Cannot be proxied. No transaction, no warning.' },
    { title: 'External calls inside a transaction', text: 'Holds a connection for the duration of the network call.' },
    { title: '@Transactional on repositories instead of services', text: 'Produces several small transactions where you wanted one.' },
    { title: 'REQUIRES_NEW everywhere', text: 'Each one takes an extra connection; enough of them deadlock the pool.' },
    { title: 'Raising the isolation level to fix a race', text: 'Usually the wrong tool. Prefer optimistic locking with @Version.' },
    { title: 'Side effects before commit', text: 'Emails sent for orders that were never saved.' },
  ],

  cheatsheet: [
    { label: 'Works via', value: 'a proxy' },
    { label: 'Internal call', value: 'no transaction' },
    { label: 'Default rollback', value: 'RuntimeException and Error only' },
    { label: 'Checked exceptions', value: 'rollbackFor = Exception.class' },
    { label: 'Caught internally', value: 'setRollbackOnly()' },
    { label: 'Not proxyable', value: 'private, final, static' },
    { label: 'Default propagation', value: 'REQUIRED' },
    { label: 'Independent commit', value: 'REQUIRES_NEW (extra connection)' },
    { label: 'Put it on', value: 'the service layer' },
    { label: 'Query-only', value: 'readOnly = true' },
    { label: 'Side effects', value: '@TransactionalEventListener AFTER_COMMIT' },
    { label: 'Manual boundary', value: 'TransactionTemplate' },
    { label: 'Concurrent edits', value: '@Version, not SERIALIZABLE' },
    { label: 'Rule', value: 'no network calls inside' },
  ],

  problems: [
    { name: 'Prove self-invocation has no transaction', difficulty: 'Easy', pattern: 'Proxies', insight: 'Call an @Transactional method internally and print TransactionSynchronizationManager.isActualTransactionActive(). It is false.' },
    { name: 'Commit despite a checked exception', difficulty: 'Easy', pattern: 'Rollback rules', insight: 'Save then throw IOException. The row is still there. Add rollbackFor and it disappears.' },
    { name: 'Swallow an exception and commit half the work', difficulty: 'Medium', pattern: 'Rollback rules', insight: 'Catch and log inside the method. The first write commits and the second never happened — the worst possible outcome.' },
    { name: 'Make @Transactional do nothing with final', difficulty: 'Medium', pattern: 'Proxy limits', insight: 'Mark the method final and confirm no transaction is active. No error is produced.' },
    { name: 'Use REQUIRES_NEW for an audit record', difficulty: 'Medium', pattern: 'Propagation', insight: 'The outer transaction rolls back; the audit entry survives. Verify both in one test.' },
    { name: 'Deadlock the connection pool', difficulty: 'Hard', pattern: 'Propagation cost', insight: 'Pool size 2, two threads each calling a REQUIRES_NEW method. Both hold one connection and wait for another.' },
    { name: 'Send an email for a rolled-back order', difficulty: 'Medium', pattern: 'Side effects', insight: 'Send inside the transaction, then force a rollback. The email went out for an order that does not exist.' },
    { name: 'Fix it with an after-commit listener', difficulty: 'Medium', pattern: 'Events', insight: 'Publish the event inside, listen with AFTER_COMMIT, and confirm nothing is sent when the transaction fails.' },
    { name: 'Measure connection hold time', difficulty: 'Hard', pattern: 'Transaction scope', insight: 'Add a 2-second sleep inside a transaction, set the pool to 5, and send 20 concurrent requests. Watch the connection timeouts.' },
    { name: 'Write a rollback test', difficulty: 'Medium', pattern: 'Testing', insight: 'Assert both that the exception propagates and that the repository count is unchanged. This is the only reliable proof.' },
  ],
}
