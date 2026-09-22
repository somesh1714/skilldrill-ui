import { Link as RouterLink } from 'react-router-dom'
import {
  Box, Button, Card, CardActionArea, CardContent, Container, Divider,
  IconButton, LinearProgress, Paper, Stack, Tooltip, Typography,
} from '@mui/material'
import Grid from '@mui/material/Grid'
import RestartAltRoundedIcon from '@mui/icons-material/RestartAltRounded'
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded'
import MapRoundedIcon from '@mui/icons-material/MapRounded'
import PatternRoundedIcon from '@mui/icons-material/PatternRounded'
import ChecklistRoundedIcon from '@mui/icons-material/ChecklistRounded'
import BoltRoundedIcon from '@mui/icons-material/BoltRounded'
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded'
import FormatListNumberedRoundedIcon from '@mui/icons-material/FormatListNumberedRounded'
import LibraryBooksRoundedIcon from '@mui/icons-material/LibraryBooksRounded'
import { alpha, useTheme } from '@mui/material/styles'
import { topicsByTier, topics, allProblems, stats } from '../content/index.js'
import { tracksById } from '../content/tracks.js'
import { tierAnchor } from '../lib/anchors.js'
import { tierColor } from '../theme.js'
import { useProgress } from '../lib/progress.js'

const DESTINATIONS = [
  {
    to: '/dsa/chapters',
    label: 'Chapters',
    Icon: LibraryBooksRoundedIcon,
    text: `All ${stats.topics} chapters, grouped into four tiers and ordered by dependency.`,
    primary: true,
  },
  {
    to: '/dsa/roadmap',
    label: 'Study roadmap',
    Icon: MapRoundedIcon,
    text: 'A 12-week plan with weekly goals, targets and the habits that make it work.',
  },
  {
    to: '/dsa/patterns',
    label: 'Pattern index',
    Icon: PatternRoundedIcon,
    text: `All ${stats.patterns} patterns in one searchable list — paste in a phrase from a problem statement.`,
  },
  {
    to: '/dsa/problems',
    label: 'Problem tracker',
    Icon: ChecklistRoundedIcon,
    text: `${stats.problems} problems, filterable by topic and difficulty, with your progress.`,
  },
  {
    to: '/dsa/cheatsheet',
    label: 'Cheat sheet',
    Icon: BoltRoundedIcon,
    text: 'Constraints, signals and every template compressed to one page for revision.',
  },
]

const HABITS = [
  {
    Icon: MenuBookRoundedIcon,
    title: 'Read the chapter like a textbook',
    text: 'Each topic opens with a mental model and the "why", not a wall of code. Work through the sections in order — they build on each other deliberately.',
  },
  {
    Icon: PatternRoundedIcon,
    title: 'Learn patterns, not solutions',
    text: 'Every pattern states when to use it, how to recognise it in a problem statement, a reusable template, and the gotchas that fail hidden tests.',
  },
  {
    Icon: FormatListNumberedRoundedIcon,
    title: 'Drill the sorted problem list',
    text: 'Problems are ordered Easy → Hard and tagged with the pattern they exercise. Each one carries the single insight that unlocks it.',
  },
  {
    Icon: BoltRoundedIcon,
    title: 'Revise from the cheat sheet',
    text: 'The night before an interview, read only the cheat sheet and the pattern index. Everything compresses down to a page per topic.',
  },
]

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

