'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { CheckCircle2, Info, TriangleAlert, X } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface Toast {
  id: string;
  title: string;
  description?: string;
  tone: 'info' | 'success' | 'warning';
}

interface ToastContextValue {
  push(toast: Omit<Toast, 'id'>): void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((current) => [...current, { ...toast, id }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id));
    }, 5_000);
  }, []);

  const value = useMemo(() => ({ push }), [push]);

  const icons = {
    info: Info,
    success: CheckCircle2,
    warning: TriangleAlert,
  } as const;

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed right-4 bottom-4 z-[100] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2"
      >
        {toasts.map((toast) => {
          const Icon = icons[toast.tone];
          return (
            <div
              key={toast.id}
              className="animate-fade-rise pointer-events-auto flex items-start gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-3 shadow-pop"
            >
              <Icon
                className={cn(
                  'mt-0.5 h-4 w-4 shrink-0',
                  toast.tone === 'success' && 'text-long',
                  toast.tone === 'warning' && 'text-warn',
                  toast.tone === 'info' && 'text-brand',
                )}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold text-ink">{toast.title}</p>
                {toast.description ? (
                  <p className="mt-0.5 text-[12px] leading-4 text-ink-muted">{toast.description}</p>
                ) : null}
              </div>
              <button
                type="button"
                aria-label="Fermer la notification"
                onClick={() =>
                  setToasts((current) => current.filter((item) => item.id !== toast.id))
                }
                className="text-ink-subtle hover:text-ink"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside <ToastProvider>');
  return context;
}
