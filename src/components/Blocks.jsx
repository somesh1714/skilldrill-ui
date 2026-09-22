import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Stack, Chip,
} from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import Inline from './Inline.jsx'
import CodeBlock from './CodeBlock.jsx'
import Callout from './Callout.jsx'

function Bullets({ items, ordered }) {
  return (
    <Box
      component={ordered ? 'ol' : 'ul'}
      sx={{
        pl: 3, my: 1.25,
        '& li': { mb: 0.7, lineHeight: 1.72 },
        '& li::marker': { color: 'primary.main', fontWeight: 700 },
      }}
    >
      {items.map((it, i) => (
        <Typography key={i} component="li" variant="body1">
          <Inline text={it} />
        </Typography>
      ))}
    </Box>
  )
}

function DataTable({ head, rows, caption }) {
  const theme = useTheme()
  return (
    <Box sx={{ my: 2 }}>
      <TableContainer component={Paper} variant="outlined" sx={{ overflowX: 'auto' }}>
        <Table size="small" sx={{ minWidth: 460 }}>
          <TableHead>
            <TableRow sx={{ bgcolor: alpha(theme.palette.text.primary, theme.palette.mode === 'dark' ? 0.04 : 0.025) }}>
              {head.map((h, i) => (
                <TableCell key={i} sx={{ fontSize: '0.78rem' }}><Inline text={h} /></TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r, i) => (
              <TableRow key={i} hover>
                {r.map((c, j) => (
                  <TableCell key={j} sx={{ fontSize: '0.84rem', verticalAlign: 'top' }}>
                    <Inline text={c} />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      {caption && (
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.75 }}>
          <Inline text={caption} />
        </Typography>
      )}
    </Box>
  )
}

function Steps({ items }) {
  const theme = useTheme()
  return (
    <Stack spacing={1.25} sx={{ my: 2 }}>
      {items.map((s, i) => (
        <Box key={i} sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
          <Box
            sx={{
              width: 24, height: 24, borderRadius: '50%', flexShrink: 0, mt: '2px',
              display: 'grid', placeItems: 'center',
              fontSize: 12, fontWeight: 800,
              color: 'primary.main',
              bgcolor: alpha(theme.palette.primary.main, 0.13),
              border: `1px solid ${alpha(theme.palette.primary.main, 0.3)}`,
            }}
          >
            {i + 1}
          </Box>
          <Box sx={{ minWidth: 0 }}>
            {s.title && (
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.2 }}>
                <Inline text={s.title} />
              </Typography>
            )}
            <Typography variant="body2" color="text.secondary">
              <Inline text={s.text} />
            </Typography>
          </Box>
        </Box>
      ))}
    </Stack>
  )
}

function Ascii({ code, caption }) {
  const theme = useTheme()
  return (
    <Box sx={{ my: 2 }}>
      <Paper
        variant="outlined"
        sx={{
          overflow: 'hidden',
          bgcolor: theme.palette.mode === 'dark' ? '#0d1017' : '#fbfbfe',
          color: 'text.secondary',
        }}
      >
        <pre className="mh-ascii">{(code || '').replace(/^\n+|\n+$/g, '')}</pre>
      </Paper>
      {caption && (
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.75 }}>
          <Inline text={caption} />
        </Typography>
      )}
    </Box>
  )
}

function Compare({ left, right }) {
  const theme = useTheme()
  const Col = ({ spec, color }) => (
    <Paper
      variant="outlined"
      sx={{ p: 1.75, flex: 1, minWidth: 220, borderColor: alpha(color, 0.35), bgcolor: alpha(color, theme.palette.mode === 'dark' ? 0.1 : 0.05) }}
    >
      <Typography variant="subtitle2" sx={{ fontWeight: 800, color, mb: 0.75 }}>
        <Inline text={spec.title} />
      </Typography>
      <Box component="ul" sx={{ pl: 2.2, m: 0, '& li': { mb: 0.5 } }}>
        {spec.items.map((it, i) => (
          <Typography key={i} component="li" variant="body2"><Inline text={it} /></Typography>
        ))}
      </Box>
    </Paper>
  )
  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ my: 2 }}>
      <Col spec={left} color="#15803d" />
      <Col spec={right} color="#be123c" />
    </Stack>
  )
}

function Defs({ items }) {
  const theme = useTheme()
  return (
    <Stack spacing={1} sx={{ my: 2 }}>
      {items.map((d, i) => (
        <Box
          key={i}
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '180px 1fr' },
            gap: { xs: 0.25, sm: 2 },
            py: 0.9,
            borderBottom: `1px dashed ${theme.palette.divider}`,
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: 700, color: 'primary.main' }}>
            <Inline text={d.term} />
          </Typography>
          <Typography variant="body2" color="text.secondary"><Inline text={d.def} /></Typography>
        </Box>
      ))}
    </Stack>
  )
}

function Tags({ items }) {
  return (
    <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: 'wrap', my: 1.5 }}>
      {items.map((t, i) => <Chip key={i} size="small" label={t} variant="outlined" />)}
    </Stack>
  )
}

export function Block({ b }) {
  switch (b.t) {
    case 'p':     return <Typography variant="body1" sx={{ my: 1.25 }}><Inline text={b.text} /></Typography>
    case 'lead':  return <Typography variant="subtitle1" sx={{ my: 1.5, fontSize: '1.06rem', color: 'text.secondary' }}><Inline text={b.text} /></Typography>
    case 'h':     return <Typography variant="h6" sx={{ mt: 3.25, mb: 1, fontWeight: 750 }}><Inline text={b.text} /></Typography>
    case 'ul':    return <Bullets items={b.items} />
    case 'ol':    return <Bullets items={b.items} ordered />
    case 'code':  return <CodeBlock code={b.code} lang={b.lang || 'java'} caption={b.caption} />
    case 'ascii': return <Ascii code={b.code} caption={b.caption} />
    case 'table': return <DataTable head={b.head} rows={b.rows} caption={b.caption} />
    case 'steps': return <Steps items={b.items} />
    case 'dl':    return <Defs items={b.items} />
    case 'compare': return <Compare left={b.left} right={b.right} />
    case 'tags':  return <Tags items={b.items} />
    case 'key': case 'tip': case 'warn': case 'note': case 'trap':
      return <Callout tone={b.t} title={b.title} text={b.text} />
    default:      return null
  }
}

export default function Blocks({ blocks = [] }) {
  return blocks.map((b, i) => <Block key={i} b={b} />)
}
