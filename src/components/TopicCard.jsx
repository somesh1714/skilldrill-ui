import { Link as RouterLink } from 'react-router-dom'
import { Card, CardActionArea, CardContent, Typography, Box, Stack, Chip, LinearProgress } from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import ScheduleRoundedIcon from '@mui/icons-material/ScheduleRounded'
import TopicIcon from '../lib/icons.jsx'
import { tierColor } from '../theme.js'
import { useProgress, problemKey } from '../lib/progress.js'
import { basePath } from '../lib/navigation.js'

export default function TopicCard({ topic, trackId = 'dsa', index = 0 }) {
  const theme = useTheme()
  const { solved } = useProgress()
  const color = tierColor[topic.tier] || theme.palette.primary.main

  const total = topic.problems?.length || 0
  const done = (topic.problems || []).filter((p) => solved[problemKey(topic.id, p.name)]).length
  const pct = total ? (done / total) * 100 : 0

  return (
    <Card
      className="mh-rise"
      sx={{
        height: '100%',
        animationDelay: `${Math.min(index, 9) * 45}ms`,
        transition: 'transform 180ms ease, border-color 180ms ease',
        '&:hover': { transform: 'translateY(-3px)', borderColor: alpha(color, 0.5) },
      }}
    >
      <CardActionArea component={RouterLink} to={`${basePath(trackId)}/${topic.id}`} sx={{ height: '100%', alignItems: 'stretch' }}>
        <CardContent sx={{ p: 2.25, height: '100%', display: 'flex', flexDirection: 'column' }}>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'flex-start', mb: 1.25 }}>
            <Box
              sx={{
                width: 38, height: 38, borderRadius: 2, flexShrink: 0,
                display: 'grid', placeItems: 'center',
                bgcolor: alpha(color, theme.palette.mode === 'dark' ? 0.18 : 0.1),
                border: `1px solid ${alpha(color, 0.3)}`,
                color,
              }}
            >
              <TopicIcon name={topic.icon} sx={{ fontSize: 20 }} />
            </Box>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography sx={{ fontWeight: 720, fontSize: '1rem', lineHeight: 1.3 }}>
                {topic.short || topic.title}
              </Typography>
              <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', mt: 0.35 }}>
                <Chip
                  size="small"
                  label={topic.tier}
                  sx={{
                    height: 19, fontSize: '0.66rem',
                    color, bgcolor: alpha(color, 0.12),
                    border: `1px solid ${alpha(color, 0.3)}`,
                  }}
                />
                <Stack direction="row" spacing={0.3} sx={{ alignItems: 'center' }}>
                  <ScheduleRoundedIcon sx={{ fontSize: 12, color: 'text.disabled' }} />
                  <Typography variant="caption" color="text.disabled">{topic.estHours}h</Typography>
                </Stack>
              </Stack>
            </Box>
          </Stack>

          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ fontSize: '0.855rem', lineHeight: 1.6, flex: 1, mb: 1.5 }}
          >
            {topic.tagline}
          </Typography>

          <Box>
            <Stack direction="row" sx={{ justifyContent: 'space-between', mb: 0.5 }}>
              <Typography variant="caption" color="text.disabled">
                {topic.patterns?.length || 0} patterns · {total} problems
              </Typography>
              <Typography variant="caption" sx={{ fontWeight: 700, color: done ? color : 'text.disabled' }}>
                {done}/{total}
              </Typography>
            </Stack>
            <LinearProgress
              variant="determinate"
              value={pct}
              sx={{
                bgcolor: alpha(color, 0.12),
                '& .MuiLinearProgress-bar': { bgcolor: color },
              }}
            />
          </Box>
        </CardContent>
      </CardActionArea>
    </Card>
  )
}
