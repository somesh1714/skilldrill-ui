export default {
  id: 'complexity',
  title: 'Complexity & The Problem-Solving Framework',
  short: 'Complexity',
  icon: 'SpeedRounded',
  tier: 'Foundations',
  order: 1,
  estHours: 6,
  prereqs: [],
  tagline: 'Before you learn any data structure, learn how to budget time and how to read a problem.',
  mentalModel:
    'The constraints tell you the algorithm. Read `n` first, pick the complexity you are allowed, and only then think about code.',
  whyItMatters:
    'Ninety percent of interview failures are not "I did not know the trick" — they are "I never worked out what complexity I was aiming for, so I optimised the wrong thing." This chapter is the compass for every chapter that follows.',

  complexity: [
    { op: 'O(1)', time: 'constant', space: '—', note: 'Hash lookup, array index, arithmetic' },
    { op: 'O(log n)', time: 'logarithmic', space: '—', note: 'Binary search, balanced-tree op, heap push/pop' },
    { op: 'O(n)', time: 'linear', space: '—', note: 'One pass, two pointers, prefix sums' },
    { op: 'O(n log n)', time: 'linearithmic', space: '—', note: 'Sorting, heap of n items, divide & conquer merge' },
    { op: 'O(n²)', time: 'quadratic', space: '—', note: 'All pairs, naive DP over 2 indices' },
    { op: 'O(2ⁿ)', time: 'exponential', space: '—', note: 'Subsets, unpruned backtracking' },
    { op: 'O(n!)', time: 'factorial', space: '—', note: 'Permutations, travelling salesman brute force' },
  ],

  sections: [
    {
      id: 'framework',
      title: 'The six-step framework (use it every single time)',
      blocks: [
        { t: 'lead', text: 'Strong problem solvers are not faster thinkers. They are more *ordered* thinkers. Here is the order.' },
        {
          t: 'steps',
          items: [
            { title: 'Restate & clarify', text: 'Say the problem back in one sentence. Ask about: duplicates, empty input, negative numbers, sorted or not, in-place or not, return index or value, and the exact tie-break rule. Half of all wrong answers are answers to a slightly different question.' },
            { title: 'Read the constraints out loud', text: 'This single habit is worth more than memorising fifty solutions. `n ≤ 20` means exponential is fine. `n ≤ 10⁵` means you need `O(n log n)` or better. See the table below.' },
            { title: 'Draw a tiny example by hand', text: 'Use 4–6 elements, include a duplicate and a negative. Solve it on paper. The pattern you use on paper *is* the algorithm — you just have not named it yet.' },
            { title: 'State the brute force, then find its waste', text: 'Always verbalise brute force with its complexity. Then ask the only optimisation question that matters: **what work am I repeating?** Repeated scanning → two pointers / sliding window. Repeated sub-answers → memoisation / DP. Repeated "have I seen this?" → hash set. Repeated min/max of a window → heap or monotonic deque.' },
            { title: 'Name the pattern, then write the template', text: 'Do not invent code under pressure. Recognise the pattern, recall the template you have drilled, and adapt it. That is what the Patterns chapters in this site exist for.' },
            { title: 'Dry-run, then handle edges', text: 'Trace your code on the tiny example **line by line**. Then check: empty, single element, all-equal, already sorted, overflow, and the largest allowed `n`.' },
          ],
        },
        {
          t: 'key',
          title: 'The one question that unlocks optimisation',
          text: '"What work am I repeating?" Every major algorithmic technique — prefix sums, hashing, sliding window, DP, monotonic stack, binary lifting — is an answer to that question.',
        },
      ],
    },
    {
      id: 'constraints',
      title: 'Constraints → algorithm (the single most useful table in DSA)',
      blocks: [
        { t: 'p', text: 'A modern judge runs roughly **10⁸ simple operations per second**. Work backwards from that. Given `n`, this table tells you what complexity you are allowed, and therefore which family of techniques to reach for.' },
        {
          t: 'table',
          head: ['Constraint on n', 'Target complexity', 'What that usually means'],
          rows: [
            ['n ≤ 10–12', 'O(n!) / O(n² · 2ⁿ)', 'Permutations, travelling salesman DP, brute-force search'],
            ['n ≤ 20–25', 'O(2ⁿ) or O(2ⁿ · n)', 'Subset enumeration, bitmask DP, meet-in-the-middle'],
            ['n ≤ 100', 'O(n³)', 'Floyd–Warshall, interval DP, triple loops'],
            ['n ≤ 1 000–2 000', 'O(n²)', 'Classic 2-D DP (edit distance, LCS), all-pairs scan'],
            ['n ≤ 10⁵', 'O(n log n)', 'Sort, heap, binary search on answer, segment tree, DSU'],
            ['n ≤ 10⁶–10⁷', 'O(n)', 'Single pass, two pointers, prefix sums, counting sort, KMP'],
            ['n ≥ 10⁹ (or n is a *value*, not a count)', 'O(log n) / O(1)', 'Binary search on the answer, maths, bit tricks, fast exponentiation'],
          ],
        },
        {
          t: 'tip',
          title: 'Read the constraint as a hint, not a limit',
          text: 'If `n ≤ 10⁵` but the array values are `≤ 10⁹`, the interviewer is telling you that sorting or hashing values is fine, but you must not index an array by value. If `n ≤ 20`, they are *begging* you to use a bitmask.',
        },
        {
          t: 'note',
          title: 'Logs are almost free',
          text: '`log₂(10⁶) ≈ 20`. Adding a log factor multiplies work by ~20, not by a thousand. Never twist your solution into knots to remove a log before you have a working `O(n log n)`.',
        },
      ],
    },
    {
      id: 'bigo',
      title: 'Big-O, stated properly',
      blocks: [
        { t: 'p', text: '`O(f(n))` is an **upper bound on growth**, ignoring constants and lower-order terms. Three facts you must be fluent in:' },
        {
          t: 'dl',
          items: [
            { term: 'Drop constants', def: '`O(3n + 5)` is `O(n)`. Two separate passes over the array is still linear — do not contort code to merge loops "for speed" unless profiling says so.' },
            { term: 'Drop lower terms', def: '`O(n² + n log n)` is `O(n²)`. The biggest term wins as `n` grows.' },
            { term: 'Sequential adds, nested multiplies', def: 'Loop A then loop B is `O(A + B)`. Loop B *inside* loop A is `O(A × B)`.' },
          ],
        },
        { t: 'h', text: 'The complexities people get wrong' },
        {
          t: 'table',
          head: ['Code shape', 'Complexity', 'Why'],
          rows: [
            ['`for (i=0..n) for (j=i..n)`', 'O(n²)', 'n + (n−1) + … + 1 = n(n+1)/2'],
            ['`for (i=1; i<n; i*=2)`', 'O(log n)', 'i doubles, so it takes log₂n steps'],
            ['`for (i=0..n) for (j=1; j<n; j*=2)`', 'O(n log n)', 'Linear outer, log inner'],
            ['Recursion `T(n)=2T(n/2)+O(n)`', 'O(n log n)', 'Merge sort: log n levels, O(n) per level'],
            ['Recursion `T(n)=2T(n/2)+O(1)`', 'O(n)', 'Work is dominated by the leaves'],
            ['Recursion `T(n)=T(n/2)+O(1)`', 'O(log n)', 'Binary search'],
            ['Recursion `T(n)=2T(n−1)+O(1)`', 'O(2ⁿ)', 'Naive Fibonacci / subset generation'],
            ['Building a heap from n items', 'O(n)', 'Not O(n log n) — the sift-down cost telescopes'],
            ['`substring(i, j)` in Java', 'O(j−i)', 'Copies characters. A loop of substrings is silently quadratic'],
            ['`list.remove(0)` on ArrayList', 'O(n)', 'Shifts everything left — use ArrayDeque instead'],
          ],
        },
        {
          t: 'trap',
          title: 'The hidden-cost trap',
          text: 'Interviewers love candidates who notice that `String` concatenation in a loop is `O(n²)` in Java, that `arr.contains(x)` on a list is `O(n)`, and that slicing a Python list copies it. Say these out loud when you write them — it signals real engineering maturity.',
        },
      ],
    },
    {
      id: 'amortized',
      title: 'Amortised analysis — why "sometimes slow" is still fast',
      blocks: [
        { t: 'p', text: 'An `ArrayList` doubles its capacity when full. A single `add` can be `O(n)` because it copies everything. Yet we call `add` **amortised O(1)**. Why?' },
        { t: 'p', text: 'Because doubling means the expensive copies happen at sizes 1, 2, 4, 8, …, n. Their total cost is `1 + 2 + 4 + … + n < 2n`. Spread over `n` insertions, that is `O(1)` each, on average, *guaranteed over the sequence* — not just "usually".' },
        {
          t: 'key',
          title: 'Where amortised reasoning shows up in interviews',
          text: 'Monotonic stack/deque problems. Each element is pushed once and popped at most once, so even though the inner `while` loop looks nested, the whole algorithm is `O(n)`. If you can say that sentence, you have already passed the "Daily Temperatures" question.',
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'Looks quadratic, is actually linear — the amortised argument in code',
          code: `
// Next Greater Element — the inner while loop is NOT a second dimension.
// Every index is pushed exactly once and popped at most once => O(n) total.
int[] nextGreater(int[] a) {
    int n = a.length;
    int[] res = new int[n];
    java.util.Arrays.fill(res, -1);
    Deque<Integer> stack = new ArrayDeque<>();   // holds indices, values decreasing

    for (int i = 0; i < n; i++) {
        while (!stack.isEmpty() && a[stack.peek()] < a[i]) {
            res[stack.pop()] = a[i];             // a[i] is the answer for that index
        }
        stack.push(i);
    }
    return res;
}`,
        },
      ],
    },
    {
      id: 'space',
      title: 'Space complexity (the half everybody forgets)',
      blocks: [
        { t: 'p', text: 'Auxiliary space is memory you allocate **beyond the input**. Two rules that catch people out:' },
        {
          t: 'ul',
          items: [
            'Recursion costs stack space equal to the **maximum depth**, not the number of calls. A recursive tree traversal is `O(h)` space, which is `O(log n)` for a balanced tree and `O(n)` for a degenerate one.',
            'The output array usually does *not* count toward auxiliary space, but say so explicitly rather than assuming the interviewer agrees.',
          ],
        },
        {
          t: 'table',
          head: ['Technique', 'Time', 'Auxiliary space'],
          rows: [
            ['Two pointers / sliding window', 'O(n)', 'O(1) — or O(k) for a window map'],
            ['Sorting (Java `Arrays.sort` on primitives)', 'O(n log n)', 'O(log n) — dual-pivot quicksort'],
            ['Sorting (Java `Arrays.sort` on objects)', 'O(n log n)', 'O(n) — TimSort is stable, needs a buffer'],
            ['Recursive DFS on a tree', 'O(n)', 'O(h)'],
            ['BFS on a grid', 'O(rows·cols)', 'O(min(rows,cols)) frontier, O(rows·cols) visited'],
            ['1-D DP rolled from 2-D', 'O(n·m)', 'O(min(n,m))'],
            ['Heap of size k', 'O(n log k)', 'O(k)'],
          ],
        },
        {
          t: 'tip',
          title: 'The "can you do it in O(1) space?" follow-up',
          text: 'It has a small number of standard answers: two pointers, in-place swapping, reversing part of the array, Floyd cycle detection, using the input array itself as a hash table (index-as-key), or the XOR trick. If you are asked, run down that list.',
        },
      ],
    },
    {
      id: 'communication',
      title: 'How to talk while you solve',
      blocks: [
        { t: 'p', text: 'The code is maybe half the signal. This is the script that reliably reads as "senior".' },
        {
          t: 'ol',
          items: [
            '**Clarify** — "Can the array be empty? Are values distinct? Should I return the index or the value?"',
            '**Commit to a target** — "n is up to 10⁵, so I am aiming for O(n log n) at worst."',
            '**Brute force out loud** — "The naive approach checks all pairs, O(n²). The repeated work is re-scanning the suffix for a complement."',
            '**Name the pattern** — "That repetition is exactly what a hash map removes, so this is a one-pass complement lookup."',
            '**Write clean code** — meaningful names, no magic numbers, guard clauses first.',
            '**Dry-run aloud** — walk the small example through your own code, and *let yourself find the bug*. Finding your own bug is a strong positive signal.',
            '**Close it** — restate final time and space, then name one edge case you deliberately handled and one trade-off you chose.',
          ],
        },
        {
          t: 'trap',
          title: 'Silence is the real failure mode',
          text: 'An interviewer cannot give you a hint if they cannot see where you are. Think out loud even when you are stuck — especially when you are stuck. "I am considering sorting first, but that destroys the original indices, so let me store pairs instead" is worth more than two minutes of quiet typing.',
        },
      ],
    },
  ],

  patterns: [
    {
      id: 'constraint-driven',
      name: 'Constraint-Driven Algorithm Selection',
      oneLiner: 'Let the input size pick the technique before you pick the code.',
      useWhen: [
        'Always — this is step zero of every problem.',
        'Especially when you feel stuck: the constraint narrows the search space of *approaches*.',
      ],
      recognize: [
        'The problem statement lists explicit bounds like `1 ≤ n ≤ 10⁵`.',
        'A suspiciously small bound (`n ≤ 20`) is a bitmask hint.',
        'A suspiciously large *value* bound with a small *count* bound hints at binary search on the answer.',
      ],
      steps: [
        'Read `n` and any value bounds.',
        'Look up the allowed complexity in the constraints table.',
        'List the techniques that hit that complexity for this data shape.',
        'Pick the simplest one that works, and say why you rejected the others.',
      ],
      complexity: 'Meta-technique — costs nothing, saves everything.',
      gotchas: [
        'Do not confuse the number of elements with the magnitude of elements. `n ≤ 10⁵` with `a[i] ≤ 10⁹` forbids value-indexed arrays.',
        'Sum-of-n constraints across test cases ("sum of n over all queries ≤ 2·10⁵") mean per-test `O(n)` is fine even if a single `n` looks large.',
      ],
      problems: ['Two Sum', 'Search a 2D Matrix'],
    },
    {
      id: 'brute-then-cut',
      name: 'Brute Force → Find the Repeated Work → Cut It',
      oneLiner: 'Every optimisation in DSA is the removal of a specific repetition.',
      useWhen: [
        'You can describe a correct-but-slow solution but cannot see the fast one.',
        'You need a safety net: a stated brute force is far better than nothing on the whiteboard.',
      ],
      recognize: ['You are recomputing a sum, a max, a "have I seen it", or a subproblem answer.'],
      steps: [
        'Write (or state) the brute force and its complexity.',
        'Point at the exact line that recomputes something.',
        'Match the repetition to its remover using the table below.',
        'Re-derive the complexity and confirm it hits your target.',
      ],
      template: {
        lang: 'java',
        caption: 'The repetition → remover mapping, as a lookup you memorise',
        code: `
/*  REPEATED WORK                       ->  REMOVER
 *  --------------------------------------------------------------
 *  Re-summing a subarray                ->  Prefix sums
 *  Re-scanning for "seen this before?"  ->  HashSet / HashMap
 *  Re-scanning a shifting window        ->  Sliding window
 *  Re-scanning a SORTED array for pairs ->  Two pointers
 *  Re-solving the same subproblem       ->  Memoisation / DP
 *  Re-finding min/max of a collection   ->  Heap
 *  Re-finding min/max of a WINDOW       ->  Monotonic deque
 *  Re-finding "next greater element"    ->  Monotonic stack
 *  Re-checking connectivity             ->  Union-Find (DSU)
 *  Re-walking a prefix of strings       ->  Trie
 *  Re-querying a range that changes     ->  Segment tree / BIT
 *  Re-testing every candidate answer    ->  Binary search on answer
 */`,
      },
      complexity: 'Turns O(n²) into O(n) or O(n log n) in the overwhelming majority of interview problems.',
      gotchas: [
        'Do not skip stating the brute force. Interviewers score "arrives at *a* solution" separately from "optimises it".',
        'If the repetition is not obvious, make your example bigger. Repetition becomes visible at n = 6 that was invisible at n = 3.',
      ],
      problems: ['Two Sum', 'Longest Substring Without Repeating Characters', 'Subarray Sum Equals K'],
    },
    {
      id: 'space-time-trade',
      name: 'Trade Space for Time (and back)',
      oneLiner: 'Almost every speed-up is paid for in memory; almost every memory saving is paid for in time.',
      useWhen: [
        'You have a linear-time solution and are asked to reduce space.',
        'You have a low-memory solution and are asked to go faster.',
      ],
      recognize: ['The follow-up question contains the words "without extra space" or "can you do better".'],
      steps: [
        'For faster: add a hash map, a precomputed table, or memoisation.',
        'For smaller: sort in place, use two pointers, roll a DP table down to one or two rows, or encode state in the input (negation / index-as-key).',
      ],
      complexity: 'O(n) extra space typically buys a factor of n in time.',
      gotchas: ['In-place tricks that mutate the input are only acceptable if you confirm mutation is allowed. Ask.'],
      problems: ['Find All Numbers Disappeared in an Array', 'Set Matrix Zeroes'],
    },
  ],

  pitfalls: [
    { title: 'Optimising before you have anything correct', text: 'A working O(n²) beats a broken O(n). Get correct, then get fast — and say that plan out loud so the interviewer knows it is deliberate.' },
    { title: 'Ignoring the recursion stack in space analysis', text: 'A "constant space" recursive solution is not constant space. Depth h costs O(h).' },
    { title: 'Quoting average-case as if it were worst-case', text: 'HashMap operations are O(1) *average*, O(n) worst case under adversarial collisions. Quicksort is O(n log n) average, O(n²) worst. Say which you mean.' },
    { title: 'Forgetting integer overflow', text: '`(lo + hi) / 2` overflows for large ints in Java/C++. Write `lo + (hi - lo) / 2`. Sums of 10⁵ values up to 10⁹ need `long`.' },
    { title: 'Treating n log n and n² as "both loops"', text: 'At n = 10⁵ the difference is ~1.7 million vs 10 billion operations — seconds vs hours.' },
  ],

  cheatsheet: [
    { label: 'Ops per second (rule of thumb)', value: '~10⁸' },
    { label: 'log₂(10⁶)', value: '≈ 20' },
    { label: 'n ≤ 20', value: 'bitmask / 2ⁿ is fine' },
    { label: 'n ≤ 2 000', value: 'O(n²) DP is fine' },
    { label: 'n ≤ 10⁵', value: 'need O(n log n)' },
    { label: 'n ≤ 10⁷', value: 'need O(n)' },
    { label: 'Safe midpoint', value: 'lo + (hi - lo) / 2' },
    { label: 'Heap build', value: 'O(n), not O(n log n)' },
    { label: 'Recursive space', value: 'O(max depth)' },
  ],

  problems: [
    { name: 'Two Sum', difficulty: 'Easy', url: 'https://leetcode.com/problems/two-sum/', pattern: 'Hash complement', insight: 'The canonical "repeated scan → hash map" conversion. Store value→index as you go and look for target − x.' },
    { name: 'Best Time to Buy and Sell Stock', difficulty: 'Easy', url: 'https://leetcode.com/problems/best-time-to-buy-and-sell-stock/', pattern: 'Running minimum', insight: 'Brute force compares all pairs; the repeated work is re-finding the minimum prefix. Track it in one variable.' },
    { name: 'Contains Duplicate', difficulty: 'Easy', url: 'https://leetcode.com/problems/contains-duplicate/', pattern: 'Hash set', insight: 'The purest example of trading O(n) space for a factor of n in time.' },
    { name: 'Majority Element', difficulty: 'Easy', url: 'https://leetcode.com/problems/majority-element/', pattern: 'Boyer–Moore voting', insight: 'Hash map is O(n) space; the voting algorithm gets O(1) by cancelling pairs of different elements.' },
    { name: 'Find All Numbers Disappeared in an Array', difficulty: 'Easy', url: 'https://leetcode.com/problems/find-all-numbers-disappeared-in-an-array/', pattern: 'Index-as-key', insight: 'Values are in [1, n], so the array *is* a hash table. Negate a[|x|−1] to mark presence.' },
    { name: 'Search a 2D Matrix', difficulty: 'Medium', url: 'https://leetcode.com/problems/search-a-2d-matrix/', pattern: 'Binary search on flattened index', insight: 'Constraint reading: fully sorted rows plus row-ordering means the matrix is one sorted array in disguise.' },
    { name: 'Set Matrix Zeroes', difficulty: 'Medium', url: 'https://leetcode.com/problems/set-matrix-zeroes/', pattern: 'Space-time trade', insight: 'O(m+n) marker arrays are the obvious answer; the O(1) follow-up stores the markers in row 0 and column 0.' },
    { name: 'Subarray Sum Equals K', difficulty: 'Medium', url: 'https://leetcode.com/problems/subarray-sum-equals-k/', pattern: 'Prefix sum + hash', insight: 'Repeated subarray summation → prefix sums; repeated search for a matching prefix → hash map.' },
  ],
}
