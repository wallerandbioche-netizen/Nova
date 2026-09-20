'use client';

import { useEffect, useRef, useState } from 'react';
import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  LineStyle,
  createChart,
  createSeriesMarkers,
  type IChartApi,
  type ISeriesApi,
  type SeriesMarker,
  type Time,
  type UTCTimestamp,
} from 'lightweight-charts';
import type { Candle } from '@/types/market';
import type { LevelZone, SwingPoint, TradeSetup } from '@/types/analysis';
import type { Drawing, IndicatorToggles } from '@/types/chart';
import { computeIndicatorSeries } from '@/lib/analysis/indicators';
import { paletteFor } from '@/lib/charts/theme';
import { cn } from '@/lib/utils/cn';

export interface PriceChartProps {
  candles: Candle[];
  precision: number;
  indicators: IndicatorToggles;
  setup?: TradeSetup | null;
  levels?: LevelZone[];
  swings?: SwingPoint[];
  drawings?: Drawing[];
  theme?: 'light' | 'dark';
  height?: number;
  className?: string;
  /** Fired with the price under the pointer when a drawing tool is armed. */
  onChartClick?: (point: { time: number; price: number }) => void;
  crosshairArmed?: boolean;
}

interface OverlayBand {
  id: string;
  top: number;
  height: number;
  color: string;
  label: string;
  labelColor: string;
}

const PANE_HEIGHTS = { rsi: 90, macd: 90 };

