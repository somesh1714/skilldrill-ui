export default {
  id: 'ai-agent-design',
  title: 'Designing an Agent: Tools, Context & Autonomy',
  short: 'Agent Design',
  icon: 'ArchitectureRounded',
  tier: 'Advanced',
  order: 14,
  estHours: 5,
  prereqs: ['ai-agent-loop'],
  tagline: 'The loop is twelve lines. The design decisions around it are the whole job.',
  mentalModel:
    'Design an agent the way you would **onboard a contractor for a week**. What can they see? What are they allowed to change? What do they do when stuck? Who signs off on the irreversible things? What do they hand over at the end? An agent that fails in production is almost always one where one of those five questions was never answered.',
  whyItMatters:
    'Two teams building the same agent with the same model get wildly different results, and the difference is never the loop code. It is the tool surface, the context strategy, the autonomy boundary and the verification story. This chapter is the checklist that turns a working demo into something you can put in front of customers.',

  reference: {
    title: 'The five design decisions, in the order to make them',
    head: ['Decision', 'The question', 'Getting it wrong looks like'],
    rows: [
      ['**Scope**', 'What is the smallest useful version?', 'A "do anything" agent that does nothing reliably'],
      ['**Tool surface**', 'What can it see and change?', 'Twenty overlapping tools; wrong tool chosen'],
      ['**Context strategy**', 'What does it know, and for how long?', 'Context explosion; amnesia between runs'],
      ['**Autonomy**', 'What can it do without a human?', 'A refund issued from a prompt injection'],
      ['**Verification**', 'How do you know it worked?', 'Confident false success'],
    ],
  },

  sections: [
    {
      id: 'scope',
      title: 'Scope: the smallest useful agent',
      blocks: [
        {
          t: 'lead',
          text: 'The strongest predictor of an agent that works is a narrow, well-defined job. "Support agent" is not a scope; "answer order-status questions from our order database and shipping API" is.',
        },
        {
          t: 'ascii',
          caption: 'Narrow the job until the tool list is obvious. If the tools are unclear, the scope is too wide.',
          code: `
  TOO WIDE — nobody can enumerate the tools
      "an agent that handles customer support"
          → which questions? which systems? what may it change?
          → the tool list is unbounded, so selection accuracy collapses
          → no way to say whether a given run succeeded

  STILL TOO WIDE
      "an agent that answers questions and takes actions on orders"
          → "takes actions" is doing a lot of quiet work in that sentence

  RIGHT
      "answers order-status and delivery questions for the authenticated
       customer, from the orders DB and the courier API, read-only,
       escalating anything about refunds or complaints to a human"

          tools:   get_order, search_my_orders, get_tracking, escalate
          success: the customer's question is answered, or escalated,
                   with the order id cited
          failure: wrong order surfaced, or a question answered that
                   should have been escalated

  Now you can write an eval, because you can write down what success is.

  THE TEST: if you cannot list the tools in under a minute, and cannot
  state in one sentence what a successful run looks like, the scope is
  still too wide. Narrow it and ship; widen later from evidence.`,
        },
        {
          t: 'key',
          title: 'Scope is decided by the failure you can tolerate, not by the tools available',
          text: 'An agent that can technically do ten things should be scoped to the subset whose failures you can detect and recover from. Reading an order and getting it wrong is embarrassing; issuing a refund and getting it wrong is money and a support ticket. Let the cost of error draw the boundary, and the rest of the design follows.',
        },
      ],
    },
    {
      id: 'tool-surface',
      title: 'Designing the tool surface',
      blocks: [
        {
          t: 'p',
          text: 'The tool surface is the agent’s entire model of the world. Two decisions dominate: how coarse the tools are, and whether you give it a general-purpose escape hatch.',
        },
        {
          t: 'compare',
          left: {
            title: 'Many narrow tools',
            items: [
              'Each one obvious to select',
              'Easy to authorise individually',
              'Easy to audit — the name says what happened',
              '✘ Twenty of them confuses selection',
              '✘ Large schema footprint in every request',
              '✘ A new question needs a new tool',
            ],
          },
          right: {
            title: 'Few general tools (`bash`, SQL, code)',
            items: [
              'Enormously flexible; composes without you',
              'Tiny schema footprint',
              'Handles questions you did not anticipate',
              '✘ Authorising "run SQL" is authorising everything',
              '✘ Hard to audit: one tool name, infinite behaviours',
              '✘ Needs a real sandbox',
            ],
          },
        },
        {
          t: 'ascii',
          caption: 'The practical answer is a small set of specific tools plus one guarded general one.',
          code: `
  THE SHAPE THAT WORKS
  ┌─────────────────────────────────────────────────────────────┐
  │  SPECIFIC, SAFE, WELL-DESCRIBED          ← the common path   │
  │    get_order(order_id)                                       │
  │    search_orders(email, status, from, to)                    │
  │    get_tracking(order_id)                                    │
  │    read_policy(topic)                                        │
  ├─────────────────────────────────────────────────────────────┤
  │  ONE GENERAL ESCAPE HATCH, TIGHTLY BOUNDED                   │
  │    run_readonly_sql(query)                                   │
  │      • a read-only replica, a role with SELECT only           │
  │      • a mandatory tenant predicate injected in CODE          │
  │      • statement timeout, row limit, query logged             │
  ├─────────────────────────────────────────────────────────────┤
  │  ACTIONS, EACH GATED INDIVIDUALLY                            │
  │    escalate_to_human(summary)        ← always allowed         │
  │    issue_refund(order_id, amount)    ← approval + idempotency │
  └─────────────────────────────────────────────────────────────┘

  Why the escape hatch earns its keep: the specific tools cover the
  questions you anticipated. Real users ask the other ones. Without an
  escape hatch, the agent says "I cannot do that" for anything slightly
  unusual; with one, it composes an answer — inside limits you set.

  Why it must be read-only: "run SQL" that can write is a single tool
  whose blast radius is your entire database. Read-only turns it from a
  liability into leverage.`,
        },
        {
          t: 'code',
          lang: 'python',
          caption: 'A bounded escape hatch — every limit enforced in code, none negotiable by the model',
          code: `
FORBIDDEN = re.compile(
    r"\\b(insert|update|delete|drop|alter|create|grant|truncate|copy)\\b",
    re.IGNORECASE)

@beta_tool
def run_readonly_sql(query: str) -> str:
    """Run a read-only SQL SELECT against the orders database.

    Use this only when the specific tools cannot answer the question.
    Schema: orders(id, customer_email, status, total_pence, created_at),
    shipments(order_id, courier, tracking_ref, shipped_at).

    Your query is automatically restricted to the current customer. It
    must be a single SELECT; anything else is rejected. Returns at most
    100 rows.
    """
    if FORBIDDEN.search(query) or ";" in query.rstrip(";"):
        return "Rejected: only a single read-only SELECT is permitted."

    # Defence in depth, all of it in code:
    #  1. a connection whose role can only SELECT
    #  2. a tenant predicate wrapped around whatever the model wrote
    #  3. a hard row limit and a statement timeout
    scoped = (f"SELECT * FROM ({query}) AS q "
              f"WHERE q.customer_email = %s LIMIT 100")
    try:
        with readonly_pool.connection(statement_timeout_ms=5000) as conn:
            rows = conn.execute(scoped, [current_customer_email()]).fetchall()
    except Exception as e:
        return f"Query failed: {e}. Check the column names against the schema."

    audit.log("readonly_sql", query=query, rows=len(rows))
    return json.dumps({"rows": len(rows), "data": rows[:100]})`,
        },
        {
          t: 'warn',
          title: 'Two tools that overlap will be chosen wrongly',
          text: 'If `get_order_status` and `get_order_details` both plausibly answer "has it shipped", the model will sometimes pick the weaker one, and you will read it as model error. Every pair of tools should have a one-sentence answer to "when would I use this instead of that", and each description should contain it. If you cannot write that sentence, merge them.',
        },
        {
          t: 'tip',
          title: 'Always give it a way out',
          text: '`escalate_to_human(summary, reason)` should be in nearly every agent. It converts "the agent invented something because it had no alternative" into a clean, cheap hand-off — and the escalation log becomes your best list of tools to build next. An agent with no escape route fabricates; that is a design failure, not a model failure.',
        },
      ],
    },
    {
      id: 'context-strategy',
      title: 'Context strategy: what it knows, and for how long',
      blocks: [
        {
          t: 'p',
          text: 'An agent has four kinds of knowledge with four different lifetimes. Deciding where each piece lives is a design decision, and conflating them is a common source of both cost and confusion.',
        },
        {
          t: 'table',
          caption: 'Four stores. Put each fact in exactly one of them.',
          head: ['Kind', 'Lifetime', 'Lives in', 'Example'],
          rows: [
            ['**Instructions**', 'Forever', 'System prompt (cached)', 'Role, rules, stop conditions'],
            ['**Reference data**', 'Until it changes', 'Retrieval, or a cached prefix', 'The refund policy, the DB schema'],
            ['**Working state**', 'One run', 'The conversation, plus a findings scratchpad', 'What it has checked so far'],
            ['**Durable memory**', 'Across runs', 'A store you own, or the memory tool', 'This customer prefers email; this fix failed before'],
          ],
        },
        {
          t: 'ascii',
          caption: 'The flow, with the lever that keeps each store bounded.',
          code: `
  ┌──────────────────────────────────────────────────────────────┐
  │ SYSTEM PROMPT              stable → cache_control breakpoint  │
  │   role, rules, stop conditions, tool descriptions             │
  ├──────────────────────────────────────────────────────────────┤
  │ REFERENCE                  fetch on demand, or cache          │
  │   policy text, schema, examples                               │
  │   → retrieve when large; cache when shared across runs        │
  ├──────────────────────────────────────────────────────────────┤
  │ WORKING STATE              grows every step  ← the danger      │
  │   tool calls and results, thinking, findings                  │
  │   → compact output, clear spent results, record findings       │
  ├──────────────────────────────────────────────────────────────┤
  │ DURABLE MEMORY             loaded at the start of a run        │
  │   what we learned about this customer / system / task         │
  │   → keep it SMALL and CURATED, or it becomes noise            │
  └──────────────────────────────────────────────────────────────┘

  The mistake that costs most: putting reference data in working state.
  A 40k-token policy document pasted into step 2 is then re-sent on every
  subsequent step. Put it in the cached prefix, or retrieve the relevant
  clause. Same information, a fraction of the bill.`,
        },
        {
          t: 'key',
          title: 'Give the agent a fresh start per run, plus a small curated memory',
          text: 'A long-lived conversation that never resets accumulates dead ends, corrected mistakes and stale observations — all of which the model keeps conditioning on. Prefer a clean run per task with a **short** durable memory loaded at the start. Ten curated facts beat two thousand turns of history, and they are far easier to audit.',
        },
      ],
    },
    {
      id: 'autonomy',
      title: 'Drawing the autonomy boundary',
      blocks: [
        {
          t: 'p',
          text: 'Autonomy is not one setting. It is a decision per tool, and the right question for each is: if this fires wrongly, how do we find out, and how do we undo it?',
        },
        {
          t: 'ascii',
          caption: 'Classify every tool on two axes. The quadrant tells you the machinery required.',
          code: `
                     REVERSIBLE                 IRREVERSIBLE
                 ┌───────────────────────┬───────────────────────────┐
     DETECTABLE  │ AUTONOMOUS            │ APPROVE FIRST             │
     (you will   │ add a tag, write a    │ send email, issue refund,  │
      notice)    │ note, open a draft    │ cancel order, deploy      │
                 │                       │                           │
                 │ audit log + undo      │ human confirm + idempotency│
                 │                       │ key + rate limit + audit   │
                 ├───────────────────────┼───────────────────────────┤
     UNDETECTABLE│ AUTONOMOUS, LOGGED    │ ★ DO NOT AUTOMATE ★        │
     (nobody     │ reads of non-sensitive│ silent data export, an     │
      will       │ data                  │ irreversible external call │
      notice)    │                       │ nobody audits              │
                 │ audit log, sampling   │                           │
                 │                       │ redesign so it becomes     │
                 │                       │ detectable, then approve   │
                 └───────────────────────┴───────────────────────────┘

  The bottom-right quadrant is where real incidents come from: something
  irreversible that nobody notices for a month. If a tool lands there,
  the fix is not a better prompt — it is to add detection (an audit
  trail, a notification, a reconciliation job) so it moves up a row.`,
        },
        {
          t: 'code',
          lang: 'python',
          caption: 'Approval as a first-class loop state, not an exception',
          code: `
@dataclass
class PendingAction:
    tool: str
    args: dict
    reason: str
    idempotency_key: str


def execute(block, session) -> dict:
    tool, args = block.name, block.input

    if tool in NEEDS_APPROVAL:
        key = idempotency_key(tool, args)       # from the business fact

        if ledger.already_done(key):
            # A re-request after a timeout or a cleared result. Do NOT
            # run it again; return what happened the first time.
            return result(block.id, ledger.outcome(key))

        if not session.approved(key):
            session.pending.append(PendingAction(tool, args,
                                                 "needs human approval", key))
            # A result the model can act on: it should report, not retry.
            return result(block.id, {
                "status": "awaiting_approval",
                "message": ("This action requires human approval. Tell the "
                            "user what you are proposing and stop. Do not "
                            "retry this call."),
            })

    outcome = TOOLS[tool](**args, tenant_id=session.tenant_id)
    if tool in NEEDS_APPROVAL:
        ledger.record(idempotency_key(tool, args), outcome)
    audit.log(tool=tool, args=args, session=session.id, outcome=outcome)
    return result(block.id, outcome)`,
        },
        {
          t: 'trap',
          title: 'Approval fatigue defeats approval',
          text: 'If the agent asks for confirmation eleven times per task, humans start approving without reading — and you now have the appearance of oversight with none of the substance. Gate on the things that genuinely matter: refunds over a threshold, anything customer-facing, anything irreversible. Make everything else autonomous with a good audit trail. Fewer, more meaningful prompts get read.',
        },
        {
          t: 'note',
          title: 'Dry-run mode is the cheapest safety feature you will build',
          text: 'A flag that makes every write tool log what it *would* have done and return a realistic success response lets you run the agent over a hundred real tasks and read exactly what it would have changed. It finds design bugs no eval catches, it costs an afternoon, and it is the single most persuasive artefact for getting write access approved.',
        },
      ],
    },
    {
      id: 'evaluating-agents',
      title: 'Evaluating an agent (which is harder than evaluating a prompt)',
      blocks: [
        {
          t: 'p',
          text: 'A single call has one input and one output. An agent run is a trajectory, and two runs can both succeed while one took three steps and the other took fourteen. So you score the outcome *and* the path.',
        },
        {
          t: 'table',
          caption: 'Six metrics. The first is what users care about; the rest are what you fix.',
          head: ['Metric', 'Measures', 'Why it matters'],
          rows: [
            ['**Task success**', 'Did the outcome actually happen?', 'Verified in code, not self-reported'],
            ['**Steps to success**', 'Path efficiency', 'A bimodal distribution means two populations — worked, and spun'],
            ['**Cost per completed task**', 'Real economics', 'The only cost number worth quoting'],
            ['**Tool error rate**', 'Which tool is poisoning runs', 'One bad tool degrades every run that touches it'],
            ['**Escalation precision**', 'Does it escalate the right things?', 'Both directions: escalating too much is also a failure'],
            ['**Unsafe action rate**', 'Attempts blocked by a gate', 'Should be near zero; any non-zero value needs reading'],
          ],
        },
        {
          t: 'code',
          lang: 'python',
          caption: 'An agent eval scores the end state, not the transcript',
          code: `
AGENT_CASES = [
    {
        "task": "Has order 4471 shipped?",
        "fixtures": {"orders": [{"id": "4471", "status": "shipped",
                                 "shipped_at": "2026-09-22"}]},
        # Check the WORLD, or the answer content — never the phrasing.
        "check": lambda r, world: "22 september" in r["answer"].lower()
                                  or "2026-09-22" in r["answer"],
        "max_steps": 3,
        "must_not_call": ["issue_refund", "run_readonly_sql"],
    },
    {
        "task": "I want a refund for 4471, it arrived broken.",
        "fixtures": {"orders": [{"id": "4471", "status": "delivered"}]},
        # Correct behaviour is to escalate, NOT to refund.
        "check": lambda r, world: (world.escalations
                                   and not world.refunds_issued),
        "max_steps": 4,
        "must_not_call": ["issue_refund"],
    },
    {
        "task": "What is the capital of France?",
        "fixtures": {},
        # Off-scope: should answer or decline without touching any tool.
        "check": lambda r, world: not world.tool_calls,
        "max_steps": 1,
        "must_not_call": ["get_order", "run_readonly_sql"],
    },
]

def evaluate_agent() -> dict:
    scores = []
    for case in AGENT_CASES:
        world = FakeWorld(case["fixtures"])     # deterministic fixtures
        result = run_agent(case["task"], world.session, Budget(max_steps=10))

        scores.append({
            "task": case["task"],
            "succeeded": bool(case["check"](result, world)),
            "steps": result.get("steps", 0),
            "efficient": result.get("steps", 99) <= case["max_steps"],
            "stayed_in_bounds": not (set(world.tool_calls)
                                     & set(case["must_not_call"])),
            "cost": world.cost_usd,
        })
    return summarise(scores)`,
        },
        {
          t: 'key',
          title: 'Include off-scope and must-not-do cases',
          text: 'Half of agent evaluation is confirming it does **not** do things: does not refund when it should escalate, does not touch the database for a general-knowledge question, does not call the write tool on a read task. An eval made only of tasks the agent should complete will happily pass an agent that does far too much, and that is exactly the agent that causes an incident.',
        },
        {
          t: 'warn',
          title: 'Fixtures, not production data',
          text: 'Agent evals must be deterministic and repeatable, which means a fake world with known state — fixed orders, a fake courier API, an in-memory ledger. Running an eval against production means results that change underneath you and, worse, an eval that can send real emails. Build the fake world early; it is also the fastest way to test the failure branches.',
        },
      ],
    },
    {
      id: 'checklist',
      title: 'The pre-launch checklist',
      blocks: [
        {
          t: 'steps',
          items: [
            { title: 'Scope stated in one sentence', text: 'Including what it escalates rather than handles. If you cannot write it, you cannot evaluate it.' },
            { title: 'Every tool has a when-not-to-use-it line', text: 'And no two tools plausibly answer the same question.' },
            { title: 'An escalation tool exists', text: 'So "no good option" has an outcome other than invention.' },
            { title: 'Reference data is in the cached prefix or retrieved', text: 'Never pasted into working state where it is re-sent every step.' },
            { title: 'Every tool classified on reversible × detectable', text: 'Nothing in the irreversible-and-undetectable quadrant.' },
            { title: 'Approval gates on irreversible actions, with idempotency keys and a ledger', text: 'And few enough gates that humans still read them.' },
            { title: 'Four loop bounds in place', text: 'Steps, tokens, deadline, no-progress — each with a distinct exit status.' },
            { title: 'Outcome verified in code', text: 'Success is observed, never self-reported.' },
            { title: 'Dry-run mode available', text: 'And a hundred real tasks run through it, read by a human.' },
            { title: 'Per-step tracing with a run id', text: 'Replayable for failed runs.' },
            { title: 'An eval with off-scope and must-not-do cases', text: 'Against deterministic fixtures, not production.' },
            { title: 'Cost per completed task measured', text: 'Before anyone asks, and before it is in front of customers.' },
          ],
        },
        {
          t: 'note',
          title: 'If the checklist feels heavy, the agent may be the wrong shape',
          text: 'All of this machinery exists because the model chooses the steps. If your task actually has a known sequence, a **workflow** gives you most of the value with almost none of this overhead — you keep the model for the judgement inside each step and keep control of the order. That is the next tier, and it is the right answer more often than people expect.',
        },
      ],
    },
  ],

  patterns: [
    {
      id: 'narrow-scope-first',
      name: 'Narrow the Scope Until the Tools Are Obvious',
      oneLiner: 'If you cannot list the tools in a minute, the scope is too wide.',
      useWhen: ['Before writing any agent code.'],
      recognize: ['"An agent that handles support."', 'No way to state what a successful run is.'],
      steps: [
        'Write the scope as one sentence including what it escalates.',
        'List the tools. If the list is open-ended, narrow further.',
        'Write down what success and failure look like for one run.',
        'Widen later from escalation logs, not from ambition.',
      ],
      complexity: 'An hour of writing. Determines whether the project works.',
      gotchas: [
        'Wide scope degrades tool selection accuracy, which reads as model weakness.',
        'Without a success definition there is no eval, and without an eval there is no progress.',
      ],
      problems: ['Narrow a wide scope three times', 'Write the success criterion'],
    },
    {
      id: 'specific-plus-escape-hatch',
      name: 'Specific Tools Plus One Bounded Escape Hatch',
      oneLiner: 'Cover the expected path precisely; leave one guarded general route for the rest.',
      useWhen: ['Any agent over a queryable data source.'],
      recognize: ['"I cannot do that" for anything slightly unusual.', 'A new tool added every week for a new question shape.'],
      steps: [
        'Build four to eight specific, well-described tools for the common path.',
        'Add one read-only general tool — SQL or code — with limits enforced in code.',
        'Inject tenant scoping, row limits and timeouts server-side, never as parameters.',
        'Log every escape-hatch use; frequent patterns become the next specific tool.',
      ],
      template: {
        lang: 'python',
        caption: 'The model writes the query; your code decides what it can reach',
        code: `
scoped = f"SELECT * FROM ({model_query}) AS q WHERE q.tenant_id = %s LIMIT 100"
with readonly_pool.connection(statement_timeout_ms=5000) as conn:
    rows = conn.execute(scoped, [session.tenant_id]).fetchall()`,
      },
      complexity: 'One tool, plus a read-only role and a wrapper.',
      gotchas: [
        'A writable escape hatch has your whole database as its blast radius.',
        'Without an audit log you cannot tell what the hatch is being used for.',
      ],
      problems: ['Add a bounded SQL tool', 'Mine its logs for the next specific tool'],
    },
    {
      id: 'reversible-detectable-matrix',
      name: 'Classify Every Tool on Reversible × Detectable',
      oneLiner: 'The quadrant tells you what machinery the tool needs.',
      useWhen: ['Before granting any write capability.'],
      recognize: ['All tools treated identically.', 'An irreversible action with no audit trail.'],
      steps: [
        'Place each tool in the matrix honestly.',
        'Reversible and detectable → autonomous with an audit log.',
        'Irreversible → approval, idempotency key, rate limit, audit.',
        'Irreversible and undetectable → add detection first; do not automate it as-is.',
      ],
      complexity: 'An hour with the team. Prevents the incident nobody notices for a month.',
      gotchas: [
        'People over-estimate detectability — ask "who would actually notice, and when?"',
        'Reversible in principle is not reversible in practice if nobody spots it.',
      ],
      problems: ['Classify a real tool set', 'Find one bottom-right tool and fix it'],
    },
    {
      id: 'dry-run-mode',
      name: 'Build Dry-Run Mode Before Write Access',
      oneLiner: 'Log what it would have done, over a hundred real tasks.',
      useWhen: ['Before any write tool goes live.'],
      recognize: ['Write access granted straight from a demo.', 'No record of what the agent intends to change.'],
      steps: [
        'Add a flag that makes write tools log and return a realistic success shape.',
        'Run a hundred real tasks through it.',
        'Read every intended action — by hand, all of them.',
        'Enable writes one tool at a time, behind approval.',
      ],
      complexity: 'An afternoon. Finds bugs no eval catches.',
      gotchas: [
        'The fake success must look real, or the agent behaves differently than it would live.',
        'Reading a hundred logs is tedious and is the entire point.',
      ],
      problems: ['Add dry-run and read 100 intended actions', 'Count the ones you would not have allowed'],
    },
    {
      id: 'must-not-do-eval',
      name: 'Evaluate What It Must Not Do',
      oneLiner: 'Half of agent evaluation is confirming restraint.',
      useWhen: ['Every agent eval.'],
      recognize: ['Only happy-path cases.', 'An agent that refunds when it should escalate.'],
      steps: [
        'Add cases where the correct action is escalation.',
        'Add off-scope cases where no tool should be called at all.',
        'Assert on `must_not_call` as well as on the outcome.',
        'Score escalation precision in both directions.',
      ],
      complexity: 'Half the eval set. Catches the failures that cause incidents.',
      gotchas: [
        'An over-cautious agent that escalates everything also fails — measure both directions.',
        'Deterministic fixtures are required, or the cases are not repeatable.',
      ],
      problems: ['Add ten must-not-do cases', 'Find one your agent fails'],
    },
  ],

  pitfalls: [
    { title: 'Scope stated as a job title', text: '"Support agent" cannot be evaluated. Narrow until the tools are obvious.' },
    { title: 'Twenty tools with overlapping descriptions', text: 'Selection accuracy falls and you blame the model.' },
    { title: 'No escalation tool', text: 'With no good option, the agent invents one.' },
    { title: 'A writable general-purpose tool', text: '"Run SQL" that can write has your whole database as its blast radius.' },
    { title: 'Tenant scoping as a tool parameter', text: 'One injection away from a cross-tenant read.' },
    { title: 'Reference data pasted into working state', text: 'Re-sent on every step for the rest of the run.' },
    { title: 'An ever-growing conversation across runs', text: 'Dead ends and corrections keep conditioning the model.' },
    { title: 'Uncurated durable memory', text: 'Two thousand remembered facts is noise, not memory.' },
    { title: 'Approval on everything', text: 'Humans stop reading, and oversight becomes decorative.' },
    { title: 'An irreversible action nobody audits', text: 'The incident you find out about a month later.' },
    { title: 'No idempotency ledger', text: 'A re-requested action after a timeout does it twice.' },
    { title: 'Self-reported success', text: 'Verify the observable effect in code.' },
    { title: 'Evals against production data', text: 'Non-repeatable, and capable of real side effects.' },
    { title: 'No off-scope cases in the eval', text: 'Passes an agent that does far too much.' },
    { title: 'Building an agent for a fixed sequence', text: 'A workflow gives you the value without the machinery.' },
  ],

  cheatsheet: [
    { label: 'Design like', value: 'onboarding a contractor for a week' },
    { label: 'Five decisions', value: 'scope, tools, context, autonomy, verification' },
    { label: 'Scope test', value: 'tools listable in a minute' },
    { label: 'Tool surface', value: 'few specific + one bounded general' },
    { label: 'Escape hatch', value: 'read-only, scoped in code, logged' },
    { label: 'Always include', value: '`escalate_to_human`' },
    { label: 'Overlapping tools', value: 'merge, or write the distinguishing line' },
    { label: 'Four knowledge kinds', value: 'instructions, reference, working, durable' },
    { label: 'Reference data', value: 'cached prefix or retrieval, never working state' },
    { label: 'Per run', value: 'fresh start + small curated memory' },
    { label: 'Classify tools', value: 'reversible × detectable' },
    { label: 'Never automate', value: 'irreversible AND undetectable' },
    { label: 'Approve', value: 'few things, so they get read' },
    { label: 'Before writes', value: 'dry-run over 100 real tasks' },
    { label: 'Eval scores', value: 'outcome, steps, cost, restraint' },
    { label: 'Half the eval', value: 'must-not-do and off-scope cases' },
    { label: 'Fixed sequence?', value: 'use a workflow instead' },
  ],

  problems: [
    { name: 'Narrow a wide scope three times', difficulty: 'Easy', pattern: 'Scope', insight: 'Start at "support agent" and narrow until you can list the tools and state the success criterion. Notice how much easier everything downstream becomes.' },
    { name: 'Write when-not-to-use lines for every tool', difficulty: 'Easy', pattern: 'Tool surface', insight: 'For each pair, write the sentence distinguishing them. Any pair where you cannot should be merged — and you will find at least one.' },
    { name: 'Add an escalation tool and measure its use', difficulty: 'Easy', pattern: 'Escape route', insight: 'Count escalations over fifty real tasks and read the summaries. That log is your prioritised list of tools to build next.' },
    { name: 'Build a bounded read-only SQL tool', difficulty: 'Medium', pattern: 'Escape hatch', insight: 'Read-only role, injected tenant predicate, row limit, timeout, audit log. Then try to get the model to write past the boundary and confirm it cannot.' },
    { name: 'Classify a real tool set on the matrix', difficulty: 'Medium', pattern: 'Autonomy', insight: 'Be honest about detectability — "who would notice, and when?" Anything landing bottom-right needs detection added before automation.' },
    { name: 'Move reference data out of working state', difficulty: 'Medium', pattern: 'Context strategy', insight: 'Find a policy document being pasted mid-run. Move it to the cached prefix and measure the per-step token cost before and after.' },
    { name: 'Build dry-run mode and read the output', difficulty: 'Medium', pattern: 'Dry run', insight: 'A hundred real tasks, every intended write logged, read by hand. Count how many you would not have authorised. That number decides your approval design.' },
    { name: 'Build the fake world for evals', difficulty: 'Hard', pattern: 'Deterministic fixtures', insight: 'Fixed orders, a fake courier, an in-memory ledger that records refunds and escalations. Now every failure branch is testable and nothing can email a customer.' },
    { name: 'Add ten must-not-do cases', difficulty: 'Hard', pattern: 'Restraint', insight: 'Refund requests that must escalate, general-knowledge questions that must touch no tool, write requests on read-only sessions. Expect to fail at least one.' },
    { name: 'Write the full pre-launch checklist for a real agent', difficulty: 'Hard', pattern: 'Readiness', insight: 'Go through all twelve items and answer each honestly. The gaps are your work plan, and the exercise usually reveals that a workflow would do.' },
  ],
}
