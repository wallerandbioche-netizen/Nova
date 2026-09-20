'use client';

import { useEffect } from 'react';
import { useSettings } from '@/hooks/use-settings';

/** Keeps `data-theme` in sync with the stored preference, including `auto`. */
export function ThemeSync() {
  const [settings] = useSettings();

  useEffect(() => {
    const apply = () => {
      const preference = settings.theme;
      const resolved =
        preference === 'auto'
          ? window.matchMedia('(prefers-color-scheme: dark)').matches
            ? 'dark'
            : 'light'
          : preference;
      document.documentElement.dataset.theme = resolved;
    };

    apply();
    if (settings.theme !== 'auto') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [settings.theme]);

  return null;
}
