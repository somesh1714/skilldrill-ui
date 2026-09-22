export default {
  id: 'trees',
  title: 'Binary Trees & Binary Search Trees',
  short: 'Trees',
  icon: 'AccountTreeRounded',
  tier: 'Core',
  order: 11,
  estHours: 16,
  prereqs: ['recursion'],
  tagline: 'Four traversals, one recursion contract, and the BST invariant. That is the whole subject.',
  mentalModel:
    'Every tree problem is answered by one question: **what does each node need from its children, and what does it pass up?** Write that as a return type, and the recursion is already done.',
  whyItMatters:
    'Trees are where recursion becomes natural and where interviewers can test depth cheaply. The traversal templates here reappear verbatim in graphs, tries and segment trees.',

  complexity: [
    { op: 'Traversal (any order)', time: 'O(n)', space: 'O(h)', note: 'h = height; O(n) worst, O(log n) balanced' },
    { op: 'BST search / insert / delete', time: 'O(h)', space: 'O(h)', note: 'O(log n) balanced, O(n) degenerate' },
    { op: 'Balanced BST (TreeMap)', time: 'O(log n)', space: 'O(n)', note: 'Red-black tree, guaranteed' },
    { op: 'Level-order (BFS)', time: 'O(n)', space: 'O(w)', note: 'w = maximum width' },
    { op: 'Lowest common ancestor (recursive)', time: 'O(n)', space: 'O(h)', note: 'O(log n) in a BST' },
    { op: 'Serialize / deserialize', time: 'O(n)', space: 'O(n)', note: 'Preorder with null markers' },
    { op: 'Morris traversal', time: 'O(n)', space: 'O(1)', note: 'Threads the tree temporarily' },
  ],

  sections: [
    {
      id: 'traversals',
      title: 'The four traversals',
      blocks: [
        {
          t: 'ascii',
          caption: 'One tree, four orders. Know what each is good for.',
          code: `
            1
          /   \\
         2      3
        / \\    /
       4   5  6

  Preorder   (root, L, R):  1 2 4 5 3 6     copy/serialize a tree
  Inorder    (L, root, R):  4 2 5 1 6 3     SORTED order in a BST
  Postorder  (L, R, root):  4 5 2 6 3 1     delete/compute from children up
  Level-order (BFS):        1 2 3 4 5 6     shortest path, per-level answers`,
        },
        {
          t: 'table',
          head: ['Traversal', 'Reach for it when…'],
          rows: [
            ['**Preorder**', 'You need to process a node *before* its subtrees: serialisation, cloning, path-building from the root down.'],
            ['**Inorder**', 'The tree is a BST and you need sorted order: validate BST, k-th smallest, convert to a list.'],
            ['**Postorder**', 'A node’s answer depends on its children: height, diameter, balance checks, subtree sums, deletion.'],
            ['**Level-order**', 'The answer is per-level or is a shortest distance: right-side view, zigzag, minimum depth, level averages.'],
          ],
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'Recursive traversals — the difference is one line’s position',
          code: `
void preorder(TreeNode n, List<Integer> out) {
    if (n == null) return;
    out.add(n.val);                  // <- visit here
    preorder(n.left, out);
    preorder(n.right, out);
}

void inorder(TreeNode n, List<Integer> out) {
    if (n == null) return;
    inorder(n.left, out);
    out.add(n.val);                  // <- or here
    inorder(n.right, out);
}

void postorder(TreeNode n, List<Integer> out) {
    if (n == null) return;
    postorder(n.left, out);
    postorder(n.right, out);
    out.add(n.val);                  // <- or here
}`,
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'Iterative inorder — the one iterative traversal you should know cold',
          code: `
List<Integer> inorderIterative(TreeNode root) {
    List<Integer> out = new ArrayList<>();
    Deque<TreeNode> st = new ArrayDeque<>();
    TreeNode cur = root;

    while (cur != null || !st.isEmpty()) {
        while (cur != null) { st.push(cur); cur = cur.left; }  // dive left
        cur = st.pop();
        out.add(cur.val);                                       // visit
        cur = cur.right;                                        // go right
    }
    return out;
}`,
        },
        {
          t: 'tip',
          title: 'Iterative postorder, the lazy way',
          text: 'Do a modified preorder visiting **root, right, left**, then reverse the result. That is postorder. It is far easier to write correctly under pressure than the two-stack or last-visited-pointer versions.',
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'Level-order BFS — the `size` snapshot is what separates levels',
          code: `
List<List<Integer>> levelOrder(TreeNode root) {
    List<List<Integer>> out = new ArrayList<>();
    if (root == null) return out;

    Queue<TreeNode> q = new ArrayDeque<>();
    q.offer(root);

    while (!q.isEmpty()) {
        int size = q.size();                 // snapshot BEFORE adding children
        List<Integer> level = new ArrayList<>(size);
        for (int i = 0; i < size; i++) {
            TreeNode n = q.poll();
            level.add(n.val);
            if (n.left  != null) q.offer(n.left);
            if (n.right != null) q.offer(n.right);
        }
        out.add(level);
    }
    return out;
}`,
        },
        {
          t: 'key',
          title: 'The size snapshot',
          text: '`int size = q.size()` taken *before* the inner loop is what turns a flat BFS into a level-by-level BFS. Nearly every "per level" problem — right side view, zigzag, level averages, maximum width — is this loop with a different body.',
        },
      ],
    },
    {
      id: 'recursion-contract',
      title: 'The contract pattern — what each node returns',
      blocks: [
        { t: 'lead', text: 'Almost every non-trivial tree problem is solved by deciding what value flows *up* the tree.' },
        {
          t: 'table',
          head: ['Problem', 'Each node returns…', 'Global state'],
          rows: [
            ['Maximum depth', 'height of its subtree', 'none'],
            ['Diameter', 'height of its subtree', 'best path length seen'],
            ['Balanced?', 'height, or −1 as a failure flag', 'none'],
            ['Maximum path sum', 'best *downward* path through it', 'best full path seen'],
            ['Count univalue subtrees', 'whether its subtree is univalue', 'counter'],
            ['Validate BST', 'min and max of the subtree (or use bounds)', 'none'],
            ['Lowest common ancestor', 'the LCA, or a found node, or null', 'none'],
            ['House Robber III', 'a pair {rob this, skip this}', 'none'],
          ],
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'Diameter — the archetype: return one thing, record another',
          code: `
int best = 0;

int diameterOfBinaryTree(TreeNode root) { height(root); return best; }

int height(TreeNode n) {
    if (n == null) return 0;
    int l = height(n.left), r = height(n.right);
    best = Math.max(best, l + r);      // RECORD: path THROUGH this node
    return 1 + Math.max(l, r);         // RETURN: path going DOWN from this node
}`,
        },
        {
          t: 'key',
          title: 'Return down, record through',
          text: 'A node can only hand its parent a path that goes *down one side*. But the best answer overall may bend at this node and use *both* sides. Keeping those two quantities separate — one returned, one recorded in a field — solves Diameter, Maximum Path Sum, Longest ZigZag and Longest Univalue Path with the same skeleton.',
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'Binary Tree Maximum Path Sum — same skeleton, with a clamp at zero',
          code: `
int best = Integer.MIN_VALUE;

int maxPathSum(TreeNode root) { gain(root); return best; }

int gain(TreeNode n) {
    if (n == null) return 0;
    int l = Math.max(gain(n.left),  0);    // a negative branch is worth skipping
    int r = Math.max(gain(n.right), 0);
    best = Math.max(best, n.val + l + r);  // path bending at n
    return n.val + Math.max(l, r);         // path continuing upward
}`,
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'Balanced Binary Tree — encode failure in the return value to stay O(n)',
          code: `
boolean isBalanced(TreeNode root) { return check(root) != -1; }

int check(TreeNode n) {
    if (n == null) return 0;
    int l = check(n.left);   if (l == -1) return -1;    // short-circuit
    int r = check(n.right);  if (r == -1) return -1;
    if (Math.abs(l - r) > 1) return -1;
    return 1 + Math.max(l, r);
}
// Calling height() inside isBalanced() at every node would be O(n^2).`,
        },
      ],
    },
    {
      id: 'bst',
      title: 'Binary search trees',
      blocks: [
        { t: 'p', text: 'The BST invariant: **every** value in the left subtree is less than the node, and **every** value in the right subtree is greater. Note "every" — not just the immediate children. That distinction is the entire Validate-BST question.' },
        {
          t: 'ascii',
          caption: 'The classic wrong answer: locally valid, globally broken.',
          code: `
        10
       /  \\
      5    15
          /  \\
         6    20      <- 6 < 10, so it must NOT be in the right subtree

  Checking only parent-child pairs says "valid". It is not.
  Inorder traversal gives 5 10 6 15 20 — not sorted. Caught.`,
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'Two correct validations: bounds passing, and inorder monotonicity',
          code: `
// (a) Pass down the allowed range. Use Long (or null) to avoid MIN/MAX edge cases.
boolean isValidBST(TreeNode n, long lo, long hi) {
    if (n == null) return true;
    if (n.val <= lo || n.val >= hi) return false;
    return isValidBST(n.left, lo, n.val) && isValidBST(n.right, n.val, hi);
}
// call: isValidBST(root, Long.MIN_VALUE, Long.MAX_VALUE)

// (b) Inorder must be strictly increasing.
Integer prev = null;
boolean inorderCheck(TreeNode n) {
    if (n == null) return true;
    if (!inorderCheck(n.left)) return false;
    if (prev != null && n.val <= prev) return false;
    prev = n.val;
    return inorderCheck(n.right);
}`,
        },
        {
          t: 'trap',
          title: 'Integer.MIN_VALUE as a sentinel',
          text: 'If the tree legitimately contains `Integer.MIN_VALUE`, using it as the initial lower bound rejects a valid tree. Use `long`, or nullable `Integer` bounds. Interviewers plant this test case deliberately.',
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'BST delete — the only tricky case is a node with two children',
          code: `
TreeNode deleteNode(TreeNode root, int key) {
    if (root == null) return null;

    if (key < root.val)      root.left  = deleteNode(root.left, key);
    else if (key > root.val) root.right = deleteNode(root.right, key);
    else {
        if (root.left == null)  return root.right;   // 0 or 1 child
        if (root.right == null) return root.left;

        TreeNode succ = root.right;                  // inorder successor
        while (succ.left != null) succ = succ.left;  // smallest in right subtree
        root.val = succ.val;                         // copy its value up
        root.right = deleteNode(root.right, succ.val);  // delete the successor
    }
    return root;
}`,
        },
        {
          t: 'tip',
          title: 'BST superpowers to exploit',
          text: '**Inorder is sorted** — so k-th smallest is an inorder walk with a counter, and "two sum in a BST" can use two iterators. **Search prunes** — LCA in a BST is just "walk down until the two targets split". **Range queries** — you can skip entire subtrees whose range cannot contain the answer.',
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'LCA in a BST — O(h) with no recursion into both sides',
          code: `
TreeNode lca(TreeNode root, TreeNode p, TreeNode q) {
    while (root != null) {
        if (p.val < root.val && q.val < root.val)      root = root.left;
        else if (p.val > root.val && q.val > root.val) root = root.right;
        else return root;      // they split here — this is the LCA
    }
    return null;
}`,
        },
      ],
    },
    {
      id: 'lca-paths',
      title: 'LCA and path problems in a general binary tree',
      blocks: [
        {
          t: 'code',
          lang: 'java',
          caption: 'LCA in a plain binary tree — the elegant three-liner',
          code: `
TreeNode lowestCommonAncestor(TreeNode root, TreeNode p, TreeNode q) {
    if (root == null || root == p || root == q) return root;
    TreeNode l = lowestCommonAncestor(root.left,  p, q);
    TreeNode r = lowestCommonAncestor(root.right, p, q);
    if (l != null && r != null) return root;   // p and q split here
    return (l != null) ? l : r;                // both on one side (or neither)
}`,
        },
        {
          t: 'note',
          title: 'Read the contract carefully',
          text: 'This function returns "`p` or `q` if found, otherwise the LCA if both are below, otherwise null". It works because the problem guarantees both nodes exist. If they might not, you need an extra pass to confirm presence — a classic follow-up.',
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'Path Sum III — prefix sums applied to a tree',
          code: `
Map<Long,Integer> prefixCount = new HashMap<>();
int target, answer = 0;

int pathSum(TreeNode root, int targetSum) {
    target = targetSum;
    prefixCount.put(0L, 1);         // the empty prefix, exactly as in arrays
    dfs(root, 0L);
    return answer;
}

void dfs(TreeNode n, long running) {
    if (n == null) return;
    running += n.val;
    answer += prefixCount.getOrDefault(running - target, 0);

    prefixCount.merge(running, 1, Integer::sum);
    dfs(n.left, running);
    dfs(n.right, running);
    prefixCount.merge(running, -1, Integer::sum);   // BACKTRACK on the way out
}`,
        },
        {
          t: 'key',
          title: 'Prefix sums work on trees too',
          text: 'The root-to-node path is a "prefix". The only addition versus arrays is that you must **remove your own contribution when leaving the node**, otherwise counts leak across sibling branches. That single `merge(..., -1, ...)` line is the whole difficulty of this Medium.',
        },
      ],
    },
    {
      id: 'construction',
      title: 'Construction, serialisation and views',
      blocks: [
        {
          t: 'code',
          lang: 'java',
          caption: 'Serialize / Deserialize — preorder with explicit null markers',
          code: `
String serialize(TreeNode root) {
    StringBuilder sb = new StringBuilder();
    build(root, sb);
    return sb.toString();
}
void build(TreeNode n, StringBuilder sb) {
    if (n == null) { sb.append("#,"); return; }      // null marker is essential
    sb.append(n.val).append(',');
    build(n.left, sb);
    build(n.right, sb);
}

TreeNode deserialize(String data) {
    return parse(new ArrayDeque<>(Arrays.asList(data.split(","))));
}
TreeNode parse(Deque<String> tokens) {
    String t = tokens.poll();
    if (t.equals("#")) return null;
    TreeNode n = new TreeNode(Integer.parseInt(t));
    n.left  = parse(tokens);
    n.right = parse(tokens);
    return n;
}`,
        },
        {
          t: 'trap',
          title: 'Why null markers are required',
          text: 'Preorder alone is ambiguous — `[1,2]` could be a left child or a right child. Null markers make the encoding unique. Alternatively, preorder + inorder together determine the tree, *provided values are distinct*. Say that caveat out loud.',
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'Right Side View — BFS taking the last node of each level',
          code: `
List<Integer> rightSideView(TreeNode root) {
    List<Integer> out = new ArrayList<>();
    if (root == null) return out;
    Queue<TreeNode> q = new ArrayDeque<>(); q.offer(root);

    while (!q.isEmpty()) {
        int size = q.size();
        for (int i = 0; i < size; i++) {
            TreeNode n = q.poll();
            if (i == size - 1) out.add(n.val);      // last node on this level
            if (n.left  != null) q.offer(n.left);
            if (n.right != null) q.offer(n.right);
        }
    }
    return out;
}`,
        },
        {
          t: 'tip',
          title: 'Vertical order needs a column index',
          text: 'For vertical traversal, DFS/BFS carrying `(row, col)` where left is `col − 1` and right is `col + 1`. Collect into a `TreeMap<Integer, List<int[]>>` keyed by column, then sort each column by row and then by value. BFS gives you row order for free.',
        },
      ],
    },
  ],

  patterns: [
    {
      id: 'dfs-contract',
      name: 'Post-order Contract (bottom-up DFS)',
      oneLiner: 'Each node computes its answer from its children’s answers and hands one value up.',
      useWhen: ['Height, depth, diameter, balance, subtree sums, subtree validity, tree DP.'],
      recognize: ['The answer at a node depends on its subtrees, not on its ancestors.'],
      steps: [
        'Decide exactly what the recursive call returns (the contract).',
        'Handle `null` as the identity value.',
        'Combine children; if the global answer differs from the returned value, record it in a field.',
      ],
      template: {
        lang: 'java',
        caption: 'Return down / record through — the reusable skeleton',
        code: `
int best;                       // the global answer

int dfs(TreeNode n) {
    if (n == null) return IDENTITY;
    int l = dfs(n.left), r = dfs(n.right);

    best = combineThrough(best, l, r, n);   // answer that BENDS at n
    return combineUp(l, r, n);              // answer that CONTINUES upward
}`,
      },
      complexity: 'O(n) time, O(h) space.',
      gotchas: [
        'Do not call a helper (like `height`) inside the recursion — that makes it O(n²). Fold it into the single pass.',
        'Clamp negative contributions with `Math.max(x, 0)` in sum problems.',
      ],
      problems: ['Maximum Depth of Binary Tree', 'Diameter of Binary Tree', 'Balanced Binary Tree', 'Binary Tree Maximum Path Sum', 'House Robber III', 'Count Good Nodes in Binary Tree'],
    },
    {
      id: 'top-down-dfs',
      name: 'Top-down DFS (pass state down)',
      oneLiner: 'Carry the ancestors’ information into the child call.',
      useWhen: ['Root-to-leaf paths, bounds checking, depth tracking, path sums.'],
      recognize: ['The validity or value at a node depends on what came *above* it.'],
      steps: ['Add parameters for the inherited state (bounds, running sum, current path).', 'Update on the way down.', 'If you carry a mutable path, remove the node on the way out.'],
      template: {
        lang: 'java',
        caption: 'Path collection with proper backtracking',
        code: `
void dfs(TreeNode n, int remaining, List<Integer> path, List<List<Integer>> out) {
    if (n == null) return;
    path.add(n.val);
    remaining -= n.val;

    if (n.left == null && n.right == null && remaining == 0)
        out.add(new ArrayList<>(path));          // copy at a LEAF
    else {
        dfs(n.left,  remaining, path, out);
        dfs(n.right, remaining, path, out);
    }
    path.remove(path.size() - 1);                // backtrack
}`,
      },
      complexity: 'O(n) nodes; O(n·h) if you copy paths.',
      gotchas: [
        'A leaf is `left == null && right == null`. A node with one child is **not** a leaf — this breaks Minimum Depth if you forget.',
        'Remove from the path on the way out, in all branches.',
      ],
      problems: ['Path Sum', 'Path Sum II', 'Validate Binary Search Tree', 'Sum Root to Leaf Numbers', 'Binary Tree Paths'],
    },
    {
      id: 'bfs-levels',
      name: 'Level-Order BFS',
      oneLiner: 'Process the queue one full level at a time using a size snapshot.',
      useWhen: ['Per-level aggregates, views, minimum depth, zigzag, connecting level pointers.'],
      recognize: ['"Level", "row", "each depth", "closest/minimum number of steps".'],
      steps: ['Enqueue the root.', 'Loop while non-empty; snapshot `size` and process exactly that many nodes.', 'Enqueue children as you go.'],
      complexity: 'O(n) time, O(w) space where w is the maximum width.',
      gotchas: ['Snapshot the size before the inner loop.', 'Guard against a null root.', 'For zigzag, reverse alternate levels (or use `addFirst` on a deque).'],
      problems: ['Binary Tree Level Order Traversal', 'Binary Tree Zigzag Level Order Traversal', 'Binary Tree Right Side View', 'Minimum Depth of Binary Tree', 'Average of Levels in Binary Tree', 'Populating Next Right Pointers in Each Node'],
    },
    {
      id: 'bst-inorder',
      name: 'BST Inorder Exploitation',
      oneLiner: 'An inorder walk of a BST is a sorted stream — use it.',
      useWhen: ['K-th smallest, validate BST, recover a swapped BST, two-sum in a BST, mode finding.'],
      recognize: ['"BST" plus anything about order, rank, or sorted output.'],
      steps: ['Walk inorder.', 'Keep a `prev` pointer or a counter.', 'Stop early once the answer is determined.'],
      template: {
        lang: 'java',
        caption: 'K-th smallest with early exit',
        code: `
int count, answer;

int kthSmallest(TreeNode root, int k) { count = k; inorder(root); return answer; }

void inorder(TreeNode n) {
    if (n == null || count == 0) return;
    inorder(n.left);
    if (--count == 0) { answer = n.val; return; }
    inorder(n.right);
}
// Follow-up "what if the BST is modified often?" -> store subtree sizes in each
// node, then k-th smallest becomes an O(h) descent.`,
      },
      complexity: 'O(h + k) with early exit; O(n) worst case.',
      gotchas: ['Use `long` or nullable bounds when validating, to survive `Integer.MIN_VALUE` values.', 'Recover BST: the two swapped nodes are found at the first and last inorder descents.'],
      problems: ['Kth Smallest Element in a BST', 'Validate Binary Search Tree', 'Recover Binary Search Tree', 'Convert BST to Greater Tree', 'Minimum Absolute Difference in BST'],
    },
    {
      id: 'tree-construct',
      name: 'Construction from Traversals',
      oneLiner: 'One traversal supplies the roots; the other supplies the split points.',
      useWhen: ['Build a tree from preorder+inorder, postorder+inorder, or a sorted array.'],
      recognize: ['"Construct binary tree from …".'],
      steps: [
        'Preorder gives roots front-to-back; postorder gives them back-to-front.',
        'Index the inorder array in a hash map so locating the root is O(1).',
        'Recurse into the correct side first — left for preorder, right for postorder.',
      ],
      complexity: 'O(n) with the hash map; O(n²) without it.',
      gotchas: ['Requires distinct values.', 'Preorder + postorder alone does **not** uniquely determine a tree.'],
      problems: ['Construct Binary Tree from Preorder and Inorder Traversal', 'Construct Binary Tree from Inorder and Postorder Traversal', 'Convert Sorted Array to Binary Search Tree', 'Serialize and Deserialize Binary Tree'],
    },
  ],

  pitfalls: [
    { title: 'Forgetting the null base case', text: 'Every recursive tree function starts with `if (node == null)`.' },
    { title: 'Treating a one-child node as a leaf', text: 'Minimum Depth is wrong unless you require both children to be null.' },
    { title: 'Validating BST with parent-child comparisons only', text: 'Needs subtree-wide bounds or an inorder check.' },
    { title: 'Recomputing height inside a recursion', text: 'Turns O(n) into O(n²). Fold it into a single pass.' },
    { title: 'Not backtracking mutable state', text: 'Paths and prefix-count maps must be unwound when leaving a node.' },
    { title: 'Using Integer.MIN_VALUE as a bound sentinel', text: 'Breaks on trees that actually contain it.' },
    { title: 'Ignoring stack depth on skewed trees', text: 'A 10⁵-node degenerate tree overflows. Mention the iterative alternative.' },
  ],

  cheatsheet: [
    { label: 'Inorder on a BST', value: 'gives sorted order' },
    { label: 'Need child answers', value: 'post-order' },
    { label: 'Need ancestor state', value: 'pass it down (pre-order)' },
    { label: 'Per-level answer', value: 'BFS + size snapshot' },
    { label: 'Diameter / max path', value: 'return down, record through' },
    { label: 'Balanced check', value: 'return −1 as a failure flag' },
    { label: 'LCA (binary tree)', value: 'both sides non-null ⇒ here' },
    { label: 'LCA (BST)', value: 'descend until the values split' },
    { label: 'Serialize', value: 'preorder with # null markers' },
    { label: 'Path count = k', value: 'prefix-sum map + unwind' },
    { label: 'Leaf', value: 'left == null && right == null' },
    { label: 'Space', value: 'O(h): log n balanced, n skewed' },
  ],

  problems: [
    { name: 'Maximum Depth of Binary Tree', difficulty: 'Easy', url: 'https://leetcode.com/problems/maximum-depth-of-binary-tree/', pattern: 'Post-order', insight: 'The simplest possible recursive contract.' },
    { name: 'Same Tree', difficulty: 'Easy', url: 'https://leetcode.com/problems/same-tree/', pattern: 'Parallel recursion', insight: 'Recurse on both trees together; null-null is true, null-node is false.' },
    { name: 'Invert Binary Tree', difficulty: 'Easy', url: 'https://leetcode.com/problems/invert-binary-tree/', pattern: 'Post-order', insight: 'Swap children after recursing — or before; both work.' },
    { name: 'Symmetric Tree', difficulty: 'Easy', url: 'https://leetcode.com/problems/symmetric-tree/', pattern: 'Mirror recursion', insight: 'Compare left.left with right.right and left.right with right.left.' },
    { name: 'Balanced Binary Tree', difficulty: 'Easy', url: 'https://leetcode.com/problems/balanced-binary-tree/', pattern: 'Post-order with flag', insight: 'Return −1 to short-circuit and keep it O(n).' },
    { name: 'Diameter of Binary Tree', difficulty: 'Easy', url: 'https://leetcode.com/problems/diameter-of-binary-tree/', pattern: 'Return down, record through', insight: 'The template for every "path that bends at a node" problem.' },
    { name: 'Path Sum', difficulty: 'Easy', url: 'https://leetcode.com/problems/path-sum/', pattern: 'Top-down', insight: 'Subtract as you descend; check the remainder at a true leaf.' },
    { name: 'Minimum Depth of Binary Tree', difficulty: 'Easy', url: 'https://leetcode.com/problems/minimum-depth-of-binary-tree/', pattern: 'BFS', insight: 'BFS returns at the first leaf; recursion must special-case one-child nodes.' },
    { name: 'Merge Two Binary Trees', difficulty: 'Easy', url: 'https://leetcode.com/problems/merge-two-binary-trees/', pattern: 'Parallel recursion', insight: 'If either node is null, return the other.' },
    { name: 'Subtree of Another Tree', difficulty: 'Easy', url: 'https://leetcode.com/problems/subtree-of-another-tree/', pattern: 'Nested recursion', insight: 'O(m·n) naively; the serialise-and-substring-search trick makes it near-linear.' },
    { name: 'Binary Tree Level Order Traversal', difficulty: 'Medium', url: 'https://leetcode.com/problems/binary-tree-level-order-traversal/', pattern: 'BFS levels', insight: 'The size snapshot is the whole technique.' },
    { name: 'Binary Tree Zigzag Level Order Traversal', difficulty: 'Medium', url: 'https://leetcode.com/problems/binary-tree-zigzag-level-order-traversal/', pattern: 'BFS levels', insight: 'Use `addFirst` on alternate levels instead of reversing.' },
    { name: 'Binary Tree Right Side View', difficulty: 'Medium', url: 'https://leetcode.com/problems/binary-tree-right-side-view/', pattern: 'BFS levels', insight: 'Take the last node of each level (or first, with right-first DFS).' },
    { name: 'Validate Binary Search Tree', difficulty: 'Medium', url: 'https://leetcode.com/problems/validate-binary-search-tree/', pattern: 'Bounds / inorder', insight: 'Subtree-wide bounds, with long or nullable sentinels.' },
    { name: 'Kth Smallest Element in a BST', difficulty: 'Medium', url: 'https://leetcode.com/problems/kth-smallest-element-in-a-bst/', pattern: 'Inorder with counter', insight: 'Early-exit inorder; the follow-up wants subtree sizes stored in nodes.' },
    { name: 'Lowest Common Ancestor of a Binary Tree', difficulty: 'Medium', url: 'https://leetcode.com/problems/lowest-common-ancestor-of-a-binary-tree/', pattern: 'Post-order', insight: 'Both sides non-null means the split happens here.' },
    { name: 'Construct Binary Tree from Preorder and Inorder Traversal', difficulty: 'Medium', url: 'https://leetcode.com/problems/construct-binary-tree-from-preorder-and-inorder-traversal/', pattern: 'Divide and conquer', insight: 'Hash the inorder indices; build left before right.' },
    { name: 'Path Sum II', difficulty: 'Medium', url: 'https://leetcode.com/problems/path-sum-ii/', pattern: 'Top-down + backtracking', insight: 'Copy the path at a leaf and always pop on the way out.' },
    { name: 'Path Sum III', difficulty: 'Medium', url: 'https://leetcode.com/problems/path-sum-iii/', pattern: 'Prefix sums on a tree', insight: 'Decrement the prefix count when leaving a node or counts leak between branches.' },
    { name: 'Flatten Binary Tree to Linked List', difficulty: 'Medium', url: 'https://leetcode.com/problems/flatten-binary-tree-to-linked-list/', pattern: 'Reverse post-order', insight: 'Traverse right-left-root keeping a `prev` pointer, or use Morris-style rewiring for O(1) space.' },
    { name: 'Count Good Nodes in Binary Tree', difficulty: 'Medium', url: 'https://leetcode.com/problems/count-good-nodes-in-binary-tree/', pattern: 'Top-down', insight: 'Carry the maximum seen on the path down.' },
    { name: 'House Robber III', difficulty: 'Medium', url: 'https://leetcode.com/problems/house-robber-iii/', pattern: 'Tree DP', insight: 'Each node returns a pair {robbed, skipped} — the cleanest introduction to tree DP.' },
    { name: 'Populating Next Right Pointers in Each Node', difficulty: 'Medium', url: 'https://leetcode.com/problems/populating-next-right-pointers-in-each-node/', pattern: 'BFS / level linking', insight: 'The O(1)-space version uses the already-built next pointers of the level above.' },
    { name: 'Binary Tree Vertical Order Traversal', difficulty: 'Medium', url: 'https://leetcode.com/problems/binary-tree-vertical-order-traversal/', pattern: 'BFS with column index', insight: 'BFS keeps row order automatically; bucket by column in a TreeMap.' },
    { name: 'Delete Node in a BST', difficulty: 'Medium', url: 'https://leetcode.com/problems/delete-node-in-a-bst/', pattern: 'BST surgery', insight: 'Two-children case: copy the inorder successor up, then delete it below.' },
    { name: 'Binary Tree Maximum Path Sum', difficulty: 'Hard', url: 'https://leetcode.com/problems/binary-tree-maximum-path-sum/', pattern: 'Return down, record through', insight: 'Clamp negative branch gains to zero.' },
    { name: 'Serialize and Deserialize Binary Tree', difficulty: 'Hard', url: 'https://leetcode.com/problems/serialize-and-deserialize-binary-tree/', pattern: 'Preorder + markers', insight: 'Null markers make the encoding unambiguous.' },
    { name: 'Binary Tree Cameras', difficulty: 'Hard', url: 'https://leetcode.com/problems/binary-tree-cameras/', pattern: 'Greedy tree DP', insight: 'Three states per node (uncovered, covered, has-camera); place cameras at parents of uncovered leaves.' },
    { name: 'Vertical Order Traversal of a Binary Tree', difficulty: 'Hard', url: 'https://leetcode.com/problems/vertical-order-traversal-of-a-binary-tree/', pattern: 'DFS with (row, col) + sort', insight: 'Ties are broken by value, not by traversal order — that is what makes it Hard.' },
  ],
}
