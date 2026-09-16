/**
 * LLM provider contract.
 *
 * The frontend never talks to a model: Frontend → API → AiService → LLMProvider (rule #5).
 * Implementations receive a system prompt plus an already-validated structured context, and
 * return raw text that the AI service parses and validates before anything is displayed.
 */
export interface LlmCompletionRequest {
  systemPrompt: string;
  /** Structured, validated context. Never raw user records or credentials. */
  userPrompt: string;
  maxOutputTokens?: number;
  temperature?: number;
}

export interface LlmCompletionResult {
  text: string;
  model: string;
  promptTokens: number | null;
  completionTokens: number | null;
  latencyMs: number;
}

export interface LlmProvider {
  readonly name: string;
  /** True when responses are generated locally and deterministically, without a real model. */
  readonly isDemo: boolean;
  readonly model: string;
  complete(request: LlmCompletionRequest): Promise<LlmCompletionResult>;
  healthCheck(): Promise<boolean>;
}

export class LlmUnavailableError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'LlmUnavailableError';
  }
}
