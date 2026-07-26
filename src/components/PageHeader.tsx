import { Box, Typography } from '@mui/material';
import type { ReactNode } from 'react';

export function PageHeader({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return (
    <Box sx={{ display: 'flex', gap: 2, alignItems: { xs: 'flex-start', sm: 'center' }, justifyContent: 'space-between', flexDirection: { xs: 'column', sm: 'row' }, mb: 3 }}>
      <Box>
        <Typography variant="overline" color="secondary.main" sx={{ fontWeight: 800, letterSpacing: '.12em' }}>{eyebrow}</Typography>
        <Typography variant="h2" sx={{ fontSize: { xs: 34, md: 44 }, mt: .3 }}>{title}</Typography>
        <Typography color="text.secondary" sx={{ mt: .7 }}>{description}</Typography>
      </Box>
      {action}
    </Box>
  );
}
