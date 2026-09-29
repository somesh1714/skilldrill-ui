export default {
  id: 'ai-agent-loop',
  title: 'The Agent Loop',
  short: 'Agent Loop',
  icon: 'LoopRounded',
  tier: 'Advanced',
  order: 13,
  estHours: 5,
  prereqs: ['ai-tools'],
  tagline: 'A while-loop around tool use. Everything hard about agents is the stopping condition.',
  mentalModel:
    'An agent is **twelve lines of code**: while the model asks for a tool, run it and ask again. That is genuinely all it is. Everything that makes agents difficult — runaway loops, compounding errors, exploding context, unrecoverable mistakes — comes from the fact that the loop has no natural end and no supervisor unless you write one.',
  whyItMatters:
    'Agents are where LLM systems stop being predictable. A workflow you designed fails in ways you anticipated; an agent fails in ways nobody anticipated, ten steps deep, having already sent an email. Knowing the loop precisely — and knowing every place it must be bounded — is what separates an agent you can deploy from a demo.',

  reference: {
    title: 'Three ways to run the loop',
    head: ['Approach', 'You write', 'Reach for it when'],
    rows: [
      ['**Manual loop**', 'The `while` loop yourself', 'You want total control, or a flow the hooks do not fit'],
      ['**Tool runner** (SDK)', 'Just the tool functions', '**Most cases.** The loop plus per-turn hooks for approval and logging'],
      ['**Managed agents**', 'An agent config and your tool results', 'You want Anthropic to run the loop *and* host the sandbox'],
      ['*(Not this chapter)* Claude Agent SDK', 'A prompt and options', 'You want a batteries-included coding agent on your own infra'],
    ],
  },

  sections: [
    {
      id: 'the-loop',
      title: 'The loop, in full',
      blocks: [
        {
          t: 'ascii',
          caption: 'ReAct — reason, act, observe — is this diagram. The name is grander than the mechanism.',
          code: `
                        ┌───────────────────┐
              ┌────────▶│  call the model   │
              │         │  with tools +     │
              │         │  full history     │
              │         └─────────┬─────────┘
              │                   │
              │                   ▼
              │         ┌───────────────────┐
              │         │  stop_reason?     │
              │         └─────────┬─────────┘
              │                   │
              │      tool_use ◀───┼───▶ end_turn ──▶ DONE, return the answer
              │          │        │
              │          │        └───▶ max_tokens ──▶ truncated: raise limit
              │          │        └───▶ refusal    ──▶ stop, handle it
              │          ▼        └───▶ pause_turn ──▶ resend to continue
              │  ┌───────────────────┐
              │  │ execute the tools │  ← YOUR authorisation boundary
              │  │ (concurrently)    │
              │  └─────────┬─────────┘
              │            │
              │            ▼
              │  ┌───────────────────┐
              └──│ append assistant  │
                 │ turn + ONE user   │
                 │ turn of results   │
                 └───────────────────┘

  THE FOUR THINGS THAT MUST BOUND THIS LOOP:
      1. step limit        — hard cap on iterations
      2. token budget      — cumulative spend ceiling
      3. wall-clock deadline
      4. no-progress detection — the same tool, same arguments, twice

  Ship without all four and you will eventually meet an agent that calls
  the same failing tool four hundred times overnight.`,
        },
        {
          t: 'code',
          lang: 'python',
          caption: 'The manual loop, with every bound in place',
          code: `
from dataclasses import dataclass, field

@dataclass
class Budget:
    max_steps: int = 20
    max_tokens: int = 500_000
    deadline_s: float = 300.0
    spent_tokens: int = 0
    started: float = field(default_factory=time.monotonic)

    def exhausted(self) -> str | None:
        if self.spent_tokens > self.max_tokens:
            return f"token budget exhausted ({self.spent_tokens})"
        if time.monotonic() - self.started > self.deadline_s:
            return "deadline exceeded"
        return None


def run_agent(task: str, session, budget: Budget) -> dict:
    messages = [{"role": "user", "content": task}]
    seen_calls: set[tuple] = set()
    trace = []

    for step in range(budget.max_steps):
        if reason := budget.exhausted():
            return {"status": "halted", "reason": reason, "trace": trace}

        response = client.messages.create(
            model="claude-opus-5", max_tokens=8000,
            thinking={"type": "adaptive"},
            output_config={"effort": "high"},
            system=SYSTEM_BLOCKS,          # cached prefix
            tools=TOOLS_SORTED,
            messages=messages,
        )
        budget.spent_tokens += (response.usage.input_tokens
                                + response.usage.output_tokens)

        if response.stop_reason == "refusal":
            return {"status": "refused",
                    "category": response.stop_details.category, "trace": trace}

        if response.stop_reason == "max_tokens":
            # Truncated mid-thought. Continuing would build on a fragment.
            return {"status": "truncated", "trace": trace}

        if response.stop_reason == "pause_turn":
            messages.append({"role": "assistant", "content": response.content})
            continue                       # resend as-is to resume

        if response.stop_reason != "tool_use":
            return {"status": "done",
                    "answer": text_of(response), "steps": step, "trace": trace}

        messages.append({"role": "assistant", "content": response.content})

        results = []
        for block in (b for b in response.content if b.type == "tool_use"):
            signature = (block.name, json.dumps(block.input, sort_keys=True))
            if signature in seen_calls:
                # Repeating an identical call is the classic stuck loop.
                results.append({"type": "tool_result", "tool_use_id": block.id,
                                "is_error": True,
                                "content": "You already made this exact call "
                                           "and got the result above. Try a "
                                           "different approach, or stop and "
                                           "report what is blocking you."})
                continue
            seen_calls.add(signature)

            trace.append({"step": step, "tool": block.name, "args": block.input})
            results.append(execute(block, session))     # authorisation inside

        messages.append({"role": "user", "content": results})   # ONE message

    return {"status": "step_limit", "steps": budget.max_steps, "trace": trace}`,
        },
        {
          t: 'key',
          title: 'Every exit must be explicit',
          text: 'Count the ways out of that loop: done, refused, truncated, step limit, token budget, deadline. Six. A loop with only "done" and "step limit" will hit production and find the other four for you, usually at 3am and usually expensively. Enumerate the exits before you enumerate the tools.',
        },
      ],
    },
    {
      id: 'tool-runner',
      title: 'The tool runner: the loop you did not write',
      blocks: [
        {
          t: 'p',
          text: 'The SDKs ship a helper that drives the loop for you. You write tool functions; it handles the request, the execution, the result formatting and the iteration — while still giving you per-turn hooks for the things you must control.',
        },
        {
          t: 'code',
          lang: 'python',
          caption: 'The decorator generates the schema from the signature and the docstring',
          code: `
from anthropic import beta_tool

@beta_tool
def get_order(order_id: str) -> str:
    """Look up an order by id. Returns status, ship date and items.

    Use this when the user names a specific order. For searching without
    an id, use search_orders instead.

    Args:
        order_id: The order id, e.g. '4471'.
    """
    return json.dumps(db.get_order(order_id, tenant_id=current_tenant()))


@beta_tool
def search_orders(email: str | None = None,
                  status: str | None = None) -> str:
    """Search orders by customer email and/or status.

    Returns up to 20 matches, newest first. Returns an empty list rather
    than an error when nothing matches.
    """
    return json.dumps(db.search(email=email, status=status,
                                tenant_id=current_tenant())[:20])


runner = client.beta.messages.tool_runner(
    model="claude-opus-5",
    max_tokens=8000,
    tools=[get_order, search_orders],
    system=SYSTEM,
    messages=[{"role": "user", "content": "Has 4471 shipped?"}],
)

final = runner.until_done()
print(text_of(final))`,
        },
        {
          t: 'ascii',
          caption: 'The runner is a harness, not a deployment. Know which of the four agent shapes you are building.',
          code: `
                     WHO WRITES      WHO WRITES      WHICH TOOLS
                     THE HARNESS?    THE DEPLOYMENT? ARE AVAILABLE?
  ───────────────────────────────────────────────────────────────────────
  1 manual loop        you              you           only yours
  2 tool runner        the SDK          you           only yours
  3 managed agents     Anthropic        Anthropic     hosted sandbox
                                                      + skills/MCP + yours
  4 Claude Agent SDK   the SDK          you           built-in file/bash/
    (a DIFFERENT                                      grep/web + MCP
     product)

  The distinction people get wrong:
      "Tool runner" and "Claude Agent SDK" sound alike and are not.
      The tool runner is a thin helper inside the regular API SDK that
      loops over tools YOU define. The Agent SDK is Claude Code packaged
      as a library, with built-in filesystem and shell tools.

  Only option 3 gives you managed DEPLOYMENT. Options 1, 2 and 4 all run
  on infrastructure you operate.`,
        },
        {
          t: 'note',
          title: 'Hooks are why the runner is not a loss of control',
          text: 'Per-turn hooks let you intercept before each tool executes — for an approval gate, an audit log, argument rewriting, or adding `cache_control` to a result — and after each turn, for budget accounting and stopping. You keep every control point from the manual loop and delete the boilerplate. Write the manual loop once to understand it, then use the runner.',
        },
      ],
    },
    {
      id: 'failure-modes',
      title: 'How agent loops actually fail',
      blocks: [
        {
          t: 'lead',
          text: 'These are not hypothetical. Each one has a signature you can detect and a specific defence, and each one will happen to you if the defence is absent.',
        },
        {
          t: 'table',
          caption: 'The eight failures, their signatures, and what stops them.',
          head: ['Failure', 'What you see in the trace', 'Defence'],
          rows: [
            ['**Stuck loop**', 'The same tool, the same arguments, repeatedly', 'Duplicate-call detection; tell the model it already tried that'],
            ['**Oscillation**', 'A → B → A → B forever', 'Detect repeated *sequences*, not just calls; cap steps'],
            ['**Context explosion**', 'Each step 15k tokens larger than the last', 'Compact tool output; context editing; compaction'],
            ['**Compounding error**', 'Step 3 was wrong, steps 4–12 build on it', 'Verify after each step; require a citation per claim'],
            ['**Premature success**', '"Done!" with nothing actually changed', 'Verify the outcome in code, never take the model’s word'],
            ['**Wrong-turn commitment**', 'Persists with a failing approach', 'Re-plan prompt every N steps; surface failures loudly'],
            ['**Irreversible mistake**', 'A refund issued, an email sent', 'Approval gates; dry-run mode; idempotency keys'],
            ['**Silent giving up**', 'Claims completion but reports nothing useful', 'Structured final output with an explicit `success` flag'],
          ],
        },
        {
          t: 'code',
          lang: 'python',
          caption: 'Detecting oscillation as well as exact repetition',
          code: `
class ProgressMonitor:
    """A loop that repeats a PAIR of calls is stuck just as surely as one
    that repeats a single call. Track short windows, not just calls."""

    def __init__(self, window: int = 3, limit: int = 2):
        self.history: list[tuple] = []
        self.window, self.limit = window, limit

    def record(self, name: str, args: dict) -> str | None:
        self.history.append((name, json.dumps(args, sort_keys=True)))

        if len(self.history) >= self.window * 2:
            recent = tuple(self.history[-self.window:])
            prior  = tuple(self.history[-self.window * 2:-self.window])
            if recent == prior:
                return (f"You have repeated the same sequence of "
                        f"{self.window} calls twice with no new information. "
                        "Stop and report what is blocking you.")

        exact = self.history.count(self.history[-1])
        if exact > self.limit:
            return ("You have made this exact call several times. The result "
                    "will not change. Try a different approach or stop.")
        return None`,
        },
        {
          t: 'warn',
          title: 'Verify the outcome, never trust the report',
          text: 'An agent that says "I have updated the record" is making a claim, not a guarantee — it may have called a tool that returned an error it misread, or planned the call and never made it. If the task had an observable effect, check for that effect in code before reporting success. "Premature success" is the failure users forgive least, because they acted on it.',
        },
        {
          t: 'code',
          lang: 'python',
          caption: 'A structured final answer, so "did it work" is a field rather than an inference',
          code: `
FINAL_SCHEMA = {
    "type": "object",
    "properties": {
        "steps_taken":   {"type": "array", "items": {"type": "string"}},
        "verified_by":   {"type": "string",
                          "description": "The tool call whose output proves "
                                         "this worked, or 'none'"},
        "succeeded":     {"type": "boolean"},
        "blocked_by":    {"type": ["string", "null"]},
        "answer":        {"type": "string", "maxLength": 2000},
    },
    "required": ["steps_taken", "verified_by", "succeeded",
                 "blocked_by", "answer"],
    "additionalProperties": False,
}

# Then check it yourself. "succeeded: true" with "verified_by: none" is
# an unverified claim, and should be surfaced as one.
if result["succeeded"] and result["verified_by"] == "none":
    result["warning"] = "The agent reported success but verified nothing."`,
        },
      ],
    },
    {
      id: 'context-in-loops',
      title: 'Keeping the context from exploding',
      blocks: [
        {
          t: 'p',
          text: 'An agent’s context grows with every step, and tool results are usually the largest contributor. Without management, step 15 is slow, expensive, and worse at reasoning than step 3 — which feels like the model degrading but is really the prompt drowning.',
        },
        {
          t: 'ascii',
          caption: 'The same twelve-step run, unmanaged and managed.',
          code: `
  UNMANAGED                              MANAGED
  step  context                          step  context
    1    2k  ▏                             1    2k  ▏
    2    9k  ██                            2    9k  ██
    3   31k  ███████                       3   31k  ███████
    4   48k  ███████████                   4   20k  ████     ← results cleared
    5   72k  █████████████████             5   26k  ██████
    6  103k  ████████████████████████      6   19k  ████     ← cleared again
    8  178k  ████████████████████████████  8   24k  █████
   12  340k  ██████████████████████████    12   31k  ███████
             slow, dear, reasoning                   flat, and step 12
             degrades from noise                     reasons as well as 3

  THE FOUR LEVERS, in the order to apply them:
    1. compact tool output at the source       (return 200 tokens, not 20k)
    2. context editing: clear spent results    (clear_tool_uses_20250919)
    3. write findings down before clearing     (a scratchpad the model keeps)
    4. compaction for the conversation itself  (compact_20260112)

  Lever 3 is the one people miss: clearing a file you still need forces a
  re-read. Have the agent record what it LEARNED, then clear the raw
  payload. Notes are small; payloads are not.`,
        },
        {
          t: 'code',
          lang: 'python',
          caption: 'Context editing in an agent loop, with a scratchpad tool',
          code: `
response = client.beta.messages.create(
    betas=["context-management-2025-06-27"],
    model="claude-opus-5", max_tokens=8000,
    tools=TOOLS_SORTED,
    messages=messages,
    context_management={"edits": [
        {"type": "clear_tool_uses_20250919"},    # spent results go
        {"type": "clear_thinking_20251015"},     # spent reasoning goes
    ]},
)

# And the tool that makes clearing safe:
@beta_tool
def record_finding(finding: str) -> str:
    """Write down something you have learned that you will need later.

    Call this after reading a large file or a long result, BEFORE moving
    on. Raw tool output may be cleared from your context to save space;
    findings recorded here persist.
    """
    notes.append(finding)
    return f"Recorded. {len(notes)} findings so far."`,
        },
        {
          t: 'tip',
          title: 'Task budgets tell the model how much room it has',
          text: '`max_tokens` is a ceiling the model cannot see — it just gets cut off. A **task budget** is a ceiling it *can* see, so it paces itself and finishes gracefully instead of being truncated mid-plan. Set `task_budget` inside `output_config` (with the task-budgets beta) and stream, since the accompanying `max_tokens` is large. Note this is advisory pacing, not a hard cap — your own budget checks still do the enforcing.',
        },
      ],
    },
    {
      id: 'prompting-agents',
      title: 'Prompting an agent differently from a chatbot',
      blocks: [
        {
          t: 'p',
          text: 'An agent system prompt has jobs a chat prompt does not: it must say when to stop, what to do when blocked, and how much autonomy the model has. Leave those out and the model invents an answer to each.',
        },
        {
          t: 'code',
          lang: 'python',
          caption: 'The five sections an agent prompt needs beyond the usual',
          code: `
AGENT_SYSTEM = """You are a support operations agent for an online retailer.

## What you can do
You have tools to look up orders, search by customer, read the refund
policy, and issue refunds. You may read freely. Issuing a refund requires
human approval — the tool will tell you when approval is pending; report
that to the user rather than retrying.

## How to work
- Plan briefly, then act. Do not narrate every step.
- Gather all the facts you need before concluding. If two lookups are
  independent, request them in the same turn.
- Quote the policy text when you rely on it. Do not paraphrase a rule.

## When to stop
Stop as soon as you can answer, or as soon as you are blocked. Specifically:
- You have the answer → give it, with the tool output that proves it.
- A tool returns the same result twice → stop; it will not change.
- You need information no tool provides → stop and say exactly what is
  missing and who could provide it.
- An action needs approval → stop and say so.

Do NOT keep trying variations of a failed approach. Reporting a blocker
clearly is a successful outcome, not a failure.

## Reporting
Always state what you actually did, and which tool output verifies it.
If you could not verify an outcome, say so plainly. Never claim an action
succeeded because you requested it."""`,
        },
        {
          t: 'table',
          caption: 'Autonomy is a dial. Pick a setting deliberately per tool class.',
          head: ['Level', 'Behaviour', 'Suits'],
          rows: [
            ['**Read-only**', 'Can look anything up, changes nothing', 'Most first deployments. Start here'],
            ['**Propose**', 'Prepares the action, a human confirms', 'Refunds, emails, anything customer-facing'],
            ['**Bounded write**', 'Acts within hard limits — refunds under £50', 'Once the read-only version is measured and trusted'],
            ['**Autonomous**', 'Acts freely inside a sandbox', 'Code agents in a branch, with tests as the check'],
          ],
        },
        {
          t: 'key',
          title: 'Ship read-only first, always',
          text: 'A read-only agent is enormously useful, and it lets you observe real traces, real failure modes and real costs with no blast radius. Every write capability you add afterwards is a decision informed by data rather than optimism. Teams that go straight to write access learn the same lessons, more expensively and in public.',
        },
        {
          t: 'note',
          title: 'Effort matters more in agent loops than anywhere else',
          text: 'Lower effort means fewer, more consolidated tool calls and less preamble; higher effort means more thorough exploration. For long-horizon agentic work, `high` or `xhigh` with the full task specified up front generally wins, while `low` suits cheap sub-agents doing one narrow thing. It is worth sweeping — the difference in both quality and token spend is larger here than in single-shot use.',
        },
      ],
    },
    {
      id: 'observability',
      title: 'You cannot debug an agent you cannot replay',
      blocks: [
        {
          t: 'p',
          text: 'A bad agent run is a sequence of twelve decisions. Without a trace you have only the final answer, which tells you nothing about where it went wrong. Tracing is not optional instrumentation here — it is the only debugging surface you have.',
        },
        {
          t: 'code',
          lang: 'python',
          caption: 'A trace record per step, and the aggregates that expose problems',
          code: `
def trace_step(run_id: str, step: int, response, results: list) -> None:
    log.info("agent step", extra={
        "run_id": run_id,
        "step": step,
        "stop_reason": response.stop_reason,
        "tools_called": [b.name for b in response.content
                         if b.type == "tool_use"],
        "tool_args": [b.input for b in response.content
                      if b.type == "tool_use"],
        "errors": [r.get("is_error", False) for r in results],
        "result_tokens": sum(count_tokens(text=r["content"]) for r in results),
        "context_tokens": (response.usage.input_tokens
                           + response.usage.cache_read_input_tokens),
        "cache_read": response.usage.cache_read_input_tokens,
        "output_tokens": response.usage.output_tokens,
        "cumulative_cost_usd": round(running_cost, 5),
    })

# The aggregates that actually tell you something:
#   steps per run           — a bimodal distribution means two populations,
#                             usually "worked" and "spun"
#   tool error rate by tool — one bad tool poisons every run that uses it
#   context growth per step — the early warning for explosion
#   duplicate-call rate     — the stuck-loop metric
#   % runs hitting a limit  — your real failure rate
#   cost per COMPLETED task — the only cost number worth quoting`,
        },
        {
          t: 'steps',
          items: [
            { title: 'Give every run an id and log every step under it', text: 'You will be handed a complaint about "the agent" and need to find that specific run.' },
            { title: 'Store the full message list for failed runs', text: 'Being able to replay the exact conversation is worth more than any metric.' },
            { title: 'Track cost per completed task, not per request', text: 'An agent that needs eleven steps is not cheap because each step was cheap.' },
            { title: 'Alert on limit-hit rate', text: 'Runs ending in a step or token limit are your failure rate, whatever the answers looked like.' },
            { title: 'Watch context growth per step', text: 'A rising slope predicts the explosion before users feel it.' },
            { title: 'Sample successful runs too', text: 'Reading five good traces a week teaches you what to simplify.' },
          ],
        },
      ],
    },
  ],

  patterns: [
    {
      id: 'four-bounds',
      name: 'Bound the Loop Four Ways',
      oneLiner: 'Steps, tokens, wall-clock, and no-progress. All four, always.',
      useWhen: ['Every agent loop, from the first prototype.'],
      recognize: ['A `while True`.', 'A step limit as the only guard.', 'An overnight run that cost more than the feature earns.'],
      steps: [
        'Hard-cap iterations — 10 to 20 for most tasks.',
        'Accumulate token spend and stop at a ceiling.',
        'Set a wall-clock deadline.',
        'Detect duplicate calls and repeated sequences; tell the model rather than silently looping.',
        'Return a distinct status for each exit so the failure mode is visible in metrics.',
      ],
      template: {
        lang: 'python',
        caption: 'One guard checked at the top of every iteration',
        code: `
for step in range(budget.max_steps):
    if reason := budget.exhausted():          # tokens or deadline
        return halted(reason)
    ...
    if msg := monitor.record(block.name, block.input):   # no progress
        results.append(error_result(block.id, msg))
        continue
return halted("step limit")`,
      },
      complexity: 'Twenty lines. Prevents the cost incident everyone eventually has.',
      gotchas: [
        'Telling the model it is repeating itself recovers far more often than silently blocking.',
        'Without distinct statuses, "it did not work" covers four different bugs.',
      ],
      problems: ['Build a runaway loop, then bound it', 'Alert on limit-hit rate'],
    },
    {
      id: 'verify-dont-trust',
      name: 'Verify the Outcome in Code',
      oneLiner: '"I updated the record" is a claim. Go and look.',
      useWhen: ['Any agent whose task has an observable effect.'],
      recognize: ['Success taken from the final message.', 'Users reporting that a change never happened.'],
      steps: [
        'Require a structured final answer with `succeeded` and `verified_by`.',
        'Check the observable effect yourself after the loop ends.',
        'Treat `succeeded: true` with `verified_by: none` as unverified and surface it.',
      ],
      complexity: 'One extra read per run.',
      gotchas: [
        'Models misread tool errors as successes surprisingly often.',
        'A confident false success is the failure users forgive least.',
      ],
      problems: ['Make a tool fail silently and catch the false success'],
    },
    {
      id: 'findings-then-clear',
      name: 'Record Findings, Then Clear the Payload',
      oneLiner: 'Notes are small. Raw tool output is not.',
      useWhen: ['Agents that read files, documents or large API responses.'],
      recognize: ['Context growing 15k tokens per step.', 'Re-reading the same file three times.'],
      steps: [
        'Give the agent a `record_finding` tool and tell it to use it after any large read.',
        'Enable context editing to clear spent tool results and thinking.',
        'Compact tool output at the source before it ever enters the context.',
        'Log context size per step and watch the slope flatten.',
      ],
      complexity: 'Often the difference between a 12-step run being feasible and not.',
      gotchas: [
        'Clearing something still needed forces a re-read — hence the notes first.',
        'The model will not record findings unless the prompt tells it to.',
      ],
      problems: ['Plot context growth with and without', 'Add the scratchpad tool'],
    },
    {
      id: 'read-only-first',
      name: 'Ship Read-Only, Then Earn Write Access',
      oneLiner: 'Observe real traces with zero blast radius before granting actions.',
      useWhen: ['Every new agent.'],
      recognize: ['A first deployment that can email customers.', 'No trace data, but full write access.'],
      steps: [
        'Ship with read tools only and let it run on real traffic.',
        'Read the traces; measure step counts, errors and cost per task.',
        'Add write tools one at a time, each behind approval.',
        'Relax to bounded autonomy only where the data supports it.',
      ],
      complexity: 'Slower to full autonomy; far fewer incidents on the way.',
      gotchas: [
        'A read-only agent is already valuable — do not treat the stage as a formality.',
        '"Propose and confirm" covers most of what people want from write access.',
      ],
      problems: ['Deploy read-only and collect fifty traces', 'Justify the first write tool from them'],
    },
    {
      id: 'stop-conditions-in-prompt',
      name: 'Put the Stop Conditions in the Prompt',
      oneLiner: 'Tell it when to stop and that reporting a blocker is a success.',
      useWhen: ['Every agent system prompt.'],
      recognize: ['Agents that spin rather than reporting a blocker.', 'Repeated variations of a failed approach.'],
      steps: [
        'Enumerate the stop conditions explicitly, including "a tool returned the same result twice".',
        'State that reporting a blocker clearly is a successful outcome.',
        'Say what to do when an action needs approval.',
        'Forbid retrying variations of a failed approach.',
      ],
      complexity: 'A paragraph. Reduces wasted steps noticeably.',
      gotchas: [
        'Preference training pushes towards appearing helpful, so "give up and report" must be explicitly authorised.',
        'Without a stated rule, the model invents its own stopping heuristic per run.',
      ],
      problems: ['Compare step counts with and without stop conditions'],
    },
  ],

  pitfalls: [
    { title: '`while True`', text: 'The overnight cost incident, waiting to happen.' },
    { title: 'A step limit as the only bound', text: 'Twenty steps can still be half a million tokens.' },
    { title: 'No duplicate-call detection', text: 'The most common stuck-loop shape, and the easiest to catch.' },
    { title: 'Detecting only exact repeats', text: 'A → B → A → B is equally stuck. Check sequences.' },
    { title: 'Silently blocking a repeated call', text: 'Tell the model it already tried that — it usually recovers.' },
    { title: 'Trusting the success report', text: 'Verify the observable effect in code.' },
    { title: 'Ignoring context growth', text: 'Step 15 reasons worse than step 3 because the prompt is drowning.' },
    { title: 'Clearing results without recording findings', text: 'Forces a re-read and costs more than it saved.' },
    { title: 'Not handling `pause_turn`', text: 'Looks like an empty answer mid-run.' },
    { title: 'Continuing after `max_tokens`', text: 'Every later step builds on a truncated fragment.' },
    { title: 'Write access on day one', text: 'You learn the failure modes in public.' },
    { title: 'No stop conditions in the prompt', text: 'The model invents a stopping rule, differently each run.' },
    { title: 'No per-step trace', text: 'A bad run is twelve decisions you cannot see.' },
    { title: 'Quoting cost per request', text: 'The number that matters is cost per completed task.' },
    { title: 'Confusing the tool runner with the Claude Agent SDK', text: 'Different packages, different scope — one loops your tools, the other ships built-in ones.' },
  ],

  cheatsheet: [
    { label: 'An agent is', value: 'while `tool_use`: run, append, repeat' },
    { label: 'ReAct is', value: 'exactly that loop' },
    { label: 'Bound it', value: 'steps, tokens, deadline, no-progress' },
    { label: 'Exits', value: 'done, refused, truncated, ×3 limits' },
    { label: 'Loop options', value: 'manual, tool runner, managed agents' },
    { label: 'Tool runner', value: '`client.beta.messages.tool_runner`' },
    { label: 'Stuck loop signal', value: 'same tool, same args' },
    { label: 'Oscillation signal', value: 'a repeated sequence' },
    { label: 'On repeat', value: 'tell the model, do not silently block' },
    { label: 'Context lever 1', value: 'compact tool output at the source' },
    { label: 'Context lever 2', value: 'clear spent results' },
    { label: 'Context lever 3', value: 'record findings before clearing' },
    { label: 'Pacing', value: '`task_budget` — advisory, and it can see it' },
    { label: 'Prompt must say', value: 'when to stop, and that blockers are OK' },
    { label: 'Autonomy', value: 'read-only → propose → bounded → free' },
    { label: 'Verify', value: 'in code; never trust the report' },
    { label: 'Trace', value: 'run id, per-step tools, errors, tokens, cost' },
    { label: 'Cost metric', value: 'per completed task' },
  ],

  problems: [
    { name: 'Write the twelve-line loop by hand', difficulty: 'Easy', pattern: 'The loop', insight: 'Two tools, print every step. Seeing how little code an agent is removes most of the mystique and all of the intimidation.' },
    { name: 'Build a runaway loop on purpose', difficulty: 'Easy', pattern: 'Bounds', insight: 'A tool that always returns "not found". Watch it try forever. Then add the four bounds and watch it halt with a clear status.' },
    { name: 'Rewrite it with the tool runner', difficulty: 'Easy', pattern: 'Tool runner', insight: 'Same two tools, decorated. Compare the amount of code. Then add a per-turn hook that logs each call, so you know you have not lost control.' },
    { name: 'Catch an oscillation', difficulty: 'Medium', pattern: 'No-progress detection', insight: 'Two tools that each suggest the other. Exact-repeat detection misses it entirely; sequence detection catches it. Write both and see.' },
    { name: 'Plot context growth per step', difficulty: 'Medium', pattern: 'Context explosion', insight: 'An agent reading three large files. Plot context size against step, then add compact output plus context editing and re-plot. The two curves make the case on their own.' },
    { name: 'Catch a false success', difficulty: 'Medium', pattern: 'Verification', insight: 'A write tool that returns a success-shaped error. The agent reports completion. Add code verification and the lie becomes visible.' },
    { name: 'Add and use a findings scratchpad', difficulty: 'Medium', pattern: 'Findings', insight: 'Enable context editing without notes first and watch a re-read happen. Then add `record_finding` and confirm the re-read stops.' },
    { name: 'Sweep effort across a ten-step task', difficulty: 'Hard', pattern: 'Effort in loops', insight: 'Run the same task at low, high and xhigh. Record steps, tokens, wall-clock and success. Effort changes agent behaviour more than it changes single-shot answers.' },
    { name: 'Build the trace viewer', difficulty: 'Hard', pattern: 'Observability', insight: 'Per-step tools, arguments, errors, tokens and cumulative cost, replayable for failed runs. Read ten traces and you will find two bugs you did not know you had.' },
    { name: 'Take an agent from read-only to bounded write', difficulty: 'Hard', pattern: 'Autonomy', insight: 'Deploy read-only, collect fifty traces, then justify one write tool from the data, behind approval and an idempotency key. Write down the evidence for each step of the promotion.' },
  ],
}
