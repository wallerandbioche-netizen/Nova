import type { ZodSchema, ZodTypeDef } from 'zod';
import { badRequest } from './errors.js';

/**
 * Parses untrusted input with a Zod schema and turns a failure into a 400 with field-level
 * details. Every body, query and params object crosses this function — nothing from a client
 * is ever used unparsed.
 */
export function parseInput<Output, Input = Output>(
  schema: ZodSchema<Output, ZodTypeDef, Input>,
  input: unknown,
  what: 'body' | 'query' | 'params' = 'body',
): Output {
  const result = schema.safeParse(input);
  if (!result.success) {
    const details = result.error.issues.map((issue) => ({
      field: issue.path.join('.') || what,
      message: issue.message,
    }));
    const first = details[0];
    throw badRequest(first ? first.message : 'Requête invalide', details);
  }
  return result.data;
}
