export default {
  id: 'ai-rag',
  title: 'RAG: The Baseline Pipeline',
  short: 'RAG',
  icon: 'TravelExploreRounded',
  tier: 'Core',
  order: 10,
  estHours: 5,
  prereqs: ['ai-chunking'],
  tagline: 'Search first, then answer from what you found — and cite it, or say you could not.',
  mentalModel:
    'RAG is an **open-book exam**. The model is a capable candidate who has not read your textbook. Retrieval is you putting the right two pages in front of them. Everything that goes wrong is one of two things: you handed them the wrong pages, or you did not insist they answer only from the pages given.',
  whyItMatters:
    'RAG is the default architecture for making a model useful on private, current or proprietary information. It is also the most commonly built and most commonly mis-debugged AI system — because the failure is visible in the generated answer while the cause is almost always upstream in retrieval.',

  reference: {
    title: 'The pipeline, and where each stage usually fails',
    head: ['Stage', 'What it does', 'Typical failure'],
    rows: [
      ['**Ingest**', 'Parse, chunk, embed, index', 'Garbage text, chunks meaningless alone'],
      ['**Query transform**', 'Rewrite, expand, resolve pronouns', 'Skipped entirely — follow-up questions break'],
      ['**Retrieve**', 'Vector and/or keyword search, filtered', 'Answer not in the top-k at all'],
      ['**Rerank**', 'Reorder by true relevance', 'Skipped — the best passage sits at rank 8'],
      ['**Assemble**', 'Build the prompt, best-first, delimited', 'No citations possible, no order, no count'],
      ['**Generate**', 'Answer from the context only', 'Answers from prior knowledge instead'],
      ['**Verify**', 'Check the citations are real', 'Skipped — fabrications ship'],
    ],
  },

  sections: [
    {
      id: 'why-rag',
      title: 'Why retrieval rather than a bigger prompt',
      blocks: [
        {
          t: 'p',
          text: 'A million-token window can hold a lot of a handbook. It is still the wrong design for most corpora, for four independent reasons.',
        },
        {
          t: 'ascii',
          caption: 'The comparison that decides the architecture.',
          code: `
  STUFF EVERYTHING IN THE PROMPT          RETRIEVE THE RELEVANT PART
  ──────────────────────────────          ──────────────────────────
  ✔ trivially simple                      ✔ scales past the window
  ✔ no retrieval bugs                     ✔ ~100× cheaper per request
  ✔ nothing is ever "missed"              ✔ faster: less to prefill
                                          ✔ citations come for free
  ✘ caps out at the window                ✘ can retrieve the wrong thing
  ✘ 500k tokens EVERY request             ✘ a real pipeline to maintain
  ✘ slow prefill, quadratic attention     ✘ needs measurement to trust
  ✘ the answer is lost in the middle

  Cost, concretely — 500k tokens of corpus, Opus 5 at $5/MTok in:
      stuffed:    500,000 × $5.00 / 1e6  =  $2.50 per question
      retrieved:    4,000 × $5.00 / 1e6  =  $0.02 per question
      → 125× cheaper, and the 4,000 tokens are the RELEVANT ones,
        which means the answer is usually better as well.

  When stuffing IS right:
      • the corpus is genuinely small (under ~50k tokens) and stable
      • it is identical for every user → cache it once, pay ~10%
      • the question needs the WHOLE document (summarise this contract)
      In that case cache the prefix and stop reading this chapter.`,
        },
        {
          t: 'key',
          title: 'Retrieval improves quality, not just cost',
          text: 'The instinct is that more context can only help. In practice four precise passages beat five hundred pages: attention is spread thin over a huge prompt, material in the middle is used least reliably, and irrelevant text actively distracts. Retrieval is a **relevance filter**, and that is why it often wins on accuracy even where the whole corpus would have fitted.',
        },
      ],
    },
    {
      id: 'baseline',
      title: 'The baseline pipeline, end to end',
      blocks: [
        {
          t: 'lead',
          text: 'Build exactly this first. It is about eighty lines, it works, and every advanced technique in the next chapter is a measured improvement on it rather than a replacement.',
        },
        {
          t: 'ascii',
          caption: 'Two phases. Nothing clever yet — on purpose.',
          code: `
  INGESTION (offline, once per document version)
  ┌────────┐  ┌───────┐  ┌────────────┐  ┌───────┐  ┌───────────────┐
  │ sources│─▶│ parse │─▶│ chunk +    │─▶│ embed │─▶│ index         │
  └────────┘  └───────┘  │ heading    │  └───────┘  │ vec+text+meta │
                          │ path       │             └───────────────┘
                          └────────────┘

  QUERY (online, per request)
  ┌──────────┐
  │ question │
  └────┬─────┘
       ▼
  ┌─────────────────┐   embed the question with the SAME model
  │ embed query     │
  └────┬────────────┘
       ▼
  ┌─────────────────┐   metadata filter FIRST (tenant, version, language)
  │ search top-k=8  │
  └────┬────────────┘
       ▼
  ┌─────────────────────────────────────────────────┐
  │ assemble prompt                                  │
  │   <documents count="8">                          │
  │     <doc id="1" source="..." page="18">...</doc> │  ← best first
  │   </documents>                                   │
  │   <question>...</question>                       │
  │   "answer only from these; cite [doc-N];         │
  │    if absent, say so"                            │  ← instruction LAST
  └────┬─────────────────────────────────────────────┘
       ▼
  ┌─────────────────┐   structured output: answer + citations + a
  │ generate        │   "answer_found" boolean
  └────┬────────────┘
       ▼
  ┌─────────────────┐   are the cited ids real? is the quote a substring?
  │ verify          │
  └────┬────────────┘
       ▼
    answer + verifiable sources`,
        },
        {
          t: 'code',
          lang: 'python',
          caption: 'The whole query path. Note that the instruction comes after the documents.',
          code: `
ANSWER_SCHEMA = {
    "type": "object",
    "properties": {
        # Evidence first: generation order is causal order.
        "supporting_quotes": {
            "type": "array",
            "items": {"type": "object", "properties": {
                "doc_id": {"type": "integer"},
                "quote":  {"type": "string"},
            }, "required": ["doc_id", "quote"], "additionalProperties": False},
        },
        "answer_found": {"type": "boolean"},
        "answer": {"type": "string", "maxLength": 1500},
    },
    "required": ["supporting_quotes", "answer_found", "answer"],
    "additionalProperties": False,
}

SYSTEM = """You answer questions from a company knowledge base.

Rules:
- Use ONLY the provided documents. Your own knowledge is not a source.
- Every factual claim must be supported by a quote from a document.
- If the documents do not contain the answer, set answer_found to false
  and say which information is missing. Do not guess, and do not fill
  gaps from general knowledge.
- Quote exactly, character for character. Never paraphrase a quote."""


def answer(question: str, session) -> dict:
    hits = store.search(
        embed(f"search_query: {question}"), k=8,
        where={"tenant_id": session.tenant_id, "doc_version": "current"},
    )

    docs = "\\n\\n".join(
        f'<doc id="{i}" source="{h["meta"]["title"]}" '
        f'page="{h["meta"].get("page", "-")}">\\n{h["text"]}\\n</doc>'
        for i, h in enumerate(hits, start=1)
    )

    response = client.messages.create(
        model="claude-opus-5", max_tokens=4000,
        system=[{"type": "text", "text": SYSTEM,
                 "cache_control": {"type": "ephemeral"}}],
        messages=[{"role": "user", "content":
            f'<documents count="{len(hits)}">\\n{docs}\\n</documents>\\n\\n'
            f"<question>\\n{question}\\n</question>\\n\\n"
            "Some documents may be irrelevant; ignore those. Answer only "
            "from the documents above and quote what supports each claim."}],
        output_config={"format": {"type": "json_schema",
                                  "schema": ANSWER_SCHEMA}},
    )

    data = json.loads(next(b.text for b in response.content if b.type == "text"))
    return verify(data, hits)`,
        },
        {
          t: 'code',
          lang: 'python',
          caption: 'Verification — the step that turns "trust me" into "check it"',
          code: `
def verify(data: dict, hits: list[dict]) -> dict:
    """Every quote must exist in the document it claims to come from."""
    valid, problems = [], []

    for q in data["supporting_quotes"]:
        idx = q["doc_id"] - 1
        if not 0 <= idx < len(hits):
            problems.append(f"cited doc {q['doc_id']} which was not provided")
            continue

        source = normalise(hits[idx]["text"])
        if normalise(q["quote"]) in source:
            valid.append({**q, "source": hits[idx]["meta"]})
        else:
            problems.append(f"quote not found in doc {q['doc_id']}: "
                            f"{q['quote'][:60]}...")

    return {
        "answer": data["answer"],
        "found": data["answer_found"],
        "citations": valid,
        # An answer with no verified quote is unsupported. Surface it, do
        # not hide it — this is your fabrication rate, measured directly.
        "trustworthy": data["answer_found"] and bool(valid) and not problems,
        "problems": problems,
    }

def normalise(s: str) -> str:
    return " ".join(s.lower().split())      # whitespace and case tolerant`,
        },
        {
          t: 'key',
          title: 'The quote-substring check is the best value in RAG',
          text: 'It costs a few output tokens and ten lines of code, and it converts hallucination from an anecdote into a **metric**. Once you can count unverifiable claims per hundred answers, you can tell whether a change helped. Almost no other guardrail in this track gives you that for so little.',
        },
      ],
    },
    {
      id: 'query-transform',
      title: 'Transform the query before you search it',
      blocks: [
        {
          t: 'p',
          text: 'The user’s words are frequently the worst possible search string. This is the cheapest stage to improve and the one most often missing entirely.',
        },
        {
          t: 'ascii',
          caption: 'Four things that break a raw-query search, and what to do about each.',
          code: `
  1. FOLLOW-UP PRONOUNS                         ← the big one in chat
     user: "what is the notice period?"
     user: "and for contractors?"
     embedding of "and for contractors?" retrieves NOTHING useful.
     FIX: rewrite against the history →
          "what is the notice period for contractors?"

  2. CONVERSATIONAL PADDING
     "Hi! I was wondering, could you possibly tell me whether we're
      allowed to expense a taxi home if we work late? Thanks!"
     FIX: extract the search intent →  "expense taxi home working late"

  3. MULTIPLE QUESTIONS IN ONE
     "what's the notice period and who approves a refund over 10k?"
     One vector cannot point at two unrelated sections.
     FIX: split into two searches, merge the results.

  4. VOCABULARY MISMATCH
     user says "time off"; the handbook says "annual leave"
     FIX: expand with synonyms, or hybrid search, or HyDE (next chapter)`,
        },
        {
          t: 'code',
          lang: 'python',
          caption: 'A rewrite step is one cheap call, and it fixes the entire class of follow-up failures',
          code: `
REWRITE = """Rewrite the user's latest message as a standalone search query.

- Resolve every pronoun and reference using the conversation.
- Remove greetings, politeness and meta-commentary.
- Keep domain vocabulary exactly as written; do not paraphrase terms.
- If the message contains several unrelated questions, output one query
  per line.
- If it is not a question at all (a greeting, thanks), output NONE.

Conversation:
{history}

Latest message: {message}

Queries:"""

def rewrite(history: list, message: str) -> list[str]:
    response = client.messages.create(
        model="claude-haiku-4-5", max_tokens=200,      # cheap and fast
        messages=[{"role": "user", "content": REWRITE.format(
            history=render(history[-6:]), message=message)}],
    )
    text = "".join(b.text for b in response.content if b.type == "text")
    if text.strip() == "NONE":
        return []
    return [q.strip() for q in text.strip().splitlines() if q.strip()]`,
        },
        {
          t: 'tip',
          title: 'Use a cheap, fast model for query transformation',
          text: 'Rewriting a query is an easy task with a short output, so Haiku does it in a fraction of the time and cost of the answering model. The same applies to classifying whether retrieval is needed at all — "hello" and "thanks" should never trigger a search. Reserve the expensive model for the answer.',
        },
        {
          t: 'warn',
          title: 'Do not retrieve for every message',
          text: 'A greeting, a thank-you, a follow-up like "shorter please" or a question about the previous answer need no search. Retrieving anyway injects eight irrelevant passages, wastes tokens, and actively degrades the reply by burying the real conversation under noise. A one-line classifier in front of retrieval pays for itself immediately.',
        },
      ],
    },
    {
      id: 'diagnosing',
      title: 'Diagnosing a bad answer',
      blocks: [
        {
          t: 'lead',
          text: 'This is the section to come back to. A RAG system produces a bad answer and the instinct is to edit the prompt. Nine times out of ten the prompt is innocent.',
        },
        {
          t: 'ascii',
          caption: 'Work top to bottom. Stop at the first stage that fails — everything below it is downstream noise.',
          code: `
  BAD ANSWER
        │
        ▼
  1. Is the answer present in the CORPUS at all?
        │  no → not a RAG bug. The content does not exist. Add it,
        │        and make sure the system says "not covered" instead
        │        of inventing something.
        ▼ yes
  2. Is it in the retrieved top-k?          ← print the chunks. Always.
        │  no → RETRIEVAL bug. Go to 2a.
        ▼ yes
  3. Is the chunk self-contained and readable?
        │  no → CHUNKING bug. Heading paths, small-to-big, re-extract.
        ▼ yes
  4. Did the model use it?
        │  no → PROMPT bug, or it was at rank 8 of 10 and ignored.
        │        Rerank; say how many docs there are; put the
        │        instruction after the documents.
        ▼ yes
  5. Is the answer actually wrong, or just not what you expected?
             → often the corpus is ambiguous or contradicts itself.
               That is a content problem, and worth reporting as one.

  2a. RETRIEVAL DIAGNOSIS
      • query as embedded — did the rewrite mangle it?
      • metadata filter — did it exclude the right document?
      • exact identifiers or negation in the query? → needs hybrid
      • was the right chunk at rank 11 of top-10? → raise k, then rerank
      • is the chunk in the index at all? → ingestion or deletion bug`,
        },
        {
          t: 'code',
          lang: 'python',
          caption: 'Log the retrieval, or you are debugging blind',
          code: `
def answer_traced(question: str, session) -> dict:
    queries = rewrite(session.history, question)
    hits = retrieve(queries, session)
    result = generate(question, hits)

    log.info(
        "rag q=%r rewritten=%r k=%d top_scores=%s ids=%s "
        "found=%s cited=%s trustworthy=%s",
        question, queries, len(hits),
        [round(h["score"], 3) for h in hits[:3]],
        [h["id"] for h in hits],
        result["found"], [c["doc_id"] for c in result["citations"]],
        result["trustworthy"],
    )
    return result

# Three questions this log answers instantly, and nothing else does:
#   did the rewrite change the meaning?
#   was the right chunk retrieved at all?
#   did the model cite the chunk that was actually relevant?`,
        },
        {
          t: 'table',
          caption: 'Symptom to cause. Print the retrieved chunks before forming any theory.',
          head: ['Symptom', 'Most likely cause', 'First thing to try'],
          rows: [
            ['"I don’t have that information" but it exists', 'Retrieval missed it', 'Print the top-k; raise k; check the filter'],
            ['Confidently wrong fact', 'Answered from prior knowledge', 'Require quotes; verify them; strengthen the only-from-documents rule'],
            ['Right topic, wrong version or year', 'No metadata filter', 'Filter on version, then re-measure'],
            ['Fails on follow-up questions', 'No query rewriting', 'Add the rewrite step'],
            ['Cannot find `INC-4471`', 'Vector search cannot do exact match', 'Hybrid search — next chapter'],
            ['Retrieves the opposite of a negated query', 'Embeddings ignore negation', 'Reranking — next chapter'],
            ['The answer is in the context but unused', 'Buried at rank 8, or instruction placement', 'Rerank; state the count; instruction last'],
            ['Answer is a fragment', 'Chunks too small', 'Small-to-big'],
            ['Cites a document that does not exist', 'No verification step', 'Add the substring check'],
          ],
        },
        {
          t: 'key',
          title: 'Print the retrieved chunks before you form a theory',
          text: 'Every RAG debugging session should begin by looking at exactly what was retrieved, in order, with scores. Most "the model is hallucinating" reports dissolve within thirty seconds of doing this — the context simply did not contain the answer. Build that view into your development loop on day one.',
        },
      ],
    },
    {
      id: 'evaluating',
      title: 'Evaluating the two halves separately',
      blocks: [
        {
          t: 'p',
          text: 'RAG has two components that fail independently, so one end-to-end score tells you nothing actionable. Measure retrieval and generation apart, and the next thing to fix is always obvious.',
        },
        {
          t: 'table',
          caption: 'Five metrics. The first two are the ones that decide where to spend your week.',
          head: ['Metric', 'Question it answers', 'How'],
          rows: [
            ['**Recall@k**', 'Is the answer in the context at all?', 'Gold chunk ids per query — the system ceiling'],
            ['**MRR**', 'Is it near the top where it will be used?', 'Reciprocal rank of the first gold chunk'],
            ['**Faithfulness**', 'Is every claim supported by the context?', 'The quote-substring check, automatically'],
            ['**Answer correctness**', 'Is the answer right?', 'A gold answer plus an LLM judge, or a human'],
            ['**Abstention accuracy**', 'Does it say "not covered" when it should?', 'Include unanswerable questions in the set — most people forget'],
          ],
        },
        {
          t: 'code',
          lang: 'python',
          caption: 'The eval set that makes RAG improvements measurable',
          code: `
EVAL = [
    # answerable, with the gold chunks labelled
    {"q": "what is the notice period after 3 years",
     "gold_chunks": {"hr-2026#4.3#0"},
     "must_contain": ["eight weeks"]},

    # unanswerable ON PURPOSE — this is the half everyone omits, and it
    # is where fabrication actually shows up
    {"q": "what is the policy on pet insurance",
     "gold_chunks": set(),
     "expect_abstain": True},

    # a near-miss: the corpus discusses something similar but not this
    {"q": "notice period for contractors",
     "gold_chunks": set(),
     "expect_abstain": True},
]

def evaluate() -> dict:
    recall = faith = abstain_ok = correct = 0
    answerable = [c for c in EVAL if not c.get("expect_abstain")]

    for case in EVAL:
        hits = retrieve([case["q"]], SESSION)
        result = generate(case["q"], hits)

        if case["gold_chunks"]:
            if {h["id"] for h in hits} & case["gold_chunks"]:
                recall += 1
            if all(s in result["answer"].lower()
                   for s in case.get("must_contain", [])):
                correct += 1
        else:
            # Correct behaviour is refusing. A confident answer here is a
            # fabrication, and it is the failure that damages trust most.
            abstain_ok += (not result["found"])

        faith += result["trustworthy"] or not result["found"]

    n_unans = len(EVAL) - len(answerable)
    return {"recall": recall / max(len(answerable), 1),
            "correct": correct / max(len(answerable), 1),
            "faithful": faith / len(EVAL),
            "abstention": abstain_ok / max(n_unans, 1)}`,
        },
        {
          t: 'warn',
          title: 'An eval set without unanswerable questions is dangerously misleading',
          text: 'If every question in your set has an answer in the corpus, a system that never abstains scores perfectly — and then fabricates in production the first time a user asks something outside the corpus. Roughly a third of your eval cases should be unanswerable or near-misses. That fraction is what measures honesty, and honesty is what users actually notice.',
        },
        {
          t: 'note',
          title: 'Recall@k is the ceiling on every other number',
          text: 'If recall@8 is 0.65, then 35% of questions cannot be answered no matter what you do to the prompt, the model or the reranker. Compute recall first, every time. It tells you whether this week belongs to retrieval or to generation, and it is a five-minute calculation.',
        },
      ],
    },
  ],

  patterns: [
    {
      id: 'rag-baseline',
      name: 'Build the Boring Baseline First',
      oneLiner: 'Chunk, embed, filter, retrieve, cite, verify. Measure. Then improve.',
      useWhen: ['Every new RAG system.'],
      recognize: ['A first version with reranking, HyDE, multi-hop and a graph, and no eval.', 'Nobody can say what recall@k is.'],
      steps: [
        'Recursive chunking with heading paths, one embedding model, metadata filters.',
        'Top-k around 8, documents delimited and numbered, instruction after them.',
        'Structured output with quotes and an `answer_found` flag.',
        'Verify every quote is a substring.',
        'Build the eval set, including unanswerable questions, and record the baseline.',
      ],
      complexity: 'About eighty lines. A day, including the eval.',
      gotchas: [
        'Adding four techniques at once means you cannot attribute the change to any of them.',
        'Without a baseline number, every later "improvement" is a belief.',
      ],
      problems: ['Build the baseline', 'Record recall, faithfulness and abstention'],
    },
    {
      id: 'cite-and-verify',
      name: 'Require Quotes, Then Verify Them',
      oneLiner: 'Turn fabrication from an anecdote into a number.',
      useWhen: ['Every factual RAG system.'],
      recognize: ['Answers with no traceable source.', 'No way to count hallucinations.'],
      steps: [
        'Add a `supporting_quotes` array as the first field of the schema.',
        'Require exact quotation, character for character.',
        'Check each quote is a substring of the document it cites, whitespace-normalised.',
        'Mark answers with no verified quote as untrustworthy and surface that.',
        'Track the unverified rate as a release metric.',
      ],
      template: {
        lang: 'python',
        caption: 'Show verified sources in the UI; flag anything unverified rather than hiding it',
        code: `
if not result["trustworthy"]:
    # Do not silently show an unsupported answer as if it were sourced.
    return {"answer": result["answer"],
            "warning": "This answer could not be traced to a source document.",
            "citations": result["citations"]}`,
      },
      complexity: 'A few output tokens, ten lines of checking.',
      gotchas: [
        'Normalise whitespace and case before comparing, or valid quotes fail.',
        'Models paraphrase unless you insist on character-for-character quotation.',
      ],
      problems: ['Add verification', 'Measure your real fabrication rate'],
    },
    {
      id: 'rewrite-the-query',
      name: 'Rewrite the Query Before Searching',
      oneLiner: 'Resolve pronouns, strip padding, split compound questions.',
      useWhen: ['Any conversational interface. Non-negotiable in chat.'],
      recognize: ['Follow-up questions retrieve nothing.', '"and for contractors?" returns random passages.'],
      steps: [
        'One cheap-model call rewriting the latest message against the history.',
        'Return NONE for greetings so retrieval is skipped.',
        'Emit one query per line for compound questions and merge the results.',
        'Log both the original and the rewrite so you can spot mangling.',
      ],
      complexity: 'One Haiku call, tens of milliseconds.',
      gotchas: [
        'An over-eager rewrite can change the meaning — log both and check.',
        'Preserve domain vocabulary exactly; paraphrasing a term breaks lexical matching.',
      ],
      problems: ['Break a follow-up, then fix it with rewriting', 'Add a no-retrieval classifier'],
    },
    {
      id: 'print-the-context',
      name: 'Print the Retrieved Chunks First',
      oneLiner: 'Most hallucination reports are retrieval misses in disguise.',
      useWhen: ['Every RAG bug report, before any other action.'],
      recognize: ['Prompt edits made without ever seeing the retrieved text.', 'No retrieval logging.'],
      steps: [
        'Log query, rewritten query, chunk ids, scores and which were cited.',
        'Build a developer view that shows the retrieved chunks next to the answer.',
        'Only after confirming the answer was retrievable, look at the prompt.',
      ],
      complexity: 'One structured log line and a small debug page.',
      gotchas: ['Without scores you cannot tell a near-miss from an absence.'],
      problems: ['Add retrieval tracing', 'Re-diagnose five old bug reports'],
    },
    {
      id: 'unanswerable-in-eval',
      name: 'Put Unanswerable Questions in the Eval Set',
      oneLiner: 'A system that never abstains scores perfectly on an answerable-only set.',
      useWhen: ['Every RAG eval.'],
      recognize: ['100% on the eval, fabrications in production.', 'No abstention metric.'],
      steps: [
        'Make roughly a third of the cases unanswerable or near-misses.',
        'Score abstention accuracy separately from correctness.',
        'Treat a confident answer to an unanswerable question as a hard failure.',
      ],
      complexity: 'Free — it is a change to the test set, not the system.',
      gotchas: [
        'Near-misses are the valuable ones: the corpus mentions something adjacent but not the answer.',
        'Over-correcting gives you a system that abstains on answerable questions; track both directions.',
      ],
      problems: ['Add unanswerable cases', 'Measure abstention in both directions'],
    },
  ],

  pitfalls: [
    { title: 'Stuffing the whole corpus when it fits', text: 'Slower, ~100× dearer, and often less accurate than four good passages.' },
    { title: 'Retrieving for every message', text: 'Greetings and "shorter please" get eight irrelevant passages and a worse reply.' },
    { title: 'No query rewriting in a chat interface', text: 'Every follow-up question retrieves noise.' },
    { title: 'No metadata filter', text: 'The 2023 handbook answers a 2026 question, confidently.' },
    { title: 'Documents not delimited or numbered', text: 'Citation becomes impossible and injection becomes easy.' },
    { title: 'Instruction before the documents', text: 'Put it after, where it is read last and followed best.' },
    { title: 'Not telling the model how many documents there are', text: 'It tries to use all of them, including the irrelevant ones.' },
    { title: 'No abstention path', text: 'Given no answer, it will construct one that reads perfectly.' },
    { title: 'No quote verification', text: 'Fabrications ship, and you cannot count them.' },
    { title: 'Debugging the prompt before printing the chunks', text: 'Nine times out of ten the context did not contain the answer.' },
    { title: 'An eval with no unanswerable questions', text: 'Rewards confident fabrication with a perfect score.' },
    { title: 'One end-to-end score', text: 'Tells you something is wrong but never which half.' },
  ],

  cheatsheet: [
    { label: 'RAG is', value: 'an open-book exam — supply the right pages' },
    { label: 'Stuff instead when', value: 'corpus < ~50k tokens, shared, cacheable' },
    { label: 'Pipeline', value: 'rewrite → filter → retrieve → rerank → assemble → generate → verify' },
    { label: 'Start k at', value: '8, then measure' },
    { label: 'Filter first', value: 'tenant, version, language' },
    { label: 'Documents', value: 'delimited, numbered, best first, count stated' },
    { label: 'Instruction', value: 'after the documents' },
    { label: 'Schema', value: 'quotes → `answer_found` → answer' },
    { label: 'Verify', value: 'quote is a substring, normalised' },
    { label: 'Rewrite with', value: 'Haiku — cheap and fast' },
    { label: 'Skip retrieval for', value: 'greetings, meta-requests' },
    { label: 'Debug step one', value: 'print the retrieved chunks' },
    { label: 'Ceiling metric', value: 'recall@k' },
    { label: 'Honesty metric', value: 'abstention accuracy' },
    { label: 'Eval set', value: '⅓ unanswerable or near-miss' },
  ],

  problems: [
    { name: 'Build the eighty-line baseline', difficulty: 'Easy', pattern: 'Baseline', insight: 'Chunk, embed, retrieve, prompt, cite. Get it working end to end before adding anything, and record the numbers.' },
    { name: 'Compare stuffing against retrieval', difficulty: 'Easy', pattern: 'Architecture', insight: 'Same twenty questions, whole corpus in the prompt versus top-8 retrieved. Record cost, latency and correctness. Retrieval usually wins on all three.' },
    { name: 'Break it with a follow-up question', difficulty: 'Easy', pattern: 'Query rewriting', insight: 'Ask "and for contractors?" as a second turn. The retrieval is garbage. Add rewriting and it works — the single clearest before/after in RAG.' },
    { name: 'Force a confident fabrication', difficulty: 'Medium', pattern: 'Abstention', insight: 'Ask about something the corpus does not cover. Without an abstention path you get a plausible invented policy. Add the path and the quote check, and measure the rate.' },
    { name: 'Add quote verification and count failures', difficulty: 'Medium', pattern: 'Faithfulness', insight: 'Run a hundred real questions and count answers with no verified quote. That number is your fabrication rate — probably the first time anyone has measured it.' },
    { name: 'Make the wrong version win', difficulty: 'Medium', pattern: 'Filtering', insight: 'Index two years of a handbook, ask a version-specific question with no filter, and watch the old policy get cited. Then add the filter.' },
    { name: 'Add retrieval tracing and re-diagnose old bugs', difficulty: 'Medium', pattern: 'Observability', insight: 'Take five previously-blamed-on-the-model failures and re-diagnose them with the chunks printed. Most will turn out to be retrieval.' },
    { name: 'Build the eval set with unanswerable cases', difficulty: 'Hard', pattern: 'Evaluation', insight: 'Twenty answerable with gold chunks, ten unanswerable, ten near-misses. Report recall, correctness, faithfulness and abstention as four separate numbers.' },
    { name: 'Sweep k against correctness and cost', difficulty: 'Hard', pattern: 'Tuning k', insight: 'k = 3, 5, 8, 15, 30. Correctness rises then plateaus while cost climbs linearly and the answer sometimes gets worse from noise. Find your own knee.' },
    { name: 'Walk the diagnosis tree on a real failure', difficulty: 'Hard', pattern: 'Diagnosis', insight: 'Take a genuine bad answer and work down: in the corpus? in top-k? self-contained? used? Write down which stage failed. Do this five times and the tree becomes instinct.' },
  ],
}
