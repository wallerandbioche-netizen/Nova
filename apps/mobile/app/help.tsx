import { View } from 'react-native';
import { Card, Screen, Text, useTheme } from '@nova/ui';
import { HELP_SECTIONS } from '../src/content/legal';

/**
 * Help.
 *
 * Explains how NOVA actually works — how news is ranked, where the figures come from, and what
 * the AI does and does not do. Transparency is a product feature, not a legal footnote.
 */
export default function HelpScreen() {
  const theme = useTheme();
  return (
    <Screen title="Comment NOVA fonctionne" subtitle="Les réponses aux questions les plus utiles.">
      <View style={{ gap: theme.spacing.md }}>
        {HELP_SECTIONS.map((section) => (
          <Card key={section.heading}>
            <View style={{ gap: theme.spacing.sm }}>
              <Text variant="h3" accessibilityRole="header">
                {section.heading}
              </Text>
              <Text variant="small" color="secondary">
                {section.body}
              </Text>
            </View>
          </Card>
        ))}
      </View>
    </Screen>
  );
}
