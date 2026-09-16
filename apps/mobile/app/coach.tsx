import { useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { AiMessage } from '@nova/types';
import {
  AIMessage,
  Card,
  ChatInput,
  SegmentedControl,
  SkeletonCard,
  Text,
  useTheme,
} from '@nova/ui';
import { ApiError } from '../src/api/client';
import { useAuth } from '../src/state/auth-context';

const SUGGESTIONS = [
  'Pourquoi mon portefeuille baisse aujourd’hui ?',
  'Qu’est-ce qu’un ETF ?',
  'Quelle est mon exposition aux États-Unis ?',
  'Explique-moi les taux d’intérêt.',
];

/**
 * AI Coach.
 *
 * The conversation is stateless on the client: each answer is stored server-side with its
 * provenance. The Simple / Détaillé toggle is always available (rule #16), and the quota is
 * displayed calmly rather than as a countdown.
 */
export default function CoachScreen() {
  const theme = useTheme();
  const { newsId, topic } = useLocalSearchParams<{ newsId?: string; topic?: string }>();
  const { api } = useAuth();

  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [depth, setDepth] = useState<'simple' | 'detailed'>('simple');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remainingQuota, setRemainingQuota] = useState<number | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const send = async (message: string) => {
    setError(null);
    setPending(true);

    const optimistic: AiMessage = {
      id: `local-${Date.now()}`,
      role: 'user',
      content: message,
      answer: null,
      createdAt: new Date().toISOString(),
    };
    setMessages((current) => [...current, optimistic]);

    try {
      const result = await api.ai.chat({
        message,
        conversationId,
        depth,
        context: newsId ? { newsId } : undefined,
      });
      setConversationId(result.conversationId);
      setRemainingQuota(result.remainingQuota);
      setMessages((current) => [...current, result.message]);
    } catch (caught) {
      const apiError = caught instanceof ApiError ? caught : null;
      setError(
        apiError?.code === 'RATE_LIMITED'
          ? apiError.message
          : apiError?.isOffline
            ? 'Vous semblez hors connexion. NOVA a besoin du réseau pour répondre.'
            : 'NOVA n’a pas pu répondre. Vous pouvez réessayer.',
      );
      // Remove the optimistic message so the thread reflects what was actually exchanged.
      setMessages((current) => current.filter((item) => item.id !== optimistic.id));
    } finally {
      setPending(false);
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    }
  };

  const intro =
    topic === 'portfolio'
      ? 'Posez une question sur votre portefeuille : composition, exposition, variation du jour.'
      : newsId
        ? 'Posez une question sur cette actualité. NOVA répondra à partir des données dont il dispose.'
        : 'NOVA explique les marchés à partir de vos données et de sources identifiées. Il ne donne pas de conseil en investissement.';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={8}
      >
        <View
          style={{
            paddingHorizontal: theme.screenPadding,
            paddingTop: theme.spacing.lg,
            gap: theme.spacing.md,
          }}
        >
          <Text variant="h1" accessibilityRole="header">
            Demander à NOVA
          </Text>
          <SegmentedControl<'simple' | 'detailed'>
            value={depth}
            onChange={setDepth}
            accessibilityLabel="Niveau de détail des réponses"
            options={[
              { value: 'simple', label: 'Simple' },
              { value: 'detailed', label: 'Détaillé' },
            ]}
          />
        </View>

        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{
            padding: theme.screenPadding,
            gap: theme.spacing.md,
            paddingBottom: theme.spacing.xl,
          }}
          keyboardShouldPersistTaps="handled"
        >
          {messages.length === 0 ? (
            <View style={{ gap: theme.spacing.md }}>
              <Card>
                <Text variant="small" color="secondary">
                  {intro}
                </Text>
              </Card>
              <Text variant="smallStrong" color="secondary">
                Exemples de questions
              </Text>
              {SUGGESTIONS.map((suggestion) => (
                <Card
                  key={suggestion}
                  onPress={() => void send(suggestion)}
                  accessibilityLabel={`Poser la question : ${suggestion}`}
                >
                  <Text variant="small">{suggestion}</Text>
                </Card>
              ))}
            </View>
          ) : (
            messages.map((message) => (
              <AIMessage
                key={message.id}
                role={message.role}
                content={message.content}
                answer={message.answer}
              />
            ))
          )}

          {pending ? <SkeletonCard lines={3} /> : null}

          {error ? (
            <Card>
              <Text variant="small" color="negative" accessibilityRole="alert">
                {error}
              </Text>
            </Card>
          ) : null}
        </ScrollView>

        <View
          style={{
            paddingHorizontal: theme.screenPadding,
            paddingVertical: theme.spacing.md,
            borderTopWidth: 1,
            borderTopColor: theme.colors.border,
            backgroundColor: theme.colors.surface,
          }}
        >
          <ChatInput onSend={send} disabled={pending} remainingQuota={remainingQuota} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
