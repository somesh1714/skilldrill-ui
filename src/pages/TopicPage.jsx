import { useEffect, useMemo, useState } from 'react'
import { useParams, Link as RouterLink, Navigate } from 'react-router-dom'
import {
  Box, Container, Typography, Stack, Chip, Card, CardContent, Divider, Button,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
  List, ListItemButton, ListItemText, Collapse,
} from '@mui/material'
import Grid from '@mui/material/Grid'
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded'
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded'
import ScheduleRoundedIcon from '@mui/icons-material/ScheduleRounded'
import ReportProblemRoundedIcon from '@mui/icons-material/ReportProblemRounded'
import BoltRoundedIcon from '@mui/icons-material/BoltRounded'
import PsychologyRoundedIcon from '@mui/icons-material/PsychologyRounded'
import { alpha, useTheme } from '@mui/material/styles'
import PageHeader from '../components/PageHeader.jsx'
import Blocks from '../components/Blocks.jsx'
import Inline from '../components/Inline.jsx'
import PatternCard from '../components/PatternCard.jsx'
import ProblemTable from '../components/ProblemTable.jsx'
import TopicIcon from '../lib/icons.jsx'
import { topicsById, neighbours, DIFFICULTY_ORDER } from '../content/index.js'
import { trackCrumb } from '../content/tracks.js'
import { tierColor } from '../theme.js'
import { useProgress, problemKey } from '../lib/progress.js'

/* ----------------------------- section heading ---------------------------- */
function SectionTitle({ id, children, icon }) {
  return (
    <Stack
      direction="row"
      spacing={1.25}
      id={id}
      data-anchor
      sx={{ alignItems: 'center', mt: 6, mb: 2, pt: 1 }}
    >
      {icon}
      <Typography variant="h5" sx={{ fontWeight: 760, fontSize: { xs: '1.3rem', md: '1.55rem' } }}>
        {children}
      </Typography>
    </Stack>
  )
}

/* --------------------------------- sidebar -------------------------------- */
function Toc({ topic, activeId }) {
  const theme = useTheme()

  const items = useMemo(() => {
    const out = [{ id: 'overview', label: 'Overview', depth: 0 }]
    if (topic.complexity?.length) out.push({ id: 'complexity-table', label: 'Complexity reference', depth: 0 })
    topic.sections.forEach((s) => out.push({ id: s.id, label: s.title, depth: 1 }))
    if (topic.patterns?.length) {
      out.push({ id: 'patterns', label: 'Patterns', depth: 0 })
      topic.patterns.forEach((p) => out.push({ id: `pattern-${p.id}`, label: p.name, depth: 1 }))
    }
    if (topic.pitfalls?.length) out.push({ id: 'pitfalls', label: 'Common pitfalls', depth: 0 })
    if (topic.cheatsheet?.length) out.push({ id: 'cheatsheet', label: 'Cheat sheet', depth: 0 })
    if (topic.problems?.length) out.push({ id: 'problems', label: 'Practice problems', depth: 0 })
    return out
  }, [topic])

  return (
    <Box
      component="nav"
      sx={{
        position: 'sticky',
        top: 'calc(var(--mh-header) + 20px)',
        maxHeight: 'calc(100dvh - var(--mh-header) - 44px)',
        overflowY: 'auto',
        pr: 1,
      }}
    >
      <Typography
        variant="caption"
        sx={{ fontWeight: 800, letterSpacing: '0.1em', color: 'text.disabled', px: 1.5 }}
      >
        ON THIS PAGE
      </Typography>
      <List dense disablePadding sx={{ mt: 0.5 }}>
        {items.map((it) => {
          const active = activeId === it.id
          return (
            <ListItemButton
              key={it.id}
              href={`#${it.id}`}
              sx={{
                py: 0.4,
                pl: 1.5 + it.depth * 1.25,
                borderLeft: `2px solid ${active ? theme.palette.primary.main : 'transparent'}`,
                borderRadius: 0,
                '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.06) },
              }}
            >
              <ListItemText
                primary={it.label}
                slotProps={{
                  primary: {
                    noWrap: true,
                    sx: {
                      fontSize: it.depth ? '0.79rem' : '0.84rem',
                      fontWeight: active ? 700 : it.depth ? 400 : 600,
                      color: active ? 'primary.main' : it.depth ? 'text.secondary' : 'text.primary',
                    },
                  },
                }}
              />
            </ListItemButton>
          )
        })}
      </List>
    </Box>
  )
}

