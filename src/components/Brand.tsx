import { Box, Typography } from '@mui/material';

export function Brand({ dark = false }: { dark?: boolean }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.4 }}>
      <span className="brand-mark">CT</span>
      <Box>
        <Typography sx={{ color: dark ? '#fff' : 'text.primary', fontWeight: 800, lineHeight: 1.05 }}>
          Compta TN
        </Typography>
        <Typography variant="caption" sx={{ color: dark ? 'rgba(255,255,255,.62)' : 'text.secondary' }}>
          Espace cabinet
        </Typography>
      </Box>
    </Box>
  );
}
