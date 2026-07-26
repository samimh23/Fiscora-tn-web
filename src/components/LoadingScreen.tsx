import { Box, CircularProgress, Typography } from '@mui/material';
import { Brand } from './Brand';

export function LoadingScreen() {
  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', bgcolor: 'background.default' }}>
      <Box sx={{ display: 'grid', justifyItems: 'center', gap: 3 }}>
        <Brand />
        <CircularProgress size={30} />
        <Typography color="text.secondary">Préparation de votre espace…</Typography>
      </Box>
    </Box>
  );
}
