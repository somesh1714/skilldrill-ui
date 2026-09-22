import { Box, Paper, Typography } from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import LightbulbRoundedIcon from '@mui/icons-material/LightbulbRounded'
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded'
import InfoRoundedIcon from '@mui/icons-material/InfoRounded'
import PsychologyRoundedIcon from '@mui/icons-material/PsychologyRounded'
import ReportProblemRoundedIcon from '@mui/icons-material/ReportProblemRounded'
import Inline from './Inline.jsx'

const TONES = {
  key:  { label: 'Key idea',       color: '#4f46e5', Icon: PsychologyRoundedIcon },
  tip:  { label: 'Trick',          color: '#15803d', Icon: LightbulbRoundedIcon },
  warn: { label: 'Careful',        color: '#b45309', Icon: WarningAmberRoundedIcon },
  note: { label: 'Note',           color: '#0e7490', Icon: InfoRoundedIcon },
  trap: { label: 'Interview trap', color: '#be123c', Icon: ReportProblemRoundedIcon },
}

export default function Callout({ tone = 'note', title, text, children }) {
  const theme = useTheme()
  const spec = TONES[tone] || TONES.note
  const { Icon } = spec
  const tint = theme.palette.mode === 'dark' ? 0.13 : 0.06

  return (
    <Paper
      variant="outlined"
      sx={{
        my: 2,
        px: 2,
        py: 1.6,
        display: 'flex',
        gap: 1.5,
        alignItems: 'flex-start',
        borderColor: alpha(spec.color, 0.35),
        bgcolor: alpha(spec.color, tint),
        borderLeft: `3px solid ${spec.color}`,
      }}
    >
      <Icon sx={{ color: spec.color, fontSize: 20, mt: '2px', flexShrink: 0 }} />
      <Box sx={{ minWidth: 0 }}>
        <Typography
          variant="caption"
          sx={{ display: 'block', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: spec.color, mb: 0.4 }}
        >
          {title || spec.label}
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.primary' }}>
          {text ? <Inline text={text} /> : children}
        </Typography>
      </Box>
    </Paper>
  )
}
