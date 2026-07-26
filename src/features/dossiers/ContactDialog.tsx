import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControlLabel, Switch, TextField, Typography,
} from '@mui/material';
import { api, ApiError } from '../../api/client';
import type { DossierContact } from '../../types/api';

const contactSchema = z.object({
  fullName: z.string().min(2, 'Le nom complet est obligatoire.').max(160),
  role: z.string().max(120),
  phone: z.string().max(50),
  email: z.string().refine((value) => !value || z.string().email().safeParse(value).success, 'Adresse e-mail invalide.'),
  whatsappNumber: z.string().max(50),
  isPrimary: z.boolean(),
  isActive: z.boolean(),
});

type ContactFormValues = z.infer<typeof contactSchema>;
const emptyContact: ContactFormValues = { fullName: '', role: '', phone: '', email: '', whatsappNumber: '', isPrimary: false, isActive: true };

export function ContactDialog({ open, onClose, organizationId, dossierId, contact }: {
  open: boolean;
  onClose: () => void;
  organizationId: string;
  dossierId: string;
  contact?: DossierContact | null;
}) {
  const queryClient = useQueryClient();
  const [apiError, setApiError] = useState('');
  const editing = Boolean(contact);
  const { register, control, reset, handleSubmit, formState: { errors } } = useForm<ContactFormValues>({ resolver: zodResolver(contactSchema), defaultValues: emptyContact });

  useEffect(() => {
    if (!open) return;
    reset(contact ? {
      fullName: contact.fullName,
      role: contact.role ?? '',
      phone: contact.phone ?? '',
      email: contact.email ?? '',
      whatsappNumber: contact.whatsappNumber ?? '',
      isPrimary: contact.isPrimary,
      isActive: contact.isActive,
    } : emptyContact);
    setApiError('');
  }, [contact, open, reset]);

  const mutation = useMutation({
    mutationFn: (values: ContactFormValues) => {
      const clean = (value: string) => value.trim() || null;
      const payload = { ...values, role: clean(values.role), phone: clean(values.phone), email: clean(values.email), whatsappNumber: clean(values.whatsappNumber) };
      return editing
        ? api.patch<DossierContact>(`/api/organizations/${organizationId}/dossiers/${dossierId}/contacts/${contact?.id}`, payload)
        : api.post<DossierContact>(`/api/organizations/${organizationId}/dossiers/${dossierId}/contacts`, {
            fullName: payload.fullName,
            role: payload.role,
            phone: payload.phone,
            email: payload.email,
            whatsappNumber: payload.whatsappNumber,
            isPrimary: payload.isPrimary,
          });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['dossier-contacts', organizationId, dossierId] });
      onClose();
    },
    onError: (error) => setApiError(error instanceof ApiError ? error.message : 'Impossible d’enregistrer le contact.'),
  });

  return (
    <Dialog open={open} onClose={mutation.isPending ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle><Typography variant="h3" sx={{ fontSize: 28 }}>{editing ? 'Modifier le contact' : 'Ajouter un contact'}</Typography></DialogTitle>
      <DialogContent dividers>
        {apiError && <Alert severity="error" sx={{ mb: 2 }}>{apiError}</Alert>}
        <Box component="form" id="contact-form" onSubmit={handleSubmit((values) => mutation.mutate(values))} sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' }, gap: 2 }}>
          <TextField label="Nom complet" sx={{ gridColumn: { sm: 'span 2' } }} error={Boolean(errors.fullName)} helperText={errors.fullName?.message} {...register('fullName')} />
          <TextField label="Fonction" placeholder="Gérant, DAF…" {...register('role')} />
          <TextField label="Téléphone" {...register('phone')} />
          <TextField label="Adresse e-mail" type="email" error={Boolean(errors.email)} helperText={errors.email?.message} {...register('email')} />
          <TextField label="WhatsApp" {...register('whatsappNumber')} />
          <Controller name="isPrimary" control={control} render={({ field }) => <FormControlLabel control={<Switch checked={field.value} onChange={(_, value) => field.onChange(value)} />} label="Contact principal" />} />
          {editing && <Controller name="isActive" control={control} render={({ field }) => <FormControlLabel control={<Switch checked={field.value} onChange={(_, value) => field.onChange(value)} />} label="Contact actif" />} />}
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}><Button onClick={onClose} disabled={mutation.isPending}>Annuler</Button><Button type="submit" form="contact-form" variant="contained" disabled={mutation.isPending}>{mutation.isPending ? 'Enregistrement…' : 'Enregistrer'}</Button></DialogActions>
    </Dialog>
  );
}
