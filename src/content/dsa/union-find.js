export default {
  id: 'union-find',
  title: 'Union-Find (Disjoint Set Union)',
  short: 'Union-Find',
  icon: 'JoinInnerRounded',
  tier: 'Advanced',
  order: 18,
  estHours: 6,
  prereqs: ['graphs'],
  tagline: 'Forty lines of code that answer "are these two connected?" in effectively constant time.',
  mentalModel:
    'Each set is a tree, identified by its root. `find` walks to the root; `union` hangs one root under another. Path compression flattens the trees as you go, so after a few operations everything points almost directly at its root.',
  whyItMatters:
    'DSU is the right answer whenever connectivity is built up **incrementally**. A traversal would cost `O(V + E)` per query; DSU costs effectively `O(1)`. It is also half of Kruskal’s MST algorithm.',

  complexity: [
    { op: 'find (with path compression)', time: 'O(α(n)) ≈ O(1)', space: 'O(n)', note: 'α is the inverse Ackermann function — under 5 for any real n' },
    { op: 'union (by rank/size)', time: 'O(α(n)) ≈ O(1)', space: '—', note: 'Attach the smaller tree under the larger' },
    { op: 'Without any optimisation', time: 'O(n)', space: 'O(n)', note: 'Degenerates into a linked list' },
    { op: 'Path compression only', time: 'O(log n) amortised', space: 'O(n)', note: 'Good enough in practice' },
    { op: 'Both optimisations', time: 'O(m · α(n))', space: 'O(n)', note: 'The standard implementation' },
    { op: 'Kruskal MST', time: 'O(E log E)', space: 'O(V)', note: 'Sorting dominates' },
  ],

  sections: [
    {
      id: 'implementation',
      title: 'The implementation — learn it as one block',
      blocks: [
        {
          t: 'ascii',
          caption: 'Path compression: the second find is nearly free.',
          code: `
  before find(4):        after find(4):

      1                      1
      |                    / | \\
      2                   2  3  4        every node on the path now
      |                                  points straight at the root
      3
      |
      4`,
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'The DSU you should be able to write from memory in two minutes',
          code: `
class DSU {
    private final int[] parent;
    private final int[] size;          // size of the tree rooted here
    private int components;

    DSU(int n) {
        parent = new int[n];
        size = new int[n];
        components = n;
        for (int i = 0; i < n; i++) { parent[i] = i; size[i] = 1; }
    }

    int find(int x) {
        while (parent[x] != x) {
            parent[x] = parent[parent[x]];   // PATH HALVING — one line, no recursion
            x = parent[x];
        }
        return x;
    }

    /** Returns false if x and y were already in the same set. */
    boolean union(int x, int y) {
        int rx = find(x), ry = find(y);
        if (rx == ry) return false;

        if (size[rx] < size[ry]) { int t = rx; rx = ry; ry = t; }   // UNION BY SIZE
        parent[ry] = rx;
        size[rx] += size[ry];
        components--;
        return true;
    }

    boolean connected(int x, int y) { return find(x) == find(y); }
    int componentCount()            { return components; }
    int componentSize(int x)        { return size[find(x)]; }
}`,
        },
        {
          t: 'key',
          title: 'union returns a boolean — and that boolean is the answer to several problems',
          text: 'If `union(a, b)` returns **false**, then `a` and `b` were already connected, so this edge **closes a cycle**. That one fact solves Redundant Connection, Graph Valid Tree, and the cycle-detection half of Kruskal. Design your `union` to return it.',
        },
        {
          t: 'dl',
          items: [
            { term: 'Path compression', def: 'Flatten the path to the root during `find`. Path *halving* (`parent[x] = parent[parent[x]]`) is iterative, avoids recursion depth, and performs just as well.' },
            { term: 'Union by size/rank', def: 'Always hang the smaller tree under the larger, so depth grows logarithmically at worst. Combined with compression, amortised cost is effectively constant.' },
            { term: 'Component count', def: 'Start at `n` and decrement on every successful union. This makes "how many groups?" an `O(1)` field read rather than a second pass.' },
          ],
        },
        {
          t: 'warn',
          title: 'Both optimisations, or neither claim',
          text: 'Without union by size, path compression alone still gives `O(log n)` amortised — acceptable. Without *either*, a chain of unions builds a linked list and `find` is `O(n)`. Do not write the naive version and then claim near-constant time.',
        },
      ],
    },
    {
      id: 'when',
      title: 'When DSU beats a traversal',
      blocks: [
        {
          t: 'compare',
          left: {
            title: 'Use Union-Find',
            items: [
              'Edges arrive incrementally and you query connectivity along the way',
              'You only need "same group or not", never the actual path',
              'Counting components as edges are added',
              'Cycle detection in an **undirected** graph',
              'Kruskal’s MST',
              'Grouping by an equivalence relation (accounts, emails, equations)',
            ],
          },
          right: {
            title: 'Use DFS/BFS instead',
            items: [
              'You need the actual path between two nodes',
              'You need distances or level information',
              'The graph is **directed** (DSU ignores direction)',
              'You need to *remove* edges — DSU cannot undo a union',
              'Ordering matters (topological sort)',
            ],
          },
        },
        {
          t: 'trap',
          title: 'DSU cannot handle deletions or directed edges',
          text: 'There is no `split` operation. If the problem removes connections over time, the standard trick is to **process the queries in reverse**, turning deletions into additions. And because `union(a,b)` is symmetric, DSU cannot detect cycles in a *directed* graph — that needs DFS colouring or Kahn’s algorithm.',
        },
        {
          t: 'tip',
          title: 'The offline-reverse trick',
          text: '"Nodes are removed one at a time; report the number of components after each removal." Reverse it: start from the final state and *add* nodes back, recording answers, then reverse the answer list. This converts an impossible problem into a routine one.',
        },
      ],
    },
    {
      id: 'grids',
      title: 'DSU on grids',
      blocks: [
        { t: 'p', text: 'Map a cell `(r, c)` to the integer `r * cols + c` and the grid becomes an ordinary DSU over `rows × cols` elements.' },
        {
          t: 'code',
          lang: 'java',
          caption: 'Number of Islands via DSU — union each land cell with its right and down neighbours',
          code: `
int numIslands(char[][] g) {
    int m = g.length, n = g[0].length;
    DSU dsu = new DSU(m * n);
    int land = 0;

    for (int r = 0; r < m; r++)
        for (int c = 0; c < n; c++) {
            if (g[r][c] != '1') continue;
            land++;
            // only right and down — left and up were handled when we visited them
            if (r + 1 < m && g[r + 1][c] == '1' && dsu.union(r*n + c, (r+1)*n + c)) land--;
            if (c + 1 < n && g[r][c + 1] == '1' && dsu.union(r*n + c, r*n + c + 1)) land--;
        }
    return land;
}`,
        },
        {
          t: 'note',
          title: 'Why DSU for islands when DFS is simpler?',
          text: 'For the static problem, DFS *is* simpler — use it. DSU earns its place in **Number of Islands II**, where land appears one cell at a time and you must report the island count after every addition. A DFS would be `O(k · mn)`; DSU is `O(k · α)`.',
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'The virtual-node trick — Surrounded Regions / percolation',
          code: `
// Add one EXTRA element that represents "the border".
// Union every border cell with it; then "escapes" is just connected(cell, BORDER).
int BORDER = m * n;
DSU dsu = new DSU(m * n + 1);

for (int r = 0; r < m; r++)
    for (int c = 0; c < n; c++) {
        if (board[r][c] != 'O') continue;
        if (r == 0 || c == 0 || r == m - 1 || c == n - 1) dsu.union(r*n + c, BORDER);
        if (r + 1 < m && board[r+1][c] == 'O') dsu.union(r*n + c, (r+1)*n + c);
        if (c + 1 < n && board[r][c+1] == 'O') dsu.union(r*n + c, r*n + c + 1);
    }
// any 'O' not connected to BORDER is surrounded`,
        },
        {
          t: 'key',
          title: 'Virtual nodes model "anything in this category"',
          text: 'Adding one or two sentinel elements that represent an abstract concept — the border, the top of the grid, the bottom — is the classic DSU modelling move. It turns a "reaches any of many targets" question into a single `connected` call.',
        },
      ],
    },
    {
      id: 'weighted',
      title: 'Weighted DSU — relationships, not just membership',
      blocks: [
        { t: 'p', text: 'Store a weight on the edge from each node to its parent, representing a *ratio* or *offset*. Path compression must then accumulate weights as it flattens.' },
        {
          t: 'code',
          lang: 'java',
          caption: 'Evaluate Division — weighted DSU where weight = value relative to the root',
          code: `
Map<String,String> parent = new HashMap<>();
Map<String,Double> weight = new HashMap<>();   // node / parent

String find(String x) {
    String p = parent.get(x);
    if (!p.equals(x)) {
        String root = find(p);
        weight.put(x, weight.get(x) * weight.get(p));   // accumulate on the way back
        parent.put(x, root);
        p = root;
    }
    return p;
}

void union(String a, String b, double value) {          // a / b = value
    String ra = find(a), rb = find(b);
    if (ra.equals(rb)) return;
    parent.put(ra, rb);
    weight.put(ra, value * weight.get(b) / weight.get(a));
}

double query(String a, String b) {
    if (!parent.containsKey(a) || !parent.containsKey(b)) return -1.0;
    if (!find(a).equals(find(b))) return -1.0;
    return weight.get(a) / weight.get(b);
}`,
        },
        {
          t: 'tip',
          title: 'Recursive find is required here',
          text: 'The iterative path-halving trick does not compose weights correctly. Weighted DSU needs the recursive form so the weight products are accumulated as the recursion unwinds. Accept the `O(log n)` stack depth.',
        },
      ],
    },
  ],

  patterns: [
    {
      id: 'dsu-connectivity',
      name: 'Incremental Connectivity',
      oneLiner: 'Union as edges arrive; query membership in effectively constant time.',
      useWhen: ['"Are a and b connected?" interleaved with adding edges.', 'Counting groups as connections form.'],
      recognize: ['"Number of provinces/components", "accounts merge", "similar strings", "friend circles".'],
      steps: ['Size the DSU by the number of elements.', 'Union for every relation.', 'Read `componentCount()` or group by root.'],
      template: {
        lang: 'java',
        caption: 'Grouping by root after all unions',
        code: `
Map<Integer, List<String>> groups = new HashMap<>();
for (int i = 0; i < n; i++)
    groups.computeIfAbsent(dsu.find(i), k -> new ArrayList<>()).add(items[i]);`,
      },
      complexity: 'O(E · α(n)) ≈ O(E).',
      gotchas: [
        'Group by `find(i)`, never by `parent[i]` — the parent may not be the root.',
        'If elements are strings, map them to integer ids first (or use a `HashMap` DSU).',
      ],
      problems: ['Number of Provinces', 'Accounts Merge', 'Number of Connected Components in an Undirected Graph', 'Satisfiability of Equality Equations', 'Most Stones Removed with Same Row or Column'],
    },
    {
      id: 'dsu-cycle',
      name: 'Cycle Detection (undirected)',
      oneLiner: 'An edge whose endpoints already share a root closes a cycle.',
      useWhen: ['Validating a tree, finding a redundant edge, Kruskal.'],
      recognize: ['"Redundant connection", "valid tree", "minimum spanning tree".'],
      steps: ['Union each edge.', 'A `false` return means this edge is redundant.', 'A tree also requires exactly `n − 1` edges and one component.'],
      complexity: 'O(E · α(n)).',
      gotchas: ['Only valid for undirected graphs.', 'Redundant Connection II (directed) additionally needs in-degree analysis — DSU alone is not enough.'],
      problems: ['Redundant Connection', 'Graph Valid Tree', 'Redundant Connection II'],
    },
    {
      id: 'kruskal',
      name: 'Kruskal’s MST',
      oneLiner: 'Sort edges by weight and take each one that connects two different components.',
      useWhen: ['Minimum cost to connect all nodes.'],
      recognize: ['"Minimum cost to connect all points/cities", "min cost to supply water".'],
      steps: ['Build the edge list (for geometric problems, all pairs).', 'Sort by weight.', 'Union greedily; stop after `n − 1` accepted edges.'],
      template: {
        lang: 'java',
        caption: 'Min Cost to Connect All Points',
        code: `
List<int[]> edges = new ArrayList<>();
for (int i = 0; i < n; i++)
    for (int j = i + 1; j < n; j++)
        edges.add(new int[]{ manhattan(points[i], points[j]), i, j });

edges.sort(Comparator.comparingInt(e -> e[0]));

DSU dsu = new DSU(n);
int total = 0, used = 0;
for (int[] e : edges) {
    if (dsu.union(e[1], e[2])) {
        total += e[0];
        if (++used == n - 1) break;
    }
}
return total;`,
      },
      complexity: 'O(E log E); for complete geometric graphs `E = n²`, so `O(n² log n)`.',
      gotchas: ['Stop early at `n − 1` edges.', 'If fewer than `n − 1` edges are accepted, the graph is disconnected.', 'For dense graphs, Prim with a heap is often better.'],
      problems: ['Min Cost to Connect All Points', 'Connecting Cities With Minimum Cost', 'Optimize Water Distribution in a Village'],
    },
    {
      id: 'dsu-virtual',
      name: 'Virtual Node',
      oneLiner: 'Add sentinel elements representing abstract groups, then connectivity answers the question.',
      useWhen: ['"Does this cell reach the border / the top / the ocean?"', 'Percolation-style problems.'],
      recognize: ['Many possible targets that are all equivalent for the purposes of the question.'],
      steps: ['Allocate extra DSU slots for the abstract targets.', 'Union real elements with the sentinel where appropriate.', 'Query `connected(x, sentinel)`.'],
      complexity: 'Same as plain DSU.',
      gotchas: ['Size the DSU to include the sentinels.', 'Two sentinels (top and bottom) can create a false connection through the sentinel — think carefully before using more than one.'],
      problems: ['Surrounded Regions', 'Number of Islands II', 'Swim in Rising Water'],
    },
    {
      id: 'weighted-dsu',
      name: 'Weighted / Relational DSU',
      oneLiner: 'Store a ratio or offset toward the parent so you can answer relative queries.',
      useWhen: ['Division/ratio chains, "a is k units ahead of b", equation consistency.'],
      recognize: ['"Evaluate division", "check whether the equations are consistent".'],
      steps: ['Keep `weight[x]` = value of `x` relative to `parent[x]`.', 'Accumulate products during a recursive `find`.', 'Compare only within the same component.'],
      complexity: 'O(α(n)) amortised per operation.',
      gotchas: ['Use the recursive `find` — iterative halving loses the weight composition.', 'Return −1 for unknown variables *and* for cross-component queries.'],
      problems: ['Evaluate Division', 'Satisfiability of Equality Equations'],
    },
  ],

  pitfalls: [
    { title: 'Skipping both optimisations', text: 'Naive DSU degenerates to O(n) per find.' },
    { title: 'Comparing parent[] instead of find()', text: 'Only roots are canonical.' },
    { title: 'Using DSU on a directed graph', text: 'Union is symmetric; direction is lost. Use DFS colouring or Kahn.' },
    { title: 'Expecting to undo a union', text: 'There is no split. Process queries in reverse instead.' },
    { title: 'Forgetting to size for virtual nodes', text: 'Off-by-one array bounds when sentinels are added.' },
    { title: 'Iterative find in weighted DSU', text: 'Weights must be composed during the recursive unwind.' },
  ],

  cheatsheet: [
    { label: 'find', value: 'walk to root + path halving' },
    { label: 'union', value: 'attach smaller under larger' },
    { label: 'union returns false', value: '⇒ cycle / redundant edge' },
    { label: 'Component count', value: 'start n, decrement per union' },
    { label: 'Grid cell id', value: 'r * cols + c' },
    { label: 'Tree check', value: 'n−1 edges + connected + no cycle' },
    { label: 'MST', value: 'sort edges + union greedily' },
    { label: '"Reaches the border"', value: 'virtual node' },
    { label: 'Deletions', value: 'process queries in reverse' },
    { label: 'Ratios', value: 'weighted DSU, recursive find' },
    { label: 'Complexity', value: 'O(α(n)) ≈ O(1)' },
  ],

  problems: [
    { name: 'Number of Connected Components in an Undirected Graph', difficulty: 'Medium', url: 'https://leetcode.com/problems/number-of-connected-components-in-an-undirected-graph/', pattern: 'Connectivity', insight: 'Start with n components and decrement on each successful union.' },
    { name: 'Number of Provinces', difficulty: 'Medium', url: 'https://leetcode.com/problems/number-of-provinces/', pattern: 'Connectivity', insight: 'The adjacency matrix makes the union loop O(n²).' },
    { name: 'Redundant Connection', difficulty: 'Medium', url: 'https://leetcode.com/problems/redundant-connection/', pattern: 'Cycle detection', insight: 'The first edge whose union returns false is the answer.' },
    { name: 'Graph Valid Tree', difficulty: 'Medium', url: 'https://leetcode.com/problems/graph-valid-tree/', pattern: 'Cycle + count', insight: 'Exactly n−1 edges and no cycle implies connected — check both.' },
    { name: 'Accounts Merge', difficulty: 'Medium', url: 'https://leetcode.com/problems/accounts-merge/', pattern: 'Connectivity + grouping', insight: 'Union all emails inside each account, then bucket emails by root and sort.' },
    { name: 'Most Stones Removed with Same Row or Column', difficulty: 'Medium', url: 'https://leetcode.com/problems/most-stones-removed-with-same-row-or-column/', pattern: 'Connectivity', insight: 'The answer is n − componentCount; union rows with columns using an offset.' },
    { name: 'Satisfiability of Equality Equations', difficulty: 'Medium', url: 'https://leetcode.com/problems/satisfiability-of-equality-equations/', pattern: 'Connectivity', insight: 'Process all "==" first, then verify no "!=" pair shares a root.' },
    { name: 'Evaluate Division', difficulty: 'Medium', url: 'https://leetcode.com/problems/evaluate-division/', pattern: 'Weighted DSU', insight: 'Weights are ratios to the root; queries divide two weights.' },
    { name: 'Min Cost to Connect All Points', difficulty: 'Medium', url: 'https://leetcode.com/problems/min-cost-to-connect-all-points/', pattern: 'Kruskal MST', insight: 'Build all n² edges, sort by Manhattan distance, union greedily.' },
    { name: 'Number of Operations to Make Network Connected', difficulty: 'Medium', url: 'https://leetcode.com/problems/number-of-operations-to-make-network-connected/', pattern: 'Connectivity', insight: 'Need at least n−1 cables; the answer is componentCount − 1.' },
    { name: 'Smallest String With Swaps', difficulty: 'Medium', url: 'https://leetcode.com/problems/smallest-string-with-swaps/', pattern: 'Connectivity + sort', insight: 'Swappable indices form a component; sort the characters within each component.' },
    { name: 'Surrounded Regions', difficulty: 'Medium', url: 'https://leetcode.com/problems/surrounded-regions/', pattern: 'Virtual node', insight: 'Union all border O cells with a single sentinel.' },
    { name: 'Number of Islands II', difficulty: 'Hard', url: 'https://leetcode.com/problems/number-of-islands-ii/', pattern: 'Incremental DSU', insight: 'The problem DSU exists for — land appears one cell at a time.' },
    { name: 'Redundant Connection II', difficulty: 'Hard', url: 'https://leetcode.com/problems/redundant-connection-ii/', pattern: 'DSU + degree analysis', insight: 'Directed: first find a node with two parents, then decide which of its edges to drop.' },
    { name: 'Swim in Rising Water', difficulty: 'Hard', url: 'https://leetcode.com/problems/swim-in-rising-water/', pattern: 'DSU over sorted cells', insight: 'Add cells in increasing height, unioning neighbours, until start and end connect.' },
    { name: 'Bricks Falling When Hit', difficulty: 'Hard', url: 'https://leetcode.com/problems/bricks-falling-when-hit/', pattern: 'Reverse-time DSU', insight: 'Remove all hits first, then add them back in reverse and measure the growth of the roof component.' },
    { name: 'Optimize Water Distribution in a Village', difficulty: 'Hard', url: 'https://leetcode.com/problems/optimize-water-distribution-in-a-village/', pattern: 'Kruskal + virtual node', insight: 'Model wells as edges to a virtual node 0, then run a plain MST.' },
  ],
}
