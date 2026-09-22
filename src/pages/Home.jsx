import { useMemo, useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import {
  Box, Button, Card, CardContent, Chip, Container, Divider, InputAdornment,
  Paper, Stack, TextField, ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material'
import Grid from '@mui/material/Grid'
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded'
import SearchRoundedIcon from '@mui/icons-material/SearchRounded'
import { alpha, useTheme } from '@mui/material/styles'
import TopicIcon from '../lib/icons.jsx'
import { tracks } from '../content/tracks.js'

const STATUSES = ['All', 'Available', 'Planned']

export default function Home() {
  const theme = useTheme()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('All')

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return tracks.filter((t) => {
      if (status === 'Available' && !t.ready) return false
      if (status === 'Planned' && t.ready) return false
      if (!q) return true
      return [t.title, t.blurb, ...(t.tags || []), ...(t.bullets || [])]
        .join(' ')
        .toLowerCase()
        .includes(q)
    })
  }, [query, status])

  return (
    <Container maxWidth="xl" sx={{ px: { xs: 2, md: 3 }, py: { xs: 5, md: 8 } }}>
      <Typography variant="overline" className="mh-fade" sx={{ color: 'primary.main' }}>
        Tracks
      </Typography>
      <Typography
        variant="h4"
        className="mh-rise"
        sx={{ mb: 1, mt: 0.5, fontSize: { xs: '1.75rem', md: '2.2rem' } }}
      >
        Pick a track and go deep
      </Typography>
      <Typography className="mh-rise mh-d1" color="text.secondary" sx={{ maxWidth: 680 }}>
        Each track is a full syllabus with its own home page, chapters and problem sets — built to be
        read front to back, not skimmed.
      </Typography>

      {/* --------------------------------- filter -------------------------------- */}
      <Paper
        variant="outlined"
        className="mh-rise mh-d2"
        sx={{ p: 1.5, mt: 3.5, mb: 3 }}
      >
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1.5}
          sx={{ alignItems: { sm: 'center' } }}
        >
          <TextField
            size="small"
            placeholder="Filter tracks…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            sx={{ flex: 1, minWidth: 200 }}
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
          <ToggleButtonGroup
            size="small"
            exclusive
            value={status}
            onChange={(_, v) => v && setStatus(v)}
          >
            {STATUSES.map((s) => (
              <ToggleButton key={s} value={s} sx={{ px: 1.75, textTransform: 'none', fontWeight: 600 }}>
                {s}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
          <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
            {shown.length} of {tracks.length} tracks
          </Typography>
        </Stack>
      </Paper>

      {/* --------------------------------- tiles --------------------------------- */}
      <Grid container spacing={2.5}>
        {shown.map((t, i) => (
          <Grid key={t.id} size={{ xs: 12, md: 6, xl: 4 }}>
            <Card
              className="mh-rise"
              sx={{
                height: '100%',
                animationDelay: `${i * 70}ms`,
                transition: 'transform 180ms ease, border-color 180ms ease',
                '&:hover': { transform: 'translateY(-3px)', borderColor: alpha(t.color, 0.5) },
              }}
            >
              <CardContent sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
                <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mb: 2 }}>
                  <Box
                    sx={{
                      width: 44, height: 44, borderRadius: 2.5, flexShrink: 0,
                      display: 'grid', placeItems: 'center',
                      bgcolor: alpha(t.color, theme.palette.mode === 'dark' ? 0.18 : 0.1),
                      border: `1px solid ${alpha(t.color, 0.3)}`,
                      color: t.color,
                    }}
                  >
                    <TopicIcon name={t.icon} />
                  </Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 750, fontSize: '1.15rem' }}>{t.title}</Typography>
                    <Chip
                      size="small"
                      label={t.status}
                      sx={{
                        height: 19, fontSize: '0.66rem', mt: 0.25,
                        color: t.ready ? t.color : 'text.secondary',
                        bgcolor: t.ready
                          ? alpha(t.color, 0.12)
                          : alpha(theme.palette.text.primary, 0.06),
                        border: `1px solid ${t.ready ? alpha(t.color, 0.3) : theme.palette.divider}`,
                      }}
                    />
                  </Box>
                </Stack>

                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7, flex: 1 }}>
                  {t.blurb}
                </Typography>

                <Divider sx={{ my: 2 }} />
                <Stack spacing={0.6} sx={{ mb: 2.5 }}>
                  {t.bullets.map((b) => (
                    <Stack key={b} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                      <Box sx={{ width: 4, height: 4, borderRadius: '50%', bgcolor: t.color, flexShrink: 0 }} />
                      <Typography variant="body2" sx={{ fontSize: '0.84rem' }}>{b}</Typography>
                    </Stack>
                  ))}
                </Stack>

                <Button
                  component={RouterLink}
                  to={t.to}
                  variant={t.ready ? 'contained' : 'outlined'}
                  endIcon={<ArrowForwardRoundedIcon />}
                  sx={{
                    alignSelf: 'flex-start',
                    ...(t.ready
                      ? { bgcolor: t.color, '&:hover': { bgcolor: t.color, filter: 'brightness(0.92)' } }
                      : { color: t.color, borderColor: alpha(t.color, 0.45), '&:hover': { borderColor: t.color, bgcolor: alpha(t.color, 0.06) } }),
                  }}
                >
                  Get started
                </Button>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {shown.length === 0 && (
        <Paper
          variant="outlined"
          sx={{ p: 5, textAlign: 'center', bgcolor: alpha(theme.palette.text.primary, 0.02) }}
        >
          <Typography color="text.secondary">No tracks match that filter.</Typography>
        </Paper>
      )}
    </Container>
  )
}
