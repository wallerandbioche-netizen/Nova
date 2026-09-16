import { AI_DISCLAIMER, NEWS_CATEGORY_LABELS, NO_DATA_ANSWER } from '@nova/config';
import type { LlmAnswer, LlmNewsExplanation } from '@nova/validation';
import type { AiContext } from './context.js';
import { findGlossaryEntry } from './glossary.js';

/**
 * Deterministic answer composer.
 *
 * Two roles:
 *  1. it powers the demo LLM provider, so the product is fully usable without an API key;
 *  2. it is the fallback when a real model is unavailable or returns something invalid.
 *
 * It only ever restates data present in the context. When the context does not contain what is
 * needed, it says so explicitly instead of producing a plausible sentence (rule #15).
 */

function formatPercent(value: number): string {
  return `${value.toFixed(1).replace('.', ',')} %`;
}

function exposureSentences(context: AiContext): string[] {
  const portfolio = context.portfolio;
  if (!portfolio || portfolio.positionCount === 0) return [];

  const sentences: string[] = [];
  const topSector = portfolio.topSectors[0];
  if (topSector) {
    sentences.push(
      `Votre portefeuille possède environ ${formatPercent(topSector.percent)} d’exposition au secteur « ${topSector.label} ».`,
    );
  }
  const topRegion = portfolio.topRegions[0];
  if (topRegion) {
    sentences.push(
      `Sa répartition géographique est dominée par « ${topRegion.label} » (environ ${formatPercent(topRegion.percent)}).`,
    );
  }
  if (portfolio.concentrationTopPercent >= 30) {
    sentences.push(
      `Votre première ligne représente environ ${formatPercent(portfolio.concentrationTopPercent)} du portefeuille : une information la concernant a un effet proportionnellement plus visible.`,
    );
  }
  return sentences;
}

function intersectionWithHoldings(context: AiContext): {
  directSymbols: string[];
  sectorMatches: { label: string; percent: number }[];
} {
  const held = new Set(context.portfolio?.heldSymbols ?? []);
  const directSymbols = (context.news?.affectedAssets ?? [])
    .filter((asset) => held.has(asset.symbol))
    .map((asset) => asset.name);

  const affectedSectors = new Set(
    (context.news?.affectedSectors ?? []).map((sector) => sector.toLowerCase()),
  );
  const sectorMatches = (context.portfolio?.topSectors ?? []).filter((sector) =>
    affectedSectors.has(sector.label.toLowerCase()),
  );

  return { directSymbols, sectorMatches };
}

/** Builds the "Pourquoi cela vous concerne ?" explanation of a news item. */
export function deterministicNewsExplanation(context: AiContext): LlmNewsExplanation {
  const news = context.news;
  if (!news) {
    return {
      summary: NO_DATA_ANSWER,
      whyItMatters: NO_DATA_ANSWER,
      portfolioRelevance: null,
      uncertainties: ['Aucune actualité n’a été fournie pour cette analyse.'],
      confidence: 0.2,
    };
  }

  const { directSymbols, sectorMatches } = intersectionWithHoldings(context);

  const categoryLabel =
    NEWS_CATEGORY_LABELS[news.category as keyof typeof NEWS_CATEGORY_LABELS] ?? news.category;

  const whyItMatters = [
    `Cette information relève de la catégorie « ${categoryLabel} », dont l’horizon de lecture habituel est ${horizonLabel(news.horizon)}.`,
    news.affectedSectors.length > 0
      ? `Les secteurs identifiés comme concernés sont : ${news.affectedSectors.join(', ')}.`
      : 'Aucun secteur spécifique n’a été identifié comme directement concerné.',
    'Ce classement reflète une priorité de lecture, et non une prévision de performance.',
  ].join(' ');

  let portfolioRelevance: string | null = null;
  if (directSymbols.length > 0) {
    portfolioRelevance = `Vous détenez ${directSymbols.join(', ')}, directement cité${
      directSymbols.length > 1 ? 's' : ''
    } par cette actualité. Cette information peut donc concerner une partie identifiable de votre portefeuille.`;
  } else if (sectorMatches.length > 0) {
    const sector = sectorMatches[0];
    portfolioRelevance = sector
      ? `Vous ne détenez pas directement les actifs cités, mais environ ${formatPercent(
          sector.percent,
        )} de votre portefeuille est investi dans le secteur « ${sector.label} », identifié comme concerné. L’effet éventuel serait donc indirect.`
      : null;
  } else if (context.portfolio && context.portfolio.positionCount > 0) {
    portfolioRelevance =
      'Aucune exposition directe ni sectorielle n’a été identifiée entre cette actualité et votre portefeuille. Elle reste utile pour comprendre le contexte de marché.';
  }

  const uncertainties = [
    'La durée et l’ampleur de cette évolution ne sont pas connues.',
    news.confidenceScore < 60
      ? 'La source disponible ne permet pas un niveau de confiance élevé sur ce point.'
      : 'D’autres facteurs non mesurés ici peuvent influencer les actifs concernés.',
  ];

  return {
    summary: news.summary,
    whyItMatters,
    portfolioRelevance,
    uncertainties,
    confidence: Math.min(0.85, news.confidenceScore / 100),
  };
}

