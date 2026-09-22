export default {
  id: 'linked-list',
  title: 'Linked Lists',
  short: 'Linked List',
  icon: 'LinkRounded',
  tier: 'Core',
  order: 8,
  estHours: 10,
  prereqs: ['two-pointers'],
  tagline: 'Pointer surgery. Six techniques cover every question ever asked.',
  mentalModel:
    'A linked list has no indices — only "the node I am holding" and "the node after it". Every technique is a way of manufacturing the extra handles you need: a dummy head, a previous pointer, or a second cursor at a different speed.',
  whyItMatters:
    'Linked-list problems test precision, not insight. They are the purest signal of whether you can write correct pointer code under pressure, which is why they remain an interview staple decades after they stopped being common in application code.',

  complexity: [
    { op: 'Access by position', time: 'O(n)', space: 'O(1)', note: 'No random access — must walk' },
    { op: 'Insert / delete at head', time: 'O(1)', space: 'O(1)', note: 'The one thing lists do better than arrays' },
    { op: 'Insert / delete after a known node', time: 'O(1)', space: 'O(1)', note: 'Given the predecessor' },
    { op: 'Search', time: 'O(n)', space: 'O(1)', note: 'Linear walk' },
    { op: 'Reverse (iterative)', time: 'O(n)', space: 'O(1)', note: 'Three-pointer rotation' },
    { op: 'Reverse (recursive)', time: 'O(n)', space: 'O(n)', note: 'Stack depth equals length' },
    { op: 'Cycle detection', time: 'O(n)', space: 'O(1)', note: 'Floyd fast/slow' },
    { op: 'Merge sort a list', time: 'O(n log n)', space: 'O(log n)', note: 'The only sort that is natural on lists' },
  ],

  sections: [
    {
      id: 'why',
      title: 'Array or linked list? The honest answer',
      blocks: [
        {
          t: 'compare',
          left: {
            title: 'Linked list wins',
            items: [
              'O(1) insert/delete when you already hold the node',
              'No reallocation, no capacity, no copying',
              'Splitting and splicing whole sublists in O(1)',
              'Stable node identity — pointers stay valid',
            ],
          },
          right: {
            title: 'Array wins (usually)',
            items: [
              'O(1) random access, O(n) for a list',
              'Cache locality makes scans ~10× faster in practice',
              'No 8–16 bytes of pointer overhead per element',
              'Binary search, two pointers from both ends, sorting in place',
            ],
          },
        },
        {
          t: 'note',
          title: 'What to say when asked',
          text: '"Linked lists win on structural modification when you already have a handle on the node; arrays win on everything involving traversal or indexing, largely because of cache behaviour. In practice I reach for `ArrayList`/`ArrayDeque` by default and only use a linked structure when I need O(1) splicing or stable node references — which is exactly why LRU caches use one."',
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'The node definition used throughout',
          code: `
class ListNode {
    int val;
    ListNode next;
    ListNode(int val) { this.val = val; }
    ListNode(int val, ListNode next) { this.val = val; this.next = next; }
}`,
        },
      ],
    },
    {
      id: 'dummy',
      title: 'Technique 1 — the dummy head (use it by default)',
      blocks: [
        { t: 'lead', text: 'Most linked-list bugs are head-node special cases. A dummy node deletes that entire category of bug.' },
        { t: 'p', text: 'Allocate one throwaway node whose `next` points at the real head. Now **every** real node has a predecessor, so insertion and deletion need no `if (node == head)` branch. At the end, return `dummy.next`.' },
        {
          t: 'ascii',
          caption: 'With a dummy, the head is no longer special.',
          code: `
  without dummy:        head -> 1 -> 2 -> 3      deleting 1 needs a special case

  with dummy:   dummy -> 1 -> 2 -> 3             deleting 1 is the same code
                  ^                               as deleting 2
                  prev`,
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'Remove all nodes with a given value — dummy head makes it uniform',
          code: `
ListNode removeElements(ListNode head, int target) {
    ListNode dummy = new ListNode(0, head);
    ListNode prev = dummy;

    while (prev.next != null) {
        if (prev.next.val == target) prev.next = prev.next.next;  // unlink
        else                         prev = prev.next;            // advance
    }
    return dummy.next;          // correct even if every node was removed
}`,
        },
        {
          t: 'trap',
          title: 'Do not advance prev after deleting',
          text: 'After `prev.next = prev.next.next`, the new `prev.next` has not been examined yet. Advancing would skip it, and consecutive duplicates would survive. The `if/else` structure above is deliberate.',
        },
        {
          t: 'tip',
          title: 'When to use a dummy',
          text: 'Any time the **head might change or be removed**: removals, merges, partitions, building a new list, reversing in groups, deleting the n-th from the end. That is most of the chapter.',
        },
      ],
    },
    {
      id: 'reversal',
      title: 'Technique 2 — reversal (the most important 5 lines)',
      blocks: [
        { t: 'p', text: 'Reversal is the building block for palindrome checks, reorder-list, add-two-numbers-in-forward-order, and k-group reversal. You must be able to write it without thinking.' },
        {
          t: 'ascii',
          caption: 'Three pointers rotate through the list, flipping one link per step.',
          code: `
  prev   cur        next
  null   1    ->    2  ->  3  ->  null

  step:  next = cur.next        (save)
         cur.next = prev        (flip)
         prev = cur             (advance)
         cur  = next            (advance)

  null <- 1      2  ->  3  -> null
          ^      ^
         prev   cur`,
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'Iterative reversal — O(1) space',
          code: `
ListNode reverse(ListNode head) {
    ListNode prev = null, cur = head;
    while (cur != null) {
        ListNode next = cur.next;   // 1. save
        cur.next = prev;            // 2. flip
        prev = cur;                 // 3. advance prev
        cur = next;                 // 4. advance cur
    }
    return prev;                    // prev is the new head
}

// Recursive version — elegant, but O(n) stack
ListNode reverseRec(ListNode head) {
    if (head == null || head.next == null) return head;
    ListNode newHead = reverseRec(head.next);
    head.next.next = head;          // the node behind me now points back at me
    head.next = null;               // and I terminate the list
    return newHead;
}`,
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'Reverse a sublist [left, right] — dummy head plus local reversal',
          code: `
ListNode reverseBetween(ListNode head, int left, int right) {
    ListNode dummy = new ListNode(0, head);
    ListNode prev = dummy;
    for (int i = 1; i < left; i++) prev = prev.next;   // node before the window

    ListNode cur = prev.next;
    for (int i = 0; i < right - left; i++) {          // head-insertion technique
        ListNode moved = cur.next;
        cur.next = moved.next;
        moved.next = prev.next;
        prev.next = moved;
    }
    return dummy.next;
}`,
        },
        {
          t: 'key',
          title: 'The head-insertion idiom',
          text: 'To reverse a window in place without re-walking it, repeatedly take the node *after* `cur` and splice it to the front of the window. Three assignments per step, no extra pointers. This generalises directly to Reverse Nodes in k-Group.',
        },
      ],
    },
    {
      id: 'fast-slow',
      title: 'Technique 3 — fast & slow pointers',
      blocks: [
        { t: 'p', text: 'Covered in depth in Two Pointers; here is the list-specific catalogue.' },
        {
          t: 'table',
          head: ['Goal', 'Setup', 'Result'],
          rows: [
            ['Detect a cycle', '`slow = fast = head`, step 1 and 2', 'They meet iff a cycle exists'],
            ['Find the cycle entrance', 'After meeting, reset one to `head`, step both by 1', 'They meet at the entrance'],
            ['Middle node', 'Step 1 and 2 until `fast` ends', '`slow` is the second middle for even n'],
            ['First middle (even n)', 'Start `fast = head.next`', '`slow` is the first middle'],
            ['n-th from the end', 'Advance `fast` n steps, then move both', '`slow` lands on the target’s predecessor'],
            ['Split in half', 'Find the middle, then `prev.next = null`', 'Two independent lists'],
          ],
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'Remove N-th Node From End — one pass, dummy head, gap technique',
          code: `
ListNode removeNthFromEnd(ListNode head, int n) {
    ListNode dummy = new ListNode(0, head);
    ListNode fast = dummy, slow = dummy;

    for (int i = 0; i < n; i++) fast = fast.next;   // open a gap of n

    while (fast.next != null) {                     // move together
        fast = fast.next;
        slow = slow.next;
    }
    slow.next = slow.next.next;                     // slow is the predecessor
    return dummy.next;
}`,
        },
        {
          t: 'trap',
          title: 'Start the gap from the dummy, not the head',
          text: 'Removing the first node (`n == length`) requires `slow` to land on the dummy. Starting both pointers at `head` makes that case crash.',
        },
      ],
    },
    {
      id: 'merge-sort',
      title: 'Technique 4 — merging and sorting',
      blocks: [
        {
          t: 'code',
          lang: 'java',
          caption: 'Merge two sorted lists — the workhorse',
          code: `
ListNode merge(ListNode a, ListNode b) {
    ListNode dummy = new ListNode(0), tail = dummy;
    while (a != null && b != null) {
        if (a.val <= b.val) { tail.next = a; a = a.next; }
        else                { tail.next = b; b = b.next; }
        tail = tail.next;
    }
    tail.next = (a != null) ? a : b;    // attach the remainder wholesale
    return dummy.next;
}`,
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'Sort List — merge sort is the natural fit (O(n log n) time, O(log n) stack)',
          code: `
ListNode sortList(ListNode head) {
    if (head == null || head.next == null) return head;

    // split at the middle: prev ends the left half
    ListNode slow = head, fast = head, prev = null;
    while (fast != null && fast.next != null) {
        prev = slow; slow = slow.next; fast = fast.next.next;
    }
    prev.next = null;                      // cut

    return merge(sortList(head), sortList(slow));
}`,
        },
        {
          t: 'note',
          title: 'Why merge sort and not quicksort',
          text: 'Merge sort needs only sequential access, which is all a list offers, and it does not need random-access partitioning. It is also stable. The `O(n)` auxiliary array that makes merge sort expensive on arrays is unnecessary here — you just relink nodes.',
        },
        {
          t: 'tip',
          title: 'Merge k lists: three options',
          text: '**Heap** of the k current heads — `O(N log k)`, the standard answer. **Divide and conquer** pairwise merging — same complexity, no heap needed, often cleaner. **Sequential merging** — `O(N·k)`, mention it only to reject it.',
        },
      ],
    },
    {
      id: 'setpieces',
      title: 'The set-piece problems',
      blocks: [
        { t: 'h', text: 'Reorder List (L0 → Ln → L1 → Ln-1 → …)' },
        { t: 'p', text: 'Three techniques composed: find the middle, reverse the second half, then interleave. Almost every Hard linked-list problem is a composition like this.' },
        {
          t: 'code',
          lang: 'java',
          caption: 'Reorder List — split, reverse, weave',
          code: `
void reorderList(ListNode head) {
    if (head == null || head.next == null) return;

    // 1. find the middle (first middle for even length)
    ListNode slow = head, fast = head.next;
    while (fast != null && fast.next != null) { slow = slow.next; fast = fast.next.next; }

    // 2. reverse the second half and detach it
    ListNode second = reverse(slow.next);
    slow.next = null;

    // 3. weave the two halves
    ListNode first = head;
    while (second != null) {
        ListNode f = first.next, s = second.next;
        first.next = second;
        second.next = f;
        first = f; second = s;
    }
}`,
        },
        { t: 'h', text: 'Copy List with Random Pointer' },
        {
          t: 'code',
          lang: 'java',
          caption: 'The O(1)-space interleaving trick',
          code: `
Node copyRandomList(Node head) {
    if (head == null) return null;

    // 1. weave clones in:  A -> A' -> B -> B' -> C -> C'
    for (Node p = head; p != null; p = p.next.next)
        p.next = new Node(p.val, p.next);

    // 2. random pointers: the clone of p.random is p.random.next
    for (Node p = head; p != null; p = p.next.next)
        if (p.random != null) p.next.random = p.random.next;

    // 3. unweave
    Node dummy = new Node(0), tail = dummy;
    for (Node p = head; p != null; p = p.next) {
        tail.next = p.next;  tail = tail.next;
        p.next = p.next.next;              // restore the original list
    }
    return dummy.next;
}`,
        },
        {
          t: 'key',
          title: 'The interleaving idea generalises',
          text: 'When you need a mapping from every old node to its new node in `O(1)` space, store the mapping *inside the structure* by placing the clone immediately after its original. The hash-map version is `O(n)` space and perfectly acceptable — but knowing the interleaving version is the differentiator.',
        },
        {
          t: 'warn',
          title: 'Restore what you borrow',
          text: 'Step 3 must repair the original list’s `next` pointers. Leaving the structure mutated is a correctness bug even if the returned copy is right — and interviewers check for it.',
        },
      ],
    },
  ],

  patterns: [
    {
      id: 'dummy-head',
      name: 'Dummy (Sentinel) Head',
      oneLiner: 'Give the head a predecessor so no node is a special case.',
      useWhen: ['The head may be deleted or replaced.', 'You are building a new list node by node.'],
      recognize: ['Any removal, merge, partition, or construction problem.'],
      steps: ['`ListNode dummy = new ListNode(0, head);`', 'Operate with `prev = dummy`.', 'Return `dummy.next`.'],
      template: {
        lang: 'java',
        caption: 'Both dummy shapes: scanning, and building',
        code: `
// SCANNING an existing list
ListNode dummy = new ListNode(0, head), prev = dummy;
while (prev.next != null) {
    if (shouldRemove(prev.next)) prev.next = prev.next.next;   // do NOT advance
    else prev = prev.next;
}
return dummy.next;

// BUILDING a new list
ListNode dummy = new ListNode(0), tail = dummy;
while (moreOutput()) { tail.next = nextNode(); tail = tail.next; }
tail.next = null;
return dummy.next;`,
      },
      complexity: 'O(1) extra space; removes an entire class of null checks.',
      gotchas: ['After unlinking, do not advance `prev` — the new successor is unexamined.', 'Remember to null-terminate when building.'],
      problems: ['Remove Linked List Elements', 'Merge Two Sorted Lists', 'Partition List', 'Remove Nth Node From End of List', 'Remove Duplicates from Sorted List II'],
    },
    {
      id: 'reverse-list',
      name: 'Iterative Reversal',
      oneLiner: 'Rotate three pointers — save, flip, advance, advance.',
      useWhen: ['Reverse the whole list, a sublist, or every k nodes.', 'Comparing a list against itself backwards (palindrome).'],
      recognize: ['"Reverse", "reorder", "palindrome", "add numbers stored in forward order".'],
      steps: ['`prev = null, cur = head`.', 'Save `next`, flip `cur.next = prev`, advance both.', 'Return `prev`.'],
      complexity: 'O(n) time, O(1) space.',
      gotchas: [
        'Save `next` **before** flipping or you lose the rest of the list.',
        'For sublists, hold the node before the window and the window’s original first node — that node becomes the window’s tail.',
        'For palindrome checks, restore the list afterwards if the caller may reuse it.',
      ],
      problems: ['Reverse Linked List', 'Reverse Linked List II', 'Palindrome Linked List', 'Reorder List', 'Reverse Nodes in k-Group'],
    },
    {
      id: 'two-pointer-list',
      name: 'Fast & Slow / Gap Pointers',
      oneLiner: 'Two cursors at different speeds or a fixed distance apart reveal structure in one pass.',
      useWhen: ['Cycles, middles, n-th from the end, splitting in half.'],
      recognize: ['"Without knowing the length", "in one pass", "O(1) space" on a list.'],
      steps: ['Fixed gap: advance one pointer n steps first, then move both.', 'Different speeds: 1× and 2×.'],
      complexity: 'O(n) time, O(1) space.',
      gotchas: ['Guard `fast != null && fast.next != null`.', 'Start gap pointers at the dummy for deletion problems.'],
      problems: ['Linked List Cycle', 'Linked List Cycle II', 'Middle of the Linked List', 'Remove Nth Node From End of List', 'Intersection of Two Linked Lists'],
    },
    {
      id: 'merge-lists',
      name: 'Merge / K-Way Merge',
      oneLiner: 'Repeatedly take the smaller head; attach the leftover tail wholesale.',
      useWhen: ['Combining sorted lists, or sorting a list.'],
      recognize: ['"Merge two sorted", "merge k sorted", "sort list".'],
      steps: ['Dummy + tail.', 'Compare heads and link the smaller.', 'For k lists, use a min-heap of heads, or divide and conquer.'],
      template: {
        lang: 'java',
        caption: 'Merge k sorted lists with a heap',
        code: `
PriorityQueue<ListNode> pq = new PriorityQueue<>((a, b) -> a.val - b.val);
for (ListNode l : lists) if (l != null) pq.offer(l);

ListNode dummy = new ListNode(0), tail = dummy;
while (!pq.isEmpty()) {
    ListNode node = pq.poll();
    tail.next = node; tail = node;
    if (node.next != null) pq.offer(node.next);
}
return dummy.next;`,
      },
      complexity: 'Two lists O(n + m); k lists O(N log k) with a heap.',
      gotchas: ['Skip null lists before offering to the heap.', 'Do not forget to attach the remaining suffix — it is already sorted.'],
      problems: ['Merge Two Sorted Lists', 'Merge k Sorted Lists', 'Sort List', 'Add Two Numbers'],
    },
    {
      id: 'in-place-restructure',
      name: 'In-Place Restructuring (split · transform · weave)',
      oneLiner: 'Decompose a hard list problem into find-middle, reverse, and merge.',
      useWhen: ['Reorder List, palindrome checks, odd-even splitting, deep copies with extra pointers.'],
      recognize: ['The output interleaves or re-pairs nodes of the input.'],
      steps: ['Split the list at a meaningful point.', 'Transform one part (usually reverse it).', 'Weave or merge the parts back.'],
      complexity: 'O(n) time, O(1) space.',
      gotchas: ['Cut the first half with `prev.next = null`, or you create a cycle.', 'Restore mutated structure if the problem expects the input intact.'],
      problems: ['Reorder List', 'Palindrome Linked List', 'Odd Even Linked List', 'Copy List with Random Pointer', 'Rotate List'],
    },
  ],

  pitfalls: [
    { title: 'Losing the rest of the list', text: 'Always save `next` before reassigning `cur.next`.' },
    { title: 'Creating accidental cycles', text: 'After splitting, the first half must be terminated with `null`.' },
    { title: 'Null-pointer on short lists', text: 'Test with length 0, 1 and 2. Most linked-list bugs live there.' },
    { title: 'Advancing prev after a deletion', text: 'Skips the node that just became the successor; breaks consecutive duplicates.' },
    { title: 'Forgetting the dummy for head-changing operations', text: 'Leads to a pile of `if (head == …)` branches that will contain a bug.' },
    { title: 'Not restoring borrowed structure', text: 'Palindrome checks and copy-with-random both mutate the input; repair it.' },
  ],

  cheatsheet: [
    { label: 'Head may change', value: 'use a dummy node' },
    { label: 'Reverse', value: 'save → flip → advance ×2' },
    { label: 'New head after reverse', value: 'prev' },
    { label: 'Middle', value: 'slow 1×, fast 2×' },
    { label: 'First middle (even n)', value: 'fast = head.next' },
    { label: 'N-th from end', value: 'gap of n, start at dummy' },
    { label: 'Cycle', value: 'fast/slow meet' },
    { label: 'Cycle start', value: 'reset one to head, step 1×' },
    { label: 'Sort a list', value: 'merge sort (split, sort, merge)' },
    { label: 'Merge k lists', value: 'min-heap of k heads' },
    { label: 'Reorder / palindrome', value: 'split + reverse + weave' },
    { label: 'Deep copy O(1) space', value: 'interleave clones' },
  ],

  problems: [
    { name: 'Reverse Linked List', difficulty: 'Easy', url: 'https://leetcode.com/problems/reverse-linked-list/', pattern: 'Reversal', insight: 'The five lines everything else is built on. Write both iterative and recursive.' },
    { name: 'Merge Two Sorted Lists', difficulty: 'Easy', url: 'https://leetcode.com/problems/merge-two-sorted-lists/', pattern: 'Merge + dummy', insight: 'Attach the non-empty remainder in one assignment.' },
    { name: 'Linked List Cycle', difficulty: 'Easy', url: 'https://leetcode.com/problems/linked-list-cycle/', pattern: 'Floyd', insight: 'Guard both `fast` and `fast.next`.' },
    { name: 'Middle of the Linked List', difficulty: 'Easy', url: 'https://leetcode.com/problems/middle-of-the-linked-list/', pattern: 'Fast & slow', insight: 'Returns the second middle when the length is even.' },
    { name: 'Remove Duplicates from Sorted List', difficulty: 'Easy', url: 'https://leetcode.com/problems/remove-duplicates-from-sorted-list/', pattern: 'Single pass', insight: 'Compare with the next node; unlink without advancing on a match.' },
    { name: 'Palindrome Linked List', difficulty: 'Easy', url: 'https://leetcode.com/problems/palindrome-linked-list/', pattern: 'Split + reverse', insight: 'Reverse the second half, compare, then restore for full marks.' },
    { name: 'Intersection of Two Linked Lists', difficulty: 'Easy', url: 'https://leetcode.com/problems/intersection-of-two-linked-lists/', pattern: 'Two pointers', insight: 'Switch each pointer to the other head at the end; they align after at most two passes.' },
    { name: 'Remove Linked List Elements', difficulty: 'Easy', url: 'https://leetcode.com/problems/remove-linked-list-elements/', pattern: 'Dummy head', insight: 'The canonical demonstration of why dummies exist.' },
    { name: 'Add Two Numbers', difficulty: 'Medium', url: 'https://leetcode.com/problems/add-two-numbers/', pattern: 'Merge + carry', insight: 'Loop while either list or the carry is non-zero — that one condition handles every edge case.' },
    { name: 'Remove Nth Node From End of List', difficulty: 'Medium', url: 'https://leetcode.com/problems/remove-nth-node-from-end-of-list/', pattern: 'Gap pointers', insight: 'Open the gap from the dummy so removing the head works.' },
    { name: 'Reverse Linked List II', difficulty: 'Medium', url: 'https://leetcode.com/problems/reverse-linked-list-ii/', pattern: 'Head insertion', insight: 'Repeatedly splice the node after `cur` to the front of the window.' },
    { name: 'Linked List Cycle II', difficulty: 'Medium', url: 'https://leetcode.com/problems/linked-list-cycle-ii/', pattern: 'Floyd + reset', insight: 'L + x ≡ 0 mod C is the reason the reset works — be ready to explain it.' },
    { name: 'Odd Even Linked List', difficulty: 'Medium', url: 'https://leetcode.com/problems/odd-even-linked-list/', pattern: 'Two-chain split', insight: 'Build odd and even chains simultaneously, then join. Save the even head first.' },
    { name: 'Rotate List', difficulty: 'Medium', url: 'https://leetcode.com/problems/rotate-list/', pattern: 'Close the ring', insight: 'Make it circular, walk n − k%n steps, then break — far simpler than repeated rotation.' },
    { name: 'Reorder List', difficulty: 'Medium', url: 'https://leetcode.com/problems/reorder-list/', pattern: 'Split + reverse + weave', insight: 'Three known techniques composed. The template for every Hard list problem.' },
    { name: 'Partition List', difficulty: 'Medium', url: 'https://leetcode.com/problems/partition-list/', pattern: 'Two dummies', insight: 'Build a "less" chain and a "greater-or-equal" chain, then splice. Null-terminate the second.' },
    { name: 'Copy List with Random Pointer', difficulty: 'Medium', url: 'https://leetcode.com/problems/copy-list-with-random-pointer/', pattern: 'Interleave or hash map', insight: 'Interleaving gives O(1) space; remember to unweave and restore.' },
    { name: 'Swap Nodes in Pairs', difficulty: 'Medium', url: 'https://leetcode.com/problems/swap-nodes-in-pairs/', pattern: 'Dummy + local relink', insight: 'Three reassignments per pair; a dummy removes the first-pair special case.' },
    { name: 'Sort List', difficulty: 'Medium', url: 'https://leetcode.com/problems/sort-list/', pattern: 'Merge sort', insight: 'Split with fast/slow, cut, recurse, merge. O(n log n) with O(log n) stack.' },
    { name: 'Remove Duplicates from Sorted List II', difficulty: 'Medium', url: 'https://leetcode.com/problems/remove-duplicates-from-sorted-list-ii/', pattern: 'Dummy + lookahead', insight: 'Remove *all* copies of a duplicated value, so you must detect the run before skipping it.' },
    { name: 'Flatten a Multilevel Doubly Linked List', difficulty: 'Medium', url: 'https://leetcode.com/problems/flatten-a-multilevel-doubly-linked-list/', pattern: 'Stack / splice', insight: 'On a child, splice it in and push the current `next` on a stack for later reattachment.' },
    { name: 'Merge k Sorted Lists', difficulty: 'Hard', url: 'https://leetcode.com/problems/merge-k-sorted-lists/', pattern: 'Heap / divide and conquer', insight: 'O(N log k) either way; pairwise merging avoids the heap entirely.' },
    { name: 'Reverse Nodes in k-Group', difficulty: 'Hard', url: 'https://leetcode.com/problems/reverse-nodes-in-k-group/', pattern: 'Reversal in windows', insight: 'Check that k nodes remain before reversing; keep the group head, it becomes the group tail.' },
    { name: 'LRU Cache', difficulty: 'Medium', url: 'https://leetcode.com/problems/lru-cache/', pattern: 'Hash map + DLL', insight: 'Sentinel head and tail nodes remove every null check in the splice logic.' },
  ],
}
