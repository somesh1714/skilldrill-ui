export default {
  id: 'intervals',
  title: 'Intervals & Sweep Line',
  short: 'Intervals',
  icon: 'LinearScaleRounded',
  tier: 'Core',
  order: 14,
  estHours: 6,
  prereqs: ['sorting'],
  tagline: 'Sort by the right endpoint and the problem solves itself. Sort by the wrong one and it is impossible.',
  mentalModel:
    'Intervals are events on a timeline. Either sort them and scan (merging, overlap detection), or explode them into `+1`/`−1` events and sweep (counting concurrency). The choice of **sort key** is the entire algorithm.',
  whyItMatters:
    'A small topic with an outsized interview presence — calendars, meeting rooms, resource allocation and rate limiting are all interval problems, and they map directly onto real backend systems.',

  complexity: [
    { op: 'Merge overlapping intervals', time: 'O(n log n)', space: 'O(n)', note: 'Dominated by the sort' },
    { op: 'Insert into a sorted interval list', time: 'O(n)', space: 'O(n)', note: 'Already sorted — no sort needed' },
    { op: 'Maximum concurrent intervals', time: 'O(n log n)', space: 'O(n)', note: 'Sweep line or heap' },
    { op: 'Minimum removals to remove overlap', time: 'O(n log n)', space: 'O(1)', note: 'Greedy by end time' },
    { op: 'Interval intersection of two lists', time: 'O(m + n)', space: 'O(1)', note: 'Two pointers on sorted lists' },
    { op: 'Range queries over intervals', time: 'O(log n)', space: 'O(n)', note: 'TreeMap of boundaries' },
  ],

  sections: [
    {
      id: 'sort-key',
      title: 'The decision that determines everything: which endpoint?',
      blocks: [
        { t: 'lead', text: 'There are only two sort keys, and choosing correctly is 90% of the work.' },
        {
          t: 'compare',
          left: {
            title: 'Sort by START when…',
            items: [
              'Merging overlapping intervals',
              'Inserting a new interval',
              'Detecting whether any overlap exists',
              'Allocating rooms / resources (with a heap of end times)',
              'Intersecting two interval lists',
            ],
          },
          right: {
            title: 'Sort by END when…',
            items: [
              'Maximising the count of non-overlapping intervals',
              'Minimising removals to eliminate overlaps',
              'Minimum number of arrows/points to hit all intervals',
              'Any "activity selection" greedy',
            ],
          },
        },
        {
          t: 'key',
          title: 'Why end-time sorting is optimal for selection',
          text: 'To fit the most activities, always take the one that **frees up the resource earliest**. Finishing sooner leaves at least as much room for everything after it as any other choice — that is a clean exchange argument, and it is the proof interviewers want to hear.',
        },
        {
          t: 'ascii',
          caption: 'Same three intervals, two questions, two sort keys.',
          code: `
   A  |-------------------|
   B      |----|
   C            |------|

  "Merge overlaps"        -> sort by START -> A absorbs B and C -> one interval
  "Max non-overlapping"   -> sort by END   -> pick B (ends first), then C -> 2`,
        },
      ],
    },
    {
      id: 'merge',
      title: 'Merging and inserting',
      blocks: [
        {
          t: 'code',
          lang: 'java',
          caption: 'Merge Intervals — the reference implementation',
          code: `
int[][] merge(int[][] intervals) {
    Arrays.sort(intervals, Comparator.comparingInt(a -> a[0]));
    List<int[]> out = new ArrayList<>();

    for (int[] iv : intervals) {
        int[] last = out.isEmpty() ? null : out.get(out.size() - 1);
        if (last != null && iv[0] <= last[1]) {
            last[1] = Math.max(last[1], iv[1]);   // EXTEND — max, not iv[1]
        } else {
            out.add(new int[]{ iv[0], iv[1] });   // start a new run
        }
    }
    return out.toArray(new int[0][]);
}`,
        },
        {
          t: 'trap',
          title: 'Use max when extending',
          text: 'Writing `last[1] = iv[1]` is wrong when one interval fully contains another: `[1,10]` followed by `[2,3]` would shrink the merged interval to `[1,3]`. Always `Math.max`.',
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'Insert Interval — three phases, no sorting required',
          code: `
int[][] insert(int[][] intervals, int[] newIv) {
    List<int[]> out = new ArrayList<>();
    int i = 0, n = intervals.length;

    // 1. everything strictly before the new interval
    while (i < n && intervals[i][1] < newIv[0]) out.add(intervals[i++]);

    // 2. absorb everything that overlaps
    while (i < n && intervals[i][0] <= newIv[1]) {
        newIv[0] = Math.min(newIv[0], intervals[i][0]);
        newIv[1] = Math.max(newIv[1], intervals[i][1]);
        i++;
    }
    out.add(newIv);

    // 3. everything strictly after
    while (i < n) out.add(intervals[i++]);

    return out.toArray(new int[0][]);
}`,
        },
        {
          t: 'tip',
          title: 'The overlap test, once and for all',
          text: 'Intervals `[a1, a2]` and `[b1, b2]` overlap **iff** `a1 <= b2 && b1 <= a2`. Their intersection, when it exists, is `[max(a1,b1), min(a2,b2)]`. Memorise both; they appear in every interval problem.',
        },
      ],
    },
    {
      id: 'sweep',
      title: 'Sweep line — counting concurrency',
      blocks: [
        { t: 'p', text: 'When the question is "how many are active at once?", forget the intervals and think about **events**. Each interval contributes a `+1` at its start and a `−1` at its end. Sort all events by time and keep a running total; the maximum is the answer.' },
        {
          t: 'ascii',
          caption: 'Three meetings become six events. The running sum peaks at 2.',
          code: `
  meetings: [0,30] [5,10] [15,20]

  events:  (0,+1) (5,+1) (10,-1) (15,+1) (20,-1) (30,-1)
  running:    1      2       1       2       1       0
                     ^               ^
                   peak = 2  ->  2 rooms needed`,
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'Meeting Rooms II — two equivalent solutions',
          code: `
// (a) SWEEP LINE: separate the starts and the ends, then two-pointer them
int minMeetingRooms(int[][] intervals) {
    int n = intervals.length;
    int[] starts = new int[n], ends = new int[n];
    for (int i = 0; i < n; i++) { starts[i] = intervals[i][0]; ends[i] = intervals[i][1]; }
    Arrays.sort(starts); Arrays.sort(ends);

    int rooms = 0, best = 0, j = 0;
    for (int i = 0; i < n; i++) {
        while (j < n && ends[j] <= starts[i]) { rooms--; j++; }   // frees first
        rooms++;
        best = Math.max(best, rooms);
    }
    return best;
}

// (b) HEAP: a min-heap of end times; its size is the number of rooms in use
int minMeetingRooms2(int[][] intervals) {
    Arrays.sort(intervals, Comparator.comparingInt(a -> a[0]));
    PriorityQueue<Integer> ends = new PriorityQueue<>();
    for (int[] iv : intervals) {
        if (!ends.isEmpty() && ends.peek() <= iv[0]) ends.poll();
        ends.offer(iv[1]);
    }
    return ends.size();
}`,
        },
        {
          t: 'warn',
          title: 'Process ends before starts at the same timestamp',
          text: 'If a meeting ends at 10 and another starts at 10, they do **not** need two rooms. Sorting the end events first (or using `<=` in the comparison) encodes that. If the problem instead treats touching intervals as overlapping, flip it to `<`. Ask which convention applies.',
        },
        {
          t: 'tip',
          title: 'When coordinates are small, skip the sort',
          text: 'If times are bounded (say 0–10⁶), a difference array is `O(n + range)` and needs no sorting: `diff[start]++`, `diff[end]--`, then a prefix sum. That is exactly the Arrays chapter’s difference-array pattern applied to a timeline.',
        },
      ],
    },
    {
      id: 'greedy-selection',
      title: 'Greedy selection by end time',
      blocks: [
        {
          t: 'code',
          lang: 'java',
          caption: 'Non-overlapping Intervals — keep the most, remove the rest',
          code: `
int eraseOverlapIntervals(int[][] intervals) {
    Arrays.sort(intervals, Comparator.comparingInt(a -> a[1]));   // by END

    int kept = 0, lastEnd = Integer.MIN_VALUE;
    for (int[] iv : intervals) {
        if (iv[0] >= lastEnd) {        // no overlap with the last kept interval
            kept++;
            lastEnd = iv[1];
        }
    }
    return intervals.length - kept;    // removals = total - kept
}`,
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'Minimum Number of Arrows to Burst Balloons — the same greedy, inverted',
          code: `
int findMinArrowShots(int[][] points) {
    Arrays.sort(points, Comparator.comparingInt(a -> a[1]));      // by END

    int arrows = 1;
    long lastArrow = points[0][1];
    for (int[] p : points) {
        if (p[0] > lastArrow) {        // this balloon starts after the last arrow
            arrows++;
            lastArrow = p[1];          // fire at the earliest possible end
        }
    }
    return arrows;
}`,
        },
        {
          t: 'key',
          title: 'One greedy, three questions',
          text: 'Maximum non-overlapping intervals, minimum removals, and minimum "hit points" are the same algorithm: **sort by end, greedily take the earliest-ending compatible interval**. Recognising this collapses three Mediums into one.',
        },
        {
          t: 'trap',
          title: 'Closed versus half-open intervals',
          text: 'For balloons, `[1,2]` and `[2,3]` *can* be burst by one arrow at x = 2, so the test is `p[0] > lastArrow`. For meeting rooms, `[1,2]` and `[2,3]` do *not* conflict, so the test is `start >= lastEnd`. Read the statement carefully — the strictness flips the answer.',
        },
      ],
    },
    {
      id: 'advanced',
      title: 'Dynamic interval structures',
      blocks: [
        { t: 'p', text: 'When intervals are *inserted over time* and you must answer conflict queries, a sorted map of boundaries gives `O(log n)` per operation.' },
        {
          t: 'code',
          lang: 'java',
          caption: 'My Calendar I — TreeMap floor/ceiling for conflict detection',
          code: `
class MyCalendar {
    private final TreeMap<Integer,Integer> booked = new TreeMap<>();   // start -> end

    public boolean book(int start, int end) {
        Integer prevStart = booked.floorKey(start);     // latest booking at or before
        Integer nextStart = booked.ceilingKey(start);   // earliest booking after

        if (prevStart != null && booked.get(prevStart) > start) return false;
        if (nextStart != null && nextStart < end)             return false;

        booked.put(start, end);
        return true;
    }
}`,
        },
        {
          t: 'note',
          title: 'Scaling up: My Calendar II and III',
          text: '**II** (no triple booking) keeps a second list of known double-bookings. **III** (report the maximum k-booking at any time) is the sweep line again — a `TreeMap<Integer,Integer>` of `+1`/`−1` deltas, scanned for the running maximum after every insert.',
        },
        {
          t: 'code',
          lang: 'java',
          caption: 'Interval List Intersections — two pointers, no sorting',
          code: `
int[][] intervalIntersection(int[][] A, int[][] B) {
    List<int[]> out = new ArrayList<>();
    int i = 0, j = 0;

    while (i < A.length && j < B.length) {
        int lo = Math.max(A[i][0], B[j][0]);
        int hi = Math.min(A[i][1], B[j][1]);
        if (lo <= hi) out.add(new int[]{ lo, hi });      // they overlap

        // advance whichever ends first — it can have no further intersections
        if (A[i][1] < B[j][1]) i++; else j++;
    }
    return out.toArray(new int[0][]);
}`,
        },
      ],
    },
  ],

  patterns: [
    {
      id: 'sort-merge',
      name: 'Sort by Start, Then Merge',
      oneLiner: 'Adjacent intervals in start order either overlap the running block or begin a new one.',
      useWhen: ['Merging, inserting, detecting any overlap, computing total covered length.'],
      recognize: ['"Merge overlapping", "insert interval", "can a person attend all meetings".'],
      steps: ['Sort by start.', 'Keep a running interval.', 'Extend with `max(end)` on overlap, otherwise emit and restart.'],
      template: {
        lang: 'java',
        caption: 'The running-block skeleton',
        code: `
Arrays.sort(iv, Comparator.comparingInt(a -> a[0]));
int curStart = iv[0][0], curEnd = iv[0][1];

for (int i = 1; i < iv.length; i++) {
    if (iv[i][0] <= curEnd) {
        curEnd = Math.max(curEnd, iv[i][1]);        // extend
    } else {
        emit(curStart, curEnd);                     // close the block
        curStart = iv[i][0]; curEnd = iv[i][1];
    }
}
emit(curStart, curEnd);                             // do not forget the last one`,
      },
      complexity: 'O(n log n) time, O(n) space.',
      gotchas: ['`Math.max` when extending.', 'Emit the final block after the loop.', 'Decide whether touching endpoints count as overlapping.'],
      problems: ['Merge Intervals', 'Insert Interval', 'Meeting Rooms', 'Summary Ranges', 'Remove Covered Intervals'],
    },
    {
      id: 'sort-by-end-greedy',
      name: 'Greedy by End Time (activity selection)',
      oneLiner: 'Always take the interval that finishes earliest among the compatible ones.',
      useWhen: ['Maximise how many intervals you can keep.', 'Minimise removals or "hit points".'],
      recognize: ['"Maximum number of non-overlapping", "minimum intervals to remove", "minimum arrows".'],
      steps: ['Sort by end.', 'Track `lastEnd`.', 'Take an interval when it starts at or after `lastEnd`.'],
      complexity: 'O(n log n) time, O(1) space.',
      gotchas: [
        'Sorting by start here gives a wrong answer — a long early interval blocks many short ones.',
        'The comparison strictness (`>` vs `>=`) depends on whether touching counts as overlapping.',
      ],
      problems: ['Non-overlapping Intervals', 'Minimum Number of Arrows to Burst Balloons', 'Maximum Length of Pair Chain', 'Course Schedule III'],
    },
    {
      id: 'sweep-line',
      name: 'Sweep Line / Event Counting',
      oneLiner: 'Convert intervals into +1 and −1 events, sort by time, and track the running total.',
      useWhen: ['Maximum concurrency, resource counts, skyline, booking conflicts.'],
      recognize: ['"How many at the same time", "minimum rooms/servers/platforms", "maximum overlap".'],
      steps: ['Emit `(start, +1)` and `(end, −1)`.', 'Sort by time; at equal times process `−1` before `+1` (unless touching counts as overlap).', 'Track the running sum and its maximum.'],
      template: {
        lang: 'java',
        caption: 'Sweep with a TreeMap of deltas — works for huge coordinate ranges',
        code: `
TreeMap<Integer,Integer> delta = new TreeMap<>();
for (int[] iv : intervals) {
    delta.merge(iv[0],  1, Integer::sum);
    delta.merge(iv[1], -1, Integer::sum);       // end is exclusive here
}

int running = 0, best = 0;
for (int d : delta.values()) {                  // TreeMap iterates in key order
    running += d;
    best = Math.max(best, running);
}`,
      },
      complexity: 'O(n log n) time, O(n) space.',
      gotchas: [
        'Endpoint tie-breaking is the whole problem — state your convention.',
        'If coordinates are small and dense, a difference array is O(n + range) with no sorting.',
      ],
      problems: ['Meeting Rooms II', 'Car Pooling', 'My Calendar III', 'The Skyline Problem', 'Employee Free Time'],
    },
    {
      id: 'two-pointer-intervals',
      name: 'Two Pointers on Two Interval Lists',
      oneLiner: 'Walk both sorted lists together; advance whichever ends first.',
      useWhen: ['Intersecting two already-sorted interval lists.', 'Finding free time common to two schedules.'],
      recognize: ['Two sorted, non-overlapping interval lists as input.'],
      steps: ['Compute `[max(starts), min(ends)]`; emit if non-empty.', 'Advance the pointer whose interval ends first.'],
      complexity: 'O(m + n) time, O(1) space.',
      gotchas: ['Advance based on the **end**, not the start.', 'Inputs are already sorted — do not sort again.'],
      problems: ['Interval List Intersections', 'Employee Free Time'],
    },
    {
      id: 'treemap-intervals',
      name: 'TreeMap Boundary Queries',
      oneLiner: 'Store intervals in a sorted map and use floor/ceiling to find the neighbours in O(log n).',
      useWhen: ['Intervals arrive dynamically and each must be validated against existing ones.'],
      recognize: ['"Design a calendar", "book a room if no conflict", "range module".'],
      steps: ['Key the map by start.', '`floorKey(start)` gives the potential left conflict; `ceilingKey(start)` the right.', 'Check both, then insert.'],
      complexity: 'O(log n) per booking.',
      gotchas: ['Handle null returns from floor/ceiling.', 'Merging adjacent ranges (Range Module) requires removing and re-inserting entries.'],
      problems: ['My Calendar I', 'My Calendar II', 'Range Module', 'Data Stream as Disjoint Intervals'],
    },
  ],

  pitfalls: [
    { title: 'Sorting by the wrong endpoint', text: 'Merging needs start; selection greedies need end. This one choice decides correctness.' },
    { title: 'Assigning instead of maxing when extending', text: 'A fully contained interval silently shrinks the merged block.' },
    { title: 'Ambiguous endpoint semantics', text: 'Does `[1,2]` overlap `[2,3]`? Ask. It flips `<` to `<=` throughout.' },
    { title: 'Forgetting to emit the final block', text: 'The last running interval never triggers the "close" branch inside the loop.' },
    { title: 'Re-sorting already-sorted input', text: 'Insert Interval and Interval List Intersections give you sorted data; sorting wastes the O(n) opportunity.' },
    { title: 'Integer overflow on coordinates', text: 'Balloon problems use values near `Integer.MAX_VALUE`; use `long` for the comparison state.' },
  ],

  cheatsheet: [
    { label: 'Overlap test', value: 'a1 <= b2 && b1 <= a2' },
    { label: 'Intersection', value: '[max(a1,b1), min(a2,b2)]' },
    { label: 'Merge', value: 'sort by START' },
    { label: 'Max non-overlapping', value: 'sort by END' },
    { label: 'Min removals', value: 'n − maxNonOverlapping' },
    { label: 'Min arrows', value: 'sort by END, fire at the end' },
    { label: 'Max concurrency', value: 'sweep +1/−1, track the peak' },
    { label: 'Rooms needed', value: 'min-heap of end times' },
    { label: 'Extend a block', value: 'end = max(end, iv[1])' },
    { label: 'Dynamic booking', value: 'TreeMap floorKey/ceilingKey' },
    { label: 'Two sorted lists', value: 'two pointers, advance smaller end' },
    { label: 'Small coordinate range', value: 'difference array, no sort' },
  ],

  problems: [
    { name: 'Summary Ranges', difficulty: 'Easy', url: 'https://leetcode.com/problems/summary-ranges/', pattern: 'Scan and group', insight: 'Consecutive runs become intervals; a gentle warm-up for the merge loop.' },
    { name: 'Meeting Rooms', difficulty: 'Easy', url: 'https://leetcode.com/problems/meeting-rooms/', pattern: 'Sort by start', insight: 'Sort, then check each adjacent pair for overlap.' },
    { name: 'Merge Intervals', difficulty: 'Medium', url: 'https://leetcode.com/problems/merge-intervals/', pattern: 'Sort by start + merge', insight: 'Extend with `max`; emit the final block after the loop.' },
    { name: 'Insert Interval', difficulty: 'Medium', url: 'https://leetcode.com/problems/insert-interval/', pattern: 'Three-phase scan', insight: 'Input is already sorted — O(n) with no sorting.' },
    { name: 'Non-overlapping Intervals', difficulty: 'Medium', url: 'https://leetcode.com/problems/non-overlapping-intervals/', pattern: 'Greedy by end', insight: 'Keep the most, remove the rest. Sorting by start is a trap.' },
    { name: 'Minimum Number of Arrows to Burst Balloons', difficulty: 'Medium', url: 'https://leetcode.com/problems/minimum-number-of-arrows-to-burst-balloons/', pattern: 'Greedy by end', insight: 'Fire each arrow at the earliest end; touching balloons share an arrow.' },
    { name: 'Meeting Rooms II', difficulty: 'Medium', url: 'https://leetcode.com/problems/meeting-rooms-ii/', pattern: 'Sweep line / heap', insight: 'Peak concurrency. Process ends before starts at equal times.' },
    { name: 'Interval List Intersections', difficulty: 'Medium', url: 'https://leetcode.com/problems/interval-list-intersections/', pattern: 'Two pointers', insight: 'Advance whichever interval ends first.' },
    { name: 'Car Pooling', difficulty: 'Medium', url: 'https://leetcode.com/problems/car-pooling/', pattern: 'Difference array', insight: 'Locations are bounded by 1000 — no sorting required.' },
    { name: 'My Calendar I', difficulty: 'Medium', url: 'https://leetcode.com/problems/my-calendar-i/', pattern: 'TreeMap boundaries', insight: 'floorKey and ceilingKey find the only two possible conflicts.' },
    { name: 'Remove Covered Intervals', difficulty: 'Medium', url: 'https://leetcode.com/problems/remove-covered-intervals/', pattern: 'Sort with tie-break', insight: 'Sort by start ascending and end **descending** so covers come first.' },
    { name: 'Maximum Length of Pair Chain', difficulty: 'Medium', url: 'https://leetcode.com/problems/maximum-length-of-pair-chain/', pattern: 'Greedy by end', insight: 'Identical to activity selection.' },
    { name: 'Partition Labels', difficulty: 'Medium', url: 'https://leetcode.com/problems/partition-labels/', pattern: 'Implicit intervals', insight: 'Each letter defines an interval [first, last]; merge them with a running max.' },
    { name: 'Course Schedule III', difficulty: 'Hard', url: 'https://leetcode.com/problems/course-schedule-iii/', pattern: 'Greedy + max-heap', insight: 'Sort by deadline; if a course overruns, drop the longest course taken so far.' },
    { name: 'Employee Free Time', difficulty: 'Hard', url: 'https://leetcode.com/problems/employee-free-time/', pattern: 'Merge all + gaps', insight: 'Flatten every schedule, merge, and report the gaps between merged blocks.' },
    { name: 'My Calendar III', difficulty: 'Hard', url: 'https://leetcode.com/problems/my-calendar-iii/', pattern: 'Sweep with TreeMap', insight: 'Maintain +1/−1 deltas and rescan for the running maximum after each booking.' },
    { name: 'The Skyline Problem', difficulty: 'Hard', url: 'https://leetcode.com/problems/the-skyline-problem/', pattern: 'Sweep + max-heap', insight: 'Events sorted by x; a max-heap of active heights; emit a point when the top changes.' },
    { name: 'Range Module', difficulty: 'Hard', url: 'https://leetcode.com/problems/range-module/', pattern: 'TreeMap of disjoint ranges', insight: 'Add, query and remove all reduce to locating and rewriting neighbouring entries.' },
  ],
}
