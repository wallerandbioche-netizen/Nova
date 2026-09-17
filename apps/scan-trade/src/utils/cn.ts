type ClassValue = string | number | null | undefined | false | ClassValue[];

/**
 * Joins class names, dropping falsy values.
 *
 * Deliberately not `clsx` + `tailwind-merge`: the component API below uses
 * variant maps rather than overlapping utility strings, so conflict resolution
 * is not needed and two dependencies are avoided.
 */
export function cn(...values: ClassValue[]): string {
  const out: string[] = [];
  for (const value of values) {
    if (!value) continue;
    if (Array.isArray(value)) {
      const nested = cn(...value);
      if (nested) out.push(nested);
    } else {
      out.push(String(value));
    }
  }
  return out.join(' ');
}
