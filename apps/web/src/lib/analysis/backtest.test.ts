import { describe, expect, it } from 'vitest';
import type { Candle } from '@/types/market';
import { buildReport, simulateSetup, type BacktestTrade } from './backtest';

const setup = {
  direction: 'long' as const,
  entryZone: { low: 99, high: 101 },
  stopLoss: 95,
  takeProfits: [
    { label: 'TP1' as const, price: 105, r: 1, rationale: '' },
    { label: 'TP2' as const, price: 110, r: 2, rationale: '' },
  ],
};

const candle = (high: number, low: number): Candle => ({
  time: 0,
  open: (high + low) / 2,
  high,
  low,
  close: (high + low) / 2,
  volume: 1,
});

describe('simulateSetup', () => {
  it('records a win when the target is reached first', () => {
    const trade = simulateSetup(setup, [candle(102, 99), candle(111, 104)]);
    expect(trade.outcome).toBe('win');
    expect(trade.r).toBeCloseTo(2, 5);
  });

  it('records a loss when the stop is reached first', () => {
    const trade = simulateSetup(setup, [candle(101, 94)]);
    expect(trade.outcome).toBe('loss');
    expect(trade.r).toBe(-1);
  });

  it('counts a candle touching both levels as a loss', () => {
    const trade = simulateSetup(setup, [candle(115, 90)]);
    expect(trade.outcome).toBe('loss');
  });

  it('leaves the trade open when neither level is reached', () => {
    const trade = simulateSetup(setup, [candle(103, 98), candle(104, 99)]);
    expect(trade.outcome).toBe('open');
  });
});

describe('buildReport', () => {
  const trades: BacktestTrade[] = [
    { direction: 'long', entry: 100, stopLoss: 95, target: 110, r: 2, outcome: 'win', barsHeld: 4 },
    {
      direction: 'long',
      entry: 100,
      stopLoss: 95,
      target: 110,
      r: -1,
      outcome: 'loss',
      barsHeld: 2,
    },
    {
      direction: 'short',
      entry: 100,
      stopLoss: 105,
      target: 90,
      r: 2,
      outcome: 'win',
      barsHeld: 6,
    },
    {
      direction: 'short',
      entry: 100,
      stopLoss: 105,
      target: 90,
      r: -1,
      outcome: 'loss',
      barsHeld: 3,
    },
    {
      direction: 'long',
      entry: 100,
      stopLoss: 95,
      target: 110,
      r: 0.5,
      outcome: 'open',
      barsHeld: 9,
    },
  ];

  it('ignores open trades and computes the usual metrics', () => {
    const report = buildReport(trades);
    expect(report.totalTrades).toBe(4);
    expect(report.wins).toBe(2);
    expect(report.losses).toBe(2);
    expect(report.winRate).toBe(50);
    expect(report.averageR).toBeCloseTo(0.5, 5);
    expect(report.profitFactor).toBe(2);
    expect(report.expectancy).toBeCloseTo(0.5, 5);
    expect(report.equityCurve).toEqual([2, 1, 3, 2]);
    expect(report.maxDrawdown).toBe(1);
  });

  it('always carries the past-performance disclaimer', () => {
    expect(buildReport([]).disclaimer).toContain('ne préjugent pas');
  });
});
