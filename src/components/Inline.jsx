import { Box, Link as MuiLink } from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'

// Supported inline syntax inside content strings:
//   **bold**   _italic_   `code`   [label](https://url)
const TOKEN = /(\*\*[^*]+\*\*|`[^`]+`|_[^_\n]+_|\[[^\]]+\]\([^)\s]+\))/g

export function InlineCode({ children }) {
  const t = useTheme()
  return (
    <Box
      component="code"
      className="mh-inline"
      sx={{
        bgcolor: alpha(t.palette.primary.main, t.palette.mode === 'dark' ? 0.16 : 0.09),
        color: t.palette.mode === 'dark' ? t.palette.primary.light : t.palette.primary.dark,
        border: `1px solid ${alpha(t.palette.primary.main, 0.18)}`,
      }}
    >
      {children}
    </Box>
  )
}

export default function Inline({ text }) {
  if (text == null) return null
  if (typeof text !== 'string') return text

  const parts = text.split(TOKEN).filter((p) => p !== '')

  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <InlineCode key={i}>{part.slice(1, -1)}</InlineCode>
    }
    if (part.startsWith('_') && part.endsWith('_')) {
      return <em key={i}>{part.slice(1, -1)}</em>
    }
    const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(part)
    if (link) {
      return (
        <MuiLink key={i} href={link[2]} target="_blank" rel="noreferrer" underline="hover">
          {link[1]}
        </MuiLink>
      )
    }
    return <span key={i}>{part}</span>
  })
}
