export default {
  id: 'spring-boot-config',
  title: 'Spring Boot: Auto-Configuration, Properties & Profiles',
  short: 'Boot & Config',
  icon: 'SettingsRounded',
  tier: 'Advanced',
  order: 13,
  estHours: 6,
  prereqs: ['spring-ioc'],
  tagline: 'Boot guesses what you want. Learn how it guesses and you can always override it.',
  mentalModel:
    'Spring Boot is Spring plus a large pile of conditional configuration. Each auto-configuration class says "if this class is on the classpath, and the user has not defined their own bean, create one". That is the whole trick — and `@ConditionalOnMissingBean` is why defining your own bean always wins.',
  whyItMatters:
    'Boot’s defaults are good, but they are defaults. Every real service needs to override some of them, and configuration mistakes — a secret in a properties file, a profile that does not activate, a timeout left at infinity — cause outages as reliably as code bugs.',

  reference: {
    title: 'Where configuration comes from (later wins)',
    head: ['#', 'Source', 'Typical use'],
    rows: [
      ['1', 'Default properties in code', 'Library defaults'],
      ['2', '`application.yml` in the jar', 'Your baseline'],
      ['3', '`application-{profile}.yml`', 'Per-environment overrides'],
      ['4', 'External `application.yml` beside the jar', 'Ops-managed settings'],
      ['5', 'OS environment variables', '**Secrets and container config**'],
      ['6', 'Java system properties (`-D`)', 'JVM-level overrides'],
      ['7', 'Command-line arguments', 'One-off runs and debugging'],
    ],
  },

  sections: [
    {
      id: 'autoconfig',
      title: 'How auto-configuration really works',
      blocks: [
        { t: 'p', text: '`@SpringBootApplication` is three annotations in one: `@SpringBootConfiguration`, `@ComponentScan` (your package downwards) and `@EnableAutoConfiguration`. The last one loads a list of configuration classes shipped inside the starter jars, and each one is guarded by conditions.' },
        {
          t: 'code',
          lang: 'java',
          caption: 'A simplified version of what Boot ships',
          code: `
@AutoConfiguration
@ConditionalOnClass(DataSource.class)               // only if JDBC is on the classpath
@ConditionalOnProperty(prefix = "spring.datasource", name = "url")
@EnableConfigurationProperties(DataSourceProperties.class)
public class DataSourceAutoConfiguration {

    @Bean
    @ConditionalOnMissingBean                        // ← YOU always win
    public DataSource dataSource(DataSourceProperties props) {
        return props.initializeDataSourceBuilder().build();
    }
}`,
        },
        {
          t: 'key',
          title: '@ConditionalOnMissingBean is why overriding just works',
          text: 'You never have to disable Boot’s bean. Define your own `DataSource` bean and Boot’s condition fails, so it quietly steps aside. This is the single most useful thing to understand about Boot.',
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'See exactly what Boot decided, and why',
          code: `
// Run with this and Boot prints a full report at startup:
--debug

// POSITIVE MATCHES: which auto-configurations applied, and the condition that matched
// NEGATIVE MATCHES: which did not, and precisely why (missing class, bean already defined)

// Or expose it as an endpoint:
management.endpoints.web.exposure.include=conditions
// GET /actuator/conditions`,
        },
        {
          t: 'note',
          title: 'Turning one off',
          text: 'If you genuinely need to exclude an auto-configuration: `@SpringBootApplication(exclude = SecurityAutoConfiguration.class)`, or `spring.autoconfigure.exclude` in properties. Needing this is rare — usually defining your own bean is the better answer.',
        },
      ],
    },
    {
      id: 'properties',
      title: 'Typed configuration with @ConfigurationProperties',
      blocks: [
        {
          t: 'compare',
          left: {
            title: '@ConfigurationProperties — use this',
            items: [
              'One typed, validated object',
              'Fails at startup if something is missing or malformed',
              'IDE autocomplete and documentation',
              'Trivial to inject and to test',
              'Supports nested objects, lists and maps',
            ],
          },
          right: {
            title: '@Value — for one-offs only',
            items: [
              'A string scattered across many classes',
              'Typos fail at runtime, not startup',
              'No validation',
              'Cannot express structure',
            ],
          },
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'A record-based, validated properties class',
          code: `
@ConfigurationProperties(prefix = "payment")
@Validated
public record PaymentProperties(
        @NotBlank String baseUrl,
        @NotNull Duration timeout,               // "5s" and "500ms" parse automatically
        @Min(1) @Max(10) int maxRetries,
        Map<String, String> headers,
        Gateway gateway) {

    public record Gateway(@NotBlank String apiKey, boolean sandbox) { }
}

@EnableConfigurationProperties(PaymentProperties.class)
@Configuration
class PaymentConfig { }`,
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'The YAML that binds to it',
          code: `
payment:
  base-url: https://api.example.com      # relaxed binding: baseUrl, base_url, BASE_URL
  timeout: 5s
  max-retries: 3
  headers:
    X-Client: orders-service
  gateway:
    api-key: \${PAYMENT_API_KEY}          # from the environment — never hard-coded
    sandbox: false`,
        },
        {
          t: 'key',
          title: 'Validation at startup beats a NullPointerException at 3am',
          text: 'With `@Validated`, a missing or malformed value stops the application from starting, with a message naming the property. Without it, you discover the problem on the first request that needs it — often days later.',
        },
      ],
    },
    {
      id: 'profiles',
      title: 'Profiles and environments',
      blocks: [
        {
          t: 'code',
          lang: 'java',
          caption: 'Profile-specific files layer on top of the base file',
          code: `
# application.yml — shared baseline
spring:
  application:
    name: orders-service
logging:
  level:
    root: INFO

---
# application-local.yml
spring:
  config:
    activate:
      on-profile: local
logging:
  level:
    com.acme: DEBUG
    org.hibernate.SQL: DEBUG

---
# application-prod.yml
spring:
  config:
    activate:
      on-profile: prod
  datasource:
    hikari:
      maximum-pool-size: 20`,
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'Profile-conditional beans',
          code: `
@Configuration
public class NotificationConfig {

    @Bean
    @Profile("!prod")                        // everything except prod
    NotificationSender loggingSender() { return new LoggingSender(); }

    @Bean
    @Profile("prod")
    NotificationSender smsSender(SmsProperties props) { return new SmsSender(props); }
}`,
        },
        {
          t: 'warn',
          title: 'Do not use profiles for secrets, and beware profile sprawl',
          text: 'Secrets belong in environment variables or a secret manager, never in a profile file that lives in git. And once you have `prod`, `prod-eu`, `prod-eu-canary`, the combinations become impossible to reason about — prefer a small number of profiles plus environment variables for the differences.',
        },
        {
          t: 'tip',
          title: 'Activating profiles',
          text: '`SPRING_PROFILES_ACTIVE=prod` as an environment variable is the container-friendly way. `--spring.profiles.active=local` works for local runs, and `@ActiveProfiles("test")` in tests. If a profile silently fails to apply, check for a typo — Boot does not warn about unknown profile names.',
        },
      ],
    },
    {
      id: 'production',
      title: 'The settings every service should set',
      blocks: [
        {
          t: 'code',
          lang: 'java',
          caption: 'Boot defaults that are wrong for production',
          code: `
spring:
  # There is NO default HTTP client timeout. Infinite waits are how
  # one slow dependency takes down your whole service.
  datasource:
    hikari:
      maximum-pool-size: 20        # default 10 — size it against your DB
      connection-timeout: 3000     # fail fast rather than queueing
      leak-detection-threshold: 20000
  jpa:
    open-in-view: false            # default TRUE and almost always wrong
                                   # (see the JPA chapter — it holds a
                                   #  connection for the whole request)

server:
  shutdown: graceful               # default IMMEDIATE — drops in-flight requests
  tomcat:
    threads:
      max: 200

spring.lifecycle.timeout-per-shutdown-phase: 30s

management:
  endpoints:
    web:
      exposure:
        include: health,info,metrics,prometheus   # never "*" in production
  endpoint:
    health:
      probes:
        enabled: true              # /readiness and /liveness for Kubernetes`,
        },
        {
          t: 'key',
          title: 'Three defaults worth changing on day one',
          text: '`spring.jpa.open-in-view=false`, `server.shutdown=graceful`, and an explicit timeout on every HTTP client you create. Those three alone prevent a surprising share of production incidents.',
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'Externalising secrets properly',
          code: `
# In the YAML — reference, never embed
spring:
  datasource:
    password: \${DB_PASSWORD}                  # fails at startup if unset
    username: \${DB_USER:app}                  # with a default after the colon

# Relaxed binding means an environment variable maps automatically:
#   spring.datasource.password  ->  SPRING_DATASOURCE_PASSWORD
# so you often need no placeholder at all in a container.`,
        },
        {
          t: 'warn',
          title: 'Never log the whole environment',
          text: '`/actuator/env` and `/actuator/configprops` expose configuration, and Boot only masks keys that look like secrets (`password`, `secret`, `key`, `token`). A value called `apiCredential` will be printed in full. Restrict those endpoints and review what they expose.',
        },
      ],
    },
  ],

  patterns: [
    {
      id: 'typed-properties',
      name: 'Typed, Validated Configuration Objects',
      oneLiner: 'Bind a prefix to a record, validate it, and inject the record.',
      useWhen: ['Any group of related settings.', 'Anything a deployment might change.'],
      recognize: ['`@Value` repeated across several classes.', 'A production incident caused by a mistyped property name.'],
      steps: [
        'Create a record annotated `@ConfigurationProperties(prefix = "...")`.',
        'Add `@Validated` and bean-validation annotations.',
        'Register it and inject the record where needed.',
      ],
      template: {
        lang: 'java',
        caption: 'One object, injected wherever it is needed',
        code: `
@ConfigurationProperties(prefix = "orders")
@Validated
public record OrderProperties(
        @Min(1) int maxItems,
        @NotNull Duration reservationWindow,
        @NotEmpty List<String> allowedCurrencies) { }

@Service
public class OrderService {
    private final OrderProperties props;
    public OrderService(OrderProperties props) { this.props = props; }
}`,
      },
      complexity: 'Bound once at startup.',
      gotchas: [
        'Records need constructor binding — automatic in Boot 3, but a class needs setters or `@ConstructorBinding` in Boot 2.',
        'Add `spring-boot-configuration-processor` to get IDE autocomplete for your own properties.',
      ],
      problems: ['Replace @Value with @ConfigurationProperties', 'Fail startup on a missing property'],
    },
    {
      id: 'conditional-beans',
      name: 'Conditional Beans',
      oneLiner: 'Ship several implementations and let configuration choose.',
      useWhen: ['A feature that is on in some environments, a stub in local development.'],
      recognize: ['`if (env.equals("prod"))` inside application code.'],
      steps: ['`@ConditionalOnProperty` for a feature toggle.', '`@Profile` for environment shape.', '`@ConditionalOnMissingBean` to supply a default others can override.'],
      template: {
        lang: 'java',
        caption: 'A toggle with a safe default',
        code: `
@Bean
@ConditionalOnProperty(name = "features.audit.enabled", havingValue = "true")
AuditPublisher kafkaAuditPublisher(KafkaTemplate<String, Audit> template) {
    return new KafkaAuditPublisher(template);
}

@Bean
@ConditionalOnMissingBean(AuditPublisher.class)     // fallback when disabled
AuditPublisher noopAuditPublisher() {
    return audit -> { };
}`,
      },
      complexity: 'Evaluated once at startup.',
      gotchas: [
        'Order matters: use `matchIfMissing` deliberately so a missing property has a defined meaning.',
        'Too many conditions makes startup behaviour hard to predict — check `/actuator/conditions`.',
      ],
      problems: ['Add a feature toggle with a no-op fallback', 'Read the conditions report'],
    },
    {
      id: 'env-for-secrets',
      name: 'Secrets From the Environment, Never the Repository',
      oneLiner: 'Configuration files describe shape; the environment supplies values.',
      useWhen: ['Any credential, API key, connection string or certificate.'],
      recognize: ['A password in `application.yml`.', '`application-prod.yml` committed to git.'],
      steps: [
        'Replace the value with `${VAR}` — with no default, so startup fails loudly if it is missing.',
        'Supply it from the orchestrator, a secret manager or a vault.',
        'Restrict `/actuator/env` and `/actuator/configprops`.',
      ],
      complexity: 'Free; entirely a discipline.',
      gotchas: [
        'A default (`${VAR:changeme}`) turns a missing secret into a silent misconfiguration. Omit it for secrets.',
        'Rotate anything that ever reached git history — deleting the file does not remove it from history.',
      ],
      problems: ['Move a secret out of application.yml', 'Verify actuator masking'],
    },
  ],

  pitfalls: [
    { title: 'Secrets in application.yml', text: 'They end up in git, in the image and in logs. Use environment variables.' },
    { title: 'Leaving spring.jpa.open-in-view=true', text: 'The default. It holds a database connection for the entire request and hides lazy-loading bugs.' },
    { title: 'No HTTP client timeout', text: 'Boot sets none. A hung dependency becomes a hung service.' },
    { title: 'Exposing all actuator endpoints', text: '`include: "*"` publishes env, beans, heapdump and more.' },
    { title: 'Typos in property names', text: '@Value fails at runtime; unknown keys are silently ignored. Typed properties catch this at startup.' },
    { title: 'Relying on a profile that never activates', text: 'Boot does not warn about unknown profiles. Log the active profiles at startup.' },
    { title: 'Immediate shutdown', text: 'In-flight requests are dropped during every deploy. Set graceful shutdown.' },
    { title: 'Scanning from a very broad base package', text: 'Pulls in unintended beans and slows startup.' },
  ],

  cheatsheet: [
    { label: '@SpringBootApplication', value: 'config + scan + auto-config' },
    { label: 'Override a Boot bean', value: 'just define your own' },
    { label: 'Why', value: '@ConditionalOnMissingBean' },
    { label: 'See decisions', value: '--debug or /actuator/conditions' },
    { label: 'Typed config', value: '@ConfigurationProperties + @Validated' },
    { label: 'Binding', value: 'relaxed: baseUrl = base-url = BASE_URL' },
    { label: 'Precedence', value: 'CLI > sysprops > env > files' },
    { label: 'Secrets', value: '${ENV_VAR}, no default' },
    { label: 'Activate profile', value: 'SPRING_PROFILES_ACTIVE' },
    { label: 'Durations', value: '"5s", "500ms" parse to Duration' },
    { label: 'Must set', value: 'open-in-view: false' },
    { label: 'Must set', value: 'server.shutdown: graceful' },
    { label: 'Must set', value: 'an HTTP client timeout' },
    { label: 'Actuator', value: 'expose only what you need' },
  ],

  problems: [
    { name: 'Read the auto-configuration report', difficulty: 'Easy', pattern: 'Auto-config', insight: 'Run with --debug and find three positive and three negative matches. For each negative, read the exact condition that failed.' },
    { name: 'Override a Boot-provided bean', difficulty: 'Easy', pattern: 'ConditionalOnMissingBean', insight: 'Define your own ObjectMapper bean and confirm from the conditions report that Boot backed off.' },
    { name: 'Bind typed properties', difficulty: 'Easy', pattern: 'Configuration', insight: 'Create a @ConfigurationProperties record with nested objects and a map, and inject it into a service.' },
    { name: 'Fail startup on bad configuration', difficulty: 'Medium', pattern: 'Validation', insight: 'Add @Validated and @NotBlank, remove the property, and read the startup failure message naming the exact key.' },
    { name: 'Prove property precedence', difficulty: 'Medium', pattern: 'Precedence', insight: 'Set the same property in application.yml, an environment variable and a command-line argument. Print it and confirm which wins.' },
    { name: 'Use a profile to swap an implementation', difficulty: 'Medium', pattern: 'Profiles', insight: 'A logging sender in local, a real one in prod. Verify with @ActiveProfiles in a test.' },
    { name: 'Catch a profile typo', difficulty: 'Medium', pattern: 'Profiles', insight: 'Activate "prd" instead of "prod". Nothing warns you. Add a startup log of Environment.getActiveProfiles() so it is visible.' },
    { name: 'Move a secret to the environment', difficulty: 'Medium', pattern: 'Secrets', insight: 'Replace a hard-coded password with ${DB_PASSWORD} with no default, and confirm startup fails cleanly when it is unset.' },
    { name: 'Check what actuator exposes', difficulty: 'Hard', pattern: 'Security', insight: 'Expose env and configprops, then find a custom property that is NOT masked because its name does not look secret-like.' },
    { name: 'Add a feature toggle with a fallback', difficulty: 'Medium', pattern: 'Conditional beans', insight: '@ConditionalOnProperty for the real implementation, @ConditionalOnMissingBean for a no-op. Flip the property and confirm which bean is active.' },
  ],
}