export default function DsaHome() {
  const theme = useTheme()
  const { count, reset } = useProgress()

  const track = tracksById.dsa
  const firstChapter = topics[0]
  const totalProblems = allProblems.length
  const pct = totalProblems ? (count / totalProblems) * 100 : 0

  return (
    <Box>
      {/* ---------------------------------- hero --------------------------------- */}
      <Box
        sx={{
          borderBottom: `1px solid ${theme.palette.divider}`,
          background: `linear-gradient(180deg, ${alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.07 : 0.045)}, transparent)`,
        }}
      >
        <Container maxWidth="xl" sx={{ px: { xs: 2, md: 3 }, py: { xs: 5, md: 9 } }}>
          <Grid container spacing={4}>
            <Grid size={{ xs: 12, lg: 7.5 }}>
              <Typography variant="overline" className="mh-fade" sx={{ color: 'primary.main' }}>
                {track.hero.eyebrow}
              </Typography>
              <Typography
                variant="h1"
                className="mh-rise"
                sx={{ fontSize: { xs: '2.1rem', sm: '2.7rem', md: '3.4rem' }, mt: 0.75, mb: 2 }}
              >
                {track.hero.headline[0]}
                <Box component="span" sx={{ display: 'block', color: 'primary.main' }}>
                  {track.hero.headline[1]}
                </Box>
              </Typography>
              <Typography
                className="mh-rise mh-d2"
                sx={{ color: 'text.secondary', maxWidth: 700, lineHeight: 1.7, fontSize: { xs: '0.98rem', md: '1.08rem' } }}
              >
                {track.hero.lead}
              </Typography>

              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1.5}
                className="mh-rise mh-d3"
                sx={{ mt: 3.5 }}
              >
                <Button
                  component={RouterLink}
                  to={`/dsa/${firstChapter.id}`}
                  variant="contained"
                  size="large"
                  endIcon={<ArrowForwardRoundedIcon />}
                  sx={{ px: 3 }}
                >
                  Start chapter 1
                </Button>
                <Button
                  component={RouterLink}
                  to="/dsa/chapters"
                  variant="outlined"
                  size="large"
                  sx={{ px: 3 }}
                >
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
                <Stat value={stats.problems} label="PROBLEMS" />
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
                        {count} / {totalProblems} solved
                      </Typography>
                      <Tooltip title="Reset all progress">
                        <span>
                          <IconButton size="small" onClick={reset} disabled={count === 0}>
                            <RestartAltRoundedIcon fontSize="inherit" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </Stack>
                  </Stack>
                  <LinearProgress variant="determinate" value={pct} />
                  <Typography variant="caption" color="text.disabled" sx={{ mt: 0.75, display: 'block' }}>
                    Saved in this browser only — tick problems off as you solve them.
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Container>
      </Box>

      <Container maxWidth="xl" sx={{ px: { xs: 2, md: 3 }, py: { xs: 5, md: 7 } }}>
        {/* ----------------------------- destinations ---------------------------- */}
        <Typography variant="overline" sx={{ color: 'primary.main' }}>In this track</Typography>
        <Typography variant="h4" sx={{ mb: 3.5, mt: 0.5, fontSize: { xs: '1.55rem', md: '1.95rem' } }}>
          Five ways in
        </Typography>

        <Grid container spacing={2}>
          {DESTINATIONS.map((d, i) => {
            const { Icon } = d
            return (
              <Grid key={d.to} size={{ xs: 12, sm: 6, lg: d.primary ? 4 : 2 }}>
                <Card
                  className="mh-rise"
                  sx={{
                    height: '100%',
                    animationDelay: `${i * 55}ms`,
                    borderColor: d.primary ? alpha(theme.palette.primary.main, 0.4) : undefined,
                    bgcolor: d.primary
                      ? alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.08 : 0.04)
                      : undefined,
                    transition: 'transform 160ms ease, border-color 160ms ease',
                    '&:hover': { transform: 'translateY(-2px)', borderColor: alpha(theme.palette.primary.main, 0.6) },
                  }}
                >
                  <CardActionArea component={RouterLink} to={d.to} sx={{ height: '100%', alignItems: 'stretch' }}>
                    <CardContent sx={{ p: 2.25 }}>
                      <Icon sx={{ fontSize: 22, color: 'primary.main', mb: 1 }} />
                      <Typography sx={{ fontWeight: 720, mb: 0.5 }}>{d.label}</Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.83rem', lineHeight: 1.6 }}>
                        {d.text}
                      </Typography>
                    </CardContent>
                  </CardActionArea>
                </Card>
              </Grid>
            )
          })}
        </Grid>

        <Divider sx={{ my: 6 }} />

        {/* ------------------------------- habits -------------------------------- */}
        <Typography variant="overline" sx={{ color: 'primary.main' }}>How to use this track</Typography>
        <Typography variant="h4" sx={{ mb: 4, mt: 0.5, fontSize: { xs: '1.55rem', md: '1.95rem' } }}>
          Four habits that actually work
        </Typography>

        <Grid container spacing={2.5}>
          {HABITS.map((h, i) => {
            const { Icon } = h
            return (
              <Grid key={h.title} size={{ xs: 12, sm: 6, lg: 3 }}>
                <Box className="mh-rise" sx={{ animationDelay: `${i * 60}ms` }}>
                  <Icon sx={{ color: 'primary.main', mb: 1.25 }} />
                  <Typography sx={{ fontWeight: 700, mb: 0.75 }}>{h.title}</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
                    {h.text}
                  </Typography>
                </Box>
              </Grid>
            )
          })}
        </Grid>

        <Divider sx={{ my: 6 }} />

        {/* -------------------------------- tiers -------------------------------- */}
        <Typography variant="overline" sx={{ color: 'primary.main' }}>The shape of the syllabus</Typography>
        <Typography variant="h4" sx={{ mb: 1, mt: 0.5, fontSize: { xs: '1.55rem', md: '1.95rem' } }}>
          Four tiers, built in order
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 3.5, maxWidth: 680 }}>
          Each tier assumes the one before it. Pick the tier that matches where you are and it will
          take you straight to those chapters.
        </Typography>

        <Grid container spacing={2}>
          {topicsByTier.map((tier, i) => {
            const color = tierColor[tier.name]
            const tierProblems = tier.topics.reduce((n, t) => n + (t.problems?.length || 0), 0)
            return (
              <Grid key={tier.name} size={{ xs: 12, sm: 6, lg: 3 }}>
                <Paper
                  variant="outlined"
                  component={RouterLink}
                  to={`/dsa/chapters#${tierAnchor(tier.name)}`}
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
                        {tierProblems}
                      </Typography>
                      <Typography variant="caption" color="text.disabled">problems</Typography>
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
