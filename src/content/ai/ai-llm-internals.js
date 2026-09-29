export default {
  id: 'ai-llm-internals',
  title: 'Inside a Language Model',
  short: 'How LLMs Work',
  icon: 'PsychologyRounded',
  tier: 'Foundations',
  order: 2,
  estHours: 5,
  prereqs: ['ai-why'],
  tagline: 'Tokens become vectors, vectors look at each other, the last one votes on what comes next.',
  mentalModel:
    'A transformer is a stack of identical layers. Each layer does two things: every token **looks at** every earlier token and pulls in what it needs (attention), then each token **thinks about what it gathered** on its own (the feed-forward network). Repeat 60–100 times and the final position holds enough information to predict the next token well.',
  whyItMatters:
    'You do not need to implement a transformer. You do need to know why context costs quadratic attention, why the model is better at the start and end of a long prompt than the middle, why it cannot spell, and what "reasoning" models actually changed. All of those are consequences of this architecture, and all of them shape decisions you make weekly.',

  reference: {
    title: 'The stages, and what each one does',
    head: ['Stage', 'Input → output', 'What it contributes'],
    rows: [
      ['**Tokenise**', 'text → token ids', 'A fixed vocabulary of sub-word pieces'],
      ['**Embed**', 'ids → vectors', 'Meaning becomes geometry: similar tokens land near each other'],
      ['**+ position**', 'vectors → positioned vectors', 'Word order, which attention alone would ignore'],
      ['**Attention** (×N)', 'vectors → mixed vectors', 'Each token pulls in relevant context from earlier tokens'],
      ['**Feed-forward** (×N)', 'vectors → transformed vectors', 'Where most parameters and most learned facts live'],
      ['**Unembed**', 'last vector → logits', 'One score per vocabulary entry'],
      ['**Softmax + sample**', 'logits → one token', 'Scores become probabilities; sampling picks one'],
    ],
  },

  sections: [
    {
      id: 'ids-to-vectors',
      title: 'From text to geometry',
      blocks: [
        {
          t: 'lead',
          text: 'Neural networks multiply numbers. So the first job is to turn "The cat sat" into numbers that carry meaning — not arbitrary ids, but coordinates in a space where distance means something.',
        },
        {
          t: 'ascii',
          caption: 'Every token becomes a row in a learned lookup table, then gets its position stamped on.',
          code: `
  "The cat sat"
        │
        ▼  tokenise
  [ 791 , 8415 , 7731 ]                   three integer ids
        │
        ▼  embedding table lookup  (vocab × d_model, a learned matrix)
  ┌─────────────────────────────────────────────────────┐
  │ 791  →  [ 0.21, -0.04,  1.88, ... ]   d_model ≈ 4096│
  │ 8415 →  [-1.02,  0.77,  0.13, ... ]                 │
  │ 7731 →  [ 0.44,  0.09, -0.61, ... ]                 │
  └─────────────────────────────────────────────────────┘
        │
        ▼  add positional information
  token 0 knows it is first, token 1 knows it is second, ...
        │
        ▼  this matrix  [3 × 4096]  enters layer 1

  The embedding space is learned, and it is meaningful:
      vec("king") - vec("man") + vec("woman")  ≈  vec("queen")
      vec("Paris") - vec("France")             ≈  vec("Tokyo") - vec("Japan")
  This is the same idea you will use directly in the embeddings chapter.`,
        },
        {
          t: 'note',
          title: 'Why position has to be added explicitly',
          text: 'Attention is a weighted sum, and a sum does not care about order — without positional information "dog bites man" and "man bites dog" would be identical to the model. Modern models encode position by rotating the query and key vectors by an angle proportional to their index (rotary embeddings), which makes relative distance fall out of the arithmetic naturally and extrapolates better to long contexts.',
        },
      ],
    },
    {
      id: 'attention',
      title: 'Attention: the one idea that matters',
      blocks: [
        {
          t: 'p',
          text: 'Each token asks a question, every earlier token advertises what it has, and the answers are averaged by how well they match. That is the whole mechanism. Three learned projections give each token a **query** (what am I looking for), a **key** (what do I offer) and a **value** (what I will contribute if chosen).',
        },
        {
          t: 'ascii',
          caption: 'Resolving the word "it" — attention is how a pronoun finds its antecedent.',
          code: `
  Sentence:  "The trophy did not fit in the suitcase because it was too large"
                                                             ▲
                                                             │ this token's query:
                                                        "which noun am I?"

  Compare that query against every earlier token's key  →  raw scores
  Scale, mask the future, softmax                        →  weights that sum to 1

      The      ▏                              0.01
      trophy   ████████████████████████▏      0.71   ← wins
      did      ▏                              0.01
      not      ▏                              0.01
      fit      ██▏                            0.06
      in       ▏                              0.01
      the      ▏                              0.01
      suitcase ████▏                          0.15
      because  ▏                              0.03

  Output for "it" = 0.71·value(trophy) + 0.15·value(suitcase) + ...
  The vector at "it" now carries trophy-ness. Later layers use that.

  Change one word — "because it was too SMALL" — and the weights flip to
  suitcase. Nothing in the network changed; the query did.`,
        },
        {
          t: 'h',
          text: 'Causal masking: why generation is possible at all',
        },
        {
          t: 'ascii',
          caption: 'Token i may only attend to tokens ≤ i. The upper triangle is set to minus infinity before the softmax.',
          code: `
             attends to →
             The  trophy  did  not  fit
   The       ✔     ✘      ✘    ✘    ✘
   trophy    ✔     ✔      ✘    ✘    ✘
   did       ✔     ✔      ✔    ✘    ✘
   not       ✔     ✔      ✔    ✔    ✘
   fit       ✔     ✔      ✔    ✔    ✔

  Consequence 1: training is massively parallel. One forward pass over a
      document teaches the model to predict position 2 from 1, 3 from 1–2,
      and so on — every position at once, all supervised, no labels needed.

  Consequence 2: a token's representation never changes once computed,
      because it cannot see anything that comes after it. That is exactly
      what makes the KV cache correct — see the next chapter.`,
        },
        {
          t: 'key',
          title: 'Attention is quadratic, and that is why context costs what it does',
          text: 'Computing every pair of scores for _n_ tokens is O(n²) work. Ten times the prompt is a hundred times the attention compute. Flash-attention and similar kernels cut the memory traffic and constants dramatically, but not the asymptotic shape. This is the mechanical reason long contexts are slow and expensive, and the reason a disciplined context budget is real engineering rather than penny-pinching.',
        },
        {
          t: 'h',
          text: 'Multi-head attention',
        },
        {
          t: 'p',
          text: 'One set of query/key/value projections can only express one kind of relationship. Real models run dozens of attention **heads** in parallel per layer, each with its own projections, then concatenate the results. Interpretability work has found heads that specialise: some track syntax, some copy the previous token, some retrieve the token that followed a similar context earlier in the prompt. You never address them directly, but they explain why the model can juggle several relationships in one layer.',
        },
      ],
    },
    {
      id: 'the-stack',
      title: 'The stack, and where the knowledge lives',
      blocks: [
        {
          t: 'ascii',
          caption: 'One block, repeated. The residual stream is the horizontal line every layer reads from and writes to.',
          code: `
   ┌──── residual stream ──────────────────────────────────────┐
   │                                                            │
   │   ┌────────────────────────────────────────────────────┐  │
   │   │  LayerNorm → MULTI-HEAD ATTENTION                  │  │  "gather
   │   └────────────────────────────────────────────────────┘  │   context"
   │                    │  + add back to the stream             │
   │   ┌────────────────▼───────────────────────────────────┐  │
   │   │  LayerNorm → FEED-FORWARD (expand 4×, then shrink) │  │  "think
   │   └────────────────────────────────────────────────────┘  │   about it"
   │                    │  + add back to the stream             │
   └────────────────────┼───────────────────────────────────────┘
                        │  × 60–100 layers
                        ▼
                 final LayerNorm
                        │
                 unembed  →  one logit per vocabulary entry (~100k+)
                        │
                 softmax  →  probabilities
                        │
                 sample   →  ONE token

  Then append that token to the input and run the whole thing again.
  That loop — one token per forward pass — is why output is slower
  than input, and why streaming exists.

  Parameter budget, roughly:
      feed-forward layers   ~⅔ of all parameters   ← most learned facts
      attention             ~⅓
      embeddings            a few percent`,
        },
        {
          t: 'note',
          title: 'The residual stream is a shared workspace',
          text: 'Because every block **adds** to the stream rather than replacing it, information can survive untouched for many layers, and a later layer can pick up something an early one wrote. A useful picture: early layers resolve surface structure, middle layers do most of the semantic work and factual recall, late layers sharpen the distribution over the actual next token.',
        },
        {
          t: 'tip',
          title: 'Mixture-of-experts, in one sentence',
          text: 'Large modern models often replace the single feed-forward block with many parallel "expert" blocks and a router that activates only a couple per token. Total parameters go up, compute per token does not. Practically this is why a very large model can still be fast — and why a headline parameter count tells you little about cost or speed.',
        },
      ],
    },
    {
      id: 'next-token',
      title: 'Next-token prediction is the whole objective',
      blocks: [
        {
          t: 'p',
          text: 'The model has exactly one skill: given a prefix, score every possible next token. Everything you value — reasoning, translation, code, tone — is an emergent consequence of doing that extremely well over a corpus that contains reasoning, translation, code and tone.',
        },
        {
          t: 'code',
          lang: 'python',
          caption: 'What the forward pass returns, conceptually — the last position is the only one you sample from',
          code: `
# Conceptual. A hosted API does this for you; this is what is underneath.
logits = model(token_ids)          # shape: [seq_len, vocab_size]
last   = logits[-1]                # only the final position predicts what is next

probs = softmax(last / temperature)

# probs might look like:
#   " Paris"   0.78
#   " the"     0.06
#   " a"       0.04
#   " Lyon"    0.01
#   ... ~100k more entries, nearly all ~0

next_token = sample(probs)         # decoding strategy: see the next chapter
token_ids.append(next_token)       # and run the whole forward pass again`,
        },
        {
          t: 'key',
          title: 'This is why the model is fluent about things it does not know',
          text: 'Nothing in the objective rewards truth. It rewards *plausibility* — being the continuation a well-informed writer would plausibly produce. A fabricated citation is high-probability text: it has the right shape, the right journal name, a believable year. The model is not lying; it is doing its job in the absence of the facts. Supply the facts and the same machinery becomes accurate.',
        },
        {
          t: 'warn',
          title: 'Autoregression means errors compound',
          text: 'Each token is conditioned on every token already emitted, including the model’s own mistakes. One wrong premise early on becomes the ground truth for everything after it — the model will confidently build on it rather than correct course. This is exactly why a scratchpad, a reasoning phase or an explicit self-check before the final answer improves accuracy: it puts the correction *inside* the generation rather than hoping for it afterwards.',
        },
      ],
    },
    {
      id: 'training',
      title: 'How it got this way: three stages',
      blocks: [
        {
          t: 'ascii',
          caption: 'A base model completes text. A chat model does what you ask. Those are different artefacts.',
          code: `
  1. PRE-TRAINING                                   months, thousands of GPUs
     objective: predict the next token over trillions of tokens of text
     result:    a BASE model — enormous knowledge, no manners
                prompt "How do I reset a password?"
                reply  "How do I change my email? How do I..."   ← it completes,
                                                                   it does not answer

  2. SUPERVISED FINE-TUNING (SFT)                   days, curated data
     objective: same next-token loss, but on (instruction, good answer) pairs
     result:    an ASSISTANT — now answers rather than continues
                learns the turn structure: system / user / assistant

  3. PREFERENCE OPTIMISATION (RLHF, DPO, ...)       days, human + AI feedback
     objective: prefer the response humans rank higher
     result:    tone, refusal behaviour, formatting habits, helpfulness
                also: sycophancy and hedging, if the ranking rewarded them

  Then, for reasoning models:

  4. REASONING TRAINING                             reinforcement learning on
     objective: produce a long internal chain that leads to a verifiably      tasks with
                correct answer (maths, code, proofs)                          checkable answers
     result:    the model spends output tokens thinking before answering,
                and that materially improves hard multi-step tasks`,
        },
        {
          t: 'dl',
          items: [
            { term: 'Base model', def: 'Pre-training only. Completes text; does not follow instructions. Rarely what you want from an API.' },
            { term: 'Instruction-tuned / chat model', def: 'Base + SFT (+ preference optimisation). What every hosted chat API serves.' },
            { term: 'Reasoning model', def: 'Additionally trained to produce a long internal chain of thought before answering. Trades output tokens and latency for accuracy on hard problems.' },
            { term: 'Training cutoff', def: 'The date the pre-training corpus ends. Knowledge after it must be supplied in the context.' },
            { term: 'Fine-tuning (yours)', def: 'Further training on your own examples. Teaches *form and behaviour* well; a poor and expensive way to teach *facts* — retrieval is better for facts.' },
          ],
        },
        {
          t: 'key',
          title: 'Fine-tuning versus retrieval, decided properly',
          text: 'Ask what is missing. Missing **knowledge** — your documents, your prices, yesterday’s incident → retrieval, every time; it is updatable, citable and cheap. Missing **behaviour** — a house style, a rigid output format, a domain-specific labelling convention → prompting first, then fine-tuning if prompting plateaus. Fine-tuning on facts bakes them in undatably and they will go stale on you.',
        },
      ],
    },
    {
      id: 'thinking',
      title: 'Reasoning models and extended thinking',
      blocks: [
        {
          t: 'p',
          text: 'A reasoning model does not have a different architecture. It has been trained to *use output tokens as working memory* before committing to an answer — and the API exposes that as a separate block so you can see or hide it, and pay for it knowingly.',
        },
        {
          t: 'ascii',
          caption: 'Thinking tokens are generated, billed, and then usually not shown to the user.',
          code: `
  WITHOUT THINKING
  prompt ──▶ [ answer tokens ] ──▶ user
             fast, cheap, weaker on multi-step problems

  WITH ADAPTIVE THINKING
  prompt ──▶ [ thinking tokens ..................... ] ──▶ [ answer ] ──▶ user
             the model decides how long to think,
             based on how hard the problem looks
             ▲
             │ billed as output tokens
             │ returned as a separate "thinking" content block
             │ display: "omitted" by default — the block arrives with empty text

  You control depth with EFFORT, not a token budget:
      low    → terse, few tool calls; good for routine or high-volume work
      medium → the cost-saving step down when quality holds
      high   → the default; the balance point for most work
      xhigh  → best setting for most coding and agentic work
      max    → when correctness matters more than the bill`,
        },
        {
          t: 'code',
          lang: 'python',
          caption: 'Adaptive thinking with an effort level — the modern shape',
          code: `
response = client.messages.create(
    model="claude-opus-5",
    max_tokens=16000,
    thinking={"type": "adaptive", "display": "summarized"},
    output_config={"effort": "high"},        # low | medium | high | xhigh | max
    messages=[{"role": "user", "content": "Plan a migration off this schema..."}],
)

for block in response.content:
    if block.type == "thinking":
        print("[reasoning]", block.thinking)   # empty unless display is set
    elif block.type == "text":
        print(block.text)

print(response.usage.output_tokens)   # includes the thinking tokens`,
        },
        {
          t: 'warn',
          title: 'Two things that trip people up',
          text: 'First, `display` defaults to `"omitted"` on current models — if you stream reasoning to a UI you will see a long pause and empty thinking blocks unless you explicitly ask for `"summarized"`. Second, when you continue a conversation on the same model, pass the thinking blocks back **unchanged**; do not reformat or drop them from the history you resend.',
        },
        {
          t: 'note',
          title: 'The fixed thinking budget is history',
          text: 'Older APIs took a hard `budget_tokens` ceiling. Current models replace it with adaptive thinking plus an `effort` level, and reject `budget_tokens` outright. If you read a tutorial that sets a token budget for thinking, it predates this; translate it to `thinking={"type": "adaptive"}` and an effort level.',
        },
      ],
    },
  ],

  patterns: [
    {
      id: 'budget-the-context',
      name: 'Treat the Context Window as a Quadratic Budget',
      oneLiner: 'Attention is O(n²) — long prompts cost more than proportionally.',
      useWhen: ['Any prompt that grows with data: retrieval, long histories, big files.'],
      recognize: ['A prompt that pastes a whole document "just in case".', 'Latency that grew faster than the input did.'],
      steps: [
        'Measure tokens per request and per stage, not just the total.',
        'Retrieve the relevant passages instead of pasting whole documents.',
        'Put the most important material at the start or the very end of the prompt.',
        'Cache the stable prefix so repeated context is not re-processed at full price.',
      ],
      complexity: 'Attention O(n²) in compute; cache memory linear in n.',
      gotchas: [
        'A bigger context window is a capacity, not an instruction to fill it.',
        'Material buried in the middle of a very long prompt is measurably less well used.',
      ],
      problems: ['Plot latency against prompt length', 'Move a key instruction from the middle to the end'],
    },
    {
      id: 'scratchpad-before-answer',
      name: 'Let It Think Before It Commits',
      oneLiner: 'Autoregression cannot revise — so put the reasoning inside the generation.',
      useWhen: ['Multi-step reasoning, maths, planning, tricky classification.'],
      recognize: ['Answers that are confidently wrong from the first sentence.', 'Accuracy that improves when you ask "explain first".'],
      steps: [
        'Enable adaptive thinking and set an effort level appropriate to the task.',
        'Where thinking is unavailable, ask for the reasoning in a field *before* the answer field.',
        'Never ask for the conclusion first and the justification after — that is post-hoc rationalisation of a guess.',
      ],
      template: {
        lang: 'python',
        caption: 'Order matters even in a plain JSON schema: reasoning first, verdict second',
        code: `
schema = {
    "type": "object",
    "properties": {
        "evidence":  {"type": "string"},   # generated FIRST — conditions what follows
        "reasoning": {"type": "string"},
        "verdict":   {"enum": ["approve", "reject", "escalate"]},
    },
    "required": ["evidence", "reasoning", "verdict"],
    "additionalProperties": False,
}
# Put "verdict" first and the model commits before reasoning, then justifies.`,
      },
      complexity: 'More output tokens, materially better accuracy on hard tasks.',
      gotchas: [
        'Thinking tokens are billed as output — measure before enabling it everywhere.',
        'On easy, high-volume work low effort is often both cheaper and no worse.',
      ],
      problems: ['Compare effort levels on a hard task', 'Reorder a schema and measure accuracy'],
    },
    {
      id: 'retrieval-not-finetune',
      name: 'Knowledge Goes in the Context, Behaviour Goes in the Weights',
      oneLiner: 'Fine-tune for form; retrieve for facts.',
      useWhen: ['Deciding how to make the model know or do something new.'],
      recognize: ['"Let’s fine-tune it on our documentation."', 'A fine-tuned model that is now out of date.'],
      steps: [
        'Name what is missing: knowledge, or behaviour?',
        'Knowledge → retrieval, with citations, updatable the moment the source changes.',
        'Behaviour → prompt and examples first; fine-tune only after prompting plateaus.',
      ],
      complexity: 'Retrieval: a search per request. Fine-tuning: a training run per update.',
      gotchas: [
        'Facts baked into weights cannot be cited, corrected or dated.',
        'Fine-tuning on a small, narrow set can make general behaviour worse.',
      ],
      problems: ['Argue both sides for a real feature', 'Cost out a fine-tune against a retrieval index'],
    },
  ],

  pitfalls: [
    { title: 'Believing bigger context is free', text: 'Attention is quadratic. Length costs compute, money and accuracy.' },
    { title: 'Expecting the model to revise itself mid-answer', text: 'It conditions on its own output. Give it a thinking phase instead.' },
    { title: 'Asking it to spell, reverse or count letters', text: 'It sees sub-word tokens, not characters. Delegate to code.' },
    { title: 'Reading parameter counts as capability', text: 'Mixture-of-experts models activate a fraction of their parameters per token.' },
    { title: 'Using `budget_tokens` for thinking', text: 'Rejected on current models. Use adaptive thinking plus an effort level.' },
    { title: 'Forgetting thinking display defaults to omitted', text: 'You get empty thinking blocks and a silent pause unless you ask for a summary.' },
    { title: 'Dropping thinking blocks from resent history', text: 'Pass them back unchanged when continuing on the same model.' },
    { title: 'Fine-tuning to teach facts', text: 'Undatable, uncitable, and stale the week after. Retrieve instead.' },
    { title: 'Burying the key instruction in the middle', text: 'Material at the edges of a long prompt is used more reliably.' },
  ],

  cheatsheet: [
    { label: 'Pipeline', value: 'tokenise → embed → ×N(attn + FFN) → logits → sample' },
    { label: 'Attention', value: 'query · key → weights → weighted values' },
    { label: 'Cost shape', value: 'O(n²) in sequence length' },
    { label: 'Causal mask', value: 'token i sees only ≤ i' },
    { label: 'Most parameters', value: 'feed-forward layers' },
    { label: 'Position', value: 'rotary — relative distance by rotation' },
    { label: 'Objective', value: 'next-token prediction, nothing else' },
    { label: 'Why it fabricates', value: 'plausibility is the objective, not truth' },
    { label: 'Base vs chat', value: 'completes text vs follows instructions' },
    { label: 'Stages', value: 'pre-train → SFT → preference → reasoning RL' },
    { label: 'Thinking', value: '`{"type": "adaptive"}` + effort level' },
    { label: 'Effort', value: 'low / medium / high / xhigh / max' },
    { label: 'Facts', value: 'retrieve' },
    { label: 'Style', value: 'prompt, then maybe fine-tune' },
  ],

  problems: [
    { name: 'Draw the attention weights for an ambiguous pronoun', difficulty: 'Easy', pattern: 'Attention', insight: 'Take "the trophy did not fit in the suitcase because it was too large/small". Write which noun "it" should attend to in each case. This is the Winograd schema, and it is why attention exists.' },
    { name: 'Measure the quadratic', difficulty: 'Easy', pattern: 'Cost shape', insight: 'Send the same question with 1k, 10k and 100k tokens of padding context and record latency and input cost. Latency should grow faster than linearly.' },
    { name: 'Find the training cutoff empirically', difficulty: 'Easy', pattern: 'Cutoff', insight: 'Ask about events at monthly intervals over the last two years and note where confidence collapses. Now supply the same facts in the prompt and watch the answers become correct.' },
    { name: 'Compare a completion prompt with an instruction prompt', difficulty: 'Medium', pattern: 'SFT', insight: 'Write a prompt that only makes sense as a completion ("Q: ... A:") and one as an instruction. A chat model handles both; the difference in style shows you what SFT installed.' },
    { name: 'Sweep effort on one hard task', difficulty: 'Medium', pattern: 'Effort', insight: 'Run the same multi-step problem at low, medium, high, xhigh and max. Record accuracy, output tokens and latency. Most teams over-pay here and never check.' },
    { name: 'Reorder a JSON schema and measure the damage', difficulty: 'Medium', pattern: 'Autoregression', insight: 'Put `verdict` before `reasoning`, then after. Score both on fifty cases. The ordering effect is real and surprises people.' },
    { name: 'Show error compounding', difficulty: 'Medium', pattern: 'Autoregression', insight: 'Seed a wrong premise in the prompt and ask a multi-step question. The model builds on it consistently rather than noticing. Then add "first check the premises" and repeat.' },
    { name: 'Break it with spelling tasks and then fix it', difficulty: 'Medium', pattern: 'Tokenisation', insight: 'Reverse a long word, count characters, find the third letter. Then let it write and execute code. The failure is the tokenizer, not the intelligence.' },
    { name: 'Test the lost-in-the-middle effect', difficulty: 'Hard', pattern: 'Position', insight: 'Hide one fact in a 100k-token prompt at 10%, 50% and 90% depth and ask for it. Repeat twenty times per position. Plot accuracy against depth before you design a retrieval layout.' },
    { name: 'Write the fine-tune versus retrieval decision for a real product', difficulty: 'Hard', pattern: 'Knowledge vs behaviour', insight: 'Split every requirement into knowledge or behaviour and cost each path, including the cost of updating when the source data changes. The update cost is what decides it.' },
  ],
}
