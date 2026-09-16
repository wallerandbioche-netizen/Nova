import type { Logger } from 'pino';
import type { Env } from '../../../config/env.js';
import { DemoNotificationProvider } from './demo-notification.provider.js';
import { ExpoNotificationProvider } from './expo-notification.provider.js';
import type { NotificationProvider } from './notification-provider.js';

export * from './notification-provider.js';

export function createNotificationProvider(env: Env, logger: Logger): NotificationProvider {
  if (env.NOTIFICATION_PROVIDER === 'expo') return new ExpoNotificationProvider(env, logger);
  return new DemoNotificationProvider(logger);
}
