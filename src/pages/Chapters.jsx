import { useMemo, useState } from 'react'
import {
  Box, Chip, Container, InputAdornment, Paper, Stack, TextField, Typography,
} from '@mui/material'
import Grid from '@mui/material/Grid'
import SearchRoundedIcon from '@mui/icons-material/SearchRounded'
import { alpha, useTheme } from '@mui/material/styles'
import PageHeader from '../components/PageHeader.jsx'
import TopicCard from '../components/TopicCard.jsx'
import { contentFor } from '../content/index.js'
import { trackCrumb, trackLabel, tracksById } from '../content/tracks.js'
import { tierColor } from '../theme.js'
import { useProgress, problemKey } from '../lib/progress.js'
import { tierAnchor } from '../lib/anchors.js'

export default function Chapters({ trackId = 'dsa' }) {
  const theme = useTheme()
  const [query, setQuery] = useState('')
  const { solved } = useProgress()

  const track = tracksById[trackId]
  const { topics, topicsByTier, allProblems, stats } = contentFor(trackId)
  const solvedHere = allProblems.filter((p) => solved[problemKey(p.topicId, p.name)]).length

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return null
    return topics.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.tagline.toLowerCase().includes(q) ||
        (t.patterns || []).some((p) => p.name.toLowerCase().includes(q)),
    )
  }, [query, topics])

  return (
    <Box>
      <PageHeader
        eyebrow={trackLabel(trackId)}
        title="Chapters"
        lead={`${stats.topics} chapters, ordered so each one earns the next. Start at the top if you are building from scratch; jump to a tier if you already know where you are weak.`}
        crumbs={[{ label: 'Home', to: '/' }, trackCrumb(trackId), { label: 'Chapters' }]}
        chips={[
          { label: `${stats.topics} chapters` },
          { label: `${stats.hours}h of study` },
          { label: `${solvedHere} / ${allProblems.length} ${track.practice.noun} done`, color: solvedHere ? 'success' : undefined },
        ]}
      >
        <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: 'wrap' }}>
          {topicsByTier.map((tier) => {
            const color = tierColor[tier.name]
            return (
              <Chip
                key={tier.name}
                component="a"
                href={`#${tierAnchor(tier.name)}`}
                clickable
                size="small"
                label={`${tier.name} · ${tier.topics.length}`}
                sx={{
                  fontWeight: 600,
                  color,
                  bgcolor: alpha(color, 0.1),
                  border: `1px solid ${alpha(color, 0.3)}`,
                }}
              />
            )
          })}
        </Stack>
      </PageHeader>

      <Container maxWidth="xl" sx={{ px: { xs: 2, md: 3 }, py: { xs: 3, md: 4 } }}>
        <TextField
          size="small"
          placeholder="Search chapters and patterns…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          sx={{ mb: 3.5, width: { xs: '100%', sm: 360 } }}
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

        {filtered ? (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {filtered.length} chapter{filtered.length === 1 ? '' : 's'} match “{query}”
            </Typography>
            {filtered.length === 0 ? (
              <Paper
                variant="outlined"
                sx={{ p: 5, textAlign: 'center', bgcolor: alpha(theme.palette.text.primary, 0.02) }}
              >
                <Typography color="text.secondary">
                  Nothing matched. Try a pattern name, like “sliding window”.
                </Typography>
              </Paper>
            ) : (
              <Grid container spacing={2}>
                {filtered.map((t, i) => (
                  <Grid key={t.id} size={{ xs: 12, sm: 6, lg: 4, xl: 3 }}>
                    <TopicCard topic={t} trackId={trackId} index={i} />
                  </Grid>
                ))}
              </Grid>
            )}
          </>
        ) : (
          <Stack spacing={5}>
            {topicsByTier.map((tier) => {
              const color = tierColor[tier.name]
              const keys = tier.topics.flatMap((t) =>
                (t.problems || []).map((p) => problemKey(t.id, p.name)),
              )
              const tierDone = keys.filter((k) => solved[k]).length

              return (
                <Box key={tier.name} id={tierAnchor(tier.name)} data-anchor>
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={1}
                    sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between', mb: 2 }}
                  >
                    <Box>
                      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                        <Box sx={{ width: 3, height: 20, borderRadius: 1, bgcolor: color }} />
                        <Typography variant="h6" sx={{ fontWeight: 750 }}>{tier.name}</Typography>
                        <Chip
                          size="small"
                          label={`${tier.topics.length} chapters`}
                          sx={{
                            height: 20, fontSize: '0.68rem',
                            color, bgcolor: alpha(color, 0.12),
                            border: `1px solid ${alpha(color, 0.3)}`,
                          }}
                        />
                      </Stack>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, maxWidth: 720 }}>
                        {tier.blurb}
                      </Typography>
                    </Box>
                    <Typography variant="caption" color="text.disabled" sx={{ whiteSpace: 'nowrap' }}>
                      {tierDone} / {keys.length} {track.practice.noun} done
                    </Typography>
                  </Stack>

                  <Grid container spacing={2}>
                    {tier.topics.map((t, i) => (
                      <Grid key={t.id} size={{ xs: 12, sm: 6, lg: 4, xl: 3 }}>
                        <TopicCard topic={t} trackId={trackId} index={i} />
                      </Grid>
                    ))}
                  </Grid>
                </Box>
              )
            })}
          </Stack>
        )}
      </Container>
    </Box>
  )
}
