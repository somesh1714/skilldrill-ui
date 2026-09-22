export default {
  id: 'strings',
  title: 'Strings — Parsing, Palindromes & Pattern Matching',
  short: 'Strings',
  icon: 'TextFieldsRounded',
  tier: 'Foundations',
  order: 6,
  estHours: 12,
  prereqs: ['arrays', 'hashing'],
  tagline: 'A string is an array with a small alphabet and a lot of hidden costs. Both facts matter.',
  mentalModel:
    'Treat a string as `char[]` plus a 26-slot counting array. The small alphabet is a gift — it turns "set of characters" into a single integer bitmask and "frequency map" into a fixed-size array.',
  whyItMatters:
    'String questions are where hidden complexity kills candidates: `substring`, `+=`, and `charAt` in the wrong place quietly turn linear algorithms quadratic. They are also where the elegant classics live — KMP, Manacher, rolling hashes.',

  complexity: [
    { op: '`charAt(i)`', time: 'O(1)', space: '—', note: 'Java strings are backed by an array' },
    { op: '`substring(i, j)`', time: 'O(j − i)', space: 'O(j − i)', note: 'Copies since Java 7 — not a view' },
    { op: '`s + t` in a loop', time: 'O(n²)', space: 'O(n²)', note: 'Use StringBuilder' },
    { op: '`StringBuilder.append`', time: 'O(1) amortised', space: 'O(n)', note: 'The correct way to build' },
    { op: 'Naive pattern search', time: 'O(n · m)', space: 'O(1)', note: 'Fine for small m' },
    { op: 'KMP', time: 'O(n + m)', space: 'O(m)', note: 'Prefix function / failure table' },
    { op: 'Rabin–Karp', time: 'O(n + m) avg', space: 'O(1)', note: 'Rolling hash, worst case O(n·m)' },
    { op: 'Expand-around-centre palindromes', time: 'O(n²)', space: 'O(1)', note: '2n − 1 centres' },
    { op: 'Manacher', time: 'O(n)', space: 'O(n)', note: 'Longest palindromic substring, optimal' },
  ],

  sections: [
    {
      id: 'costs',
      title: 'The hidden costs that ruin string solutions',
      blocks: [
        { t: 'lead', text: 'Before any algorithm, internalise what each operation actually costs in Java. This is where most "why is my solution TLE?" questions come from.' },
        {
          t: 'compare',
          left: {
            title: 'Correct — O(n)',
            items: [
              '`StringBuilder sb; for (…) sb.append(c);`',
              '`s.charAt(i)` inside loops',
              '`char[] arr = s.toCharArray();` once, then index it',
              'Two indices `(l, r)` describing a slice, no copying',
            ],
          },
          right: {
            title: 'Quadratic — O(n²)',
            items: [
              '`String out = ""; for (…) out += c;`',
              '`s.substring(i, j)` inside a nested loop',
              '`s = s + t` accumulating in a loop',
              '`s.replace(...)` repeatedly on a growing string',
            ],
          },
        },
        {
          t: 'key',
          title: 'Strings are immutable in Java',
          text: 'Every `+` allocates a new string and copies both operands. In a loop of `n` appends that is `1 + 2 + … + n = O(n²)` character copies. `StringBuilder` mutates one buffer and is amortised `O(1)` per append. This is worth saying out loud the moment you type a loop that builds output.',
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'The utility belt you will reuse constantly',
          code: `
char[] c = s.toCharArray();          // index-friendly, avoids repeated charAt dispatch
new String(c);                       // back to a String
String.valueOf(charArray);           // same thing

s.equals(t);                         // NEVER use == on strings
s.equalsIgnoreCase(t);
s.compareTo(t);                      // lexicographic, < 0 / 0 / > 0

Character.isLetterOrDigit(ch);
Character.isDigit(ch);  Character.isLetter(ch);
Character.toLowerCase(ch);

s.split("\\\\s+");                      // split on runs of whitespace
s.trim();  s.strip();                // strip() is Unicode-aware
String.join(" ", list);
sb.reverse();                        // StringBuilder has it; String does not

int idx = ch - 'a';                  // the 26-array index, used everywhere`,
        },
      ],
    },
    {
      id: 'alphabet',
      title: 'Exploiting the small alphabet',
      blocks: [
        { t: 'p', text: 'Lowercase English is 26 symbols. That is small enough that a **set of characters fits in one `int`** — bit `i` set means letter `i` is present. This single idea powers several otherwise-hard problems.' },
        {
          t: 'code',
          lang: 'java',
          caption: 'Maximum Product of Word Lengths — bitmask as a character set',
          code: `
int maxProduct(String[] words) {
    int n = words.length;
    int[] mask = new int[n];
    for (int i = 0; i < n; i++)
        for (char c : words[i].toCharArray())
            mask[i] |= 1 << (c - 'a');        // set the bit for this letter

    int best = 0;
    for (int i = 0; i < n; i++)
        for (int j = i + 1; j < n; j++)
            if ((mask[i] & mask[j]) == 0)     // disjoint letter sets, in ONE operation
                best = Math.max(best, words[i].length() * words[j].length());
    return best;
}`,
        },
        {
          t: 'table',
          head: ['Question about characters', 'Cheap representation'],
          rows: [
            ['Which characters appear?', '`int` bitmask, 26 bits'],
            ['How many times does each appear?', '`int[26]`'],
            ['Do two strings share a letter?', '`(maskA & maskB) != 0`'],
            ['Can it be rearranged into a palindrome?', 'count of odd frequencies ≤ 1'],
            ['Are two strings anagrams?', '`int[26]` difference is all zero'],
            ['Is this substring a permutation of p?', 'sliding window over `int[26]` + a matches counter'],
          ],
        },
        {
          t: 'tip',
          title: 'The "matches counter" upgrade',
          text: 'Comparing two `int[26]` arrays every window step is `O(26)`. Instead keep a single integer `matched` counting how many of the 26 letters currently have the exact required count, and update it in `O(1)` on each add/remove. That turns window comparison into a single `matched == 26` test.',
        },
      ],
    },
    {
      id: 'palindromes',
      title: 'Palindromes — expand around centre, then Manacher',
      blocks: [
        { t: 'p', text: 'A palindrome is defined by its **centre**. In a string of length `n` there are `2n − 1` centres: `n` single characters and `n − 1` gaps between characters. Expanding from each centre is `O(n²)` total and is the expected answer in most interviews.' },
        {
          t: 'ascii',
          caption: 'Odd and even centres — you must try both.',
          code: `
   a  b  a  c  a  b  a
   ^     ^              odd centre at index 2  -> "aba"
      ^^                even centre between 1 and 2 -> "" (b != a)

   centres: 0, 0|1, 1, 1|2, 2, ... -> 2n-1 of them`,
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'The two templates: longest palindromic substring, and counting them',
          code: `
String longestPalindrome(String s) {
    int bestL = 0, bestR = 0;
    for (int c = 0; c < s.length(); c++) {
        int[] odd  = expand(s, c, c);        // centre on a character
        int[] even = expand(s, c, c + 1);    // centre between characters
        if (odd[1]  - odd[0]  > bestR - bestL) { bestL = odd[0];  bestR = odd[1];  }
        if (even[1] - even[0] > bestR - bestL) { bestL = even[0]; bestR = even[1]; }
    }
    return s.substring(bestL, bestR + 1);
}

int[] expand(String s, int l, int r) {
    while (l >= 0 && r < s.length() && s.charAt(l) == s.charAt(r)) { l--; r++; }
    return new int[]{ l + 1, r - 1 };        // step back to the last valid pair
}

// Counting all palindromic substrings is the same loop with a counter:
int countSubstrings(String s) {
    int count = 0;
    for (int c = 0; c < s.length(); c++) {
        count += countFrom(s, c, c) + countFrom(s, c, c + 1);
    }
    return count;
}
int countFrom(String s, int l, int r) {
    int k = 0;
    while (l >= 0 && r < s.length() && s.charAt(l) == s.charAt(r)) { l--; r++; k++; }
    return k;
}`,
        },
        {
          t: 'trap',
          title: 'Forgetting even-length centres',
          text: '"abba" has no single-character centre. A solution that only tries `expand(c, c)` passes many tests and fails the obvious one. Always call both.',
        },
        {
          t: 'note',
          title: 'When to mention Manacher',
          text: 'Manacher’s algorithm solves longest-palindromic-substring in `O(n)` by reusing mirror information around the current rightmost palindrome. Nobody expects you to write it from memory, but *naming it* as the optimal solution after you deliver the `O(n²)` version is a strong finish.',
        },
      ],
    },
    {
      id: 'matching',
      title: 'Pattern matching: KMP and rolling hashes',
      blocks: [
        { t: 'p', text: 'Naive substring search re-compares from scratch after every mismatch, costing `O(n·m)`. **KMP** never re-examines a character of the text: when a mismatch occurs it uses a precomputed table to jump the pattern forward by the largest amount that is still safe.' },
        { t: 'h', text: 'The prefix function (LPS table)' },
        { t: 'p', text: '`lps[i]` = the length of the longest proper prefix of `pattern[0..i]` that is also a suffix of it. Intuitively: "if I fail at position `i+1`, how much of what I have already matched can I keep?"' },
        {
          t: 'ascii',
          caption: 'For "ababaca": the table records reusable overlap.',
          code: `
 pattern:  a  b  a  b  a  c  a
 index:    0  1  2  3  4  5  6
 lps:      0  0  1  2  3  0  1
                       ^
           "ababa" has prefix "aba" == suffix "aba", so lps = 3`,
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'KMP — build the table, then scan the text without ever backing up',
          code: `
int[] buildLps(String p) {
    int[] lps = new int[p.length()];
    int len = 0;
    for (int i = 1; i < p.length(); ) {
        if (p.charAt(i) == p.charAt(len)) {
            lps[i++] = ++len;
        } else if (len > 0) {
            len = lps[len - 1];             // fall back, do NOT advance i
        } else {
            lps[i++] = 0;
        }
    }
    return lps;
}

int indexOf(String text, String p) {
    if (p.isEmpty()) return 0;
    int[] lps = buildLps(p);
    for (int i = 0, j = 0; i < text.length(); ) {
        if (text.charAt(i) == p.charAt(j)) {
            i++; j++;
            if (j == p.length()) return i - j;     // full match
        } else if (j > 0) {
            j = lps[j - 1];                        // shift the pattern, keep i
        } else {
            i++;
        }
    }
    return -1;
}`,
        },
        {
          t: 'key',
          title: 'KMP is worth learning for its side effects',
          text: 'The LPS table by itself answers several problems directly: **shortest repeated unit** (`n − lps[n−1]` divides `n`), **shortest palindrome by prepending** (run KMP on `s + "#" + reverse(s)`), and **longest happy prefix**. Learning the table is higher value than learning the search.',
        },
        { t: 'h', text: 'Rabin–Karp rolling hash' },
        { t: 'p', text: 'Treat a window of characters as a number in base `B` modulo a large prime. Sliding the window is `O(1)`: subtract the leaving character’s contribution, multiply by `B`, add the entering one.' },
        {
          t: 'code',
          lang: 'java',
          caption: 'Rolling hash — the core update',
          code: `
long B = 131, MOD = 1_000_000_007L;

// hash of s[0..m-1]
long h = 0, power = 1;
for (int i = 0; i < m; i++) {
    h = (h * B + s.charAt(i)) % MOD;
    if (i > 0) power = power * B % MOD;      // B^(m-1)
}

// roll from window [i, i+m-1] to [i+1, i+m]
h = (h - s.charAt(i) * power % MOD + MOD) % MOD;   // drop leftmost
h = (h * B + s.charAt(i + m)) % MOD;               // append rightmost`,
        },
        {
          t: 'warn',
          title: 'Hash equality is not string equality',
          text: 'Collisions happen. Either verify with a direct comparison on a hit, or use two independent moduli. In an interview, saying "I would verify the match, or use a double hash" is what separates a correct answer from a hand-wave.',
        },
      ],
    },
    {
      id: 'parsing',
      title: 'Parsing and encoding problems',
      blocks: [
        { t: 'p', text: 'A quiet but frequent category: expression evaluation, string compression, encode/decode, Roman numerals, atoi. These reward carefulness, not cleverness.' },
        {
          t: 'code',
          lang: 'java',
          caption: 'Decode String ("3[a2[c]]") — the stack pattern for nested structure',
          code: `
String decodeString(String s) {
    Deque<Integer> counts = new ArrayDeque<>();
    Deque<StringBuilder> parts = new ArrayDeque<>();
    StringBuilder cur = new StringBuilder();
    int k = 0;

    for (char c : s.toCharArray()) {
        if (Character.isDigit(c)) {
            k = k * 10 + (c - '0');            // multi-digit counts
        } else if (c == '[') {
            counts.push(k);  k = 0;            // save the count
            parts.push(cur); cur = new StringBuilder();   // save the outer string
        } else if (c == ']') {
            StringBuilder outer = parts.pop();
            int times = counts.pop();
            outer.append(String.valueOf(cur).repeat(times));
            cur = outer;
        } else {
            cur.append(c);
        }
    }
    return cur.toString();
}`,
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'Encode and Decode Strings — length-prefixing is the only safe delimiter',
          code: `
// Any separator character could appear in the payload. Prefix the length instead.
String encode(List<String> strs) {
    StringBuilder sb = new StringBuilder();
    for (String s : strs) sb.append(s.length()).append('#').append(s);
    return sb.toString();
}

List<String> decode(String s) {
    List<String> out = new ArrayList<>();
    int i = 0;
    while (i < s.length()) {
        int j = s.indexOf('#', i);
        int len = Integer.parseInt(s.substring(i, j));
        out.add(s.substring(j + 1, j + 1 + len));
        i = j + 1 + len;
    }
    return out;
}`,
        },
        {
          t: 'tip',
          title: 'Parsing checklist',
          text: 'Multi-digit numbers (`k = k*10 + d`). Leading/trailing whitespace. Optional sign. Overflow (clamp to `Integer.MAX_VALUE`/`MIN_VALUE` in atoi). Empty input. Nesting depth. Mention each explicitly — parsing problems are graded on thoroughness.',
        },
      ],
    },
  ],

  patterns: [
    {
      id: 'char-count',
      name: 'Fixed-Alphabet Counting',
      oneLiner: 'Replace the hash map with `int[26]` and comparisons become arithmetic.',
      useWhen: ['Anagrams, permutations, character frequency questions on a bounded alphabet.'],
      recognize: ['"lowercase English letters" in the constraints.'],
      steps: ['Count with `cnt[c - \'a\']++`.', 'Compare with a second array, or maintain a `matched` counter for O(1) window checks.'],
      template: {
        lang: 'java',
        caption: 'Window over counts with an O(1) validity check',
        code: `
int[] need = new int[26], win = new int[26];
for (char c : p.toCharArray()) need[c - 'a']++;

int matched = 0, required = 0;
for (int x : need) if (x > 0) required++;

for (int r = 0; r < s.length(); r++) {
    int in = s.charAt(r) - 'a';
    if (++win[in] == need[in]) matched++;
    else if (win[in] == need[in] + 1) matched--;      // overshot

    if (r >= p.length()) {
        int out = s.charAt(r - p.length()) - 'a';
        if (--win[out] == need[out]) matched++;
        else if (win[out] == need[out] - 1) matched--;
    }
    if (matched == required) record(r - p.length() + 1);
}`,
      },
      complexity: 'O(n) time, O(1) space (26 is a constant).',
      gotchas: ['Check the constraints for uppercase, digits or Unicode — then use `int[128]` or a map.'],
      problems: ['Valid Anagram', 'Find All Anagrams in a String', 'Permutation in String', 'Group Anagrams'],
    },
    {
      id: 'expand-centre',
      name: 'Expand Around Centre',
      oneLiner: 'Every palindrome grows outward from one of 2n − 1 centres.',
      useWhen: ['Longest palindromic substring; counting palindromic substrings; palindrome partitioning precomputation.'],
      recognize: ['The word "palindrome" plus "substring" (contiguous).'],
      steps: ['Loop over all centres.', 'Expand while the characters match and indices are in range.', 'Handle odd and even centres separately.'],
      complexity: 'O(n²) time, O(1) space. Manacher gives O(n).',
      gotchas: ['Always call both `expand(c,c)` and `expand(c,c+1)`.', 'After the loop, step back by one — the last expansion failed.'],
      problems: ['Longest Palindromic Substring', 'Palindromic Substrings', 'Longest Palindrome'],
    },
    {
      id: 'kmp',
      name: 'KMP / Prefix Function',
      oneLiner: 'Precompute how much of a partial match survives a mismatch, and never re-read the text.',
      useWhen: [
        'Substring search where `n · m` is too slow.',
        'Questions about the longest prefix that is also a suffix.',
        'Periodicity: "is this string a repetition of a smaller unit?"',
      ],
      recognize: ['"Implement strStr", "shortest palindrome", "repeated substring pattern", "longest happy prefix".'],
      steps: ['Build `lps` for the pattern.', 'Scan the text with `i` never decreasing; on mismatch set `j = lps[j − 1]`.'],
      complexity: 'O(n + m) time, O(m) space.',
      gotchas: [
        'In the table builder, on mismatch with `len > 0` you fall back **without** advancing `i`.',
        'Period check: `n − lps[n − 1]` is the candidate unit length; it is a real period only if it divides `n`.',
      ],
      problems: ['Find the Index of the First Occurrence in a String', 'Repeated Substring Pattern', 'Shortest Palindrome', 'Longest Happy Prefix'],
    },
    {
      id: 'rolling-hash',
      name: 'Rolling Hash (Rabin–Karp)',
      oneLiner: 'A window’s hash updates in O(1), so substring comparison becomes integer comparison.',
      useWhen: ['Many substring equality checks.', 'Binary searching the *length* of a repeated or common substring.'],
      recognize: ['"Longest duplicate substring", "longest common substring of two strings" with large n.'],
      steps: ['Pick a base and a large prime modulus.', 'Hash the first window, then roll.', 'Verify hits, or use a double hash.'],
      complexity: 'O(n) average per length; combined with binary search on length, O(n log n).',
      gotchas: ['Keep the modulus in `long` and add `MOD` before taking `%` to avoid negatives.', 'Never claim a match on hash equality alone without saying you would verify.'],
      problems: ['Repeated DNA Sequences', 'Longest Duplicate Substring', 'Find the Index of the First Occurrence in a String'],
    },
    {
      id: 'stack-parse',
      name: 'Stack-Based Parsing',
      oneLiner: 'Nesting means a stack — push the outer context, pop and merge on close.',
      useWhen: ['Brackets, nested encodings, expression evaluation, path simplification.'],
      recognize: ['Any grammar with `[ ]`, `( )`, or nested repetition.'],
      steps: ['On an opening token, push the accumulated state and reset.', 'On a closing token, pop and combine.', 'Accumulate multi-character numbers/identifiers as you go.'],
      complexity: 'O(n) time and space.',
      gotchas: ['Multi-digit numbers need `k = k*10 + d`, not a single `charAt`.', 'Validate that the stack is empty at the end for matching-bracket problems.'],
      problems: ['Valid Parentheses', 'Decode String', 'Basic Calculator', 'Simplify Path', 'Remove All Adjacent Duplicates In String'],
    },
  ],

  pitfalls: [
    { title: 'String concatenation in a loop', text: 'Always `StringBuilder`. This is the number one cause of TLE on string problems.' },
    { title: 'substring inside nested loops', text: 'It copies. Pass indices around instead, or use a rolling hash.' },
    { title: 'Comparing with ==', text: '`==` compares references. Interned literals make it *look* like it works, which is worse than failing loudly.' },
    { title: 'Only handling odd palindrome centres', text: '"abba" breaks immediately.' },
    { title: 'Ignoring case and non-alphanumerics', text: 'Valid Palindrome specifically tests this. Read the statement.' },
    { title: 'Assuming ASCII', text: 'If the constraints mention Unicode, `charAt` walks UTF-16 code units, and surrogate pairs will bite you.' },
    { title: 'Off-by-one in substring bounds', text: '`substring(i, j)` is inclusive of `i` and exclusive of `j`. Palindrome answers need `substring(l, r + 1)`.' },
  ],

  cheatsheet: [
    { label: 'Build output', value: 'StringBuilder, never +=' },
    { label: 'Letter index', value: "c - 'a'" },
    { label: 'Char set', value: "mask |= 1 << (c - 'a')" },
    { label: 'Disjoint sets', value: '(maskA & maskB) == 0' },
    { label: 'Anagram', value: 'int[26] diff all zeros' },
    { label: 'Palindrome centres', value: '2n − 1: (c,c) and (c,c+1)' },
    { label: 'Palindrome permutation', value: '≤ 1 odd count' },
    { label: 'KMP fallback', value: 'j = lps[j − 1]' },
    { label: 'Repeated unit', value: 'n − lps[n−1] divides n' },
    { label: 'Safe encoding', value: 'length-prefix, not a delimiter' },
    { label: 'Nested structure', value: 'stack of (count, prefix)' },
  ],

  problems: [
    { name: 'Valid Palindrome', difficulty: 'Easy', url: 'https://leetcode.com/problems/valid-palindrome/', pattern: 'Two pointers', insight: 'Skip non-alphanumerics on both sides; compare lowercased.' },
    { name: 'Valid Anagram', difficulty: 'Easy', url: 'https://leetcode.com/problems/valid-anagram/', pattern: 'Char count', insight: 'Single int[26]: increment for one string, decrement for the other.' },
    { name: 'Longest Common Prefix', difficulty: 'Easy', url: 'https://leetcode.com/problems/longest-common-prefix/', pattern: 'Vertical scan', insight: 'Compare column by column and stop at the first mismatch.' },
    { name: 'Reverse String', difficulty: 'Easy', url: 'https://leetcode.com/problems/reverse-string/', pattern: 'Two pointers', insight: 'In-place swap from both ends.' },
    { name: 'Reverse Words in a String III', difficulty: 'Easy', url: 'https://leetcode.com/problems/reverse-words-in-a-string-iii/', pattern: 'Split + reverse', insight: 'Reverse each word in place using a two-pointer swap per word span.' },
    { name: 'Isomorphic Strings', difficulty: 'Easy', url: 'https://leetcode.com/problems/isomorphic-strings/', pattern: 'Bijection', insight: 'Two maps, or two last-seen-index arrays compared position by position.' },
    { name: 'Longest Palindrome', difficulty: 'Easy', url: 'https://leetcode.com/problems/longest-palindrome/', pattern: 'Char count', insight: 'Sum the even parts of each count, then add 1 if any odd count exists.' },
    { name: 'Implement strStr()', difficulty: 'Easy', url: 'https://leetcode.com/problems/find-the-index-of-the-first-occurrence-in-a-string/', pattern: 'KMP / naive', insight: 'Naive is accepted; KMP is the answer that earns the follow-up.' },
    { name: 'Valid Parentheses', difficulty: 'Easy', url: 'https://leetcode.com/problems/valid-parentheses/', pattern: 'Stack', insight: 'Push openers, match on close, and require an empty stack at the end.' },
    { name: 'Longest Substring Without Repeating Characters', difficulty: 'Medium', url: 'https://leetcode.com/problems/longest-substring-without-repeating-characters/', pattern: 'Sliding window', insight: 'Track last-seen index and jump left forward rather than shrinking one by one.' },
    { name: 'Longest Palindromic Substring', difficulty: 'Medium', url: 'https://leetcode.com/problems/longest-palindromic-substring/', pattern: 'Expand around centre', insight: '2n − 1 centres; mention Manacher as the O(n) optimum.' },
    { name: 'Palindromic Substrings', difficulty: 'Medium', url: 'https://leetcode.com/problems/palindromic-substrings/', pattern: 'Expand around centre', insight: 'Count every successful expansion instead of tracking the longest.' },
    { name: 'Group Anagrams', difficulty: 'Medium', url: 'https://leetcode.com/problems/group-anagrams/', pattern: 'Canonical key', insight: 'Sorted characters or a count signature as the map key.' },
    { name: 'String to Integer (atoi)', difficulty: 'Medium', url: 'https://leetcode.com/problems/string-to-integer-atoi/', pattern: 'Careful parsing', insight: 'Whitespace, optional sign, digits only, clamp on overflow.' },
    { name: 'Decode String', difficulty: 'Medium', url: 'https://leetcode.com/problems/decode-string/', pattern: 'Stack parsing', insight: 'Two stacks: repetition counts and partially built strings.' },
    { name: 'Longest Repeating Character Replacement', difficulty: 'Medium', url: 'https://leetcode.com/problems/longest-repeating-character-replacement/', pattern: 'Sliding window', insight: 'Valid while (windowLength − maxFreq) ≤ k.' },
    { name: 'Zigzag Conversion', difficulty: 'Medium', url: 'https://leetcode.com/problems/zigzag-conversion/', pattern: 'Simulation', insight: 'Walk rows with a direction flag that flips at the top and bottom.' },
    { name: 'Encode and Decode Strings', difficulty: 'Medium', url: 'https://leetcode.com/problems/encode-and-decode-strings/', pattern: 'Length prefixing', insight: 'No delimiter is safe; prefix each payload with its length.' },
    { name: 'Repeated DNA Sequences', difficulty: 'Medium', url: 'https://leetcode.com/problems/repeated-dna-sequences/', pattern: 'Rolling hash / set', insight: 'Fixed length 10 — encode each base in 2 bits and roll a 20-bit integer.' },
    { name: 'Basic Calculator II', difficulty: 'Medium', url: 'https://leetcode.com/problems/basic-calculator-ii/', pattern: 'Stack parsing', insight: 'Push numbers; apply * and / immediately, defer + and − to a final sum.' },
    { name: 'Simplify Path', difficulty: 'Medium', url: 'https://leetcode.com/problems/simplify-path/', pattern: 'Stack', insight: 'Split on "/", push names, pop on "..", ignore "." and empties.' },
    { name: 'Repeated Substring Pattern', difficulty: 'Easy', url: 'https://leetcode.com/problems/repeated-substring-pattern/', pattern: 'KMP table', insight: 'n − lps[n−1] is the period; valid only if it divides n. (Or check `(s+s).indexOf(s,1) < n`.)' },
    { name: 'Minimum Window Substring', difficulty: 'Hard', url: 'https://leetcode.com/problems/minimum-window-substring/', pattern: 'Sliding window', insight: 'Maintain a satisfied-character counter; shrink while fully satisfied.' },
    { name: 'Shortest Palindrome', difficulty: 'Hard', url: 'https://leetcode.com/problems/shortest-palindrome/', pattern: 'KMP', insight: 'Build the LPS of `s + "#" + reverse(s)`; the final value is the longest palindromic prefix.' },
    { name: 'Text Justification', difficulty: 'Hard', url: 'https://leetcode.com/problems/text-justification/', pattern: 'Greedy simulation', insight: 'Pack greedily per line, distribute spaces left-heavy, left-justify the final line.' },
    { name: 'Longest Duplicate Substring', difficulty: 'Hard', url: 'https://leetcode.com/problems/longest-duplicate-substring/', pattern: 'Binary search + rolling hash', insight: 'Length is monotone: if a duplicate of length L exists, one of length L−1 does too.' },
  ],
}
