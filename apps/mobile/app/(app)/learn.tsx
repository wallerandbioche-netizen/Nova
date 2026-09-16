import { useRouter } from 'expo-router';
import { View } from 'react-native';
import type { LearningProgressSummary, LessonSummary } from '@nova/types';
import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
  Screen,
  SectionHeader,
  SkeletonCard,
  Text,
  useTheme,
} from '@nova/ui';
import { useNovaQuery } from '../../src/hooks/use-nova-query';
import { useAuth } from '../../src/state/auth-context';

const DIFFICULTY_LABELS = {
  beginner: 'Débutant',
  intermediate: 'Intermédiaire',
  advanced: 'Avancé',
} as const;

export default function LearnScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { api, user } = useAuth();

  const lessons = useNovaQuery<{ items: LessonSummary[] }>({
    queryKey: ['learning', user?.id],
    queryFn: () => api.learning.list(),
    cacheKey: 'learning.lessons',
    staleTime: 10 * 60_000,
  });

  const progress = useNovaQuery<LearningProgressSummary>({
    queryKey: ['learning', 'progress', user?.id],
    queryFn: () => api.learning.progress(),
    cacheKey: 'learning.progress',
  });

  return (
    <Screen
      title="Apprendre"
      subtitle="Des leçons de deux minutes, adaptées à votre niveau."
      onRefresh={() => {
        void lessons.refetch();
        void progress.refetch();
      }}
      refreshing={lessons.isRefetching}
      offline={lessons.isFromCache}
      lastUpdatedLabel={lessons.cachedAtLabel}
    >
      <View style={{ gap: theme.spacing.xl }}>
        {progress.data ? (
          <Card>
            <View style={{ gap: theme.spacing.sm }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text variant="smallStrong">Votre progression</Text>
                <Text variant="smallStrong" tabular>
                  {progress.data.completedCount} / {progress.data.totalCount}
                </Text>
              </View>
              <View
                accessible
                accessibilityLabel={`${progress.data.percent} pour cent des leçons terminées`}
                style={{
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: theme.colors.surfaceSecondary,
                  overflow: 'hidden',
                }}
              >
                <View
                  style={{
                    width: `${Math.max(progress.data.percent, 2)}%`,
                    height: '100%',
                    backgroundColor: theme.colors.accent,
                  }}
                />
              </View>
            </View>
          </Card>
        ) : null}

        <View>
          <SectionHeader title="Leçons" />
          {lessons.isLoading ? (
            <View style={{ gap: theme.spacing.md }}>
              <SkeletonCard lines={2} />
              <SkeletonCard lines={2} />
            </View>
          ) : lessons.error ? (
            <ErrorState
              offline={lessons.isOffline}
              onRetry={() => void lessons.refetch()}
              requestId={lessons.error.requestId}
            />
          ) : (lessons.data?.items.length ?? 0) === 0 ? (
            <Card>
              <EmptyState
                title="Aucune leçon disponible"
                description="Les contenus pédagogiques seront bientôt disponibles."
              />
            </Card>
          ) : (
            <View style={{ gap: theme.spacing.md }}>
              {lessons.data?.items.map((lesson) => (
                <Card
                  key={lesson.id}
                  onPress={() => router.push(`/lesson/${lesson.id}`)}
                  accessibilityLabel={`${lesson.title}, ${lesson.estimatedMinutes} minutes, niveau ${
                    DIFFICULTY_LABELS[lesson.difficulty]
                  }${lesson.status === 'completed' ? ', terminée' : ''}`}
                >
                  <View style={{ gap: theme.spacing.sm }}>
                    <View
                      style={{
                        flexDirection: 'row',
                        gap: theme.spacing.sm,
                        alignItems: 'center',
                        flexWrap: 'wrap',
                      }}
                    >
                      <Badge label={DIFFICULTY_LABELS[lesson.difficulty]} tone="neutral" />
                      <Badge label={`${lesson.estimatedMinutes} min`} tone="neutral" />
                      {lesson.status === 'completed' ? (
                        <Badge label="Terminée" tone="positive" />
                      ) : lesson.status === 'in_progress' ? (
                        <Badge label="Commencée" tone="info" />
                      ) : null}
                    </View>
                    <Text variant="h3">{lesson.title}</Text>
                    <Text variant="small" color="secondary">
                      {lesson.description}
                    </Text>
                  </View>
                </Card>
              ))}
            </View>
          )}
        </View>
      </View>
    </Screen>
  );
}
