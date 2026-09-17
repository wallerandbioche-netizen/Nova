'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/utils/cn';

export interface DropdownItem {
  label: string;
  href?: string;
  onSelect?: () => void;
  tone?: 'default' | 'danger';
}

export interface DropdownProps {
  trigger: ReactNode;
  items: DropdownItem[];
  align?: 'left' | 'right';
  label?: string;
}

/** Menu button with outside-click and Escape dismissal. */
export function Dropdown({ trigger, items, align = 'right', label = 'Menu' }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-surface-raised"
      >
        {trigger}
      </button>

      {open && (
        <div
          role="menu"
          className={cn(
            'absolute z-40 mt-2 min-w-48 animate-slide-down overflow-hidden rounded-xl border border-border',
            'bg-surface-raised py-1 shadow-lift',
            align === 'right' ? 'right-0' : 'left-0',
          )}
        >
          {items.map((item) =>
            item.href ? (
              <Link
                key={item.label}
                href={item.href}
                role="menuitem"
                onClick={() => setOpen(false)}
                className={cn(
                  'block px-3.5 py-2 text-sm transition-colors hover:bg-[#1D222C]',
                  item.tone === 'danger' ? 'text-danger' : 'text-content-muted hover:text-content',
                )}
              >
                {item.label}
              </Link>
            ) : (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  item.onSelect?.();
                }}
                className={cn(
                  'block w-full px-3.5 py-2 text-left text-sm transition-colors hover:bg-[#1D222C]',
                  item.tone === 'danger' ? 'text-danger' : 'text-content-muted hover:text-content',
                )}
              >
                {item.label}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}
