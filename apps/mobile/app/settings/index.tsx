import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Switch, View } from 'react-native';
import type { NotificationPreferences } from '@nova/types';
import {
  Button,
  Card,
  ListRow,
  Screen,
  SectionHeader,
  SegmentedControl,
  Text,
  useTheme,
} from '@nova/ui';
import { useNovaQuery } from '../../src/hooks/use-nova-query';
import { useAuth } from '../../src/state/auth-context';

/**
 * Settings.
 *
 * Appearance, reading depth, notification preferences, data export and account deletion.
 * Notifications are opt-out per type; nothing here is designed to make disabling them hard.
 */
export default function SettingsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { api, user, signOut, refreshSession } = useAuth();
  const [exporting, setExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState<string | null>(null);

  const preferences = useNovaQuery<NotificationPreferences>({
    queryKey: ['notification-preferences', user?.id],
    queryFn: () => api.profile.getNotificationPreferences(),
    cacheKey: 'notification-preferences',
  });

  const togglePreference = async (key: keyof NotificationPreferences, value: boolean) => {
    await api.profile.updateNotificationPreferences({ [key]: value });
    await preferences.refetch();
  };

  return (
    <Screen title="Paramètres">
      <View style={{ gap: theme.spacing.xl }}>
        <View>
          <SectionHeader title="Apparence" />
          <Card>
            <View style={{ gap: theme.spacing.md }}>
              <Text variant="small" color="secondary">
                Thème
              </Text>
              <SegmentedControl<'system' | 'light' | 'dark'>
                value={user?.theme ?? 'system'}
                onChange={async (value) => {
                  await api.profile.update({ theme: value });
                  await refreshSession();
                }}
                accessibilityLabel="Choisir le thème de l’application"
                options={[
                  { value: 'system', label: 'Système' },
                  { value: 'light', label: 'Clair' },
                  { value: 'dark', label: 'Sombre' },
                ]}
              />
            </View>
          </Card>
        </View>

        <View>
          <SectionHeader
            title="Niveau de détail"
            subtitle="S’applique par défaut aux explications de NOVA."
          />
          <Card>
            <SegmentedControl<'simple' | 'detailed'>
              value={user?.contentDepth ?? 'simple'}
              onChange={async (value) => {
                await api.profile.update({ contentDepth: value });
                await refreshSession();
              }}
              accessibilityLabel="Choisir le niveau de détail par défaut"
              options={[
                { value: 'simple', label: 'Simple' },
                { value: 'detailed', label: 'Détaillé' },
              ]}
            />
          </Card>
        </View>

        <View>
          <SectionHeader title="Notifications" />
          <Card>
            <View style={{ gap: theme.spacing.sm }}>
              <PreferenceRow
                label="Briefing du matin"
                description="Une notification quand votre briefing est prêt."
                value={preferences.data?.dailyBrief ?? true}
                onChange={(value) => void togglePreference('dailyBrief', value)}
              />
              <Divider />
              <PreferenceRow
                label="Actualité importante"
                description="Uniquement lorsqu’une information touche fortement votre portefeuille."
                value={preferences.data?.importantNews ?? true}
                onChange={(value) => void togglePreference('importantNews', value)}
              />
              <Divider />
              <PreferenceRow
                label="Leçon du jour"
                description="Un rappel quotidien de votre leçon de deux minutes."
                value={preferences.data?.learning ?? true}
                onChange={(value) => void togglePreference('learning', value)}
              />
            </View>
            <Text variant="caption" color="tertiary" style={{ marginTop: theme.spacing.md }}>
              NOVA n’envoie jamais de notification destinée à provoquer une décision dans
              l’urgence.
            </Text>
          </Card>
        </View>

        <View>
          <SectionHeader title="Vos données" />
          <Card>
            <ListRow
              label="Exporter mes données"
              description="Toutes vos données, au format JSON"
              onPress={async () => {
                setExporting(true);
                setExportMessage(null);
                try {
                  const payload = await api.account.exportData();
                  const size = JSON.stringify(payload).length;
                  setExportMessage(
                    `Export prêt (${Math.round(size / 1024)} Ko). Il contient votre profil, vos portefeuilles, votre journal et votre progression.`,
                  );
                } catch {
                  setExportMessage('L’export n’a pas pu être généré. Réessayez plus tard.');
                } finally {
                  setExporting(false);
                }
              }}
              value={exporting ? '…' : undefined}
            />
            {exportMessage ? (
              <Text variant="caption" color="secondary">
                {exportMessage}
              </Text>
            ) : null}
            <Divider />
            <ListRow
              label="Supprimer mon compte"
              description="Suppression définitive de vos données"
              destructive
              onPress={() => router.push('/settings/delete-account')}
            />
          </Card>
        </View>

        <Button label="Se déconnecter" variant="secondary" fullWidth onPress={() => void signOut()} />
      </View>
    </Screen>
  );
}

function PreferenceRow({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  const theme = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
        paddingVertical: theme.spacing.sm,
        minHeight: theme.minTouchTarget,
      }}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="body">{label}</Text>
        <Text variant="caption" color="secondary">
          {description}
        </Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        accessibilityLabel={label}
        accessibilityHint={description}
        trackColor={{ true: theme.colors.accent, false: theme.colors.borderStrong }}
      />
    </View>
  );
}

function Divider() {
  const theme = useTheme();
  return <View style={{ height: 1, backgroundColor: theme.colors.border }} />;
}
