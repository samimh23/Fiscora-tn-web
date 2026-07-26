import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { Alert, Box, Button, Card, CardContent, Chip, InputAdornment, Pagination, Skeleton, TextField, Typography } from '@mui/material';
import { AddRounded, ArrowForwardRounded, SearchRounded } from '@mui/icons-material';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { PageHeader } from '../components/PageHeader';
import { DossierFormDialog } from '../features/dossiers/DossierFormDialog';
import { dossierStatusLabels, legalFormLabel, taxRegimeLabel } from '../features/dossiers/options';
import type { DossierSummary, PagedResponse } from '../types/api';

export function DossiersPage() {
  const { organization, can } = useAuth();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const navigate = useNavigate();
  const query = useQuery({
    queryKey: ['dossiers', organization?.id, search, page],
    queryFn: () => api.get<PagedResponse<DossierSummary>>(`/api/organizations/${organization?.id}/dossiers?page=${page}&pageSize=10&search=${encodeURIComponent(search)}`),
    enabled: Boolean(organization?.id),
  });

  return (
    <>
      <PageHeader eyebrow="Portefeuille clients" title="Dossiers clients" description="Suivez les informations, obligations, pièces et travaux de chaque client." action={<Button variant="contained" startIcon={<AddRounded />} disabled={!can('dossiers.create')} onClick={() => setCreateOpen(true)}>Nouveau dossier</Button>} />
      <Card>
        <CardContent sx={{ p: 0 }}>
          <Box sx={{ p: 2.5, display: 'flex', gap: 2, alignItems: 'center', justifyContent: 'space-between' }}>
            <TextField size="small" placeholder="Nom, matricule fiscal ou RNE…" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} sx={{ width: { xs: '100%', sm: 420 } }} slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchRounded /></InputAdornment> } }} />
            <Typography variant="body2" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' } }}>{query.data?.total ?? 0} dossier(s)</Typography>
          </Box>
          {query.isError && <Alert severity="error" sx={{ mx: 2.5, mb: 2 }}>Impossible de charger les dossiers.</Alert>}
          {query.isLoading && <Box sx={{ px: 2.5, pb: 2.5 }}><Skeleton height={65} /><Skeleton height={65} /><Skeleton height={65} /></Box>}
          {!query.isLoading && !query.data?.items.length && <Box sx={{ p: 7, textAlign: 'center' }}><Typography variant="h3" sx={{ fontSize: 24 }}>Aucun dossier trouvé</Typography><Typography color="text.secondary" sx={{ mt: 1 }}>Créez votre premier dossier client ou modifiez la recherche.</Typography></Box>}
          {query.data?.items.map((item) => (
            <Box key={item.id} className="data-row" sx={{ px: 3, py: 2, borderTop: '1px solid', borderColor: 'divider', '&:hover': { bgcolor: '#faf8f2' } }}>
              <Box sx={{ minWidth: 0 }}><Typography noWrap sx={{ fontWeight: 750 }}>{item.legalName}</Typography><Typography variant="body2" color="text.secondary" noWrap>{item.taxIdentifier || 'Matricule fiscal non renseigné'} {item.tradeName ? `· ${item.tradeName}` : ''}</Typography></Box>
              <Box><Typography variant="caption" color="text.secondary">Forme</Typography><Typography variant="body2" sx={{ fontWeight: 650 }}>{legalFormLabel(item.legalForm)}</Typography></Box>
              <Box><Typography variant="caption" color="text.secondary">Régime</Typography><Typography variant="body2" sx={{ fontWeight: 650 }}>{taxRegimeLabel(item.taxRegime)}</Typography></Box>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1 }}><Chip label={dossierStatusLabels[item.status] ?? item.status} size="small" color={item.status === 'ACTIF' ? 'success' : item.status === 'SUSPENDU' ? 'warning' : 'default'} variant="outlined" /><Button component={RouterLink} to={`/dossiers/${item.id}`} size="small" endIcon={<ArrowForwardRounded />}>Ouvrir</Button></Box>
            </Box>
          ))}
          {(query.data?.total ?? 0) > 10 && <Box sx={{ p: 2.5, borderTop: '1px solid', borderColor: 'divider', display: 'flex', justifyContent: 'center' }}><Pagination count={Math.ceil((query.data?.total ?? 0) / 10)} page={page} onChange={(_, value) => setPage(value)} /></Box>}
        </CardContent>
      </Card>
      {organization?.id && <DossierFormDialog open={createOpen} onClose={() => setCreateOpen(false)} organizationId={organization.id} onSaved={(saved) => navigate(`/dossiers/${saved.id}`)} />}
    </>
  );
}
