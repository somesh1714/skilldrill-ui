export default {
  id: 'rest-apis',
  title: 'Building REST APIs',
  short: 'REST APIs',
  icon: 'ApiRounded',
  tier: 'Advanced',
  order: 14,
  estHours: 7,
  prereqs: ['spring-ioc', 'exceptions'],
  tagline: 'An API is a contract. Design it for the client, then make it impossible to break accidentally.',
  mentalModel:
    'A REST endpoint has four jobs and no more: accept a request, validate it, delegate to a service, and map the result to a response. Anything else — business rules, transactions, database access — belongs behind it. A controller that is longer than fifteen lines is usually doing somebody else’s job.',
  whyItMatters:
    'The API is the part of your service other teams actually see. Status codes, error shapes and DTO boundaries are decisions you live with for years, because changing them breaks other people’s code.',

  reference: {
    title: 'Status codes that actually matter',
    head: ['Code', 'Meaning', 'Use it when'],
    rows: [
      ['**200** OK', 'Success with a body', 'GET, PUT, and PATCH that return the resource'],
      ['**201** Created', 'A new resource exists', 'POST that creates — include a `Location` header'],
      ['**204** No Content', 'Success, nothing to return', 'DELETE, or PUT with no response body'],
      ['**400** Bad Request', 'Malformed or invalid input', 'Validation failure, unparseable JSON'],
      ['**401** Unauthorized', 'Not authenticated', 'Missing or invalid credentials'],
      ['**403** Forbidden', 'Authenticated, not allowed', 'Valid token, insufficient permission'],
      ['**404** Not Found', 'No such resource', 'Unknown id — also to hide existence from unauthorised users'],
      ['**409** Conflict', 'State conflict', 'Duplicate key, optimistic-lock failure'],
      ['**422** Unprocessable', 'Well-formed but semantically wrong', 'Business rule violated'],
      ['**429** Too Many Requests', 'Rate limited', 'Include `Retry-After`'],
      ['**500** Server Error', 'You broke', 'Never for a client mistake'],
      ['**503** Unavailable', 'Temporarily down', 'Dependency failure, shedding load'],
    ],
  },

  sections: [
    {
      id: 'shape',
      title: 'Designing the URLs',
      blocks: [
        {
          t: 'compare',
          left: {
            title: 'Resource-oriented — do this',
            items: [
              '`GET /orders` — a collection',
              '`GET /orders/42` — one item',
              '`POST /orders` — create',
              '`PUT /orders/42` — replace',
              '`PATCH /orders/42` — partial update',
              '`DELETE /orders/42`',
              '`GET /orders/42/items` — a sub-collection',
            ],
          },
          right: {
            title: 'RPC-in-a-URL — avoid',
            items: [
              '`GET /getOrder?id=42`',
              '`POST /createOrder`',
              '`POST /orders/42/doUpdate`',
              '`GET /orders/delete/42` — a GET that mutates!',
            ],
          },
        },
        {
          t: 'dl',
          items: [
            { term: 'Nouns, plural', def: '`/orders`, not `/order` or `/getOrders`. The HTTP method is the verb.' },
            { term: 'Safe', def: 'GET, HEAD and OPTIONS never change anything. Browsers, proxies and crawlers rely on this.' },
            { term: 'Idempotent', def: 'The same request twice has the same effect as once. GET, PUT and DELETE are; POST is not, which matters for retries.' },
            { term: 'Nest one level', def: '`/orders/42/items` is fine. `/customers/1/orders/42/items/7/tags` is a URL nobody can use — expose `/items/7/tags` instead.' },
          ],
        },
        {
          t: 'key',
          title: 'POST is not idempotent, so clients will double-charge you',
          text: 'Network retries mean the same POST can arrive twice. If the operation has real consequences — a payment, an order — accept an `Idempotency-Key` header, store it with the result, and return the original response on a repeat. This is how payment APIs work, and it is worth doing before you need it.',
        },
      ],
    },
    {
      id: 'controllers',
      title: 'Controllers that stay thin',
      blocks: [
        {
          t: 'code',
          lang: 'java',
          caption: 'Everything a controller should contain',
          code: `
@RestController
@RequestMapping("/api/v1/orders")
public class OrderController {

    private final OrderService service;

    public OrderController(OrderService service) { this.service = service; }

    @GetMapping("/{id}")
    public OrderDto get(@PathVariable Long id) {
        return OrderDto.from(service.findById(id));      // throws -> handled centrally
    }

    @GetMapping
    public Page<OrderDto> list(@RequestParam(defaultValue = "0") int page,
                               @RequestParam(defaultValue = "20") int size,
                               @RequestParam(required = false) OrderStatus status) {
        return service.find(status, PageRequest.of(page, Math.min(size, 100)))
                      .map(OrderDto::from);              // cap the page size
    }

    @PostMapping
    public ResponseEntity<OrderDto> create(@Valid @RequestBody CreateOrderRequest req) {
        Order created = service.place(req.toCommand());
        URI location = ServletUriComponentsBuilder.fromCurrentRequest()
                .path("/{id}").buildAndExpand(created.id()).toUri();
        return ResponseEntity.created(location).body(OrderDto.from(created));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void cancel(@PathVariable Long id) { service.cancel(id); }
}`,
        },
        {
          t: 'key',
          title: 'No try/catch, no business logic, no entities',
          text: 'Errors go to a `@RestControllerAdvice`. Rules live in the service. The web layer only translates between HTTP and your domain. If you find yourself writing an `if` about money in a controller, it is in the wrong place.',
        },
        {
          t: 'warn',
          title: 'Always cap the page size',
          text: '`?size=1000000` will happily try to load a million rows. Clamp it server-side. This is one of the most common ways a public API gets accidentally denial-of-serviced.',
        },
      ],
    },
    {
      id: 'dtos',
      title: 'Never expose your entities',
      blocks: [
        { t: 'p', text: 'Returning a JPA entity from a controller couples your API to your database schema, leaks fields you did not mean to publish, and triggers lazy-loading exceptions during serialisation. Use dedicated request and response types.' },
        {
          t: 'code',
          lang: 'java',
          caption: 'Separate types for in and out',
          code: `
// INBOUND — only what a client may set. No id, no createdAt, no status.
public record CreateOrderRequest(
        @NotNull Long customerId,
        @NotEmpty @Size(max = 50) List<@Valid ItemRequest> items,
        @Size(max = 500) String note) {

    public record ItemRequest(@NotNull Long productId, @Min(1) int quantity) { }
}

// OUTBOUND — exactly what you promise to return
public record OrderDto(Long id, String status, BigDecimal total, Instant placedAt) {
    public static OrderDto from(Order o) {
        return new OrderDto(o.getId(), o.getStatus().name(), o.getTotal(), o.getPlacedAt());
    }
}`,
        },
        {
          t: 'trap',
          title: 'The three concrete dangers of returning entities',
          text: '**(1)** A `passwordHash` field you forgot about is now in your API. **(2)** Jackson touches a lazy association outside the transaction and you get `LazyInitializationException` — or worse, it silently issues dozens of queries. **(3)** Renaming a column becomes a breaking API change.',
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'Useful Jackson settings',
          code: `
spring:
  jackson:
    default-property-inclusion: non_null    # omit nulls instead of "field": null
    deserialization:
      fail-on-unknown-properties: false     # tolerate new client fields
    serialization:
      write-dates-as-timestamps: false      # ISO-8601 strings, not epoch millis

// Per-field control
public record UserDto(
        Long id,
        String email,
        @JsonIgnore String internalNote,                   // never serialised
        @JsonFormat(pattern = "yyyy-MM-dd") LocalDate joined,
        @JsonProperty("full_name") String fullName) { }`,
        },
      ],
    },
    {
      id: 'validation',
      title: 'Validation at the edge',
      blocks: [
        {
          t: 'code',
          lang: 'java',
          caption: 'Declarative validation, triggered by @Valid',
          code: `
public record CreateUserRequest(
        @NotBlank(message = "email is required")
        @Email String email,

        @NotBlank
        @Size(min = 8, max = 72, message = "password must be 8-72 characters")
        String password,

        @Min(18) @Max(120) int age,

        @Pattern(regexp = "^\\\\+?[0-9]{10,15}$", message = "invalid phone number")
        String phone,

        @NotNull @Future LocalDate startDate,

        @Valid Address address) { }         // @Valid cascades into nested objects

@PostMapping
public UserDto create(@Valid @RequestBody CreateUserRequest req) { }
// A failure throws MethodArgumentNotValidException before your method runs.`,
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'Turning validation failures into a useful response',
          code: `
@RestControllerAdvice
public class ValidationHandler {

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ProblemDetail onInvalid(MethodArgumentNotValidException e) {
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(
                HttpStatus.BAD_REQUEST, "Request validation failed");

        Map<String, String> errors = e.getBindingResult().getFieldErrors().stream()
                .collect(toMap(FieldError::getField,
                               f -> f.getDefaultMessage(),
                               (a, b) -> a));
        pd.setProperty("errors", errors);     // {"email": "must be a valid email"}
        return pd;
    }
}`,
        },
        {
          t: 'key',
          title: 'Return every error, not the first',
          text: 'A client filling in a form wants all the problems at once. Bean validation collects them all — make sure your handler returns the full map rather than stopping at the first failure.',
        },
        {
          t: 'note',
          title: 'Validate the shape at the edge, the rules in the service',
          text: '"Email must look like an email" is a shape check and belongs on the DTO. "This email is already registered" is a business rule and belongs in the service, where it becomes a 409. Do not try to express the second with annotations.',
        },
      ],
    },
    {
      id: 'evolution',
      title: 'Versioning and evolving an API',
      blocks: [
        {
          t: 'ul',
          items: [
            '**Adding** an optional field is backward compatible. Adding a required one is not.',
            '**Removing or renaming** a field breaks every client. Deprecate first, remove much later.',
            '**Changing a type** (`"5"` to `5`, or a string to an object) is always breaking.',
            '**Changing a status code** or an error shape breaks clients that branch on it.',
          ],
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'URL versioning — ugly, explicit, and the one most teams should use',
          code: `
@RequestMapping("/api/v1/orders")      // visible in logs, easy to route, trivially cached
@RequestMapping("/api/v2/orders")

// The alternatives:
// - Header versioning (Accept: application/vnd.acme.v2+json) — pure, but
//   invisible in logs and awkward to test from a browser or curl.
// - Query parameter (?version=2) — easy, but tends to be forgotten.`,
        },
        {
          t: 'tip',
          title: 'Version the whole API, not each endpoint',
          text: 'Per-endpoint versions produce combinations nobody can reason about. Keep one version for the surface, add v2 only for genuinely breaking changes, and run v1 and v2 side by side until clients migrate.',
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'Document it from the code, so it cannot drift',
          code: `
// springdoc-openapi generates OpenAPI from your controllers and DTOs
implementation 'org.springdoc:springdoc-openapi-starter-webmvc-ui'

@Operation(summary = "Place a new order")
@ApiResponse(responseCode = "201", description = "Order created")
@ApiResponse(responseCode = "422", description = "Business rule violated")
@PostMapping
public ResponseEntity<OrderDto> create(@Valid @RequestBody CreateOrderRequest req) { }

// Swagger UI at /swagger-ui.html, the spec at /v3/api-docs`,
        },
      ],
    },
  ],

  patterns: [
    {
      id: 'thin-controller',
      name: 'Thin Controller, Rich Service',
      oneLiner: 'Accept, validate, delegate, map. Nothing else.',
      useWhen: ['Every endpoint.'],
      recognize: ['Business logic, `try/catch` or repository calls inside a controller.'],
      steps: [
        'Move rules into a service method that takes a domain command.',
        'Let exceptions propagate to a central handler.',
        'Map entity to DTO at the boundary.',
      ],
      complexity: 'Structural; makes the service unit-testable with no web layer.',
      gotchas: [
        'The controller should not know about transactions — those belong on the service.',
        'Do not let DTOs leak into the service; convert at the edge.',
      ],
      problems: ['Refactor a fat controller', 'Test a service with no MockMvc'],
    },
    {
      id: 'dto-boundary',
      name: 'DTOs at the Boundary',
      oneLiner: 'Separate types for request, response and persistence.',
      useWhen: ['Always. The one entity-as-DTO shortcut you take will be the one that leaks a password hash.'],
      recognize: ['`@Entity` classes appearing in controller signatures.', '`LazyInitializationException` during JSON serialisation.'],
      steps: ['Define a request record with only client-settable fields.', 'Define a response record with only what you promise.', 'Map with a static factory or MapStruct.'],
      template: {
        lang: 'java',
        caption: 'Mapping in one place, testable on its own',
        code: `
public record OrderDto(Long id, String status, BigDecimal total) {
    public static OrderDto from(Order o) {
        return new OrderDto(o.getId(), o.getStatus().name(), o.getTotal());
    }
}
// For large projects, MapStruct generates these at compile time:
@Mapper(componentModel = "spring")
public interface OrderMapper { OrderDto toDto(Order order); }`,
      },
      complexity: 'One small object per response.',
      gotchas: [
        'Never reuse one DTO for both request and response — they always diverge.',
        'Map inside the transaction if the entity has lazy associations you need.',
      ],
      problems: ['Find a field leaking through an entity', 'Trigger LazyInitializationException in serialisation'],
    },
    {
      id: 'idempotency-key',
      name: 'Idempotency Keys for Unsafe Operations',
      oneLiner: 'Make a retried POST safe by remembering what you already did.',
      useWhen: ['Payments, orders, anything a client may retry after a timeout.'],
      recognize: ['Duplicate records created when the network is flaky.'],
      steps: [
        'Require an `Idempotency-Key` header on the operation.',
        'On arrival, try to insert the key — if it already exists, return the stored response.',
        'Store the response and expire keys after a sensible window.',
      ],
      template: {
        lang: 'java',
        caption: 'The unique constraint does the hard work',
        code: `
@PostMapping
public ResponseEntity<OrderDto> create(
        @RequestHeader("Idempotency-Key") String key,
        @Valid @RequestBody CreateOrderRequest req) {

    Optional<StoredResponse> existing = idempotency.find(key);
    if (existing.isPresent())                          // a retry
        return existing.get().toResponseEntity();

    Order order = service.place(req.toCommand());
    idempotency.store(key, order, Duration.ofHours(24));
    return ResponseEntity.created(location(order)).body(OrderDto.from(order));
}`,
      },
      complexity: 'One extra lookup and insert per request.',
      gotchas: [
        'The key must be stored in the *same transaction* as the work, or a crash between them lets a duplicate through.',
        'Two concurrent requests with the same key must not both proceed — rely on a unique constraint, not a check-then-act.',
      ],
      problems: ['Add idempotency to a POST', 'Prove concurrent duplicates are rejected'],
    },
  ],

  pitfalls: [
    { title: 'Returning entities from controllers', text: 'Leaks fields, couples the API to the schema, and causes lazy-loading failures during serialisation.' },
    { title: '200 OK for everything', text: 'Clients cannot branch on the outcome. Use 201, 204, 4xx and 5xx properly.' },
    { title: '500 for a client mistake', text: 'A validation failure is a 400. A 5xx means *you* broke, and it triggers alerts and retries.' },
    { title: 'Business logic in the controller', text: 'Untestable without the web layer and impossible to reuse.' },
    { title: 'Unbounded page size', text: '`?size=1000000` will try. Clamp it.' },
    { title: 'GET that mutates', text: 'Breaks caching and retries, and crawlers will find it.' },
    { title: 'Stack traces in error responses', text: 'Information disclosure and useless to the caller.' },
    { title: 'No idempotency on payments', text: 'A client retry after a timeout charges twice.' },
    { title: 'Breaking changes without a version', text: 'Every client breaks at once, usually silently.' },
  ],

  cheatsheet: [
    { label: 'Created', value: '201 + Location header' },
    { label: 'Deleted', value: '204, no body' },
    { label: 'Validation failed', value: '400 with a field map' },
    { label: 'Business rule failed', value: '422' },
    { label: 'Duplicate / conflict', value: '409' },
    { label: 'Not authenticated', value: '401' },
    { label: 'Not permitted', value: '403' },
    { label: 'Error body', value: 'ProblemDetail (RFC 7807)' },
    { label: 'URLs', value: 'plural nouns, method is the verb' },
    { label: 'Idempotent', value: 'GET, PUT, DELETE — not POST' },
    { label: 'Validation', value: '@Valid @RequestBody' },
    { label: 'Nested validation', value: '@Valid on the field' },
    { label: 'Never return', value: 'JPA entities' },
    { label: 'Always cap', value: 'page size' },
    { label: 'Versioning', value: '/api/v1 — whole API, not per endpoint' },
  ],

  problems: [
    { name: 'Return the right status codes', difficulty: 'Easy', pattern: 'HTTP semantics', insight: 'Build CRUD for one resource: 201 with Location on create, 204 on delete, 404 on a missing id. Verify each with curl -i.' },
    { name: 'Leak a field through an entity', difficulty: 'Easy', pattern: 'DTO boundary', insight: 'Return a User entity containing passwordHash and look at the JSON. Then add a DTO and confirm it is gone.' },
    { name: 'Validate a request body', difficulty: 'Easy', pattern: 'Validation', insight: 'Add @Valid and constraints, post invalid JSON, and confirm the method never runs.' },
    { name: 'Return every validation error', difficulty: 'Medium', pattern: 'Error shape', insight: 'Handle MethodArgumentNotValidException and return a field-to-message map instead of just the first failure.' },
    { name: 'Trigger LazyInitializationException', difficulty: 'Medium', pattern: 'DTO boundary', insight: 'Return an entity with a lazy collection and open-in-view disabled. Jackson fails mid-serialisation, producing a half-written response.' },
    { name: 'Cap the page size', difficulty: 'Medium', pattern: 'Defensive API', insight: 'Request size=1000000, watch the query, then clamp with Math.min and confirm the limit holds.' },
    { name: 'Add idempotency to a POST', difficulty: 'Hard', pattern: 'Idempotency', insight: 'Store the key with a unique constraint in the same transaction. Send the same key twice and confirm one record and two identical responses.' },
    { name: 'Prove concurrent duplicates are rejected', difficulty: 'Hard', pattern: 'Idempotency', insight: 'Fire two identical requests simultaneously. Only one insert should succeed; the other must return the stored response, not an error.' },
    { name: 'Make a backward-compatible change', difficulty: 'Medium', pattern: 'Evolution', insight: 'Add an optional field and verify an old client still works. Then make it required and watch that client break.' },
    { name: 'Generate OpenAPI docs', difficulty: 'Medium', pattern: 'Documentation', insight: 'Add springdoc, annotate the responses, and check that /v3/api-docs reflects the DTOs exactly.' },
  ],
}
