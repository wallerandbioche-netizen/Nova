import { View } from 'react-native';
import { NEWS_CATEGORY_LABELS } from '@nova/config';
import type { NewsCategory, PersonalizedNewsItem } from '@nova/types';
import { useTheme } from '../theme/index.js';
import { Badge } from './Badge.js';
import { Card } from './Card.js';
import { DemoBadge } from './DemoBadge.js';
import { Text } from './Text.js';

export interface NewsCardProps {
  item: PersonalizedNewsItem;
  onPress?: () => void;
  compact?: boolean;
}

function relativeTime(iso: string): string {
  const published = new Date(iso).getTime();
  if (Number.isNaN(published)) return '';
  const minutes = Math.round((Date.now() - published) / 60_000);
  if (minutes < 60) return `il y a ${Math.max(minutes, 1)} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.round(hours / 24);
  return `il y a ${days} j`;
}

/**
 * News card.
 *
 * Shows the source and the date (transparency), and — when it exists — the reason the item is
 * relevant to *this* user. It never shows an importance score as a headline number: a score is
 * a reading priority, not a verdict.
 */
export function NewsCard({ item, onPress, compact = false }: NewsCardProps) {
  const theme = useTheme();
  const isRelevant = item.portfolioRelevanceScore >= 40;

  return (
    <Card
      onPress={onPress}
      accessibilityLabel={`${item.title}. Source ${item.source}, ${relativeTime(item.publishedAt)}.${
        item.relevanceReason ? ` Concerne votre portefeuille : ${item.relevanceReason}.` : ''
      }`}
    >
      <View style={{ gap: theme.spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, flexWrap: 'wrap' }}>
          <Badge
            label={NEWS_CATEGORY_LABELS[item.category as NewsCategory] ?? item.category}
            tone="neutral"
          />
          {isRelevant ? <Badge label="Concerne votre portefeuille" tone="accent" /> : null}
          <DemoBadge visible={item.isDemo} />
        </View>

        <Text variant={compact ? 'bodyStrong' : 'h3'} numberOfLines={compact ? 2 : 3}>
          {item.title}
        </Text>

        {!compact ? (
          <Text variant="small" color="secondary" numberOfLines={3}>
            {item.summary}
          </Text>
        ) : null}

        {item.relevanceReason ? (
          <View
            style={{
              backgroundColor: theme.colors.accentMuted,
              borderRadius: theme.radius.sm,
              paddingHorizontal: theme.spacing.sm,
              paddingVertical: theme.spacing.xs + 2,
            }}
          >
            <Text variant="caption" color="accent">
              {item.relevanceReason}
            </Text>
          </View>
        ) : null}

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
          <Text variant="caption" color="tertiary">
            {item.source}
          </Text>
          <Text variant="caption" color="tertiary">
            ·
          </Text>
          <Text variant="caption" color="tertiary">
            {relativeTime(item.publishedAt)}
          </Text>
        </View>
      </View>
    </Card>
  );
}
