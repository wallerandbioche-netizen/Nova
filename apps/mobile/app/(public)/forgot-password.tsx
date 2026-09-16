import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Button, Input, Screen, Text, useTheme } from '@nova/ui';
import { ApiClient } from '../../src/api/client';
import { createEndpoints } from '../../src/api/endpoints';
import { secureTokenStore } from '../../src/api/token-store';

/**
 * Password reset request.
 *
 * The confirmation is deliberately identical whether or not an account exists: the screen
 * mirrors the API, which never reveals which addresses are registered.
 */
export default function ForgotPasswordScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setSubmitting(true);
    try {
      const api = createEndpoints(new ApiClient(secureTokenStore));
      await api.auth.forgotPassword(email.trim());
    } catch {
      // Even a transport failure shows the same confirmation: the screen must not become an
      // oracle for which addresses exist.
    } finally {
      setSubmitting(false);
      setSubmitted(true);
    }
  };

  if (submitted) {
    return (
      <Screen title="Vérifiez votre boîte mail">
        <View style={{ gap: theme.spacing.lg }}>
          <Text variant="body" color="secondary">
            Si un compte existe pour cette adresse, un e-mail de réinitialisation vient d’être
            envoyé. Le lien est valable 30 minutes.
          </Text>
          <Button label="Retour à la connexion" onPress={() => router.replace('/(public)/login')} fullWidth />
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      title="Mot de passe oublié"
      subtitle="Nous vous enverrons un lien pour en choisir un nouveau."
    >
      <View style={{ gap: theme.spacing.lg }}>
        <Input
          label="Adresse e-mail"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="vous@exemple.fr"
        />
        <Button
          label="Envoyer le lien"
          fullWidth
          loading={submitting}
          disabled={email.length < 5}
          onPress={submit}
        />
        <Button label="Annuler" variant="ghost" fullWidth onPress={() => router.back()} />
      </View>
    </Screen>
  );
}
