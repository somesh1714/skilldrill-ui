import { useEffect, useState } from 'react'
import { Link as RouterLink, useLocation } from 'react-router-dom'
import {
  AppBar, Box, Button, Container, Divider, Drawer, IconButton, List,
  ListItemButton, ListItemText, ListSubheader, Stack, Toolbar, Tooltip, Typography,
} from '@mui/material'
import MenuRoundedIcon from '@mui/icons-material/MenuRounded'
import DarkModeRoundedIcon from '@mui/icons-material/DarkModeRounded'
import LightModeRoundedIcon from '@mui/icons-material/LightModeRounded'
import TrackChangesRoundedIcon from '@mui/icons-material/TrackChangesRounded'
import GitHubIcon from '@mui/icons-material/GitHub'
import { alpha, useTheme } from '@mui/material/styles'
import { useColorMode } from '../lib/ColorMode.jsx'
import { TRACKS, sectionFor, matchesPath, activeItem } from '../lib/navigation.js'

export default function AppShell({ children }) {
  const theme = useTheme()
  const { mode, toggle } = useColorMode()
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()

  const section = sectionFor(pathname)
  const subNav = section?.items?.length ? section.items : null
  const current = activeItem(section, pathname)

  // Anchor offsets and the sticky chapter TOC read the header height from CSS,
  // so it has to know whether the second bar is present.
  useEffect(() => {
    document.body.classList.toggle('mh-has-subnav', !!subNav)
  }, [subNav])

  return (
    <Box sx={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <AppBar
        position="sticky"
        elevation={0}
        color="transparent"
        sx={{
          backdropFilter: 'saturate(180%) blur(14px)',
          bgcolor: alpha(theme.palette.background.default, 0.82),
          borderBottom: `1px solid ${theme.palette.divider}`,
        }}
      >
        {/* ------------------------- primary bar: tracks ------------------------ */}
        <Container maxWidth="xl" disableGutters>
          <Toolbar sx={{ gap: 1, minHeight: { xs: 58, md: 64 }, px: { xs: 1.5, md: 3 } }}>
            <Box
              component={RouterLink}
              to="/"
              sx={{
                display: 'flex', alignItems: 'center', gap: 1, mr: 1,
                textDecoration: 'none', color: 'text.primary',
              }}
            >
              <TrackChangesRoundedIcon sx={{ color: 'primary.main' }} />
              <Typography sx={{ fontWeight: 800, letterSpacing: '-0.02em', fontSize: '1.06rem' }}>
                SkillDrill
              </Typography>
            </Box>

            <Stack direction="row" spacing={0.25} sx={{ display: { xs: 'none', md: 'flex' }, ml: 1 }}>
              {TRACKS.map((t) => {
                const active = matchesPath(t, pathname)
                return (
                  <Button
                    key={t.to}
                    component={RouterLink}
                    to={t.to}
                    size="small"
                    sx={{
                      px: 1.4,
                      color: active ? 'primary.main' : 'text.secondary',
                      bgcolor: active ? alpha(theme.palette.primary.main, 0.1) : 'transparent',
                      '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.08), color: 'primary.main' },
                    }}
                  >
                    {t.label}
                  </Button>
                )
              })}
            </Stack>

            <Box sx={{ flex: 1 }} />

            <Tooltip title={mode === 'dark' ? 'Switch to light' : 'Switch to dark'}>
              <IconButton onClick={toggle} size="small" sx={{ color: 'text.secondary' }}>
                {mode === 'dark' ? <LightModeRoundedIcon fontSize="small" /> : <DarkModeRoundedIcon fontSize="small" />}
              </IconButton>
            </Tooltip>

            <IconButton
              onClick={() => setOpen(true)}
              size="small"
              sx={{ display: { md: 'none' }, color: 'text.secondary' }}
            >
              <MenuRoundedIcon />
            </IconButton>
          </Toolbar>
        </Container>

        {/* --------------- secondary bar: only inside a track ------------------ */}
        {subNav && (
          <Box
            sx={{
              borderTop: `1px solid ${theme.palette.divider}`,
              bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.06 : 0.035),
            }}
          >
            <Container maxWidth="xl" disableGutters>
              <Stack
                direction="row"
                spacing={0.5}
                sx={{
                  alignItems: 'center',
                  px: { xs: 1.5, md: 3 },
                  minHeight: 44,
                  overflowX: 'auto',
                  '&::-webkit-scrollbar': { display: 'none' },
                  scrollbarWidth: 'none',
                }}
              >
                <Typography
                  variant="caption"
                  sx={{
                    display: { xs: 'none', lg: 'block' },
                    fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase',
                    color: 'text.disabled', mr: 1.5, whiteSpace: 'nowrap',
                  }}
                >
                  {section.label}
                </Typography>

                {subNav.map((it) => {
                  const active = it === current
                  return (
                    <Button
                      key={it.to}
                      component={RouterLink}
                      to={it.to}
                      size="small"
                      sx={{
                        px: 1.25,
                        minHeight: 44,
                        borderRadius: 0,
                        whiteSpace: 'nowrap',
                        fontWeight: active ? 700 : 500,
                        color: active ? 'primary.main' : 'text.secondary',
                        borderBottom: `2px solid ${active ? theme.palette.primary.main : 'transparent'}`,
                        '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.07), color: 'primary.main' },
                      }}
                    >
                      {it.label}
                    </Button>
                  )
                })}
              </Stack>
            </Container>
          </Box>
        )}
      </AppBar>

      {/* ------------------------------- drawer -------------------------------- */}
      <Drawer anchor="right" open={open} onClose={() => setOpen(false)}>
        <Box sx={{ width: 272, pt: 1 }} role="presentation" onClick={() => setOpen(false)}>
          <List
            dense
            subheader={
              <ListSubheader sx={{ fontWeight: 800, letterSpacing: '0.06em', fontSize: '0.7rem' }}>
                TRACKS
              </ListSubheader>
            }
          >
            {TRACKS.map((t) => {
              const active = matchesPath(t, pathname)
              return (
                <ListItemButton key={t.to} component={RouterLink} to={t.to} selected={active}>
                  <ListItemText primary={t.label} slotProps={{ primary: { fontWeight: active ? 700 : 500 } }} />
                </ListItemButton>
              )
            })}
          </List>

          {subNav && (
            <>
              <Divider />
              <List
                dense
                subheader={
                  <ListSubheader sx={{ fontWeight: 800, letterSpacing: '0.06em', fontSize: '0.7rem' }}>
                    {section.label.toUpperCase()}
                  </ListSubheader>
                }
              >
                {subNav.map((it) => (
                  <ListItemButton key={it.to} component={RouterLink} to={it.to} selected={it === current}>
                    <ListItemText
                      primary={it.label}
                      slotProps={{ primary: { fontWeight: it === current ? 700 : 500 } }}
                    />
                  </ListItemButton>
                ))}
              </List>
            </>
          )}
        </Box>
      </Drawer>

      <Box component="main" sx={{ flex: 1 }}>{children}</Box>

      <Box component="footer" sx={{ borderTop: `1px solid ${theme.palette.divider}`, mt: 8 }}>
        <Container maxWidth="xl" sx={{ py: 3.5, px: { xs: 2, md: 3 } }}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1.5}
            sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between' }}
          >
            <Typography variant="body2" color="text.secondary">
              <strong>SkillDrill</strong> — read the patterns, then drill the problems.
            </Typography>
            <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
              <Typography variant="caption" color="text.secondary">
                Built with Vite · React · MUI
              </Typography>
              <GitHubIcon sx={{ fontSize: 18, color: 'text.disabled' }} />
            </Stack>
          </Stack>
        </Container>
      </Box>
    </Box>
  )
}
