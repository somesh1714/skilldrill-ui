export default {
  id: 'ai-multi-agent',
  title: 'Multi-Agent Systems',
  short: 'Multi-Agent',
  icon: 'GroupWorkRounded',
  tier: 'Advanced',
  order: 17,
  estHours: 4,
  prereqs: ['ai-mcp'],
  tagline: 'Several agents are not smarter than one. They are a way to buy parallelism and context isolation — at a price.',
  mentalModel:
    'A sub-agent is **a function call with its own context window**. You hand it a task, it works in a private conversation you never see, and it returns a summary. That is the entire benefit: parallelism, and keeping one agent’s reading out of another agent’s prompt. There is no emergent intelligence from putting models in a room together.',
  whyItMatters:
    'Multi-agent architectures are the most over-adopted idea in this field. They genuinely solve two real problems, and they are routinely deployed for a third thing — "better answers" — that they do not deliver. Knowing which is which saves an enormous amount of money and debugging.',

  reference: {
    title: 'The topologies, and what each is actually for',
    head: ['Topology', 'Shape', 'Buys you'],
    rows: [
      ['**Single agent**', 'One loop, all tools', '**The default.** Simplest to debug'],
      ['**Orchestrator–worker**', 'One plans, N execute in parallel', 'Wall-clock time; context isolation'],
      ['**Router**', 'Classify, then hand to one specialist', 'Focused prompts and tool sets; lower cost'],
      ['**Pipeline**', 'Fixed stages, each a different agent', 'Predictability — but this is a **workflow**'],
      ['**Debate / critic**', 'One proposes, another critiques', 'Occasionally real quality gains; often just cost'],
      ['**Peer network**', 'Agents freely messaging each other', '**Avoid.** Unbounded cost, undebuggable'],
    ],
  },

  sections: [
    {
      id: 'why-not',
      title: 'Start by not doing it',
      blocks: [
        {
          t: 'lead',
          text: 'The honest opening: most multi-agent systems would work better, cost less and be easier to debug as a single agent with well-chosen tools. Two problems genuinely justify the complexity, and "it will be smarter" is not one of them.',
        },
        {
          t: 'ascii',
          caption: 'What a second agent actually costs you.',
          code: `
  ONE AGENT                          TWO AGENTS
  ┌────────────────────┐             ┌──────────┐      ┌──────────┐
  │ sees everything     │             │ agent A  │─────▶│ agent B  │
  │ one trace           │             └──────────┘      └──────────┘
  │ one failure mode    │              A's context       B's context
  │ one prompt to tune  │              A's trace         B's trace
  └────────────────────┘              A's failures       B's failures
                                             │
                                      + the HANDOFF, which is its own
                                        failure mode and the commonest one

  THE HANDOFF TAX, paid every time:
      • A summarises what it learned      → detail is lost, silently
      • B re-establishes context          → tokens spent re-reading
      • B cannot ask A a question         → it guesses instead
      • an error in A's summary is        → B has no way to detect it
        invisible to B
      • debugging means reading two       → and reasoning about what
        traces and inferring the join        crossed between them

  TWO REAL REASONS TO PAY IT
      1. PARALLELISM       five independent searches, concurrently.
                           Wall-clock, not quality.
      2. CONTEXT ISOLATION one sub-task would read 200k tokens that
                           the main agent must not carry forward.

  ONE BAD REASON, extremely common
      "specialist agents will produce better answers"
      A prompt saying "you are a security reviewer" produces the same
      quality whether it is agent #2 or a second turn of agent #1 —
      and the single agent keeps the full context and one trace.`,
        },
        {
          t: 'key',
          title: 'The test before you split',
          text: 'Ask: **can these sub-tasks run at the same time?** and **would one of them otherwise flood the main context?** If both answers are no, you want one agent with better tools, or a workflow. If either is yes, a sub-agent is buying you something real, and the handoff tax is worth paying.',
        },
      ],
    },
    {
      id: 'orchestrator-worker',
      title: 'Orchestrator–worker: the pattern that earns its keep',
      blocks: [
        {
          t: 'p',
          text: 'One agent decomposes the task and spawns workers that run concurrently, each in its own context. This is the shape behind almost every multi-agent system that actually works.',
        },
        {
          t: 'ascii',
          caption: 'Fan out, run in parallel, fan in. The orchestrator never sees the workers’ raw reading.',
          code: `
                     ┌─────────────────────┐
                     │    ORCHESTRATOR     │
                     │  decompose the task │
                     │  into INDEPENDENT   │
                     │  sub-tasks          │
                     └──────────┬──────────┘
              ┌─────────────────┼─────────────────┐
              ▼                 ▼                 ▼
        ┌───────────┐     ┌───────────┐     ┌───────────┐
        │ WORKER 1  │     │ WORKER 2  │     │ WORKER 3  │
        │ own ctx   │     │ own ctx   │     │ own ctx   │
        │ reads 80k │     │ reads 60k │     │ reads 90k │
        │ returns   │     │ returns   │     │ returns   │
        │  ~500 tok │     │  ~500 tok │     │  ~500 tok │
        └─────┬─────┘     └─────┬─────┘     └─────┬─────┘
              └─────────────────┼─────────────────┘
                                ▼
                     ┌─────────────────────┐
                     │    ORCHESTRATOR     │
                     │  1,500 tokens in,   │
                     │  not 230,000        │
                     │  synthesise         │
                     └─────────────────────┘

  THE TWO WINS, quantified:
     wall-clock  max(t1,t2,t3) instead of t1+t2+t3   → ~3× on this shape
     context     1,500 tokens instead of 230,000     → the orchestrator
                                                        can still reason

  THE HARD PART is decomposition. Sub-tasks must be genuinely
  INDEPENDENT. If worker 2 needs worker 1's answer, you do not have a
  fan-out — you have a sequence, and running it in parallel produces
  worker 2 guessing.`,
        },
        {
          t: 'code',
          lang: 'python',
          caption: 'The orchestrator, with the two rules that keep it honest',
          code: `
PLAN_SCHEMA = {
    "type": "object",
    "properties": {
        "independent": {"type": "boolean",
                        "description": "True only if every sub-task can be "
                                       "done WITHOUT the result of another"},
        "subtasks": {"type": "array", "maxItems": 5,
                     "items": {"type": "object", "properties": {
                         "id": {"type": "string"},
                         "task": {"type": "string", "maxLength": 400},
                     }, "required": ["id", "task"],
                        "additionalProperties": False}},
    },
    "required": ["independent", "subtasks"],
    "additionalProperties": False,
}

async def orchestrate(goal: str, session, budget: Budget) -> dict:
    plan = ask(PLANNER_SYSTEM, goal, schema=PLAN_SCHEMA)

    # Rule 1: if the sub-tasks are not independent, this is a sequence.
    # Running it as a fan-out makes later workers guess.
    if not plan["independent"] or len(plan["subtasks"]) < 2:
        return await run_agent(goal, session, budget)

    # Rule 2: every worker gets its own budget, and the total is capped.
    per_worker = Budget(max_steps=8,
                        max_tokens=budget.max_tokens // len(plan["subtasks"]),
                        deadline_s=budget.deadline_s * 0.6)

    results = await asyncio.gather(*[
        run_worker(st["task"], session, per_worker) for st in plan["subtasks"]
    ], return_exceptions=True)

    findings = []
    for st, r in zip(plan["subtasks"], results):
        if isinstance(r, Exception) or r.get("status") != "done":
            # A failed worker is a FACT the orchestrator must see, not a
            # gap it should quietly fill in.
            findings.append({"id": st["id"], "task": st["task"],
                             "status": "failed",
                             "detail": str(r)[:200]})
        else:
            findings.append({"id": st["id"], "task": st["task"],
                             "status": "done", "summary": r["answer"],
                             "citations": r.get("citations", [])})

    return await synthesise(goal, findings, session)`,
        },
        {
          t: 'warn',
          title: 'Budget multiplies, and it multiplies quietly',
          text: 'Five workers at twenty steps each is a hundred model calls for one user request — and if a worker can itself spawn workers, the growth is exponential. Give every worker an explicit budget carved out of the parent’s, forbid recursive spawning unless you have a very good reason, and cap the fan-out width in the schema (`maxItems`) rather than trusting the plan.',
        },
        {
          t: 'tip',
          title: 'Workers can be a cheaper model',
          text: '"Read this document and extract every mention of X" is a narrow, well-specified task — exactly what a smaller model does well at a fraction of the cost. A common and effective arrangement is an expensive orchestrator with cheap workers. Measure it: if worker quality is the bottleneck, raise that tier specifically rather than everything.',
        },
      ],
    },
    {
      id: 'handoff',
      title: 'The handoff is where it breaks',
      blocks: [
        {
          t: 'p',
          text: 'Every failure specific to multi-agent systems happens at a boundary. Designing the handoff explicitly — as a schema, not as prose — removes most of them.',
        },
        {
          t: 'table',
          caption: 'Five handoff failures and their fixes.',
          head: ['Failure', 'What happens', 'Fix'],
          rows: [
            ['**Lossy summary**', 'The worker drops the detail that mattered', 'A structured return: findings, evidence, confidence, gaps'],
            ['**Confident gap**', 'A worker found nothing and says nothing', 'Require an explicit `found: false` and a `gaps` list'],
            ['**Silent failure**', 'A worker errored; the orchestrator infers around it', 'Pass failures through as facts, never as absence'],
            ['**Duplicated work**', 'Three workers search the same thing', 'Decompose by source or scope, not by rephrasing the goal'],
            ['**Lost provenance**', 'The synthesis cannot cite anything', 'Workers return citations; the orchestrator propagates them'],
          ],
        },
        {
          t: 'code',
          lang: 'python',
          caption: 'A worker return contract — the single most valuable artefact in a multi-agent system',
          code: `
WORKER_RETURN = {
    "type": "object",
    "properties": {
        "found":      {"type": "boolean"},
        "summary":    {"type": "string", "maxLength": 1200},
        "evidence":   {"type": "array", "items": {"type": "object",
                        "properties": {"claim": {"type": "string"},
                                       "source": {"type": "string"},
                                       "quote": {"type": "string"}},
                        "required": ["claim", "source", "quote"],
                        "additionalProperties": False}},
        # The two fields everyone forgets, and the two that prevent the
        # orchestrator from confidently synthesising nothing:
        "gaps":       {"type": "array", "items": {"type": "string"},
                       "description": "What you could NOT establish"},
        "confidence": {"enum": ["high", "medium", "low"]},
    },
    "required": ["found", "summary", "evidence", "gaps", "confidence"],
    "additionalProperties": False,
}

SYNTHESIS_RULES = """You are combining reports from several workers.

- A worker reporting found=false means that information is MISSING.
  Say so. Do not fill the gap from your own knowledge.
- A worker that failed produced NO information. Do not treat its absence
  as a negative finding.
- Cite the worker and source for every claim you carry forward.
- Where two workers disagree, report the disagreement; do not silently
  pick one."""`,
        },
        {
          t: 'trap',
          title: 'Absence of evidence becomes evidence of absence',
          text: 'The single most dangerous multi-agent failure: a worker times out, returns nothing, and the orchestrator synthesises a confident "there are no security issues in the payments module" from a report that never happened. Every worker outcome must arrive as an explicit status. A missing report and a negative report must be impossible to confuse.',
        },
      ],
    },
    {
      id: 'router',
      title: 'Routing: the cheapest multi-agent pattern',
      blocks: [
        {
          t: 'p',
          text: 'Routing is barely multi-agent — one classifier picks a specialist, and exactly one specialist runs. It gives you focused prompts and small tool sets without paying the parallelism or handoff costs at all.',
        },
        {
          t: 'ascii',
          caption: 'One classification, one handler. No fan-out, no synthesis, no handoff tax.',
          code: `
                   ┌──────────────────┐
     request ─────▶│  ROUTER (Haiku)  │  one cheap call
                   └────────┬─────────┘
          ┌─────────────────┼─────────────────┬──────────────┐
          ▼                 ▼                 ▼              ▼
    ┌───────────┐   ┌─────────────┐   ┌────────────┐  ┌───────────┐
    │ ORDERS    │   │ BILLING     │   │ TECHNICAL  │  │ HUMAN     │
    │ 4 tools   │   │ 3 tools     │   │ 6 tools    │  │ escalate  │
    │ 600-token │   │ 500-token   │   │ 900-token  │  │           │
    │ prompt    │   │ prompt      │   │ prompt     │  │           │
    └───────────┘   └─────────────┘   └────────────┘  └───────────┘

  WHY THIS WORKS SO WELL
    • each specialist has a short, sharp prompt instead of one prompt
      trying to cover every case
    • each has 4 tools to choose between, not 13 — selection accuracy
      goes up measurably
    • each prompt is separately cacheable
    • only ONE specialist runs, so the cost is one agent plus a Haiku call

  THE ONE THING TO GET RIGHT
    a "cannot classify" branch. Without it the router picks the least
    wrong specialist and you get confident nonsense from the wrong
    tool set. Route ambiguity to a generalist or to a human.`,
        },
        {
          t: 'code',
          lang: 'python',
          caption: 'Routing with an explicit uncertainty branch',
          code: `
ROUTE_SCHEMA = {
    "type": "object",
    "properties": {
        "reasoning": {"type": "string", "maxLength": 200},
        "route": {"enum": ["orders", "billing", "technical",
                           "general", "human"]},
        "confidence": {"enum": ["high", "medium", "low"]},
    },
    "required": ["reasoning", "route", "confidence"],
    "additionalProperties": False,
}

async def handle(request: str, session) -> dict:
    decision = ask(ROUTER_SYSTEM, request, model="claude-haiku-4-5",
                   schema=ROUTE_SCHEMA)

    # Low confidence must NOT silently pick the least-wrong specialist.
    route = decision["route"]
    if decision["confidence"] == "low":
        route = "general"

    log.info("routed", extra={"route": route,
                              "confidence": decision["confidence"],
                              "reasoning": decision["reasoning"]})

    return await SPECIALISTS[route](request, session)`,
        },
        {
          t: 'key',
          title: 'Try routing before you try fan-out',
          text: 'Routing captures most of what people want from "specialist agents" — focused prompts, small tool sets, lower cost — with none of the handoff or budget multiplication. If your motivation for multi-agent is specialisation rather than parallelism, routing is almost certainly the right shape.',
        },
      ],
    },
    {
      id: 'critic',
      title: 'Critics and debate: sometimes real, often theatre',
      blocks: [
        {
          t: 'p',
          text: 'A second agent that reviews the first agent’s output can genuinely improve quality — but only under specific conditions, and it is easy to build a version that adds cost and a false sense of rigour.',
        },
        {
          t: 'compare',
          left: {
            title: 'A critic that works',
            items: [
              'It has something the author lacks: test results, a linter, the source documents',
              'Its job is narrow and checkable ("does every claim have a quote in the sources?")',
              'It can only accept, reject with reasons, or request a change',
              'The loop is capped at one or two rounds',
              'You measured that it improves the eval score',
            ],
          },
          right: {
            title: 'A critic that is theatre',
            items: [
              'Same model, same context, "now critique this"',
              '"Review for quality and correctness" — unfalsifiable',
              'It always finds something, because it must seem useful',
              'An uncapped revise loop',
              'Nobody measured anything; it feels more rigorous',
            ],
          },
        },
        {
          t: 'code',
          lang: 'python',
          caption: 'A critic with a real check, a narrow job and a hard cap',
          code: `
CRITIC_SCHEMA = {
    "type": "object",
    "properties": {
        "unsupported_claims": {"type": "array", "items": {"type": "string"}},
        "failing_checks":     {"type": "array", "items": {"type": "string"}},
        "verdict": {"enum": ["accept", "revise"]},
    },
    "required": ["unsupported_claims", "failing_checks", "verdict"],
    "additionalProperties": False,
}

async def draft_and_check(task: str, sources: list, rounds: int = 2) -> dict:
    draft = await author(task, sources)

    for _ in range(rounds):
        # The critic gets something the author did NOT have: the
        # mechanical verification result. Without that it is just the
        # same model guessing twice.
        checks = run_verifiers(draft, sources)   # substring checks, tests, lint

        review = ask(CRITIC_SYSTEM, draft=draft, sources=sources,
                     checks=checks, schema=CRITIC_SCHEMA)

        if review["verdict"] == "accept":
            return {"output": draft, "accepted": True}

        draft = await author(task, sources, feedback=review)

    # Exhausting the rounds is a real outcome. Surface it.
    return {"output": draft, "accepted": False,
            "remaining_issues": review["unsupported_claims"]}`,
        },
        {
          t: 'warn',
          title: 'Self-critique with no new information is weak',
          text: 'The same model, with the same context, asked to find problems with its own output, will find some — but it will also invent some, and it will miss the ones it was already blind to. The critic needs a genuine information advantage: test results, a compiler, the source documents, a different tool set. Without that, you have doubled the cost for a plausible-sounding review.',
        },
      ],
    },
    {
      id: 'operating',
      title: 'Operating a multi-agent system',
      blocks: [
        {
          t: 'p',
          text: 'Everything in the observability sections gets harder when there are several traces. Two things make the difference between debuggable and not.',
        },
        {
          t: 'code',
          lang: 'python',
          caption: 'A correlation id through every agent, and the aggregates that matter',
          code: `
@dataclass
class RunContext:
    root_id: str            # the user request
    agent_id: str           # this agent's own id
    parent_id: str | None   # who spawned it
    depth: int              # spawn depth — hard-cap this
    budget: Budget

    def child(self, name: str) -> "RunContext":
        if self.depth >= MAX_DEPTH:            # almost always 1
            raise TooDeep("workers may not spawn workers")
        return RunContext(root_id=self.root_id, agent_id=new_id(name),
                          parent_id=self.agent_id, depth=self.depth + 1,
                          budget=self.budget.split())

# Every log line carries root_id, so one user request is one query away.
# The aggregates worth watching:
#   agents spawned per request     — should be stable; a rise is a bug
#   worker failure rate BY ROLE    — one bad worker prompt poisons runs
#   total tokens per user request  — the number that surprises people
#   orchestrator input tokens      — if it grows, isolation is not working
#   wall-clock vs sum of workers   — proves parallelism is real
#   % of syntheses citing a failed  — the dangerous-absence metric
#     or empty worker report`,
        },
        {
          t: 'steps',
          items: [
            { title: 'Cap the spawn depth at one', text: 'Workers spawning workers is how a single request becomes four hundred model calls. Lift the cap only with a measured reason.' },
            { title: 'Split the budget, never duplicate it', text: 'Each worker gets a slice of the parent’s allowance so the total is bounded by construction.' },
            { title: 'Correlate every log line by root id', text: 'One user complaint must resolve to one queryable trace tree.' },
            { title: 'Report total tokens per user request', text: 'Per-agent cost hides the real number, and the real number is what gets the architecture questioned.' },
            { title: 'Measure the parallelism you think you bought', text: 'Wall-clock against the sum of worker times. If they are close, the workers are not actually running concurrently.' },
            { title: 'Compare against the single-agent baseline', text: 'Keep it runnable. Periodically re-run both on the same eval — sometimes the simple one has caught up.' },
          ],
        },
        {
          t: 'key',
          title: 'Keep the single-agent version alive',
          text: 'The most useful artefact in a multi-agent project is a working single-agent implementation you can re-run on the same eval. It answers "is this complexity earning its keep?" with a number instead of an argument — and as models improve, the answer changes, usually in the direction of the simple one.',
        },
      ],
    },
  ],

  patterns: [
    {
      id: 'split-only-for-parallel-or-isolation',
      name: 'Split Only for Parallelism or Context Isolation',
      oneLiner: 'Two reasons justify a second agent. "Specialisation" is not one of them.',
      useWhen: ['Before adding any agent beyond the first.'],
      recognize: ['A five-agent design for a sequential task.', '"Specialist agents give better answers."'],
      steps: [
        'Ask whether the sub-tasks can genuinely run concurrently.',
        'Ask whether one sub-task would otherwise flood the main context.',
        'If both are no, use one agent with better tools, or a workflow.',
        'If specialisation is the motive, use routing instead.',
      ],
      complexity: 'Free. Saves the most expensive kind of rework.',
      gotchas: [
        'A "specialist prompt" works just as well as a second turn of one agent, with full context retained.',
        'Sequential sub-tasks run in parallel produce guesswork, not speed.',
      ],
      problems: ['Rebuild a multi-agent design as one agent', 'Compare cost and quality'],
    },
    {
      id: 'structured-worker-return',
      name: 'A Structured Worker Return Contract',
      oneLiner: 'found, summary, evidence, gaps, confidence — and failures pass through as facts.',
      useWhen: ['Every orchestrator–worker system.'],
      recognize: ['Workers returning free prose.', 'A synthesis that cites nothing.', 'A confident conclusion drawn from a worker that timed out.'],
      steps: [
        'Define the return schema before writing any worker.',
        'Require `found` and `gaps` explicitly.',
        'Convert worker exceptions into status records the orchestrator sees.',
        'Instruct the synthesiser that a failure is not a negative finding.',
      ],
      complexity: 'One schema. Removes most multi-agent failure modes.',
      gotchas: [
        'Absence of evidence silently becoming evidence of absence is the dangerous one.',
        'Prose summaries lose the detail the orchestrator needed most.',
      ],
      problems: ['Kill a worker and watch the synthesis', 'Add the contract and retry'],
    },
    {
      id: 'route-before-fanout',
      name: 'Route Before You Fan Out',
      oneLiner: 'Specialisation without the handoff tax.',
      useWhen: ['Several distinct request types with different tools.'],
      recognize: ['One agent with thirteen tools and a 3,000-word prompt.', 'A fan-out built to get specialisation.'],
      steps: [
        'Classify with a cheap model into a small set of routes.',
        'Give each specialist a short prompt and four to six tools.',
        'Add a low-confidence branch to a generalist or a human.',
        'Log the routing decision and its reasoning.',
      ],
      complexity: 'One extra cheap call; usually cheaper overall.',
      gotchas: [
        'Without an uncertainty branch the router picks the least-wrong specialist.',
        'Overlapping route definitions cause the same misclassification problems as overlapping tools.',
      ],
      problems: ['Split one broad agent into three specialists', 'Measure selection accuracy'],
    },
    {
      id: 'critic-with-information-advantage',
      name: 'A Critic Needs an Information Advantage',
      oneLiner: 'Test results, sources or a linter — not just the same context again.',
      useWhen: ['Adding any review or debate stage.'],
      recognize: ['"Now critique your answer."', 'An uncapped revise loop.', 'A critic that always finds something.'],
      steps: [
        'Give the critic something mechanical the author did not have.',
        'Make its job narrow and checkable.',
        'Constrain the verdict to accept or revise with specific reasons.',
        'Cap the rounds at one or two and surface exhaustion as an outcome.',
        'Measure it against no critic at all before keeping it.',
      ],
      complexity: 'Doubles the cost of the stage. Justify it with a number.',
      gotchas: [
        'Self-critique with no new information invents issues as readily as it finds them.',
        'Unfalsifiable instructions like "review for quality" guarantee a non-empty review.',
      ],
      problems: ['Build both critic versions', 'Score them against no critic'],
    },
    {
      id: 'bounded-fanout',
      name: 'Cap Width, Depth and Budget',
      oneLiner: 'Five workers, depth one, budget split — not duplicated.',
      useWhen: ['Every fan-out.'],
      recognize: ['Workers that can spawn workers.', 'Each worker given the full budget.', 'A request that made ninety model calls.'],
      steps: [
        'Cap fan-out width in the plan schema with `maxItems`.',
        'Hard-cap spawn depth at one.',
        'Split the parent budget across workers.',
        'Report total tokens per user request, not per agent.',
      ],
      complexity: 'A few lines. Prevents the exponential case entirely.',
      gotchas: [
        'Recursive spawning grows exponentially and looks fine in a demo with one level.',
        'Per-agent cost dashboards hide the real per-request number.',
      ],
      problems: ['Build an unbounded fan-out and price it', 'Add all three caps'],
    },
  ],

  pitfalls: [
    { title: 'Multi-agent for "better answers"', text: 'It buys parallelism and isolation. Quality comes from context and tools.' },
    { title: 'Parallelising a sequence', text: 'Workers that need each other’s results end up guessing.' },
    { title: 'Free-prose handoffs', text: 'The detail that mattered is exactly what gets summarised away.' },
    { title: 'Treating a failed worker as a negative finding', text: 'The most dangerous failure in the pattern.' },
    { title: 'No `gaps` field', text: 'The orchestrator cannot tell "nothing there" from "did not look".' },
    { title: 'Workers spawning workers', text: 'Exponential cost growth from an innocuous-looking demo.' },
    { title: 'Duplicating the budget per worker', text: 'Five workers at full budget is five times the ceiling you set.' },
    { title: 'No uncertainty branch in a router', text: 'It picks the least-wrong specialist and sounds confident.' },
    { title: 'Same-model, same-context self-critique', text: 'Doubles the cost for a plausible-sounding review.' },
    { title: 'Uncapped revise loops', text: 'A cost incident with a critic attached.' },
    { title: 'No correlation id across agents', text: 'One complaint becomes an archaeology project.' },
    { title: 'Reporting per-agent cost', text: 'Hides the per-request number that would prompt the right questions.' },
    { title: 'Discarding the single-agent baseline', text: 'You lose the ability to prove the complexity is still earning its keep.' },
  ],

  cheatsheet: [
    { label: 'A sub-agent is', value: 'a function call with its own context' },
    { label: 'Buys', value: 'parallelism and context isolation' },
    { label: 'Does not buy', value: 'intelligence' },
    { label: 'Default', value: 'one agent' },
    { label: 'Specialisation?', value: 'use routing, not fan-out' },
    { label: 'Fan-out test', value: 'genuinely independent sub-tasks?' },
    { label: 'Worker return', value: 'found, summary, evidence, gaps, confidence' },
    { label: 'Failures', value: 'pass through as status, never as absence' },
    { label: 'Depth cap', value: '1 — workers do not spawn workers' },
    { label: 'Width cap', value: 'in the plan schema (`maxItems`)' },
    { label: 'Budget', value: 'split from the parent, never duplicated' },
    { label: 'Workers can be', value: 'a cheaper model' },
    { label: 'Router needs', value: 'a low-confidence branch' },
    { label: 'Critic needs', value: 'an information advantage' },
    { label: 'Critic rounds', value: 'one or two, capped' },
    { label: 'Trace by', value: 'root id across every agent' },
    { label: 'Report', value: 'total tokens per user request' },
    { label: 'Keep', value: 'the single-agent baseline runnable' },
  ],

  problems: [
    { name: 'Rebuild a multi-agent design as one agent', difficulty: 'Easy', pattern: 'Justification', insight: 'Take any three-agent design and implement it as one agent with all the tools. Compare cost, latency and quality. The simple version wins more often than people expect.' },
    { name: 'Measure the handoff tax', difficulty: 'Easy', pattern: 'Handoff', insight: 'Count tokens spent on summarising and re-establishing context across a boundary. That is what parallelism costs you, per split.' },
    { name: 'Build orchestrator–worker for five searches', difficulty: 'Medium', pattern: 'Fan-out', insight: 'Five independent lookups, concurrent. Measure wall-clock against sequential and the orchestrator’s input tokens against the single-agent version. Both numbers should move sharply.' },
    { name: 'Kill a worker mid-run', difficulty: 'Medium', pattern: 'Dangerous absence', insight: 'Without a status contract, the synthesis confidently reports "no issues found" from a report that never arrived. Add the contract and watch it say so instead.' },
    { name: 'Parallelise a sequence on purpose', difficulty: 'Medium', pattern: 'Independence', insight: 'Fan out two tasks where the second needs the first. Watch worker 2 invent a plausible input. Then add the independence check to the plan schema.' },
    { name: 'Split one broad agent into three specialists', difficulty: 'Medium', pattern: 'Routing', insight: 'Thirteen tools and a long prompt become three short prompts with five tools each. Measure tool-selection accuracy and cost — both usually improve.' },
    { name: 'Route with no uncertainty branch, then add one', difficulty: 'Medium', pattern: 'Router', insight: 'Send deliberately ambiguous requests. Without the branch you get confident answers from the wrong tool set; with it, a generalist or a human.' },
    { name: 'Build both critic versions', difficulty: 'Hard', pattern: 'Critique', insight: 'One with test results, one with just "critique this". Score both against no critic at all. Frequently the second is worse than nothing.' },
    { name: 'Build an unbounded fan-out and price it', difficulty: 'Hard', pattern: 'Budget multiplication', insight: 'Let workers spawn workers for one request and record the total model calls. Then add the three caps and re-run.' },
    { name: 'Build the trace tree viewer', difficulty: 'Hard', pattern: 'Observability', insight: 'Root id, parent id, depth, per-agent tokens and a total per user request. Then re-run the single-agent baseline on the same eval and compare — periodically, forever.' },
  ],
}
