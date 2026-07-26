import { useState } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, type Resolver } from 'react-hook-form';
import { z } from 'zod';
import { Alert, Box, Button, TextField, Typography } from '@mui/material';
import { ArrowForwardRounded, CheckCircleOutlineRounded } from '@mui/icons-material';
import { useAuth } from '../auth/AuthContext';
import { ApiError } from '../api/client';
import { Brand } from '../components/Brand';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { useLanguage } from '../i18n/LanguageContext';

const loginSchema = z.object({
  email: z.string().email('Saisissez une adresse e-mail valide.'),
  password: z.string().min(1, 'Le mot de passe est obligatoire.'),
});

const registerSchema = loginSchema.extend({
  fullName: z.string().min(2, 'Saisissez votre nom complet.'),
  organizationName: z.string().min(2, 'Saisissez le nom du cabinet.'),
  password: z.string().min(10, 'Au moins 10 caractères.').regex(/[A-Z]/, 'Ajoutez une majuscule.').regex(/[a-z]/, 'Ajoutez une minuscule.').regex(/[0-9]/, 'Ajoutez un chiffre.'),
});

type FormValues = z.infer<typeof registerSchema>;

export function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const isRegister = mode === 'register';
  const { t } = useLanguage();
  const { login, register: createAccount } = useAuth();
  const navigate = useNavigate();
  const [apiError, setApiError] = useState('');
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(isRegister ? registerSchema : loginSchema) as unknown as Resolver<FormValues>,
    defaultValues: { fullName: '', organizationName: '', email: '', password: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setApiError('');
    try {
      if (isRegister) await createAccount(values);
      else await login({ email: values.email, password: values.password });
      navigate('/', { replace: true });
    } catch (error) {
      setApiError(error instanceof ApiError ? error.message : t('Impossible de contacter le serveur.'));
    }
  });

  return (
    <main className="auth-page">
      <section className="auth-visual">
        <Brand dark />
        <Box className="auth-visual-copy" sx={{ position: 'relative', zIndex: 1, maxWidth: 560 }}>
          <Typography variant="overline" sx={{ color: '#f2c56b', letterSpacing: '.16em' }}>{t('Conçu pour les cabinets tunisiens')}</Typography>
          <Typography variant="h1" sx={{ mt: 1.5, mb: 3, fontSize: { md: 52, xl: 64 }, lineHeight: 1.02 }}>
            {t('Votre cabinet, enfin réuni au même endroit.')}
          </Typography>
          <Typography sx={{ color: 'rgba(255,255,255,.68)', fontSize: 17, lineHeight: 1.7 }}>
            {t('Dossiers clients, échéances fiscales, production comptable, facturation et rentabilité dans un espace sécurisé.')}
          </Typography>
        </Box>
        <Box sx={{ position: 'relative', zIndex: 1, display: 'grid', gap: 1.4 }}>
          {['Données isolées par cabinet', 'Accès contrôlé selon chaque rôle', 'Règles fiscales tunisiennes versionnées'].map((item) => (
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
        <Box component="form" className="auth-form" onSubmit={onSubmit} noValidate>
          <Typography variant="overline" color="secondary.main" sx={{ fontWeight: 800, letterSpacing: '.14em' }}>{t('Identité et accès')}</Typography>
          <Typography variant="h2" sx={{ mt: 1, mb: 1, fontSize: { xs: 38, sm: 48 } }}>
            {isRegister ? t('Créer votre espace') : t('Bon retour parmi nous')}
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 4 }}>
            {isRegister ? t('Créez le premier compte propriétaire de votre cabinet.') : t('Connectez-vous pour reprendre le travail de votre cabinet.')}
          </Typography>

          {apiError && <Alert severity="error" sx={{ mb: 2 }}>{apiError}</Alert>}
          <Box sx={{ display: 'grid', gap: 2.2 }}>
            {isRegister && <TextField label={t('Nom complet')} autoComplete="name" error={Boolean(errors.fullName)} helperText={errors.fullName?.message} {...register('fullName')} />}
            {isRegister && <TextField label={t('Nom du cabinet')} autoComplete="organization" error={Boolean(errors.organizationName)} helperText={errors.organizationName?.message} {...register('organizationName')} />}
            <TextField label={t('Adresse e-mail')} type="email" autoComplete="email" error={Boolean(errors.email)} helperText={errors.email?.message} {...register('email')} />
            <TextField label={t('Mot de passe')} type="password" autoComplete={isRegister ? 'new-password' : 'current-password'} error={Boolean(errors.password)} helperText={errors.password?.message} {...register('password')} />
            <Button type="submit" variant="contained" size="large" disabled={isSubmitting} endIcon={<ArrowForwardRounded />}>
              {isSubmitting ? t('Connexion…') : isRegister ? t('Créer mon cabinet') : t('Se connecter')}
            </Button>
          </Box>
          <Typography color="text.secondary" sx={{ mt: 3, textAlign: 'center' }}>
            {isRegister ? `${t('Vous avez déjà un compte ?')} ` : `${t('Nouveau cabinet ?')} `}
            <RouterLink to={isRegister ? '/connexion' : '/inscription'} style={{ color: '#145a46', fontWeight: 700 }}>
              {isRegister ? t('Se connecter') : t('Créer un espace')}
            </RouterLink>
          </Typography>
        </Box>
      </section>
    </main>
  );
}
