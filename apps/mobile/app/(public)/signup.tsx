import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, View } from 'react-native';
import { MIN_PASSWORD_LENGTH, registerSchema } from '@nova/validation';
import { Button, Input, Screen, Text, useTheme } from '@nova/ui';
import { ApiError } from '../../src/api/client';
import { useAuth } from '../../src/state/auth-context';

export default function SignupScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { signUp } = useAuth();

  const [firstName, setFirstName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setErrors({});

    // The same schema the API enforces, so the user sees the error before the round trip.
    const parsed = registerSchema.safeParse({
      firstName,
      email,
      password,
      acceptedTerms: acceptedTerms as true,
    });
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (typeof field === 'string' && !fieldErrors[field]) fieldErrors[field] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    setSubmitting(true);
    try {
      await signUp({ firstName: parsed.data.firstName, email: parsed.data.email, password: parsed.data.password });
    } catch (caught) {
      setErrors({
        form:
          caught instanceof ApiError
            ? caught.message
            : 'Création de compte impossible. Réessayez dans quelques instants.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1 }}
    >
      <Screen title="Créer un compte" subtitle="Quelques informations, et votre espace est prêt.">
        <View style={{ gap: theme.spacing.lg }}>
          <Input
            label="Prénom"
            value={firstName}
            onChangeText={setFirstName}
            autoComplete="given-name"
            error={errors.firstName}
            placeholder="Camille"
          />
          <Input
            label="Adresse e-mail"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            error={errors.email}
            placeholder="vous@exemple.fr"
          />
          <Input
            label="Mot de passe"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="new-password"
            error={errors.password}
            hint={`Au moins ${MIN_PASSWORD_LENGTH} caractères, dont un chiffre.`}
          />

          <Pressable
            onPress={() => setAcceptedTerms((current) => !current)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: acceptedTerms }}
            accessibilityLabel="J’accepte les conditions d’utilisation et la politique de confidentialité"
            style={{
              flexDirection: 'row',
              gap: theme.spacing.md,
              alignItems: 'flex-start',
              minHeight: theme.minTouchTarget,
              paddingVertical: theme.spacing.xs,
            }}
          >
            <View
              style={{
                width: 22,
                height: 22,
                borderRadius: 6,
                borderWidth: 1,
                borderColor: acceptedTerms ? theme.colors.accent : theme.colors.borderStrong,
                backgroundColor: acceptedTerms ? theme.colors.accent : 'transparent',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {acceptedTerms ? (
                <Text variant="caption" color="inverse">
                  ✓
                </Text>
              ) : null}
            </View>
            <Text variant="small" color="secondary" style={{ flex: 1 }}>
              J’accepte les conditions d’utilisation et la politique de confidentialité de NOVA.
            </Text>
          </Pressable>

          {errors.acceptedTerms ? (
            <Text variant="caption" color="negative">
              {errors.acceptedTerms}
            </Text>
          ) : null}
          {errors.form ? (
            <Text variant="small" color="negative" accessibilityRole="alert">
              {errors.form}
            </Text>
          ) : null}

          <Button label="Créer mon compte" fullWidth loading={submitting} onPress={submit} />

          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: theme.spacing.sm }}>
            <Pressable onPress={() => router.push('/(public)/terms')} accessibilityRole="link">
              <Text variant="caption" color="accent">
                Conditions
              </Text>
            </Pressable>
            <Text variant="caption" color="tertiary">
              ·
            </Text>
            <Pressable onPress={() => router.push('/(public)/privacy')} accessibilityRole="link">
              <Text variant="caption" color="accent">
                Confidentialité
              </Text>
            </Pressable>
          </View>

          <Button
            label="J’ai déjà un compte"
            variant="ghost"
            fullWidth
            onPress={() => router.replace('/(public)/login')}
          />
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}
