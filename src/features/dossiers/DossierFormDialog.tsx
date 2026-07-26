import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControlLabel, MenuItem, Switch, TextField, Typography,
} from '@mui/material';
import { api, ApiError } from '../../api/client';
import type { DossierSummary } from '../../types/api';
import { billingFrequencyOptions, legalFormOptions, taxRegimeOptions } from './options';

const money = z.string().refine((value) => !value || /^\d{1,12}(\.\d{1,3})?$/.test(value), 'Montant invalide (3 décimales maximum).');
const dossierSchema = z.object({
  legalName: z.string().min(2, 'La raison sociale est obligatoire.').max(200),
  tradeName: z.string().max(200),
  taxIdentifier: z.string().max(100),
  rneNumber: z.string().max(100),
  vatCode: z.string().max(50),
  customsCode: z.string().max(100),
  legalForm: z.string().min(1),
  taxRegime: z.string().min(1),
  isVatSubject: z.boolean(),
  hasVatSuspension: z.boolean(),
  isTotallyExporting: z.boolean(),
  activitySector: z.string().max(200),
  cnssEmployerNumber: z.string().max(100),
  employeeCount: z.number().int().min(0).max(1_000_000),
  fiscalYearStartMonth: z.number().int().min(1).max(12),
  fiscalYearStartDay: z.number().int().min(1).max(31),
  monthlyFee: money,
  annualFee: money,
  billingFrequency: z.string().min(1),
  internalNotes: z.string().max(10_000),
  tags: z.string(),
  status: z.enum(['ACTIF', 'SUSPENDU']),
});

type DossierFormValues = z.infer<typeof dossierSchema>;

const emptyValues: DossierFormValues = {
  legalName: '', tradeName: '', taxIdentifier: '', rneNumber: '', vatCode: '', customsCode: '',
  legalForm: 'SARL', taxRegime: 'REEL', isVatSubject: true, hasVatSuspension: false,
  isTotallyExporting: false, activitySector: '', cnssEmployerNumber: '', employeeCount: 0,
  fiscalYearStartMonth: 1, fiscalYearStartDay: 1, monthlyFee: '', annualFee: '',
  billingFrequency: 'MENSUELLE', internalNotes: '', tags: '', status: 'ACTIF',
};

function valuesFromDossier(dossier?: DossierSummary | null): DossierFormValues {
  if (!dossier) return emptyValues;
  return {
    legalName: dossier.legalName,
    tradeName: dossier.tradeName ?? '',
    taxIdentifier: dossier.taxIdentifier ?? '',
    rneNumber: dossier.rneNumber ?? '',
    vatCode: dossier.vatCode ?? '',
    customsCode: dossier.customsCode ?? '',
    legalForm: dossier.legalForm,
    taxRegime: dossier.taxRegime,
    isVatSubject: dossier.isVatSubject,
    hasVatSuspension: dossier.hasVatSuspension ?? false,
    isTotallyExporting: dossier.isTotallyExporting ?? false,
    activitySector: dossier.activitySector ?? '',
    cnssEmployerNumber: dossier.cnssEmployerNumber ?? '',
    employeeCount: dossier.employeeCount ?? 0,
    fiscalYearStartMonth: dossier.fiscalYearStartMonth ?? 1,
    fiscalYearStartDay: dossier.fiscalYearStartDay ?? 1,
    monthlyFee: dossier.monthlyFee ?? '',
    annualFee: dossier.annualFee ?? '',
    billingFrequency: dossier.billingFrequency ?? 'MENSUELLE',
    internalNotes: dossier.internalNotes ?? '',
    tags: dossier.tags.join(', '),
    status: dossier.status === 'SUSPENDU' ? 'SUSPENDU' : 'ACTIF',
  };
}

