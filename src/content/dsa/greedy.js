export default {
  id: 'greedy',
  title: 'Greedy Algorithms',
  short: 'Greedy',
  icon: 'BoltRounded',
  tier: 'Core',
  order: 15,
  estHours: 8,
  prereqs: ['sorting', 'intervals'],
  tagline: 'Take the best local choice — but only after you can prove it is safe.',
  mentalModel:
    'Greedy works when a locally optimal choice is provably part of *some* globally optimal solution. The whole skill is knowing when that is true, and recognising when it is a trap and you actually need DP.',
  whyItMatters:
    'Greedy solutions are short, fast and elegant when they apply — and catastrophically wrong when they do not. Interviewers use greedy problems to see whether you *justify* your approach or just pattern-match.',

  complexity: [
    { op: 'Sort then single scan', time: 'O(n log n)', space: 'O(1)', note: 'The most common greedy shape' },
    { op: 'Greedy with a heap', time: 'O(n log n)', space: 'O(n)', note: 'When "best remaining" changes dynamically' },
    { op: 'Single-pass greedy', time: 'O(n)', space: 'O(1)', note: 'Jump Game, Gas Station, Kadane' },
    { op: 'Greedy + monotonic stack', time: 'O(n)', space: 'O(n)', note: 'Remove K Digits, Smallest Subsequence' },
    { op: 'Exchange-argument proof', time: '—', space: '—', note: 'The step that makes it an answer, not a guess' },
  ],

  sections: [
    {
      id: 'when',
      title: 'When is greedy correct?',
      blocks: [
        { t: 'lead', text: 'Two properties must hold. If you cannot state them, do not use greedy.' },
        {
          t: 'dl',
          items: [
            { term: 'Greedy choice property', def: 'A globally optimal solution can be reached by making the locally optimal choice at each step. You never have to "look ahead" or undo.' },
            { term: 'Optimal substructure', def: 'After making that choice, what remains is a smaller instance of the same problem, and solving it optimally gives an optimal whole.' },
          ],
        },
        { t: 'h', text: 'The exchange argument — how to prove it in thirty seconds' },
        { t: 'p', text: 'This is the standard proof technique and it is short enough to say out loud in an interview.' },
        {
          t: 'steps',
          items: [
            { title: 'Assume an optimal solution OPT that differs from your greedy choice', text: 'Say greedy picks `g` first, but OPT picks something else, `x`.' },
            { title: 'Swap x for g in OPT', text: 'Show the result is still valid (does not break any constraint).' },
            { title: 'Show the swap does not make things worse', text: 'The new solution is at least as good as OPT.' },
            { title: 'Conclude', text: 'So there exists an optimal solution containing the greedy choice. Induct.' },
          ],
        },
        {
          t: 'key',
          title: 'Worked example: activity selection',
          text: '"Suppose an optimal schedule does not include the earliest-finishing activity `g`. Replace its first activity `x` with `g`. Since `g` finishes no later than `x`, nothing that came after `x` now conflicts. The count is unchanged, so the new schedule is also optimal — and it contains `g`." That is the whole proof, in three sentences.',
        },
        {
          t: 'compare',
          left: {
            title: 'Greedy works',
            items: [
              'Activity selection / interval scheduling',
              'Huffman coding',
              'Fractional knapsack (you may take a fraction)',
              'Kruskal & Prim MST',
              'Dijkstra (non-negative weights)',
              'Jump Game, Gas Station',
              'Coin change with a **canonical** system (1, 5, 10, 25)',
            ],
          },
          right: {
            title: 'Greedy fails — use DP',
            items: [
              '0/1 knapsack (all-or-nothing items)',
              'Coin change with arbitrary denominations',
              'Longest increasing subsequence',
              'Edit distance',
              'Partition into equal subsets',
              'Word break',
              'Dijkstra with negative edges',
            ],
          },
        },
        {
          t: 'trap',
          title: 'The classic counterexample to have ready',
          text: 'Coins `{1, 3, 4}`, target `6`. Greedy takes `4 + 1 + 1 = 3` coins. Optimal is `3 + 3 = 2` coins. Memorise this — it is the fastest way to demonstrate that you know greedy needs justification, and interviewers love hearing it unprompted.',
        },
      ],
    },
    {
      id: 'shapes',
      title: 'The recurring greedy shapes',
      blocks: [
        {
          t: 'table',
          head: ['Shape', 'The greedy rule', 'Examples'],
          rows: [
            ['**Sort by deadline/end**', 'Take the earliest-finishing compatible item', 'Activity selection, non-overlapping intervals, minimum arrows'],
            ['**Sort by ratio**', 'Take the best value-per-unit first', 'Fractional knapsack, gas station variants'],
            ['**Reach tracking**', 'Extend the furthest reachable point in one pass', 'Jump Game, Jump Game II, Video Stitching'],
            ['**Running balance**', 'Reset when the running total goes negative', 'Gas Station, Kadane, Candy'],
            ['**Two-pass prefix/suffix**', 'Enforce each one-sided constraint separately, then combine', 'Candy, Trapping Rain Water'],
            ['**Heap-driven**', 'Always consume the current extreme', 'Task Scheduler, Reorganize String, Minimum Cost to Connect Sticks, IPO'],
            ['**Monotonic stack**', 'Discard a previous choice when a better one arrives', 'Remove K Digits, Smallest Subsequence, Create Maximum Number'],
            ['**Exchange/swap**', 'Locally reorder to improve without breaking validity', 'Queue Reconstruction, Largest Number'],
          ],
        },
      ],
    },
    {
      id: 'reach',
      title: 'Reach tracking — the one-pass greedy',
      blocks: [
        {
          t: 'code',
          lang: 'java',
          caption: 'Jump Game — track the furthest reachable index',
          code: `
boolean canJump(int[] nums) {
    int reach = 0;
    for (int i = 0; i < nums.length; i++) {
        if (i > reach) return false;                 // a gap we cannot cross
        reach = Math.max(reach, i + nums[i]);
    }
    return true;
}`,
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'Jump Game II — minimum jumps, via implicit BFS levels',
          code: `
int jump(int[] nums) {
    int jumps = 0, curEnd = 0, farthest = 0;

    for (int i = 0; i < nums.length - 1; i++) {      // stop before the last index
        farthest = Math.max(farthest, i + nums[i]);
        if (i == curEnd) {                           // exhausted the current level
            jumps++;
            curEnd = farthest;                       // the next level ends here
        }
    }
    return jumps;
}`,
        },
        {
          t: 'key',
          title: 'This is BFS without a queue',
          text: '`curEnd` marks the boundary of the current BFS level and `farthest` is the boundary of the next. The greedy is provably optimal because within a level, *every* index is reachable in the same number of jumps, so taking the furthest reach is never worse.',
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'Gas Station — the reset argument',
          code: `
int canCompleteCircuit(int[] gas, int[] cost) {
    int total = 0, tank = 0, start = 0;

    for (int i = 0; i < gas.length; i++) {
        int gain = gas[i] - cost[i];
        total += gain;
        tank  += gain;
        if (tank < 0) {          // cannot reach i+1 from 'start'
            start = i + 1;       // ...and no station in [start, i] can either
            tank = 0;
        }
    }
    return total >= 0 ? start : -1;
}`,
        },
        {
          t: 'tip',
          title: 'Why the reset is safe',
          text: 'If you run out of fuel between `start` and `i`, then **no** station in that range can complete the loop either — each of them starts with even less accumulated fuel. So you can skip them all and restart at `i + 1`. That argument is what makes this `O(n)` instead of `O(n²)`, and stating it is the point of the question.',
        },
      ],
    },
    {
      id: 'two-pass',
      title: 'Two-pass greedy — satisfy one constraint at a time',
      blocks: [
        { t: 'p', text: 'When a valid answer must satisfy constraints from *both* directions, a single pass cannot see the future. The fix: one pass per direction, then combine.' },
        {
          t: 'code',
          lang: 'java',
          caption: 'Candy — left rule, then right rule, take the max',
          code: `
int candy(int[] ratings) {
    int n = ratings.length;
    int[] c = new int[n];
    Arrays.fill(c, 1);                                   // everyone gets at least 1

    for (int i = 1; i < n; i++)                          // left-to-right rule
        if (ratings[i] > ratings[i - 1]) c[i] = c[i - 1] + 1;

    for (int i = n - 2; i >= 0; i--)                     // right-to-left rule
        if (ratings[i] > ratings[i + 1]) c[i] = Math.max(c[i], c[i + 1] + 1);

    int total = 0;
    for (int x : c) total += x;
    return total;
}`,
        },
        {
          t: 'trap',
          title: 'The max in the second pass is essential',
          text: 'Assigning `c[i] = c[i+1] + 1` would destroy the left-rule guarantee established by the first pass. Taking the maximum satisfies both rules simultaneously, which is exactly the minimal valid assignment.',
        },
      ],
    },
    {
      id: 'greedy-stack',
      title: 'Greedy with a monotonic stack — building the best sequence',
      blocks: [
        { t: 'p', text: 'When you must delete `k` items to leave the lexicographically smallest (or largest) result, the rule is: **as soon as a smaller item arrives, the bigger item directly before it was a mistake — delete it**, while you still have deletions in budget.' },
        {
          t: 'code',
          lang: 'java',
          caption: 'Remove K Digits — greedy deletion with a monotonic stack',
          code: `
String removeKdigits(String num, int k) {
    StringBuilder st = new StringBuilder();

    for (char d : num.toCharArray()) {
        while (k > 0 && st.length() > 0 && st.charAt(st.length() - 1) > d) {
            st.deleteCharAt(st.length() - 1);      // this bigger digit was a mistake
            k--;
        }
        st.append(d);
    }
    while (k-- > 0) st.deleteCharAt(st.length() - 1);   // budget unspent: trim the tail

    int i = 0;
    while (i < st.length() - 1 && st.charAt(i) == '0') i++;   // strip leading zeros
    return st.substring(i).isEmpty() ? "0" : st.substring(i);
}`,
        },
        {
          t: 'note',
          title: 'Two details that fail the hidden tests',
          text: 'If the input is already non-decreasing (`"112"`, k=1) the `while` never fires, so you must trim from the end afterwards. And the result can have leading zeros (`"10200"`, k=1 → `"0200"` → `"200"`), so strip them. Both are trivially forgotten.',
        },
        {
          t: 'tip',
          title: 'The same idea, more powerfully',
          text: '**Smallest Subsequence of Distinct Characters** adds "only delete a character if it appears again later", which you check with a last-occurrence array. **Create Maximum Number** applies the greedy twice and then merges. Both are the same deletion rule with an extra guard.',
        },
      ],
    },
  ],

  patterns: [
    {
      id: 'sort-greedy',
      name: 'Sort, Then Take Greedily',
      oneLiner: 'Impose an order in which the locally best choice is provably safe.',
      useWhen: ['Interval scheduling, assignment/matching, deadline problems.'],
      recognize: ['"Maximum number of", "minimum number of", with items that have two comparable attributes.'],
      steps: [
        'Identify the correct sort key — this is the design decision.',
        'Scan, taking each item when it is compatible with what you have taken.',
        'State the exchange argument.',
      ],
      template: {
        lang: 'java',
        caption: 'Assign Cookies — two sorted pointers, a minimal greedy',
        code: `
Arrays.sort(children); Arrays.sort(cookies);
int i = 0, j = 0, satisfied = 0;

while (i < children.length && j < cookies.length) {
    if (cookies[j] >= children[i]) { satisfied++; i++; }   // this cookie works
    j++;                                                   // otherwise discard it
}
return satisfied;`,
      },
      complexity: 'O(n log n) time.',
      gotchas: ['The sort key is the algorithm. If your greedy fails a test, the key is usually wrong, not the loop.'],
      problems: ['Assign Cookies', 'Non-overlapping Intervals', 'Minimum Number of Arrows to Burst Balloons', 'Two City Scheduling', 'Boats to Save People'],
    },
    {
      id: 'reach-greedy',
      name: 'Reach / Frontier Tracking',
      oneLiner: 'Keep the furthest point you can get to; the answer falls out of one pass.',
      useWhen: ['Jump problems, coverage problems, "can you finish the circuit".'],
      recognize: ['"Can you reach the end", "minimum jumps", "minimum taps/clips to cover".'],
      steps: ['Track `farthest` reachable from everything seen so far.', 'When you exhaust the current level, increment the answer and extend the boundary.'],
      complexity: 'O(n) time, O(1) space.',
      gotchas: [
        'In Jump Game II, loop to `n − 2`, not `n − 1`, or you count one jump too many.',
        'Check for an unreachable gap (`i > reach`) before extending.',
      ],
      problems: ['Jump Game', 'Jump Game II', 'Gas Station', 'Video Stitching', 'Minimum Number of Taps to Open to Water a Garden'],
    },
    {
      id: 'heap-greedy',
      name: 'Heap-Driven Greedy',
      oneLiner: 'When "the best option" changes after every choice, a heap keeps it current.',
      useWhen: ['Scheduling with priorities, combining items, frequency-based rearrangement.'],
      recognize: ['"Always pick the largest/smallest remaining", "rearrange so no two adjacent are equal".'],
      steps: ['Push all candidates.', 'Poll the extreme, apply it, push back the updated item if it still has work left.'],
      complexity: 'O(n log n).',
      gotchas: ['Remember to push modified items back.', 'For "no two adjacent", poll **two** items per round so you never place the same one twice in a row.'],
      problems: ['Task Scheduler', 'Reorganize String', 'Minimum Cost to Connect Sticks', 'IPO', 'Maximum Performance of a Team'],
    },
    {
      id: 'two-pass-greedy',
      name: 'Two-Pass (Left Rule, Right Rule)',
      oneLiner: 'Enforce each directional constraint in its own pass, then combine with max/min.',
      useWhen: ['Constraints reference both neighbours.', 'A single pass cannot know the future.'],
      recognize: ['"Each element must satisfy a condition relative to both sides."'],
      steps: ['Forward pass enforcing the left constraint.', 'Backward pass enforcing the right, combining rather than overwriting.'],
      complexity: 'O(n) time, O(n) space.',
      gotchas: ['Combine with `Math.max` (or min) — never overwrite, or you undo the first pass.'],
      problems: ['Candy', 'Trapping Rain Water', 'Product of Array Except Self'],
    },
    {
      id: 'greedy-stack-build',
      name: 'Greedy Construction with a Stack',
      oneLiner: 'Undo a previous choice the moment a strictly better one becomes available.',
      useWhen: ['Lexicographically smallest/largest result after deletions.', 'Building an optimal subsequence.'],
      recognize: ['"Remove k digits", "smallest subsequence", "most competitive subsequence".'],
      steps: ['Maintain a monotonic stack of the result so far.', 'Pop while the top is worse and you can still afford a deletion.', 'Handle unspent budget and leading zeros.'],
      complexity: 'O(n) time and space.',
      gotchas: [
        'Trim leftovers from the end if the budget is unspent.',
        'Ensure enough characters remain to reach the required length: `stack.size() - 1 + (n - i) >= k`.',
      ],
      problems: ['Remove K Digits', 'Smallest Subsequence of Distinct Characters', 'Find the Most Competitive Subsequence', 'Create Maximum Number', 'Remove Duplicate Letters'],
    },
  ],

  pitfalls: [
    { title: 'Using greedy without a proof', text: 'If you cannot state an exchange argument, treat it as a hypothesis and test it against a tricky case before committing.' },
    { title: 'Greedy on 0/1 knapsack', text: 'Value-per-weight fails when items cannot be split. That problem needs DP.' },
    { title: 'Greedy coin change', text: 'Only correct for canonical coin systems. `{1,3,4}` breaks it.' },
    { title: 'Wrong sort key', text: 'The single most common greedy bug. If tests fail, re-examine the key before the loop.' },
    { title: 'Overwriting in the second pass', text: 'Two-pass greedies must combine, not replace.' },
    { title: 'Forgetting leftover budget', text: 'Deletion greedies must handle the case where the stack never triggered a pop.' },
  ],

  cheatsheet: [
    { label: 'Proof technique', value: 'exchange argument' },
    { label: 'Max activities', value: 'sort by end time' },
    { label: 'Min removals', value: 'n − max kept' },
    { label: 'Jump reachability', value: 'reach = max(reach, i + a[i])' },
    { label: 'Min jumps', value: 'level boundaries, loop to n−2' },
    { label: 'Gas station', value: 'reset start when tank < 0' },
    { label: 'Two-sided constraints', value: 'two passes + max' },
    { label: 'Best changes each step', value: 'use a heap' },
    { label: 'Lexicographic build', value: 'monotonic stack + budget' },
    { label: 'Greedy fails ⇒', value: 'try DP' },
    { label: 'Counterexample to quote', value: 'coins {1,3,4}, target 6' },
  ],

  problems: [
    { name: 'Assign Cookies', difficulty: 'Easy', url: 'https://leetcode.com/problems/assign-cookies/', pattern: 'Sort + two pointers', insight: 'Satisfy the least greedy child with the smallest adequate cookie.' },
    { name: 'Best Time to Buy and Sell Stock II', difficulty: 'Medium', url: 'https://leetcode.com/problems/best-time-to-buy-and-sell-stock-ii/', pattern: 'Local greedy', insight: 'Sum every positive daily difference — unlimited transactions make it that simple.' },
    { name: 'Lemonade Change', difficulty: 'Easy', url: 'https://leetcode.com/problems/lemonade-change/', pattern: 'Greedy change', insight: 'Give a $10 before two $5s — keep the flexible small bills.' },
    { name: 'Can Place Flowers', difficulty: 'Easy', url: 'https://leetcode.com/problems/can-place-flowers/', pattern: 'Scan greedy', insight: 'Plant at the first legal spot; planting early never hurts later options.' },
    { name: 'Maximum Units on a Truck', difficulty: 'Easy', url: 'https://leetcode.com/problems/maximum-units-on-a-truck/', pattern: 'Sort by value', insight: 'Fractional-knapsack style: take the densest boxes first.' },
    { name: 'Jump Game', difficulty: 'Medium', url: 'https://leetcode.com/problems/jump-game/', pattern: 'Reach tracking', insight: 'Fail as soon as an index exceeds the reach.' },
    { name: 'Jump Game II', difficulty: 'Medium', url: 'https://leetcode.com/problems/jump-game-ii/', pattern: 'Level boundaries', insight: 'Implicit BFS. Loop to n−2 to avoid an extra jump.' },
    { name: 'Gas Station', difficulty: 'Medium', url: 'https://leetcode.com/problems/gas-station/', pattern: 'Running balance + reset', insight: 'If the total is non-negative a solution exists, and the reset point is it.' },
    { name: 'Task Scheduler', difficulty: 'Medium', url: 'https://leetcode.com/problems/task-scheduler/', pattern: 'Heap greedy / formula', insight: 'Idle slots are determined by the most frequent task: (maxFreq−1)·(n+1) + tiesAtMax.' },
    { name: 'Partition Labels', difficulty: 'Medium', url: 'https://leetcode.com/problems/partition-labels/', pattern: 'Reach tracking', insight: 'Extend the cut to the last occurrence of every letter seen so far.' },
    { name: 'Non-overlapping Intervals', difficulty: 'Medium', url: 'https://leetcode.com/problems/non-overlapping-intervals/', pattern: 'Sort by end', insight: 'Activity selection; the exchange argument is short and worth saying.' },
    { name: 'Boats to Save People', difficulty: 'Medium', url: 'https://leetcode.com/problems/boats-to-save-people/', pattern: 'Sort + two pointers', insight: 'Pair the heaviest with the lightest that still fits.' },
    { name: 'Two City Scheduling', difficulty: 'Medium', url: 'https://leetcode.com/problems/two-city-scheduling/', pattern: 'Sort by difference', insight: 'Sort by costA − costB; send the first half to A.' },
    { name: 'Remove K Digits', difficulty: 'Medium', url: 'https://leetcode.com/problems/remove-k-digits/', pattern: 'Greedy + monotonic stack', insight: 'Pop bigger digits while budget remains; handle leftovers and leading zeros.' },
    { name: 'Queue Reconstruction by Height', difficulty: 'Medium', url: 'https://leetcode.com/problems/queue-reconstruction-by-height/', pattern: 'Sort + insert', insight: 'Tallest first, then insert at index k — shorter people do not disturb the count.' },
    { name: 'Minimum Number of Taps to Open to Water a Garden', difficulty: 'Hard', url: 'https://leetcode.com/problems/minimum-number-of-taps-to-open-to-water-a-garden/', pattern: 'Reach tracking', insight: 'Convert each tap to an interval, then it is exactly Jump Game II.' },
    { name: 'Video Stitching', difficulty: 'Medium', url: 'https://leetcode.com/problems/video-stitching/', pattern: 'Reach tracking', insight: 'Same interval-covering greedy as the tap problem.' },
    { name: 'Candy', difficulty: 'Hard', url: 'https://leetcode.com/problems/candy/', pattern: 'Two-pass greedy', insight: 'Left rule, then right rule with max — never overwrite.' },
    { name: 'Create Maximum Number', difficulty: 'Hard', url: 'https://leetcode.com/problems/create-maximum-number/', pattern: 'Greedy stack + merge', insight: 'Best subsequence of length i from one array and k−i from the other, then merge greedily.' },
    { name: 'Remove Duplicate Letters', difficulty: 'Medium', url: 'https://leetcode.com/problems/remove-duplicate-letters/', pattern: 'Greedy stack', insight: 'Only pop a character if it occurs again later; track presence to avoid duplicates.' },
    { name: 'Course Schedule III', difficulty: 'Hard', url: 'https://leetcode.com/problems/course-schedule-iii/', pattern: 'Sort by deadline + max-heap', insight: 'Take every course; if you overrun, drop the longest one taken so far.' },
    { name: 'Minimum Cost to Connect Sticks', difficulty: 'Medium', url: 'https://leetcode.com/problems/minimum-cost-to-connect-sticks/', pattern: 'Heap greedy', insight: 'Huffman coding: always merge the two smallest.' },
  ],
}
