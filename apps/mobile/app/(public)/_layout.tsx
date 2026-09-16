import { Stack } from 'expo-router';
import { useTheme } from '@nova/ui';

export default function PublicLayout() {
  const theme = useTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    />
  );
}
