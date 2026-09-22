export default {
  id: 'advanced-structures',
  title: 'Segment Trees, Fenwick Trees & Advanced Structures',
  short: 'Advanced Structures',
  icon: 'ArchitectureRounded',
  tier: 'Elite',
  order: 21,
  estHours: 10,
  prereqs: ['trees', 'bit-manipulation'],
  tagline: 'For when the array changes *and* you must keep answering range queries.',
  mentalModel:
    'A prefix-sum array answers range queries in O(1) but costs O(n) per update. A plain array updates in O(1) but costs O(n) per query. Segment and Fenwick trees split the difference: O(log n) for both. That trade is the entire reason they exist.',
  whyItMatters:
    'These rarely appear in a standard 45-minute screen, but they are decisive in competitive programming and in senior interviews where "the data is mutable" is the follow-up. Knowing when a problem *needs* one is more valuable than being able to write one from memory.',

  complexity: [
    { op: 'Fenwick (BIT) update / prefix query', time: 'O(log n)', space: 'O(n)', note: 'Smallest constant factor; ~15 lines' },
    { op: 'Segment tree build', time: 'O(n)', space: 'O(4n)', note: 'Bottom-up construction' },
    { op: 'Segment tree query / update', time: 'O(log n)', space: '—', note: 'Any associative operation' },
    { op: 'Segment tree with lazy propagation', time: 'O(log n)', space: 'O(4n)', note: 'Range updates as well as range queries' },
    { op: 'Sparse table', time: 'O(n log n) build, O(1) query', space: 'O(n log n)', note: 'Immutable data only; idempotent operations' },
    { op: 'TreeMap / balanced BST', time: 'O(log n)', space: 'O(n)', note: 'Ordered set with rank-ish queries' },
    { op: 'Sqrt decomposition', time: 'O(√n)', space: 'O(√n)', note: 'Easiest to write; often fast enough' },
  ],

  sections: [
    {
      id: 'choosing',
      title: 'Which structure does this problem need?',
      blocks: [
        {
          t: 'table',
          head: ['Queries', 'Updates', 'Use'],
          rows: [
            ['Range sum', 'none (immutable)', '**Prefix sums** — O(1) query, trivial to write'],
            ['Range sum', 'point update', '**Fenwick tree** — smallest and fastest'],
            ['Range min/max/gcd', 'point update', '**Segment tree**'],
            ['Range min/max', 'none (immutable)', '**Sparse table** — O(1) query'],
            ['Range sum', 'range update', '**Fenwick ×2** or **lazy segment tree**'],
            ['Range anything', 'range update', '**Segment tree with lazy propagation**'],
            ['Order statistics (k-th smallest, rank)', 'insert/delete', '**BIT over compressed values**, or a balanced BST'],
            ['Anything, and you have 10 minutes', 'anything', '**Sqrt decomposition** — O(√n), far easier to get right'],
          ],
        },
        {
          t: 'key',
          title: 'The recognition signal',
          text: 'The phrase *"the array may be modified"* alongside *"many range queries"* is the tell. Without updates, prefix sums or a sparse table are strictly better. With updates, the `O(n)` rebuild cost of prefix sums is what kills you — and that is exactly the gap these structures fill.',
        },
      ],
    },
    {
      id: 'fenwick',
      title: 'Fenwick tree (Binary Indexed Tree)',
      blocks: [
        { t: 'p', text: 'The Fenwick tree is the smallest structure that gives `O(log n)` prefix sums with point updates. Each index `i` is responsible for a range of length `lowbit(i) = i & -i`, and traversal moves by adding or subtracting that value.' },
        {
          t: 'ascii',
          caption: 'Index i covers lowbit(i) elements ending at i. Queries walk down, updates walk up.',
          code: `
  i      binary   lowbit   covers
  1      0001       1      [1,1]
  2      0010       2      [1,2]
  3      0011       1      [3,3]
  4      0100       4      [1,4]
  6      0110       2      [5,6]
  8      1000       8      [1,8]

  query(7) = tree[7] + tree[6] + tree[4]      7 -> 6 -> 4 -> 0
  update(3) touches 3 -> 4 -> 8               add lowbit each time`,
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'The whole structure — fifteen lines, and it is 1-indexed for a reason',
          code: `
class Fenwick {
    private final long[] tree;
    private final int n;

    Fenwick(int n) { this.n = n; tree = new long[n + 1]; }   // 1-INDEXED

    /** add delta at position i (1-indexed) */
    void update(int i, long delta) {
        for (; i <= n; i += i & -i) tree[i] += delta;        // walk UP
    }

    /** sum of [1, i] */
    long query(int i) {
        long s = 0;
        for (; i > 0; i -= i & -i) s += tree[i];             // walk DOWN
        return s;
    }

    /** sum of [l, r], both 1-indexed */
    long range(int l, int r) { return query(r) - query(l - 1); }
}`,
        },
        {
          t: 'trap',
          title: 'One-indexing is not a style choice',
          text: '`i & -i` is zero when `i` is zero, so a 0-indexed Fenwick tree loops forever. Always size the array `n + 1` and translate external indices by adding 1. Every Fenwick bug you will ever have is an off-by-one here.',
        },
        {
          t: 'tip',
          title: 'The killer application: counting inversions',
          text: 'To count "how many earlier elements are greater than me", compress the values into `1..n`, then sweep the array: query the BIT for how many values greater than the current one have been inserted, then insert the current one. That solves Count of Smaller Numbers After Self in `O(n log n)`.',
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'Coordinate compression — the companion technique',
          code: `
// Values may be up to 1e9, but there are only n of them.
// Map them to ranks 1..n so they can index a BIT or a segment tree.
int[] sorted = nums.clone();
Arrays.sort(sorted);

Map<Integer,Integer> rank = new HashMap<>();
int r = 0;
for (int v : sorted) if (!rank.containsKey(v)) rank.put(v, ++r);

// now rank.get(nums[i]) is a small index in [1, n]`,
        },
      ],
    },
    {
      id: 'segtree',
      title: 'Segment tree',
      blocks: [
        { t: 'p', text: 'More general than a Fenwick tree: it supports **any associative operation** (min, max, gcd, sum, "number of 1s"), and with lazy propagation it supports range updates too. The cost is more code.' },
        {
          t: 'ascii',
          caption: 'Each node owns a range; children split it in half.',
          code: `
                  [0..7] sum=36
                 /             \\
          [0..3] sum=6        [4..7] sum=30
           /      \\             /       \\
    [0..1]=1   [2..3]=5   [4..5]=9   [6..7]=21
     /   \\      /   \\      /   \\      /    \\
    0     1    2     3    4     5    6      7

  Query [2..5] decomposes into [2..3] + [4..5]  ->  O(log n) nodes`,
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'Iterative segment tree — shorter and faster than the recursive version',
          code: `
class SegmentTree {
    private final int n;
    private final int[] t;

    SegmentTree(int[] a) {
        n = a.length;
        t = new int[2 * n];
        System.arraycopy(a, 0, t, n, n);                  // leaves live at [n, 2n)
        for (int i = n - 1; i > 0; i--)
            t[i] = combine(t[2 * i], t[2 * i + 1]);       // build internal nodes
    }

    private int combine(int a, int b) { return a + b; }   // swap for min/max/gcd

    void update(int i, int value) {
        for (t[i += n] = value; i > 1; i >>= 1)
            t[i >> 1] = combine(t[i], t[i ^ 1]);          // i ^ 1 is the sibling
    }

    /** query over [l, r) — half open */
    int query(int l, int r) {
        int resL = 0, resR = 0;                           // identity for the operation
        for (l += n, r += n; l < r; l >>= 1, r >>= 1) {
            if ((l & 1) == 1) resL = combine(resL, t[l++]);
            if ((r & 1) == 1) resR = combine(t[--r], resR);
        }
        return combine(resL, resR);
    }
}`,
        },
        {
          t: 'warn',
          title: 'Keep the two accumulators separate',
          text: 'For non-commutative operations (string concatenation, matrix multiplication) the left and right partial results must be combined in the correct order at the end. Using a single accumulator silently breaks those cases even though it looks fine for sum and min.',
        },
        {
          t: 'note',
          title: 'Lazy propagation, in one paragraph',
          text: 'To support *range* updates, store a pending "lazy" value on each node meaning "this whole range still needs this applied". On the way down a query or update, push the pending value to the children before descending. This keeps every operation `O(log n)` at the cost of roughly doubling the code. Know that it exists and what it solves; writing it from memory is rarely expected.',
        },
      ],
    },
    {
      id: 'others',
      title: 'Sparse tables, sqrt decomposition and ordered sets',
      blocks: [
        { t: 'h', text: 'Sparse table — O(1) range min/max on immutable data' },
        {
          t: 'code',
          lang: 'java',
          caption: 'Precompute powers of two; every query is two overlapping lookups',
          code: `
int[][] sparse;  int[] log;

void build(int[] a) {
    int n = a.length, K = 32 - Integer.numberOfLeadingZeros(n);
    log = new int[n + 1];
    for (int i = 2; i <= n; i++) log[i] = log[i / 2] + 1;

    sparse = new int[K + 1][n];
    sparse[0] = a.clone();
    for (int k = 1; k <= K; k++)
        for (int i = 0; i + (1 << k) <= n; i++)
            sparse[k][i] = Math.min(sparse[k-1][i], sparse[k-1][i + (1 << (k-1))]);
}

int queryMin(int l, int r) {          // inclusive
    int k = log[r - l + 1];
    return Math.min(sparse[k][l], sparse[k][r - (1 << k) + 1]);   // overlap is fine
}`,
        },
        {
          t: 'key',
          title: 'Why overlap is allowed',
          text: 'Min and max are **idempotent** — counting an element twice does not change the answer. That is what makes the two-lookup `O(1)` query legal. It does **not** work for sum, which is why sparse tables are min/max/gcd-only.',
        },
        { t: 'h', text: 'Sqrt decomposition — the pragmatic fallback' },
        { t: 'p', text: 'Split the array into blocks of size `√n` and keep an aggregate per block. A query touches at most two partial blocks and `√n` whole ones. It is `O(√n)` rather than `O(log n)`, but for `n = 10⁵` that is ~316 operations, which is usually fast enough — and you can write it correctly in five minutes under pressure.' },
        {
          t: 'code',
          lang: 'java',
          caption: 'Sqrt decomposition for range sums',
          code: `
int blockSize; long[] blockSum; int[] a;

void build(int[] arr) {
    a = arr;
    blockSize = (int) Math.sqrt(a.length) + 1;
    blockSum = new long[a.length / blockSize + 1];
    for (int i = 0; i < a.length; i++) blockSum[i / blockSize] += a[i];
}

void update(int i, int value) {
    blockSum[i / blockSize] += value - a[i];
    a[i] = value;
}

long query(int l, int r) {               // inclusive
    long s = 0;
    while (l <= r && l % blockSize != 0) s += a[l++];        // partial head
    while (l + blockSize - 1 <= r) { s += blockSum[l / blockSize]; l += blockSize; }
    while (l <= r) s += a[l++];                              // partial tail
    return s;
}`,
        },
        { t: 'h', text: 'Ordered sets in Java' },
        {
          t: 'note',
          title: 'Java has no built-in order-statistic tree',
          text: 'C++ has `order_of_key`; Java does not. `TreeMap`/`TreeSet` give you `floor`, `ceiling`, `higher`, `lower`, `headMap` and `subMap` in `O(log n)`, but **not** "the k-th smallest" in log time. If you need rank queries, build a **BIT over compressed values** — that is the idiomatic Java answer, and saying so demonstrates real familiarity with the language.',
        },
      ],
    },
  ],

  patterns: [
    {
      id: 'bit-prefix',
      name: 'Fenwick Tree (point update, prefix query)',
      oneLiner: 'Mutable prefix sums in O(log n) with fifteen lines of code.',
      useWhen: ['Range sums with point updates.', 'Counting how many inserted values are below/above a threshold.'],
      recognize: ['"Range Sum Query - Mutable", "count of smaller numbers after self", "count inversions".'],
      steps: ['1-index everything.', '`update` walks up adding `i & -i`; `query` walks down subtracting it.', 'Compress values first when they are large.'],
      complexity: 'O(log n) per operation, O(n) space.',
      gotchas: ['Never 0-index — `i & -i` is 0 and the loop hangs.', 'Use `long` for sums.', 'Range sum is `query(r) − query(l−1)`.'],
      problems: ['Range Sum Query - Mutable', 'Count of Smaller Numbers After Self', 'Reverse Pairs', 'Create Sorted Array through Instructions'],
    },
    {
      id: 'segment-tree',
      name: 'Segment Tree',
      oneLiner: 'Any associative range query with point (or, with lazy, range) updates.',
      useWhen: ['Range min/max/gcd/sum with updates.', 'Queries whose combine step is not invertible (so a BIT will not do).'],
      recognize: ['"Range minimum/maximum query with updates", "longest increasing run in a range".'],
      steps: ['Leaves at `[n, 2n)`, internal nodes built bottom-up.', 'Query by walking both boundaries inward.', 'Swap the `combine` function for a different operation.'],
      complexity: 'O(n) build, O(log n) query and update, O(2n) space (iterative) or O(4n) (recursive).',
      gotchas: [
        'Keep left and right accumulators separate for non-commutative merges.',
        'The identity element must be correct: 0 for sum, `+∞` for min, `−∞` for max.',
        'Range updates require lazy propagation — a point-update tree cannot do them efficiently.',
      ],
      problems: ['Range Sum Query - Mutable', 'Range Minimum Query', 'My Calendar III', 'Falling Squares', 'Rectangle Area II'],
    },
    {
      id: 'coordinate-compression',
      name: 'Coordinate Compression',
      oneLiner: 'Replace huge values with their ranks so they can index an array.',
      useWhen: ['Values up to 10⁹ but only 10⁵ of them.', 'Any BIT or segment tree indexed by value rather than position.'],
      recognize: ['Sparse coordinates, "the values can be up to 10⁹".'],
      steps: ['Sort the distinct values.', 'Map each to its 1-based rank.', 'Use the rank as the index.'],
      complexity: 'O(n log n) to build, O(1) or O(log n) per lookup.',
      gotchas: ['De-duplicate before ranking.', 'For interval endpoints, you may need to compress both `x` and `x+1` so that gaps are representable.'],
      problems: ['Count of Smaller Numbers After Self', 'Falling Squares', 'Rectangle Area II', 'The Skyline Problem'],
    },
    {
      id: 'sparse-table',
      name: 'Sparse Table',
      oneLiner: 'O(1) range min/max on data that never changes.',
      useWhen: ['Immutable array, many min/max/gcd range queries.'],
      recognize: ['"Range minimum query" with no updates mentioned.'],
      steps: ['Precompute answers for every power-of-two length.', 'Answer a query with two overlapping blocks.'],
      complexity: 'O(n log n) build and space, O(1) per query.',
      gotchas: ['Only valid for **idempotent** operations — never for sum.', 'Any update forces a full rebuild.'],
      problems: ['Range Minimum Query', 'Longest Subarray With Absolute Diff Less Than or Equal to Limit'],
    },
    {
      id: 'sqrt-decomposition',
      name: 'Sqrt Decomposition',
      oneLiner: 'Block aggregates give O(√n) for almost anything, with a fraction of the code.',
      useWhen: ['You need a range structure but cannot risk a buggy segment tree.', 'Operations that do not decompose cleanly into a tree.'],
      recognize: ['n ≤ 10⁵ and the query count is modest.'],
      steps: ['Block size ≈ √n.', 'Maintain a per-block aggregate.', 'Queries handle two partial blocks plus whole blocks in between.'],
      complexity: 'O(√n) per operation.',
      gotchas: ['Handle the case where the whole query fits inside one block.', 'Rebuild the affected block aggregate on update.'],
      problems: ['Range Sum Query - Mutable', 'Design a Number Container System'],
    },
  ],

  pitfalls: [
    { title: '0-indexing a Fenwick tree', text: 'Infinite loop, guaranteed. Always 1-index.' },
    { title: 'Using a sparse table for sums', text: 'Overlapping blocks double-count. Idempotent operations only.' },
    { title: 'Building a segment tree when prefix sums suffice', text: 'If the data is immutable, prefix sums are simpler and faster.' },
    { title: 'Wrong identity element', text: '0 for sum, `Integer.MAX_VALUE` for min, `MIN_VALUE` for max. A wrong identity gives subtly wrong answers only on edge queries.' },
    { title: 'Forgetting to compress coordinates', text: 'Allocating an array of size 10⁹ is an immediate out-of-memory error.' },
    { title: 'Attempting range updates without lazy propagation', text: 'It degrades to O(n log n) per update — worse than a plain array.' },
  ],

  cheatsheet: [
    { label: 'Immutable + range sum', value: 'prefix sums' },
    { label: 'Point update + range sum', value: 'Fenwick tree' },
    { label: 'Point update + range min/max', value: 'segment tree' },
    { label: 'Range update + range query', value: 'lazy segment tree' },
    { label: 'Immutable + range min', value: 'sparse table, O(1)' },
    { label: 'Need it working fast', value: 'sqrt decomposition' },
    { label: 'lowbit', value: 'i & −i' },
    { label: 'Fenwick update', value: 'i += i & −i' },
    { label: 'Fenwick query', value: 'i −= i & −i' },
    { label: 'Fenwick indexing', value: '1-based, always' },
    { label: 'Segment tree leaves', value: 'at [n, 2n)' },
    { label: 'Sibling of i', value: 'i ^ 1' },
    { label: 'Big values', value: 'compress to ranks first' },
  ],

  problems: [
    { name: 'Range Sum Query - Immutable', difficulty: 'Easy', url: 'https://leetcode.com/problems/range-sum-query-immutable/', pattern: 'Prefix sums', insight: 'The baseline — establishes why updates are the hard part.' },
    { name: 'Range Sum Query - Mutable', difficulty: 'Medium', url: 'https://leetcode.com/problems/range-sum-query-mutable/', pattern: 'Fenwick / segment tree', insight: 'The canonical introduction to both structures.' },
    { name: 'Range Sum Query 2D - Immutable', difficulty: 'Medium', url: 'https://leetcode.com/problems/range-sum-query-2d-immutable/', pattern: '2-D prefix sums', insight: 'Inclusion–exclusion on a padded table.' },
    { name: 'My Calendar I', difficulty: 'Medium', url: 'https://leetcode.com/problems/my-calendar-i/', pattern: 'TreeMap', insight: 'floorKey and ceilingKey bound the only possible conflicts.' },
    { name: 'My Calendar III', difficulty: 'Hard', url: 'https://leetcode.com/problems/my-calendar-iii/', pattern: 'Sweep / segment tree', insight: 'A TreeMap of deltas is enough; a lazy segment tree is the scalable version.' },
    { name: 'Count of Smaller Numbers After Self', difficulty: 'Hard', url: 'https://leetcode.com/problems/count-of-smaller-numbers-after-self/', pattern: 'BIT + compression', insight: 'Sweep right to left, querying how many smaller values are already inserted.' },
    { name: 'Reverse Pairs', difficulty: 'Hard', url: 'https://leetcode.com/problems/reverse-pairs/', pattern: 'BIT / merge sort', insight: 'Compress both `x` and `2x` so the threshold is representable.' },
    { name: 'Create Sorted Array through Instructions', difficulty: 'Hard', url: 'https://leetcode.com/problems/create-sorted-array-through-instructions/', pattern: 'BIT', insight: 'Count strictly-less and strictly-greater at each insertion and take the minimum.' },
    { name: 'Falling Squares', difficulty: 'Hard', url: 'https://leetcode.com/problems/falling-squares/', pattern: 'Segment tree / compression', insight: 'Range max query with range assignment; coordinates must be compressed.' },
    { name: 'The Skyline Problem', difficulty: 'Hard', url: 'https://leetcode.com/problems/the-skyline-problem/', pattern: 'Sweep + heap', insight: 'A segment tree also works, but the event sweep is cleaner.' },
    { name: 'Rectangle Area II', difficulty: 'Hard', url: 'https://leetcode.com/problems/rectangle-area-ii/', pattern: 'Sweep + segment tree', insight: 'Sweep over x, maintaining the covered y-length with a lazy segment tree.' },
    { name: 'Longest Continuous Subarray With Absolute Diff Less Than or Equal to Limit', difficulty: 'Medium', url: 'https://leetcode.com/problems/longest-continuous-subarray-with-absolute-diff-less-than-or-equal-to-limit/', pattern: 'Monotonic deques', insight: 'Two deques beat a segment tree here — always check for the simpler tool first.' },
  ],
}
