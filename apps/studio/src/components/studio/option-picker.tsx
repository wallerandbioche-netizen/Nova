'use client';

import { cn } from '@/lib/utils';

export interface Option<T extends string> {
  value: T;
  label: string;
  hint?: string;
}

/** A single, consistent control for style, format and duration. */
export function OptionPicker<T extends string>({
  label,
  options,
  value,
  onChange,
  columns = 2,
}: {
  label: string;
  options: Option<T>[];
  value: T;
  onChange: (next: T) => void;
  columns?: 2 | 3 | 4;
}) {
  return (
    <fieldset>
      <legend className="mb-3 text-sm font-medium text-ink-700">{label}</legend>
      <div
        className={cn(
          'grid gap-2',
          columns === 2 && 'grid-cols-2',
          columns === 3 && 'grid-cols-3',
          columns === 4 && 'grid-cols-2 sm:grid-cols-4',
        )}
      >
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={value === option.value}
            className={cn(
              'rounded-xl border px-3.5 py-3 text-left transition-all',
              value === option.value
                ? 'border-ink-900 bg-ink-900 text-white'
                : 'border-ink-200 bg-white text-ink-700 hover:border-ink-300',
            )}
          >
            <span className="block text-sm font-medium">{option.label}</span>
            {option.hint ? (
              <span
                className={cn(
                  'mt-0.5 block text-xs',
                  value === option.value ? 'text-white/70' : 'text-ink-400',
                )}
              >
                {option.hint}
              </span>
            ) : null}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
