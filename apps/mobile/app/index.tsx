import { View } from 'react-native';
import { APP_NAME, APP_TAGLINE } from '@nova/config';
import { Text, useTheme } from '@nova/ui';

/**
 * Splash.
 *
 * Shown while the session is restored. The router replaces it as soon as the session state is
 * known, so it never lingers as a dead end.
 */
export default function SplashScreen() {
  const theme = useTheme();

  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.background,
        gap: theme.spacing.sm,
        padding: theme.screenPadding,
      }}
    >
      <Text variant="display" color="accent">
        {APP_NAME}
      </Text>
      <Text variant="small" color="secondary" align="center">
        {APP_TAGLINE}
      </Text>
    </View>
  );
}
