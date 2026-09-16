import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { APP_NAME } from '@nova/config';
import { Button, Text, useTheme } from '@nova/ui';

/**
 * Welcome / landing.
 *
 * States the promise in one sentence and what NOVA does — and does not do. No performance
 * claim, no figure, no urgency.
 */
export default function WelcomeScreen() {
  const theme = useTheme();
  const router = useRouter();

  const propositions = [
    {
      title: 'Ce qui s’est passé',
      body: 'Les marchés et les actualités du jour, résumés en trois minutes.',
    },
    {
      title: 'Ce qui vous concerne',
      body: 'NOVA croise l’actualité avec votre portefeuille pour vous dire ce qui vous touche, et pourquoi.',
    },
    {
      title: 'Ce que vous apprenez',
      body: 'Chaque notion importante est expliquée simplement, avec ses sources et ses incertitudes.',
    },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <View style={{ flex: 1, padding: theme.screenPadding, justifyContent: 'space-between' }}>
        <View style={{ gap: theme.spacing.xl, paddingTop: theme.spacing['3xl'] }}>
          <View style={{ gap: theme.spacing.sm }}>
            <Text variant="display" color="accent">
              {APP_NAME}
            </Text>
            <Text variant="h2">Comprenez vos investissements sans passer votre journée à suivre les marchés.</Text>
          </View>

          <View style={{ gap: theme.spacing.lg }}>
            {propositions.map((proposition) => (
              <View key={proposition.title} style={{ gap: theme.spacing.xs }}>
                <Text variant="bodyStrong">{proposition.title}</Text>
                <Text variant="small" color="secondary">
                  {proposition.body}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <View style={{ gap: theme.spacing.md }}>
          <Button
            label="Commencer"
            fullWidth
            onPress={() => router.push('/(public)/signup')}
          />
          <Button
            label="J’ai déjà un compte"
            variant="ghost"
            fullWidth
            onPress={() => router.push('/(public)/login')}
          />
          <Text variant="caption" color="tertiary" align="center">
            NOVA fournit une information pédagogique. NOVA ne délivre pas de conseil en
            investissement personnalisé et ne passe aucun ordre.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
