import type { SentimentLabel } from '../types';

export function formatIdr(value: number, decimals = 0): string {
  if (!Number.isFinite(value) || value === 0) return '—';
  return new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatSignedPercent(value: number): string {
  if (!Number.isFinite(value)) return '0,00%';
  const prefix = value > 0 ? '+' : '';
  return `${prefix}${value.toFixed(2).replace('.', ',')}%`;
}

export function formatCompactVolume(volume: number): string {
  if (!Number.isFinite(volume) || volume <= 0) return '—';
  if (volume >= 1_000_000_000) return `${(volume / 1_000_000_000).toFixed(2)}B`;
  if (volume >= 1_000_000) return `${(volume / 1_000_000).toFixed(2)}M`;
  if (volume >= 1_000) return `${(volume / 1_000).toFixed(1)}K`;
  return String(Math.round(volume));
}

export function formatBillionIdr(valueB: number | null | undefined): string {
  if (valueB === null || valueB === undefined || !Number.isFinite(valueB)) return '—';
  const abs = Math.abs(valueB);
  const sign = valueB < 0 ? '-' : '';
  if (abs >= 1000) {
    return `${sign}Rp${(abs / 1000).toFixed(2)} T`;
  }
  return `${sign}Rp${abs.toLocaleString('id-ID')} M`;
}

export function getChangeColorClass(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value) || value === 0) {
    return 'text-slate-600 dark:text-slate-400';
  }
  if (value > 0) return 'text-emerald-700 dark:text-emerald-400';
  return 'text-red-700 dark:text-red-400';
}

export function getSentimentTextClass(sentiment: SentimentLabel): string {
  if (sentiment === 'Positif') return 'text-emerald-700 dark:text-emerald-400';
  if (sentiment === 'Negatif') return 'text-red-700 dark:text-red-400';
  return 'text-amber-700 dark:text-amber-400';
}
