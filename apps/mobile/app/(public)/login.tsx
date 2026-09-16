import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { Button, Input, Screen, Text, useTheme } from '@nova/ui';
import { ApiError } from '../../src/api/client';
import { useAuth } from '../../src/state/auth-context';

export default function LoginScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { signIn } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await signIn({ email: email.trim(), password });
      // Navigation is handled by the root layout once the session is known.
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : 'Connexion impossible. Réessayez dans quelques instants.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1 }}
    >
      <Screen title="Connexion" subtitle="Retrouvez votre espace NOVA.">
        <View style={{ gap: theme.spacing.lg }}>
          <Input
            label="Adresse e-mail"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            placeholder="vous@exemple.fr"
          />
          <Input
            label="Mot de passe"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="current-password"
            textContentType="password"
            error={error}
            onSubmitEditing={submit}
          />

          <Button
            label="Se connecter"
            fullWidth
            loading={submitting}
            disabled={!email || !password}
            onPress={submit}
          />

          <Button
            label="Mot de passe oublié ?"
            variant="ghost"
            fullWidth
            onPress={() => router.push('/(public)/forgot-password')}
          />

          <View style={{ alignItems: 'center', gap: theme.spacing.xs }}>
            <Text variant="small" color="secondary">
              Pas encore de compte ?
            </Text>
            <Button
              label="Créer un compte"
              variant="secondary"
              onPress={() => router.replace('/(public)/signup')}
            />
          </View>
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}
