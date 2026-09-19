/**
 * Lecture minimale de robots.txt.
 *
 * Objectif : ne jamais récupérer une page qu'un site demande de ne pas
 * parcourir. Ce module n'a pas vocation à couvrir toute la spécification —
 * en cas de doute, il refuse plutôt que d'autoriser.
 */

interface Group {
  agents: string[];
  allow: string[];
  disallow: string[];
}

export function parseRobots(text: string): Group[] {
  const groups: Group[] = [];
  let current: Group | null = null;
  let lastLineWasAgent = false;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.split('#')[0]?.trim() ?? '';
    if (line === '') continue;
    const separator = line.indexOf(':');
    if (separator === -1) continue;

    const field = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();

    if (field === 'user-agent') {
      if (!current || !lastLineWasAgent) {
        current = { agents: [], allow: [], disallow: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastLineWasAgent = true;
      continue;
    }

    lastLineWasAgent = false;
    if (!current) continue;
    if (field === 'allow') current.allow.push(value);
    else if (field === 'disallow') current.disallow.push(value);
  }

  return groups;
}

function matches(pattern: string, path: string): number {
  if (pattern === '') return -1;
  // Support de `*` et de l'ancre `$`, les deux seules extensions répandues.
  const anchored = pattern.endsWith('$');
  const body = anchored ? pattern.slice(0, -1) : pattern;
  const regex = new RegExp(
    `^${body.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}${anchored ? '$' : ''}`,
  );
  return regex.test(path) ? body.length : -1;
}

/** Applique les règles au chemin demandé pour un user-agent donné. */
export function isAllowed(groups: Group[], userAgent: string, path: string): boolean {
  const token = userAgent.toLowerCase();
  const specific = groups.filter((group) =>
    group.agents.some((agent) => agent !== '*' && token.includes(agent)),
  );
  const wildcard = groups.filter((group) => group.agents.includes('*'));
  const applicable = specific.length > 0 ? specific : wildcard;
  if (applicable.length === 0) return true;

  let bestAllow = -1;
  let bestDisallow = -1;
  for (const group of applicable) {
    for (const rule of group.allow) bestAllow = Math.max(bestAllow, matches(rule, path));
    for (const rule of group.disallow) bestDisallow = Math.max(bestDisallow, matches(rule, path));
  }

  if (bestDisallow === -1) return true;
  return bestAllow >= bestDisallow;
}

/**
 * Récupère et évalue robots.txt. Toute incertitude — réseau, format,
 * erreur serveur — se résout par un refus.
 */
export async function robotsAllows(
  targetUrl: string,
  userAgent: string,
  signal?: AbortSignal,
): Promise<boolean> {
  const url = new URL(targetUrl);
  try {
    const response = await fetch(`${url.origin}/robots.txt`, {
      headers: { 'user-agent': userAgent, accept: 'text/plain' },
      redirect: 'follow',
      ...(signal ? { signal } : {}),
    });
    // Absence de robots.txt = pas de restriction déclarée.
    if (response.status === 404) return true;
    if (!response.ok) return false;
    return isAllowed(parseRobots(await response.text()), userAgent, url.pathname);
  } catch {
    return false;
  }
}
