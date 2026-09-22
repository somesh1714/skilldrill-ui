import { Card, CardContent, Typography, Box, Stack, Chip, Divider } from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded'
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded'
import SpeedRoundedIcon from '@mui/icons-material/SpeedRounded'
import Inline from './Inline.jsx'
import CodeBlock from './CodeBlock.jsx'

function Bulleted({ icon: Icon, title, items, color }) {
  if (!items || items.length === 0) return null
  return (
    <Box sx={{ mb: 1.75 }}>
      <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', mb: 0.5 }}>
        <Icon sx={{ fontSize: 15, color }} />
        <Typography
          variant="caption"
          sx={{ fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', color }}
        >
          {title}
        </Typography>
      </Stack>
      <Box component="ul" sx={{ pl: 2.4, m: 0, '& li': { mb: 0.4 } }}>
        {items.map((it, i) => (
          <Typography key={i} component="li" variant="body2" sx={{ fontSize: '0.87rem' }}>
            <Inline text={it} />
          </Typography>
        ))}
      </Box>
    </Box>
  )
}

export default function PatternCard({ pattern, showTopic = false, defaultOpen = true }) {
  const theme = useTheme()
  const p = pattern

  return (
    <Card sx={{ scrollMarginTop: 'calc(var(--mh-header) + 18px)' }} data-anchor id={`pattern-${p.id}`}>
      <Box
        sx={{
          px: 2.25, py: 1.6,
          borderBottom: `1px solid ${theme.palette.divider}`,
          bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.08 : 0.045),
        }}
      >
        <Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
          <Typography variant="h6" sx={{ fontWeight: 750, fontSize: '1.05rem' }}>
            {p.name}
          </Typography>
          {showTopic && p.topicTitle && (
            <Chip size="small" label={p.topicTitle} variant="outlined" />
          )}
        </Stack>
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.35, fontStyle: 'italic' }}>
          <Inline text={p.oneLiner} />
        </Typography>
      </Box>

      <CardContent sx={{ pt: 2 }}>
        <Bulleted icon={CheckCircleRoundedIcon} title="Use when" items={p.useWhen} color="#15803d" />
        <Bulleted icon={VisibilityRoundedIcon} title="How to recognise it" items={p.recognize} color="#0e7490" />
        <Bulleted icon={SpeedRoundedIcon} title="Recipe" items={p.steps} color={theme.palette.primary.main} />

        {p.template && (
          <Box sx={{ my: 2 }}>
            <CodeBlock
              code={p.template.code}
              lang={p.template.lang || 'java'}
              caption={p.template.caption}
              dense
            />
          </Box>
        )}

        {p.complexity && (
          <Box
            sx={{
              my: 1.75, px: 1.5, py: 1, borderRadius: 2,
              bgcolor: alpha(theme.palette.text.primary, theme.palette.mode === 'dark' ? 0.04 : 0.03),
              border: `1px solid ${theme.palette.divider}`,
            }}
          >
            <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary', mr: 1 }}>
              COMPLEXITY
            </Typography>
            <Typography variant="body2" component="span"><Inline text={p.complexity} /></Typography>
          </Box>
        )}

        <Bulleted icon={WarningAmberRoundedIcon} title="Gotchas" items={p.gotchas} color="#b45309" />

        {p.problems && p.problems.length > 0 && (
          <>
            <Divider sx={{ my: 1.5 }} />
            <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary', display: 'block', mb: 0.75 }}>
              DRILL THESE
            </Typography>
            <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: 'wrap' }}>
              {p.problems.map((name) => (
                <Chip key={name} size="small" label={name} variant="outlined" sx={{ fontWeight: 500 }} />
              ))}
            </Stack>
          </>
        )}
      </CardContent>
    </Card>
  )
}