function horizonLabel(horizon: string): string {
  switch (horizon) {
    case 'long_term':
      return 'le long terme';
    case 'medium_term':
      return 'le moyen terme';
    default:
      return 'le court terme';
  }
}

/** Answers a free-text question using only the structured context. */
export function deterministicChatAnswer(context: AiContext): LlmAnswer {
  const question = context.question ?? '';
  const depth = context.investor?.depth ?? 'simple';
  const glossaryEntry = context.glossary ? null : findGlossaryEntry(question);

  // 1. Advice request — declined explicitly, and redirected to what NOVA can actually do.
  if (isAdviceRequest(question)) {
    return adviceRefusal(context);
  }

  // 2. Definition question — answered from the human-written glossary.
  if (context.glossary || glossaryEntry) {
    const term = context.glossary?.term ?? glossaryEntry?.term ?? '';
    const definition =
      context.glossary?.definition ??
      (depth === 'detailed' ? glossaryEntry?.detailed : glossaryEntry?.simple) ??
      '';
    return {
      shortAnswer: definition,
      whatWeKnow: glossaryEntry
        ? [glossaryEntry.simple, ...(depth === 'detailed' ? [glossaryEntry.detailed] : [])]
        : [definition],
      whyItMatters:
        glossaryEntry?.whyItMatters ?? `Comprendre « ${term} » aide à lire les marchés.`,
      portfolioRelevance: portfolioTieIn(context),
      uncertainties: glossaryEntry?.uncertainties ?? [],
      sources: context.sources,
      confidence: 0.9,
    };
  }

  // 3. Portfolio question — answered from computed exposure only.
  if (context.portfolio && mentionsPortfolio(question)) {
    return deterministicPortfolioAnswer(context);
  }

  // 4. News question.
  if (context.news) {
    const explanation = deterministicNewsExplanation(context);
    return {
      shortAnswer: explanation.summary,
      whatWeKnow: [
        `${context.news.title} (source : ${context.news.source}, publié le ${formatDate(
          context.news.publishedAt,
        )}).`,
      ],
      whyItMatters: explanation.whyItMatters,
      portfolioRelevance: explanation.portfolioRelevance,
      uncertainties: explanation.uncertainties,
      sources: context.sources,
      confidence: explanation.confidence,
    };
  }

  // 5. Nothing in context matches the question: say so rather than improvise.
  return {
    shortAnswer: NO_DATA_ANSWER,
    whatWeKnow: [],
    whyItMatters:
      'Je peux expliquer un terme financier, une actualité de votre fil, ou l’exposition de votre portefeuille à partir des données dont je dispose.',
    portfolioRelevance: null,
    uncertainties: [
      'Je ne dispose pas de données suffisantes pour répondre précisément à cette question.',
    ],
    sources: [],
    confidence: 0.2,
  };
}

/**
 * Detects a request for investment advice.
 *
 * "Dois-je acheter ?" is not a data gap — it is a question NOVA deliberately does not answer.
 * Saying "je n'ai pas assez de données" would be misleading: the honest answer is that giving a
 * personalised buy or sell recommendation is outside what NOVA does (rule #17).
 */
function isAdviceRequest(question: string): boolean {
  return /\b(?:dois[- ]je|devrais[- ]je|faut[- ]il|est[- ]ce que je dois|je devrais)\b.*\b(?:acheter|vendre|investir|placer|sortir|renforcer|alléger)\b|\b(?:quoi|que) (?:acheter|vendre)\b|\bbon moment pour (?:acheter|vendre|investir)\b|\bque me conseillez[- ]vous\b|\bvotre conseil\b/i.test(
    question,
  );
}

