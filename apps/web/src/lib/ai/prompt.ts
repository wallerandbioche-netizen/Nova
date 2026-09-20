import type { MarketAnalysis } from '@/types/analysis';

/**
 * The model is a commentator, not a calculator: it receives the engine output
 * and must only explain it. Any request for new levels is refused by the schema
 * on the way back.
 */
export const SYSTEM_PROMPT = [
  'Tu es un analyste technique rigoureux. Tu commentes une analyse déjà calculée par un moteur déterministe.',
  'Règles absolues :',
  "- N'invente jamais un prix, un niveau, un volume, un indicateur ou une figure. Utilise uniquement les valeurs fournies.",
  "- Si une donnée manque, écris explicitement qu'elle est indisponible.",
  '- Ne promets jamais un gain, une direction certaine ou un taux de réussite.',
  "- Le score de confluence mesure l'accord entre facteurs, ce n'est pas une probabilité de gain : ne le présente jamais comme tel.",
  "- Si le moteur conclut qu'il n'y a pas de trade, explique pourquoi sans proposer d'alternative forcée.",
  '- Réponds en français, dans un style sobre et factuel.',
  'Tu réponds uniquement avec un objet JSON valide correspondant au schéma demandé, sans texte autour.',
].join('\n');

export function buildUserPrompt(analysis: MarketAnalysis, userContext?: string): string {
  const facts = {
    actif: analysis.asset.symbol,
    uniteDeTemps: analysis.timeframe,
    dernierPrix: analysis.lastPrice,
    sourceDesDonnees: analysis.dataSource.label,
    biais: analysis.marketBias,
    regime: analysis.marketRegime,
    structure: {
      etat: analysis.marketStructure.state,
      sequence: analysis.marketStructure.sequence,
      evenements: analysis.marketStructure.events.map((event) => ({
        type: event.type,
        direction: event.direction,
        prix: event.price,
      })),
    },
    niveaux: analysis.supportResistance.map((level) => ({
      type: level.type,
      zone: level.zone,
      force: level.strength,
      reactions: level.reactions,
    })),
    indicateurs: analysis.indicators,
    momentum: analysis.momentum,
    volume: analysis.volume,
    volatilite: analysis.volatility,
    liquidite: analysis.liquidity.map((event) => ({ type: event.kind, prix: event.price })),
    figures: analysis.patterns.map((pattern) => ({ type: pattern.kind, force: pattern.strength })),
    multiUnites: analysis.multiTimeframe,
    confluence: {
      score: analysis.confluence.score,
      direction: analysis.confluence.direction,
      facteurs: analysis.confluence.factors.map((factor) => ({
        facteur: factor.label,
        direction: factor.direction,
        force: factor.strength,
      })),
      conflits: analysis.confluence.conflicts,
    },
    setup: analysis.setup,
    pasDeTrade: analysis.noTrade,
  };

  return [
    'Voici les faits calculés par le moteur :',
    JSON.stringify(facts, null, 2),
    userContext ? `Contexte fourni par le trader (non vérifié) : ${userContext}` : '',
    '',
    'Produis un JSON avec les clés : headline (string), narrative (objet avec marketContext, structure, keyLevels, momentum, volume, setup, entry, riskManagement, invalidation — chacune une chaîne), reasons (tableau de chaînes), warnings (tableau de chaînes).',
  ]
    .filter(Boolean)
    .join('\n');
}
