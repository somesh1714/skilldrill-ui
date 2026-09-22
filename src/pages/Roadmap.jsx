import { Link as RouterLink } from 'react-router-dom'
import {
  Box, Container, Typography, Paper, Stack, Chip, Card, CardContent, Divider, LinearProgress,
} from '@mui/material'
import Grid from '@mui/material/Grid'
import { alpha, useTheme } from '@mui/material/styles'
import PageHeader from '../components/PageHeader.jsx'
import Callout from '../components/Callout.jsx'
import { contentFor } from '../content/index.js'

const { topicsById } = contentFor('dsa')
import { trackCrumb } from '../content/tracks.js'
import { useProgress, problemKey } from '../lib/progress.js'

const PLAN = [
  {
    phase: 'Phase 1 — Foundations',
    weeks: 'Weeks 1–4',
    goal: 'Build the reflexes. By the end you should read a constraint and know your complexity budget without thinking.',
    color: '#0e7490',
    weeksDetail: [
      { week: 1, topics: ['complexity', 'arrays'], focus: 'The six-step framework, Big-O, prefix sums, Kadane, in-place tricks.', target: '25 problems' },
      { week: 2, topics: ['two-pointers', 'hashing'], focus: 'The sliding-window template until it is muscle memory. Hash-key modelling.', target: '30 problems' },
      { week: 3, topics: ['binary-search', 'sorting'], focus: 'The firstTrue template, then binary search on the answer. Comparators.', target: '25 problems' },
      { week: 4, topics: ['strings'], focus: 'Palindromes, character counting, and the hidden costs of Java strings. Review week.', target: '20 problems + redo weak spots' },
    ],
  },
  {
    phase: 'Phase 2 — Core structures',
    weeks: 'Weeks 5–8',
    goal: 'The bulk of real interviews. Traversals, recursion contracts and the structures they run on.',
    color: '#4f46e5',
    weeksDetail: [
      { week: 5, topics: ['linked-list', 'stacks-queues'], focus: 'Dummy heads and reversal; then monotonic stacks, which are worth a week on their own.', target: '30 problems' },
      { week: 6, topics: ['recursion', 'trees'], focus: 'The recursive contract. Traversals, then "return down, record through".', target: '35 problems' },
      { week: 7, topics: ['heaps', 'intervals'], focus: 'Top-k direction rule, two heaps, sweep lines and the sort-key decision.', target: '25 problems' },
      { week: 8, topics: ['graphs'], focus: 'BFS/DFS, topological sort, Dijkstra. Spend the whole week here — it is that important.', target: '30 problems' },
    ],
  },
  {
    phase: 'Phase 3 — Advanced',
    weeks: 'Weeks 9–12',
    goal: 'The topics that decide senior outcomes. DP gets three weeks because it deserves three weeks.',
    color: '#9333ea',
    weeksDetail: [
      { week: 9, topics: ['greedy', 'dp'], focus: 'Exchange arguments; then the DP framework, linear DP and knapsack.', target: '25 problems' },
      { week: 10, topics: ['dp'], focus: 'Two-sequence DP, LIS, grid DP. Do the brute-force → memo → table progression every time.', target: '25 DP problems' },
      { week: 11, topics: ['dp', 'tries', 'union-find'], focus: 'Interval and state-machine DP. Then tries and DSU, which are quick wins.', target: '25 problems' },
      { week: 12, topics: ['bit-manipulation', 'math', 'advanced-structures'], focus: 'Bit tricks, number theory, and recognising when a segment tree is required.', target: '20 problems + full mock interviews' },
    ],
  },
]

const RULES = [
  {
    title: 'Two hours beats six hours once a week',
    text: 'Spaced repetition is not a preference, it is how memory works. Ninety focused minutes a day for twelve weeks will beat a weekend binge every time.',
  },
  {
    title: 'Twenty minutes, then look',
    text: 'If you are genuinely stuck for twenty minutes, read the insight — but then close it and write the solution from scratch. Staring at a problem for two hours teaches you nothing except frustration.',
  },
  {
    title: 'Re-solve, do not re-read',
    text: 'A problem you read the solution to is not solved. Put it in a list and redo it from blank three days later. That second attempt is where the learning actually happens.',
  },
  {
    title: 'Say the complexity out loud, every time',
    text: 'Before you write code, state your target. After you write it, state what you achieved. This one habit converts directly into interview performance.',
  },
  {
    title: 'Keep a mistakes log',
    text: 'One line per bug: "forgot to seed the prefix map with {0:1}". Read it before every practice session. Your bugs repeat far more than you expect.',
  },
  {
    title: 'Mock interviews from week 8',
    text: 'Solving alone and solving while narrating to a stranger are different skills. Start practising the second one well before you need it.',
  },
]