function adviceRefusal(context: AiContext): LlmAnswer {
  const exposure = exposureSentences(context);
  return {
    shortAnswer:
      'NOVA ne donne pas de recommandation d’achat ou de vente. Je peux en revanche vous aider à comprendre ce qui est en jeu.',
    whatWeKnow: exposure,
    whyItMatters:
      'Une décision d’investissement dépend de votre situation personnelle, de votre horizon et de votre tolérance aux fluctuations — des éléments que NOVA ne peut pas apprécier à votre place. Ce que NOVA peut faire : vous montrer votre exposition actuelle, expliquer les mécanismes en jeu et détailler ce qui reste incertain.',
    portfolioRelevance: exposure.length > 0 ? exposure.join(' ') : null,
    uncertainties: [
      'Personne ne connaît l’évolution future du prix d’un actif.',
      'Une décision qui convient à une personne peut ne pas convenir à une autre.',
    ],
    sources: context.sources,
    confidence: 0.9,
  };
}

function mentionsPortfolio(question: string): boolean {
  return /portefeuille|exposition|mes (?:actions|positions|placements)|mon (?:portefeuille|argent)|baisse|hausse|perform/i.test(
    question,
  );
}

function portfolioTieIn(context: AiContext): string | null {
  const sentences = exposureSentences(context);
  return sentences.length > 0 ? (sentences[0] ?? null) : null;
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? iso
    : new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeStyle: 'short' }).format(date);
}

/** Answers "pourquoi mon portefeuille baisse ?" / "quelle est mon exposition ?" from data. */
export function deterministicPortfolioAnswer(context: AiContext): LlmAnswer {
  const portfolio = context.portfolio;
  if (!portfolio || portfolio.positionCount === 0) {
    return {
      shortAnswer:
        'Votre portefeuille ne contient pas encore de position, je ne peux donc pas analyser votre exposition.',
      whatWeKnow: [],
      whyItMatters:
        'Ajouter vos positions permet à NOVA de relier les actualités à ce que vous détenez réellement.',
      portfolioRelevance: null,
      uncertainties: [],
      sources: [],
      confidence: 0.9,
    };
  }

  const facts: string[] = [
    `Votre portefeuille compte ${portfolio.positionCount} position${portfolio.positionCount > 1 ? 's' : ''}.`,
    ...exposureSentences(context),
  ];

  if (portfolio.dayChangePercent !== null) {
    facts.push(
      `Sur la dernière séance connue, sa valeur a évolué de ${formatPercent(portfolio.dayChangePercent)} (données arrêtées au ${formatDate(portfolio.asOf)}).`,
    );
  } else {
    facts.push(
      'La variation du jour n’est pas disponible pour toutes vos lignes : NOVA ne l’affiche donc pas.',
    );
  }

  if (portfolio.isDemoData) {
    facts.push(
      'Attention : ces valeurs reposent sur des données de démonstration, et non sur des cours de marché réels.',
    );
  }

  const drivers = portfolio.themeExposure
    .filter((theme) => theme.percent >= 10)
    .slice(0, 3)
    .map((theme) => `${theme.theme} (environ ${formatPercent(theme.percent)})`);

  return {
    shortAnswer:
      portfolio.dayChangePercent === null
        ? `Voici la composition de votre portefeuille ; la variation du jour n’est pas disponible pour toutes vos lignes.`
        : `Sur la dernière séance connue, votre portefeuille a évolué de ${formatPercent(portfolio.dayChangePercent)}.`,
    whatWeKnow: facts,
    whyItMatters:
      drivers.length > 0
        ? `Votre portefeuille est principalement sensible aux thèmes suivants : ${drivers.join(', ')}. Une actualité portant sur ces thèmes a plus de chances de vous concerner.`
        : 'Votre portefeuille ne présente pas de concentration thématique marquée d’après les données disponibles.',
    portfolioRelevance: exposureSentences(context).join(' ') || null,
    uncertainties: [
      'Cette analyse repose sur les derniers cours connus, qui peuvent ne pas être les cours de clôture définitifs.',
      'Une variation quotidienne ne dit rien de l’évolution future de votre portefeuille.',
    ],
    sources: context.sources,
    confidence: 0.75,
  };
}

/** Adds the disclaimer and provenance every answer must carry before display. */
export function withDisclaimer(answer: LlmAnswer): LlmAnswer & { disclaimer: string } {
  return { ...answer, disclaimer: AI_DISCLAIMER };
}
