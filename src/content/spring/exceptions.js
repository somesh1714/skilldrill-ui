export default {
  id: 'exceptions',
  title: 'Exceptions & Designing for Failure',
  short: 'Exceptions',
  icon: 'ReportProblemRounded',
  tier: 'Foundations',
  order: 5,
  estHours: 5,
  prereqs: ['jvm-memory'],
  tagline: 'An exception is a design decision about who is responsible for a failure.',
  mentalModel:
    'Ask one question: **can the caller do something useful about this?** If yes, it belongs in the method signature so they are forced to decide. If no — a bug, a misconfiguration, a dead database — it should travel up to a single place that logs it and returns a sensible error.',
  whyItMatters:
    'Bad exception handling is how debugging information disappears. A swallowed exception turns a five-minute fix into a two-day investigation, and `catch (Exception e) { e.printStackTrace(); }` is still the most common bug in Java codebases.',

  reference: {
    title: 'The hierarchy, and what you should do with each',
    head: ['Type', 'Examples', 'Checked?', 'What to do'],
    rows: [
      ['`Error`', '`OutOfMemoryError`, `StackOverflowError`', 'No', '**Never catch.** The JVM is broken; let it die'],
      ['`RuntimeException`', '`NullPointerException`, `IllegalArgumentException`', 'No', 'Usually a bug — fix the code, do not catch'],
      ['Checked `Exception`', '`IOException`, `SQLException`', 'Yes', 'Handle it, or wrap it in a domain exception'],
      ['Your domain exception', '`InsufficientFundsException`', 'Your choice', 'Unchecked, with enough context to act on'],
    ],
  },

  sections: [
    {
      id: 'hierarchy',
      title: 'Checked, unchecked and the argument about them',
      blocks: [
        {
          t: 'ascii',
          caption: 'Everything throwable, and where the checked/unchecked line falls.',
          code: `
                       Throwable
                      ╱         ╲
                Error             Exception
          (do not catch)         ╱         ╲
                       RuntimeException   IOException, SQLException…
                        (UNCHECKED)            (CHECKED)
                    NullPointerException
                    IllegalArgumentException
                    IllegalStateException`,
        },
        { t: 'p', text: 'A **checked** exception must be declared or caught — the compiler enforces it. An **unchecked** one can propagate silently. Java is the only mainstream language that kept checked exceptions, and modern practice has moved decisively toward unchecked ones for application code.' },
        {
          t: 'compare',
          left: {
            title: 'Why checked exceptions were a good idea',
            items: [
              'The signature documents what can fail',
              'The compiler forces the caller to decide',
              'Good for genuinely recoverable, expected failures',
            ],
          },
          right: {
            title: 'Why they mostly failed in practice',
            items: [
              'They leak through every layer of the call stack',
              'They break lambdas — streams cannot throw checked exceptions',
              'People swallow them to make the compiler quiet',
              'Most failures are not recoverable by the immediate caller anyway',
            ],
          },
        },
        {
          t: 'key',
          title: 'The practical rule',
          text: 'In application code, throw **unchecked** exceptions. Spring does this throughout — it translates `SQLException` into an unchecked `DataAccessException` precisely so it does not pollute every signature. Reserve checked exceptions for library APIs where the caller genuinely has a recovery strategy.',
        },
      ],
    },
    {
      id: 'antipatterns',
      title: 'The four ways people destroy debugging information',
      blocks: [
        {
          t: 'code',
          lang: 'java',
          caption: 'Each of these has cost somebody a weekend',
          code: `
// 1. SWALLOWING — the failure happened and you will never know
try { risky(); } catch (Exception e) { }

// 2. LOG AND CONTINUE — logs the error, then proceeds with broken state
try { user = load(id); }
catch (Exception e) { log.error("failed", e); }
return user.getName();                      // NPE five lines later, no context

// 3. LOSING THE CAUSE — the original stack trace is gone
try { risky(); }
catch (IOException e) { throw new ServiceException("failed"); }   // where is e?

// 4. CATCHING TOO MUCH — hides bugs you never intended to handle
try { parse(input); }
catch (Exception e) { return DEFAULT; }     // also swallows NPE, OOM, everything`,
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'The same four, done properly',
          code: `
// 1. If you truly cannot handle it, let it propagate. Do not catch.
risky();

// 2. Fail fast — do not continue with broken state
User user = load(id);   // throws; a handler upstream turns it into a 404 or 500

// 3. Always chain the cause
try { risky(); }
catch (IOException e) {
    throw new ServiceException("Loading config from " + path + " failed", e);
}                                           //                              ^ cause

// 4. Catch the narrowest type that you can actually act on
try { return parse(input); }
catch (NumberFormatException e) {           // exactly the case you handle
    return DEFAULT;
}`,
        },
        {
          t: 'trap',
          title: 'Passing the cause is not optional',
          text: '`new ServiceException(msg)` versus `new ServiceException(msg, e)` is the difference between "something failed" and a full chain showing the SQL error four layers down. Every custom exception should have a `(String, Throwable)` constructor and you should use it.',
        },
        {
          t: 'note',
          title: 'Never log and rethrow',
          text: 'If you log an exception and then rethrow it, it gets logged again by whoever eventually handles it — often three times in one request. Decide: either you handle it (log it) or you propagate it (stay silent). Handling means the caller no longer needs to know.',
        },
      ],
    },
    {
      id: 'writing',
      title: 'Writing exceptions worth catching',
      blocks: [
        {
          t: 'code',
          lang: 'java',
          caption: 'A domain exception carries data, not just a message',
          code: `
public class InsufficientFundsException extends RuntimeException {
    private final String accountId;
    private final BigDecimal requested;
    private final BigDecimal available;

    public InsufficientFundsException(String accountId,
                                      BigDecimal requested,
                                      BigDecimal available) {
        super("Account %s needs %s but has %s"
                .formatted(accountId, requested, available));
        this.accountId = accountId;
        this.requested = requested;
        this.available = available;
    }

    public String accountId()       { return accountId; }
    public BigDecimal shortfall()   { return requested.subtract(available); }
}`,
        },
        {
          t: 'key',
          title: 'Put the values in fields, not only in the message',
          text: 'A handler can then build a precise API response — "you are short by ₹250" — without parsing a string. This is the difference between an exception that is merely logged and one the system can respond to.',
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'Validate at the boundary, fail fast, and say exactly what was wrong',
          code: `
public Transfer transfer(String from, String to, BigDecimal amount) {
    Objects.requireNonNull(from, "from account is required");
    Objects.requireNonNull(to, "to account is required");

    if (amount == null || amount.signum() <= 0)
        throw new IllegalArgumentException("amount must be positive, was " + amount);
    if (from.equals(to))
        throw new IllegalArgumentException("cannot transfer to the same account: " + from);

    // ... by here, every assumption below is guaranteed
}`,
        },
        {
          t: 'tip',
          title: 'Which built-in exception to throw',
          text: '`IllegalArgumentException` — the caller passed something wrong. `IllegalStateException` — the object is in the wrong state for this call. `NullPointerException` (via `Objects.requireNonNull`) — a required argument was null. `UnsupportedOperationException` — this operation is deliberately not implemented. Reaching for these before inventing a new type keeps the codebase legible.',
        },
      ],
    },
    {
      id: 'resources',
      title: 'try-with-resources and finally',
      blocks: [
        { t: 'p', text: 'Anything holding an OS handle — files, sockets, database connections, streams — must be closed on every path, including the exceptional ones. `try-with-resources` does it for you and handles the tricky cases correctly.' },
        {
          t: 'code',
          lang: 'java',
          caption: 'Why the old way was so easy to get wrong',
          code: `
// OLD — and subtly broken: if close() throws, it MASKS the real exception
InputStream in = null;
try {
    in = new FileInputStream(path);
    process(in);
} finally {
    if (in != null) in.close();       // this exception replaces the real one
}

// MODERN — closes in reverse order, and a close() failure is attached
// to the original exception as a "suppressed" exception instead of hiding it
try (InputStream in = new FileInputStream(path);
     OutputStream out = new FileOutputStream(dest)) {
    in.transferTo(out);
}   // out closed first, then in — both closed even if transferTo throws`,
        },
        {
          t: 'warn',
          title: 'Never return from inside finally',
          text: 'A `return` in a `finally` block discards any exception in flight — silently. The same goes for `break` and `continue`. Some static analysers flag it; most do not.',
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'The checked-exception-in-a-lambda problem, and the usual fix',
          code: `
// Does not compile: Function cannot throw a checked exception
List<String> contents = paths.stream()
        .map(p -> Files.readString(p))         // IOException — compile error
        .toList();

// Fix: wrap at the boundary into an unchecked exception
List<String> ok = paths.stream()
        .map(p -> {
            try { return Files.readString(p); }
            catch (IOException e) { throw new UncheckedIOException(e); }
        })
        .toList();

// Cleaner: extract a small helper so the stream stays readable
private static String read(Path p) {
    try { return Files.readString(p); }
    catch (IOException e) { throw new UncheckedIOException(e); }
}
List<String> best = paths.stream().map(ExceptionsDemo::read).toList();`,
        },
      ],
    },
    {
      id: 'spring-handling',
      title: 'Handling exceptions once, in Spring',
      blocks: [
        { t: 'p', text: 'The single best structural improvement you can make is to stop catching exceptions in controllers and handle them in one place instead. Spring gives you `@RestControllerAdvice` for exactly this.' },
        {
          t: 'code',
          lang: 'java',
          caption: 'One handler, every endpoint',
          code: `
@RestControllerAdvice
public class ApiExceptionHandler {

    @ExceptionHandler(NoSuchElementException.class)
    public ProblemDetail notFound(NoSuchElementException e) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, e.getMessage());
    }

    @ExceptionHandler(InsufficientFundsException.class)
    public ProblemDetail insufficientFunds(InsufficientFundsException e) {
        ProblemDetail pd = ProblemDetail
                .forStatusAndDetail(HttpStatus.UNPROCESSABLE_ENTITY, e.getMessage());
        pd.setProperty("accountId", e.accountId());
        pd.setProperty("shortfall", e.shortfall());   // machine-readable detail
        return pd;
    }

    @ExceptionHandler(Exception.class)
    public ProblemDetail unexpected(Exception e) {
        log.error("Unhandled exception", e);          // logged ONCE, here
        return ProblemDetail.forStatusAndDetail(
                HttpStatus.INTERNAL_SERVER_ERROR, "Something went wrong");
    }
}`,
        },
        {
          t: 'key',
          title: 'Controllers get shorter and services get honest',
          text: 'With a central handler, a service can simply throw. No `try/catch` in the controller, no `ResponseEntity` gymnastics, and every endpoint returns errors in the same shape. This is the single highest-value refactor in most Spring codebases.',
        },
        {
          t: 'warn',
          title: 'Never leak internals in an error response',
          text: 'Stack traces, SQL fragments and class names in a public API response are an information disclosure risk and useless to the caller. Log the detail server-side; return a stable code and a human-readable message. `ProblemDetail` (RFC 7807) is the standard shape.',
        },
      ],
    },
  ],

  patterns: [
    {
      id: 'fail-fast',
      name: 'Fail Fast at the Boundary',
      oneLiner: 'Validate inputs at the entry point so the rest of the method can assume they are valid.',
      useWhen: ['Public methods, constructors, anything taking external input.'],
      recognize: ['Null checks scattered through the middle of a method.', 'An NPE thrown ten frames below where the bad value entered.'],
      steps: [
        'Check every precondition in the first few lines.',
        'Throw `IllegalArgumentException` or `NullPointerException` with the offending value in the message.',
        'Write the rest of the method assuming validity.',
      ],
      template: {
        lang: 'java',
        caption: 'Guard clauses make the happy path obvious',
        code: `
public Order place(String customerId, List<Item> items) {
    Objects.requireNonNull(customerId, "customerId");
    if (items == null || items.isEmpty())
        throw new IllegalArgumentException("order must contain at least one item");
    if (items.size() > MAX_ITEMS)
        throw new IllegalArgumentException(
                "order has %d items, maximum is %d".formatted(items.size(), MAX_ITEMS));

    return new Order(customerId, items);     // no defensive checks needed below
}`,
      },
      complexity: 'A few comparisons; saves hours of debugging.',
      gotchas: [
        'Include the actual value in the message — "invalid amount" is useless, "amount must be positive, was -5" is not.',
        'Do not validate the same thing at every layer; do it at the boundary and trust it inward.',
      ],
      problems: ['Add guard clauses to a service method', 'Improve a useless exception message'],
    },
    {
      id: 'wrap-with-cause',
      name: 'Translate and Wrap, Never Swallow',
      oneLiner: 'Convert a low-level failure into a domain one, carrying the original as the cause.',
      useWhen: ['Crossing a layer boundary — persistence to service, HTTP client to domain.'],
      recognize: ['`SQLException` or `IOException` appearing in a service or controller signature.'],
      steps: [
        'Catch the technical exception at the layer boundary.',
        'Throw a domain exception that means something to the caller.',
        'Pass the original as the cause, always.',
      ],
      template: {
        lang: 'java',
        caption: 'The context you add is the point',
        code: `
try {
    return httpClient.send(request, ofString());
} catch (IOException | InterruptedException e) {
    if (e instanceof InterruptedException) Thread.currentThread().interrupt();
    throw new PaymentGatewayException(
            "Payment gateway call failed for order " + orderId, e);
}`,
      },
      complexity: 'Free; the exception is already being constructed.',
      gotchas: [
        'Always restore the interrupt flag when you catch `InterruptedException`.',
        'Do not wrap and log — wrapping means you are delegating, so stay quiet.',
      ],
      problems: ['Wrap a checked exception with context', 'Restore the interrupt flag correctly'],
    },
    {
      id: 'central-handler',
      name: 'Handle Once, Centrally',
      oneLiner: 'One advice class turns every exception into a consistent API response.',
      useWhen: ['Any Spring web application.'],
      recognize: ['`try/catch` in controllers.', 'Error responses whose shape differs per endpoint.'],
      steps: [
        'Delete the `try/catch` blocks from controllers.',
        'Add `@RestControllerAdvice` with one `@ExceptionHandler` per meaningful failure.',
        'Add a catch-all that logs and returns 500 without internals.',
      ],
      complexity: 'One class; removes handling code from every controller.',
      gotchas: [
        'The most specific handler wins, so a handler for `Exception` does not shadow your specific ones.',
        'Log at the catch-all only, or you will log the same failure repeatedly.',
      ],
      problems: ['Add a RestControllerAdvice', 'Return RFC 7807 ProblemDetail'],
    },
  ],

  pitfalls: [
    { title: 'Empty catch blocks', text: 'The failure happened and nobody will ever know. If you genuinely want to ignore it, comment why — and log at debug level.' },
    { title: 'catch (Exception e) at a low level', text: 'It also catches bugs you never meant to handle. Catch the narrowest type you can act on.' },
    { title: 'Dropping the cause', text: 'Always use the `(message, cause)` constructor. The chain is the debugging information.' },
    { title: 'e.printStackTrace()', text: 'Writes to stderr, bypasses your logging config, is invisible in aggregated logs. Use the logger.' },
    { title: 'Catching InterruptedException and doing nothing', text: 'You just cancelled the thread’s shutdown signal. Restore it with `Thread.currentThread().interrupt()` or rethrow.' },
    { title: 'Using exceptions for control flow', text: 'Throwing to signal "not found" in a loop is orders of magnitude slower than a boolean, because filling in a stack trace is expensive.' },
    { title: 'Returning from finally', text: 'Silently discards the exception in flight.' },
    { title: 'Leaking stack traces to API clients', text: 'Security risk and useless to them. Log server-side, return a code.' },
  ],

  cheatsheet: [
    { label: 'Caller can recover?', value: 'checked — otherwise unchecked' },
    { label: 'App code default', value: 'unchecked (like Spring)' },
    { label: 'Never catch', value: 'Error' },
    { label: 'Always pass', value: 'the cause' },
    { label: 'Bad argument', value: 'IllegalArgumentException' },
    { label: 'Wrong state', value: 'IllegalStateException' },
    { label: 'Null required arg', value: 'Objects.requireNonNull' },
    { label: 'Resources', value: 'try-with-resources' },
    { label: 'Close order', value: 'reverse of declaration' },
    { label: 'close() failure', value: 'becomes a suppressed exception' },
    { label: 'Interrupted', value: 'restore the interrupt flag' },
    { label: 'Checked in a lambda', value: 'wrap in an unchecked one' },
    { label: 'Spring web', value: '@RestControllerAdvice' },
    { label: 'Error body', value: 'ProblemDetail (RFC 7807)' },
  ],

  problems: [
    { name: 'Lose a stack trace, then get it back', difficulty: 'Easy', pattern: 'Chaining', insight: 'Wrap an IOException without the cause and print it. Then add the cause and compare — the second shows "Caused by" with the real origin.' },
    { name: 'Write guard clauses for a service method', difficulty: 'Easy', pattern: 'Fail fast', insight: 'Validate every argument in the first five lines, including the offending value in each message.' },
    { name: 'Prove try-with-resources closes on exception', difficulty: 'Easy', pattern: 'Resources', insight: 'Implement AutoCloseable with a print in close(), throw from inside the try, and confirm close still ran.' },
    { name: 'See a suppressed exception', difficulty: 'Medium', pattern: 'Resources', insight: 'Throw from both the try body and close(). The body exception wins; the close exception appears under "Suppressed:".' },
    { name: 'Build a domain exception with data', difficulty: 'Medium', pattern: 'Exception design', insight: 'Give it fields, not just a message, and use them to build a precise error response.' },
    { name: 'Add a RestControllerAdvice', difficulty: 'Medium', pattern: 'Central handling', insight: 'Delete try/catch from a controller, add the advice, and confirm the endpoint still returns a clean 404 and 500.' },
    { name: 'Handle a checked exception inside a stream', difficulty: 'Medium', pattern: 'Lambdas', insight: 'Files.readString in a map() does not compile. Extract a helper that wraps it in UncheckedIOException.' },
    { name: 'Swallow an interrupt and observe the damage', difficulty: 'Hard', pattern: 'Interruption', insight: 'Catch InterruptedException without restoring the flag, then try to shut down the executor. It hangs, because the thread no longer knows it was asked to stop.' },
    { name: 'Measure the cost of exceptions as control flow', difficulty: 'Hard', pattern: 'Performance', insight: 'Loop a million times returning a boolean, then throwing. The throwing version is dramatically slower — most of it is filling in the stack trace.' },
    { name: 'Return RFC 7807 ProblemDetail', difficulty: 'Medium', pattern: 'API errors', insight: 'Use ProblemDetail with custom properties and confirm the response has the application/problem+json content type.' },
  ],
}
