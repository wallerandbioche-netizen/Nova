'use client';

import {
  Crosshair,
  Minus,
  MoveDownRight,
  Octagon,
  Square,
  Target,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import type { DrawingTool } from '@/types/chart';
import { DRAWING_TOOL_LABEL } from '@/types/chart';
import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils/cn';

const TOOLS: { tool: DrawingTool; icon: typeof Minus }[] = [
  { tool: 'cursor', icon: Crosshair },
  { tool: 'trendline', icon: MoveDownRight },
  { tool: 'horizontal', icon: Minus },
  { tool: 'support', icon: TrendingUp },
  { tool: 'resistance', icon: Octagon },
  { tool: 'entry', icon: Target },
  { tool: 'stop', icon: Square },
];

/**
 * Drawing tools. The chart click handler turns the armed tool into a drawing;
 * the tools themselves stay dumb so new ones only need an entry here.
 */
export function DrawingToolbar({
  tool,
  onToolChange,
  onClear,
  count,
  className,
}: {
  tool: DrawingTool;
  onToolChange: (tool: DrawingTool) => void;
  onClear: () => void;
  count: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-0.5 rounded-[var(--radius-control)] border border-line bg-surface p-1',
        className,
      )}
      role="toolbar"
      aria-label="Outils de dessin"
    >
      {TOOLS.map(({ tool: item, icon: Icon }) => (
        <Tooltip key={item} content={DRAWING_TOOL_LABEL[item]}>
          <button
            type="button"
            aria-label={DRAWING_TOOL_LABEL[item]}
            aria-pressed={tool === item}
            onClick={() => onToolChange(item)}
            className={cn(
              'flex h-7 w-7 items-center justify-center rounded-md transition-colors',
              tool === item ? 'bg-brand-soft text-brand' : 'text-ink-muted hover:bg-surface-muted',
            )}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden />
          </button>
        </Tooltip>
      ))}
      <span className="mx-1 h-4 w-px bg-line" />
      <Tooltip content={`Effacer les tracés (${count})`}>
        <button
          type="button"
          aria-label="Effacer les tracés"
          onClick={onClear}
          disabled={count === 0}
          className="flex h-7 w-7 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-surface-muted disabled:opacity-40"
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden />
        </button>
      </Tooltip>
    </div>
  );
}
