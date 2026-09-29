export default {
  id: 'ai-embeddings',
  title: 'Embeddings & Vector Search',
  short: 'Embeddings',
  icon: 'BubbleChartRounded',
  tier: 'Core',
  order: 8,
  estHours: 5,
  prereqs: ['ai-context'],
  tagline: 'Turn meaning into coordinates, then search by distance instead of by keyword.',
  mentalModel:
    'An embedding model is a **compressor with a very specific loss function**: it squashes a passage into a few hundred numbers such that passages meaning similar things land near each other. Search stops being "which document contains these words" and becomes "which document points in the same direction".',
  whyItMatters:
    'Vector search is the engine under every RAG system, every semantic deduplication job and every "find similar" feature. It is also the component people most often treat as a black box — and then cannot explain why their retrieval returns confidently irrelevant results.',

  reference: {
    title: 'Vocabulary you need before anything else makes sense',
    head: ['Term', 'What it actually is'],
    rows: [
      ['**Embedding**', 'A fixed-length vector of floats — typically 384 to 3072 numbers — representing a piece of text'],
      ['**Dimension**', 'How many numbers. More is more expressive, slower and larger to store'],
      ['**Cosine similarity**', 'The cosine of the angle between two vectors. 1 = same direction, 0 = unrelated, −1 = opposite'],
      ['**Vector database**', 'A store that can find the nearest vectors to a query vector quickly'],
      ['**ANN**', 'Approximate nearest neighbour — trades a little recall for enormous speed'],
      ['**Recall@k**', 'Of the truly relevant documents, what fraction appear in the top k. The metric that matters'],
      ['**Bi-encoder**', 'Embeds query and document separately. Fast, pre-computable — this chapter'],
      ['**Cross-encoder**', 'Reads query and document together and scores the pair. Slow, far more accurate — the reranker'],
    ],
  },

  sections: [
    {
      id: 'geometry',
      title: 'Meaning as geometry',
      blocks: [
        {
          t: 'lead',
          text: 'You already met this idea in the transformer chapter: the embedding table maps tokens to vectors where distance means something. An embedding model does the same thing for a whole passage instead of a single token.',
        },
        {
          t: 'ascii',
          caption: 'A two-dimensional cartoon of a 1024-dimensional space. Direction carries the meaning.',
          code: `
                    ▲
                    │        · "how do I reset my password"
          account   │      · "I forgot my login details"
          topics    │    · "cannot sign in to my account"
                    │
        ────────────┼────────────────────────────────▶
                    │
          billing   │           · "my card was declined"
          topics    │         · "update payment method"
                    │       · "why was I charged twice"
                    ▼

  Note what is NOT happening here:
      "forgot my login details" shares ZERO content words with
      "how do I reset my password" — no keyword search finds it.
      They are neighbours because they MEAN the same thing.

  And the failure mode, in the same picture:
      "how do I reset my password"   and
      "how do I reset my ROUTER"     are close too.
      Similar shape, similar vocabulary, different intent.
      Embeddings capture topic far better than they capture negation,
      numbers, names, or precise intent. Remember this — it is the
      source of most bad retrieval.`,
        },
        {
          t: 'code',
          lang: 'python',
          caption: 'Cosine similarity, which is the entire scoring function',
          code: `
import numpy as np

def cosine(a: np.ndarray, b: np.ndarray) -> float:
    return float(a @ b / (np.linalg.norm(a) * np.linalg.norm(b)))

# Most embedding APIs return already-normalised vectors (length 1). When
# they do, cosine similarity IS the dot product — which is why vector
# databases are so fast: one multiply-accumulate per dimension.
def cosine_normalised(a: np.ndarray, b: np.ndarray) -> float:
    return float(a @ b)

# Rough intuition for the numbers you will see in practice:
#   0.95+   near-duplicate text
#   0.80    same topic, same intent
#   0.65    same topic, different intent      ← the dangerous band
#   0.45    loosely related
#   0.20    unrelated`,
        },
        {
          t: 'warn',
          title: 'Absolute similarity scores are not comparable across models',
          text: 'One model’s 0.82 is another’s 0.61 for the same pair — they are calibrated differently, and some produce a narrow band where nothing ever scores below 0.7. So a hard threshold such as `if score > 0.75` is a magic number tuned to one model that will break the day you upgrade it. Rank by score, take the top k, and let a **reranker** decide relevance if you need a real cut-off.',
        },
      ],
    },
    {
      id: 'producing',
      title: 'Producing and storing embeddings',
      blocks: [
        {
          t: 'p',
          text: 'The shape of the pipeline is the same regardless of which embedding provider you use: embed every chunk once at ingestion, store the vectors with their text and metadata, and embed only the query at search time.',
        },
        {
          t: 'ascii',
          caption: 'Two phases with completely different frequencies and cost profiles.',
          code: `
  INGESTION — once per document, or on change
  ┌──────────┐   ┌────────┐   ┌───────────┐   ┌──────────────────┐
  │ documents│──▶│ chunk  │──▶│  embed    │──▶│ vector store      │
  └──────────┘   └────────┘   │  (batch)  │   │ id | vec | text   │
                               └───────────┘   │    | meta        │
                                               └──────────────────┘
       expensive, slow, done rarely, easily parallelised

  QUERY — once per user request, must be fast
  ┌──────────┐   ┌───────────┐   ┌──────────────┐   ┌────────────┐
  │  query   │──▶│  embed    │──▶│ ANN search   │──▶│ top-k text │
  └──────────┘   │ (1 call)  │   │ + metadata   │   └────────────┘
                 └───────────┘   │   filter     │
                                 └──────────────┘
       ~20-50 ms embed + ~5-20 ms search

  THE RULE THAT BREAKS SYSTEMS:
      the query and the documents MUST be embedded by the same model,
      with the same version and the same prompt/prefix convention.
      Change the model and every stored vector is garbage — you must
      re-embed the entire corpus. Store the model name and version
      alongside every vector so this is detectable rather than mysterious.`,
        },
        {
          t: 'code',
          lang: 'python',
          caption: 'A minimal store — and the metadata that makes it debuggable later',
          code: `
import numpy as np

class VectorStore:
    def __init__(self, embed_model: str):
        self.embed_model = embed_model      # recorded, so a mismatch is loud
        self.vectors: np.ndarray | None = None
        self.records: list[dict] = []

    def add(self, chunks: list[dict], vectors: np.ndarray) -> None:
        # Normalise once at write time; then search is a pure dot product.
        vectors = vectors / np.linalg.norm(vectors, axis=1, keepdims=True)
        self.vectors = vectors if self.vectors is None else np.vstack(
            [self.vectors, vectors])
        self.records.extend(chunks)

    def search(self, query_vec: np.ndarray, k: int = 10,
               where: dict | None = None) -> list[dict]:
        q = query_vec / np.linalg.norm(query_vec)
        scores = self.vectors @ q                  # cosine, all at once

        if where:                                  # metadata pre-filter
            mask = np.array([
                all(r["meta"].get(f) == v for f, v in where.items())
                for r in self.records])
            scores = np.where(mask, scores, -np.inf)

        top = np.argpartition(-scores, k)[:k]       # O(n), not a full sort
        top = top[np.argsort(-scores[top])]
        return [{**self.records[i], "score": float(scores[i])} for i in top]

# Store text and metadata WITH the vector. A search that returns only ids
# and scores is impossible to debug: you cannot see what was retrieved.`,
        },
        {
          t: 'key',
          title: 'Metadata filtering is often worth more than a better embedding model',
          text: 'If the user is asking about the 2026 handbook, filtering to `year = 2026` before the vector search removes every plausible-but-wrong neighbour from 2023 in one step. Embeddings are poor at dates, versions, tenancy and permissions — precisely the things a `WHERE` clause is excellent at. Always store the structured fields, and always filter on them first.',
        },
        {
          t: 'trap',
          title: 'Filtering after the search silently returns fewer results',
          text: 'Retrieve the top 10, then filter to one tenant, and you may be left with two chunks — or none — while the right answer sat at rank 14. Use a store that supports **pre-filtering** (restricting the search space before the nearest-neighbour scan), or over-fetch generously and filter afterwards while monitoring how often you fall short of k.',
        },
      ],
    },
    {
      id: 'ann',
      title: 'Why approximate search, and what it costs you',
      blocks: [
        {
          t: 'p',
          text: 'Comparing a query against every vector is exact and linear. At ten thousand chunks that is fine. At ten million it is not, so real systems use an index that finds *almost* the nearest neighbours in logarithmic time.',
        },
        {
          t: 'ascii',
          caption: 'HNSW is the default in most vector databases. Its shape explains its tuning knobs.',
          code: `
  FLAT (exact)           compare against every vector
      10k vectors × 1024 dims ≈ 10M multiply-adds ≈ a few ms   ✔ fine
      10M vectors             ≈ 10B                            ✘ seconds

  HNSW — a navigable small-world graph in layers
      layer 2   ●───────────────────●              few nodes, long hops
                 \\                 /
      layer 1   ●───●───────●─────●                more nodes
                 \\   \\     /     /
      layer 0   ●─●─●─●─●─●─●─●─●─●                every vector

      Start at the top, greedily walk towards the query, drop a layer,
      repeat. Log-ish time. Recall typically 95-99%.

  THE KNOBS, and what they trade:
      M                graph connectivity. Higher = better recall,
                       more memory, slower build.
      ef_construction  effort at build time. Higher = better graph,
                       slower ingestion. Set it generously; you pay once.
      ef_search        candidates explored per query. Higher = better
                       recall, slower query. THIS is the runtime dial.

  IVF — cluster first, then search only the nearest few clusters.
      Smaller memory footprint, faster to build, usually lower recall
      than HNSW at the same speed. Common when the corpus is huge.`,
        },
        {
          t: 'note',
          title: 'The approximation is rarely your accuracy problem',
          text: 'At 97% recall, three relevant chunks in a hundred are missed by the index. Meanwhile bad chunking, a missing metadata filter or a mismatched query formulation routinely lose thirty. Tune `ef_search` once, measure recall@k against a small exact-search baseline, and then go and fix the parts of the pipeline that are actually losing you results.',
        },
        {
          t: 'table',
          caption: 'Choosing a store. Start at the top and move down only when a number forces you to.',
          head: ['Scale', 'Reasonable choice', 'Why'],
          rows: [
            ['< 10k chunks', 'NumPy array in memory', 'Exact, trivial, zero operations. Genuinely fine.'],
            ['< 1M chunks', 'Postgres + `pgvector`', 'Your data, your transactions, real `WHERE` clauses, one database'],
            ['1M – 100M', 'A dedicated vector database', 'Purpose-built ANN, sharding, filtered search'],
            ['Already on Elastic/OpenSearch', 'Its built-in vector field', 'Hybrid keyword + vector in one query, which you will want anyway'],
            ['Any scale, needs keyword too', '**Hybrid** — see advanced RAG', 'Vectors alone miss exact identifiers and rare terms'],
          ],
        },
        {
          t: 'tip',
          title: 'Do not start with a vector database',
          text: 'A NumPy array and a dot product will serve a prototype and most internal tools indefinitely, and it keeps the debugging trivially inspectable. Moving to `pgvector` gets you transactions and joins against data you already have. Reach for a dedicated vector store when a measurement — not an architecture diagram — says you need one.',
        },
      ],
    },
    {
      id: 'limits',
      title: 'What embeddings are bad at',
      blocks: [
        {
          t: 'lead',
          text: 'This is the most useful section in the chapter. Every one of these failures is silent: you get a confident top-5 that simply does not contain the answer.',
        },
        {
          t: 'table',
          caption: 'Known weaknesses, and the fix for each. Almost none of the fixes is "a better embedding model".',
          head: ['Weakness', 'Example', 'Fix'],
          rows: [
            ['**Negation**', '"deployments that do *not* require approval" retrieves the ones that do', 'Hybrid search; a reranker; rewrite the query'],
            ['**Exact identifiers**', 'Ticket `INC-4471`, SKU `A7-99`, an error code', '**Keyword search** — this is what BM25 is for'],
            ['**Numbers and dates**', '"orders over £500 in Q3"', 'Metadata filters, not vectors'],
            ['**Rare proper nouns**', 'An internal codename the model never saw', 'Hybrid search; the lexical half catches it'],
            ['**Long documents**', 'A 20-page page averaged into one vector', 'Chunking — the next chapter'],
            ['**Asymmetry**', 'A short question versus a long answer passage', 'Query/document prefixes, or HyDE'],
            ['**Intent versus topic**', '"reset password" versus "reset router"', 'Reranking with a cross-encoder'],
            ['**Multilingual mismatch**', 'English query, Hindi document', 'A multilingual embedding model, chosen deliberately'],
          ],
        },
        {
          t: 'key',
          title: 'The single most important sentence about embeddings',
          text: 'They are excellent at **topic** and mediocre at **precision**. That is why every serious retrieval system is hybrid — a lexical index for exactness and a vector index for meaning — with a reranker on top to sort out what actually answers the question. A pure vector pipeline is a prototype, not an architecture.',
        },
        {
          t: 'code',
          lang: 'python',
          caption: 'The asymmetry problem, and the prefix convention that addresses it',
          code: `
# A short question and a long answer passage are structurally different
# kinds of text, yet a naive pipeline embeds them identically. Many
# embedding models are trained with task prefixes to fix exactly this.

query_vec = embed("search_query: how long is the notice period?")
doc_vecs  = embed_batch([f"search_document: {c}" for c in chunks])

# The rule that follows: whatever prefix convention you choose, it must
# be applied identically at ingestion and at query time, forever. Store
# the convention next to the model name in your index metadata — a
# silently changed prefix degrades recall with no error anywhere.`,
        },
      ],
    },
    {
      id: 'evaluating',
      title: 'Measuring retrieval before you blame the model',
      blocks: [
        {
          t: 'p',
          text: 'When a RAG system answers badly, the cause is retrieval far more often than generation. You cannot tell which without measuring them separately — and that needs a small labelled set, which takes about an hour to build.',
        },
        {
          t: 'code',
          lang: 'python',
          caption: 'Thirty labelled queries will tell you more than any amount of prompt tuning',
          code: `
# (query, the chunk ids that genuinely answer it)
GOLD = [
    ("what is the notice period", {"hr-handbook-c12"}),
    ("can I expense a taxi home after 10pm", {"expenses-c4", "expenses-c5"}),
    ("who approves a refund over 10k", {"finance-c9"}),
    # ... 30 or so, drawn from real user questions
]

def recall_at_k(store, k: int = 10) -> float:
    hits = 0
    for query, gold_ids in GOLD:
        got = {r["id"] for r in store.search(embed(query), k=k)}
        hits += bool(got & gold_ids)          # did ANY gold chunk appear?
    return hits / len(GOLD)

def mrr(store, k: int = 10) -> float:
    """Mean reciprocal rank — rewards putting the answer near the top."""
    total = 0.0
    for query, gold_ids in GOLD:
        for rank, r in enumerate(store.search(embed(query), k=k), start=1):
            if r["id"] in gold_ids:
                total += 1 / rank
                break
    return total / len(GOLD)

print(f"recall@10 {recall_at_k(store):.2f}  mrr {mrr(store):.2f}")`,
        },
        {
          t: 'steps',
          items: [
            { title: 'Collect thirty real questions', text: 'From support tickets, search logs or the people who will use the system. Invented questions are too easy and mislead you.' },
            { title: 'Label the chunks that truly answer each one', text: 'Tedious, one hour, and it pays for itself the first time you avoid a wrong architectural conclusion.' },
            { title: 'Measure recall@10 and MRR as your baseline', text: 'Recall says "is the answer in the context at all". MRR says "is it near the top where the model will actually use it".' },
            { title: 'Change exactly one thing and re-measure', text: 'Chunk size, embedding model, hybrid search, reranking. One at a time or you learn nothing.' },
            { title: 'Only tune the generation prompt once recall is good', text: 'No prompt can answer from a context that does not contain the answer.' },
          ],
        },
        {
          t: 'warn',
          title: 'Recall@k is the ceiling on everything downstream',
          text: 'If recall@10 is 0.6, then 40% of questions are unanswerable no matter how good your model, prompt or reranker is. That single number tells you whether to work on retrieval or on generation — and most teams spend weeks on the prompt without ever computing it.',
        },
      ],
    },
  ],

  patterns: [
    {
      id: 'filter-then-search',
      name: 'Filter on Metadata, Then Search Vectors',
      oneLiner: 'A `WHERE` clause beats a better embedding model for dates, tenants and versions.',
      useWhen: ['Any corpus with structure: versions, dates, owners, languages, permissions.'],
      recognize: ['Results from the wrong year or the wrong customer.', 'A leak across tenant boundaries.'],
      steps: [
        'Store structured fields alongside every vector at ingestion.',
        'Derive filters from the query or the session — tenant, locale, document version.',
        'Pre-filter where the store supports it; otherwise over-fetch and filter, monitoring shortfalls.',
        'Never rely on the embedding to encode a date or an id.',
      ],
      template: {
        lang: 'python',
        caption: 'Permission filtering is a correctness requirement, not a ranking preference',
        code: `
results = store.search(
    embed(question), k=10,
    where={"tenant_id": session.tenant_id,     # security, not relevance
           "doc_version": "2026",
           "language": session.locale},
)`,
      },
      complexity: 'Usually faster than unfiltered search, because the candidate set shrinks.',
      gotchas: [
        'Post-filtering silently returns fewer than k results.',
        'A tenant filter applied only in the prompt is not a security control.',
      ],
      problems: ['Add metadata filtering and re-measure recall', 'Prove a tenant leak, then close it'],
    },
    {
      id: 'same-model-both-sides',
      name: 'One Model, One Convention, Recorded',
      oneLiner: 'Query and documents must be embedded identically — store the model and prefix with the index.',
      useWhen: ['Every vector index, from the first day.'],
      recognize: ['Recall that collapsed after a dependency upgrade.', 'Nobody can say which model produced the stored vectors.'],
      steps: [
        'Record the embedding model name, version and prefix convention in the index metadata.',
        'Assert the match at query time and fail loudly on a mismatch.',
        'Treat a model change as a full re-embed, and plan for a dual-write migration.',
      ],
      complexity: 'One assertion. Prevents a failure mode with no other symptom.',
      gotchas: [
        'A silently upgraded library can change the model under you.',
        'Mixed-model indexes do not error — they just retrieve nonsense.',
      ],
      problems: ['Mix two models in one index and watch recall collapse', 'Add the assertion'],
    },
    {
      id: 'measure-recall-first',
      name: 'Measure Recall Before Touching the Prompt',
      oneLiner: 'Recall@k is the ceiling on the whole system.',
      useWhen: ['Any RAG quality complaint.'],
      recognize: ['Weeks of prompt tuning with no measurement of retrieval.', 'No labelled query set exists.'],
      steps: [
        'Build thirty labelled query/chunk pairs from real questions.',
        'Compute recall@10 and MRR.',
        'Below about 0.8 recall, fix retrieval and ignore the prompt entirely.',
        'Re-measure after every single change.',
      ],
      complexity: 'One hour to build, seconds to run.',
      gotchas: [
        'Invented queries are far easier than real ones and will flatter you.',
        'Recall alone hides ranking problems — track MRR too.',
      ],
      problems: ['Build the gold set', 'Find your ceiling'],
    },
    {
      id: 'start-simple-store',
      name: 'Start With NumPy, Graduate on Evidence',
      oneLiner: 'Exact search over 10k vectors is milliseconds and perfectly debuggable.',
      useWhen: ['Prototypes, internal tools, anything under roughly a million chunks.'],
      recognize: ['A vector database deployed for 4,000 documents.', 'Weeks spent on infrastructure before recall was ever measured.'],
      steps: [
        'Begin with an in-memory array and exact cosine search.',
        'Move to `pgvector` when you want transactions, joins and real filters.',
        'Move to a dedicated store when a measured latency or scale number demands it.',
      ],
      complexity: 'Exact search: O(n·d) per query — a few milliseconds at 10k × 1024.',
      gotchas: [
        'An ANN index hides recall problems behind a plausible result list.',
        'Exact search is also your ground truth for measuring an ANN index later.',
      ],
      problems: ['Benchmark exact search at your real corpus size', 'Compare ANN recall against it'],
    },
  ],

  pitfalls: [
    { title: 'Different models for query and documents', text: 'Retrieval becomes noise, with no error anywhere.' },
    { title: 'Hard-coded similarity thresholds', text: 'Scores are not calibrated across models. Rank and rerank instead.' },
    { title: 'Expecting exact-match behaviour', text: 'Identifiers and error codes need keyword search, not vectors.' },
    { title: 'Ignoring negation', text: '"does not require approval" retrieves the opposite. Hybrid plus a reranker.' },
    { title: 'Embedding dates and numbers', text: 'Put them in metadata and filter on them.' },
    { title: 'Post-filtering instead of pre-filtering', text: 'Quietly returns fewer than k results.' },
    { title: 'Not storing text with the vector', text: 'You cannot debug a retrieval you cannot read.' },
    { title: 'Embedding whole documents', text: 'The average of twenty pages points at nothing in particular.' },
    { title: 'A vector database for 4,000 chunks', text: 'Operational cost for no measured benefit.' },
    { title: 'Never measuring recall@k', text: 'You are tuning a prompt against an unreachable answer.' },
    { title: 'Changing the embedding model without re-embedding', text: 'Every stored vector becomes meaningless.' },
    { title: 'Applying a tenant filter in the prompt only', text: 'That is not access control; enforce it in the query.' },
  ],

  cheatsheet: [
    { label: 'Embedding', value: 'text → fixed-length float vector' },
    { label: 'Score', value: 'cosine = dot product, if normalised' },
    { label: 'Normalise', value: 'once, at write time' },
    { label: 'Same model', value: 'query and documents, always' },
    { label: 'Record', value: 'model, version and prefix in the index' },
    { label: 'Good at', value: 'topic and paraphrase' },
    { label: 'Bad at', value: 'negation, ids, numbers, dates, rare names' },
    { label: 'Exact terms', value: 'BM25 / keyword, not vectors' },
    { label: 'Dates, tenants', value: 'metadata filters' },
    { label: 'Filter', value: 'before the search, not after' },
    { label: '< 10k chunks', value: 'NumPy and exact search' },
    { label: '< 1M chunks', value: '`pgvector`' },
    { label: 'ANN default', value: 'HNSW; tune `ef_search` at query time' },
    { label: 'Key metric', value: 'recall@k — the system ceiling' },
    { label: 'Ranking metric', value: 'MRR' },
    { label: 'Gold set', value: '30 real queries, one hour' },
    { label: 'Below 0.8 recall', value: 'fix retrieval, not the prompt' },
  ],

  problems: [
    { name: 'Embed twenty sentences and print the similarity matrix', difficulty: 'Easy', pattern: 'Geometry', insight: 'Include paraphrases, same-topic-different-intent pairs and unrelated sentences. Seeing the 0.65 band where topic matches but intent does not is the lesson.' },
    { name: 'Find a pair that fools it', difficulty: 'Easy', pattern: 'Limits', insight: 'Construct two sentences with opposite meaning and near-identical wording. Cosine above 0.9. Now you understand why reranking exists.' },
    { name: 'Build an in-memory store and search it', difficulty: 'Easy', pattern: 'Exact search', insight: 'A NumPy array, normalised vectors, a dot product and an argpartition. Fifty lines, and it will serve a real internal tool.' },
    { name: 'Break an index with a second model', difficulty: 'Medium', pattern: 'Model consistency', insight: 'Embed half the corpus with one model and half with another. Recall collapses and nothing errors. Then add the assertion that would have caught it.' },
    { name: 'Add metadata filtering', difficulty: 'Medium', pattern: 'Filtering', insight: 'Index two years of a handbook and ask a version-specific question. Unfiltered, the wrong year wins. Filtered, it cannot.' },
    { name: 'Measure post-filter shortfall', difficulty: 'Medium', pattern: 'Pre vs post filter', insight: 'Retrieve k=10 then filter to one tenant and count how often you end up with fewer than five. The number is usually alarming.' },
    { name: 'Build the thirty-query gold set', difficulty: 'Medium', pattern: 'Evaluation', insight: 'Real questions, labelled chunks, recall@10 and MRR. This is the artefact every later retrieval decision is measured against.' },
    { name: 'Compare ANN recall against exact search', difficulty: 'Hard', pattern: 'ANN tuning', insight: 'Use exact search as ground truth, then sweep `ef_search`. Plot recall against latency and pick the knee rather than a default.' },
    { name: 'Show where pure vector search fails on your own corpus', difficulty: 'Hard', pattern: 'Hybrid motivation', insight: 'Collect ten queries containing identifiers, negations and rare names. Measure recall. The gap is the case for hybrid search in the next chapters.' },
    { name: 'Plan a zero-downtime re-embedding migration', difficulty: 'Hard', pattern: 'Model change', insight: 'Dual-write both models, shadow-read the new index, compare recall on the gold set, then cut over. Write it down before you need it at 2am.' },
  ],
}
