import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { InvestorProfile, PublicUser, SubscriptionState } from '@nova/types';
import { ApiClient, ApiError } from '../api/client';
import { createEndpoints, type NovaApi } from '../api/endpoints';
import { secureTokenStore } from '../api/token-store';
import { clearCachedPayloads } from '../lib/offline-cache';

/**
 * Session state.
 *
 * The app knows three states: restoring (splash), signed out, and signed in — with onboarding
 * either complete or not. Routing derives from this, so no screen can be reached in a state it
 * is not designed for.
 */
export type AuthStatus = 'restoring' | 'signed-out' | 'signed-in';

export interface AuthContextValue {
  status: AuthStatus;
  user: PublicUser | null;
  investorProfile: InvestorProfile | null;
  subscription: SubscriptionState | null;
  onboardingCompleted: boolean;
  api: NovaApi;
  signIn: (credentials: { email: string; password: string }) => Promise<void>;
  signUp: (input: { email: string; password: string; firstName: string }) => Promise<void>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
  /** Set after a successful account deletion so the UI can confirm before returning home. */
  lastAction: string | null;
  setLastAction: (action: string | null) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('restoring');
  const [user, setUser] = useState<PublicUser | null>(null);
  const [investorProfile, setInvestorProfile] = useState<InvestorProfile | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionState | null>(null);
  const [onboardingCompleted, setOnboardingCompleted] = useState(false);
  const [lastAction, setLastAction] = useState<string | null>(null);

  const clearSession = useCallback(async () => {
    await secureTokenStore.clear();
    await clearCachedPayloads();
    setUser(null);
    setInvestorProfile(null);
    setSubscription(null);
    setOnboardingCompleted(false);
    setStatus('signed-out');
  }, []);

  const client = useMemo(
    () =>
      new ApiClient(secureTokenStore, undefined, () => {
        void clearSession();
      }),
    [clearSession],
  );

  const api = useMemo(() => createEndpoints(client), [client]);

  const loadSession = useCallback(async () => {
    const session = await api.auth.me();
    setUser(session.user);
    setInvestorProfile(session.investorProfile);
    setSubscription(session.subscription);
    setOnboardingCompleted(session.onboardingCompleted);
    setStatus('signed-in');
  }, [api]);

  // Restore the session on launch: a stored refresh token is enough to come back signed in.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = await secureTokenStore.getAccessToken();
      const refreshToken = await secureTokenStore.getRefreshToken();
      if (!token && !refreshToken) {
        if (!cancelled) setStatus('signed-out');
        return;
      }
      try {
        await loadSession();
      } catch (error) {
        // Offline at launch: keep the user signed in so cached content remains reachable.
        if (error instanceof ApiError && error.isOffline) {
          if (!cancelled) setStatus('signed-in');
          return;
        }
        if (!cancelled) await clearSession();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadSession, clearSession]);

  const signIn = useCallback(
    async (credentials: { email: string; password: string }) => {
      const result = await api.auth.login(credentials);
      await secureTokenStore.setTokens(result.tokens);
      await loadSession();
    },
    [api, loadSession],
  );

  const signUp = useCallback(
    async (input: { email: string; password: string; firstName: string }) => {
      const result = await api.auth.register({ ...input, acceptedTerms: true });
      await secureTokenStore.setTokens(result.tokens);
      await loadSession();
    },
    [api, loadSession],
  );

  const signOut = useCallback(async () => {
    const refreshToken = await secureTokenStore.getRefreshToken();
    try {
      await api.auth.logout(refreshToken ?? undefined);
    } catch {
      // Signing out must always succeed locally, even with no connection.
    }
    await clearSession();
  }, [api, clearSession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      investorProfile,
      subscription,
      onboardingCompleted,
      api,
      signIn,
      signUp,
      signOut,
      refreshSession: loadSession,
      lastAction,
      setLastAction,
    }),
    [
      status,
      user,
      investorProfile,
      subscription,
      onboardingCompleted,
      api,
      signIn,
      signUp,
      signOut,
      loadSession,
      lastAction,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside an AuthProvider');
  return context;
}

/** Convenience accessor for screens that always run authenticated. */
export function useApi(): NovaApi {
  return useAuth().api;
}
