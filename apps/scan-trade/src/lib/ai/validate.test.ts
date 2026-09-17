import { describe, expect, it } from 'vitest';
import { AnalysisValidationError, validateAnalysisResponse } from './validate';
import { validLongResponse } from './testing/fake-provider';

/**
 * The validation gate is the last thing standing between a model's output and
 * a number a trader might act on, so these tests are exhaustive on purpose.
 */
describe('validateAnalysisResponse', () => {
  describe('a coherent trade plan', () => {
    it('accepts a well-formed LONG scenario', () => {
      const result = validateAnalysisResponse(validLongResponse());

      expect(result.status).toBe('COMPLETED');
      expect(result.bias).toBe('LONG');
      expect(result.entryMin).toBe(61250);
      expect(result.entryMax).toBe(61900);
      expect(result.stopLoss).toBe(59800);
      expect(result.takeProfit1).toBe(65400);
      expect(result.asset).toBe('BTC/USDT');
      expect(result.market).toBe('CRYPTO');
      expect(result.confidence).toBe('MEDIUM');
    });

    it('accepts a well-formed SHORT scenario', () => {
      const result = validateAnalysisResponse(
        validLongResponse({
          market_bias: 'short',
          entry: { min: 61250, max: 61900 },
          stop_loss: 63000,
          take_profit_1: 58000,
          take_profit_2: 56000,
          risk_reward: null,
          key_levels: [],
        }),
      );

      expect(result.status).toBe('COMPLETED');
      expect(result.bias).toBe('SHORT');
      expect(result.stopLoss).toBe(63000);
    });

    it('normalises an entry zone given in the wrong order', () => {
      const result = validateAnalysisResponse(
        validLongResponse({ entry: { min: 61900, max: 61250 } }),
      );
      expect(result.entryMin).toBe(61250);
      expect(result.entryMax).toBe(61900);
    });

    it('recomputes risk/reward from the levels rather than trusting the model', () => {
      // Entry midpoint 61575, risk 1775, reward 3825 → 2.15, not the 9.9 claimed.
      const result = validateAnalysisResponse(validLongResponse({ risk_reward: 9.9 }));

      expect(result.riskReward).toBe(2.15);
      expect(result.warnings.some((warning) => warning.includes('recalculé'))).toBe(true);
    });

    it('does not warn when the model’s ratio matches the computed one', () => {
      const result = validateAnalysisResponse(validLongResponse({ risk_reward: 2.15 }));
      expect(result.warnings.some((warning) => warning.includes('recalculé'))).toBe(false);
    });

    it('keeps take profit 2 optional', () => {
      const result = validateAnalysisResponse(validLongResponse({ take_profit_2: null }));
      expect(result.takeProfit2).toBeNull();
      expect(result.status).toBe('COMPLETED');
    });
  });

  describe('incoherent plans are rejected outright', () => {
    it('rejects a LONG whose stop loss sits above the entry zone', () => {
      expect(() => validateAnalysisResponse(validLongResponse({ stop_loss: 62500 }))).toThrow(
        AnalysisValidationError,
      );
    });

    it('rejects a LONG whose take profit sits below the entry zone', () => {
      expect(() => validateAnalysisResponse(validLongResponse({ take_profit_1: 60000 }))).toThrow(
        AnalysisValidationError,
      );
    });

    it('rejects a SHORT whose stop loss sits below the entry zone', () => {
      expect(() =>
        validateAnalysisResponse(
          validLongResponse({
            market_bias: 'short',
            stop_loss: 60000,
            take_profit_1: 58000,
            take_profit_2: null,
          }),
        ),
      ).toThrow(AnalysisValidationError);
    });

    it('rejects a second take profit that is closer than the first', () => {
      expect(() => validateAnalysisResponse(validLongResponse({ take_profit_2: 63000 }))).toThrow(
        AnalysisValidationError,
      );
    });

    it('rejects a level that is out of proportion with the entry (decimal slip)', () => {
      expect(() => validateAnalysisResponse(validLongResponse({ take_profit_1: 654000 }))).toThrow(
        AnalysisValidationError,
      );
    });

    it('rejects an "analysis" with no direction', () => {
      expect(() => validateAnalysisResponse(validLongResponse({ market_bias: 'neutral' }))).toThrow(
        AnalysisValidationError,
      );
    });

    it('rejects an "analysis" missing its stop loss', () => {
      expect(() => validateAnalysisResponse(validLongResponse({ stop_loss: null }))).toThrow(
        AnalysisValidationError,
      );
    });

    it('rejects negative and non-finite prices', () => {
      expect(() => validateAnalysisResponse(validLongResponse({ stop_loss: -100 }))).toThrow(
        AnalysisValidationError,
      );
      expect(() =>
        validateAnalysisResponse(validLongResponse({ take_profit_1: Number.POSITIVE_INFINITY })),
      ).toThrow(AnalysisValidationError);
    });

    it('rejects a payload that is not the agreed shape at all', () => {
      expect(() => validateAnalysisResponse({ hello: 'world' })).toThrow(AnalysisValidationError);
      expect(() => validateAnalysisResponse(null)).toThrow(AnalysisValidationError);
      expect(() => validateAnalysisResponse('{}')).toThrow(AnalysisValidationError);
    });

    it('names what was wrong, for the server log', () => {
      try {
        validateAnalysisResponse(validLongResponse({ stop_loss: 62500 }));
        expect.unreachable('should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(AnalysisValidationError);
        expect((error as AnalysisValidationError).reasons.join(' ')).toContain('stop loss');
      }
    });
  });

  describe('declined scenarios', () => {
    it('keeps a NO TRADE and strips every price the model still filled in', () => {
      const result = validateAnalysisResponse(
        validLongResponse({
          status: 'no_trade',
          // A model that says "no trade" but ships an entry anyway is the exact
          // case this strip exists for.
          entry: { min: 61250, max: 61900 },
          stop_loss: 59800,
          take_profit_1: 65400,
          risk_reward: 2.8,
        }),
      );

      expect(result.status).toBe('NO_TRADE');
      expect(result.entryMin).toBeNull();
      expect(result.entryMax).toBeNull();
      expect(result.stopLoss).toBeNull();
      expect(result.takeProfit1).toBeNull();
      expect(result.takeProfit2).toBeNull();
      expect(result.riskReward).toBeNull();
      expect(result.invalidation).toBeNull();
    });

    it('drops entry and target levels from a declined analysis but keeps S/R', () => {
      const result = validateAnalysisResponse(validLongResponse({ status: 'no_trade' }));

      expect(result.levels.map((level) => level.type)).toEqual([
        'SUPPORT_PRIMARY',
        'RESISTANCE_PRIMARY',
      ]);
    });

    it('keeps INSUFFICIENT_DATA with its explanation', () => {
      const result = validateAnalysisResponse(
        validLongResponse({
          status: 'insufficient_data',
          asset: null,
          timeframe: null,
          summary: "L'échelle de prix n'est pas lisible.",
          reasoning: [{ category: 'observation', content: 'Aucune échelle visible.' }],
        }),
      );

      expect(result.status).toBe('INSUFFICIENT_DATA');
      expect(result.asset).toBeNull();
      expect(result.timeframe).toBeNull();
      expect(result.summary).toContain('échelle');
      expect(result.reasoning).toHaveLength(1);
    });

    it('never throws on a declined scenario, however incoherent its numbers', () => {
      expect(() =>
        validateAnalysisResponse(
          validLongResponse({ status: 'no_trade', stop_loss: 999999, take_profit_1: -5 }),
        ),
      ).not.toThrow();
    });
  });

  describe('fields the chart did not show', () => {
    it('keeps nulls as nulls instead of inventing values', () => {
      const result = validateAnalysisResponse(
        validLongResponse({
          asset: null,
          timeframe: null,
          market: null,
          chart_type: null,
          approximate_price: null,
        }),
      );

      expect(result.asset).toBeNull();
      expect(result.timeframe).toBeNull();
      expect(result.market).toBeNull();
      expect(result.chartType).toBeNull();
      expect(result.approxPrice).toBeNull();
    });

    it('drops a level that carries neither a price nor a label', () => {
      const result = validateAnalysisResponse(
        validLongResponse({
          key_levels: [
            { type: 'support_primary', price: null, price_max: null, label: null },
            { type: 'resistance_primary', price: 65400, price_max: null, label: null },
          ],
        }),
      );

      expect(result.levels).toHaveLength(1);
      expect(result.levels[0]?.type).toBe('RESISTANCE_PRIMARY');
    });

    it('de-duplicates identical levels', () => {
      const result = validateAnalysisResponse(
        validLongResponse({
          key_levels: [
            { type: 'support_primary', price: 59800, price_max: null, label: 'A' },
            { type: 'support_primary', price: 59800, price_max: null, label: 'B' },
          ],
        }),
      );

      expect(result.levels).toHaveLength(1);
    });

    it('de-duplicates repeated warnings', () => {
      // `risk_reward` matches the computed ratio so no extra warning is appended.
      const result = validateAnalysisResponse(
        validLongResponse({ risk_reward: 2.15, warnings: ['Volume absent', 'Volume absent'] }),
      );
      expect(result.warnings).toEqual(['Volume absent']);
    });
  });
});
