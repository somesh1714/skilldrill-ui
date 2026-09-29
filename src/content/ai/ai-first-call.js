export default {
  id: 'ai-first-call',
  title: 'The Messages API, Properly',
  short: 'Messages API',
  icon: 'TerminalRounded',
  tier: 'Foundations',
  order: 4,
  estHours: 4,
  prereqs: ['ai-inference'],
  tagline: 'One endpoint. Everything else — tools, images, JSON, agents — is a field on this request.',
  mentalModel:
    'There is essentially **one** endpoint: `POST /v1/messages`. Tool use, structured output, vision, caching, thinking and citations are not separate APIs; they are fields on that request and extra block types in the response. Learn the request and response shape once and every later feature is an addition to something you already know.',
  whyItMatters:
    'People learn this API by copying a hello-world snippet and then bolt features on by trial and error. Learning the shape properly — roles, content blocks, the statelessness contract, the error taxonomy, the usage object — means every subsequent chapter is a small delta instead of new magic.',

  reference: {
    title: 'The request, field by field',
    head: ['Field', 'Required', 'What it does'],
    rows: [
      ['`model`', '**Yes**', 'Exact id string, e.g. `claude-opus-5`. Never append a date.'],
      ['`max_tokens`', '**Yes**', 'Hard ceiling on output. Carved out of the context window.'],
      ['`messages`', '**Yes**', 'The alternating conversation. First entry must be `user`.'],
      ['`system`', 'No', 'Instructions and persona. A **top-level field**, not a message.'],
      ['`tools`', 'No', 'What the model may ask you to run.'],
      ['`output_config`', 'No', '`effort`, and `format` for a JSON schema.'],
      ['`thinking`', 'No', '`{"type": "adaptive"}`. On by default on the newest models.'],
      ['`cache_control`', 'No', 'Marks a cacheable prefix. The biggest cost lever there is.'],
      ['`stop_sequences`', 'No', 'Strings that end generation early.'],
      ['`metadata`', 'No', 'Opaque `user_id` for abuse tracking on the provider side.'],
    ],
  },

  sections: [
    {
      id: 'anatomy',
      title: 'Anatomy of a request and a response',
      blocks: [
        {
          t: 'ascii',
          caption: 'Learn this picture and the rest of the track is field-by-field additions to it.',
          code: `
  REQUEST                                    RESPONSE
  ┌───────────────────────────────┐          ┌───────────────────────────────┐
  │ model        "claude-opus-5"  │          │ id           "msg_01..."      │
  │ max_tokens   16000            │          │ model        "claude-opus-5"  │
  │ system       "You are ..."    │   ───▶   │ role         "assistant"      │
  │ tools        [ ... ]          │          │ content      [ blocks ]  ◀── a │
  │ messages     [                │          │ stop_reason  "end_turn"   LIST│
  │   {user,      "..."},         │          │ stop_details null             │
  │   {assistant, "..."},         │          │ usage        { ... }          │
  │   {user,      "..."}          │          └───────────────────────────────┘
  │ ]                             │
  └───────────────────────────────┘

  content block types you will meet, in order of arrival:
      thinking          the reasoning phase (text empty unless you ask)
      text              prose for the user
      tool_use          "please run this tool with these arguments"
      server_tool_use   a tool Anthropic ran for you (web search, code exec)
      compaction        server-side history summary — must be echoed back

  and blocks YOU send in a user turn:
      text, image, document, tool_result

  Rule that catches everyone once: content is a LIST.
      ✘  response.content[0].text
      ✔  "".join(b.text for b in response.content if b.type == "text")`,
        },
        {
          t: 'code',
          lang: 'python',
          caption: 'The whole thing, with nothing left implicit',
          code: `
import anthropic

# Resolves credentials from the environment: ANTHROPIC_API_KEY, or
# ANTHROPIC_AUTH_TOKEN, or a profile created by 'ant auth login'.
client = anthropic.Anthropic()

response = client.messages.create(
    model="claude-opus-5",
    max_tokens=16000,
    system="You are a precise technical writer. Prefer short sentences.",
    messages=[{"role": "user", "content": "Explain idempotency in two sentences."}],
)

text = "".join(b.text for b in response.content if b.type == "text")
print(text)
print(response.stop_reason)                 # end_turn
print(response.usage.input_tokens,
      response.usage.output_tokens)          # log these on EVERY call`,
        },
        {
          t: 'note',
          title: 'An unset `ANTHROPIC_API_KEY` does not mean you have no credentials',
          text: 'The SDKs resolve in order: `ANTHROPIC_API_KEY`, then `ANTHROPIC_AUTH_TOKEN`, then an OAuth profile stored by `ant auth login`, then workload identity federation. A bare `Anthropic()` works fine after a CLI login with no environment variable set — `ant auth status` tells you which source is active. Do not hardcode a key to "fix" a missing variable.',
        },
      ],
    },
    {
      id: 'roles',
      title: 'Roles, and where the system prompt lives',
      blocks: [
        {
          t: 'dl',
          items: [
            { term: '`system`', def: 'A **top-level field**, not an entry in `messages`. Carries instructions, persona, policy and any stable context. Rendered before everything else, which makes it the natural cache prefix.' },
            { term: '`user`', def: 'Anything from outside: the human’s text, images, documents, and `tool_result` blocks. Yes — tool results are user turns, because they are input to the model.' },
            { term: '`assistant`', def: 'What the model produced. You echo these back verbatim to build history.' },
            { term: '`system` inside `messages`', def: 'On some current models you may append a `{"role": "system"}` entry mid-conversation for an operator instruction — the cache-safe way to change the rules mid-flight without editing the top-level system prompt.' },
          ],
        },
        {
          t: 'code',
          lang: 'python',
          caption: 'Multi-turn is just a growing list — the API keeps nothing',
          code: `
messages = []

def chat(user_text: str) -> str:
    messages.append({"role": "user", "content": user_text})

    response = client.messages.create(
        model="claude-opus-5", max_tokens=16000,
        system=SYSTEM_PROMPT, messages=messages,
    )

    # Append the FULL content list, not the extracted string. Thinking blocks,
    # tool_use blocks and compaction blocks must survive into the next request.
    messages.append({"role": "assistant", "content": response.content})

    return "".join(b.text for b in response.content if b.type == "text")

chat("My name is Somesh.")
chat("What is my name?")     # works — because turn 1 is still in the list`,
        },
        {
          t: 'key',
          title: 'Append `response.content`, never the extracted text',
          text: 'Flattening the assistant turn to a plain string is the most damaging shortcut in this API. You lose thinking blocks (which the model expects back unchanged), `tool_use` blocks (so the tool results you send next have nothing to attach to), and compaction blocks (so server-side history management silently breaks). Append the list. Extract text separately for display.',
        },
        {
          t: 'ascii',
          caption: 'Cost grows quadratically with turn count, because every turn resends all previous turns.',
          code: `
  turn 1   send: [u1]                          input ≈  1 unit
  turn 2   send: [u1, a1, u2]                  input ≈  3 units
  turn 3   send: [u1, a1, u2, a2, u3]          input ≈  5 units
  turn 10  send: everything                     input ≈ 19 units
  turn 30  send: everything                     input ≈ 59 units

  Total tokens billed across an n-turn conversation ≈ O(n²).

  Three defences, in the order you should apply them:
      1. PROMPT CACHING     — the repeated prefix is charged at ~10%
      2. COMPACTION         — the server summarises old turns for you
      3. CONTEXT EDITING    — clear stale tool results out of the history

  All three are covered in the context-engineering chapter. Doing none of
  them is how a chat feature quietly becomes the largest line on the bill.`,
        },
      ],
    },
    {
      id: 'multimodal',
      title: 'Images, PDFs and files',
      blocks: [
        {
          t: 'p',
          text: 'A user turn’s `content` can be a list of blocks rather than a string. That is how images and documents get in — and the pattern is always: the media block first, the question after it.',
        },
        {
          t: 'code',
          lang: 'python',
          caption: 'Three ways in, same shape',
          code: `
import base64

# 1. An image by URL
{"role": "user", "content": [
    {"type": "image", "source": {"type": "url",
                                 "url": "https://example.com/chart.png"}},
    {"type": "text", "text": "What trend does this chart show?"},
]}

# 2. A PDF as base64 — no beta header needed. Document block BEFORE the text.
pdf = base64.b64encode(open("contract.pdf", "rb").read()).decode()
{"role": "user", "content": [
    {"type": "document", "source": {"type": "base64",
                                    "media_type": "application/pdf",
                                    "data": pdf}},
    {"type": "text", "text": "List every termination clause."},
]}

# 3. Files API — upload once, reference by id across many requests
uploaded = client.files.upload(file=("contract.pdf", open("contract.pdf", "rb"),
                                     "application/pdf"))
{"role": "user", "content": [
    {"type": "document", "source": {"type": "file", "file_id": uploaded.id}},
    {"type": "text", "text": "Now summarise the payment terms."},
]}`,
        },
        {
          t: 'h',
          text: 'Citations: answers tied to the source text',
        },
        {
          t: 'code',
          lang: 'python',
          caption: 'Set `citations` on the document and the response comes back attributed',
          code: `
{"role": "user", "content": [
    {"type": "document",
     "source": {"type": "base64", "media_type": "application/pdf", "data": pdf},
     "title": "Master Services Agreement",
     "citations": {"enabled": True}},          # all documents, or none
    {"type": "text", "text": "What is the notice period?"},
]}

# The response splits into several text blocks; cited ones carry a list:
for block in response.content:
    if block.type == "text" and getattr(block, "citations", None):
        for c in block.citations:
            print(c.cited_text, c.document_title)
            # location by type: page_location (1-indexed) for PDFs,
            #                   char_location for plain text`,
        },
        {
          t: 'warn',
          title: 'Three constraints worth knowing before you design around this',
          text: 'Base64 PDF data must contain no newlines, the whole request is capped at 32 MB and roughly 600 pages, `citations` must be enabled on **every** document block or none, and citations are **incompatible with `output_config.format`** — asking for a JSON schema and citations in the same request returns a 400. If you need both, do them in two calls.',
        },
        {
          t: 'tip',
          title: 'Use the Files API the moment a document is reused',
          text: 'Uploading a 4 MB PDF on every request wastes bandwidth and makes the prefix unstable, which kills prompt caching. Upload once, keep the `file_id`, and reference it. The content-block type must match the file’s MIME type — `document` for PDFs and text, `image` for images.',
        },
      ],
    },
    {
      id: 'errors',
      title: 'Errors, retries and the ones you must not retry',
      blocks: [
        {
          t: 'p',
          text: 'The SDK already retries the retryable classes twice with backoff. Your job is to catch a **chain** of specific exceptions rather than one broad class, because the correct action differs per status.',
        },
        {
          t: 'table',
          caption: 'Most-specific first. A single broad `except` loses all of this.',
          head: ['Status', 'SDK exception', 'Retry?', 'Real cause, usually'],
          rows: [
            ['400', '`BadRequestError`', '**No**', 'Malformed request: a removed parameter, an oversized prompt, a bad schema'],
            ['401', '`AuthenticationError`', 'No', 'Wrong or missing credential'],
            ['403', '`PermissionDeniedError`', 'No', 'The key lacks access to that model or feature'],
            ['404', '`NotFoundError`', 'No', 'A mistyped model id — often a date suffix that should not be there'],
            ['413', '`RequestTooLargeError`', 'No', 'Payload over the limit — shrink or use the Files API'],
            ['429', '`RateLimitError`', '**Yes**', 'Honour `retry-after`; add jitter; consider the Batch API'],
            ['500 / 529', '`InternalServerError` / overloaded', '**Yes**', 'Transient. Exponential backoff.'],
            ['—', '`APIConnectionError`', 'Yes', 'Network or timeout. Watch total wall-clock across retries.'],
          ],
        },
        {
          t: 'code',
          lang: 'python',
          caption: 'The handler shape that survives an incident review',
          code: `
import anthropic

client = anthropic.Anthropic(max_retries=3, timeout=120.0)  # seconds in Python

try:
    response = client.messages.create(model="claude-opus-5", max_tokens=16000,
                                      messages=msgs)

except anthropic.NotFoundError:
    raise RuntimeError("model id is wrong — check for a stray date suffix")

except anthropic.BadRequestError as e:
    # Never retry: it will fail identically. Log the body and fix the caller.
    log.error("bad request: %s", e.message)
    raise

except anthropic.RateLimitError as e:
    # The SDK already retried. Getting here means sustained pressure —
    # shed load, queue the work, or move the job to the Batch API.
    raise Throttled(retry_after=e.response.headers.get("retry-after"))

except anthropic.APIStatusError as e:
    log.error("api error %s: %s", e.status_code, e.message)
    raise

except anthropic.APIConnectionError:
    raise Unavailable("network or timeout after retries")`,
        },
        {
          t: 'trap',
          title: 'Timeouts multiply by retries',
          text: 'With `timeout=120` and `max_retries=3`, one call can occupy up to about eight minutes of wall-clock before it gives up. If that sits inside an HTTP request handler with its own 30-second budget, your service times out long before the SDK does. Set the client timeout *below* your own deadline and size retries accordingly. Note the units differ per SDK: seconds in Python and Ruby, **milliseconds** in TypeScript.',
        },
      ],
    },
    {
      id: 'usage',
      title: 'Usage and cost, from the first call',
      blocks: [
        {
          t: 'p',
          text: 'Every response carries a `usage` object. Logging it from day one costs one line and is the difference between having a cost conversation with data and having one with adjectives.',
        },
        {
          t: 'code',
          lang: 'python',
          caption: 'Four numbers, four different prices',
          code: `
u = response.usage

u.input_tokens                  # uncached input — full price
u.cache_creation_input_tokens   # written to cache — about 1.25× input price
u.cache_read_input_tokens       # served from cache — about 0.1× input price
u.output_tokens                 # generated — about 5× input price (incl. thinking)

# Opus 5: $5 / MTok in, $25 / MTok out
cost = (u.input_tokens * 5
        + u.cache_creation_input_tokens * 6.25
        + u.cache_read_input_tokens * 0.5
        + u.output_tokens * 25) / 1e6

log.info("req cost=$%.5f in=%d cached=%d out=%d stop=%s",
         cost, u.input_tokens, u.cache_read_input_tokens,
         u.output_tokens, response.stop_reason)`,
        },
        {
          t: 'table',
          caption: 'Current model line-up. Use Opus 5 by default; drop tier only with a measurement in hand.',
          head: ['Model', 'Id', 'Context', 'In $/MTok', 'Out $/MTok', 'Use for'],
          rows: [
            ['Claude Opus 5', '`claude-opus-5`', '1M', '$5', '$25', '**The default.** Reasoning, coding, agents'],
            ['Claude Sonnet 5', '`claude-sonnet-5`', '1M', '$2', '$10', 'High-volume work where quality still matters'],
            ['Claude Haiku 4.5', '`claude-haiku-4-5`', '200K', '$1', '$5', 'Bulk classification, extraction, cheap sub-agents'],
            ['Claude Fable 5.1', '`claude-fable-5-1`', '1M', '$10', '$50', 'The hardest reasoning and long-horizon agentic work'],
          ],
        },
        {
          t: 'warn',
          title: 'Model ids are complete as written — never append a date',
          text: '`claude-opus-5` is the whole id. Adding a date suffix you half-remember from an older generation produces a 404. If you need an older model, look the exact id up rather than constructing one.',
        },
        {
          t: 'key',
          title: 'Do not downgrade the model to save money before you have measured',
          text: 'Cheaper-per-token is not cheaper-per-task if the smaller model needs retries, longer prompts or a fallback. The free wins come first: prompt caching, shorter output, trimmed input, and the Batch API for anything asynchronous. Only after those, and only with an eval in place, is a tier change a defensible decision.',
        },
      ],
    },
    {
      id: 'checklist',
      title: 'A production checklist for call number one',
      blocks: [
        {
          t: 'steps',
          items: [
            { title: 'Log the request and the response', text: 'Model, token counts, `stop_reason`, latency, and a hash or id of the prompt version. Without this you cannot debug a single incident.' },
            { title: 'Branch on `stop_reason`', text: 'Handle refusal, truncation and `tool_use` before the happy path. Never render a `max_tokens` response as a finished answer.' },
            { title: 'Set a timeout under your own deadline', text: 'And size `max_retries` so the worst case still fits inside it.' },
            { title: 'Cache the stable prefix', text: 'System prompt and tool definitions barely change. Marking them cacheable is close to free and often the largest single saving available.' },
            { title: 'Stream anything long', text: 'For the user experience, and to avoid HTTP timeouts on large outputs.' },
            { title: 'Version the prompt in source control', text: 'A prompt is code. It needs a diff, a review and a rollback.' },
            { title: 'Keep an eval, however small', text: 'Twenty saved cases with expected outcomes will catch more regressions than any amount of manual spot-checking.' },
          ],
        },
        {
          t: 'note',
          title: 'What to reach for next',
          text: 'The rest of this tier is prompting. Then the Core tier makes the output shape reliable and the context deliberate, and adds retrieval. Tool use — the field that turns this endpoint into an agent platform — is the first Advanced chapter.',
        },
      ],
    },
  ],

  patterns: [
    {
      id: 'append-full-content',
      name: 'Append the Whole Content List',
      oneLiner: 'History holds blocks, not strings.',
      useWhen: ['Every multi-turn conversation, agent loop or tool call.'],
      recognize: ['`messages.append({"role": "assistant", "content": text})`.', 'Tool results that the model seems to ignore.'],
      steps: [
        'Append `response.content` verbatim.',
        'Extract display text separately by filtering `block.type == "text"`.',
        'Pass thinking blocks back unchanged when continuing on the same model.',
      ],
      complexity: 'Free. Prevents an entire category of broken loops.',
      gotchas: [
        'Flattening drops `tool_use` blocks, so the next `tool_result` has no `tool_use_id` to attach to.',
        'It also drops compaction blocks, silently disabling server-side history management.',
      ],
      problems: ['Break a tool loop by flattening history', 'Then fix it'],
    },
    {
      id: 'error-chain',
      name: 'Catch a Chain, Not One Class',
      oneLiner: 'Retryable and non-retryable failures need different code paths.',
      useWhen: ['Any call that reaches production.'],
      recognize: ['A single `except Exception`.', 'Retry loops that hammer a 400 forever.'],
      steps: [
        'Order the handlers most specific first: NotFound, BadRequest, RateLimit, APIStatusError, APIConnectionError.',
        'Never retry a 4xx other than 429.',
        'Set the client timeout below your own deadline and account for retry multiplication.',
      ],
      complexity: 'Twelve lines, once, in a shared client wrapper.',
      gotchas: [
        'String-matching error messages breaks on the next wording change — use the typed classes.',
        '`timeout × (max_retries + 1)` is your real worst case.',
      ],
      problems: ['Trigger each error class deliberately', 'Verify no 400 is ever retried'],
    },
    {
      id: 'log-usage-always',
      name: 'Log `usage` on Every Call',
      oneLiner: 'Four token counters at four different prices. Capture them from day one.',
      useWhen: ['From the first call you ship.'],
      recognize: ['A cost surprise nobody can attribute.', 'No way to tell whether caching is working.'],
      steps: [
        'Log input, cached-read, cache-creation and output tokens plus `stop_reason` and latency.',
        'Compute a per-request cost and aggregate it per feature.',
        'Alert when `cache_read_input_tokens` collapses to zero — something invalidated the prefix.',
      ],
      complexity: 'One structured log line per request.',
      gotchas: [
        'Output tokens include thinking tokens; a rising effort level shows up here.',
        'Aggregate per feature, not per service, or you cannot tell which page is expensive.',
      ],
      problems: ['Add cost logging and a dashboard', 'Alert on a cache-hit-rate drop'],
    },
  ],

  pitfalls: [
    { title: 'Putting the system prompt in `messages`', text: 'It is a top-level `system` field. As a message it loses its role and its cache position.' },
    { title: 'Appending extracted text as the assistant turn', text: 'Loses thinking, tool_use and compaction blocks. Append the list.' },
    { title: 'Reading `response.content[0].text`', text: 'Block zero is often an empty thinking block.' },
    { title: 'Appending a date to the model id', text: 'Current ids are complete. A suffix gives you a 404.' },
    { title: 'One broad `except`', text: 'Conflates a permanent 400 with a transient 529.' },
    { title: 'Retrying a 400', text: 'It will fail identically forever. Fix the request.' },
    { title: 'A client timeout above your own deadline', text: 'Your service gives up while the SDK is still patiently retrying.' },
    { title: 'Re-uploading the same document every request', text: 'Use the Files API; it also keeps your cache prefix stable.' },
    { title: 'Citations plus a JSON schema in one request', text: 'Returns a 400. Split it into two calls.' },
    { title: 'Not logging `usage`', text: 'You will be asked to explain the bill, and you will not be able to.' },
    { title: 'Assuming a missing env var means no credentials', text: 'A CLI profile or auth token may already be active. Check `ant auth status`.' },
  ],

  cheatsheet: [
    { label: 'Endpoint', value: '`POST /v1/messages` — one, for everything' },
    { label: 'Required', value: '`model`, `max_tokens`, `messages`' },
    { label: 'System prompt', value: 'top-level `system`, not a message' },
    { label: 'First message', value: 'must be `user`' },
    { label: 'Tool results', value: 'go in a `user` turn' },
    { label: 'History', value: 'append `response.content`, the whole list' },
    { label: 'Extract text', value: 'filter `block.type == "text"`' },
    { label: 'Chat cost', value: 'O(n²) in turns — cache and compact' },
    { label: 'PDFs', value: 'document block before the text block' },
    { label: 'Reused files', value: '`client.files.upload` → `file_id`' },
    { label: 'Citations', value: 'all documents or none; no JSON schema' },
    { label: 'Retry', value: '429, 5xx, connection errors only' },
    { label: 'Never retry', value: '400, 401, 403, 404, 413' },
    { label: 'Worst case', value: '`timeout × (max_retries + 1)`' },
    { label: 'Default model', value: '`claude-opus-5`' },
    { label: 'Log always', value: '`usage` + `stop_reason` + latency' },
  ],

  problems: [
    { name: 'Make one call and print every field of the response', difficulty: 'Easy', pattern: 'Response shape', insight: 'Dump `id`, `model`, `stop_reason`, `stop_details`, `usage` and each content block’s type. Ten minutes here saves a week of confusion later.' },
    { name: 'Build a three-turn conversation by hand', difficulty: 'Easy', pattern: 'Statelessness', insight: 'Maintain the list yourself and watch `input_tokens` climb each turn. That climb is the O(n²) you will spend the context chapter defeating.' },
    { name: 'Break history by appending a string', difficulty: 'Easy', pattern: 'Content blocks', insight: 'Append only extracted text as the assistant turn, then try to continue a tool call. It fails, and the failure message teaches you why blocks matter.' },
    { name: 'Ask a PDF a question', difficulty: 'Easy', pattern: 'Documents', insight: 'Base64 a real contract, put the document block before the text block, and ask for a clause. Then move it to the Files API and compare request size.' },
    { name: 'Turn on citations and read the locations', difficulty: 'Medium', pattern: 'Citations', insight: 'Enable citations and print `cited_text` with its page number. Then add a JSON schema to the same request and read the 400 — the incompatibility is worth meeting once.' },
    { name: 'Trigger five error classes on purpose', difficulty: 'Medium', pattern: 'Error taxonomy', insight: 'A bad model id, a removed parameter, an oversized prompt, a bad key. Write the handler chain and confirm no 400 is ever retried.' },
    { name: 'Add per-request cost logging', difficulty: 'Medium', pattern: 'Cost observability', insight: 'One structured line with all four token counters and a computed cost. Aggregate by feature. This is the artefact every cost conversation needs.' },
    { name: 'Make retries blow your own deadline', difficulty: 'Medium', pattern: 'Timeouts', insight: 'Set `timeout=120, max_retries=3` behind a handler with a 30-second budget and induce 529s. Then fix the arithmetic.' },
    { name: 'Price the same task on three model tiers', difficulty: 'Hard', pattern: 'Model selection', insight: 'Run fifty real inputs on Opus, Sonnet and Haiku. Record cost, latency and correctness. Report cost per *correct* answer — the ranking often reverses.' },
    { name: 'Build a reusable client wrapper', difficulty: 'Hard', pattern: 'Production shape', insight: 'One module with the error chain, usage logging, a prompt-version tag, streaming and a stop-reason branch. Every later chapter plugs into it instead of reinventing it.' },
  ],
}
