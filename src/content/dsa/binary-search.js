export default {
  id: 'binary-search',
  title: 'Binary Search (and Binary Search on the Answer)',
  short: 'Binary Search',
  icon: 'SearchRounded',
  tier: 'Foundations',
  order: 4,
  estHours: 10,
  prereqs: ['complexity'],
  tagline: 'Everyone knows it. Almost nobody writes it correctly under pressure. Here is how to never get it wrong again.',
  mentalModel:
    'Binary search is not about sorted arrays. It is about a **predicate that flips exactly once**: false, false, false, TRUE, TRUE. Your job is to find the boundary.',
  whyItMatters:
    'The vanilla version appears in warm-ups. The real value is the generalisation — "binary search on the answer" turns dozens of Hard optimisation problems into fifteen lines of code.',

  complexity: [
    { op: 'Search sorted array', time: 'O(log n)', space: 'O(1)', note: 'Iterative form' },
    { op: 'Lower bound / upper bound', time: 'O(log n)', space: 'O(1)', note: 'First ≥ x / first > x' },
    { op: 'Search rotated sorted array', time: 'O(log n)', space: 'O(1)', note: 'One half is always sorted' },
    { op: 'Binary search on answer', time: 'O(n log(range))', space: 'O(1)', note: 'Each check costs a linear feasibility scan' },
    { op: 'Search 2-D sorted matrix', time: 'O(log(m·n))', space: 'O(1)', note: 'Flatten the index' },
    { op: 'Median of two sorted arrays', time: 'O(log min(m,n))', space: 'O(1)', note: 'Partition search' },
  ],

  sections: [
    {
      id: 'predicate',
      title: 'Stop memorising three templates. Learn one idea.',
      blocks: [
        { t: 'lead', text: 'The reason binary search feels fragile is that people memorise `mid ± 1` rules instead of the invariant. Fix the invariant and the rules become obvious.' },
        { t: 'p', text: 'Reframe **every** binary search as: *"I have a boolean function `ok(x)` which is false for a while and then true forever. Find the first `x` where it is true."* This is called the **monotone predicate** view.' },
        {
          t: 'ascii',
          caption: 'Binary search finds the flip point. Everything else is a special case of this.',
          code: `
 x:        0   1   2   3   4   5   6   7   8
 ok(x):    F   F   F   F   T   T   T   T   T
                           ^
                           first true  =  the answer

 "Find target"            ->  ok(i) = (a[i] >= target)
 "Lower bound"            ->  ok(i) = (a[i] >= target)
 "Upper bound"            ->  ok(i) = (a[i] >  target)
 "Min capacity that works"->  ok(c) = feasible(c)
 "Min days to finish"     ->  ok(d) = canFinishIn(d)`,
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'THE template. Half-open interval, no mid−1, no infinite loops, ever.',
          code: `
/**
 * Returns the smallest x in [lo, hi) with ok(x) == true,
 * or hi if no such x exists.
 * Invariant: ok is false on [start, lo) and true on [hi, end).
 */
int firstTrue(int lo, int hi) {
    while (lo < hi) {
        int mid = lo + (hi - lo) / 2;      // never (lo+hi)/2 — that overflows
        if (ok(mid)) hi = mid;             // mid might be the answer: KEEP it
        else         lo = mid + 1;         // mid is definitely not: DISCARD it
    }
    return lo;                             // lo == hi == boundary
}`,
        },
        {
          t: 'key',
          title: 'Why this template cannot loop forever',
          text: 'With `lo < hi`, `mid` is always in `[lo, hi)`, so `mid < hi`. The `hi = mid` branch strictly shrinks the interval because `mid < hi`, and the `lo = mid + 1` branch strictly grows `lo`. The interval shrinks on every iteration. The classic infinite loop comes from `lo <= hi` combined with `hi = mid` — never mix those.',
        },
        {
          t: 'tip',
          title: 'Derive every variant from firstTrue',
          text: '**Lower bound** (first index with `a[i] ≥ t`) is `firstTrue(i → a[i] ≥ t)`. **Upper bound** (first index with `a[i] > t`) is `firstTrue(i → a[i] > t)`. **Count of t** is `upper − lower`. **Last index < t** is `lower − 1`. You never need another template.',
        },
      ],
    },
    {
      id: 'classic',
      title: 'The classic forms, written out',
      blocks: [
        {
          t: 'code',
          lang: 'java',
          caption: 'Exact search, lower bound, upper bound — all from one shape',
          code: `
// 1. Does target exist? Where?
int search(int[] a, int t) {
    int lo = 0, hi = a.length;
    while (lo < hi) {
        int mid = lo + (hi - lo) / 2;
        if (a[mid] >= t) hi = mid; else lo = mid + 1;
    }
    return (lo < a.length && a[lo] == t) ? lo : -1;
}

// 2. Lower bound: first index i with a[i] >= t   (insertion point)
int lowerBound(int[] a, int t) {
    int lo = 0, hi = a.length;
    while (lo < hi) {
        int mid = lo + (hi - lo) / 2;
        if (a[mid] >= t) hi = mid; else lo = mid + 1;
    }
    return lo;
}

// 3. Upper bound: first index i with a[i] > t
int upperBound(int[] a, int t) {
    int lo = 0, hi = a.length;
    while (lo < hi) {
        int mid = lo + (hi - lo) / 2;
        if (a[mid] > t) hi = mid; else lo = mid + 1;
    }
    return lo;
}

// Occurrences of t  =  upperBound(a,t) - lowerBound(a,t)
// First & last position of t  =  lowerBound(a,t) and upperBound(a,t) - 1`,
        },
        {
          t: 'note',
          title: 'Java already has these',
          text: '`Arrays.binarySearch` returns `-(insertionPoint) - 1` when absent — useful but awkward. `Collections.binarySearch`, `TreeMap.floorKey/ceilingKey/higherKey/lowerKey` and `TreeSet.floor/ceiling` cover most bound queries in production code. In interviews, write it out — they want to see the invariant.',
        },
      ],
    },
    {
      id: 'rotated',
      title: 'Rotated and unusual arrays',
      blocks: [
        { t: 'p', text: 'A rotated sorted array is not globally sorted, but **at least one half of any split is sorted**. Identify which half, test whether the target lies inside it, and discard accordingly.' },
        {
          t: 'code',
          lang: 'java',
          caption: 'Search in Rotated Sorted Array',
          code: `
int search(int[] a, int target) {
    int lo = 0, hi = a.length - 1;
    while (lo <= hi) {
        int mid = lo + (hi - lo) / 2;
        if (a[mid] == target) return mid;

        if (a[lo] <= a[mid]) {                       // LEFT half is sorted
            if (a[lo] <= target && target < a[mid]) hi = mid - 1;
            else                                    lo = mid + 1;
        } else {                                     // RIGHT half is sorted
            if (a[mid] < target && target <= a[hi])  lo = mid + 1;
            else                                     hi = mid - 1;
        }
    }
    return -1;
}`,
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'Find Minimum in Rotated Sorted Array — compare against hi, never lo',
          code: `
int findMin(int[] a) {
    int lo = 0, hi = a.length - 1;
    while (lo < hi) {
        int mid = lo + (hi - lo) / 2;
        if (a[mid] > a[hi]) lo = mid + 1;   // min is strictly right of mid
        else                hi = mid;       // min is at mid or left of it
    }
    return a[lo];
}`,
        },
        {
          t: 'trap',
          title: 'Compare with hi, not lo',
          text: 'Using `a[mid] > a[lo]` breaks on already-sorted input such as `[1,2,3]`. Comparing against `a[hi]` is correct in every case. With duplicates (`[3,3,1,3]`), worst case degrades to `O(n)` and you must handle `a[mid] == a[hi]` by doing `hi--`.',
        },
        { t: 'h', text: 'Peak finding — binary search without any sorting at all' },
        { t: 'p', text: 'This is the clearest proof that binary search is about predicates, not order. In `Find Peak Element`, compare `a[mid]` with `a[mid+1]`: if it is rising, a peak must exist to the right; if falling, one exists at `mid` or to the left.' },
        {
          t: 'code',
          lang: 'java',
          caption: 'Find Peak Element — O(log n) on an unsorted array',
          code: `
int findPeakElement(int[] a) {
    int lo = 0, hi = a.length - 1;
    while (lo < hi) {
        int mid = lo + (hi - lo) / 2;
        if (a[mid] < a[mid + 1]) lo = mid + 1;   // ascending -> peak to the right
        else                     hi = mid;       // descending -> peak here or left
    }
    return lo;
}`,
        },
      ],
    },
    {
      id: 'on-answer',
      title: 'Binary search on the answer — the technique that wins Hards',
      blocks: [
        { t: 'lead', text: 'When you cannot compute the answer directly, but you *can* cheaply check whether a candidate answer is good enough, binary search the candidate space.' },
        { t: 'p', text: 'The signature is unmistakable: **"minimise the maximum"**, **"maximise the minimum"**, or **"find the smallest capacity/speed/days such that …"**. These all have a feasibility function that is monotone — if capacity 10 works, capacity 11 certainly works.' },
        {
          t: 'steps',
          items: [
            { title: 'Identify the answer space', text: 'What is the smallest conceivable answer, and the largest? For ship capacity: `lo = max(weights)` (must fit the heaviest item), `hi = sum(weights)` (one giant trip).' },
            { title: 'Write `feasible(x)`', text: 'A plain linear simulation: "with capacity x, how many days does it take?" Do not try to be clever here — greedy simulation is almost always correct and `O(n)`.' },
            { title: 'Prove monotonicity out loud', text: '"If x works, then x+1 works, because more capacity never forces more trips." That sentence is the licence to binary search.' },
            { title: 'Run firstTrue over the value range', text: 'Not over indices — over the candidate answers themselves.' },
          ],
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'Capacity To Ship Packages Within D Days — the archetype',
          code: `
int shipWithinDays(int[] weights, int days) {
    int lo = 0, hi = 0;
    for (int w : weights) { lo = Math.max(lo, w); hi += w; }   // answer space

    while (lo < hi) {
        int mid = lo + (hi - lo) / 2;
        if (feasible(weights, mid, days)) hi = mid;            // mid works, try smaller
        else                              lo = mid + 1;
    }
    return lo;
}

// Greedy simulation: how many days does capacity 'cap' need?
boolean feasible(int[] w, int cap, int days) {
    int used = 1, load = 0;
    for (int x : w) {
        if (load + x > cap) { used++; load = 0; }   // start a new day
        load += x;
    }
    return used <= days;
}`,
        },
        {
          t: 'table',
          head: ['Problem', 'What you binary search', 'feasible(x) is…'],
          rows: [
            ['Koko Eating Bananas', 'bananas per hour', 'total hours `Σ ceil(pile/x) ≤ h`'],
            ['Ship Packages in D Days', 'ship capacity', 'greedy day count `≤ D`'],
            ['Split Array Largest Sum', 'the largest allowed subarray sum', 'greedy partition count `≤ k`'],
            ['Minimum Days to Make Bouquets', 'number of days', 'count of formable bouquets `≥ m`'],
            ['Magnetic Force Between Balls', 'minimum gap', 'greedy placement fits `≥ m` balls'],
            ['Kth Smallest in Sorted Matrix', 'the value itself', 'count of elements `≤ x` is `≥ k`'],
            ['Median of Two Sorted Arrays', 'the partition point', 'left halves are all `≤` right halves'],
          ],
          caption: 'All seven are the same fifteen lines with a different `feasible`.',
        },
        {
          t: 'key',
          title: 'The tell',
          text: 'If the problem says **"minimum largest"**, **"maximum smallest"**, or gives you a huge value range with a small `n`, you are binary searching the answer. Nothing else fits those shapes.',
        },
        {
          t: 'warn',
          title: 'Floating-point variants',
          text: 'When the answer is a real number, replace the exit condition with a fixed iteration count (`for (int it = 0; it < 100; it++)`) or `while (hi - lo > 1e-7)`. Do not use `lo < hi` on doubles — it may never terminate.',
        },
      ],
    },
    {
      id: 'advanced',
      title: 'Two advanced set-pieces',
      blocks: [
        { t: 'h', text: 'Kth smallest in a sorted matrix — search the value, not the position' },
        { t: 'p', text: 'You cannot index the k-th element directly, but you can count how many entries are `≤ x` in `O(m + n)` using the staircase walk. That count is monotone in `x`, so binary search `x` over the value range.' },
        {
          t: 'code',
          lang: 'java',
          caption: 'Binary search over values, with a staircase counter',
          code: `
int kthSmallest(int[][] m, int k) {
    int n = m.length;
    int lo = m[0][0], hi = m[n - 1][n - 1];

    while (lo < hi) {
        int mid = lo + (hi - lo) / 2;
        if (countLessEqual(m, mid) >= k) hi = mid; else lo = mid + 1;
    }
    return lo;                                  // guaranteed to be a real matrix value
}

int countLessEqual(int[][] m, int x) {
    int n = m.length, count = 0, row = n - 1, col = 0;
    while (row >= 0 && col < n) {               // staircase from bottom-left
        if (m[row][col] <= x) { count += row + 1; col++; }
        else                  { row--; }
    }
    return count;
}`,
        },
        { t: 'h', text: 'Median of two sorted arrays — binary search the partition' },
        { t: 'p', text: 'The `O(log min(m,n))` solution searches for a split of the smaller array such that everything on the left of the combined partition is ≤ everything on the right.' },
        {
          t: 'code',
          lang: 'java',
          caption: 'Partition search — the hardest binary search asked in interviews',
          code: `
double findMedianSortedArrays(int[] A, int[] B) {
    if (A.length > B.length) return findMedianSortedArrays(B, A);  // search the smaller
    int m = A.length, n = B.length, half = (m + n + 1) / 2;
    int lo = 0, hi = m;

    while (lo <= hi) {
        int i = (lo + hi) / 2;          // take i from A
        int j = half - i;               // and j from B

        int Aleft  = (i == 0) ? Integer.MIN_VALUE : A[i - 1];
        int Aright = (i == m) ? Integer.MAX_VALUE : A[i];
        int Bleft  = (j == 0) ? Integer.MIN_VALUE : B[j - 1];
        int Bright = (j == n) ? Integer.MAX_VALUE : B[j];

        if (Aleft <= Bright && Bleft <= Aright) {           // correct partition
            if (((m + n) & 1) == 1) return Math.max(Aleft, Bleft);
            return (Math.max(Aleft, Bleft) + Math.min(Aright, Bright)) / 2.0;
        }
        if (Aleft > Bright) hi = i - 1;    // took too many from A
        else                lo = i + 1;    // took too few
    }
    throw new IllegalArgumentException("inputs not sorted");
}`,
        },
        {
          t: 'tip',
          title: 'The sentinels are the whole trick',
          text: 'Using `MIN_VALUE` / `MAX_VALUE` for out-of-range partition edges removes every boundary `if`. Without them this problem is a nightmare of special cases.',
        },
      ],
    },
  ],

  patterns: [
    {
      id: 'first-true',
      name: 'Monotone Predicate Search (firstTrue)',
      oneLiner: 'Find the single point where a false→true predicate flips.',
      useWhen: [
        'The data (or the candidate answers) are ordered and a property is monotone.',
        'You need lower bound, upper bound, first/last occurrence, insertion point, or a floor/ceiling.',
      ],
      recognize: ['Sorted input; "first index such that…"; "how many are ≤ x".'],
      steps: [
        'Write `ok(x)` and check it is false-then-true.',
        'Use the half-open loop `while (lo < hi)` with `hi = mid` / `lo = mid + 1`.',
        'Return `lo`, then validate it if the target might not exist.',
      ],
      template: {
        lang: 'java',
        caption: 'Memorise these eight lines and never write a broken binary search again',
        code: `
int lo = 0, hi = n;                 // half-open [lo, hi)
while (lo < hi) {
    int mid = lo + (hi - lo) / 2;
    if (ok(mid)) hi = mid;          // keep mid — it is a candidate
    else         lo = mid + 1;      // discard mid
}
return lo;                          // first index where ok is true (or n)`,
      },
      complexity: 'O(log n) comparisons; O(1) space.',
      gotchas: [
        'Never write `(lo + hi) / 2` — it overflows for large indices.',
        'Do not mix `lo <= hi` with `hi = mid`; that is the infinite-loop recipe.',
        'After the loop, `lo` may equal `n` — check bounds before dereferencing.',
      ],
      problems: ['Binary Search', 'Search Insert Position', 'Find First and Last Position of Element in Sorted Array', 'Sqrt(x)'],
    },
    {
      id: 'bs-on-answer',
      name: 'Binary Search on the Answer',
      oneLiner: 'Guess the answer, verify it in O(n), and halve the guess space.',
      useWhen: [
        '"Minimise the maximum" / "maximise the minimum".',
        'Direct computation is hard but verification is easy.',
        'The candidate range is numeric and large.',
      ],
      recognize: [
        'Phrases: minimum capacity, minimum speed, minimum days, largest minimum distance, smallest divisor.',
        'Answer range up to 10⁹ but `n` only 10⁵ — the log must come from the *value* range.',
      ],
      steps: [
        'Define `lo` = smallest possibly-valid answer, `hi` = definitely-valid answer.',
        'Write `feasible(x)` as a straightforward greedy or counting scan.',
        'Argue monotonicity explicitly.',
        'Run `firstTrue` over `[lo, hi]`.',
      ],
      template: {
        lang: 'java',
        caption: 'The universal shape',
        code: `
int lo = minimumPossible(), hi = maximumPossible();
while (lo < hi) {
    int mid = lo + (hi - lo) / 2;
    if (feasible(mid)) hi = mid;      // for MINIMISE problems
    else               lo = mid + 1;
}
return lo;

// For MAXIMISE problems, flip it:
//   if (feasible(mid)) lo = mid; else hi = mid - 1;
//   and use  mid = lo + (hi - lo + 1) / 2;   // upper mid, or you loop forever`,
      },
      complexity: 'O(n · log(hi − lo)).',
      gotchas: [
        'For the maximise form you **must** use the upper midpoint, or `lo = mid` never advances.',
        'Set `lo` to a value that is genuinely possible (e.g. `max(weights)`), otherwise `feasible` may be asked nonsense.',
        'Use `long` for `hi` when it is a sum of large values.',
      ],
      problems: ['Koko Eating Bananas', 'Capacity To Ship Packages Within D Days', 'Split Array Largest Sum', 'Minimum Number of Days to Make m Bouquets', 'Magnetic Force Between Two Balls'],
    },
    {
      id: 'rotated-search',
      name: 'Search in a Rotated / Partially Sorted Array',
      oneLiner: 'One half of every split is guaranteed sorted — decide which, then decide where the target lives.',
      useWhen: ['Sorted array rotated at an unknown pivot.', 'Find the minimum, or find a target, in O(log n).'],
      recognize: ['"Sorted array rotated at some pivot unknown to you beforehand".'],
      steps: [
        'Compute `mid`.',
        'Test `a[lo] <= a[mid]` to decide whether the left half is sorted.',
        'Check whether the target lies inside the sorted half; if yes, recurse there, else the other half.',
      ],
      complexity: 'O(log n); degrades to O(n) with duplicates.',
      gotchas: [
        'For find-minimum, compare `a[mid]` with `a[hi]`, never `a[lo]`.',
        'Duplicates: on `a[mid] == a[hi]`, you can only safely do `hi--`.',
      ],
      problems: ['Search in Rotated Sorted Array', 'Find Minimum in Rotated Sorted Array', 'Search in Rotated Sorted Array II', 'Find Minimum in Rotated Sorted Array II'],
    },
    {
      id: 'bs-matrix',
      name: 'Binary Search in 2-D',
      oneLiner: 'Either flatten the matrix into one virtual sorted array, or binary search the value and count.',
      useWhen: ['Rows sorted and each row starts after the previous ends → flatten.', 'Rows and columns sorted independently → staircase or value search.'],
      recognize: ['"m × n matrix, each row sorted, first integer of each row greater than the last of the previous".'],
      steps: [
        'Fully sorted matrix: treat index `i` as `(i / n, i % n)` and run a normal binary search.',
        'Row/column sorted only: staircase from top-right in `O(m + n)`, or binary search values with a counting function.',
      ],
      complexity: 'O(log(m·n)) flattened; O(m + n) staircase; O((m+n) log(range)) for k-th smallest.',
      gotchas: ['Do not run a per-row binary search when the matrix is fully sorted — that is O(m log n) for no reason.'],
      problems: ['Search a 2D Matrix', 'Search a 2D Matrix II', 'Kth Smallest Element in a Sorted Matrix'],
    },
  ],

  pitfalls: [
    { title: 'Midpoint overflow', text: '`(lo + hi) / 2` overflows when both are near 2³¹. Always `lo + (hi - lo) / 2`.' },
    { title: 'Infinite loop from mixing conventions', text: '`while (lo <= hi)` pairs with `hi = mid - 1`. `while (lo < hi)` pairs with `hi = mid`. Never cross them.' },
    { title: 'Maximise problems with the lower midpoint', text: 'If you write `lo = mid`, you must use the upper midpoint `lo + (hi - lo + 1) / 2`.' },
    { title: 'Not validating the result', text: '`firstTrue` returns the insertion point when the target is absent. Check `lo < n && a[lo] == target`.' },
    { title: 'Assuming binary search needs sorting', text: 'It needs *monotonicity*. Peak finding and rotated arrays are binary searchable without being sorted.' },
    { title: 'Expensive feasibility functions', text: 'If `feasible` is `O(n log n)`, your total becomes `O(n log n log range)` — usually still fine, but say it out loud.' },
  ],

  cheatsheet: [
    { label: 'Safe midpoint', value: 'lo + (hi − lo) / 2' },
    { label: 'Half-open loop', value: 'while (lo < hi) … return lo' },
    { label: 'Keep mid', value: 'hi = mid' },
    { label: 'Discard mid', value: 'lo = mid + 1' },
    { label: 'Lower bound', value: 'first a[i] ≥ t' },
    { label: 'Upper bound', value: 'first a[i] > t' },
    { label: 'Count of t', value: 'upper − lower' },
    { label: 'Maximise form', value: 'lo = mid + upper midpoint' },
    { label: 'Rotated min', value: 'compare a[mid] vs a[hi]' },
    { label: 'Peak element', value: 'compare a[mid] vs a[mid+1]' },
    { label: '“min largest” / “max smallest”', value: 'binary search the answer' },
    { label: 'Float search', value: 'fixed 100 iterations' },
  ],

  problems: [
    { name: 'Binary Search', difficulty: 'Easy', url: 'https://leetcode.com/problems/binary-search/', pattern: 'firstTrue', insight: 'Write it with the half-open invariant so the harder variants come free.' },
    { name: 'Search Insert Position', difficulty: 'Easy', url: 'https://leetcode.com/problems/search-insert-position/', pattern: 'Lower bound', insight: 'Literally `lowerBound` — return lo without validating.' },
    { name: 'First Bad Version', difficulty: 'Easy', url: 'https://leetcode.com/problems/first-bad-version/', pattern: 'firstTrue', insight: 'The predicate is handed to you by the API; this is the purest form of the pattern.' },
    { name: 'Sqrt(x)', difficulty: 'Easy', url: 'https://leetcode.com/problems/sqrtx/', pattern: 'Binary search on answer', insight: 'Search r where r·r ≤ x; use long for the square to avoid overflow.' },
    { name: 'Valid Perfect Square', difficulty: 'Easy', url: 'https://leetcode.com/problems/valid-perfect-square/', pattern: 'Binary search on answer', insight: 'Same as Sqrt(x) with an equality check at the end.' },
    { name: 'Guess Number Higher or Lower', difficulty: 'Easy', url: 'https://leetcode.com/problems/guess-number-higher-or-lower/', pattern: 'firstTrue', insight: 'A warm-up that makes the predicate framing explicit.' },
    { name: 'Find First and Last Position of Element in Sorted Array', difficulty: 'Medium', url: 'https://leetcode.com/problems/find-first-and-last-position-of-element-in-sorted-array/', pattern: 'Lower + upper bound', insight: 'Two calls to the same template — never write two different loops.' },
    { name: 'Search in Rotated Sorted Array', difficulty: 'Medium', url: 'https://leetcode.com/problems/search-in-rotated-sorted-array/', pattern: 'Rotated search', insight: 'Identify the sorted half, then test containment.' },
    { name: 'Find Minimum in Rotated Sorted Array', difficulty: 'Medium', url: 'https://leetcode.com/problems/find-minimum-in-rotated-sorted-array/', pattern: 'Rotated search', insight: 'Compare against a[hi]; a[lo] fails on already-sorted input.' },
    { name: 'Find Peak Element', difficulty: 'Medium', url: 'https://leetcode.com/problems/find-peak-element/', pattern: 'Slope predicate', insight: 'Binary search on an unsorted array — the strongest evidence that monotone predicates are the real idea.' },
    { name: 'Search a 2D Matrix', difficulty: 'Medium', url: 'https://leetcode.com/problems/search-a-2d-matrix/', pattern: 'Flattened index', insight: 'Index i maps to (i / cols, i % cols).' },
    { name: 'Search a 2D Matrix II', difficulty: 'Medium', url: 'https://leetcode.com/problems/search-a-2d-matrix-ii/', pattern: 'Staircase', insight: 'Top-right start gives O(m + n) — binary search per row is worse.' },
    { name: 'Koko Eating Bananas', difficulty: 'Medium', url: 'https://leetcode.com/problems/koko-eating-bananas/', pattern: 'Binary search on answer', insight: 'Search the eating speed; feasibility is a ceil-division sum.' },
    { name: 'Capacity To Ship Packages Within D Days', difficulty: 'Medium', url: 'https://leetcode.com/problems/capacity-to-ship-packages-within-d-days/', pattern: 'Binary search on answer', insight: 'lo = max(weights), hi = sum(weights); greedy day count for feasibility.' },
    { name: 'Minimum Number of Days to Make m Bouquets', difficulty: 'Medium', url: 'https://leetcode.com/problems/minimum-number-of-days-to-make-m-bouquets/', pattern: 'Binary search on answer', insight: 'Feasibility counts consecutive runs of bloomed flowers.' },
    { name: 'Find the Smallest Divisor Given a Threshold', difficulty: 'Medium', url: 'https://leetcode.com/problems/find-the-smallest-divisor-given-a-threshold/', pattern: 'Binary search on answer', insight: 'Sum of ceil(a[i]/d) is decreasing in d — perfectly monotone.' },
    { name: 'Magnetic Force Between Two Balls', difficulty: 'Medium', url: 'https://leetcode.com/problems/magnetic-force-between-two-balls/', pattern: 'Binary search on answer (maximise)', insight: 'Maximise the minimum gap — remember the upper-midpoint rule.' },
    { name: 'Kth Smallest Element in a Sorted Matrix', difficulty: 'Medium', url: 'https://leetcode.com/problems/kth-smallest-element-in-a-sorted-matrix/', pattern: 'Binary search on value', insight: 'Count entries ≤ mid with a staircase walk in O(n).' },
    { name: 'Time Based Key-Value Store', difficulty: 'Medium', url: 'https://leetcode.com/problems/time-based-key-value-store/', pattern: 'Upper bound', insight: 'Per key, keep a sorted list of timestamps and take the last one ≤ query.' },
    { name: 'Find K Closest Elements', difficulty: 'Medium', url: 'https://leetcode.com/problems/find-k-closest-elements/', pattern: 'Binary search the window start', insight: 'Search lo in [0, n−k] with the predicate x − a[mid] ≤ a[mid+k] − x.' },
    { name: 'Split Array Largest Sum', difficulty: 'Hard', url: 'https://leetcode.com/problems/split-array-largest-sum/', pattern: 'Binary search on answer', insight: 'The purest "minimise the maximum". Greedy partitioning is the feasibility check.' },
    { name: 'Median of Two Sorted Arrays', difficulty: 'Hard', url: 'https://leetcode.com/problems/median-of-two-sorted-arrays/', pattern: 'Partition search', insight: 'Binary search the split of the smaller array; use ±infinity sentinels at the edges.' },
    { name: 'Find Minimum in Rotated Sorted Array II', difficulty: 'Hard', url: 'https://leetcode.com/problems/find-minimum-in-rotated-sorted-array-ii/', pattern: 'Rotated search with duplicates', insight: 'When a[mid] == a[hi] you learn nothing — shrink with hi-- and accept O(n) worst case.' },
  ],
}
