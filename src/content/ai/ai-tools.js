export default {
  id: 'ai-tools',
  title: 'Tool Use: Letting the Model Act',
  short: 'Tool Use',
  icon: 'HandymanRounded',
  tier: 'Advanced',
  order: 12,
  estHours: 5,
  prereqs: ['ai-rag-advanced'],
  tagline: 'The model never calls anything. It asks, in JSON, and your code decides.',
  mentalModel:
    'Tool use is **a structured request, not an execution**. The model emits a `tool_use` block saying "run `get_order` with `{"id": "4471"}`". Your code — which owns the credentials, the network and the authorisation check — decides whether to comply, does the work, and hands back a `tool_result`. The model is a planner with no hands. That separation is the entire security model.',
  whyItMatters:
    'Tool use is the hinge between a chatbot and software that does things. It is also where an LLM feature stops being read-only and starts being able to charge a card, delete a record or email a customer — so understanding exactly who decides what, at which step, is not optional.',

  reference: {
    title: 'The vocabulary, precisely',
    head: ['Term', 'What it is'],
    rows: [
      ['**Tool definition**', '`name`, `description`, `input_schema` — a JSON Schema. Sent in `tools`'],
      ['**`tool_use` block**', 'In the assistant response: `id`, `name`, `input`. A **request**, not an action'],
      ['**`tool_result` block**', 'Your reply, in a **`user`** turn: `tool_use_id`, `content`, optional `is_error`'],
      ['**`stop_reason: "tool_use"`**', 'The model is waiting for results and will not continue without them'],
      ['**`strict: true`**', 'On the tool definition: arguments are guaranteed to validate against the schema'],
      ['**Server tool**', 'Anthropic runs it (web search, web fetch, code execution) — no loop on your side'],
      ['**Anthropic-defined tool**', '`bash`, text editor, memory — a fixed `type`, no `input_schema` of yours'],
      ['**`tool_choice`**', '`auto` (default), `none`. Forced modes are rejected on the newest models'],
    ],
  },

  sections: [
    {
      id: 'protocol',
      title: 'The protocol, one round trip at a time',
      blocks: [
        {
          t: 'ascii',
          caption: 'Four messages for one tool call. Notice who does what — and that nothing happens without you.',
          code: `
  YOUR CODE                              THE MODEL
      │                                       │
      │  1. messages=[user: "where is          │
      │      order 4471?"]                     │
      │      tools=[get_order]                 │
      │─────────────────────────────────────▶ │
      │                                       │ decides it needs the tool
      │  2. stop_reason: "tool_use"            │
      │     content: [                         │
      │       text     "Let me look that up",  │
      │       tool_use {id: "toolu_01A",       │
      │                 name: "get_order",     │
      │                 input: {"id":"4471"}}] │
      │◀───────────────────────────────────── │
      │                                       │
   ┌──┴─────────────────────────────┐         │   NOTHING HAS HAPPENED YET.
   │ 3. YOUR CODE, YOUR DECISION:   │         │   No database was touched.
   │    • is this caller allowed?    │         │   The model cannot reach
   │    • validate the arguments     │         │   anything. It asked.
   │    • run it, or refuse          │         │
   └──┬─────────────────────────────┘         │
      │                                       │
      │  4. messages += [                      │
      │       assistant: <the WHOLE content>,  │  ← must include the
      │       user: [tool_result               │     tool_use block
      │              {tool_use_id: "toolu_01A",│
      │               content: "{...}"}]]      │  ← tool_result goes in a
      │─────────────────────────────────────▶ │     USER turn
      │                                       │
      │  5. stop_reason: "end_turn"            │
      │     "Order 4471 shipped on Tuesday..." │
      │◀───────────────────────────────────── │

  Three rules that cause most bugs:
    • the tool_result is a USER turn, because it is input to the model
    • tool_use_id must match exactly — it is how results are paired
    • the assistant turn you append must contain the tool_use block,
      so append response.content, never the extracted text`,
        },
        {
          t: 'code',
          lang: 'python',
          caption: 'One complete round trip, written out with nothing hidden',
          code: `
tools = [{
    "name": "get_order",
    "description": (
        "Look up an order by its id. Returns status, ship date and items. "
        "Use this whenever the user asks about a specific order. Returns "
        "an error if the order does not exist."
    ),
    "strict": True,
    "input_schema": {
        "type": "object",
        "properties": {
            "order_id": {"type": "string",
                         "description": "The order id, e.g. '4471'"},
        },
        "required": ["order_id"],
        "additionalProperties": False,
    },
}]

messages = [{"role": "user", "content": "Where is order 4471?"}]

response = client.messages.create(model="claude-opus-5", max_tokens=4000,
                                  tools=tools, messages=messages)

if response.stop_reason == "tool_use":
    # Append the WHOLE content list — the tool_use block must survive.
    messages.append({"role": "assistant", "content": response.content})

    results = []
    for block in response.content:
        if block.type != "tool_use":
            continue
        try:
            output = dispatch(block.name, block.input)      # your code
            results.append({"type": "tool_result",
                            "tool_use_id": block.id,
                            "content": json.dumps(output)})
        except Exception as e:
            # Report the failure as a result. Never drop it: the model is
            # blocked until every tool_use id has a matching result.
            results.append({"type": "tool_result",
                            "tool_use_id": block.id,
                            "content": f"Error: {e}",
                            "is_error": True})

    # ALL results in ONE user message — see the parallel section below.
    messages.append({"role": "user", "content": results})

    response = client.messages.create(model="claude-opus-5", max_tokens=4000,
                                      tools=tools, messages=messages)`,
        },
        {
          t: 'key',
          title: 'The model cannot do anything. It can only ask.',
          text: 'This is worth stating twice because it changes how you think about safety. There is no sandbox to escape and no permission to revoke — the model emits JSON, and every actual effect happens in code you wrote. So "can the model delete the database?" is really "does my dispatch function delete the database when asked?" Every guardrail lives on your side of that line.',
        },
      ],
    },
    {
      id: 'writing-tools',
      title: 'Writing a tool the model uses correctly',
      blocks: [
        {
          t: 'lead',
          text: 'A tool definition is a prompt with a schema attached. The description is not documentation for you — it is the only thing telling the model when this tool applies, and it is where nearly all tool-use quality comes from.',
        },
        {
          t: 'compare',
          left: {
            title: 'A description that works',
            items: [
              'Says what it does *and when to use it*',
              'States what it returns, including on failure',
              'Names the boundary: "do not use this for X"',
              'Gives an example argument value',
              'Explains any non-obvious parameter',
              'Distinguishes itself from similar tools explicitly',
            ],
          },
          right: {
            title: 'A description that causes bugs',
            items: [
              '"Gets an order." — when? which orders?',
              'Nothing about the error case',
              'No boundary, so it gets called for everything',
              'Parameter named `q` with no description',
              'Two tools whose descriptions overlap',
              'Assumes the model knows your domain vocabulary',
            ],
          },
        },
        {
          t: 'code',
          lang: 'python',
          caption: 'The description is where the effort belongs — usually longer than the schema',
          code: `
{
  "name": "search_orders",
  "description": (
      "Search orders by customer email, date range or status. Use this "
      "when the user does NOT have a specific order id — if they give an "
      "id, use get_order instead, which is faster and exact.\\n\\n"
      "Returns up to 20 matching orders, newest first, each with id, "
      "status, total and date. Returns an empty list (not an error) when "
      "nothing matches.\\n\\n"
      "Dates must be ISO 8601 (2026-09-01). If the user says 'last "
      "month', convert it before calling — this tool does not parse "
      "relative dates."
  ),
  "strict": True,
  "input_schema": {
    "type": "object",
    "properties": {
      "email":  {"type": ["string", "null"],
                 "description": "Exact customer email, or null"},
      "status": {"type": ["string", "null"],
                 "enum": ["pending", "shipped", "delivered",
                          "cancelled", None],
                 "description": "Filter by status, or null for any"},
      "from_date": {"type": ["string", "null"],
                    "description": "ISO 8601 date, inclusive, or null"},
      "to_date":   {"type": ["string", "null"],
                    "description": "ISO 8601 date, inclusive, or null"},
    },
    "required": ["email", "status", "from_date", "to_date"],
    "additionalProperties": False,
  },
}`,
        },
        {
          t: 'table',
          caption: 'Design rules, and the failure each one prevents.',
          head: ['Rule', 'Failure it prevents'],
          rows: [
            ['Few tools, each doing one thing well', 'Twenty overlapping tools and the model picks wrongly'],
            ['Say when *not* to use it', 'A tool called for every question'],
            ['Every parameter described', 'Plausible-looking garbage arguments'],
            ['Return errors as results, not exceptions', 'The model cannot recover or explain'],
            ['Return compact, structured output', 'A 50k-token dump destroys the context budget'],
            ['Make it idempotent where you can', 'A retry after a timeout charges the card twice'],
            ['Never trust the arguments', 'SQL injection, path traversal, cross-tenant reads'],
            ['State units and formats explicitly', 'Cents versus pounds, local time versus UTC'],
          ],
        },
        {
          t: 'warn',
          title: 'Tool output is a context budget line item',
          text: 'A tool returning a full API response can inject tens of thousands of tokens into every subsequent request for the rest of the conversation. Return only the fields the model needs, truncate lists with an explicit "showing 20 of 4,312" note, and summarise large payloads before returning them. An agent that slows to a crawl after six steps is almost always drowning in its own tool output.',
        },
        {
          t: 'code',
          lang: 'python',
          caption: 'Shape the result for the model, not for a machine',
          code: `
# ✘ Dumps the whole row set: 40k tokens, 90% irrelevant, and it stays in
#   the context for every remaining turn.
return db.query("SELECT * FROM orders WHERE ...").to_dict()

# ✔ Compact, truthful about truncation, and cheap to carry forward.
rows = db.query(...)
return {
    "count": len(rows),
    "showing": min(len(rows), 20),
    "orders": [{"id": r.id, "status": r.status,
                "total_gbp": r.total_pence / 100,
                "date": r.created_at.date().isoformat()} for r in rows[:20]],
    "note": (f"{len(rows) - 20} more matches not shown; narrow the filters"
             if len(rows) > 20 else None),
}`,
        },
      ],
    },
    {
      id: 'parallel',
      title: 'Parallel tool calls, and the mistake that disables them',
      blocks: [
        {
          t: 'p',
          text: 'One assistant turn can contain several `tool_use` blocks. Running them concurrently is a large latency win — and there is a specific, silent way to lose the capability permanently.',
        },
        {
          t: 'ascii',
          caption: 'The right shape, and the mistake that trains the model out of parallelism.',
          code: `
  "Compare orders 4471, 4472 and 4473"

  ONE assistant turn, THREE tool_use blocks:
      tool_use toolu_01A  get_order {"order_id": "4471"}
      tool_use toolu_01B  get_order {"order_id": "4472"}
      tool_use toolu_01C  get_order {"order_id": "4473"}

  ✔ CORRECT — execute concurrently, reply with ONE user message
     containing ALL THREE results
     ┌──────────────────────────────────────────────┐
     │ user: [ tool_result toolu_01A,               │
     │         tool_result toolu_01B,               │   latency = slowest
     │         tool_result toolu_01C ]              │   of the three
     └──────────────────────────────────────────────┘

  ✘ WRONG — one user message per result
     ┌────────────────────┐ ┌────────────────────┐ ┌────────────────────┐
     │ user: [result A]   │ │ user: [result B]   │ │ user: [result C]   │
     └────────────────────┘ └────────────────────┘ └────────────────────┘
     This is not just untidy. The conversation now DEMONSTRATES that
     parallel calls get answered one at a time, so the model learns from
     its own history to stop batching them. It silently becomes serial,
     and you will blame the model.

  Also required: a result for EVERY tool_use id, including failures.
  One missing result and the request is rejected — the model cannot
  continue with a dangling call.`,
        },
        {
          t: 'code',
          lang: 'python',
          caption: 'Concurrent execution, single reply message',
          code: `
import asyncio

async def run_tools(blocks) -> list[dict]:
    calls = [b for b in blocks if b.type == "tool_use"]

    async def one(block):
        try:
            output = await dispatch_async(block.name, block.input)
            return {"type": "tool_result", "tool_use_id": block.id,
                    "content": json.dumps(output)}
        except Exception as e:
            return {"type": "tool_result", "tool_use_id": block.id,
                    "content": f"Error: {e}", "is_error": True}

    # gather preserves order, and returns a result for every call.
    return list(await asyncio.gather(*(one(b) for b in calls)))

results = await run_tools(response.content)
messages.append({"role": "user", "content": results})    # ONE message`,
        },
        {
          t: 'tip',
          title: 'Return the error, do not raise it',
          text: 'A `tool_result` with `is_error: true` lets the model react: correct a malformed argument, try a different tool, or tell the user the lookup failed. Raising the exception out of your loop instead throws away a recovery the model would often have handled well — and gives the user a stack trace rather than an explanation.',
        },
      ],
    },
    {
      id: 'server-tools',
      title: 'Server tools: no loop required',
      blocks: [
        {
          t: 'p',
          text: 'Some tools run on Anthropic’s infrastructure. You declare them and read the results out of the same response — there is no execution step on your side, and no loop to write.',
        },
        {
          t: 'table',
          caption: 'Declare in `tools`; results arrive as extra content blocks.',
          head: ['Tool', '`type`', 'Result block'],
          rows: [
            ['Web search', '`web_search_20260209`', '`web_search_tool_result`'],
            ['Web fetch', '`web_fetch_20260209`', '`web_fetch_tool_result`'],
            ['Code execution', '`code_execution_20260521`', '`bash_code_execution_tool_result`'],
            ['Tool search (regex)', '`tool_search_tool_regex_20251119`', '`tool_search_tool_result`'],
            ['Tool search (BM25)', '`tool_search_tool_bm25_20251119`', '`tool_search_tool_result`'],
          ],
        },
        {
          t: 'code',
          lang: 'python',
          caption: 'Web search with domain restrictions — one call, results inline',
          code: `
response = client.messages.create(
    model="claude-opus-5", max_tokens=8000,
    tools=[{
        "type": "web_search_20260209",
        "name": "web_search",
        "max_uses": 5,
        "allowed_domains": ["docs.python.org", "peps.python.org"],
    }],
    messages=[{"role": "user",
               "content": "What changed about the GIL in recent Python?"}],
)

for block in response.content:
    if block.type == "web_search_tool_result":
        # Errors arrive as HTTP 200 with an error OBJECT in content, while
        # success is a LIST. Branch on the shape before indexing.
        if isinstance(block.content, list):
            for result in block.content:
                print(result.title, result.url)
        else:
            print("search failed:", block.content.error_code)
    elif block.type == "text":
        print(block.text)`,
        },
        {
          t: 'code',
          lang: 'python',
          caption: 'Code execution — the right answer to "do arithmetic reliably"',
          code: `
response = client.messages.create(
    model="claude-opus-5", max_tokens=8000,
    tools=[{"type": "code_execution_20260521", "name": "code_execution"}],
    messages=[{"role": "user", "content":
               "Here are 400 order totals in pence. Compute the "
               "median, the p95 and the monthly trend."}],
)

for block in response.content:
    if block.type == "bash_code_execution_tool_result":
        print(block.content.stdout)
        if block.content.return_code != 0:
            print("stderr:", block.content.stderr)`,
        },
        {
          t: 'warn',
          title: 'Three things that surprise people about server tools',
          text: 'Server-tool errors do **not** raise — they return HTTP 200 with an error object inside the result block, so code that assumes success silently mishandles them. Web fetch only fetches URLs already present in the conversation, so it cannot be used to browse freely. And the modern web search variant runs code execution internally for filtering, so you should **not** separately declare `code_execution` alongside it — two execution environments confuse the model.',
        },
        {
          t: 'note',
          title: '`pause_turn` on long server-tool work',
          text: 'A turn that runs several searches can come back with `stop_reason: "pause_turn"`. That is not an error and not a refusal: it means the model paused and can resume. Append the response content and send the conversation back unchanged to continue. Code that only handles `end_turn` and `tool_use` will treat this as a mysterious empty answer.',
        },
      ],
    },
    {
      id: 'anthropic-defined',
      title: 'Anthropic-defined tools and many-tool situations',
      blocks: [
        {
          t: 'p',
          text: 'A few tools have fixed contracts the model was specifically trained on. You declare a `type` and a `name`, and you do **not** supply an `input_schema` — the shape is already agreed.',
        },
        {
          t: 'code',
          lang: 'python',
          caption: 'Schema-less by design — supplying your own schema makes it a different tool',
          code: `
tools = [
    {"type": "bash_20250124", "name": "bash"},
    {"type": "text_editor_20250728", "name": "str_replace_based_edit_tool"},
    {"type": "memory_20250818", "name": "memory"},
]
# No input_schema on any of these — the contract is fixed and trained in.
#
# A custom tool of your own that happens to be called "bash", with your
# own schema, is a DIFFERENT tool as far as the model is concerned, and
# it will be used less reliably. You still implement the handler; the
# model just already knows the calling convention.`,
        },
        {
          t: 'h',
          text: 'When you have too many tools',
        },
        {
          t: 'ascii',
          caption: 'Fifty tool definitions is 30k tokens in every single request. Two ways out.',
          code: `
  THE PROBLEM
      50 tools × ~600 tokens of schema = 30,000 tokens
      • sent on every request (cacheable, but still prefilled)
      • and the model must choose between 50 similar options,
        which measurably degrades selection accuracy

  OPTION 1 — TOOL SEARCH  (the model looks tools up on demand)
      declare the search tool, mark the rest defer_loading: true
      ┌──────────────────────────────────────────────────┐
      │ tools: [ {type: tool_search_tool_bm25_...},       │
      │          {name: "get_order",   defer_loading: T}, │
      │          {name: "refund",      defer_loading: T}, │
      │          ... 48 more, all deferred }              │
      └──────────────────────────────────────────────────┘
      Only the search tool's schema is loaded up front; the model
      searches for what it needs and the schema arrives then.
      RULE: the search tool itself must NOT be deferred, and at least
      one tool must be non-deferred, or you get a 400.

  OPTION 2 — ROUTE FIRST  (your code narrows the set)
      a cheap classifier picks the relevant 5 tools for this request
      BUT: a varying tool set changes the cached prefix, so you lose
      prompt caching on tools. Prefer a small number of STABLE sets
      (one per task type) over a bespoke set per request.`,
        },
        {
          t: 'key',
          title: 'Fewer, better tools beats more tools',
          text: 'Before reaching for tool search, ask whether five tools could replace twenty. `search_orders` with filters is one tool; `get_orders_by_email`, `get_orders_by_date`, `get_pending_orders` and `get_cancelled_orders` are four tools that confuse the choice. Consolidation improves accuracy *and* shrinks the prompt, which is the rare change with no trade-off.',
        },
      ],
    },
    {
      id: 'safety',
      title: 'The authorisation boundary',
      blocks: [
        {
          t: 'lead',
          text: 'The model’s request is untrusted input. It may be influenced by a document it read, a web page it fetched, or a user trying it on. Treat `tool_use` exactly as you would treat an HTTP request from the internet.',
        },
        {
          t: 'code',
          lang: 'python',
          caption: 'The dispatch function is your security boundary — everything is enforced here',
          code: `
READ_ONLY = {"get_order", "search_orders", "get_policy"}
NEEDS_APPROVAL = {"issue_refund", "cancel_order", "send_email"}

def dispatch(name: str, args: dict, session) -> dict:
    if name not in TOOLS_BY_NAME:
        return {"error": f"unknown tool {name}"}       # never dynamic dispatch

    # 1. Authorisation is per SESSION, never per model request. The model
    #    does not get a say in what this user is allowed to do.
    if name not in session.permitted_tools:
        return {"error": "not permitted for this user"}

    # 2. Validate independently of the schema. strict: true guarantees the
    #    SHAPE; it says nothing about whether this id belongs to this
    #    tenant. That check is yours, always.
    args = validate(name, args)

    # 3. Anything irreversible needs a human, or an idempotency key, or both.
    if name in NEEDS_APPROVAL and not session.approved(name, args):
        return {"status": "awaiting_approval",
                "message": "This action needs human approval. Tell the user."}

    # 4. Scope every query to the tenant in CODE, not via an argument the
    #    model supplies. A tenant id in the arguments is a leak waiting to
    #    happen.
    return TOOLS_BY_NAME[name](**args, tenant_id=session.tenant_id)`,
        },
        {
          t: 'table',
          caption: 'The classification that decides how much machinery a tool needs.',
          head: ['Class', 'Examples', 'Required protection'],
          rows: [
            ['**Read, own data**', 'Look up an order, read a policy', 'Tenant scoping in code'],
            ['**Read, sensitive**', 'Customer PII, salary data', 'Tenant scoping, field allow-list, audit log'],
            ['**Write, reversible**', 'Update a note, add a tag', 'Validation, audit log'],
            ['**Write, irreversible**', 'Refund, email, delete, deploy', '**Human approval**, idempotency key, rate limit'],
            ['**Arbitrary execution**', 'Bash, code execution, SQL', 'Sandbox, no network, no credentials, timeout'],
          ],
        },
        {
          t: 'trap',
          title: 'Never let the model supply the tenant id',
          text: 'If `get_order(order_id, tenant_id)` takes the tenant from the model’s arguments, then a prompt injection in a customer email can read another customer’s orders — and the tool call will look entirely legitimate in your logs. The tenant comes from the authenticated session, in code, appended after the model’s arguments. The same applies to user ids, roles and any other authorisation input.',
        },
        {
          t: 'warn',
          title: 'Retries and irreversible tools',
          text: 'The model may re-request a tool it thinks failed — after a timeout, after an ambiguous error, or after context editing removed the result it was waiting for. If that tool charges a card, you have just charged twice. Derive an idempotency key from the business fact (`refund-order-4471`) rather than from the attempt, and keep a ledger of what has already been executed in this session.',
        },
      ],
    },
  ],

  patterns: [
    {
      id: 'description-is-the-prompt',
      name: 'The Description Is the Prompt',
      oneLiner: 'When to use it, when not to, what it returns, what it errors with.',
      useWhen: ['Every tool you define.'],
      recognize: ['"Gets an order."', 'A tool called for questions it does not fit.', 'Two tools with overlapping descriptions.'],
      steps: [
        'State the purpose and the trigger condition.',
        'State what it returns, including the empty and error cases.',
        'State explicitly when to use a different tool instead.',
        'Describe every parameter, with units and formats and an example.',
      ],
      complexity: 'Twenty minutes per tool. The highest-leverage work in tool use.',
      gotchas: [
        'Overlapping descriptions cause wrong selection far more often than a weak model does.',
        'Undescribed parameters get plausible garbage.',
      ],
      problems: ['Rewrite three thin descriptions', 'Measure selection accuracy before and after'],
    },
    {
      id: 'parallel-results-one-message',
      name: 'All Results in One User Message',
      oneLiner: 'Splitting them teaches the model to stop calling tools in parallel.',
      useWhen: ['Any turn with more than one `tool_use` block.'],
      recognize: ['One user message per tool result.', 'An agent that used to batch calls and now does not.'],
      steps: [
        'Collect every `tool_use` block from the turn.',
        'Execute them concurrently.',
        'Return every result — including errors, with `is_error: true` — in a single user message.',
        'Never omit a result; a dangling `tool_use` id is rejected.',
      ],
      complexity: 'Latency becomes the slowest call rather than the sum.',
      gotchas: [
        'The regression is behavioural and silent — nothing errors, it just goes serial.',
        'Preserve the pairing by `tool_use_id`, not by position.',
      ],
      problems: ['Force three parallel calls', 'Split the results and watch batching stop'],
    },
    {
      id: 'errors-as-results',
      name: 'Return Errors as Results',
      oneLiner: 'Let the model recover instead of crashing your loop.',
      useWhen: ['Every tool handler.'],
      recognize: ['Exceptions escaping the dispatch function.', 'Users shown stack traces.'],
      steps: [
        'Catch everything in the handler.',
        'Return `tool_result` with `is_error: true` and a message the model can act on.',
        'Include what to do differently: "order id must be numeric — you passed \'last one\'".',
        'Log the real exception separately for yourself.',
      ],
      complexity: 'A try/except per call.',
      gotchas: [
        'A vague "error" gives the model nothing to correct.',
        'Do not leak internal details — a stack trace goes into the conversation context.',
      ],
      problems: ['Make a tool fail and watch the recovery', 'Compare vague and specific error text'],
    },
    {
      id: 'dispatch-is-the-boundary',
      name: 'One Dispatch Function Owns Authorisation',
      oneLiner: 'Permissions, tenant scoping and approval gates live in code, not in arguments.',
      useWhen: ['Any tool touching real data or performing an action.'],
      recognize: ['A `tenant_id` parameter in a tool schema.', 'Dynamic dispatch by name into a module.', 'No approval gate on a refund tool.'],
      steps: [
        'Look the tool up in an explicit allow-list — never dispatch dynamically.',
        'Check session permissions before running anything.',
        'Validate arguments independently of the schema.',
        'Append tenant and user context from the session, in code.',
        'Gate irreversible actions behind approval and an idempotency key.',
      ],
      template: {
        lang: 'python',
        caption: 'The tenant never appears in the schema, so the model cannot influence it',
        code: `
# Schema the model sees — no tenant, no user, no role.
{"name": "get_order",
 "input_schema": {"type": "object",
                  "properties": {"order_id": {"type": "string"}},
                  "required": ["order_id"],
                  "additionalProperties": False}}

# What actually runs.
def get_order(order_id: str, *, tenant_id: str) -> dict:
    return db.one("SELECT ... WHERE id = %s AND tenant_id = %s",
                  order_id, tenant_id)      # scoping is not negotiable`,
      },
      complexity: 'One function. The whole security model lives in it.',
      gotchas: [
        '`strict: true` guarantees the shape, never the authorisation.',
        'A tenant id in the arguments is a cross-tenant leak waiting for an injection.',
      ],
      problems: ['Leak across tenants via arguments, then fix it', 'Add an approval gate'],
    },
    {
      id: 'compact-tool-output',
      name: 'Shape Tool Output for the Context Budget',
      oneLiner: 'Return the fields the model needs, and say what you truncated.',
      useWhen: ['Any tool returning a list, a document or an API payload.'],
      recognize: ['An agent that slows down after a few steps.', 'A tool result of 40,000 tokens.'],
      steps: [
        'Project to the fields the model actually uses.',
        'Truncate lists and state the true count.',
        'Summarise large text before returning it.',
        'Enable context editing so spent results are cleared from history.',
      ],
      complexity: 'Often a 10–50× reduction in tool-result tokens.',
      gotchas: [
        'Silent truncation makes the model draw conclusions from a partial list.',
        'Tool output persists in the conversation and is re-sent every turn.',
      ],
      problems: ['Measure tool-result tokens per step', 'Shrink the three worst offenders'],
    },
  ],

  pitfalls: [
    { title: 'Thinking the model executes tools', text: 'It emits JSON. Every effect is code you wrote.' },
    { title: 'Putting `tool_result` in an assistant turn', text: 'Results are input, so they go in a `user` turn.' },
    { title: 'Appending extracted text as the assistant turn', text: 'Drops the `tool_use` block and the pairing breaks.' },
    { title: 'A mismatched or missing `tool_use_id`', text: 'The request is rejected; a dangling call blocks the model.' },
    { title: 'One user message per parallel result', text: 'Silently trains the model out of parallel calls.' },
    { title: 'Raising instead of returning an error', text: 'Throws away a recovery the model would have handled.' },
    { title: 'Dumping full API payloads', text: 'Tens of thousands of tokens carried forward every turn.' },
    { title: 'A `tenant_id` parameter in the schema', text: 'A cross-tenant leak one injection away.' },
    { title: 'Dynamic dispatch by tool name', text: 'Use an explicit allow-list.' },
    { title: 'No approval gate on irreversible actions', text: 'Refunds and emails need a human or a very good reason.' },
    { title: 'No idempotency key on a retryable side effect', text: 'A re-requested tool charges the card twice.' },
    { title: 'Twenty overlapping tools', text: 'Selection accuracy falls. Consolidate into fewer, richer tools.' },
    { title: 'Giving an Anthropic-defined tool your own schema', text: 'It becomes a different, less reliable tool.' },
    { title: 'Not handling `pause_turn`', text: 'Looks like a mysteriously empty response.' },
    { title: 'Assuming server tools raise on failure', text: 'They return 200 with an error object in the result block.' },
  ],

  cheatsheet: [
    { label: 'Model does', value: 'ask, in JSON' },
    { label: 'Your code does', value: 'authorise and execute' },
    { label: 'Tool def', value: '`name`, `description`, `input_schema`' },
    { label: 'Effort goes in', value: 'the description' },
    { label: '`tool_result`', value: 'in a `user` turn' },
    { label: 'Pairing', value: 'by `tool_use_id`, exactly' },
    { label: 'Parallel results', value: 'ALL in ONE user message' },
    { label: 'Every call', value: 'needs a result, errors included' },
    { label: 'Errors', value: '`is_error: true`, actionable text' },
    { label: 'Guarantee args', value: '`strict: true` + `additionalProperties: false`' },
    { label: 'Forced `tool_choice`', value: 'rejected on the newest models' },
    { label: 'Server tools', value: 'web search, web fetch, code execution' },
    { label: 'Server errors', value: '200 with an error object, not an exception' },
    { label: 'Schema-less tools', value: 'bash, text editor, memory' },
    { label: 'Too many tools', value: 'consolidate, then tool search' },
    { label: 'Tenant id', value: 'from the session, in code, never a parameter' },
    { label: 'Irreversible', value: 'approval + idempotency key' },
    { label: 'Output', value: 'compact, truncation stated' },
  ],

  problems: [
    { name: 'Do one round trip by hand', difficulty: 'Easy', pattern: 'Protocol', insight: 'Print every message at every step. Seeing the `tool_use` block and the matching `tool_result` in a `user` turn makes the protocol permanent knowledge.' },
    { name: 'Break the loop by flattening history', difficulty: 'Easy', pattern: 'Content blocks', insight: 'Append only the text as the assistant turn and then try to send a result. The error tells you exactly why blocks matter.' },
    { name: 'Write a bad description and watch it misfire', difficulty: 'Easy', pattern: 'Descriptions', insight: 'Define `search` as "searches things". Count wrong invocations over twenty questions, then rewrite it properly and recount.' },
    { name: 'Force three parallel calls', difficulty: 'Medium', pattern: 'Parallelism', insight: 'Ask about three orders at once. Measure latency for concurrent versus sequential execution, then split the results into separate messages and watch batching disappear.' },
    { name: 'Return errors two ways', difficulty: 'Medium', pattern: 'Error handling', insight: 'Compare a bare "Error" with "`order_id` must be numeric; you passed \'the last one\' — call `search_orders` instead." The second recovers on the next turn; the first loops.' },
    { name: 'Blow the context budget with tool output', difficulty: 'Medium', pattern: 'Output shaping', insight: 'Return a full API payload and log context size per step. Then project the fields and re-measure. A 20× reduction is common.' },
    { name: 'Leak across tenants through the schema', difficulty: 'Medium', pattern: 'Authorisation', insight: 'Put `tenant_id` in the tool schema and get the model to pass someone else’s. Then move it to the session and confirm it is now impossible.' },
    { name: 'Add code execution for arithmetic', difficulty: 'Medium', pattern: 'Server tools', insight: 'Ask for a median over 400 numbers with and without code execution. The unaided answer is confidently wrong; the executed one is right.' },
    { name: 'Double-charge with a retry', difficulty: 'Hard', pattern: 'Idempotency', insight: 'Make a refund tool time out after succeeding. The model re-requests it and the customer is refunded twice. Fix it with a business-derived key and a session ledger.' },
    { name: 'Consolidate twenty tools into six', difficulty: 'Hard', pattern: 'Tool surface', insight: 'Replace per-filter tools with one parameterised tool each. Measure selection accuracy and prompt size before and after — both improve, which is rare.' },
  ],
}
