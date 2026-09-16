import { useEffect, useRef, useState } from 'react';
import { Alert, Box, CircularProgress } from '@mui/material';
import { useLanguage } from '../i18n/LanguageContext';

const GOOGLE_SCRIPT_ID = 'google-identity-services';
const GOOGLE_CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '').trim();

let scriptPromise: Promise<void> | null = null;
let initializedClientId = '';
let currentCredentialHandler:
  | ((response: GoogleCredentialResponse) => void)
  | null = null;

function loadGoogleIdentityServices() {
  if (window.google?.accounts.id) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.getElementById(
      GOOGLE_SCRIPT_ID,
    ) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error()), {
        once: true,
      });
      return;
    }

    const script = document.createElement('script');
    script.id = GOOGLE_SCRIPT_ID;
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error());
    document.head.appendChild(script);
  });
  return scriptPromise;
}

function initializeGoogle(clientId: string) {
  if (!window.google?.accounts.id || initializedClientId === clientId) return;
  window.google.accounts.id.initialize({
    client_id: clientId,
    ux_mode: 'popup',
    auto_select: false,
    cancel_on_tap_outside: true,
    callback: (response) => currentCredentialHandler?.(response),
  });
  initializedClientId = clientId;
}

export function GoogleSignInButton({
  disabled,
  onCredential,
}: {
  disabled?: boolean;
  onCredential: (credential: string) => void | Promise<void>;
}) {
  const { language, t } = useLanguage();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    let active = true;
    setLoadFailed(false);
    setIsReady(false);
    currentCredentialHandler = (response) => {
      if (active && response.credential) void onCredential(response.credential);
    };

    void loadGoogleIdentityServices()
      .then(() => {
        if (!active || !containerRef.current || !window.google?.accounts.id)
          return;
        initializeGoogle(GOOGLE_CLIENT_ID);
        containerRef.current.replaceChildren();
        window.google.accounts.id.renderButton(containerRef.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'rectangular',
          logo_alignment: 'left',
          width: Math.min(400, containerRef.current.clientWidth || 400),
          locale: language === 'ar' ? 'ar' : 'fr',
        });
        setIsReady(true);
      })
      .catch(() => {
        if (!active) return;
        setIsReady(false);
        setLoadFailed(true);
      });

    return () => {
      active = false;
      if (currentCredentialHandler) currentCredentialHandler = null;
    };
  }, [language, onCredential]);

  if (!GOOGLE_CLIENT_ID) return null;
  if (loadFailed) {
    return (
      <Alert severity="warning">
        {t('La connexion Google est temporairement indisponible.')}
      </Alert>
    );
  }

  return (
    <Box
      sx={{
        minHeight: 44,
        position: 'relative',
        opacity: disabled ? 0.55 : 1,
        pointerEvents: disabled ? 'none' : 'auto',
        '& > div': { width: '100%' },
        '& iframe': { margin: '0 auto !important' },
      }}
    >
      <Box ref={containerRef} sx={{ display: 'flex', justifyContent: 'center' }} />
      {!isReady && (
        <CircularProgress
          size={22}
          sx={{ position: 'absolute', inset: 0, margin: 'auto' }}
        />
      )}
    </Box>
  );
}
