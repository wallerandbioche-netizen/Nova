'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

const PHOTOS = [
  '/demo/01-exterior-front.jpg',
  '/demo/02-living-room.jpg',
  '/demo/04-kitchen.jpg',
  '/demo/10-pool.jpg',
];

/**
 * The before/after demonstration: still photos on the left, and on the right the same photos as
 * the product treats them — framed for 9:16 and moving.
 */
export function PreviewStrip() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setActive((current) => (current + 1) % PHOTOS.length), 2600);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="grid items-start gap-8 md:grid-cols-[1fr_auto_1fr]">
      <div>
        <p className="mb-3 text-xs font-medium uppercase tracking-widest text-ink-400">Vos photos</p>
        <div className="grid grid-cols-2 gap-3">
          {PHOTOS.map((photo, index) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={photo}
              src={photo}
              alt=""
              className={cn(
                'aspect-3/2 w-full rounded-xl object-cover transition-all duration-500',
                active === index ? 'opacity-100 ring-2 ring-accent-500/60' : 'opacity-45',
              )}
            />
          ))}
        </div>
      </div>

      <div className="hidden self-center pt-8 text-ink-300 md:block" aria-hidden>
        <svg width="40" height="24" viewBox="0 0 40 24" fill="none">
          <path
            d="M2 12h34m0 0-8-8m8 8-8 8"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </div>

      <div>
        <p className="mb-3 text-xs font-medium uppercase tracking-widest text-ink-400">Votre vidéo</p>
        <div className="relative mx-auto aspect-9/16 w-full max-w-[240px] overflow-hidden rounded-2xl bg-ink-950 shadow-[var(--shadow-lift)]">
          {PHOTOS.map((photo, index) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={photo}
              src={photo}
              alt=""
              className={cn(
                'absolute inset-0 h-full w-full object-cover transition-opacity duration-1000',
                active === index ? 'opacity-100' : 'opacity-0',
              )}
              style={{
                // A slow push, the same kind of move the renderer applies.
                transform: active === index ? 'scale(1.09)' : 'scale(1)',
                transition: 'transform 3.6s ease-out, opacity 1.2s ease-in-out',
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
