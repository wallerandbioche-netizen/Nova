import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { JOURNAL_ACTION_LABELS, INVESTMENT_HORIZON_LABELS } from '@nova/config';
import { freeTextSchema, priceSchema, quantitySchema } from '@nova/validation';
import { Button, Card, Input, OptionList, Screen, SectionHeader, Text, useTheme } from '@nova/ui';
import { ApiError } from '../../src/api/client';
import { useAuth } from '../../src/state/auth-context';

const ACTION_OPTIONS = Object.entries(JOURNAL_ACTION_LABELS).map(([value, label]) => ({
  value,
  label,
}));

const HORIZON_OPTIONS = Object.entries(INVESTMENT_HORIZON_LABELS).map(([value, label]) => ({
  value,
  label,
}));

const CONVICTION_OPTIONS = [
  { value: 'low', label: 'Faible', description: 'J’hésite encore.' },
  { value: 'medium', label: 'Moyenne', description: 'J’ai un avis, sans certitude.' },
  { value: 'high', label: 'Forte', description: 'Je suis convaincu de ma décision.' },
];

/**
 * New journal entry.
 *
 * The reason is the only mandatory field: an entry without a "pourquoi" would have no value
 * when re-read six months later.
 */
export default function NewJournalEntryScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { api } = useAuth();

  const [action, setAction] = useState<string>('buy');
  const [reason, setReason] = useState('');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [horizon, setHorizon] = useState<string | null>(null);
  const [conviction, setConviction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setError(null);

    const parsedReason = freeTextSchema(2000, 'Votre raison').safeParse(reason);
    if (!parsedReason.success) {
      setError(parsedReason.error.issues[0]?.message ?? 'Indiquez la raison de votre décision.');
      return;
    }

    const parsedQuantity = quantity ? quantitySchema.safeParse(quantity) : null;
    if (parsedQuantity && !parsedQuantity.success) {
      setError(parsedQuantity.error.issues[0]?.message ?? 'Quantité invalide');
      return;
    }

    const parsedPrice = price ? priceSchema.safeParse(price) : null;
    if (parsedPrice && !parsedPrice.success) {
      setError(parsedPrice.error.issues[0]?.message ?? 'Prix invalide');
      return;
    }

    setSubmitting(true);
    try {
      await api.journal.create({
        action,
        reason: parsedReason.data,
        ...(parsedQuantity?.success ? { quantity: parsedQuantity.data } : {}),
        ...(parsedPrice?.success ? { price: parsedPrice.data, currency: 'EUR' } : {}),
        ...(horizon ? { horizon } : {}),
        ...(conviction ? { conviction } : {}),
      });
      router.replace('/journal');
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : 'L’entrée n’a pas pu être enregistrée.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen
      title="Nouvelle entrée"
      subtitle="Ce que vous avez fait, et surtout pourquoi."
      footer={
        <View style={{ gap: theme.spacing.sm }}>
          <Button label="Enregistrer" fullWidth loading={submitting} onPress={submit} />
          <Button label="Annuler" variant="ghost" fullWidth onPress={() => router.back()} />
        </View>
      }
    >
      <View style={{ gap: theme.spacing.xl }}>
        <View>
          <SectionHeader title="Votre décision" />
          <OptionList options={ACTION_OPTIONS} value={action} onChange={setAction} />
        </View>

        <View>
          <SectionHeader title="Pourquoi ?" subtitle="Le champ le plus utile de tout le journal." />
          <Card>
            <Input
              label="Votre raisonnement"
              value={reason}
              onChangeText={setReason}
              multiline
              numberOfLines={5}
              placeholder="Ce qui m’a décidé, ce que j’anticipe, ce dont je ne suis pas sûr…"
              style={{ minHeight: 120, textAlignVertical: 'top' }}
            />
          </Card>
        </View>

        <View>
          <SectionHeader title="Détails (facultatif)" />
          <Card>
            <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
              <Input
                label="Quantité"
                value={quantity}
                onChangeText={setQuantity}
                keyboardType="decimal-pad"
                containerStyle={{ flex: 1 }}
              />
              <Input
                label="Prix"
                value={price}
                onChangeText={setPrice}
                keyboardType="decimal-pad"
                suffix="€"
                containerStyle={{ flex: 1 }}
              />
            </View>
          </Card>
        </View>

        <View>
          <SectionHeader title="Horizon envisagé" />
          <OptionList options={HORIZON_OPTIONS} value={horizon} onChange={setHorizon} />
        </View>

        <View>
          <SectionHeader title="Niveau de conviction" />
          <OptionList options={CONVICTION_OPTIONS} value={conviction} onChange={setConviction} />
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
