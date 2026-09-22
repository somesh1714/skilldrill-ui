export default {
  id: 'heaps',
  title: 'Heaps & Priority Queues',
  short: 'Heaps',
  icon: 'ChangeHistoryRounded',
  tier: 'Core',
  order: 12,
  estHours: 8,
  prereqs: ['sorting'],
  tagline: 'When you need the best element repeatedly — but never the full order.',
  mentalModel:
    'A heap is a *partially* sorted structure: it knows its extreme and nothing else. That is exactly enough for "top k", "merge k", "schedule next", and "running median" — and it is why a heap beats a sort.',
  whyItMatters:
    'The heap is the answer to "the data is a stream" and to "k is much smaller than n". Recognising those two signals converts a pile of Hard problems into fifteen-line solutions.',

  complexity: [
    { op: 'Peek min/max', time: 'O(1)', space: '—', note: 'The root' },
    { op: 'Insert (offer)', time: 'O(log n)', space: '—', note: 'Sift up' },
    { op: 'Extract (poll)', time: 'O(log n)', space: '—', note: 'Sift down' },
    { op: 'Build heap from n items', time: 'O(n)', space: 'O(n)', note: 'Heapify — NOT n log n' },
    { op: 'Search for an arbitrary value', time: 'O(n)', space: '—', note: 'Heaps are not searchable' },
    { op: 'Delete an arbitrary value', time: 'O(n)', space: '—', note: 'Must find it first' },
    { op: 'Top-k over n items', time: 'O(n log k)', space: 'O(k)', note: 'Bounded heap' },
    { op: 'Merge k sorted lists', time: 'O(N log k)', space: 'O(k)', note: 'N = total elements' },
  ],

  sections: [
    {
      id: 'structure',
      title: 'What a heap is',
      blocks: [
        { t: 'p', text: 'A binary heap is a **complete binary tree** — every level full except possibly the last, which fills left to right — stored in an array. Because it is complete, the array has no gaps, and the parent/child relationships are pure arithmetic.' },
        {
          t: 'ascii',
          caption: 'A min-heap and its array form. Parent ≤ children, everywhere.',
          code: `
            1                    index:  0  1  2  3  4  5
          /   \\                  array: [1, 3, 2, 7, 4, 5]
         3     2
        / \\   /                  parent(i) = (i - 1) / 2
       7   4 5                   left(i)   = 2i + 1
                                 right(i)  = 2i + 2

  HEAP PROPERTY: parent <= both children (min-heap).
  NOTE: it is NOT sorted. [1,3,2,7,4,5] is a valid heap and not a sorted array.`,
        },
        {
          t: 'key',
          title: 'Heap ≠ sorted',
          text: 'The only guarantee is at the root. Siblings have no defined order, and a heap’s array form is not sorted. Iterating a `PriorityQueue` in Java gives you **arbitrary order** — a classic bug. To drain in order you must `poll()` repeatedly.',
        },
        {
          t: 'note',
          title: 'Why building a heap is O(n)',
          text: 'Sifting down from the bottom up costs `O(1)` for the `n/2` leaves, `O(1)` for the `n/4` nodes above them, and so on. The sum `Σ (n/2^k) · k` converges to `2n`. Most of the tree is near the bottom, where sifting is cheap. This is a favourite "do you actually understand it?" question.',
        },
      ],
    },
    {
      id: 'java',
      title: 'Java PriorityQueue in practice',
      blocks: [
        {
          t: 'code',
          lang: 'java',
          caption: 'Everything you need to declare the right heap',
          code: `
// MIN-heap (default): smallest first
PriorityQueue<Integer> min = new PriorityQueue<>();

// MAX-heap: reverse the comparator
PriorityQueue<Integer> max = new PriorityQueue<>(Comparator.reverseOrder());
PriorityQueue<Integer> max2 = new PriorityQueue<>((a, b) -> b - a);   // ok for small ints

// By a field
PriorityQueue<int[]> byDistance =
    new PriorityQueue<>(Comparator.comparingInt(p -> p[0] * p[0] + p[1] * p[1]));

// Multi-key: frequency ascending, then value descending
PriorityQueue<int[]> pq = new PriorityQueue<>(
    Comparator.<int[]>comparingInt(x -> x[1]).thenComparing(x -> -x[0]));

// O(n) bulk construction — heapify, not n inserts
PriorityQueue<Integer> h = new PriorityQueue<>(Arrays.asList(1, 5, 2, 9));

pq.offer(x);     // O(log n)
pq.peek();       // O(1), null if empty
pq.poll();       // O(log n), null if empty
pq.size();`,
        },
        {
          t: 'warn',
          title: 'Three PriorityQueue traps',
          text: '**(1)** Iterating or printing a `PriorityQueue` does not give sorted order. **(2)** `remove(Object)` is `O(n)` — do not build an algorithm on it; use lazy deletion instead. **(3)** `(a, b) -> b - a` overflows for large values; prefer `Comparator.reverseOrder()` or `Integer.compare(b, a)`.',
        },
        {
          t: 'tip',
          title: 'Lazy deletion',
          text: 'When you need to remove elements that are no longer valid (expired tasks, stale prices), do not search the heap. Push a "tombstone" or check validity when you `poll`, discarding stale entries in a `while` loop. Each element is pushed and popped once, so the amortised cost stays `O(log n)`.',
        },
      ],
    },
    {
      id: 'topk',
      title: 'The top-k pattern — and the counter-intuitive bit',
      blocks: [
        { t: 'p', text: 'To find the **k largest** elements, use a **min-heap** of size k. That feels backwards, so here is why: the min-heap’s root is the *weakest* of your current champions. When a new element arrives, you only need to compare it with the weakest — and if it wins, evict the weakest.' },
        {
          t: 'code',
          lang: 'java',
          caption: 'Top-k with a bounded heap — the pattern in six lines',
          code: `
// k LARGEST -> MIN-heap of size k (root = the weakest champion)
PriorityQueue<Integer> heap = new PriorityQueue<>();
for (int x : nums) {
    heap.offer(x);
    if (heap.size() > k) heap.poll();     // evict the smallest
}
// heap now holds the k largest; heap.peek() is the k-th largest

// k SMALLEST -> MAX-heap of size k
PriorityQueue<Integer> heap2 = new PriorityQueue<>(Comparator.reverseOrder());
for (int x : nums) {
    heap2.offer(x);
    if (heap2.size() > k) heap2.poll();   // evict the largest
}`,
        },
        {
          t: 'key',
          title: 'The rule, stated once',
          text: '**k largest → min-heap. k smallest → max-heap.** Size it to k and evict after every insert. Complexity is `O(n log k)` and space `O(k)` — both better than sorting when `k ≪ n`.',
        },
        {
          t: 'table',
          head: ['Situation', 'Best tool', 'Why'],
          rows: [
            ['Data is a stream / does not fit in memory', 'Bounded heap', 'Processes one element at a time, O(k) memory'],
            ['One-shot query on an in-memory array', 'Quickselect', 'O(n) average, beats O(n log k)'],
            ['The key is a small bounded integer', 'Bucket / counting sort', 'O(n), no comparisons'],
            ['You need the k items *in order*', 'Heap, then drain', 'Draining costs O(k log k)'],
            ['k is close to n', 'Just sort', 'O(n log n) with better constants'],
          ],
        },
      ],
    },
    {
      id: 'two-heaps',
      title: 'Two heaps — the running median',
      blocks: [
        { t: 'p', text: 'Split the data at the median: a **max-heap for the lower half** and a **min-heap for the upper half**. The two roots sit either side of the median, so the answer is `O(1)`.' },
        {
          t: 'ascii',
          caption: 'The two roots face each other across the median.',
          code: `
   lower half (max-heap)          upper half (min-heap)
        [1, 2, 3]                      [5, 7, 9]
              ^                         ^
            root=3                    root=5

   even count -> median = (3 + 5) / 2 = 4
   odd count  -> keep 'lower' one larger; median = lower.peek()`,
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'Find Median from Data Stream — the push-through-both-heaps trick',
          code: `
class MedianFinder {
    // 'lower' holds the smaller half (max-heap), 'upper' the larger half (min-heap)
    private final PriorityQueue<Integer> lower = new PriorityQueue<>(Comparator.reverseOrder());
    private final PriorityQueue<Integer> upper = new PriorityQueue<>();

    public void addNum(int num) {
        lower.offer(num);                 // always insert into lower...
        upper.offer(lower.poll());        // ...then hand its largest to upper
        if (upper.size() > lower.size())  // rebalance so lower >= upper
            lower.offer(upper.poll());
    }

    public double findMedian() {
        return lower.size() > upper.size()
             ? lower.peek()
             : (lower.peek() + upper.peek()) / 2.0;
    }
}`,
        },
        {
          t: 'tip',
          title: 'Why push through both heaps',
          text: 'Inserting into `lower` and immediately moving its maximum to `upper` guarantees the partition stays correct without any comparison logic. It costs one extra `O(log n)` operation and removes every edge case — a very good trade in an interview.',
        },
        {
          t: 'note',
          title: 'Two-heap problems beyond the median',
          text: 'IPO (maximise capital), Sliding Window Median, and "Find Right Interval" all use two heaps or a heap plus a sorted structure. The shape is always "one structure for the available items, another for the committed ones".',
        },
      ],
    },
    {
      id: 'scheduling',
      title: 'Heaps for scheduling and merging',
      blocks: [
        { t: 'p', text: 'A heap is the natural "what happens next?" device. Two archetypes cover most scheduling problems.' },
        {
          t: 'code',
          lang: 'java',
          caption: 'Meeting Rooms II — a min-heap of end times counts concurrent rooms',
          code: `
int minMeetingRooms(int[][] intervals) {
    Arrays.sort(intervals, Comparator.comparingInt(a -> a[0]));   // by start
    PriorityQueue<Integer> endTimes = new PriorityQueue<>();      // rooms in use

    for (int[] iv : intervals) {
        if (!endTimes.isEmpty() && endTimes.peek() <= iv[0])
            endTimes.poll();          // the earliest-finishing room is now free
        endTimes.offer(iv[1]);        // occupy a room until this meeting's end
    }
    return endTimes.size();           // peak concurrency
}`,
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'Task Scheduler / Reorganize String — greedily spend the most frequent item',
          code: `
// Reorganize String: never place the same character adjacently.
// Greedy: always take the two most frequent remaining characters.
PriorityQueue<int[]> pq = new PriorityQueue<>((a, b) -> b[1] - a[1]);  // by count desc
for (int c = 0; c < 26; c++) if (freq[c] > 0) pq.offer(new int[]{ c, freq[c] });

StringBuilder sb = new StringBuilder();
while (pq.size() >= 2) {
    int[] a = pq.poll(), b = pq.poll();          // two DIFFERENT characters
    sb.append((char)('a' + a[0])).append((char)('a' + b[0]));
    if (--a[1] > 0) pq.offer(a);
    if (--b[1] > 0) pq.offer(b);
}
if (!pq.isEmpty()) {
    int[] last = pq.poll();
    if (last[1] > 1) return "";                  // impossible
    sb.append((char)('a' + last[0]));
}`,
        },
        {
          t: 'key',
          title: 'The greedy-with-a-heap shape',
          text: 'Many greedy algorithms need "the currently best option", and that option changes as you consume items. A heap maintains it in `O(log n)`. If you find yourself writing "pick the max, update it, pick the max again", you want a priority queue.',
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'Merge k Sorted Lists — the k-way merge',
          code: `
PriorityQueue<ListNode> pq = new PriorityQueue<>(Comparator.comparingInt(n -> n.val));
for (ListNode l : lists) if (l != null) pq.offer(l);

ListNode dummy = new ListNode(0), tail = dummy;
while (!pq.isEmpty()) {
    ListNode n = pq.poll();
    tail.next = n; tail = n;
    if (n.next != null) pq.offer(n.next);    // refill from the same list
}
return dummy.next;`,
        },
      ],
    },
  ],

  patterns: [
    {
      id: 'top-k-heap',
      name: 'Bounded Heap (Top-K)',
      oneLiner: 'Keep exactly k champions; evict the weakest after every insert.',
      useWhen: ['k largest / smallest / closest / most frequent.', 'Data arrives as a stream.', 'k ≪ n.'],
      recognize: ['The words "k largest", "k closest", "top k", "kth largest".'],
      steps: ['Choose the heap direction opposite to what you want (k largest ⇒ min-heap).', 'Offer, then poll if size exceeds k.', 'The root is the k-th best; the heap is the top k.'],
      template: {
        lang: 'java',
        caption: 'K Closest Points to Origin — max-heap keyed by distance',
        code: `
PriorityQueue<int[]> pq = new PriorityQueue<>(
    (a, b) -> (b[0]*b[0] + b[1]*b[1]) - (a[0]*a[0] + a[1]*a[1]));  // farthest first

for (int[] p : points) {
    pq.offer(p);
    if (pq.size() > k) pq.poll();     // drop the farthest
}
return pq.toArray(new int[0][]);      // order within the result does not matter`,
      },
      complexity: 'O(n log k) time, O(k) space.',
      gotchas: [
        'Getting the direction backwards is the classic error — say the rule out loud before you type.',
        'If the result must be sorted, drain the heap (`O(k log k)`).',
        'Compare squared distances; never call `Math.sqrt`.',
      ],
      problems: ['Kth Largest Element in an Array', 'K Closest Points to Origin', 'Top K Frequent Elements', 'Kth Largest Element in a Stream', 'Top K Frequent Words'],
    },
    {
      id: 'two-heaps',
      name: 'Two Heaps (Median / Partitioned Halves)',
      oneLiner: 'A max-heap for the low half and a min-heap for the high half meet at the median.',
      useWhen: ['Running median.', 'Any problem needing the boundary between two halves of a dynamic set.'],
      recognize: ['"Median from a data stream", "sliding window median", "maximise capital with a budget".'],
      steps: ['Insert into one heap, push its extreme into the other.', 'Rebalance so the sizes differ by at most one.', 'Read the median from the roots.'],
      complexity: 'O(log n) per insert, O(1) per query.',
      gotchas: [
        'Fix a size convention (`lower` is never smaller than `upper`) and enforce it every time.',
        'For sliding-window median you need deletions — use lazy deletion or a `TreeMap` instead.',
      ],
      problems: ['Find Median from Data Stream', 'Sliding Window Median', 'IPO'],
    },
    {
      id: 'k-way-merge',
      name: 'K-Way Merge',
      oneLiner: 'Hold one candidate from each sorted source; take the best and refill from its source.',
      useWhen: ['Merging k sorted lists/arrays.', 'Smallest range covering elements from k lists.', 'K-th smallest in a sorted matrix.'],
      recognize: ['"k sorted lists", "k sorted arrays", "smallest range".'],
      steps: ['Seed the heap with the first element of each source.', 'Poll the minimum, emit it, then push that source’s next element.'],
      complexity: 'O(N log k) time, O(k) space.',
      gotchas: ['Store the source index with the value so you know where to refill from.', 'Skip empty sources when seeding.'],
      problems: ['Merge k Sorted Lists', 'Kth Smallest Element in a Sorted Matrix', 'Smallest Range Covering Elements from K Lists', 'Find K Pairs with Smallest Sums'],
    },
    {
      id: 'greedy-heap',
      name: 'Greedy Scheduling with a Heap',
      oneLiner: 'Repeatedly commit to the currently best option; the heap keeps "best" up to date.',
      useWhen: ['Interval room allocation, task scheduling with cooldown, rearranging by frequency, connecting ropes.'],
      recognize: ['"Minimum number of rooms/machines", "maximum tasks", "rearrange so no two adjacent", "minimum cost to combine".'],
      steps: ['Sort by the natural order (usually start time) if the input is intervals.', 'Maintain a heap of in-flight commitments.', 'Release finished ones before committing new ones.'],
      complexity: 'O(n log n).',
      gotchas: [
        'Decide whether touching endpoints count as overlapping — it changes `<` to `<=`.',
        'For the "cooldown" scheduler, pair a max-heap of counts with a queue of cooling-down items.',
      ],
      problems: ['Meeting Rooms II', 'Task Scheduler', 'Reorganize String', 'Minimum Cost to Connect Sticks', 'Single-Threaded CPU'],
    },
    {
      id: 'lazy-deletion',
      name: 'Lazy Deletion / Stale-Entry Heap',
      oneLiner: 'Never remove from the middle — discard invalid entries when they reach the top.',
      useWhen: ['Elements become invalid over time but removing them directly is O(n).'],
      recognize: ['Sliding-window heaps, expiring tasks, "the heap may contain outdated data".'],
      steps: ['Push entries with enough information to validate them later (index, timestamp, version).', 'On `poll`, loop while the top is stale and discard it.'],
      template: {
        lang: 'java',
        caption: 'Discard stale entries at the top',
        code: `
while (!pq.isEmpty() && isStale(pq.peek())) pq.poll();
int[] best = pq.peek();            // guaranteed valid`,
      },
      complexity: 'Amortised O(log n) per operation; the heap may grow to O(n).',
      gotchas: ['Validate on every read, not only on removal.', 'Memory can grow if staleness is never checked — bound it if the problem is long-running.'],
      problems: ['Sliding Window Median', 'Design Twitter', 'Seat Reservation Manager'],
    },
  ],

  pitfalls: [
    { title: 'Iterating a PriorityQueue expecting order', text: 'Only `poll()` gives order. Printing the queue prints heap-array order.' },
    { title: 'Wrong heap direction for top-k', text: 'k largest needs a MIN-heap. Say the rule before you code it.' },
    { title: '`(a,b) -> b - a` on large values', text: 'Overflows. Use `Comparator.reverseOrder()` or `Integer.compare`.' },
    { title: 'Using `remove(Object)` in a loop', text: 'It is O(n) per call. Use lazy deletion.' },
    { title: 'Assuming heap construction is O(n log n)', text: 'Bulk heapify is O(n) — mention it when you pass a collection to the constructor.' },
    { title: 'Using a heap when quickselect fits', text: 'For a one-shot k-th element on an in-memory array, quickselect is O(n).' },
  ],

  cheatsheet: [
    { label: 'Min-heap', value: 'new PriorityQueue<>()' },
    { label: 'Max-heap', value: 'Comparator.reverseOrder()' },
    { label: 'k largest', value: 'min-heap of size k' },
    { label: 'k smallest', value: 'max-heap of size k' },
    { label: 'Top-k cost', value: 'O(n log k), space O(k)' },
    { label: 'Build from collection', value: 'O(n) heapify' },
    { label: 'Running median', value: 'max-heap low + min-heap high' },
    { label: 'Merge k lists', value: 'heap of k heads, O(N log k)' },
    { label: 'Concurrent intervals', value: 'min-heap of end times' },
    { label: 'Stale entries', value: 'lazy deletion at the top' },
    { label: 'Stream ⇒', value: 'heap, not quickselect' },
    { label: 'Not searchable', value: 'find is O(n)' },
  ],

  problems: [
    { name: 'Kth Largest Element in a Stream', difficulty: 'Easy', url: 'https://leetcode.com/problems/kth-largest-element-in-a-stream/', pattern: 'Bounded heap', insight: 'Keep a min-heap of size k; its root is always the answer.' },
    { name: 'Last Stone Weight', difficulty: 'Easy', url: 'https://leetcode.com/problems/last-stone-weight/', pattern: 'Max-heap simulation', insight: 'Poll two, push the difference if non-zero.' },
    { name: 'Minimum Cost to Connect Sticks', difficulty: 'Medium', url: 'https://leetcode.com/problems/minimum-cost-to-connect-sticks/', pattern: 'Greedy heap', insight: 'Always combine the two shortest — this is Huffman coding.' },
    { name: 'Kth Largest Element in an Array', difficulty: 'Medium', url: 'https://leetcode.com/problems/kth-largest-element-in-an-array/', pattern: 'Bounded heap / quickselect', insight: 'Heap is O(n log k); quickselect is O(n) average. Name both.' },
    { name: 'Top K Frequent Elements', difficulty: 'Medium', url: 'https://leetcode.com/problems/top-k-frequent-elements/', pattern: 'Count + heap / bucket', insight: 'Bucket sort by frequency is the O(n) upgrade.' },
    { name: 'K Closest Points to Origin', difficulty: 'Medium', url: 'https://leetcode.com/problems/k-closest-points-to-origin/', pattern: 'Bounded heap', insight: 'Max-heap of size k on squared distance.' },
    { name: 'Task Scheduler', difficulty: 'Medium', url: 'https://leetcode.com/problems/task-scheduler/', pattern: 'Greedy heap', insight: 'Max-heap of counts plus a cooldown queue — or the O(1) maths formula.' },
    { name: 'Reorganize String', difficulty: 'Medium', url: 'https://leetcode.com/problems/reorganize-string/', pattern: 'Greedy heap', insight: 'Take the two most frequent each round; impossible when a count exceeds (n+1)/2.' },
    { name: 'Meeting Rooms II', difficulty: 'Medium', url: 'https://leetcode.com/problems/meeting-rooms-ii/', pattern: 'Heap of end times', insight: 'Heap size is the number of concurrent meetings.' },
    { name: 'Sort Characters By Frequency', difficulty: 'Medium', url: 'https://leetcode.com/problems/sort-characters-by-frequency/', pattern: 'Count + heap', insight: 'Bucket by count is the linear alternative.' },
    { name: 'Kth Smallest Element in a Sorted Matrix', difficulty: 'Medium', url: 'https://leetcode.com/problems/kth-smallest-element-in-a-sorted-matrix/', pattern: 'K-way merge / binary search', insight: 'Heap over row heads, or binary search the value with a staircase count.' },
    { name: 'Find K Pairs with Smallest Sums', difficulty: 'Medium', url: 'https://leetcode.com/problems/find-k-pairs-with-smallest-sums/', pattern: 'K-way merge', insight: 'Seed with (i, 0) pairs; after popping (i, j) push (i, j+1).' },
    { name: 'Single-Threaded CPU', difficulty: 'Medium', url: 'https://leetcode.com/problems/single-threaded-cpu/', pattern: 'Greedy heap + time cursor', insight: 'Sort by enqueue time; advance the clock when the heap is empty.' },
    { name: 'IPO', difficulty: 'Hard', url: 'https://leetcode.com/problems/ipo/', pattern: 'Two heaps', insight: 'Min-heap by capital to unlock projects; max-heap by profit to choose one.' },
    { name: 'Find Median from Data Stream', difficulty: 'Hard', url: 'https://leetcode.com/problems/find-median-from-data-stream/', pattern: 'Two heaps', insight: 'Push through both heaps, then rebalance — no branching needed.' },
    { name: 'Merge k Sorted Lists', difficulty: 'Hard', url: 'https://leetcode.com/problems/merge-k-sorted-lists/', pattern: 'K-way merge', insight: 'O(N log k); pairwise divide-and-conquer merging matches it without a heap.' },
    { name: 'Smallest Range Covering Elements from K Lists', difficulty: 'Hard', url: 'https://leetcode.com/problems/smallest-range-covering-elements-from-k-lists/', pattern: 'K-way merge', insight: 'Keep one pointer per list; the range is (heap min, running max).' },
    { name: 'Sliding Window Median', difficulty: 'Hard', url: 'https://leetcode.com/problems/sliding-window-median/', pattern: 'Two heaps + lazy deletion', insight: 'Deletion is the hard part — mark stale entries and purge at the top.' },
    { name: 'The Skyline Problem', difficulty: 'Hard', url: 'https://leetcode.com/problems/the-skyline-problem/', pattern: 'Sweep line + max-heap', insight: 'Process events by x; a max-heap of active heights gives the current skyline level.' },
    { name: 'Maximum Performance of a Team', difficulty: 'Hard', url: 'https://leetcode.com/problems/maximum-performance-of-a-team/', pattern: 'Sort + bounded heap', insight: 'Sort by efficiency descending; keep the k largest speeds in a min-heap.' },
  ],
}
