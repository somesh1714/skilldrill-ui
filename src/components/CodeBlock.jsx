import { useState } from 'react'
import Prism from 'prismjs'
import 'prismjs/components/prism-java'
import 'prismjs/components/prism-python'
import { Box, IconButton, Tooltip, Typography, Paper } from '@mui/material'
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded'
import CheckRoundedIcon from '@mui/icons-material/CheckRounded'
import { alpha, useTheme } from '@mui/material/styles'

export default function CodeBlock({ code, lang = 'java', caption, dense = false }) {
  const theme = useTheme()
  const [copied, setCopied] = useState(false)
  const src = (code || '').replace(/^\n+|\n+$/g, '')

  let html = null
  const grammar = Prism.languages[lang]
  if (grammar) {
    try { html = Prism.highlight(src, grammar, lang) } catch { html = null }
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(src)
      setCopied(true)
      setTimeout(() => setCopied(false), 1400)
    } catch { /* clipboard blocked */ }
  }

  return (
    <Paper
      variant="outlined"
      sx={{
        my: dense ? 1 : 2,
        overflow: 'hidden',
        bgcolor: theme.palette.mode === 'dark' ? '#0d1017' : '#fcfcfe',
        borderColor: alpha(theme.palette.divider, 1),
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 1.5,
          py: 0.5,
          borderBottom: `1px solid ${theme.palette.divider}`,
          bgcolor: alpha(theme.palette.text.primary, theme.palette.mode === 'dark' ? 0.03 : 0.02),
        }}
      >
        <Typography
          variant="caption"
          sx={{ fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'text.secondary' }}
        >
          {lang}
        </Typography>
        {caption && (
          <Typography variant="caption" sx={{ color: 'text.secondary', ml: 0.5, minWidth: 0, flex: 1 }} noWrap>
            — {caption}
          </Typography>
        )}
        <Box sx={{ flex: caption ? 'none' : 1 }} />
        <Tooltip title={copied ? 'Copied' : 'Copy'}>
          <IconButton size="small" onClick={copy} sx={{ color: copied ? 'success.main' : 'text.secondary' }}>
            {copied ? <CheckRoundedIcon fontSize="inherit" /> : <ContentCopyRoundedIcon fontSize="inherit" />}
          </IconButton>
        </Tooltip>
      </Box>
      {html ? (
        <pre className="mh-code" dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <pre className="mh-code"><code>{src}</code></pre>
      )}
    </Paper>
  )
}
