export default {
  id: 'recursion',
  title: 'Recursion & Backtracking',
  short: 'Recursion',
  icon: 'AllInclusiveRounded',
  tier: 'Core',
  order: 10,
  estHours: 14,
  prereqs: ['complexity'],
  tagline: 'Trust the recursion. Define the contract, handle the base case, and let the function do its job.',
  mentalModel:
    'Write the function as if it already works. Your only jobs are: (1) state precisely what it returns, (2) stop at the base case, (3) combine the results of smaller calls. Do not trace the whole tree in your head — that way lies madness.',
  whyItMatters:
    'Trees, graphs, DP and divide-and-conquer are all recursion wearing different hats. And backtracking is the single technique for "generate all valid configurations", which covers subsets, permutations, N-Queens, Sudoku and word search.',

  complexity: [
    { op: 'Subsets of n elements', time: 'O(2ⁿ · n)', space: 'O(n)', note: '2ⁿ subsets, O(n) to copy each' },
    { op: 'Permutations of n elements', time: 'O(n! · n)', space: 'O(n)', note: 'n! leaves' },
    { op: 'Combinations C(n, k)', time: 'O(C(n,k) · k)', space: 'O(k)', note: 'Pruned subset generation' },
    { op: 'Balanced parentheses', time: 'O(4ⁿ / √n)', space: 'O(n)', note: 'Catalan number of results' },
    { op: 'N-Queens', time: 'O(n!)', space: 'O(n)', note: 'Heavy pruning makes it practical to n ≈ 13' },
    { op: 'Grid word search', time: 'O(m·n·4^L)', space: 'O(L)', note: 'L = word length' },
    { op: 'Recursion stack', time: '—', space: 'O(depth)', note: 'Always mention this' },
  ],

  sections: [
    {
      id: 'contract',
      title: 'The recursive contract',
      blocks: [
        { t: 'lead', text: 'Stop tracing. Start specifying.' },
        { t: 'p', text: 'The single most common reason recursion feels hard is that people try to simulate the call stack mentally. Professionals do something else: they write down a **contract** — a one-sentence statement of what the function returns for *any* valid input — and then trust it.' },
        {
          t: 'steps',
          items: [
            { title: 'State the contract', text: '"`maxDepth(node)` returns the height of the subtree rooted at `node`." Now, inside the body, `maxDepth(node.left)` is *known* to be the left height. You do not need to know how.' },
            { title: 'Write the base case first', text: 'What is the smallest input, and what does the contract say the answer is? `maxDepth(null) = 0`. Getting this right prevents most infinite recursions.' },
            { title: 'Assume the recursive calls work', text: 'Call yourself on strictly smaller inputs.' },
            { title: 'Combine', text: 'Turn the sub-answers into your answer. `return 1 + max(left, right)`.' },
            { title: 'Check progress', text: 'Every recursive call must move measurably toward the base case, or you stack-overflow.' },
          ],
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'The contract in action — three functions, same four steps',
          code: `
// CONTRACT: returns the height of the subtree rooted at node.
int height(TreeNode node) {
    if (node == null) return 0;                              // base
    return 1 + Math.max(height(node.left), height(node.right));  // combine
}

// CONTRACT: returns the reversed list whose head was 'head'.
ListNode reverse(ListNode head) {
    if (head == null || head.next == null) return head;      // base
    ListNode newHead = reverse(head.next);                   // trust it
    head.next.next = head;                                   // combine
    head.next = null;
    return newHead;
}

// CONTRACT: returns the number of distinct ways to climb 'n' stairs.
int climb(int n) {
    if (n <= 2) return n;                                    // base
    return climb(n - 1) + climb(n - 2);                      // combine
}`,
        },
        {
          t: 'key',
          title: 'Recursion vs iteration',
          text: 'Recursion is not slower by nature, but it costs `O(depth)` stack and Java does not optimise tail calls. Depth beyond roughly 10⁴ risks `StackOverflowError` — for a linked list of 10⁵ nodes, use iteration. Say this when you choose recursion; it shows you know the limits.',
        },
      ],
    },
    {
      id: 'backtracking',
      title: 'Backtracking — the universal template',
      blocks: [
        { t: 'p', text: 'Backtracking is depth-first search over the space of *partial solutions*. You make a choice, recurse, then **undo the choice**. The undo is what makes it "backtracking" and it is where nearly all bugs live.' },
        {
          t: 'ascii',
          caption: 'The decision tree for subsets of [1,2,3]. Each level decides one element.',
          code: `
                          []
              include 1 /    \\ skip 1
                     [1]        []
            inc 2 /    \\      /    \\
               [1,2]    [1]  [2]    []
          inc3/  \\     /  \\  /  \\   /  \\
        [1,2,3][1,2][1,3][1][2,3][2][3] []

        8 leaves = 2^3 subsets`,
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'THE backtracking template — commit this to memory',
          code: `
void backtrack(State state, List<Result> results) {
    if (isComplete(state)) {              // 1. GOAL
        results.add(copyOf(state));       //    copy! the state keeps mutating
        return;
    }

    for (Choice c : choicesFrom(state)) { // 2. EXPLORE
        if (!isValid(state, c)) continue; //    3. PRUNE early
        apply(state, c);                  //    4. CHOOSE
        backtrack(state, results);        //    5. RECURSE
        undo(state, c);                   //    6. UN-CHOOSE  <- never forget this
    }
}`,
        },
        {
          t: 'trap',
          title: 'Two bugs cause 90% of backtracking failures',
          text: '**(1)** Adding the live mutable `path` to the results instead of a copy — every result ends up empty or identical. Always `new ArrayList<>(path)`. **(2)** Forgetting to undo — the state leaks into sibling branches and results are nonsense.',
        },
        { t: 'h', text: 'The three shapes: subsets, combinations, permutations' },
        {
          t: 'code',
          lang: 'java',
          caption: 'Subsets — every node is an answer, so record on entry',
          code: `
void subsets(int[] a, int start, List<Integer> path, List<List<Integer>> out) {
    out.add(new ArrayList<>(path));         // EVERY node is a valid subset
    for (int i = start; i < a.length; i++) {
        path.add(a[i]);
        subsets(a, i + 1, path, out);       // i + 1: never reuse, never reorder
        path.remove(path.size() - 1);
    }
}`,
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'Combinations — prune when not enough elements remain',
          code: `
void combine(int n, int k, int start, List<Integer> path, List<List<Integer>> out) {
    if (path.size() == k) { out.add(new ArrayList<>(path)); return; }

    int need = k - path.size();
    // prune: stop early if fewer than 'need' candidates remain
    for (int i = start; i <= n - need + 1; i++) {
        path.add(i);
        combine(n, k, i + 1, path, out);
        path.remove(path.size() - 1);
    }
}`,
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'Permutations — order matters, so scan from 0 with a used[] array',
          code: `
void permute(int[] a, boolean[] used, List<Integer> path, List<List<Integer>> out) {
    if (path.size() == a.length) { out.add(new ArrayList<>(path)); return; }

    for (int i = 0; i < a.length; i++) {     // from 0, not from 'start'
        if (used[i]) continue;
        used[i] = true;  path.add(a[i]);
        permute(a, used, path, out);
        path.remove(path.size() - 1);  used[i] = false;
    }
}`,
        },
        {
          t: 'table',
          head: ['Shape', 'Loop starts at', 'Record when', 'Reuse elements?'],
          rows: [
            ['Subsets', '`start`', 'every node', 'no'],
            ['Combinations (choose k)', '`start`', '`path.size() == k`', 'no'],
            ['Combination Sum (reuse allowed)', '`start`', 'target reached', '**yes** — recurse with `i`, not `i+1`'],
            ['Permutations', '`0` with `used[]`', '`path.size() == n`', 'no, but order matters'],
          ],
        },
        {
          t: 'key',
          title: 'i + 1 versus i',
          text: 'Recursing with `i + 1` means "this element is used up". Recursing with `i` means "I may use this element again". That single character is the difference between Combination Sum and Combination Sum II.',
        },
      ],
    },
    {
      id: 'duplicates',
      title: 'Handling duplicates without producing duplicate answers',
      blocks: [
        { t: 'p', text: 'Given `[1, 2, 2]`, naive subset generation produces `[1,2]` twice. The fix is always the same two steps: **sort**, then **skip a candidate that equals its predecessor at the same tree level**.' },
        {
          t: 'code',
          lang: 'java',
          caption: 'The skip rule for subsets/combinations with duplicates',
          code: `
Arrays.sort(a);   // duplicates become adjacent — this is mandatory

void backtrack(int[] a, int start, List<Integer> path, List<List<Integer>> out) {
    out.add(new ArrayList<>(path));
    for (int i = start; i < a.length; i++) {
        if (i > start && a[i] == a[i - 1]) continue;   // same VALUE at same LEVEL
        path.add(a[i]);
        backtrack(a, i + 1, path, out);
        path.remove(path.size() - 1);
    }
}`,
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'The skip rule for permutations with duplicates',
          code: `
Arrays.sort(a);

void permute(int[] a, boolean[] used, List<Integer> path, List<List<Integer>> out) {
    if (path.size() == a.length) { out.add(new ArrayList<>(path)); return; }
    for (int i = 0; i < a.length; i++) {
        if (used[i]) continue;
        // only allow the FIRST unused copy of a run of equal values
        if (i > 0 && a[i] == a[i - 1] && !used[i - 1]) continue;
        used[i] = true;  path.add(a[i]);
        permute(a, used, path, out);
        path.remove(path.size() - 1);  used[i] = false;
    }
}`,
        },
        {
          t: 'trap',
          title: '`i > start` versus `i > 0 && !used[i-1]`',
          text: 'They are different rules for different shapes. For subsets/combinations the guard is positional (`i > start`). For permutations it is state-based (`!used[i-1]`), because the same value can legitimately appear again later in a permutation — just not as a *different branch at the same depth*. Mixing them up silently drops valid answers.',
        },
      ],
    },
    {
      id: 'pruning',
      title: 'Pruning — what turns exponential into feasible',
      blocks: [
        { t: 'p', text: 'Backtracking without pruning is brute force. Pruning is what makes N-Queens solvable for `n = 12` and Sudoku instant.' },
        {
          t: 'ul',
          items: [
            '**Feasibility pruning** — stop as soon as the partial solution cannot possibly be completed (running sum already exceeds the target).',
            '**Sorted-order pruning** — sort candidates so you can `break` instead of `continue` when the first failure means all later ones fail too.',
            '**Constraint propagation** — maintain sets of forbidden values (`cols`, `diag1`, `diag2` in N-Queens) so validity is an `O(1)` check rather than an `O(n)` scan.',
            '**Symmetry breaking** — fix the first choice to avoid exploring mirror images.',
            '**Memoisation** — if the same state can be reached by different paths, cache it (this is where backtracking becomes DP).',
          ],
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'N-Queens — O(1) validity via three boolean sets',
          code: `
int n; boolean[] col, diag, anti; List<List<String>> out; int[] pos;

void solve(int row) {
    if (row == n) { out.add(render(pos)); return; }
    for (int c = 0; c < n; c++) {
        int d = row - c + n;          // shift to keep the index non-negative
        int ad = row + c;
        if (col[c] || diag[d] || anti[ad]) continue;   // O(1) pruning

        col[c] = diag[d] = anti[ad] = true;  pos[row] = c;
        solve(row + 1);
        col[c] = diag[d] = anti[ad] = false;           // undo
    }
}`,
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'Combination Sum — sorting enables break instead of continue',
          code: `
Arrays.sort(candidates);

void dfs(int[] c, int start, int remaining, List<Integer> path, List<List<Integer>> out) {
    if (remaining == 0) { out.add(new ArrayList<>(path)); return; }

    for (int i = start; i < c.length; i++) {
        if (c[i] > remaining) break;      // sorted ⇒ everything after is too big too
        path.add(c[i]);
        dfs(c, i, remaining - c[i], path, out);   // 'i' allows reuse
        path.remove(path.size() - 1);
    }
}`,
        },
        {
          t: 'tip',
          title: 'break beats continue',
          text: 'If the candidates are sorted and the current one already fails a monotone check, every later candidate fails too. Converting a `continue` into a `break` is often the difference between TLE and accepted.',
        },
      ],
    },
    {
      id: 'divide-conquer',
      title: 'Divide and conquer, and recursion on grids',
      blocks: [
        { t: 'p', text: 'Divide and conquer is recursion where the subproblems are *independent* and roughly equal in size. Merge sort, quickselect, binary search and "construct tree from traversals" are the canonical examples.' },
        {
          t: 'code',
          lang: 'java',
          caption: 'Build a binary tree from preorder + inorder — index maps make it O(n)',
          code: `
Map<Integer,Integer> inIndex = new HashMap<>();   // value -> index in inorder
int p = 0;

TreeNode build(int[] preorder, int[] inorder) {
    for (int i = 0; i < inorder.length; i++) inIndex.put(inorder[i], i);
    return helper(preorder, 0, inorder.length - 1);
}

TreeNode helper(int[] pre, int lo, int hi) {
    if (lo > hi) return null;
    int val = pre[p++];                      // preorder gives the root in order
    TreeNode root = new TreeNode(val);
    int mid = inIndex.get(val);              // inorder tells us where it splits
    root.left  = helper(pre, lo, mid - 1);   // LEFT FIRST — preorder demands it
    root.right = helper(pre, mid + 1, hi);
    return root;
}`,
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'Word Search — grid DFS with in-place marking as the visited set',
          code: `
boolean dfs(char[][] g, int r, int c, String word, int k) {
    if (k == word.length()) return true;
    if (r < 0 || c < 0 || r >= g.length || c >= g[0].length) return false;
    if (g[r][c] != word.charAt(k)) return false;

    char saved = g[r][c];
    g[r][c] = '#';                                  // mark visited, no extra array
    boolean found = dfs(g, r+1, c, word, k+1) || dfs(g, r-1, c, word, k+1)
                 || dfs(g, r, c+1, word, k+1) || dfs(g, r, c-1, word, k+1);
    g[r][c] = saved;                                // restore — this is the backtrack
    return found;
}`,
        },
        {
          t: 'note',
          title: 'In-place marking is a legitimate visited set',
          text: 'Overwriting the cell with a sentinel avoids allocating a `boolean[][]` and is `O(1)` space beyond the recursion. It is only safe because you restore it on the way out — and only if mutating the input is allowed.',
        },
      ],
    },
  ],

  patterns: [
    {
      id: 'subsets',
      name: 'Subsets / Power Set',
      oneLiner: 'At each element, branch on include-or-skip; every node is an answer.',
      useWhen: ['"All subsets", "all combinations", "all subsequences".'],
      recognize: ['Output size is 2ⁿ; n is small (≤ 20).'],
      steps: ['Record the current path at every node.', 'Loop from `start` and recurse with `i + 1`.', 'Undo after recursing.'],
      template: {
        lang: 'java',
        caption: 'Two equivalent formulations — pick whichever you find clearer',
        code: `
// (a) Loop form — natural for "start index" pruning
void dfs(int[] a, int start, List<Integer> path, List<List<Integer>> out) {
    out.add(new ArrayList<>(path));
    for (int i = start; i < a.length; i++) {
        path.add(a[i]);
        dfs(a, i + 1, path, out);
        path.remove(path.size() - 1);
    }
}

// (b) Binary-choice form — mirrors the decision tree exactly
void dfs2(int[] a, int i, List<Integer> path, List<List<Integer>> out) {
    if (i == a.length) { out.add(new ArrayList<>(path)); return; }
    path.add(a[i]); dfs2(a, i + 1, path, out); path.remove(path.size() - 1);  // take
    dfs2(a, i + 1, path, out);                                                // skip
}

// (c) Iterative bitmask — no recursion at all, for n <= 20
for (int mask = 0; mask < (1 << n); mask++) {
    List<Integer> sub = new ArrayList<>();
    for (int i = 0; i < n; i++) if ((mask & (1 << i)) != 0) sub.add(a[i]);
    out.add(sub);
}`,
      },
      complexity: 'O(2ⁿ · n) time, O(n) recursion depth.',
      gotchas: ['Copy the path when recording.', 'With duplicates: sort, then `if (i > start && a[i] == a[i-1]) continue`.'],
      problems: ['Subsets', 'Subsets II', 'Letter Case Permutation', 'Combination Sum', 'Combination Sum II'],
    },
    {
      id: 'permutations',
      name: 'Permutations',
      oneLiner: 'Order matters — scan all candidates each level, tracking which are used.',
      useWhen: ['"All orderings", "all arrangements", "all permutations".'],
      recognize: ['Output size is n!; n ≤ 10.'],
      steps: ['Loop `i` from 0 to n−1 every level.', 'Skip used elements.', 'Record when the path is full.'],
      complexity: 'O(n! · n) time, O(n) space.',
      gotchas: [
        'Duplicate rule is `i > 0 && a[i] == a[i-1] && !used[i-1]` — different from the subset rule.',
        'The swap-based variant avoids `used[]` but does not handle duplicates cleanly.',
      ],
      problems: ['Permutations', 'Permutations II', 'Next Permutation', 'Letter Combinations of a Phone Number'],
    },
    {
      id: 'constraint-backtracking',
      name: 'Constraint Satisfaction Backtracking',
      oneLiner: 'Place one item at a time, maintaining O(1)-checkable constraint sets.',
      useWhen: ['N-Queens, Sudoku, graph colouring, crossword filling.'],
      recognize: ['A board or grid with rules about rows, columns, regions or adjacency.'],
      steps: [
        'Choose an ordering (row by row, or most-constrained cell first).',
        'Maintain sets/bitmasks of what each row, column and region already contains.',
        'Recurse; undo the sets on the way out.',
      ],
      template: {
        lang: 'java',
        caption: 'Sudoku solver — return true to unwind immediately on success',
        code: `
boolean solve(char[][] b) {
    for (int r = 0; r < 9; r++)
        for (int c = 0; c < 9; c++) {
            if (b[r][c] != '.') continue;
            for (char d = '1'; d <= '9'; d++) {
                if (!valid(b, r, c, d)) continue;
                b[r][c] = d;
                if (solve(b)) return true;    // found a full solution — stop
                b[r][c] = '.';                // undo
            }
            return false;                     // no digit fits: this branch is dead
        }
    return true;                              // no empty cells left
}`,
      },
      complexity: 'Exponential in theory; pruning makes it fast in practice.',
      gotchas: [
        'For find-**one**-solution problems, propagate a boolean return so you stop immediately instead of exploring the rest.',
        'The `return false` after the digit loop is essential — without it the search silently continues past a dead end.',
      ],
      problems: ['N-Queens', 'N-Queens II', 'Sudoku Solver', 'Word Search', 'Word Search II'],
    },
    {
      id: 'partition-backtracking',
      name: 'Partitioning / Segmentation',
      oneLiner: 'Choose where to cut, validate the prefix, recurse on the rest.',
      useWhen: ['Splitting a string or array into valid pieces.'],
      recognize: ['"Palindrome partitioning", "restore IP addresses", "word break II", "matchsticks to square".'],
      steps: [
        'At position `i`, try every end `j` for the next piece.',
        'Validate `[i, j)` cheaply (precompute a palindrome table if needed).',
        'Recurse from `j`; undo.',
      ],
      complexity: 'O(2ⁿ · n) worst case; precomputation and pruning matter a lot.',
      gotchas: ['Precompute validity (e.g. `isPal[i][j]` by DP) so the inner check is O(1).', 'Bound the piece length where the problem allows (IP segments are ≤ 3 digits).'],
      problems: ['Palindrome Partitioning', 'Restore IP Addresses', 'Word Break II', 'Partition to K Equal Sum Subsets'],
    },
    {
      id: 'divide-conquer',
      name: 'Divide & Conquer',
      oneLiner: 'Split into independent halves, solve each, then combine.',
      useWhen: ['Merge sort, quickselect, tree construction, expression evaluation with different groupings.'],
      recognize: ['The problem splits cleanly at a pivot or a root, with no interaction between halves.'],
      steps: ['Identify the split point.', 'Recurse on each side.', 'Combine — this step is usually where the real work lives.'],
      complexity: 'Master theorem: `T(n) = aT(n/b) + f(n)`. Merge sort is `2T(n/2) + O(n)` = `O(n log n)`.',
      gotchas: ['Off-by-one in the split bounds. Standardise on half-open `[lo, hi)`.', 'Watch for repeated subproblems — if halves overlap, you need memoisation.'],
      problems: ['Sort an Array', 'Construct Binary Tree from Preorder and Inorder Traversal', 'Different Ways to Add Parentheses', 'Kth Largest Element in an Array', 'Beautiful Array'],
    },
  ],

  pitfalls: [
    { title: 'Adding the live path to the results', text: 'It keeps mutating. Always `new ArrayList<>(path)`.' },
    { title: 'Forgetting to undo', text: 'State leaks into sibling branches. Every `apply` needs a matching `undo` on the same code path.' },
    { title: 'Wrong duplicate-skip rule', text: 'Subsets use `i > start`; permutations use `!used[i-1]`. They are not interchangeable.' },
    { title: 'Missing base case', text: 'Or a base case that does not actually terminate — check that every call strictly reduces the problem.' },
    { title: 'Ignoring stack depth', text: 'Depth > ~10⁴ overflows in Java. Convert to an explicit stack for deep linear structures.' },
    { title: 'No pruning', text: 'An unpruned N-Queens or Combination Sum will time out. Sort and break early.' },
    { title: 'Not returning early for find-one problems', text: 'Sudoku and Word Search should stop as soon as a solution is found.' },
  ],

  cheatsheet: [
    { label: 'Template', value: 'choose → recurse → un-choose' },
    { label: 'Record answers', value: 'copy the path, never the reference' },
    { label: 'Subsets', value: 'record at every node, loop from start' },
    { label: 'Combinations', value: 'record at size k, recurse i+1' },
    { label: 'Reuse allowed', value: 'recurse with i, not i+1' },
    { label: 'Permutations', value: 'loop from 0 with used[]' },
    { label: 'Dup subsets', value: 'sort + (i > start && a[i]==a[i-1])' },
    { label: 'Dup permutations', value: 'sort + (a[i]==a[i-1] && !used[i-1])' },
    { label: 'Prune', value: 'sort then break, not continue' },
    { label: 'Grid visited', value: 'overwrite cell, restore on exit' },
    { label: 'Find one solution', value: 'return boolean to unwind' },
    { label: 'Space', value: 'O(depth) — always state it' },
  ],

  problems: [
    { name: 'Fibonacci Number', difficulty: 'Easy', url: 'https://leetcode.com/problems/fibonacci-number/', pattern: 'Recursion → memo', insight: 'The cleanest demonstration of why naive recursion is exponential and memoisation is linear.' },
    { name: 'Climbing Stairs', difficulty: 'Easy', url: 'https://leetcode.com/problems/climbing-stairs/', pattern: 'Recursion → DP', insight: 'Same recurrence as Fibonacci; the bridge from recursion into the DP chapter.' },
    { name: 'Power of Two', difficulty: 'Easy', url: 'https://leetcode.com/problems/power-of-two/', pattern: 'Recursion / bit trick', insight: 'Recursive halving, or the one-liner `n > 0 && (n & (n-1)) == 0`.' },
    { name: 'Merge Two Sorted Lists', difficulty: 'Easy', url: 'https://leetcode.com/problems/merge-two-sorted-lists/', pattern: 'Recursion on lists', insight: 'The recursive version is four lines and shows the contract idea beautifully.' },
    { name: 'Subsets', difficulty: 'Medium', url: 'https://leetcode.com/problems/subsets/', pattern: 'Subsets', insight: 'Record at every node. Also know the bitmask formulation.' },
    { name: 'Subsets II', difficulty: 'Medium', url: 'https://leetcode.com/problems/subsets-ii/', pattern: 'Subsets + dedup', insight: 'Sort, then skip `i > start && a[i] == a[i-1]`.' },
    { name: 'Permutations', difficulty: 'Medium', url: 'https://leetcode.com/problems/permutations/', pattern: 'Permutations', insight: 'Loop from 0 with a used[] array.' },
    { name: 'Permutations II', difficulty: 'Medium', url: 'https://leetcode.com/problems/permutations-ii/', pattern: 'Permutations + dedup', insight: 'The `!used[i-1]` guard allows only the first unused copy of each run.' },
    { name: 'Combination Sum', difficulty: 'Medium', url: 'https://leetcode.com/problems/combination-sum/', pattern: 'Backtracking with reuse', insight: 'Recurse with `i` to allow reuse; sort and break when the candidate exceeds the remainder.' },
    { name: 'Combination Sum II', difficulty: 'Medium', url: 'https://leetcode.com/problems/combination-sum-ii/', pattern: 'Backtracking + dedup', insight: 'Recurse with `i + 1` (each number used once) plus the level-skip rule.' },
    { name: 'Combinations', difficulty: 'Medium', url: 'https://leetcode.com/problems/combinations/', pattern: 'Combinations', insight: 'Prune the loop bound to `n − need + 1`.' },
    { name: 'Letter Combinations of a Phone Number', difficulty: 'Medium', url: 'https://leetcode.com/problems/letter-combinations-of-a-phone-number/', pattern: 'Backtracking', insight: 'One digit per level; the branching factor is the letters on that key.' },
    { name: 'Generate Parentheses', difficulty: 'Medium', url: 'https://leetcode.com/problems/generate-parentheses/', pattern: 'Backtracking with constraints', insight: 'Add "(" while open < n; add ")" only while close < open. Validity is built in, not checked.' },
    { name: 'Word Search', difficulty: 'Medium', url: 'https://leetcode.com/problems/word-search/', pattern: 'Grid backtracking', insight: 'Mark the cell in place and restore it on the way out.' },
    { name: 'Palindrome Partitioning', difficulty: 'Medium', url: 'https://leetcode.com/problems/palindrome-partitioning/', pattern: 'Partitioning', insight: 'Precompute an isPalindrome DP table so each cut test is O(1).' },
    { name: 'Restore IP Addresses', difficulty: 'Medium', url: 'https://leetcode.com/problems/restore-ip-addresses/', pattern: 'Partitioning', insight: 'Exactly four segments, each 1–3 digits, ≤ 255, no leading zeros.' },
    { name: 'Target Sum', difficulty: 'Medium', url: 'https://leetcode.com/problems/target-sum/', pattern: 'Backtracking → DP', insight: 'Brute force is 2ⁿ; memoising on (index, runningSum) makes it polynomial.' },
    { name: 'Partition to K Equal Sum Subsets', difficulty: 'Medium', url: 'https://leetcode.com/problems/partition-to-k-equal-sum-subsets/', pattern: 'Backtracking with heavy pruning', insight: 'Sort descending, skip equal-value siblings, and abandon a bucket that fails while empty.' },
    { name: 'Subsets Sum / Beautiful Arrangement', difficulty: 'Medium', url: 'https://leetcode.com/problems/beautiful-arrangement/', pattern: 'Backtracking + bitmask memo', insight: 'The used-set is a bitmask, which makes memoisation possible.' },
    { name: 'N-Queens', difficulty: 'Hard', url: 'https://leetcode.com/problems/n-queens/', pattern: 'Constraint backtracking', insight: 'Three boolean arrays (column, diagonal, anti-diagonal) reduce validity to O(1).' },
    { name: 'Sudoku Solver', difficulty: 'Hard', url: 'https://leetcode.com/problems/sudoku-solver/', pattern: 'Constraint backtracking', insight: 'Return a boolean so the first complete solution unwinds the whole stack.' },
    { name: 'Word Search II', difficulty: 'Hard', url: 'https://leetcode.com/problems/word-search-ii/', pattern: 'Trie + backtracking', insight: 'Walk the trie alongside the grid DFS; prune whole branches when the prefix has no words.' },
    { name: 'Word Break II', difficulty: 'Hard', url: 'https://leetcode.com/problems/word-break-ii/', pattern: 'Partitioning + memo', insight: 'Memoise suffix → list of sentences, or you re-explode on adversarial inputs.' },
    { name: 'Expression Add Operators', difficulty: 'Hard', url: 'https://leetcode.com/problems/expression-add-operators/', pattern: 'Backtracking with state', insight: 'Carry both the running value and the last multiplicand so that * can be applied retroactively.' },
  ],
}
