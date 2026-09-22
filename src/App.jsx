import { useMemo, useEffect, lazy, Suspense } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import { ThemeProvider, CssBaseline, Box, CircularProgress } from '@mui/material'
import { ColorModeProvider, useColorMode } from './lib/ColorMode.jsx'
import { buildTheme } from './theme.js'
import AppShell from './components/AppShell.jsx'
import Home from './pages/Home.jsx'

// The DSA content module is large; keep it out of the initial bundle.
const DsaHome = lazy(() => import('./pages/DsaHome.jsx'))
const Chapters = lazy(() => import('./pages/Chapters.jsx'))
const TopicPage = lazy(() => import('./pages/TopicPage.jsx'))
const PatternsIndex = lazy(() => import('./pages/PatternsIndex.jsx'))
const ProblemsIndex = lazy(() => import('./pages/ProblemsIndex.jsx'))
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
            <Route path="/dsa" element={<DsaHome />} />
            <Route path="/dsa/chapters" element={<Chapters />} />
            <Route path="/dsa/patterns" element={<PatternsIndex />} />
            <Route path="/dsa/problems" element={<ProblemsIndex />} />
            <Route path="/dsa/cheatsheet" element={<CheatSheet />} />
            <Route path="/dsa/roadmap" element={<Roadmap />} />
            <Route path="/dsa/:topicId" element={<TopicPage />} />
            <Route path="/spring" element={<TrackOutline trackId="spring" />} />
            <Route path="/system-design" element={<TrackOutline trackId="system-design" />} />
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
