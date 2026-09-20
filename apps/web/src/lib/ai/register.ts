import 'server-only';

import { anthropicProvider } from './providers/anthropic';
import { deterministicProvider } from './providers/deterministic';
import { setReasoningProvider } from './provider';

/**
 * Picks the reasoning layer once, on the server. Credentials never reach the
 * browser; when none are configured the deterministic layer is used.
 */
export function registerReasoningProvider(): void {
  setReasoningProvider(anthropicProvider.isAvailable() ? anthropicProvider : deterministicProvider);
}
