import { createTheme, alpha } from '@mui/material/styles'

// A restrained, document-first palette. Ink on paper in light mode,
// deep slate in dark mode, with a single indigo accent used sparingly.
const accent = { light: '#4f46e5', dark: '#a5b4fc' }

export const difficultyColor = {
  Easy: '#15803d',
  Medium: '#b45309',
  Hard: '#be123c',
}

export const tierColor = {
  Foundations: '#0e7490',
  Core: '#4f46e5',
  Advanced: '#9333ea',
  Elite: '#be123c',
}

export function buildTheme(mode) {
  const isDark = mode === 'dark'

  return createTheme({
    cssVariables: false,
    palette: {
      mode,
      primary: { main: isDark ? accent.dark : accent.light },
      secondary: { main: isDark ? '#5eead4' : '#0f766e' },
      background: {
        default: isDark ? '#0b0d12' : '#fbfbfd',
        paper: isDark ? '#12151c' : '#ffffff',
      },
      text: {
        primary: isDark ? '#e6e8ef' : '#14161c',
        secondary: isDark ? '#9aa1b1' : '#5b6170',
      },
      divider: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(16,18,24,0.10)',
    },
    shape: { borderRadius: 12 },
    typography: {
      fontFamily: '"Inter", system-ui, -apple-system, "Segoe UI", sans-serif',
      h1: { fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.08 },
      h2: { fontWeight: 800, letterSpacing: '-0.025em', lineHeight: 1.15 },
      h3: { fontWeight: 750, letterSpacing: '-0.02em' },
      h4: { fontWeight: 720, letterSpacing: '-0.015em' },
      h5: { fontWeight: 700, letterSpacing: '-0.01em' },
      h6: { fontWeight: 700 },
      subtitle1: { lineHeight: 1.6 },
      body1: { lineHeight: 1.72, fontSize: '1rem' },
      body2: { lineHeight: 1.65 },
      button: { textTransform: 'none', fontWeight: 600 },
      overline: { letterSpacing: '0.12em', fontWeight: 700 },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          html: { scrollBehavior: 'smooth' },
          body: {
            WebkitFontSmoothing: 'antialiased',
            backgroundImage: isDark
              ? 'radial-gradient(1200px 600px at 78% -8%, rgba(99,102,241,0.14), transparent 62%)'
              : 'radial-gradient(1200px 600px at 78% -8%, rgba(99,102,241,0.09), transparent 62%)',
            backgroundAttachment: 'fixed',
          },
          '::selection': {
            background: alpha(isDark ? accent.dark : accent.light, 0.28),
          },
          '*::-webkit-scrollbar': { width: 10, height: 10 },
          '*::-webkit-scrollbar-thumb': {
            background: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.16)',
            borderRadius: 8,
          },
        },
      },
      MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
      MuiCard: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: {
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.09)' : 'rgba(16,18,24,0.09)'}`,
            backgroundColor: isDark ? '#12151c' : '#ffffff',
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: { fontWeight: 600 },
          sizeSmall: { height: 22, fontSize: '0.72rem' },
        },
      },
      MuiButton: { defaultProps: { disableElevation: true } },
      MuiTooltip: {
        defaultProps: { arrow: true },
        styleOverrides: { tooltip: { fontSize: '0.78rem', padding: '6px 10px' } },
      },
      MuiTableCell: {
        styleOverrides: {
          root: { borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(16,18,24,0.08)' },
          head: { fontWeight: 700, whiteSpace: 'nowrap' },
        },
      },
      MuiAccordion: {
        defaultProps: { disableGutters: true, elevation: 0, square: false },
        styleOverrides: {
          root: {
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.09)' : 'rgba(16,18,24,0.09)'}`,
            borderRadius: 12,
            '&:before': { display: 'none' },
            marginBottom: 10,
            overflow: 'hidden',
          },
        },
      },
      MuiLinearProgress: { styleOverrides: { root: { borderRadius: 999, height: 6 } } },
    },
  })
}
