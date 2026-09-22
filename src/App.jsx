import { useMemo, useEffect, lazy, Suspense } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import { ThemeProvider, CssBaseline, Box, CircularProgress } from '@mui/material'
import { ColorModeProvider, useColorMode } from './lib/ColorMode.jsx'
import { buildTheme } from './theme.js'
import AppShell from './components/AppShell.jsx'
import Home from './pages/Home.jsx'
import { tracks } from './content/tracks.js'

// The DSA content module is large; keep it out of the initial bundle.
const TrackHome = lazy(() => import('./pages/TrackHome.jsx'))
const Chapters = lazy(() => import('./pages/Chapters.jsx'))
const TopicPage = lazy(() => import('./pages/TopicPage.jsx'))
const PatternsIndex = lazy(() => import('./pages/PatternsIndex.jsx'))
const Practice = lazy(() => import('./pages/Practice.jsx'))
const CheatSheet = lazy(() => import('./pages/CheatSheet.jsx'))
const Roadmap = lazy(() => import('./pages/Roadmap.jsx'))
const TrackOutline = lazy(() => import('./pages/TrackOutline.jsx'))
const NotFound = lazy(() => import('./pages/NotFound.jsx'))

function ScrollToTop() {
  const { pathname, hash } = useLocation()

  useEffect(() => {
    if (!hash) {
      window.scrollTo({ top: 0, behavior: 'auto' })
      return
    }

    // The target may live in a route that is still being code-split in, so poll
    // for a few frames before giving up rather than scrolling to a missing node.
    const id = decodeURIComponent(hash.slice(1))
    let frames = 0
    let raf = 0

    const tryScroll = () => {
      const el = document.getElementById(id)
      if (el) { el.scrollIntoView(); return }
      if (frames++ < 40) raf = requestAnimationFrame(tryScroll)
    }
    raf = requestAnimationFrame(tryScroll)
    return () => cancelAnimationFrame(raf)
  }, [pathname, hash])

  return null
}

function Loading() {
  return (
    <Box sx={{ display: 'grid', placeItems: 'center', minHeight: '55dvh' }}>
      <CircularProgress size={28} />
    </Box>
  )
}

function Themed() {
  const { mode } = useColorMode()
  const theme = useMemo(() => buildTheme(mode), [mode])

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <ScrollToTop />
      <AppShell>
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route path="/" element={<Home />} />

            {/* A finished track gets the full page set; an unfinished one gets
                its outline. Both come from the same registry. */}
            {tracks.map((t) =>
              t.ready ? (
                <Route key={t.id} path={t.to}>
                  <Route index element={<TrackHome trackId={t.id} />} />
                  <Route path="chapters" element={<Chapters trackId={t.id} />} />
                  <Route path="patterns" element={<PatternsIndex trackId={t.id} />} />
                  <Route path={t.practice.path} element={<Practice trackId={t.id} />} />
                  <Route path="cheatsheet" element={<CheatSheet trackId={t.id} />} />
                  {t.hasRoadmap && <Route path="roadmap" element={<Roadmap />} />}
                  <Route path=":topicId" element={<TopicPage trackId={t.id} />} />
                </Route>
              ) : (
                <Route key={t.id} path={t.to} element={<TrackOutline trackId={t.id} />} />
              ),
            )}

            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </AppShell>
    </ThemeProvider>
  )
}

export default function App() {
  return (
    <ColorModeProvider>
      <Themed />
    </ColorModeProvider>
  )
}
