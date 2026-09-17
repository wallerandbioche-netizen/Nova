/**
 * Lowers only the first letter, so a sentence fragment can be inlined mid-sentence without
 * destroying the casing of anything else.
 *
 * Lowercasing the whole string turned "Amundi Euro Government Bond UCITS ETF" into
 * "amundi euro government bond ucits etf" — a fund name the user would no longer recognise.
 */
export function uncapitalize(text: string): string {
  return text.length > 0 ? `${text.charAt(0).toLowerCase()}${text.slice(1)}` : text;
}
