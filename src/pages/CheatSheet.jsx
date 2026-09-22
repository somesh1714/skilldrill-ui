import { useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import {
  Box, Container, Paper, Typography, Stack, Chip, Accordion, AccordionSummary,
  AccordionDetails, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, TextField, InputAdornment, Button,
} from '@mui/material'
import Grid from '@mui/material/Grid'
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded'
import SearchRoundedIcon from '@mui/icons-material/SearchRounded'
import UnfoldMoreRoundedIcon from '@mui/icons-material/UnfoldMoreRounded'
import UnfoldLessRoundedIcon from '@mui/icons-material/UnfoldLessRounded'
import { alpha, useTheme } from '@mui/material/styles'
import PageHeader from '../components/PageHeader.jsx'
import TopicIcon from '../lib/icons.jsx'
import Inline from '../components/Inline.jsx'
import { topics } from '../content/index.js'
import { trackCrumb } from '../content/tracks.js'
import { tierColor } from '../theme.js'

const CONSTRAINTS = [
  ['n ≤ 10–12', 'O(n!)', 'Permutations, brute-force search'],
  ['n ≤ 20–25', 'O(2ⁿ)', 'Subsets, bitmask DP, meet in the middle'],
  ['n ≤ 100', 'O(n³)', 'Floyd–Warshall, interval DP'],
  ['n ≤ 2 000', 'O(n²)', 'Classic 2-D DP, all-pairs scan'],
  ['n ≤ 10⁵', 'O(n log n)', 'Sort, heap, binary search, segment tree, DSU'],
  ['n ≤ 10⁷', 'O(n)', 'One pass, two pointers, prefix sums, counting'],
  ['n ≥ 10⁹', 'O(log n)', 'Binary search on the answer, maths, bit tricks'],
]

const SIGNALS = [
  ['Sorted array + find a pair', 'Two pointers from both ends'],
  ['“Contiguous subarray/substring” + longest/shortest', 'Sliding window'],
  ['“Count subarrays with sum = k”', 'Prefix sum + hash map'],
  ['“Top / k-th largest” on a stream', 'Min-heap of size k'],
  ['“Top / k-th largest” in memory, one shot', 'Quickselect'],
  ['“Next greater / previous smaller”', 'Monotonic stack'],
  ['“Maximum of every window of size k”', 'Monotonic deque'],
  ['“Minimum number of steps/moves”', 'BFS on states'],
  ['“Prerequisites” / “build order”', 'Topological sort'],
  ['“Minimum cost path”, weighted, non-negative', 'Dijkstra'],
  ['“At most k stops” or negative weights', 'Bellman–Ford'],
  ['“Are these connected?” as edges arrive', 'Union-Find'],
  ['“Minimise the maximum” / “maximise the minimum”', 'Binary search on the answer'],
  ['“Number of ways” / “best over choices”', 'Dynamic programming'],
  ['“Generate all …”', 'Backtracking'],
  ['“Prefix” + a dictionary of words', 'Trie'],
  ['“Merge / overlap” on intervals', 'Sort by start, then scan'],
  ['“Maximum non-overlapping”', 'Sort by end, greedy'],
  ['Values in [1, n], O(1) space', 'Cyclic sort / index-as-key'],
  ['“Every element twice except one”', 'XOR'],
  ['n ≤ 20 and “assign each exactly once”', 'Bitmask DP'],
  ['Mutable array + many range queries', 'Fenwick / segment tree'],
]

export default function CheatSheet() {
  const theme = useTheme()
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState(() => new Set(topics.map((t) => t.id)))

  const q = query.trim().toLowerCase()
  const shown = topics.filter(
    (t) =>
      !q ||
      t.title.toLowerCase().includes(q) ||
      (t.cheatsheet || []).some(
        (c) => c.label.toLowerCase().includes(q) || String(c.value).toLowerCase().includes(q),
      ),
  )

  const toggle = (id) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <Box>
      <PageHeader
        eyebrow="Revision"
        title="The cheat sheet"
        lead="Everything compressed. Read this the night before an interview — the constraint table and the signal table alone will carry most of a screen."
        crumbs={[{ label: 'Home', to: '/' }, trackCrumb('dsa'), { label: 'Cheat Sheet' }]}
      />

      <Container maxWidth="xl" sx={{ px: { xs: 2, md: 3 }, py: { xs: 3, md: 4 } }}>
        <Grid container spacing={3} sx={{ mb: 4 }}>
          {/* constraints */}
          <Grid size={{ xs: 12, lg: 5 }}>
            <Typography variant="h6" sx={{ fontWeight: 750, mb: 1.5 }}>
              Constraints → target complexity
            </Typography>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: alpha(theme.palette.text.primary, 0.03) }}>
                    <TableCell sx={{ fontSize: '0.78rem' }}>Given n</TableCell>
                    <TableCell sx={{ fontSize: '0.78rem' }}>Aim for</TableCell>
                    <TableCell sx={{ fontSize: '0.78rem' }}>Means</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {CONSTRAINTS.map((r) => (
                    <TableRow key={r[0]} hover>
                      <TableCell sx={{ fontSize: '0.82rem', whiteSpace: 'nowrap', fontWeight: 600 }}>{r[0]}</TableCell>
                      <TableCell sx={{ fontSize: '0.82rem', color: 'primary.main', fontWeight: 700, whiteSpace: 'nowrap' }}>{r[1]}</TableCell>
                      <TableCell sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>{r[2]}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 1 }}>
              Rule of thumb: a judge runs roughly 10⁸ simple operations per second.
            </Typography>
          </Grid>

          {/* signals */}
          <Grid size={{ xs: 12, lg: 7 }}>
            <Typography variant="h6" sx={{ fontWeight: 750, mb: 1.5 }}>
              Problem signal → technique
            </Typography>
            <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 520, overflow: 'auto' }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontSize: '0.78rem' }}>When the statement says…</TableCell>
                    <TableCell sx={{ fontSize: '0.78rem' }}>Reach for</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {SIGNALS.map((r) => (
                    <TableRow key={r[0]} hover>
                      <TableCell sx={{ fontSize: '0.82rem' }}>{r[0]}</TableCell>
                      <TableCell sx={{ fontSize: '0.82rem', fontWeight: 650, color: 'primary.main' }}>{r[1]}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Grid>
        </Grid>

        {/* per-topic cheat sheets */}
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1.5}
          sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between', mb: 2 }}
        >
          <Typography variant="h6" sx={{ fontWeight: 750 }}>Per-topic quick reference</Typography>
          <Stack direction="row" spacing={1}>
            <TextField
              size="small"
              placeholder="Filter…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              sx={{ minWidth: 220 }}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchRoundedIcon fontSize="small" sx={{ color: 'text.disabled' }} />
                    </InputAdornment>
                  ),
                },
              }}
            />
            <Button
              size="small"
              startIcon={expanded.size ? <UnfoldLessRoundedIcon /> : <UnfoldMoreRoundedIcon />}
              onClick={() => setExpanded(expanded.size ? new Set() : new Set(topics.map((t) => t.id)))}
            >
              {expanded.size ? 'Collapse' : 'Expand'} all
            </Button>
          </Stack>
        </Stack>

        {shown.map((t) => {
          const color = tierColor[t.tier]
          return (
            <Accordion key={t.id} expanded={expanded.has(t.id)} onChange={() => toggle(t.id)}>
              <AccordionSummary expandIcon={<ExpandMoreRoundedIcon />}>
                <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center', flex: 1, minWidth: 0 }}>
                  <TopicIcon name={t.icon} sx={{ fontSize: 18, color }} />
                  <Typography sx={{ fontWeight: 700, fontSize: '0.95rem' }}>
                    {t.short || t.title}
                  </Typography>
                  <Chip
                    size="small"
                    label={t.tier}
                    sx={{
                      height: 19, fontSize: '0.65rem',
                      color, bgcolor: alpha(color, 0.12), border: `1px solid ${alpha(color, 0.3)}`,
                    }}
                  />
                </Stack>
              </AccordionSummary>
              <AccordionDetails sx={{ pt: 0 }}>
                <Paper
                  variant="outlined"
                  sx={{ p: 1.5, mb: 1.5, bgcolor: alpha(color, theme.palette.mode === 'dark' ? 0.08 : 0.04), borderColor: alpha(color, 0.3) }}
                >
                  <Typography variant="body2" sx={{ fontStyle: 'italic' }}>
                    <Inline text={t.mentalModel} />
                  </Typography>
                </Paper>

                <Grid container spacing={1}>
                  {(t.cheatsheet || []).map((c, i) => (
                    <Grid key={i} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
                      <Box
                        sx={{
                          px: 1.25, py: 0.9, borderRadius: 1.5, height: '100%',
                          bgcolor: alpha(theme.palette.text.primary, theme.palette.mode === 'dark' ? 0.035 : 0.025),
                        }}
                      >
                        <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', fontWeight: 700 }}>
                          {c.label}
                        </Typography>
                        <Typography
                          sx={{
                            fontFamily: '"JetBrains Mono", monospace',
                            fontSize: '0.78rem', color: 'primary.main', wordBreak: 'break-word',
                          }}
                        >
                          {c.value}
                        </Typography>
                      </Box>
                    </Grid>
                  ))}
                </Grid>

                <Box sx={{ mt: 1.5 }}>
                  <Button component={RouterLink} to={`/dsa/${t.id}`} size="small" sx={{ px: 0, minWidth: 0 }}>
                    Open the chapter →
                  </Button>
                </Box>
              </AccordionDetails>
            </Accordion>
          )
        })}
      </Container>
    </Box>
  )
}