export function DossierFormDialog({ open, onClose, organizationId, dossier, onSaved }: {
  open: boolean;
  onClose: () => void;
  organizationId: string;
  dossier?: DossierSummary | null;
  onSaved?: (saved: DossierSummary) => void;
}) {
  const queryClient = useQueryClient();
  const [apiError, setApiError] = useState('');
  const editing = Boolean(dossier);
  const { register, control, handleSubmit, reset, formState: { errors } } = useForm<DossierFormValues>({
    resolver: zodResolver(dossierSchema),
    defaultValues: valuesFromDossier(dossier),
  });

  useEffect(() => {
    if (open) {
      reset(valuesFromDossier(dossier));
      setApiError('');
    }
  }, [dossier, open, reset]);

  const mutation = useMutation({
    mutationFn: (values: DossierFormValues) => {
      const nullable = (value: string) => value.trim() || null;
      const payload = {
        ...values,
        tradeName: nullable(values.tradeName),
        taxIdentifier: nullable(values.taxIdentifier),
        rneNumber: nullable(values.rneNumber),
        vatCode: nullable(values.vatCode),
        customsCode: nullable(values.customsCode),
        activitySector: nullable(values.activitySector),
        cnssEmployerNumber: nullable(values.cnssEmployerNumber),
        monthlyFee: nullable(values.monthlyFee),
        annualFee: nullable(values.annualFee),
        internalNotes: nullable(values.internalNotes),
        tags: values.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
        ...(editing ? {} : { status: undefined }),
      };
      return editing
        ? api.patch<DossierSummary>(`/api/organizations/${organizationId}/dossiers/${dossier?.id}`, payload)
        : api.post<DossierSummary>(`/api/organizations/${organizationId}/dossiers`, payload);
    },
    onSuccess: async (saved) => {
      await queryClient.invalidateQueries({ queryKey: ['dossiers', organizationId] });
      await queryClient.invalidateQueries({ queryKey: ['dossier', organizationId, saved.id] });
      onSaved?.(saved);
      onClose();
    },
    onError: (error) => setApiError(error instanceof ApiError ? error.message : 'Impossible d’enregistrer le dossier.'),
  });

  return (
    <Dialog open={open} onClose={mutation.isPending ? undefined : onClose} fullWidth maxWidth="md">
      <DialogTitle sx={{ pb: 1 }}>
        <Typography variant="overline" color="secondary.main" sx={{ fontWeight: 800, letterSpacing: '.12em' }}>{editing ? 'Mise à jour' : 'Nouveau client'}</Typography>
        <Typography variant="h3" sx={{ fontSize: 30 }}>{editing ? 'Modifier le dossier' : 'Créer un dossier client'}</Typography>
      </DialogTitle>
      <DialogContent dividers>
        {apiError && <Alert severity="error" sx={{ mb: 2 }}>{apiError}</Alert>}
        <Box component="form" id="dossier-form" onSubmit={handleSubmit((values) => mutation.mutate(values))} sx={{ display: 'grid', gap: 3 }}>
          <Box>
            <Typography sx={{ fontWeight: 800, mb: 1.5 }}>Identité juridique</Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' }, gap: 2 }}>
              <TextField label="Raison sociale" error={Boolean(errors.legalName)} helperText={errors.legalName?.message} {...register('legalName')} />
              <TextField label="Nom commercial" {...register('tradeName')} />
              <TextField label="Matricule fiscal" {...register('taxIdentifier')} />
              <TextField label="Numéro RNE" {...register('rneNumber')} />
              <Controller name="legalForm" control={control} render={({ field }) => <TextField select label="Forme juridique" {...field}>{legalFormOptions.map((item) => <MenuItem key={item.value} value={item.value}>{item.label}</MenuItem>)}</TextField>} />
              <Controller name="taxRegime" control={control} render={({ field }) => <TextField select label="Régime fiscal" {...field}>{taxRegimeOptions.map((item) => <MenuItem key={item.value} value={item.value}>{item.label}</MenuItem>)}</TextField>} />
              <TextField label="Code TVA" {...register('vatCode')} />
              <TextField label="Code en douane" {...register('customsCode')} />
              <TextField label="Secteur d’activité" {...register('activitySector')} />
              <TextField label="Matricule employeur CNSS" {...register('cnssEmployerNumber')} />
            </Box>
          </Box>

          <Box>
            <Typography sx={{ fontWeight: 800, mb: 1 }}>Situation fiscale</Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: { xs: 1, sm: 3 } }}>
              <Controller name="isVatSubject" control={control} render={({ field }) => <FormControlLabel control={<Switch checked={field.value} onChange={(_, value) => field.onChange(value)} />} label="Assujetti à la TVA" />} />
              <Controller name="hasVatSuspension" control={control} render={({ field }) => <FormControlLabel control={<Switch checked={field.value} onChange={(_, value) => field.onChange(value)} />} label="Suspension de TVA" />} />
              <Controller name="isTotallyExporting" control={control} render={({ field }) => <FormControlLabel control={<Switch checked={field.value} onChange={(_, value) => field.onChange(value)} />} label="Totalement exportateur" />} />
            </Box>
          </Box>

          <Box>
            <Typography sx={{ fontWeight: 800, mb: 1.5 }}>Gestion du dossier</Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 2 }}>
              <TextField type="number" label="Nombre de salariés" error={Boolean(errors.employeeCount)} {...register('employeeCount', { valueAsNumber: true })} />
              <TextField type="number" label="Mois début exercice" error={Boolean(errors.fiscalYearStartMonth)} {...register('fiscalYearStartMonth', { valueAsNumber: true })} />
              <TextField type="number" label="Jour début exercice" error={Boolean(errors.fiscalYearStartDay)} {...register('fiscalYearStartDay', { valueAsNumber: true })} />
              <TextField label="Honoraires mensuels (TND)" error={Boolean(errors.monthlyFee)} helperText={errors.monthlyFee?.message} {...register('monthlyFee')} />
              <TextField label="Honoraires annuels (TND)" error={Boolean(errors.annualFee)} helperText={errors.annualFee?.message} {...register('annualFee')} />
              <Controller name="billingFrequency" control={control} render={({ field }) => <TextField select label="Fréquence de facturation" {...field}>{billingFrequencyOptions.map((item) => <MenuItem key={item.value} value={item.value}>{item.label}</MenuItem>)}</TextField>} />
              {editing && <Controller name="status" control={control} render={({ field }) => <TextField select label="Statut" {...field}><MenuItem value="ACTIF">Actif</MenuItem><MenuItem value="SUSPENDU">Suspendu</MenuItem></TextField>} />}
              <TextField label="Étiquettes" placeholder="TVA, paie, export…" helperText="Séparez les étiquettes par une virgule." sx={{ gridColumn: { sm: editing ? 'span 2' : 'span 3' } }} {...register('tags')} />
              <TextField label="Notes internes" multiline minRows={3} sx={{ gridColumn: { sm: 'span 3' } }} {...register('internalNotes')} />
            </Box>
          </Box>
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} disabled={mutation.isPending}>Annuler</Button>
        <Button type="submit" form="dossier-form" variant="contained" disabled={mutation.isPending}>{mutation.isPending ? 'Enregistrement…' : editing ? 'Enregistrer les modifications' : 'Créer le dossier'}</Button>
      </DialogActions>
    </Dialog>
  );
}
