export default {
  id: 'dp',
  title: 'Dynamic Programming',
  short: 'Dynamic Programming',
  icon: 'TableChartRounded',
  tier: 'Advanced',
  order: 16,
  estHours: 30,
  prereqs: ['recursion'],
  tagline: 'Not a trick. A discipline: define the state, write the recurrence, fix the base case, choose the order.',
  mentalModel:
    'DP is recursion plus memory. If your brute-force recursion solves the same subproblem twice, cache it — you are now doing DP. Everything else is bookkeeping.',
  whyItMatters:
    'DP is the topic candidates fear most, and the one that rewards systematic thinking the most. There are perhaps a dozen recognisable families; once you can name the family, the recurrence is nearly automatic.',

  complexity: [
    { op: '1-D DP', time: 'O(n)', space: 'O(n) → O(1)', note: 'Climbing stairs, house robber, Kadane' },
    { op: '1-D DP with inner loop', time: 'O(n²)', space: 'O(n)', note: 'LIS, word break, coin change' },
    { op: '2-D DP over two sequences', time: 'O(n·m)', space: 'O(n·m) → O(min(n,m))', note: 'LCS, edit distance' },
    { op: 'Knapsack', time: 'O(n·W)', space: 'O(W)', note: 'Pseudo-polynomial in the capacity' },
    { op: 'Interval DP', time: 'O(n³)', space: 'O(n²)', note: 'Burst balloons, matrix chain' },
    { op: 'Bitmask DP', time: 'O(2ⁿ · n)', space: 'O(2ⁿ)', note: 'n ≤ 20' },
    { op: 'DP on a DAG / tree', time: 'O(V + E)', space: 'O(V)', note: 'Each node once, in topological order' },
    { op: 'LIS with binary search', time: 'O(n log n)', space: 'O(n)', note: 'Patience sorting' },
  ],

  sections: [
    {
      id: 'framework',
      title: 'The five-step DP framework',
      blocks: [
        { t: 'lead', text: 'Never "try to think of the DP". Run the checklist. Every time, in this order.' },
        {
          t: 'steps',
          items: [
            { title: 'Define the state — in one English sentence', text: '"`dp[i]` is the maximum money robbable from the first `i` houses." If you cannot say it in a sentence, you do not have a state yet and writing code will not help. The sentence must be complete enough that the value depends on *nothing else*.' },
            { title: 'Write the recurrence — as a choice', text: 'At each state, what are my options? `dp[i] = max(rob this house + dp[i−2], skip it + dp[i−1])`. DP recurrences are almost always "take the best over a small set of choices".' },
            { title: 'Fix the base cases', text: 'The smallest states, answered directly. Watch out for "empty" (`dp[0]`) versus "first element" (`dp[1]`) — most off-by-ones live here.' },
            { title: 'Choose the iteration order', text: 'Every state must be computed **after** everything it depends on. Depends on smaller `i`? Loop upward. Depends on larger `i`? Loop downward.' },
            { title: 'Identify the answer', text: 'It is not always `dp[n]`. For LIS it is `max(dp)`. For maximum-square it is the maximum cell. Say explicitly where the answer lives.' },
          ],
        },
        {
          t: 'key',
          title: 'The state definition is 80% of the work',
          text: 'Wrong state ⇒ no recurrence exists ⇒ you flail. If you are stuck on a DP problem, almost always the fix is to *add a dimension* to the state (e.g. "…and I currently hold a stock", "…and I have used k transactions", "…and the last move was a jump of length j").',
        },
      ],
    },
    {
      id: 'memo-vs-tab',
      title: 'Top-down or bottom-up?',
      blocks: [
        {
          t: 'compare',
          left: {
            title: 'Top-down (memoisation)',
            items: [
              'Write the brute-force recursion, then add a cache — very low risk',
              'Only computes the states you actually need',
              'Iteration order is automatic',
              'Costs O(depth) stack; can overflow',
              'Best when the state space is sparse or irregular',
            ],
          },
          right: {
            title: 'Bottom-up (tabulation)',
            items: [
              'No recursion, no stack limits',
              'Usually faster (no call overhead)',
              'Enables space optimisation to O(1) or O(n)',
              'You must work out the order yourself',
              'Best when every state is needed anyway',
            ],
          },
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'The same problem three ways — watch the progression',
          code: `
// 1) BRUTE FORCE — exponential, but always start here
int rob(int[] nums, int i) {
    if (i < 0) return 0;
    return Math.max(rob(nums, i - 2) + nums[i], rob(nums, i - 1));
}

// 2) TOP-DOWN — add one array, done. O(n).
int[] memo;
int robMemo(int[] nums, int i) {
    if (i < 0) return 0;
    if (memo[i] != -1) return memo[i];
    return memo[i] = Math.max(robMemo(nums, i - 2) + nums[i], robMemo(nums, i - 1));
}

// 3) BOTTOM-UP — same recurrence, computed in dependency order
int robTab(int[] nums) {
    int n = nums.length;
    int[] dp = new int[n + 1];
    dp[0] = 0;
    dp[1] = nums[0];
    for (int i = 2; i <= n; i++)
        dp[i] = Math.max(dp[i - 2] + nums[i - 1], dp[i - 1]);
    return dp[n];
}

// 4) SPACE-OPTIMISED — only two previous values are ever read
int robO1(int[] nums) {
    int prev2 = 0, prev1 = 0;
    for (int x : nums) {
        int cur = Math.max(prev2 + x, prev1);
        prev2 = prev1; prev1 = cur;
    }
    return prev1;
}`,
        },
        {
          t: 'tip',
          title: 'The interview strategy',
          text: 'Say the brute force, add memoisation to make it correct and fast, then *offer* the bottom-up and space-optimised versions. That progression demonstrates the reasoning, which scores far better than producing an optimised table out of thin air.',
        },
      ],
    },
    {
      id: 'families',
      title: 'The DP families — learn to name them',
      blocks: [
        {
          t: 'table',
          head: ['Family', 'State', 'Recurrence shape', 'Examples'],
          rows: [
            ['**Linear / Fibonacci**', '`dp[i]`', 'combine a few previous', 'Climbing Stairs, House Robber, Min Cost Climbing Stairs'],
            ['**Kadane / best-ending-here**', '`dp[i]` ends at i', 'extend or restart', 'Maximum Subarray, Max Product Subarray'],
            ['**0/1 Knapsack**', '`dp[i][w]`', 'take or skip item i', 'Partition Equal Subset Sum, Target Sum, Last Stone Weight II'],
            ['**Unbounded knapsack**', '`dp[w]`', 'reuse items freely', 'Coin Change, Coin Change II, Combination Sum IV'],
            ['**Two-sequence**', '`dp[i][j]`', 'match ⇒ diagonal, else best of two', 'LCS, Edit Distance, Distinct Subsequences'],
            ['**LIS / subsequence**', '`dp[i]` ends at i', 'max over all j < i', 'LIS, Russian Doll Envelopes, Longest String Chain'],
            ['**Grid**', '`dp[r][c]`', 'from above or from the left', 'Unique Paths, Minimum Path Sum, Maximal Square'],
            ['**Interval**', '`dp[i][j]`', 'split at every k between i and j', 'Burst Balloons, Matrix Chain, Palindrome Partitioning II'],
            ['**State machine**', '`dp[i][state]`', 'transitions between states', 'Best Time to Buy and Sell Stock series'],
            ['**Bitmask**', '`dp[mask]`', 'mask = set of used items', 'TSP, Partition to K Equal Sum Subsets'],
            ['**Digit DP**', '`dp[pos][tight][…]`', 'digit by digit', 'Numbers At Most N Given Digit Set'],
            ['**Tree DP**', '`dp[node][state]`', 'combine children', 'House Robber III, Binary Tree Cameras'],
          ],
        },
      ],
    },
    {
      id: 'knapsack',
      title: 'Knapsack — the family worth mastering first',
      blocks: [
        { t: 'p', text: 'A staggering number of DP problems are knapsack in disguise. Learn both variants and the loop-order rule that separates them.' },
        {
          t: 'code',
          lang: 'java',
          caption: '0/1 knapsack — each item used at most once',
          code: `
// dp[w] = best value achievable with capacity exactly/at most w
int knapsack01(int[] weight, int[] value, int W) {
    int[] dp = new int[W + 1];
    for (int i = 0; i < weight.length; i++)
        for (int w = W; w >= weight[i]; w--)          // BACKWARD over capacity
            dp[w] = Math.max(dp[w], dp[w - weight[i]] + value[i]);
    return dp[W];
}`,
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'Unbounded knapsack — each item reusable',
          code: `
int knapsackUnbounded(int[] weight, int[] value, int W) {
    int[] dp = new int[W + 1];
    for (int i = 0; i < weight.length; i++)
        for (int w = weight[i]; w <= W; w++)          // FORWARD over capacity
            dp[w] = Math.max(dp[w], dp[w - weight[i]] + value[i]);
    return dp[W];
}`,
        },
        {
          t: 'key',
          title: 'The loop direction IS the difference',
          text: 'Iterating capacity **backwards** reads `dp[w − weight]` from the *previous item\u2019s* row, so each item is used at most once. Iterating **forwards** reads the already-updated current row, so the item can be reused. One character of difference, two completely different problems. This is the single highest-value fact in the DP chapter.',
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'Coin Change vs Coin Change II — combinations or permutations?',
          code: `
// MINIMUM coins to make amount (unbounded, order irrelevant)
int coinChange(int[] coins, int amount) {
    int[] dp = new int[amount + 1];
    Arrays.fill(dp, amount + 1);           // "infinity" sentinel
    dp[0] = 0;
    for (int c : coins)
        for (int a = c; a <= amount; a++)
            dp[a] = Math.min(dp[a], dp[a - c] + 1);
    return dp[amount] > amount ? -1 : dp[amount];
}

// NUMBER OF COMBINATIONS (order does NOT matter): coins outer, amount inner
int change(int amount, int[] coins) {
    int[] dp = new int[amount + 1];
    dp[0] = 1;
    for (int c : coins)                    // <- coin loop OUTSIDE
        for (int a = c; a <= amount; a++)
            dp[a] += dp[a - c];
    return dp[amount];
}

// NUMBER OF PERMUTATIONS (order matters): amount outer, coins inner
int combinationSum4(int[] nums, int target) {
    int[] dp = new int[target + 1];
    dp[0] = 1;
    for (int a = 1; a <= target; a++)      // <- amount loop OUTSIDE
        for (int c : nums)
            if (a >= c) dp[a] += dp[a - c];
    return dp[target];
}`,
        },
        {
          t: 'trap',
          title: 'Combinations vs permutations: swap the loops',
          text: 'Item loop outside ⇒ each item is considered once in a fixed order ⇒ you count **combinations** (`{1,2}` and `{2,1}` are the same). Amount loop outside ⇒ every ordering is re-counted ⇒ **permutations**. Interviewers ask this exact follow-up because it proves you understand the table rather than having memorised it.',
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'Partition Equal Subset Sum — subset-sum is boolean 0/1 knapsack',
          code: `
boolean canPartition(int[] nums) {
    int total = 0;
    for (int x : nums) total += x;
    if ((total & 1) == 1) return false;    // odd total can never split evenly
    int target = total / 2;

    boolean[] dp = new boolean[target + 1];
    dp[0] = true;
    for (int x : nums)
        for (int s = target; s >= x; s--)  // backward = each number used once
            dp[s] |= dp[s - x];
    return dp[target];
}`,
        },
      ],
    },
    {
      id: 'two-sequence',
      title: 'Two-sequence DP — LCS and edit distance',
      blocks: [
        { t: 'p', text: 'When the input is two strings or arrays, the state is almost always `dp[i][j]` = "the answer for the first `i` of A and the first `j` of B". The recurrence has two branches: the characters match, or they do not.' },
        {
          t: 'ascii',
          caption: 'The universal two-sequence table. Match ⇒ diagonal. Mismatch ⇒ best of the neighbours.',
          code: `
           ""   a    b    c    d
      ""    0    0    0    0    0
      a     0   \\1    1    1    1
      c     0    1    1   \\2    2
      e     0    1    1    2    2
                            ^
        match -> dp[i-1][j-1] + 1  (the diagonal)
        else  -> max(dp[i-1][j], dp[i][j-1])  for LCS
              -> min(...) + 1                 for edit distance`,
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'Longest Common Subsequence',
          code: `
int lcs(String a, String b) {
    int n = a.length(), m = b.length();
    int[][] dp = new int[n + 1][m + 1];     // +1 row/col for the empty prefix

    for (int i = 1; i <= n; i++)
        for (int j = 1; j <= m; j++)
            dp[i][j] = a.charAt(i - 1) == b.charAt(j - 1)
                     ? dp[i - 1][j - 1] + 1
                     : Math.max(dp[i - 1][j], dp[i][j - 1]);
    return dp[n][m];
}`,
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'Edit Distance — the three operations are the three neighbours',
          code: `
int minDistance(String a, String b) {
    int n = a.length(), m = b.length();
    int[][] dp = new int[n + 1][m + 1];

    for (int i = 0; i <= n; i++) dp[i][0] = i;      // delete everything
    for (int j = 0; j <= m; j++) dp[0][j] = j;      // insert everything

    for (int i = 1; i <= n; i++)
        for (int j = 1; j <= m; j++)
            dp[i][j] = a.charAt(i - 1) == b.charAt(j - 1)
                     ? dp[i - 1][j - 1]
                     : 1 + Math.min(dp[i - 1][j - 1],           // REPLACE
                              Math.min(dp[i - 1][j],            // DELETE from a
                                       dp[i][j - 1]));          // INSERT into a
    return dp[n][m];
}`,
        },
        {
          t: 'tip',
          title: 'Rolling the table down to one row',
          text: 'Each cell reads only the previous row and the current row to the left. Keep two `int[m+1]` arrays (or one array plus a saved diagonal) for `O(m)` space. Offer this after you have the `O(n·m)` version working.',
        },
        {
          t: 'note',
          title: 'LCS is the parent of a whole family',
          text: '**Longest Common Substring** (contiguous) resets to 0 on a mismatch instead of taking a max. **Shortest Common Supersequence** is `n + m − LCS`. **Minimum deletions to make two strings equal** is `n + m − 2·LCS`. **Longest Palindromic Subsequence** is `LCS(s, reverse(s))`. Deriving these from LCS is much easier than memorising four recurrences.',
        },
      ],
    },
    {
      id: 'lis',
      title: 'LIS — and the O(n log n) upgrade',
      blocks: [
        {
          t: 'code',
          lang: 'java',
          caption: 'LIS in O(n²) — the definition everyone should be able to derive',
          code: `
int lengthOfLIS(int[] a) {
    int n = a.length;
    int[] dp = new int[n];                 // dp[i] = LIS length ENDING at i
    Arrays.fill(dp, 1);
    int best = 1;

    for (int i = 1; i < n; i++)
        for (int j = 0; j < i; j++)
            if (a[j] < a[i]) {
                dp[i] = Math.max(dp[i], dp[j] + 1);
                best = Math.max(best, dp[i]);
            }
    return best;                           // the answer is max(dp), NOT dp[n-1]
}`,
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'LIS in O(n log n) — patience sorting',
          code: `
int lengthOfLIS(int[] a) {
    List<Integer> tails = new ArrayList<>();   // tails[k] = smallest tail of an
                                               // increasing subsequence of length k+1
    for (int x : a) {
        int i = lowerBound(tails, x);          // first index with tails[i] >= x
        if (i == tails.size()) tails.add(x);   // x extends the longest run
        else                   tails.set(i, x);// x makes a length-(i+1) run cheaper
    }
    return tails.size();
}`,
        },
        {
          t: 'warn',
          title: '`tails` is not the LIS',
          text: 'The array holds the smallest possible tail for each length, and it is **not** a valid subsequence of the input. Only its *length* is the answer. To reconstruct the actual subsequence you must record predecessor indices separately. Interviewers ask this to check whether you understand the algorithm or merely reproduced it.',
        },
        {
          t: 'tip',
          title: 'Non-decreasing variants',
          text: 'For a strictly increasing LIS use `lowerBound` (first `>= x`). For non-decreasing, use `upperBound` (first `> x`). Russian Doll Envelopes uses this: sort by width ascending and **height descending**, so that equal widths cannot chain, then run LIS on the heights.',
        },
      ],
    },
    {
      id: 'grid-interval',
      title: 'Grid DP and interval DP',
      blocks: [
        {
          t: 'code',
          lang: 'java',
          caption: 'Minimum Path Sum — the grid template, in place',
          code: `
int minPathSum(int[][] g) {
    int m = g.length, n = g[0].length;
    for (int r = 0; r < m; r++)
        for (int c = 0; c < n; c++) {
            if (r == 0 && c == 0) continue;
            int fromTop  = (r > 0) ? g[r - 1][c] : Integer.MAX_VALUE;
            int fromLeft = (c > 0) ? g[r][c - 1] : Integer.MAX_VALUE;
            g[r][c] += Math.min(fromTop, fromLeft);
        }
    return g[m - 1][n - 1];
}`,
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'Maximal Square — the min-of-three trick',
          code: `
int maximalSquare(char[][] matrix) {
    int m = matrix.length, n = matrix[0].length, best = 0;
    int[][] dp = new int[m + 1][n + 1];    // dp[r][c] = side of the square ENDING here

    for (int r = 1; r <= m; r++)
        for (int c = 1; c <= n; c++)
            if (matrix[r - 1][c - 1] == '1') {
                dp[r][c] = 1 + Math.min(dp[r - 1][c - 1],
                               Math.min(dp[r - 1][c], dp[r][c - 1]));
                best = Math.max(best, dp[r][c]);
            }
    return best * best;
}`,
        },
        {
          t: 'key',
          title: 'Why min-of-three',
          text: 'A square of side `k+1` ending at `(r,c)` requires squares of side `k` ending at all three neighbours. The smallest of the three is the binding constraint. This "the bottleneck neighbour limits me" shape recurs across grid DP.',
        },
        { t: 'h', text: 'Interval DP — think about the LAST operation' },
        { t: 'p', text: 'For problems where you repeatedly remove or combine elements, the trick is to iterate over which element is handled **last**, not first. That makes the two sides independent.' },
        {
          t: 'code',
          lang: 'java',
          caption: 'Burst Balloons — the classic "reverse the thinking" problem',
          code: `
int maxCoins(int[] nums) {
    int n = nums.length;
    int[] a = new int[n + 2];
    a[0] = a[n + 1] = 1;                       // virtual balloons at both ends
    System.arraycopy(nums, 0, a, 1, n);

    int[][] dp = new int[n + 2][n + 2];        // dp[i][j] = best for the OPEN range (i, j)

    for (int len = 2; len <= n + 1; len++)     // increasing span
        for (int i = 0; i + len <= n + 1; i++) {
            int j = i + len;
            for (int k = i + 1; k < j; k++)    // k is burst LAST in (i, j)
                dp[i][j] = Math.max(dp[i][j],
                        dp[i][k] + a[i] * a[k] * a[j] + dp[k][j]);
        }
    return dp[0][n + 1];
}`,
        },
        {
          t: 'trap',
          title: 'Why "burst first" fails',
          text: 'If `k` is burst *first*, the two halves are no longer independent — the neighbours of the remaining balloons change. If `k` is burst **last**, then `a[i]` and `a[j]` are guaranteed to still be its neighbours, so the two sub-intervals are independent and the recurrence is valid. Reversing the order of thinking is the entire problem.',
        },
      ],
    },
    {
      id: 'state-machine',
      title: 'State-machine DP — the stock series',
      blocks: [
        { t: 'p', text: 'When the answer depends on "which mode am I in", make the mode part of the state. The Best Time to Buy and Sell Stock family is the cleanest illustration, and it is asked constantly.' },
        {
          t: 'ascii',
          caption: 'Two states, four transitions. Every stock problem is this diagram plus a constraint.',
          code: `
            buy
     HOLD <------- FREE
      |  \\          ^  \\
      |   \\ hold    |   \\ rest
      \\___/         \\___/
        |
        | sell
        v
       FREE  (or COOLDOWN, in the cooldown variant)`,
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'The whole stock family, derived from one skeleton',
          code: `
// I — one transaction
int maxProfit1(int[] p) {
    int hold = Integer.MIN_VALUE, free = 0;
    for (int x : p) {
        hold = Math.max(hold, -x);              // buying is the FIRST purchase
        free = Math.max(free, hold + x);
    }
    return free;
}

// II — unlimited transactions
int maxProfit2(int[] p) {
    int hold = Integer.MIN_VALUE, free = 0;
    for (int x : p) {
        int prevFree = free;
        hold = Math.max(hold, prevFree - x);    // may buy using earlier profit
        free = Math.max(free, hold + x);
    }
    return free;
}

// With COOLDOWN — a third state
int maxProfitCooldown(int[] p) {
    int hold = Integer.MIN_VALUE, free = 0, cooldown = 0;
    for (int x : p) {
        int prevHold = hold, prevFree = free, prevCool = cooldown;
        hold     = Math.max(prevHold, prevFree - x);
        cooldown = prevHold + x;                // just sold
        free     = Math.max(prevFree, prevCool);
    }
    return Math.max(free, cooldown);
}

// With FEE — subtract on sale
int maxProfitFee(int[] p, int fee) {
    int hold = Integer.MIN_VALUE, free = 0;
    for (int x : p) {
        int prevFree = free;
        hold = Math.max(hold, prevFree - x);
        free = Math.max(free, hold + x - fee);
    }
    return free;
}

// K transactions — add a dimension
int maxProfitK(int k, int[] p) {
    if (k >= p.length / 2) return maxProfit2(p);      // effectively unlimited
    int[] hold = new int[k + 1], free = new int[k + 1];
    Arrays.fill(hold, Integer.MIN_VALUE);
    for (int x : p)
        for (int t = 1; t <= k; t++) {
            hold[t] = Math.max(hold[t], free[t - 1] - x);
            free[t] = Math.max(free[t], hold[t] + x);
        }
    return free[k];
}`,
        },
        {
          t: 'key',
          title: 'Stuck? Add a dimension.',
          text: 'Cooldown adds a state. A fee changes a transition. `k` transactions adds an index. The recurrence never fundamentally changes. When a DP problem feels impossible, ask "what extra fact would I need to know at this position to decide?" — then put that fact in the state.',
        },
      ],
    },
  ],

  patterns: [
    {
      id: 'linear-dp',
      name: 'Linear DP (dp[i] from a few predecessors)',
      oneLiner: 'The answer at i depends on a constant number of earlier positions.',
      useWhen: ['Sequences with local dependencies: stairs, robbing, tiling, decoding.'],
      recognize: ['"Number of ways to reach n", "maximum you can take without adjacent".'],
      steps: ['Define `dp[i]` for the prefix ending at i.', 'Enumerate the small set of choices.', 'Collapse to O(1) space once it works.'],
      template: {
        lang: 'java',
        caption: 'Two-variable rolling form',
        code: `
int prev2 = base0, prev1 = base1;
for (int i = 2; i <= n; i++) {
    int cur = f(prev1, prev2, i);
    prev2 = prev1;
    prev1 = cur;
}
return prev1;`,
      },
      complexity: 'O(n) time, O(1) space after optimisation.',
      gotchas: ['Base cases for `n = 0` and `n = 1`.', 'Decode Ways: "0" is never a valid single digit and "06" is not a valid pair.'],
      problems: ['Climbing Stairs', 'House Robber', 'House Robber II', 'Min Cost Climbing Stairs', 'Decode Ways', 'Fibonacci Number'],
    },
    {
      id: 'knapsack-pattern',
      name: 'Knapsack (0/1 and Unbounded)',
      oneLiner: 'Choose a subset of items subject to a capacity; loop direction decides reuse.',
      useWhen: ['Subset sums, partitions, coin change, target sums, "can I make exactly X".'],
      recognize: ['A budget/capacity/target plus a list of items with costs.'],
      steps: [
        'State: `dp[capacity]` (after rolling the item dimension away).',
        'Item loop outside, capacity loop inside.',
        '**Backward** capacity for 0/1, **forward** for unbounded.',
      ],
      template: {
        lang: 'java',
        caption: 'The direction rule, side by side',
        code: `
// 0/1 — each item once
for (int item : items)
    for (int w = W; w >= cost[item]; w--)
        dp[w] = best(dp[w], dp[w - cost[item]] + value[item]);

// UNBOUNDED — reuse freely
for (int item : items)
    for (int w = cost[item]; w <= W; w++)
        dp[w] = best(dp[w], dp[w - cost[item]] + value[item]);

// COUNTING combinations: item loop outer
// COUNTING permutations: capacity loop outer`,
      },
      complexity: 'O(n · W) time, O(W) space.',
      gotchas: [
        'Pseudo-polynomial: if `W` is up to 10⁹ this is not viable — look for a different angle.',
        'Use `Integer.MAX_VALUE / 2` or `amount + 1` as infinity to avoid overflow when you add 1.',
      ],
      problems: ['Coin Change', 'Coin Change II', 'Partition Equal Subset Sum', 'Target Sum', 'Combination Sum IV', 'Last Stone Weight II', 'Ones and Zeroes'],
    },
    {
      id: 'two-sequence-dp',
      name: 'Two-Sequence DP',
      oneLiner: 'dp[i][j] over prefixes of both inputs; match goes diagonal, mismatch takes the best neighbour.',
      useWhen: ['Comparing, aligning or transforming two strings/arrays.'],
      recognize: ['Two strings in, one number out: common subsequence, edit distance, interleaving, matching.'],
      steps: [
        'Pad with an extra row and column for the empty prefix.',
        'Fill the base row/column with the cost of matching against nothing.',
        'Branch on whether the current characters match.',
      ],
      complexity: 'O(n·m) time; O(min(n,m)) space when rolled.',
      gotchas: [
        'Index carefully: `dp[i][j]` uses `a.charAt(i-1)` and `b.charAt(j-1)`.',
        'Longest common **substring** resets to 0 on mismatch; **subsequence** takes the max.',
        'Wildcard/regex matching needs special handling for `*`, which can match zero characters.',
      ],
      problems: ['Longest Common Subsequence', 'Edit Distance', 'Distinct Subsequences', 'Interleaving String', 'Regular Expression Matching', 'Wildcard Matching', 'Delete Operation for Two Strings'],
    },
    {
      id: 'lis-pattern',
      name: 'LIS / Best Subsequence Ending Here',
      oneLiner: 'dp[i] considers every earlier index that could precede i.',
      useWhen: ['Longest increasing/chaining subsequence; problems where any earlier element may extend to i.'],
      recognize: ['"Longest increasing subsequence", "maximum chain", "can this follow that".'],
      steps: ['`dp[i] = 1 + max(dp[j])` over valid `j < i`.', 'The answer is `max(dp)`.', 'Upgrade to `O(n log n)` with the patience/tails array if needed.'],
      complexity: 'O(n²), or O(n log n) with binary search.',
      gotchas: [
        'The answer is the maximum over the table, not the last cell.',
        'The tails array is not itself a valid subsequence.',
        'Sort carefully for 2-D chaining (Russian Doll: width ascending, height **descending**).',
      ],
      problems: ['Longest Increasing Subsequence', 'Russian Doll Envelopes', 'Longest String Chain', 'Number of Longest Increasing Subsequence', 'Maximum Length of Pair Chain'],
    },
    {
      id: 'grid-dp',
      name: 'Grid DP',
      oneLiner: 'Each cell combines the cells it can be reached from.',
      useWhen: ['Paths in a grid, minimum cost routes, maximal squares, triangles.'],
      recognize: ['A 2-D board with movement restricted to one or two directions.'],
      steps: ['Decide the allowed incoming directions.', 'Handle the first row and column as base cases.', 'Roll to one row for O(n) space.'],
      complexity: 'O(rows · cols) time; O(cols) space rolled.',
      gotchas: [
        'Obstacles zero out a cell *and* everything downstream through it.',
        'If movement is in all four directions, it is no longer a simple DP — it becomes a shortest-path (Dijkstra/BFS) problem.',
      ],
      problems: ['Unique Paths', 'Unique Paths II', 'Minimum Path Sum', 'Maximal Square', 'Triangle', 'Dungeon Game'],
    },
    {
      id: 'interval-dp',
      name: 'Interval DP',
      oneLiner: 'dp[i][j] over a range, split at every interior point — and think about the LAST operation.',
      useWhen: ['Merging/removing elements where the order of operations matters.'],
      recognize: ['"Burst", "merge stones", "minimum cuts", "matrix chain multiplication".'],
      steps: [
        'Iterate by increasing interval length so sub-intervals are ready.',
        'Inner loop over the split point `k`.',
        'Ask "what if `k` is processed **last**?" to make the two sides independent.',
      ],
      template: {
        lang: 'java',
        caption: 'The interval loop order — length outermost, always',
        code: `
for (int len = 2; len <= n; len++)
    for (int i = 0; i + len <= n; i++) {
        int j = i + len - 1;
        for (int k = i; k < j; k++)
            dp[i][j] = best(dp[i][j], dp[i][k] + dp[k + 1][j] + cost(i, k, j));
    }
return dp[0][n - 1];`,
      },
      complexity: 'O(n³) time, O(n²) space.',
      gotchas: ['Length must be the outermost loop.', 'Sentinel padding (the virtual balloons) removes all boundary special cases.'],
      problems: ['Burst Balloons', 'Palindrome Partitioning II', 'Minimum Cost to Cut a Stick', 'Longest Palindromic Subsequence', 'Strange Printer'],
    },
    {
      id: 'state-machine-dp',
      name: 'State-Machine DP',
      oneLiner: 'Track which mode you are in; transitions carry the costs.',
      useWhen: ['Buy/sell/hold, cooldowns, limited transactions, alternating constraints.'],
      recognize: ['The legal next move depends on what you did last.'],
      steps: ['Enumerate the states.', 'Write the transition for each.', 'Update all states from the *previous* values — snapshot them first.'],
      complexity: 'O(n · states) time, O(states) space.',
      gotchas: ['Snapshot the previous values before updating, or a same-tick transition chains illegally.', 'Initialise "holding" to −infinity, not 0.'],
      problems: ['Best Time to Buy and Sell Stock', 'Best Time to Buy and Sell Stock II', 'Best Time to Buy and Sell Stock with Cooldown', 'Best Time to Buy and Sell Stock with Transaction Fee', 'Best Time to Buy and Sell Stock III', 'Best Time to Buy and Sell Stock IV'],
    },
    {
      id: 'bitmask-dp',
      name: 'Bitmask DP',
      oneLiner: 'When n ≤ 20, the subset of used items fits in a single integer.',
      useWhen: ['Assignment problems, travelling salesman, "cover all items exactly once".'],
      recognize: ['Small `n` (≤ 20) combined with "all permutations/assignments".'],
      steps: ['`mask` bit `i` = item `i` is used.', '`dp[mask]` = best cost to reach that used-set.', 'Transition by adding one unused bit.'],
      template: {
        lang: 'java',
        caption: 'Bitmask iteration idioms',
        code: `
for (int mask = 0; mask < (1 << n); mask++)
    for (int i = 0; i < n; i++) {
        if ((mask & (1 << i)) != 0) continue;         // i already used
        int next = mask | (1 << i);
        dp[next] = best(dp[next], dp[mask] + cost(mask, i));
    }

Integer.bitCount(mask);          // how many items used
(mask & (mask - 1))              // clear the lowest set bit
(mask & -mask)                   // isolate the lowest set bit
for (int s = mask; s > 0; s = (s - 1) & mask)   // iterate all SUBMASKS of mask`,
      },
      complexity: 'O(2ⁿ · n) time, O(2ⁿ) space.',
      gotchas: ['Only viable for n ≤ 20 (2²⁰ ≈ 10⁶).', 'The number of used bits often encodes the position, removing a dimension.'],
      problems: ['Partition to K Equal Sum Subsets', 'Shortest Path Visiting All Nodes', 'Find the Shortest Superstring', 'Maximum Students Taking Exam'],
    },
  ],

  pitfalls: [
    { title: 'Coding before defining the state in words', text: 'If you cannot say what `dp[i]` means in one sentence, stop and define it.' },
    { title: 'Wrong loop direction in knapsack', text: 'Backward = 0/1, forward = unbounded. One character, completely different problem.' },
    { title: 'Assuming the answer is dp[n]', text: 'For LIS and maximal-square it is the maximum over the whole table.' },
    { title: 'Off-by-one between "first i items" and "index i"', text: 'Pad the table with an extra row/column and be consistent.' },
    { title: 'Overflow in the infinity sentinel', text: '`Integer.MAX_VALUE + 1` wraps negative. Use `amount + 1` or `MAX_VALUE / 2`.' },
    { title: 'Memoising a mutable key', text: 'The cache key must capture the *complete* state. If a parameter affects the answer and is not in the key, the cache returns wrong values.' },
    { title: 'Optimising space too early', text: 'Get the full table correct first. Roll it afterwards.' },
    { title: 'Using DP where greedy works (and vice versa)', text: 'DP is safe but slower; greedy is fast but needs proof. When unsure, write the DP.' },
  ],

  cheatsheet: [
    { label: 'Step 1', value: 'define dp[...] in one sentence' },
    { label: 'Step 2', value: 'recurrence = best over choices' },
    { label: '0/1 knapsack', value: 'capacity loop BACKWARD' },
    { label: 'Unbounded', value: 'capacity loop FORWARD' },
    { label: 'Combinations', value: 'item loop outside' },
    { label: 'Permutations', value: 'target loop outside' },
    { label: 'Two sequences', value: 'match → diagonal' },
    { label: 'LCS mismatch', value: 'max(up, left)' },
    { label: 'Edit distance mismatch', value: '1 + min(diag, up, left)' },
    { label: 'LIS answer', value: 'max(dp), not dp[n−1]' },
    { label: 'LIS O(n log n)', value: 'tails + lowerBound' },
    { label: 'Maximal square', value: '1 + min of three neighbours' },
    { label: 'Interval DP', value: 'length outermost; think LAST' },
    { label: 'Stuck?', value: 'add a dimension to the state' },
    { label: 'Bitmask viable', value: 'n ≤ 20' },
  ],

  problems: [
    { name: 'Climbing Stairs', difficulty: 'Easy', url: 'https://leetcode.com/problems/climbing-stairs/', pattern: 'Linear DP', insight: 'Fibonacci. Start here and do the full brute-force → memo → table → O(1) progression.' },
    { name: 'Min Cost Climbing Stairs', difficulty: 'Easy', url: 'https://leetcode.com/problems/min-cost-climbing-stairs/', pattern: 'Linear DP', insight: 'You may start at index 0 or 1 — the base cases are the whole problem.' },
    { name: 'House Robber', difficulty: 'Medium', url: 'https://leetcode.com/problems/house-robber/', pattern: 'Linear DP', insight: 'Take-or-skip. The template for every "no two adjacent" question.' },
    { name: 'House Robber II', difficulty: 'Medium', url: 'https://leetcode.com/problems/house-robber-ii/', pattern: 'Linear DP ×2', insight: 'Circular: run the linear version twice, excluding the first house then the last.' },
    { name: 'Maximum Subarray', difficulty: 'Medium', url: 'https://leetcode.com/problems/maximum-subarray/', pattern: 'Kadane', insight: 'best-ending-here — the smallest possible DP state.' },
    { name: 'Coin Change', difficulty: 'Medium', url: 'https://leetcode.com/problems/coin-change/', pattern: 'Unbounded knapsack', insight: 'Minimise coins; use amount+1 as infinity so you never overflow.' },
    { name: 'Coin Change II', difficulty: 'Medium', url: 'https://leetcode.com/problems/coin-change-ii/', pattern: 'Unbounded knapsack (counting)', insight: 'Coin loop outside to count combinations, not permutations.' },
    { name: 'Combination Sum IV', difficulty: 'Medium', url: 'https://leetcode.com/problems/combination-sum-iv/', pattern: 'Unbounded knapsack (permutations)', insight: 'Target loop outside — the mirror image of Coin Change II.' },
    { name: 'Partition Equal Subset Sum', difficulty: 'Medium', url: 'https://leetcode.com/problems/partition-equal-subset-sum/', pattern: '0/1 knapsack', insight: 'Boolean subset-sum for total/2; reject odd totals immediately.' },
    { name: 'Target Sum', difficulty: 'Medium', url: 'https://leetcode.com/problems/target-sum/', pattern: '0/1 knapsack', insight: 'Rewrite +/− assignment as "choose a subset summing to (total + target)/2".' },
    { name: 'Word Break', difficulty: 'Medium', url: 'https://leetcode.com/problems/word-break/', pattern: 'Linear DP over prefixes', insight: 'dp[i] is true when some j has dp[j] true and s[j..i) is in the dictionary.' },
    { name: 'Longest Increasing Subsequence', difficulty: 'Medium', url: 'https://leetcode.com/problems/longest-increasing-subsequence/', pattern: 'LIS', insight: 'Know both O(n²) and the patience-sorting O(n log n).' },
    { name: 'Unique Paths', difficulty: 'Medium', url: 'https://leetcode.com/problems/unique-paths/', pattern: 'Grid DP', insight: 'Also solvable with a binomial coefficient — worth mentioning.' },
    { name: 'Unique Paths II', difficulty: 'Medium', url: 'https://leetcode.com/problems/unique-paths-ii/', pattern: 'Grid DP', insight: 'An obstacle zeroes its cell; the first row/column stop propagating after one.' },
    { name: 'Minimum Path Sum', difficulty: 'Medium', url: 'https://leetcode.com/problems/minimum-path-sum/', pattern: 'Grid DP', insight: 'In-place accumulation keeps it O(1) extra space.' },
    { name: 'Maximal Square', difficulty: 'Medium', url: 'https://leetcode.com/problems/maximal-square/', pattern: 'Grid DP', insight: '1 + min of the three neighbours; the bottleneck limits the square.' },
    { name: 'Longest Common Subsequence', difficulty: 'Medium', url: 'https://leetcode.com/problems/longest-common-subsequence/', pattern: 'Two-sequence DP', insight: 'The parent of a whole family of string-transformation problems.' },
    { name: 'Longest Palindromic Subsequence', difficulty: 'Medium', url: 'https://leetcode.com/problems/longest-palindromic-subsequence/', pattern: 'Interval DP', insight: 'Equivalently LCS(s, reverse(s)).' },
    { name: 'Decode Ways', difficulty: 'Medium', url: 'https://leetcode.com/problems/decode-ways/', pattern: 'Linear DP', insight: 'Zeros are the whole difficulty: "0" alone is invalid and "06" is not 6.' },
    { name: 'Best Time to Buy and Sell Stock with Cooldown', difficulty: 'Medium', url: 'https://leetcode.com/problems/best-time-to-buy-and-sell-stock-with-cooldown/', pattern: 'State machine', insight: 'Three states; snapshot the previous values before updating.' },
    { name: 'Palindromic Substrings', difficulty: 'Medium', url: 'https://leetcode.com/problems/palindromic-substrings/', pattern: 'Interval DP / expand', insight: 'dp[i][j] = s[i]==s[j] && dp[i+1][j-1]; or just expand around centres.' },
    { name: 'Partition to K Equal Sum Subsets', difficulty: 'Medium', url: 'https://leetcode.com/problems/partition-to-k-equal-sum-subsets/', pattern: 'Bitmask DP / backtracking', insight: 'dp over the used-mask; the bit count implicitly tracks progress.' },
    { name: 'Edit Distance', difficulty: 'Medium', url: 'https://leetcode.com/problems/edit-distance/', pattern: 'Two-sequence DP', insight: 'The three operations map exactly to the three neighbouring cells.' },
    { name: 'Jump Game', difficulty: 'Medium', url: 'https://leetcode.com/problems/jump-game/', pattern: 'DP or greedy', insight: 'Instructive because the greedy is strictly better — know why.' },
    { name: 'Longest String Chain', difficulty: 'Medium', url: 'https://leetcode.com/problems/longest-string-chain/', pattern: 'LIS-style', insight: 'Sort by length, then DP over predecessors formed by deleting one character.' },
    { name: 'Regular Expression Matching', difficulty: 'Hard', url: 'https://leetcode.com/problems/regular-expression-matching/', pattern: 'Two-sequence DP', insight: '`*` either matches zero occurrences (skip two pattern chars) or consumes one text char.' },
    { name: 'Wildcard Matching', difficulty: 'Hard', url: 'https://leetcode.com/problems/wildcard-matching/', pattern: 'Two-sequence DP', insight: '`*` matches any sequence: dp[i][j] = dp[i-1][j] || dp[i][j-1].' },
    { name: 'Burst Balloons', difficulty: 'Hard', url: 'https://leetcode.com/problems/burst-balloons/', pattern: 'Interval DP', insight: 'Iterate over which balloon is burst LAST; pad with virtual 1s.' },
    { name: 'Distinct Subsequences', difficulty: 'Hard', url: 'https://leetcode.com/problems/distinct-subsequences/', pattern: 'Two-sequence DP', insight: 'On a match you may either use it or skip it: dp[i-1][j-1] + dp[i-1][j].' },
    { name: 'Longest Valid Parentheses', difficulty: 'Hard', url: 'https://leetcode.com/problems/longest-valid-parentheses/', pattern: 'Linear DP / stack', insight: 'DP: on ")", look back past the matched block to extend a previous run.' },
    { name: 'Dungeon Game', difficulty: 'Hard', url: 'https://leetcode.com/problems/dungeon-game/', pattern: 'Grid DP (backwards)', insight: 'Must be solved from the destination backwards — forward DP cannot see future damage.' },
    { name: 'Best Time to Buy and Sell Stock IV', difficulty: 'Hard', url: 'https://leetcode.com/problems/best-time-to-buy-and-sell-stock-iv/', pattern: 'State machine + k', insight: 'Collapse to the unlimited case when k ≥ n/2.' },
    { name: 'Russian Doll Envelopes', difficulty: 'Hard', url: 'https://leetcode.com/problems/russian-doll-envelopes/', pattern: 'LIS in 2-D', insight: 'Sort width ascending, height descending, then LIS on heights.' },
    { name: 'Palindrome Partitioning II', difficulty: 'Hard', url: 'https://leetcode.com/problems/palindrome-partitioning-ii/', pattern: 'Interval + linear DP', insight: 'Precompute the palindrome table, then a simple min-cut DP over prefixes.' },
    { name: 'Frog Jump', difficulty: 'Hard', url: 'https://leetcode.com/problems/frog-jump/', pattern: 'DP with extra state', insight: 'The state is (stone, lastJumpSize) — a perfect example of adding a dimension.' },
  ],
}
