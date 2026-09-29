export default {
  id: 'ai-structured-output',
  title: 'Structured Output: Making the Shape Guaranteed',
  short: 'Structured Output',
  icon: 'DataObjectRounded',
  tier: 'Core',
  order: 6,
  estHours: 4,
  prereqs: ['ai-prompting'],
  tagline: 'Stop parsing hope. Constrain the output and the parse cannot fail.',
  mentalModel:
    'There are two completely different ways to get JSON out of a model. You can **ask nicely and parse** — the prompt says "reply in JSON", and you write defensive code for the day it wraps the JSON in a code fence and a sentence of apology. Or you can **constrain the decoder** — the API masks every token that would break your schema, so invalid output is not merely discouraged, it is unreachable. Always pick the second.',
  whyItMatters:
    'Shape failures are the most common production breakage in LLM features, and the only class of failure that can be eliminated outright rather than merely reduced. Once output is guaranteed to validate, the model becomes a normal component in a typed pipeline instead of an unreliable text source you defend against.',

  reference: {
    title: 'Four ways to get structured data, worst to best',
    head: ['Approach', 'Guarantee', 'Use when'],
    rows: [
      ['Prompt says "reply in JSON"', '**None** — fences, preambles, trailing prose', 'Never in production'],
      ['Prompt + retry loop on parse failure', 'Eventually, at extra cost and latency', 'A model or provider with no schema support'],
      ['`output_config.format` with a JSON schema', '**Structurally valid, always**', 'The answer *is* the data'],
      ['A tool with `strict: true`', '**Arguments validate exactly**', 'The model should choose whether and when to call'],
    ],
  },

  sections: [
    {
      id: 'why-prompting-fails',
      title: 'Why "reply in JSON" is not enough',
      blocks: [
        {
          t: 'p',
          text: 'Asking for JSON works most of the time, and "most of the time" is the problem. At a thousand requests a day, a 2% failure rate is twenty broken requests — and they fail in a dozen different ways, so no amount of cleanup code is ever complete.',
        },
        {
          t: 'ascii',
          caption: 'Every one of these is a real thing a model does when you only ask politely.',
          code: `
  YOU ASKED FOR:   {"category": "bug", "urgency": "high"}

  WHAT ARRIVES, over a few thousand calls:

   1  Here is the JSON you requested:
      {"category": "bug", "urgency": "high"}          ← preamble

   2  \`\`\`json
      {"category": "bug", "urgency": "high"}
      \`\`\`                                            ← fenced

   3  {"category": "bug", "urgency": "high",}         ← trailing comma

   4  {'category': 'bug', 'urgency': 'high'}          ← single quotes

   5  {"category": "bug", "urgency": "very high"}     ← invented enum value

   6  {"cat": "bug", "urg": "high"}                   ← abbreviated keys

   7  {"category": "bug"}                             ← required field missing

   8  {"category": "bug", "urgency": "high",
       "note": "I also noticed the user seems frustrated"}   ← extra field

   9  {"category": "bug", "urgency": "high"}
      Let me know if you need anything else!          ← trailing prose

  Each one needs different cleanup. Together they are unfixable by regex.
  With a schema-constrained decoder, ALL NINE become impossible.`,
        },
        {
          t: 'key',
          title: 'Constrained decoding, in one sentence',
          text: 'At every decode step the server computes which tokens could still lead to a valid document under your schema and sets the probability of all the others to zero. A closing brace that would break the structure is not merely unlikely — it cannot be sampled. That is why the guarantee is absolute rather than statistical.',
        },
      ],
    },
    {
      id: 'output-format',
      title: 'Schema-constrained output',
      blocks: [
        {
          t: 'code',
          lang: 'python',
          caption: 'The modern shape: a schema on `output_config.format`',
          code: `
TICKET_SCHEMA = {
    "type": "object",
    "properties": {
        # Evidence first — generation order is causal order.
        "quoted_evidence": {"type": "string",
                            "description": "The sentence that decided the urgency"},
        "category": {"enum": ["bug", "billing", "how-to", "feature", "other"]},
        "urgency":  {"enum": ["low", "medium", "high"]},
        "blocked_users": {"type": "integer", "minimum": 0},
        "needs_human": {"type": "boolean"},
    },
    "required": ["quoted_evidence", "category", "urgency",
                 "blocked_users", "needs_human"],
    "additionalProperties": False,          # required for a strict guarantee
}

response = client.messages.create(
    model="claude-opus-5",
    max_tokens=2000,
    system=SYSTEM,
    messages=[{"role": "user", "content": ticket}],
    output_config={"format": {"type": "json_schema", "schema": TICKET_SCHEMA}},
)

import json
data = json.loads(next(b.text for b in response.content if b.type == "text"))
# data is guaranteed to have every required key, with values in the enums.`,
        },
        {
          t: 'tip',
          title: 'Prefer the parse helper when your SDK offers one',
          text: '`client.messages.parse()` validates the response against your schema and hands back a typed object, so you are not writing `json.loads` plus validation at every call site. It is the same constrained decoding underneath, with the boilerplate removed.',
        },
        {
          t: 'h',
          text: 'Descriptions in the schema are prompt real estate',
        },
        {
          t: 'code',
          lang: 'python',
          caption: 'The field description is where the definition belongs — not buried in the system prompt',
          code: `
{
  "urgency": {
    "enum": ["low", "medium", "high"],
    "description": (
      "high = a paying customer is blocked from working right now. "
      "medium = degraded but they have a workaround. "
      "low = question, cosmetic issue, or feature request. "
      "When torn between two levels, choose the lower one."
    )
  },
  "blocked_users": {
    "type": "integer", "minimum": 0,
    "description": "Number of users the ticket says are affected. "
                   "Use 0 when the ticket does not say. Never estimate."
  }
}`,
        },
        {
          t: 'note',
          title: 'Why definitions belong in the schema, not the prompt',
          text: 'The description sits immediately next to the field the model is about to generate, which is exactly where it is most likely to be used. It also keeps the rule and the field together so they cannot drift apart in review, and it survives being reused by a second caller who never read your system prompt.',
        },
        {
          t: 'warn',
          title: 'A valid shape is not a correct value',
          text: 'Constrained decoding guarantees the document validates. It does **not** guarantee `blocked_users` is the right number or that the category is the one you would have picked. Shape is solved; correctness still needs good prompting, examples and an eval. Teams routinely conflate the two and then wonder why bad data still gets through.',
        },
      ],
    },
    {
      id: 'strict-tools',
      title: 'Strict tools: the other half of the guarantee',
      blocks: [
        {
          t: 'p',
          text: 'Use `output_config.format` when the answer *is* the data. Use a tool when the model should decide *whether* and *when* to produce it, or when you need several different shapes available in one turn. Setting `strict: true` gives tool arguments the same absolute validation.',
        },
        {
          t: 'code',
          lang: 'python',
          caption: '`strict` is a field on the tool definition — not on `tool_choice`',
          code: `
tools = [{
    "name": "create_incident",
    "description": (
        "File an incident. Call this ONLY when a paying customer is "
        "currently unable to work. Do not call it for questions or "
        "feature requests."
    ),
    "strict": True,                       # top-level on the tool, alongside name
    "input_schema": {
        "type": "object",
        "properties": {
            "severity": {"enum": ["sev1", "sev2", "sev3"]},
            "summary":  {"type": "string", "maxLength": 120},
            "affected_users": {"type": "integer", "minimum": 1},
        },
        "required": ["severity", "summary", "affected_users"],
        "additionalProperties": False,     # mandatory when strict is on
    },
}]

response = client.messages.create(
    model="claude-opus-5", max_tokens=2000, tools=tools,
    messages=[{"role": "user", "content": ticket}],
)

for block in response.content:
    if block.type == "tool_use":
        # block.input is guaranteed to satisfy input_schema exactly.
        file_incident(**block.input)`,
        },
        {
          t: 'table',
          caption: 'Choosing between the two mechanisms.',
          head: ['Question', 'Use'],
          rows: [
            ['Do I always want the same object back?', '`output_config.format`'],
            ['Should the model decide *if* this applies at all?', 'A tool — it can simply not call it'],
            ['Do I need one of several different shapes?', 'Several tools'],
            ['Do I want text *and* data in the same turn?', 'A tool — text blocks come alongside the `tool_use` block'],
            ['Am I actually running code as a result?', 'A tool — that is what they are for'],
            ['Do I need citations on the answer?', 'Neither — citations are incompatible with `format`'],
          ],
        },
        {
          t: 'trap',
          title: 'Two constraints that produce confusing errors',
          text: 'First, `additionalProperties: false` and a complete `required` list are **mandatory** for a strict guarantee; omit them and you silently fall back to best-effort. Second, `strict: true` is incompatible with programmatic tool calling, with `disable_parallel_tool_use`, and with forced `tool_choice` — and on the newest models forced tool choice (`any` or a named tool) is rejected outright. Ask with `auto` plus an explicit instruction naming the tool instead.',
        },
      ],
    },
    {
      id: 'designing-schemas',
      title: 'Designing a schema the model can actually fill',
      blocks: [
        {
          t: 'lead',
          text: 'A schema is a prompt with a type system attached. The same design instincts apply — be specific, order fields causally, and make the hard case expressible.',
        },
        {
          t: 'steps',
          items: [
            { title: 'Order fields in the order you want them thought about', text: 'Evidence, then reasoning, then the decision, then the confidence. The model generates top to bottom and each field conditions the next.' },
            { title: 'Use enums wherever the value set is closed', text: 'An enum is a hard guarantee; a string with "one of: low, medium, high" in the description is a suggestion. Enums also make downstream code exhaustive.' },
            { title: 'Make "I do not know" representable', text: 'Add an `unclear` enum member, or allow null, or add a `confidence` field. If the schema has no way to express uncertainty, the model must guess — and it will.' },
            { title: 'Prefer flat over deeply nested', text: 'Three levels of nesting is harder to fill correctly and far harder to debug. Flatten, or split into two calls.' },
            { title: 'Constrain the free text', text: '`maxLength` on a summary field is the difference between 40 words and four paragraphs, and it protects your latency budget.' },
            { title: 'Put the definition in the field description', text: 'Right next to the field, where it is read at the moment of use.' },
          ],
        },
        {
          t: 'compare',
          left: {
            title: 'A schema that works',
            items: [
              'Flat, six or seven fields',
              'Closed sets as enums',
              'An `unclear` value available',
              '`maxLength` on prose fields',
              'Evidence field generated first',
              'Each field carries its own definition',
              'Every field in `required`, nullable where optional',
            ],
          },
          right: {
            title: 'A schema that fights you',
            items: [
              'Four levels of nested objects',
              'Free strings where enums belong',
              'No way to say "not stated"',
              'An unbounded `analysis` string',
              'The verdict field first',
              'Definitions only in the system prompt',
              'Half the fields optional, so you cannot tell absent from missed',
            ],
          },
        },
        {
          t: 'key',
          title: 'Make every field required, and use null for absence',
          text: 'Optional fields create a genuine ambiguity: did the model decide the field does not apply, or did it simply forget? Marking everything required and allowing `null` where a value may be absent removes that ambiguity — a null is a **deliberate statement** that there is nothing there, and you can hold the model to it in your prompt and your eval.',
        },
      ],
    },
    {
      id: 'validation-layers',
      title: 'What still needs validating afterwards',
      blocks: [
        {
          t: 'p',
          text: 'Structural validity is the first of three layers. The other two are yours, and skipping them is how well-formed nonsense reaches your database.',
        },
        {
          t: 'ascii',
          caption: 'Three layers. Only the first is free.',
          code: `
  LAYER 1 — STRUCTURE                    provided by constrained decoding
    ✔ valid JSON, all required keys present, enums respected, types correct
    ✘ cannot check: is the value true? is it internally consistent?

  LAYER 2 — SEMANTIC VALIDATION          YOUR code, deterministic
    • does invoice_total equal the sum of the line items?
    • is due_date after issue_date?
    • does the product_id actually exist in our catalogue?
    • is the quoted evidence really a substring of the input?     ← powerful
    → on failure: retry once with the error appended, then escalate

  LAYER 3 — BUSINESS RULES               YOUR code, policy
    • a sev1 incident requires a named on-call owner
    • a refund over $10,000 requires human approval
    → on failure: route to a human. Never auto-correct silently.

  The substring check in layer 2 is the strongest cheap guard there is:
  if the model must quote its evidence, and you verify the quote really
  appears in the source, fabrication becomes mechanically detectable.`,
        },
        {
          t: 'code',
          lang: 'python',
          caption: 'One retry with the validation error fed back — then stop',
          code: `
def extract_validated(text: str, attempts: int = 2) -> Invoice:
    messages = [{"role": "user", "content": text}]

    for attempt in range(attempts):
        response = client.messages.create(
            model="claude-opus-5", max_tokens=2000, system=SYSTEM,
            messages=messages,
            output_config={"format": {"type": "json_schema",
                                      "schema": INVOICE_SCHEMA}},
        )
        raw = next(b.text for b in response.content if b.type == "text")
        data = json.loads(raw)               # cannot fail: guaranteed valid

        problems = semantic_check(data, source=text)   # layer 2
        if not problems:
            return Invoice(**data)

        # Feed the specific failure back. Generic "try again" teaches nothing.
        messages += [
            {"role": "assistant", "content": response.content},
            {"role": "user", "content":
                "That output was structurally valid but wrong:\\n"
                + "\\n".join(f"- {p}" for p in problems)
                + "\\nCorrect only these fields. Use null where the "
                  "document genuinely does not state a value."},
        ]

    raise NeedsHuman(problems)     # two failures means escalate, not loop`,
        },
        {
          t: 'warn',
          title: 'Cap the retries and make the failure loud',
          text: 'An unbounded correction loop is a cost incident waiting to happen — three attempts is generous, two is usually right. And a retry that silently succeeds on attempt two is hiding a quality signal: count them, alert on the rate, and treat a rising retry rate as a regression in the prompt or a change in the input distribution.',
        },
      ],
    },
  ],

  patterns: [
    {
      id: 'constrain-not-parse',
      name: 'Constrain the Decoder, Do Not Parse Hope',
      oneLiner: 'A schema makes invalid output unreachable rather than unlikely.',
      useWhen: ['Any time the output feeds code rather than a human.'],
      recognize: ['`json.loads` wrapped in a try/except with regex cleanup.', 'A prompt that says "respond with JSON only, no markdown".'],
      steps: [
        'Write the JSON schema with `additionalProperties: false` and a complete `required` list.',
        'Pass it as `output_config={"format": {...}}`, or use `strict: true` on a tool.',
        'Delete the pleading from the prompt and the cleanup code from the parser.',
        'Keep semantic validation — structure is solved, correctness is not.',
      ],
      complexity: 'Free. Removes an entire failure class.',
      gotchas: [
        'Incompatible with citations in the same request — split into two calls.',
        'Omitting `additionalProperties: false` quietly downgrades the guarantee.',
      ],
      problems: ['Collect nine malformed outputs, then make them impossible', 'Delete the cleanup code'],
    },
    {
      id: 'evidence-field',
      name: 'Require a Quoted Evidence Field',
      oneLiner: 'Make the model cite a substring, then verify the substring exists.',
      useWhen: ['Extraction, classification and question answering over documents.'],
      recognize: ['Confident values that do not appear in the source.', 'No way to audit a decision after the fact.'],
      steps: [
        'Add a `quoted_evidence` string as the first field in the schema.',
        'Require it to be an exact quotation from the input.',
        'Check in code that it is a substring; fail the record if not.',
        'Log it — it makes every decision auditable for free.',
      ],
      template: {
        lang: 'python',
        caption: 'The check is three lines and it catches fabrication mechanically',
        code: `
def semantic_check(data, source):
    problems = []
    quote = data["quoted_evidence"].strip()
    if quote and quote not in source:
        problems.append(f"quoted_evidence is not present in the source: {quote!r}")
    if data["blocked_users"] > 0 and data["urgency"] == "low":
        problems.append("blocked users reported but urgency is low")
    return problems`,
      },
      complexity: 'A few extra output tokens; a large gain in auditability.',
      gotchas: [
        'Allow for whitespace and case normalisation before comparing.',
        'Models sometimes paraphrase — state "exact quotation, character for character".',
      ],
      problems: ['Add evidence plus a substring check', 'Measure how often it fires'],
    },
    {
      id: 'nullable-required',
      name: 'Everything Required, Null for Absent',
      oneLiner: 'An omitted field is ambiguous; an explicit null is a statement.',
      useWhen: ['Every extraction schema.'],
      recognize: ['Optional fields.', 'Downstream code that cannot distinguish "missing" from "not applicable".'],
      steps: [
        'Put every field in `required`.',
        'Allow null on the fields that may genuinely be absent.',
        'State in the description when null is correct and that guessing is not.',
      ],
      complexity: 'Free.',
      gotchas: ['Without this, absent and overlooked are indistinguishable in your data.'],
      problems: ['Convert an optional schema and re-measure completeness'],
    },
    {
      id: 'bounded-repair',
      name: 'One Repair Attempt With the Specific Error',
      oneLiner: 'Feed back what was wrong, cap the loop, escalate on failure.',
      useWhen: ['Semantic validation fails on a structurally valid document.'],
      recognize: ['A while-loop around a model call.', 'Silent retries nobody counts.'],
      steps: [
        'Append the assistant turn and a user turn listing the exact problems.',
        'Allow one or two attempts, no more.',
        'Raise to a human on exhaustion.',
        'Count repairs as a quality metric and alert on the rate.',
      ],
      complexity: 'Roughly doubles cost on the cases that need it.',
      gotchas: [
        'Generic "that was wrong, try again" produces the same answer.',
        'A hidden repair loop masks a prompt regression until the bill arrives.',
      ],
      problems: ['Build the repair loop', 'Alert on the repair rate'],
    },
  ],

  pitfalls: [
    { title: 'Asking for JSON in prose and parsing it', text: 'Works most of the time; "most" is not a guarantee you can build on.' },
    { title: 'Omitting `additionalProperties: false`', text: 'Silently downgrades a strict guarantee to best effort.' },
    { title: 'Putting `strict` on `tool_choice`', text: 'It is a top-level field on the tool definition.' },
    { title: 'Using the deprecated `output_format` parameter', text: 'The current shape is `output_config: {format: {...}}`.' },
    { title: 'Forcing `tool_choice` on the newest models', text: '`any` and a named tool are rejected. Use `auto` plus an instruction.' },
    { title: 'Assuming valid means correct', text: 'The shape is guaranteed; the values are not. Keep semantic checks.' },
    { title: 'Optional fields', text: 'You cannot tell a considered absence from an oversight.' },
    { title: 'Free strings where an enum belongs', text: 'You will get "very high" eventually, and a `KeyError` with it.' },
    { title: 'Deeply nested schemas', text: 'Harder to fill, much harder to debug. Flatten or split the call.' },
    { title: 'Unbounded prose fields', text: 'One `maxLength` is the difference between a summary and an essay.' },
    { title: 'Unbounded repair loops', text: 'A cost incident with a retry counter you never added.' },
    { title: 'Requesting citations and a schema together', text: 'Returns a 400. Two calls.' },
  ],

  cheatsheet: [
    { label: 'Answer is data', value: '`output_config: {format: {...}}`' },
    { label: 'Model decides whether', value: 'a tool with `strict: true`' },
    { label: 'Strict needs', value: '`additionalProperties: false` + full `required`' },
    { label: '`strict` goes', value: 'on the tool, not on `tool_choice`' },
    { label: 'Deprecated', value: '`output_format` — use `output_config.format`' },
    { label: 'Helper', value: '`client.messages.parse()`' },
    { label: 'Field order', value: 'evidence → reasoning → decision → confidence' },
    { label: 'Closed sets', value: 'enums, never free strings' },
    { label: 'Absence', value: 'required + nullable, never optional' },
    { label: 'Prose fields', value: 'always set `maxLength`' },
    { label: 'Definitions', value: 'in the field `description`' },
    { label: 'Layer 1', value: 'structure — free' },
    { label: 'Layer 2', value: 'semantic checks — yours' },
    { label: 'Layer 3', value: 'business rules — yours' },
    { label: 'Best cheap guard', value: 'quoted evidence + substring check' },
    { label: 'Repairs', value: 'max two, with the specific error, then escalate' },
    { label: 'Incompatible with', value: 'citations in the same request' },
  ],

  problems: [
    { name: 'Collect ten malformed JSON outputs', difficulty: 'Easy', pattern: 'Motivation', insight: 'Run a "reply in JSON" prompt a hundred times over varied inputs and save every response that fails to parse. Keep the file — it is the argument for schemas.' },
    { name: 'Make all ten impossible with a schema', difficulty: 'Easy', pattern: 'Constrained decoding', insight: 'Add the schema and rerun the same hundred. Zero parse failures. Then delete the cleanup code, which is the real win.' },
    { name: 'Produce a well-formed wrong answer', difficulty: 'Easy', pattern: 'Valid ≠ correct', insight: 'Feed an invoice whose line items do not sum to the total. The schema passes; the data is wrong. This is why layer 2 exists.' },
    { name: 'Add a quoted-evidence field and verify it', difficulty: 'Medium', pattern: 'Evidence', insight: 'Require an exact quotation and check it is a substring. Count how often it fails on real inputs — the number is usually higher than expected and is a direct fabrication metric.' },
    { name: 'Convert optional fields to required-and-nullable', difficulty: 'Medium', pattern: 'Absence', insight: 'Compare how many records have a genuinely-absent value before and after. The optional version was hiding oversights as absences.' },
    { name: 'Move definitions from the system prompt into descriptions', difficulty: 'Medium', pattern: 'Schema as prompt', insight: 'Score both on fifty cases. The field-adjacent definition usually wins, and it cannot drift away from the field it defines.' },
    { name: 'Build the bounded repair loop', difficulty: 'Medium', pattern: 'Repair', insight: 'Feed the specific validation errors back, cap at two attempts, escalate after. Then log the repair rate and watch it move when you change the prompt.' },
    { name: 'Choose between format and tools for three tasks', difficulty: 'Medium', pattern: 'Mechanism choice', insight: 'One that always returns data, one where the action is conditional, one needing several shapes. Justify each choice in a sentence.' },
    { name: 'Break strict mode on purpose', difficulty: 'Hard', pattern: 'Strict constraints', insight: 'Drop `additionalProperties`, then combine `strict` with a forced `tool_choice`. Read both errors. Knowing exactly which combinations are illegal saves an afternoon later.' },
    { name: 'Flatten a deeply nested schema and compare', difficulty: 'Hard', pattern: 'Schema design', insight: 'Take a four-level schema, flatten it to one level with prefixed keys, and score both on fifty documents. Field-level accuracy and debuggability both improve.' },
  ],
}
