import { z } from 'zod';

/**
 * Contract the LLM must satisfy. Anything that does not parse is retried once and then
 * replaced by a deterministic fallback — an invalid model answer is never shown.
 */
export const llmSourceSchema = z.object({
  name: z.string().trim().min(1).max(160),
  url: z.string().trim().url().max(600).nullable().optional().default(null),
  publishedAt: z.string().trim().max(40).nullable().optional().default(null),
});

export const llmAnswerSchema = z.object({
  shortAnswer: z.string().trim().min(1).max(600),
  whatWeKnow: z.array(z.string().trim().min(1).max(600)).max(8).default([]),
  whyItMatters: z.string().trim().max(1200).default(''),
  portfolioRelevance: z.string().trim().max(1200).nullable().default(null),
  uncertainties: z.array(z.string().trim().min(1).max(400)).max(8).default([]),
  sources: z.array(llmSourceSchema).max(12).default([]),
  confidence: z.number().min(0).max(1).default(0.5),
});
export type LlmAnswer = z.infer<typeof llmAnswerSchema>;

export const llmNewsExplanationSchema = z.object({
  summary: z.string().trim().min(1).max(800),
  whyItMatters: z.string().trim().min(1).max(1200),
  portfolioRelevance: z.string().trim().max(1200).nullable().default(null),
  uncertainties: z.array(z.string().trim().min(1).max(400)).max(8).default([]),
  confidence: z.number().min(0).max(1).default(0.5),
});
export type LlmNewsExplanation = z.infer<typeof llmNewsExplanationSchema>;

export const llmBriefSchema = z.object({
  headline: z.string().trim().min(1).max(160),
  summary: z.string().trim().min(1).max(1200),
  marketSummary: z.string().trim().min(1).max(800),
  portfolioSummary: z.string().trim().max(800).nullable().default(null),
  takeaways: z
    .array(z.object({ newsId: z.string().trim().min(1), takeaway: z.string().trim().min(1).max(400) }))
    .max(10)
    .default([]),
  uncertainties: z.array(z.string().trim().min(1).max(400)).max(6).default([]),
});
export type LlmBrief = z.infer<typeof llmBriefSchema>;

/**
 * Phrases that would turn NOVA into an adviser or a fortune teller. A model answer containing
 * one of these is rejected and replaced by the deterministic fallback (guardrail #17).
 */
export const FORBIDDEN_PATTERNS: RegExp[] = [
  /\bje vous (?:conseille|recommande|garantis)\b/i,
  /\b(?:vous devriez|il faut) (?:acheter|vendre|investir)\b/i,
  /\bgaranti(?:e|es|s)? (?:de |d’|d')?(?:rendement|performance|gain)/i,
  /\brendement garanti\b/i,
  /\bva (?:certainement|forcément|assurément) (?:monter|baisser|augmenter|chuter)\b/i,
  /\bje suis un(?:e)? (?:conseill\w+|expert\w* financi\w+) humain/i,
  /\bguaranteed returns?\b/i,
  /\byou should (?:buy|sell)\b/i,
];

export function findGuardrailViolation(text: string): string | null {
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(text)) return pattern.source;
  }
  return null;
}
