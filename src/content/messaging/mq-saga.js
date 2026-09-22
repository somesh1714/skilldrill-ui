export default {
  id: 'mq-saga',
  title: 'Sagas: Transactions Across Services',
  short: 'Sagas',
  icon: 'AltRouteRounded',
  tier: 'Advanced',
  order: 12,
  estHours: 6,
  prereqs: ['mq-eda', 'mq-outbox'],
  tagline: 'You cannot roll back across services. So you undo forward instead.',
  mentalModel:
    'A saga is a sequence of local transactions, each in one service, each publishing what it did. If step four fails, you cannot roll back steps one to three — they are already committed in other databases. Instead you run **compensating** transactions that undo them semantically: refund the payment, release the stock.',
  whyItMatters:
    'The moment an order touches payment, inventory and shipping, you have a distributed transaction. Two-phase commit is not available across services in practice, so the saga is the answer — and getting compensation wrong means charged customers with no order, or reserved stock nobody will ever buy.',

  reference: {
    title: 'Saga vocabulary',
    head: ['Term', 'Meaning', 'Example'],
    rows: [
      ['**Local transaction**', 'One step, atomic within one service', '`INSERT payment`'],
      ['**Compensating transaction**', 'The semantic undo of a step', '`INSERT refund`'],
      ['**Pivot**', 'The step after which you cannot go back', 'Goods handed to the courier'],
      ['**Retriable step**', 'Comes after the pivot; must eventually succeed', 'Send confirmation email'],
      ['**Compensatable step**', 'Comes before the pivot; can be undone', 'Charge card, reserve stock'],
      ['**Saga log**', 'Durable record of where the saga is', 'A row per saga instance'],
    ],
  },

  sections: [
    {
      id: 'the-problem',
      title: 'Why a normal transaction is unavailable',
      blocks: [
        {
          t: 'ascii',
          caption: 'Four databases, four commits, no shared transaction.',
          code: `
   ORDER            PAYMENT          INVENTORY        SHIPPING
   service          service          service          service
      │                │                │                │
   ┌──▼──┐          ┌──▼──┐         ┌───▼───┐        ┌───▼───┐
   │ DB1 │          │ DB2 │         │  DB3  │        │  DB4  │
   └─────┘          └─────┘         └───────┘        └───────┘

   Step 1: order saved         COMMIT ✔  ← already durable
   Step 2: card charged        COMMIT ✔  ← already durable
   Step 3: stock reserved      FAIL   ✘  ← item sold out

   There is no ROLLBACK that reaches back into DB1 and DB2.
   Those transactions ended seconds ago. The money is gone.

   Two-phase commit could do it in theory, but it requires every
   service to hold locks while waiting for a coordinator — which
   means one slow service blocks everyone, and a coordinator
   failure leaves locks held indefinitely. Nobody does this
   across service boundaries.`,
        },
        {
          t: 'key',
          title: 'A saga trades isolation for availability',
          text: 'The uncomfortable consequence: there is a window where the system is **visibly inconsistent** — money taken, stock not reserved. A user could see that state. You are choosing to accept temporary inconsistency in exchange for services that do not lock each other. That is a product decision as much as a technical one, and it should be a conscious one.',
        },
      ],
    },
    {
      id: 'compensation',
      title: 'Compensation, step by step',
      blocks: [
        {
          t: 'ascii',
          caption: 'The happy path, then the same saga failing at step 3.',
          code: `
  HAPPY PATH
    1. OrderCreated       (order svc)   status = PENDING
    2. PaymentCaptured    (payment svc) ₹2,400 taken
    3. StockReserved      (inventory)   2 units held
    4. ShipmentCreated    (shipping)    label printed
    5. OrderConfirmed     (order svc)   status = CONFIRMED


  FAILURE AT STEP 3 — compensate backwards
    1. OrderCreated       ✔
    2. PaymentCaptured    ✔   ₹2,400 taken
    3. StockReservation   ✘   out of stock
         │
         ▼  publish StockReservationFailed
    2'. RefundIssued      ←  compensates step 2  (a NEW transaction,
                              not a rollback — there is a refund row)
    1'. OrderCancelled    ←  compensates step 1  status = CANCELLED
         │
         ▼
    the customer sees: "Order cancelled, refund issued"
    the ledger shows:  a charge AND a refund — both real, both audited`,
        },
        {
          t: 'key',
          title: 'Compensation is semantic, not a rewind',
          text: 'A refund is not the charge disappearing — it is a second, opposite transaction. The customer’s statement shows both. An email already sent cannot be unsent; you send a correction. Design compensations as real business operations, because that is what they are.',
        },
        { t: 'h', text: 'The pivot: where compensation stops being possible' },
        {
          t: 'ascii',
          caption: 'Before the pivot you can undo. After it you must go forward.',
          code: `
   COMPENSATABLE          PIVOT              RETRIABLE
  ┌──────────────┬──────────────────┬───────────────────────┐
  │ 1. create    │  4. hand goods   │  5. send confirmation │
  │ 2. charge    │     to courier   │  6. update analytics  │
  │ 3. reserve   │                  │  7. award points      │
  └──────────────┴──────────────────┴───────────────────────┘
       can undo       point of no        MUST eventually
                      return             succeed — retry
                                         forever, alert a human

  Design rule: put everything that can fail BEFORE the pivot, and
  everything after it must be retriable indefinitely. If step 6 can
  fail permanently, it is in the wrong place.`,
        },
        {
          t: 'warn',
          title: 'Compensations must be idempotent too',
          text: 'The compensating step arrives over the same at-least-once messaging as everything else. A refund command delivered twice must produce one refund. Key it by the original payment id and make the second attempt a no-op — otherwise your failure path causes a worse problem than the failure did.',
        },
      ],
    },
    {
      id: 'implementing',
      title: 'Implementing an orchestrated saga',
      blocks: [
        { t: 'p', text: 'Choreographed sagas exist, but for anything involving money the orchestrated form is almost always right: the state is explicit, you can query it, and compensation has an owner.' },
        {
          t: 'code',
          lang: 'java',
          caption: 'The saga state must be persistent — it outlives the process',
          code: `
@Entity
public class OrderSaga {
    @Id private String orderId;

    @Enumerated(EnumType.STRING)
    private SagaState state;        // STARTED, PAYMENT_DONE, STOCK_DONE,
                                    // COMPENSATING, COMPLETED, FAILED
    private String paymentId;       // needed to compensate
    private String reservationId;   // needed to compensate
    private Instant startedAt;
    private Instant deadline;       // for the timeout sweeper
    private String failureReason;
}`,
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'The orchestrator: one method per event, each advancing or compensating',
          code: `
@Component
public class OrderSagaOrchestrator {

    @KafkaListener(topics = "orders", groupId = "order-saga")
    @Transactional
    public void onOrderCreated(OrderCreated e) {
        sagas.save(OrderSaga.start(e.orderId(), Duration.ofMinutes(5)));
        outbox.publish(new ChargeCard(e.orderId(), e.total()));   // via outbox
    }

    @KafkaListener(topics = "payments", groupId = "order-saga")
    @Transactional
    public void onPaymentCaptured(PaymentCaptured e) {
        OrderSaga saga = sagas.get(e.orderId());
        if (saga.state() != STARTED) return;          // duplicate — ignore

        saga.paymentCaptured(e.paymentId());
        outbox.publish(new ReserveStock(e.orderId(), saga.items()));
    }

    @KafkaListener(topics = "inventory", groupId = "order-saga")
    @Transactional
    public void onStockReservationFailed(StockReservationFailed e) {
        OrderSaga saga = sagas.get(e.orderId());
        saga.compensating(e.reason());

        // Undo in reverse order, and only what actually happened
        if (saga.paymentId() != null) {
            outbox.publish(new RefundPayment(saga.paymentId(), e.orderId()));
        }
        outbox.publish(new CancelOrder(e.orderId(), e.reason()));
    }
}`,
        },
        {
          t: 'key',
          title: 'Guard every handler on the current state',
          text: '`if (saga.state() != STARTED) return;` is what makes the orchestrator idempotent. Messages arrive twice, and out of order. The state machine — not the message — decides what happens next. Without that guard, a duplicated `PaymentCaptured` issues a second `ReserveStock`.',
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'The timeout sweeper: the step that never answers',
          code: `
// The most-forgotten failure mode. A service does not fail — it simply
// never replies. Without this, the saga is stuck forever and the
// customer's money is held with no resolution.
@Scheduled(fixedDelay = 30_000)
@Transactional
public void sweepTimeouts() {
    for (OrderSaga saga : sagas.findExpired(Instant.now())) {
        log.warn("Saga {} timed out in state {}", saga.orderId(), saga.state());
        meterRegistry.counter("saga.timeout", "state", saga.state().name())
                     .increment();
        compensate(saga);                 // same path as an explicit failure
    }
}`,
        },
      ],
    },
  ],

  patterns: [
    {
      id: 'orchestrated-saga',
      name: 'Orchestrated Saga With Persistent State',
      oneLiner: 'One component owns the sequence, the state and the compensation.',
      useWhen: ['Multi-service processes involving money, stock or legal obligations.'],
      recognize: ['A flow spread across services with nobody responsible for cleanup.', 'Being unable to answer "where is order 4471?".'],
      steps: [
        'Model the states explicitly as an enum.',
        'Persist the saga row; never hold it in memory.',
        'One handler per incoming event, guarded on the current state.',
        'Publish commands through the outbox.',
        'Add a timeout sweeper.',
      ],
      complexity: 'One entity and one component; makes the process observable.',
      gotchas: [
        'Store the ids you will need to compensate — you cannot refund without the payment id.',
        'The orchestrator should co-ordinate, not do the work itself.',
      ],
      problems: ['Build a three-step saga', 'Query the state of an in-flight saga'],
    },
    {
      id: 'idempotent-compensation',
      name: 'Idempotent, Reverse-Order Compensation',
      oneLiner: 'Undo only what happened, in reverse, and survive being asked twice.',
      useWhen: ['Any saga step that can fail.'],
      recognize: ['Double refunds.', 'A compensation for a step that never ran.'],
      steps: [
        'Record what each step actually did, with its id.',
        'Compensate in reverse order.',
        'Key each compensation by the original operation id.',
        'Skip steps the saga never reached.',
      ],
      template: {
        lang: 'java',
        caption: 'The unique constraint makes the second refund a no-op',
        code: `
@Transactional
public void refund(RefundPayment cmd) {
    try {
        // one refund per payment, enforced by the database
        refunds.save(new Refund(cmd.paymentId(), cmd.amount()));
    } catch (DataIntegrityViolationException alreadyRefunded) {
        log.info("Payment {} already refunded", cmd.paymentId());
        return;
    }
    gateway.refund(cmd.paymentId(), "refund-" + cmd.paymentId());  // idempotency key
}`,
      },
      complexity: 'One unique constraint per compensation type.',
      gotchas: [
        'A compensation that fails needs its own retry and alerting — it cannot be compensated in turn.',
        'Some steps have no true compensation; plan the pivot so those come last.',
      ],
      problems: ['Double-refund a payment', 'Fix it with a unique constraint'],
    },
    {
      id: 'saga-timeout',
      name: 'Sweep for Stuck Sagas',
      oneLiner: 'A step that never answers is the failure mode nobody designs for.',
      useWhen: ['Every saga.'],
      recognize: ['Orders stuck in PENDING for days.', 'Customers emailing about money taken with no order.'],
      steps: [
        'Give every saga a deadline when it starts.',
        'A scheduled job finds expired sagas and compensates them.',
        'Emit a metric per timed-out state so you can see which step hangs.',
      ],
      complexity: 'One scheduled query.',
      gotchas: [
        'The deadline must exceed the slowest legitimate path, or you compensate successful sagas.',
        'A late reply arriving after compensation must be rejected by the state guard.',
      ],
      problems: ['Hang a step and watch the sweeper fire', 'Handle a late reply after compensation'],
    },
  ],

  pitfalls: [
    { title: 'Expecting rollback across services', text: 'Those transactions already committed. Compensation is the only option.' },
    { title: 'Saga state in memory', text: 'A restart loses every in-flight saga. It must be persisted.' },
    { title: 'Compensations that are not idempotent', text: 'Duplicate refunds — the failure path causing a worse failure.' },
    { title: 'No timeout handling', text: 'A silent step leaves the saga stuck forever with money held.' },
    { title: 'Compensating steps that never ran', text: 'Refunding a payment that was never captured.' },
    { title: 'Not storing the ids needed to compensate', text: 'You cannot refund without the payment id.' },
    { title: 'Handlers without a state guard', text: 'A duplicate event advances the saga twice.' },
    { title: 'Publishing commands without an outbox', text: 'The saga advances in the database but the command is lost.' },
    { title: 'Ignoring the visible inconsistency window', text: 'The UI must explain PENDING; users will see it.' },
  ],

  cheatsheet: [
    { label: 'Saga =', value: 'local transactions + compensations' },
    { label: 'No rollback', value: 'undo forward instead' },
    { label: 'Compensation is', value: 'a new opposite transaction' },
    { label: 'Pivot', value: 'the point of no return' },
    { label: 'Before pivot', value: 'compensatable' },
    { label: 'After pivot', value: 'must eventually succeed' },
    { label: 'Compensate in', value: 'reverse order' },
    { label: 'Only compensate', value: 'steps that actually ran' },
    { label: 'State', value: 'persisted, never in memory' },
    { label: 'Every handler', value: 'guarded on the current state' },
    { label: 'Commands', value: 'published via the outbox' },
    { label: 'Must have', value: 'a timeout sweeper' },
    { label: 'Trade', value: 'isolation for availability' },
    { label: 'Money flows', value: 'orchestrate, do not choreograph' },
  ],

  problems: [
    { name: 'Break a flow at step three', difficulty: 'Medium', pattern: 'The problem', insight: 'Charge the card, then fail stock reservation. Confirm nothing refunds the customer and the order sits in PENDING.' },
    { name: 'Build a three-step saga', difficulty: 'Hard', pattern: 'Orchestration', insight: 'Persisted state, one handler per event, compensation on failure. Verify the customer ends up whole.' },
    { name: 'Duplicate a saga event', difficulty: 'Medium', pattern: 'Idempotency', insight: 'Redeliver PaymentCaptured. Without a state guard the saga issues a second ReserveStock; with one it is ignored.' },
    { name: 'Double-refund a payment', difficulty: 'Medium', pattern: 'Compensation', insight: 'Deliver RefundPayment twice with no unique constraint. Two refund rows, two gateway calls. Then fix it.' },
    { name: 'Restart mid-saga', difficulty: 'Hard', pattern: 'Durability', insight: 'Kill the orchestrator between steps two and three. On restart it must resume from the persisted state, not start over.' },
    { name: 'Hang a step forever', difficulty: 'Hard', pattern: 'Timeouts', insight: 'Make inventory never reply. Without a sweeper the saga is stuck permanently; with one it compensates after the deadline.' },
    { name: 'Handle a late reply', difficulty: 'Hard', pattern: 'Timeouts', insight: 'Let the timeout fire, then deliver the delayed StockReserved. The state guard must reject it rather than un-cancel the order.' },
    { name: 'Compensate a step that never ran', difficulty: 'Medium', pattern: 'Compensation', insight: 'Fail at step one and confirm the orchestrator does not attempt a refund for a payment that was never captured.' },
    { name: 'Identify your pivot', difficulty: 'Medium', pattern: 'Design', insight: 'For a real flow, mark which steps are compensatable and which are retriable. Anything that can fail permanently after the pivot is misplaced.' },
    { name: 'Expose saga state in an API', difficulty: 'Medium', pattern: 'Observability', insight: 'GET /orders/4471/saga returning the current state and history. This is what makes support possible.' },
  ],
}
