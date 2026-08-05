import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, type Resolver } from 'react-hook-form';
import { z } from 'zod';
import { Alert, Box, Button, TextField, Typography } from '@mui/material';
import { ArrowForwardRounded, CheckCircleOutlineRounded } from '@mui/icons-material';
import { api, ApiError } from '../api/client';
import { Brand } from '../components/Brand';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { useLanguage } from '../i18n/LanguageContext';

const requestSchema = z.object({
  email: z.string().email('Saisissez une adresse e-mail valide.'),
});

const confirmSchema = z.object({
  newPassword: z
    .string()
    .min(10, 'Au moins 10 caractères.')
    .regex(/[A-Z]/, 'Ajoutez une majuscule.')
    .regex(/[a-z]/, 'Ajoutez une minuscule.')
    .regex(/[0-9]/, 'Ajoutez un chiffre.'),
});

type RequestValues = z.infer<typeof requestSchema>;
type ConfirmValues = z.infer<typeof confirmSchema>;

export function PasswordResetRequestPage() {
  const { t } = useLanguage();
  const [apiError, setApiError] = useState('');
  const [message, setMessage] = useState('');
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<RequestValues>({
    resolver: zodResolver(requestSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setApiError('');
    setMessage('');
    try {
      const response = await api.post<{ message: string }>('/api/auth/password-reset/request', values);
      setMessage(response.message);
    } catch (error) {
      setApiError(error instanceof ApiError ? error.message : t('Impossible de contacter le serveur.'));
    }
  });

  return (
    <PasswordResetLayout
      title={t('Réinitialiser le mot de passe')}
      subtitle={t('Entrez votre adresse e-mail. Si le compte existe, nous vous envoyons un lien sécurisé.')}
    >
      {message && <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert>}
      {apiError && <Alert severity="error" sx={{ mb: 2 }}>{apiError}</Alert>}
      <Box component="form" onSubmit={onSubmit} noValidate sx={{ display: 'grid', gap: 2.2 }}>
        <TextField
          label={t('Adresse e-mail')}
          type="email"
          autoComplete="email"
          error={Boolean(errors.email)}
          helperText={errors.email?.message}
          {...register('email')}
        />
        <Button type="submit" variant="contained" size="large" disabled={isSubmitting} endIcon={<ArrowForwardRounded />}>
          {isSubmitting ? t('Envoi…') : t('Envoyer le lien')}
        </Button>
      </Box>
      <BackToLogin />
    </PasswordResetLayout>
  );
}

export function PasswordResetConfirmPage() {
  const { token = '' } = useParams();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [apiError, setApiError] = useState('');
  const [message, setMessage] = useState('');
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<ConfirmValues>({
    resolver: zodResolver(confirmSchema) as Resolver<ConfirmValues>,
    defaultValues: { newPassword: '' },
  });

  const isTokenMissing = useMemo(() => token.trim().length < 20, [token]);

  const onSubmit = handleSubmit(async (values) => {
    setApiError('');
    setMessage('');
    try {
      const response = await api.post<{ message: string }>('/api/auth/password-reset/confirm', {
        token,
        newPassword: values.newPassword,
      });
      setMessage(response.message);
      window.setTimeout(() => navigate('/connexion', { replace: true }), 1400);
    } catch (error) {
      setApiError(error instanceof ApiError ? error.message : t('Impossible de contacter le serveur.'));
    }
  });

  return (
    <PasswordResetLayout
      title={t('Choisir un nouveau mot de passe')}
      subtitle={t('Utilisez un mot de passe fort. Toutes les sessions ouvertes seront déconnectées.')}
    >
      {isTokenMissing && <Alert severity="error" sx={{ mb: 2 }}>{t('Le lien de réinitialisation est incomplet.')}</Alert>}
      {message && <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert>}
      {apiError && <Alert severity="error" sx={{ mb: 2 }}>{apiError}</Alert>}
      <Box component="form" onSubmit={onSubmit} noValidate sx={{ display: 'grid', gap: 2.2 }}>
        <TextField
          label={t('Nouveau mot de passe')}
          type="password"
          autoComplete="new-password"
          disabled={isTokenMissing}
          error={Boolean(errors.newPassword)}
          helperText={errors.newPassword?.message}
          {...register('newPassword')}
        />
        <Button type="submit" variant="contained" size="large" disabled={isSubmitting || isTokenMissing} endIcon={<ArrowForwardRounded />}>
          {isSubmitting ? t('Validation…') : t('Réinitialiser')}
        </Button>
      </Box>
      <BackToLogin />
    </PasswordResetLayout>
  );
}

function PasswordResetLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  const { t } = useLanguage();
  return (
    <main className="auth-page">
      <section className="auth-visual">
        <Brand dark />
        <Box className="auth-visual-copy" sx={{ position: 'relative', zIndex: 1, maxWidth: 560 }}>
          <Typography variant="overline" sx={{ color: '#f2c56b', letterSpacing: '.16em' }}>{t('Sécurité Fiscora')}</Typography>
          <Typography variant="h1" sx={{ mt: 1.5, mb: 3, fontSize: { md: 52, xl: 64 }, lineHeight: 1.02 }}>
            {t('Un accès propre, sans stress.')}
          </Typography>
          <Typography sx={{ color: 'rgba(255,255,255,.68)', fontSize: 17, lineHeight: 1.7 }}>
            {t('Le lien envoyé par e-mail est personnel, limité dans le temps et utilisable une seule fois.')}
          </Typography>
        </Box>
        <Box sx={{ position: 'relative', zIndex: 1, display: 'grid', gap: 1.4 }}>
          {['Lien temporaire', 'Jeton stocké sous forme hachée', 'Déconnexion des anciennes sessions'].map((item) => (
            <Box key={item} sx={{ display: 'flex', alignItems: 'center', gap: 1.2, color: 'rgba(255,255,255,.76)' }}>
              <CheckCircleOutlineRounded sx={{ color: '#f2c56b', fontSize: 20 }} />
              <Typography variant="body2">{t(item)}</Typography>
            </Box>
          ))}
        </Box>
      </section>

      <section className="auth-form-wrap">
        <Box sx={{ position: 'absolute', insetBlockStart: 24, insetInlineEnd: 24 }}>
          <LanguageSwitcher />
        </Box>
        <Box className="auth-form">
          <Typography variant="overline" color="secondary.main" sx={{ fontWeight: 800, letterSpacing: '.14em' }}>
            {t('Identité et accès')}
          </Typography>
          <Typography variant="h2" sx={{ mt: 1, mb: 1, fontSize: { xs: 38, sm: 48 } }}>
            {title}
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 4 }}>
            {subtitle}
          </Typography>
          {children}
        </Box>
      </section>
    </main>
  );
}

function BackToLogin() {
  const { t } = useLanguage();
  return (
    <Typography color="text.secondary" sx={{ mt: 3, textAlign: 'center' }}>
      <RouterLink to="/connexion" style={{ color: '#145a46', fontWeight: 700 }}>
        {t('Retour à la connexion')}
      </RouterLink>
    </Typography>
  );
}
