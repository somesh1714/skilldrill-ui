export default {
  id: 'ai-inference',
  title: 'Inference, Decoding & the Context Window',
  short: 'Inference & Decoding',
  icon: 'SpeedRounded',
  tier: 'Foundations',
  order: 3,
  estHours: 4,
  prereqs: ['ai-llm-internals'],
  tagline: 'Input is processed in parallel. Output is produced one token at a time. Every latency fact follows from that.',
  mentalModel:
    'A request has **two phases with completely different economics**. Prefill reads your whole prompt in one parallel pass — compute-bound, fast per token, and cacheable. Decode then emits one token per forward pass — memory-bandwidth-bound and unavoidably serial. Input is cheap and wide; output is expensive and narrow.',
  whyItMatters:
    'This single asymmetry explains why streaming exists, why a 50k-token prompt is fine but a 5k-token answer is slow, why prompt caching pays for itself immediately, and why "make it faster" almost always means "make it say less". It is also the first thing to reach for when someone reports the model is slow.',

  reference: {
    title: 'Prefill versus decode',
    head: ['', 'Prefill (your prompt)', 'Decode (the answer)'],
    rows: [
      ['Work per token', 'One matrix multiply over all tokens at once', 'A full forward pass **per token**'],
      ['Parallelism', 'Fully parallel', 'Strictly serial'],
      ['Bottleneck', 'Compute (FLOPs)', 'Memory bandwidth'],
      ['Speed', 'Thousands of tokens/sec', 'Tens of tokens/sec'],
      ['Cacheable', '**Yes** — prompt caching lives here', 'No'],
      ['Price', 'Lower per token', '~5× the input price'],
      ['Latency it controls', 'Time to first token', 'Everything after that'],
    ],
  },

  sections: [
    {
      id: 'two-phases',
      title: 'The two phases, drawn',
      blocks: [
        {
          t: 'ascii',
          caption: 'One request. The left half is wide and quick; the right half is a single-file queue.',
          code: `
  PREFILL — the whole prompt, one pass, all positions at once
  ┌────────────────────────────────────────────────────────────┐
  │  system prompt │ history │ retrieved docs │ user question   │
  │  ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼   │  ← parallel
  │  every token computes its keys and values simultaneously    │
  └────────────────────────────────────────────────────────────┘
                              │
                        KV cache filled
                              │
  DECODE — one token per forward pass, forever
  ┌────────────────────────────────────────────────────────────┐
  │  pass 1 → "The"      pass 2 → " answer"    pass 3 → " is"   │
  │     ▼                    ▼                     ▼            │
  │  each pass reads the ENTIRE KV cache, appends one entry      │  ← serial
  └────────────────────────────────────────────────────────────┘

  TIME TO FIRST TOKEN (TTFT)  = prefill  ≈ grows with prompt length
  TOKENS PER SECOND (TPS)     = decode   ≈ roughly constant per model
  TOTAL                       = TTFT + (output tokens ÷ TPS)

  Worked example, order-of-magnitude:
      20,000-token prompt, 800-token answer
      prefill ≈ 0.6 s      decode ≈ 800 ÷ 60 ≈ 13 s
      → the answer length dominates by 20×.
      Halving the prompt saves 0.3 s. Halving the answer saves 6.5 s.`,
        },
        {
          t: 'key',
          title: 'To make it feel faster, shorten the output — not the prompt',
          text: 'Teams instinctively trim the prompt when latency complaints arrive. That optimises the wrong phase. Ask for a shorter answer, cap `max_tokens`, return structured fields instead of prose, lower the effort level, and **stream** so the user sees the first token instead of waiting for the last one. Prompt trimming helps the bill and the context budget; it barely touches wall-clock.',
        },
      ],
    },
    {
      id: 'kv-cache',
      title: 'The KV cache: why decoding is possible at all',
      blocks: [
        {
          t: 'p',
          text: 'Every decode step needs the keys and values of all preceding tokens. Recomputing them each step would make generation quadratic in the worst way. Because of causal masking, a token’s key and value never change once computed — so they are computed once and kept.',
        },
        {
          t: 'ascii',
          caption: 'Without the cache, generating n tokens is O(n³) work. With it, O(n²).',
          code: `
  NAIVE — recompute everything every step
    step 1:  forward pass over 1000 tokens
    step 2:  forward pass over 1001 tokens
    step 3:  forward pass over 1002 tokens      ← 99.9% is repeated work
    ...

  WITH THE KV CACHE
    prefill:  compute K,V for all 1000 tokens → store
    step 1:   compute K,V for ONE new token → append → attend over 1001
    step 2:   compute K,V for ONE new token → append → attend over 1002
    ...

  The cost of the cache is GPU memory, and it is linear in context:
      per token ≈ 2 (K and V) × layers × kv_heads × head_dim × bytes

  That memory is the real reason a provider caps concurrency on long
  contexts — and the reason grouped-query attention exists: several query
  heads share one key/value head, shrinking the cache several-fold with
  almost no quality loss.`,
        },
        {
          t: 'note',
          title: 'This is a different cache from prompt caching',
          text: 'The KV cache lives inside one request and dies with it. **Prompt caching** is a product feature that persists the prefill result *across* requests, so a stable prefix you send repeatedly is not re-processed. Same underlying mechanism, entirely different lifetime — and prompt caching is the single biggest cost lever you have. It gets its own chapter.',
        },
      ],
    },
    {
      id: 'decoding',
      title: 'Decoding: turning a distribution into a token',
      blocks: [
        {
          t: 'p',
          text: 'Each step hands you ~100k logits. A **decoding strategy** picks one token from that. The classic knobs are worth understanding even where the API no longer exposes them, because they explain the behaviour you observe.',
        },
        {
          t: 'ascii',
          caption: 'Temperature reshapes the distribution before sampling; top-p and top-k truncate its tail.',
          code: `
  raw probabilities after softmax
      " Paris"  0.62   ████████████████████████
      " Lyon"   0.11   ████
      " the"    0.09   ███
      " a"      0.05   ██
      ~100k others, tiny

  TEMPERATURE  — divide the logits by T before softmax
      T = 0.0   ▶ always " Paris"            deterministic-ish, repetitive
      T = 0.7   ▶ " Paris" ~75% of the time  the usual default for prose
      T = 1.5   ▶ genuinely might say " the" creative, and often incoherent

  TOP-K = 3    ▶ keep the 3 best, renormalise, sample
  TOP-P = 0.9  ▶ keep the smallest set whose probabilities sum to 0.9
                 (adaptive: 2 candidates when confident, 40 when not —
                  which is why top-p is preferred over top-k)

  GREEDY (T=0) is NOT determinism:
      batched GPU kernels reduce floating-point values in a
      non-deterministic order, so ties and near-ties can flip.
      Never build a system that requires byte-identical output.`,
        },
        {
          t: 'warn',
          title: 'Current frontier models have removed the sampling knobs',
          text: 'On the current Claude generation, `temperature`, `top_p` and `top_k` are **rejected with a 400** — they are gone, not defaulted. Reasoning-trained models are tuned for a specific sampling regime, and letting callers perturb it degraded them. You now control the model’s behaviour through `output_config.effort`, the prompt, and structured output constraints. If you find a tutorial reaching for `temperature=0` to make output stable, the modern equivalent is a **schema**: constrain the shape rather than flatten the distribution.',
        },
        {
          t: 'compare',
          left: {
            title: 'What you actually control now',
            items: [
              '`output_config.effort` — how much thinking and how many tokens',
              '`max_tokens` — a hard ceiling on the answer',
              '`output_config.format` — a JSON schema the output must satisfy',
              '`strict: true` on tools — arguments guaranteed to validate',
              '`stop_sequences` — stop when a marker appears',
              'The prompt itself — by far the strongest lever',
            ],
          },
          right: {
            title: 'What no longer exists on current models',
            items: [
              '`temperature` — 400 error',
              '`top_p` / `top_k` — 400 error',
              '`thinking.budget_tokens` — 400 error; use effort',
              'Assistant prefill (putting words in its mouth) — 400 error',
              '"Set temperature to 0 for reproducibility" — never worked, now impossible',
            ],
          },
        },
      ],
    },
    {
      id: 'context-window',
      title: 'The context window is a budget you spend',
      blocks: [
        {
          t: 'p',
          text: 'The context window is the maximum combined size of everything in the request plus everything generated. It is not a target. Filling it is slow, expensive, and measurably worse than filling a third of it with the right material.',
        },
        {
          t: 'ascii',
          caption: 'Five claimants on one budget. Only one of them is the user’s actual question.',
          code: `
  ┌─────────────────────── 1,000,000-token window ─────────────────────┐
  │                                                                     │
  │  system prompt + tool definitions   ██                    (stable → CACHE)
  │  conversation history               ████████              (grows every turn)
  │  retrieved documents                ██████████            (the biggest knob)
  │  the user's question                ▏                     (tiny)
  │  room for thinking + the answer     ████                  (must be reserved)
  │                                                                     │
  └─────────────────────────────────────────────────────────────────────┘

  Two hard rules:
    1. max_tokens is carved OUT of the window. Prompt + max_tokens must fit.
    2. On a long conversation, history growth is silent and superlinear in
       cost — turn 30 resends turns 1–29 every single time.

  Three failure modes, in order of how often they bite:
    • the request 400s because prompt + max_tokens exceeds the window
    • some middleware silently truncated the history and told nobody
    • it all fits, but the key fact sits in the middle and is used poorly`,
        },
        {
          t: 'code',
          lang: 'python',
          caption: 'Budget explicitly rather than discovering the limit in production',
          code: `
WINDOW      = 1_000_000      # confirm per model via the Models API
RESERVE_OUT = 16_000         # what you will pass as max_tokens
SAFETY      = 2_000          # tokenizer drift, tool schemas, wrappers

budget = WINDOW - RESERVE_OUT - SAFETY

used = client.messages.count_tokens(
    model="claude-opus-5", system=system, tools=tools, messages=messages,
).input_tokens

if used > budget:
    # Drop retrieved chunks before dropping conversation history: the user
    # notices amnesia, and usually does not notice one fewer source.
    messages = trim_retrieved_context(messages, target=budget - used)

response = client.messages.create(
    model="claude-opus-5", max_tokens=RESERVE_OUT,
    system=system, tools=tools, messages=messages,
)`,
        },
        {
          t: 'tip',
          title: 'Ask the API what the limits are',
          text: 'Do not hard-code a window from memory or a blog post. `client.models.retrieve("claude-opus-5")` returns `max_input_tokens` (the context window) and `max_tokens` (the output cap) for that exact model. Read them at startup and derive your budget from them, so a model swap does not require a code change.',
        },
      ],
    },
    {
      id: 'streaming',
      title: 'Streaming, and the timeouts that force it',
      blocks: [
        {
          t: 'p',
          text: 'Non-streaming holds the HTTP connection open for the whole generation and hands you one object at the end. Streaming sends server-sent events as tokens are produced. The user-experience argument is obvious; the operational argument is stronger.',
        },
        {
          t: 'ascii',
          caption: 'The same request, felt two ways.',
          code: `
  NON-STREAMING
  ├──────────── 14 s of nothing ────────────┤▓ full response
     user stares at a spinner; a proxy may
     time out; a large max_tokens can exceed
     the SDK's own request timeout

  STREAMING
  ├─0.6s─┤▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓┤
     TTFT   tokens arrive continuously
     perceived latency ≈ TTFT, not total

  Rule: stream whenever the input is long, the output is long, or
  max_tokens is large. For 128k-token outputs the SDKs REQUIRE it —
  a non-streaming request that long will hit an HTTP timeout first.`,
        },
        {
          t: 'code',
          lang: 'python',
          caption: 'Stream for the UI; use the helper when you only want the finished message',
          code: `
# Full event handling — what a chat UI needs
with client.messages.stream(
    model="claude-opus-5",
    max_tokens=64000,
    messages=[{"role": "user", "content": "Explain the outbox pattern."}],
) as stream:
    for text in stream.text_stream:
        print(text, end="", flush=True)

    final = stream.get_final_message()     # assembled Message, with usage

print()
print(final.usage.input_tokens, final.usage.output_tokens)

# Batch job with a big max_tokens: stream to dodge the timeout, but
# do not bother handling events.
with client.messages.stream(model="claude-opus-5", max_tokens=64000,
                            messages=msgs) as s:
    result = s.get_final_message()`,
        },
        {
          t: 'warn',
          title: 'Do not rebuild what the SDK gives you',
          text: 'Wrapping stream events in a hand-rolled promise to reassemble the message is a classic waste of an afternoon and a source of subtle bugs around tool-use blocks and thinking blocks. `get_final_message()` does it correctly, including partial JSON accumulation for tool arguments.',
        },
      ],
    },
    {
      id: 'stop-reasons',
      title: 'Always read the stop reason',
      blocks: [
        {
          t: 'p',
          text: 'A response is not "the text". It is a structured object whose `stop_reason` tells you whether you have a complete answer, a truncated one, a request to run a tool, or a refusal. Code that reads `content[0].text` and nothing else will eventually ship a half-sentence to a customer.',
        },
        {
          t: 'table',
          caption: 'Every branch your handler needs.',
          head: ['`stop_reason`', 'Means', 'What your code must do'],
          rows: [
            ['`end_turn`', 'Finished naturally', 'Use the answer'],
            ['`max_tokens`', '**Truncated** mid-thought', 'Raise `max_tokens`, or continue, or surface it — never present it as complete'],
            ['`tool_use`', 'It wants a tool run', 'Execute it and send the result back; this is the agent loop'],
            ['`stop_sequence`', 'Hit one of your markers', 'Treat as complete for your protocol'],
            ['`pause_turn`', 'A long server-side tool paused the turn', 'Send the response back to continue'],
            ['`refusal`', 'Declined on safety grounds', 'Read `stop_details.category`; consider a fallback path'],
          ],
        },
        {
          t: 'code',
          lang: 'python',
          caption: 'The shape every production handler should have',
          code: `
response = client.messages.create(model="claude-opus-5", max_tokens=16000,
                                  messages=msgs)

if response.stop_reason == "refusal":
    # stop_details is populated ONLY for refusals — guard before reading it.
    log.warning("declined: %s", response.stop_details.category)
    return fallback_answer()

if response.stop_reason == "max_tokens":
    log.warning("truncated at %d output tokens", response.usage.output_tokens)
    # Do not render this as a finished answer.

if response.stop_reason == "tool_use":
    return run_tools_and_continue(response)

text = "".join(b.text for b in response.content if b.type == "text")`,
        },
        {
          t: 'trap',
          title: '`content` is a list of blocks, not a string',
          text: 'One response can contain a thinking block, several text blocks and several `tool_use` blocks. `content[0]` is whichever came first — often the thinking block, which may be empty. Always filter by `block.type`. Assuming `content[0].text` is the answer is the single most common first-week bug.',
        },
      ],
    },
    {
      id: 'throughput',
      title: 'Latency versus throughput: different problems',
      blocks: [
        {
          t: 'p',
          text: 'Making one request fast and making ten thousand requests cheap are opposite optimisations. Know which one you have before you tune anything.',
        },
        {
          t: 'table',
          caption: 'Pick the lever that matches the shape of the problem.',
          head: ['Goal', 'Lever', 'What it costs you'],
          rows: [
            ['Lower perceived latency', 'Stream; shorten the output; lower the effort', 'Less thorough answers'],
            ['Lower TTFT', 'Prompt caching on the stable prefix; smaller prompt', 'Engineering discipline'],
            ['Faster tokens per second', 'A faster model tier, or fast mode where available', 'Money, or capability'],
            ['Lower cost per request', 'Caching, then shorter output, then a cheaper model', 'Possibly quality — measure it'],
            ['High volume, not urgent', '**Batch API** — roughly half price, asynchronous', 'Results arrive later, in any order'],
            ['Many concurrent users', 'Parallel requests; the provider batches them server-side', 'Rate limits become the ceiling'],
          ],
        },
        {
          t: 'key',
          title: 'Judge cost per completed task, not per request',
          text: 'A cheaper model that needs three attempts, two retries and a fallback is not cheaper. A smaller prompt that loses a retrieved fact and produces a wrong answer is not cheaper. Always measure end to end — tokens *and* success rate — before declaring a saving.',
        },
        {
          t: 'note',
          title: 'Batch work belongs on the Batch API',
          text: 'Nightly summarisation, backfilling classifications, evaluating a dataset: none of these need a synchronous response. Submitting them as a batch is around half the price for identical output. Results come back keyed by your own `custom_id` and **in any order** — key by id, never by position.',
        },
      ],
    },
  ],

  patterns: [
    {
      id: 'shorten-the-output',
      name: 'Optimise the Decode Phase First',
      oneLiner: 'Output tokens dominate latency. Cut those before touching the prompt.',
      useWhen: ['Any latency complaint.'],
      recognize: ['A prompt-trimming project that did not move p95.', 'Answers with a paragraph of preamble before the content.'],
      steps: [
        'Split measured latency into TTFT and decode time.',
        'If decode dominates — it usually does — reduce what the model says.',
        'Ask for fields, not prose. Cap `max_tokens`. Lower the effort level.',
        'Stream, so perceived latency collapses to TTFT.',
      ],
      template: {
        lang: 'python',
        caption: 'Same information, a fifth of the decode time',
        code: `
# Slow: unbounded prose, most of it preamble
"Analyse this support ticket and explain your reasoning in detail."

# Fast: the model emits only what you will actually parse
output_config={"format": {"type": "json_schema", "schema": {
    "type": "object",
    "properties": {
        "category": {"enum": ["billing", "bug", "how-to", "other"]},
        "urgency":  {"enum": ["low", "medium", "high"]},
        "summary":  {"type": "string", "maxLength": 200},
    },
    "required": ["category", "urgency", "summary"],
    "additionalProperties": False,
}}}`,
      },
      complexity: 'Latency roughly linear in output tokens.',
      gotchas: [
        'Cutting output too hard removes the reasoning that made it accurate — measure quality too.',
        'A hard `max_tokens` truncates rather than summarising. Check `stop_reason`.',
      ],
      problems: ['Split latency into TTFT and decode', 'Convert a prose prompt to a schema'],
    },
    {
      id: 'budget-window',
      name: 'Budget the Window Before You Send',
      oneLiner: 'Count tokens, reserve the output, trim retrieval before history.',
      useWhen: ['Any prompt whose size depends on data or conversation length.'],
      recognize: ['Sporadic 400s under load.', 'A model that "forgot" something a middleware quietly dropped.'],
      steps: [
        'Read the real window and output cap from the Models API at startup.',
        'Compute `budget = window − max_tokens − safety`.',
        'Count tokens with `count_tokens` including system and tools.',
        'Over budget? Drop retrieved chunks first, summarise old turns second, and **log every drop**.',
      ],
      complexity: 'One extra API call per request, or an estimate you verify periodically.',
      gotchas: [
        'Tool schemas and system prompts count. People forget both.',
        'Silent truncation is worse than a 400 — at least the error is visible.',
      ],
      problems: ['Trigger a context-limit 400 deliberately', 'Add budget logging to a real handler'],
    },
    {
      id: 'stream-long-work',
      name: 'Stream Anything Long',
      oneLiner: 'Streaming is a timeout defence as much as a UX feature.',
      useWhen: ['Long input, long output, or a large `max_tokens`.'],
      recognize: ['Read timeouts on big requests.', 'A proxy killing the connection at 60 seconds.'],
      steps: [
        'Use the SDK’s streaming context manager.',
        'For a UI, render `text_stream` as it arrives.',
        'For a job, ignore the events and take `get_final_message()`.',
      ],
      complexity: 'No extra tokens. Perceived latency drops to TTFT.',
      gotchas: [
        'Do not hand-assemble the final message from events.',
        'Streaming does not reduce total tokens or total time — only the wait for the first one.',
      ],
      problems: ['Hit a timeout non-streaming, then fix it', 'Measure TTFT versus total'],
    },
    {
      id: 'branch-on-stop-reason',
      name: 'Branch on `stop_reason`, Always',
      oneLiner: 'Six outcomes, not one. Truncation and refusal are not text.',
      useWhen: ['Every single call you make.'],
      recognize: ['`response.content[0].text` in production code.', 'Answers that end mid-sentence in the logs.'],
      steps: [
        'Handle `refusal` (guard `stop_details` — it is null otherwise), `max_tokens`, `tool_use`, then the normal path.',
        'Collect text by filtering `block.type == "text"`, never by index.',
        'Log `usage` on every call so cost is observable from day one.',
      ],
      complexity: 'Six lines. Prevents a class of silent production bugs.',
      gotchas: [
        '`content[0]` is often a thinking block, and it is usually empty.',
        'A truncated answer looks completely plausible right up to where it stops.',
      ],
      problems: ['Force each stop reason deliberately', 'Add a truncation alarm'],
    },
  ],

  pitfalls: [
    { title: 'Trimming the prompt to fix latency', text: 'Decode dominates. Shorten the answer instead.' },
    { title: 'Sending `temperature` to a current model', text: 'It is rejected with a 400. Constrain output with a schema instead.' },
    { title: 'Believing `temperature=0` gives reproducibility', text: 'It never did — batched float reductions are not deterministic.' },
    { title: 'Forgetting `max_tokens` is carved out of the window', text: 'Prompt plus reservation must fit, or the request fails.' },
    { title: 'Reading `content[0].text`', text: 'Content is a list of typed blocks. Filter by type.' },
    { title: 'Ignoring `stop_reason`', text: 'Truncated and refused responses look like normal ones until you look.' },
    { title: 'Reading `stop_details` unconditionally', text: 'It is populated only for refusals; otherwise it is null.' },
    { title: 'Non-streaming with a huge `max_tokens`', text: 'You will hit an HTTP timeout before the model finishes.' },
    { title: 'Hand-assembling a message from stream events', text: 'Use `get_final_message()`; the SDK handles tool and thinking blocks.' },
    { title: 'Filling the window because it is large', text: 'Slower, dearer, and the middle of a huge prompt is used least well.' },
    { title: 'Using the synchronous API for a nightly job', text: 'The Batch API is about half the price for the same output.' },
  ],

  cheatsheet: [
    { label: 'Prefill', value: 'parallel, compute-bound, cacheable' },
    { label: 'Decode', value: 'serial, bandwidth-bound, ~5× the price' },
    { label: 'TTFT', value: 'grows with prompt length' },
    { label: 'Total', value: 'TTFT + output ÷ TPS' },
    { label: 'Latency lever', value: 'fewer output tokens' },
    { label: 'Cost lever', value: 'prompt caching, then output length' },
    { label: 'KV cache', value: 'per-request; linear memory in context' },
    { label: 'Prompt cache', value: 'across requests; the big cost win' },
    { label: 'temperature / top_p', value: 'removed — 400 on current models' },
    { label: 'Shape control', value: '`output_config.format`, `strict: true`' },
    { label: 'Depth control', value: '`output_config.effort`' },
    { label: 'Window check', value: '`models.retrieve()` → `max_input_tokens`' },
    { label: 'Stream when', value: 'long in, long out, big `max_tokens`' },
    { label: 'Stream helper', value: '`get_final_message()`' },
    { label: 'Always read', value: '`stop_reason` and `usage`' },
    { label: 'Bulk work', value: 'Batch API, ~50% off' },
  ],

  problems: [
    { name: 'Measure TTFT and tokens per second', difficulty: 'Easy', pattern: 'Latency split', insight: 'Time the first streamed chunk and the last. Two numbers, and from then on every latency conversation is concrete instead of anecdotal.' },
    { name: 'Plot latency against prompt length', difficulty: 'Easy', pattern: 'Prefill', insight: 'Fix the output length and pad the prompt to 1k, 10k, 100k. TTFT rises; total barely moves. That is the whole argument for optimising decode.' },
    { name: 'Plot latency against output length', difficulty: 'Easy', pattern: 'Decode', insight: 'Fix the prompt and ask for 50, 500 and 5000 tokens. Near-perfectly linear. Compare the slope with the prompt-length experiment.' },
    { name: 'Send `temperature` and read the error', difficulty: 'Easy', pattern: 'Removed knobs', insight: 'The 400 message is worth seeing once. Then get the stability you wanted from a JSON schema instead.' },
    { name: 'Force all six stop reasons', difficulty: 'Medium', pattern: 'Stop reasons', insight: 'Tiny `max_tokens` for truncation, a tool definition for `tool_use`, a stop sequence, and so on. Write the handler that covers every branch.' },
    { name: 'Hit the context limit on purpose', difficulty: 'Medium', pattern: 'Window budget', insight: 'Pad until prompt plus `max_tokens` exceeds the window. Read the error. Then add the pre-flight budget check that turns it into a graceful trim.' },
    { name: 'Make a long request time out, then stream it', difficulty: 'Medium', pattern: 'Streaming', insight: 'Ask for 100k tokens non-streaming and watch the client give up. The same request streams fine. This is why the SDKs insist on it.' },
    { name: 'Convert a prose prompt into a schema and re-measure', difficulty: 'Medium', pattern: 'Output shape', insight: 'A classification prompt that wrote three paragraphs now emits three fields. Compare latency, tokens and parse reliability. Usually a 5–10× improvement on all three.' },
    { name: 'Compare effort levels on cost and latency', difficulty: 'Hard', pattern: 'Effort', insight: 'Run fifty real requests at low, medium, high and xhigh. Record accuracy, output tokens and p95. Find the level where accuracy stops improving — that is your default, and almost nobody measures it.' },
    { name: 'Move a nightly job to the Batch API', difficulty: 'Hard', pattern: 'Throughput', insight: 'Submit a thousand requests with `custom_id`s, poll until ended, and key results by id. Confirm the halved cost and confirm your code does not assume ordering.' },
  ],
}
