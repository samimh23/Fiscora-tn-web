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
import type { DossierAssignment, OrganizationMember } from '../../types/api';

const assignmentSchema = z.object({
  membershipId: z.string().uuid('Sélectionnez un collaborateur.'),
  assignmentRole: z.enum(['RESPONSABLE', 'SUPPORT']),
  monthlyTimeBudgetHours: z.number().min(0).max(1666),
  isActive: z.boolean(),
});

type AssignmentFormValues = z.infer<typeof assignmentSchema>;

export function AssignmentDialog({ open, onClose, organizationId, dossierId, members, assignment }: {
  open: boolean;
  onClose: () => void;
  organizationId: string;
  dossierId: string;
  members: OrganizationMember[];
  assignment?: DossierAssignment | null;
}) {
  const queryClient = useQueryClient();
  const [apiError, setApiError] = useState('');
  const editing = Boolean(assignment);
  const { control, register, reset, handleSubmit, formState: { errors } } = useForm<AssignmentFormValues>({
    resolver: zodResolver(assignmentSchema),
    defaultValues: { membershipId: '', assignmentRole: 'SUPPORT', monthlyTimeBudgetHours: 0, isActive: true },
  });

  useEffect(() => {
    if (!open) return;
    reset(assignment ? {
      membershipId: assignment.membershipId,
      assignmentRole: assignment.assignmentRole,
      monthlyTimeBudgetHours: (assignment.monthlyTimeBudgetMinutes ?? 0) / 60,
      isActive: assignment.isActive,
    } : { membershipId: '', assignmentRole: 'SUPPORT', monthlyTimeBudgetHours: 0, isActive: true });
    setApiError('');
  }, [assignment, open, reset]);

  const mutation = useMutation({
    mutationFn: (values: AssignmentFormValues) => api.put<DossierAssignment>(
      `/api/organizations/${organizationId}/dossiers/${dossierId}/assignments/${values.membershipId}`,
      {
        assignmentRole: values.assignmentRole,
        monthlyTimeBudgetMinutes: Math.round(values.monthlyTimeBudgetHours * 60),
        isActive: values.isActive,
      },
    ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['dossier-assignments', organizationId, dossierId] });
      onClose();
    },
    onError: (error) => setApiError(error instanceof ApiError ? error.message : 'Impossible d’enregistrer l’affectation.'),
  });

  return (
    <Dialog open={open} onClose={mutation.isPending ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle><Typography variant="h3" sx={{ fontSize: 28 }}>{editing ? 'Modifier l’affectation' : 'Affecter un collaborateur'}</Typography></DialogTitle>
      <DialogContent dividers>
        {apiError && <Alert severity="error" sx={{ mb: 2 }}>{apiError}</Alert>}
        <Box component="form" id="assignment-form" onSubmit={handleSubmit((values) => mutation.mutate(values))} sx={{ display: 'grid', gap: 2 }}>
          <Controller name="membershipId" control={control} render={({ field }) => <TextField select label="Collaborateur" disabled={editing} error={Boolean(errors.membershipId)} helperText={errors.membershipId?.message} {...field}>{members.filter((member) => member.isActive || member.membershipId === assignment?.membershipId).map((member) => <MenuItem key={member.membershipId} value={member.membershipId}>{member.fullName} · {member.role}</MenuItem>)}</TextField>} />
          <Controller name="assignmentRole" control={control} render={({ field }) => <TextField select label="Rôle sur le dossier" {...field}><MenuItem value="RESPONSABLE">Responsable</MenuItem><MenuItem value="SUPPORT">Support</MenuItem></TextField>} />
          <TextField type="number" label="Budget mensuel (heures)" slotProps={{ htmlInput: { min: 0, step: 0.25 } }} error={Boolean(errors.monthlyTimeBudgetHours)} helperText={errors.monthlyTimeBudgetHours?.message ?? 'Utilisé pour suivre la charge et la rentabilité du dossier.'} {...register('monthlyTimeBudgetHours', { valueAsNumber: true })} />
          {editing && <Controller name="isActive" control={control} render={({ field }) => <FormControlLabel control={<Switch checked={field.value} onChange={(_, value) => field.onChange(value)} />} label="Affectation active" />} />}
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}><Button onClick={onClose} disabled={mutation.isPending}>Annuler</Button><Button type="submit" form="assignment-form" variant="contained" disabled={mutation.isPending}>{mutation.isPending ? 'Enregistrement…' : 'Enregistrer l’affectation'}</Button></DialogActions>
    </Dialog>
  );
}
