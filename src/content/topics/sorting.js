export default {
  id: 'sorting',
  title: 'Sorting, Comparators & Selection',
  short: 'Sorting',
  icon: 'SortRounded',
  tier: 'Foundations',
  order: 7,
  estHours: 8,
  prereqs: ['arrays'],
  tagline: 'Sorting is rarely the answer, but it is very often the first line of the answer.',
  mentalModel:
    'Sorting costs O(n log n) and buys you **order** — and order is what makes greedy choices safe, two pointers valid, and binary search possible. Ask "does sorting make this problem obvious?" before anything else.',
  whyItMatters:
    'You will almost never implement merge sort in an interview. You will constantly need to know which sort is stable, how to write a correct comparator, and when a partial sort (heap or quickselect) beats a full one.',

  complexity: [
    { op: 'Merge sort', time: 'O(n log n) always', space: 'O(n)', note: 'Stable; the basis of TimSort and external sorting' },
    { op: 'Quick sort', time: 'O(n log n) avg, O(n²) worst', space: 'O(log n)', note: 'Unstable; fastest in practice on primitives' },
    { op: 'Heap sort', time: 'O(n log n) always', space: 'O(1)', note: 'Unstable; no extra memory' },
    { op: 'Insertion sort', time: 'O(n²), O(n) if nearly sorted', space: 'O(1)', note: 'Stable; used for small runs inside TimSort' },
    { op: 'Counting sort', time: 'O(n + k)', space: 'O(k)', note: 'Only for small integer ranges' },
    { op: 'Radix sort', time: 'O(d · (n + b))', space: 'O(n + b)', note: 'Fixed-width keys' },
    { op: 'Bucket sort', time: 'O(n) avg', space: 'O(n)', note: 'Needs uniformly distributed input' },
    { op: 'Quickselect (k-th element)', time: 'O(n) avg, O(n²) worst', space: 'O(1)', note: 'Partial sort — no need to order everything' },
  ],

  sections: [
    {
      id: 'when',
      title: 'When sorting is the right first move',
      blocks: [
        { t: 'lead', text: 'Sorting is a `O(n log n)` down-payment. It is worth it whenever order unlocks a linear second phase.' },
        {
          t: 'table',
          head: ['If the problem involves…', 'Sorting gives you…', 'Example'],
          rows: [
            ['Pairs or triples summing to a target', 'Two pointers instead of a nested loop', '3Sum'],
            ['Intervals', 'The sweep order that makes merging trivial', 'Merge Intervals'],
            ['"Can I schedule / fit / pick the most?"', 'A provable greedy order', 'Non-overlapping Intervals'],
            ['Duplicates or grouping', 'Equal items become adjacent', 'Contains Duplicate'],
            ['Closest / k-nearest', 'Rank by distance', 'K Closest Points to Origin'],
            ['Median / percentile', 'Direct indexing', 'Minimum Moves to Equal Array Elements II'],
            ['Anagram grouping', 'A canonical key per word', 'Group Anagrams'],
          ],
        },
        {
          t: 'warn',
          title: 'When NOT to sort',
          text: 'If the answer depends on original indices, sorting destroys them (sort `(value, index)` pairs instead). If the input is a stream, you cannot sort it. If you only need the top `k`, a heap (`O(n log k)`) or quickselect (`O(n)`) beats a full sort. And if you need `O(n)` overall, sorting has already blown your budget.',
        },
      ],
    },
    {
      id: 'stability',
      title: 'Stability — the property interviewers probe',
      blocks: [
        { t: 'p', text: 'A sort is **stable** if equal elements keep their original relative order. This matters whenever you sort by one key after having sorted by another.' },
        {
          t: 'ascii',
          caption: 'Sorting by grade only; stability decides whether Ann still precedes Bob.',
          code: `
 input:   (Ann, B)  (Bob, B)  (Cal, A)

 STABLE   ->  (Cal, A)  (Ann, B)  (Bob, B)     Ann still before Bob
 UNSTABLE ->  (Cal, A)  (Bob, B)  (Ann, B)     order among equals is arbitrary`,
        },
        {
          t: 'dl',
          items: [
            { term: 'Stable', def: 'Merge sort, insertion sort, TimSort, counting sort, bubble sort.' },
            { term: 'Unstable', def: 'Quick sort, heap sort, selection sort.' },
            { term: 'Java: `Arrays.sort(int[])`', def: 'Dual-pivot quicksort — **unstable**, but that is invisible for primitives since equal ints are indistinguishable.' },
            { term: 'Java: `Arrays.sort(Object[])` / `Collections.sort`', def: 'TimSort — **stable**, `O(n)` on nearly-sorted input, needs `O(n)` auxiliary space.' },
          ],
        },
        {
          t: 'key',
          title: 'Multi-key sorting via stability',
          text: 'To sort by grade ascending then name ascending, you can either write one comparator with a tie-break, or sort by name first and then stably sort by grade. The second is the "radix" way of thinking and is how database ORDER BY with multiple columns is often implemented.',
        },
      ],
    },
    {
      id: 'comparators',
      title: 'Writing comparators that do not blow up',
      blocks: [
        {
          t: 'code',
          lang: 'java',
          caption: 'The comparator toolkit',
          code: `
// Natural, reversed, by key
Arrays.sort(people, Comparator.comparingInt(p -> p.age));
Arrays.sort(people, Comparator.comparing(Person::getName));
Arrays.sort(people, Comparator.comparingInt((Person p) -> p.age).reversed());

// Multi-key: age ascending, then name ascending
Arrays.sort(people, Comparator
        .comparingInt((Person p) -> p.age)
        .thenComparing(p -> p.name));

// int[][] by first column, then second
Arrays.sort(intervals, (a, b) -> a[0] != b[0] ? a[0] - b[0] : a[1] - b[1]);
Arrays.sort(intervals, Comparator.comparingInt(a -> a[0]));   // cleaner, no overflow

// Custom order: "largest number" — concatenation comparison
String[] nums = {"3", "30", "34", "5", "9"};
Arrays.sort(nums, (a, b) -> (b + a).compareTo(a + b));        // -> 9 5 34 3 30`,
        },
        {
          t: 'trap',
          title: 'Never write `a - b` on values that can overflow',
          text: '`Integer.MIN_VALUE - 1` wraps to a positive number, producing an inconsistent comparator. Java then throws `IllegalArgumentException: Comparison method violates its general contract!` — usually only on large inputs, which makes it a nightmare to debug. Use `Integer.compare(a, b)` or `Comparator.comparingInt`.',
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'Safe versus unsafe',
          code: `
// UNSAFE: overflows, and violates the comparator contract
(a, b) -> a.value - b.value

// SAFE
(a, b) -> Integer.compare(a.value, b.value)
Comparator.comparingInt(x -> x.value)

// UNSAFE for doubles: subtracting then casting to int loses the sign for |d| < 1
(a, b) -> (int)(a.score - b.score)

// SAFE
(a, b) -> Double.compare(a.score, b.score)`,
        },
        {
          t: 'note',
          title: 'The comparator contract, in three rules',
          text: '**Antisymmetry**: `cmp(a,b)` and `cmp(b,a)` must have opposite signs. **Transitivity**: if `a < b` and `b < c` then `a < c`. **Consistency of equality**: if `cmp(a,b) == 0`, then `cmp(a,x)` and `cmp(b,x)` must agree for all `x`. Breaking any of these is undefined behaviour, and TimSort actively detects it.',
        },
      ],
    },
    {
      id: 'algorithms',
      title: 'The algorithms you should be able to write',
      blocks: [
        { t: 'h', text: 'Merge sort — and the merge step you reuse everywhere' },
        { t: 'p', text: 'The merge itself appears in merge-k-sorted-lists, counting inversions, and external sorting. Learn the merge even if you never write the full sort.' },
        {
          t: 'code',
          lang: 'java',
          caption: 'Merge sort with an explicit, reusable merge',
          code: `
void mergeSort(int[] a, int lo, int hi, int[] buf) {   // [lo, hi)
    if (hi - lo <= 1) return;
    int mid = lo + (hi - lo) / 2;
    mergeSort(a, lo, mid, buf);
    mergeSort(a, mid, hi, buf);
    merge(a, lo, mid, hi, buf);
}

void merge(int[] a, int lo, int mid, int hi, int[] buf) {
    int i = lo, j = mid, k = lo;
    while (i < mid && j < hi)
        buf[k++] = (a[i] <= a[j]) ? a[i++] : a[j++];   // <= keeps it STABLE
    while (i < mid) buf[k++] = a[i++];
    while (j < hi)  buf[k++] = a[j++];
    System.arraycopy(buf, lo, a, lo, hi - lo);
}`,
        },
        {
          t: 'tip',
          title: 'Counting inversions is merge sort with one extra line',
          text: 'When you take from the right half while the left half still has `mid − i` elements remaining, every one of those forms an inversion. Add `mid − i` to a counter inside the merge and you have solved Count of Smaller Numbers / Reverse Pairs in `O(n log n)`.',
        },
        { t: 'h', text: 'Quickselect — the k-th element without a full sort' },
        {
          t: 'code',
          lang: 'java',
          caption: 'Quickselect: O(n) average for "k-th largest"',
          code: `
int quickselect(int[] a, int k) {          // k-th smallest, 0-indexed
    int lo = 0, hi = a.length - 1;
    Random rnd = new Random();
    while (lo < hi) {
        int p = partition(a, lo, hi, lo + rnd.nextInt(hi - lo + 1));  // randomise!
        if (p == k) return a[p];
        if (p < k) lo = p + 1; else hi = p - 1;
    }
    return a[lo];
}

int partition(int[] a, int lo, int hi, int pivotIdx) {
    int pivot = a[pivotIdx];
    swap(a, pivotIdx, hi);                 // park the pivot at the end
    int store = lo;
    for (int i = lo; i < hi; i++)
        if (a[i] < pivot) swap(a, i, store++);
    swap(a, store, hi);                    // put the pivot in its final place
    return store;
}`,
        },
        {
          t: 'warn',
          title: 'Always randomise the pivot',
          text: 'A fixed pivot (first or last element) gives `O(n²)` on already-sorted input, which is exactly what adversarial test cases use. Random or median-of-three pivoting makes the bad case vanishingly unlikely.',
        },
        { t: 'h', text: 'Counting and bucket sort — beating n log n' },
        { t: 'p', text: 'When keys are small integers, you can skip comparisons entirely. Counting sort tallies each value and rewrites the array; it is `O(n + k)` and stable if you build it with a prefix-sum of counts.' },
        {
          t: 'code',
          lang: 'java',
          caption: 'Counting sort — the O(n) option when the value range is small',
          code: `
int[] countingSort(int[] a, int maxValue) {
    int[] count = new int[maxValue + 1];
    for (int x : a) count[x]++;

    int[] out = new int[a.length];
    int idx = 0;
    for (int v = 0; v <= maxValue; v++)
        while (count[v]-- > 0) out[idx++] = v;
    return out;
}
// Sort Colors, Height Checker, H-Index and "sort by frequency" are all
// counting sort in disguise.`,
        },
      ],
    },
    {
      id: 'topk',
      title: 'Top-k and partial ordering',
      blocks: [
        { t: 'p', text: 'When the question is "the k largest / smallest / closest", a full sort is wasteful. Know all three options and their trade-offs — interviewers frequently ask you to compare them.' },
        {
          t: 'table',
          head: ['Approach', 'Time', 'Space', 'Best when'],
          rows: [
            ['Full sort, take k', 'O(n log n)', 'O(1)–O(n)', 'n is small, or you need the full order anyway'],
            ['Min-heap of size k', 'O(n log k)', 'O(k)', 'k ≪ n, or the data is a **stream**'],
            ['Quickselect', 'O(n) average', 'O(1)', 'One-shot query, in-memory array, order of the k not needed'],
            ['Bucket by count', 'O(n)', 'O(n)', 'The key is a bounded frequency or small integer'],
          ],
        },
        {
          t: 'key',
          title: 'The deciding question is "is it a stream?"',
          text: 'Quickselect needs the whole array in memory and reorders it. A heap processes elements one at a time and never needs to see them again. If the interviewer says "the data does not fit in memory" or "elements arrive over time", the answer is the heap — every time.',
        },
      ],
    },
  ],

  patterns: [
    {
      id: 'sort-then-scan',
      name: 'Sort Then Scan',
      oneLiner: 'Pay O(n log n) once so the second phase is a single linear pass.',
      useWhen: [
        'Intervals, pairs, grouping, greedy scheduling, dedup.',
        'Anything where adjacency after sorting is meaningful.',
      ],
      recognize: ['"Merge", "overlap", "minimum number of X", "closest pair", "group identical".'],
      steps: [
        'Decide the sort key — this *is* the algorithm design step.',
        'Sort.',
        'Do one linear pass exploiting adjacency or monotonicity.',
      ],
      template: {
        lang: 'java',
        caption: 'Merge Intervals — sort by start, then extend or emit',
        code: `
Arrays.sort(intervals, Comparator.comparingInt(a -> a[0]));
List<int[]> out = new ArrayList<>();

for (int[] iv : intervals) {
    if (!out.isEmpty() && iv[0] <= out.get(out.size() - 1)[1]) {
        out.get(out.size() - 1)[1] = Math.max(out.get(out.size() - 1)[1], iv[1]);
    } else {
        out.add(iv.clone());
    }
}`,
      },
      complexity: 'O(n log n) dominated by the sort.',
      gotchas: [
        'Choosing to sort by *end* instead of *start* changes the problem completely (see the Greedy chapter).',
        'If you must return original indices, sort index arrays or (value, index) pairs.',
      ],
      problems: ['Merge Intervals', 'Meeting Rooms', 'Largest Number', 'H-Index', '3Sum'],
    },
    {
      id: 'custom-comparator',
      name: 'Custom Comparator / Canonical Order',
      oneLiner: 'Define "less than" for your objects and the sort does the rest.',
      useWhen: ['The desired order is not the natural one.', 'Multi-key ordering, or an order defined by a combination rule.'],
      recognize: ['"Arrange to form the largest number", "sort by frequency then lexicographically", "reconstruct the queue".'],
      steps: ['State the ordering rule in words.', 'Express it as a comparator, using `thenComparing` for tie-breaks.', 'Sanity-check antisymmetry and transitivity.'],
      template: {
        lang: 'java',
        caption: 'Two classics: largest-number concatenation, and queue reconstruction',
        code: `
// Largest Number: a before b iff (a+b) > (b+a) lexicographically
Arrays.sort(strs, (a, b) -> (b + a).compareTo(a + b));

// Queue Reconstruction by Height:
// tallest first, and among equal heights, smaller k first;
// then insert each person at index k — taller people are already placed,
// so the index is exactly the count of taller-or-equal people in front.
Arrays.sort(people, (a, b) -> a[0] != b[0] ? b[0] - a[0] : a[1] - b[1]);
List<int[]> q = new LinkedList<>();
for (int[] p : people) q.add(p[1], p);`,
      },
      complexity: 'O(n log n) comparisons, each costing the comparator’s own cost.',
      gotchas: [
        'Use `Integer.compare`, never subtraction, when values may be large or negative.',
        'A comparator with an expensive body (string concatenation) multiplies the sort cost — mention it.',
      ],
      problems: ['Largest Number', 'Queue Reconstruction by Height', 'Sort Characters By Frequency', 'Custom Sort String', 'Relative Sort Array'],
    },
    {
      id: 'quickselect',
      name: 'Quickselect (Partial Selection)',
      oneLiner: 'Partition toward the k-th position and ignore the half you do not need.',
      useWhen: ['"K-th largest/smallest" on an in-memory array.', 'You do not need the k elements in sorted order.'],
      recognize: ['"Kth largest element in an array", "top K frequent" with an O(n) follow-up.'],
      steps: ['Randomly pick a pivot and partition.', 'Compare the pivot’s final index with `k` and recurse into one side only.'],
      complexity: 'O(n) average (n + n/2 + n/4 + … = 2n), O(n²) worst, O(1) space.',
      gotchas: [
        'Randomise the pivot or an adversarial test kills you.',
        'It mutates the input — confirm that is allowed.',
        'Handle duplicates with three-way partitioning if the array is heavily repeated.',
      ],
      problems: ['Kth Largest Element in an Array', 'K Closest Points to Origin', 'Top K Frequent Elements', 'Wiggle Sort II'],
    },
    {
      id: 'counting-sort',
      name: 'Counting / Bucket Sort',
      oneLiner: 'When keys are small integers, count them instead of comparing them.',
      useWhen: ['Values are bounded (0–100, ages, characters, frequencies).', 'You need O(n) and the comparison lower bound is in your way.'],
      recognize: ['Constraints give a small value range, or the key is itself a count.'],
      steps: ['Tally counts into an array indexed by value.', 'Walk the count array in order (or in reverse for descending).'],
      complexity: 'O(n + k) time, O(k) space.',
      gotchas: [
        'Offset negative values (`index = value − min`).',
        'Comparison sorts have an `Ω(n log n)` lower bound; counting sort escapes it only because it does not compare.',
      ],
      problems: ['Sort Colors', 'Height Checker', 'Top K Frequent Elements', 'H-Index', 'Maximum Gap'],
    },
    {
      id: 'merge-count',
      name: 'Merge Sort with a Counter (Inversions)',
      oneLiner: 'Piggyback on the merge step to count cross-pairs in O(n log n).',
      useWhen: ['Counting pairs `(i, j)` with `i < j` and a comparison condition on `a[i]`, `a[j]`.'],
      recognize: ['"Count of smaller numbers after self", "reverse pairs", "count inversions", "global and local inversions".'],
      steps: [
        'Sort recursively.',
        'During the merge, when an element from the right half is taken, every remaining left-half element forms a qualifying pair.',
        'For conditions like `a[i] > 2·a[j]`, run a separate counting two-pointer pass before merging.',
      ],
      complexity: 'O(n log n) time, O(n) space.',
      gotchas: ['Count before or after merging consistently; mixing the two double-counts.', 'Use `long` when comparing `2 * a[j]`.'],
      problems: ['Count of Smaller Numbers After Self', 'Reverse Pairs', 'Global and Local Inversions'],
    },
  ],

  pitfalls: [
    { title: 'Subtraction comparators', text: '`a - b` overflows and breaks the comparator contract. Use `Integer.compare`.' },
    { title: 'Sorting when indices matter', text: 'Sort `(value, index)` pairs, or sort an index array by value.' },
    { title: 'Assuming Arrays.sort is stable', text: 'It is for objects (TimSort), not for primitives (quicksort).' },
    { title: 'Full sort for top-k', text: 'O(n log n) when O(n log k) or O(n) is available. Interviewers notice.' },
    { title: 'Quickselect with a fixed pivot', text: 'Sorted input degrades it to O(n²).' },
    { title: 'Forgetting sort cost in the final complexity', text: 'If you sort inside a loop over n items, you are at O(n² log n).' },
  ],

  cheatsheet: [
    { label: 'Stable sorts', value: 'merge, insertion, TimSort, counting' },
    { label: 'Unstable sorts', value: 'quick, heap, selection' },
    { label: 'Java primitives', value: 'dual-pivot quicksort (unstable)' },
    { label: 'Java objects', value: 'TimSort (stable, O(n) if sorted)' },
    { label: 'Safe comparator', value: 'Integer.compare(a, b)' },
    { label: 'Multi-key', value: 'comparing(...).thenComparing(...)' },
    { label: 'Largest number', value: '(b+a).compareTo(a+b)' },
    { label: 'k-th element', value: 'quickselect O(n) avg' },
    { label: 'Top-k on a stream', value: 'min-heap of size k' },
    { label: 'Small value range', value: 'counting sort O(n+k)' },
    { label: 'Count inversions', value: 'merge sort + counter' },
  ],

  problems: [
    { name: 'Merge Sorted Array', difficulty: 'Easy', url: 'https://leetcode.com/problems/merge-sorted-array/', pattern: 'Merge step', insight: 'Fill from the back to avoid overwriting.' },
    { name: 'Sort Array By Parity', difficulty: 'Easy', url: 'https://leetcode.com/problems/sort-array-by-parity/', pattern: 'Partition', insight: 'A single Lomuto-style partition pass — no sorting needed.' },
    { name: 'Height Checker', difficulty: 'Easy', url: 'https://leetcode.com/problems/height-checker/', pattern: 'Counting sort', insight: 'Heights are bounded by 100, so count rather than sort.' },
    { name: 'Relative Sort Array', difficulty: 'Easy', url: 'https://leetcode.com/problems/relative-sort-array/', pattern: 'Custom order + counting', insight: 'Map each value to its rank in arr2; unlisted values sort last, ascending.' },
    { name: 'Meeting Rooms', difficulty: 'Easy', url: 'https://leetcode.com/problems/meeting-rooms/', pattern: 'Sort then scan', insight: 'Sort by start and check every adjacent pair for overlap.' },
    { name: 'Sort an Array', difficulty: 'Medium', url: 'https://leetcode.com/problems/sort-an-array/', pattern: 'Merge / heap sort', insight: 'The problem exists to make you implement one by hand — merge sort is the safest.' },
    { name: 'Sort Colors', difficulty: 'Medium', url: 'https://leetcode.com/problems/sort-colors/', pattern: 'Dutch flag / counting', insight: 'Two passes with counting is fine; one pass with three pointers is the expected answer.' },
    { name: 'Kth Largest Element in an Array', difficulty: 'Medium', url: 'https://leetcode.com/problems/kth-largest-element-in-an-array/', pattern: 'Quickselect / heap', insight: 'Heap is O(n log k); quickselect is O(n) average. Know both.' },
    { name: 'Top K Frequent Elements', difficulty: 'Medium', url: 'https://leetcode.com/problems/top-k-frequent-elements/', pattern: 'Counting + bucket', insight: 'Bucket by frequency for O(n).' },
    { name: 'Sort Characters By Frequency', difficulty: 'Medium', url: 'https://leetcode.com/problems/sort-characters-by-frequency/', pattern: 'Counting + bucket', insight: 'Build the output by walking buckets from the highest count down.' },
    { name: 'Merge Intervals', difficulty: 'Medium', url: 'https://leetcode.com/problems/merge-intervals/', pattern: 'Sort then scan', insight: 'Sort by start; extend the last interval when it overlaps.' },
    { name: 'Largest Number', difficulty: 'Medium', url: 'https://leetcode.com/problems/largest-number/', pattern: 'Custom comparator', insight: 'Compare concatenations both ways; handle the all-zeros case.' },
    { name: 'Queue Reconstruction by Height', difficulty: 'Medium', url: 'https://leetcode.com/problems/queue-reconstruction-by-height/', pattern: 'Custom comparator + insert', insight: 'Tallest first, then insert at index k — placement becomes self-consistent.' },
    { name: 'K Closest Points to Origin', difficulty: 'Medium', url: 'https://leetcode.com/problems/k-closest-points-to-origin/', pattern: 'Heap / quickselect', insight: 'Compare squared distances — no square roots needed.' },
    { name: 'Custom Sort String', difficulty: 'Medium', url: 'https://leetcode.com/problems/custom-sort-string/', pattern: 'Custom order', insight: 'Map characters to their rank in the order string; unlisted characters go last.' },
    { name: 'Wiggle Sort II', difficulty: 'Medium', url: 'https://leetcode.com/problems/wiggle-sort-ii/', pattern: 'Quickselect + interleave', insight: 'Find the median, three-way partition, then place into odd indices first with reversed order.' },
    { name: 'Maximum Gap', difficulty: 'Medium', url: 'https://leetcode.com/problems/maximum-gap/', pattern: 'Bucket sort / pigeonhole', insight: 'The maximum gap is at least ceil((max−min)/(n−1)), so it must occur between buckets.' },
    { name: 'H-Index', difficulty: 'Medium', url: 'https://leetcode.com/problems/h-index/', pattern: 'Counting sort', insight: 'Bucket citations at n; then sweep from the highest bucket accumulating counts.' },
    { name: 'Count of Smaller Numbers After Self', difficulty: 'Hard', url: 'https://leetcode.com/problems/count-of-smaller-numbers-after-self/', pattern: 'Merge sort + counter', insight: 'Count during the merge, or use a BIT over compressed values.' },
    { name: 'Reverse Pairs', difficulty: 'Hard', url: 'https://leetcode.com/problems/reverse-pairs/', pattern: 'Merge sort + counter', insight: 'Count pairs with a two-pointer pass over the two sorted halves before merging; use long.' },
  ],
}
