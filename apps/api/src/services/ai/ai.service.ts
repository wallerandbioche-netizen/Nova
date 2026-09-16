import type { Logger } from 'pino';
import type {
  AiAnswer,
  AiChatResult,
  AiConversation,
  AiMessage,
  ContentDepth,
  NewsAnalysis,
  NewsItem,
  PortfolioExposure,
  SourceReference,
} from '@nova/types';
import {
  AI_DISCLAIMER,
  CACHE_TTL,
  getPlan,
  REGION_LABELS,
  SECTOR_LABELS,
  THEME_LABELS,
} from '@nova/config';
import {
  findGuardrailViolation,
  llmAnswerSchema,
  llmNewsExplanationSchema,
  type LlmAnswer,
} from '@nova/validation';
import type { Env } from '../../config/env.js';
import type { Cache } from '../../infrastructure/cache/index.js';
import { cacheKey } from '../../infrastructure/cache/index.js';
import type { Database } from '../../infrastructure/database/prisma.js';
import { notFound, rateLimited } from '../../http/errors.js';
import type { PortfolioService } from '../../modules/portfolios/portfolio.service.js';
import type { NewsService } from '../news/news.service.js';
import type { PersonalizationService } from '../personalization/personalization.service.js';
import { renderContext, valueBand, type AiContext } from './context.js';
import { deterministicChatAnswer, deterministicNewsExplanation } from './deterministic-answer.js';
import { findGlossaryEntry } from './glossary.js';
import {
  ANSWER_FORMAT_INSTRUCTION,
  NEWS_EXPLANATION_INSTRUCTION,
  NOVA_SYSTEM_PROMPT,
  PROMPT_VERSION,
  depthInstruction,
} from './prompts.js';
import { LlmUnavailableError, type LlmProvider } from './providers/index.js';

interface GenerationOutcome<T> {
  value: T;
  isFallback: boolean;
  provider: string;
  model: string;
  latencyMs: number;
  promptTokens: number | null;
  completionTokens: number | null;
}

/**
 * AI orchestration.
 *
 * The model is an explanation layer, never a source of truth (rule #59). It receives only a
 * validated, minimised context, and its output is parsed, schema-validated and guardrail-checked
 * before display. On failure: one controlled retry, then a deterministic answer built from the
 * same data. The user always gets a usable answer, never an invented one.
 */
export class AiService {
  constructor(
    private readonly db: Database,
    private readonly env: Env,
    private readonly provider: LlmProvider,
    private readonly personalization: PersonalizationService,
    private readonly portfolios: PortfolioService,
    private readonly news: NewsService,
    private readonly cache: Cache,
    private readonly logger: Logger,
  ) {}

  get providerName(): string {
    return this.provider.name;
  }

