export default {
  id: 'stacks-queues',
  title: 'Stacks, Queues & Monotonic Structures',
  short: 'Stacks & Queues',
  icon: 'LayersRounded',
  tier: 'Core',
  order: 9,
  estHours: 10,
  prereqs: ['arrays'],
  tagline: 'A stack remembers what is still unresolved. That one sentence solves an entire class of Hard problems.',
  mentalModel:
    'A stack holds **pending obligations** — things you have seen but cannot answer yet. The moment an element resolves an obligation, you pop it and record the answer. A monotonic stack is that idea with the extra rule that the pending items are kept in sorted order.',
  whyItMatters:
    'Monotonic stacks convert a whole family of "next greater / previous smaller / largest rectangle" problems from `O(n²)` to `O(n)`. They look like magic until you see the obligation framing, and then they become mechanical.',

  complexity: [
    { op: 'Stack push / pop / peek', time: 'O(1)', space: 'O(n)', note: 'Use `ArrayDeque`, not `Stack`' },
    { op: 'Queue offer / poll', time: 'O(1)', space: 'O(n)', note: '`ArrayDeque` or `LinkedList`' },
    { op: 'Deque operations (both ends)', time: 'O(1)', space: 'O(n)', note: 'The basis of sliding-window min/max' },
    { op: 'Monotonic stack sweep', time: 'O(n)', space: 'O(n)', note: 'Each index pushed once, popped once' },
    { op: 'Monotonic deque sweep', time: 'O(n)', space: 'O(k)', note: 'Window extremes in O(1) amortised' },
    { op: 'Min stack (get min)', time: 'O(1)', space: 'O(n)', note: 'Store the running min alongside each value' },
    { op: 'Queue via two stacks', time: 'O(1) amortised', space: 'O(n)', note: 'Each element moves between stacks once' },
  ],

  sections: [
    {
      id: 'basics',
      title: 'The Java reality check',
      blocks: [
        {
          t: 'warn',
          title: 'Do not use `java.util.Stack`',
          text: 'It extends `Vector`, so every method is synchronised, and — worse — its iteration order is bottom-to-top, the opposite of what you expect from a stack. Use `ArrayDeque`, which is faster and behaves correctly. Also avoid `LinkedList` as a stack: it allocates a node per element.',
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'The one class you need for stacks, queues and deques',
          code: `
Deque<Integer> stack = new ArrayDeque<>();
stack.push(x);        // addFirst
stack.pop();          // removeFirst  (throws if empty)
stack.peek();         // peekFirst    (null if empty)
stack.isEmpty();

Deque<Integer> queue = new ArrayDeque<>();
queue.offer(x);       // addLast
queue.poll();         // removeFirst  (null if empty)
queue.peek();         // peekFirst

Deque<Integer> dq = new ArrayDeque<>();
dq.offerFirst(x); dq.offerLast(x);
dq.pollFirst();   dq.pollLast();
dq.peekFirst();   dq.peekLast();`,
        },
        {
          t: 'note',
          title: '`ArrayDeque` cannot hold null',
          text: 'It throws `NullPointerException` on `offer(null)`. That is usually a feature — it means `poll()` returning `null` unambiguously signals "empty". If you genuinely need nulls, use `LinkedList`.',
        },
      ],
    },
    {
      id: 'matching',
      title: 'Stacks for nesting and matching',
      blocks: [
        { t: 'p', text: 'Whenever structure is **nested**, the most recently opened thing must close first. That is precisely LIFO.' },
        {
          t: 'code',
          lang: 'java',
          caption: 'Valid Parentheses — push the expected closer, not the opener',
          code: `
boolean isValid(String s) {
    Deque<Character> st = new ArrayDeque<>();
    for (char c : s.toCharArray()) {
        switch (c) {
            case '(' -> st.push(')');       // push what we EXPECT to see next
            case '[' -> st.push(']');
            case '{' -> st.push('}');
            default  -> { if (st.isEmpty() || st.pop() != c) return false; }
        }
    }
    return st.isEmpty();                     // nothing left unclosed
}`,
        },
        {
          t: 'tip',
          title: 'Push the expectation',
          text: 'Pushing the matching closer instead of the opener removes the whole `if (pair(top) != c)` lookup table. Small, but it reads better and there is less to get wrong.',
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'Longest Valid Parentheses — indices on the stack, with a base marker',
          code: `
int longestValidParentheses(String s) {
    Deque<Integer> st = new ArrayDeque<>();
    st.push(-1);                    // sentinel: the index just before a valid run
    int best = 0;

    for (int i = 0; i < s.length(); i++) {
        if (s.charAt(i) == '(') {
            st.push(i);
        } else {
            st.pop();
            if (st.isEmpty()) st.push(i);                 // new base for future runs
            else best = Math.max(best, i - st.peek());    // length since the base
        }
    }
    return best;
}`,
        },
        {
          t: 'key',
          title: 'The sentinel index trick',
          text: 'Pushing `-1` means "the last position where the string became unbalanced". Lengths are then always `i − stack.peek()`, with no special case for a run that starts at index 0. The same idea reappears in histogram problems.',
        },
      ],
    },
    {
      id: 'monotonic-stack',
      title: 'Monotonic stacks — the big one',
      blocks: [
        { t: 'lead', text: 'If you learn one thing from this chapter, learn this. It turns a whole family of quadratic problems linear.' },
        { t: 'p', text: 'A **monotonic stack** keeps its elements in sorted order (increasing or decreasing) as you sweep the array. Before pushing `a[i]`, you pop everything that violates the order — and *each pop is an answered question*.' },
        {
          t: 'ascii',
          caption: 'Next Greater Element: the stack holds indices still waiting for a bigger value.',
          code: `
 a = [ 2, 1, 2, 4, 3 ]

 i=0  push 0                stack(values): [2]          pending: 2
 i=1  1 < 2, push 1         stack: [2,1]                pending: 2,1
 i=2  2 > 1 -> pop 1, ans[1]=2
      2 == 2, push 2        stack: [2,2]
 i=3  4 > 2 -> pop, ans[2]=4
      4 > 2 -> pop, ans[0]=4
      push 3                stack: [4]
 i=4  3 < 4, push 4         stack: [4,3]

 leftovers have no greater element  ->  -1`,
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'The four variants — memorise the direction table, not four functions',
          code: `
// NEXT GREATER (strict): sweep LEFT->RIGHT, pop while a[stack.peek()] <= a[i]
// stack values are DECREASING
int[] nextGreater(int[] a) {
    int n = a.length; int[] res = new int[n]; Arrays.fill(res, -1);
    Deque<Integer> st = new ArrayDeque<>();
    for (int i = 0; i < n; i++) {
        while (!st.isEmpty() && a[st.peek()] < a[i]) res[st.pop()] = a[i];
        st.push(i);
    }
    return res;
}

// PREVIOUS SMALLER: sweep LEFT->RIGHT, pop while a[stack.peek()] >= a[i]
// stack values are INCREASING; after popping, the top IS the previous smaller
int[] previousSmaller(int[] a) {
    int n = a.length; int[] res = new int[n]; Arrays.fill(res, -1);
    Deque<Integer> st = new ArrayDeque<>();
    for (int i = 0; i < n; i++) {
        while (!st.isEmpty() && a[st.peek()] >= a[i]) st.pop();
        res[i] = st.isEmpty() ? -1 : st.peek();
        st.push(i);
    }
    return res;
}`,
        },
        {
          t: 'table',
          head: ['You want…', 'Sweep', 'Pop while', 'Stack is'],
          rows: [
            ['Next greater element', 'left → right', '`a[top] < a[i]`', 'decreasing'],
            ['Next smaller element', 'left → right', '`a[top] > a[i]`', 'increasing'],
            ['Previous greater element', 'left → right', '`a[top] <= a[i]`', 'decreasing'],
            ['Previous smaller element', 'left → right', '`a[top] >= a[i]`', 'increasing'],
          ],
          caption: '"Next" ⇒ the answer is assigned to the element being **popped**. "Previous" ⇒ the answer is whatever remains on **top** after popping.',
        },
        {
          t: 'key',
          title: 'Next = answer on pop. Previous = answer on peek.',
          text: 'That single sentence is the whole mnemonic. If you can state which of the two you need, the code writes itself.',
        },
        {
          t: 'note',
          title: 'Circular arrays',
          text: 'For "next greater element in a circular array", iterate `i` from `0` to `2n − 1` and use `a[i % n]`, pushing only while `i < n`. Two laps guarantee every element sees every candidate.',
        },
        { t: 'h', text: 'Largest Rectangle in Histogram — the masterpiece' },
        { t: 'p', text: 'For each bar, the largest rectangle with that bar as its height extends left until a shorter bar and right until a shorter bar. A monotonic increasing stack finds both boundaries in one sweep.' },
        {
          t: 'code',
          lang: 'java',
          caption: 'Largest rectangle — with the sentinel that removes the drain loop',
          code: `
int largestRectangleArea(int[] h) {
    int n = h.length, best = 0;
    Deque<Integer> st = new ArrayDeque<>();      // indices, heights INCREASING

    for (int i = 0; i <= n; i++) {
        int cur = (i == n) ? 0 : h[i];           // sentinel 0 flushes the stack
        while (!st.isEmpty() && h[st.peek()] >= cur) {
            int height = h[st.pop()];
            int left = st.isEmpty() ? -1 : st.peek();   // first shorter bar on the left
            int width = i - left - 1;                   // i is the first shorter on the right
            best = Math.max(best, height * width);
        }
        st.push(i);
    }
    return best;
}`,
        },
        {
          t: 'tip',
          title: 'Maximal Rectangle is this, once per row',
          text: 'Build a histogram of consecutive 1s ending at each row, then run the histogram algorithm on every row. `O(rows × cols)` total — and it is the standard follow-up.',
        },
        {
          t: 'trap',
          title: 'The width formula',
          text: '`width = i − left − 1`, where `left` is the index of the first strictly shorter bar on the left (or `−1`). Writing `i − left` or `i − st.peek()` is the classic off-by-one here. Derive it once on paper with a three-bar example.',
        },
      ],
    },
    {
      id: 'monotonic-deque',
      title: 'Monotonic deques — sliding window extremes',
      blocks: [
        { t: 'p', text: 'A stack answers "next greater". A **deque** answers "maximum of the current window", because you must also evict from the front when elements fall out of range.' },
        {
          t: 'code',
          lang: 'java',
          caption: 'Sliding Window Maximum — decreasing deque',
          code: `
int[] maxSlidingWindow(int[] a, int k) {
    Deque<Integer> dq = new ArrayDeque<>();     // indices; a[] values DECREASING
    int[] out = new int[a.length - k + 1];

    for (int i = 0; i < a.length; i++) {
        if (!dq.isEmpty() && dq.peekFirst() <= i - k) dq.pollFirst();   // expired
        while (!dq.isEmpty() && a[dq.peekLast()] <= a[i]) dq.pollLast(); // dominated
        dq.offerLast(i);
        if (i >= k - 1) out[i - k + 1] = a[dq.peekFirst()];
    }
    return out;
}`,
        },
        {
          t: 'key',
          title: 'Why popping from the back is safe',
          text: 'If `a[i] >= a[j]` and `i > j`, then `a[j]` can never be the maximum of any future window — because every future window containing `j` also contains `i`, which is at least as large and expires later. That is the dominance argument, and it is the answer to "why is this correct?".',
        },
        {
          t: 'note',
          title: 'Two deques for min *and* max',
          text: 'Problems like "Longest Continuous Subarray With Absolute Diff Less Than or Equal to Limit" need both window extremes. Run a decreasing deque and an increasing deque side by side; the window is valid while `maxDq.front − minDq.front <= limit`.',
        },
      ],
    },
    {
      id: 'design',
      title: 'Design problems',
      blocks: [
        {
          t: 'code',
          lang: 'java',
          caption: 'Min Stack — carry the running minimum with each entry',
          code: `
class MinStack {
    private final Deque<int[]> st = new ArrayDeque<>();   // {value, minSoFar}

    public void push(int x) {
        int min = st.isEmpty() ? x : Math.min(x, st.peek()[1]);
        st.push(new int[]{ x, min });
    }
    public void pop()    { st.pop(); }
    public int  top()    { return st.peek()[0]; }
    public int  getMin() { return st.peek()[1]; }
}`,
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'Queue from two stacks — amortised O(1)',
          code: `
class MyQueue {
    private final Deque<Integer> in = new ArrayDeque<>();
    private final Deque<Integer> out = new ArrayDeque<>();

    public void push(int x) { in.push(x); }

    public int pop() { shift(); return out.pop(); }
    public int peek() { shift(); return out.peek(); }
    public boolean empty() { return in.isEmpty() && out.isEmpty(); }

    // Only move when 'out' is empty — that is what makes it amortised O(1):
    // each element is moved from 'in' to 'out' exactly once in its lifetime.
    private void shift() {
        if (out.isEmpty()) while (!in.isEmpty()) out.push(in.pop());
    }
}`,
        },
        {
          t: 'trap',
          title: 'The guard is the whole algorithm',
          text: 'Shifting on every operation makes it `O(n)` per call. Shifting **only when `out` is empty** makes it amortised `O(1)`. Interviewers ask specifically about this.',
        },
      ],
    },
  ],

  patterns: [
    {
      id: 'bracket-stack',
      name: 'Matching / Nesting Stack',
      oneLiner: 'The most recently opened context is the first that must close.',
      useWhen: ['Brackets, tags, nested encodings, undo histories, path normalisation.'],
      recognize: ['Any grammar with matched pairs, or "the last one wins" semantics.'],
      steps: ['Push on an opening token (push the expected closer).', 'Pop and verify on a closing token.', 'Require an empty stack at the end.'],
      complexity: 'O(n) time and space.',
      gotchas: ['Check `isEmpty()` before popping.', 'For index-based length questions, push **indices** and seed with a `−1` sentinel.'],
      problems: ['Valid Parentheses', 'Min Add to Make Parentheses Valid', 'Simplify Path', 'Remove All Adjacent Duplicates In String', 'Longest Valid Parentheses'],
    },
    {
      id: 'monotonic-stack',
      name: 'Monotonic Stack',
      oneLiner: 'Keep pending elements in sorted order; every pop resolves one answer.',
      useWhen: [
        '"Next/previous greater/smaller element" for every index.',
        'Span, rectangle, and water-trapping problems.',
        'Building a lexicographically smallest/largest result by greedy removal.',
      ],
      recognize: [
        'Words: next greater, warmer day, stock span, largest rectangle, remove k digits.',
        'A nested loop where the inner loop scans forward for the first element that beats `a[i]`.',
      ],
      steps: [
        'Decide next-vs-previous and greater-vs-smaller.',
        'Store **indices**, not values, so you can compute distances.',
        'Pop while the ordering is violated; assign answers on pop (next) or read the top (previous).',
        'Use a sentinel to flush the stack at the end.',
      ],
      template: {
        lang: 'java',
        caption: 'The skeleton, plus the greedy "remove k digits" variant',
        code: `
Deque<Integer> st = new ArrayDeque<>();
for (int i = 0; i < n; i++) {
    while (!st.isEmpty() && violates(a[st.peek()], a[i])) {
        int j = st.pop();
        answer[j] = /* something derived from i and j */;
    }
    st.push(i);
}

// Greedy variant — Remove K Digits: keep the stack INCREASING,
// popping bigger digits while we still have removals left.
StringBuilder sb = new StringBuilder();
for (char d : num.toCharArray()) {
    while (k > 0 && sb.length() > 0 && sb.charAt(sb.length() - 1) > d) {
        sb.deleteCharAt(sb.length() - 1); k--;
    }
    sb.append(d);
}
while (k-- > 0) sb.deleteCharAt(sb.length() - 1);   // still removals left`,
      },
      complexity: 'O(n) time — each index is pushed once and popped once — O(n) space.',
      gotchas: [
        'Strict (`<`) versus non-strict (`<=`) decides how ties are handled; for "days until a **warmer** temperature" you need strict.',
        'Leftovers on the stack have no answer — initialise the result array accordingly.',
        'Push indices. Pushing values makes distance-based answers impossible.',
      ],
      problems: ['Daily Temperatures', 'Next Greater Element I', 'Next Greater Element II', 'Largest Rectangle in Histogram', 'Trapping Rain Water', 'Remove K Digits', 'Online Stock Span'],
    },
    {
      id: 'monotonic-deque',
      name: 'Monotonic Deque',
      oneLiner: 'A monotonic stack that can also evict from the front as the window moves.',
      useWhen: ['Maximum or minimum of every sliding window.', 'Window validity that depends on the window’s extremes.'],
      recognize: ['"Sliding window maximum", "absolute difference within a window ≤ limit", "shortest subarray with sum ≥ k".'],
      steps: [
        'Evict from the front when the index falls out of the window.',
        'Evict from the back while the incoming value dominates.',
        'The front is the current extreme.',
      ],
      complexity: 'O(n) time, O(k) space.',
      gotchas: ['Evict expired indices *before* reading the front.', 'For prefix-sum variants (Shortest Subarray with Sum at Least K) the deque holds prefix indices with increasing prefix values.'],
      problems: ['Sliding Window Maximum', 'Longest Continuous Subarray With Absolute Diff Less Than or Equal to Limit', 'Shortest Subarray with Sum at Least K', 'Jump Game VI'],
    },
    {
      id: 'stack-simulation',
      name: 'Stack Simulation',
      oneLiner: 'When the rules say "the last thing interacts with the next thing", simulate with a stack.',
      useWhen: ['Collision problems, adjacent-cancellation, expression evaluation.'],
      recognize: ['"Asteroids collide", "remove adjacent duplicates", "evaluate RPN", "backspace string compare".'],
      steps: ['Push each incoming item.', 'While the top and the incoming item interact, resolve — which may consume either or both.', 'The remaining stack is the answer, bottom to top.'],
      complexity: 'O(n) time and space.',
      gotchas: ['Careful with loops that must `break` after the incoming item is destroyed.', 'Iterate the final stack in the right direction — `ArrayDeque` iterates head first, which is top-of-stack.'],
      problems: ['Asteroid Collision', 'Evaluate Reverse Polish Notation', 'Backspace String Compare', 'Remove All Adjacent Duplicates in String II', 'Basic Calculator II'],
    },
    {
      id: 'two-stacks',
      name: 'Auxiliary-Stack Designs',
      oneLiner: 'Pair the main stack with a second structure to gain an O(1) query.',
      useWhen: ['Min/max stack, queue from stacks, stack from queues, max frequency stack.'],
      recognize: ['"Design a stack that supports getMin in O(1)".'],
      steps: ['Store the derived value alongside each element, or keep a parallel stack of running extremes.', 'For queue-from-stacks, transfer lazily and only when the output stack is empty.'],
      complexity: 'O(1) per operation (amortised for the queue), O(n) space.',
      gotchas: ['Pop from the auxiliary structure in lockstep with the main one.', 'Lazy transfer is what makes the amortised bound work.'],
      problems: ['Min Stack', 'Implement Queue using Stacks', 'Implement Stack using Queues', 'Maximum Frequency Stack'],
    },
  ],

  pitfalls: [
    { title: 'Using `java.util.Stack`', text: 'Synchronised and iterates in the wrong order. Use `ArrayDeque`.' },
    { title: 'Pushing values instead of indices', text: 'Monotonic stack answers usually need distances, which require indices.' },
    { title: 'Popping without an emptiness check', text: '`ArrayDeque.pop()` throws on empty; `poll()` returns null.' },
    { title: 'Wrong strictness', text: '`<` versus `<=` changes tie behaviour and silently produces wrong answers on plateaus.' },
    { title: 'Forgetting to flush the stack', text: 'Elements left at the end still need answers — use a sentinel or a drain loop.' },
    { title: 'Eager transfer in queue-from-stacks', text: 'Destroys the amortised O(1) guarantee.' },
  ],

  cheatsheet: [
    { label: 'Use', value: 'ArrayDeque, never Stack' },
    { label: 'Next greater', value: 'pop while a[top] < a[i]; answer on pop' },
    { label: 'Next smaller', value: 'pop while a[top] > a[i]' },
    { label: 'Previous smaller', value: 'pop while a[top] >= a[i]; answer = new top' },
    { label: 'Stack decreasing', value: '⇒ finds next greater' },
    { label: 'Stack increasing', value: '⇒ finds next smaller' },
    { label: 'Histogram width', value: 'i − stack.peek() − 1' },
    { label: 'Flush trick', value: 'append a sentinel (0 or ∞)' },
    { label: 'Window max', value: 'decreasing deque, front = max' },
    { label: 'Window min', value: 'increasing deque, front = min' },
    { label: 'Valid-run base', value: 'push −1 sentinel index' },
    { label: 'Queue from stacks', value: 'transfer only when out is empty' },
  ],

  problems: [
    { name: 'Valid Parentheses', difficulty: 'Easy', url: 'https://leetcode.com/problems/valid-parentheses/', pattern: 'Matching stack', insight: 'Push the expected closer; require an empty stack at the end.' },
    { name: 'Min Stack', difficulty: 'Medium', url: 'https://leetcode.com/problems/min-stack/', pattern: 'Auxiliary value', insight: 'Store (value, minSoFar) pairs so getMin never searches.' },
    { name: 'Implement Queue using Stacks', difficulty: 'Easy', url: 'https://leetcode.com/problems/implement-queue-using-stacks/', pattern: 'Two stacks', insight: 'Lazy transfer only when the output stack is empty.' },
    { name: 'Baseball Game', difficulty: 'Easy', url: 'https://leetcode.com/problems/baseball-game/', pattern: 'Stack simulation', insight: 'A gentle warm-up for operate-on-the-last-few-entries logic.' },
    { name: 'Backspace String Compare', difficulty: 'Easy', url: 'https://leetcode.com/problems/backspace-string-compare/', pattern: 'Stack simulation', insight: 'O(1) space follow-up: walk both strings backwards counting pending deletions.' },
    { name: 'Remove All Adjacent Duplicates In String', difficulty: 'Easy', url: 'https://leetcode.com/problems/remove-all-adjacent-duplicates-in-string/', pattern: 'Stack simulation', insight: 'Use a StringBuilder as the stack to avoid a final reversal.' },
    { name: 'Next Greater Element I', difficulty: 'Easy', url: 'https://leetcode.com/problems/next-greater-element-i/', pattern: 'Monotonic stack', insight: 'Precompute answers for nums2 into a map, then look up each element of nums1.' },
    { name: 'Daily Temperatures', difficulty: 'Medium', url: 'https://leetcode.com/problems/daily-temperatures/', pattern: 'Monotonic stack', insight: 'Indices on a decreasing stack; the answer is the index difference on pop.' },
    { name: 'Next Greater Element II', difficulty: 'Medium', url: 'https://leetcode.com/problems/next-greater-element-ii/', pattern: 'Monotonic stack (circular)', insight: 'Loop to 2n and index with i % n; only push during the first lap.' },
    { name: 'Evaluate Reverse Polish Notation', difficulty: 'Medium', url: 'https://leetcode.com/problems/evaluate-reverse-polish-notation/', pattern: 'Stack simulation', insight: 'Pop the right operand first — subtraction and division are not commutative.' },
    { name: 'Asteroid Collision', difficulty: 'Medium', url: 'https://leetcode.com/problems/asteroid-collision/', pattern: 'Stack simulation', insight: 'Only a right-mover on the stack meeting a left-mover collides; handle mutual destruction carefully.' },
    { name: 'Decode String', difficulty: 'Medium', url: 'https://leetcode.com/problems/decode-string/', pattern: 'Nesting stack', insight: 'Two stacks — counts and partially built strings.' },
    { name: 'Online Stock Span', difficulty: 'Medium', url: 'https://leetcode.com/problems/online-stock-span/', pattern: 'Monotonic stack', insight: 'Pop smaller spans and absorb their widths — the stack compresses history.' },
    { name: 'Remove K Digits', difficulty: 'Medium', url: 'https://leetcode.com/problems/remove-k-digits/', pattern: 'Greedy monotonic stack', insight: 'Keep the stack increasing; strip leading zeros and trim leftovers at the end.' },
    { name: 'Remove All Adjacent Duplicates in String II', difficulty: 'Medium', url: 'https://leetcode.com/problems/remove-all-adjacent-duplicates-in-string-ii/', pattern: 'Stack of (char, count)', insight: 'Store run-lengths on the stack rather than individual characters.' },
    { name: 'Simplify Path', difficulty: 'Medium', url: 'https://leetcode.com/problems/simplify-path/', pattern: 'Stack', insight: 'Split on "/", push names, pop on "..", skip "." and empty segments.' },
    { name: 'Basic Calculator II', difficulty: 'Medium', url: 'https://leetcode.com/problems/basic-calculator-ii/', pattern: 'Stack + deferred ops', insight: 'Apply * and / immediately against the stack top; push + and − terms with sign.' },
    { name: '132 Pattern', difficulty: 'Medium', url: 'https://leetcode.com/problems/132-pattern/', pattern: 'Monotonic stack (right to left)', insight: 'Sweep backwards keeping the largest popped value as a candidate "2"; then look for a smaller "1".' },
    { name: 'Car Fleet', difficulty: 'Medium', url: 'https://leetcode.com/problems/car-fleet/', pattern: 'Sort + monotonic stack', insight: 'Sort by position descending; a car joins the fleet ahead if its arrival time is no later.' },
    { name: 'Longest Valid Parentheses', difficulty: 'Hard', url: 'https://leetcode.com/problems/longest-valid-parentheses/', pattern: 'Index stack with sentinel', insight: 'Seed with −1; lengths are always i − stack.peek().' },
    { name: 'Largest Rectangle in Histogram', difficulty: 'Hard', url: 'https://leetcode.com/problems/largest-rectangle-in-histogram/', pattern: 'Monotonic stack', insight: 'width = i − stack.peek() − 1 after popping; a trailing 0 flushes the stack.' },
    { name: 'Maximal Rectangle', difficulty: 'Hard', url: 'https://leetcode.com/problems/maximal-rectangle/', pattern: 'Histogram per row', insight: 'Build cumulative column heights per row, then run the histogram algorithm.' },
    { name: 'Trapping Rain Water', difficulty: 'Hard', url: 'https://leetcode.com/problems/trapping-rain-water/', pattern: 'Monotonic stack or two pointers', insight: 'The stack version fills water layer by layer between a popped valley and its two walls.' },
    { name: 'Sliding Window Maximum', difficulty: 'Hard', url: 'https://leetcode.com/problems/sliding-window-maximum/', pattern: 'Monotonic deque', insight: 'Dominance argument: a smaller earlier element can never be a future maximum.' },
    { name: 'Shortest Subarray with Sum at Least K', difficulty: 'Hard', url: 'https://leetcode.com/problems/shortest-subarray-with-sum-at-least-k/', pattern: 'Prefix + monotonic deque', insight: 'Negatives break the sliding window, so keep a deque of increasing prefix sums instead.' },
    { name: 'Maximum Frequency Stack', difficulty: 'Hard', url: 'https://leetcode.com/problems/maximum-frequency-stack/', pattern: 'Stack per frequency', insight: 'Keep a stack for each frequency level and a running maxFreq — push duplicates into every level they reach.' },
  ],
}
