export default {
  id: 'math',
  title: 'Math & Number Theory',
  short: 'Math',
  icon: 'FunctionsRounded',
  tier: 'Advanced',
  order: 20,
  estHours: 8,
  prereqs: ['complexity'],
  tagline: 'The small toolbox that turns some O(n) problems into O(1) and some O(n²) into O(n log log n).',
  mentalModel:
    'Most "math" interview problems are not clever — they are careful. Know the handful of standard algorithms (GCD, sieve, fast power, modular arithmetic), then spend your attention on overflow and edge cases, which is where the marks actually are.',
  whyItMatters:
    'Number-theory questions show up as warm-ups and as hidden subroutines: modular exponentiation inside hashing, GCD inside fraction problems, the sieve inside anything about primes, and reservoir sampling inside stream design.',

  complexity: [
    { op: 'GCD (Euclid)', time: 'O(log min(a,b))', space: 'O(1)', note: 'Iterative form has no stack cost' },
    { op: 'Sieve of Eratosthenes', time: 'O(n log log n)', space: 'O(n)', note: 'All primes below n' },
    { op: 'Primality test (trial division)', time: 'O(√n)', space: 'O(1)', note: 'Check divisors up to √n only' },
    { op: 'Fast exponentiation', time: 'O(log n)', space: 'O(1)', note: 'Square-and-multiply' },
    { op: 'Prime factorisation', time: 'O(√n)', space: 'O(log n)', note: 'Divide out each factor' },
    { op: 'Combinations nCr with Pascal', time: 'O(n²)', space: 'O(n)', note: 'Or O(n) with modular inverses' },
    { op: 'Reservoir sampling', time: 'O(n)', space: 'O(k)', note: 'Stream of unknown length' },
  ],

  sections: [
    {
      id: 'toolkit',
      title: 'The standard toolbox',
      blocks: [
        {
          t: 'code',
          lang: 'java',
          caption: 'GCD, LCM and fast power — write these without thinking',
          code: `
// Euclid: gcd(a, b) = gcd(b, a mod b)
int gcd(int a, int b) {
    while (b != 0) { int t = a % b; a = b; b = t; }
    return a;
}

// lcm(a,b) = a / gcd * b  —  divide FIRST to avoid overflow
long lcm(int a, int b) { return (long) a / gcd(a, b) * b; }

// Fast exponentiation: a^n mod m in O(log n)
long power(long a, long n, long mod) {
    long result = 1;
    a %= mod;
    while (n > 0) {
        if ((n & 1) == 1) result = result * a % mod;   // odd exponent: take one a
        a = a * a % mod;                               // square the base
        n >>= 1;
    }
    return result;
}`,
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'Primes: trial division and the sieve',
          code: `
boolean isPrime(int n) {
    if (n < 2) return false;
    if (n % 2 == 0) return n == 2;
    for (int d = 3; (long) d * d <= n; d += 2)    // d*d as long avoids overflow
        if (n % d == 0) return false;
    return true;
}

// Sieve of Eratosthenes — all primes below n
boolean[] sieve(int n) {
    boolean[] composite = new boolean[n];
    for (int p = 2; (long) p * p < n; p++) {
        if (composite[p]) continue;
        for (int m = p * p; m < n; m += p)         // start at p*p, not 2p
            composite[m] = true;
    }
    return composite;   // composite[i] == false && i >= 2  =>  i is prime
}`,
        },
        {
          t: 'key',
          title: 'Two optimisations that matter',
          text: 'Trial division only needs divisors up to `√n`, because any factor above `√n` pairs with one below it. The sieve starts marking at `p²` because every smaller multiple of `p` already has a smaller prime factor and was marked earlier. Both halve or better the work, and both are the sort of detail interviewers listen for.',
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'Prime factorisation in O(√n)',
          code: `
Map<Integer,Integer> factorize(int n) {
    Map<Integer,Integer> f = new LinkedHashMap<>();
    for (int p = 2; (long) p * p <= n; p++)
        while (n % p == 0) { f.merge(p, 1, Integer::sum); n /= p; }
    if (n > 1) f.merge(n, 1, Integer::sum);    // the remaining n is itself prime
    return f;
}`,
        },
      ],
    },
    {
      id: 'modular',
      title: 'Modular arithmetic — the overflow discipline',
      blocks: [
        { t: 'p', text: 'Problems that say *"return the answer modulo 10⁹ + 7"* are telling you the true answer overflows. Take the modulus **at every step**, not at the end.' },
        {
          t: 'code',
          lang: 'java',
          caption: 'The four rules',
          code: `
final long MOD = 1_000_000_007L;

(a + b) % MOD
(a - b + MOD) % MOD              // ALWAYS add MOD before % for subtraction
(a * b) % MOD                    // both operands must already be < MOD, and be long
// division needs the MODULAR INVERSE, not '/':
//   a / b  mod p   ==   a * b^(p-2)  mod p     (Fermat, valid when p is prime)
long inverse(long b) { return power(b, MOD - 2, MOD); }`,
        },
        {
          t: 'trap',
          title: 'int × int overflows before the modulus is applied',
          text: '`int a = 1e9, b = 1e9; (a * b) % MOD` computes the product in 32-bit arithmetic **first**, wrapping to garbage, and then takes the modulus of the garbage. Declare intermediates as `long`, or cast: `((long) a * b) % MOD`.',
        },
        {
          t: 'warn',
          title: 'Java’s % can return a negative number',
          text: '`-7 % 3` is `-1` in Java, not `2`. For any problem involving remainders of possibly-negative values — "subarray sums divisible by k" is the classic — normalise with `((x % k) + k) % k`.',
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'Combinations modulo a prime',
          code: `
// Pascal's triangle: O(n^2), no division at all — safest under pressure
long[][] binom = new long[n + 1][n + 1];
for (int i = 0; i <= n; i++) {
    binom[i][0] = 1;
    for (int j = 1; j <= i; j++)
        binom[i][j] = (binom[i-1][j-1] + binom[i-1][j]) % MOD;
}

// Factorials + modular inverse: O(n) precompute, O(1) per query
long[] fact = new long[n + 1], inv = new long[n + 1];
fact[0] = 1;
for (int i = 1; i <= n; i++) fact[i] = fact[i-1] * i % MOD;
inv[n] = power(fact[n], MOD - 2, MOD);
for (int i = n; i > 0; i--) inv[i-1] = inv[i] * i % MOD;

long nCr(int a, int b) {
    if (b < 0 || b > a) return 0;
    return fact[a] * inv[b] % MOD * inv[a - b] % MOD;
}`,
        },
      ],
    },
    {
      id: 'digits',
      title: 'Digit manipulation and base conversion',
      blocks: [
        {
          t: 'code',
          lang: 'java',
          caption: 'The digit loop, and reversing with overflow detection',
          code: `
// Iterate digits from least significant
int sumDigits(int n) {
    int s = 0;
    while (n > 0) { s += n % 10; n /= 10; }
    return s;
}

// Reverse Integer — detect overflow BEFORE it happens
int reverse(int x) {
    int res = 0;
    while (x != 0) {
        int digit = x % 10;                       // works for negatives in Java
        x /= 10;
        // would res * 10 + digit overflow?
        if (res > Integer.MAX_VALUE / 10 ||
           (res == Integer.MAX_VALUE / 10 && digit > 7)) return 0;
        if (res < Integer.MIN_VALUE / 10 ||
           (res == Integer.MIN_VALUE / 10 && digit < -8)) return 0;
        res = res * 10 + digit;
    }
    return res;
}`,
        },
        {
          t: 'key',
          title: 'Check for overflow before you cause it',
          text: 'You cannot detect integer overflow after the fact in Java — the value has already wrapped. The pattern is always "would this operation exceed the limit?", expressed as a division against `MAX_VALUE`. Alternatively, accumulate in a `long` and range-check at the end.',
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'Palindrome Number without converting to a string',
          code: `
boolean isPalindrome(int x) {
    if (x < 0 || (x % 10 == 0 && x != 0)) return false;   // negatives and trailing 0

    int reversedHalf = 0;
    while (x > reversedHalf) {                    // stop at the middle
        reversedHalf = reversedHalf * 10 + x % 10;
        x /= 10;
    }
    return x == reversedHalf                      // even length
        || x == reversedHalf / 10;                // odd length: drop the middle digit
}`,
        },
      ],
    },
    {
      id: 'geometry-random',
      title: 'Light geometry and randomness',
      blocks: [
        {
          t: 'code',
          lang: 'java',
          caption: 'Geometry idioms that avoid floating point',
          code: `
// Squared distance — never call sqrt for comparisons
long dist2(int[] a, int[] b) {
    long dx = a[0] - b[0], dy = a[1] - b[1];
    return dx * dx + dy * dy;
}

// Collinearity / orientation via cross product (no division, no doubles)
long cross(int[] o, int[] a, int[] b) {
    return (long)(a[0] - o[0]) * (b[1] - o[1]) - (long)(a[1] - o[1]) * (b[0] - o[0]);
}
// cross > 0 -> counter-clockwise turn, < 0 -> clockwise, == 0 -> collinear

// Canonical slope key for "points on a line": reduce by gcd, normalise the sign
int[] slopeKey(int dx, int dy) {
    int g = gcd(Math.abs(dx), Math.abs(dy));
    if (g != 0) { dx /= g; dy /= g; }
    if (dx < 0 || (dx == 0 && dy < 0)) { dx = -dx; dy = -dy; }
    return new int[]{ dx, dy };
}`,
        },
        {
          t: 'tip',
          title: 'Avoid floating point wherever possible',
          text: 'Comparing squared distances, using cross products for orientation, and reducing slopes by GCD all keep the arithmetic exact. Floating-point equality tests are a genuine source of wrong answers in geometry problems.',
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'Reservoir sampling — uniform choice from a stream of unknown length',
          code: `
// Pick one item uniformly from a stream you can only read once.
int pick(Iterator<Integer> stream) {
    Random rnd = new Random();
    int chosen = 0, seen = 0;
    while (stream.hasNext()) {
        int x = stream.next();
        seen++;
        if (rnd.nextInt(seen) == 0) chosen = x;   // keep with probability 1/seen
    }
    return chosen;
}`,
        },
        {
          t: 'note',
          title: 'Why reservoir sampling is uniform',
          text: 'Item `i` is chosen at step `i` with probability `1/i`, and then survives each later step `j` with probability `(j−1)/j`. The product telescopes to `1/n`. Being able to give that one-line proof is what the question is testing.',
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'Fisher–Yates shuffle — the only correct in-place shuffle',
          code: `
void shuffle(int[] a) {
    Random rnd = new Random();
    for (int i = a.length - 1; i > 0; i--) {
        int j = rnd.nextInt(i + 1);       // inclusive of i — this matters
        int t = a[i]; a[i] = a[j]; a[j] = t;
    }
}
// Choosing j from the FULL range each time (rnd.nextInt(n)) produces a
// biased shuffle — a famous and subtle bug.`,
        },
      ],
    },
  ],

  patterns: [
    {
      id: 'gcd-pattern',
      name: 'GCD / LCM Reasoning',
      oneLiner: 'Reduce ratios, find cycle lengths, and detect divisibility structure.',
      useWhen: ['Fractions, repeating patterns, "water jug", slope normalisation.'],
      recognize: ['"Simplify the fraction", "how many times until they align", "collinear points".'],
      steps: ['Compute GCD with the iterative Euclid loop.', 'Reduce and normalise signs when using the result as a hash key.'],
      complexity: 'O(log min(a, b)).',
      gotchas: ['`lcm` overflows easily — divide before multiplying and use `long`.', 'Normalise slope signs or `(1,2)` and `(−1,−2)` become different keys.'],
      problems: ['Fraction to Recurring Decimal', 'Water and Jug Problem', 'Max Points on a Line', 'Number of Boomerangs'],
    },
    {
      id: 'sieve-pattern',
      name: 'Sieve / Precomputation',
      oneLiner: 'Compute all answers up to n once, then serve queries in O(1).',
      useWhen: ['Many primality or divisor queries below a bound.', 'Smallest prime factor tables for fast factorisation.'],
      recognize: ['"Count primes less than n", "how many numbers have exactly k divisors".'],
      steps: ['Allocate a table of size n.', 'Sweep multiples of each prime starting at p².', 'Read answers off the table.'],
      complexity: 'O(n log log n) time, O(n) space.',
      gotchas: ['`p * p` overflows `int` for large n — cast to `long` in the loop condition.', 'Remember that 0 and 1 are not prime.'],
      problems: ['Count Primes', 'Ugly Number II', 'Distinct Prime Factors of Product of Array'],
    },
    {
      id: 'fast-power',
      name: 'Fast Exponentiation',
      oneLiner: 'Square the base and halve the exponent — O(log n) instead of O(n).',
      useWhen: ['`pow(x, n)`, modular exponentiation, matrix power for linear recurrences.'],
      recognize: ['Huge exponents, "modulo 10⁹+7", "n-th Fibonacci with n up to 10¹⁸".'],
      steps: ['While the exponent is non-zero, multiply the result when the low bit is set, then square the base and shift.'],
      template: {
        lang: 'java',
        caption: 'Handling a negative exponent safely',
        code: `
double myPow(double x, int n) {
    long e = n;                       // widen FIRST: -Integer.MIN_VALUE overflows int
    if (e < 0) { x = 1 / x; e = -e; }

    double result = 1;
    while (e > 0) {
        if ((e & 1) == 1) result *= x;
        x *= x;
        e >>= 1;
    }
    return result;
}`,
      },
      complexity: 'O(log n).',
      gotchas: ['`-Integer.MIN_VALUE` overflows — widen to `long` before negating.', 'Under a modulus, reduce after every multiplication.'],
      problems: ['Pow(x, n)', 'Super Pow', 'Count Good Numbers'],
    },
    {
      id: 'modular-pattern',
      name: 'Modular Arithmetic Discipline',
      oneLiner: 'Reduce at every step; add the modulus before subtracting; use inverses for division.',
      useWhen: ['The problem says "modulo 10⁹ + 7".'],
      recognize: ['Counting problems with astronomically large answers.'],
      steps: ['Declare all accumulators as `long`.', 'Apply `% MOD` after every addition and multiplication.', 'For division, multiply by the modular inverse.'],
      complexity: 'O(1) per operation, O(log p) for an inverse.',
      gotchas: ['`int * int` overflows before the modulus applies — cast to `long`.', 'Java `%` can be negative; normalise with `((x % m) + m) % m`.'],
      problems: ['Count Good Numbers', 'Number of Ways to Reorder Array to Get Same BST', 'Knight Dialer'],
    },
    {
      id: 'sampling',
      name: 'Randomised Selection',
      oneLiner: 'Reservoir sampling for streams; Fisher–Yates for shuffles; prefix sums for weighted picks.',
      useWhen: ['Uniform choice from unknown-length data, random shuffling, weighted random selection.'],
      recognize: ['"Pick a random node", "shuffle an array", "random pick with weight".'],
      steps: [
        'Stream: keep the current item with probability `1/seen`.',
        'Shuffle: swap `i` with a random index in `[0, i]`.',
        'Weighted: build prefix sums and binary search a random value.',
      ],
      complexity: 'O(n) for a pass; O(log n) per weighted pick.',
      gotchas: ['Fisher–Yates must draw from the *shrinking* range, or the shuffle is biased.', 'Weighted picking uses `upperBound` on the prefix array.'],
      problems: ['Linked List Random Node', 'Random Pick Index', 'Shuffle an Array', 'Random Pick with Weight'],
    },
  ],

  pitfalls: [
    { title: 'int overflow in products', text: 'Cast one operand to `long` before multiplying.' },
    { title: 'Negative modulo', text: 'Java `%` keeps the sign of the dividend. Normalise.' },
    { title: 'Checking divisors past √n', text: 'Wastes a factor of √n and signals unfamiliarity.' },
    { title: 'Floating-point equality', text: 'Use cross products and squared distances instead of slopes and square roots.' },
    { title: 'Negating Integer.MIN_VALUE', text: 'Widen to `long` first.' },
    { title: 'Biased shuffles', text: 'Drawing the swap index from the full range every iteration is a classic bug.' },
  ],

  cheatsheet: [
    { label: 'GCD', value: 'while (b) { t=a%b; a=b; b=t; }' },
    { label: 'LCM', value: 'a / gcd * b (divide first)' },
    { label: 'Primality', value: 'divisors up to √n' },
    { label: 'Sieve start', value: 'mark from p², step p' },
    { label: 'Fast power', value: 'square base, shift exponent' },
    { label: 'Modular subtract', value: '(a − b + MOD) % MOD' },
    { label: 'Modular divide', value: 'multiply by b^(p−2)' },
    { label: 'Safe product', value: '((long) a * b) % MOD' },
    { label: 'Negative mod fix', value: '((x % k) + k) % k' },
    { label: 'Digits', value: 'n % 10, n /= 10' },
    { label: 'Compare distances', value: 'use squared, never sqrt' },
    { label: 'Orientation', value: 'cross product sign' },
    { label: 'Stream sample', value: 'keep with probability 1/seen' },
    { label: 'Shuffle', value: 'Fisher–Yates, shrinking range' },
  ],

  problems: [
    { name: 'Palindrome Number', difficulty: 'Easy', url: 'https://leetcode.com/problems/palindrome-number/', pattern: 'Digit manipulation', insight: 'Reverse only half the number to avoid overflow entirely.' },
    { name: 'Fizz Buzz', difficulty: 'Easy', url: 'https://leetcode.com/problems/fizz-buzz/', pattern: 'Modulo', insight: 'A warm-up, but check the divisibility order: 15 before 3 and 5.' },
    { name: 'Happy Number', difficulty: 'Easy', url: 'https://leetcode.com/problems/happy-number/', pattern: 'Digit + cycle detection', insight: 'Use a set, or Floyd fast/slow for O(1) space.' },
    { name: 'Excel Sheet Column Number', difficulty: 'Easy', url: 'https://leetcode.com/problems/excel-sheet-column-number/', pattern: 'Base conversion', insight: 'Base 26, but 1-indexed — A is 1, not 0.' },
    { name: 'Plus One', difficulty: 'Easy', url: 'https://leetcode.com/problems/plus-one/', pattern: 'Carry propagation', insight: 'All-nines needs an extra leading digit.' },
    { name: 'Add Binary', difficulty: 'Easy', url: 'https://leetcode.com/problems/add-binary/', pattern: 'Carry propagation', insight: 'Walk both strings from the back with a carry; append and reverse.' },
    { name: 'Count Primes', difficulty: 'Medium', url: 'https://leetcode.com/problems/count-primes/', pattern: 'Sieve', insight: 'Start marking at p² and cast p*p to long in the loop condition.' },
    { name: 'Pow(x, n)', difficulty: 'Medium', url: 'https://leetcode.com/problems/powx-n/', pattern: 'Fast power', insight: 'Widen n to long before negating.' },
    { name: 'Reverse Integer', difficulty: 'Medium', url: 'https://leetcode.com/problems/reverse-integer/', pattern: 'Digit + overflow guard', insight: 'Detect the overflow before performing the multiplication.' },
    { name: 'Ugly Number II', difficulty: 'Medium', url: 'https://leetcode.com/problems/ugly-number-ii/', pattern: 'Three-pointer DP', insight: 'Three pointers into the result array generating multiples of 2, 3 and 5.' },
    { name: 'Fraction to Recurring Decimal', difficulty: 'Medium', url: 'https://leetcode.com/problems/fraction-to-recurring-decimal/', pattern: 'Long division + map', insight: 'A repeated remainder marks the start of the cycle — record remainder → position.' },
    { name: 'Random Pick with Weight', difficulty: 'Medium', url: 'https://leetcode.com/problems/random-pick-with-weight/', pattern: 'Prefix sums + binary search', insight: 'Draw a uniform value in [0, total) and upper-bound it in the prefix array.' },
    { name: 'Shuffle an Array', difficulty: 'Medium', url: 'https://leetcode.com/problems/shuffle-an-array/', pattern: 'Fisher–Yates', insight: 'Draw from the shrinking range, inclusive of i.' },
    { name: 'Linked List Random Node', difficulty: 'Medium', url: 'https://leetcode.com/problems/linked-list-random-node/', pattern: 'Reservoir sampling', insight: 'Keep the i-th node with probability 1/i; the telescoping product is the proof.' },
    { name: 'Rectangle Area', difficulty: 'Medium', url: 'https://leetcode.com/problems/rectangle-area/', pattern: 'Geometry', insight: 'Overlap width is max(0, min(rights) − max(lefts)); use long for the sums.' },
    { name: 'Integer to Roman', difficulty: 'Medium', url: 'https://leetcode.com/problems/integer-to-roman/', pattern: 'Greedy table', insight: 'Include the subtractive pairs (CM, CD, XC…) in the value table and go greedy.' },
    { name: 'Basic Calculator', difficulty: 'Hard', url: 'https://leetcode.com/problems/basic-calculator/', pattern: 'Stack parsing', insight: 'Push the running result and sign when entering a parenthesis.' },
    { name: 'Max Points on a Line', difficulty: 'Hard', url: 'https://leetcode.com/problems/max-points-on-a-line/', pattern: 'Slope normalisation', insight: 'Reduce dy/dx by gcd and fix the sign; anchor at each point.' },
    { name: 'Super Pow', difficulty: 'Medium', url: 'https://leetcode.com/problems/super-pow/', pattern: 'Fast power', insight: 'a^[d1,d2,d3] = (a^[d1,d2])^10 · a^d3 — process the digit array recursively.' },
    { name: 'Count Good Numbers', difficulty: 'Medium', url: 'https://leetcode.com/problems/count-good-numbers/', pattern: 'Fast power + modulo', insight: '5^(ceil(n/2)) · 4^(floor(n/2)) mod 1e9+7.' },
  ],
}
