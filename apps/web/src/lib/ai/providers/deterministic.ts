import type { ReasoningProvider, ReasoningRequest } from '../provider';
import type { ReasoningPayload } from '../schema';
import { BIAS_LABEL, NO_TRADE_LABEL, REGIME_LABEL } from '@/lib/utils/labels';

/**
 * Default reasoning layer. It writes the commentary from the engine output
 * only, which means the product works with no model credentials and can never
 * hallucinate a level: there is nowhere for a new number to come from.
 */
export const deterministicProvider: ReasoningProvider = {
  id: 'engine',
  label: 'Moteur déterministe',
  isAvailable: () => true,
  async reason({ analysis, userContext }: ReasoningRequest): Promise<ReasoningPayload> {
    const { setup, noTrade, confluence } = analysis;

    const headline = setup
      ? `${setup.direction === 'long' ? 'Achat' : 'Vente'} — ${setup.label} sur ${analysis.asset.symbol} en ${analysis.timeframe}`
      : `Aucun trade sur ${analysis.asset.symbol} en ${analysis.timeframe} — ${
          noTrade?.codes.map((code) => NO_TRADE_LABEL[code]).join(', ') ?? 'configuration absente'
        }`;

    const reasons = setup
      ? setup.reasons
      : (noTrade?.reasons ?? ['Les filtres de risque rejettent la configuration.']);

    const warnings: string[] = [];
    if (confluence.conflicts.length) {
      warnings.push(`Facteurs contradictoires : ${confluence.conflicts.length}.`);
    }
    if (analysis.volatility.regime === 'high') warnings.push(analysis.volatility.description);
    if (analysis.dataSource.source === 'mock') {
      warnings.push(
        'Analyse produite sur des données simulées : elle illustre le raisonnement, pas un flux de marché réel.',
      );
    }
    if (userContext) {
      warnings.push(
        "Le contexte fourni n'est pas vérifiable par le moteur : il est affiché tel quel, sans être intégré aux calculs.",
      );
    }

    return {
      headline,
      narrative: {
        ...analysis.narrative,
        marketContext: `${analysis.narrative.marketContext} Régime : ${REGIME_LABEL[analysis.marketRegime].toLowerCase()}, biais ${BIAS_LABEL[analysis.marketBias].toLowerCase()}.`,
      },
      reasons: reasons.slice(0, 8),
      warnings: warnings.slice(0, 6),
    };
  },
};
