import { Link as RouterLink } from 'react-router-dom'
import { Box, Container, Typography, Button, Stack } from '@mui/material'
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded'

export default function NotFound() {
  return (
    <Container maxWidth="sm" sx={{ py: { xs: 10, md: 16 }, textAlign: 'center' }}>
      <Typography sx={{ fontSize: '4rem', fontWeight: 800, color: 'primary.main', lineHeight: 1 }}>
        404
      </Typography>
      <Typography variant="h5" sx={{ fontWeight: 700, mt: 1.5, mb: 1 }}>
        That page does not exist
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 4 }}>
        The link may be out of date, or the chapter may not be written yet.
      </Typography>
      <Stack direction="row" spacing={1.5} sx={{ justifyContent: 'center' }}>
        <Button component={RouterLink} to="/" variant="contained" startIcon={<ArrowBackRoundedIcon />}>
          Back home
        </Button>
        <Button component={RouterLink} to="/dsa" variant="outlined">
          Browse DSA chapters
        </Button>
      </Stack>
    </Container>
  )
}
