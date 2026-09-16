import { describe, expect, it } from 'vitest';
import {
  deterministicChatAnswer,
  deterministicNewsExplanation,
  deterministicPortfolioAnswer,
} from './deterministic-answer.js';
import { findGuardrailViolation } from '@nova/validation';
import type { AiContext } from './context.js';

function context(overrides: Partial<AiContext> = {}): AiContext {
  return {
    intent: 'chat',
    question: null,
    investor: {
      experienceLevel: 'beginner',
      knowledgeLevel: 'beginner',
      investmentHorizon: '10_to_20_years',
      riskTolerance: 'balanced',
      depth: 'simple',
    },
    portfolio: null,
    news: null,
    market: null,
    glossary: null,
    sources: [],
    ...overrides,
  };
}

const portfolio: NonNullable<AiContext['portfolio']> = {
  valueBand: '10 000 – 50 000 EUR',
  baseCurrency: 'EUR',
  positionCount: 3,
  topSectors: [
    { label: 'Technologie', percent: 42 },
    { label: 'Énergie', percent: 18 },
  ],
  topRegions: [{ label: 'Amérique du Nord', percent: 61 }],
  byAssetType: [{ label: 'etf', percent: 100 }],
  heldSymbols: ['AAPL', 'CW8.PA'],
  concentrationTopPercent: 45,
  dayChangePercent: -1.2,
  totalReturnPercent: 8.4,
  themeExposure: [{ theme: 'Technologie', percent: 42 }],
  isDemoData: true,
  asOf: '2026-09-16T17:30:00.000Z',
};

const news: NonNullable<AiContext['news']> = {
  id: 'news-1',
  title: 'Le pétrole progresse de 3 %',
  summary: 'Les prix du baril montent après une réduction de l’offre.',
  source: 'Reuters',
  sourceUrl: 'https://example.test/a',
  publishedAt: '2026-09-16T06:00:00.000Z',
  category: 'commodities',
  importanceScore: 62,
  confidenceScore: 80,
  horizon: 'short_term',
  affectedAssets: [{ symbol: 'TTE.PA', name: 'TotalEnergies' }],
  affectedSectors: ['Énergie'],
  isDemo: true,
};

describe('advice requests', () => {
  it.each([
    'Est-ce que je dois acheter des actions Apple ?',
    'Dois-je vendre mon ETF World ?',
    'Faut-il investir maintenant ?',
    'Est-ce le bon moment pour acheter ?',
    'Que me conseillez-vous ?',
  ])('declines explicitly: %s', (question) => {
    const answer = deterministicChatAnswer(context({ question, portfolio }));
    expect(answer.shortAnswer).toMatch(/ne donne pas de recommandation/i);
    // The refusal states the real reason rather than claiming missing data.
    expect(answer.shortAnswer).not.toMatch(/pas suffisamment de données/i);
    expect(answer.uncertainties.length).toBeGreaterThan(0);
  });

  it('does not mistake an explanatory question for an advice request', () => {
    const answer = deterministicChatAnswer(
      context({ question: 'Pourquoi les gens achètent-ils des obligations ?', portfolio }),
    );
    expect(answer.shortAnswer).not.toMatch(/ne donne pas de recommandation/i);
  });
});

describe('definition questions', () => {
  it('answers from the curated glossary', () => {
    const answer = deterministicChatAnswer(context({ question: 'Qu’est-ce qu’un ETF ?' }));
    expect(answer.shortAnswer).toMatch(/fonds coté en bourse/i);
    expect(answer.uncertainties.length).toBeGreaterThan(0);
  });

  it('gives a deeper answer when detailed is requested', () => {
    const simple = deterministicChatAnswer(context({ question: 'Explique-moi la volatilité.' }));
    const detailed = deterministicChatAnswer(
      context({
        question: 'Explique-moi la volatilité.',
        investor: {
          ...(context().investor as NonNullable<AiContext['investor']>),
          depth: 'detailed',
        },
      }),
    );
    expect(detailed.shortAnswer.length).toBeGreaterThan(simple.shortAnswer.length);
  });
});

describe('portfolio answers', () => {
  it('restates computed figures and discloses demo data', () => {
    const answer = deterministicPortfolioAnswer(context({ portfolio }));
    expect(answer.shortAnswer).toMatch(/-1,2 %/);
    expect(answer.whatWeKnow.join(' ')).toMatch(/3 positions/);
    expect(answer.whatWeKnow.join(' ')).toMatch(/démonstration/i);
  });

  it('says the day change is unavailable rather than showing zero', () => {
    const answer = deterministicPortfolioAnswer(
      context({ portfolio: { ...portfolio, dayChangePercent: null } }),
    );
    expect(answer.whatWeKnow.join(' ')).toMatch(/n’est pas disponible/i);
    expect(answer.shortAnswer).not.toMatch(/0,0 %/);
  });

  it('invites an empty portfolio to add positions', () => {
    const answer = deterministicPortfolioAnswer(
      context({ portfolio: { ...portfolio, positionCount: 0 } }),
    );
    expect(answer.shortAnswer).toMatch(/ne contient pas encore de position/i);
  });
});

describe('news explanations', () => {
  it('states direct exposure when the user holds an affected asset', () => {
    const explanation = deterministicNewsExplanation(
      context({ news, portfolio: { ...portfolio, heldSymbols: ['TTE.PA'] } }),
    );
    expect(explanation.portfolioRelevance).toMatch(/TotalEnergies/);
    expect(explanation.uncertainties.length).toBeGreaterThan(0);
  });

  it('describes indirect exposure through a sector, in the conditional', () => {
    // The portfolio holds 18 % energy and the item affects energy: the link is real but
    // indirect, and must be phrased as such rather than as a certain effect.
    const explanation = deterministicNewsExplanation(context({ news, portfolio }));
    expect(explanation.portfolioRelevance).toMatch(/Énergie/);
    expect(explanation.portfolioRelevance).toMatch(/indirect/i);
    expect(explanation.portfolioRelevance).toMatch(/serait|pourrait|peut/i);
  });

  it('says plainly when nothing connects the news to the portfolio', () => {
    const unrelated = {
      ...portfolio,
      heldSymbols: ['CW8.PA'],
      topSectors: [{ label: 'Santé', percent: 100 }],
    };
    const explanation = deterministicNewsExplanation(context({ news, portfolio: unrelated }));
    expect(explanation.portfolioRelevance).toMatch(/aucune exposition/i);
  });

  it('reports missing context instead of improvising', () => {
    const explanation = deterministicNewsExplanation(context());
    expect(explanation.summary).toMatch(/pas suffisamment de données/i);
    expect(explanation.confidence).toBeLessThan(0.5);
  });
});

describe('guardrails', () => {
  it('never produces a forbidden phrasing across every answer shape', () => {
    const answers = [
      deterministicChatAnswer(context({ question: 'Dois-je acheter ?', portfolio })),
      deterministicChatAnswer(context({ question: 'Qu’est-ce qu’un ETF ?', portfolio })),
      deterministicPortfolioAnswer(context({ portfolio })),
      deterministicChatAnswer(context({ question: 'Et le pétrole ?', news, portfolio })),
    ];

    for (const answer of answers) {
      const text = [
        answer.shortAnswer,
        answer.whyItMatters,
        answer.portfolioRelevance ?? '',
        ...answer.whatWeKnow,
        ...answer.uncertainties,
      ].join(' ');
      expect(findGuardrailViolation(text)).toBeNull();
    }
  });
});
