export default {
  id: 'arrays',
  title: 'Arrays, Prefix Sums & In-Place Tricks',
  short: 'Arrays',
  icon: 'GridViewRounded',
  tier: 'Foundations',
  order: 2,
  estHours: 14,
  prereqs: ['complexity'],
  tagline: 'The substrate of everything. Master contiguous memory and half of DSA stops being scary.',
  mentalModel:
    'An array is a ruler: `O(1)` to read any mark, `O(n)` to insert a new one. Every array technique is a way of avoiding a second walk down the ruler.',
  whyItMatters:
    'Arrays are the default input format for roughly 60% of interview questions. More importantly, the three ideas in this chapter — prefix sums, in-place partitioning and index-as-key — reappear inside DP, graphs and strings for the rest of your career.',

  complexity: [
    { op: 'Access by index `a[i]`', time: 'O(1)', space: '—', note: 'Address arithmetic, nothing more' },
    { op: 'Search (unsorted)', time: 'O(n)', space: 'O(1)', note: 'Must touch every element' },
    { op: 'Search (sorted)', time: 'O(log n)', space: 'O(1)', note: 'Binary search' },
    { op: 'Insert / delete at end', time: 'O(1)*', space: '—', note: 'Amortised for dynamic arrays' },
    { op: 'Insert / delete at index i', time: 'O(n)', space: '—', note: 'Shifts n − i elements' },
    { op: 'Build prefix sums', time: 'O(n)', space: 'O(n)', note: 'Then any range sum is O(1)' },
    { op: 'Range update via difference array', time: 'O(1)', space: 'O(n)', note: 'Finalise with one O(n) pass' },
    { op: 'Sort', time: 'O(n log n)', space: 'O(log n)–O(n)', note: 'Depends on primitive vs object in Java' },
  ],

  sections: [
    {
      id: 'foundations',
      title: 'What an array actually is',
      blocks: [
        { t: 'p', text: 'An array is a **contiguous block of memory** holding equally sized cells. That one physical fact explains every complexity in the table above: the address of `a[i]` is `base + i × cellSize`, which is arithmetic, so access is `O(1)`. Inserting in the middle requires physically moving everything after it, so it is `O(n)`.' },
        {
          t: 'ascii',
          caption: 'Contiguity is the whole story — and it is also why arrays beat linked lists in practice.',
          code: `
index:     0     1     2     3     4     5
         +-----+-----+-----+-----+-----+-----+
array:   |  7  |  2  |  9  |  4  |  1  |  8  |
         +-----+-----+-----+-----+-----+-----+
addr:    1000  1004  1008  1012  1016  1020     (4-byte ints)

a[3]  ->  1000 + 3*4  =  1012        O(1), pure arithmetic
insert at index 1  ->  shift 2,9,4,1,8 right    O(n), real work`,
        },
        {
          t: 'key',
          title: 'Cache locality is a real, measurable advantage',
          text: 'Because array cells sit next to each other, reading `a[i]` pulls `a[i+1..i+15]` into CPU cache for free. A linear scan of an array is often *10× faster in wall-clock time* than a linear scan of a linked list with the same Big-O. When an interviewer asks "array or linked list?", this is the answer they are hoping for.',
        },
        { t: 'h', text: 'Java specifics worth knowing' },
        {
          t: 'dl',
          items: [
            { term: '`int[]` vs `Integer[]`', def: 'Primitives are packed and fast. `Integer[]` stores pointers to boxed objects — slower, more memory, and `==` compares references. `Arrays.sort` is dual-pivot quicksort for primitives but stable TimSort for objects.' },
            { term: '`Arrays.fill(a, v)`', def: 'Initialise in one line. For 2-D you must loop rows, or use `for (int[] row : grid) Arrays.fill(row, v);`.' },
            { term: '`System.arraycopy` / `Arrays.copyOfRange`', def: 'The fast way to copy or slice. Both are `O(k)` in the copied length — never free.' },
            { term: '`List.toArray(new int[0])` does not exist for primitives', def: 'Use streams: `list.stream().mapToInt(Integer::intValue).toArray()`.' },
          ],
        },
      ],
    },
    {
      id: 'prefix',
      title: 'Prefix sums — turning range queries into subtraction',
      blocks: [
        { t: 'lead', text: 'If you will be asked for the sum of many ranges, compute the running totals once. Every range sum then becomes a single subtraction.' },
        { t: 'p', text: 'Define `P[0] = 0` and `P[i] = a[0] + … + a[i−1]`. Then `sum(a[l..r])` (inclusive) is `P[r+1] − P[l]`. Using a length `n+1` prefix array with a leading zero removes every off-by-one headache — **always do it this way**.' },
        {
          t: 'code',
          lang: 'java',
          caption: 'The canonical 1-D prefix sum',
          code: `
int[] buildPrefix(int[] a) {
    int n = a.length;
    long[] tmp = new long[n + 1];           // use long if values can be large
    int[] p = new int[n + 1];               // p[0] = 0 sentinel is the whole trick
    for (int i = 0; i < n; i++) p[i + 1] = p[i] + a[i];
    return p;
}

// inclusive range sum a[l..r] in O(1)
int rangeSum(int[] p, int l, int r) {
    return p[r + 1] - p[l];
}`,
        },
        { t: 'h', text: 'Prefix sums + hash map: the highest-yield combination in arrays' },
        { t: 'p', text: 'The question "how many subarrays sum to `k`?" looks like it needs all `O(n²)` subarrays. It does not. A subarray `(l..r)` sums to `k` exactly when `P[r+1] − P[l] = k`, i.e. `P[l] = P[r+1] − k`. So as you sweep `r`, you just need to know **how many earlier prefixes had the value `P[r+1] − k`** — that is a hash map lookup.' },
        {
          t: 'code',
          lang: 'java',
          caption: 'Subarray Sum Equals K — the template to memorise',
          code: `
int subarraySum(int[] a, int k) {
    Map<Integer, Integer> count = new HashMap<>();
    count.put(0, 1);                 // the empty prefix — do NOT forget this
    int running = 0, answer = 0;

    for (int x : a) {
        running += x;
        answer += count.getOrDefault(running - k, 0);   // close off earlier prefixes
        count.merge(running, 1, Integer::sum);          // then register myself
    }
    return answer;
}`,
        },
        {
          t: 'trap',
          title: 'Order matters inside the loop',
          text: 'Query *before* you insert the current prefix. If you insert first, a zero-length subarray can match when `k = 0` and your count is wrong. And `count.put(0, 1)` seeds the case where the prefix itself equals `k`.',
        },
        { t: 'h', text: 'The variants you should recognise instantly' },
        {
          t: 'table',
          head: ['Problem shape', 'What to store in the map', 'Why'],
          rows: [
            ['Count subarrays with sum = k', '`prefixSum → count`', 'Need how many, so count occurrences'],
            ['Longest subarray with sum = k', '`prefixSum → earliest index`', 'Longest ⇒ keep the first occurrence only'],
            ['Subarray sum divisible by k', '`prefixSum mod k → count`', 'Equal remainders cancel'],
            ['Longest subarray with equal 0s and 1s', 'map `prefix` where 0 counts as −1', 'Equality becomes "sum = 0"'],
            ['Continuous subarray sum (multiple of k)', '`prefix mod k → earliest index`', 'Need length ≥ 2, so compare indices'],
            ['2-D submatrix sum', '2-D prefix `P[i][j]`', 'Inclusion–exclusion, see below'],
          ],
        },
        {
          t: 'code',
          lang: 'java',
          caption: '2-D prefix sums — inclusion–exclusion',
          code: `
// P[i][j] = sum of the rectangle from (0,0) to (i-1, j-1)
int[][] build2D(int[][] g) {
    int m = g.length, n = g[0].length;
    int[][] P = new int[m + 1][n + 1];
    for (int i = 0; i < m; i++)
        for (int j = 0; j < n; j++)
            P[i+1][j+1] = g[i][j] + P[i][j+1] + P[i+1][j] - P[i][j];
    return P;
}

// sum of rectangle with corners (r1,c1) .. (r2,c2), inclusive
int rect(int[][] P, int r1, int c1, int r2, int c2) {
    return P[r2+1][c2+1] - P[r1][c2+1] - P[r2+1][c1] + P[r1][c1];
}`,
        },
        {
          t: 'tip',
          title: 'Remember the shape, not the signs',
          text: 'Big rectangle, minus the strip above, minus the strip to the left, **plus** the corner you subtracted twice. Draw it once and the signs are obvious forever.',
        },
      ],
    },
    {
      id: 'difference',
      title: 'Difference arrays — O(1) range updates',
      blocks: [
        { t: 'p', text: 'Prefix sums answer range *queries* fast. The difference array is its mirror: it applies range *updates* fast. If you must add `v` to every element in `[l, r]` many times and only read the array at the end, do not touch the range.' },
        {
          t: 'code',
          lang: 'java',
          caption: 'Range update in O(1), finalise in O(n)',
          code: `
int[] diff = new int[n + 1];

void addRange(int l, int r, int v) {    // inclusive
    diff[l] += v;
    diff[r + 1] -= v;                   // the +1 slot is why we size n+1
}

int[] finalize(int n, int[] diff) {
    int[] a = new int[n];
    int running = 0;
    for (int i = 0; i < n; i++) { running += diff[i]; a[i] = running; }
    return a;
}`,
        },
        {
          t: 'key',
          title: 'This is the "meeting rooms / car pooling" pattern',
          text: 'Any problem of the form "intervals arrive, tell me the maximum overlap" is a difference array in disguise: `+1` at each start, `−1` at each end, then a running sum. If coordinates are large, sort the events instead — that is the sweep line, covered in the Intervals chapter.',
        },
      ],
    },
    {
      id: 'kadane',
      title: 'Kadane — the DP hiding inside an array problem',
      blocks: [
        { t: 'p', text: 'Maximum subarray sum is the gateway to dynamic programming. The insight: define `best(i)` as the maximum sum of a subarray **that ends exactly at i**. Then the recurrence writes itself — either you extend the previous best, or you start fresh at `i`.' },
        {
          t: 'code',
          lang: 'java',
          caption: 'Kadane, with the index tracking interviewers ask for as a follow-up',
          code: `
int maxSubArray(int[] a) {
    int best = a[0];              // global answer
    int cur  = a[0];              // best subarray ending at i
    for (int i = 1; i < a.length; i++) {
        cur  = Math.max(a[i], cur + a[i]);   // start fresh, or extend
        best = Math.max(best, cur);
    }
    return best;
}

// Follow-up: return the actual subarray bounds
int[] maxSubArrayIndices(int[] a) {
    int best = a[0], cur = a[0], s = 0, bl = 0, br = 0;
    for (int i = 1; i < a.length; i++) {
        if (cur + a[i] < a[i]) { cur = a[i]; s = i; }   // restarting here
        else                   { cur = cur + a[i]; }
        if (cur > best) { best = cur; bl = s; br = i; }
    }
    return new int[]{ bl, br };
}`,
        },
        {
          t: 'warn',
          title: 'All-negative arrays',
          text: 'Initialising `best = 0` silently returns 0 for `[-3, -1, -2]`. Initialise from `a[0]` instead. This is the single most common Kadane bug.',
        },
        {
          t: 'tip',
          title: 'Kadane variants worth drilling',
          text: '**Max product** — track both max and min, because a negative flips them. **Circular max sum** — answer is `max(normal Kadane, total − minKadane)`, with a guard for all-negative. **Max sum with one deletion** — two DP states, one "no deletion used", one "deletion used".',
        },
      ],
    },
    {
      id: 'inplace',
      title: 'In-place surgery: partitions, rotations and index-as-key',
      blocks: [
        { t: 'h', text: 'Dutch National Flag — three-way partition in one pass' },
        { t: 'p', text: 'Sorting `[0,1,2]` values (or partitioning around a pivot) is done with three pointers: `low` marks the end of the zeros, `high` the start of the twos, `i` scans.' },
        {
          t: 'code',
          lang: 'java',
          caption: 'Sort Colors — one pass, O(1) space',
          code: `
void sortColors(int[] a) {
    int low = 0, i = 0, high = a.length - 1;
    while (i <= high) {
        if (a[i] == 0)      swap(a, i++, low++);
        else if (a[i] == 2) swap(a, i, high--);   // do NOT i++ — unseen value swapped in
        else                i++;                  // a[i] == 1, leave it
    }
}`,
        },
        {
          t: 'trap',
          title: 'The i++ asymmetry',
          text: 'When swapping with `low` you may advance `i`, because everything left of `i` is already processed. When swapping with `high` you must **not** advance, because the value you pulled in from the right has never been examined. Explaining this out loud is the whole point of the question.',
        },
        { t: 'h', text: 'Rotation by reversal' },
        { t: 'p', text: 'Rotating right by `k` is three reversals. It is `O(n)` time, `O(1)` space, and it looks like magic until you draw it once.' },
        {
          t: 'code',
          lang: 'java',
          caption: 'Rotate Array — the reversal trick',
          code: `
void rotate(int[] a, int k) {
    int n = a.length;
    k = ((k % n) + n) % n;        // normalise, handles k > n and negative k
    reverse(a, 0, n - 1);         // [1,2,3,4,5,6,7] -> [7,6,5,4,3,2,1]
    reverse(a, 0, k - 1);         // k=3            -> [5,6,7,4,3,2,1]
    reverse(a, k, n - 1);         //                 -> [5,6,7,1,2,3,4]
}

void reverse(int[] a, int i, int j) {
    while (i < j) swap(a, i++, j--);
}`,
        },
        { t: 'h', text: 'Index-as-key — using the array as its own hash table' },
        { t: 'p', text: 'When values are guaranteed to lie in `[1, n]` or `[0, n−1]`, the array can store its own presence information. Two encodings:' },
        {
          t: 'ul',
          items: [
            '**Sign marking** — to mark that value `v` was seen, negate `a[v−1]`. Read presence with `a[i] < 0`. Non-destructive enough to restore afterwards by taking absolute values.',
            '**Cyclic sort** — repeatedly swap `a[i]` to its home position `a[i]−1` until it is correct. After the pass, the first index where `a[i] != i+1` is the missing/duplicate answer.',
          ],
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'Cyclic sort — solves an entire family of "missing / duplicate in [1..n]" problems',
          code: `
void cyclicSort(int[] a) {
    int i = 0;
    while (i < a.length) {
        int home = a[i] - 1;                       // where a[i] belongs
        if (a[i] > 0 && a[i] <= a.length && a[i] != a[home]) {
            swap(a, i, home);                      // place it, re-examine index i
        } else {
            i++;
        }
    }
}
// Now: first index with a[i] != i+1 gives the missing number (i+1)
// and the duplicate (a[i]) simultaneously.`,
        },
        {
          t: 'key',
          title: 'Recognising the cyclic sort family',
          text: 'The tell is always the same sentence: *"an array of n integers where each is in the range [1, n]"*. Missing Number, Find the Duplicate, Find All Duplicates, Find All Disappeared, First Missing Positive, Set Mismatch — all one pattern.',
        },
      ],
    },
    {
      id: 'matrix',
      title: 'Grids and matrices',
      blocks: [
        { t: 'p', text: 'A matrix is an array of arrays. The recurring interview moves are transposition, spiral traversal, and treating a sorted matrix as a sorted list.' },
        {
          t: 'code',
          lang: 'java',
          caption: 'Rotate image 90° clockwise — transpose then reverse rows',
          code: `
void rotate(int[][] m) {
    int n = m.length;
    for (int i = 0; i < n; i++)                 // transpose across the main diagonal
        for (int j = i + 1; j < n; j++) {
            int t = m[i][j]; m[i][j] = m[j][i]; m[j][i] = t;
        }
    for (int[] row : m) reverse(row);           // then mirror horizontally
}
// Counter-clockwise: transpose, then reverse the COLUMN order instead.`,
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'Spiral traversal — four moving boundaries',
          code: `
List<Integer> spiralOrder(int[][] m) {
    List<Integer> out = new ArrayList<>();
    int top = 0, bot = m.length - 1, left = 0, right = m[0].length - 1;

    while (top <= bot && left <= right) {
        for (int j = left; j <= right; j++) out.add(m[top][j]);
        top++;
        for (int i = top; i <= bot; i++) out.add(m[i][right]);
        right--;
        if (top <= bot) {                       // guard: single row left
            for (int j = right; j >= left; j--) out.add(m[bot][j]);
            bot--;
        }
        if (left <= right) {                    // guard: single column left
            for (int i = bot; i >= top; i--) out.add(m[i][left]);
            left++;
        }
    }
    return out;
}`,
        },
        {
          t: 'warn',
          title: 'The two guards are not optional',
          text: 'Without the `if (top <= bot)` and `if (left <= right)` checks, a single remaining row or column is emitted twice. This is the only thing that makes spiral order a Medium instead of an Easy.',
        },
        {
          t: 'tip',
          title: 'Staircase search in a row/column-sorted matrix',
          text: 'Start at the **top-right** corner. If the value is too big, move left; too small, move down. Each step eliminates a whole row or column, giving `O(m + n)` — better than binary searching each row.',
        },
      ],
    },
  ],

  patterns: [
    {
      id: 'prefix-sum',
      name: 'Prefix Sum',
      oneLiner: 'Precompute running totals so any range sum is one subtraction.',
      useWhen: [
        'You need many range-sum / range-count queries on a static array.',
        'The brute force contains a loop that re-sums an interval.',
        'The problem says "subarray" and "sum" in the same sentence.',
      ],
      recognize: [
        'Repeated `for (j = i; j <= r; j++) sum += a[j]` inside another loop.',
        'Counting subarrays with a sum property (equal to k, divisible by k, equal 0s and 1s).',
        '2-D version: repeated rectangle sums over a fixed matrix.',
      ],
      steps: [
        'Build `P` of length `n+1` with `P[0] = 0`.',
        'Convert the condition on a subarray into a condition on two prefix values.',
        'If you need counts or earliest indices, put prefix values in a hash map as you sweep.',
        'Query the map before inserting the current prefix.',
      ],
      template: {
        lang: 'java',
        caption: 'Prefix + hash map — the universal skeleton',
        code: `
Map<Integer, Integer> seen = new HashMap<>();
seen.put(0, 1);                 // or put(0, -1) when you need earliest INDEX
int prefix = 0, answer = 0;

for (int i = 0; i < a.length; i++) {
    prefix += a[i];
    // condition rewritten as "some earlier prefix equals X"
    answer += seen.getOrDefault(prefix - k, 0);
    seen.merge(prefix, 1, Integer::sum);
}`,
      },
      complexity: 'Build O(n) time / O(n) space, query O(1). With a hash map, whole problem is O(n).',
      gotchas: [
        'Seed the map with the empty prefix (`0`), otherwise subarrays starting at index 0 are missed.',
        'For *longest* variants store the earliest index and do **not** overwrite on repeat.',
        'Use `long` for the running sum when `n · max|a[i]|` can exceed 2³¹.',
        'For "divisible by k" with negatives, normalise: `((prefix % k) + k) % k`.',
      ],
      problems: ['Subarray Sum Equals K', 'Contiguous Array', 'Range Sum Query 2D - Immutable', 'Product of Array Except Self'],
    },
    {
      id: 'difference-array',
      name: 'Difference Array',
      oneLiner: 'Record only where the value changes; integrate once at the end.',
      useWhen: [
        'Many range updates, one final read.',
        'Counting maximum overlap of intervals over a small coordinate range.',
      ],
      recognize: ['"Add v to all elements between l and r", repeated q times, with q and n both large.'],
      steps: ['`diff[l] += v; diff[r+1] -= v;` per update.', 'One prefix-sum pass reconstructs the array.'],
      template: {
        lang: 'java',
        caption: 'Car Pooling / Corporate Flight Bookings skeleton',
        code: `
int[] diff = new int[n + 1];
for (int[] q : queries) {          // q = {l, r, v}
    diff[q[0]]     += q[2];
    diff[q[1] + 1] -= q[2];
}
int run = 0;
for (int i = 0; i < n; i++) { run += diff[i]; result[i] = run; }`,
      },
      complexity: 'O(1) per update, O(n) to finalise — versus O(n) per update naively.',
      gotchas: [
        'Size the array `n + 1` so `r + 1` is always writable.',
        'If coordinates are huge (up to 10⁹), switch to a sorted event list (sweep line) instead.',
      ],
      problems: ['Corporate Flight Bookings', 'Car Pooling', 'Range Addition'],
    },
    {
      id: 'kadane',
      name: "Kadane / Running-Best DP",
      oneLiner: 'Track the best answer *ending at i*, then take the max over all i.',
      useWhen: [
        'Maximum or minimum contiguous subarray of sum, product, or a derived score.',
        'Any "best streak ending here" question.',
      ],
      recognize: ['The word "contiguous" plus an optimisation ("maximum", "largest", "best").'],
      steps: [
        'Define `cur` = best value of a subarray ending exactly at `i`.',
        'Write the two-way choice: extend (`cur + a[i]`) or restart (`a[i]`).',
        'Keep a separate `best` global maximum.',
      ],
      template: {
        lang: 'java',
        caption: 'Generic running-best skeleton',
        code: `
int cur = a[0], best = a[0];
for (int i = 1; i < a.length; i++) {
    cur  = Math.max(a[i], cur + a[i]);   // restart vs extend
    best = Math.max(best, cur);
}
return best;

// PRODUCT variant: negatives flip order, so carry both extremes
int hi = a[0], lo = a[0], ans = a[0];
for (int i = 1; i < a.length; i++) {
    int x = a[i], phi = hi, plo = lo;
    hi = Math.max(x, Math.max(phi * x, plo * x));
    lo = Math.min(x, Math.min(phi * x, plo * x));
    ans = Math.max(ans, hi);
}`,
      },
      complexity: 'O(n) time, O(1) space.',
      gotchas: [
        'Never seed `best` with 0 unless empty subarrays are allowed.',
        'For products, a zero resets both extremes — the `Math.max(x, ...)` term handles it automatically.',
      ],
      problems: ['Maximum Subarray', 'Maximum Product Subarray', 'Maximum Sum Circular Subarray', 'Best Time to Buy and Sell Stock'],
    },
    {
      id: 'cyclic-sort',
      name: 'Cyclic Sort / Index-as-Key',
      oneLiner: 'When values are in [1, n], the array is already a perfect hash table.',
      useWhen: [
        'Values are bounded by the array length.',
        'You are asked for missing, duplicated, or misplaced numbers in O(1) extra space.',
      ],
      recognize: ['The phrase "array of n integers where each integer is in the range [1, n]".'],
      steps: [
        'Walk `i` from 0. While `a[i]` is not at its home index `a[i] − 1`, swap it there.',
        'Do not advance `i` after a swap — the newly arrived value is unexamined.',
        'Second pass: any index with `a[i] != i + 1` reveals the answer.',
      ],
      template: {
        lang: 'java',
        caption: 'Cyclic sort, then read off the answer',
        code: `
int i = 0;
while (i < n) {
    int home = a[i] - 1;
    if (a[i] != a[home]) swap(a, i, home);   // compare VALUES, not indices — handles dups
    else i++;
}
for (int j = 0; j < n; j++)
    if (a[j] != j + 1) return j + 1;         // missing number

// Sign-marking alternative (no reordering):
for (int x : a) { int idx = Math.abs(x) - 1; if (a[idx] > 0) a[idx] = -a[idx]; }
// a[i] > 0  =>  i + 1 never appeared`,
      },
      complexity: 'O(n) time, O(1) extra space.',
      gotchas: [
        'Guard against out-of-range values before indexing (`First Missing Positive` has arbitrary ints).',
        'Compare `a[i] != a[home]` rather than `i != home`, or duplicates cause an infinite loop.',
      ],
      problems: ['Missing Number', 'Find the Duplicate Number', 'Find All Numbers Disappeared in an Array', 'First Missing Positive', 'Set Mismatch'],
    },
    {
      id: 'dutch-flag',
      name: 'Dutch National Flag (3-Way Partition)',
      oneLiner: 'Three pointers split an array into <, =, > regions in a single pass.',
      useWhen: ['Only a few distinct categories.', 'In-place partitioning around a pivot, including quickselect with duplicates.'],
      recognize: ['"Sort an array of 0s, 1s and 2s", "move all X to the front", "partition around a value".'],
      steps: ['`low` = boundary of the small region, `high` = boundary of the large region, `i` = scanner.', 'Swap into `low` and advance both; swap into `high` and advance only `high`.'],
      complexity: 'O(n) time, O(1) space, one pass.',
      gotchas: ['Loop condition is `i <= high`, not `i < high`.', 'Do not advance `i` on a high-swap.'],
      problems: ['Sort Colors', 'Move Zeroes', 'Partition Array According to Given Pivot'],
    },
    {
      id: 'prefix-suffix',
      name: 'Prefix + Suffix Decomposition',
      oneLiner: 'Answer for index i = something about everything left of i, combined with everything right of i.',
      useWhen: [
        'The answer at each index depends on both sides but excludes the index itself.',
        'Division is forbidden or unsafe (zeros).',
      ],
      recognize: ['"…except self", "water trapped above index i", "best split point".'],
      steps: ['One left-to-right pass filling `left[i]`.', 'One right-to-left pass, combining on the fly to use O(1) extra space.'],
      template: {
        lang: 'java',
        caption: 'Product of Array Except Self — O(1) extra space',
        code: `
int[] productExceptSelf(int[] a) {
    int n = a.length;
    int[] res = new int[n];

    res[0] = 1;
    for (int i = 1; i < n; i++) res[i] = res[i - 1] * a[i - 1];   // prefix products

    int suffix = 1;
    for (int i = n - 1; i >= 0; i--) {                            // fold suffix in
        res[i] *= suffix;
        suffix *= a[i];
    }
    return res;
}`,
      },
      complexity: 'O(n) time, O(1) auxiliary space (output excluded).',
      gotchas: ['Handle zeros explicitly if you take the division shortcut — better to avoid division entirely.'],
      problems: ['Product of Array Except Self', 'Trapping Rain Water', 'Candy'],
    },
  ],

  pitfalls: [
    { title: 'Mutating the array while iterating it', text: 'Removing from a list inside a for-each throws `ConcurrentModificationException`. Iterate backwards, or build a new list.' },
    { title: 'Integer overflow in sums', text: '10⁵ elements of 10⁹ each overflows `int`. Promote prefix sums to `long`.' },
    { title: 'Assuming distinct values', text: 'Cyclic sort, two pointers and binary search all behave differently with duplicates. Ask early.' },
    { title: 'Off-by-one in prefix arrays', text: 'Mixing a length-`n` prefix with a length-`n+1` one is the most common source of wrong answers. Standardise on `n+1` with `P[0] = 0`.' },
    { title: 'Copying inside a loop', text: '`Arrays.copyOfRange` in a loop turns an `O(n)` algorithm into `O(n²)` without any visible nesting.' },
    { title: 'Forgetting k % n in rotations', text: '`k` can exceed `n`, and in some problems be negative. Normalise with `((k % n) + n) % n`.' },
  ],

  cheatsheet: [
    { label: 'Range sum', value: 'P[r+1] − P[l]' },
    { label: 'Subarray sum = k', value: 'map prefix→count, seed {0:1}' },
    { label: 'Longest subarray sum = k', value: 'map prefix→earliest index' },
    { label: 'Equal 0s and 1s', value: 'treat 0 as −1, find sum 0' },
    { label: 'Range update', value: 'diff[l]+=v, diff[r+1]−=v' },
    { label: 'Max subarray', value: 'Kadane: cur = max(x, cur+x)' },
    { label: 'Max product', value: 'track max AND min' },
    { label: 'Rotate by k', value: 'reverse all, reverse k, reverse rest' },
    { label: 'Values in [1,n]', value: 'cyclic sort or sign-marking' },
    { label: '0/1/2 sort', value: 'Dutch flag, i <= high' },
    { label: 'Sorted matrix search', value: 'start top-right, O(m+n)' },
    { label: 'Rotate matrix 90° CW', value: 'transpose + reverse rows' },
  ],

  problems: [
    { name: 'Two Sum', difficulty: 'Easy', url: 'https://leetcode.com/problems/two-sum/', pattern: 'Hash complement', insight: 'One pass, store value→index, look for target − x before inserting x.' },
    { name: 'Best Time to Buy and Sell Stock', difficulty: 'Easy', url: 'https://leetcode.com/problems/best-time-to-buy-and-sell-stock/', pattern: 'Kadane / running min', insight: 'Track the minimum seen so far; the answer is the best price − minSoFar.' },
    { name: 'Maximum Subarray', difficulty: 'Easy', url: 'https://leetcode.com/problems/maximum-subarray/', pattern: 'Kadane', insight: 'best-ending-here = max(a[i], best + a[i]). Seed from a[0], never from 0.' },
    { name: 'Move Zeroes', difficulty: 'Easy', url: 'https://leetcode.com/problems/move-zeroes/', pattern: 'Two pointers / partition', insight: 'A write pointer collects non-zeros; fill the tail with zeros afterwards.' },
    { name: 'Missing Number', difficulty: 'Easy', url: 'https://leetcode.com/problems/missing-number/', pattern: 'Cyclic sort / XOR', insight: 'Three valid answers: cyclic sort, n(n+1)/2 − sum, or XOR of indices and values.' },
    { name: 'Running Sum of 1d Array', difficulty: 'Easy', url: 'https://leetcode.com/problems/running-sum-of-1d-array/', pattern: 'Prefix sum', insight: 'Literally the prefix array — do it in place.' },
    { name: 'Merge Sorted Array', difficulty: 'Easy', url: 'https://leetcode.com/problems/merge-sorted-array/', pattern: 'Two pointers from the back', insight: 'Filling from the end avoids overwriting unread values in nums1.' },
    { name: 'Product of Array Except Self', difficulty: 'Medium', url: 'https://leetcode.com/problems/product-of-array-except-self/', pattern: 'Prefix + suffix', insight: 'Prefix products into the result array, then fold suffix products in on a backward pass.' },
    { name: 'Subarray Sum Equals K', difficulty: 'Medium', url: 'https://leetcode.com/problems/subarray-sum-equals-k/', pattern: 'Prefix + hash map', insight: 'Count earlier prefixes equal to running − k. Seed the map with {0:1}.' },
    { name: 'Contiguous Array', difficulty: 'Medium', url: 'https://leetcode.com/problems/contiguous-array/', pattern: 'Prefix + hash map', insight: 'Map 0 to −1 so "equal counts" becomes "prefix sum repeats"; store earliest index.' },
    { name: 'Sort Colors', difficulty: 'Medium', url: 'https://leetcode.com/problems/sort-colors/', pattern: 'Dutch national flag', insight: 'Three pointers, one pass. Do not advance i after swapping with high.' },
    { name: 'Rotate Array', difficulty: 'Medium', url: 'https://leetcode.com/problems/rotate-array/', pattern: 'Reversal', insight: 'Reverse whole, reverse first k, reverse rest. Normalise k modulo n first.' },
    { name: 'Spiral Matrix', difficulty: 'Medium', url: 'https://leetcode.com/problems/spiral-matrix/', pattern: 'Boundary shrinking', insight: 'Four boundaries, with guards before the bottom row and left column passes.' },
    { name: 'Rotate Image', difficulty: 'Medium', url: 'https://leetcode.com/problems/rotate-image/', pattern: 'Transpose + reverse', insight: 'Clockwise = transpose then reverse each row.' },
    { name: 'Set Matrix Zeroes', difficulty: 'Medium', url: 'https://leetcode.com/problems/set-matrix-zeroes/', pattern: 'In-place marking', insight: 'Use row 0 and column 0 as the marker arrays; track column 0 separately with a flag.' },
    { name: 'Find the Duplicate Number', difficulty: 'Medium', url: 'https://leetcode.com/problems/find-the-duplicate-number/', pattern: 'Floyd cycle / index-as-key', insight: 'Treat i → a[i] as a linked list; the duplicate is the cycle entrance.' },
    { name: 'Maximum Product Subarray', difficulty: 'Medium', url: 'https://leetcode.com/problems/maximum-product-subarray/', pattern: 'Kadane with two states', insight: 'A negative swaps max and min, so carry both.' },
    { name: 'Maximum Sum Circular Subarray', difficulty: 'Medium', url: 'https://leetcode.com/problems/maximum-sum-circular-subarray/', pattern: 'Kadane ×2', insight: 'max(normal Kadane, total − minKadane), unless every element is negative.' },
    { name: 'Corporate Flight Bookings', difficulty: 'Medium', url: 'https://leetcode.com/problems/corporate-flight-bookings/', pattern: 'Difference array', insight: 'The textbook O(1)-per-update range addition.' },
    { name: 'Range Sum Query 2D - Immutable', difficulty: 'Medium', url: 'https://leetcode.com/problems/range-sum-query-2d-immutable/', pattern: '2-D prefix sum', insight: 'Inclusion–exclusion with a padded (m+1)×(n+1) table.' },
    { name: 'Next Permutation', difficulty: 'Medium', url: 'https://leetcode.com/problems/next-permutation/', pattern: 'In-place scan + reverse', insight: 'Find the rightmost ascent, swap with the smallest larger value to its right, reverse the suffix.' },
    { name: 'First Missing Positive', difficulty: 'Hard', url: 'https://leetcode.com/problems/first-missing-positive/', pattern: 'Cyclic sort', insight: 'Place each value v ∈ [1,n] at index v−1, then scan for the first mismatch.' },
    { name: 'Trapping Rain Water', difficulty: 'Hard', url: 'https://leetcode.com/problems/trapping-rain-water/', pattern: 'Prefix/suffix max or two pointers', insight: 'Water above i = min(maxLeft, maxRight) − height[i]. Two pointers make it O(1) space.' },
    { name: 'Candy', difficulty: 'Hard', url: 'https://leetcode.com/problems/candy/', pattern: 'Two-pass prefix/suffix', insight: 'Left-to-right enforces the left rule, right-to-left enforces the right rule; take the max.' },
  ],
}
