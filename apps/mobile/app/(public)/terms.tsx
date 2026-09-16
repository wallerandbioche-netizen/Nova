import { View } from 'react-native';
import { Screen, Text, useTheme } from '@nova/ui';
import { TERMS_SECTIONS } from '../../src/content/legal';

export default function TermsScreen() {
  const theme = useTheme();
  return (
    <Screen title="Conditions d’utilisation" subtitle="Ce que NOVA fait, et ce qu’il ne fait pas.">
      <View style={{ gap: theme.spacing.xl }}>
        {TERMS_SECTIONS.map((section) => (
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
