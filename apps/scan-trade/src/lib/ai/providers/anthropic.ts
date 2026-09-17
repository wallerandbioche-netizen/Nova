import { getAIConfig } from '@/lib/env';
import { AI_RESPONSE_JSON_SCHEMA } from '../schema';
import { SYSTEM_PROMPT, buildHintsBlock } from '../prompt';
import {
  AIProviderError,
  type AIAnalysisProvider,
  type AnalyzeChartInput,
  type ProviderResult,
} from '../types';

const TOOL_NAME = 'submit_chart_analysis';

interface AnthropicContentBlock {
  type: string;
  name?: string;
  input?: unknown;
  text?: string;
}

interface AnthropicResponse {
  content?: AnthropicContentBlock[];
  model?: string;
  usage?: { input_tokens?: number; output_tokens?: number };
  error?: { type?: string; message?: string };
}

/**
 * Vision analysis through the Anthropic Messages API.
 *
 * The structured answer is requested as a forced tool call, which is far more
 * reliable than asking for "JSON only". A text answer is still accepted as a
 * fallback so a provider-side change of behaviour degrades into a parse attempt
 * rather than a hard outage.
 */
export class AnthropicVisionProvider implements AIAnalysisProvider {
  readonly name = 'anthropic';

  async analyze(input: AnalyzeChartInput, signal: AbortSignal): Promise<ProviderResult> {
    const config = getAIConfig();

    const body = {
      model: config.model,
      max_tokens: config.maxOutputTokens,
      temperature: 0,
      system: SYSTEM_PROMPT,
      tools: [
        {
          name: TOOL_NAME,
          description: 'Return the structured analysis of the chart screenshot.',
          input_schema: AI_RESPONSE_JSON_SCHEMA,
        },
      ],
      tool_choice: { type: 'tool', name: TOOL_NAME },
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: input.image.mimeType,
                data: input.image.data.toString('base64'),
              },
            },
            { type: 'text', text: buildHintsBlock(input.hints) },
          ],
        },
      ],
    };

    let response: Response;
    try {
      response = await fetch(`${config.baseUrl}/v1/messages`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': config.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
        signal,
      });
    } catch (error) {
      if (signal.aborted || (error instanceof Error && error.name === 'AbortError')) {
        throw new AIProviderError(
          'timeout',
          "Le fournisseur d'analyse n'a pas répondu dans le délai imparti.",
        );
      }
      throw new AIProviderError('unavailable', "Le fournisseur d'analyse est injoignable.");
    }

    if (!response.ok) {
      const detail = await safeErrorDetail(response);
      // 4xx other than 429 means we sent something the provider rejected.
      const kind = response.status === 408 || response.status === 504 ? 'timeout' : 'unavailable';
      throw new AIProviderError(
        kind,
        `Fournisseur d'analyse indisponible (${response.status}): ${detail}`,
        response.status,
      );
    }

    const payload = (await response.json()) as AnthropicResponse;
    const raw = extractToolInput(payload);

    return {
      raw,
      model: payload.model ?? config.model,
      provider: this.name,
      usage: {
        inputTokens: payload.usage?.input_tokens,
        outputTokens: payload.usage?.output_tokens,
      },
    };
  }
}

function extractToolInput(payload: AnthropicResponse): unknown {
  const blocks = payload.content ?? [];

  const toolBlock = blocks.find((block) => block.type === 'tool_use' && block.name === TOOL_NAME);
  if (toolBlock && toolBlock.input != null) return toolBlock.input;

  // Fallback: the model answered in prose. Try to recover a JSON object.
  const text = blocks
    .filter((block) => block.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text as string)
    .join('\n');

  const recovered = extractJsonObject(text);
  if (recovered != null) return recovered;

  throw new AIProviderError(
    'invalid_response',
    "Le fournisseur n'a pas renvoyé d'analyse structurée.",
  );
}

/** Pulls the outermost balanced JSON object out of a text blob. */
export function extractJsonObject(text: string): unknown {
  const start = text.indexOf('{');
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === '{') depth += 1;
    else if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        try {
          return JSON.parse(text.slice(start, index + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

async function safeErrorDetail(response: Response): Promise<string> {
  try {
    const text = await response.text();
    return text.slice(0, 300);
  } catch {
    return 'réponse illisible';
  }
}
