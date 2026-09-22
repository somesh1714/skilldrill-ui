import { Link as RouterLink, Navigate } from 'react-router-dom'
import { Box, Button, Chip, Container, Divider, Paper, Stack, Typography } from '@mui/material'
import Grid from '@mui/material/Grid'
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded'
import { alpha, useTheme } from '@mui/material/styles'
import Callout from '../components/Callout.jsx'
import TopicIcon from '../lib/icons.jsx'
import { tracksById, trackLabel } from '../content/tracks.js'

/**
 * Home page for a track whose chapters are not written yet. It carries the
 * track's own headline copy (from the registry) plus the planned syllabus, so
 * each track reads like its own front door rather than a generic placeholder.
 */
export default function TrackOutline({ trackId }) {
  const theme = useTheme()
  const track = tracksById[trackId]

  if (!track) return <Navigate to="/" replace />

  const chapterCount = (track.outline || []).reduce((n, g) => n + g.items.length, 0)

  return (
    <Box>
      <Box
        sx={{
          borderBottom: `1px solid ${theme.palette.divider}`,
          background: `linear-gradient(180deg, ${alpha(track.color, theme.palette.mode === 'dark' ? 0.09 : 0.055)}, transparent)`,
        }}
      >
        <Container maxWidth="xl" sx={{ px: { xs: 2, md: 3 }, py: { xs: 5, md: 8 } }}>
          <Typography variant="overline" className="mh-fade" sx={{ color: track.color }}>
            {track.hero.eyebrow}
          </Typography>

          <Stack direction="row" spacing={2} sx={{ alignItems: 'flex-start', mt: 0.75 }}>
            <Box
              className="mh-rise"
              sx={{
                mt: 0.5, width: 48, height: 48, borderRadius: 2.5, flexShrink: 0,
                display: { xs: 'none', sm: 'grid' }, placeItems: 'center',
                bgcolor: alpha(track.color, theme.palette.mode === 'dark' ? 0.18 : 0.1),
                border: `1px solid ${alpha(track.color, 0.3)}`,
                color: track.color,
              }}
            >
              <TopicIcon name={track.icon} />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography
                variant="h1"
                className="mh-rise"
                sx={{ fontSize: { xs: '2rem', sm: '2.5rem', md: '3.1rem' }, mb: 2 }}
              >
                {track.hero.headline[0]}
                <Box component="span" sx={{ display: 'block', color: track.color }}>
                  {track.hero.headline[1]}
                </Box>
              </Typography>
              <Typography
                className="mh-rise mh-d2"
                sx={{ color: 'text.secondary', maxWidth: 740, lineHeight: 1.7, fontSize: { xs: '0.98rem', md: '1.08rem' } }}
              >
                {track.hero.lead}
              </Typography>
            </Box>
          </Stack>

          <Stack direction="row" spacing={0.75} useFlexGap className="mh-rise mh-d3" sx={{ mt: 3, flexWrap: 'wrap' }}>
            <Chip
              size="small"
              label={track.status}
              sx={{
                fontWeight: 700,
                color: 'text.secondary',
                bgcolor: alpha(theme.palette.text.primary, 0.06),
              }}
            />
            <Chip size="small" variant="outlined" label={`${track.outline.length} modules`} />
            <Chip size="small" variant="outlined" label={`${chapterCount} planned chapters`} />
          </Stack>
        </Container>
      </Box>

      <Container maxWidth="xl" sx={{ px: { xs: 2, md: 3 }, py: { xs: 3, md: 4 } }}>
        <Box sx={{ maxWidth: 900, mb: 4 }}>
          <Callout
            tone="note"
            title="Not written yet"
            text="This page holds the planned outline. The content structure is already wired up, so chapters can be added one file at a time without touching the app."
          />
        </Box>

        <Grid container spacing={2.5}>
          {track.outline.map((section, i) => (
            <Grid key={section.group} size={{ xs: 12, md: 6 }}>
              <Paper
                variant="outlined"
                className="mh-rise"
                sx={{ p: 2.5, height: '100%', animationDelay: `${i * 60}ms` }}
              >
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1.5 }}>
                  <Box sx={{ width: 3, height: 18, borderRadius: 1, bgcolor: track.color }} />
                  <Typography sx={{ fontWeight: 750 }}>{section.group}</Typography>
                  <Chip
                    size="small"
                    variant="outlined"
                    label={`${section.items.length} chapters`}
                    sx={{ height: 20, fontSize: '0.68rem' }}
                  />
                </Stack>
                <Stack spacing={0.9}>
                  {section.items.map((it) => (
                    <Stack key={it} direction="row" spacing={1.25} sx={{ alignItems: 'flex-start' }}>
                      <Box
                        sx={{
                          width: 5, height: 5, borderRadius: '50%', mt: '8px', flexShrink: 0,
                          bgcolor: alpha(track.color, 0.7),
                        }}
                      />
                      <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.87rem', lineHeight: 1.6 }}>
                        {it}
                      </Typography>
                    </Stack>
                  ))}
                </Stack>
              </Paper>
            </Grid>
          ))}
        </Grid>

        <Divider sx={{ my: 4 }} />

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ alignItems: { sm: 'center' } }}>
          <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
            In the meantime, the DSA track is finished and its problem sets are ready to work through.
          </Typography>
          <Button component={RouterLink} to="/dsa" variant="contained" endIcon={<ArrowForwardRoundedIcon />}>
            Go to {trackLabel('dsa')}
          </Button>
        </Stack>
      </Container>
    </Box>
  )
}
