export default {
  id: 'ai-chunking',
  title: 'Chunking & Document Processing',
  short: 'Chunking',
  icon: 'ContentCutRounded',
  tier: 'Core',
  order: 9,
  estHours: 4,
  prereqs: ['ai-embeddings'],
  tagline: 'The least glamorous part of RAG, and the one that most often decides whether it works.',
  mentalModel:
    'A chunk is the **unit of retrieval**, so it has two jobs that pull in opposite directions: it must be small and focused enough to be found by a specific question, and complete enough to answer that question once found. Every chunking decision is a trade between those two.',
  whyItMatters:
    'Teams spend weeks tuning prompts and swapping embedding models while their real problem is that the answer was split across two chunks and neither one made sense alone. Chunking is where most retrieval quality is won or lost, and it is almost never where people look first.',

  reference: {
    title: 'Strategies, worst to best',
    head: ['Strategy', 'How it splits', 'Verdict'],
    rows: [
      ['Fixed characters', 'Every 1000 characters', '**Never.** Cuts mid-word and mid-sentence'],
      ['Fixed tokens', 'Every 400 tokens', 'Better, still splits arguments in half'],
      ['Recursive', 'Paragraph → sentence → word, as needed', '**The sane default.** Respects natural boundaries'],
      ['Structural', 'By heading, section, row, function', '**Best where structure exists** — markdown, HTML, code, tables'],
      ['Semantic', 'Where the embedding of consecutive sentences shifts', 'Elegant; expensive; rarely beats structural'],
      ['Whole document', 'No splitting', 'Only for genuinely short documents, under ~500 tokens'],
    ],
  },

  sections: [
    {
      id: 'tension',
      title: 'The core tension, drawn',
      blocks: [
        {
          t: 'ascii',
          caption: 'Too small and the answer is incomplete. Too large and the vector points nowhere in particular.',
          code: `
  ORIGINAL SECTION
  ┌────────────────────────────────────────────────────────────────┐
  │ 4.3 Notice period                                              │
  │                                                                │
  │ Employees must give written notice before leaving. The period   │
  │ depends on length of service. Under two years, it is four      │
  │ weeks. Two years or more, it is eight weeks. Notice starts on   │
  │ the next working day after HR acknowledges receipt.             │
  └────────────────────────────────────────────────────────────────┘

  TOO SMALL — 1 sentence per chunk
  ┌─────────────────────────────┐
  │ "Under two years, it is      │  ← retrieved for "what is my notice
  │  four weeks."                │     period?" ... four weeks of WHAT?
  └─────────────────────────────┘     No subject. No section title.
                                      Technically relevant, useless.

  TOO LARGE — the whole 40-page handbook as one chunk
  ┌─────────────────────────────┐
  │ [holidays, notice, expenses, │  ← its vector is the AVERAGE of forty
  │  conduct, benefits, IT, ...] │     topics, so it is near nothing.
  └─────────────────────────────┘     Loses to a focused chunk every time,
                                      and blows the context budget if it wins.

  JUST RIGHT — one section, with its heading carried along
  ┌─────────────────────────────────────────────────────────────┐
  │ [HR Handbook 2026 > 4.3 Notice period]                       │
  │ Employees must give written notice... four weeks. Two years   │
  │ or more, eight weeks. Notice starts on the next working day.  │
  └─────────────────────────────────────────────────────────────┘
      self-contained, one topic, ~120 tokens, answers the question alone`,
        },
        {
          t: 'key',
          title: 'The test for a good chunk',
          text: 'Read the chunk with no other context. Could a competent colleague answer the intended question from it? If they would have to ask "four weeks of what?" or "which product version is this?", the chunk is not self-contained — and the model will guess exactly where your colleague would have asked.',
        },
        {
          t: 'table',
          caption: 'Reasonable starting sizes. Measure recall on your own corpus rather than trusting any table, including this one.',
          head: ['Content type', 'Target size', 'Overlap', 'Split on'],
          rows: [
            ['Prose, policy, documentation', '300–600 tokens', '10–15%', 'Headings, then paragraphs'],
            ['FAQ or Q&A pairs', 'One pair per chunk', 'None', 'The pair boundary'],
            ['Code', 'One function or class', 'None', 'Syntactic boundaries'],
            ['Chat or ticket transcripts', 'One exchange, or a time window', 'One message', 'Speaker turns'],
            ['Tables', 'A row group, header repeated', 'The header', 'Rows — never mid-row'],
            ['Legal or contracts', 'One clause, parents in the header', 'None', 'Clause numbering'],
            ['Slides', 'One slide, plus its notes', 'None', 'Slide boundaries'],
          ],
        },
      ],
    },
    {
      id: 'recursive',
      title: 'Recursive splitting: the default that works',
      blocks: [
        {
          t: 'p',
          text: 'Try to split on the biggest natural boundary available. If the resulting piece is still too big, split it on the next smallest boundary, and so on. The result respects document structure where it exists and degrades gracefully where it does not.',
        },
        {
          t: 'code',
          lang: 'python',
          caption: 'A recursive splitter with overlap — about forty lines, and no dependency needed',
          code: `
SEPARATORS = ["\\n## ", "\\n### ", "\\n\\n", "\\n", ". ", " "]

def split(text: str, max_tokens: int = 500, seps: list[str] = SEPARATORS
          ) -> list[str]:
    if count_tokens(text) <= max_tokens:
        return [text]

    for i, sep in enumerate(seps):
        if sep not in text:
            continue
        parts, buf = [], ""
        for piece in text.split(sep):
            candidate = (buf + sep + piece) if buf else piece
            if count_tokens(candidate) <= max_tokens:
                buf = candidate
            else:
                if buf:
                    parts.append(buf)
                # A single piece can still be too big: recurse with the
                # next-finer separator rather than emitting an oversized chunk.
                buf = piece if count_tokens(piece) <= max_tokens else ""
                if not buf:
                    parts.extend(split(piece, max_tokens, seps[i + 1:]))
        if buf:
            parts.append(buf)
        return parts

    # No separator left — a pathological run of characters. Hard-cut it.
    return hard_split_by_tokens(text, max_tokens)


def with_overlap(chunks: list[str], sentences: int = 1) -> list[str]:
    """Carry the tail of each chunk into the next so a sentence spanning
    a boundary is still retrievable from at least one chunk."""
    out = []
    for i, chunk in enumerate(chunks):
        prefix = ""
        if i > 0:
            tail = chunks[i - 1].split(". ")[-sentences:]
            prefix = ". ".join(tail).strip() + " "
        out.append(prefix + chunk)
    return out`,
        },
        {
          t: 'note',
          title: 'What overlap is actually for',
          text: 'It is insurance against a boundary landing in the middle of the one sentence that answers the question. Ten to fifteen percent is plenty. Fifty percent overlap doubles your index, doubles your embedding bill, and fills the top-k with near-duplicates that crowd out genuinely different material — which makes retrieval worse, not better.',
        },
      ],
    },
    {
      id: 'context-injection',
      title: 'Give every chunk its own context',
      blocks: [
        {
          t: 'lead',
          text: 'This is the single highest-value trick in the chapter, it takes an afternoon, and most pipelines skip it. A chunk torn out of a document loses everything the document structure was telling you.',
        },
        {
          t: 'ascii',
          caption: 'Three levels of context injection. Each one measurably improves both retrieval and the answer.',
          code: `
  LEVEL 0 — raw chunk (what most pipelines store)
    "Two years or more, it is eight weeks."
    → retrievable for almost nothing; answers nothing

  LEVEL 1 — prepend the heading path                    ★ do this always
    "[HR Handbook 2026 > 4 Leaving > 4.3 Notice period]
     Two years or more, it is eight weeks."
    → now "notice period" matches lexically AND semantically,
      and the answer is interpretable on its own

  LEVEL 2 — add a generated one-line situating sentence  ★★ best quality
    "[HR Handbook 2026 > 4 Leaving > 4.3 Notice period]
     This passage states the notice period required from employees
     with two or more years of service.
     Two years or more, it is eight weeks."
    → written once at ingestion by a cheap model; large recall gain

  LEVEL 3 — store small, retrieve small, SEND the parent
    index:   the focused 150-token chunk        (precise matching)
    context: the whole 800-token section        (complete answering)
    → resolves the tension instead of compromising on it.
      Often the best of all: match narrow, answer wide.`,
        },
        {
          t: 'code',
          lang: 'python',
          caption: 'Contextual chunks: generate the situating line once, at ingestion',
          code: `
CONTEXTUALISE = """<document>
{document}
</document>

<chunk>
{chunk}
</chunk>

Write ONE sentence that situates this chunk inside the document: what
it is about and what part of the document it belongs to. Resolve any
pronouns or references that only make sense in the wider document.
Output the sentence only, no preamble."""

def contextualise(document: str, chunk: str) -> str:
    # Haiku is the right tool here: cheap, fast, and the task is easy.
    # Cache the document prefix and this costs very little across a corpus.
    response = client.messages.create(
        model="claude-haiku-4-5", max_tokens=150,
        cache_control={"type": "ephemeral"},        # the document repeats
        messages=[{"role": "user",
                   "content": CONTEXTUALISE.format(document=document,
                                                   chunk=chunk)}],
    )
    line = "".join(b.text for b in response.content if b.type == "text")
    return f"{line.strip()}\\n\\n{chunk}"`,
        },
        {
          t: 'code',
          lang: 'python',
          caption: 'Small-to-big: index the precise chunk, hand the model the parent section',
          code: `
# At ingestion: store both, linked.
for section in sections:
    parent_id = store_parent(section.text)            # 800 tokens
    for child in split(section.text, max_tokens=150): # precise units
        index(vector=embed(with_heading(child, section.path)),
              text=child, meta={"parent_id": parent_id,
                                "heading": section.path})

# At query time: match on children, deduplicate, send parents.
hits = store.search(embed(question), k=10)
parent_ids = dict.fromkeys(h["meta"]["parent_id"] for h in hits)  # ordered set
passages = [load_parent(pid) for pid in list(parent_ids)[:4]]
# Four complete sections beat ten sentence fragments, every time.`,
        },
        {
          t: 'key',
          title: 'Always prepend the heading path — it is free and it works',
          text: 'The document title and heading chain cost you twenty tokens per chunk and improve both halves of retrieval at once: the vector gains topical signal, and a keyword search can now match "notice period" even when the chunk body never repeats the phrase. If you do only one thing from this chapter, do this one.',
        },
      ],
    },
    {
      id: 'parsing',
      title: 'Getting the text out in the first place',
      blocks: [
        {
          t: 'p',
          text: 'Chunking assumes you have clean text. Extraction is where the ugliest bugs live, and they are all silent: your pipeline runs fine and indexes garbage.',
        },
        {
          t: 'table',
          caption: 'Format by format, including the failure that catches people.',
          head: ['Format', 'Approach', 'The silent failure'],
          rows: [
            ['Markdown', 'Split on headings; keep the tree', 'Fenced code blocks split mid-function'],
            ['HTML', 'Strip nav, footer, cookie banners first', 'Boilerplate becomes 40% of every chunk and dominates the vectors'],
            ['PDF (text layer)', 'A real PDF library, then repair the layout', 'Two-column pages interleave into nonsense'],
            ['PDF (scanned)', 'OCR, or send the pages to a vision model', 'Silent empty text — zero-length chunks nobody notices'],
            ['Tables', 'One row group per chunk, header repeated', 'The header is in chunk 1 and the data in chunk 7'],
            ['Code', 'Parse the syntax tree; one function per chunk', 'Imports in one chunk, the function that needs them in another'],
            ['Slides', 'One slide plus its speaker notes', 'Text boxes emitted in creation order, not reading order'],
            ['Spreadsheets', 'Serialise each sheet as markdown rows', 'Merged cells and formulas turn into blanks'],
          ],
        },
        {
          t: 'warn',
          title: 'Two-column PDFs are the classic silent disaster',
          text: 'A naive text extraction reads across the page, so line one of column one is followed by line one of column two. The result is grammatical-looking nonsense that embeds without complaint and retrieves plausibly. **Always read fifty random chunks from a new corpus with your own eyes before you trust the index.** It takes ten minutes and it has saved more RAG projects than any model upgrade.',
        },
        {
          t: 'code',
          lang: 'python',
          caption: 'Ingestion-time quality gates — cheap, and they catch most extraction disasters',
          code: `
def quality_gate(chunk: str, source: str) -> list[str]:
    problems = []
    n = count_tokens(chunk)

    if n < 20:
        problems.append("too small to be useful — likely an extraction artefact")
    if n > 2000:
        problems.append("too large — the splitter failed to find a boundary")

    # Extraction garbage: heavy punctuation, no sentences, broken words.
    words = chunk.split()
    if words and sum(len(w) for w in words) / len(words) > 15:
        problems.append("implausible average word length — OCR or ligature damage")
    if chunk.count("\\ufffd") or chunk.count("�"):
        problems.append("replacement characters — encoding problem")
    if len(words) > 30 and chunk.count(". ") == 0:
        problems.append("no sentence boundaries — possible column interleaving")

    return problems

# Report the rate, do not silently drop. A 5% failure rate is a bug to fix;
# dropping 5% of the corpus without telling anyone is a bug to discover
# six months later when a specific question never works.
flagged = [(c, quality_gate(c, src)) for c, src in chunks]
bad = [(c, p) for c, p in flagged if p]
log.warning("%d/%d chunks flagged (%.1f%%)", len(bad), len(chunks),
            100 * len(bad) / len(chunks))`,
        },
        {
          t: 'tip',
          title: 'Use a vision model for documents that defeat extraction',
          text: 'For scanned pages, complex multi-column layouts, charts and forms, sending the page image to the model and asking for clean markdown often beats every text-extraction library — it understands reading order and can transcribe a table properly. It costs more per page, but it is a one-off ingestion cost against a permanent quality gain.',
        },
      ],
    },
    {
      id: 'metadata-and-updates',
      title: 'Metadata, ids and keeping the index current',
      blocks: [
        {
          t: 'p',
          text: 'A chunk is not just text. What you store alongside it decides whether you can filter, cite, audit, and — critically — update without rebuilding everything.',
        },
        {
          t: 'code',
          lang: 'python',
          caption: 'The record shape. Every field here earns its place.',
          code: `
{
  "id": "hr-handbook-2026#4.3#0",       # stable and deterministic
  "text": "[HR Handbook 2026 > 4.3 Notice period] Employees must...",
  "raw_text": "Employees must give written notice...",   # without the header
  "vector": [...],

  "meta": {
    "source_uri":  "s3://docs/hr-handbook-2026.pdf",
    "title":       "HR Handbook 2026",
    "heading_path": ["4 Leaving", "4.3 Notice period"],
    "page":        18,                  # for citations users can verify
    "doc_version": "2026",              # filterable
    "tenant_id":   "acme",              # access control, enforced in the query
    "language":    "en",
    "content_hash": "sha256:9f2a...",    # skip re-embedding unchanged chunks
    "embed_model": "embed-v3",          # detect a model mismatch
    "ingested_at": "2026-09-29T09:14:00Z",
  },
}`,
        },
        {
          t: 'ascii',
          caption: 'Re-indexing on change. Content-hashed ids turn a full rebuild into a small diff.',
          code: `
  DOCUMENT UPDATED
        │
        ▼
  1. chunk it again with the SAME strategy and the SAME id scheme
        │
        ▼
  2. compare content hashes against what is indexed
        │
        ├── unchanged  → skip entirely (no embedding cost)
        ├── changed    → re-embed, upsert by id
        └── absent now → DELETE by id           ← the step everyone forgets
        │
        ▼
  4. record the new doc_version

  Two rules that save you:
    • Deterministic ids. "chunk_7" breaks the moment a paragraph is
      inserted above it; "doc#section#index" plus a content hash does not.
    • Deletion is mandatory. An orphaned chunk from a retracted policy
      will be retrieved and cited with full confidence, forever.

  Changing the chunking STRATEGY, though, is a full re-index. Version it,
  and expect to rebuild — which is why measuring before you change matters.`,
        },
        {
          t: 'trap',
          title: 'Orphaned chunks are the worst RAG bug',
          text: 'A section is deleted from a policy, but its chunk stays in the index. Nothing errors. Months later the system cites a rule that no longer exists, complete with a page number, and a human acts on it. Deletion on re-index is not housekeeping — it is correctness. Reconcile the index against the source on a schedule and alert on any chunk whose source document no longer contains it.',
        },
      ],
    },
  ],

  patterns: [
    {
      id: 'heading-path-prefix',
      name: 'Prepend the Heading Path to Every Chunk',
      oneLiner: 'Twenty tokens that improve both lexical and semantic retrieval.',
      useWhen: ['Every structured document. This is the default, not an optimisation.'],
      recognize: ['Chunks that are meaningless read alone.', 'Retrieved text with no indication of which document or version it came from.'],
      steps: [
        'Keep the heading stack while parsing.',
        'Prepend `[Title > H1 > H2]` to the indexed text.',
        'Store `raw_text` separately so citations can quote the original cleanly.',
        'Re-measure recall — the gain is usually immediate and obvious.',
      ],
      template: {
        lang: 'python',
        caption: 'Carry the stack through the walk; the cost is one string join',
        code: `
def walk(node, stack=()):
    stack = stack + (node.heading,) if node.heading else stack
    for chunk in split(node.text):
        yield {
            "text": f"[{' > '.join(stack)}]\\n{chunk}",
            "raw_text": chunk,
            "meta": {"heading_path": list(stack)},
        }
    for child in node.children:
        yield from walk(child, stack)`,
      },
      complexity: 'About 20 tokens per chunk. Reliably one of the best returns in RAG.',
      gotchas: [
        'Index the prefixed text but cite the raw text, or your quotes look odd.',
        'Very deep heading chains get long — keep the last three levels.',
      ],
      problems: ['Add heading paths and re-measure recall', 'Compare with and without'],
    },
    {
      id: 'small-to-big',
      name: 'Small to Big: Match Narrow, Answer Wide',
      oneLiner: 'Index precise chunks; send the model their parent sections.',
      useWhen: ['Retrieval finds the right area but the answer is incomplete.'],
      recognize: ['Correct chunks retrieved, answers still missing detail.', 'A tug-of-war between chunk size for matching and for answering.'],
      steps: [
        'Split into small units for the index and keep a link to the parent section.',
        'Search over the small units.',
        'Deduplicate by parent and fetch the parents.',
        'Send four complete sections rather than ten fragments.',
      ],
      complexity: 'Double storage for text; the index itself is unchanged.',
      gotchas: [
        'Deduplicate by parent or you will send the same section three times.',
        'Parents must be bounded, or one huge section blows the context budget.',
      ],
      problems: ['Implement small-to-big', 'Compare answer completeness'],
    },
    {
      id: 'contextual-chunks',
      name: 'Generate a Situating Sentence at Ingestion',
      oneLiner: 'One cheap model call per chunk buys a large recall gain, permanently.',
      useWhen: ['High-value corpora where retrieval quality justifies an ingestion cost.'],
      recognize: ['Chunks full of unresolved pronouns and "as described above".', 'Recall stuck despite good chunk sizes.'],
      steps: [
        'For each chunk, prompt a cheap model with the whole document plus the chunk.',
        'Ask for one sentence situating it and resolving references.',
        'Cache the document prefix so the corpus costs a fraction of the naive price.',
        'Prepend the sentence and embed the result.',
      ],
      complexity: 'One Haiku call per chunk at ingestion; nothing extra at query time.',
      gotchas: [
        'Without prompt caching on the document, this gets expensive on a large corpus.',
        'Regenerate when the document changes, or the situating line goes stale.',
      ],
      problems: ['Add contextual chunks to 500 chunks', 'Measure the recall delta'],
    },
    {
      id: 'read-your-chunks',
      name: 'Read Fifty Random Chunks Before Trusting an Index',
      oneLiner: 'Extraction failures are silent, plausible, and everywhere.',
      useWhen: ['Every new corpus, every new source format, after every parser change.'],
      recognize: ['Nobody on the team has ever looked at the indexed text.', 'Confident retrieval of grammatical nonsense.'],
      steps: [
        'Sample fifty chunks at random and read them.',
        'Look for interleaved columns, missing headers, split code, empty text, replacement characters.',
        'Add automated quality gates for whatever you found.',
        'Report the flag rate; never silently drop.',
      ],
      complexity: 'Ten minutes. The highest-yield ten minutes in the project.',
      gotchas: [
        'Averages hide it — one bad format in five can be invisible in aggregate metrics.',
        'Empty chunks from failed OCR embed happily and retrieve occasionally.',
      ],
      problems: ['Find a real extraction bug by reading', 'Automate the check'],
    },
    {
      id: 'deterministic-ids',
      name: 'Deterministic Ids and Mandatory Deletion',
      oneLiner: 'Content-hashed ids make re-indexing a diff; deletion keeps it honest.',
      useWhen: ['Any corpus that changes — which is all of them.'],
      recognize: ['A full rebuild on every update.', 'Retrieved content from a document that was withdrawn.'],
      steps: [
        'Build ids from `doc#section#index` plus a content hash.',
        'On re-index, skip unchanged, upsert changed, **delete absent**.',
        'Reconcile index against source on a schedule and alert on orphans.',
        'Version the chunking strategy; a strategy change is a full re-index.',
      ],
      complexity: 'Re-embedding cost falls to the changed fraction.',
      gotchas: [
        'Positional ids break when a paragraph is inserted above them.',
        'Orphaned chunks never error — they just mislead, with a citation.',
      ],
      problems: ['Implement incremental re-index', 'Detect an orphan you planted'],
    },
  ],

  pitfalls: [
    { title: 'Fixed-size character splitting', text: 'Cuts mid-word and mid-argument. Use recursive or structural splitting.' },
    { title: 'Chunks that are meaningless alone', text: '"Two years or more, eight weeks" answers nothing. Prepend the heading path.' },
    { title: 'Embedding a whole document', text: 'The average of forty topics points at none of them.' },
    { title: 'Fifty percent overlap', text: 'Doubles cost and fills top-k with near-duplicates.' },
    { title: 'Splitting a table from its header', text: 'The rows become uninterpretable numbers.' },
    { title: 'Splitting code mid-function', text: 'Chunk on the syntax tree, not on line count.' },
    { title: 'Trusting PDF extraction', text: 'Two-column layouts interleave into plausible nonsense.' },
    { title: 'Not reading your own chunks', text: 'Ten minutes of reading beats a week of model swapping.' },
    { title: 'Silently dropping bad chunks', text: 'Report the rate. A silent drop is a question that never works.' },
    { title: 'Positional chunk ids', text: 'One inserted paragraph shifts everything and breaks incremental updates.' },
    { title: 'Never deleting on re-index', text: 'Orphaned chunks are cited confidently long after the source is gone.' },
    { title: 'Changing chunk strategy without re-indexing', text: 'You now have two incompatible chunkings in one index.' },
  ],

  cheatsheet: [
    { label: 'Chunk test', value: 'self-contained for its question?' },
    { label: 'Default strategy', value: 'recursive on natural boundaries' },
    { label: 'Best where possible', value: 'structural — headings, clauses, functions' },
    { label: 'Prose size', value: '300–600 tokens' },
    { label: 'Overlap', value: '10–15%, never 50%' },
    { label: 'Always do', value: 'prepend the heading path' },
    { label: 'Best quality', value: 'contextual chunks + small-to-big' },
    { label: 'Tables', value: 'repeat the header in every chunk' },
    { label: 'Code', value: 'one function per chunk' },
    { label: 'Q&A', value: 'one pair per chunk, no overlap' },
    { label: 'Hard PDFs', value: 'send the page to a vision model' },
    { label: 'Before trusting', value: 'read fifty random chunks' },
    { label: 'Ids', value: 'deterministic + content hash' },
    { label: 'On re-index', value: 'skip, upsert, and DELETE' },
    { label: 'Store', value: 'text, raw_text, heading path, page, version, tenant' },
  ],

  problems: [
    { name: 'Chunk one document five ways and read the output', difficulty: 'Easy', pattern: 'Strategies', insight: 'Fixed characters, fixed tokens, recursive, by heading, whole document. Reading the fixed-character output is the fastest way to never use it again.' },
    { name: 'Find a chunk that is meaningless alone', difficulty: 'Easy', pattern: 'Self-containment', insight: 'Search your own index for a chunk starting with "This" or "It". Then add heading paths and look again.' },
    { name: 'Add heading paths and measure', difficulty: 'Easy', pattern: 'Context injection', insight: 'Recall@10 on your gold set, before and after. The gain from twenty tokens per chunk surprises people.' },
    { name: 'Break a table in half', difficulty: 'Medium', pattern: 'Structural chunking', insight: 'Split a rates table so the header lands in a different chunk, then ask a question about it. The answer is confident and wrong. Repeat the header and it works.' },
    { name: 'Interleave a two-column PDF', difficulty: 'Medium', pattern: 'Extraction', insight: 'Extract a real two-column paper naively and read the output. It is grammatical and meaningless — the exact profile of a bug that survives to production.' },
    { name: 'Sweep chunk size against recall', difficulty: 'Medium', pattern: 'Sizing', insight: '150, 300, 600, 1200 tokens on the same corpus and gold set. Plot the curve. Your optimum is probably not the default you were using.' },
    { name: 'Implement small-to-big', difficulty: 'Medium', pattern: 'Small to big', insight: 'Index 150-token children, retrieve, deduplicate by parent, send 800-token parents. Compare answer completeness on questions that need surrounding detail.' },
    { name: 'Add contextual chunks with a cheap model', difficulty: 'Hard', pattern: 'Contextual retrieval', insight: 'Generate a situating sentence per chunk with Haiku, caching the document prefix. Measure both the recall gain and the actual ingestion bill.' },
    { name: 'Build the incremental re-index', difficulty: 'Hard', pattern: 'Updates', insight: 'Content hashes, deterministic ids, skip/upsert/delete. Then change one paragraph in a large document and confirm only one chunk is re-embedded.' },
    { name: 'Plant an orphan and catch it', difficulty: 'Hard', pattern: 'Orphan detection', insight: 'Delete a section from the source, re-index without the delete step, and get the system to cite the removed policy. Then write the reconciliation job that catches it.' },
  ],
}