  /** Extracts the first JSON object from a model answer, tolerating code fences and prose. */
  private extractJson(text: string): unknown {
    const withoutFences = text.replace(/```(?:json)?/gi, '').trim();
    const start = withoutFences.indexOf('{');
    const end = withoutFences.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) return null;
    try {
      return JSON.parse(withoutFences.slice(start, end + 1));
    } catch {
      return null;
    }
  }

  /**
   * Validates a model answer: schema, guardrail phrasing, and source honesty.
   * A source the context did not provide is a fabricated source, which is rejected outright.
   */
  private validateAnswer(
    raw: unknown,
    allowedSources: SourceReference[],
  ): { ok: true; value: LlmAnswer } | { ok: false; reason: string } {
    const parsed = llmAnswerSchema.safeParse(raw);
    if (!parsed.success) {
      return { ok: false, reason: `schema: ${parsed.error.issues[0]?.message ?? 'invalid'}` };
    }

    const answer = parsed.data;
    const text = [
      answer.shortAnswer,
      answer.whyItMatters,
      answer.portfolioRelevance ?? '',
      ...answer.whatWeKnow,
    ].join(' ');

    const violation = findGuardrailViolation(text);
    if (violation) return { ok: false, reason: `guardrail: ${violation}` };

    const allowedNames = new Set(allowedSources.map((source) => source.name.toLowerCase()));
    const allowedUrls = new Set(
      allowedSources.map((source) => source.url).filter((url): url is string => Boolean(url)),
    );
    const invented = answer.sources.find(
      (source) =>
        !allowedNames.has(source.name.toLowerCase()) &&
        !(source.url && allowedUrls.has(source.url)),
    );
    if (invented) return { ok: false, reason: `fabricated source: ${invented.name}` };

    return { ok: true, value: answer };
  }

  /** Calls the model, validates, retries once, then falls back to the deterministic answer. */
  private async generate<T>(options: {
    instruction: string;
    context: AiContext;
    validate: (raw: unknown) => { ok: true; value: T } | { ok: false; reason: string };
    fallback: () => T;
  }): Promise<GenerationOutcome<T>> {
    const userPrompt = [
      options.instruction,
      depthInstruction(options.context.investor?.depth ?? 'simple'),
      ANSWER_FORMAT_INSTRUCTION,
      renderContext(options.context),
      options.context.question ? `Question de l'utilisateur : ${options.context.question}` : '',
    ]
      .filter(Boolean)
      .join('\n\n');

    let lastReason = 'not attempted';
    let totalLatency = 0;
    let promptTokens: number | null = null;
    let completionTokens: number | null = null;

    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        const completion = await this.provider.complete({
          systemPrompt: NOVA_SYSTEM_PROMPT,
          maxOutputTokens: this.env.LLM_MAX_OUTPUT_TOKENS,
          userPrompt:
            attempt === 1
              ? userPrompt
              : `${userPrompt}\n\nTa réponse précédente était invalide (${lastReason}). Respecte strictement le format JSON demandé et n'utilise que les sources fournies.`,
        });
        totalLatency += completion.latencyMs;
        promptTokens = completion.promptTokens;
        completionTokens = completion.completionTokens;

        const validated = options.validate(this.extractJson(completion.text));
        if (validated.ok) {
          return {
            value: validated.value,
            isFallback: false,
            provider: this.provider.name,
            model: completion.model,
            latencyMs: totalLatency,
            promptTokens,
            completionTokens,
          };
        }
        lastReason = validated.reason;
        this.logger.warn(
          { attempt, reason: validated.reason, provider: this.provider.name },
          'LLM answer rejected',
        );
      } catch (error) {
        lastReason = error instanceof LlmUnavailableError ? error.message : 'provider error';
        this.logger.warn({ err: error, attempt }, 'LLM call failed');
        // A transport failure will not be fixed by an immediate retry of the same request.
        if (error instanceof LlmUnavailableError) break;
      }
    }

    this.logger.info({ reason: lastReason }, 'falling back to the deterministic answer');
    return {
      value: options.fallback(),
      isFallback: true,
      provider: this.provider.name,
      model: `${this.provider.model}-fallback`,
      latencyMs: totalLatency,
      promptTokens,
      completionTokens,
    };
  }

  /** Builds the minimised context sent to the model. */
  async buildContext(options: {
    userId: string;
    intent: AiContext['intent'];
    question?: string | null;
    depth: ContentDepth;
    news?: NewsItem | null;
    includePortfolio?: boolean;
  }): Promise<AiContext> {
    const [profile, user] = await Promise.all([
      this.db.investorProfile.findUnique({ where: { userId: options.userId } }),
      this.db.user.findUnique({ where: { id: options.userId }, select: { contentDepth: true } }),
    ]);

    const depth = options.depth ?? user?.contentDepth ?? 'simple';

    let portfolioContext: AiContext['portfolio'] = null;
    if (options.includePortfolio !== false) {
      const exposure = await this.personalization.getExposure(options.userId);
      if (exposure) {
        const portfolio = await this.portfolios.getDefault(options.userId);
        const analytics = portfolio
          ? await this.portfolios.getAnalytics(portfolio.id, options.userId)
          : null;

        portfolioContext = {
          valueBand: valueBand(exposure.totalValue, exposure.baseCurrency),
          baseCurrency: exposure.baseCurrency,
          positionCount: exposure.symbols.length,
          topSectors: Object.entries(exposure.bySector)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([key, percent]) => ({ label: SECTOR_LABELS[key] ?? key, percent })),
          topRegions: Object.entries(exposure.byRegion)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 4)
            .map(([key, percent]) => ({
              label: REGION_LABELS[key as keyof typeof REGION_LABELS] ?? key,
              percent,
            })),
          byAssetType: Object.entries(exposure.byAssetType).map(([key, percent]) => ({
            label: key,
            percent,
          })),
          heldSymbols: exposure.symbols,
          concentrationTopPercent: analytics?.concentration.topPositionPercent ?? 0,
          dayChangePercent: analytics?.dayChangePercent ?? null,
          totalReturnPercent: analytics?.totalUnrealizedGainPercent ?? null,
          themeExposure: Object.entries(exposure.byTheme)
            .filter(([, percent]) => percent > 0)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([theme, percent]) => ({
              theme: THEME_LABELS[theme as keyof typeof THEME_LABELS] ?? theme,
              percent,
            })),
          isDemoData: exposure.meta.isDemo,
          asOf: exposure.meta.asOf,
        };
      }
    }

    const sources: SourceReference[] = options.news
      ? [
          {
            name: options.news.source,
            url: options.news.sourceUrl,
            publishedAt: options.news.publishedAt,
          },
        ]
      : [];

    const glossaryEntry = options.question ? findGlossaryEntry(options.question) : null;

    return {
      intent: options.intent,
      question: options.question ?? null,
      investor: profile
        ? {
            experienceLevel: profile.experienceLevel,
            knowledgeLevel: profile.knowledgeLevel,
            investmentHorizon: profile.investmentHorizon as never,
            riskTolerance: profile.riskTolerance,
            depth,
          }
        : {
            experienceLevel: 'beginner',
            knowledgeLevel: 'beginner',
            investmentHorizon: '5_to_10_years' as never,
            riskTolerance: 'balanced',
            depth,
          },
      portfolio: portfolioContext,
      news: options.news
        ? {
            id: options.news.id,
            title: options.news.title,
            summary: options.news.summary,
            source: options.news.source,
            sourceUrl: options.news.sourceUrl,
            publishedAt: options.news.publishedAt,
            category: options.news.category,
            importanceScore: options.news.importanceScore,
            confidenceScore: options.news.confidenceScore,
            horizon: options.news.horizon,
            affectedAssets: options.news.affectedAssets.map((asset) => ({
              symbol: asset.symbol,
              name: asset.name,
            })),
            affectedSectors: options.news.affectedSectors.map((sector) => sector.label),
            isDemo: options.news.isDemo,
          }
        : null,
      market: null,
      glossary: glossaryEntry
        ? {
            term: glossaryEntry.term,
            definition: depth === 'detailed' ? glossaryEntry.detailed : glossaryEntry.simple,
          }
        : null,
      sources,
    };
  }

  /** Enforces the per-plan daily question quota. */
  private async assertQuota(userId: string, plan: 'free' | 'premium'): Promise<number | null> {
    const limit = getPlan(plan).limits.aiQuestionsPerDay;
    if (limit === null) return null;

    const key = cacheKey('quota', 'ai', userId, new Date().toISOString().slice(0, 10));
    const used = await this.cache.increment(key, 86_400);
    // -1 means the counter itself failed; we fail open rather than block a paying user.
    if (used === -1) return null;
    if (used > limit) {
      throw rateLimited(
        `Vous avez atteint votre limite de ${limit} questions par jour. Elle se réinitialise demain.`,
      );
    }
    return Math.max(limit - used, 0);
  }

  async chat(options: {
    userId: string;
    message: string;
    conversationId?: string;
    depth: ContentDepth;
    plan: 'free' | 'premium';
    newsId?: string;
  }): Promise<AiChatResult> {
    const remainingQuota = await this.assertQuota(options.userId, options.plan);

    const news = options.newsId ? await this.news.getById(options.newsId) : null;
    const context = await this.buildContext({
      userId: options.userId,
      intent: news ? 'news' : 'chat',
      question: options.message,
      depth: options.depth,
      news,
    });

    const outcome = await this.generate<LlmAnswer>({
      instruction: news
        ? NEWS_EXPLANATION_INSTRUCTION
        : 'Réponds à la question de l’utilisateur en te limitant strictement au contexte fourni.',
      context,
      validate: (raw) => this.validateAnswer(raw, context.sources),
      fallback: () => deterministicChatAnswer(context),
    });

    const conversation = options.conversationId
      ? await this.getOwnedConversation(options.conversationId, options.userId)
      : await this.db.aiConversation.create({
          data: {
            userId: options.userId,
            title: options.message.slice(0, 60),
          },
        });

    await this.db.aiMessage.create({
      data: {
        conversationId: conversation.id,
        role: 'user',
        content: options.message,
      },
    });

    const answer: AiAnswer = {
      ...outcome.value,
      disclaimer: AI_DISCLAIMER,
      generatedBy: {
        provider: outcome.provider,
        model: outcome.model,
        isFallback: outcome.isFallback,
      },
    };

    const stored = await this.db.aiMessage.create({
      data: {
        conversationId: conversation.id,
        role: 'assistant',
        content: answer.shortAnswer,
        answer: answer as never,
        provider: outcome.provider,
        model: outcome.model,
        isFallback: outcome.isFallback,
        promptTokens: outcome.promptTokens,
        completionTokens: outcome.completionTokens,
        latencyMs: outcome.latencyMs,
      },
    });

    await this.db.aiConversation.update({
      where: { id: conversation.id },
      data: { updatedAt: new Date() },
    });

    this.logger.info(
      {
        userId: options.userId,
        provider: outcome.provider,
        isFallback: outcome.isFallback,
        latencyMs: outcome.latencyMs,
        promptVersion: PROMPT_VERSION,
      },
      'ai answer generated',
    );

    return {
      conversationId: conversation.id,
      message: {
        id: stored.id,
        role: 'assistant',
        content: answer.shortAnswer,
        answer,
        createdAt: stored.createdAt.toISOString(),
      },
      depth: options.depth,
      remainingQuota,
    };
  }

  /** "Pourquoi cela vous concerne ?" for one news item. */
  async explainNews(options: {
    userId: string;
    newsId: string;
    depth: ContentDepth;
    exposure: PortfolioExposure | null;
  }): Promise<NewsAnalysis> {
    const news = await this.news.getById(options.newsId);
    const themes = await this.news.withThemes([news]);

    const scored = {
      ...this.news.toScored(news),
      themeKeys: themes.get(news.id) ?? [],
    };
    const relevance = this.personalization.computeRelevance(scored, options.exposure);

    // The relevance engine works on symbols; the user reads names.
    const nameBySymbol = new Map(news.affectedAssets.map((asset) => [asset.symbol, asset.name]));
    const exposure = relevance.exposure.map((entry) =>
      entry.kind === 'asset'
        ? {
            ...entry,
            label: entry.label
              .split(', ')
              .map((symbol) => nameBySymbol.get(symbol) ?? symbol)
              .join(', '),
          }
        : entry,
    );

    const context = await this.buildContext({
      userId: options.userId,
      intent: 'news',
      question: null,
      depth: options.depth,
      news,
    });

    // Cache the non-personalised part of the explanation; the exposure block is per user.
    const key = cacheKey('news', 'analysis', news.id, options.depth);
    let explanation = await this.cache.get<{
      summary: string;
      whyItMatters: string;
      uncertainties: string[];
      confidence: number;
      isFallback: boolean;
    }>(key);

    if (!explanation) {
      const outcome = await this.generate({
        instruction: NEWS_EXPLANATION_INSTRUCTION,
        context: { ...context, portfolio: null },
        validate: (raw) => {
          const parsed = llmNewsExplanationSchema.safeParse(raw);
          if (!parsed.success) {
            return { ok: false as const, reason: parsed.error.issues[0]?.message ?? 'invalid' };
          }
          const violation = findGuardrailViolation(
            `${parsed.data.summary} ${parsed.data.whyItMatters}`,
          );
          if (violation) return { ok: false as const, reason: `guardrail: ${violation}` };
          return { ok: true as const, value: parsed.data };
        },
        fallback: () => deterministicNewsExplanation({ ...context, portfolio: null }),
      });

      explanation = {
        summary: outcome.value.summary,
        whyItMatters: outcome.value.whyItMatters,
        uncertainties: outcome.value.uncertainties,
        confidence: outcome.value.confidence,
        isFallback: outcome.isFallback,
      };
      await this.cache.set(key, explanation, CACHE_TTL.newsAnalysis);
    }

    // The personalised part is always deterministic: it restates computed exposure, which must
    // never be paraphrased by a model into something the numbers do not support.
    const personalStatements = deterministicNewsExplanation(context);

    return {
      newsId: news.id,
      whatHappened: { kind: 'fact', text: explanation.summary },
      whyItMatters: { kind: 'analysis', text: explanation.whyItMatters },
      affectedAssets: news.affectedAssets,
      affectedSectors: news.affectedSectors,
      yourExposure: exposure,
      yourExposureSummary: buildExposureSummary(exposure),
      whyItConcernsYou: personalStatements.portfolioRelevance
        ? [{ kind: 'hypothesis', text: personalStatements.portfolioRelevance }]
        : [
            {
              kind: 'analysis',
              text: options.exposure
                ? 'Aucune exposition directe identifiée entre cette actualité et votre portefeuille.'
                : 'Ajoutez vos positions pour que NOVA puisse relier cette actualité à votre portefeuille.',
            },
          ],
      uncertainties: explanation.uncertainties,
      sources: context.sources,
      importanceScore: news.importanceScore,
      confidenceScore: news.confidenceScore,
      portfolioRelevanceScore: relevance.score,
      horizon: news.horizon,
      isFallback: explanation.isFallback,
      generatedAt: new Date().toISOString(),
      meta: {
        asOf: news.publishedAt,
        isDemo: news.isDemo,
        provider: this.news.providerName,
        sources: context.sources,
      },
    };
  }

  async explainPortfolio(options: {
    userId: string;
    portfolioId: string;
    question?: string;
    depth: ContentDepth;
  }): Promise<AiAnswer> {
    await this.portfolios.getOwned(options.portfolioId, options.userId);
    const context = await this.buildContext({
      userId: options.userId,
      intent: 'portfolio',
      question: options.question ?? 'Explique-moi la composition de mon portefeuille.',
      depth: options.depth,
    });

    const outcome = await this.generate<LlmAnswer>({
      instruction:
        'Explique la composition et l’exposition du portefeuille à partir des pourcentages fournis. Ne formule aucune recommandation d’achat ou de vente.',
      context,
      validate: (raw) => this.validateAnswer(raw, context.sources),
      fallback: () => deterministicChatAnswer(context),
    });

    return {
      ...outcome.value,
      disclaimer: AI_DISCLAIMER,
      generatedBy: {
        provider: outcome.provider,
        model: outcome.model,
        isFallback: outcome.isFallback,
      },
    };
  }

  async getOwnedConversation(conversationId: string, userId: string) {
    const conversation = await this.db.aiConversation.findUnique({
      where: { id: conversationId },
    });
    if (!conversation || conversation.userId !== userId) {
      throw notFound('Conversation introuvable');
    }
    return conversation;
  }

  async getConversation(conversationId: string, userId: string): Promise<AiConversation> {
    const conversation = await this.getOwnedConversation(conversationId, userId);
    const messages = await this.db.aiMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      take: 200,
    });

    return {
      id: conversation.id,
      title: conversation.title,
      createdAt: conversation.createdAt.toISOString(),
      updatedAt: conversation.updatedAt.toISOString(),
      messages: messages.map((message): AiMessage => ({
        id: message.id,
        role: message.role === 'user' ? 'user' : 'assistant',
        content: message.content,
        answer: (message.answer as AiAnswer | null) ?? null,
        createdAt: message.createdAt.toISOString(),
      })),
    };
  }

  async listConversations(userId: string, limit = 20) {
    const conversations = await this.db.aiConversation.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      take: limit,
    });
    return conversations.map((conversation) => ({
      id: conversation.id,
      title: conversation.title,
      createdAt: conversation.createdAt.toISOString(),
      updatedAt: conversation.updatedAt.toISOString(),
    }));
  }

  /** Generates the narrative parts of a daily brief. Falls back to deterministic prose. */
  async generateBriefNarrative(context: AiContext, items: { id: string; title: string }[]) {
    void items;
    const outcome = await this.generate<LlmAnswer>({
      instruction:
        'Rédige une synthèse matinale à partir du contexte fourni, sans recommandation d’action.',
      context,
      validate: (raw) => this.validateAnswer(raw, context.sources),
      fallback: () => deterministicChatAnswer(context),
    });
    return outcome;
  }

  async healthCheck(): Promise<boolean> {
    return this.provider.healthCheck();
  }
}

function buildExposureSummary(exposure: { label: string; percent: number }[]): string {
  if (exposure.length === 0) {
    return 'Aucune exposition identifiée entre cette actualité et votre portefeuille.';
  }
  const first = exposure[0];
  if (!first) return 'Aucune exposition identifiée.';
  return `Votre portefeuille possède environ ${first.percent.toFixed(1).replace('.', ',')} % d’exposition à « ${first.label} ».`;
}
