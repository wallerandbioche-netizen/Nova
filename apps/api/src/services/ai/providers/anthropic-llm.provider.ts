import type { Logger } from 'pino';
import { z } from 'zod';
import type { Env } from '../../../config/env.js';
import {
  LlmUnavailableError,
  type LlmCompletionRequest,
  type LlmCompletionResult,
  type LlmProvider,
} from './llm-provider.js';

const responseSchema = z.object({
  content: z.array(z.object({ type: z.string(), text: z.string().optional() })),
  model: z.string(),
  usage: z
    .object({ input_tokens: z.number().optional(), output_tokens: z.number().optional() })
    .optional(),
});

/**
 * Anthropic Messages API provider.
 *
 * The API key lives only in the backend process; it is never exposed to a client. Failures are
 * raised as `LlmUnavailableError` so the AI service can fall back to its deterministic answer
 * instead of showing an error to the user.
 */
export class AnthropicLlmProvider implements LlmProvider {
  readonly name = 'anthropic';
  readonly isDemo = false;
  readonly model: string;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly maxOutputTokens: number;

  constructor(env: Env, private readonly logger: Logger) {
    this.model = env.LLM_MODEL;
    this.apiKey = env.LLM_API_KEY ?? '';
    this.baseUrl = (env.LLM_API_URL ?? 'https://api.anthropic.com').replace(/\/$/, '');
    this.timeoutMs = env.LLM_TIMEOUT_MS;
    this.maxOutputTokens = env.LLM_MAX_OUTPUT_TOKENS;
  }

  async complete(request: LlmCompletionRequest): Promise<LlmCompletionResult> {
    const startedAt = Date.now();
    try {
      const response = await fetch(`${this.baseUrl}/v1/messages`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: request.maxOutputTokens ?? this.maxOutputTokens,
          temperature: request.temperature ?? 0.2,
          system: request.systemPrompt,
          messages: [{ role: 'user', content: request.userPrompt }],
        }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (!response.ok) {
        throw new LlmUnavailableError(`LLM provider responded ${response.status}`);
      }

      const parsed = responseSchema.safeParse(await response.json());
      if (!parsed.success) {
        throw new LlmUnavailableError('Unexpected LLM response shape');
      }

      const text = parsed.data.content
        .filter((block) => block.type === 'text')
        .map((block) => block.text ?? '')
        .join('')
        .trim();

      if (!text) throw new LlmUnavailableError('Empty LLM response');

      return {
        text,
        model: parsed.data.model,
        promptTokens: parsed.data.usage?.input_tokens ?? null,
        completionTokens: parsed.data.usage?.output_tokens ?? null,
        latencyMs: Date.now() - startedAt,
      };
    } catch (error) {
      this.logger.error({ err: error, model: this.model }, 'LLM completion failed');
      if (error instanceof LlmUnavailableError) throw error;
      throw new LlmUnavailableError('LLM provider unavailable', { cause: error });
    }
  }

  async healthCheck(): Promise<boolean> {
    return Boolean(this.apiKey);
  }
}
