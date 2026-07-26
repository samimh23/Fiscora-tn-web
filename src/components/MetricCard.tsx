import { Box, Card, CardContent, Skeleton, Typography, type SvgIconProps } from '@mui/material';
import type { ElementType } from 'react';

export function MetricCard({ label, value, hint, icon: Icon, color = '#145a46', loading = false }: { label: string; value: string | number; hint: string; icon: ElementType<SvgIconProps>; color?: string; loading?: boolean }) {
  return (
    <Card>
      <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 650 }}>{label}</Typography>
            {loading ? <Skeleton width={90} height={45} /> : <Typography sx={{ fontFamily: 'Georgia, serif', fontSize: 32, mt: .6, lineHeight: 1.2 }}>{value}</Typography>}
          </Box>
          <Box sx={{ width: 42, height: 42, borderRadius: 2.5, display: 'grid', placeItems: 'center', bgcolor: `${color}16`, color }}><Icon /></Box>
        </Box>
        <Typography variant="caption" color="text.secondary">{hint}</Typography>
      </CardContent>
    </Card>
  );
}
