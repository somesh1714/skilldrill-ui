export default {
  id: 'tries',
  title: 'Tries (Prefix Trees)',
  short: 'Tries',
  icon: 'SpellcheckRounded',
  tier: 'Advanced',
  order: 17,
  estHours: 6,
  prereqs: ['trees', 'strings'],
  tagline: 'Share prefixes once. Search becomes independent of how many words you stored.',
  mentalModel:
    'A trie is a tree where the **path** spells the key, not the node. Looking up a word of length L costs O(L) — completely independent of the dictionary size. That is the entire value proposition.',
  whyItMatters:
    'Tries turn "does any of these 10⁵ words start with this prefix?" from a scan into a walk. They also make the hardest grid-search problem (Word Search II) tractable by letting you abandon whole branches early.',

  complexity: [
    { op: 'Insert a word', time: 'O(L)', space: 'O(L · Σ)', note: 'L = word length, Σ = alphabet size' },
    { op: 'Search exact word', time: 'O(L)', space: 'O(1)', note: 'Independent of the number of words' },
    { op: 'Search prefix', time: 'O(L)', space: 'O(1)', note: 'The trie’s reason for existing' },
    { op: 'Delete', time: 'O(L)', space: 'O(1)', note: 'Prune nodes with no children and no word flag' },
    { op: 'Collect all words with a prefix', time: 'O(L + k)', space: 'O(k)', note: 'k = total output size' },
    { op: 'Total space', time: '—', space: 'O(total chars)', note: 'Shared prefixes are stored once' },
  ],

  sections: [
    {
      id: 'structure',
      title: 'The shape',
      blocks: [
        {
          t: 'ascii',
          caption: 'Storing "car", "card", "care", "dog". The prefix "car" exists once.',
          code: `
              (root)
              /     \\
             c       d
             |       |
             a       o
             |       |
             r*      g*
            / \\
           d*  e*

  * marks isEnd — a node where a complete word finishes.
  "car" is a word AND a prefix of "card". Both facts are stored on one node.`,
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'The standard implementation — array children for a fixed alphabet',
          code: `
class Trie {
    private static class Node {
        Node[] next = new Node[26];     // a..z; use a HashMap for larger alphabets
        boolean isEnd;
    }
    private final Node root = new Node();

    public void insert(String word) {
        Node cur = root;
        for (char c : word.toCharArray()) {
            int i = c - 'a';
            if (cur.next[i] == null) cur.next[i] = new Node();
            cur = cur.next[i];
        }
        cur.isEnd = true;               // the ONLY difference from a prefix
    }

    public boolean search(String word) {
        Node n = walk(word);
        return n != null && n.isEnd;    // must be a complete word
    }

    public boolean startsWith(String prefix) {
        return walk(prefix) != null;    // existence of the path is enough
    }

    private Node walk(String s) {
        Node cur = root;
        for (char c : s.toCharArray()) {
            cur = cur.next[c - 'a'];
            if (cur == null) return null;
        }
        return cur;
    }
}`,
        },
        {
          t: 'key',
          title: 'isEnd is the entire difference between search and startsWith',
          text: 'Both walk the same path. `startsWith` only needs the path to exist; `search` additionally requires the final node to be marked as a word boundary. Candidates who conflate them fail the very first test case.',
        },
        {
          t: 'table',
          head: ['Node children as…', 'Use when', 'Trade-off'],
          rows: [
            ['`Node[26]`', 'lowercase a–z only', 'Fastest; 26 pointers per node even if mostly null'],
            ['`Node[128]`', 'ASCII', 'Simple; wasteful'],
            ['`HashMap<Character,Node>`', 'Unicode, digits, mixed case', 'Memory-proportional; slightly slower'],
            ['`Map<String,Node>`', 'path segments, file systems', 'Each edge is a whole token'],
          ],
        },
        {
          t: 'note',
          title: 'Trie vs HashSet',
          text: 'A `HashSet<String>` gives `O(L)` exact lookup too (hashing costs `O(L)`). The trie wins when you need **prefix** operations, **sorted traversal**, or **incremental character-by-character matching** — which is exactly what autocomplete and grid search need. If you only ever check exact membership, a hash set is simpler and faster.',
        },
      ],
    },
    {
      id: 'wildcards',
      title: 'Wildcard search — the trie meets backtracking',
      blocks: [
        { t: 'p', text: 'Add a `.` that matches any character and search becomes a DFS: at a wildcard, try every non-null child.' },
        {
          t: 'code',
          lang: 'java',
          caption: 'Design Add and Search Words Data Structure',
          code: `
boolean search(String word) { return dfs(word, 0, root); }

private boolean dfs(String w, int i, Node cur) {
    if (cur == null) return false;
    if (i == w.length()) return cur.isEnd;

    char c = w.charAt(i);
    if (c != '.') return dfs(w, i + 1, cur.next[c - 'a']);

    for (Node child : cur.next)                  // wildcard: branch on all children
        if (child != null && dfs(w, i + 1, child)) return true;
    return false;
}`,
        },
        {
          t: 'tip',
          title: 'Complexity of wildcard search',
          text: 'A leading `.` forces 26 branches; `k` wildcards give `O(26^k · L)` in the worst case. That is fine when wildcards are rare, which the problem constraints guarantee. Say this bound out loud rather than claiming `O(L)`.',
        },
      ],
    },
    {
      id: 'grid',
      title: 'Trie + grid DFS — Word Search II',
      blocks: [
        { t: 'p', text: 'Searching a grid for 10⁴ words one at a time is hopeless. Build one trie of all the words and run a **single** DFS, walking the trie alongside the grid. The moment the current prefix has no trie node, you abandon that entire branch.' },
        {
          t: 'code',
          lang: 'java',
          caption: 'Word Search II — the standard optimised solution',
          code: `
List<String> findWords(char[][] board, String[] words) {
    Node root = buildTrie(words);
    List<String> out = new ArrayList<>();
    for (int r = 0; r < board.length; r++)
        for (int c = 0; c < board[0].length; c++)
            dfs(board, r, c, root, out);
    return out;
}

void dfs(char[][] b, int r, int c, Node parent, List<String> out) {
    if (r < 0 || c < 0 || r >= b.length || c >= b[0].length) return;
    char ch = b[r][c];
    if (ch == '#') return;                       // already on the current path

    Node node = parent.next[ch - 'a'];
    if (node == null) return;                    // PRUNE: no word has this prefix

    if (node.word != null) {                     // store the word ON the node
        out.add(node.word);
        node.word = null;                        // de-duplicate without a set
    }

    b[r][c] = '#';
    dfs(b, r + 1, c, node, out); dfs(b, r - 1, c, node, out);
    dfs(b, r, c + 1, node, out); dfs(b, r, c - 1, node, out);
    b[r][c] = ch;                                // restore
}`,
        },
        {
          t: 'key',
          title: 'Two upgrades that make this the "good" solution',
          text: '**(1)** Store the complete word on the terminal node so you never rebuild strings during the DFS. **(2)** Null it out after collecting, which de-duplicates for free and avoids a `HashSet`. A third optimisation — pruning leaf nodes once their word is found — keeps the trie shrinking as the search proceeds.',
        },
      ],
    },
    {
      id: 'variants',
      title: 'Variants worth knowing',
      blocks: [
        { t: 'h', text: 'Binary trie for XOR problems' },
        { t: 'p', text: 'Insert numbers bit by bit, most significant first. To maximise `x XOR y`, walk the trie greedily preferring the **opposite** bit at every level — that sets the highest possible bits.' },
        {
          t: 'code',
          lang: 'java',
          caption: 'Maximum XOR of Two Numbers in an Array',
          code: `
class BitTrie {
    BitTrie[] next = new BitTrie[2];

    void insert(int x) {
        BitTrie cur = this;
        for (int b = 31; b >= 0; b--) {
            int bit = (x >> b) & 1;
            if (cur.next[bit] == null) cur.next[bit] = new BitTrie();
            cur = cur.next[bit];
        }
    }

    int maxXor(int x) {
        BitTrie cur = this;
        int best = 0;
        for (int b = 31; b >= 0; b--) {
            int bit = (x >> b) & 1, want = bit ^ 1;    // prefer the opposite bit
            if (cur.next[want] != null) { best |= (1 << b); cur = cur.next[want]; }
            else                          cur = cur.next[bit];
        }
        return best;
    }
}`,
        },
        {
          t: 'note',
          title: 'Other trie relatives',
          text: '**Compressed trie / radix tree** merges single-child chains into one edge — the basis of IP routing tables. **Suffix trie/array** indexes every suffix for substring queries. **Aho–Corasick** adds failure links to a trie for multi-pattern matching in `O(n + total pattern length)` — the multi-string generalisation of KMP. Naming these correctly in a system-design context is worth real credit.',
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'Autocomplete — collect the top results under a prefix',
          code: `
List<String> autocomplete(String prefix, int limit) {
    Node start = walk(prefix);
    List<String> out = new ArrayList<>();
    if (start != null) collect(start, new StringBuilder(prefix), out, limit);
    return out;
}

void collect(Node n, StringBuilder sb, List<String> out, int limit) {
    if (out.size() == limit) return;
    if (n.isEnd) out.add(sb.toString());
    for (int i = 0; i < 26; i++) {            // ascending i = lexicographic order
        if (n.next[i] == null) continue;
        sb.append((char)('a' + i));
        collect(n.next[i], sb, out, limit);
        sb.deleteCharAt(sb.length() - 1);     // backtrack
    }
}`,
        },
        {
          t: 'tip',
          title: 'Ranked autocomplete',
          text: 'For "top 3 by search frequency" (Design Search Autocomplete System), store a small sorted list or a `TreeSet` of the best candidates **on each node**. Updating is `O(1)` amortised and queries need no subtree walk at all.',
        },
      ],
    },
  ],

  patterns: [
    {
      id: 'prefix-trie',
      name: 'Prefix Trie',
      oneLiner: 'Store the dictionary once; every prefix question becomes a walk down the path.',
      useWhen: ['Repeated prefix queries over a fixed word set.', 'Autocomplete, spell-check, dictionary membership, word replacement.'],
      recognize: ['"Starts with", "prefix", "dictionary of words", "autocomplete", "replace words with their root".'],
      steps: ['Insert every word, marking terminal nodes.', 'Walk character by character for queries.', 'Distinguish `isEnd` from mere path existence.'],
      template: {
        lang: 'java',
        caption: 'Replace Words — stop at the first root found',
        code: `
String shortestRoot(String word) {
    Node cur = root;
    StringBuilder sb = new StringBuilder();
    for (char c : word.toCharArray()) {
        cur = cur.next[c - 'a'];
        if (cur == null) return word;         // no root matches
        sb.append(c);
        if (cur.isEnd) return sb.toString();  // shortest root wins
    }
    return word;
}`,
      },
      complexity: 'O(L) per operation; O(total characters) space.',
      gotchas: [
        'Forgetting `isEnd` makes `search` behave like `startsWith`.',
        'For mixed-case or Unicode input, switch children to a `HashMap`.',
        'Deletion must prune only nodes with no children and no word flag.',
      ],
      problems: ['Implement Trie (Prefix Tree)', 'Replace Words', 'Longest Word in Dictionary', 'Implement Magic Dictionary', 'Index Pairs of a String'],
    },
    {
      id: 'trie-dfs',
      name: 'Trie-Guided Search (prune with the dictionary)',
      oneLiner: 'Walk the trie in lockstep with a DFS so dead prefixes kill whole branches.',
      useWhen: ['Searching a grid or a large space for many dictionary words at once.'],
      recognize: ['"Find all words in the board", "concatenated words", "word squares".'],
      steps: ['Build one trie from all target words.', 'DFS the search space, advancing the trie node with each character.', 'Return immediately when the trie node is null.'],
      complexity: 'O(rows · cols · 4^maxWordLength) worst case, but the pruning makes it fast in practice.',
      gotchas: [
        'Store the full word on the terminal node instead of rebuilding strings.',
        'Null the word after collecting, to de-duplicate.',
        'Restore the grid cell on the way out.',
      ],
      problems: ['Word Search II', 'Concatenated Words', 'Word Squares', 'Stream of Characters'],
    },
    {
      id: 'wildcard-trie',
      name: 'Wildcard / Fuzzy Trie Search',
      oneLiner: 'A `.` branches into every child; everything else is a single step.',
      useWhen: ['Pattern queries with single-character wildcards.', 'Dictionary lookup allowing one edit.'],
      recognize: ['"Search supports . matching any letter", "magic dictionary with exactly one change".'],
      steps: ['Recurse with (index, node).', 'On a concrete character, descend once.', 'On a wildcard, loop over all non-null children.'],
      complexity: 'O(26^wildcards · L).',
      gotchas: ['Check `isEnd` only when the whole pattern is consumed.', 'For "exactly one edit", carry a used-edit boolean in the recursion.'],
      problems: ['Design Add and Search Words Data Structure', 'Implement Magic Dictionary'],
    },
    {
      id: 'bit-trie',
      name: 'Binary (XOR) Trie',
      oneLiner: 'Insert numbers as 32-bit paths and greedily choose the opposite bit to maximise XOR.',
      useWhen: ['Maximum XOR pair, XOR queries with constraints.'],
      recognize: ['"Maximum XOR of two numbers", "maximum XOR with an element from the array".'],
      steps: ['Insert each number from the most significant bit down.', 'For a query, prefer the opposite bit at each level, falling back when absent.'],
      complexity: 'O(32) per insert and per query.',
      gotchas: ['Iterate bits from high to low — greedily maximising the high bits is what makes it correct.', 'Mind the sign bit if negative numbers are allowed.'],
      problems: ['Maximum XOR of Two Numbers in an Array', 'Maximum XOR With an Element From Array', 'Count Pairs With XOR in a Range'],
    },
  ],

  pitfalls: [
    { title: 'Confusing search with startsWith', text: '`isEnd` is what separates them.' },
    { title: 'Using a trie where a HashSet suffices', text: 'If you only need exact membership, a set is simpler. Justify the trie with a prefix requirement.' },
    { title: 'Allocating 26 children per node for a sparse alphabet', text: 'Memory blows up; use a HashMap.' },
    { title: 'Rebuilding strings during a grid DFS', text: 'Store the word on the node instead.' },
    { title: 'Forgetting to restore grid cells', text: 'The DFS corrupts the board for subsequent starting cells.' },
    { title: 'Claiming O(L) for wildcard search', text: 'Leading wildcards branch 26 ways per level.' },
  ],

  cheatsheet: [
    { label: 'Node', value: 'children[26] + isEnd' },
    { label: 'Insert / search', value: 'O(L), independent of word count' },
    { label: 'search vs startsWith', value: 'isEnd flag' },
    { label: 'Large alphabet', value: 'HashMap children' },
    { label: 'Wildcard `.`', value: 'DFS over all children' },
    { label: 'Grid + many words', value: 'one trie, one DFS' },
    { label: 'Avoid rebuilding strings', value: 'store the word on the node' },
    { label: 'De-duplicate results', value: 'null the word after collecting' },
    { label: 'Max XOR', value: 'binary trie, prefer opposite bit' },
    { label: 'Autocomplete top-k', value: 'cache candidates per node' },
  ],

  problems: [
    { name: 'Implement Trie (Prefix Tree)', difficulty: 'Medium', url: 'https://leetcode.com/problems/implement-trie-prefix-tree/', pattern: 'Prefix trie', insight: 'The reference implementation; write it until it is automatic.' },
    { name: 'Design Add and Search Words Data Structure', difficulty: 'Medium', url: 'https://leetcode.com/problems/design-add-and-search-words-data-structure/', pattern: 'Wildcard trie', insight: 'A `.` turns the walk into a DFS over all children.' },
    { name: 'Replace Words', difficulty: 'Medium', url: 'https://leetcode.com/problems/replace-words/', pattern: 'Prefix trie', insight: 'Stop at the first `isEnd` — that is the shortest root by construction.' },
    { name: 'Longest Word in Dictionary', difficulty: 'Medium', url: 'https://leetcode.com/problems/longest-word-in-dictionary/', pattern: 'Prefix trie + DFS', insight: 'Only descend through nodes that are themselves complete words.' },
    { name: 'Map Sum Pairs', difficulty: 'Medium', url: 'https://leetcode.com/problems/map-sum-pairs/', pattern: 'Trie with values', insight: 'Store a running sum on each node, or sum the subtree on query.' },
    { name: 'Implement Magic Dictionary', difficulty: 'Medium', url: 'https://leetcode.com/problems/implement-magic-dictionary/', pattern: 'Fuzzy trie', insight: 'DFS carrying a "one change already used" flag.' },
    { name: 'Maximum XOR of Two Numbers in an Array', difficulty: 'Medium', url: 'https://leetcode.com/problems/maximum-xor-of-two-numbers-in-an-array/', pattern: 'Binary trie', insight: 'Greedy from the most significant bit; prefer the opposite bit.' },
    { name: 'Design Search Autocomplete System', difficulty: 'Hard', url: 'https://leetcode.com/problems/design-search-autocomplete-system/', pattern: 'Trie + ranking', insight: 'Cache the top candidates on each node so queries avoid a subtree walk.' },
    { name: 'Word Search II', difficulty: 'Hard', url: 'https://leetcode.com/problems/word-search-ii/', pattern: 'Trie-guided grid DFS', insight: 'One trie, one DFS; store the word on the node and null it after collecting.' },
    { name: 'Concatenated Words', difficulty: 'Hard', url: 'https://leetcode.com/problems/concatenated-words/', pattern: 'Trie + DP', insight: 'Sort by length and ask whether each word is composed of shorter words already inserted.' },
    { name: 'Stream of Characters', difficulty: 'Hard', url: 'https://leetcode.com/problems/stream-of-characters/', pattern: 'Reversed trie', insight: 'Insert words reversed and match backwards from the newest character.' },
    { name: 'Palindrome Pairs', difficulty: 'Hard', url: 'https://leetcode.com/problems/palindrome-pairs/', pattern: 'Trie + palindrome checks', insight: 'Store reversed words; at each node check whether the remaining suffix is a palindrome.' },
    { name: 'Word Squares', difficulty: 'Hard', url: 'https://leetcode.com/problems/word-squares/', pattern: 'Trie + backtracking', insight: 'The prefix constraint at each row comes from the columns already built.' },
  ],
}
