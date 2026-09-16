import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { NEWS_CATEGORY_LABELS } from '@nova/config';
import type { NewsAnalysis, NewsCategory, NewsItem } from '@nova/types';
import {
  Badge,
  Button,
  Card,
  DemoBadge,
  ErrorState,
  Screen,
  SectionHeader,
  SegmentedControl,
  SkeletonCard,
  SourceList,
  Text,
  useTheme,
} from '@nova/ui';
import { useNovaQuery } from '../../src/hooks/use-nova-query';
import { formatDateTime } from '../../src/lib/format';
import { useAuth } from '../../src/state/auth-context';

/**
 * News detail — "Pourquoi cela vous concerne ?".
 *
 * The screen follows the mandated structure: what happened (fact), why it matters (analysis),
 * affected assets and sectors, YOUR exposure (figures computed server-side), why it may concern
 * you (explicitly a hypothesis), what we do not know, and the sources.
 *
 * The epistemic status of each block is visible, not implied.
 */
export default function NewsDetailScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { api } = useAuth();

  const [depth, setDepth] = useState<'simple' | 'detailed'>('simple');

  const news = useNovaQuery<NewsItem>({
    queryKey: ['news', id],
    queryFn: () => api.news.detail(id as string),
    cacheKey: `news.${id}`,
    enabled: Boolean(id),
  });

  const analysis = useNovaQuery<NewsAnalysis>({
    queryKey: ['news', id, 'analysis', depth],
    queryFn: () => api.news.analysis(id as string, depth),
    cacheKey: `news.${id}.analysis.${depth}`,
    enabled: Boolean(id),
    staleTime: 10 * 60_000,
  });

  if (news.isLoading) {
    return (
      <Screen>
        <View style={{ gap: theme.spacing.lg }}>
          <SkeletonCard lines={3} />
          <SkeletonCard lines={4} />
        </View>
      </Screen>
    );
  }

  if (news.error || !news.data) {
    return (
      <Screen>
        <ErrorState
          offline={news.isOffline}
          onRetry={() => void news.refetch()}
          requestId={news.error?.requestId}
        />
      </Screen>
    );
  }

  const item = news.data;
  const detail = analysis.data;

  return (
    <Screen
      offline={news.isFromCache}
      lastUpdatedLabel={news.cachedAtLabel}
      footer={
        <Button
          label="Poser une question sur cette actualité"
          variant="secondary"
          fullWidth
          onPress={() => router.push(`/coach?newsId=${item.id}`)}
        />
      }
    >
      <View style={{ gap: theme.spacing['2xl'] }}>
        {/* ---------------------------------------------------------- Header */}
        <View style={{ gap: theme.spacing.md }}>
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm, flexWrap: 'wrap' }}>
            <Badge
              label={NEWS_CATEGORY_LABELS[item.category as NewsCategory] ?? item.category}
              tone="neutral"
            />
            <DemoBadge visible={item.isDemo} />
          </View>

          <Text variant="h1" accessibilityRole="header">
            {item.title}
          </Text>

          <Text variant="caption" color="tertiary">
            {item.source} · {formatDateTime(item.publishedAt)}
          </Text>
        </View>

        {/* ---------------------------------------------------------- Depth toggle */}
        <SegmentedControl<'simple' | 'detailed'>
          value={depth}
          onChange={setDepth}
          accessibilityLabel="Niveau de détail de l’explication"
          options={[
            { value: 'simple', label: 'Simple' },
            { value: 'detailed', label: 'Détaillé' },
          ]}
        />

        {analysis.isLoading ? (
          <SkeletonCard lines={5} />
        ) : analysis.error ? (
          <>
            {/* The factual content stays readable even when the explanation fails. */}
            <Card>
              <View style={{ gap: theme.spacing.sm }}>
                <Text variant="smallStrong" color="secondary">
                  Ce qui s’est passé
                </Text>
                <Text variant="body">{item.summary}</Text>
              </View>
            </Card>
            <ErrorState
              title="L’explication personnalisée n’est pas disponible."
              description="Le résumé factuel et les sources restent consultables. Vous pouvez réessayer."
              offline={analysis.isOffline}
              onRetry={() => void analysis.refetch()}
              requestId={analysis.error.requestId}
            />
          </>
        ) : detail ? (
          <>
            <Block title="Ce qui s’est passé" kind="Fait">
              <Text variant="body">{detail.whatHappened.text}</Text>
            </Block>

            <Block title="Pourquoi c’est important" kind="Analyse">
              <Text variant="body" color="secondary">
                {detail.whyItMatters.text}
              </Text>
            </Block>

            {/* -------------------------------------------------- Affected assets */}
            {detail.affectedAssets.length > 0 || detail.affectedSectors.length > 0 ? (
              <View>
                <SectionHeader title="Actifs et secteurs concernés" />
                <Card>
                  <View style={{ gap: theme.spacing.md }}>
                    {detail.affectedAssets.length > 0 ? (
                      <View style={{ gap: theme.spacing.xs }}>
                        <Text variant="caption" color="secondary">
                          Actifs
                        </Text>
                        <View
                          style={{ flexDirection: 'row', gap: theme.spacing.sm, flexWrap: 'wrap' }}
                        >
                          {detail.affectedAssets.map((asset) => (
                            <Badge key={asset.assetId} label={asset.name} tone="neutral" />
                          ))}
                        </View>
                      </View>
                    ) : null}

                    {detail.affectedSectors.length > 0 ? (
                      <View style={{ gap: theme.spacing.xs }}>
                        <Text variant="caption" color="secondary">
                          Secteurs
                        </Text>
                        <View
                          style={{ flexDirection: 'row', gap: theme.spacing.sm, flexWrap: 'wrap' }}
                        >
                          {detail.affectedSectors.map((sector) => (
                            <Badge key={sector.sectorKey} label={sector.label} tone="neutral" />
                          ))}
                        </View>
                      </View>
                    ) : null}
                  </View>
                </Card>
              </View>
            ) : null}

            {/* -------------------------------------------------- Your exposure */}
            <View>
              <SectionHeader title="Votre exposition" />
              <Card>
                <View style={{ gap: theme.spacing.md }}>
                  <Text variant="body">{detail.yourExposureSummary}</Text>

                  {detail.yourExposure.length > 0 ? (
                    <View style={{ gap: theme.spacing.sm }}>
                      {detail.yourExposure.map((exposure, index) => (
                        <View
                          key={`${exposure.label}-${index}`}
                          accessible
                          accessibilityLabel={`${exposure.label} : ${exposure.percent
                            .toFixed(1)
                            .replace('.', ',')} pour cent`}
                          style={{ gap: 4 }}
                        >
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <Text variant="small" color="secondary">
                              {exposure.label}
                            </Text>
                            <Text variant="smallStrong" tabular>
                              {exposure.percent.toFixed(1).replace('.', ',')} %
                            </Text>
                          </View>
                          <View
                            accessibilityElementsHidden
                            style={{
                              height: 4,
                              borderRadius: 2,
                              backgroundColor: theme.colors.surfaceSecondary,
                              overflow: 'hidden',
                            }}
                          >
                            <View
                              style={{
                                width: `${Math.min(Math.max(exposure.percent, 1), 100)}%`,
                                height: '100%',
                                backgroundColor: theme.colors.accent,
                              }}
                            />
                          </View>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </View>
              </Card>
            </View>

            {/* -------------------------------------------------- Why it concerns you */}
            <Block title="Pourquoi cela peut vous concerner" kind="Hypothèse">
              <View style={{ gap: theme.spacing.sm }}>
                {detail.whyItConcernsYou.map((statement, index) => (
                  <Text key={index} variant="body" color="secondary">
                    {statement.text}
                  </Text>
                ))}
              </View>
            </Block>

            {/* -------------------------------------------------- Uncertainties */}
            <View>
              <SectionHeader title="Ce qu’on ne sait pas" />
              <View
                style={{
                  backgroundColor: theme.colors.warningMuted,
                  borderRadius: theme.radius.lg,
                  padding: theme.spacing.lg,
                  gap: theme.spacing.sm,
                }}
              >
                {detail.uncertainties.map((uncertainty, index) => (
                  <Text key={index} variant="small" color="warning">
                    • {uncertainty}
                  </Text>
                ))}
              </View>
            </View>

            {/* -------------------------------------------------- Scores */}
            <Card>
              <View style={{ gap: theme.spacing.sm }}>
                <Text variant="smallStrong" color="secondary">
                  Comment NOVA a classé cette information
                </Text>
                <ScoreRow label="Importance" value={detail.importanceScore} />
                <ScoreRow label="Confiance dans la source" value={detail.confidenceScore} />
                <ScoreRow
                  label="Lien avec votre portefeuille"
                  value={detail.portfolioRelevanceScore}
                />
                <Text variant="caption" color="tertiary">
                  Ces scores expriment une priorité de lecture. Ils ne constituent pas une prévision
                  de performance.
                </Text>
              </View>
            </Card>

            <SourceList sources={detail.sources} />
          </>
        ) : null}
      </View>
    </Screen>
  );
}

function Block({
  title,
  kind,
  children,
}: {
  title: string;
  kind: string;
  children: React.ReactNode;
}) {
  const theme = useTheme();
  return (
    <View style={{ gap: theme.spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
        <Text variant="h2" accessibilityRole="header">
          {title}
        </Text>
        <Badge
          label={kind}
          tone={kind === 'Fait' ? 'info' : kind === 'Analyse' ? 'neutral' : 'warning'}
        />
      </View>
      {children}
    </View>
  );
}

function ScoreRow({ label, value }: { label: string; value: number }) {
  const theme = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={`${label} : ${value} sur 100`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}
    >
      <Text variant="small" color="secondary" style={{ flex: 1 }}>
        {label}
      </Text>
      <View
        accessibilityElementsHidden
        style={{
          width: 80,
          height: 4,
          borderRadius: 2,
          backgroundColor: theme.colors.surfaceSecondary,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            width: `${Math.max(value, 2)}%`,
            height: '100%',
            backgroundColor: theme.colors.accent,
          }}
        />
      </View>
      <Text variant="caption" color="secondary" tabular>
        {value}/100
      </Text>
    </View>
  );
}
