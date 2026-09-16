import { useState } from 'react';
import { View } from 'react-native';
import { MIN_PASSWORD_LENGTH, changePasswordSchema } from '@nova/validation';
import { Button, Card, Input, Screen, SectionHeader, Text, useTheme } from '@nova/ui';
import { ApiError } from '../../src/api/client';
import { useAuth } from '../../src/state/auth-context';

/**
 * Security.
 *
 * Changing the password ends every other session server-side, which the screen states before
 * the user commits to it.
 */
export default function SecurityScreen() {
  const theme = useTheme();
  const { api, signOut } = useAuth();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setError(null);

    const parsed = changePasswordSchema.safeParse({ currentPassword, newPassword });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Mot de passe invalide');
      return;
    }

    setSubmitting(true);
    try {
      await api.profile.changePassword(parsed.data);
      setSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : 'Le mot de passe n’a pas pu être modifié.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <Screen title="Mot de passe modifié">
        <View style={{ gap: theme.spacing.lg }}>
          <Text variant="body" color="secondary">
            Votre mot de passe a été modifié. Par sécurité, toutes vos autres sessions ont été
            fermées. Reconnectez-vous sur vos autres appareils.
          </Text>
          <Button label="Se reconnecter" fullWidth onPress={() => void signOut()} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen title="Sécurité">
      <View style={{ gap: theme.spacing.xl }}>
        <View>
          <SectionHeader title="Changer de mot de passe" />
          <Card>
            <View style={{ gap: theme.spacing.md }}>
              <Input
                label="Mot de passe actuel"
                value={currentPassword}
                onChangeText={setCurrentPassword}
                secureTextEntry
                autoComplete="current-password"
              />
              <Input
                label="Nouveau mot de passe"
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
                autoComplete="new-password"
                hint={`Au moins ${MIN_PASSWORD_LENGTH} caractères, dont un chiffre.`}
                error={error}
              />
              <Text variant="caption" color="secondary">
                Modifier votre mot de passe fermera toutes vos sessions ouvertes, sur cet appareil
                comme sur les autres.
              </Text>
              <Button
                label="Modifier le mot de passe"
                fullWidth
                loading={submitting}
                disabled={!currentPassword || !newPassword}
                onPress={submit}
              />
            </View>
          </Card>
        </View>

        <View>
          <SectionHeader title="Comment vos données sont protégées" />
          <Card>
            <View style={{ gap: theme.spacing.sm }}>
              <Text variant="small" color="secondary">
                • Votre mot de passe n’est jamais stocké en clair : seule une empreinte calculée
                avec scrypt est conservée.
              </Text>
              <Text variant="small" color="secondary">
                • Vos jetons de session sont conservés dans le trousseau sécurisé de votre
                appareil.
              </Text>
              <Text variant="small" color="secondary">
                • Les accès sensibles à votre compte sont journalisés, sans jamais enregistrer de
                mot de passe ni de montant.
              </Text>
            </View>
          </Card>
        </View>
      </View>
    </Screen>
  );
}
