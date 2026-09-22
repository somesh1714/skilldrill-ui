export default {
  id: 'mq-eda',
  title: 'Event-Driven Architecture',
  short: 'EDA',
  icon: 'HubRounded',
  tier: 'Foundations',
  order: 3,
  estHours: 5,
  prereqs: ['mq-why'],
  tagline: 'Stop telling services what to do. Announce what happened and let them decide.',
  mentalModel:
    'In a request-driven system the caller knows who must act, so it holds all the knowledge and all the coupling. In an event-driven system the producer states a **fact** and knows nothing about who cares. Every architectural benefit and every debugging difficulty comes from that inversion.',
  whyItMatters:
    'EDA is what lets teams add capability without co-ordinating deployments. It is also how you end up with a system where nobody can explain what happens when an order is placed. Both outcomes come from the same property, and the difference is discipline.',

  reference: {
    title: 'Message types, and what each implies',
    head: ['Type', 'Example', 'Consumers', 'Who decides'],
    rows: [
      ['**Event**', '`OrderPlaced`', 'Zero to many', 'Each consumer decides what it means'],
      ['**Command**', '`ReserveStock`', 'Exactly one', 'The sender decides'],
      ['**Query**', '`GetOrderStatus`', 'One, with a reply', 'The sender needs an answer'],
      ['**Document / state**', '`OrderSnapshot`', 'Many', 'Carries full state, not a change'],
    ],
  },

  sections: [
    {
      id: 'inversion',
      title: 'The inversion, drawn',
      blocks: [
        {
          t: 'ascii',
          caption: 'Request-driven: the Order Service knows every downstream service by name.',
          code: `
                   ┌────────────────┐
                   │  Order Service │   knows about ALL of them
                   └───┬───┬───┬───┬┘
           ┌───────────┘   │   │   └──────────┐
           ▼               ▼   ▼              ▼
     ┌─────────┐   ┌───────────┐  ┌──────────┐  ┌───────────────┐
     │ Payment │   │ Inventory │  │ Shipping │  │ Notifications │
     └─────────┘   └───────────┘  └──────────┘  └───────────────┘

  Adding fraud detection means:
    • changing the Order Service
    • testing the Order Service
    • deploying the Order Service
    • a conversation between two teams`,
        },
        {
          t: 'ascii',
          caption: 'Event-driven: the Order Service knows only the topic.',
          code: `
                   ┌────────────────┐
                   │  Order Service │   knows about NOBODY
                   └────────┬───────┘
                            │ publishes OrderPlaced
                            ▼
                   ╔════════════════╗
                   ║ topic: orders  ║
                   ╚═══╤═══╤═══╤══╤═╝
           ┌───────────┘   │   │  └───────────┬──────────────┐
           ▼               ▼   ▼              ▼              ▼
     ┌─────────┐   ┌───────────┐  ┌──────────┐  ┌──────────────┐  ┌───────┐
     │ Payment │   │ Inventory │  │ Shipping │  │Notifications │  │ Fraud │
     └─────────┘   └───────────┘  └──────────┘  └──────────────┘  └───────┘
                                                                    ▲
                                                    added today, no upstream change`,
        },
        {
          t: 'key',
          title: 'The producer must not know its consumers',
          text: 'The test is simple: if adding a consumer requires *any* change to the producer, you are not event-driven — you are doing asynchronous RPC. An event carries what happened, in enough detail for any reasonable consumer, and nothing about what should be done next.',
        },
      ],
    },
    {
      id: 'events-vs-commands',
      title: 'Events versus commands, with the same requirement',
      blocks: [
        { t: 'p', text: 'The distinction sounds academic until you see the same feature modelled both ways.' },
        {
          t: 'code',
          lang: 'java',
          caption: 'Requirement: when an order is placed, take payment, reserve stock and email the customer.',
          code: `
// ───── COMMAND STYLE ─────────────────────────────────────────────
// The Order Service decides what must happen and to whom.
publish(new ChargeCard(orderId, customerId, total));
publish(new ReserveStock(orderId, items));
publish(new SendEmail(customerId, "order-confirmation", orderId));

// The Order Service now knows:
//   • that payment exists and how it is invoked
//   • that inventory exists
//   • which email template to use   ← it has opinions about marketing
// Adding fraud scoring = another publish() here.


// ───── EVENT STYLE ───────────────────────────────────────────────
// The Order Service states a fact and stops.
publish(new OrderPlaced(orderId, customerId, items, total, placedAt));

// Payment subscribes and decides to charge.
// Inventory subscribes and decides to reserve.
// Notifications subscribes and decides which template to use.
// Fraud subscribes next quarter. Nobody tells the Order Service.`,
        },
        {
          t: 'dl',
          items: [
            { term: 'Name events in the past tense', def: '`OrderPlaced`, `PaymentCaptured`, `StockReserved`. If you cannot name it in the past tense, it is probably a command.' },
            { term: 'An event is a fact', def: 'It has already happened. It cannot be rejected, only reacted to. A consumer that "refuses" an event is misunderstanding it.' },
            { term: 'Commands are legitimate', def: 'Sometimes you genuinely need to instruct one service. That is fine — just send it point-to-point, name it imperatively, and accept that it is coupled.' },
            { term: 'The smell', def: 'An event field that exactly one consumer reads, describing what that consumer should do. That is a command hiding inside an event.' },
          ],
        },
        {
          t: 'trap',
          title: 'The "event" that is really a command',
          text: '`OrderPlaced { orderId, sendEmailTo, emailTemplate, shouldChargeImmediately }` is not an event. The producer is instructing the consumers and simply using the word "event". You will know because every new consumer requires new fields on the payload.',
        },
      ],
    },
    {
      id: 'choreography-orchestration',
      title: 'Choreography versus orchestration',
      blocks: [
        { t: 'lead', text: 'Once you have events, there are two ways to make a multi-step business process happen. Both are valid; they fail in different ways.' },
        {
          t: 'ascii',
          caption: 'Choreography: each service reacts to the previous one. No central brain.',
          code: `
  Order Service
      │ publishes OrderPlaced
      ▼
  ╔═══════════╗
  ║  orders   ║
  ╚═════╤═════╝
        ▼
    Payment ── charges card ── publishes PaymentCaptured
                                    │
                              ╔═════▼══════╗
                              ║  payments  ║
                              ╚═════╤══════╝
                                    ▼
                              Inventory ── reserves ── publishes StockReserved
                                                            │
                                                      ╔═════▼═══════╗
                                                      ║  inventory  ║
                                                      ╚═════╤═══════╝
                                                            ▼
                                                        Shipping ── creates label

  Nobody owns the flow. Each service knows only its own trigger and its
  own output. Very loosely coupled — and impossible to see in one place.`,
        },
        {
          t: 'ascii',
          caption: 'Orchestration: one component owns the sequence and issues commands.',
          code: `
                 ┌──────────────────────────────┐
                 │   Order Orchestrator (saga)  │  ◀── owns the flow
                 └──┬────────┬────────┬─────────┘
       1. ChargeCard│        │        │
                    ▼        │        │
               ┌─────────┐   │        │
               │ Payment │   │        │
               └────┬────┘   │        │
        PaymentCaptured      │        │
                    └───────▶│        │
                 2. ReserveStock       │
                             ▼        │
                      ┌───────────┐   │
                      │ Inventory │   │
                      └─────┬─────┘   │
                  StockReserved        │
                             └────────▶│
                                 3. CreateShipment
                                          ▼
                                    ┌──────────┐
                                    │ Shipping │
                                    └──────────┘

  The whole business process is readable in ONE class.
  More coupling, far more visibility — and compensation is possible.`,
        },
        {
          t: 'compare',
          left: {
            title: 'Choreography',
            items: [
              'Maximum decoupling — no central component',
              'Easy to add a step: subscribe',
              'No single point of failure',
              'The flow exists nowhere; you infer it from code',
              'Cycles are easy to create by accident',
              'Compensation across steps is very hard',
            ],
          },
          right: {
            title: 'Orchestration',
            items: [
              'The process is explicit and readable',
              'Compensation and timeouts are natural',
              'You can query "where is order 4471?"',
              'The orchestrator knows every participant',
              'It becomes a critical component',
              'Risk of a distributed monolith',
            ],
          },
        },
        {
          t: 'key',
          title: 'A practical rule',
          text: 'Use **choreography for notification** — things that react to a fact but do not change the outcome: emails, analytics, search indexing, caches. Use **orchestration for business transactions** — sequences with money, stock or legal meaning, where you need to know the state and to undo steps when a later one fails. Most real systems use both, and that is correct.',
        },
        {
          t: 'warn',
          title: 'The choreography failure everyone hits',
          text: 'Order placed → payment captured → stock reservation **fails** because the item sold out. In choreography, nobody is responsible for refunding the payment. The money is taken, the stock is gone, and no component owns the contradiction. This is exactly what sagas exist to fix, and why business-critical flows tend toward orchestration.',
        },
      ],
    },
    {
      id: 'payload',
      title: 'How much to put in an event',
      blocks: [
        { t: 'p', text: 'A genuine design decision with a real trade-off. There are three positions.' },
        {
          t: 'ascii',
          caption: 'Thin, fat, and in between.',
          code: `
  ── NOTIFICATION (thin) ──────────────────────────────────────────
     { "eventType": "OrderPlaced", "orderId": 4471 }

     Consumer must call back: GET /orders/4471
     ✔ small, no stale data, no schema coupling on the body
     ✘ every consumer generates load on the producer
     ✘ the callback may see a LATER state than the event described


  ── EVENT-CARRIED STATE TRANSFER (fat) ───────────────────────────
     { "eventType": "OrderPlaced", "orderId": 4471,
       "customerId": "c-902", "customerEmail": "...",
       "items": [ ... ], "total": 2400.00, "placedAt": "..." }

     ✔ consumers are fully autonomous — no callback, works when the
       producer is down
     ✔ the event is a snapshot of that moment — no race
     ✘ larger messages, and a schema many teams now depend on
     ✘ duplicated data that can go stale in consumer stores


  ── HYBRID (usual answer) ────────────────────────────────────────
     Carry the fields consumers actually need, plus the id for the rest.`,
        },
        {
          t: 'key',
          title: 'Prefer event-carried state for anything that must survive the producer being down',
          text: 'The whole point of decoupling is that Payment can work while the Order Service is being redeployed. If every consumer has to call back, you have reintroduced the runtime coupling you just removed — with extra latency. Carry the state, version the schema, and accept the size.',
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'An event designed to be consumed by services you have not met',
          code: `
public record OrderPlaced(
        // identity
        UUID eventId,               // for de-duplication
        Instant occurredAt,         // when the FACT happened, not when published

        // the entity
        Long orderId,
        String customerId,

        // enough state for a consumer to act without calling back
        List<Item> items,
        BigDecimal total,
        String currency,
        Address shippingAddress) {

    public record Item(Long productId, String sku, int quantity, BigDecimal price) { }
}

// NOT included, deliberately:
//   • emailTemplate    — Notifications owns that decision
//   • shouldCharge     — Payment owns that decision
//   • warehouseId      — Inventory owns that decision`,
        },
        {
          t: 'note',
          title: 'occurredAt is not publishedAt',
          text: 'Keep the time the fact happened separate from the time the message was sent. With an outbox or a retry they can differ by seconds or minutes, and consumers that reason about ordering or windows need the business time, not the transport time.',
        },
      ],
    },
  ],

  patterns: [
    {
      id: 'fact-not-instruction',
      name: 'Publish Facts, Let Consumers Decide',
      oneLiner: 'The producer states what happened; each consumer owns what that means for it.',
      useWhen: ['Any domain change other services may care about.'],
      recognize: ['Message names in the imperative.', 'Payload fields describing consumer behaviour.', 'The producer changing every time a consumer is added.'],
      steps: [
        'Name the message after a fact, in the past tense.',
        'Include the state a reasonable consumer would need.',
        'Remove anything that instructs a consumer.',
      ],
      complexity: 'No runtime cost; decides whether the system can evolve.',
      gotchas: [
        'Resist adding a field "just for the new consumer" — that is the coupling returning.',
        'Events are facts, so they cannot be rejected. A consumer that cannot act must handle that itself.',
      ],
      problems: ['Convert three commands into one event', 'Add a consumer with no producer change'],
    },
    {
      id: 'orchestrate-transactions',
      name: 'Choreograph Notifications, Orchestrate Transactions',
      oneLiner: 'Loose coupling where the outcome does not matter; explicit control where it does.',
      useWhen: ['Designing a multi-step business process.'],
      recognize: ['A flow spread across five services that nobody can draw.', 'A failure halfway through with nobody responsible for cleanup.'],
      steps: [
        'Split the process into steps that change business state and steps that merely react.',
        'Orchestrate the first group so you can compensate and observe.',
        'Let the second group subscribe freely.',
      ],
      template: {
        lang: 'java',
        caption: 'The orchestrator owns only the transactional spine',
        code: `
// ORCHESTRATED — money and stock, with compensation
@Component
public class OrderSaga {
    public void onOrderPlaced(OrderPlaced e) { commands.send(new ChargeCard(e)); }

    public void onPaymentCaptured(PaymentCaptured e) {
        commands.send(new ReserveStock(e.orderId()));
    }

    public void onStockReservationFailed(StockReservationFailed e) {
        commands.send(new RefundPayment(e.orderId()));    // compensate
        orders.markFailed(e.orderId(), "out of stock");
    }
}

// CHOREOGRAPHED — these just react; a failure here changes nothing
@KafkaListener(topics = "orders", groupId = "notifications")
public void email(OrderPlaced e) { mailer.sendConfirmation(e); }

@KafkaListener(topics = "orders", groupId = "analytics")
public void count(OrderPlaced e) { metrics.recordRevenue(e.total()); }`,
      },
      complexity: 'One component to own the flow; the rest stays decoupled.',
      gotchas: [
        'An orchestrator must persist its state — it cannot hold a saga in memory across a restart.',
        'Do not let the orchestrator grow into a service that does the work itself.',
      ],
      problems: ['Draw a choreographed flow from the code', 'Add compensation to a failing step'],
    },
    {
      id: 'carry-state',
      name: 'Event-Carried State Transfer',
      oneLiner: 'Put enough in the event that consumers never have to call back.',
      useWhen: ['Consumers must work while the producer is unavailable.', 'Callback load on the producer is significant.'],
      recognize: ['Every consumer issuing a GET to the producer on each message.', 'A consumer seeing state newer than the event it is handling.'],
      steps: [
        'Ask what the consumers actually read after the callback.',
        'Put those fields in the event.',
        'Version the schema, because it is now a shared contract.',
      ],
      complexity: 'Larger messages; removes a synchronous dependency.',
      gotchas: [
        'The event is a snapshot — consumers that store it must handle it going stale.',
        'Do not carry secrets or personal data further than necessary; the topic may be retained for days.',
      ],
      problems: ['Remove a callback by fattening the event', 'Show a callback racing ahead of the event'],
    },
  ],

  pitfalls: [
    { title: 'Commands dressed as events', text: 'Imperative names or consumer-specific fields. The coupling is still there.' },
    { title: 'The producer knowing its consumers', text: 'If adding a consumer changes the producer, it is asynchronous RPC.' },
    { title: 'Pure choreography for money flows', text: 'When step three fails, nobody owns undoing steps one and two.' },
    { title: 'An orchestrator that does the work', text: 'It becomes a distributed monolith with extra network hops.' },
    { title: 'Thin events plus mandatory callbacks', text: 'Reintroduces runtime coupling and load on the producer.' },
    { title: 'No event id', text: 'De-duplication becomes impossible, and duplicates are guaranteed.' },
    { title: 'Conflating occurredAt with publishedAt', text: 'Breaks windowing and ordering logic whenever a retry delays publication.' },
    { title: 'Events as a database', text: 'Consumers querying a topic for current state. Use a compacted topic or a read model instead.' },
  ],

  cheatsheet: [
    { label: 'Event', value: 'past tense, a fact, many consumers' },
    { label: 'Command', value: 'imperative, one handler' },
    { label: 'Test for EDA', value: 'can you add a consumer untouched?' },
    { label: 'Choreography', value: 'services react to each other' },
    { label: 'Orchestration', value: 'one component owns the flow' },
    { label: 'Use choreography for', value: 'notifications, analytics, indexing' },
    { label: 'Use orchestration for', value: 'money, stock, anything needing undo' },
    { label: 'Thin event', value: 'id only — consumer calls back' },
    { label: 'Fat event', value: 'carries state — consumer is autonomous' },
    { label: 'Default to', value: 'event-carried state' },
    { label: 'Always include', value: 'eventId + occurredAt' },
    { label: 'Never include', value: 'instructions for a consumer' },
  ],

  problems: [
    { name: 'Rewrite three commands as one event', difficulty: 'Easy', pattern: 'Event design', insight: 'Replace ChargeCard, ReserveStock and SendEmail with OrderPlaced. Note which knowledge left the Order Service.' },
    { name: 'Add a consumer with zero upstream change', difficulty: 'Easy', pattern: 'Decoupling', insight: 'Subscribe a fraud service to the existing topic. If you had to touch the producer, the design was not event-driven.' },
    { name: 'Spot the command hiding in an event', difficulty: 'Easy', pattern: 'Event design', insight: 'Given a payload with emailTemplate and shouldChargeImmediately, identify which consumer owns each decision and remove the fields.' },
    { name: 'Draw a choreographed flow from code', difficulty: 'Medium', pattern: 'Choreography', insight: 'Given four services each subscribing to the previous one, reconstruct the sequence from the code alone. Time how long it takes.' },
    { name: 'Break a choreographed flow at step three', difficulty: 'Medium', pattern: 'Choreography limits', insight: 'Make stock reservation fail after payment succeeds. Confirm nothing refunds the customer.' },
    { name: 'Add an orchestrator with compensation', difficulty: 'Hard', pattern: 'Orchestration', insight: 'Introduce a saga that issues a refund when reservation fails. Verify the customer ends up whole.' },
    { name: 'Create an accidental event cycle', difficulty: 'Hard', pattern: 'Choreography risk', insight: 'A publishes X, B reacts and publishes Y, C reacts and publishes X. Watch the infinite loop and add a guard.' },
    { name: 'Remove a callback with a fatter event', difficulty: 'Medium', pattern: 'State transfer', insight: 'Measure the producer GET load, move those fields into the event, and confirm the load disappears.' },
    { name: 'Race a callback against an event', difficulty: 'Hard', pattern: 'Thin events', insight: 'Update the order immediately after publishing. The consumer calling back sees the newer state, not the state the event described.' },
    { name: 'Design an OrderPlaced schema', difficulty: 'Medium', pattern: 'Event design', insight: 'Write the record, then justify each field by naming a consumer that needs it. Delete anything you cannot justify.' },
  ],
}
