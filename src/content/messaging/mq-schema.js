export default {
  id: 'mq-schema',
  title: 'Schema Evolution & the Schema Registry',
  short: 'Schema Evolution',
  icon: 'SchemaRounded',
  tier: 'Advanced',
  order: 14,
  estHours: 4,
  prereqs: ['mq-eda'],
  tagline: 'The event schema is a public API with consumers you have never met and cannot deploy.',
  mentalModel:
    'A synchronous API has one version live at a time and you control the rollout. A topic has **messages from last week** being read **by a consumer deployed last year**. The schema must therefore be compatible in both directions simultaneously, forever — and the only way to guarantee that is to enforce it before the message is published.',
  whyItMatters:
    'Renaming one field in an event breaks every consumer at once, silently, in production, and you cannot roll back messages already written. Schema management is the difference between an event backbone that scales across teams and one that everybody is afraid to touch.',

  reference: {
    title: 'Compatibility modes',
    head: ['Mode', 'You may', 'Upgrade first', 'Use when'],
    rows: [
      ['**BACKWARD** (default)', 'Delete a field, add an **optional** field', '**Consumers**', 'Most event topics'],
      ['**FORWARD**', 'Add a field, delete an **optional** one', '**Producers**', 'Many uncontrolled consumers'],
      ['**FULL**', 'Only add or delete optional fields', 'Either', 'Safest; what you usually want'],
      ['**NONE**', 'Anything', 'Pray', 'Never, in production'],
      ['**\\*_TRANSITIVE**', 'Same, checked against **all** past versions', '—', 'Long-retention topics'],
    ],
  },

  sections: [
    {
      id: 'problem',
      title: 'Why this is harder than versioning a REST API',
      blocks: [
        {
          t: 'ascii',
          caption: 'Old and new coexist in the log itself, not just in traffic.',
          code: `
  topic "orders", 7-day retention

  ┌──────────┬──────────┬──────────┬──────────┬──────────┐
  │ v1 msg   │ v1 msg   │ v2 msg   │ v2 msg   │ v2 msg   │
  │ (Mon)    │ (Tue)    │ (Wed)    │ (Thu)    │ (Fri)    │
  └──────────┴──────────┴──────────┴──────────┴──────────┘
        ▲                      ▲                      ▲
        │                      │                      │
   consumer A             consumer B             consumer C
   still on v1 code       upgraded to v2         brand new, v2
   reading Monday         reading Wednesday      replaying from
   (old msg, old code)    (new msg, new code)    Monday — NEW CODE
                                                 reading OLD MESSAGES

  So you need, simultaneously:
    • new code able to read old messages   (backward compatibility)
    • old code able to read new messages   (forward compatibility)

  A REST API never has this problem: the server and the request are
  always from the same moment in time.`,
        },
        {
          t: 'key',
          title: 'Retention is how long you must stay compatible',
          text: 'With seven-day retention you must read seven days of old formats. With a compacted topic that is the source of truth, you must be able to read **every version you have ever produced**, forever. That is why long-lived topics should use the `_TRANSITIVE` modes.',
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'The changes that break things, and what to do instead',
          code: `
// ✘ BREAKING — rename a field
record OrderPlaced(Long orderId, BigDecimal total) { }      // v1
record OrderPlaced(Long orderId, BigDecimal amount) { }     // v2 — total is gone

// ✔ SAFE — add the new one, keep the old, deprecate, remove much later
record OrderPlaced(Long orderId,
                   @Deprecated BigDecimal total,
                   BigDecimal amount) { }

// ✘ BREAKING — change a type
BigDecimal total  →  String total          // consumers fail to parse

// ✘ BREAKING — add a REQUIRED field
//    old messages have no value for it, so new code cannot read them

// ✔ SAFE — add an OPTIONAL field with a default
record OrderPlaced(Long orderId, BigDecimal total,
                   String currency) { }    // default "INR" in the schema

// ✘ BREAKING — add an enum value
//    old consumers hit an unknown constant and throw. Always include
//    an UNKNOWN member from day one and map unrecognised values to it.`,
        },
      ],
    },
    {
      id: 'registry',
      title: 'The schema registry',
      blocks: [
        {
          t: 'ascii',
          caption: 'The schema travels by id; the payload stays small.',
          code: `
  PRODUCER                  SCHEMA REGISTRY              CONSUMER
     │                            │                          │
     │─ register schema v2 ──────▶│                          │
     │   (checked for             │  REJECTS the register    │
     │    compatibility)          │  if incompatible ──── the breaking
     │◀── schema id = 42 ─────────│  change is stopped HERE, at
     │                            │  build or deploy time
     │                            │
     │  message on the wire:      │                          │
     │  ┌──┬────────┬───────────┐ │                          │
     │  │00│  42    │ avro bytes│ │                          │
     │  └──┴────────┴───────────┘ │                          │
     │   magic  schema id  payload│                          │
     │                            │                          │
     │────────── to Kafka ────────┼─────────────────────────▶│
     │                            │◀── fetch schema 42 ──────│
     │                            │──── schema (cached) ────▶│
     │                            │                          │ deserialize

  The payload carries a 4-byte id, not the schema. So Avro messages
  are far smaller than JSON, and the contract is enforced centrally
  rather than by convention.`,
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'Wiring it up in Spring',
          code: `
spring:
  kafka:
    properties:
      schema.registry.url: http://schema-registry:8081
      # Fail the PRODUCER at startup rather than writing bad messages
      auto.register.schemas: false        # register via CI, not at runtime
      use.latest.version: true
    producer:
      value-serializer: io.confluent.kafka.serializers.KafkaAvroSerializer
    consumer:
      value-deserializer: io.confluent.kafka.serializers.KafkaAvroDeserializer
      properties:
        specific.avro.reader: true`,
        },
        {
          t: 'key',
          title: 'Register schemas in CI, not at runtime',
          text: 'With `auto.register.schemas=true`, a developer’s laptop can register an incompatible schema and break production. Registering as a build step means the compatibility check fails the **pull request** — which is exactly where you want to find out.',
        },
        {
          t: 'table',
          head: ['Format', 'Size', 'Schema enforced?', 'Notes'],
          rows: [
            ['**JSON**', 'Large', 'By convention only', 'Readable, easy, no safety net'],
            ['**Avro**', 'Small', '**Yes**, via the registry', 'The Kafka default; rich evolution rules'],
            ['**Protobuf**', 'Small', '**Yes**', 'Great tooling, field numbers make evolution explicit'],
            ['**JSON Schema**', 'Large', '**Yes**', 'Readability with enforcement'],
          ],
        },
      ],
    },
    {
      id: 'practice',
      title: 'Evolving a schema in practice',
      blocks: [
        {
          t: 'ascii',
          caption: 'Adding a field, then removing one — the order of deployment matters.',
          code: `
  ADDING an optional field  (BACKWARD compatible)
    1. add the field with a default to the schema
    2. deploy PRODUCERS first — they start writing it
    3. deploy consumers whenever — old ones simply ignore it
    Old consumers reading new messages: fine, the field is unknown.


  REMOVING a field  (BACKWARD compatible)
    1. deploy CONSUMERS first — stop reading the field
    2. verify nothing reads it (grep, and check the registry's
       list of registered consumer schemas)
    3. remove it from the producer's schema
    4. WAIT for retention to pass before reusing the name
    New consumers reading old messages: fine, they ignore the extra.


  RENAMING a field  — there is no safe rename
    1. add the new field, write BOTH for a full retention period
    2. move consumers to the new field, one at a time
    3. remove the old field
    Three deploys, spread over days. There is no shortcut.`,
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'Defensive consumers survive changes you did not plan for',
          code: `
// 1. Never fail on an unknown field
@JsonIgnoreProperties(ignoreUnknown = true)     // Jackson
public record OrderPlaced(Long orderId, BigDecimal total) { }

// 2. Always have an UNKNOWN enum member, from day one
public enum OrderStatus {
    PENDING, CONFIRMED, SHIPPED, CANCELLED,
    UNKNOWN;                                     // for values added later

    @JsonCreator
    public static OrderStatus from(String value) {
        return Arrays.stream(values())
                .filter(s -> s.name().equalsIgnoreCase(value))
                .findFirst()
                .orElse(UNKNOWN);                // never throw
    }
}

// 3. Treat a schema version header as information, not as a gate
//    — refusing to process an unexpected version just moves the
//    outage from "deserialization error" to "everything rejected".`,
        },
        {
          t: 'warn',
          title: 'Enums are the most common silent break',
          text: 'Adding `REFUNDED` to a status enum is backward compatible at the schema level and still breaks every consumer that deserializes into a Java enum without an `UNKNOWN` fallback. They throw on the first message carrying the new value. Add the fallback before you need it, because retrofitting it requires deploying every consumer first.',
        },
      ],
    },
  ],

  patterns: [
    {
      id: 'registry-in-ci',
      name: 'Enforce Compatibility in CI',
      oneLiner: 'The build should fail, not production.',
      useWhen: ['Any topic consumed by a team other than yours.'],
      recognize: ['`auto.register.schemas=true`.', 'Compatibility discovered at runtime.'],
      steps: [
        'Set the subject compatibility to `FULL` or `BACKWARD_TRANSITIVE`.',
        'Disable auto-registration in the application.',
        'Add a CI step that tests the new schema against the registered ones.',
      ],
      template: {
        lang: 'java',
        caption: 'The Maven plugin fails the build on an incompatible change',
        code: `
mvn io.confluent:kafka-schema-registry-maven-plugin:test-compatibility

# Or via the REST API, in a pipeline step:
curl -X POST \\
  http://schema-registry:8081/compatibility/subjects/orders-value/versions/latest \\
  -H "Content-Type: application/vnd.schemaregistry.v1+json" \\
  -d @schema.json
# { "is_compatible": false }   →  exit 1, fail the pull request`,
      },
      complexity: 'One CI step; moves a production outage to a red build.',
      gotchas: [
        'Set compatibility per subject — the global default is easy to forget.',
        'Use `_TRANSITIVE` for compacted or long-retention topics, since you must read every historical version.',
      ],
      problems: ['Fail a build with a breaking change', 'Compare BACKWARD and FULL'],
    },
    {
      id: 'tolerant-reader',
      name: 'Tolerant Reader',
      oneLiner: 'Ignore what you do not recognise instead of refusing to work.',
      useWhen: ['Every consumer.'],
      recognize: ['Consumers failing when the producer adds a field.', 'Enum deserialization exceptions after a producer deploy.'],
      steps: ['Ignore unknown fields.', 'Give every enum an `UNKNOWN` member with a fallback.', 'Read only the fields you need.'],
      complexity: 'A couple of annotations; removes a whole class of outage.',
      gotchas: [
        'Tolerance is not blindness — validate the fields you *do* use.',
        'Unknown enum values should be counted in a metric, so you notice the producer changed.',
      ],
      problems: ['Break a consumer with a new enum value', 'Fix it with UNKNOWN'],
    },
    {
      id: 'expand-contract',
      name: 'Expand and Contract',
      oneLiner: 'There is no safe rename — add, migrate, then remove.',
      useWhen: ['Renaming a field, changing a type, restructuring a payload.'],
      recognize: ['A pull request that renames an event field in one commit.'],
      steps: [
        'Expand: add the new field, write both.',
        'Migrate: move consumers to the new field one at a time.',
        'Wait: at least a full retention period.',
        'Contract: remove the old field.',
      ],
      complexity: 'Three deploys over days, instead of one outage.',
      gotchas: [
        'Do not skip the wait — messages with only the old field are still in the log.',
        'Never reuse a removed field name with a different meaning; a replay would misinterpret it.',
      ],
      problems: ['Rename a field safely', 'Break it by skipping the wait'],
    },
  ],

  pitfalls: [
    { title: 'Renaming a field', text: 'Breaks every consumer at once and cannot be rolled back — the messages are already written.' },
    { title: 'Adding a required field', text: 'New code cannot read old messages, which are still in the log.' },
    { title: 'Changing a field type', text: 'Never compatible. Add a new field instead.' },
    { title: 'Adding an enum value with no UNKNOWN fallback', text: 'Every existing consumer throws on the first new message.' },
    { title: 'auto.register.schemas in production', text: 'Any process can register an incompatible schema.' },
    { title: 'NONE compatibility', text: 'The registry becomes a filing cabinet with no safety.' },
    { title: 'Non-transitive modes on compacted topics', text: 'You must be able to read every version ever written, not just the previous one.' },
    { title: 'Consumers that reject unknown fields', text: 'A producer adding a field takes them all down.' },
    { title: 'Reusing a removed field name', text: 'A replay of old messages silently misinterprets it.' },
  ],

  cheatsheet: [
    { label: 'An event schema is', value: 'a public API, forever' },
    { label: 'Must satisfy', value: 'old code + new msgs AND new code + old msgs' },
    { label: 'Default mode', value: 'BACKWARD' },
    { label: 'Safest mode', value: 'FULL' },
    { label: 'Long retention', value: 'use _TRANSITIVE' },
    { label: 'Safe change', value: 'add an optional field with a default' },
    { label: 'Safe change', value: 'remove a field (consumers first)' },
    { label: 'Never safe', value: 'rename, retype, add required' },
    { label: 'Rename =', value: 'expand, migrate, wait, contract' },
    { label: 'Enums', value: 'always have UNKNOWN' },
    { label: 'Consumers', value: 'ignore unknown fields' },
    { label: 'Register schemas', value: 'in CI, not at runtime' },
    { label: 'Wire format', value: 'magic byte + schema id + payload' },
    { label: 'Add field', value: 'producers deploy first' },
    { label: 'Remove field', value: 'consumers deploy first' },
  ],

  problems: [
    { name: 'Break a consumer by renaming a field', difficulty: 'Easy', pattern: 'Breaking changes', insight: 'Rename total to amount and watch every consumer fail. Note that you cannot fix it by reverting — the messages are written.' },
    { name: 'Add an optional field safely', difficulty: 'Easy', pattern: 'Evolution', insight: 'Add a field with a default, deploy the producer first, and confirm old consumers keep working untouched.' },
    { name: 'Break consumers with a new enum value', difficulty: 'Medium', pattern: 'Enums', insight: 'Add REFUNDED to the status enum and watch existing consumers throw on the first message carrying it.' },
    { name: 'Fix it with an UNKNOWN member', difficulty: 'Medium', pattern: 'Tolerant reader', insight: 'Add a fallback and a metric. Unknown values now degrade gracefully and you can see them happening.' },
    { name: 'Run a schema registry', difficulty: 'Medium', pattern: 'Registry', insight: 'Start Confluent Schema Registry in Docker, produce with Avro, and inspect the registered subject and versions.' },
    { name: 'Fail a build on an incompatible schema', difficulty: 'Medium', pattern: 'CI enforcement', insight: 'Set BACKWARD, attempt a rename, and confirm the compatibility check rejects it before anything is published.' },
    { name: 'Compare BACKWARD and FULL', difficulty: 'Medium', pattern: 'Modes', insight: 'Find a change BACKWARD accepts and FULL rejects, and explain which consumer it would have broken.' },
    { name: 'Rename a field safely', difficulty: 'Hard', pattern: 'Expand-contract', insight: 'Three deploys: add both, migrate consumers, remove the old. Verify at every stage that both old and new messages are readable.' },
    { name: 'Break it by skipping the wait', difficulty: 'Hard', pattern: 'Retention', insight: 'Remove the old field immediately, then replay messages from before the change. The consumer sees nothing where the value should be.' },
    { name: 'Measure Avro against JSON', difficulty: 'Medium', pattern: 'Formats', insight: 'Produce identical data in both and compare on-disk segment size. Avro is typically a fraction of the size.' },
  ],
}
