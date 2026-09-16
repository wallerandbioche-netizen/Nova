import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { Text, useTheme } from '@nova/ui';

/**
 * Bottom navigation: Accueil · Marchés · Portefeuille · Apprendre · Profil.
 *
 * Labels are always visible (an icon alone is not an accessible label), and each tab has an
 * explicit accessibility label.
 */
function TabIcon({ glyph, focused }: { glyph: string; focused: boolean }) {
  return (
    <Text variant="body" color={focused ? 'accent' : 'tertiary'}>
      {glyph}
    </Text>
  );
}

export default function AppLayout() {
  const theme = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.accent,
        tabBarInactiveTintColor: theme.colors.textTertiary,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
          height: Platform.OS === 'ios' ? 88 : 64,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
        sceneStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Accueil',
          tabBarAccessibilityLabel: 'Accueil, votre briefing du jour',
          tabBarIcon: ({ focused }) => <TabIcon glyph="◉" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="markets"
        options={{
          title: 'Marchés',
          tabBarAccessibilityLabel: 'Marchés et thèmes du jour',
          tabBarIcon: ({ focused }) => <TabIcon glyph="◈" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="portfolio"
        options={{
          title: 'Portefeuille',
          tabBarAccessibilityLabel: 'Votre portefeuille et votre exposition',
          tabBarIcon: ({ focused }) => <TabIcon glyph="◧" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="learn"
        options={{
          title: 'Apprendre',
          tabBarAccessibilityLabel: 'Leçons et vocabulaire financier',
          tabBarIcon: ({ focused }) => <TabIcon glyph="◐" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarAccessibilityLabel: 'Profil et paramètres',
          tabBarIcon: ({ focused }) => <TabIcon glyph="◯" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
