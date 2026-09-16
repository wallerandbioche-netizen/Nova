import { Linking, Pressable, View } from 'react-native';
import type { SourceReference } from '@nova/types';
import { useTheme } from '../theme/index.js';
import { Text } from './Text.js';

export interface SourceListProps {
  sources: SourceReference[];
  title?: string;
}

/**
 * Sources block (transparency principle).
 *
 * Every important piece of financial information displays its source and its date. When no
 * source is available, the component says so instead of disappearing silently.
 */
export function SourceList({ sources, title = 'Sources' }: SourceListProps) {
  const theme = useTheme();

  const formatDate = (iso: string | null) => {
    if (!iso) return null;
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return null;
    return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeStyle: 'short' }).format(date);
  };

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <Text variant="smallStrong" color="secondary">
        {title}
      </Text>
      {sources.length === 0 ? (
        <Text variant="small" color="tertiary">
          Aucune source externe n’est associée à cette information.
        </Text>
      ) : (
        sources.map((source, index) => {
          const date = formatDate(source.publishedAt);
          const body = (
            <View style={{ gap: 2 }}>
              <Text variant="small" color={source.url ? 'accent' : 'primary'}>
                {source.name}
              </Text>
              {date ? (
                <Text variant="caption" color="tertiary">
                  Publié le {date}
                </Text>
              ) : null}
            </View>
          );

          return source.url ? (
            <Pressable
              key={`${source.name}-${index}`}
              accessibilityRole="link"
              accessibilityLabel={`${source.name}${date ? `, publié le ${date}` : ''}`}
              onPress={() => Linking.openURL(source.url as string)}
              hitSlop={6}
            >
              {body}
            </Pressable>
          ) : (
            <View key={`${source.name}-${index}`}>{body}</View>
          );
        })
      )}
    </View>
  );
}
