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

    // Older Safari only exposes the deprecated listener API.
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', apply);
      return () => media.removeEventListener('change', apply);
    }
    media.addListener(apply);
    return () => media.removeListener(apply);
  }, [settings.theme]);

  return null;
}
