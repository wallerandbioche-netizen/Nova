import type { Logger } from 'pino';
import type { AnalyticsEvent } from '@nova/config';
import type { Env } from '../../config/env.js';

/**
 * Product analytics.
 *
 * Hard rule (#48): no amount, no holding, no identity ever leaves NOVA through analytics.
 * Only the event name, a pseudonymous user reference and a small set of non-financial
 * properties are allowed, and the property allowlist is enforced here rather than trusted at
 * each call site.
 */
const ALLOWED_PROPERTIES = new Set([
  'plan',
  'depth',
  'source',
  'category',
  'difficulty',
  'step',
  'positionCount',
  'lessonSlug',
  'hasPortfolio',
  'isDemo',
]);

const FORBIDDEN_VALUE_HINTS = /amount|value|price|quantity|total|balance|email|name|iban/i;

export interface AnalyticsPayload {
  event: AnalyticsEvent;
  /** Pseudonymous id. Never an email. */
  userRef: string | null;
  properties?: Record<string, string | number | boolean>;
}

export class AnalyticsService {
  constructor(
    private readonly env: Env,
    private readonly logger: Logger,
  ) {}

  sanitizeProperties(
    properties: AnalyticsPayload['properties'],
  ): Record<string, string | number | boolean> {
    if (!properties) return {};
    const clean: Record<string, string | number | boolean> = {};
    for (const [key, value] of Object.entries(properties)) {
      if (!ALLOWED_PROPERTIES.has(key)) continue;
      if (FORBIDDEN_VALUE_HINTS.test(key)) continue;
      clean[key] = value;
    }
    return clean;
  }

  async track(payload: AnalyticsPayload): Promise<void> {
    const properties = this.sanitizeProperties(payload.properties);

    if (this.env.ANALYTICS_PROVIDER === 'none' || !this.env.ANALYTICS_API_URL) {
      this.logger.debug({ event: payload.event, properties }, 'analytics event (not forwarded)');
      return;
    }

    try {
      await fetch(this.env.ANALYTICS_API_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(this.env.ANALYTICS_API_KEY
            ? { authorization: `Bearer ${this.env.ANALYTICS_API_KEY}` }
            : {}),
        },
        body: JSON.stringify({
          event: payload.event,
          userRef: payload.userRef,
          properties,
          timestamp: new Date().toISOString(),
        }),
        signal: AbortSignal.timeout(3000),
      });
    } catch (error) {
      // Analytics must never affect the user-facing request.
      this.logger.debug({ err: error, event: payload.event }, 'analytics delivery failed');
    }
  }
}
