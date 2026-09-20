'use client';

import { Maximize2, Minimize2, Sparkles } from 'lucide-react';
import type { Asset, Timeframe } from '@/types/market';
import { TIMEFRAMES } from '@/types/market';
import type { DrawingTool, IndicatorToggles } from '@/types/chart';
import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/segmented';
import { Select } from '@/components/ui/select';
import { ASSET_CLASS_LABEL } from '@/lib/market-data';
import { cn } from '@/lib/utils/cn';
import { DrawingToolbar } from './drawing-toolbar';
import { IndicatorMenu } from './indicator-menu';

export function ChartToolbar({
  assets,
  assetId,
  onAssetChange,
  timeframe,
  onTimeframeChange,
  indicators,
  onIndicatorsChange,
  tool,
  onToolChange,
  onClearDrawings,
  drawingCount,
  fullscreen,
  onFullscreenToggle,
  onAnalyze,
  analyzing,
  className,
}: {
  assets: Asset[];
  assetId: string;
  onAssetChange: (assetId: string) => void;
  timeframe: Timeframe;
  onTimeframeChange: (timeframe: Timeframe) => void;
  indicators: IndicatorToggles;
  onIndicatorsChange: (indicators: IndicatorToggles) => void;
  tool: DrawingTool;
  onToolChange: (tool: DrawingTool) => void;
  onClearDrawings: () => void;
  drawingCount: number;
  fullscreen: boolean;
  onFullscreenToggle: () => void;
  onAnalyze: () => void;
  analyzing: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-2 border-b border-line px-3 py-2.5',
        className,
      )}
    >
      <Select
        label="Actif"
        className="w-[190px]"
        value={assetId}
        onChange={onAssetChange}
        options={assets.map((asset) => ({
          value: asset.id,
          label: asset.symbol,
          description: asset.name,
          group: ASSET_CLASS_LABEL[asset.assetClass],
        }))}
      />

      <Segmented
        label="Unité de temps"
        size="sm"
        value={timeframe}
        onChange={onTimeframeChange}
        options={TIMEFRAMES.map((item) => ({ value: item, label: item }))}
        className="hidden md:inline-flex"
      />
      <Select
        label="Unité de temps"
        className="w-[96px] md:hidden"
        value={timeframe}
        onChange={onTimeframeChange}
        options={TIMEFRAMES.map((item) => ({ value: item, label: item }))}
      />

      <div className="ml-auto flex flex-wrap items-center gap-2">
        <DrawingToolbar
          tool={tool}
          onToolChange={onToolChange}
          onClear={onClearDrawings}
          count={drawingCount}
          className="hidden sm:inline-flex"
        />
        <IndicatorMenu value={indicators} onChange={onIndicatorsChange} />
        <Button
          variant="secondary"
          size="icon"
          aria-label={fullscreen ? 'Quitter le plein écran' : 'Passer en plein écran'}
          onClick={onFullscreenToggle}
          className="hidden sm:inline-flex"
        >
          {fullscreen ? (
            <Minimize2 className="h-4 w-4" aria-hidden />
          ) : (
            <Maximize2 className="h-4 w-4" aria-hidden />
          )}
        </Button>
        <Button onClick={onAnalyze} disabled={analyzing}>
          <Sparkles className="h-4 w-4" aria-hidden />
          {analyzing ? 'Analyse…' : 'Analyser'}
        </Button>
      </div>
    </div>
  );
}
