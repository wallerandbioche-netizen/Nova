'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { readSettings } from '@/lib/storage/settings';

/** Screens a visitor may reach before answering the questionnaire. */
const PUBLIC_PATHS = ['/bienvenue', '/connexion'];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) => pathname.startsWith(path));
}

/**
 * Runs before the first paint, so a first-time visitor never sees the
 * application flash behind the questionnaire. Kept inline and tiny, like the
 * theme script; a browser without usable storage simply falls through.
 */
export function OnboardingScript() {
  const script = `(function(){try{var p=location.pathname;if(p.indexOf('/bienvenue')===0||p.indexOf('/connexion')===0)return;var raw=localStorage.getItem('scantrade.settings.v1');if(raw&&JSON.parse(raw).onboarded)return;location.replace('/bienvenue');}catch(e){}})();`;
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}

/**
 * Same gate for navigations that happen without a page load — the script above
 * only runs once, when the document is first served.
 */
export function OnboardingRedirect() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (isPublic(pathname)) return;
    if (readSettings().onboarded) return;
    router.replace('/bienvenue');
  }, [pathname, router]);

  return null;
}
