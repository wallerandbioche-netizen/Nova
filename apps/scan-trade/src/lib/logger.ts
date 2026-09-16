/**
 * Structured JSON logging (§47).
 *
 * Everything goes to stdout/stderr as one JSON object per line so a log drain
 * can index it. Secrets are stripped by `redact()` before serialisation — never
 * log a password, a token, an API key or anything Stripe sends us raw.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_WEIGHT: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

const REDACTED = '[redacted]';

const SENSITIVE_KEY = /(password|passwd|secret|token|apikey|api_key|authorization|cookie|card|cvc|iban|signature)/i;

export type LogValue = string | number | boolean | null | undefined | LogValue[] | { [key: string]: LogValue };

export function redact(value: unknown, depth = 0): LogValue {
  if (depth > 6) return '[deep]';
  if (value == null) return null;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack ?? null };
  }
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => redact(item, depth + 1));
  if (typeof value === 'object') {
    const out: Record<string, LogValue> = {};
    for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SENSITIVE_KEY.test(key) ? REDACTED : redact(raw, depth + 1);
    }
    return out;
  }
  return String(value);
}

function currentLevel(): LogLevel {
  const raw = (process.env.LOG_LEVEL ?? 'info') as LogLevel;
  return raw in LEVEL_WEIGHT ? raw : 'info';
}

function emit(level: LogLevel, message: string, context: Record<string, unknown> = {}): void {
  if (LEVEL_WEIGHT[level] < LEVEL_WEIGHT[currentLevel()]) return;
  const line = JSON.stringify({
    level,
    time: new Date().toISOString(),
    service: 'scan-trade',
    message,
    ...(redact(context) as Record<string, LogValue>),
  });
  if (level === 'error') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    // eslint-disable-next-line no-console
    console.log(line);
  }
}

export interface Logger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
  child(bindings: Record<string, unknown>): Logger;
}

function build(bindings: Record<string, unknown>): Logger {
  return {
    debug: (message, context) => emit('debug', message, { ...bindings, ...context }),
    info: (message, context) => emit('info', message, { ...bindings, ...context }),
    warn: (message, context) => emit('warn', message, { ...bindings, ...context }),
    error: (message, context) => emit('error', message, { ...bindings, ...context }),
    child: (extra) => build({ ...bindings, ...extra }),
  };
}

export const logger = build({});