function WeekCard({ w, color }) {
  const theme = useTheme()
  const { solved } = useProgress()

  const uniqueTopics = [...new Set(w.topics)]
  const problems = uniqueTopics.flatMap((id) =>
    (topicsById[id]?.problems || []).map((p) => problemKey(id, p.name)),
  )
  const done = problems.filter((k) => solved[k]).length
  const pct = problems.length ? (done / problems.length) * 100 : 0

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ p: 2.25 }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1 }}>
          <Box
            sx={{
              width: 28, height: 28, borderRadius: '50%', display: 'grid', placeItems: 'center',
              bgcolor: alpha(color, 0.14), border: `1px solid ${alpha(color, 0.35)}`,
              color, fontWeight: 800, fontSize: '0.78rem', flexShrink: 0,
            }}
          >
            {w.week}
          </Box>
          <Typography variant="caption" sx={{ fontWeight: 800, letterSpacing: '0.06em', color: 'text.secondary' }}>
            WEEK {w.week}
          </Typography>
        </Stack>

        <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: 'wrap', mb: 1.25 }}>
          {uniqueTopics.map((id) => (
            <Chip
              key={id}
              size="small"
              component={RouterLink}
              to={`/dsa/${id}`}
              clickable
              label={topicsById[id]?.short || id}
              sx={{
                height: 22, fontSize: '0.7rem', fontWeight: 600,
                color, bgcolor: alpha(color, 0.1), border: `1px solid ${alpha(color, 0.28)}`,
              }}
            />
          ))}
        </Stack>

        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.85rem', lineHeight: 1.65, mb: 1.5 }}>
          {w.focus}
        </Typography>

        <Divider sx={{ mb: 1.25 }} />

        <Stack direction="row" sx={{ justifyContent: 'space-between', mb: 0.5 }}>
          <Typography variant="caption" color="text.disabled">Target: {w.target}</Typography>
          <Typography variant="caption" sx={{ fontWeight: 700, color: done ? color : 'text.disabled' }}>
            {done}/{problems.length}
          </Typography>
        </Stack>
        <LinearProgress
          variant="determinate"
          value={pct}
          sx={{ bgcolor: alpha(color, 0.12), '& .MuiLinearProgress-bar': { bgcolor: color } }}
        />
      </CardContent>
    </Card>
  )
}

export default function Roadmap() {
  const theme = useTheme()

  return (
    <Box>
      <PageHeader
        eyebrow="Plan"
        title="The 12-week roadmap"
        lead="A realistic schedule at roughly 10–12 hours a week. If you have less time, stretch it rather than skipping — the ordering matters more than the pace."
        crumbs={[{ label: 'Home', to: '/' }, trackCrumb('dsa'), { label: 'Roadmap' }]}
        chips={[{ label: '12 weeks' }, { label: '~10h / week' }, { label: '3 phases' }]}
      />

      <Container maxWidth="xl" sx={{ px: { xs: 2, md: 3 }, py: { xs: 3, md: 4 } }}>
        <Box sx={{ maxWidth: 900, mb: 4 }}>
          <Callout
            tone="key"
            title="Read this before you start"
            text="The single biggest mistake is doing problems in random order. Patterns compound: sliding window is easier after two pointers, DP is easier after recursion, and graphs are easier after trees. Follow the order, and let each chapter’s prerequisites tell you whether you are ready."
          />
        </Box>

        <Stack spacing={5}>
          {PLAN.map((phase) => (
            <Box key={phase.phase}>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1}
                sx={{ alignItems: { sm: 'baseline' }, justifyContent: 'space-between', mb: 2 }}
              >
                <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
                  <Box sx={{ width: 3, height: 22, borderRadius: 1, bgcolor: phase.color }} />
                  <Typography variant="h6" sx={{ fontWeight: 760 }}>{phase.phase}</Typography>
                  <Chip
                    size="small"
                    label={phase.weeks}
                    sx={{
                      height: 20, fontSize: '0.68rem',
                      color: phase.color, bgcolor: alpha(phase.color, 0.12),
                      border: `1px solid ${alpha(phase.color, 0.3)}`,
                    }}
                  />
                </Stack>
              </Stack>

              <Typography variant="body2" color="text.secondary" sx={{ mb: 2, maxWidth: 820 }}>
                {phase.goal}
              </Typography>

              <Grid container spacing={2}>
                {phase.weeksDetail.map((w) => (
                  <Grid key={w.week} size={{ xs: 12, sm: 6, lg: 3 }}>
                    <WeekCard w={w} color={phase.color} />
                  </Grid>
                ))}
              </Grid>
            </Box>
          ))}
        </Stack>

        <Divider sx={{ my: 5 }} />

        <Typography variant="h6" sx={{ fontWeight: 760, mb: 0.5 }}>
          Six rules that make the difference
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          The schedule above is the easy part. These are the habits that decide whether it works.
        </Typography>

        <Grid container spacing={2}>
          {RULES.map((r, i) => (
            <Grid key={r.title} size={{ xs: 12, md: 6, lg: 4 }}>
              <Paper
                variant="outlined"
                className="mh-rise"
                sx={{ p: 2, height: '100%', animationDelay: `${i * 50}ms` }}
              >
                <Stack direction="row" spacing={1.25} sx={{ alignItems: 'flex-start' }}>
                  <Box
                    sx={{
                      width: 22, height: 22, borderRadius: '50%', flexShrink: 0, mt: '2px',
                      display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 800,
                      color: 'primary.main',
                      bgcolor: alpha(theme.palette.primary.main, 0.13),
                    }}
                  >
                    {i + 1}
                  </Box>
                  <Box>
                    <Typography sx={{ fontWeight: 700, mb: 0.4, fontSize: '0.95rem' }}>{r.title}</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.855rem', lineHeight: 1.65 }}>
                      {r.text}
                    </Typography>
                  </Box>
                </Stack>
              </Paper>
            </Grid>
          ))}
        </Grid>

        <Box sx={{ maxWidth: 900, mt: 4 }}>
          <Callout
            tone="tip"
            title="If you only have four weeks"
            text="Do Complexity, Arrays, Two Pointers, Hashing, Binary Search, Trees, Graphs and the linear + knapsack halves of DP. That set covers the large majority of screening questions. Skip Elite entirely and come back to it later."
          />
        </Box>
      </Container>
    </Box>
  )
}
