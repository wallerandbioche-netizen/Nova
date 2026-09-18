import { AppError } from '../errors';

const BLOCKED_HOSTNAMES = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1', 'metadata.google.internal']);

/** Parses and hardens a user-supplied URL. Rejects anything that is not public http(s). */
export function parseListingUrl(raw: string): URL {
  const trimmed = raw.trim();
  if (!trimmed) throw new AppError('INVALID_URL');

  let url: URL;
  try {
    url = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`);
  } catch {
    throw new AppError('INVALID_URL');
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new AppError('INVALID_URL');
  if (!url.hostname.includes('.') && url.hostname !== 'demo') throw new AppError('INVALID_URL');
  if (isPrivateHost(url.hostname)) {
    throw new AppError('INVALID_URL', "Cette adresse n'est pas accessible publiquement.");
  }
  url.hash = '';
  return url;
}

/** Blocks SSRF targets: loopback, link-local and RFC1918 ranges. */
export function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(host)) return true;
  if (host.endsWith('.local') || host.endsWith('.internal')) return true;

  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (ipv4) {
    const [a, b] = [Number(ipv4[1]), Number(ipv4[2])];
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
  }
  return false;
}

export function normalisePlatformLabel(url: URL): string {
  return url.hostname.replace(/^www\./, '');
}
