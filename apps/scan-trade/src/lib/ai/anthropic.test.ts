import { describe, expect, it } from 'vitest';
import { extractJsonObject } from './providers/anthropic';

/**
 * The provider asks for a forced tool call, but a model that answers in prose
 * must degrade into a parse attempt rather than a hard outage.
 */
describe('extractJsonObject', () => {
  it('pulls a JSON object out of surrounding prose', () => {
    const text =
      'Voici l’analyse :\n```json\n{"status":"no_trade","asset":null}\n```\nBonne lecture.';

    expect(extractJsonObject(text)).toEqual({ status: 'no_trade', asset: null });
  });

  it('keeps braces that appear inside strings', () => {
    const text = '{"summary":"une accolade } dans le texte","status":"no_trade"}';

    expect(extractJsonObject(text)).toEqual({
      summary: 'une accolade } dans le texte',
      status: 'no_trade',
    });
  });

  it('handles an escaped quote before a brace', () => {
    const text = '{"summary":"il a dit \\"non\\" }","status":"no_trade"}';

    expect(extractJsonObject(text)).toEqual({ summary: 'il a dit "non" }', status: 'no_trade' });
  });

  it('handles nested objects', () => {
    const text = 'prefix {"entry":{"min":1,"max":2},"status":"analysis"} suffix';

    expect(extractJsonObject(text)).toEqual({ entry: { min: 1, max: 2 }, status: 'analysis' });
  });

  it('returns null rather than a half-parsed object', () => {
    expect(extractJsonObject('aucune accolade ici')).toBeNull();
    expect(extractJsonObject('{"status": "analysis"')).toBeNull();
    expect(extractJsonObject('{ceci n’est pas du JSON}')).toBeNull();
  });
});
