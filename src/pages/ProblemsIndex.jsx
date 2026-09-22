import { useMemo, useState } from 'react'
import {
  Box, Container, Paper, Stack, Typography, Chip, LinearProgress, Button,
} from '@mui/material'
import Grid from '@mui/material/Grid'
import RestartAltRoundedIcon from '@mui/icons-material/RestartAltRounded'
import { alpha, useTheme } from '@mui/material/styles'
import PageHeader from '../components/PageHeader.jsx'
import ProblemTable from '../components/ProblemTable.jsx'
import { allProblems, topics, DIFFICULTY_ORDER } from '../content/index.js'
import { trackCrumb } from '../content/tracks.js'
import { difficultyColor } from '../theme.js'
import { useProgress, problemKey } from '../lib/progress.js'

function CountTile({ label, value, total, color }) {
  const theme = useTheme()
  const pct = total ? (value / total) * 100 : 0
  return (
    <Paper variant="outlined" sx={{ p: 1.75, borderColor: alpha(color, 0.3) }}>
      <Stack direction="row" sx={{ alignItems: 'baseline', justifyContent: 'space-between' }}>
        <Typography variant="caption" sx={{ fontWeight: 800, color, letterSpacing: '0.05em' }}>
          {label.toUpperCase()}
        </Typography>
        <Typography variant="caption" color="text.secondary">{total}</Typography>
      </Stack>
      <Typography sx={{ fontWeight: 800, fontSize: '1.5rem', lineHeight: 1.2, my: 0.25 }}>
        {value}
      </Typography>
      <LinearProgress
        variant="determinate"
        value={pct}
        sx={{ bgcolor: alpha(color, 0.14), '& .MuiLinearProgress-bar': { bgcolor: color } }}
      />
    </Paper>
  )
}

export default function ProblemsIndex() {
  const theme = useTheme()
  const { solved, count, reset } = useProgress()
  const [topicFilter, setTopicFilter] = useState('All')

  const sorted = useMemo(
    () =>
      [...allProblems].sort(
        (a, b) =>
          (DIFFICULTY_ORDER[a.difficulty] ?? 3) - (DIFFICULTY_ORDER[b.difficulty] ?? 3) ||
          a.topicTitle.localeCompare(b.topicTitle) ||
          a.name.localeCompare(b.name),
      ),
    [],
  )

  const shown = topicFilter === 'All' ? sorted : sorted.filter((p) => p.topicId === topicFilter)

  const byDifficulty = useMemo(() => {
    const out = { Easy: { total: 0, done: 0 }, Medium: { total: 0, done: 0 }, Hard: { total: 0, done: 0 } }
    for (const p of allProblems) {
      const bucket = out[p.difficulty]
      if (!bucket) continue
      bucket.total++
      if (solved[problemKey(p.topicId, p.name)]) bucket.done++
    }
    return out
  }, [solved])

  return (
    <Box>
      <PageHeader
        eyebrow="Practice"
        title="Problem tracker"
        lead="Every problem in the curriculum, sorted Easy → Hard, tagged with its pattern and the single insight that unlocks it. Tick them off as you solve them — progress is stored in this browser."
        crumbs={[{ label: 'Home', to: '/' }, trackCrumb('dsa'), { label: 'Problems' }]}
        chips={[
          { label: `${allProblems.length} problems` },
          { label: `${count} solved`, color: count ? 'success' : undefined },
        ]}
      />

      <Container maxWidth="xl" sx={{ px: { xs: 2, md: 3 }, py: { xs: 3, md: 4 } }}>
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {['Easy', 'Medium', 'Hard'].map((d) => (
            <Grid key={d} size={{ xs: 12, sm: 4, lg: 3 }}>
              <CountTile
                label={`${d} solved`}
                value={byDifficulty[d].done}
                total={byDifficulty[d].total}
                color={difficultyColor[d]}
              />
            </Grid>
          ))}
          <Grid size={{ xs: 12, sm: 12, lg: 3 }}>
            <Paper
              variant="outlined"
              sx={{ p: 1.75, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
            >
              <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary', letterSpacing: '0.05em' }}>
                OVERALL
              </Typography>
              <Typography sx={{ fontWeight: 800, fontSize: '1.5rem', lineHeight: 1.2 }}>
                {Math.round((count / allProblems.length) * 100)}%
              </Typography>
              <Button
                size="small"
                startIcon={<RestartAltRoundedIcon />}
                onClick={reset}
                disabled={count === 0}
                sx={{ alignSelf: 'flex-start', px: 0, minWidth: 0 }}
              >
                Reset progress
              </Button>
            </Paper>
          </Grid>
        </Grid>

        <Box sx={{ mb: 2.5 }}>
          <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', display: 'block', mb: 0.75 }}>
            FILTER BY TOPIC
          </Typography>
          <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: 'wrap' }}>
            <Chip
              size="small"
              label="All"
              onClick={() => setTopicFilter('All')}
              color={topicFilter === 'All' ? 'primary' : 'default'}
              variant={topicFilter === 'All' ? 'filled' : 'outlined'}
            />
            {topics.map((t) => (
              <Chip
                key={t.id}
                size="small"
                label={t.short || t.title}
                onClick={() => setTopicFilter(t.id === topicFilter ? 'All' : t.id)}
                color={topicFilter === t.id ? 'primary' : 'default'}
                variant={topicFilter === t.id ? 'filled' : 'outlined'}
              />
            ))}
          </Stack>
        </Box>

        <ProblemTable problems={shown} showTopic />

        <Typography
          variant="caption"
          color="text.disabled"
          sx={{ display: 'block', mt: 2, bgcolor: alpha(theme.palette.text.primary, 0.02), p: 1.5, borderRadius: 1.5 }}
        >
          Note: the same problem appears under more than one topic where it genuinely drills more than
          one pattern — Trapping Rain Water, for example, is both a two-pointer and a monotonic-stack
          exercise. Solving it once and ticking it in both places is fine.
        </Typography>
      </Container>
    </Box>
  )
}
