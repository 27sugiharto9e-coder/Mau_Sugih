import { useMemo, useState } from 'react';
import type { CandlePoint, NewsArticle } from '../types';
import { formatCompactVolume, formatIdr } from '../utils/formatters';

interface CandlestickChartProps {
  ticker: string;
  candles: CandlePoint[];
  range: string;
  onRangeChange: (nextRange: string) => void;
  loading: boolean;
  relatedNews: NewsArticle[];
  onSelectNews?: (article: NewsArticle) => void;
}

const RANGES = [
  { key: '1d', label: '1H' },
  { key: '5d', label: '5H' },
  { key: '1mo', label: '1B' },
  { key: '3mo', label: '3B' },
  { key: '1y', label: '1T' },
];

export function CandlestickChart({
  ticker,
  candles,
  range,
  onRangeChange,
  loading,
  relatedNews,
  onSelectNews,
}: CandlestickChartProps) {
  const [showMa20, setShowMa20] = useState(true);
  const [showMa50, setShowMa50] = useState(true);
  const [showRsi, setShowRsi] = useState(true);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const chartGeom = useMemo(() => {
    const svgW = 860;
    const priceH = 260;
    const volH = 54;
    const rsiH = showRsi ? 78 : 0;
    const padLeft = 12;
    const padRight = 64;
    const padTop = 16;
    const gapVol = 14;
    const gapRsi = showRsi ? 24 : 0;
    const totalH = padTop + priceH + gapVol + volH + gapRsi + rsiH + 26;

    if (candles.length === 0) {
      return {
        svgW,
        totalH,
        priceH,
        volH,
        rsiH,
        padLeft,
        padRight,
        padTop,
        gapVol,
        gapRsi,
        minPrice: 0,
        maxPrice: 100,
        maxVol: 1,
        plotW: svgW - padLeft - padRight,
      };
    }

    let minP = Infinity;
    let maxP = -Infinity;
    let maxV = 1;
    for (const c of candles) {
      if (c.low < minP) minP = c.low;
      if (c.high > maxP) maxP = c.high;
      if (showMa20 && c.ma20 !== null) {
        minP = Math.min(minP, c.ma20);
        maxP = Math.max(maxP, c.ma20);
      }
      if (showMa50 && c.ma50 !== null) {
        minP = Math.min(minP, c.ma50);
        maxP = Math.max(maxP, c.ma50);
      }
      if (c.volume > maxV) maxV = c.volume;
    }

    const pad = (maxP - minP) * 0.08 || maxP * 0.02 || 1;
    return {
      svgW,
      totalH,
      priceH,
      volH,
      rsiH,
      padLeft,
      padRight,
      padTop,
      gapVol,
      gapRsi,
      minPrice: minP - pad,
      maxPrice: maxP + pad,
      maxVol: maxV,
      plotW: svgW - padLeft - padRight,
    };
  }, [candles, showMa20, showMa50, showRsi]);

  const activeCandle =
    hoverIdx !== null && candles[hoverIdx]
      ? candles[hoverIdx]
      : candles[candles.length - 1] ?? null;

  const yForPrice = (price: number) => {
    const span = chartGeom.maxPrice - chartGeom.minPrice || 1;
    return (
      chartGeom.padTop +
      chartGeom.priceH -
      ((price - chartGeom.minPrice) / span) * chartGeom.priceH
    );
  };

  const yForRsi = (rsi: number) => {
    const rsiTop =
      chartGeom.padTop + chartGeom.priceH + chartGeom.gapVol + chartGeom.volH + chartGeom.gapRsi;
    return rsiTop + chartGeom.rsiH - (rsi / 100) * chartGeom.rsiH;
  };

  const buildLinePath = (extractor: (c: CandlePoint) => number | null, yMapper: (v: number) => number) => {
    let path = '';
    let started = false;
    candles.forEach((c, idx) => {
      const val = extractor(c);
      if (val === null) {
        started = false;
        return;
      }
      const x =
        chartGeom.padLeft +
        ((idx + 0.5) / Math.max(candles.length, 1)) * chartGeom.plotW;
      const y = yMapper(val);
      path += started ? ` L ${x.toFixed(1)} ${y.toFixed(1)}` : `M ${x.toFixed(1)} ${y.toFixed(1)}`;
      started = true;
    });
    return path;
  };

  const priceTicks = useMemo(() => {
    const span = chartGeom.maxPrice - chartGeom.minPrice;
    if (span <= 0) return [];
    return [0, 0.25, 0.5, 0.75, 1].map((t) => chartGeom.minPrice + t * span);
  }, [chartGeom.minPrice, chartGeom.maxPrice]);

  const xStep = chartGeom.plotW / Math.max(candles.length, 1);
  const candleBodyW = Math.max(2, Math.min(10, xStep * 0.64));

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
            {RANGES.map((r) => (
              <button
                key={r.key}
                type="button"
                onClick={() => onRangeChange(r.key)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  range === r.key
                    ? 'bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowMa20((v) => !v)}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                showMa20
                  ? 'border-amber-500/50 bg-amber-50/70 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                  : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'
              }`}
            >
              MA20
            </button>
            <button
              type="button"
              onClick={() => setShowMa50((v) => !v)}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                showMa50
                  ? 'border-sky-500/50 bg-sky-50/70 text-sky-800 dark:bg-sky-950/40 dark:text-sky-300'
                  : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'
              }`}
            >
              MA50
            </button>
            <button
              type="button"
              onClick={() => setShowRsi((v) => !v)}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                showRsi
                  ? 'border-teal-500/50 bg-teal-50/70 text-teal-800 dark:bg-teal-950/40 dark:text-teal-300'
                  : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'
              }`}
            >
              RSI (14)
            </button>
          </div>
        </div>

        {/* Live OHLCV Crosshair Readout */}
        {activeCandle ? (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono tabular-nums text-slate-600 dark:text-slate-300">
            <span className="text-slate-500 dark:text-slate-400">{activeCandle.dateLabel}</span>
            <span>
              O <strong className="text-slate-900 dark:text-slate-100">{formatIdr(activeCandle.open)}</strong>
            </span>
            <span>
              H <strong className="text-slate-900 dark:text-slate-100">{formatIdr(activeCandle.high)}</strong>
            </span>
            <span>
              L <strong className="text-slate-900 dark:text-slate-100">{formatIdr(activeCandle.low)}</strong>
            </span>
            <span>
              C{' '}
              <strong
                className={
                  activeCandle.close >= activeCandle.open
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : 'text-red-700 dark:text-red-400'
                }
              >
                {formatIdr(activeCandle.close)}
              </strong>
            </span>
            <span>Vol {formatCompactVolume(activeCandle.volume)}</span>
            {activeCandle.rsi14 !== null && (
              <span>
                RSI <strong className="text-teal-700 dark:text-teal-400">{activeCandle.rsi14.toFixed(1)}</strong>
              </span>
            )}
          </div>
        ) : null}
      </div>

      {/* Chart Area */}
      <div className="pt-4 relative">
        {loading ? (
          <div className="h-[380px] flex flex-col items-center justify-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <div className="w-6 h-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
            <span>Memuat data candlestick {ticker}...</span>
          </div>
        ) : candles.length === 0 ? (
          <div className="h-[380px] flex flex-col items-center justify-center text-center px-6">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Data historis grafik untuk {ticker} belum tersedia pada rentang ini.
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Coba pilih rentang waktu 1B atau 3B untuk melihat pergerakan harga harian.
            </p>
          </div>
        ) : (
          <svg
            viewBox={`0 0 ${chartGeom.svgW} ${chartGeom.totalH}`}
            className="w-full h-auto select-none"
            onMouseLeave={() => setHoverIdx(null)}
          >
            {/* Price Grid Lines */}
            {priceTicks.map((tick, i) => {
              const y = yForPrice(tick);
              return (
                <g key={i}>
                  <line
                    x1={chartGeom.padLeft}
                    x2={chartGeom.padLeft + chartGeom.plotW}
                    y1={y}
                    y2={y}
                    className="stroke-slate-200 dark:stroke-slate-800"
                    strokeDasharray="3 3"
                    strokeWidth="1"
                  />
                  <text
                    x={chartGeom.padLeft + chartGeom.plotW + 8}
                    y={y + 4}
                    className="fill-slate-500 dark:fill-slate-400 text-[10px] font-mono tabular-nums"
                  >
                    {formatIdr(tick)}
                  </text>
                </g>
              );
            })}

            {/* Candlesticks + Volume */}
            {candles.map((c, idx) => {
              const xCenter = chartGeom.padLeft + (idx + 0.5) * xStep;
              const isUp = c.close >= c.open;
              const color = isUp ? '#16a34a' : '#dc2626';

              const yHigh = yForPrice(c.high);
              const yLow = yForPrice(c.low);
              const yOpen = yForPrice(c.open);
              const yClose = yForPrice(c.close);
              const bodyTop = Math.min(yOpen, yClose);
              const bodyH = Math.max(1.5, Math.abs(yClose - yOpen));

              const volTopBase = chartGeom.padTop + chartGeom.priceH + chartGeom.gapVol;
              const barH = (c.volume / chartGeom.maxVol) * chartGeom.volH;

              return (
                <g key={c.time}>
                  {/* Wick */}
                  <line
                    x1={xCenter}
                    x2={xCenter}
                    y1={yHigh}
                    y2={yLow}
                    stroke={color}
                    strokeWidth="1.2"
                  />
                  {/* Candle Body */}
                  <rect
                    x={xCenter - candleBodyW / 2}
                    y={bodyTop}
                    width={candleBodyW}
                    height={bodyH}
                    fill={color}
                    rx="1"
                  />
                  {/* Volume Bar */}
                  <rect
                    x={xCenter - candleBodyW / 2}
                    y={volTopBase + chartGeom.volH - barH}
                    width={candleBodyW}
                    height={Math.max(1, barH)}
                    fill={color}
                    opacity="0.35"
                  />
                </g>
              );
            })}

            {/* Moving Averages */}
            {showMa20 && (
              <path
                d={buildLinePath((c) => c.ma20, yForPrice)}
                fill="none"
                stroke="#d97706"
                strokeWidth="1.6"
              />
            )}
            {showMa50 && (
              <path
                d={buildLinePath((c) => c.ma50, yForPrice)}
                fill="none"
                stroke="#0284c7"
                strokeWidth="1.6"
              />
            )}

            {/* RSI Subchart */}
            {showRsi && (
              <g>
                {[30, 50, 70].map((level) => {
                  const y = yForRsi(level);
                  return (
                    <g key={level}>
                      <line
                        x1={chartGeom.padLeft}
                        x2={chartGeom.padLeft + chartGeom.plotW}
                        y1={y}
                        y2={y}
                        className="stroke-slate-200 dark:stroke-slate-800"
                        strokeDasharray={level === 50 ? '2 2' : '4 3'}
                        strokeWidth="1"
                      />
                      <text
                        x={chartGeom.padLeft + chartGeom.plotW + 8}
                        y={y + 3}
                        className="fill-slate-400 dark:fill-slate-500 text-[9px] font-mono tabular-nums"
                      >
                        {level}
                      </text>
                    </g>
                  );
                })}
                <text
                  x={chartGeom.padLeft}
                  y={
                    chartGeom.padTop +
                    chartGeom.priceH +
                    chartGeom.gapVol +
                    chartGeom.volH +
                    16
                  }
                  className="fill-slate-500 dark:fill-slate-400 text-[10px] font-medium"
                >
                  RSI (14)
                </text>
                <path
                  d={buildLinePath((c) => c.rsi14, yForRsi)}
                  fill="none"
                  stroke="#0d9488"
                  strokeWidth="1.6"
                />
              </g>
            )}

            {/* Hover Crosshair & Date Axis */}
            {hoverIdx !== null && candles[hoverIdx] && (
              <line
                x1={chartGeom.padLeft + (hoverIdx + 0.5) * xStep}
                x2={chartGeom.padLeft + (hoverIdx + 0.5) * xStep}
                y1={chartGeom.padTop}
                y2={chartGeom.totalH - 22}
                className="stroke-slate-400 dark:stroke-slate-500"
                strokeDasharray="3 3"
                strokeWidth="1"
              />
            )}

            {/* X-axis sparse labels */}
            {candles.length > 0 &&
              [0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
                const idx = Math.min(
                  candles.length - 1,
                  Math.floor(ratio * (candles.length - 1))
                );
                const x = chartGeom.padLeft + (idx + 0.5) * xStep;
                return (
                  <text
                    key={i}
                    x={x}
                    y={chartGeom.totalH - 6}
                    textAnchor={i === 0 ? 'start' : i === 4 ? 'end' : 'middle'}
                    className="fill-slate-500 dark:fill-slate-400 text-[10px] font-mono tabular-nums"
                  >
                    {candles[idx].dateLabel}
                  </text>
                );
              })}

            {/* Interactive Hover Columns */}
            {candles.map((c, idx) => (
              <rect
                key={`hit-${c.time}`}
                x={chartGeom.padLeft + idx * xStep}
                y={chartGeom.padTop}
                width={xStep}
                height={chartGeom.totalH - chartGeom.padTop - 20}
                fill="transparent"
                onMouseEnter={() => setHoverIdx(idx)}
              />
            ))}
          </svg>
        )}
      </div>

      {/* News Impact Marker Strip */}
      {relatedNews.length > 0 && (
        <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-400">
          <span>
            Katalis berita terkait {ticker}:{' '}
            <button
              type="button"
              onClick={() => onSelectNews?.(relatedNews[0])}
              className="font-medium text-slate-900 dark:text-slate-100 underline decoration-slate-300 dark:decoration-slate-700 hover:decoration-teal-600 cursor-pointer text-left"
            >
              {relatedNews[0].title}
            </button>
          </span>
          <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400 shrink-0">
            Sentimen: {relatedNews[0].sentiment} · {relatedNews[0].pubTimeWib}
          </span>
        </div>
      )}
    </div>
  );
}
