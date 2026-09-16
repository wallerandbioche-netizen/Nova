import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Button, Screen, Text, useTheme } from '@nova/ui';
import { ApiError } from '../../src/api/client';
import { useAuth } from '../../src/state/auth-context';
import { useOnboarding } from '../../src/state/onboarding-context';

/**
 * Final onboarding step.
 *
 * Everything collected across the flow is submitted here, in order, and only then is
 * onboarding marked complete — so a failure halfway leaves the user on this screen with a
 * retry, not in a half-configured state.
 */
export default function ReadyStep() {
  const theme = useTheme();
  const router = useRouter();
  const { api, refreshSession } = useAuth();
  const { draft, reset } = useOnboarding();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const finish = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await api.profile.saveInvestor({
        investmentGoal: draft.investmentGoal,
        investmentHorizon: draft.investmentHorizon,
        experienceLevel: draft.experienceLevel,
        riskTolerance: draft.riskTolerance,
        interestedAssetTypes: draft.interestedAssetTypes,
      });

      if (draft.positions.length > 0) {
        const portfolio = await api.portfolios.create({
          name: 'Mon portefeuille',
          baseCurrency: 'EUR',
        });
        for (const position of draft.positions) {
          await api.portfolios.addPosition(portfolio.id, {
            symbol: position.symbol,
            quantity: position.quantity,
            averagePrice: position.averagePrice,
            currency: position.currency,
          });
        }
      }

      await api.profile.completeOnboarding();
      await refreshSession();
      reset();
      router.replace('/(app)');
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : 'Nous n’avons pas pu finaliser votre espace. Vous pouvez réessayer.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen
      footer={
        <Button label="Découvrir mon espace" fullWidth loading={submitting} onPress={finish} />
      }
    >
      <View style={{ gap: theme.spacing.xl, paddingTop: theme.spacing['2xl'] }}>
        <View style={{ gap: theme.spacing.sm }}>
          <Text variant="display">Votre espace NOVA est prêt.</Text>
          <Text variant="body" color="secondary">
            Chaque matin, vous y trouverez ce qui s’est passé, ce qui vous concerne, et pourquoi.
          </Text>
        </View>

        <View style={{ gap: theme.spacing.md }}>
          <Summary label="Objectif" value={draft.investmentGoal} />
          <Summary label="Horizon" value={draft.investmentHorizon} />
          <Summary label="Expérience" value={draft.experienceLevel} />
          <Summary
            label="Portefeuille"
            value={
              draft.positions.length > 0
                ? `${draft.positions.length} position${draft.positions.length > 1 ? 's' : ''}`
                : 'à compléter plus tard'
            }
          />
        </View>

        {error ? (
          <Text variant="small" color="negative" accessibilityRole="alert">
            {error}
          </Text>
        ) : null}
      </View>
    </Screen>
  );
}

function Summary({ label, value }: { label: string; value: string | null }) {
  const theme = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: theme.spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
      }}
    >
      <Text variant="small" color="secondary">
        {label}
      </Text>
      <Text variant="smallStrong">{value ?? '—'}</Text>
    </View>
  );
}
