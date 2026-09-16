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
  model: z.string().optional(),
  choices: z
    .array(z.object({ message: z.object({ content: z.string().nullable() }) }))
    .min(1),
  usage: z
    .object({ prompt_tokens: z.number().optional(), completion_tokens: z.number().optional() })
    .optional(),
});

/** Provider for any OpenAI-compatible `/chat/completions` endpoint (self-hosted included). */
export class OpenAiCompatibleLlmProvider implements LlmProvider {
  readonly name = 'openai-compatible';
  readonly isDemo = false;
  readonly model: string;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly maxOutputTokens: number;

  constructor(env: Env, private readonly logger: Logger) {
    this.model = env.LLM_MODEL;
    this.apiKey = env.LLM_API_KEY ?? '';
    this.baseUrl = (env.LLM_API_URL ?? '').replace(/\/$/, '');
    this.timeoutMs = env.LLM_TIMEOUT_MS;
    this.maxOutputTokens = env.LLM_MAX_OUTPUT_TOKENS;
  }

  async complete(request: LlmCompletionRequest): Promise<LlmCompletionResult> {
    const startedAt = Date.now();
    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: request.maxOutputTokens ?? this.maxOutputTokens,
          temperature: request.temperature ?? 0.2,
          messages: [
            { role: 'system', content: request.systemPrompt },
            { role: 'user', content: request.userPrompt },
          ],
        }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (!response.ok) throw new LlmUnavailableError(`LLM provider responded ${response.status}`);

      const parsed = responseSchema.safeParse(await response.json());
      if (!parsed.success) throw new LlmUnavailableError('Unexpected LLM response shape');

      const text = parsed.data.choices[0]?.message.content?.trim() ?? '';
      if (!text) throw new LlmUnavailableError('Empty LLM response');

      return {
        text,
        model: parsed.data.model ?? this.model,
        promptTokens: parsed.data.usage?.prompt_tokens ?? null,
        completionTokens: parsed.data.usage?.completion_tokens ?? null,
        latencyMs: Date.now() - startedAt,
      };
    } catch (error) {
      this.logger.error({ err: error, model: this.model }, 'LLM completion failed');
      if (error instanceof LlmUnavailableError) throw error;
      throw new LlmUnavailableError('LLM provider unavailable', { cause: error });
    }
  }

  async healthCheck(): Promise<boolean> {
    return Boolean(this.apiKey && this.baseUrl);
  }
}
