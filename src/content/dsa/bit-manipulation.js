export default {
  id: 'bit-manipulation',
  title: 'Bit Manipulation',
  short: 'Bit Manipulation',
  icon: 'MemoryRounded',
  tier: 'Advanced',
  order: 19,
  estHours: 6,
  prereqs: ['complexity'],
  tagline: 'A dozen idioms that turn loops into single operations — and make bitmask DP possible.',
  mentalModel:
    'An integer is 32 booleans. Anything you would store in a small `boolean[]` or `Set<Integer>` over a tiny universe can be an `int` instead, with set operations costing one CPU instruction.',
  whyItMatters:
    'Beyond the party tricks, bits matter for two real reasons: **bitmask DP** (representing a subset of ≤ 20 items as an index) and **XOR’s cancellation property**, which solves an entire family of "find the odd one out" problems in O(1) space.',

  complexity: [
    { op: 'Any bitwise operation', time: 'O(1)', space: 'O(1)', note: 'Single CPU instruction' },
    { op: 'Count set bits (Brian Kernighan)', time: 'O(set bits)', space: 'O(1)', note: 'Faster than checking all 32' },
    { op: '`Integer.bitCount`', time: 'O(1)', space: 'O(1)', note: 'Compiles to a POPCNT instruction' },
    { op: 'Enumerate all subsets of n items', time: 'O(2ⁿ)', space: 'O(1)', note: 'Loop mask from 0 to 2ⁿ − 1' },
    { op: 'Enumerate submasks of a mask', time: 'O(3ⁿ) total', space: 'O(1)', note: 'Summed over all masks' },
    { op: 'Bitmask DP', time: 'O(2ⁿ · n)', space: 'O(2ⁿ)', note: 'Practical to n ≈ 20' },
  ],

  sections: [
    {
      id: 'idioms',
      title: 'The idioms — memorise these',
      blocks: [
        {
          t: 'code',
          lang: 'java',
          caption: 'The core toolkit',
          code: `
// --- single-bit operations (i is 0-indexed from the LSB) ---
x |  (1 << i)        // SET bit i
x & ~(1 << i)        // CLEAR bit i
x ^  (1 << i)        // TOGGLE bit i
(x >> i) & 1         // READ bit i
(x & (1 << i)) != 0  // TEST bit i

// --- whole-number tricks ---
x & (x - 1)          // clear the LOWEST set bit
x & -x               // isolate the LOWEST set bit  (a.k.a. lowbit)
x | (x + 1)          // set the lowest CLEAR bit
x & (x - 1) == 0     // is x a power of two? (also require x > 0)

// --- arithmetic in disguise ---
x << 1               // multiply by 2
x >> 1               // divide by 2 (floor, for non-negatives)
x >>> 1              // UNSIGNED right shift — fills with 0, not the sign bit
x & 1                // parity: 1 if odd
(x ^ y) < 0          // do x and y have different signs?

// --- Java helpers you should name in an interview ---
Integer.bitCount(x);              // popcount
Integer.highestOneBit(x);         // largest power of 2 <= x
Integer.numberOfTrailingZeros(x); // index of the lowest set bit
Integer.toBinaryString(x);
Integer.reverse(x);`,
        },
        {
          t: 'key',
          title: 'x & (x−1) is the most useful trick in the chapter',
          text: 'Subtracting 1 flips the lowest set bit to 0 and turns every bit below it into 1. ANDing therefore *removes* the lowest set bit. It gives you popcount in `O(set bits)`, an instant power-of-two test, and the core of several DP transitions.',
        },
        {
          t: 'ascii',
          caption: 'Why x & (x−1) clears the lowest set bit.',
          code: `
    x     = 1 0 1 1 0 0 0      (88)
    x - 1 = 1 0 1 0 1 1 1      borrow flips the lowest 1 and everything below
    -----------------------
    x&(x-1)=1 0 1 0 0 0 0      lowest set bit gone

    x     = 1 0 1 1 0 0 0
   -x     = 0 1 0 1 0 0 0      two's complement = ~x + 1
    -----------------------
    x & -x = 0 0 0 1 0 0 0      only the lowest set bit remains`,
        },
        {
          t: 'warn',
          title: '>> versus >>>',
          text: 'Java’s `>>` preserves the sign bit, so `-8 >> 1 == -4`. `>>>` fills with zeros, so `-8 >>> 1` is a huge positive number. When you are iterating over the 32 bits of a possibly-negative number, use `>>>` or you get an infinite loop.',
        },
        {
          t: 'trap',
          title: 'Operator precedence will bite you',
          text: 'In Java, `==` binds **tighter** than `&`. So `x & 1 == 0` parses as `x & (1 == 0)` and does not compile (or, in C, silently misbehaves). Always parenthesise: `(x & 1) == 0`.',
        },
      ],
    },
    {
      id: 'xor',
      title: 'XOR — the cancellation engine',
      blocks: [
        {
          t: 'dl',
          items: [
            { term: '`x ^ x = 0`', def: 'A value XORed with itself vanishes. This is *the* property.' },
            { term: '`x ^ 0 = x`', def: 'Zero is the identity.' },
            { term: 'Commutative & associative', def: 'Order does not matter, so you can XOR a whole array in any sequence.' },
            { term: '`a ^ b ^ b = a`', def: 'XOR is its own inverse — which is why it works for toggling and for simple encryption.' },
          ],
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'The XOR family of problems',
          code: `
// Single Number: every element appears twice except one
int singleNumber(int[] a) {
    int x = 0;
    for (int v : a) x ^= v;          // pairs cancel, the loner survives
    return x;
}

// Missing Number in [0..n]
int missingNumber(int[] a) {
    int x = a.length;                 // start with n, since indices only go to n-1
    for (int i = 0; i < a.length; i++) x ^= i ^ a[i];
    return x;
}

// Single Number III: exactly TWO elements appear once
int[] singleNumberIII(int[] a) {
    int xor = 0;
    for (int v : a) xor ^= v;         // xor == p ^ q  (the two loners)

    int bit = xor & -xor;             // any bit where p and q DIFFER
    int p = 0, q = 0;
    for (int v : a) {                 // partition the array by that bit
        if ((v & bit) != 0) p ^= v;
        else                q ^= v;
    }
    return new int[]{ p, q };
}`,
        },
        {
          t: 'key',
          title: 'The partition trick',
          text: 'When two unique numbers hide among pairs, their XOR is non-zero, so at least one bit differs. Isolate any such bit with `xor & -xor` and split the array on it — each half now contains exactly one loner and the simple XOR works. This is the one genuinely clever XOR problem, and it generalises.',
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'Single Number II — every element appears three times except one',
          code: `
// Counting bits modulo 3: for each bit position, the count is a multiple of 3
// plus possibly the loner's contribution.
int singleNumberII(int[] a) {
    int result = 0;
    for (int b = 0; b < 32; b++) {
        int count = 0;
        for (int v : a) count += (v >> b) & 1;
        if (count % 3 != 0) result |= (1 << b);
    }
    return result;
}
// The O(1)-space "ones/twos" state-machine version is slicker but harder to
// derive under pressure; this one is always safe.`,
        },
        {
          t: 'tip',
          title: 'Prefix XOR is prefix sum',
          text: 'XOR is associative and self-inverse, so `xor(l..r) = prefix[r+1] ^ prefix[l]` — exactly like prefix sums but with XOR. Every prefix-sum-plus-hash-map technique from the Arrays chapter transfers directly to XOR problems.',
        },
      ],
    },
    {
      id: 'subsets',
      title: 'Bitmasks as sets',
      blocks: [
        { t: 'p', text: 'With `n ≤ 20`, a subset of `{0, …, n−1}` is just an integer. Set operations become single instructions, which is what makes bitmask DP fast enough.' },
        {
          t: 'code',
          lang: 'java',
          caption: 'Set algebra with integers',
          code: `
int A = 0b1011, B = 0b0110;

A | B                 // union
A & B                 // intersection
A & ~B                // difference (A minus B)
A ^ B                 // symmetric difference
(A & B) == B          // is B a subset of A?
Integer.bitCount(A)   // cardinality
A == 0                // empty?
(1 << n) - 1          // the FULL set of n elements

// enumerate ALL subsets of n elements
for (int mask = 0; mask < (1 << n); mask++) { /* ... */ }

// enumerate every SUBMASK of a given mask (descending, includes mask, excludes 0)
for (int s = mask; s > 0; s = (s - 1) & mask) { /* ... */ }

// iterate the SET BITS only — O(popcount), not O(32)
for (int m = mask; m != 0; m &= m - 1) {
    int i = Integer.numberOfTrailingZeros(m);   // index of the lowest set bit
}`,
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'Generate all subsets without recursion',
          code: `
List<List<Integer>> subsets(int[] a) {
    int n = a.length;
    List<List<Integer>> out = new ArrayList<>(1 << n);

    for (int mask = 0; mask < (1 << n); mask++) {
        List<Integer> sub = new ArrayList<>(Integer.bitCount(mask));
        for (int i = 0; i < n; i++)
            if ((mask & (1 << i)) != 0) sub.add(a[i]);
        out.add(sub);
    }
    return out;
}`,
        },
        {
          t: 'note',
          title: 'Counting Bits — the DP that uses a bit trick',
          text: '`dp[i] = dp[i >> 1] + (i & 1)` — the number of set bits in `i` equals the count for `i/2` plus its last bit. Alternatively `dp[i] = dp[i & (i−1)] + 1`. Both are `O(n)` and both are much nicer than calling `bitCount` n times.',
        },
      ],
    },
    {
      id: 'arithmetic',
      title: 'Arithmetic without arithmetic',
      blocks: [
        {
          t: 'code',
          lang: 'java',
          caption: 'Sum of Two Integers — addition via XOR and AND',
          code: `
int getSum(int a, int b) {
    while (b != 0) {
        int carry = (a & b) << 1;   // bits where BOTH are 1 produce a carry
        a = a ^ b;                  // XOR is addition without carrying
        b = carry;                  // now add the carry in
    }
    return a;
}`,
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'Divide Two Integers without / or % — repeated doubling',
          code: `
int divide(int dividend, int divisor) {
    if (dividend == Integer.MIN_VALUE && divisor == -1) return Integer.MAX_VALUE;

    boolean negative = (dividend < 0) ^ (divisor < 0);
    long a = Math.abs((long) dividend), b = Math.abs((long) divisor);
    long result = 0;

    while (a >= b) {
        long temp = b, multiple = 1;
        while (a >= (temp << 1)) { temp <<= 1; multiple <<= 1; }   // double greedily
        a -= temp;
        result += multiple;
    }
    return negative ? (int) -result : (int) result;
}`,
        },
        {
          t: 'trap',
          title: 'The MIN_VALUE overflow case',
          text: '`Math.abs(Integer.MIN_VALUE)` is still `Integer.MIN_VALUE` — there is no positive counterpart in two’s complement. Promote to `long` before taking the absolute value, and special-case `MIN_VALUE / −1`. Interviewers plant this every single time.',
        },
      ],
    },
  ],

  patterns: [
    {
      id: 'xor-cancel',
      name: 'XOR Cancellation',
      oneLiner: 'Pairs annihilate, so whatever survives is the odd one out.',
      useWhen: ['Elements appear an even number of times except one.', 'Finding a missing or duplicated value in O(1) space.'],
      recognize: ['"Every element appears twice except one", "find the missing number", "find the duplicate".'],
      steps: ['XOR everything.', 'For two loners, split on a differing bit and XOR each half.'],
      complexity: 'O(n) time, O(1) space.',
      gotchas: ['Only works when the repetition count is even (or handled explicitly, as in the mod-3 variant).', '`xor & -xor` isolates a differing bit — remember the two’s complement identity.'],
      problems: ['Single Number', 'Single Number II', 'Single Number III', 'Missing Number', 'Find the Difference'],
    },
    {
      id: 'bitmask-set',
      name: 'Bitmask as a Set',
      oneLiner: 'A subset of ≤ 20 items is an integer; set operations are single instructions.',
      useWhen: ['Enumerating subsets.', 'Tracking "which items have I used" inside DP or backtracking.'],
      recognize: ['`n ≤ 20` together with "all subsets", "assign each item exactly once", "visit all nodes".'],
      steps: ['Map item `i` to bit `i`.', 'Loop masks `0 .. 2ⁿ − 1`, or DFS adding one bit at a time.', 'Memoise on the mask.'],
      template: {
        lang: 'java',
        caption: 'Bitmask DP skeleton (Travelling Salesman shape)',
        code: `
int[][] dp = new int[1 << n][n];
for (int[] row : dp) Arrays.fill(row, INF);
dp[1][0] = 0;                                     // start at node 0

for (int mask = 1; mask < (1 << n); mask++)
    for (int last = 0; last < n; last++) {
        if ((mask & (1 << last)) == 0) continue;  // 'last' must be in the set
        if (dp[mask][last] == INF) continue;
        for (int next = 0; next < n; next++) {
            if ((mask & (1 << next)) != 0) continue;   // already visited
            int nm = mask | (1 << next);
            dp[nm][next] = Math.min(dp[nm][next], dp[mask][last] + cost[last][next]);
        }
    }`,
      },
      complexity: 'O(2ⁿ · n²) for TSP; O(2ⁿ · n) for simpler assignments.',
      gotchas: ['Only for n ≤ 20 — 2²⁰ is about a million states.', '`Integer.bitCount(mask)` often encodes "how far along am I", removing a dimension.'],
      problems: ['Partition to K Equal Sum Subsets', 'Shortest Path Visiting All Nodes', 'Find the Shortest Superstring', 'Maximum Students Taking Exam', 'Beautiful Arrangement'],
    },
    {
      id: 'bit-tricks',
      name: 'Low-Bit Tricks',
      oneLiner: 'Isolate or clear the lowest set bit to loop only over the bits that matter.',
      useWhen: ['Counting set bits, iterating a sparse mask, Fenwick trees.'],
      recognize: ['"Number of 1 bits", "power of two", "counting bits".'],
      steps: ['`x & (x−1)` clears the lowest set bit — loop until zero.', '`x & -x` isolates it, and `numberOfTrailingZeros` converts it to an index.'],
      complexity: 'O(number of set bits).',
      gotchas: ['Power-of-two test must also require `x > 0`.', 'Use `>>>` when the value may be negative.'],
      problems: ['Number of 1 Bits', 'Counting Bits', 'Power of Two', 'Reverse Bits', 'Hamming Distance'],
    },
    {
      id: 'bit-arithmetic',
      name: 'Arithmetic via Bits',
      oneLiner: 'XOR adds without carry; AND-shift produces the carry; doubling replaces division.',
      useWhen: ['Explicitly forbidden from using +, −, × or ÷.'],
      recognize: ['"Without using the operator …".'],
      steps: ['Addition: loop XOR and carry until the carry is zero.', 'Division: subtract the largest doubled divisor repeatedly.'],
      complexity: 'O(32) per operation.',
      gotchas: ['Promote to `long` before `Math.abs` to survive `Integer.MIN_VALUE`.', 'Clamp the `MIN_VALUE / −1` overflow case.'],
      problems: ['Sum of Two Integers', 'Divide Two Integers', 'Multiply Strings'],
    },
  ],

  pitfalls: [
    { title: 'Operator precedence', text: '`==` binds tighter than `&`. Parenthesise every bitwise comparison.' },
    { title: 'Using >> on negative numbers in a bit loop', text: 'Sign extension makes it loop forever. Use `>>>`.' },
    { title: 'Shifting by 32 or more', text: 'Java masks the shift count to 5 bits, so `1 << 32` equals `1`. Use `1L << 32` for 64-bit work.' },
    { title: 'Math.abs(Integer.MIN_VALUE)', text: 'Returns itself. Promote to `long` first.' },
    { title: 'Using 1 << i with longs', text: '`1 << 40` overflows to garbage. Write `1L << 40`.' },
    { title: 'Reaching for bit tricks when clarity matters', text: 'In production, `x % 2 == 0` is clearer than `(x & 1) == 0` and compiles to the same thing.' },
  ],

  cheatsheet: [
    { label: 'Set bit i', value: 'x | (1 << i)' },
    { label: 'Clear bit i', value: 'x & ~(1 << i)' },
    { label: 'Toggle bit i', value: 'x ^ (1 << i)' },
    { label: 'Test bit i', value: '(x >> i) & 1' },
    { label: 'Clear lowest set bit', value: 'x & (x − 1)' },
    { label: 'Isolate lowest set bit', value: 'x & −x' },
    { label: 'Power of two', value: 'x > 0 && (x & (x−1)) == 0' },
    { label: 'Popcount', value: 'Integer.bitCount(x)' },
    { label: 'Full set of n', value: '(1 << n) − 1' },
    { label: 'All submasks', value: 's = (s − 1) & mask' },
    { label: 'XOR identities', value: 'x^x=0, x^0=x' },
    { label: 'Two loners', value: 'split on xor & −xor' },
    { label: 'Counting bits DP', value: 'dp[i] = dp[i>>1] + (i&1)' },
    { label: 'Unsigned shift', value: '>>>' },
  ],

  problems: [
    { name: 'Number of 1 Bits', difficulty: 'Easy', url: 'https://leetcode.com/problems/number-of-1-bits/', pattern: 'Low-bit trick', insight: 'Loop `x &= x − 1` — one iteration per set bit.' },
    { name: 'Counting Bits', difficulty: 'Easy', url: 'https://leetcode.com/problems/counting-bits/', pattern: 'Bit DP', insight: 'dp[i] = dp[i >> 1] + (i & 1).' },
    { name: 'Single Number', difficulty: 'Easy', url: 'https://leetcode.com/problems/single-number/', pattern: 'XOR', insight: 'The purest use of cancellation.' },
    { name: 'Missing Number', difficulty: 'Easy', url: 'https://leetcode.com/problems/missing-number/', pattern: 'XOR', insight: 'XOR the indices with the values; also solvable with n(n+1)/2.' },
    { name: 'Reverse Bits', difficulty: 'Easy', url: 'https://leetcode.com/problems/reverse-bits/', pattern: 'Bit shifting', insight: 'Build the result left-shifting while right-shifting the input; use `>>>`.' },
    { name: 'Power of Two', difficulty: 'Easy', url: 'https://leetcode.com/problems/power-of-two/', pattern: 'Low-bit trick', insight: '`n > 0 && (n & (n − 1)) == 0`.' },
    { name: 'Hamming Distance', difficulty: 'Easy', url: 'https://leetcode.com/problems/hamming-distance/', pattern: 'XOR + popcount', insight: 'bitCount(x ^ y).' },
    { name: 'Complement of Base 10 Integer', difficulty: 'Easy', url: 'https://leetcode.com/problems/complement-of-base-10-integer/', pattern: 'Mask construction', insight: 'Build a mask of all 1s up to the highest set bit, then XOR.' },
    { name: 'Single Number II', difficulty: 'Medium', url: 'https://leetcode.com/problems/single-number-ii/', pattern: 'Bit counting mod 3', insight: 'Count each bit position modulo 3 — safe and easy to derive.' },
    { name: 'Single Number III', difficulty: 'Medium', url: 'https://leetcode.com/problems/single-number-iii/', pattern: 'XOR + partition', insight: 'Split the array on any bit where the two loners differ.' },
    { name: 'Subsets', difficulty: 'Medium', url: 'https://leetcode.com/problems/subsets/', pattern: 'Bitmask enumeration', insight: 'Loop masks 0 to 2ⁿ − 1; no recursion needed.' },
    { name: 'Sum of Two Integers', difficulty: 'Medium', url: 'https://leetcode.com/problems/sum-of-two-integers/', pattern: 'Bit arithmetic', insight: 'XOR is sum-without-carry; (a & b) << 1 is the carry.' },
    { name: 'Bitwise AND of Numbers Range', difficulty: 'Medium', url: 'https://leetcode.com/problems/bitwise-and-of-numbers-range/', pattern: 'Common prefix', insight: 'The answer is the common binary prefix of left and right — shift both until equal.' },
    { name: 'Maximum Product of Word Lengths', difficulty: 'Medium', url: 'https://leetcode.com/problems/maximum-product-of-word-lengths/', pattern: 'Bitmask as a set', insight: 'Disjoint letter sets is one AND operation.' },
    { name: 'Divide Two Integers', difficulty: 'Medium', url: 'https://leetcode.com/problems/divide-two-integers/', pattern: 'Bit arithmetic', insight: 'Repeated doubling; handle MIN_VALUE / −1 explicitly.' },
    { name: 'Gray Code', difficulty: 'Medium', url: 'https://leetcode.com/problems/gray-code/', pattern: 'Bit construction', insight: 'The i-th Gray code is `i ^ (i >> 1)`.' },
    { name: 'Find the Duplicate Number', difficulty: 'Medium', url: 'https://leetcode.com/problems/find-the-duplicate-number/', pattern: 'Bit counting / Floyd', insight: 'Count set bits per position across values and indices, or use cycle detection.' },
    { name: 'Maximum XOR of Two Numbers in an Array', difficulty: 'Medium', url: 'https://leetcode.com/problems/maximum-xor-of-two-numbers-in-an-array/', pattern: 'Bit trie / prefix set', insight: 'Build the answer bit by bit from the top, testing candidates with a hash set.' },
    { name: 'Shortest Path Visiting All Nodes', difficulty: 'Hard', url: 'https://leetcode.com/problems/shortest-path-visiting-all-nodes/', pattern: 'Bitmask BFS', insight: 'State is (node, visitedMask); BFS because every edge costs 1.' },
    { name: 'Maximum Students Taking Exam', difficulty: 'Hard', url: 'https://leetcode.com/problems/maximum-students-taking-exam/', pattern: 'Bitmask DP per row', insight: 'Enumerate valid seat masks per row and check compatibility with the row above.' },
  ],
}
