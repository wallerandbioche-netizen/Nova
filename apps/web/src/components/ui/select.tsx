'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export interface SelectOption<T extends string> {
  value: T;
  label: string;
  description?: string;
  group?: string;
}

/** Accessible listbox: keyboard driven, closes on Escape or outside click. */
export function Select<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
  buttonClassName,
  renderValue,
}: {
  options: SelectOption<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  className?: string;
  buttonClassName?: string;
  renderValue?: (option: SelectOption<T> | undefined) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value);

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

  const groups = options.reduce<Record<string, SelectOption<T>[]>>((accumulator, option) => {
    const key = option.group ?? '';
    accumulator[key] = [...(accumulator[key] ?? []), option];
    return accumulator;
  }, {});

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((previous) => !previous)}
        className={cn(
          'inline-flex h-9 w-full items-center justify-between gap-2 rounded-[var(--radius-control)] border border-line bg-surface px-3 text-sm font-medium text-ink transition-colors hover:border-line-strong',
          buttonClassName,
        )}
      >
        <span className="truncate">
          {renderValue ? renderValue(selected) : (selected?.label ?? label)}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-ink-subtle" aria-hidden />
      </button>

      {open ? (
        <div
          role="listbox"
          aria-label={label}
          className="animate-fade-rise scroll-slim absolute z-40 mt-1.5 max-h-80 w-full min-w-56 overflow-y-auto rounded-[var(--radius-card)] border border-line bg-surface p-1.5 shadow-pop"
        >
          {Object.entries(groups).map(([group, groupOptions]) => (
            <div key={group}>
              {group ? (
                <p className="px-2.5 pt-2 pb-1 text-[11px] font-semibold tracking-[0.08em] text-ink-subtle uppercase">
                  {group}
                </p>
              ) : null}
              {groupOptions.map((option) => {
                const active = option.value === value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => {
                      onChange(option.value);
                      setOpen(false);
                    }}
                    className={cn(
                      'flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-left text-sm transition-colors',
                      active ? 'bg-brand-soft text-brand' : 'text-ink hover:bg-surface-muted',
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{option.label}</span>
                      {option.description ? (
                        <span className="block truncate text-[12px] text-ink-muted">
                          {option.description}
                        </span>
                      ) : null}
                    </span>
                    {active ? <Check className="h-4 w-4 shrink-0" aria-hidden /> : null}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
