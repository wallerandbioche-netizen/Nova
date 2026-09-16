import type { Logger } from 'pino';
import { z } from 'zod';
import type { Env } from '../../../config/env.js';
import type { NotificationProvider, PushMessage, PushResult } from './notification-provider.js';

const ticketSchema = z.object({
  data: z.array(
    z.object({
      status: z.enum(['ok', 'error']),
      id: z.string().optional(),
      message: z.string().optional(),
      details: z.object({ error: z.string().optional() }).optional(),
    }),
  ),
});

/** Expo push transport. Batched at 100 messages, the documented API limit. */
export class ExpoNotificationProvider implements NotificationProvider {
  readonly name = 'expo';
  readonly isDemo = false;

  constructor(
    private readonly env: Env,
    private readonly logger: Logger,
  ) {}

  async send(messages: PushMessage[]): Promise<PushResult[]> {
    const results: PushResult[] = [];
    for (let index = 0; index < messages.length; index += 100) {
      const batch = messages.slice(index, index + 100);
      try {
        const response = await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            ...(this.env.EXPO_ACCESS_TOKEN
              ? { authorization: `Bearer ${this.env.EXPO_ACCESS_TOKEN}` }
              : {}),
          },
          body: JSON.stringify(
            batch.map((message) => ({
              to: message.token,
              title: message.title,
              body: message.body,
              data: message.data ?? {},
              sound: null,
            })),
          ),
          signal: AbortSignal.timeout(10_000),
        });

        const parsed = ticketSchema.safeParse(await response.json());
        if (!parsed.success) {
          results.push(
            ...batch.map((message) => ({
              token: message.token,
              delivered: false,
              error: 'unexpected response',
            })),
          );
          continue;
        }

        parsed.data.data.forEach((ticket, ticketIndex) => {
          const message = batch[ticketIndex];
          if (!message) return;
          results.push({
            token: message.token,
            delivered: ticket.status === 'ok',
            invalidToken: ticket.details?.error === 'DeviceNotRegistered',
            error: ticket.message,
          });
        });
      } catch (error) {
        this.logger.warn({ err: error }, 'push notification batch failed');
        results.push(
          ...batch.map((message) => ({
            token: message.token,
            delivered: false,
            error: 'transport error',
          })),
        );
      }
    }
    return results;
  }
}
