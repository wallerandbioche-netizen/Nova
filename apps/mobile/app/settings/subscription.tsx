import { View } from 'react-native';
import type { PlanDefinition, SubscriptionState } from '@nova/types';
import {
  Badge,
  Button,
  Card,
  ErrorState,
  Screen,
  SectionHeader,
  SkeletonCard,
  Text,
  useTheme,
} from '@nova/ui';
import { useNovaQuery } from '../../src/hooks/use-nova-query';
import { useAuth } from '../../src/state/auth-context';

type PlanWithPurchase = PlanDefinition & { isPurchasable: boolean };

/**
 * Subscription.
 *
 * Plans and prices come from the API, never hardcoded here (rule #49). When no payment
 * provider is configured, the premium plan is presented as "bientôt disponible" rather than
 * offering a checkout button that cannot work (rule #63).
 */
export default function SubscriptionScreen() {
  const theme = useTheme();
  const { api, user } = useAuth();

  const plans = useNovaQuery<{ items: PlanWithPurchase[]; paymentEnabled: boolean }>({
    queryKey: ['subscription', 'plans'],
    queryFn: () => api.subscriptions.plans(),
    cacheKey: 'subscription.plans',
    staleTime: 60 * 60_000,
  });

  const state = useNovaQuery<SubscriptionState>({
    queryKey: ['subscription', user?.id],
    queryFn: () => api.subscriptions.me(),
    cacheKey: 'subscription.state',
  });

  if (plans.isLoading) {
    return (
      <Screen title="Abonnement">
        <SkeletonCard lines={4} />
      </Screen>
    );
  }

  if (plans.error) {
    return (
      <Screen title="Abonnement">
        <ErrorState
          offline={plans.isOffline}
          onRetry={() => void plans.refetch()}
          requestId={plans.error.requestId}
        />
      </Screen>
    );
  }

  const currentPlan = state.data?.plan ?? 'free';

  return (
    <Screen title="Abonnement">
      <View style={{ gap: theme.spacing.xl }}>
        {plans.data?.items.map((plan) => {
          const isCurrent = plan.key === currentPlan;
          const price =
            plan.priceAmount === 0
              ? 'Gratuit'
              : `${(plan.priceAmount / 100).toLocaleString('fr-FR', {
                  style: 'currency',
                  currency: plan.priceCurrency,
                })}${plan.interval === 'month' ? ' / mois' : plan.interval === 'year' ? ' / an' : ''}`;

          return (
            <Card key={plan.key}>
              <View style={{ gap: theme.spacing.md }}>
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <Text variant="h2">{plan.name}</Text>
                  {isCurrent ? <Badge label="Votre formule" tone="accent" /> : null}
                </View>

                <Text variant="h3" tabular>
                  {price}
                </Text>
                <Text variant="small" color="secondary">
                  {plan.description}
                </Text>

                <View style={{ gap: theme.spacing.xs }}>
                  {plan.features.map((feature) => (
                    <Text key={feature} variant="small">
                      • {feature}
                    </Text>
                  ))}
                </View>

                {!isCurrent && plan.key !== 'free' ? (
                  plan.isPurchasable ? (
                    <Button
                      label="Passer à Premium"
                      fullWidth
                      onPress={async () => {
                        const session = await api.subscriptions.checkout({
                          plan: 'premium',
                          interval: 'month',
                        });
                        if (session.url) {
                          const { Linking } = await import('react-native');
                          await Linking.openURL(session.url);
                        }
                      }}
                    />
                  ) : (
                    <View
                      style={{
                        backgroundColor: theme.colors.surfaceSecondary,
                        borderRadius: theme.radius.md,
                        padding: theme.spacing.md,
                      }}
                    >
                      <Text variant="small" color="secondary">
                        Le paiement n’est pas encore activé sur cet environnement. NOVA Premium sera
                        proposé prochainement.
                      </Text>
                    </View>
                  )
                ) : null}
              </View>
            </Card>
          );
        })}

        {state.data?.currentPeriodEnd ? (
          <View>
            <SectionHeader title="Détails" />
            <Card>
              <Text variant="small" color="secondary">
                {state.data.cancelAtPeriodEnd
                  ? 'Votre abonnement prendra fin à la fin de la période en cours.'
                  : 'Votre abonnement se renouvellera automatiquement.'}
              </Text>
            </Card>
          </View>
        ) : null}

        <Text variant="caption" color="tertiary">
          Les prix sont susceptibles d’évoluer. Toute modification vous serait communiquée avant
          application.
        </Text>
      </View>
    </Screen>
  );
}
