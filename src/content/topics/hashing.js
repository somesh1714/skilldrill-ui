export default {
  id: 'hashing',
  title: 'Hashing — Maps, Sets & Frequency Counting',
  short: 'Hashing',
  icon: 'TagRounded',
  tier: 'Foundations',
  order: 5,
  estHours: 8,
  prereqs: ['arrays'],
  tagline: 'The universal "have I seen this before?" machine. Learn what to use as the key and most problems collapse.',
  mentalModel:
    'A hash map buys you O(1) membership and counting in exchange for O(n) memory. The entire skill is **choosing the right key** — because the right key turns a search problem into a lookup.',
  whyItMatters:
    'Hashing is the single most-used data structure in real backend code and in interviews. But the interesting part is never `map.get`; it is the modelling decision: what is the key, and what is the value?',

  complexity: [
    { op: 'put / get / containsKey', time: 'O(1) avg, O(n) worst', space: 'O(n)', note: 'Worst case needs adversarial collisions' },
    { op: 'Iterate all entries', time: 'O(n)', space: 'O(1)', note: 'Order is unspecified for HashMap' },
    { op: 'TreeMap get / floorKey / ceilingKey', time: 'O(log n)', space: 'O(n)', note: 'Red-black tree, sorted order' },
    { op: 'LinkedHashMap ops', time: 'O(1)', space: 'O(n)', note: 'Preserves insertion or access order' },
    { op: 'Frequency array (bounded alphabet)', time: 'O(1)', space: 'O(k)', note: 'Always beats a HashMap when keys are small ints' },
    { op: 'Group by signature', time: 'O(n·L)', space: 'O(n·L)', note: 'L = cost of building one key' },
  ],

  sections: [
    {
      id: 'mechanics',
      title: 'How a hash map actually works (and why "O(1)" has an asterisk)',
      blocks: [
        { t: 'p', text: 'A hash map is an array of buckets. `hash(key)` produces an integer, that integer is reduced modulo the bucket count, and the entry lands in that bucket. Two keys landing in the same bucket is a **collision**; the bucket then holds a small list (or, in modern Java, a red-black tree once it exceeds 8 entries).' },
        {
          t: 'ascii',
          caption: 'Buckets, collisions, and why load factor matters.',
          code: `
  hash("cat") % 8 = 3        hash("dog") % 8 = 6       hash("emu") % 8 = 3
                                                        (collision!)

  buckets:
   0 | -
   1 | -
   2 | -
   3 | ("cat",1) -> ("emu",7)      <- chain
   4 | -
   5 | -
   6 | ("dog",4)
   7 | -

  load factor = entries / buckets.  Java resizes (doubles + rehashes) at 0.75.`,
        },
        {
          t: 'dl',
          items: [
            { term: 'Average O(1)', def: 'With a good hash and a bounded load factor, chains stay short (length ~1), so lookups are constant.' },
            { term: 'Worst-case O(n)', def: 'If every key collides, you are traversing one long chain. Java mitigates this by treeifying long buckets to O(log n).' },
            { term: 'Amortised resize', def: 'Doubling the bucket array is O(n), but it happens rarely enough that inserts remain amortised O(1).' },
            { term: 'hashCode / equals contract', def: 'Equal objects **must** have equal hash codes. Break this and your map silently loses entries — a genuine production bug, and a favourite senior-interview question.' },
          ],
        },
        {
          t: 'trap',
          title: 'Mutating a key after inserting it',
          text: 'If you use a `List` or a custom object as a key and then mutate it, its hash changes and the entry becomes unreachable — it is still in the map, consuming memory, but `get` will never find it. Only ever use immutable keys.',
        },
      ],
    },
    {
      id: 'choosing-keys',
      title: 'The real skill: choosing the key',
      blocks: [
        { t: 'lead', text: 'Almost every hashing problem is solved the moment you pick the right key. Here is the catalogue.' },
        {
          t: 'table',
          head: ['Problem asks…', 'Key', 'Value', 'Example'],
          rows: [
            ['Does a complement exist?', 'the number', 'its index', 'Two Sum'],
            ['Are two strings anagrams?', 'sorted string, or 26-count signature', 'list of words', 'Group Anagrams'],
            ['How many subarrays sum to k?', 'prefix sum', 'count of occurrences', 'Subarray Sum Equals K'],
            ['Longest subarray with property P', 'the state value', '**earliest** index', 'Contiguous Array'],
            ['Are these points on one line?', 'reduced slope `dy/gcd : dx/gcd`', 'count', 'Max Points on a Line'],
            ['Which cells belong together?', 'row, column, or 3×3 box id', 'set of seen values', 'Valid Sudoku'],
            ['Is this an isomorphic mapping?', 'char from A', 'char from B (plus reverse map)', 'Isomorphic Strings'],
            ['Detect a repeated substring', 'the substring (or its rolling hash)', 'count', 'Repeated DNA Sequences'],
            ['Cluster by equivalence', 'a canonical form of the object', 'group list', 'Group Shifted Strings'],
          ],
        },
        {
          t: 'key',
          title: 'Canonical form is the master idea',
          text: 'When you must group "things that are the same in some way", invent a **canonical representation** that is identical for equivalent items, then hash that. Sorted characters for anagrams. Normalised slope for collinear points. Difference-from-first-character for shifted strings. Relative shape for islands.',
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'Group Anagrams — two canonical keys, both correct',
          code: `
// Option A: sorted characters. O(n · L log L). Short and unmistakable.
Map<String, List<String>> groups = new HashMap<>();
for (String w : words) {
    char[] c = w.toCharArray();
    Arrays.sort(c);
    groups.computeIfAbsent(new String(c), k -> new ArrayList<>()).add(w);
}

// Option B: 26-character count signature. O(n · L) — better when L is large.
Map<String, List<String>> groups2 = new HashMap<>();
for (String w : words) {
    int[] cnt = new int[26];
    for (char ch : w.toCharArray()) cnt[ch - 'a']++;
    groups2.computeIfAbsent(Arrays.toString(cnt), k -> new ArrayList<>()).add(w);
}`,
        },
      ],
    },
    {
      id: 'java-toolkit',
      title: 'The Java collections toolkit',
      blocks: [
        {
          t: 'table',
          head: ['Need', 'Use', 'Why'],
          rows: [
            ['Plain O(1) lookup', '`HashMap` / `HashSet`', 'Fastest, unordered'],
            ['Sorted keys, range queries, floor/ceiling', '`TreeMap` / `TreeSet`', 'O(log n) but gives you order'],
            ['Insertion order preserved', '`LinkedHashMap`', 'Deterministic iteration'],
            ['LRU cache', '`LinkedHashMap(cap, 0.75f, true)`', 'Access-order mode + `removeEldestEntry`'],
            ['Counting', '`map.merge(k, 1, Integer::sum)`', 'One line, no null checks'],
            ['Grouping', '`map.computeIfAbsent(k, x -> new ArrayList<>())`', 'One line, no null checks'],
            ['Bounded small keys (a–z, 0–9, 0–100)', '`int[26]` / `int[128]`', '5–10× faster than HashMap, zero boxing'],
          ],
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'The four idioms you should never write the long way again',
          code: `
Map<String,Integer> count = new HashMap<>();
Map<String,List<String>> groups = new HashMap<>();

count.merge(word, 1, Integer::sum);                    // increment (creates if absent)
count.merge(word, -1, Integer::sum);                   // decrement
if (count.merge(word, -1, Integer::sum) == 0)          // decrement + prune to zero
    count.remove(word);

groups.computeIfAbsent(key, k -> new ArrayList<>()).add(value);   // group
int v = count.getOrDefault(word, 0);                              // safe read

// Sorted-map queries that save you a binary search:
TreeMap<Integer,String> tm = new TreeMap<>();
tm.floorKey(x);     // greatest key <= x
tm.ceilingKey(x);   // smallest key >= x
tm.higherKey(x);    // smallest key >  x
tm.firstKey(); tm.lastKey();
tm.subMap(lo, true, hi, true);   // range view`,
        },
        {
          t: 'warn',
          title: 'Boxing costs are real',
          text: 'A `HashMap<Integer,Integer>` with 10⁶ entries allocates two million objects. When keys are small bounded integers — characters, digits, small IDs — use a plain array. It is faster, uses less memory, and reads more clearly.',
        },
      ],
    },
    {
      id: 'frequency',
      title: 'Frequency counting patterns',
      blocks: [
        { t: 'p', text: 'Counting is hashing’s most common job. Three follow-ups come up constantly, and each has a better answer than "sort the counts".' },
        {
          t: 'code',
          lang: 'java',
          caption: 'Top K Frequent Elements — three approaches, increasing quality',
          code: `
// 1) Sort the entries:  O(n log n)
// 2) Min-heap of size k:  O(n log k)   <- the usual expected answer
PriorityQueue<int[]> pq = new PriorityQueue<>((x, y) -> x[1] - y[1]);   // by count asc
for (var e : freq.entrySet()) {
    pq.offer(new int[]{ e.getKey(), e.getValue() });
    if (pq.size() > k) pq.poll();            // evict the least frequent
}

// 3) BUCKET SORT by frequency:  O(n)     <- the answer that impresses
List<Integer>[] buckets = new List[n + 1];   // a count can never exceed n
for (var e : freq.entrySet())
    buckets[e.getValue()] = buckets[e.getValue()] == null
        ? new ArrayList<>(List.of(e.getKey()))
        : appended(buckets[e.getValue()], e.getKey());

List<Integer> out = new ArrayList<>();
for (int c = n; c >= 1 && out.size() < k; c--)
    if (buckets[c] != null) out.addAll(buckets[c]);`,
        },
        {
          t: 'key',
          title: 'Bucket-by-count is the O(n) trick',
          text: 'Frequencies are bounded by `n`, so they can index an array directly. Any "top k by frequency" or "sort characters by frequency" problem has an `O(n)` bucket solution. Reaching for it instead of a heap is a strong signal.',
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'Longest Consecutive Sequence — O(n) with a set and one clever guard',
          code: `
int longestConsecutive(int[] a) {
    Set<Integer> set = new HashSet<>();
    for (int x : a) set.add(x);

    int best = 0;
    for (int x : set) {
        if (set.contains(x - 1)) continue;      // only start from a sequence HEAD
        int len = 1;
        while (set.contains(x + len)) len++;
        best = Math.max(best, len);
    }
    return best;
}`,
        },
        {
          t: 'tip',
          title: 'Why that continue makes it linear',
          text: 'Without the guard, the inner `while` could re-walk the same run from every member — quadratic. By only expanding from a value whose predecessor is absent, each run is walked exactly once, so the total work is `O(n)`. Being able to explain this is the entire point of the problem.',
        },
      ],
    },
    {
      id: 'design',
      title: 'Design problems built on hashing',
      blocks: [
        { t: 'p', text: 'A whole genre of interview questions is "design a structure with O(1) operations". The answer is nearly always **hash map + one other structure**.' },
        {
          t: 'table',
          head: ['Problem', 'Composition', 'The insight'],
          rows: [
            ['LRU Cache', 'HashMap + doubly linked list', 'Map gives O(1) find; list gives O(1) move-to-front and evict-tail'],
            ['LFU Cache', 'HashMap + freq→DLL map + minFreq', 'Bucket nodes by frequency; minFreq changes by at most 1 per op'],
            ['Insert Delete GetRandom O(1)', 'HashMap + ArrayList', 'Swap the removed element with the last, then pop — O(1) delete'],
            ['Time Based Key-Value Store', 'HashMap + sorted list per key', 'Timestamps are increasing, so append and binary search'],
            ['Design Twitter', 'HashMap + heap merge', 'k-way merge of followees’ tweet lists'],
            ['Two Sum III (data structure)', 'HashMap of counts', 'Handle x + x by checking count ≥ 2'],
          ],
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'Insert Delete GetRandom O(1) — the swap-with-last trick',
          code: `
class RandomizedSet {
    private final List<Integer> list = new ArrayList<>();
    private final Map<Integer,Integer> index = new HashMap<>();   // value -> position
    private final Random rnd = new Random();

    public boolean insert(int val) {
        if (index.containsKey(val)) return false;
        index.put(val, list.size());
        list.add(val);
        return true;
    }

    public boolean remove(int val) {
        Integer i = index.remove(val);
        if (i == null) return false;
        int last = list.get(list.size() - 1);
        list.set(i, last);                     // move the tail into the hole
        if (last != val) index.put(last, i);   // and fix its recorded position
        list.remove(list.size() - 1);          // O(1) because it is the last slot
        return true;
    }

    public int getRandom() { return list.get(rnd.nextInt(list.size())); }
}`,
        },
        {
          t: 'trap',
          title: 'The self-removal edge case',
          text: 'If the removed element *is* the last element, `index.put(last, i)` would resurrect a key you just deleted. The `if (last != val)` guard is not optional.',
        },
      ],
    },
  ],

  patterns: [
    {
      id: 'complement-lookup',
      name: 'Complement / Seen-Before Lookup',
      oneLiner: 'As you scan, ask the map whether the partner you need has already gone past.',
      useWhen: [
        'You need a pair satisfying `a + b = target` (or a difference, or a ratio) on unsorted data.',
        'You need to detect a duplicate or a previously seen state.',
      ],
      recognize: ['Nested loop where the inner loop searches the prefix or suffix for one specific value.'],
      steps: [
        'Scan once.',
        'Query the map for the partner you need **before** inserting the current element.',
        'Insert the current element.',
      ],
      template: {
        lang: 'java',
        caption: 'Query-then-insert — the ordering that avoids using an element twice',
        code: `
Map<Integer,Integer> seen = new HashMap<>();
for (int i = 0; i < a.length; i++) {
    int need = target - a[i];
    if (seen.containsKey(need)) return new int[]{ seen.get(need), i };
    seen.put(a[i], i);              // insert AFTER the query
}`,
      },
      complexity: 'O(n) time, O(n) space.',
      gotchas: [
        'Insert after querying, or `x + x = target` incorrectly matches a single element.',
        'If duplicates must map to multiple indices, store a list or handle the first-occurrence rule explicitly.',
      ],
      problems: ['Two Sum', 'Contains Duplicate', 'Contains Duplicate II', 'Happy Number', 'Longest Consecutive Sequence'],
    },
    {
      id: 'canonical-key',
      name: 'Canonical Key / Group By Signature',
      oneLiner: 'Reduce every item to a normal form; equal normal forms go in the same bucket.',
      useWhen: ['Grouping equivalent items.', 'Detecting that two objects are "the same up to X".'],
      recognize: ['"Group all anagrams", "shifted strings", "points on the same line", "identical island shapes".'],
      steps: [
        'Define equivalence precisely.',
        'Invent a representation that is identical for equivalent items and different otherwise.',
        'Use `computeIfAbsent` to accumulate groups.',
      ],
      complexity: 'O(n · cost of building one key).',
      gotchas: [
        'The key must be **immutable and value-comparable** — use `String`, a record, or `Arrays.toString(int[])`, never a raw array (arrays hash by identity).',
        'Normalise signs and reduce by gcd for slope keys, otherwise `1/2` and `2/4` look different.',
      ],
      problems: ['Group Anagrams', 'Valid Anagram', 'Group Shifted Strings', 'Max Points on a Line', 'Number of Distinct Islands'],
    },
    {
      id: 'freq-count',
      name: 'Frequency Counting',
      oneLiner: 'Count occurrences, then answer the question from the counts.',
      useWhen: ['Majority, top-k, anagram checks, "can it be rearranged into a palindrome".'],
      recognize: ['Any question about how many times things appear.'],
      steps: [
        'Build the counts (array if the alphabet is small, map otherwise).',
        'If you need a ranking, bucket by count for O(n) or use a size-k heap for O(n log k).',
      ],
      template: {
        lang: 'java',
        caption: 'Bucket-by-frequency: sorting counts without a sort',
        code: `
int[] freq = new int[26];
for (char c : s.toCharArray()) freq[c - 'a']++;

// counts are bounded by n, so they can index an array
List<Character>[] bucket = new List[s.length() + 1];
for (int c = 0; c < 26; c++) {
    if (freq[c] == 0) continue;
    if (bucket[freq[c]] == null) bucket[freq[c]] = new ArrayList<>();
    bucket[freq[c]].add((char)('a' + c));
}
// walk bucket from high to low for descending frequency order`,
      },
      complexity: 'O(n) to count; O(n) with bucketing, O(n log k) with a heap.',
      gotchas: [
        'Palindrome permutation rule: at most one character may have an odd count.',
        'Do not forget uppercase, digits, or Unicode if the constraints allow them — `int[128]` or a map.',
      ],
      problems: ['Valid Anagram', 'Top K Frequent Elements', 'Sort Characters By Frequency', 'Majority Element', 'Ransom Note', 'First Unique Character in a String'],
    },
    {
      id: 'prefix-state-hash',
      name: 'Hash the Running State',
      oneLiner: 'Store a derived running value (prefix sum, prefix XOR, balance) and look for a matching earlier state.',
      useWhen: ['Counting or measuring subarrays with an additive property.'],
      recognize: ['"Subarray with sum / XOR / balance equal to X", "equal number of 0s and 1s".'],
      steps: [
        'Choose the running state so the property becomes "two states are equal" or "differ by k".',
        'Map state → count (for counting) or state → earliest index (for longest).',
        'Seed the map with the empty-prefix state.',
      ],
      complexity: 'O(n) time and space.',
      gotchas: ['Seeding `{0 → 1}` or `{0 → −1}` is mandatory and is the most commonly forgotten line.'],
      problems: ['Subarray Sum Equals K', 'Contiguous Array', 'Subarray Sums Divisible by K', 'Count Number of Nice Subarrays'],
    },
    {
      id: 'hash-plus-structure',
      name: 'Hash Map + Auxiliary Structure (O(1) design)',
      oneLiner: 'The map finds things instantly; a second structure maintains order or randomness.',
      useWhen: ['You are asked to design a cache or a container with all-O(1) operations.'],
      recognize: ['"Design … with O(1) average time for every operation".'],
      steps: [
        'Decide what the map must point *at*: a list index, or a node in a linked list.',
        'Make sure every operation keeps both structures consistent.',
        'Handle the self-referencing edge case (removing the last/only element).',
      ],
      complexity: 'O(1) per operation, O(n) space.',
      gotchas: [
        'For LRU, `LinkedHashMap` with access order is acceptable but most interviewers want the hand-rolled doubly linked list.',
        'Always use sentinel head/tail nodes in the DLL — it removes every null check.',
      ],
      problems: ['LRU Cache', 'LFU Cache', 'Insert Delete GetRandom O(1)', 'Design HashMap'],
    },
  ],

  pitfalls: [
    { title: 'Using an array as a map key', text: 'Java arrays hash by identity, so two equal `int[]` are different keys. Convert with `Arrays.toString` or use a `List`.' },
    { title: 'Inserting before querying', text: 'In complement problems this lets one element pair with itself.' },
    { title: 'Leaving zero counts in the map', text: 'Breaks any logic that uses `map.size()` as a distinct-count.' },
    { title: 'Assuming HashMap iteration order', text: 'It is unspecified and changes between runs and versions. Use `LinkedHashMap` or sort explicitly.' },
    { title: 'Boxing in hot loops', text: 'For bounded integer keys, an array is dramatically faster and simpler.' },
    { title: 'Quoting O(1) as a guarantee', text: 'Say "O(1) average". Hash-collision attacks are a real concern in web services, which is why Java treeifies buckets.' },
  ],

  cheatsheet: [
    { label: 'Increment', value: 'map.merge(k, 1, Integer::sum)' },
    { label: 'Group', value: 'computeIfAbsent(k, x -> new ArrayList<>())' },
    { label: 'Safe read', value: 'map.getOrDefault(k, 0)' },
    { label: 'Anagram key', value: 'sorted chars or int[26] signature' },
    { label: 'Top-k frequent', value: 'bucket by count → O(n)' },
    { label: 'Longest with property', value: 'map state → earliest index' },
    { label: 'Count with property', value: 'map state → occurrence count' },
    { label: 'Small alphabet', value: 'int[26] beats HashMap' },
    { label: 'Need floor/ceiling', value: 'TreeMap, not HashMap' },
    { label: 'O(1) random delete', value: 'swap with last + pop' },
    { label: 'LRU', value: 'HashMap + doubly linked list' },
  ],

  problems: [
    { name: 'Two Sum', difficulty: 'Easy', url: 'https://leetcode.com/problems/two-sum/', pattern: 'Complement lookup', insight: 'Query before inserting so an element never pairs with itself.' },
    { name: 'Contains Duplicate', difficulty: 'Easy', url: 'https://leetcode.com/problems/contains-duplicate/', pattern: 'Set membership', insight: 'Return early on the first failed add.' },
    { name: 'Valid Anagram', difficulty: 'Easy', url: 'https://leetcode.com/problems/valid-anagram/', pattern: 'Frequency count', insight: 'One int[26], increment for s and decrement for t; all zero at the end.' },
    { name: 'Ransom Note', difficulty: 'Easy', url: 'https://leetcode.com/problems/ransom-note/', pattern: 'Frequency count', insight: 'Count the magazine, then consume; fail on the first negative.' },
    { name: 'First Unique Character in a String', difficulty: 'Easy', url: 'https://leetcode.com/problems/first-unique-character-in-a-string/', pattern: 'Frequency count', insight: 'Two passes: count, then scan for the first count of 1.' },
    { name: 'Intersection of Two Arrays', difficulty: 'Easy', url: 'https://leetcode.com/problems/intersection-of-two-arrays/', pattern: 'Set intersection', insight: 'Hash the smaller array; probe with the larger.' },
    { name: 'Happy Number', difficulty: 'Easy', url: 'https://leetcode.com/problems/happy-number/', pattern: 'Seen-state set', insight: 'A repeat means a cycle. Floyd’s fast/slow also works with O(1) space.' },
    { name: 'Contains Duplicate II', difficulty: 'Easy', url: 'https://leetcode.com/problems/contains-duplicate-ii/', pattern: 'Sliding window set', insight: 'Keep a set of the last k elements, evicting as you move.' },
    { name: 'Isomorphic Strings', difficulty: 'Easy', url: 'https://leetcode.com/problems/isomorphic-strings/', pattern: 'Bijection maps', insight: 'You need BOTH directions; a single map accepts "badc" → "baba".' },
    { name: 'Word Pattern', difficulty: 'Easy', url: 'https://leetcode.com/problems/word-pattern/', pattern: 'Bijection maps', insight: 'Same as isomorphic strings, with words instead of characters.' },
    { name: 'Group Anagrams', difficulty: 'Medium', url: 'https://leetcode.com/problems/group-anagrams/', pattern: 'Canonical key', insight: 'Sorted string or a 26-count signature; the signature is faster for long words.' },
    { name: 'Top K Frequent Elements', difficulty: 'Medium', url: 'https://leetcode.com/problems/top-k-frequent-elements/', pattern: 'Frequency + bucket', insight: 'Bucket by count for O(n); mention the heap alternative for O(n log k).' },
    { name: 'Longest Consecutive Sequence', difficulty: 'Medium', url: 'https://leetcode.com/problems/longest-consecutive-sequence/', pattern: 'Set + head detection', insight: 'Only expand from values whose predecessor is absent — that is what makes it O(n).' },
    { name: 'Subarray Sum Equals K', difficulty: 'Medium', url: 'https://leetcode.com/problems/subarray-sum-equals-k/', pattern: 'Prefix state hash', insight: 'Seed the map with {0:1} to catch prefixes that themselves equal k.' },
    { name: 'Insert Delete GetRandom O(1)', difficulty: 'Medium', url: 'https://leetcode.com/problems/insert-delete-getrandom-o1/', pattern: 'Map + list', insight: 'Swap the doomed element with the last, fix its index, then pop.' },
    { name: 'Sort Characters By Frequency', difficulty: 'Medium', url: 'https://leetcode.com/problems/sort-characters-by-frequency/', pattern: 'Bucket by count', insight: 'Counts are bounded by the string length — bucket them.' },
    { name: 'Valid Sudoku', difficulty: 'Medium', url: 'https://leetcode.com/problems/valid-sudoku/', pattern: 'Composite keys', insight: 'One pass with three sets keyed "r3-5", "c7-5", "b1-5"; box id = (r/3)*3 + c/3.' },
    { name: 'Find All Anagrams in a String', difficulty: 'Medium', url: 'https://leetcode.com/problems/find-all-anagrams-in-a-string/', pattern: 'Window + counts', insight: 'Maintain a matches counter so each step is O(1) rather than O(26).' },
    { name: 'Copy List with Random Pointer', difficulty: 'Medium', url: 'https://leetcode.com/problems/copy-list-with-random-pointer/', pattern: 'Map old→new', insight: 'Two passes with a map, or interleave clones to achieve O(1) space.' },
    { name: 'Max Points on a Line', difficulty: 'Hard', url: 'https://leetcode.com/problems/max-points-on-a-line/', pattern: 'Canonical slope key', insight: 'Reduce dy/dx by gcd and normalise the sign; anchor on each point in turn.' },
    { name: 'LRU Cache', difficulty: 'Medium', url: 'https://leetcode.com/problems/lru-cache/', pattern: 'Map + doubly linked list', insight: 'Sentinel head and tail nodes eliminate every null check.' },
    { name: 'LFU Cache', difficulty: 'Hard', url: 'https://leetcode.com/problems/lfu-cache/', pattern: 'Map + frequency buckets', insight: 'Track minFreq; it only ever increases by one or resets to one on insert.' },
    { name: 'Substring with Concatenation of All Words', difficulty: 'Hard', url: 'https://leetcode.com/problems/substring-with-concatenation-of-all-words/', pattern: 'Window of word-counts', insight: 'Run wordLength separate windows, each stepping a whole word at a time.' },
  ],
}
