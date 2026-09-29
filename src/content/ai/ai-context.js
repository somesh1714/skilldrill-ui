export default {
  id: 'ai-context',
  title: 'Context Engineering: Caching, Compaction & Budgets',
  short: 'Context Engineering',
  icon: 'LayersRounded',
  tier: 'Core',
  order: 7,
  estHours: 5,
  prereqs: ['ai-structured-output'],
  tagline: 'The context window is the working memory you design. Order it, cache it, and prune it on purpose.',
  mentalModel:
    'Think of the request as a **document you are assembling for a reader who charges by the word and reads the middle least carefully**. Stable material goes at the front so it can be cached; the volatile question goes at the back where it is read most carefully; and anything no longer load-bearing gets removed before it costs you again. That is the whole discipline.',
  whyItMatters:
    'Prompt caching is routinely the difference between a feature that is viable and one that is not — a repeated prefix costs about a tenth of its normal price. And a long-running conversation or agent will grow past any window eventually, so pruning is not an optimisation, it is a correctness requirement.',

  reference: {
    title: 'The three mechanisms, and what each one is for',
    head: ['Mechanism', 'What it does', 'When to reach for it'],
    rows: [
      ['**Prompt caching**', 'Persists the prefill of a stable prefix across requests', '**Always.** Any prompt with a repeated prefix'],
      ['**Compaction**', 'Server-side: summarises older turns when context grows', 'Long conversations and agents that may exceed the window'],
      ['**Context editing**', 'Server-side: *clears* stale tool results or thinking blocks', 'Agent loops where old tool output is dead weight'],
      ['**Your own trimming**', 'Drop retrieved chunks, summarise old turns yourself', 'When you need control over exactly what is lost'],
    ],
  },

  sections: [
    {
      id: 'the-budget',
      title: 'Five claimants, one budget',
      blocks: [
        {
          t: 'p',
          text: 'Every request is a negotiation between five things that all want space. Naming them is the first step, because each one has a different growth rate and a different lever.',
        },
        {
          t: 'ascii',
          caption: 'Know the growth rate of each claimant. That is what tells you which one will break you first.',
          code: `
  CLAIMANT                 GROWS WITH          LEVER
  ─────────────────────────────────────────────────────────────────────
  system prompt            nothing             cache it (stable → free)
  tool definitions         tool count          cache; defer loading if many
  conversation history     turns   ← O(n²)     cache + compaction + editing
  retrieved documents      top-k × chunk size  retrieve less, rerank better
  the user's question      nothing             leave it alone
  reserved output          max_tokens          set it deliberately

  ┌──────────────── the window ────────────────────────────────────────┐
  │ ██ system  ██ tools │ ████████ history │ ██████████ retrieved │ ▏q │ ████ out │
  │ ◀──── cacheable, stable ────▶│◀─── volatile ───▶│                  │
  └────────────────────────────────────────────────────────────────────┘

  Two rules that follow directly:
    1. Anything stable goes FIRST, so the cache prefix is as long as possible.
    2. Anything volatile goes LAST, so it invalidates nothing behind it.

  Ignore rule 2 and you will cache nothing while believing you cache
  everything. One timestamp in the system prompt is enough.`,
        },
        {
          t: 'key',
          title: 'More context is not more context engineering',
          text: 'A million-token window is a capacity, not a target. Filling it costs quadratic attention, real money, and measurable accuracy — a fact buried in the middle of an enormous prompt is used less reliably than the same fact in a focused one. The skill is choosing what *not* to include.',
        },
      ],
    },
    {
      id: 'caching',
      title: 'Prompt caching: the biggest lever you have',
      blocks: [
        {
          t: 'p',
          text: 'The prefill of a prefix can be stored server-side and reused. A cache read costs roughly a tenth of a normal input token; writing the cache costs about a quarter more than normal. So the break-even is about two requests, and everything after that is nearly free.',
        },
        {
          t: 'ascii',
          caption: 'The cache is a PREFIX match. One changed byte invalidates everything after it.',
          code: `
  RENDER ORDER — this is the order the cache sees, always:
        tools  →  system  →  messages

  REQUEST 1                          REQUEST 2 (prefix identical)
  ┌─────────────────────┐            ┌─────────────────────┐
  │ tools    12,000 tok │            │ tools    12,000 tok │  ← cache READ
  │ system    3,000 tok │  ▸ WRITE   │ system    3,000 tok │     15,000 tok
  │ ══ cache_control ══ │  15,000    │ ══ cache_control ══ │     at ~0.1×
  ├─────────────────────┤            ├─────────────────────┤
  │ question    40 tok  │  full      │ question    55 tok  │  ← full price
  └─────────────────────┘  price     └─────────────────────┘

  Cost of the 15,000-token prefix, per request, Opus 5 at $5/MTok in:
      no cache      15,000 × $5.00 / 1e6   =  $0.0750
      cache write   15,000 × $6.25 / 1e6   =  $0.0938   (once)
      cache read    15,000 × $0.50 / 1e6   =  $0.0075   (every time after)

      → break even on request 2; a 90% saving from request 3 onwards.

  NOW BREAK IT — put one volatile byte in the prefix:
  ┌─────────────────────────────────────────┐
  │ system: "Today is 2026-09-27T14:03:22Z" │  ← changes every request
  │ system: <3,000 tokens of instructions>  │  ← so this NEVER caches
  └─────────────────────────────────────────┘
      cache_read_input_tokens = 0, on every single request, silently.`,
        },
        {
          t: 'code',
          lang: 'python',
          caption: 'Manual breakpoints: cache the tools and the system prompt, leave the question volatile',
          code: `
response = client.messages.create(
    model="claude-opus-5",
    max_tokens=16000,
    tools=TOOLS,                       # stable and sorted → cached first
    system=[
        {"type": "text", "text": COMPANY_POLICY_DOCS},          # 40k tokens
        {"type": "text", "text": TASK_INSTRUCTIONS,
         "cache_control": {"type": "ephemeral"}},   # breakpoint: cache to here
    ],
    messages=[
        # Everything below the last breakpoint is charged at full price.
        {"role": "user", "content": f"Today is {today}. {question}"},
    ],
)

u = response.usage
print(u.cache_creation_input_tokens,    # non-zero on the first call
      u.cache_read_input_tokens,        # non-zero on every call after
      u.input_tokens)                   # only the volatile tail`,
        },
        {
          t: 'code',
          lang: 'python',
          caption: 'Or let the API place the breakpoint for you, and extend the TTL when calls are spread out',
          code: `
# Simplest form: caches the last cacheable block automatically.
response = client.messages.create(
    model="claude-opus-5", max_tokens=16000,
    cache_control={"type": "ephemeral"},        # top-level, auto-placed
    system=LARGE_STABLE_SYSTEM,
    messages=[{"role": "user", "content": question}],
)

# Default TTL is 5 minutes. For traffic that arrives in bursts an hour
# apart, the longer TTL is usually worth the higher write price.
system=[{"type": "text", "text": LARGE_STABLE_SYSTEM,
         "cache_control": {"type": "ephemeral", "ttl": "1h"}}]`,
        },
        {
          t: 'table',
          caption: 'The silent invalidators. Every one of these produces `cache_read_input_tokens == 0` with no error.',
          head: ['Cause', 'Why it breaks the prefix', 'Fix'],
          rows: [
            ['A timestamp or "today is..." in the system prompt', 'Changes every request', 'Move it into the last user message'],
            ['A request id, trace id or user id in the prefix', 'Unique per request', 'Move it after the last breakpoint, or into `metadata`'],
            ['`json.dumps(dict)` with non-deterministic key order', 'Byte-different for identical data', '`sort_keys=True`, or build the string once'],
            ['A tool list assembled from a set or dict', 'Order varies between processes', 'Sort tools by name and freeze the list'],
            ['Conditionally adding one tool', 'Different tool set = different prefix', 'Send the full set every time; gate in the handler'],
            ['A prompt built with string concatenation per request', 'Whitespace drift', 'Build it once at import time'],
            ['Switching model or effort mid-conversation', 'The cache is scoped to the model; effort resets it', 'Pin the model; see mid-conversation effort below'],
            ['A prefix shorter than the model minimum', 'Below 512–4096 tokens nothing is stored', 'Cache only genuinely large prefixes'],
          ],
        },
        {
          t: 'warn',
          title: 'Verify caching with `usage`, never by assumption',
          text: 'Caching fails silently. There is no error, no warning, and the output is identical — only the bill differs. Log `cache_read_input_tokens` on every request and alert when it drops to zero. Teams have shipped "cached" prompts for months and found out at renewal time.',
        },
        {
          t: 'tip',
          title: 'Four breakpoints, placed at stability boundaries',
          text: 'You get at most four `cache_control` markers per request. Spend them where the content changes at different rates: after the tools, after a large static corpus, after the system instructions, and after the stable head of the conversation. Do not scatter them — each one only pays off if the material before it genuinely repeats.',
        },
        {
          t: 'note',
          title: 'Pre-warming and mid-conversation instructions',
          text: 'Two small tricks worth knowing. You can warm a cache before the user arrives by sending the prefix with `max_tokens: 0`. And on models that support it, appending a `{"role": "system"}` entry to `messages` lets you inject an operator instruction mid-conversation **without** editing the top-level system prompt — which would invalidate the whole cached prefix. It is also the injection-safe channel for operator authority, because it is clearly separated from user content.',
        },
      ],
    },
    {
      id: 'growth',
      title: 'The quadratic problem, and three ways out',
      blocks: [
        {
          t: 'p',
          text: 'A conversation resends its entire history every turn, so total tokens billed across n turns grows as n². Caching flattens the constant dramatically but does not change the shape — and eventually the history simply will not fit. You need a pruning strategy before you need it.',
        },
        {
          t: 'ascii',
          caption: 'Four strategies. The right answer is usually caching plus compaction, with editing added for agents.',
          code: `
  1. TRUNCATE — keep the last N turns
     ┌──┬──┬──┬──┬──┬──┬──┐
     │╳ │╳ │╳ │  │  │  │  │   simple, and the user notices the amnesia
     └──┴──┴──┴──┴──┴──┴──┘   also destroys the cache prefix every trim
     Only acceptable for genuinely stateless Q&A.

  2. SUMMARISE YOURSELF — an extra model call to compress old turns
     ┌────────┬──┬──┬──┬──┐
     │summary │  │  │  │  │   you control exactly what survives
     └────────┴──┴──┴──┴──┘   costs a call; you own the prompt and the bugs

  3. COMPACTION — the server does it, inside the same request
     ┌────────┬──┬──┬──┬──┐
     │compact │  │  │  │  │   triggers automatically near a threshold
     └────────┴──┴──┴──┴──┘   returns a compaction BLOCK you must echo back

  4. CONTEXT EDITING — clear stale tool results rather than summarise
     ┌──┬──┬──┬──┬──┬──┬──┐
     │  │░░│  │░░│  │  │  │   keeps the turn structure, drops the payloads
     └──┴──┴──┴──┴──┴──┴──┘   ideal for agents: a 50k-token file read from
                               ten steps ago is pure cost now

  A tool result is the classic dead weight: enormous, already acted on,
  and never referenced again. Clearing it is nearly free in quality terms.`,
        },
        {
          t: 'code',
          lang: 'python',
          caption: 'Compaction — note that you must append the whole content list',
          code: `
messages = []

def chat(user_text: str) -> str:
    messages.append({"role": "user", "content": user_text})

    response = client.beta.messages.create(
        betas=["compact-2026-01-12"],
        model="claude-opus-5",
        max_tokens=16000,
        messages=messages,
        context_management={"edits": [{"type": "compact_20260112"}]},
    )

    # CRITICAL: append response.content, not the extracted text. The
    # compaction block is how the server replaces the summarised history
    # on the next request. Flatten it to a string and compaction silently
    # stops working while appearing to be enabled.
    messages.append({"role": "assistant", "content": response.content})

    return "".join(b.text for b in response.content if b.type == "text")`,
        },
        {
          t: 'code',
          lang: 'python',
          caption: 'Context editing — clearing, not summarising',
          code: `
response = client.beta.messages.create(
    betas=["context-management-2025-06-27"],
    model="claude-opus-5",
    max_tokens=16000,
    tools=TOOLS,
    messages=messages,
    context_management={"edits": [
        # Drop old tool RESULTS. Add clear_tool_inputs to also drop the
        # arguments that produced them.
        {"type": "clear_tool_uses_20250919"},
        # Drop old thinking blocks once the turn they belonged to is done.
        {"type": "clear_thinking_20251015"},
    ]},
)`,
        },
        {
          t: 'trap',
          title: 'Compaction and context editing are different features with confusable names',
          text: 'Compaction **summarises** and uses `compact_20260112` with the beta flag `compact-2026-01-12`. Context editing **clears** and uses `clear_tool_uses_20250919` / `clear_thinking_20251015` with the beta flag `context-management-2025-06-27`. Mixing the strategy type into the wrong feature’s parameter is a confusing 400. They compose fine together — just keep the pairs straight.',
        },
      ],
    },
    {
      id: 'ordering',
      title: 'Where to put things, and why',
      blocks: [
        {
          t: 'p',
          text: 'Two independent forces decide layout: the cache wants stability at the front, and attention favours the two ends of a long prompt over its middle. Happily, they agree about most things.',
        },
        {
          t: 'table',
          caption: 'A layout that satisfies both the cache and the attention pattern.',
          head: ['Position', 'What goes here', 'Why'],
          rows: [
            ['1. Tools', 'The full, sorted tool list', 'Rendered first; must be byte-stable to cache anything'],
            ['2. System — static corpus', 'Policy documents, style guides, schemas', 'Large and unchanging: the best cache value in the request'],
            ['3. System — instructions', 'Role, task, rules, output shape', 'Stable, and read early where it frames everything'],
            ['4. `cache_control` breakpoint', '—', 'Everything above this is cached'],
            ['5. History', 'Earlier turns', 'Grows; compact or edit it'],
            ['6. Retrieved documents', 'This request’s passages, best-first', 'Volatile; reranking puts the strongest passage at the top'],
            ['7. The question', 'What the user actually asked', 'Last, where compliance is highest'],
            ['8. A one-line reminder', '"Answer only from the documents; cite [doc-N]."', 'Very end of a long prompt, where it is read best'],
          ],
        },
        {
          t: 'key',
          title: 'Order retrieved passages best-first, and say how many there are',
          text: 'If you retrieve ten passages, the model reads the first two most carefully. Reranking (covered in advanced RAG) exists precisely so the strongest passage occupies that slot. And telling the model "you have been given 10 passages, some irrelevant" measurably improves its willingness to ignore the weak ones rather than trying to use all of them.',
        },
        {
          t: 'code',
          lang: 'python',
          caption: 'The assembly function — one place that owns the whole layout',
          code: `
def build_request(question: str, history: list, passages: list) -> dict:
    """Single owner of context layout. Every caller goes through here."""
    docs = "\\n\\n".join(
        f"<doc id=\\"{i}\\" source=\\"{p.source}\\">\\n{p.text}\\n</doc>"
        for i, p in enumerate(passages, start=1)     # already reranked
    )

    return dict(
        model="claude-opus-5",
        max_tokens=RESERVED_OUTPUT,
        tools=TOOLS_SORTED,                          # frozen at import time
        system=[
            {"type": "text", "text": STATIC_CORPUS},
            {"type": "text", "text": INSTRUCTIONS,
             "cache_control": {"type": "ephemeral"}},
        ],
        messages=[
            *history,
            {"role": "user", "content":
                f"<documents count=\\"{len(passages)}\\">\\n{docs}\\n</documents>\\n\\n"
                f"<question>\\n{question}\\n</question>\\n\\n"
                "Answer using only the documents above and cite each claim "
                "as [doc-N]. Some documents may be irrelevant; ignore those. "
                "If the answer is not present, say so and stop."},
        ],
    )`,
        },
        {
          t: 'tip',
          title: 'Centralise assembly in one function',
          text: 'The moment two code paths build a prompt independently, they drift, and one of them silently loses caching. One assembly function, one place to add a breakpoint, one place to log token counts per section. This is the least glamorous and most valuable piece of code in an LLM application.',
        },
      ],
    },
    {
      id: 'observability',
      title: 'Making the context observable',
      blocks: [
        {
          t: 'p',
          text: 'You cannot engineer what you cannot see. Four numbers per request, logged from the first day, turn every future context argument into arithmetic.',
        },
        {
          t: 'code',
          lang: 'python',
          caption: 'Per-section token accounting plus cache-hit monitoring',
          code: `
def log_context(request: dict, response) -> None:
    u = response.usage
    total_in = (u.input_tokens + u.cache_read_input_tokens
                + u.cache_creation_input_tokens)

    hit_rate = u.cache_read_input_tokens / total_in if total_in else 0.0

    log.info(
        "ctx tools=%d system=%d history=%d docs=%d out=%d "
        "cache_read=%d cache_write=%d hit_rate=%.2f stop=%s",
        count_tokens(tools=request["tools"]),
        count_tokens(system=request["system"]),
        count_tokens(messages=request["messages"][:-1]),
        count_tokens(messages=request["messages"][-1:]),
        u.output_tokens,
        u.cache_read_input_tokens, u.cache_creation_input_tokens,
        hit_rate, response.stop_reason,
    )

    # A stable prefix that stops being read is the single most valuable
    # alert in an LLM application. It is always a silent invalidator.
    if hit_rate < 0.3 and total_in > 10_000:
        log.warning("cache hit rate collapsed — check the prefix for drift")`,
        },
        {
          t: 'steps',
          items: [
            { title: 'Log the four token counters on every request', text: 'Input, cache read, cache write, output. Aggregate by feature, not by service.' },
            { title: 'Alert when the cache hit rate falls', text: 'A deploy that adds a timestamp to a system prompt is invisible in every other metric.' },
            { title: 'Log token counts per section', text: 'When the bill moves, you want to know whether it was retrieval, history, or the tool list that grew.' },
            { title: 'Alert on requests near the window limit', text: 'Before they start failing, not after.' },
            { title: 'Log every drop and every compaction', text: 'Silent context loss is the hardest LLM bug to diagnose, because the only symptom is a worse answer.' },
          ],
        },
      ],
    },
  ],

  patterns: [
    {
      id: 'stable-prefix',
      name: 'Design a Stable Prefix',
      oneLiner: 'Tools, then static corpus, then instructions, then a breakpoint. Nothing volatile above it.',
      useWhen: ['Any prompt sent more than once with shared material.'],
      recognize: ['`cache_read_input_tokens` is always zero.', 'A timestamp in the system prompt.'],
      steps: [
        'Build the tool list and system prompt once at import time, sorted and frozen.',
        'Place the `cache_control` breakpoint after the last stable block.',
        'Move every per-request value below it — timestamps, ids, the question.',
        'Serialise any JSON in the prefix with sorted keys.',
        'Confirm with `cache_read_input_tokens` on the second request.',
      ],
      template: {
        lang: 'python',
        caption: 'Frozen at import time, so it cannot drift per request',
        code: `
# Module level: built once, identical bytes forever.
TOOLS_SORTED = tuple(sorted(TOOLS, key=lambda t: t["name"]))
SYSTEM_BLOCKS = (
    {"type": "text", "text": STATIC_CORPUS},
    {"type": "text", "text": INSTRUCTIONS,
     "cache_control": {"type": "ephemeral"}},
)

# Per request: only the tail changes.
messages = [*history, {"role": "user",
                       "content": f"Today is {today}. {question}"}]`,
      },
      complexity: 'About a 90% saving on the cached portion, from the third request.',
      gotchas: [
        'A conditional tool changes the tool set and therefore the prefix — always send the full set.',
        'Below the model minimum (512–4096 tokens) nothing is stored, with no error.',
        'The cache is scoped to the model; a fallback to a cheaper model starts cold.',
      ],
      problems: ['Verify a cache hit, then break it deliberately', 'Add a hit-rate alert'],
    },
    {
      id: 'clear-dead-tool-results',
      name: 'Clear Tool Results Once They Are Spent',
      oneLiner: 'A 50k-token file read from ten steps ago is pure cost.',
      useWhen: ['Agent loops, long tool-using sessions.'],
      recognize: ['Context growing by tens of thousands of tokens per step.', 'An agent that slows down as it works.'],
      steps: [
        'Enable `clear_tool_uses_20250919` under the context-management beta.',
        'Add `clear_thinking_20251015` where thinking blocks accumulate.',
        'Keep summaries of what was learned in the conversation; clear only the raw payloads.',
      ],
      complexity: 'Large token savings, minimal quality cost when the result was already acted on.',
      gotchas: [
        'If the model still needs the detail later, clearing it causes a re-fetch — write findings down before clearing.',
        'Do not confuse this with compaction; different beta, different strategy name.',
      ],
      problems: ['Measure agent context growth', 'Add editing and compare'],
    },
    {
      id: 'centralise-assembly',
      name: 'One Function Owns Context Assembly',
      oneLiner: 'Two code paths building prompts will drift, and one will lose caching.',
      useWhen: ['The moment a second caller exists.'],
      recognize: ['Prompt strings built in handlers.', 'Caching that works on one endpoint and not another.'],
      steps: [
        'Write one `build_request` function returning the full request dict.',
        'Put the breakpoint, the delimiters and the section ordering inside it.',
        'Log per-section token counts from the same place.',
      ],
      complexity: 'An afternoon of refactoring; pays back permanently.',
      gotchas: ['Resist the "just this once" inline prompt — that is how the second path starts.'],
      problems: ['Refactor two paths into one', 'Add per-section logging'],
    },
    {
      id: 'reserve-output',
      name: 'Reserve the Output Before You Fill the Input',
      oneLiner: '`max_tokens` is carved out of the window. Budget for it first.',
      useWhen: ['Any request whose input size varies with data.'],
      recognize: ['Sporadic context-limit 400s.', 'Truncated answers under heavy retrieval.'],
      steps: [
        'Read the real window and output cap from the Models API at startup.',
        'Compute `budget = window − max_tokens − safety` and count before sending.',
        'Over budget? Drop retrieved chunks first, then compact history — and log it.',
      ],
      complexity: 'One count-tokens call, or a verified estimate.',
      gotchas: [
        'Tool schemas and the system prompt count towards the input.',
        'Dropping history before retrieval is backwards: users notice amnesia, not a missing source.',
      ],
      problems: ['Trigger the 400, then make it a graceful trim'],
    },
  ],

  pitfalls: [
    { title: 'A timestamp in the system prompt', text: 'The single most common cause of a permanently cold cache.' },
    { title: 'Assuming caching works', text: 'It fails silently and identically. Log `cache_read_input_tokens`.' },
    { title: 'Conditionally including a tool', text: 'Changes the prefix. Send the full set and gate in your handler.' },
    { title: 'Unsorted JSON in the prefix', text: 'Byte-different for identical data. Sort keys.' },
    { title: 'Caching a prefix below the model minimum', text: 'Nothing is stored, and nothing tells you.' },
    { title: 'More than four breakpoints', text: 'Only four are allowed; scattering them wastes them.' },
    { title: 'Editing the top-level system prompt mid-conversation', text: 'Invalidates the whole cached prefix. Use a mid-conversation system message where supported.' },
    { title: 'Flattening the assistant turn when compaction is on', text: 'Drops the compaction block, so compaction silently stops.' },
    { title: 'Confusing compaction with context editing', text: 'Different betas, different strategy names — `compact_20260112` versus `clear_tool_uses_20250919`.' },
    { title: 'Truncating history to fit', text: 'Visible amnesia, and it destroys the cache prefix every time.' },
    { title: 'Dropping history before retrieval', text: 'Retrieved chunks are the cheaper thing to lose.' },
    { title: 'Not logging silent drops', text: 'The only symptom is a worse answer, days later.' },
  ],

  cheatsheet: [
    { label: 'Render order', value: 'tools → system → messages' },
    { label: 'Cache is', value: 'a prefix match — one byte kills it' },
    { label: 'Cache read', value: '≈0.1× input price' },
    { label: 'Cache write', value: '≈1.25× input price' },
    { label: 'Break even', value: 'the second request' },
    { label: 'Breakpoints', value: 'max 4 per request' },
    { label: 'Min prefix', value: '512–4096 tokens, model-dependent' },
    { label: 'TTL', value: '5 min default; `"1h"` available' },
    { label: 'Verify with', value: '`usage.cache_read_input_tokens`' },
    { label: 'Pre-warm', value: 'send the prefix with `max_tokens: 0`' },
    { label: 'Mid-conversation rules', value: 'append a `{"role": "system"}` message' },
    { label: 'Compaction', value: '`compact_20260112`, beta `compact-2026-01-12`' },
    { label: 'Context editing', value: '`clear_tool_uses_20250919`' },
    { label: 'Compaction needs', value: '`response.content` echoed back whole' },
    { label: 'Layout', value: 'stable first, question last' },
    { label: 'Retrieved docs', value: 'best-first, and say how many' },
    { label: 'Drop order', value: 'retrieval before history' },
  ],

  problems: [
    { name: 'Prove a cache hit', difficulty: 'Easy', pattern: 'Caching', insight: 'Send a 10k-token system prompt twice with a breakpoint. The second response shows `cache_read_input_tokens` near 10k and `input_tokens` near zero. Now you can trust the mechanism.' },
    { name: 'Break the cache with one timestamp', difficulty: 'Easy', pattern: 'Silent invalidation', insight: 'Prepend "Today is <now>" to the system prompt and watch the hit rate go permanently to zero with no error at all. This is the bug, in miniature.' },
    { name: 'Compute the real saving on your own prompt', difficulty: 'Easy', pattern: 'Cost', insight: 'Take your actual prefix size and daily request count and work out the three prices. The number is usually large enough to end the discussion.' },
    { name: 'Break the cache with unsorted JSON', difficulty: 'Medium', pattern: 'Determinism', insight: 'Serialise a config dict without `sort_keys` and run across two processes. Identical data, different bytes, no caching.' },
    { name: 'Measure the quadratic on a thirty-turn chat', difficulty: 'Medium', pattern: 'Growth', insight: 'Log cumulative input tokens per turn, uncached then cached. The curve stays quadratic; the constant collapses. Both facts matter.' },
    { name: 'Enable compaction and watch it fire', difficulty: 'Medium', pattern: 'Compaction', insight: 'Drive a conversation past the trigger and find the compaction block in the response. Then flatten the assistant turn to a string and watch it silently stop working.' },
    { name: 'Add context editing to an agent loop', difficulty: 'Medium', pattern: 'Context editing', insight: 'Have an agent read three large files. Log context size per step with and without `clear_tool_uses`. The difference is often the whole reason a long agent run is feasible.' },
    { name: 'Test the lost-in-the-middle effect on your own data', difficulty: 'Hard', pattern: 'Position', insight: 'Place the answer at 10%, 50% and 90% depth in a 100k-token prompt, twenty trials each. Your numbers should decide your retrieval layout, not a blog post.' },
    { name: 'Refactor two prompt paths into one assembler', difficulty: 'Hard', pattern: 'Centralisation', insight: 'Find the drift between them first — there always is some. Then one function, one breakpoint, one logger, and caching that works everywhere.' },
    { name: 'Build the context dashboard', difficulty: 'Hard', pattern: 'Observability', insight: 'Tokens per section, cache hit rate, distance to the window limit, drop and compaction counts. Then deliberately regress the prefix and confirm the alert fires before anyone notices the bill.' },
  ],
}
