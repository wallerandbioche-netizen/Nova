import type { Logger } from 'pino';
import type { Env } from '../../../config/env.js';
import { AnthropicLlmProvider } from './anthropic-llm.provider.js';
import { DemoLlmProvider } from './demo-llm.provider.js';
import type { LlmProvider } from './llm-provider.js';
import { OpenAiCompatibleLlmProvider } from './openai-compatible-llm.provider.js';

export * from './llm-provider.js';
export { DemoLlmProvider } from './demo-llm.provider.js';
export { AnthropicLlmProvider } from './anthropic-llm.provider.js';
export { OpenAiCompatibleLlmProvider } from './openai-compatible-llm.provider.js';

export function createLlmProvider(env: Env, logger: Logger): LlmProvider {
  switch (env.LLM_PROVIDER) {
    case 'anthropic':
      return new AnthropicLlmProvider(env, logger);
    case 'openai-compatible':
      return new OpenAiCompatibleLlmProvider(env, logger);
    default:
      logger.info('AI: using the deterministic demo provider (no model is called)');
      return new DemoLlmProvider();
  }
}
