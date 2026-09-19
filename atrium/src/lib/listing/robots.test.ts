import { describe, expect, it } from 'vitest';
import { isAllowed, parseRobots } from './robots';

const ROBOTS = `
User-agent: *
Disallow: /private/
Disallow: /rooms/
Allow: /rooms/public/

User-agent: AtriumBot
Disallow: /
`;

describe('robots.txt', () => {
  const groups = parseRobots(ROBOTS);

  it('applique les règles génériques', () => {
    expect(isAllowed(groups, 'SomeBot/1.0', '/about')).toBe(true);
    expect(isAllowed(groups, 'SomeBot/1.0', '/rooms/123')).toBe(false);
  });

  it('fait primer la règle la plus spécifique', () => {
    expect(isAllowed(groups, 'SomeBot/1.0', '/rooms/public/123')).toBe(true);
  });

  it('préfère le groupe nommant explicitement l\'agent', () => {
    expect(isAllowed(groups, 'AtriumBot/0.1', '/about')).toBe(false);
  });

  it('autorise quand aucun groupe ne s\'applique', () => {
    expect(isAllowed(parseRobots('User-agent: Other\nDisallow: /'), 'AtriumBot', '/x')).toBe(true);
  });
});
