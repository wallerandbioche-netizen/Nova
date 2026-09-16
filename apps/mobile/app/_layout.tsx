import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from '@nova/ui';
import { AuthProvider, useAuth } from '../src/state/auth-context';
import { OnboardingProvider } from '../src/state/onboarding-context';

/**
 * Root layout.
 *
 * Owns the three cross-cutting concerns: data fetching (React Query), session state and theme.
 * Routing is derived from the session so a screen can never be reached in a state it was not
 * designed for.
 */
function RootNavigator() {
  const { status, onboardingCompleted } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const theme = useTheme();

  useEffect(() => {
    if (status === 'restoring') return;

    const group = segments[0];
    const inPublic = group === '(public)' || group === undefined;
    const inOnboarding = group === '(onboarding)';

    if (status === 'signed-out' && !inPublic) {
      router.replace('/(public)/welcome');
      return;
    }
    if (status === 'signed-in' && !onboardingCompleted && !inOnboarding) {
      router.replace('/(onboarding)/goal');
      return;
    }
    if (status === 'signed-in' && onboardingCompleted && (inPublic || inOnboarding)) {
      router.replace('/(app)');
    }
  }, [status, onboardingCompleted, segments, router]);

  return (
    <>
      <StatusBar style={theme.isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.background },
          animation: 'fade',
        }}
      />
    </>
  );
}

function ThemedApp() {
  const { user } = useAuth();
  // The theme follows the system by default and honours the user's explicit preference.
  return (
    <ThemeProvider preference={user?.theme ?? 'system'}>
      <RootNavigator />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  const queryClient = useMemo(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            gcTime: 30 * 60_000,
            refetchOnWindowFocus: false,
            retry: false,
          },
        },
      }),
    [],
  );

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <OnboardingProvider>
            <ThemedApp />
          </OnboardingProvider>
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
