import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import type { Lesson } from '@nova/types';
import {
  Badge,
  Button,
  Card,
  ErrorState,
  OptionList,
  Screen,
  SectionHeader,
  SkeletonCard,
  Text,
  useTheme,
} from '@nova/ui';
import { useNovaQuery } from '../../src/hooks/use-nova-query';
import { useAuth } from '../../src/state/auth-context';

interface Correction {
  questionId: string;
  correct: boolean;
  explanation: string;
}

/**
 * Lesson detail.
 *
 * Content, key takeaways, glossary and a short quiz. Answers are graded server-side, and the
 * explanation is shown whatever the answer — the goal is understanding, not scoring.
 */
export default function LessonScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { api } = useAuth();

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [corrections, setCorrections] = useState<Correction[] | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const lesson = useNovaQuery<Lesson>({
    queryKey: ['lesson', id],
    queryFn: () => api.learning.detail(id as string),
    cacheKey: `lesson.${id}`,
    enabled: Boolean(id),
    staleTime: 30 * 60_000,
  });

  const complete = async () => {
    if (!id) return;
    setSubmitting(true);
    try {
      const result = await api.learning.complete(id, answers);
      setCorrections(result.corrections);
    } catch {
      // Completion is not critical: the content stays readable, and the user can retry.
    } finally {
      setSubmitting(false);
    }
  };

  if (lesson.isLoading) {
    return (
      <Screen>
        <SkeletonCard lines={5} />
      </Screen>
    );
  }

  if (lesson.error || !lesson.data) {
    return (
      <Screen>
        <ErrorState
          offline={lesson.isOffline}
          onRetry={() => void lesson.refetch()}
          requestId={lesson.error?.requestId}
        />
      </Screen>
    );
  }

  const data = lesson.data;
  const allAnswered = data.quiz.every((question) => answers[question.id]);

  return (
    <Screen
      offline={lesson.isFromCache}
      lastUpdatedLabel={lesson.cachedAtLabel}
      footer={
        corrections ? (
          <Button
            label="Revenir aux leçons"
            fullWidth
            onPress={() => router.push('/(app)/learn')}
          />
        ) : data.quiz.length > 0 ? (
          <Button
            label="Valider mes réponses"
            fullWidth
            disabled={!allAnswered}
            loading={submitting}
            onPress={complete}
          />
        ) : (
          <Button
            label="Marquer comme terminée"
            fullWidth
            loading={submitting}
            onPress={complete}
          />
        )
      }
    >
      <View style={{ gap: theme.spacing['2xl'] }}>
        <View style={{ gap: theme.spacing.sm }}>
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
            <Badge label={`${data.estimatedMinutes} min`} tone="neutral" />
            <Badge label={data.category} tone="neutral" />
          </View>
          <Text variant="h1" accessibilityRole="header">
            {data.title}
          </Text>
          <Text variant="small" color="secondary">
            {data.description}
          </Text>
        </View>

        <View style={{ gap: theme.spacing.xl }}>
          {data.sections.map((section) => (
            <View key={section.heading} style={{ gap: theme.spacing.sm }}>
              <Text variant="h3" accessibilityRole="header">
                {section.heading}
              </Text>
              <Text variant="body" color="secondary">
                {section.body}
              </Text>
            </View>
          ))}
        </View>

        {data.keyTakeaways.length > 0 ? (
          <Card>
            <View style={{ gap: theme.spacing.sm }}>
              <Text variant="smallStrong" color="secondary">
                À retenir
              </Text>
              {data.keyTakeaways.map((takeaway, index) => (
                <Text key={index} variant="small">
                  • {takeaway}
                </Text>
              ))}
            </View>
          </Card>
        ) : null}

        {data.glossary.length > 0 ? (
          <View>
            <SectionHeader title="Vocabulaire" />
            <Card>
              <View style={{ gap: theme.spacing.md }}>
                {data.glossary.map((entry) => (
                  <View key={entry.term} style={{ gap: 2 }}>
                    <Text variant="smallStrong">{entry.term}</Text>
                    <Text variant="small" color="secondary">
                      {entry.definition}
                    </Text>
                  </View>
                ))}
              </View>
            </Card>
          </View>
        ) : null}

        {data.quiz.length > 0 ? (
          <View>
            <SectionHeader title="Vérifier ma compréhension" />
            <View style={{ gap: theme.spacing.lg }}>
              {data.quiz.map((question) => {
                const correction = corrections?.find((entry) => entry.questionId === question.id);
                return (
                  <Card key={question.id}>
                    <View style={{ gap: theme.spacing.md }}>
                      <Text variant="bodyStrong">{question.question}</Text>
                      <OptionList
                        options={question.options.map((option) => ({
                          value: option.id,
                          label: option.label,
                        }))}
                        value={answers[question.id] ?? null}
                        onChange={(value) =>
                          setAnswers((current) => ({ ...current, [question.id]: value }))
                        }
                      />
                      {correction ? (
                        <View
                          style={{
                            backgroundColor: correction.correct
                              ? theme.colors.positiveMuted
                              : theme.colors.infoMuted,
                            borderRadius: theme.radius.md,
                            padding: theme.spacing.md,
                            gap: theme.spacing.xs,
                          }}
                        >
                          <Text
                            variant="smallStrong"
                            color={correction.correct ? 'positive' : 'info'}
                          >
                            {correction.correct ? 'Réponse correcte' : 'Pour aller plus loin'}
                          </Text>
                          <Text variant="small" color={correction.correct ? 'positive' : 'info'}>
                            {correction.explanation}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  </Card>
                );
              })}
            </View>
          </View>
        ) : null}
      </View>
    </Screen>
  );
}
