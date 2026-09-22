import { useMemo, useState } from 'react'
import { Box, Button, Chip, Container, LinearProgress, Paper, Stack, Typography } from '@mui/material'
import Grid from '@mui/material/Grid'
import RestartAltRoundedIcon from '@mui/icons-material/RestartAltRounded'
import { alpha, useTheme } from '@mui/material/styles'
import PageHeader from '../components/PageHeader.jsx'
import ProblemTable from '../components/ProblemTable.jsx'
import { contentFor, DIFFICULTY_ORDER } from '../content/index.js'
import { trackCrumb, tracksById } from '../content/tracks.js'
import { difficultyColor } from '../theme.js'
import { useProgress, problemKey } from '../lib/progress.js'

function CountTile({ label, value, total, color }) {
  const pct = total ? (value / total) * 100 : 0
  return (
    <Paper variant="outlined" sx={{ p: 1.75, borderColor: alpha(color, 0.3) }}>
      <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
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

/**
 * A track's practice page. DSA calls these problems, Spring calls them
 * exercises — the wording comes from the track registry.
 */
export default function Practice({ trackId = 'dsa' }) {
  const theme = useTheme()
  const { solved, reset } = useProgress()
  const [topicFilter, setTopicFilter] = useState('All')

  const track = tracksById[trackId]
  const { allProblems, topics } = contentFor(trackId)

  const sorted = useMemo(
    () =>
      [...allProblems].sort(
        (a, b) =>
          (DIFFICULTY_ORDER[a.difficulty] ?? 3) - (DIFFICULTY_ORDER[b.difficulty] ?? 3) ||
          a.topicTitle.localeCompare(b.topicTitle) ||
          a.name.localeCompare(b.name),
      ),
    [allProblems],
  )

  const shown = topicFilter === 'All' ? sorted : sorted.filter((p) => p.topicId === topicFilter)
  const solvedHere = allProblems.filter((p) => solved[problemKey(p.topicId, p.name)]).length

  const byDifficulty = useMemo(() => {
    const out = { Easy: { total: 0, done: 0 }, Medium: { total: 0, done: 0 }, Hard: { total: 0, done: 0 } }
    for (const p of allProblems) {
      const bucket = out[p.difficulty]
      if (!bucket) continue
      bucket.total++
      if (solved[problemKey(p.topicId, p.name)]) bucket.done++
    }
    return out
  }, [solved, allProblems])

  return (
    <Box>
      <PageHeader
        eyebrow={track.practice.eyebrow}
        title={track.practice.title}
        lead={track.practice.lead}
        crumbs={[{ label: 'Home', to: '/' }, trackCrumb(trackId), { label: track.practice.label }]}
        chips={[
          { label: `${allProblems.length} ${track.practice.noun}` },
          { label: `${solvedHere} done`, color: solvedHere ? 'success' : undefined },
        ]}
      />

      <Container maxWidth="xl" sx={{ px: { xs: 2, md: 3 }, py: { xs: 3, md: 4 } }}>
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {['Easy', 'Medium', 'Hard'].map((d) => (
            <Grid key={d} size={{ xs: 12, sm: 4, lg: 3 }}>
              <CountTile
                label={`${d} done`}
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
                {allProblems.length ? Math.round((solvedHere / allProblems.length) * 100) : 0}%
              </Typography>
              <Button
                size="small"
                startIcon={<RestartAltRoundedIcon />}
                onClick={reset}
                disabled={solvedHere === 0}
                sx={{ alignSelf: 'flex-start', px: 0, minWidth: 0 }}
              >
                Reset progress
              </Button>
            </Paper>
          </Grid>
        </Grid>

        <Box sx={{ mb: 2.5 }}>
          <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', display: 'block', mb: 0.75 }}>
            FILTER BY CHAPTER
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

        <ProblemTable problems={shown} trackId={trackId} showTopic />

        {trackId === 'dsa' && (
          <Typography
            variant="caption"
            color="text.disabled"
            sx={{ display: 'block', mt: 2, bgcolor: alpha(theme.palette.text.primary, 0.02), p: 1.5, borderRadius: 1.5 }}
          >
            Note: the same problem appears under more than one chapter where it genuinely drills more
            than one pattern — Trapping Rain Water, for example, is both a two-pointer and a
            monotonic-stack exercise. Solving it once and ticking it in both places is fine.
          </Typography>
        )}
      </Container>
    </Box>
  )
}
