export default {
  id: 'ai-workflows',
  title: 'Agentic Workflows: Chaining, Routing & Parallelisation',
  short: 'Agentic Workflows',
  icon: 'AltRouteRounded',
  tier: 'Elite',
  order: 18,
  estHours: 5,
  prereqs: ['ai-multi-agent'],
  tagline: 'You write the control flow; the model fills in each step. Most production systems should be this.',
  mentalModel:
    'The difference between a workflow and an agent is **who decides the order of operations**. In a workflow you do — the steps are in your code, visible in a diagram, testable in isolation. In an agent the model does. Workflows trade flexibility for something you usually want more: predictability, cheap testing, and a failure you can point at.',
  whyItMatters:
    'Almost everything people build as an agent has a knowable structure and should be a workflow. Workflows cost less, fail in ways you anticipated, can be unit-tested step by step, and let you use a cheap model for the easy steps. Reaching for a workflow first — and an agent only where the sequence genuinely cannot be written down — is the single most reliable architectural instinct in this field.',

  reference: {
    title: 'The five topologies',
    head: ['Pattern', 'Shape', 'Use when'],
    rows: [
      ['**Prompt chaining**', 'A → B → C, each step feeding the next', 'The task decomposes into fixed stages'],
      ['**Routing**', 'Classify, then run one branch', 'Distinct input types need different handling'],
      ['**Parallelisation**', 'Run N steps at once, then combine', 'Independent sub-tasks, or several views of one input'],
      ['**Evaluator–optimiser**', 'Generate → check → revise, bounded', 'Quality is checkable and worth iterating for'],
      ['**Orchestrator–worker**', 'A step plans the sub-tasks dynamically', 'The number of sub-tasks is not known in advance'],
    ],
  },

  sections: [
    {
      id: 'workflow-vs-agent',
      title: 'Workflow or agent: the decision',
      blocks: [
        {
          t: 'ascii',
          caption: 'The same job, both ways. Read the right-hand column before choosing the left.',
          code: `
  WORKFLOW — you own the control flow      AGENT — the model owns it
  ┌────────────────────────────────┐       ┌────────────────────────────┐
  │ extract  = classify(ticket)    │       │ while tool_use:            │
  │ if urgent:                     │       │     run the tool           │
  │     facts = lookup(extract)    │       │     ask again              │
  │     draft = compose(facts)     │       │                            │
  │     return review(draft)       │       │ (the model decides         │
  │ return acknowledge(extract)    │       │  everything else)          │
  └────────────────────────────────┘       └────────────────────────────┘

  ✔ predictable: same path every time      ✔ handles the unanticipated
  ✔ each step unit-testable in isolation    ✔ no decomposition work for you
  ✔ cheap model per easy step               ✔ composes tools you did not
  ✔ cost and latency knowable in advance      think to combine
  ✔ a failure points at ONE step
  ✘ only handles what you anticipated       ✘ unpredictable cost and path
  ✘ new case = new code                     ✘ failures are emergent
                                            ✘ needs bounds, tracing, gates

  THE TEST — can you draw the flowchart?
      YES, and it fits on a page        → workflow
      YES, but a step needs to choose
      among tools                        → workflow with ONE agentic step
      NO, it genuinely depends on what
      is discovered along the way        → agent
      NO, because nobody has thought
      about it yet                       → think about it. This is the
                                            most common real answer.`,
        },
        {
          t: 'key',
          title: 'The best architecture is usually a workflow with one agentic step',
          text: 'Most real tasks have a known shape with one genuinely open part — "gather whatever evidence is relevant" inside an otherwise fixed pipeline. Make that one step an agent with a tight budget, and keep the rest as ordinary code. You get the flexibility exactly where it is needed and predictability everywhere else, which is a far better trade than making the whole thing agentic.',
        },
      ],
    },
    {
      id: 'chaining',
      title: 'Prompt chaining',
      blocks: [
        {
          t: 'p',
          text: 'Break a task into stages and feed each output into the next. The gain is not just clarity: each stage can be prompted, tested, priced and modelled separately — and you can put a cheap model on the easy stages.',
        },
        {
          t: 'ascii',
          caption: 'Chaining with gates. The gate is the part people leave out.',
          code: `
  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐
  │ EXTRACT  │──▶│ ENRICH   │──▶│ COMPOSE  │──▶│ CHECK    │
  │ haiku    │   │ (no LLM) │   │ opus     │   │ haiku    │
  │ 200 tok  │   │ a DB call│   │ 2000 tok │   │ 300 tok  │
  └────┬─────┘   └────┬─────┘   └────┬─────┘   └────┬─────┘
       │              │              │              │
     GATE           GATE                          GATE
   valid? ✘        found? ✘                      passes? ✘
       │              │                              │
       ▼              ▼                              ▼
   escalate      "not in our            revise once, then escalate
                  records"

  WHY THE GATES MATTER MORE THAN THE STEPS:
      without them, stage 3 composes a confident reply from stage 2's
      empty result, and stage 4 checks a document built on nothing.
      Errors propagate FORWARD and get more plausible at every step.

  A gate is just: "is this output good enough to continue?" — usually
  a deterministic check in code, not another model call.

  WHERE THE MONEY GOES, on this shape:
      one-shot opus for everything     ~2,500 tokens on the big model
      chained with the split above     ~2,000 opus + ~500 haiku
      → similar quality, lower cost, and three of the four stages are
        cheaply unit-testable`,
        },
        {
          t: 'code',
          lang: 'python',
          caption: 'A chain where every stage is a function you can test on its own',
          code: `
def handle_ticket(ticket: str, session) -> Reply:
    # 1. Cheap, narrow, schema-constrained.
    extracted = extract_ticket(ticket)              # haiku
    if not extracted["order_id"]:
        return Reply.ask_for("an order number")     # gate

    # 2. No model at all. The cheapest step is the one you do not make.
    order = orders.get(extracted["order_id"], tenant=session.tenant_id)
    if order is None:
        return Reply.not_found(extracted["order_id"])   # gate

    # 3. The expensive step, and the only one that needs to be.
    draft = compose_reply(ticket, extracted, order)  # opus

    # 4. Cheap verification, with a bounded repair.
    check = check_reply(draft, order)                # haiku
    if not check["ok"]:
        draft = compose_reply(ticket, extracted, order,
                              feedback=check["problems"])
        if not check_reply(draft, order)["ok"]:
            return Reply.escalate(draft, check["problems"])   # gate

    return Reply.send(draft)

# Each of extract_ticket, compose_reply and check_reply is independently
# testable with fixed inputs and expected outputs — which is the thing an
# agent can never give you.`,
        },
        {
          t: 'warn',
          title: 'Errors compound along a chain, and they get more convincing',
          text: 'Stage 1 extracts the wrong order id. Stage 2 finds a real order — the wrong one. Stage 3 writes a fluent, specific, entirely wrong reply. Stage 4 checks it against the order it was given and passes it. Every stage did its job. Gates exist to stop a bad output travelling, and the cheapest gate is usually a deterministic check, not another model.',
        },
      ],
    },
    {
      id: 'parallelisation',
      title: 'Parallelisation: sectioning and voting',
      blocks: [
        {
          t: 'p',
          text: 'Two distinct patterns share the name. **Sectioning** splits the work; **voting** runs the same work several ways and combines the answers. They solve different problems and are often confused.',
        },
        {
          t: 'ascii',
          caption: 'Sectioning for speed and focus; voting for reliability on a decision.',
          code: `
  SECTIONING — different sub-tasks, run at once
                    ┌─── extract entities ────┐
      document ─────┼─── classify topic ──────┼──▶ combine ──▶ result
                    └─── detect PII ──────────┘
      Each prompt is short and focused; one call would have to do all
      three at once and would do each of them slightly worse.
      Latency = the slowest branch, not the sum.

  VOTING — the same question, several ways
                    ┌─── prompt A: "is this safe?" ───┐
      input ────────┼─── prompt B: "find any policy   ┼──▶ aggregate
                    │    violation"                   │      • any flag → block
                    └─── prompt C: different model ───┘      • majority → decide
                                                             • all agree → auto
                                                             • disagree → human

      Use when a false negative is expensive and you will pay 3× to
      reduce it. The aggregation RULE is the design decision: "any
      flag blocks" is strict and noisy; "majority" is balanced;
      "unanimous or human" is the one that handles disagreement well.

  THE COMMON MISTAKE: voting with three near-identical prompts on the
  same model. They agree because they are the same, so you have paid
  three times for one opinion. Vary the model, the framing, or the
  information — or do not vote.`,
        },
        {
          t: 'code',
          lang: 'python',
          caption: 'Voting where disagreement is a first-class outcome',
          code: `
async def moderate(content: str) -> dict:
    checks = await asyncio.gather(
        classify(content, POLICY_PROMPT,  model="claude-opus-5"),
        classify(content, HARM_PROMPT,    model="claude-opus-5"),
        classify(content, LEGAL_PROMPT,   model="claude-sonnet-5"),
    )

    flags = [c for c in checks if c["violation"]]

    if len(flags) == len(checks):
        return {"action": "block", "confidence": "high",
                "reasons": [c["reason"] for c in flags]}
    if not flags:
        return {"action": "allow", "confidence": "high"}

    # Disagreement is INFORMATION, not an inconvenience to average away.
    # These are exactly the cases a human should see.
    return {"action": "review", "confidence": "low",
            "split": f"{len(flags)}/{len(checks)} flagged",
            "reasons": [c["reason"] for c in flags]}`,
        },
        {
          t: 'tip',
          title: 'Sectioning also improves quality, not just speed',
          text: 'A single prompt asked to extract entities, classify the topic and detect personally identifiable information does all three a little worse than three focused prompts. Splitting gives each task the model’s full attention and a schema of its own — so sectioning frequently pays for itself in accuracy before you even count the latency.',
        },
      ],
    },
    {
      id: 'evaluator-optimiser',
      title: 'Evaluator–optimiser',
      blocks: [
        {
          t: 'p',
          text: 'Generate, check, revise. This works when there is a **real** check — something mechanical the generator did not have. Without that, it is the self-critique theatre from the multi-agent chapter.',
        },
        {
          t: 'ascii',
          caption: 'The check must be something the generator could not do itself.',
          code: `
  ┌───────────┐      ┌────────────────┐      ┌──────────────┐
  │ GENERATE  │─────▶│ EVALUATE       │─────▶│ accept?      │
  │           │      │                │      └──────┬───────┘
  │           │◀─────│ specific       │        yes  │  no
  └───────────┘ with │ feedback       │             ▼   │
                feedback              │        ship it   │
                     └────────────────┘                 │
                            ▲                            │
                            └──── max 2 rounds ──────────┘
                                  then escalate

  CHECKS THAT ARE REAL (the generator could not run these)
      ✔ the code compiles / the tests pass
      ✔ the SQL runs and returns rows
      ✔ every quoted claim is a substring of the sources
      ✔ the JSON validates against a downstream schema
      ✔ the numbers in the summary match the numbers in the table
      ✔ a linter, a type checker, a spell checker

  CHECKS THAT ARE THEATRE
      ✘ "rate this answer's quality from 1 to 10"
      ✘ "is this response helpful?"
      ✘ the same model, same context, asked to find problems

  BOUND IT: two rounds. Exhausting them is an OUTCOME to report, not a
  reason to loop again. An uncapped revise loop is a cost incident with
  a quality-assurance story attached.`,
        },
        {
          t: 'code',
          lang: 'python',
          caption: 'Code generation with tests as the evaluator — the canonical honest version',
          code: `
def generate_with_tests(spec: str, tests: str, rounds: int = 2) -> dict:
    code = generate_code(spec, tests)

    for attempt in range(rounds):
        result = run_in_sandbox(code, tests)     # the real check
        if result.passed:
            return {"code": code, "attempts": attempt + 1, "passed": True}

        # Feed back the ACTUAL failure output. "Try again" teaches nothing;
        # a stack trace and a failing assertion teach a great deal.
        code = generate_code(spec, tests, feedback=(
            f"The previous attempt failed {result.failed_count} tests.\\n"
            f"{result.output[:2000]}"))

    return {"code": code, "attempts": rounds, "passed": False,
            "last_failure": result.output[:2000]}`,
        },
        {
          t: 'key',
          title: 'Feed back the specific failure, not the fact of failure',
          text: 'A stack trace, a failing assertion, the exact unsupported quote, the schema validation error — these give the model something to act on. "That was not good enough, try again" produces a rephrasing of the same answer, and you have paid twice for it. The quality of the feedback is the quality of the loop.',
        },
      ],
    },
    {
      id: 'composing',
      title: 'Composing a real system',
      blocks: [
        {
          t: 'p',
          text: 'Production systems combine the patterns. Here is a support pipeline using four of the five, with one bounded agentic step where the flexibility is genuinely needed.',
        },
        {
          t: 'ascii',
          caption: 'Four patterns, one flow, one agentic step. Note the cheap models doing most of the work.',
          code: `
  incoming ticket
        │
        ▼
  ┌─────────────────────┐
  │ SECTION (parallel)  │  three focused prompts at once, haiku
  │  • classify         │
  │  • extract entities │
  │  • detect sentiment │
  └──────────┬──────────┘
             ▼
  ┌─────────────────────┐
  │ ROUTE               │  one cheap classification
  └──┬──────┬───────┬───┘
     │      │       │
     ▼      ▼       ▼
  simple  complex  human
  reply     │      (angry, legal, refund > threshold)
     │      │
     │      ▼
     │  ┌──────────────────────────────┐
     │  │ AGENT  ← the ONE open step    │
     │  │ gather whatever evidence is   │
     │  │ relevant. max 6 steps,        │
     │  │ read-only tools, own budget   │
     │  └──────────┬───────────────────┘
     │             ▼
     │  ┌──────────────────────────────┐
     │  │ CHAIN: compose → check        │  opus, then haiku
     │  │ EVALUATOR-OPTIMISER, 1 round  │
     │  └──────────┬───────────────────┘
     └─────────────┤
                   ▼
            ┌─────────────┐
            │ FINAL GATE  │  deterministic: tone, PII, policy, length
            └──────┬──────┘
                   ▼
            send, or escalate

  Every arrow is code you wrote. Exactly one box is open-ended, it is
  read-only, and it has a budget. That is the shape to aim for.`,
        },
        {
          t: 'table',
          caption: 'What to put on each step. Most steps do not need the biggest model.',
          head: ['Step type', 'Model', 'Why'],
          rows: [
            ['Classification, routing, extraction', 'Haiku', 'Short output, closed set, schema-constrained'],
            ['Deterministic lookup or check', '**No model**', 'The cheapest step is the one you do not make'],
            ['Composing customer-facing text', 'Opus', 'Quality is visible to the user'],
            ['Verification against a source', 'Haiku', 'A narrow, checkable comparison'],
            ['The open-ended agentic step', 'Opus, high effort', 'Judgement and tool selection'],
            ['Final policy gate', '**No model**', 'Regex, allow-lists, length — must be deterministic'],
          ],
        },
        {
          t: 'key',
          title: 'The cheapest step is the one you do not make',
          text: 'Every workflow has steps that are really database lookups, template fills, regex checks or business rules. Doing those in code is faster, exact, free, and testable. A workflow whose every box is a model call has usually not been designed — it has been transcribed from a description.',
        },
      ],
    },
    {
      id: 'operating',
      title: 'Operating a workflow',
      blocks: [
        {
          t: 'p',
          text: 'Workflows are much easier to operate than agents, and the reason is worth stating explicitly: the steps are fixed, so every metric can be attributed to one of them.',
        },
        {
          t: 'code',
          lang: 'python',
          caption: 'Per-step instrumentation, which falls out naturally from having named steps',
          code: `
@instrumented("extract")
def extract_ticket(ticket: str) -> dict: ...

# The decorator records, per step:
#   latency p50/p95            → which step is slow
#   input and output tokens    → which step is expensive
#   gate rejection rate        → which step fails, and how often
#   model and prompt version   → what changed when quality moved
#   error rate by type
#
# The aggregates a workflow gives you for free, and an agent does not:
#   cost per request, decomposed by step — so "make it cheaper" has an
#     obvious target instead of a debate
#   the funnel: how many requests reach each step, and where they exit
#   step-level A/B: change ONE step's prompt and attribute the result
#   a step you can swap for a cheaper model and measure in isolation`,
        },
        {
          t: 'steps',
          items: [
            { title: 'Name every step and instrument it', text: 'The names become your dashboard, your trace spans and your test file layout.' },
            { title: 'Unit-test each step with fixed inputs', text: 'This is the advantage over an agent — use it. A step is a function with a schema on both ends.' },
            { title: 'Track the funnel', text: 'Where requests exit tells you which gate is doing the work and which is never firing.' },
            { title: 'A/B one step at a time', text: 'Attribution is the entire point of having steps.' },
            { title: 'Try a cheaper model per step, measured', text: 'Classification and verification steps usually hold quality on a smaller model; the composing step usually does not.' },
            { title: 'Review escalations weekly', text: 'They are your list of missing branches, and the most reliable signal for where the workflow needs to grow.' },
          ],
        },
        {
          t: 'note',
          title: 'When the workflow should become an agent',
          text: 'When the escalation review keeps producing cases that need a *different combination* of existing steps rather than a new step. That is the signal that the sequence genuinely varies — and that is the one honest reason to hand control of the order to the model. Growing a workflow branch by branch until you hit that point is the right way to discover you needed an agent.',
        },
      ],
    },
  ],

  patterns: [
    {
      id: 'draw-the-flowchart',
      name: 'Draw the Flowchart First',
      oneLiner: 'If it fits on a page, it is a workflow.',
      useWhen: ['Before building any multi-step LLM system.'],
      recognize: ['An agent chosen because nobody mapped the task.', 'A design document with no diagram.'],
      steps: [
        'Write the steps as a flowchart, including the failure branches.',
        'If you can draw it, implement it as code with model calls inside.',
        'If exactly one box is genuinely open, make that box an agent with a budget.',
        'If you cannot draw it because the path depends on discoveries, use an agent.',
      ],
      complexity: 'An hour with a whiteboard. Usually saves weeks.',
      gotchas: [
        '"I cannot draw it" often means "I have not thought about it yet".',
        'The failure branches are the half people omit, and they are where the gates go.',
      ],
      problems: ['Draw the flowchart for an existing agent', 'Count the boxes that are genuinely open'],
    },
    {
      id: 'gate-between-steps',
      name: 'Put a Gate Between Every Step',
      oneLiner: 'Errors compound forward and get more convincing as they go.',
      useWhen: ['Every chain of two or more steps.'],
      recognize: ['Stage 3 composing from stage 2’s empty result.', 'A fluent, confident, entirely wrong output.'],
      steps: [
        'After each step, check the output is good enough to continue.',
        'Prefer a deterministic check to another model call.',
        'On failure: retry once with specific feedback, or exit the workflow.',
        'Log gate rejection rates per step.',
      ],
      template: {
        lang: 'python',
        caption: 'The gate is usually three lines, and it is what stops the plausible wrong answer',
        code: `
extracted = extract_ticket(ticket)
if not extracted["order_id"] or extracted["confidence"] == "low":
    metrics.incr("gate.extract.rejected")
    return Reply.ask_for("an order number")`,
      },
      complexity: 'A few lines per step.',
      gotchas: [
        'A gate that never fires is not validating anything — check the rate.',
        'A model-based gate on a deterministic condition is wasted money.',
      ],
      problems: ['Remove the gates and trace a compounding error', 'Put them back'],
    },
    {
      id: 'cheap-model-per-step',
      name: 'Pick the Model per Step',
      oneLiner: 'Classification, routing and verification rarely need the biggest model.',
      useWhen: ['Any workflow with more than two steps.'],
      recognize: ['One model id used for every call.', 'No per-step cost breakdown.'],
      steps: [
        'Break cost down by step first.',
        'Try a cheaper model on the narrow, schema-constrained steps.',
        'Measure that step in isolation against its own test cases.',
        'Keep the expensive model where quality is user-visible.',
      ],
      complexity: 'Frequently a large cost reduction with no quality change.',
      gotchas: [
        'Measure per step or you cannot attribute a regression.',
        'Cost per completed task, not per call — a cheaper step that adds a retry is not cheaper.',
      ],
      problems: ['Break cost down by step', 'Downgrade one step and prove parity'],
    },
    {
      id: 'real-evaluator',
      name: 'The Evaluator Must Know Something New',
      oneLiner: 'Tests, a compiler, the sources — not "rate this out of ten".',
      useWhen: ['Any generate–check–revise loop.'],
      recognize: ['A quality score from the same model and context.', 'An uncapped revise loop.'],
      steps: [
        'Find a mechanical check the generator could not run.',
        'Feed back the specific failure output, not the fact of failure.',
        'Cap at two rounds and report exhaustion as an outcome.',
        'Measure against no loop at all before keeping it.',
      ],
      complexity: 'Doubles the cost of the step when it fires.',
      gotchas: [
        'Self-assessment with no new information is close to noise.',
        'Generic feedback produces a rephrasing of the same answer.',
      ],
      problems: ['Build both evaluators', 'Compare against no loop'],
    },
    {
      id: 'one-agentic-step',
      name: 'One Agentic Step Inside a Workflow',
      oneLiner: 'Flexibility exactly where it is needed; predictability everywhere else.',
      useWhen: ['A fixed pipeline with one genuinely open stage.'],
      recognize: ['A fully agentic system whose flow is 90% predictable.', 'A workflow that cannot handle "gather whatever is relevant".'],
      steps: [
        'Identify the one step whose sequence genuinely varies.',
        'Make it an agent with read-only tools and a small step budget.',
        'Constrain its return with a schema so the next step is deterministic again.',
        'Keep every other step as ordinary code.',
      ],
      complexity: 'One bounded agent instead of an unbounded system.',
      gotchas: [
        'Two agentic steps in one workflow usually means the decomposition is wrong.',
        'Without a return schema, the agentic step infects the rest of the pipeline.',
      ],
      problems: ['Convert an agent into a workflow with one agentic step', 'Compare cost and variance'],
    },
  ],

  pitfalls: [
    { title: 'Building an agent for a knowable sequence', text: 'You pay unpredictability for flexibility you do not need.' },
    { title: 'No gates between steps', text: 'A wrong output travels and becomes more convincing at each stage.' },
    { title: 'One model for every step', text: 'You are paying Opus rates to classify into three buckets.' },
    { title: 'A model call where code would do', text: 'The cheapest step is the one you do not make.' },
    { title: 'Voting with three identical prompts', text: 'They agree because they are the same. Vary model, framing or information.' },
    { title: 'Averaging away disagreement', text: 'Disagreement is the signal that a human should look.' },
    { title: 'An evaluator with no new information', text: 'Self-assessment theatre at double the price.' },
    { title: 'Generic revise feedback', text: 'Produces a rephrasing of the same answer.' },
    { title: 'Uncapped revise loops', text: 'A cost incident with a quality-assurance story attached.' },
    { title: 'Two agentic steps in one workflow', text: 'The decomposition is probably wrong. Look again.' },
    { title: 'No per-step instrumentation', text: 'Throws away the main advantage workflows have over agents.' },
    { title: 'Gates that never fire', text: 'They are not validating anything; check the rejection rate.' },
    { title: 'Never reviewing escalations', text: 'That list is your roadmap for the next branch.' },
  ],

  cheatsheet: [
    { label: 'Workflow', value: 'you own the control flow' },
    { label: 'Agent', value: 'the model owns it' },
    { label: 'The test', value: 'can you draw the flowchart?' },
    { label: 'Best shape', value: 'workflow + one agentic step' },
    { label: 'Chaining', value: 'fixed stages, gate between each' },
    { label: 'Routing', value: 'classify, then one branch' },
    { label: 'Sectioning', value: 'different sub-tasks in parallel' },
    { label: 'Voting', value: 'same question, varied ways' },
    { label: 'Vary in voting', value: 'model, framing, or information' },
    { label: 'Disagreement', value: 'route to a human' },
    { label: 'Evaluator', value: 'needs a real, mechanical check' },
    { label: 'Feedback', value: 'the specific failure, not "try again"' },
    { label: 'Revise rounds', value: 'two, then escalate' },
    { label: 'Model per step', value: 'haiku for narrow, opus for visible' },
    { label: 'Cheapest step', value: 'the one with no model in it' },
    { label: 'Instrument', value: 'latency, tokens, gate rate, per step' },
    { label: 'Become an agent when', value: 'the step COMBINATION varies' },
  ],

  problems: [
    { name: 'Draw the flowchart for an existing agent', difficulty: 'Easy', pattern: 'Decision', insight: 'Take something built as an agent and map it. Count the boxes that are genuinely open-ended — usually zero or one, which tells you what it should have been.' },
    { name: 'Chain four steps with gates', difficulty: 'Easy', pattern: 'Chaining', insight: 'Extract, look up, compose, check. Unit-test each step in isolation and notice how much easier that is than testing an agent.' },
    { name: 'Trace a compounding error', difficulty: 'Medium', pattern: 'Gates', insight: 'Remove the gates and feed an ambiguous input. Watch a wrong extraction become a fluent, specific, wrong reply that passes the final check. Then put the gates back.' },
    { name: 'Section a single prompt into three', difficulty: 'Medium', pattern: 'Sectioning', insight: 'Split "extract, classify and detect PII" into three parallel calls. Measure latency and per-task accuracy — both usually improve, which surprises people.' },
    { name: 'Build voting that disagrees usefully', difficulty: 'Medium', pattern: 'Voting', insight: 'Three identical prompts first: near-perfect agreement and zero value. Then vary model and framing and watch real disagreement appear on genuinely hard cases.' },
    { name: 'Build both evaluators', difficulty: 'Medium', pattern: 'Evaluator–optimiser', insight: 'One using real test results, one using "rate this 1-10". Score both against no loop. The self-rating version frequently adds nothing but cost.' },
    { name: 'Break cost down by step', difficulty: 'Medium', pattern: 'Instrumentation', insight: 'Per-step tokens and cost for a hundred requests. One step is usually 70% of the bill, and it is often not the one people expect.' },
    { name: 'Downgrade one step and prove parity', difficulty: 'Hard', pattern: 'Model per step', insight: 'Move the classification step to Haiku and measure that step alone against its test cases. Keep the evidence — it is how the next downgrade gets approved.' },
    { name: 'Convert an agent into a workflow plus one agentic step', difficulty: 'Hard', pattern: 'Composition', insight: 'Same task, both ways, same eval. Compare cost, p95 latency, variance and debuggability. Write down what you gave up as well as what you gained.' },
    { name: 'Review a month of escalations', difficulty: 'Hard', pattern: 'Growth', insight: 'Classify each one: missing branch, or genuinely variable sequence? The ratio tells you whether to add a branch or to hand control of the order to the model.' },
  ],
}
