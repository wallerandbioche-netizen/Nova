import { getEnv } from '../config/env';
import { AppError } from '../errors';
import { isPrivateHost } from './url';

export interface FetchTextResult {
  body: string;
  finalUrl: string;
}

/** Small, polite HTTP client: identified user agent, timeout, size cap, no redirects to private hosts. */
export async function fetchText(url: URL, maxBytes = 3 * 1024 * 1024): Promise<FetchTextResult> {
  const env = getEnv();
  const response = await fetchWithGuards(url, {
    headers: {
      'user-agent': env.IMPORT_USER_AGENT,
      accept: 'text/html,application/xhtml+xml',
      'accept-language': 'fr,en;q=0.8',
    },
  });

  if (!response.ok) {
    throw new AppError('IMPORT_BLOCKED', undefined, {
      details: { status: response.status },
    });
  }
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('html') && !contentType.includes('xml') && !contentType.includes('json')) {
    throw new AppError('IMPORT_BLOCKED');
  }

  const buffer = await readCapped(response, maxBytes);
  return { body: buffer.toString('utf8'), finalUrl: response.url || url.toString() };
}

export async function fetchBinary(
  url: URL,
  maxBytes: number,
): Promise<{ body: Buffer; contentType: string }> {
  const env = getEnv();
  const response = await fetchWithGuards(url, {
    headers: { 'user-agent': env.IMPORT_USER_AGENT, accept: 'image/*' },
  });
  if (!response.ok) throw new AppError('IMAGES_UNREACHABLE', undefined, { details: { status: response.status } });

  const declared = Number(response.headers.get('content-length') ?? '0');
  if (declared > maxBytes) throw new AppError('FILE_TOO_LARGE');

  const body = await readCapped(response, maxBytes);
  return { body, contentType: response.headers.get('content-type') ?? 'application/octet-stream' };
}

async function fetchWithGuards(url: URL, init: RequestInit): Promise<Response> {
  if (isPrivateHost(url.hostname)) throw new AppError('INVALID_URL');
  const env = getEnv();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), env.IMPORT_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal, redirect: 'follow' });
  } catch (cause) {
    throw new AppError('IMPORT_BLOCKED', undefined, { cause });
  } finally {
    clearTimeout(timer);
  }
}

async function readCapped(response: Response, maxBytes: number): Promise<Buffer> {
  const reader = response.body?.getReader();
  if (!reader) return Buffer.alloc(0);

  const chunks: Buffer[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new AppError('FILE_TOO_LARGE');
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks);
}

/**
 * Honours robots.txt for our own user agent. A site that asks us not to read a page is not read:
 * the product falls back to manual upload instead.
 */
export async function isAllowedByRobots(url: URL): Promise<boolean> {
  const env = getEnv();
  try {
    const robotsUrl = new URL('/robots.txt', url.origin);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(robotsUrl, {
      headers: { 'user-agent': env.IMPORT_USER_AGENT },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!response.ok) return true; // No robots.txt means no restriction.
    const text = (await response.text()).slice(0, 200_000);
    return isPathAllowed(text, url.pathname, env.IMPORT_USER_AGENT);
  } catch {
    // Unreachable robots.txt: stay conservative but do not block the whole product.
    return true;
  }
}

/** Minimal robots.txt evaluation: most specific matching rule wins, as per the RFC. */
export function isPathAllowed(robotsTxt: string, pathname: string, userAgent: string): boolean {
  const agentToken = userAgent.split('/')[0]?.toLowerCase() ?? '*';
  const groups: { agents: string[]; rules: { allow: boolean; path: string }[] }[] = [];
  let current: { agents: string[]; rules: { allow: boolean; path: string }[] } | null = null;
  let lastWasAgent = false;

  for (const rawLine of robotsTxt.split(/\r?\n/)) {
    const line = rawLine.split('#')[0]?.trim() ?? '';
    if (!line) continue;
    const [rawField, ...rest] = line.split(':');
    const field = rawField?.trim().toLowerCase();
    const value = rest.join(':').trim();
    if (!field) continue;

    if (field === 'user-agent') {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else if ((field === 'allow' || field === 'disallow') && current) {
      current.rules.push({ allow: field === 'allow', path: value });
      lastWasAgent = false;
    }
  }

  const applicable =
    groups.find((g) => g.agents.some((a) => a === agentToken)) ??
    groups.find((g) => g.agents.includes('*'));
  if (!applicable) return true;

  let decision: { allow: boolean; length: number } | null = null;
  for (const rule of applicable.rules) {
    if (rule.path === '') continue;
    if (!matchesRobotsPattern(rule.path, pathname)) continue;
    const length = rule.path.length;
    if (!decision || length > decision.length || (length === decision.length && rule.allow)) {
      decision = { allow: rule.allow, length };
    }
  }
  return decision ? decision.allow : true;
}

function matchesRobotsPattern(pattern: string, pathname: string): boolean {
  const mustEnd = pattern.endsWith('$');
  const raw = mustEnd ? pattern.slice(0, -1) : pattern;
  const parts = raw.split('*');
  let index = 0;
  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i] ?? '';
    if (part === '') continue;
    const found = i === 0 ? (pathname.startsWith(part) ? 0 : -1) : pathname.indexOf(part, index);
    if (found === -1) return false;
    index = found + part.length;
  }
  return mustEnd ? index === pathname.length : true;
}
