export default {
  id: 'ai-rag-advanced',
  title: 'Advanced RAG: Hybrid Search, Reranking & Multi-Hop',
  short: 'Advanced RAG',
  icon: 'ManageSearchRounded',
  tier: 'Core',
  order: 11,
  estHours: 6,
  prereqs: ['ai-rag'],
  tagline: 'Two retrievers, one reranker, and a loop for questions that need more than one search.',
  mentalModel:
    'The baseline has one retriever doing one search and trusting its own ranking. Advanced RAG fixes that in three moves: **cast a wider net** (two complementary retrievers), **sort it properly** (a reranker that actually reads the passage against the question), and **search more than once** where one search cannot possibly suffice.',
  whyItMatters:
    'The gap between a RAG demo and a RAG product is almost entirely this chapter. Hybrid search and reranking together typically move recall and precision more than any model upgrade, and they are the two techniques most often missing from systems people are unhappy with.',

  reference: {
    title: 'The techniques, ranked by payoff for the effort',
    head: ['Technique', 'Fixes', 'Cost', 'Worth it?'],
    rows: [
      ['**Reranking**', 'The right passage sitting at rank 8', 'One rerank call, ~50ms', '**Almost always.** Do this first'],
      ['**Hybrid search**', 'Identifiers, rare names, negation', 'A second index', '**Almost always**'],
      ['**Metadata filters**', 'Wrong version, wrong tenant', 'Nothing', '**Always** — covered earlier'],
      ['Query expansion', 'Vocabulary mismatch', 'One cheap call', 'Often'],
      ['HyDE', 'Short question versus long answer', 'One generation', 'Sometimes — measure it'],
      ['Multi-hop / iterative', 'Questions needing two lookups', 'N searches + N calls', 'Only when the question shape demands it'],
      ['Sentence-window', 'Match precisely, answer completely', 'Storage', 'Often — same idea as small-to-big'],
      ['Graph RAG', '"How does X relate to Y across documents"', 'A whole extraction pipeline', 'Rarely. Try everything else first'],
    ],
  },

  sections: [
    {
      id: 'hybrid',
      title: 'Hybrid search: two retrievers that fail differently',
      blocks: [
        {
          t: 'p',
          text: 'Lexical search (BM25) matches words. Vector search matches meaning. Their failure modes are almost perfectly complementary, which is why running both and merging beats either one.',
        },
        {
          t: 'ascii',
          caption: 'Same five queries, two retrievers. Neither is adequate alone.',
          code: `
  QUERY                              BM25      VECTOR     WHY
  ────────────────────────────────────────────────────────────────────────
  "INC-4471 root cause"               ✔✔✔       ✘        exact token
  "error code E_TIMEOUT_9"            ✔✔✔       ✘        rare identifier
  "widget Zephyr rollout plan"        ✔✔✔       ✘        internal codename
  "I forgot my login details"          ✘       ✔✔✔       zero shared words
                                                          with "reset password"
  "time off policy"                    ✘       ✔✔✔       corpus says
                                                          "annual leave"
  "deploys that do NOT need approval"  ~        ✘        BM25 at least keeps
                                                          "approval"; the
                                                          vector retrieves
                                                          the opposite

  BM25 in one sentence: score a document by how many query terms it
  contains, weighted by how RARE each term is in the corpus (so "the"
  counts for nothing and "E_TIMEOUT_9" counts for a great deal), and
  damped by document length so long documents cannot win by padding.

  That rare-term weighting is exactly what embeddings cannot do, and it
  is why every serious retrieval stack keeps a lexical index.`,
        },
        {
          t: 'code',
          lang: 'python',
          caption: 'Reciprocal Rank Fusion — merges ranked lists without needing comparable scores',
          code: `
def rrf(ranked_lists: list[list[str]], k: int = 60) -> list[tuple[str, float]]:
    """Reciprocal Rank Fusion.

    Uses only RANK, never score — which is the point. BM25 scores are
    unbounded and cosine scores sit in [-1, 1]; they cannot be added or
    averaged meaningfully. Ranks always can.
    """
    scores: dict[str, float] = {}
    for ranked in ranked_lists:
        for rank, doc_id in enumerate(ranked, start=1):
            scores[doc_id] = scores.get(doc_id, 0.0) + 1.0 / (k + rank)
    return sorted(scores.items(), key=lambda kv: -kv[1])


def hybrid_search(query: str, session, k: int = 40) -> list[dict]:
    # Over-fetch from both: this list feeds a reranker, so recall now
    # matters far more than precision.
    filters = {"tenant_id": session.tenant_id, "doc_version": "current"}

    dense  = vector_store.search(embed(f"search_query: {query}"),
                                 k=k, where=filters)
    sparse = bm25_index.search(query, k=k, where=filters)

    fused = rrf([[h["id"] for h in dense], [h["id"] for h in sparse]])
    by_id = {h["id"]: h for h in dense + sparse}
    return [by_id[doc_id] for doc_id, _ in fused]`,
        },
        {
          t: 'key',
          title: 'Fuse on rank, never on raw score',
          text: 'BM25 scores are unbounded and corpus-dependent; cosine scores live in a narrow band. Normalising and weighting them (`0.7 × dense + 0.3 × sparse`) requires tuning two constants that drift with your corpus. RRF needs no tuning, no normalisation, and is remarkably hard to beat. Start there and only reach for weighted fusion if a measurement demands it.',
        },
        {
          t: 'note',
          title: 'You may already have both indexes',
          text: 'Postgres gives you `pgvector` alongside full-text search in the same database and the same transaction. Elasticsearch and OpenSearch have BM25 and a vector field, queryable together. If you are already running either, hybrid search is a query change rather than a new piece of infrastructure — which makes skipping it hard to justify.',
        },
      ],
    },
    {
      id: 'reranking',
      title: 'Reranking: the single biggest win',
      blocks: [
        {
          t: 'lead',
          text: 'If you do one thing from this chapter, do this. Retrieval is optimised for speed over millions of documents; reranking is optimised for accuracy over forty. Using both is the standard architecture, and the gain is usually immediate.',
        },
        {
          t: 'ascii',
          caption: 'Bi-encoder versus cross-encoder — why one is fast and the other is accurate.',
          code: `
  BI-ENCODER (your embedding model) — how retrieval works
      query    ──▶ [encoder] ──▶ vec_q  ┐
                                         ├──▶ cosine
      document ──▶ [encoder] ──▶ vec_d  ┘

      The document vector is computed at INGESTION, before any query
      exists. So the encoder never sees the two together, and must
      compress the passage into one vector that is good for every
      possible future question. Fast: millions of comparisons. Blunt.

  CROSS-ENCODER (the reranker)
      [query + document] ──▶ [encoder] ──▶ relevance score 0..1

      Reads them TOGETHER, with full attention across both. It can see
      that the passage says "approval is NOT required", that the version
      number does not match, that it answers a neighbouring question.
      Far more accurate. Far too slow to run over a corpus — which is
      exactly why it goes second.

  THE ARCHITECTURE
  ┌──────────────┐  ┌──────────────┐  ┌────────────┐  ┌──────────────┐
  │ 2M chunks    │─▶│ hybrid       │─▶│  rerank    │─▶│ top 5        │
  │              │  │ retrieve 40  │  │  40 pairs  │  │ → the prompt │
  └──────────────┘  └──────────────┘  └────────────┘  └──────────────┘
      ANN, ~10ms       recall-oriented    ~50ms          precision

  Recall is the retriever's job. Precision is the reranker's job.
  Optimising a single stage for both is what makes baseline RAG mediocre.`,
        },
        {
          t: 'code',
          lang: 'python',
          caption: 'Reranking with the model you already have — no extra service needed',
          code: `
RERANK_SCHEMA = {
    "type": "object",
    "properties": {
        "rankings": {
            "type": "array",
            "items": {"type": "object", "properties": {
                "doc_id": {"type": "integer"},
                "answers_the_question": {"type": "boolean"},
                "score": {"type": "integer", "minimum": 0, "maximum": 10},
            }, "required": ["doc_id", "answers_the_question", "score"],
               "additionalProperties": False},
        },
    },
    "required": ["rankings"],
    "additionalProperties": False,
}

RERANK = """Score each passage on how well it answers the question.

10 = contains the complete answer
7  = contains part of the answer
4  = same topic, does not answer the question
0  = irrelevant, or answers a DIFFERENT question that merely looks similar

Be strict. Most passages in a retrieval result are 4 or below, and
saying so is the useful part of this task. Pay attention to negation,
version numbers and dates: a passage about the 2023 policy scores 0 for
a question about 2026."""

def rerank(question: str, hits: list[dict], keep: int = 5) -> list[dict]:
    passages = "\\n\\n".join(
        f'<p id="{i}">{h["text"][:1200]}</p>' for i, h in enumerate(hits))

    response = client.messages.create(
        model="claude-haiku-4-5", max_tokens=3000,     # cheap and adequate
        system=[{"type": "text", "text": RERANK,
                 "cache_control": {"type": "ephemeral"}}],
        messages=[{"role": "user", "content":
                   f"<passages>\\n{passages}\\n</passages>\\n\\n"
                   f"<question>{question}</question>"}],
        output_config={"format": {"type": "json_schema",
                                  "schema": RERANK_SCHEMA}},
    )
    data = json.loads(next(b.text for b in response.content if b.type == "text"))

    ranked = sorted(data["rankings"], key=lambda r: -r["score"])
    # A real relevance CUT, which raw cosine scores can never give you:
    # if nothing scores 7+, the corpus probably does not contain the answer.
    return [hits[r["doc_id"]] for r in ranked
            if r["score"] >= 5 and r["answers_the_question"]][:keep]`,
        },
        {
          t: 'key',
          title: 'Reranking gives you a meaningful "no results" signal',
          text: 'Cosine similarity always returns a top-5, however irrelevant, because it can only rank. A reranker that assigns everything a 3 is telling you the answer is not in the corpus — which lets you abstain honestly instead of answering from the least-bad passage. That signal alone justifies the stage.',
        },
        {
          t: 'table',
          caption: 'Three ways to rerank. Start with the cheap model and measure before buying anything.',
          head: ['Approach', 'Latency', 'Notes'],
          rows: [
            ['A cheap model with a scoring prompt', '~50–200ms for 40', 'No new infrastructure; gives you the abstention signal; good enough for most systems'],
            ['A hosted reranker API', '~30–80ms', 'Purpose-built cross-encoder, usually the best quality per millisecond'],
            ['A local cross-encoder model', '~20–100ms on GPU', 'No per-call cost, but a model to host and monitor'],
          ],
        },
        {
          t: 'warn',
          title: 'Two ways to ruin a reranker',
          text: 'First, reranking a top-5 achieves nothing — you must over-fetch to 30 or 50 first, because the reranker can only reorder what the retriever handed it. Second, truncate each passage before scoring (around 1,200 characters is plenty): forty full chunks is a large prompt, and the cost of the rerank call can quietly exceed the answer call.',
        },
      ],
    },
    {
      id: 'query-techniques',
      title: 'Query-side techniques',
      blocks: [
        {
          t: 'p',
          text: 'Three ways to attack the query itself. Each costs one cheap call and fixes a specific failure — so add them in response to a measured problem, not as a matter of course.',
        },
        {
          t: 'h',
          text: 'Multi-query expansion',
        },
        {
          t: 'code',
          lang: 'python',
          caption: 'One question, several phrasings, fused results',
          code: `
EXPAND = """Write 3 alternative search queries for this question.
Use different vocabulary — synonyms and the formal terms a policy
document would use. Keep any identifiers and numbers exactly as given.
One per line, no numbering."""

def multi_query(question: str, session) -> list[dict]:
    response = client.messages.create(
        model="claude-haiku-4-5", max_tokens=200,
        messages=[{"role": "user", "content": f"{EXPAND}\\n\\n{question}"}],
    )
    variants = [question] + [
        q.strip() for q in
        "".join(b.text for b in response.content if b.type == "text")
        .strip().splitlines() if q.strip()
    ]

    # Fuse the ranked lists from all four searches. A chunk that appears
    # near the top for several phrasings is very likely the right one.
    lists = [[h["id"] for h in hybrid_search(v, session, k=20)]
             for v in variants]
    fused = rrf(lists)
    by_id = {h["id"]: h for v in variants
             for h in hybrid_search(v, session, k=20)}
    return [by_id[i] for i, _ in fused[:40]]`,
        },
        {
          t: 'h',
          text: 'HyDE — search with a hypothetical answer',
        },
        {
          t: 'ascii',
          caption: 'A question and its answer are different kinds of text. HyDE closes that gap.',
          code: `
  THE ASYMMETRY PROBLEM
      query:    "how long is the notice period?"          8 tokens, a question
      document: "Employees must give written notice...     120 tokens, prose
                 four weeks... eight weeks..."

      These are structurally different. The question's vector sits in
      "questions about notice" space; the document's sits in "policy
      prose about notice" space. Related, but not as close as they
      should be.

  HyDE
      1. ask the model to WRITE a plausible answer — no retrieval,
         it may well be factually wrong, that is fine
             "Employees are required to provide written notice.
              The standard notice period is four weeks, extending
              to eight weeks for longer service..."
      2. embed THAT, not the question
      3. search

      The fake answer is prose about notice periods, so it lands in the
      same region as the real prose. You are matching document-to-document
      instead of question-to-document.

  COST: one extra generation before every search.
  VERDICT: real gains on short, jargon-light questions over prose
           corpora. Little or no gain once you have hybrid search and a
           reranker, and it can HURT on identifier lookups by burying
           the exact token in invented prose. Measure it; do not adopt
           it on principle.`,
        },
        {
          t: 'h',
          text: 'Routing: choosing where to search',
        },
        {
          t: 'code',
          lang: 'python',
          caption: 'A cheap classifier in front of retrieval — often the largest win per line of code',
          code: `
ROUTE_SCHEMA = {
    "type": "object",
    "properties": {
        "needs_retrieval": {"type": "boolean"},
        "corpora": {"type": "array",
                    "items": {"enum": ["hr", "engineering", "finance", "legal"]}},
        "time_filter": {"type": ["string", "null"]},   # e.g. "2026" or null
    },
    "required": ["needs_retrieval", "corpora", "time_filter"],
    "additionalProperties": False,
}

def route(question: str, history: list) -> dict:
    # Three things at once, for one Haiku call:
    #   • skip retrieval entirely for greetings and meta-requests
    #   • search only the relevant corpora instead of all of them
    #   • extract a time filter the embedding could never encode
    ...`,
        },
        {
          t: 'tip',
          title: 'Routing is cheaper than better retrieval',
          text: 'Searching the HR handbook for an engineering question wastes the entire top-k. A one-call router that picks the right corpus and skips retrieval for non-questions frequently improves answers more than swapping the embedding model — and it reduces cost at the same time, which is a rare combination.',
        },
      ],
    },
    {
      id: 'multi-hop',
      title: 'Multi-hop: when one search cannot work',
      blocks: [
        {
          t: 'p',
          text: 'Some questions are structurally unanswerable in one retrieval, because you cannot even formulate the second search until you have the result of the first. No amount of reranking fixes that.',
        },
        {
          t: 'ascii',
          caption: 'The shape of a question that needs two searches.',
          code: `
  "Does the engineer who approved INC-4471 have refund authority?"

  ONE SEARCH — impossible
      Whatever you embed, no single chunk contains both the approver of
      INC-4471 and that person's authority level. They live in different
      documents, and you do not know the name yet.

  MULTI-HOP
      hop 1:  search "INC-4471 approved by"
              → "Approved by Priya Sharma (Staff Engineer), 14:20 UTC"
              → extract: Priya Sharma, Staff Engineer

      hop 2:  search "Staff Engineer refund approval authority"
              → "Staff Engineers may approve refunds up to £2,000"

      answer: yes, up to £2,000 — with both chunks cited.

  QUESTION SHAPES THAT NEED THIS
      • bridge:      A → B → answer  (the example above)
      • comparison:  "how does the 2024 policy differ from 2026?"
                     (two independent searches, then compare)
      • aggregation: "which teams have no on-call rota?"
                     (many searches — often better served by SQL)

  COST AND RISK
      2-4× the latency and tokens, and errors COMPOUND: a wrong hop 1
      guarantees a wrong hop 2, confidently. Cap the hops, require a
      citation per hop, and abstain if any hop comes back empty.`,
        },
        {
          t: 'code',
          lang: 'python',
          caption: 'A bounded multi-hop loop — note the cap and the empty-hop abstention',
          code: `
HOP_SCHEMA = {
    "type": "object",
    "properties": {
        "reasoning":   {"type": "string", "maxLength": 400},
        "have_answer": {"type": "boolean"},
        "answer":      {"type": ["string", "null"]},
        "next_query":  {"type": ["string", "null"]},
    },
    "required": ["reasoning", "have_answer", "answer", "next_query"],
    "additionalProperties": False,
}

def multi_hop(question: str, session, max_hops: int = 3) -> dict:
    gathered: list[dict] = []

    query = question
    for hop in range(max_hops):
        hits = rerank(query, hybrid_search(query, session, k=30), keep=4)

        if not hits:
            # An empty hop means the chain is broken. Say so rather than
            # inventing the missing link.
            return {"found": False,
                    "answer": f"Could not find information for: {query}",
                    "hops": hop, "citations": gathered}

        gathered.extend(hits)

        step = ask(HOP_PROMPT, question=question, gathered=gathered,
                   schema=HOP_SCHEMA)

        if step["have_answer"]:
            return {"found": True, "answer": step["answer"],
                    "hops": hop + 1, "citations": gathered}
        if not step["next_query"]:
            break
        query = step["next_query"]

    return {"found": False, "answer": "Could not resolve within the hop limit.",
            "hops": max_hops, "citations": gathered}`,
        },
        {
          t: 'warn',
          title: 'Route to multi-hop; do not make it the default',
          text: 'Most questions are single-hop, and running a multi-hop loop for all of them multiplies cost and latency while adding a compounding-error failure mode. Detect the shape first — a cheap classifier can spot bridge and comparison questions reliably — and send only those down the expensive path.',
        },
        {
          t: 'note',
          title: 'Aggregation questions usually want SQL, not RAG',
          text: '"How many incidents last quarter", "which teams have no rota", "average resolution time" are database queries wearing a natural-language costume. Retrieval over chunks can only ever sample. Generate SQL against the real table instead — it is exact, cheap, and the answer can be checked.',
        },
      ],
    },
    {
      id: 'graph',
      title: 'Graph RAG, and when it is not the answer',
      blocks: [
        {
          t: 'p',
          text: 'Graph RAG extracts entities and relationships into a graph at ingestion, then traverses it at query time. It is genuinely powerful for a narrow class of question, and genuinely over-adopted.',
        },
        {
          t: 'ascii',
          caption: 'What the graph buys you, and what it costs.',
          code: `
  INGESTION — a model extracts triples from every chunk
      (Priya Sharma) ──[is]──▶ (Staff Engineer)
      (Staff Engineer) ──[may approve refunds up to]──▶ (£2,000)
      (INC-4471) ──[approved by]──▶ (Priya Sharma)
      (INC-4471) ──[caused by]──▶ (deploy #8821)

  QUERY — traverse instead of searching
      "who could have approved INC-4471's refund?"
          INC-4471 → approved by → Priya → is → Staff Engineer
                   → may approve refunds up to → £2,000
      A path, not a passage. Multi-hop for free, and no compounding
      generation error along the way.

  GOOD AT                          BAD AT / COSTS
  ─────────────────────────────    ─────────────────────────────────────
  multi-hop relationships          an extraction pipeline to build,
  "how does X connect to Y"        tune and maintain
  global questions: "what are      extraction errors are permanent and
  the main themes across 500       silent — a wrong triple is a wrong
  documents"                       answer forever
  entity-centric corpora           re-extraction on every content change
  (people, systems, incidents)     poor at nuance: prose that does not
                                   reduce to triples loses its meaning

  HONEST ADVICE: hybrid + reranking + a routed multi-hop loop covers the
  overwhelming majority of what teams reach for Graph RAG to fix, at a
  fraction of the build and maintenance cost. Reach for the graph when
  your corpus is genuinely a network of entities AND you have measured
  that everything else fell short.`,
        },
        {
          t: 'key',
          title: 'The order to add things in',
          text: 'Metadata filters, then reranking, then hybrid search, then routing, then query rewriting — measuring after each one. Only then consider HyDE, multi-hop and graphs. Teams that jump to the exotic techniques usually have a chunking or filtering bug that the complexity then hides.',
        },
      ],
    },
    {
      id: 'putting-together',
      title: 'The full pipeline',
      blocks: [
        {
          t: 'ascii',
          caption: 'Every stage justified by a failure it fixes. Latency budget on the right.',
          code: `
  question
     │
     ├─▶ ROUTE (Haiku)                            ~150ms
     │     needs retrieval? which corpora? time filter?
     │     └── no retrieval needed ──▶ answer directly
     │
     ├─▶ REWRITE (Haiku)                          ~150ms
     │     resolve pronouns, strip padding, split compounds
     │
     ├─▶ RETRIEVE, over-fetch                     ~20ms
     │     ┌── vector, k=40, filtered
     │     └── BM25,  k=40, filtered
     │           └──▶ RRF fuse ──▶ 40 candidates
     │
     ├─▶ RERANK (Haiku, cross-encoder style)      ~200ms
     │     score 40, keep those ≥5, take top 5
     │     └── nothing scores ≥5 ──▶ abstain honestly
     │
     ├─▶ ASSEMBLE                                 ~0ms
     │     best first, delimited, numbered, count stated,
     │     instruction last, system prompt cached
     │
     ├─▶ GENERATE (Opus 5, streamed)              ~2-8s
     │     structured: quotes → answer_found → answer
     │
     └─▶ VERIFY                                   ~0ms
           every quote a substring; flag anything unverified

  ~500ms of pipeline before the answer starts streaming. Worth it:
  each stage removes a failure the user would otherwise have seen.

  Stages 1, 2 and 4 all run on a cheap model. The expensive model is
  used exactly once, on a context that has been filtered to five
  genuinely relevant passages.`,
        },
        {
          t: 'table',
          caption: 'What each stage is buying. Add them one at a time and measure.',
          head: ['Stage', 'Metric it moves', 'Typical effect'],
          rows: [
            ['Metadata filters', 'Precision, correctness', 'Removes whole classes of wrong-version answers'],
            ['Over-fetch to 40', 'Recall@40 versus recall@8', 'Raises the ceiling the reranker works within'],
            ['Hybrid + RRF', 'Recall on identifiers and rare terms', 'Large on technical corpora'],
            ['Reranking', 'MRR, precision, abstention', '**Usually the biggest single gain**'],
            ['Routing', 'Precision, cost, latency', 'Large where there are several corpora'],
            ['Query rewriting', 'Recall in conversation', 'Essential in chat; near-zero for one-shot'],
            ['Verification', 'Faithfulness (measurable)', 'Turns fabrication into a number'],
          ],
        },
        {
          t: 'tip',
          title: 'Add one stage at a time and keep the numbers',
          text: 'Every stage here adds latency, cost and a new failure mode. Keep a table of recall, MRR, correctness, faithfulness and p95 latency per stage added. When someone asks whether the reranker is worth 200ms, you will have the answer — and occasionally the honest answer is no, for your corpus.',
        },
      ],
    },
  ],

  patterns: [
    {
      id: 'retrieve-wide-rerank-narrow',
      name: 'Retrieve Wide, Rerank Narrow',
      oneLiner: 'Recall is the retriever’s job; precision is the reranker’s.',
      useWhen: ['Every RAG system past the prototype stage.'],
      recognize: ['Top-5 straight from cosine into the prompt.', 'The right passage found at rank 8 and ignored.'],
      steps: [
        'Over-fetch 30–50 candidates — optimise this stage purely for recall.',
        'Rerank with a cross-encoder or a cheap model and a strict scoring prompt.',
        'Keep the top 3–5 above a relevance threshold.',
        'Abstain when nothing clears the threshold.',
      ],
      template: {
        lang: 'python',
        caption: 'The two-stage call, and the honest empty result',
        code: `
candidates = hybrid_search(query, session, k=40)    # recall
passages   = rerank(query, candidates, keep=5)      # precision

if not passages:
    return {"found": False,
            "answer": "I could not find anything relevant in the knowledge base."}`,
      },
      complexity: 'One extra call, roughly 50–200ms.',
      gotchas: [
        'Reranking a top-5 is pointless — you must over-fetch first.',
        'Truncate passages before scoring or the rerank call costs more than the answer.',
      ],
      problems: ['Add reranking and measure MRR', 'Sweep the over-fetch size'],
    },
    {
      id: 'hybrid-rrf',
      name: 'Hybrid Search Fused by Rank',
      oneLiner: 'BM25 for exactness, vectors for meaning, RRF to merge.',
      useWhen: ['Any corpus with identifiers, codenames, error codes or version numbers.'],
      recognize: ['Cannot retrieve `INC-4471`.', 'Internal codenames never match.'],
      steps: [
        'Index the same chunks in a lexical index as well.',
        'Run both searches with identical metadata filters.',
        'Fuse with RRF on rank, never on raw score.',
        'Feed the fused list to the reranker.',
      ],
      complexity: 'A second index; both searches run in parallel.',
      gotchas: [
        'Weighted score fusion needs constants that drift with your corpus; RRF needs none.',
        'Apply the same filters to both halves, or one leaks across a boundary.',
      ],
      problems: ['Find ten queries only BM25 can answer', 'Measure the recall gain from fusion'],
    },
    {
      id: 'route-before-retrieve',
      name: 'Route Before You Retrieve',
      oneLiner: 'One cheap call decides whether, where and when to search.',
      useWhen: ['Several corpora, or a conversational interface.'],
      recognize: ['Greetings triggering retrieval.', 'HR documents answering engineering questions.'],
      steps: [
        'Classify: retrieval needed at all, which corpora, what time filter.',
        'Skip retrieval entirely for greetings and meta-requests.',
        'Search only the selected corpora.',
        'Log the routing decision so mis-routes are visible.',
      ],
      complexity: 'One Haiku call, about 150ms. Usually saves more than it costs.',
      gotchas: [
        'A mis-route is invisible without logging — the answer is simply worse.',
        'Include an "all corpora" escape hatch for genuinely cross-cutting questions.',
      ],
      problems: ['Add routing across three corpora', 'Measure precision and cost'],
    },
    {
      id: 'bounded-multi-hop',
      name: 'Bounded Multi-Hop, Routed To',
      oneLiner: 'Only for questions that structurally need it, with a hard cap.',
      useWhen: ['Bridge and comparison questions across documents.'],
      recognize: ['Questions naming an entity whose attribute lives elsewhere.', 'A multi-hop loop running on every question.'],
      steps: [
        'Detect the question shape with a cheap classifier and route.',
        'Cap hops at two or three.',
        'Require at least one citation per hop.',
        'Abstain on an empty hop rather than guessing the missing link.',
      ],
      complexity: '2–4× latency and tokens for the routed subset only.',
      gotchas: [
        'Errors compound: a wrong hop 1 produces a confidently wrong final answer.',
        'Aggregation questions belong in SQL, not in a hop loop.',
      ],
      problems: ['Build a two-hop question and solve it', 'Route so single-hop stays cheap'],
    },
  ],

  pitfalls: [
    { title: 'Reranking a top-5', text: 'It can only reorder what it is given. Over-fetch first.' },
    { title: 'Fusing normalised scores', text: 'BM25 and cosine are not comparable. Fuse on rank with RRF.' },
    { title: 'No lexical index', text: 'Identifiers, error codes and codenames are unreachable by vectors.' },
    { title: 'Different filters on the two retrievers', text: 'One half leaks across a tenant or version boundary.' },
    { title: 'Full chunks in the rerank prompt', text: 'Forty untruncated passages can cost more than the answer call.' },
    { title: 'Multi-hop on every question', text: 'Multiplies cost and adds compounding errors for no gain.' },
    { title: 'HyDE on identifier lookups', text: 'The invented prose buries the exact token you needed.' },
    { title: 'Graph RAG before hybrid and reranking', text: 'An extraction pipeline to maintain, hiding a chunking bug.' },
    { title: 'Aggregation questions through retrieval', text: 'Chunks can only sample. Write SQL.' },
    { title: 'Adding four techniques at once', text: 'You cannot attribute the change, or the regression.' },
    { title: 'No abstention when everything scores low', text: 'The reranker handed you a real "no results" signal — use it.' },
    { title: 'Not logging the routing decision', text: 'A mis-route looks exactly like a bad model.' },
  ],

  cheatsheet: [
    { label: 'Do first', value: 'reranking' },
    { label: 'Do second', value: 'hybrid search' },
    { label: 'Over-fetch', value: '30–50 candidates' },
    { label: 'Keep after rerank', value: '3–5' },
    { label: 'Fuse with', value: 'RRF on rank, k=60' },
    { label: 'BM25 wins', value: 'ids, codes, rare names, negation' },
    { label: 'Vectors win', value: 'paraphrase, synonyms, intent' },
    { label: 'Bi-encoder', value: 'fast, blunt, pre-computed' },
    { label: 'Cross-encoder', value: 'slow, accurate, reads the pair' },
    { label: 'Reranker gives', value: 'a real relevance cut → abstention' },
    { label: 'Routing', value: 'whether / where / when to search' },
    { label: 'HyDE', value: 'embed a fake answer; measure before adopting' },
    { label: 'Multi-hop', value: 'route to it, cap at 2–3 hops' },
    { label: 'Aggregation', value: 'SQL, not RAG' },
    { label: 'Graph RAG', value: 'last resort, entity-centric corpora' },
    { label: 'Add stages', value: 'one at a time, keep the numbers' },
  ],

  problems: [
    { name: 'Find ten queries only BM25 answers', difficulty: 'Easy', pattern: 'Hybrid motivation', insight: 'Ticket ids, error codes, internal codenames. Vector recall near zero, BM25 perfect. This table is the case for hybrid search on your corpus.' },
    { name: 'Add BM25 and fuse with RRF', difficulty: 'Medium', pattern: 'Hybrid search', insight: 'Measure recall@10 for dense, sparse and fused. Fused should beat both. Then try weighted score fusion and see how much tuning it needs to match RRF.' },
    { name: 'Add reranking and measure MRR', difficulty: 'Medium', pattern: 'Reranking', insight: 'Over-fetch 40, rerank to 5. MRR usually improves sharply. Note how often the new top-1 was previously rank 6 or lower.' },
    { name: 'Use the reranker to abstain', difficulty: 'Medium', pattern: 'Relevance cut', insight: 'Ask questions the corpus does not cover and confirm nothing scores 5+. You now have an honest empty result, which cosine alone can never give you.' },
    { name: 'Sweep the over-fetch size', difficulty: 'Medium', pattern: 'Recall ceiling', insight: 'Rerank from 10, 20, 40, 80 candidates. Final quality rises then flattens while rerank cost climbs linearly. Find the knee.' },
    { name: 'Add routing over three corpora', difficulty: 'Medium', pattern: 'Routing', insight: 'Classify into HR, engineering or finance and search only that one. Measure precision, cost and latency — routing usually improves all three at once.' },
    { name: 'Test HyDE honestly', difficulty: 'Hard', pattern: 'HyDE', insight: 'Measure recall with and without, separately for prose questions and identifier questions. It should help the first and hurt the second — which is why blanket adoption is wrong.' },
    { name: 'Build a bounded multi-hop loop', difficulty: 'Hard', pattern: 'Multi-hop', insight: 'Solve a real bridge question in two hops with citations per hop. Then break hop 1 deliberately and confirm the system abstains instead of inventing the link.' },
    { name: 'Compare aggregation via RAG and via SQL', difficulty: 'Hard', pattern: 'Wrong tool', insight: 'Ask "how many incidents last quarter" both ways. RAG samples and is wrong; generated SQL is exact. Write down the rule for when to route to SQL.' },
    { name: 'Build the stage-by-stage improvement table', difficulty: 'Hard', pattern: 'Measurement discipline', insight: 'Recall, MRR, correctness, faithfulness and p95 latency after each stage is added. This one table answers every future "is X worth it" question, sometimes with a no.' },
  ],
}
