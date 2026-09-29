export default {
  id: 'ai-production',
  title: 'Shipping to Production: Cost, Latency & Reliability',
  short: 'Production',
  icon: 'RocketLaunchRounded',
  tier: 'Elite',
  order: 21,
  estHours: 5,
  prereqs: ['ai-safety'],
  tagline: 'A demo has one user and no budget. Production has neither of those luxuries.',
  mentalModel:
    'An LLM feature in production is **a slow, expensive, non-deterministic dependency that sometimes refuses**. Treat it like any other third-party service you do not control: budget for it, cache in front of it, time it out, degrade gracefully when it fails, and instrument everything. Nothing in this chapter is specific to AI — it is ordinary service engineering applied to a component with unusual cost and variance.',
  whyItMatters:
    'The gap between "it works on my machine" and "it works for ten thousand users at a margin the business accepts" is where most AI features die. This chapter is the list of things that turn out to matter, in roughly the order they bite.',

  reference: {
    title: 'The levers, in the order to pull them',
    head: ['Lever', 'Typical effect', 'Costs you'],
    rows: [
      ['**Prompt caching**', '**Up to ~90% off the cached prefix**', 'Nothing. Do this first'],
      ['**Shorter output**', 'Large on both latency and cost', 'Possibly detail — measure'],
      ['**Trim the input**', 'Proportional, and often better quality', 'Engineering time'],
      ['**Batch API for async work**', '~50% off', 'Results arrive later'],
      ['**Semantic / exact response cache**', 'Free on a repeat hit', 'Staleness risk'],
      ['**Lower the effort level**', 'Meaningful on reasoning-heavy work', 'Quality on hard tasks'],
      ['**Cheaper model per step**', 'Large', 'Quality — needs an eval'],
      ['Fewer agent steps', 'Large in agent loops', 'Capability'],
      ['A smaller context window', 'Nothing directly', 'It is not a billed dimension'],
    ],
  },

  sections: [
    {
      id: 'cost',
      title: 'Cost: find the number before you optimise',
      blocks: [
        {
          t: 'p',
          text: 'Most cost work starts with a guess and optimises the wrong thing. The first step is always a token profile: where the tokens actually go, per feature and per step.',
        },
        {
          t: 'ascii',
          caption: 'A real profile. Note that the expensive thing is rarely the thing people blame.',
          code: `
  SUPPORT REPLY FEATURE — 10,000 requests/day, measured
  ┌──────────────────────────────────────────────────────────────────┐
  │ STEP        MODEL   IN      CACHED  OUT    $/req    % of bill     │
  ├──────────────────────────────────────────────────────────────────┤
  │ classify    haiku      900      0     40   $0.0011      2%        │
  │ retrieve    —            0      0      0   $0.0000      0%        │
  │ rerank      haiku    9,400      0    320   $0.0110     18%        │
  │ compose     opus     2,100 18,000    850   $0.0410     67%        │
  │ check       haiku    1,400      0     90   $0.0019      3%        │
  │ guardrail   haiku    1,100      0     30   $0.0016      3%        │
  │ (retries)                                  $0.0043      7%        │
  ├──────────────────────────────────────────────────────────────────┤
  │ TOTAL                                      $0.0609    100%        │
  │                                     × 10,000/day  = $609/day      │
  │                                                   = $18k/month    │
  └──────────────────────────────────────────────────────────────────┘

  WHAT THE PROFILE TELLS YOU, in order:
    1. compose is 67% → every optimisation effort belongs there first
    2. its 18,000 cached tokens are already ~90% off. Without caching
       this feature would cost roughly $2,300/day instead of $609
    3. rerank is 18% for 9,400 input tokens → truncate the passages
    4. retries are 7% → that is a QUALITY problem showing up as a
       cost problem. Fix the cause, not the budget
    5. classify, check and guardrail together are 8% → leave them alone

  WITHOUT this table, the instinct is "switch to a cheaper model", which
  would attack the 67% by trading the only quality the user actually sees.`,
        },
        {
          t: 'code',
          lang: 'python',
          caption: 'The instrumentation that produces the table',
          code: `
PRICES = {   # $ per million tokens: (input, cache_write, cache_read, output)
    "claude-opus-5":   (5.00,  6.25,  0.50, 25.00),
    "claude-sonnet-5": (2.00,  2.50,  0.20, 10.00),
    "claude-haiku-4-5":(1.00,  1.25,  0.10,  5.00),
}

def cost_of(model: str, usage) -> float:
    pin, pwrite, pread, pout = PRICES[model]
    return (usage.input_tokens * pin
            + usage.cache_creation_input_tokens * pwrite
            + usage.cache_read_input_tokens * pread
            + usage.output_tokens * pout) / 1e6


def record(feature: str, step: str, model: str, response, elapsed_ms: int):
    u = response.usage
    metrics.observe("llm.cost_usd", cost_of(model, u),
                    tags={"feature": feature, "step": step, "model": model})
    metrics.observe("llm.latency_ms", elapsed_ms,
                    tags={"feature": feature, "step": step})
    metrics.observe("llm.cache_hit_rate",
                    u.cache_read_input_tokens
                    / max(u.input_tokens + u.cache_read_input_tokens, 1),
                    tags={"feature": feature, "step": step})
    metrics.incr(f"llm.stop_reason.{response.stop_reason}",
                 tags={"feature": feature, "step": step})

# Tag by FEATURE and STEP, not by service. "The AI service costs $18k"
# starts an argument; "the compose step of support replies costs $12k and
# here is why" starts a piece of work.`,
        },
        {
          t: 'key',
          title: 'Cost per completed task, never cost per call',
          text: 'A cheaper model that needs two attempts, a longer prompt, or a fallback is not cheaper. An agent whose steps are individually cheap but which takes fourteen of them is not cheap. Always divide by *successful outcomes*. This one change of denominator reverses a surprising number of confident cost conclusions.',
        },
        {
          t: 'table',
          caption: 'Cost work in order. Do not skip to the bottom.',
          head: ['#', 'Do this', 'Why it is in this position'],
          rows: [
            ['1', 'Profile per feature and per step', 'Everything else is guessing without it'],
            ['2', 'Cache the stable prefix, verify the hit rate', 'Free, and usually the largest single win'],
            ['3', 'Shorten output — schemas, `maxLength`, `max_tokens`', 'Output is ~5× input; also the biggest latency lever'],
            ['4', 'Trim the input — truncate tool results and passages', 'Often improves quality at the same time'],
            ['5', 'Move async work to the Batch API', '~50% off for identical output'],
            ['6', 'Fix the retry rate', 'A quality problem presenting as a cost problem'],
            ['7', 'Lower the effort level where quality holds', 'First lever that trades quality — needs an eval'],
            ['8', 'Cheaper model per step, measured', 'Last, and only per step, never globally'],
          ],
        },
      ],
    },
    {
      id: 'latency',
      title: 'Latency: what users actually feel',
      blocks: [
        {
          t: 'ascii',
          caption: 'The same pipeline, felt two ways. Perceived latency is the number that matters.',
          code: `
  NAIVE — everything serial, nothing streamed
  ├─classify─┤├─────retrieve─────┤├──rerank──┤├───────compose───────┤├check┤
  0        0.4                1.2         1.6                     9.8   10.4s
                          user sees nothing for 10.4 seconds

  OPTIMISED — parallel where possible, streamed at the end
  ├─classify─┤
  ├──retrieve (parallel with classify)──┤
                                        ├──rerank──┤
                                                   ├─compose, STREAMED──▶
  0        0.4                          1.0      1.3                1.9s
                                            first token at 1.9s
                                            complete at 8.7s
                     perceived latency: 1.9s, not 10.4s

  THE FOUR MOVES, in order of effect:
    1. STREAM the final generation           → perceived = TTFT
    2. PARALLELISE independent steps         → 10.4s → 8.7s wall-clock
    3. SHORTEN the output                    → the only way to cut total
    4. CACHE the prefix                      → lowers TTFT as well as cost

  AND ONE MORE: show progress for the non-streamable part. "Searching
  your orders…" during the 1.9s of pipeline is worth more than 300ms of
  optimisation, and costs nothing.`,
        },
        {
          t: 'code',
          lang: 'python',
          caption: 'Parallelise the independent steps, stream the last one',
          code: `
async def answer(question: str, session):
    # Independent: run together rather than in sequence.
    classification, passages = await asyncio.gather(
        classify(question),
        retrieve(question, session),
    )

    ranked = await rerank(question, passages, keep=5)

    # Stream the expensive final step so perceived latency is TTFT.
    async with client.messages.stream(
        model="claude-opus-5", max_tokens=4000,
        system=CACHED_SYSTEM_BLOCKS,
        messages=build_messages(question, ranked, classification),
    ) as stream:
        async for text in stream.text_stream:
            yield text
        final = await stream.get_final_message()

    record("support", "compose", "claude-opus-5", final, elapsed_ms())`,
        },
        {
          t: 'table',
          caption: 'Which lever for which symptom.',
          head: ['Symptom', 'Cause', 'Lever'],
          rows: [
            ['Long wait, then everything at once', 'Not streaming', '**Stream.** Biggest perceived win available'],
            ['High TTFT', 'Big prompt, or a cold cache', 'Cache the prefix; trim the input'],
            ['Slow after the first token', 'Long output', 'Schemas, `maxLength`, lower effort'],
            ['p99 far above p50', 'Retries, or variable output length', 'Cap `max_tokens`; investigate the retry rate'],
            ['Slow pipeline before generation', 'Serial independent steps', 'Parallelise; show progress'],
            ['An agent that slows as it works', 'Context explosion', 'Compact tool output; clear spent results'],
            ['Occasional very slow request', 'A timeout being retried', 'Lower the client timeout below your deadline'],
          ],
        },
        {
          t: 'warn',
          title: 'Timeout budgets multiply, and the arithmetic surprises people',
          text: 'A client timeout of 120 seconds with three retries is up to eight minutes of wall-clock inside a handler that may have a thirty-second deadline. Your service gives up while the SDK is still patiently waiting. Set the client timeout to a fraction of your own deadline, size retries to fit, and remember the units differ per SDK — seconds in Python and Ruby, milliseconds in TypeScript.',
        },
      ],
    },
    {
      id: 'reliability',
      title: 'Reliability: it will fail, so decide how',
      blocks: [
        {
          t: 'p',
          text: 'The model API is a dependency that will be slow, rate-limited, occasionally overloaded, and sometimes will decline. Every one of those needs a decided behaviour — decided in advance, not improvised during an incident.',
        },
        {
          t: 'ascii',
          caption: 'A degradation ladder. Each rung is a product decision, so write it down.',
          code: `
  NORMAL
    full pipeline, Opus compose, streamed
        │ rate limited, or p95 latency breached
        ▼
  DEGRADED 1 — shed the optional work
    drop reranking, retrieve 5 instead of 40, skip the guardrail model
    (keep the deterministic checks — those are not optional)
        │ still failing
        ▼
  DEGRADED 2 — smaller model
    compose on Sonnet or Haiku. Worse, and far better than nothing.
        │ still failing
        ▼
  DEGRADED 3 — no model
    retrieval-only: show the top 3 passages with a note that the
    assistant is unavailable. Genuinely useful, and needs no model.
        │ retrieval also unavailable
        ▼
  FAIL CLOSED
    an honest message and a route to a human.
    NEVER a fabricated answer, never a silent empty state.

  ┌───────────────────────────────────────────────────────────────┐
  │ Write this ladder down before launch and make each rung a      │
  │ config flag you can set without a deploy. During an incident   │
  │ you want to turn a dial, not make a decision.                  │
  └───────────────────────────────────────────────────────────────┘`,
        },
        {
          t: 'code',
          lang: 'python',
          caption: 'A circuit breaker and the degradation ladder as code',
          code: `
class ModelCircuit:
    """Stop hammering a failing dependency; recover automatically."""
    def __init__(self, threshold: int = 5, cooldown_s: int = 30):
        self.failures = 0
        self.opened_at: float | None = None
        self.threshold, self.cooldown = threshold, cooldown_s

    def allow(self) -> bool:
        if self.opened_at is None:
            return True
        if time.monotonic() - self.opened_at > self.cooldown:
            self.opened_at, self.failures = None, 0   # half-open: try again
            return True
        return False

    def record(self, ok: bool) -> None:
        if ok:
            self.failures = 0
            return
        self.failures += 1
        if self.failures >= self.threshold:
            self.opened_at = time.monotonic()
            alert.page("model circuit opened")


async def answer_resilient(question: str, session):
    if not circuit.allow() or load_shedding_active():
        return retrieval_only(question, session)      # degraded 3

    try:
        return await full_pipeline(question, session)

    except anthropic.RateLimitError:
        metrics.incr("llm.rate_limited")
        return await cheap_pipeline(question, session)  # degraded 2

    except (anthropic.InternalServerError, anthropic.APIConnectionError):
        circuit.record(ok=False)
        return retrieval_only(question, session)        # degraded 3

    except anthropic.BadRequestError as e:
        # Never retry: it will fail identically. Alert — this is a bug.
        alert.error("malformed request", detail=e.message)
        return fail_closed()`,
        },
        {
          t: 'table',
          caption: 'Every failure mode, and the decided behaviour.',
          head: ['Failure', 'Frequency', 'Behaviour'],
          rows: [
            ['429 rate limited', 'Common at scale', 'Retry with jitter, then degrade. Queue async work'],
            ['529 / 5xx overloaded', 'Occasional', 'Backoff, circuit breaker, degrade'],
            ['Timeout', 'Occasional', 'Degrade. Do not stack retries into your own deadline'],
            ['`stop_reason: "refusal"`', 'Rare, and it happens', 'Log the category, offer a human. Never retry unchanged'],
            ['`max_tokens` truncation', 'A bug in your sizing', 'Never present as complete; raise the limit or shorten the task'],
            ['400 bad request', 'A bug — a removed parameter, an oversized prompt', 'Alert, never retry'],
            ['Valid output, wrong content', '**The common one**', 'Verification, evals, and a feedback channel'],
          ],
        },
        {
          t: 'key',
          title: 'The most common production failure is a plausible wrong answer',
          text: 'Everything above is a visible failure with a status code. The failure that actually damages trust returns HTTP 200 with a fluent, specific, incorrect answer — and no monitor catches it. That is why verification, evals and a thumbs-down channel are reliability infrastructure, not nice-to-haves. Budget for them alongside the retries.',
        },
      ],
    },
    {
      id: 'caching-responses',
      title: 'Caching responses, not just prompts',
      blocks: [
        {
          t: 'p',
          text: 'Prompt caching makes the prefix cheap. A response cache makes the whole call free — and in most products a meaningful fraction of questions are repeats.',
        },
        {
          t: 'ascii',
          caption: 'Three cache layers with different hit rates and different risks.',
          code: `
  LAYER 1 — EXACT MATCH               hit rate ~5-20% in a real product
    key = hash(model, prompt_version, system, messages, tools)
    safe, trivial, and completely free on a hit.
    Scope the key per TENANT and per USER where the answer is personal —
    a cross-user cache hit is a data leak, not an optimisation.

  LAYER 2 — NORMALISED MATCH          hit rate ~10-30%
    lowercase, collapse whitespace, strip punctuation, drop greetings
      "How do I reset my password?"  ─┐
      "how do i reset my password"    ├─▶ the same key
      "Hi! How do I reset my password?"┘
    Still exact after normalisation, so still safe.

  LAYER 3 — SEMANTIC MATCH            hit rate ~20-40%, and risky
    embed the question; serve a cached answer above a similarity cut
      "how do I reset my password"  ≈  "how do I change my password"
                                       ← the SAME answer. Good.
      "how do I reset my password"  ≈  "how do I reset my ROUTER"
                                       ← a DIFFERENT answer. Bad.
    A high threshold (0.95+) plus a reranker check on the pair is the
    only way to use this safely. Log every hit and sample them by hand.

  EVICTION IS THE HARD PART, not lookup:
    • the source document changed  → invalidate by document id
    • the prompt version changed   → the version is in the key
    • the answer is time-sensitive → a short TTL, or do not cache
    • personalised answers         → scope the key, or do not cache`,
        },
        {
          t: 'code',
          lang: 'python',
          caption: 'Exact and normalised caching, with the scoping that keeps it safe',
          code: `
def cache_key(question: str, session, prompt_version: str) -> str:
    normalised = " ".join(re.sub(r"[^\\w\\s]", "", question.lower()).split())
    return hashlib.sha256("|".join([
        prompt_version,
        MODEL,
        session.tenant_id,          # NEVER share a cache across tenants
        session.locale,
        normalised,
    ]).encode()).hexdigest()


async def answer_cached(question: str, session) -> dict:
    # Only cache answers that are the same for everyone in the tenant.
    if is_personalised(question):
        return await answer(question, session)

    key = cache_key(question, session, PROMPT_VERSION)
    if hit := await cache.get(key):
        metrics.incr("llm.cache.response_hit")
        return {**hit, "cached": True}

    result = await answer(question, session)

    if result["trustworthy"]:       # never cache an unverified answer
        await cache.set(key, result, ttl=3600,
                        tags=[f"doc:{c['doc_id']}" for c in result["citations"]])
    return result


async def on_document_changed(doc_id: str) -> None:
    # Tag-based invalidation: every cached answer citing this document goes.
    await cache.invalidate_tag(f"doc:{doc_id}")`,
        },
        {
          t: 'warn',
          title: 'A cross-user cache hit is a data breach',
          text: 'If the answer depends on who is asking — their orders, their entitlements, their data — then a cache keyed only on the question text will serve one user’s answer to another. Put the tenant and, where relevant, the user in the key, or classify the question as personalised and skip the cache entirely. This is the single most dangerous mistake in response caching and it is very easy to make.',
        },
      ],
    },
    {
      id: 'operating',
      title: 'What to monitor, and what to alert on',
      blocks: [
        {
          t: 'table',
          caption: 'Monitor everything; alert on the short list.',
          head: ['Signal', 'Alert?', 'What it means when it moves'],
          rows: [
            ['Error rate by type', '**Yes**', '5xx and timeouts mean the dependency; 400s mean your bug'],
            ['p95 latency per feature', '**Yes**', 'A regression users feel before you hear about it'],
            ['Cost per completed task', '**Yes**', 'The number that gets the feature cancelled if nobody watches it'],
            ['Cache hit rate', '**Yes**', 'A drop to zero is a silently broken prefix'],
            ['Unverified-claim rate', '**Yes**', 'Fabrication, measured — the trust metric'],
            ['Retry / repair rate', '**Yes**', 'A quality regression, or a shift in the inputs'],
            ['Refusal rate by category', 'Yes', 'Usually a change in your input distribution'],
            ['Truncation (`max_tokens`) rate', 'Yes', 'Users are being shown half-answers'],
            ['Escalation rate', 'Yes', 'Scope drift, or a broken tool'],
            ['Tokens per request, by step', 'No — watch it', 'The early warning for the cost alert'],
            ['Thumbs down with comment', 'No — read it weekly', 'The best source of new eval cases'],
          ],
        },
        {
          t: 'steps',
          items: [
            { title: 'Version the prompt and log the version on every request', text: 'Without it you cannot correlate a quality change with a deploy, which is most of debugging.' },
            { title: 'Store full request and response for a sampled fraction', text: 'One percent, with PII redacted, and 100% of failures. You cannot debug what you did not keep.' },
            { title: 'Put a kill switch on every feature and every tool', text: 'Config, not a deploy. During an incident you want to turn things off in seconds.' },
            { title: 'Cap spend per user, per session and per feature', text: 'Runaway loops and abuse look identical in the billing data, and both are stopped by the same cap.' },
            { title: 'Run the eval in CI on every prompt change', text: 'A prompt is code. It gets a test, a diff and a revert.' },
            { title: 'Roll out behind a flag with a canary', text: 'Compare quality, cost and latency on real traffic before going to 100%.' },
            { title: 'Review negative feedback weekly and turn it into eval cases', text: 'Thirty minutes. This is the loop that makes quality improve rather than drift.' },
          ],
        },
        {
          t: 'code',
          lang: 'python',
          caption: 'One log line per request, carrying everything an investigation needs',
          code: `
log.info("llm_request", extra={
    "request_id": request_id,
    "feature": "support_reply",
    "step": "compose",
    "user_id": hashed(session.user_id),
    "tenant_id": session.tenant_id,

    "model": MODEL,
    "prompt_version": PROMPT_VERSION,     # correlate quality with deploys
    "effort": "high",

    "input_tokens": u.input_tokens,
    "cache_read_tokens": u.cache_read_input_tokens,
    "output_tokens": u.output_tokens,
    "cost_usd": round(cost_of(MODEL, u), 6),

    "latency_ms": elapsed,
    "ttft_ms": ttft,
    "stop_reason": response.stop_reason,

    "retrieved_ids": [h["id"] for h in hits],   # RAG debugging
    "citations_verified": verified_count,
    "trustworthy": result["trustworthy"],
    "cached": False,
    "degraded_mode": None,
})`,
        },
        {
          t: 'key',
          title: 'The launch checklist',
          text: 'An eval in CI. Prompt versioned and logged. Per-feature cost, latency and quality dashboards. Alerts on error rate, p95, cost per task, cache hit rate and unverified claims. A written degradation ladder with config flags. Spend caps. Kill switches. Sampled request storage. A weekly feedback review. None of it is exotic — it is the same list you would write for any dependency you cannot control, and it is what makes an AI feature boring to operate.',
        },
        {
          t: 'note',
          title: 'Where to go from here',
          text: 'You now have the whole arc: how the model works, how to prompt and constrain it, how to give it knowledge through retrieval, how to let it act through tools, how to loop it into an agent, how to structure that as a workflow, and how to measure, secure and operate the result. The rest is repetition on real problems — and an eval to tell you whether each change helped.',
        },
      ],
    },
  ],

  patterns: [
    {
      id: 'profile-before-optimising',
      name: 'Profile Per Feature and Per Step First',
      oneLiner: 'Optimising without the table means attacking the wrong 3%.',
      useWhen: ['Any cost or latency concern.'],
      recognize: ['"The AI is expensive."', 'A model downgrade proposed with no per-step numbers.'],
      steps: [
        'Log cost and latency tagged by feature, step and model.',
        'Build the per-step table for a representative day.',
        'Attack the largest row, then re-measure.',
        'Divide by successful outcomes, not by calls.',
      ],
      complexity: 'One decorator and a dashboard.',
      gotchas: [
        'Service-level aggregates hide which feature is expensive.',
        'A high retry rate is a quality problem presenting as a cost problem.',
      ],
      problems: ['Build the per-step cost table', 'Find your 67% step'],
    },
    {
      id: 'stream-and-parallelise',
      name: 'Stream the Last Step, Parallelise the Rest',
      oneLiner: 'Perceived latency becomes time-to-first-token.',
      useWhen: ['Any user-facing multi-step pipeline.'],
      recognize: ['A ten-second blank wait.', 'Independent steps running in sequence.'],
      steps: [
        'Run independent steps concurrently.',
        'Stream the final generation.',
        'Show progress text during the non-streamable pipeline.',
        'Report TTFT separately from total latency.',
      ],
      complexity: 'Perceived latency often falls 5×.',
      gotchas: [
        'Streaming does not reduce total time — only the wait for the first token.',
        'A single p95 number hides a bad TTFT behind a good total.',
      ],
      problems: ['Measure TTFT and total separately', 'Parallelise two independent steps'],
    },
    {
      id: 'degradation-ladder',
      name: 'Write the Degradation Ladder Before Launch',
      oneLiner: 'Four rungs, each a config flag, decided in advance.',
      useWhen: ['Every production LLM feature.'],
      recognize: ['No decided behaviour for a rate limit.', 'A spinner forever when the API is down.'],
      steps: [
        'Define the rungs: full, shed optional work, cheaper model, no model, fail closed.',
        'Make each rung a config flag that needs no deploy.',
        'Add a circuit breaker so a failing dependency is not hammered.',
        'Never fabricate an answer as a fallback, and never show a silent empty state.',
      ],
      complexity: 'A day. Turns an outage into a degraded experience.',
      gotchas: [
        'Retrieval-only is genuinely useful and needs no model — do not skip that rung.',
        'Keep the deterministic guardrails at every rung; they are not optional work.',
      ],
      problems: ['Write and test the ladder', 'Break the API and walk down it'],
    },
    {
      id: 'scoped-response-cache',
      name: 'Cache Responses, Scoped and Tagged',
      oneLiner: 'Free on a hit — and a data leak if the key is wrong.',
      useWhen: ['Any product with repeated questions.'],
      recognize: ['Identical questions answered from scratch all day.', 'A cache key made only of the question text.'],
      steps: [
        'Key on prompt version, model, tenant, locale and the normalised question.',
        'Skip the cache for personalised questions entirely.',
        'Tag entries with the document ids they cite and invalidate by tag on change.',
        'Never cache an unverified answer; log and sample every semantic hit.',
      ],
      complexity: 'A day. Frequently a 10-30% reduction in calls.',
      gotchas: [
        'A cross-user hit serves one person’s data to another.',
        'Semantic matching confuses "reset my password" with "reset my router".',
      ],
      problems: ['Add exact and normalised caching', 'Measure the hit rate, then audit for leaks'],
    },
    {
      id: 'version-and-log-the-prompt',
      name: 'Version the Prompt, Log the Version',
      oneLiner: 'Correlating quality with a deploy is most of debugging.',
      useWhen: ['From the first prompt you ship.'],
      recognize: ['Prompts in a database or an admin UI.', 'No way to say which prompt produced an answer.'],
      steps: [
        'Keep prompts in source control with a version tag.',
        'Log the tag on every request.',
        'Run the eval in CI on every change.',
        'Roll out behind a flag with a canary comparing quality, cost and latency.',
      ],
      complexity: 'Free. Turns quality into something you can bisect.',
      gotchas: [
        'A prompt change alters product behaviour and needs review and revert like any code change.',
        'Without the version in the logs, a regression is unattributable.',
      ],
      problems: ['Add versioning and CI evals', 'Bisect a real quality regression'],
    },
  ],

  pitfalls: [
    { title: 'Optimising before profiling', text: 'You will spend a week on the 3% step.' },
    { title: 'Cost per call instead of per completed task', text: 'Reverses many confident conclusions.' },
    { title: 'Downgrading the model first', text: 'It is the last lever, not the first. Caching is free.' },
    { title: 'Not verifying the cache hit rate', text: 'Caching fails silently and identically.' },
    { title: 'Trimming the prompt to fix latency', text: 'Output dominates. Shorten the answer.' },
    { title: 'Not streaming', text: 'The largest perceived-latency win, left on the table.' },
    { title: 'Serial independent steps', text: 'Free wall-clock, unclaimed.' },
    { title: 'Client timeout above your own deadline', text: 'Your service gives up while the SDK waits.' },
    { title: 'Retrying a 400', text: 'It will fail identically forever.' },
    { title: 'Retrying a refusal unchanged', text: 'Same request, same outcome, more cost.' },
    { title: 'No degradation ladder', text: 'An outage becomes a spinner instead of a reduced experience.' },
    { title: 'Fabricating a fallback answer', text: 'Worse than an honest failure, and harder to detect.' },
    { title: 'A response cache not scoped by tenant', text: 'A data breach dressed as an optimisation.' },
    { title: 'Semantic caching on a low threshold', text: '"Reset my password" and "reset my router" are not the same question.' },
    { title: 'Caching an unverified answer', text: 'You have persisted a fabrication.' },
    { title: 'Prompts outside source control', text: 'Behaviour changes with no diff, no review, no revert.' },
    { title: 'No spend cap per user', text: 'Runaway loops and abuse are indistinguishable and both expensive.' },
    { title: 'No kill switch', text: 'During an incident you want a dial, not a deploy.' },
    { title: 'Monitoring only errors', text: 'The common failure is a fluent wrong answer with a 200 status.' },
  ],

  cheatsheet: [
    { label: 'Step one', value: 'profile per feature and per step' },
    { label: 'Metric', value: 'cost per completed task' },
    { label: 'Lever 1', value: 'prompt caching — free, up to ~90% off' },
    { label: 'Lever 2', value: 'shorter output' },
    { label: 'Lever 3', value: 'trim the input' },
    { label: 'Lever 4', value: 'Batch API, ~50% off' },
    { label: 'Lever 5', value: 'effort level' },
    { label: 'Lever 6 (last)', value: 'cheaper model, per step, measured' },
    { label: 'Perceived latency', value: 'streaming → TTFT' },
    { label: 'Total latency', value: 'only output length cuts it' },
    { label: 'Timeout', value: 'below your own deadline; retries multiply' },
    { label: 'Never retry', value: '400, refusal' },
    { label: 'Ladder', value: 'full → shed → cheap model → retrieval-only → fail closed' },
    { label: 'Never', value: 'fabricate a fallback' },
    { label: 'Response cache key', value: 'version, model, tenant, locale, normalised text' },
    { label: 'Never cache', value: 'personalised or unverified answers' },
    { label: 'Invalidate by', value: 'document-id tags' },
    { label: 'Alert on', value: 'errors, p95, cost/task, cache rate, unverified' },
    { label: 'Log always', value: 'prompt version, usage, stop reason, retrieved ids' },
    { label: 'Weekly', value: 'read the thumbs-down, add eval cases' },
  ],

  problems: [
    { name: 'Build the per-step cost table', difficulty: 'Easy', pattern: 'Profiling', insight: 'A day of real traffic, tagged by feature and step. One step is usually most of the bill, and it is often not the one people blame.' },
    { name: 'Measure TTFT against total latency', difficulty: 'Easy', pattern: 'Latency', insight: 'Two numbers instead of one. Then stream and watch the number users feel collapse while the total stays the same.' },
    { name: 'Verify your cache hit rate is real', difficulty: 'Easy', pattern: 'Caching', insight: 'Log `cache_read_input_tokens` for a day. Teams routinely discover it has been zero for months, with no other symptom.' },
    { name: 'Compute cost per completed task', difficulty: 'Medium', pattern: 'Cost metric', insight: 'Divide by successes rather than calls, including retries and fallbacks. Compare two models on this basis — the ranking sometimes reverses.' },
    { name: 'Parallelise two independent steps', difficulty: 'Medium', pattern: 'Latency', insight: 'Find two calls that do not depend on each other and run them together. Then add progress text and measure what users report, not just what the timer says.' },
    { name: 'Break the API and walk the ladder', difficulty: 'Medium', pattern: 'Degradation', insight: 'Force rate limits and 5xx, and confirm each rung engages. Then confirm the bottom rung is honest rather than fabricated.' },
    { name: 'Add response caching and measure the hit rate', difficulty: 'Medium', pattern: 'Response cache', insight: 'Exact, then normalised. Then audit every hit for cross-user leakage before you enable it — this is the step to be paranoid about.' },
    { name: 'Blow your own deadline with retries', difficulty: 'Medium', pattern: 'Timeouts', insight: 'Set a 120-second timeout with three retries behind a 30-second handler and induce 529s. Then fix the arithmetic and write the rule down.' },
    { name: 'Wire the eval into CI with a canary rollout', difficulty: 'Hard', pattern: 'Release', insight: 'Prompt change → eval runs → flag at 5% → compare quality, cost and latency → ramp. This is what makes prompt changes routine instead of frightening.' },
    { name: 'Write and execute the full launch checklist', difficulty: 'Hard', pattern: 'Readiness', insight: 'Dashboards, alerts, degradation ladder, spend caps, kill switches, sampled storage, weekly review. Do it once properly and it becomes the template for every feature after.' },
  ],
}
