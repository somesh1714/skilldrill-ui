import { useMemo, useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import {
  Box, Container, Stack, TextField, InputAdornment, Typography, Chip,
  ToggleButton, ToggleButtonGroup, Paper, Link as MuiLink,
} from '@mui/material'
import Grid from '@mui/material/Grid'
import SearchRoundedIcon from '@mui/icons-material/SearchRounded'
import { alpha, useTheme } from '@mui/material/styles'
import PageHeader from '../components/PageHeader.jsx'
import PatternCard from '../components/PatternCard.jsx'
import { contentFor } from '../content/index.js'
import { trackCrumb, tracksById } from '../content/tracks.js'
import { tierColor } from '../theme.js'

export default function PatternsIndex({ trackId = 'dsa' }) {
  const theme = useTheme()
  const track = tracksById[trackId]
  const { allPatterns, topics, tiers } = contentFor(trackId)
  const [query, setQuery] = useState('')
  const [tier, setTier] = useState('All')
  const [topicId, setTopicId] = useState('All')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return allPatterns.filter((p) => {
      if (tier !== 'All' && p.tier !== tier) return false
      if (topicId !== 'All' && p.topicId !== topicId) return false
      if (!q) return true
      const haystack = [
        p.name, p.oneLiner, p.topicTitle,
        ...(p.useWhen || []), ...(p.recognize || []), ...(p.problems || []),
      ].join(' ').toLowerCase()
      return haystack.includes(q)
    })
  }, [query, tier, topicId, allPatterns])

  return (
    <Box>
      <PageHeader
        eyebrow="Reference"
        title="Pattern index"
        lead="Every named pattern in the curriculum, in one searchable place. Search by a phrase from a problem statement — “minimum number of rooms”, “at most k distinct”, “next greater” — and the pattern that solves it should surface."
        crumbs={[{ label: 'Home', to: '/' }, trackCrumb(trackId), { label: 'Patterns' }]}
        chips={[{ label: `${allPatterns.length} patterns` }, { label: `${topics.length} chapters` }]}
      />

      <Container maxWidth="xl" sx={{ px: { xs: 2, md: 3 }, py: { xs: 3, md: 4 } }}>
        <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
          <Stack spacing={2}>
            <TextField
              size="small"
              fullWidth
              placeholder="Search patterns, signals, templates…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
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

            <Box>
              <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', display: 'block', mb: 0.75 }}>
                TIER
              </Typography>
              <ToggleButtonGroup size="small" exclusive value={tier} onChange={(_, v) => v && setTier(v)}>
                {['All', ...tiers.map((t) => t.name)].map((t) => (
                  <ToggleButton key={t} value={t} sx={{ px: 1.5, textTransform: 'none', fontWeight: 600 }}>
                    {t}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            </Box>

            <Box>
              <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', display: 'block', mb: 0.75 }}>
                TOPIC
              </Typography>
              <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: 'wrap' }}>
                <Chip
                  size="small"
                  label="All"
                  onClick={() => setTopicId('All')}
                  color={topicId === 'All' ? 'primary' : 'default'}
                  variant={topicId === 'All' ? 'filled' : 'outlined'}
                />
                {topics
                  .filter((t) => (tier === 'All' || t.tier === tier) && t.patterns?.length)
                  .map((t) => (
                    <Chip
                      key={t.id}
                      size="small"
                      label={t.short || t.title}
                      onClick={() => setTopicId(t.id === topicId ? 'All' : t.id)}
                      color={topicId === t.id ? 'primary' : 'default'}
                      variant={topicId === t.id ? 'filled' : 'outlined'}
                    />
                  ))}
              </Stack>
            </Box>
          </Stack>
        </Paper>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Showing <strong>{filtered.length}</strong> of {allPatterns.length} patterns
        </Typography>

        <Grid container spacing={2.5}>
          {filtered.map((p) => (
            <Grid key={`${p.topicId}-${p.id}`} size={{ xs: 12, xl: 6 }}>
              <Box sx={{ height: '100%' }}>
                <PatternCard pattern={p} showTopic />
                <Box sx={{ mt: 0.75, textAlign: 'right' }}>
                  <MuiLink
                    component={RouterLink}
                    to={`${track.to}/${p.topicId}#pattern-${p.id}`}
                    underline="hover"
                    sx={{ fontSize: '0.8rem' }}
                  >
                    Read the full chapter →
                  </MuiLink>
                </Box>
              </Box>
            </Grid>
          ))}
        </Grid>

        {filtered.length === 0 && (
          <Paper
            variant="outlined"
            sx={{ p: 5, textAlign: 'center', bgcolor: alpha(theme.palette.text.primary, 0.02) }}
          >
            <Typography color="text.secondary">
              No patterns match those filters. Try a broader search term.
            </Typography>
          </Paper>
        )}
      </Container>
    </Box>
  )
}
