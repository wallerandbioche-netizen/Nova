import type { AiContext } from '../context.js';
import { deterministicChatAnswer, deterministicNewsExplanation } from '../deterministic-answer.js';
import type { LlmCompletionRequest, LlmCompletionResult, LlmProvider } from './llm-provider.js';

/**
 * Demo LLM provider.
 *
 * It does not call any model: it parses the structured context out of the prompt and composes
 * a deterministic answer from it. The product is therefore fully usable without an API key,
 * and the answers it gives contain only data NOVA actually holds — a demo must never look
 * like a model, and must never state anything the backend cannot back up.
 */
export class DemoLlmProvider implements LlmProvider {
  readonly name = 'demo';
  readonly isDemo = true;
  readonly model = 'nova-deterministic-v1';

  async complete(request: LlmCompletionRequest): Promise<LlmCompletionResult> {
    const startedAt = Date.now();
    const context = this.extractContext(request.userPrompt);

    let payload: unknown;
    if (request.userPrompt.includes('"intent": "news"') && context?.news) {
      payload = deterministicNewsExplanation(context);
    } else if (context) {
      payload = deterministicChatAnswer(context);
    } else {
      payload = {
        shortAnswer: 'Je n’ai pas suffisamment de données pour répondre précisément.',
        whatWeKnow: [],
        whyItMatters: '',
        portfolioRelevance: null,
        uncertainties: ['Contexte indisponible.'],
        sources: [],
        confidence: 0.2,
      };
    }

    return {
      text: JSON.stringify(payload),
      model: this.model,
      promptTokens: null,
      completionTokens: null,
      latencyMs: Date.now() - startedAt,
    };
  }

  private extractContext(prompt: string): AiContext | null {
    const match = /<contexte>\s*([\s\S]*?)\s*<\/contexte>/.exec(prompt);
    if (!match?.[1]) return null;
    try {
      return JSON.parse(match[1]) as AiContext;
    } catch {
      return null;
    }
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }
}
