import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api, readSession, saveSession, SESSION_CHANGED_EVENT } from '../api/client';
import type { AuthResponse, OrganizationSummary } from '../types/api';

const ORGANIZATION_KEY = 'compta-tn.organization';

interface LoginInput {
  email: string;
  password: string;
}

interface RegisterInput extends LoginInput {
  fullName: string;
  organizationName: string;
}

interface AuthContextValue {
  session: AuthResponse | null;
  isAuthenticated: boolean;
  isBooting: boolean;
  organization: OrganizationSummary | null;
  selectOrganization: (id: string) => void;
  can: (permission: string) => boolean;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSessionState] = useState<AuthResponse | null>(() => readSession());
  const [organizationId, setOrganizationId] = useState(() => localStorage.getItem(ORGANIZATION_KEY));
  const [isBooting, setIsBooting] = useState(Boolean(readSession()));

  const setSession = useCallback((next: AuthResponse | null) => {
    saveSession(next);
    setSessionState(next);
  }, []);

  useEffect(() => {
    const sync = () => setSessionState(readSession());
    window.addEventListener(SESSION_CHANGED_EVENT, sync);
    return () => window.removeEventListener(SESSION_CHANGED_EVENT, sync);
  }, []);

  useEffect(() => {
    const current = readSession();
    if (!current) {
      setIsBooting(false);
      return;
    }
    api
      .get<{ id: string; email: string; fullName: string; organizations: OrganizationSummary[] }>('/api/auth/me')
      .then((me) => {
        const latest = readSession();
        if (!latest) return;
        setSession({
          ...latest,
          user: { ...latest.user, id: me.id, email: me.email, fullName: me.fullName },
          organizations: me.organizations,
        });
      })
      .catch(() => setSession(null))
      .finally(() => setIsBooting(false));
  }, [setSession]);

  useEffect(() => {
    if (!session?.organizations.length) return;
    const stillExists = session.organizations.some((item) => item.id === organizationId);
    if (!stillExists) {
      const first = session.organizations[0].id;
      setOrganizationId(first);
      localStorage.setItem(ORGANIZATION_KEY, first);
    }
  }, [organizationId, session]);

  const organization = useMemo(
    () => session?.organizations.find((item) => item.id === organizationId) ?? session?.organizations[0] ?? null,
    [organizationId, session],
  );

  const selectOrganization = useCallback((id: string) => {
    setOrganizationId(id);
    localStorage.setItem(ORGANIZATION_KEY, id);
  }, []);

  const login = useCallback(async (input: LoginInput) => {
    const response = await api.post<AuthResponse>('/api/auth/login', input);
    setSession(response);
  }, [setSession]);

  const register = useCallback(async (input: RegisterInput) => {
    const response = await api.post<AuthResponse>('/api/auth/register', input);
    setSession(response);
  }, [setSession]);

  const logout = useCallback(async () => {
    const current = readSession();
    if (current?.refreshToken) {
      try {
        await api.post<void>('/api/auth/revoke', { refreshToken: current.refreshToken });
      } catch {
        // Local logout must still work if the API is temporarily unavailable.
      }
    }
    setSession(null);
  }, [setSession]);

  const value = useMemo<AuthContextValue>(() => ({
    session,
    isAuthenticated: Boolean(session),
    isBooting,
    organization,
    selectOrganization,
    can: (permission: string) => Boolean(organization?.permissions.includes(permission)),
    login,
    register,
    logout,
  }), [isBooting, login, logout, organization, register, selectOrganization, session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// The hook stays beside its provider so the public authentication API is easy to discover.
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth doit être utilisé dans AuthProvider.');
  return context;
}
