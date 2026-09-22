import { Link as RouterLink, Navigate } from 'react-router-dom'
import {
  Box, Button, Card, CardActionArea, CardContent, Container, Divider,
  IconButton, LinearProgress, Paper, Stack, Tooltip, Typography,
} from '@mui/material'
import Grid from '@mui/material/Grid'
import RestartAltRoundedIcon from '@mui/icons-material/RestartAltRounded'
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded'
import { alpha, useTheme } from '@mui/material/styles'
import TopicIcon from '../lib/icons.jsx'
import { contentFor } from '../content/index.js'
import { tracksById } from '../content/tracks.js'
import { tierAnchor } from '../lib/anchors.js'
import { tierColor } from '../theme.js'
import { useProgress, problemKey } from '../lib/progress.js'

function Stat({ value, label }) {
  return (
    <Box>
      <Typography sx={{ fontWeight: 800, fontSize: { xs: '1.4rem', md: '1.7rem' }, letterSpacing: '-0.03em', lineHeight: 1.1 }}>
        {value}
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, letterSpacing: '0.04em' }}>
        {label}
      </Typography>
    </Box>
  )
}

/**
 * The landing page for a finished track. Everything on it comes from the track
 * registry plus that track's chapters, so a new track gets this page for free.
 */
export default function TrackHome({ trackId }) {
  const theme = useTheme()
  const { solved, reset } = useProgress()

  const track = tracksById[trackId]
  const { topics, topicsByTier, allProblems, stats } = contentFor(trackId)

  if (!track) return <Navigate to="/" replace />

  const base = track.to
  const firstChapter = topics[0]
  const solvedHere = allProblems.filter((p) => solved[problemKey(p.topicId, p.name)]).length
  const pct = allProblems.length ? (solvedHere / allProblems.length) * 100 : 0

  const destinations = [
    {
      to: `${base}/chapters`,
      label: 'Chapters',
      icon: 'LibraryBooksRounded',
      text: `All ${stats.topics} chapters, grouped into tiers and ordered by dependency.`,
      primary: true,
    },
    ...(track.hasRoadmap
      ? [{
          to: `${base}/roadmap`,
          label: 'Study roadmap',
          icon: 'MapRounded',
          text: 'A 12-week plan with weekly goals, targets and the habits that make it work.',
        }]
      : []),
    {
      to: `${base}/patterns`,
      label: 'Pattern index',
      icon: 'PatternRounded',
      text: `All ${stats.patterns} patterns in one searchable list.`,
    },
    {
      to: `${base}/practice`,
      label: track.practice.label,
      icon: 'ChecklistRounded',
      text: `${stats.problems} ${track.practice.noun}, filterable by chapter and difficulty, with your progress.`,
    },
    {
      to: `${base}/cheatsheet`,
      label: 'Cheat sheet',
      icon: 'BoltRounded',
      text: 'Every rule, default and snippet compressed to one page for revision.',
    },
  ]

  return (
    <Box>
      {/* ---------------------------------- hero --------------------------------- */}
      <Box
        sx={{
          borderBottom: `1px solid ${theme.palette.divider}`,
          background: `linear-gradient(180deg, ${alpha(track.color, theme.palette.mode === 'dark' ? 0.09 : 0.055)}, transparent)`,
        }}
      >
        <Container maxWidth="xl" sx={{ px: { xs: 2, md: 3 }, py: { xs: 5, md: 9 } }}>
          <Grid container spacing={4}>
            <Grid size={{ xs: 12, lg: 7.5 }}>
              <Typography variant="overline" className="mh-fade" sx={{ color: track.color }}>
                {track.hero.eyebrow}
              </Typography>
              <Typography
                variant="h1"
                className="mh-rise"
                sx={{ fontSize: { xs: '2.1rem', sm: '2.7rem', md: '3.4rem' }, mt: 0.75, mb: 2 }}
              >
                {track.hero.headline[0]}
                <Box component="span" sx={{ display: 'block', color: track.color }}>
                  {track.hero.headline[1]}
                </Box>
              </Typography>
              <Typography
                className="mh-rise mh-d2"
                sx={{ color: 'text.secondary', maxWidth: 700, lineHeight: 1.7, fontSize: { xs: '0.98rem', md: '1.08rem' } }}
              >
                {track.hero.lead}
              </Typography>

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} className="mh-rise mh-d3" sx={{ mt: 3.5 }}>
                <Button
                  component={RouterLink}
                  to={`${base}/${firstChapter.id}`}
                  variant="contained"
                  size="large"
                  endIcon={<ArrowForwardRoundedIcon />}
                  sx={{ px: 3, bgcolor: track.color, '&:hover': { bgcolor: track.color, filter: 'brightness(0.92)' } }}
                >
                  Start chapter 1
                </Button>
                <Button component={RouterLink} to={`${base}/chapters`} variant="outlined" size="large" sx={{ px: 3 }}>
                  Browse all chapters
                </Button>
              </Stack>

              <Stack
                direction="row"
                spacing={{ xs: 2.5, md: 4 }}
                useFlexGap
                className="mh-rise mh-d4"
                sx={{ mt: 4.5, flexWrap: 'wrap' }}
              >
                <Stat value={stats.topics} label="CHAPTERS" />
                <Stat value={stats.patterns} label="PATTERNS" />
                <Stat value={stats.problems} label={track.practice.noun.toUpperCase()} />
                <Stat value={stats.sections} label="LESSONS" />
                <Stat value={`${stats.hours}h`} label="OF STUDY" />
              </Stack>
            </Grid>

            <Grid size={{ xs: 12, lg: 4.5 }}>
              <Card className="mh-rise mh-d3">
                <CardContent sx={{ py: 2 }}>
                  <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>Your progress</Typography>
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                      <Typography variant="body2" color="text.secondary">
                        {solvedHere} / {allProblems.length} done
                      </Typography>
                      <Tooltip title="Reset all progress">
                        <span>
                          <IconButton size="small" onClick={reset} disabled={solvedHere === 0}>
                            <RestartAltRoundedIcon fontSize="inherit" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </Stack>
                  </Stack>
                  <LinearProgress
                    variant="determinate"
                    value={pct}
                    sx={{ bgcolor: alpha(track.color, 0.14), '& .MuiLinearProgress-bar': { bgcolor: track.color } }}
                  />
                  <Typography variant="caption" color="text.disabled" sx={{ mt: 0.75, display: 'block' }}>
                    Saved in this browser only — tick items off as you finish them.
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Container>
      </Box>

      <Container maxWidth="xl" sx={{ px: { xs: 2, md: 3 }, py: { xs: 5, md: 7 } }}>
        {/* ----------------------------- destinations ---------------------------- */}
        <Typography variant="overline" sx={{ color: track.color }}>In this track</Typography>
        <Typography variant="h4" sx={{ mb: 3.5, mt: 0.5, fontSize: { xs: '1.55rem', md: '1.95rem' } }}>
          {destinations.length} ways in
        </Typography>

        <Grid container spacing={2}>
          {destinations.map((d, i) => (
            <Grid key={d.to} size={{ xs: 12, sm: 6, lg: d.primary ? 4 : 2 }}>
              <Card
                className="mh-rise"
                sx={{
                  height: '100%',
                  animationDelay: `${i * 55}ms`,
                  borderColor: d.primary ? alpha(track.color, 0.4) : undefined,
                  bgcolor: d.primary ? alpha(track.color, theme.palette.mode === 'dark' ? 0.08 : 0.04) : undefined,
                  transition: 'transform 160ms ease, border-color 160ms ease',
                  '&:hover': { transform: 'translateY(-2px)', borderColor: alpha(track.color, 0.6) },
                }}
              >
                <CardActionArea component={RouterLink} to={d.to} sx={{ height: '100%', alignItems: 'stretch' }}>
                  <CardContent sx={{ p: 2.25 }}>
                    <TopicIcon name={d.icon} sx={{ fontSize: 22, color: track.color, mb: 1 }} />
                    <Typography sx={{ fontWeight: 720, mb: 0.5 }}>{d.label}</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.83rem', lineHeight: 1.6 }}>
                      {d.text}
                    </Typography>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          ))}
        </Grid>

        <Divider sx={{ my: 6 }} />

        {/* ------------------------------- habits -------------------------------- */}
        <Typography variant="overline" sx={{ color: track.color }}>How to use this track</Typography>
        <Typography variant="h4" sx={{ mb: 4, mt: 0.5, fontSize: { xs: '1.55rem', md: '1.95rem' } }}>
          Four habits that actually work
        </Typography>

        <Grid container spacing={2.5}>
          {track.habits.map((h, i) => (
            <Grid key={h.title} size={{ xs: 12, sm: 6, lg: 3 }}>
              <Box className="mh-rise" sx={{ animationDelay: `${i * 60}ms` }}>
                <TopicIcon name={h.icon} sx={{ color: track.color, mb: 1.25 }} />
                <Typography sx={{ fontWeight: 700, mb: 0.75 }}>{h.title}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
                  {h.text}
                </Typography>
              </Box>
            </Grid>
          ))}
        </Grid>

        <Divider sx={{ my: 6 }} />

        {/* -------------------------------- tiers -------------------------------- */}
        <Typography variant="overline" sx={{ color: track.color }}>The shape of the syllabus</Typography>
        <Typography variant="h4" sx={{ mb: 1, mt: 0.5, fontSize: { xs: '1.55rem', md: '1.95rem' } }}>
          {topicsByTier.length} tiers, built in order
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 3.5, maxWidth: 680 }}>
          Each tier assumes the one before it. Pick the tier that matches where you are and it will
          take you straight to those chapters.
        </Typography>

        <Grid container spacing={2}>
          {topicsByTier.map((tier, i) => {
            const color = tierColor[tier.name] || track.color
            const tierItems = tier.topics.reduce((n, t) => n + (t.problems?.length || 0), 0)
            return (
              <Grid key={tier.name} size={{ xs: 12, sm: 6, lg: 3 }}>
                <Paper
                  variant="outlined"
                  component={RouterLink}
                  to={`${base}/chapters#${tierAnchor(tier.name)}`}
                  className="mh-rise"
                  sx={{
                    display: 'block', p: 2.25, height: '100%', textDecoration: 'none',
                    color: 'inherit', animationDelay: `${i * 60}ms`,
                    borderColor: alpha(color, 0.3),
                    transition: 'transform 160ms ease, border-color 160ms ease',
                    '&:hover': { transform: 'translateY(-2px)', borderColor: alpha(color, 0.6) },
                  }}
                >
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1 }}>
                    <Box sx={{ width: 3, height: 18, borderRadius: 1, bgcolor: color }} />
                    <Typography sx={{ fontWeight: 750 }}>{tier.name}</Typography>
                  </Stack>
                  <Stack direction="row" spacing={2} sx={{ mb: 1.25 }}>
                    <Box>
                      <Typography sx={{ fontWeight: 800, fontSize: '1.15rem', lineHeight: 1.2, color }}>
                        {tier.topics.length}
                      </Typography>
                      <Typography variant="caption" color="text.disabled">chapters</Typography>
                    </Box>
                    <Box>
                      <Typography sx={{ fontWeight: 800, fontSize: '1.15rem', lineHeight: 1.2, color }}>
                        {tierItems}
                      </Typography>
                      <Typography variant="caption" color="text.disabled">{track.practice.noun}</Typography>
                    </Box>
                  </Stack>
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.85rem', lineHeight: 1.65 }}>
                    {tier.blurb}
                  </Typography>
                </Paper>
              </Grid>
            )
          })}
        </Grid>
      </Container>
    </Box>
  )
}
