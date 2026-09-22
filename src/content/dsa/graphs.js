export default {
  id: 'graphs',
  title: 'Graphs — Traversal, Shortest Paths & Topological Order',
  short: 'Graphs',
  icon: 'HubRounded',
  tier: 'Core',
  order: 13,
  estHours: 20,
  prereqs: ['trees', 'stacks-queues'],
  tagline: 'Once you can see the graph, the algorithm is a lookup. The skill is seeing the graph.',
  mentalModel:
    'A graph is just "things and the connections between them". A tree is a graph without cycles. A grid is a graph where the edges are implied. The hard part of a graph interview is almost never the traversal — it is recognising that the problem *is* a graph.',
  whyItMatters:
    'Graphs unify the hardest-looking interview questions: course scheduling, word ladders, flood fill, network delay, island counting, dependency resolution. They are also the closest DSA topic to real backend work — service dependency graphs, DAG-based build systems, routing.',

  complexity: [
    { op: 'BFS / DFS', time: 'O(V + E)', space: 'O(V)', note: 'Every vertex and edge once' },
    { op: 'Topological sort (Kahn or DFS)', time: 'O(V + E)', space: 'O(V)', note: 'DAGs only' },
    { op: 'Dijkstra (binary heap)', time: 'O(E log V)', space: 'O(V)', note: 'Non-negative weights only' },
    { op: 'Bellman–Ford', time: 'O(V · E)', space: 'O(V)', note: 'Handles negative edges, detects negative cycles' },
    { op: 'Floyd–Warshall', time: 'O(V³)', space: 'O(V²)', note: 'All pairs; fine for V ≤ 400' },
    { op: 'Union-Find (near-constant)', time: 'O(α(n))', space: 'O(V)', note: 'Connectivity, Kruskal' },
    { op: 'Kruskal MST', time: 'O(E log E)', space: 'O(V)', note: 'Sort edges + DSU' },
    { op: 'Prim MST', time: 'O(E log V)', space: 'O(V)', note: 'Heap-based, better on dense graphs' },
  ],

  sections: [
    {
      id: 'seeing',
      title: 'Step one: see the graph',
      blocks: [
        { t: 'lead', text: 'Most graph problems do not mention graphs. Here is how they disguise themselves.' },
        {
          t: 'table',
          head: ['Disguise', 'Vertices', 'Edges'],
          rows: [
            ['2-D grid / maze / image', 'cells `(r, c)`', 'the 4 or 8 neighbours'],
            ['Course prerequisites', 'courses', '`a → b` means a before b'],
            ['Word ladder', 'words', 'words differing by one letter'],
            ['Currency exchange', 'currencies', 'rates (use `−log(rate)` for arbitrage)'],
            ['Flight routes with stops', '(city, stops used)', 'flights'],
            ['String equations `a==b`, `a!=b`', 'variables', 'equality edges (then check inequalities)'],
            ['Clone / copy a structure', 'objects', 'references between them'],
            ['State puzzles (locks, jugs, board positions)', 'each reachable state', 'one legal move'],
          ],
        },
        {
          t: 'key',
          title: 'The state-graph insight',
          text: 'When a problem asks for the **minimum number of moves/steps/changes**, the vertices are *states* and the edges are *legal moves*, and the answer is a BFS. Open the Lock, Word Ladder, Minimum Genetic Mutation, Sliding Puzzle and Jump Game III are all one algorithm with a different `neighbours()` function.',
        },
        { t: 'h', text: 'Representations' },
        {
          t: 'code',
          lang: 'java',
          caption: 'Build an adjacency list — the default representation',
          code: `
// From an edge list, directed
List<List<Integer>> g = new ArrayList<>();
for (int i = 0; i < n; i++) g.add(new ArrayList<>());
for (int[] e : edges) {
    g.get(e[0]).add(e[1]);
    // g.get(e[1]).add(e[0]);     // add this line for an UNDIRECTED graph
}

// Weighted: store {neighbour, weight}
List<List<int[]>> wg = new ArrayList<>();
for (int[] e : edges) wg.get(e[0]).add(new int[]{ e[1], e[2] });

// Grid: no structure needed — the neighbours are implicit
int[][] DIRS = {{1,0},{-1,0},{0,1},{0,-1}};
for (int[] d : DIRS) {
    int nr = r + d[0], nc = c + d[1];
    if (nr < 0 || nc < 0 || nr >= rows || nc >= cols) continue;
    // ...
}`,
        },
        {
          t: 'dl',
          items: [
            { term: 'Adjacency list', def: '`O(V + E)` space. The default for everything — sparse graphs, which is nearly all interview graphs.' },
            { term: 'Adjacency matrix', def: '`O(V²)` space, `O(1)` edge lookup. Use for dense graphs, Floyd–Warshall, or when `V ≤ 400`.' },
            { term: 'Edge list', def: 'Just `int[][] edges`. Perfect for Kruskal and Bellman–Ford, which iterate edges rather than neighbours.' },
            { term: 'Implicit', def: 'Grids and state puzzles. Never materialise the graph — generate neighbours on demand.' },
          ],
        },
      ],
    },
    {
      id: 'traversal',
      title: 'BFS and DFS — and when each is wrong',
      blocks: [
        {
          t: 'compare',
          left: {
            title: 'Use BFS when…',
            items: [
              'You need the **shortest path in an unweighted graph**',
              'You need level-by-level information',
              'The graph may be huge and the target near',
              'You need "minimum number of moves"',
            ],
          },
          right: {
            title: 'Use DFS when…',
            items: [
              'You need to explore/enumerate everything',
              'Connected components, cycle detection, topological order',
              'You need path information from root to current node',
              'Backtracking over choices',
            ],
          },
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'BFS — the template, with the level counter',
          code: `
int bfs(int start, int target, List<List<Integer>> g) {
    boolean[] seen = new boolean[g.size()];
    Queue<Integer> q = new ArrayDeque<>();
    q.offer(start); seen[start] = true;          // mark on ENQUEUE, not on dequeue
    int steps = 0;

    while (!q.isEmpty()) {
        int size = q.size();                     // one full level
        for (int i = 0; i < size; i++) {
            int u = q.poll();
            if (u == target) return steps;
            for (int v : g.get(u)) {
                if (seen[v]) continue;
                seen[v] = true;
                q.offer(v);
            }
        }
        steps++;
    }
    return -1;
}`,
        },
        {
          t: 'trap',
          title: 'Mark visited on enqueue, never on dequeue',
          text: 'If you mark when you *dequeue*, the same vertex can be enqueued many times before it is first processed. On a dense graph that is exponential blow-up. This is the single most common BFS bug.',
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'DFS — recursive and iterative',
          code: `
void dfs(int u, List<List<Integer>> g, boolean[] seen) {
    seen[u] = true;
    for (int v : g.get(u)) if (!seen[v]) dfs(v, g, seen);
}

// Iterative, for deep graphs where recursion would overflow
void dfsIterative(int start, List<List<Integer>> g) {
    boolean[] seen = new boolean[g.size()];
    Deque<Integer> st = new ArrayDeque<>();
    st.push(start);
    while (!st.isEmpty()) {
        int u = st.pop();
        if (seen[u]) continue;        // check on POP for the stack version
        seen[u] = true;
        for (int v : g.get(u)) if (!seen[v]) st.push(v);
    }
}`,
        },
        { t: 'h', text: 'Multi-source BFS — the trick that flattens a whole family of problems' },
        { t: 'p', text: 'If several starting points spread simultaneously, push **all of them into the queue before the loop starts**. The BFS then computes the distance to the *nearest* source for every cell, in one pass.' },
        {
          t: 'code',
          lang: 'java',
          caption: 'Rotting Oranges / 01 Matrix — seed the queue with every source',
          code: `
Queue<int[]> q = new ArrayDeque<>();
for (int r = 0; r < rows; r++)
    for (int c = 0; c < cols; c++)
        if (grid[r][c] == SOURCE) { q.offer(new int[]{ r, c }); dist[r][c] = 0; }
        else dist[r][c] = -1;

while (!q.isEmpty()) {
    int[] cur = q.poll();
    for (int[] d : DIRS) {
        int nr = cur[0] + d[0], nc = cur[1] + d[1];
        if (nr < 0 || nc < 0 || nr >= rows || nc >= cols) continue;
        if (dist[nr][nc] != -1) continue;
        dist[nr][nc] = dist[cur[0]][cur[1]] + 1;
        q.offer(new int[]{ nr, nc });
    }
}`,
        },
        {
          t: 'tip',
          title: 'Bidirectional BFS',
          text: 'For Word Ladder-style problems with a known target, search from both ends and always expand the *smaller* frontier. It reduces the explored space from `O(b^d)` to roughly `O(b^(d/2))` — often a 10× speed-up. Mentioning it as an optimisation is a strong finish.',
        },
      ],
    },
    {
      id: 'toposort',
      title: 'Topological sort & cycle detection',
      blocks: [
        { t: 'p', text: 'A topological order lists vertices so that every edge points forward. It exists **if and only if the graph is a DAG**, which is why topological sort doubles as a cycle detector.' },
        {
          t: 'code',
          lang: 'java',
          caption: 'Kahn’s algorithm (BFS) — my default, because it detects cycles naturally',
          code: `
int[] topoSort(int n, int[][] edges) {
    List<List<Integer>> g = new ArrayList<>();
    for (int i = 0; i < n; i++) g.add(new ArrayList<>());
    int[] indeg = new int[n];
    for (int[] e : edges) { g.get(e[0]).add(e[1]); indeg[e[1]]++; }

    Queue<Integer> q = new ArrayDeque<>();
    for (int i = 0; i < n; i++) if (indeg[i] == 0) q.offer(i);

    int[] order = new int[n];
    int idx = 0;
    while (!q.isEmpty()) {
        int u = q.poll();
        order[idx++] = u;
        for (int v : g.get(u))
            if (--indeg[v] == 0) q.offer(v);      // v's last prerequisite is done
    }
    return idx == n ? order : new int[0];         // short order ⇒ a cycle exists
}`,
        },
        {
          t: 'key',
          title: 'The cycle test',
          text: 'If Kahn’s algorithm emits fewer than `V` vertices, the remaining vertices are in (or downstream of) a cycle. That one comparison answers "Course Schedule" completely.',
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'DFS cycle detection — three colours, for directed graphs',
          code: `
// 0 = unvisited, 1 = in the current recursion stack, 2 = fully processed
boolean hasCycle(int u, List<List<Integer>> g, int[] color) {
    color[u] = 1;
    for (int v : g.get(u)) {
        if (color[v] == 1) return true;                  // BACK EDGE -> cycle
        if (color[v] == 0 && hasCycle(v, g, color)) return true;
    }
    color[u] = 2;                                        // done with u
    return false;
}`,
        },
        {
          t: 'warn',
          title: 'Directed vs undirected cycle detection are different',
          text: 'In a **directed** graph you need the three-colour scheme — a grey (in-stack) neighbour is a cycle. In an **undirected** graph, simply seeing a visited neighbour is not a cycle (it might be the edge you came in on); you must skip the parent, or use Union-Find. Mixing these up is a very common error.',
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'Undirected cycle detection — skip the parent',
          code: `
boolean hasCycleUndirected(int u, int parent, List<List<Integer>> g, boolean[] seen) {
    seen[u] = true;
    for (int v : g.get(u)) {
        if (v == parent) continue;                  // the edge we arrived on
        if (seen[v]) return true;
        if (hasCycleUndirected(v, u, g, seen)) return true;
    }
    return false;
}
// A tree check: connected AND edges == n - 1 AND no cycle.`,
        },
      ],
    },
    {
      id: 'shortest-paths',
      title: 'Shortest paths — pick the right algorithm',
      blocks: [
        {
          t: 'table',
          head: ['Situation', 'Algorithm', 'Complexity'],
          rows: [
            ['Unweighted (all edges cost 1)', '**BFS**', 'O(V + E)'],
            ['Edge weights 0 or 1', '**0-1 BFS** (deque)', 'O(V + E)'],
            ['Non-negative weights', '**Dijkstra**', 'O(E log V)'],
            ['Negative weights allowed', '**Bellman–Ford**', 'O(V · E)'],
            ['Negative cycle detection', '**Bellman–Ford** (n-th relaxation)', 'O(V · E)'],
            ['All pairs, small V (≤ 400)', '**Floyd–Warshall**', 'O(V³)'],
            ['At most k edges / stops', '**Bellman–Ford, k rounds**', 'O(k · E)'],
          ],
        },
        {
          t: 'trap',
          title: 'Do not reach for Dijkstra on an unweighted graph',
          text: 'BFS is simpler, faster, and impossible to get wrong. Using a heap where a queue would do is a small but real negative signal.',
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'Dijkstra — lazy deletion version (no decrease-key needed)',
          code: `
int[] dijkstra(int n, List<List<int[]>> g, int src) {
    int[] dist = new int[n];
    Arrays.fill(dist, Integer.MAX_VALUE);
    dist[src] = 0;

    // {distance, vertex}, ordered by distance
    PriorityQueue<int[]> pq = new PriorityQueue<>(Comparator.comparingInt(a -> a[0]));
    pq.offer(new int[]{ 0, src });

    while (!pq.isEmpty()) {
        int[] top = pq.poll();
        int d = top[0], u = top[1];
        if (d > dist[u]) continue;            // STALE entry — skip it

        for (int[] e : g.get(u)) {
            int v = e[0], w = e[1];
            if (dist[u] + w < dist[v]) {
                dist[v] = dist[u] + w;
                pq.offer(new int[]{ dist[v], v });   // push a fresh entry
            }
        }
    }
    return dist;
}`,
        },
        {
          t: 'key',
          title: 'Why Dijkstra fails with negative edges',
          text: 'Dijkstra finalises a vertex the moment it is popped, on the assumption that no cheaper route can appear later. A negative edge breaks that assumption — a longer path can become cheaper further along. That is exactly what Bellman–Ford’s repeated relaxation handles.',
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'Bellman–Ford with a k-edge limit — Cheapest Flights Within K Stops',
          code: `
int findCheapestPrice(int n, int[][] flights, int src, int dst, int k) {
    int[] dist = new int[n];
    Arrays.fill(dist, Integer.MAX_VALUE);
    dist[src] = 0;

    for (int round = 0; round <= k; round++) {       // k stops = k + 1 edges
        int[] next = dist.clone();                   // SNAPSHOT: one more edge only
        for (int[] f : flights) {
            if (dist[f[0]] == Integer.MAX_VALUE) continue;
            next[f[1]] = Math.min(next[f[1]], dist[f[0]] + f[2]);
        }
        dist = next;
    }
    return dist[dst] == Integer.MAX_VALUE ? -1 : dist[dst];
}`,
        },
        {
          t: 'trap',
          title: 'The clone is the algorithm',
          text: 'Without `dist.clone()`, a single round can chain several edges together and you will allow more than `k` stops. Relaxing from a snapshot of the previous round is what bounds the number of edges used.',
        },
        {
          t: 'tip',
          title: '0-1 BFS',
          text: 'When every edge weighs 0 or 1, use a **deque**: push zero-weight moves to the **front** and one-weight moves to the **back**. This keeps the deque sorted by distance without a heap, giving `O(V + E)`. It solves problems like "minimum obstacles to remove".',
        },
      ],
    },
    {
      id: 'grids',
      title: 'Grid problems — the biggest single family',
      blocks: [
        { t: 'p', text: 'Islands, flood fill, rotting oranges, surrounded regions, shortest path in a maze — all the same two templates with a different neighbour test.' },
        {
          t: 'code',
          lang: 'java',
          caption: 'Number of Islands — DFS with in-place marking',
          code: `
int numIslands(char[][] g) {
    int count = 0;
    for (int r = 0; r < g.length; r++)
        for (int c = 0; c < g[0].length; c++)
            if (g[r][c] == '1') { count++; sink(g, r, c); }
    return count;
}

void sink(char[][] g, int r, int c) {
    if (r < 0 || c < 0 || r >= g.length || c >= g[0].length || g[r][c] != '1') return;
    g[r][c] = '0';                       // mark visited in place
    sink(g, r + 1, c); sink(g, r - 1, c);
    sink(g, r, c + 1); sink(g, r, c - 1);
}`,
        },
        {
          t: 'key',
          title: 'The boundary-inward trick',
          text: 'For "Surrounded Regions" and "Pacific Atlantic Water Flow", do not ask "can this cell escape?" for every cell — that is `O((mn)²)`. Instead, start from the **border** and mark everything reachable *inward*. One pass, `O(mn)`. Inverting the direction of the question is the whole insight.',
        },
        {
          t: 'warn',
          title: 'Recursion depth on large grids',
          text: 'A 1000×1000 grid of all-land will recurse a million deep and overflow the stack. Use BFS or an explicit stack when the constraints are large. Mention this even if you write the recursive version.',
        },
      ],
    },
    {
      id: 'union-find-mst',
      title: 'Connectivity and minimum spanning trees',
      blocks: [
        { t: 'p', text: 'When the question is purely "are these connected?" or "how many groups?", Union-Find is usually simpler and faster than a traversal — especially when edges arrive incrementally. It has its own chapter; here is the graph-level view.' },
        {
          t: 'table',
          head: ['Question', 'Best tool'],
          rows: [
            ['Count connected components (static graph)', 'DFS/BFS or DSU — both O(V+E)'],
            ['Edges arrive one at a time; query connectivity', '**DSU** (traversal would be O(V+E) per query)'],
            ['Detect a cycle in an undirected graph', '**DSU** — a union of two already-joined nodes'],
            ['Minimum spanning tree', '**Kruskal** (sort + DSU) or **Prim** (heap)'],
            ['Detect a cycle in a directed graph', 'DFS three-colouring or Kahn — DSU does **not** work'],
          ],
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'Kruskal — sort edges, union greedily',
          code: `
int minimumSpanningTree(int n, int[][] edges) {
    Arrays.sort(edges, Comparator.comparingInt(e -> e[2]));   // by weight
    DSU dsu = new DSU(n);
    int total = 0, used = 0;

    for (int[] e : edges) {
        if (dsu.union(e[0], e[1])) {      // union returns false if already connected
            total += e[2];
            if (++used == n - 1) break;   // a spanning tree has exactly n-1 edges
        }
    }
    return used == n - 1 ? total : -1;    // -1 ⇒ the graph is disconnected
}`,
        },
      ],
    },
  ],

  patterns: [
    {
      id: 'bfs-shortest',
      name: 'BFS for Shortest Path (unweighted)',
      oneLiner: 'Level-by-level expansion finds the fewest-edges path, guaranteed.',
      useWhen: ['Minimum number of steps/moves/transformations.', 'All edges cost the same.'],
      recognize: ['"Minimum number of", "fewest", "shortest" with uniform cost.'],
      steps: ['Queue + visited set.', 'Mark on enqueue.', 'Count levels with a size snapshot, or store distance per node.'],
      template: {
        lang: 'java',
        caption: 'Grid BFS with distance tracking',
        code: `
int[][] DIRS = {{1,0},{-1,0},{0,1},{0,-1}};
Queue<int[]> q = new ArrayDeque<>();
boolean[][] seen = new boolean[m][n];
q.offer(new int[]{ sr, sc }); seen[sr][sc] = true;
int steps = 0;

while (!q.isEmpty()) {
    for (int i = q.size(); i > 0; i--) {
        int[] cur = q.poll();
        if (isTarget(cur)) return steps;
        for (int[] d : DIRS) {
            int nr = cur[0] + d[0], nc = cur[1] + d[1];
            if (nr < 0 || nc < 0 || nr >= m || nc >= n) continue;
            if (seen[nr][nc] || blocked(nr, nc)) continue;
            seen[nr][nc] = true;
            q.offer(new int[]{ nr, nc });
        }
    }
    steps++;
}
return -1;`,
      },
      complexity: 'O(V + E) time, O(V) space.',
      gotchas: [
        'Mark visited on enqueue.',
        'For state puzzles, the visited set is over **states**, not positions — encode the state as a string or an integer.',
        'Bidirectional BFS roughly halves the exponent when the target is known.',
      ],
      problems: ['Word Ladder', 'Rotting Oranges', '01 Matrix', 'Open the Lock', 'Shortest Path in Binary Matrix', 'Minimum Genetic Mutation'],
    },
    {
      id: 'dfs-components',
      name: 'DFS for Components & Exploration',
      oneLiner: 'Sink each region as you find it; the number of launches is the number of components.',
      useWhen: ['Counting islands/provinces/regions.', 'Computing a per-region aggregate (area, perimeter, shape).'],
      recognize: ['"Number of islands/provinces/groups", "largest region", "flood fill".'],
      steps: ['Loop over all cells/vertices.', 'On an unvisited one, increment the counter and DFS to consume the whole component.', 'Mark visited in place or with a separate array.'],
      complexity: 'O(V + E), or O(rows · cols) for grids.',
      gotchas: [
        'Guard bounds before reading the cell.',
        'Use BFS for very large grids to avoid stack overflow.',
        'For shape comparison (Distinct Islands), record the *relative* path or offsets, not absolute coordinates.',
      ],
      problems: ['Number of Islands', 'Max Area of Island', 'Flood Fill', 'Number of Provinces', 'Surrounded Regions', 'Pacific Atlantic Water Flow'],
    },
    {
      id: 'topo-sort',
      name: 'Topological Sort',
      oneLiner: 'Repeatedly emit a vertex with no unmet prerequisites.',
      useWhen: ['Ordering with dependencies.', 'Detecting cycles in a directed graph.', 'DP over a DAG.'],
      recognize: ['"Prerequisites", "build order", "must come before", "alien dictionary".'],
      steps: [
        'Build the adjacency list and in-degree array.',
        'Enqueue all zero in-degree vertices.',
        'Pop, emit, decrement neighbours, enqueue new zeros.',
        'If fewer than V emitted, a cycle exists.',
      ],
      complexity: 'O(V + E) time and space.',
      gotchas: [
        'Direction matters: `[a, b]` meaning "b before a" must produce the edge `b → a`. Get this backwards and everything is reversed.',
        'Use a `PriorityQueue` instead of a queue when the lexicographically smallest order is required.',
        'Alien Dictionary: a prefix appearing *after* its extension (`"abc"` then `"ab"`) is invalid input, not a cycle.',
      ],
      problems: ['Course Schedule', 'Course Schedule II', 'Alien Dictionary', 'Minimum Height Trees', 'Sequence Reconstruction', 'Parallel Courses'],
    },
    {
      id: 'dijkstra',
      name: 'Dijkstra (non-negative weighted shortest path)',
      oneLiner: 'Always expand the closest unfinalised vertex.',
      useWhen: ['Weighted edges, all non-negative.', 'Minimum cost/time/effort path.'],
      recognize: ['"Minimum time for all nodes to receive a signal", "path with minimum effort", "cheapest route".'],
      steps: ['`dist[]` filled with infinity; `dist[src] = 0`.', 'Min-heap of `{dist, vertex}`.', 'Skip stale entries; relax each outgoing edge.'],
      complexity: 'O(E log V) time, O(V) space.',
      gotchas: [
        'The stale check `if (d > dist[u]) continue;` is what replaces decrease-key. Without it you re-expand vertices.',
        'Not valid with negative weights.',
        'Variants change the relaxation: **Path With Minimum Effort** minimises `max(edge)` instead of the sum; **Maximum Probability** maximises a product.',
      ],
      problems: ['Network Delay Time', 'Path with Minimum Effort', 'Cheapest Flights Within K Stops', 'Swim in Rising Water', 'Path with Maximum Probability'],
    },
    {
      id: 'multi-source',
      name: 'Multi-Source BFS',
      oneLiner: 'Seed the queue with every source, and one BFS gives the distance to the nearest one.',
      useWhen: ['"Distance to the nearest X" for every cell.', 'Simultaneous spreading (fire, rot, water).'],
      recognize: ['Several starting points that all begin at time zero.'],
      steps: ['Enqueue every source with distance 0 before entering the loop.', 'Run a standard BFS.'],
      complexity: 'O(V + E) — the same as a single BFS.',
      gotchas: ['Doing one BFS per source is `O(sources · V)` — usually the TLE solution.', 'Check for unreachable cells after the loop.'],
      problems: ['01 Matrix', 'Rotting Oranges', 'As Far from Land as Possible', 'Walls and Gates', 'Shortest Bridge'],
    },
    {
      id: 'bellman-ford',
      name: 'Bellman–Ford / Edge-Limited Relaxation',
      oneLiner: 'Relax every edge V−1 times; a V-th improvement proves a negative cycle.',
      useWhen: ['Negative weights.', 'A hard cap on the number of edges used.'],
      recognize: ['"At most k stops", "negative cost", "detect arbitrage".'],
      steps: ['Initialise distances.', 'Repeat V−1 (or k+1) rounds of relaxing all edges.', 'Snapshot the distance array per round when the edge count is bounded.'],
      complexity: 'O(V · E), or O(k · E) when bounded.',
      gotchas: ['Clone the distance array per round for the k-stop variant.', 'Currency arbitrage: take `−log(rate)` so a negative cycle means profit.'],
      problems: ['Cheapest Flights Within K Stops', 'Network Delay Time'],
    },
  ],

  pitfalls: [
    { title: 'Marking visited on dequeue', text: 'Lets a vertex enter the queue many times. Mark on enqueue.' },
    { title: 'Forgetting to add both directions', text: 'Undirected graphs need edges in both adjacency lists.' },
    { title: 'Using Dijkstra on negative weights', text: 'Silently wrong. Use Bellman–Ford.' },
    { title: 'Confusing directed and undirected cycle detection', text: 'Directed needs three-colouring; undirected needs a parent check or DSU.' },
    { title: 'Reversing the dependency direction', text: 'In Course Schedule, `[a, b]` means take `b` first, so the edge is `b → a`.' },
    { title: 'Deep recursion on big grids', text: 'A million-cell component overflows the stack; switch to BFS.' },
    { title: 'No stale check in Dijkstra', text: 'Re-expanding finalised vertices blows up the runtime.' },
    { title: 'Using positions instead of states as the visited key', text: 'In puzzles with keys/fuel/stops, the state includes those extras.' },
  ],

  cheatsheet: [
    { label: 'Unweighted shortest', value: 'BFS' },
    { label: 'Weighted, non-negative', value: 'Dijkstra O(E log V)' },
    { label: 'Negative edges', value: 'Bellman–Ford O(V·E)' },
    { label: 'Weights 0/1', value: '0-1 BFS with a deque' },
    { label: 'All pairs, V ≤ 400', value: 'Floyd–Warshall O(V³)' },
    { label: 'Dependencies', value: 'topological sort' },
    { label: 'Cycle in DAG check', value: 'Kahn emits < V vertices' },
    { label: 'Cycle (directed)', value: 'three-colour DFS' },
    { label: 'Cycle (undirected)', value: 'DSU or skip-parent DFS' },
    { label: 'Nearest-source distance', value: 'multi-source BFS' },
    { label: 'Islands', value: 'DFS + in-place sink' },
    { label: 'Escape/border problems', value: 'search inward from the border' },
    { label: 'MST', value: 'Kruskal (sort + DSU) or Prim' },
    { label: 'Mark visited', value: 'on enqueue' },
  ],

  problems: [
    { name: 'Flood Fill', difficulty: 'Easy', url: 'https://leetcode.com/problems/flood-fill/', pattern: 'Grid DFS', insight: 'Guard against the new colour equalling the old, or you loop forever.' },
    { name: 'Find the Town Judge', difficulty: 'Easy', url: 'https://leetcode.com/problems/find-the-town-judge/', pattern: 'Degree counting', insight: 'The judge has in-degree n−1 and out-degree 0 — no traversal needed.' },
    { name: 'Number of Provinces', difficulty: 'Medium', url: 'https://leetcode.com/problems/number-of-provinces/', pattern: 'Components', insight: 'DFS launches or DSU unions; both O(n²) on an adjacency matrix.' },
    { name: 'Number of Islands', difficulty: 'Medium', url: 'https://leetcode.com/problems/number-of-islands/', pattern: 'Grid DFS', insight: 'Sink each island in place; the launch count is the answer.' },
    { name: 'Max Area of Island', difficulty: 'Medium', url: 'https://leetcode.com/problems/max-area-of-island/', pattern: 'Grid DFS', insight: 'Return the area from the DFS and take the maximum.' },
    { name: 'Clone Graph', difficulty: 'Medium', url: 'https://leetcode.com/problems/clone-graph/', pattern: 'DFS + map', insight: 'Map original→clone and consult it before recursing, or cycles cause infinite recursion.' },
    { name: 'Course Schedule', difficulty: 'Medium', url: 'https://leetcode.com/problems/course-schedule/', pattern: 'Topological sort', insight: 'Cycle detection via Kahn’s emit count.' },
    { name: 'Course Schedule II', difficulty: 'Medium', url: 'https://leetcode.com/problems/course-schedule-ii/', pattern: 'Topological sort', insight: 'Same algorithm, but return the order instead of a boolean.' },
    { name: 'Rotting Oranges', difficulty: 'Medium', url: 'https://leetcode.com/problems/rotting-oranges/', pattern: 'Multi-source BFS', insight: 'Seed with every rotten orange; count levels; check for survivors at the end.' },
    { name: '01 Matrix', difficulty: 'Medium', url: 'https://leetcode.com/problems/01-matrix/', pattern: 'Multi-source BFS', insight: 'Seed with all zeros and expand outward.' },
    { name: 'Pacific Atlantic Water Flow', difficulty: 'Medium', url: 'https://leetcode.com/problems/pacific-atlantic-water-flow/', pattern: 'Reverse BFS/DFS from borders', insight: 'Flow *up* from each ocean and intersect the two reachable sets.' },
    { name: 'Surrounded Regions', difficulty: 'Medium', url: 'https://leetcode.com/problems/surrounded-regions/', pattern: 'Border-inward DFS', insight: 'Anything connected to the border survives; flip the rest.' },
    { name: 'Walls and Gates', difficulty: 'Medium', url: 'https://leetcode.com/problems/walls-and-gates/', pattern: 'Multi-source BFS', insight: 'Start from every gate at once.' },
    { name: 'Network Delay Time', difficulty: 'Medium', url: 'https://leetcode.com/problems/network-delay-time/', pattern: 'Dijkstra', insight: 'The answer is the maximum finalised distance; unreachable means −1.' },
    { name: 'Cheapest Flights Within K Stops', difficulty: 'Medium', url: 'https://leetcode.com/problems/cheapest-flights-within-k-stops/', pattern: 'Bellman–Ford, k rounds', insight: 'Clone the distance array each round to enforce the edge limit.' },
    { name: 'Path with Maximum Probability', difficulty: 'Medium', url: 'https://leetcode.com/problems/path-with-maximum-probability/', pattern: 'Dijkstra (maximising)', insight: 'Use a max-heap and multiply probabilities instead of adding costs.' },
    { name: 'Open the Lock', difficulty: 'Medium', url: 'https://leetcode.com/problems/open-the-lock/', pattern: 'State BFS', insight: 'Vertices are 4-digit strings; each has 8 neighbours. A perfect bidirectional-BFS candidate.' },
    { name: 'Redundant Connection', difficulty: 'Medium', url: 'https://leetcode.com/problems/redundant-connection/', pattern: 'Union-Find', insight: 'The first edge joining two already-connected nodes closes the cycle.' },
    { name: 'Graph Valid Tree', difficulty: 'Medium', url: 'https://leetcode.com/problems/graph-valid-tree/', pattern: 'Union-Find / DFS', insight: 'A tree has exactly n−1 edges, is connected, and has no cycle — check all three.' },
    { name: 'Minimum Height Trees', difficulty: 'Medium', url: 'https://leetcode.com/problems/minimum-height-trees/', pattern: 'Topological peeling', insight: 'Repeatedly strip leaves; the last one or two vertices are the centroids.' },
    { name: 'Shortest Bridge', difficulty: 'Medium', url: 'https://leetcode.com/problems/shortest-bridge/', pattern: 'DFS + multi-source BFS', insight: 'DFS to mark the first island, then BFS outward from all of its cells.' },
    { name: 'Evaluate Division', difficulty: 'Medium', url: 'https://leetcode.com/problems/evaluate-division/', pattern: 'Weighted graph DFS', insight: 'Edges carry ratios; a path product answers the query. Weighted DSU also works.' },
    { name: 'Accounts Merge', difficulty: 'Medium', url: 'https://leetcode.com/problems/accounts-merge/', pattern: 'Union-Find', insight: 'Union all emails within an account, then group by root.' },
    { name: 'Word Ladder', difficulty: 'Hard', url: 'https://leetcode.com/problems/word-ladder/', pattern: 'BFS on states', insight: 'Generate neighbours by wildcarding each position; bidirectional BFS is the optimisation.' },
    { name: 'Alien Dictionary', difficulty: 'Hard', url: 'https://leetcode.com/problems/alien-dictionary/', pattern: 'Topological sort', insight: 'Derive edges from the first differing character of adjacent words; reject the prefix-after-extension case.' },
    { name: 'Swim in Rising Water', difficulty: 'Hard', url: 'https://leetcode.com/problems/swim-in-rising-water/', pattern: 'Dijkstra / binary search + BFS', insight: 'Minimise the maximum cell value on the path — relax with max, not sum.' },
    { name: 'Critical Connections in a Network', difficulty: 'Hard', url: 'https://leetcode.com/problems/critical-connections-in-a-network/', pattern: 'Tarjan bridges', insight: 'An edge is a bridge when `low[child] > disc[node]` — no back edge escapes the subtree.' },
    { name: 'Reconstruct Itinerary', difficulty: 'Hard', url: 'https://leetcode.com/problems/reconstruct-itinerary/', pattern: 'Hierholzer (Eulerian path)', insight: 'Post-order DFS consuming edges, then reverse the result.' },
    { name: 'Making A Large Island', difficulty: 'Hard', url: 'https://leetcode.com/problems/making-a-large-island/', pattern: 'Component labelling', insight: 'Label islands with ids and sizes, then for each 0 sum its distinct neighbouring island sizes.' },
  ],
}
