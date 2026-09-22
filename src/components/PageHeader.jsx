import { Box, Container, Typography, Stack, Chip, Breadcrumbs, Link as MuiLink } from '@mui/material'
import { Link as RouterLink } from 'react-router-dom'
import NavigateNextRoundedIcon from '@mui/icons-material/NavigateNextRounded'
import { alpha, useTheme } from '@mui/material/styles'
import Inline from './Inline.jsx'

export default function PageHeader({ eyebrow, title, lead, chips = [], crumbs = [], children, icon }) {
  const theme = useTheme()
  return (
    <Box
      sx={{
        borderBottom: `1px solid ${theme.palette.divider}`,
        background: `linear-gradient(180deg, ${alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.07 : 0.045)}, transparent)`,
      }}
    >
      <Container maxWidth="xl" sx={{ px: { xs: 2, md: 3 }, pt: { xs: 3, md: 5 }, pb: { xs: 3, md: 4.5 } }}>
        {crumbs.length > 0 && (
          <Breadcrumbs
            separator={<NavigateNextRoundedIcon fontSize="small" />}
            sx={{ mb: 1.5, fontSize: '0.83rem' }}
            className="mh-fade"
          >
            {crumbs.map((c, i) =>
              c.to ? (
                <MuiLink key={i} component={RouterLink} to={c.to} underline="hover" color="text.secondary">
                  {c.label}
                </MuiLink>
              ) : (
                <Typography key={i} variant="body2" color="text.primary" sx={{ fontWeight: 600 }}>
                  {c.label}
                </Typography>
              ),
            )}
          </Breadcrumbs>
        )}

        {eyebrow && (
          <Typography
            variant="overline"
            className="mh-rise"
            sx={{ color: 'primary.main', display: 'block', mb: 0.5, fontSize: '0.72rem' }}
          >
            {eyebrow}
          </Typography>
        )}

        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'flex-start' }}>
          {icon && (
            <Box
              className="mh-rise"
              sx={{
                mt: 0.5, width: 46, height: 46, borderRadius: 2.5, flexShrink: 0,
                display: { xs: 'none', sm: 'grid' }, placeItems: 'center',
                bgcolor: alpha(theme.palette.primary.main, 0.11),
                border: `1px solid ${alpha(theme.palette.primary.main, 0.22)}`,
                color: 'primary.main',
              }}
            >
              {icon}
            </Box>
          )}
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography
              variant="h3"
              className="mh-rise mh-d1"
              sx={{ fontSize: { xs: '1.75rem', md: '2.4rem' }, mb: lead ? 1 : 0 }}
            >
              {title}
            </Typography>
            {lead && (
              <Typography
                variant="subtitle1"
                className="mh-rise mh-d2"
                sx={{ color: 'text.secondary', maxWidth: 820, fontSize: { xs: '0.98rem', md: '1.08rem' } }}
              >
                <Inline text={lead} />
              </Typography>
            )}
          </Box>
        </Stack>

        {chips.length > 0 && (
          <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: 'wrap', mt: 2 }} className="mh-rise mh-d3">
            {chips.map((c, i) => (
              <Chip
                key={i}
                size="small"
                label={c.label}
                icon={c.icon}
                variant={c.filled ? 'filled' : 'outlined'}
                color={c.color}
                sx={{ fontWeight: 600 }}
              />
            ))}
          </Stack>
        )}

        {children && <Box sx={{ mt: 2.5 }} className="mh-rise mh-d4">{children}</Box>}
      </Container>
    </Box>
  )
}
