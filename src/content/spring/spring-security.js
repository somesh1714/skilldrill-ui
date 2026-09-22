export default {
  id: 'spring-security',
  title: 'Spring Security',
  short: 'Security',
  icon: 'ShieldRounded',
  tier: 'Advanced',
  order: 17,
  estHours: 8,
  prereqs: ['rest-apis'],
  tagline: 'A chain of filters that runs before your controller. Learn the chain and it stops being frightening.',
  mentalModel:
    'Every request walks a **filter chain** before reaching your controller. Somewhere in that chain a filter works out *who you are* (authentication) and stores it; later, another check decides *what you may do* (authorization). Everything you configure is either adding a filter, changing one, or declaring a rule.',
  whyItMatters:
    'Security misconfiguration is consistently in the OWASP top ten, and Spring Security is opinionated enough that fighting it usually means disabling something you needed. It is also the framework people most often cargo-cult without understanding.',

  reference: {
    title: 'The concepts, and what each one answers',
    head: ['Concept', 'Question it answers', 'Where it lives'],
    rows: [
      ['**Authentication**', 'Who are you?', 'A filter early in the chain'],
      ['**Authorization**', 'What may you do?', 'URL rules and method annotations'],
      ['**Principal**', 'The authenticated identity', '`SecurityContextHolder`'],
      ['**Authority / Role**', 'A permission you hold', 'Inside the `Authentication` object'],
      ['**Filter chain**', 'The ordered pipeline', '`SecurityFilterChain` bean'],
      ['**401 vs 403**', 'Unauthenticated vs not permitted', 'Entry point vs access-denied handler'],
    ],
  },

  sections: [
    {
      id: 'chain',
      title: 'The filter chain',
      blocks: [
        {
          t: 'ascii',
          caption: 'Your controller is the last thing to run, not the first.',
          code: `
  request
     │
     ▼
  [ SecurityContextPersistenceFilter ]   restore any existing context
     │
  [ your JWT / auth filter ]             read the token, build an Authentication
     │
  [ ExceptionTranslationFilter ]         turns exceptions into 401 / 403
     │
  [ AuthorizationFilter ]                applies the URL rules
     │
     ▼
  DispatcherServlet ──▶ your @RestController`,
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'A modern, stateless configuration for an API',
          code: `
@Configuration
@EnableWebSecurity
@EnableMethodSecurity                       // enables @PreAuthorize
public class SecurityConfig {

    @Bean
    SecurityFilterChain filterChain(HttpSecurity http, JwtFilter jwtFilter)
            throws Exception {
        return http
            // No cookies, no sessions -> CSRF does not apply.
            // NEVER disable CSRF for a browser app that uses cookies.
            .csrf(csrf -> csrf.disable())
            .sessionManagement(s -> s.sessionCreationPolicy(STATELESS))

            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/actuator/health", "/api/v1/auth/**").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/v1/products/**").permitAll()
                .requestMatchers("/api/v1/admin/**").hasRole("ADMIN")
                .anyRequest().authenticated())      // ← default deny, always last

            .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class)
            .exceptionHandling(e -> e
                .authenticationEntryPoint(this::unauthorized)   // 401
                .accessDeniedHandler(this::forbidden))          // 403
            .build();
    }

    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();      // never store plaintext or MD5
    }
}`,
        },
        {
          t: 'key',
          title: 'Rules are evaluated in order, so put anyRequest() last',
          text: 'The first matching rule wins. `anyRequest().authenticated()` at the end is your default-deny backstop — without it, any URL you forget to list is wide open. Order the specific rules from most to least specific.',
        },
      ],
    },
    {
      id: 'authn',
      title: 'Authentication: JWT in practice',
      blocks: [
        {
          t: 'code',
          lang: 'java',
          caption: 'A filter that validates the token and populates the context',
          code: `
@Component
public class JwtFilter extends OncePerRequestFilter {

    private final JwtService jwt;

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res,
                                    FilterChain chain) throws IOException, ServletException {
        String header = req.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")) {
            try {
                Claims claims = jwt.parse(header.substring(7));   // verifies signature
                var authorities = jwt.authorities(claims);

                var auth = new UsernamePasswordAuthenticationToken(
                        claims.getSubject(), null, authorities);
                SecurityContextHolder.getContext().setAuthentication(auth);
            } catch (JwtException e) {
                // Do not throw — leave the context empty and let the
                // authorization filter produce a clean 401.
                log.debug("Invalid token", e);
            }
        }
        chain.doFilter(req, res);
    }
}`,
        },
        {
          t: 'dl',
          items: [
            { term: 'Access token', def: 'Short-lived (5–15 minutes), carries the claims, sent on every request. Because it is stateless it **cannot be revoked** — that is the price of not hitting the database.' },
            { term: 'Refresh token', def: 'Long-lived, stored server-side so it *can* be revoked, used only to mint new access tokens.' },
            { term: 'Signature', def: 'HMAC with a shared secret, or RSA/EC with a key pair. Use asymmetric keys when a different service verifies the token.' },
            { term: 'Claims', def: 'Subject, expiry, issuer, roles. They are base64, **not encrypted** — never put anything secret in a JWT.' },
          ],
        },
        {
          t: 'trap',
          title: 'Three JWT mistakes that make the token worthless',
          text: '**(1)** Accepting the `alg: none` header — always pin the expected algorithm. **(2)** Not verifying expiry, issuer and audience. **(3)** Putting sensitive data in the payload; anyone can decode it with a base64 decoder. Use a maintained library and never hand-roll the parsing.',
        },
        {
          t: 'note',
          title: 'If you can, do not implement this yourself',
          text: 'Spring Security’s OAuth2 resource-server support gives you signature validation, JWK-set fetching, expiry checks and claim mapping with a few lines of configuration. Writing your own filter is only worth it for unusual requirements.',
        },
      ],
    },
    {
      id: 'authz',
      title: 'Authorization: URL rules and method security',
      blocks: [
        {
          t: 'code',
          lang: 'java',
          caption: 'Coarse rules at the URL, fine rules at the method',
          code: `
@Service
public class DocumentService {

    @PreAuthorize("hasRole('ADMIN')")
    public void deleteAll() { }

    @PreAuthorize("hasAnyRole('ADMIN', 'EDITOR')")
    public void publish(Long id) { }

    // Ownership check — the most common real requirement
    @PreAuthorize("hasRole('ADMIN') or #ownerId == authentication.name")
    public List<Document> findByOwner(String ownerId) { }

    // Check the returned object instead of the arguments
    @PostAuthorize("returnObject.ownerId == authentication.name")
    public Document findById(Long id) { }
}`,
        },
        {
          t: 'warn',
          title: 'The vulnerability this prevents is the most common one there is',
          text: 'Broken object-level authorization — `GET /api/orders/12345` returning someone else’s order because you checked that the user was logged in but never that the order was theirs. URL rules cannot express this; you must check ownership where the data is loaded.',
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'Roles versus authorities — a naming trap',
          code: `
// hasRole('ADMIN')      looks for the authority "ROLE_ADMIN"  (prefix added)
// hasAuthority('ADMIN') looks for the authority "ADMIN"       (exact)

// So this silently never matches:
new SimpleGrantedAuthority("ADMIN")    +   hasRole("ADMIN")     // ✘

// Pick one convention and stick to it:
new SimpleGrantedAuthority("ROLE_ADMIN")   +   hasRole("ADMIN")   // ✔
new SimpleGrantedAuthority("orders:read")  +   hasAuthority("orders:read")  // ✔`,
        },
        {
          t: 'tip',
          title: 'Prefer fine-grained authorities to roles',
          text: '`hasAuthority("orders:delete")` expresses intent far better than `hasRole("ADMIN")`, and it survives reorganisation — when a new role needs to delete orders, you grant the authority instead of editing every annotation.',
        },
      ],
    },
    {
      id: 'practical',
      title: 'CORS, CSRF, and the things people disable',
      blocks: [
        {
          t: 'dl',
          items: [
            { term: 'CSRF', def: 'An attack where another site makes an authenticated request using your **cookies**. It only applies when the browser attaches credentials automatically. A stateless API using an `Authorization` header is not vulnerable, which is why disabling CSRF is correct there — and dangerous anywhere else.' },
            { term: 'CORS', def: 'A browser rule about which origins may read a response. It is not a security control on your side; it protects the *user*. Configure it properly rather than allowing everything.' },
          ],
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'CORS configured narrowly',
          code: `
@Bean
CorsConfigurationSource corsConfigurationSource() {
    CorsConfiguration config = new CorsConfiguration();
    config.setAllowedOrigins(List.of("https://app.example.com"));   // not "*"
    config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE"));
    config.setAllowedHeaders(List.of("Authorization", "Content-Type"));
    config.setAllowCredentials(true);          // cannot be combined with "*"
    config.setMaxAge(3600L);

    var source = new UrlBasedCorsConfigurationSource();
    source.registerCorsConfiguration("/api/**", config);
    return source;
}`,
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'Password storage, done correctly',
          code: `
@Bean
PasswordEncoder passwordEncoder() {
    // Adaptive hashing: slow by design, with a per-password salt built in.
    return new BCryptPasswordEncoder(12);          // cost factor
    // Argon2PasswordEncoder is the modern alternative.
}

// Storing: encoder.encode(rawPassword)
// Checking: encoder.matches(rawPassword, storedHash)
// NEVER: MD5, SHA-256 without a salt, or your own scheme.

// DelegatingPasswordEncoder stores the algorithm as a prefix —
// {bcrypt}$2a$... — so you can migrate algorithms without a flag day.`,
        },
        {
          t: 'trap',
          title: 'Do not leak which half of the login was wrong',
          text: 'Returning "user not found" versus "wrong password" lets an attacker enumerate valid accounts. Return one generic message for both, and make sure the timing is similar too — an early return on an unknown user is measurably faster.',
        },
      ],
    },
  ],

  patterns: [
    {
      id: 'default-deny',
      name: 'Default Deny',
      oneLiner: 'Permit specific things; require authentication for everything else.',
      useWhen: ['Every security configuration.'],
      recognize: ['`anyRequest().permitAll()`.', 'A new endpoint that turned out to be public by accident.'],
      steps: ['List public endpoints explicitly first.', 'End with `anyRequest().authenticated()`.', 'Add a test that an unauthenticated request to a new endpoint gets 401.'],
      complexity: 'Free; the difference between a safe default and an unsafe one.',
      gotchas: [
        'Rules match in order — a broad early rule shadows later specific ones.',
        'Remember to protect actuator endpoints; only `health` is safe to expose publicly.',
      ],
      problems: ['Find an unintentionally public endpoint', 'Test that new endpoints require auth'],
    },
    {
      id: 'ownership-check',
      name: 'Check Ownership, Not Just Authentication',
      oneLiner: 'Being logged in is not permission to see this particular record.',
      useWhen: ['Any endpoint that takes a resource id.'],
      recognize: ['`findById(id)` returned straight to the caller with no owner check.'],
      steps: [
        'Load the resource.',
        'Compare its owner with the authenticated principal.',
        'Return 404 rather than 403 if you do not want to confirm the record exists.',
      ],
      template: {
        lang: 'java',
        caption: 'Filter by owner in the query — the safest version',
        code: `
// Best: make it impossible to load someone else's row
Optional<Order> findByIdAndCustomerId(Long id, String customerId);

public Order get(Long id, Authentication auth) {
    return repo.findByIdAndCustomerId(id, auth.getName())
               .orElseThrow(() -> new NoSuchElementException("Order not found"));
}`,
      },
      complexity: 'One extra predicate in the query.',
      gotchas: [
        '`@PostAuthorize` works but loads the record first — fine for reads, wasteful for large objects.',
        'Do not trust an owner id sent by the client; take it from the authenticated principal.',
      ],
      problems: ['Exploit a missing ownership check', 'Fix it in the query'],
    },
    {
      id: 'authorities-not-roles',
      name: 'Fine-Grained Authorities',
      oneLiner: 'Grant permissions, not job titles.',
      useWhen: ['Permissions that do not map cleanly onto a handful of roles.'],
      recognize: ['`hasRole("ADMIN")` scattered across unrelated features.', 'A new role requiring edits in fifty places.'],
      steps: ['Name authorities after actions: `orders:read`, `orders:refund`.', 'Map roles to sets of authorities at login.', 'Annotate with `hasAuthority`.'],
      complexity: 'More authorities to manage, far less code churn.',
      gotchas: [
        '`hasRole` adds the `ROLE_` prefix and `hasAuthority` does not — mixing them fails silently.',
        'Keep the role-to-authority mapping in one place so it can be audited.',
      ],
      problems: ['Convert roles to authorities', 'Catch the ROLE_ prefix mismatch'],
    },
  ],

  pitfalls: [
    { title: 'Disabling CSRF on a cookie-based app', text: 'Correct for stateless APIs, a serious vulnerability for anything using session cookies.' },
    { title: 'permitAll as the last rule', text: 'Every endpoint you forget becomes public.' },
    { title: 'Authenticating but not authorizing', text: 'Broken object-level authorization — any logged-in user reads any record.' },
    { title: 'Mixing hasRole and hasAuthority', text: 'The ROLE_ prefix makes the check silently never match.' },
    { title: 'Secrets inside a JWT', text: 'The payload is base64, not encrypted.' },
    { title: 'Long-lived access tokens', text: 'They cannot be revoked. Keep them short and use refresh tokens.' },
    { title: 'CORS allowedOrigins "*" with credentials', text: 'Rejected by browsers, and a sign the config was not thought through.' },
    { title: 'Weak password hashing', text: 'MD5 or plain SHA-256 are trivially brute-forced. Use BCrypt or Argon2.' },
    { title: 'Distinguishing "no such user" from "wrong password"', text: 'Enables account enumeration.' },
    { title: 'Exposing all actuator endpoints', text: '/env, /beans and /heapdump are an attacker’s dream.' },
  ],

  cheatsheet: [
    { label: 'Mental model', value: 'a chain of filters' },
    { label: 'Last rule', value: 'anyRequest().authenticated()' },
    { label: 'Not authenticated', value: '401' },
    { label: 'Not permitted', value: '403' },
    { label: 'Stateless API', value: 'SessionCreationPolicy.STATELESS' },
    { label: 'CSRF', value: 'only for cookie auth' },
    { label: 'hasRole("X")', value: 'looks for ROLE_X' },
    { label: 'hasAuthority("X")', value: 'looks for X exactly' },
    { label: 'Method security', value: '@EnableMethodSecurity + @PreAuthorize' },
    { label: 'Ownership', value: 'findByIdAndOwnerId' },
    { label: 'Passwords', value: 'BCrypt or Argon2' },
    { label: 'JWT payload', value: 'readable by anyone' },
    { label: 'Access token', value: 'short-lived; refresh token revocable' },
    { label: 'Current user', value: 'SecurityContextHolder / @AuthenticationPrincipal' },
  ],

  problems: [
    { name: 'Leave an endpoint accidentally public', difficulty: 'Easy', pattern: 'Default deny', insight: 'Configure permitAll as the last rule, add a new controller, and hit it with no token. It works — which is the bug.' },
    { name: 'Return the right status codes', difficulty: 'Easy', pattern: 'Entry points', insight: 'No token should give 401; a valid token without the role should give 403. Many configurations return 403 for both.' },
    { name: 'Hash and verify a password', difficulty: 'Easy', pattern: 'Password storage', insight: 'Encode the same password twice with BCrypt. The hashes differ because of the salt, yet matches() returns true for both.' },
    { name: 'Exploit a missing ownership check', difficulty: 'Medium', pattern: 'Object-level authorization', insight: 'Log in as user A and request user B’s order by id. It returns. Then fix it with findByIdAndCustomerId.' },
    { name: 'Catch the ROLE_ prefix mismatch', difficulty: 'Medium', pattern: 'Authorities', insight: 'Grant "ADMIN" and check hasRole("ADMIN"). Access is denied with no useful message. Grant "ROLE_ADMIN" instead.' },
    { name: 'Write a JWT filter', difficulty: 'Medium', pattern: 'Authentication', insight: 'Parse, verify the signature and expiry, populate the SecurityContext. Confirm an invalid token yields 401 rather than an exception page.' },
    { name: 'Decode a JWT payload', difficulty: 'Medium', pattern: 'JWT', insight: 'Base64-decode the middle segment of a real token without any key. Everything in it is readable — which is why secrets must not go there.' },
    { name: 'Test security with @WithMockUser', difficulty: 'Medium', pattern: 'Testing', insight: 'Use MockMvc with @WithMockUser(roles="USER") and assert 403 on an admin endpoint.' },
    { name: 'Configure CORS correctly', difficulty: 'Medium', pattern: 'CORS', insight: 'Allow one origin with credentials. Then try "*" with credentials and read the browser error.' },
    { name: 'Demonstrate account enumeration', difficulty: 'Hard', pattern: 'Information leakage', insight: 'Time logins for a known and an unknown user. The unknown one returns measurably faster. Add a dummy hash comparison to equalise.' },
  ],
}
