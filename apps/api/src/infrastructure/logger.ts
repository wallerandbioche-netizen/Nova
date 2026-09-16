import { pino, type Logger } from 'pino';
import { getEnv } from '../config/env.js';

/**
 * Structured logging.
 *
 * Redaction is defined here rather than at each call site: passwords, tokens, API keys and
 * authorization headers must never reach a log line, whoever writes it (observability rule #52).
 */
export const REDACTED_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'password',
  'newPassword',
  'currentPassword',
  'passwordHash',
  'token',
  'refreshToken',
  'accessToken',
  'tokenHash',
  '*.password',
  '*.token',
  '*.refreshToken',
  '*.accessToken',
  '*.apiKey',
  'apiKey',
];

export function createLogger(): Logger {
  const env = getEnv();
  const isDev = env.NODE_ENV === 'development';
  return pino({
    level: env.LOG_LEVEL,
    redact: { paths: REDACTED_PATHS, censor: '[redacted]' },
    base: { service: 'nova-api', env: env.NODE_ENV },
    timestamp: pino.stdTimeFunctions.isoTime,
    ...(isDev
      ? {
          transport: {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'HH:MM:ss',
              ignore: 'pid,hostname,service,env',
            },
          },
        }
      : {}),
  });
}