/* ---------------------------------- page ---------------------------------- */
export default function TopicPage() {
  const { topicId } = useParams()
  const theme = useTheme()
  const topic = topicsById[topicId]
  const [activeId, setActiveId] = useState('overview')
  const { solved } = useProgress()

  // Highlight the TOC entry for whichever anchor is nearest the top of the viewport.
  useEffect(() => {
    if (!topic) return
    const nodes = Array.from(document.querySelectorAll('[data-anchor][id]'))
    if (nodes.length === 0) return

    const onScroll = () => {
      // measure the bar rather than hard-coding it — its height depends on
      // whether the track's second nav row is showing
      const headerHeight = document.querySelector('header')?.getBoundingClientRect().height ?? 64
      const threshold = headerHeight + 76

      let current = nodes[0].id
      for (const n of nodes) {
        if (n.getBoundingClientRect().top <= threshold) current = n.id
        else break
      }
      setActiveId(current)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [topic, topicId])

  if (!topic) return <Navigate to="/dsa" replace />

  const { prev, next } = neighbours(topic.id)
  const color = tierColor[topic.tier] || theme.palette.primary.main

  const sortedProblems = [...(topic.problems || [])]
    .map((p) => ({ ...p, topicId: topic.id }))
    .sort(
      (a, b) =>
        (DIFFICULTY_ORDER[a.difficulty] ?? 3) - (DIFFICULTY_ORDER[b.difficulty] ?? 3) ||
        a.name.localeCompare(b.name),
    )

  const done = sortedProblems.filter((p) => solved[problemKey(topic.id, p.name)]).length

  return (
    <Box>
      <PageHeader
        eyebrow={`${topic.tier} · Chapter ${topic.order}`}
        title={topic.title}
        lead={topic.tagline}
        icon={<TopicIcon name={topic.icon} />}
        crumbs={[{ label: 'Home', to: '/' }, trackCrumb('dsa'), { label: topic.short || topic.title }]}
        chips={[
          { label: `${topic.estHours}h`, icon: <ScheduleRoundedIcon sx={{ fontSize: 14 }} /> },
          { label: `${topic.patterns?.length || 0} patterns` },
          { label: `${sortedProblems.length} problems` },
          { label: `${done} solved`, color: done ? 'success' : undefined },
        ]}
      >
        {topic.prereqs?.length > 0 && (
          <Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
            <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
              PREREQUISITES
            </Typography>
            {topic.prereqs.map((id) => (
              <Chip
                key={id}
                size="small"
                component={RouterLink}
                to={`/dsa/${id}`}
                clickable
                label={topicsById[id]?.short || id}
                variant="outlined"
              />
            ))}
          </Stack>
        )}
      </PageHeader>

      <Container maxWidth="xl" sx={{ px: { xs: 2, md: 3 }, py: { xs: 3, md: 4 } }}>
        <Grid container spacing={4}>
          {/* ------------------------------ sidebar ----------------------------- */}
          <Grid size={{ xs: 12, lg: 2.6 }} sx={{ display: { xs: 'none', lg: 'block' } }}>
            <Toc topic={topic} activeId={activeId} />
          </Grid>

          {/* ------------------------------ content ----------------------------- */}
          <Grid size={{ xs: 12, lg: 9.4 }} sx={{ minWidth: 0 }}>
            <Box sx={{ maxWidth: 940 }}>
              {/* overview */}
              <Box id="overview" data-anchor>
                <Card
                  sx={{
                    mb: 2.5,
                    borderColor: alpha(color, 0.35),
                    bgcolor: alpha(color, theme.palette.mode === 'dark' ? 0.1 : 0.05),
                  }}
                >
                  <CardContent sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
                    <PsychologyRoundedIcon sx={{ color, fontSize: 21, mt: '2px', flexShrink: 0 }} />
                    <Box>
                      <Typography
                        variant="caption"
                        sx={{ fontWeight: 800, letterSpacing: '0.06em', color, display: 'block', mb: 0.5 }}
                      >
                        MENTAL MODEL
                      </Typography>
                      <Typography sx={{ fontSize: '1.02rem', lineHeight: 1.65 }}>
                        <Inline text={topic.mentalModel} />
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>

                <Typography variant="body1" sx={{ color: 'text.secondary', lineHeight: 1.75 }}>
                  <Inline text={topic.whyItMatters} />
                </Typography>
              </Box>

              {/* complexity reference */}
              {topic.complexity?.length > 0 && (
                <>
                  <SectionTitle id="complexity-table" icon={<ScheduleRoundedIcon sx={{ color }} />}>
                    Complexity reference
                  </SectionTitle>
                  <TableContainer component={Paper} variant="outlined" sx={{ overflowX: 'auto' }}>
                    <Table size="small" sx={{ minWidth: 560 }}>
                      <TableHead>
                        <TableRow sx={{ bgcolor: alpha(theme.palette.text.primary, theme.palette.mode === 'dark' ? 0.04 : 0.025) }}>
                          <TableCell sx={{ fontSize: '0.78rem' }}>Operation</TableCell>
                          <TableCell sx={{ fontSize: '0.78rem' }}>Time</TableCell>
                          <TableCell sx={{ fontSize: '0.78rem' }}>Space</TableCell>
                          <TableCell sx={{ fontSize: '0.78rem' }}>Notes</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {topic.complexity.map((row, i) => (
                          <TableRow key={i} hover>
                            <TableCell sx={{ fontSize: '0.84rem', fontWeight: 600 }}>
                              <Inline text={row.op} />
                            </TableCell>
                            <TableCell sx={{ fontSize: '0.84rem', color: 'primary.main', fontWeight: 600, whiteSpace: 'nowrap' }}>
                              {row.time}
                            </TableCell>
                            <TableCell sx={{ fontSize: '0.84rem', whiteSpace: 'nowrap' }}>{row.space}</TableCell>
                            <TableCell sx={{ fontSize: '0.82rem', color: 'text.secondary' }}>
                              <Inline text={row.note} />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </>
              )}

              {/* lesson sections */}
              {topic.sections.map((s) => (
                <Box key={s.id}>
                  <SectionTitle id={s.id}>{s.title}</SectionTitle>
                  <Blocks blocks={s.blocks} />
                </Box>
              ))}

              {/* patterns */}
              {topic.patterns?.length > 0 && (
                <>
                  <SectionTitle id="patterns" icon={<BoltRoundedIcon sx={{ color }} />}>
                    Patterns &amp; when to apply them
                  </SectionTitle>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
                    This is the section to re-read before an interview. Each pattern lists the signals
                    that should make you reach for it, a template you can adapt, and the mistakes that
                    fail hidden tests.
                  </Typography>
                  <Stack spacing={2.5}>
                    {topic.patterns.map((p) => (
                      <PatternCard key={p.id} pattern={p} />
                    ))}
                  </Stack>
                </>
              )}

              {/* pitfalls */}
              {topic.pitfalls?.length > 0 && (
                <>
                  <SectionTitle id="pitfalls" icon={<ReportProblemRoundedIcon sx={{ color: '#be123c' }} />}>
                    Common pitfalls
                  </SectionTitle>
                  <Grid container spacing={1.5}>
                    {topic.pitfalls.map((p, i) => (
                      <Grid key={i} size={{ xs: 12, md: 6 }}>
                        <Paper
                          variant="outlined"
                          sx={{
                            p: 1.75, height: '100%',
                            borderLeft: '3px solid #be123c',
                            bgcolor: alpha('#be123c', theme.palette.mode === 'dark' ? 0.08 : 0.035),
                          }}
                        >
                          <Typography variant="subtitle2" sx={{ fontWeight: 750, mb: 0.4 }}>
                            <Inline text={p.title} />
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.855rem' }}>
                            <Inline text={p.text} />
                          </Typography>
                        </Paper>
                      </Grid>
                    ))}
                  </Grid>
                </>
              )}

              {/* cheatsheet */}
              {topic.cheatsheet?.length > 0 && (
                <>
                  <SectionTitle id="cheatsheet" icon={<BoltRoundedIcon sx={{ color: '#b45309' }} />}>
                    Cheat sheet
                  </SectionTitle>
                  <Paper variant="outlined" sx={{ p: 0.5 }}>
                    <Grid container>
                      {topic.cheatsheet.map((c, i) => (
                        <Grid key={i} size={{ xs: 12, sm: 6, md: 4 }}>
                          <Box
                            sx={{
                              px: 1.5, py: 1.1, m: 0.5, borderRadius: 1.5, height: 'calc(100% - 8px)',
                              bgcolor: alpha(theme.palette.text.primary, theme.palette.mode === 'dark' ? 0.035 : 0.025),
                            }}
                          >
                            <Typography
                              variant="caption"
                              sx={{ display: 'block', color: 'text.secondary', fontWeight: 700, mb: 0.2 }}
                            >
                              {c.label}
                            </Typography>
                            <Typography
                              sx={{
                                fontFamily: '"JetBrains Mono", monospace',
                                fontSize: '0.8rem',
                                color: 'primary.main',
                                fontWeight: 500,
                                wordBreak: 'break-word',
                              }}
                            >
                              {c.value}
                            </Typography>
                          </Box>
                        </Grid>
                      ))}
                    </Grid>
                  </Paper>
                </>
              )}

              {/* problems */}
              {sortedProblems.length > 0 && (
                <>
                  <SectionTitle id="problems">Practice problems</SectionTitle>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Sorted Easy → Hard. Work down the list; each row names the pattern it drills and the
                    one insight that unlocks it. Tick them off as you go — progress is saved locally.
                  </Typography>
                  <ProblemTable problems={sortedProblems} />
                </>
              )}

              {/* prev / next */}
              <Divider sx={{ my: 5 }} />
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={2} sx={{ justifyContent: 'space-between' }}>
                {prev ? (
                  <Button
                    component={RouterLink}
                    to={`/dsa/${prev.id}`}
                    startIcon={<ArrowBackRoundedIcon />}
                    sx={{ justifyContent: 'flex-start', textAlign: 'left', flex: 1, p: 2, border: `1px solid ${theme.palette.divider}`, borderRadius: 2 }}
                  >
                    <Box>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        Previous
                      </Typography>
                      <Typography sx={{ fontWeight: 700 }}>{prev.short || prev.title}</Typography>
                    </Box>
                  </Button>
                ) : <Box sx={{ flex: 1 }} />}

                {next ? (
                  <Button
                    component={RouterLink}
                    to={`/dsa/${next.id}`}
                    endIcon={<ArrowForwardRoundedIcon />}
                    sx={{ justifyContent: 'flex-end', textAlign: 'right', flex: 1, p: 2, border: `1px solid ${theme.palette.divider}`, borderRadius: 2 }}
                  >
                    <Box>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        Next
                      </Typography>
                      <Typography sx={{ fontWeight: 700 }}>{next.short || next.title}</Typography>
                    </Box>
                  </Button>
                ) : <Box sx={{ flex: 1 }} />}
              </Stack>
            </Box>
          </Grid>
        </Grid>
      </Container>
    </Box>
  )
}
