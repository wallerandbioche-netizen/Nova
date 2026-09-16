import React from 'react';
import { View } from 'react-native';
import type { AiAnswer } from '@nova/types';
import { useTheme } from '../theme/index.js';
import { Badge } from './Badge.js';
import { Card } from './Card.js';
import { SourceList } from './SourceList.js';
import { Text } from './Text.js';

export interface AIMessageProps {
  role: 'user' | 'assistant';
  content: string;
  answer?: AiAnswer | null;
}

/**
 * A NOVA answer.
 *
 * Renders the mandated structure (rule #16): short answer, what we know, why it matters, what
 * concerns your portfolio, what remains uncertain, sources. The uncertainty block is always
 * rendered when present — it is never collapsed away to make the answer look more confident.
 */
export function AIMessage({ role, content, answer }: AIMessageProps) {
  const theme = useTheme();

  if (role === 'user') {
    return (
      <View
        accessible
        accessibilityLabel={`Votre question : ${content}`}
        style={{
          alignSelf: 'flex-end',
          maxWidth: '85%',
          backgroundColor: theme.colors.accentMuted,
          borderRadius: theme.radius.lg,
          paddingHorizontal: theme.spacing.lg,
          paddingVertical: theme.spacing.md,
        }}
      >
        <Text variant="body">{content}</Text>
      </View>
    );
  }

  if (!answer) {
    return (
      <Card>
        <Text variant="body">{content}</Text>
      </Card>
    );
  }

  return (
    <Card>
      <View style={{ gap: theme.spacing.lg }}>
        <View style={{ gap: theme.spacing.sm }}>
          <Text variant="body">{answer.shortAnswer}</Text>
          {answer.generatedBy.isFallback ? (
            <Badge
              label="Réponse générée sans modèle"
              tone="warning"
              accessibilityLabel="Réponse générée à partir de vos données, sans modèle de langage"
            />
          ) : null}
        </View>

        {answer.whatWeKnow.length > 0 ? (
          <Block title="Ce que l’on sait">
            {answer.whatWeKnow.map((fact, index) => (
              <Text key={index} variant="small" color="secondary">
                • {fact}
              </Text>
            ))}
          </Block>
        ) : null}

        {answer.whyItMatters ? (
          <Block title="Pourquoi cela compte">
            <Text variant="small" color="secondary">
              {answer.whyItMatters}
            </Text>
          </Block>
        ) : null}

        {answer.portfolioRelevance ? (
          <Block title="Ce qui concerne votre portefeuille">
            <Text variant="small" color="secondary">
              {answer.portfolioRelevance}
            </Text>
          </Block>
        ) : null}

        {answer.uncertainties.length > 0 ? (
          <View
            style={{
              backgroundColor: theme.colors.warningMuted,
              borderRadius: theme.radius.md,
              padding: theme.spacing.md,
              gap: theme.spacing.xs,
            }}
          >
            <Text variant="smallStrong" color="warning">
              Ce qui reste incertain
            </Text>
            {answer.uncertainties.map((uncertainty, index) => (
              <Text key={index} variant="small" color="warning">
                • {uncertainty}
              </Text>
            ))}
          </View>
        ) : null}

        <SourceList sources={answer.sources} />

        <Text variant="caption" color="tertiary">
          {answer.disclaimer}
        </Text>
      </View>
    </Card>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={{ gap: theme.spacing.xs }}>
      <Text variant="smallStrong" color="secondary">
        {title}
      </Text>
      {children}
    </View>
  );
}
