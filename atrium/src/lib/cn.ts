/** Concatène des classes en ignorant les valeurs vides. */
export function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}
