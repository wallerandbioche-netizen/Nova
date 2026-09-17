'use client';

import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { Button } from './button';
import { cn } from '@/utils/cn';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  /** Widens the panel for content-heavy dialogs. */
  size?: 'sm' | 'md';
}

/**
 * Accessible dialog (§48).
 *
 * Focus moves into the panel on open and returns to the trigger on close;
 * Tab is kept inside the panel; Escape and the backdrop both dismiss.
 */
export function Modal({ open, onClose, title, description, children, footer, size = 'sm' }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  const focusables = useCallback((): HTMLElement[] => {
    const root = panelRef.current;
    if (!root) return [];
    return Array.from(
      root.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
      ),
    );
  }, []);

  useEffect(() => {
    if (!open) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const timer = window.setTimeout(() => {
      const [first] = focusables();
      (first ?? panelRef.current)?.focus();
    }, 0);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;

      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused.current?.focus();
    };
  }, [open, onClose, focusables]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div
        className="absolute inset-0 bg-black/70 animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        tabIndex={-1}
        className={cn(
          'relative w-full animate-fade-up rounded-t-2xl border border-border bg-surface shadow-lift',
          'sm:rounded-2xl',
          size === 'sm' ? 'sm:max-w-md' : 'sm:max-w-lg',
        )}
      >
        <div className="px-5 pt-5 sm:px-6 sm:pt-6">
          <h2 id="modal-title" className="text-lg font-semibold text-content">
            {title}
          </h2>
          {description && <div className="mt-2 text-sm text-content-muted">{description}</div>}
        </div>
        {children && <div className="px-5 py-5 sm:px-6">{children}</div>}
        <div className="flex flex-col-reverse gap-2 px-5 pb-5 pt-2 sm:flex-row sm:justify-end sm:px-6 sm:pb-6">
          {footer ?? (
            <Button variant="secondary" onClick={onClose}>
              Fermer
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