export function PriceChart({
  candles,
  precision,
  indicators,
  setup = null,
  levels = [],
  swings = [],
  drawings = [],
  theme = 'light',
  height = 460,
  className,
  onChartClick,
  crosshairArmed = false,
}: PriceChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const priceSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const clickHandlerRef = useRef(onChartClick);
  const [bands, setBands] = useState<OverlayBand[]>([]);

  clickHandlerRef.current = onChartClick;

  useEffect(() => {
    const container = containerRef.current;
    if (!container || candles.length === 0) return;

    const palette = paletteFor(theme);
    const chart = createChart(container, {
      width: container.clientWidth,
      height,
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: palette.background },
        textColor: palette.text,
        fontFamily: 'var(--font-sans)',
        fontSize: 11,
        attributionLogo: false,
        panes: { separatorColor: palette.border, separatorHoverColor: palette.grid },
      },
      grid: {
        vertLines: { color: palette.grid },
        horzLines: { color: palette.grid },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: palette.crosshair,
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: palette.text,
        },
        horzLine: {
          color: palette.crosshair,
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: palette.text,
        },
      },
      rightPriceScale: {
        borderColor: palette.border,
        scaleMargins: { top: 0.12, bottom: indicators.volume ? 0.26 : 0.1 },
      },
      timeScale: {
        borderColor: palette.border,
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 6,
        barSpacing: 7,
      },
      handleScroll: true,
      handleScale: true,
      localization: { locale: 'fr-FR' },
    });

    const priceSeries = chart.addSeries(CandlestickSeries, {
      upColor: palette.up,
      downColor: palette.down,
      wickUpColor: palette.up,
      wickDownColor: palette.down,
      borderVisible: false,
      priceFormat: { type: 'price', precision, minMove: 1 / 10 ** precision },
    });
    priceSeries.setData(
      candles.map((candle) => ({
        time: candle.time as UTCTimestamp,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
      })),
    );

    if (indicators.volume) {
      const volumeSeries = chart.addSeries(HistogramSeries, {
        priceFormat: { type: 'volume' },
        priceScaleId: '',
      });
      volumeSeries.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
      volumeSeries.setData(
        candles.map((candle) => ({
          time: candle.time as UTCTimestamp,
          value: candle.volume,
          color: candle.close >= candle.open ? palette.volumeUp : palette.volumeDown,
        })),
      );
    }

    const computed = computeIndicatorSeries(candles);
    const addLine = (values: (number | null)[], color: string, title: string, width: 1 | 2 = 1) => {
      const series = chart.addSeries(LineSeries, {
        color,
        lineWidth: width,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
        title,
      });
      series.setData(
        candles
          .map((candle, index) => ({ time: candle.time as UTCTimestamp, value: values[index] }))
          .filter((point): point is { time: UTCTimestamp; value: number } => point.value != null),
      );
    };

    if (indicators.ema20) addLine(computed.ema20, palette.ema20, 'EMA 20');
    if (indicators.ema50) addLine(computed.ema50, palette.ema50, 'EMA 50');
    if (indicators.ema200) addLine(computed.ema200, palette.ema200, 'EMA 200');
    if (indicators.vwap) addLine(computed.vwap, palette.vwap, 'VWAP');

    let paneIndex = 1;
    if (indicators.rsi) {
      const rsiSeries = chart.addSeries(
        LineSeries,
        { color: palette.ema20, lineWidth: 1, priceLineVisible: false, title: 'RSI 14' },
        paneIndex,
      );
      rsiSeries.setData(
        candles
          .map((candle, index) => ({
            time: candle.time as UTCTimestamp,
            value: computed.rsi14[index],
          }))
          .filter((point): point is { time: UTCTimestamp; value: number } => point.value != null),
      );
      rsiSeries.createPriceLine({
        price: 70,
        color: palette.down,
        lineStyle: LineStyle.Dotted,
        lineWidth: 1,
        title: '70',
      });
      rsiSeries.createPriceLine({
        price: 30,
        color: palette.up,
        lineStyle: LineStyle.Dotted,
        lineWidth: 1,
        title: '30',
      });
      chart.panes()[paneIndex]?.setHeight(PANE_HEIGHTS.rsi);
      paneIndex += 1;
    }

    if (indicators.macd) {
      const histogram = chart.addSeries(
        HistogramSeries,
        { priceFormat: { type: 'price', precision: 2, minMove: 0.01 }, title: 'MACD' },
        paneIndex,
      );
      histogram.setData(
        candles
          .map((candle, index) => {
            const point = computed.macd[index];
            if (!point || point.histogram == null) return null;
            return {
              time: candle.time as UTCTimestamp,
              value: point.histogram,
              color: point.histogram >= 0 ? palette.volumeUp : palette.volumeDown,
            };
          })
          .filter(
            (point): point is { time: UTCTimestamp; value: number; color: string } =>
              point !== null,
          ),
      );
      chart.panes()[paneIndex]?.setHeight(PANE_HEIGHTS.macd);
    }

    // Structure markers: the labelled swings the engine actually found.
    const markers: SeriesMarker<Time>[] = swings
      .filter((swing) => swing.label)
      .slice(-8)
      .map((swing) => ({
        time: swing.time as UTCTimestamp,
        position: swing.kind === 'high' ? 'aboveBar' : 'belowBar',
        color: swing.label === 'HH' || swing.label === 'HL' ? palette.up : palette.down,
        shape: swing.kind === 'high' ? 'arrowDown' : 'arrowUp',
        text: swing.label ?? '',
        size: 0,
      }));
    if (markers.length) createSeriesMarkers(priceSeries, markers);

    // Trade plan: entry zone bounds, stop and targets as labelled price lines.
    const priceLines: { price: number; color: string; title: string; style: LineStyle }[] = [];
    if (setup) {
      priceLines.push(
        {
          price: setup.entryZone.low,
          color: palette.entry,
          title: 'Entrée bas',
          style: LineStyle.Dashed,
        },
        {
          price: setup.entryZone.high,
          color: palette.entry,
          title: 'Entrée haut',
          style: LineStyle.Dashed,
        },
        { price: setup.stopLoss, color: palette.stop, title: 'Stop', style: LineStyle.Solid },
        ...setup.takeProfits.map((takeProfit) => ({
          price: takeProfit.price,
          color: palette.target,
          title: takeProfit.label,
          style: LineStyle.Dotted,
        })),
      );
    }
    levels.slice(0, 3).forEach((level) => {
      priceLines.push({
        price: level.price,
        color: level.type === 'support' ? palette.support : palette.resistance,
        title: level.type === 'support' ? 'Support' : 'Résistance',
        style: LineStyle.Dotted,
      });
    });
    drawings.forEach((drawing) => {
      const first = drawing.points[0];
      if (!first || drawing.tool === 'trendline' || drawing.tool === 'zone') return;
      priceLines.push({
        price: first.price,
        color: drawing.color ?? palette.text,
        title: drawing.label ?? '',
        style: LineStyle.Dashed,
      });
    });

    priceLines.forEach((line) => {
      priceSeries.createPriceLine({
        price: line.price,
        color: line.color,
        lineWidth: 1,
        lineStyle: line.style,
        axisLabelVisible: true,
        title: line.title,
      });
    });

    // Free-form trendlines and zones are drawn as their own line series.
    drawings.forEach((drawing) => {
      if (drawing.tool !== 'trendline' && drawing.tool !== 'zone') return;
      const [start, end] = drawing.points;
      if (!start || !end) return;
      const series = chart.addSeries(LineSeries, {
        color: drawing.color ?? palette.entry,
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      const ordered = [start, end].sort((a, b) => a.time - b.time);
      series.setData(
        ordered.map((point) => ({ time: point.time as UTCTimestamp, value: point.price })),
      );
    });

    chart.timeScale().fitContent();

    const handleClick = (param: {
      time?: Time;
      point?: { x: number; y: number };
      paneIndex?: number;
    }) => {
      const handler = clickHandlerRef.current;
      if (!handler || !param.point || param.time === undefined) return;
      // Coordinates are pane relative: only the price pane can be converted.
      if (param.paneIndex !== undefined && param.paneIndex !== 0) return;
      const price = priceSeries.coordinateToPrice(param.point.y);
      if (price == null) return;
      handler({ time: Number(param.time), price: Number(price) });
    };
    chart.subscribeClick(handleClick);

    // Shaded bands for the entry zone and the risk / reward areas.
    const updateBands = () => {
      if (!setup) {
        setBands([]);
        return;
      }
      const toCoordinate = (price: number) => priceSeries.priceToCoordinate(price);
      const entryTop = toCoordinate(setup.entryZone.high);
      const entryBottom = toCoordinate(setup.entryZone.low);
      const stop = toCoordinate(setup.stopLoss);
      const lastTarget = setup.takeProfits[setup.takeProfits.length - 1];
      const target = lastTarget ? toCoordinate(lastTarget.price) : null;
      const next: OverlayBand[] = [];

      if (entryTop != null && entryBottom != null) {
        next.push({
          id: 'entry',
          top: Math.min(entryTop, entryBottom),
          height: Math.max(Math.abs(entryBottom - entryTop), 2),
          color: 'color-mix(in srgb, var(--color-brand) 14%, transparent)',
          label: "Zone d'entrée",
          labelColor: 'var(--color-brand)',
        });
      }
      const entryEdge = setup.direction === 'long' ? entryBottom : entryTop;
      if (stop != null && entryEdge != null) {
        next.push({
          id: 'risk',
          top: Math.min(stop, entryEdge),
          height: Math.max(Math.abs(stop - entryEdge), 2),
          color: 'color-mix(in srgb, var(--color-short) 9%, transparent)',
          label: 'Risque',
          labelColor: 'var(--color-short)',
        });
      }
      const targetEdge = setup.direction === 'long' ? entryTop : entryBottom;
      if (target != null && targetEdge != null) {
        next.push({
          id: 'reward',
          top: Math.min(target, targetEdge),
          height: Math.max(Math.abs(target - targetEdge), 2),
          color: 'color-mix(in srgb, var(--color-long) 8%, transparent)',
          label: 'Objectifs',
          labelColor: 'var(--color-long)',
        });
      }
      setBands(next);
    };

    updateBands();
    chart.timeScale().subscribeVisibleLogicalRangeChange(updateBands);
    const resizeObserver = new ResizeObserver(() => updateBands());
    resizeObserver.observe(container);

    chartRef.current = chart;
    priceSeriesRef.current = priceSeries;

    return () => {
      resizeObserver.disconnect();
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(updateBands);
      chart.unsubscribeClick(handleClick);
      chart.remove();
      chartRef.current = null;
      priceSeriesRef.current = null;
    };
  }, [candles, precision, indicators, setup, levels, swings, drawings, theme, height]);

  return (
    <div className={cn('relative w-full', className)} style={{ height }}>
      <div
        ref={containerRef}
        className={cn('h-full w-full', crosshairArmed && 'cursor-crosshair')}
        role="img"
        aria-label="Graphique en chandeliers"
      />
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {bands.map((band) => (
          <div
            key={band.id}
            className="absolute right-[64px] left-0 border-y border-dashed"
            style={{
              top: band.top,
              height: band.height,
              background: band.color,
              borderColor: band.labelColor,
              opacity: 0.9,
            }}
          >
            <span
              className="absolute top-0.5 left-2 rounded px-1 text-[10px] font-semibold"
              style={{ color: band.labelColor }}
            >
              {band.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
