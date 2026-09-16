import { View } from 'react-native';
import { Screen, Text, useTheme } from '@nova/ui';
import { PRIVACY_SECTIONS } from '../../src/content/legal';

export default function PrivacyScreen() {
  const theme = useTheme();
  return (
    <Screen
      title="Politique de confidentialité"
      subtitle="Quelles données, pourquoi, et comment les retirer."
    >
      <View style={{ gap: theme.spacing.xl }}>
        {PRIVACY_SECTIONS.map((section) => (
          <View key={section.heading} style={{ gap: theme.spacing.xs }}>
            <Text variant="h3" accessibilityRole="header">
              {section.heading}
            </Text>
            <Text variant="small" color="secondary">
              {section.body}
            </Text>
          </View>
        ))}
      </View>
    </Screen>
  );
}
