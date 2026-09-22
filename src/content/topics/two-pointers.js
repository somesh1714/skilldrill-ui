export default {
  id: 'two-pointers',
  title: 'Two Pointers & Sliding Window',
  short: 'Two Pointers',
  icon: 'SwapHorizRounded',
  tier: 'Foundations',
  order: 3,
  estHours: 12,
  prereqs: ['arrays'],
  tagline: 'The cheapest way to delete a nested loop. Learn the three shapes and you will spot them everywhere.',
  mentalModel:
    'Two indices walking a line. If moving one of them can only ever help or only ever hurt, you never need to go back — and the O(n²) collapses to O(n).',
  whyItMatters:
    'This is the highest-frequency optimisation in interviews. "Longest / shortest / count of subarrays or substrings satisfying P" is a sliding window in ~80% of cases, and the remaining 20% are two pointers on a sorted array.',

  complexity: [
    { op: 'Opposite-direction two pointers', time: 'O(n)', space: 'O(1)', note: 'Requires sorted input or a monotone property' },
    { op: 'Same-direction (fast/slow)', time: 'O(n)', space: 'O(1)', note: 'In-place filtering, dedup, cycle detection' },
    { op: 'Fixed-size sliding window', time: 'O(n)', space: 'O(1)–O(k)', note: 'Add one, remove one per step' },
    { op: 'Variable-size sliding window', time: 'O(n)', space: 'O(k)', note: 'Each index enters and leaves once — amortised' },
    { op: 'Window with max/min query', time: 'O(n)', space: 'O(k)', note: 'Monotonic deque' },
    { op: 'Sorting first, then two pointers', time: 'O(n log n)', space: 'O(1)', note: 'Dominated by the sort' },
  ],

  sections: [
    {
      id: 'why',
      title: 'Why it works: the monotonicity argument',
      blocks: [
        { t: 'lead', text: 'Two pointers is not a trick. It is a proof that you never need to look backwards.' },
        { t: 'p', text: 'Take **Two Sum on a sorted array**. Put `l` at the start and `r` at the end. If `a[l] + a[r] > target`, then `a[r]` paired with *any* `l′ ≥ l` is still too big — so `a[r]` can never be part of the answer, and you may discard it forever by doing `r--`. Symmetrically if the sum is too small, `a[l]` is useless and you do `l++`.' },
        { t: 'p', text: 'Every step **permanently eliminates one element**. There are `n` elements, so there are at most `n` steps. That is the entire complexity proof, and it is the sentence you should say in an interview.' },
        {
          t: 'ascii',
          caption: 'Each comparison kills one candidate — n candidates, n steps.',
          code: `
target = 13
        l                             r
      [ 2 ,  3 ,  5 ,  8 ,  9 , 11 , 14 ]
        2 + 14 = 16 > 13   ->  14 can never work  ->  r--

        l                       r
      [ 2 ,  3 ,  5 ,  8 ,  9 , 11 , 14 ]
        2 + 11 = 13 == 13  ->  found`,
        },
        {
          t: 'key',
          title: 'The precondition you must check',
          text: 'Opposite-direction two pointers needs a **monotone** relationship: moving `l` right must move the quantity one way, moving `r` left must move it the other. Sorted arrays give you this for free. Without monotonicity, use a hash map instead.',
        },
      ],
    },
    {
      id: 'shapes',
      title: 'The three shapes',
      blocks: [
        { t: 'h', text: 'Shape 1 — Opposite ends (converging)' },
        { t: 'p', text: 'Pointers start at the two ends and move toward each other. Used for pair sums on sorted data, palindromes, container problems, and reversal.' },
        {
          t: 'code',
          lang: 'java',
          caption: 'Converging template',
          code: `
int l = 0, r = n - 1;
while (l < r) {
    int sum = a[l] + a[r];
    if (sum == target) return new int[]{ l, r };
    else if (sum < target) l++;          // need a bigger value
    else r--;                            // need a smaller value
}`,
        },
        { t: 'h', text: 'Shape 2 — Same direction (fast & slow / read & write)' },
        { t: 'p', text: 'Both move forward, at different speeds or with different jobs. The most common job split is **`read` scans, `write` places** — that is how every in-place filter works.' },
        {
          t: 'code',
          lang: 'java',
          caption: 'Read/write template — in-place removal, dedup, compaction',
          code: `
int write = 0;
for (int read = 0; read < n; read++) {
    if (keep(a[read])) {                 // whatever the keep-condition is
        a[write++] = a[read];
    }
}
return write;                            // new logical length

// Remove Duplicates from Sorted Array is exactly this with:
//   keep = (write == 0 || a[read] != a[write - 1])`,
        },
        { t: 'h', text: 'Shape 3 — Sliding window' },
        { t: 'p', text: 'A same-direction pair where the interval `[left, right]` *is* the answer object. `right` expands the window; `left` contracts it when the window becomes invalid (or when you want to shrink a valid one).' },
        {
          t: 'ascii',
          caption: 'The window breathes: expand right, then contract left until valid again.',
          code: `
 "a b c a b c b b"          k = 3 distinct allowed

  L                                 expand ->  window "abc"   valid
  |-----|
  a b c a b c b b

  L                                 expand ->  window "abca"  still 3 distinct
  |-------|
  a b c a b c b b

      L                             4 distinct -> contract L until valid
      |---------|
  a b c a b c b b`,
        },
      ],
    },
    {
      id: 'window-template',
      title: 'The one sliding-window template that solves them all',
      blocks: [
        { t: 'p', text: 'Almost every variable-size window problem fits this skeleton. Learn it as muscle memory, then change only three lines: how you *add*, how you *remove*, and what makes the window *invalid*.' },
        {
          t: 'code',
          lang: 'java',
          caption: 'Universal variable-size window — LONGEST variant',
          code: `
int longestWindow(int[] a) {
    Map<Integer, Integer> win = new HashMap<>();   // window state
    int left = 0, best = 0;

    for (int right = 0; right < a.length; right++) {
        // 1. ADD a[right] to the window
        win.merge(a[right], 1, Integer::sum);

        // 2. SHRINK while the window is INVALID
        while (win.size() > K) {                   // <- the only condition that changes
            int out = a[left++];
            if (win.merge(out, -1, Integer::sum) == 0) win.remove(out);
        }

        // 3. The window is now valid -> record
        best = Math.max(best, right - left + 1);
    }
    return best;
}`,
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'Universal variable-size window — SHORTEST variant (note where the answer is recorded)',
          code: `
int shortestWindow(int[] a, int target) {
    int left = 0, sum = 0, best = Integer.MAX_VALUE;

    for (int right = 0; right < a.length; right++) {
        sum += a[right];                           // 1. ADD

        while (sum >= target) {                    // 2. while VALID, try to shrink
            best = Math.min(best, right - left + 1);   // 3. record INSIDE the loop
            sum -= a[left++];
        }
    }
    return best == Integer.MAX_VALUE ? 0 : best;
}`,
        },
        {
          t: 'key',
          title: 'Longest vs shortest — the only structural difference',
          text: 'For **longest**, the `while` loop restores validity and you record **after** it. For **shortest**, the `while` loop runs *while valid* and you record **inside** it. Get this backwards and the code compiles, runs, and returns the wrong number.',
        },
        { t: 'h', text: 'Counting windows: the "at most" trick' },
        { t: 'p', text: 'Problems asking for "number of subarrays with **exactly** K distinct" are hard directly, but trivial via a subtraction:' },
        {
          t: 'code',
          lang: 'java',
          caption: 'exactly(K) = atMost(K) − atMost(K−1)',
          code: `
int subarraysWithKDistinct(int[] a, int k) {
    return atMost(a, k) - atMost(a, k - 1);
}

int atMost(int[] a, int k) {
    Map<Integer,Integer> win = new HashMap<>();
    int left = 0, count = 0;
    for (int right = 0; right < a.length; right++) {
        win.merge(a[right], 1, Integer::sum);
        while (win.size() > k) {
            int out = a[left++];
            if (win.merge(out, -1, Integer::sum) == 0) win.remove(out);
        }
        // every window ending at 'right' and starting at >= left is valid
        count += right - left + 1;
    }
    return count;
}`,
        },
        {
          t: 'tip',
          title: 'The counting line is the one to remember',
          text: '`count += right - left + 1` counts all valid subarrays **ending at `right`**. This single line converts any "at most" window into a counting solution — and combined with the subtraction trick, into an "exactly" solution.',
        },
        {
          t: 'warn',
          title: 'Sliding window needs non-negative contributions',
          text: 'The window technique assumes that growing the window can only push you *further* past the threshold. With negative numbers in a sum problem, shrinking is no longer guaranteed to help — use a prefix sum with a hash map (or a monotonic deque) instead.',
        },
      ],
    },
    {
      id: 'fixed-window',
      title: 'Fixed-size windows and the monotonic deque',
      blocks: [
        { t: 'p', text: 'When `k` is fixed, there is no shrink loop — you add the incoming element and remove the outgoing one on every step.' },
        {
          t: 'code',
          lang: 'java',
          caption: 'Fixed window skeleton',
          code: `
long sum = 0, best = Long.MIN_VALUE;
for (int i = 0; i < n; i++) {
    sum += a[i];                          // add incoming
    if (i >= k) sum -= a[i - k];          // remove outgoing
    if (i >= k - 1) best = Math.max(best, sum);
}`,
        },
        { t: 'p', text: 'If instead of a sum you need the **maximum of each window**, a heap gives `O(n log k)` but a **monotonic deque** gives `O(n)`. Keep the deque decreasing: the front is always the window maximum.' },
        {
          t: 'code',
          lang: 'java',
          caption: 'Sliding Window Maximum — monotonic deque, O(n)',
          code: `
int[] maxSlidingWindow(int[] a, int k) {
    Deque<Integer> dq = new ArrayDeque<>();      // stores INDICES, values decreasing
    int[] out = new int[a.length - k + 1];

    for (int i = 0; i < a.length; i++) {
        // drop indices that have slid out of the window
        if (!dq.isEmpty() && dq.peekFirst() <= i - k) dq.pollFirst();

        // drop values smaller than a[i] — they can never be a future maximum
        while (!dq.isEmpty() && a[dq.peekLast()] <= a[i]) dq.pollLast();

        dq.offerLast(i);
        if (i >= k - 1) out[i - k + 1] = a[dq.peekFirst()];
    }
    return out;
}`,
        },
        {
          t: 'key',
          title: 'Why the deque is O(n)',
          text: 'Every index is offered exactly once and polled at most once. The inner `while` is amortised `O(1)`. Say this sentence and the interviewer stops worrying about the nested loop.',
        },
      ],
    },
    {
      id: 'fast-slow',
      title: 'Fast & slow pointers (Floyd)',
      blocks: [
        { t: 'p', text: 'Move one pointer one step and another two steps. Three classic uses:' },
        {
          t: 'ol',
          items: [
            '**Cycle detection** — if they ever meet, there is a cycle.',
            '**Middle of a list** — when `fast` hits the end, `slow` is at the middle.',
            '**Cycle entry point** — after meeting, reset one pointer to the head and advance both one step at a time; they meet at the entrance.',
          ],
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'Floyd’s algorithm, all three uses',
          code: `
boolean hasCycle(ListNode head) {
    ListNode slow = head, fast = head;
    while (fast != null && fast.next != null) {
        slow = slow.next;
        fast = fast.next.next;
        if (slow == fast) return true;
    }
    return false;
}

ListNode detectCycleStart(ListNode head) {
    ListNode slow = head, fast = head;
    while (fast != null && fast.next != null) {
        slow = slow.next; fast = fast.next.next;
        if (slow == fast) {                  // meeting point found
            ListNode p = head;
            while (p != slow) { p = p.next; slow = slow.next; }
            return p;                        // entrance of the cycle
        }
    }
    return null;
}`,
        },
        {
          t: 'note',
          title: 'Why the reset works (the proof in one line)',
          text: 'Let `L` be the distance head→entrance and `C` the cycle length. When they meet, `slow` has walked `L + x` and `fast` `2(L + x)`, so `L + x ≡ 0 (mod C)`. That means walking another `L` steps from the meeting point lands exactly on the entrance — which is also `L` steps from the head.',
        },
      ],
    },
    {
      id: 'ksum',
      title: 'The k-Sum ladder',
      blocks: [
        { t: 'p', text: '2Sum, 3Sum and 4Sum form a ladder: each level sorts, fixes one more index with a loop, and finishes with two pointers. The only genuinely tricky part is **de-duplication**.' },
        {
          t: 'code',
          lang: 'java',
          caption: '3Sum — sort, fix, converge, and skip duplicates in three places',
          code: `
List<List<Integer>> threeSum(int[] a) {
    Arrays.sort(a);
    List<List<Integer>> res = new ArrayList<>();

    for (int i = 0; i < a.length - 2; i++) {
        if (a[i] > 0) break;                          // sorted: no triple can sum to 0
        if (i > 0 && a[i] == a[i - 1]) continue;      // SKIP 1: duplicate anchor

        int l = i + 1, r = a.length - 1;
        while (l < r) {
            int sum = a[i] + a[l] + a[r];
            if (sum < 0) l++;
            else if (sum > 0) r--;
            else {
                res.add(List.of(a[i], a[l], a[r]));
                while (l < r && a[l] == a[l + 1]) l++;   // SKIP 2
                while (l < r && a[r] == a[r - 1]) r--;   // SKIP 3
                l++; r--;
            }
        }
    }
    return res;
}`,
        },
        {
          t: 'trap',
          title: 'Three skips, not one',
          text: 'Candidates routinely skip duplicates for the anchor `i` and forget `l` and `r`. Test with `[-2,0,0,2,2]`: the correct answer has exactly one triple.',
        },
      ],
    },
  ],

  patterns: [
    {
      id: 'converging',
      name: 'Opposite-Direction Two Pointers',
      oneLiner: 'Start at both ends; each comparison permanently discards one candidate.',
      useWhen: [
        'The array is sorted (or you may sort it).',
        'You need a pair/triple satisfying a sum or difference condition.',
        'The quantity you measure is monotone in both pointers (container area, palindrome check).',
      ],
      recognize: [
        '"Find two numbers that add up to…" on **sorted** input.',
        '"Container with most water", "trapping rain water", "valid palindrome".',
        'Any O(n²) all-pairs loop over sorted data.',
      ],
      steps: [
        'Sort if the problem allows it (and note the O(n log n) cost).',
        'Place `l = 0`, `r = n − 1`.',
        'Compare against the target; move the pointer that can possibly improve the situation.',
        'Skip duplicates if you must return distinct results.',
      ],
      template: {
        lang: 'java',
        caption: 'Converging two pointers — including the "move the limiting side" variant',
        code: `
// Sum-style: move based on comparison with target
int l = 0, r = n - 1;
while (l < r) {
    int s = a[l] + a[r];
    if (s == target) return new int[]{l, r};
    if (s < target) l++; else r--;
}

// Area-style (Container With Most Water): always move the SHORTER side,
// because moving the taller side can never increase min(h[l], h[r]).
int best = 0;
l = 0; r = n - 1;
while (l < r) {
    best = Math.max(best, (r - l) * Math.min(h[l], h[r]));
    if (h[l] < h[r]) l++; else r--;
}`,
      },
      complexity: 'O(n) after sorting; O(1) space.',
      gotchas: [
        'If the input is unsorted **and** you must return original indices, sorting destroys them — use a hash map instead.',
        'For area problems the rule is "move the limiting side", not "move the smaller sum".',
      ],
      problems: ['Two Sum II - Input Array Is Sorted', '3Sum', 'Container With Most Water', 'Valid Palindrome', 'Trapping Rain Water'],
    },
    {
      id: 'fast-slow',
      name: 'Fast & Slow Pointers (Floyd)',
      oneLiner: 'Two speeds on the same path detect cycles and find midpoints without extra memory.',
      useWhen: [
        'Linked list cycle questions.',
        '"Find the middle", "reorder list", "palindrome linked list".',
        'Any functional graph (`i → f(i)`) where you must find a repeat in O(1) space.',
      ],
      recognize: ['Linked list + "O(1) space" in the same problem; or an array where `i → a[i]` forms an implicit list.'],
      steps: [
        'Advance `slow` by 1 and `fast` by 2 inside `while (fast != null && fast.next != null)`.',
        'Meeting ⇒ cycle. End reached ⇒ no cycle.',
        'For the entry point, reset one pointer to the head and step both by one.',
      ],
      complexity: 'O(n) time, O(1) space.',
      gotchas: [
        'The loop guard must check both `fast` and `fast.next`, or you get a null-pointer exception on even-length lists.',
        'For "middle of list", `slow` lands on the **second** middle for even lengths. If you need the first, start `fast = head.next`.',
      ],
      problems: ['Linked List Cycle', 'Linked List Cycle II', 'Middle of the Linked List', 'Find the Duplicate Number', 'Happy Number'],
    },
    {
      id: 'variable-window',
      name: 'Variable-Size Sliding Window',
      oneLiner: 'Expand right always; contract left only while the window breaks the rule.',
      useWhen: [
        '"Longest / shortest / count of **contiguous** subarray or substring such that P".',
        'The contribution of each element is non-negative, so growing the window monotonically worsens (or improves) the condition.',
      ],
      recognize: [
        'Words: substring, subarray, contiguous, consecutive — combined with longest/shortest/at most/at least.',
        'Constraints like "at most K distinct characters", "sum ≥ target", "no repeating characters".',
      ],
      steps: [
        'Choose the window state: a count map, a sum, a distinct counter.',
        'Expand with `right`, updating state.',
        'Decide the invalid condition; shrink with `left` while invalid.',
        'Record the answer after shrinking (longest) or inside shrinking (shortest).',
      ],
      template: {
        lang: 'java',
        caption: 'The full annotated skeleton — change only the three marked lines',
        code: `
int left = 0, best = 0;
Map<Character,Integer> win = new HashMap<>();

for (int right = 0; right < s.length(); right++) {
    char c = s.charAt(right);
    win.merge(c, 1, Integer::sum);                       // (1) ADD

    while (/* window invalid */ win.get(c) > 1) {        // (2) INVALID CONDITION
        char d = s.charAt(left++);
        if (win.merge(d, -1, Integer::sum) == 0) win.remove(d);   // (3) REMOVE
    }

    best = Math.max(best, right - left + 1);
}`,
      },
      complexity: 'O(n) — each index enters once and leaves once. O(k) space for the state map.',
      gotchas: [
        'Negative numbers break the monotonicity assumption for sum windows. Switch to prefix sums + hash map.',
        'Remove the key from the map when its count hits zero, otherwise `map.size()` over-reports distinct characters.',
        'Do not use `if` where you need `while` — one shrink step is often not enough.',
      ],
      problems: ['Longest Substring Without Repeating Characters', 'Minimum Size Subarray Sum', 'Longest Repeating Character Replacement', 'Fruit Into Baskets', 'Minimum Window Substring'],
    },
    {
      id: 'fixed-window',
      name: 'Fixed-Size Sliding Window',
      oneLiner: 'Add the entering element, remove the leaving one, report every step.',
      useWhen: ['The window length `k` is given.', 'Averages, sums, or anagram checks over every length-k block.'],
      recognize: ['"…of size k", "every window of length k", "find all anagrams".'],
      steps: ['Add `a[i]`.', 'If `i >= k`, remove `a[i − k]`.', 'If `i >= k − 1`, record the answer.'],
      complexity: 'O(n) time; O(1) for sums, O(alphabet) for character counts.',
      gotchas: ['Off-by-one on when to start recording — it is `i >= k − 1`, not `i >= k`.'],
      problems: ['Maximum Average Subarray I', 'Find All Anagrams in a String', 'Permutation in String', 'Sliding Window Maximum'],
    },
    {
      id: 'at-most-trick',
      name: 'At-Most Subtraction (counting windows)',
      oneLiner: 'exactly(K) = atMost(K) − atMost(K − 1).',
      useWhen: ['You must **count** subarrays with an *exact* property, and the direct window is not monotone.'],
      recognize: ['"Number of subarrays with exactly K distinct / exactly K odd numbers".'],
      steps: [
        'Write a clean `atMost(k)` window that returns a count using `count += right − left + 1`.',
        'Return `atMost(k) − atMost(k − 1)`.',
      ],
      complexity: 'O(n) — two linear passes.',
      gotchas: ['`atMost(k − 1)` with `k = 0` must return 0; guard it.'],
      problems: ['Subarrays with K Different Integers', 'Count Number of Nice Subarrays', 'Binary Subarrays With Sum'],
    },
    {
      id: 'read-write',
      name: 'Read / Write In-Place Compaction',
      oneLiner: 'One pointer scans, the other places survivors; the prefix is always the answer.',
      useWhen: ['Remove elements / duplicates in place and return the new length.', 'You are told "do not allocate another array".'],
      recognize: ['"Remove duplicates from sorted array", "remove element", "move zeroes".'],
      steps: ['`write = 0`.', 'For each `read`, if the element should survive, write it to `a[write++]`.', 'Return `write`.'],
      complexity: 'O(n) time, O(1) space, stable order preserved.',
      gotchas: ['For "allow at most two duplicates", the keep-test becomes `write < 2 || a[read] != a[write − 2]`.'],
      problems: ['Remove Duplicates from Sorted Array', 'Remove Element', 'Move Zeroes', 'Remove Duplicates from Sorted Array II'],
    },
  ],

  pitfalls: [
    { title: 'Using a window when numbers can be negative', text: 'Shrinking no longer guarantees progress. Prefix sums with a hash map is the correct tool.' },
    { title: 'Recording the answer in the wrong place', text: 'Longest records after the shrink loop; shortest records inside it.' },
    { title: 'Leaving zero-count keys in the map', text: '`map.size()` then counts characters that are no longer in the window.' },
    { title: 'Forgetting to skip duplicates in k-Sum', text: 'Three separate skips are required: anchor, left, right.' },
    { title: 'Null-pointer in fast/slow loops', text: 'Guard `fast != null && fast.next != null`, in that order.' },
    { title: 'Sorting when indices matter', text: 'If the answer is a pair of original indices, sorting destroys them unless you sort (value, index) pairs.' },
  ],

  cheatsheet: [
    { label: 'Sorted pair sum', value: 'l=0, r=n−1, move by comparison' },
    { label: 'Longest window', value: 'record AFTER the while-shrink' },
    { label: 'Shortest window', value: 'record INSIDE the while-shrink' },
    { label: 'Count valid windows', value: 'count += right − left + 1' },
    { label: 'Exactly K', value: 'atMost(K) − atMost(K−1)' },
    { label: 'Window max', value: 'monotonic decreasing deque' },
    { label: 'Window min', value: 'monotonic increasing deque' },
    { label: 'Middle of list', value: 'slow 1×, fast 2×' },
    { label: 'Cycle start', value: 'meet, reset one to head, step 1×' },
    { label: 'Container area', value: 'always move the shorter side' },
    { label: 'In-place filter', value: 'read scans, write places' },
  ],

  problems: [
    { name: 'Valid Palindrome', difficulty: 'Easy', url: 'https://leetcode.com/problems/valid-palindrome/', pattern: 'Converging', insight: 'Skip non-alphanumerics from both ends; compare lowercased.' },
    { name: 'Two Sum II - Input Array Is Sorted', difficulty: 'Medium', url: 'https://leetcode.com/problems/two-sum-ii-input-array-is-sorted/', pattern: 'Converging', insight: 'The canonical monotonicity argument. O(1) space, no hash map needed.' },
    { name: 'Remove Duplicates from Sorted Array', difficulty: 'Easy', url: 'https://leetcode.com/problems/remove-duplicates-from-sorted-array/', pattern: 'Read/write', insight: 'Keep a[read] when it differs from a[write−1].' },
    { name: 'Move Zeroes', difficulty: 'Easy', url: 'https://leetcode.com/problems/move-zeroes/', pattern: 'Read/write', insight: 'Compact non-zeros forward, then zero-fill the tail.' },
    { name: 'Merge Sorted Array', difficulty: 'Easy', url: 'https://leetcode.com/problems/merge-sorted-array/', pattern: 'Converging from the back', insight: 'Write from the end so you never clobber unread values.' },
    { name: 'Middle of the Linked List', difficulty: 'Easy', url: 'https://leetcode.com/problems/middle-of-the-linked-list/', pattern: 'Fast & slow', insight: 'Returns the second middle on even lengths — usually what is wanted.' },
    { name: 'Linked List Cycle', difficulty: 'Easy', url: 'https://leetcode.com/problems/linked-list-cycle/', pattern: 'Floyd', insight: 'Meeting implies a cycle; no meeting implies termination.' },
    { name: 'Maximum Average Subarray I', difficulty: 'Easy', url: 'https://leetcode.com/problems/maximum-average-subarray-i/', pattern: 'Fixed window', insight: 'Keep the sum, not the average, while sliding.' },
    { name: 'Squares of a Sorted Array', difficulty: 'Easy', url: 'https://leetcode.com/problems/squares-of-a-sorted-array/', pattern: 'Converging', insight: 'The largest square is at one of the two ends; fill the result backwards.' },
    { name: 'Longest Substring Without Repeating Characters', difficulty: 'Medium', url: 'https://leetcode.com/problems/longest-substring-without-repeating-characters/', pattern: 'Variable window', insight: 'Shrink while the incoming character already appears in the window.' },
    { name: 'Minimum Size Subarray Sum', difficulty: 'Medium', url: 'https://leetcode.com/problems/minimum-size-subarray-sum/', pattern: 'Variable window (shortest)', insight: 'Record inside the shrink loop while sum ≥ target.' },
    { name: 'Longest Repeating Character Replacement', difficulty: 'Medium', url: 'https://leetcode.com/problems/longest-repeating-character-replacement/', pattern: 'Variable window', insight: 'Window is valid when (length − maxFreq) ≤ k. maxFreq never needs to decrease.' },
    { name: 'Fruit Into Baskets', difficulty: 'Medium', url: 'https://leetcode.com/problems/fruit-into-baskets/', pattern: 'Variable window', insight: 'Literally "longest subarray with at most 2 distinct values".' },
    { name: 'Permutation in String', difficulty: 'Medium', url: 'https://leetcode.com/problems/permutation-in-string/', pattern: 'Fixed window', insight: 'Compare 26-length frequency arrays, or keep a "matches" counter for O(1) checks.' },
    { name: 'Find All Anagrams in a String', difficulty: 'Medium', url: 'https://leetcode.com/problems/find-all-anagrams-in-a-string/', pattern: 'Fixed window', insight: 'Same as above but collect every matching start index.' },
    { name: '3Sum', difficulty: 'Medium', url: 'https://leetcode.com/problems/3sum/', pattern: 'Sort + converge', insight: 'Fix i, two-pointer the rest, and skip duplicates in all three positions.' },
    { name: '3Sum Closest', difficulty: 'Medium', url: 'https://leetcode.com/problems/3sum-closest/', pattern: 'Sort + converge', insight: 'Same scaffold, but track the minimum absolute difference instead of equality.' },
    { name: 'Container With Most Water', difficulty: 'Medium', url: 'https://leetcode.com/problems/container-with-most-water/', pattern: 'Converging', insight: 'Move the shorter wall — moving the taller one can never help.' },
    { name: 'Sort Colors', difficulty: 'Medium', url: 'https://leetcode.com/problems/sort-colors/', pattern: 'Three pointers', insight: 'Dutch national flag partition.' },
    { name: '4Sum', difficulty: 'Medium', url: 'https://leetcode.com/problems/4sum/', pattern: 'Sort + converge', insight: 'Two nested anchors plus two pointers; use long arithmetic to avoid overflow.' },
    { name: 'Subarray Product Less Than K', difficulty: 'Medium', url: 'https://leetcode.com/problems/subarray-product-less-than-k/', pattern: 'Variable window + counting', insight: 'count += right − left + 1 once the product is below k.' },
    { name: 'Count Number of Nice Subarrays', difficulty: 'Medium', url: 'https://leetcode.com/problems/count-number-of-nice-subarrays/', pattern: 'At-most subtraction', insight: 'Map odd→1, even→0; then exactly(k) = atMost(k) − atMost(k−1).' },
    { name: 'Minimum Window Substring', difficulty: 'Hard', url: 'https://leetcode.com/problems/minimum-window-substring/', pattern: 'Variable window (shortest)', insight: 'Track how many required characters are fully satisfied; shrink while satisfied == required.' },
    { name: 'Sliding Window Maximum', difficulty: 'Hard', url: 'https://leetcode.com/problems/sliding-window-maximum/', pattern: 'Monotonic deque', insight: 'Decreasing deque of indices; front is the max; evict indices that fell out of range.' },
    { name: 'Subarrays with K Different Integers', difficulty: 'Hard', url: 'https://leetcode.com/problems/subarrays-with-k-different-integers/', pattern: 'At-most subtraction', insight: 'The cleanest demonstration of exactly = atMost(k) − atMost(k−1).' },
    { name: 'Trapping Rain Water', difficulty: 'Hard', url: 'https://leetcode.com/problems/trapping-rain-water/', pattern: 'Converging', insight: 'Whichever side is shorter is the binding constraint, so it is safe to process and advance it.' },
  ],
}
