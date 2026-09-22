import { useMemo, useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import {
  Box, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Typography, Chip, Checkbox, Link as MuiLink, Stack, TextField, ToggleButton,
  ToggleButtonGroup, InputAdornment, Tooltip,
} from '@mui/material'
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded'
import SearchRoundedIcon from '@mui/icons-material/SearchRounded'
import { alpha, useTheme } from '@mui/material/styles'
import { difficultyColor } from '../theme.js'
import { useProgress, problemKey } from '../lib/progress.js'
import { basePath } from '../lib/navigation.js'
import Inline from './Inline.jsx'

export function DifficultyChip({ value }) {
  const color = difficultyColor[value] || '#666'
  return (
    <Chip
      size="small"
      label={value}
      sx={{
        color,
        bgcolor: alpha(color, 0.12),
        border: `1px solid ${alpha(color, 0.35)}`,
        fontWeight: 700,
        minWidth: 68,
      }}
    />
  )
}

export default function ProblemTable({
  problems, trackId = 'dsa', showTopic = false, filterable = true, dense = false,
}) {
  const theme = useTheme()
  const { solved, toggle } = useProgress()
  const [query, setQuery] = useState('')
  const [difficulty, setDifficulty] = useState('All')

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return problems.filter((p) => {
      if (difficulty !== 'All' && p.difficulty !== difficulty) return false
      if (!q) return true
      return (
        p.name.toLowerCase().includes(q) ||
        (p.pattern || '').toLowerCase().includes(q) ||
        (p.insight || '').toLowerCase().includes(q) ||
        (p.topicTitle || '').toLowerCase().includes(q)
      )
    })
  }, [problems, query, difficulty])

  const doneCount = rows.filter((p) => solved[problemKey(p.topicId, p.name)]).length

  return (
    <Box>
      {filterable && (
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1.5}
          sx={{ alignItems: { sm: 'center' }, mb: 2 }}
        >
          <TextField
            size="small"
            placeholder="Filter by name, pattern or insight…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            sx={{ flex: 1, minWidth: 220 }}
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
            value={difficulty}
            onChange={(_, v) => v && setDifficulty(v)}
          >
            {['All', 'Easy', 'Medium', 'Hard'].map((d) => (
              <ToggleButton key={d} value={d} sx={{ px: 1.5, textTransform: 'none', fontWeight: 600 }}>
                {d}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
          <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
            {doneCount} / {rows.length} done
          </Typography>
        </Stack>
      )}

      <TableContainer component={Paper} variant="outlined" sx={{ overflowX: 'auto' }}>
        <Table size="small" sx={{ minWidth: showTopic ? 820 : 700 }}>
          <TableHead>
            <TableRow sx={{ bgcolor: alpha(theme.palette.text.primary, theme.palette.mode === 'dark' ? 0.04 : 0.025) }}>
              <TableCell padding="checkbox" />
              <TableCell sx={{ fontSize: '0.78rem' }}>Problem</TableCell>
              <TableCell sx={{ fontSize: '0.78rem' }}>Difficulty</TableCell>
              {showTopic && <TableCell sx={{ fontSize: '0.78rem' }}>Topic</TableCell>}
              <TableCell sx={{ fontSize: '0.78rem' }}>Pattern</TableCell>
              {!dense && <TableCell sx={{ fontSize: '0.78rem' }}>Key insight</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((p) => {
              const key = problemKey(p.topicId, p.name)
              const done = !!solved[key]
              return (
                <TableRow
                  key={key}
                  hover
                  sx={{ opacity: done ? 0.58 : 1, transition: 'opacity 160ms ease' }}
                >
                  <TableCell padding="checkbox">
                    <Tooltip title={done ? 'Mark as not done' : 'Mark as done'}>
                      <Checkbox size="small" checked={done} onChange={() => toggle(key)} />
                    </Tooltip>
                  </TableCell>
                  <TableCell sx={{ minWidth: 200 }}>
                    {p.url ? (
                      <MuiLink
                        href={p.url}
                        target="_blank"
                        rel="noreferrer"
                        underline="hover"
                        sx={{
                          fontWeight: 600, fontSize: '0.88rem',
                          display: 'inline-flex', alignItems: 'center', gap: 0.5,
                          textDecoration: done ? 'line-through' : 'none',
                          color: 'text.primary',
                          '&:hover': { color: 'primary.main' },
                        }}
                      >
                        {p.name}
                        <OpenInNewRoundedIcon sx={{ fontSize: 13, opacity: 0.45 }} />
                      </MuiLink>
                    ) : (
                      <Typography
                        sx={{
                          fontWeight: 600, fontSize: '0.88rem',
                          textDecoration: done ? 'line-through' : 'none',
                        }}
                      >
                        {p.name}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell><DifficultyChip value={p.difficulty} /></TableCell>
                  {showTopic && (
                    <TableCell>
                      <MuiLink
                        component={RouterLink}
                        to={`${basePath(trackId)}/${p.topicId}`}
                        underline="hover"
                        sx={{ fontSize: '0.82rem', color: 'text.secondary' }}
                      >
                        {p.topicTitle}
                      </MuiLink>
                    </TableCell>
                  )}
                  <TableCell>
                    <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 600 }}>
                      {p.pattern}
                    </Typography>
                  </TableCell>
                  {!dense && (
                    <TableCell sx={{ maxWidth: 460 }}>
                      <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.82rem' }}>
                        <Inline text={p.insight} />
                      </Typography>
                    </TableCell>
                  )}
                </TableRow>
              )
            })}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6}>
                  <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
                    No problems match that filter.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  )
}
