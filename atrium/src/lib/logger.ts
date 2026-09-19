type Level = 'debug' | 'info' | 'warn' | 'error';

const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const threshold = ORDER[(process.env.LOG_LEVEL as Level) ?? 'info'] ?? ORDER.info;

function emit(level: Level, scope: string, message: string, extra?: unknown): void {
  if (ORDER[level] < threshold) return;
  const prefix = `[atrium:${scope}]`;
  const payload = extra === undefined ? '' : ` ${typeof extra === 'string' ? extra : JSON.stringify(extra)}`;
  // eslint-disable-next-line no-console -- journalisation serveur volontaire
  console[level === 'debug' ? 'log' : level](`${prefix} ${message}${payload}`);
}

export function logger(scope: string) {
  return {
    debug: (message: string, extra?: unknown) => emit('debug', scope, message, extra),
    info: (message: string, extra?: unknown) => emit('info', scope, message, extra),
    warn: (message: string, extra?: unknown) => emit('warn', scope, message, extra),
    error: (message: string, extra?: unknown) => emit('error', scope, message, extra),
  };
}
