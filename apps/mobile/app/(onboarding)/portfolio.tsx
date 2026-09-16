import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Button, Card, Input, Text, useTheme } from '@nova/ui';
import { quantitySchema, priceSchema } from '@nova/validation';
import { OnboardingStepScreen } from '../../src/components/OnboardingStep';
import { useOnboarding } from '../../src/state/onboarding-context';

/**
 * Manual portfolio entry.
 *
 * Positions are validated with the same schemas as the API, and the step can be skipped: an
 * empty portfolio is a legitimate state, and the app says what it means rather than blocking.
 */
export default function PortfolioStep() {
  const router = useRouter();
  const theme = useTheme();
  const { draft, update } = useOnboarding();

  const [symbol, setSymbol] = useState('');
  const [quantity, setQuantity] = useState('');
  const [averagePrice, setAveragePrice] = useState('');
  const [error, setError] = useState<string | null>(null);

  const addPosition = () => {
    setError(null);

    const parsedQuantity = quantitySchema.safeParse(quantity);
    const parsedPrice = priceSchema.safeParse(averagePrice);

    if (!symbol.trim()) {
      setError('Indiquez un nom ou un symbole (par exemple CW8.PA ou AAPL).');
      return;
    }
    if (!parsedQuantity.success) {
      setError(parsedQuantity.error.issues[0]?.message ?? 'Quantité invalide');
      return;
    }
    if (!parsedPrice.success) {
      setError(parsedPrice.error.issues[0]?.message ?? 'Prix invalide');
      return;
    }

    update({
      positions: [
        ...draft.positions,
        {
          symbol: symbol.trim().toUpperCase(),
          quantity: parsedQuantity.data,
          averagePrice: parsedPrice.data,
          currency: 'EUR',
        },
      ],
    });
    setSymbol('');
    setQuantity('');
    setAveragePrice('');
  };

  const removePosition = (index: number) => {
    update({ positions: draft.positions.filter((_, position) => position !== index) });
  };

  return (
    <OnboardingStepScreen
      step="portfolio"
      title="Votre portefeuille"
      subtitle="Ajoutez vos positions pour que NOVA puisse relier l’actualité à ce que vous détenez réellement."
      onNext={() => router.push('/(onboarding)/ready')}
      nextLabel={draft.positions.length > 0 ? 'Continuer' : 'Continuer sans position'}
      onSkip={draft.positions.length === 0 ? () => router.push('/(onboarding)/ready') : undefined}
      skipLabel="Je le ferai plus tard"
      footnote="NOVA ne se connecte à aucun compte bancaire ou courtier : vos positions sont saisies manuellement et restent modifiables."
    >
      <View style={{ gap: theme.spacing.lg }}>
        <Card>
          <View style={{ gap: theme.spacing.md }}>
            <Input
              label="Nom ou symbole"
              value={symbol}
              onChangeText={setSymbol}
              autoCapitalize="characters"
              placeholder="CW8.PA"
            />
            <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
              <Input
                label="Quantité"
                value={quantity}
                onChangeText={setQuantity}
                keyboardType="decimal-pad"
                placeholder="10"
                containerStyle={{ flex: 1 }}
              />
              <Input
                label="Prix moyen"
                value={averagePrice}
                onChangeText={setAveragePrice}
                keyboardType="decimal-pad"
                placeholder="440"
                suffix="€"
                containerStyle={{ flex: 1 }}
              />
            </View>
            {error ? (
              <Text variant="caption" color="negative" accessibilityRole="alert">
                {error}
              </Text>
            ) : null}
            <Button label="Ajouter cette position" variant="secondary" fullWidth onPress={addPosition} />
          </View>
        </Card>

        {draft.positions.length > 0 ? (
          <View style={{ gap: theme.spacing.sm }}>
            <Text variant="smallStrong" color="secondary">
              {draft.positions.length} position{draft.positions.length > 1 ? 's' : ''} ajoutée
              {draft.positions.length > 1 ? 's' : ''}
            </Text>
            {draft.positions.map((position, index) => (
              <Card key={`${position.symbol}-${index}`}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
                  <View style={{ flex: 1 }}>
                    <Text variant="bodyStrong">{position.symbol}</Text>
                    <Text variant="caption" color="secondary">
                      {position.quantity.toLocaleString('fr-FR')} × {position.averagePrice.toLocaleString('fr-FR')} €
                    </Text>
                  </View>
                  <Button
                    label="Retirer"
                    variant="ghost"
                    size="small"
                    onPress={() => removePosition(index)}
                  />
                </View>
              </Card>
            ))}
          </View>
        ) : null}
      </View>
    </OnboardingStepScreen>
  );
}
