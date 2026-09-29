export default {
  id: 'ai-why',
  title: 'What a Language Model Is, and What It Is Not',
  short: 'Why LLMs',
  icon: 'AutoAwesomeRounded',
  tier: 'Foundations',
  order: 1,
  estHours: 3,
  prereqs: [],
  tagline: 'A next-token predictor with a text interface. Everything else is engineering you add.',
  mentalModel:
    'A language model is a **pure function**: text in, a probability distribution over the next token out. It has no memory, no clock, no filesystem, no ability to act. Every capability you think it has — remembering your name, looking things up, calling an API — is a loop **you** wrote around that function.',
  whyItMatters:
    'Almost every bug in an AI feature comes from expecting the model to have something it does not have. Once you internalise "stateless function over text", you stop being surprised: you know why it forgot, why it invented a citation, why it cannot tell you today’s date, and which of those are your job to fix.',

  reference: {
    title: 'What the model has, and what you must supply',
    head: ['Capability', 'In the model?', 'Where it actually comes from'],
    rows: [
      ['Language and reasoning', '**Yes**', 'Learned during training. This is what you are buying.'],
      ['World knowledge', 'Partly', 'Frozen at the training cutoff. Anything newer must be in the prompt.'],
      ['Memory of past turns', '**No**', 'You resend the whole conversation on every request.'],
      ['Your private data', '**No**', 'Retrieval: you fetch it and put it in the prompt.'],
      ['Doing things (email, DB, HTTP)', '**No**', 'Tool use: the model emits a request, *your code* runs it.'],
      ['Arithmetic and exact counting', 'Unreliable', 'Give it a calculator or a code sandbox.'],
      ['Knowing what it does not know', 'Weak', 'Guardrails, citations and evals that you build.'],
    ],
  },

  sections: [
    {
      id: 'the-function',
      title: 'The whole thing, in one diagram',
      blocks: [
        {
          t: 'lead',
          text: 'Strip away the chat window and the SDK and this is all that happens. One request, one distribution over possible next tokens, one sample from it, repeat.',
        },
        {
          t: 'ascii',
          caption: 'The model is the small box in the middle. Everything else is your application.',
          code: `
   YOUR APPLICATION                    THE MODEL                 YOUR APPLICATION
  ┌──────────────────┐        ┌──────────────────────┐        ┌──────────────────┐
  │ system prompt    │        │                      │        │ stream to the UI │
  │ conversation so  │───────▶│  text ──▶ P(next     │───────▶│ parse the JSON   │
  │   far (all of it)│        │            token)    │        │ run the tool     │
  │ retrieved docs   │        │                      │        │ store the turn   │
  │ tool definitions │        │   stateless.         │        │ append + repeat  │
  └──────────────────┘        │   no memory.         │        └──────────────────┘
          ▲                   │   no side effects.   │                 │
          └───────────────────┴──────────────────────┴─────────────────┘
                       the loop is yours, not the model’s

  Every "AI feature" in this course is a different shape of that loop:
      chat        = append the new user turn, resend everything
      RAG         = search first, paste the results into the prompt
      tool use    = model asks, your code does it, you hand back the result
      agent       = tool use, in a while-loop, until the model says it is done`,
        },
        {
          t: 'key',
          title: 'The request is the entire world',
          text: 'The model sees exactly what is in the request body and nothing else. Not your database, not the previous request, not the file the user uploaded five minutes ago. If the answer depends on something, that something must be **in the bytes you send**. This one sentence explains most of the work in this track.',
        },
        {
          t: 'p',
          text: 'It follows that the interesting engineering question is never "can the model do X". It is "what do I have to put in the context, and what do I have to do with the output, so that X happens reliably and at an acceptable cost". That is the job title: AI engineer.',
        },
      ],
    },
    {
      id: 'tokens',
      title: 'Tokens: the unit of everything',
      blocks: [
        {
          t: 'p',
          text: 'The model does not see characters or words. Text is first cut into **tokens** — frequent sub-word chunks drawn from a fixed vocabulary of roughly 100k–200k entries. Tokens are the unit of the context window, of latency, and of your bill, so you need a feel for them.',
        },
        {
          t: 'ascii',
          caption: 'Tokenisation is why "count the letters in this word" is a hard question for a model.',
          code: `
  TEXT                    TOKENS (│ marks a boundary)              COUNT
  ──────────────────────────────────────────────────────────────────────
  "Hello world"           │Hello│ world│                              2
  "unbelievable"          │un│believ│able│                            3
  "strawberry"            │str│aw│berry│                              3
  "1234567"               │123│45│67│                                 3
  "नमस्ते"                  │न│म│स│्│त│े│  (non-Latin costs more)       ~6
  "def foo(x):"           │def│ foo│(│x│):│                           5

  Rules of thumb for English prose:
      1 token  ≈ 4 characters  ≈ 0.75 words
      1,000 tokens ≈ 750 words ≈ 1.5 pages of a paperback
      code is denser: more tokens per character than prose
      other scripts and rare words are far more expensive

  Why "how many r’s in strawberry" is genuinely hard:
      the model sees  │str│aw│berry│  — three opaque ids.
      It never saw the letters. Asking it to spell is asking it to
      recall a fact about its own tokenizer. Give it code instead.`,
        },
        {
          t: 'tip',
          title: 'Never estimate tokens with a character count in production',
          text: 'Use the API’s own counter — `client.messages.count_tokens(...)` — which runs the real tokenizer for the real model. Third-party tokenizers built for other vendors’ models will be wrong, sometimes by 30%. Budgeting a context window off a wrong number is how you get a 400 error in front of a customer.',
        },
        {
          t: 'code',
          lang: 'python',
          caption: 'Count before you send — the only reliable way to know what a prompt costs',
          code: `
import anthropic

client = anthropic.Anthropic()   # reads ANTHROPIC_API_KEY from the environment

count = client.messages.count_tokens(
    model="claude-opus-5",
    system="You are a careful technical editor.",
    messages=[{"role": "user", "content": open("chapter.md").read()}],
)

print(count.input_tokens)                     # e.g. 18_432
print(f"input cost: \${count.input_tokens / 1e6 * 5.00:.4f}")   # Opus 5: $5 / MTok in`,
        },
      ],
    },
    {
      id: 'failure-modes',
      title: 'The four failure modes, and whose fault each one is',
      blocks: [
        {
          t: 'p',
          text: 'New teams treat every bad output as one undifferentiated problem called "hallucination". They are four different problems with four different fixes, and three of the four are fixed in your code rather than in the prompt.',
        },
        {
          t: 'table',
          caption: 'Diagnose before you prompt-engineer. The wrong fix wastes weeks.',
          head: ['Symptom', 'Real cause', 'Fix', 'Chapter'],
          rows: [
            ['Confident, specific, wrong fact', 'The fact was never in the prompt, so the model predicted a plausible one', 'Retrieval — put the fact in the context and require citations', 'RAG'],
            ['"I don’t have information after..."', 'Training cutoff', 'Retrieval or web search', 'RAG / Tool use'],
            ['Forgot what you said earlier', 'You did not resend the history, or it was truncated', 'Conversation state, caching, compaction', 'Context engineering'],
            ['Output shape keeps changing', 'You asked for JSON in prose instead of constraining it', 'Structured output / strict tools', 'Structured output'],
            ['Wrong arithmetic, miscounted items', 'Token-level prediction is not a calculator', 'Give it code execution or a tool', 'Tool use'],
            ['Did something you did not want', 'No guardrail between "model asked" and "code did"', 'Approval gates, allow-lists, sandboxing', 'Safety'],
          ],
        },
        {
          t: 'warn',
          title: 'Hallucination is usually a retrieval bug wearing a costume',
          text: 'When a model invents an API method or a case citation, it is doing exactly what it was trained to do: produce the most plausible continuation. Nothing in the request told it the real answer, and nothing told it that being wrong is worse than being silent. Both of those are things **you** supply — the facts, and the instruction to say "not in the provided documents".',
        },
        {
          t: 'note',
          title: 'Non-determinism is the baseline, not a defect',
          text: 'The same prompt can produce different text on two calls. Even at the lowest sampling settings, floating-point non-determinism in batched inference means byte-identical output is not guaranteed. Design for it: never assert on exact strings in tests, always parse defensively, and score behaviour over a set of cases rather than one.',
        },
      ],
    },
    {
      id: 'when-not-to',
      title: 'When not to use a language model',
      blocks: [
        {
          t: 'lead',
          text: 'The most senior instinct in this field is knowing when the answer is "a regular expression". An LLM costs a thousand times more than a function call, takes a thousand times longer, and cannot be unit-tested for equality. It must earn its place.',
        },
        {
          t: 'compare',
          left: {
            title: 'Reach for a model',
            items: [
              'The input is unstructured natural language',
              'The rules are fuzzy, numerous, or change often',
              'Writing the rules by hand would take longer than the feature is worth',
              'You need fluent text out, not just a decision',
              'A human already does this job by reading and judging',
              'An occasional wrong answer is survivable and detectable',
            ],
          },
          right: {
            title: 'Do not reach for a model',
            items: [
              'A regex, a parser or a SQL query is exact and instant',
              'The answer must be provably correct every time (billing, auth)',
              'You need sub-10ms latency',
              'The volume is enormous and the margin is thin',
              'You cannot detect a wrong answer after the fact',
              'A lookup table would do — this is the most common mistake',
            ],
          },
        },
        {
          t: 'ascii',
          caption: 'Climb this ladder from the bottom. Every rung up costs money, latency and debuggability.',
          code: `
             ┌──────────────────────────────────────────────┐
     hardest │  4. AGENT       model decides the steps      │  slowest,
     to      │                 loop until done              │  priciest,
     debug   ├──────────────────────────────────────────────┤  least
             │  3. WORKFLOW    you decide the steps,         │  predictable
             │                 model fills each one          │
             ├──────────────────────────────────────────────┤
             │  2. ONE CALL    + retrieval / tools           │
             ├──────────────────────────────────────────────┤
     easiest │  1. ONE CALL    prompt in, text out           │  fastest,
     to      ├──────────────────────────────────────────────┤  cheapest,
     debug   │  0. NO MODEL    regex, SQL, a lookup table    │  testable
             └──────────────────────────────────────────────┘

  Ship rung 1. Measure it. Only climb when the measurement says you must.
  Most production "AI features" that work are rung 1 or 2 with good retrieval.
  Most that fail are rung 4 built before anyone tried rung 1.`,
        },
        {
          t: 'key',
          title: 'Four questions before you build an agent',
          text: '**Complexity** — is the task genuinely hard to specify in advance? **Value** — does the outcome justify the cost and latency? **Viability** — is the model actually good at this kind of task? **Cost of error** — can a mistake be caught and undone? If any answer is no, stay one rung lower. This test reappears in the agent chapters; it is the single most useful filter in the track.',
        },
      ],
    },
    {
      id: 'shape-of-track',
      title: 'How the rest of this track is shaped',
      blocks: [
        {
          t: 'p',
          text: 'The chapters follow the loop outward from the model. First the machine itself, then what you put into it, then what you do with what comes out, then the loops built on top.',
        },
        {
          t: 'steps',
          items: [
            { title: 'Foundations — the machine', text: 'Tokens, attention and next-token prediction; how inference and decoding actually behave; the Messages API; and prompting that holds up under load.' },
            { title: 'Core — what goes in', text: 'Constraining the output shape, engineering the context window as a budget, embeddings and vector search, chunking, and RAG from a baseline pipeline to hybrid search and reranking.' },
            { title: 'Advanced — letting it act', text: 'Tool use from first principles, the agent loop, designing a tool surface, memory, MCP, and multi-agent systems.' },
            { title: 'Elite — making it survive', text: 'Agentic workflow topologies, evals that turn opinion into a number, prompt injection and guardrails, and the production concerns: cost, latency, observability and failure handling.' },
          ],
        },
        {
          t: 'note',
          title: 'The code in this track',
          text: 'Examples are Python with the official `anthropic` SDK, against `claude-opus-5` unless a snippet is specifically about choosing a cheaper model. The concepts — tokens, context windows, tool-call loops, retrieval — transfer to any provider; the parameter names do not, so always check the SDK you are using.',
        },
      ],
    },
  ],

  patterns: [
    {
      id: 'ladder-of-escalation',
      name: 'Climb the Ladder, Don’t Start at the Top',
      oneLiner: 'Ship the simplest tier that works, then measure before escalating.',
      useWhen: ['Designing any AI feature, before a line of code exists.'],
      recognize: ['A design doc that opens with "an agent that...".', 'A multi-agent architecture for a classification problem.'],
      steps: [
        'Write down the task as a single prompt and try it.',
        'If it fails, ask whether it failed for lack of *information* (add retrieval) or lack of *actions* (add tools).',
        'Only if the sequence of steps genuinely cannot be written in advance, move to an agent.',
        'Record what each rung cost in tokens and latency so the escalation is defensible.',
      ],
      complexity: 'Each rung up: roughly 3–10× the tokens and a large loss of predictability.',
      gotchas: [
        'An agent that works in a demo often fails at rung 4 for reasons rung 2 would have exposed cheaply.',
        'Teams skip the measurement, so nobody can say whether the agent was necessary.',
      ],
      problems: ['Solve the same task at three rungs', 'Compare token cost and variance'],
    },
    {
      id: 'context-is-everything',
      name: 'If It Matters, Put It In the Context',
      oneLiner: 'The model knows only what is in the request body.',
      useWhen: ['Any time output is wrong, stale or forgetful.'],
      recognize: ['"Why does it not know about our pricing?"', '"It forgot my name from two messages ago."'],
      steps: [
        'Log the exact request body that produced the bad output.',
        'Read it as the model: is the needed fact physically present?',
        'If not, this is a retrieval or state-management bug, not a prompting bug.',
        'Fix it where it lives — the fetch, the history, the truncation — not in the instructions.',
      ],
      complexity: 'Free. Costs one log line and the discipline to read it.',
      gotchas: [
        'Truncation is usually silent — a middleware trimmed the history and told nobody.',
        'Adding "be accurate" to the system prompt fixes nothing when the fact is absent.',
      ],
      problems: ['Log and read a real request body', 'Find a silent truncation'],
    },
    {
      id: 'diagnose-before-prompting',
      name: 'Diagnose the Failure Class First',
      oneLiner: 'Four failure modes, four different fixes. Naming it saves weeks.',
      useWhen: ['Any bad output, before editing the prompt.'],
      recognize: ['A prompt that has grown to 2,000 words of accumulated pleading.', 'Fixes that work once and regress.'],
      steps: [
        'Classify: missing fact, missing action, missing state, or wrong shape?',
        'Missing fact → retrieval. Missing action → tools. Missing state → conversation handling. Wrong shape → structured output.',
        'Only edit the prompt for genuine instruction-following problems.',
      ],
      complexity: 'Minutes of thought; saves weeks of prompt archaeology.',
      gotchas: ['Everything looks like a prompting problem if prompting is the only tool you have.'],
      problems: ['Classify ten real failures', 'Fix one of each class'],
    },
  ],

  pitfalls: [
    { title: 'Treating the model as stateful', text: 'It is not. Every request must carry the entire conversation, or it has not happened.' },
    { title: 'Expecting knowledge past the training cutoff', text: 'Anything recent, private or proprietary has to be retrieved and pasted in.' },
    { title: 'Calling every wrong answer a hallucination', text: 'It is usually a missing fact in the context — a retrieval bug, not a model defect.' },
    { title: 'Estimating tokens by dividing characters by four', text: 'Fine for a mental sketch, wrong for a budget. Use `count_tokens`.' },
    { title: 'Asking a model to do exact arithmetic', text: 'Give it code execution or a calculator tool and let it delegate.' },
    { title: 'Asserting exact output strings in tests', text: 'Output is non-deterministic by design. Score behaviour, not bytes.' },
    { title: 'Building an agent first', text: 'Rung 4 hides the bugs that rung 1 would have shown you in an hour.' },
    { title: 'Using a model where a regex would do', text: 'A thousand times the cost and latency for a worse guarantee.' },
    { title: 'No logging of the request body', text: 'Without it you are debugging by seance. Log the bytes you actually sent.' },
  ],

  cheatsheet: [
    { label: 'What a model is', value: 'text → P(next token), stateless' },
    { label: 'Memory', value: 'yours — resend the history' },
    { label: 'Private data', value: 'yours — retrieval' },
    { label: 'Actions', value: 'yours — tool use' },
    { label: '1 token', value: '≈ 4 chars ≈ 0.75 words (English)' },
    { label: 'Count tokens', value: '`client.messages.count_tokens(...)`' },
    { label: 'Confident wrong fact', value: 'retrieval bug' },
    { label: 'Forgot earlier turn', value: 'state bug' },
    { label: 'Wrong shape', value: 'structured output' },
    { label: 'Bad arithmetic', value: 'give it a tool' },
    { label: 'Ladder', value: 'no model → one call → +tools → workflow → agent' },
    { label: 'Agent test', value: 'complexity, value, viability, cost of error' },
    { label: 'Determinism', value: 'never assume it' },
  ],

  problems: [
    { name: 'Tokenise ten strings and predict the counts first', difficulty: 'Easy', pattern: 'Tokens', insight: 'Write down your guess for a sentence, a code snippet, a URL and a non-English phrase, then call `count_tokens`. The gap on code and non-Latin script is the lesson.' },
    { name: 'Prove the model is stateless', difficulty: 'Easy', pattern: 'No memory', insight: 'Send "my name is Somesh", then a second independent request asking "what is my name". It cannot answer. Now resend both turns and it can. You just implemented memory.' },
    { name: 'Price a single request three ways', difficulty: 'Easy', pattern: 'Cost', insight: 'Count the input tokens, read `usage` off the response, and compute the cost at Opus, Sonnet and Haiku rates. Keep the number — most cost arguments are made without it.' },
    { name: 'Ask for the letter count in a word', difficulty: 'Easy', pattern: 'Tokenisation limits', insight: 'Ask how many r’s are in "strawberry" ten times. Then ask it to write and run Python that counts them. The second is reliable because it delegates past the tokenizer.' },
    { name: 'Classify ten real failures into the four modes', difficulty: 'Medium', pattern: 'Diagnosis', insight: 'Take actual bad outputs and label each: missing fact, missing action, missing state, wrong shape. The distribution tells you which chapter to read next.' },
    { name: 'Force a hallucinated citation, then remove it', difficulty: 'Medium', pattern: 'Retrieval', insight: 'Ask for a source on an obscure internal policy. It will invent one. Paste the real policy in and add "cite only from the text above, or say it is not covered". The invention stops.' },
    { name: 'Measure non-determinism', difficulty: 'Medium', pattern: 'Variance', insight: 'Send the same prompt twenty times and diff the outputs. Now do it for a classification prompt with a fixed label set. Variance on open text is high, on constrained output near zero — which is the whole argument for structured output.' },
    { name: 'Replace an LLM call with a regex', difficulty: 'Medium', pattern: 'Rung 0', insight: 'Find a prompt in a codebase doing extraction from a fixed format. Write the parser. Compare latency, cost and accuracy. Usually the parser wins on all three.' },
    { name: 'Solve one task at rungs 1, 2 and 4', difficulty: 'Hard', pattern: 'Escalation', insight: 'Pick "answer a question about our docs". Do it as one call, then with retrieval, then as an agent with a search tool. Record tokens, latency and correctness for each. This table is the best design argument you will ever have.' },
    { name: 'Write the four-question agent test for a real feature', difficulty: 'Hard', pattern: 'Agent viability', insight: 'Answer complexity, value, viability and cost of error honestly for something you actually want to build. Most proposals fail on cost of error, and that is the one people skip.' },
  ],
}
