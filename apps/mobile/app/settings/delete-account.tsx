import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Button, Card, Input, Screen, Text, useTheme } from '@nova/ui';
import { ApiError } from '../../src/api/client';
import { useAuth } from '../../src/state/auth-context';

/**
 * Account deletion.
 *
 * Requires the password and an explicit typed confirmation. The screen states exactly what is
 * deleted and when — no dark pattern, no guilt-tripping, no hidden retention (rules #46, #56).
 */
export default function DeleteAccountScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { api, signOut } = useAuth();

  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = password.length > 0 && confirmation === 'SUPPRIMER';

  const submit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await api.account.remove({ password, confirmation: 'SUPPRIMER' });
      // The session no longer exists server-side; clear it locally and return to the landing.
      await signOut();
      router.replace('/(public)/welcome');
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : 'La suppression n’a pas pu être effectuée.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen
      title="Supprimer mon compte"
      footer={
        <View style={{ gap: theme.spacing.sm }}>
          <Button
            label="Supprimer définitivement"
            variant="danger"
            fullWidth
            disabled={!canSubmit}
            loading={submitting}
            onPress={submit}
          />
          <Button label="Annuler" variant="ghost" fullWidth onPress={() => router.back()} />
        </View>
      }
    >
      <View style={{ gap: theme.spacing.xl }}>
        <Card>
          <View style={{ gap: theme.spacing.sm }}>
            <Text variant="h3">Ce qui sera supprimé</Text>
            <Text variant="small" color="secondary">
              • Votre profil et votre profil investisseur
            </Text>
            <Text variant="small" color="secondary">
              • Vos portefeuilles et toutes vos positions
            </Text>
            <Text variant="small" color="secondary">
              • Votre journal, vos briefings et votre progression
            </Text>
            <Text variant="small" color="secondary">
              • Vos conversations avec NOVA
            </Text>
          </View>
        </Card>

        <Card>
          <View style={{ gap: theme.spacing.sm }}>
            <Text variant="h3">Comment cela se passe</Text>
            <Text variant="small" color="secondary">
              Vos données personnelles sont anonymisées immédiatement : votre compte disparaît du
              produit dès la confirmation. Elles sont ensuite effacées définitivement à l’issue de
              la période de conservation prévue.
            </Text>
            <Text variant="small" color="secondary">
              Cette action est irréversible. Si vous souhaitez conserver une copie, exportez vos
              données depuis les paramètres avant de continuer.
            </Text>
          </View>
        </Card>

        <View style={{ gap: theme.spacing.md }}>
          <Input
            label="Votre mot de passe"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="current-password"
          />
          <Input
            label="Saisissez SUPPRIMER pour confirmer"
            value={confirmation}
            onChangeText={setConfirmation}
            autoCapitalize="characters"
            placeholder="SUPPRIMER"
            error={error}
          />
        </View>
      </View>
    </Screen>
  );
}
