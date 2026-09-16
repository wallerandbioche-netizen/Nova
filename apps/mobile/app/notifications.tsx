import { useRouter } from 'expo-router';
import { View } from 'react-native';
import type { AppNotification, Paginated } from '@nova/types';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Screen,
  SkeletonCard,
  Text,
  useTheme,
} from '@nova/ui';
import { useNovaQuery } from '../src/hooks/use-nova-query';
import { formatDateTime } from '../src/lib/format';
import { useAuth } from '../src/state/auth-context';

export default function NotificationsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { api, user } = useAuth();

  const notifications = useNovaQuery<Paginated<AppNotification> & { unreadCount: number }>({
    queryKey: ['notifications', user?.id],
    queryFn: () => api.notifications.list(),
    cacheKey: 'notifications',
  });

  const unread = notifications.data?.unreadCount ?? 0;

  return (
    <Screen
      title="Notifications"
      subtitle={unread > 0 ? `${unread} non lue${unread > 1 ? 's' : ''}` : 'Tout est à jour.'}
      onRefresh={() => void notifications.refetch()}
      refreshing={notifications.isRefetching}
      offline={notifications.isFromCache}
      lastUpdatedLabel={notifications.cachedAtLabel}
      footer={
        unread > 0 ? (
          <Button
            label="Tout marquer comme lu"
            variant="secondary"
            fullWidth
            onPress={async () => {
              await api.notifications.markAllRead();
              await notifications.refetch();
            }}
          />
        ) : undefined
      }
    >
      {notifications.isLoading ? (
        <SkeletonCard lines={3} />
      ) : notifications.error ? (
        <ErrorState
          offline={notifications.isOffline}
          onRetry={() => void notifications.refetch()}
          requestId={notifications.error.requestId}
        />
      ) : (notifications.data?.items.length ?? 0) === 0 ? (
        <Card>
          <EmptyState
            title="Aucune notification"
            description="NOVA vous préviendra quand votre briefing est prêt, ou lorsqu’une actualité importante concerne votre portefeuille."
          />
        </Card>
      ) : (
        <View style={{ gap: theme.spacing.md }}>
          {notifications.data?.items.map((notification) => (
            <Card
              key={notification.id}
              accessibilityLabel={`${notification.title}. ${notification.body}`}
              onPress={async () => {
                if (!notification.readAt) {
                  await api.notifications.markRead(notification.id);
                  await notifications.refetch();
                }
                if (notification.link) router.push(notification.link as never);
              }}
            >
              <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
                <View
                  accessibilityElementsHidden
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    marginTop: 6,
                    backgroundColor: notification.readAt ? 'transparent' : theme.colors.accent,
                  }}
                />
                <View style={{ flex: 1, gap: theme.spacing.xs }}>
                  <Text variant={notification.readAt ? 'body' : 'bodyStrong'}>
                    {notification.title}
                  </Text>
                  <Text variant="small" color="secondary">
                    {notification.body}
                  </Text>
                  <Text variant="caption" color="tertiary">
                    {formatDateTime(notification.createdAt)}
                  </Text>
                </View>
              </View>
            </Card>
          ))}
        </View>
      )}
    </Screen>
  );
}
