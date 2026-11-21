import { useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { LiveStockQuote } from '../types';
import {
  computeStockValuationAnalysis,
  estimateDefaultGrowthPct,
  type FutureYearPoint,
  type InvestabilityLabel,
} from '../utils/valuation';
import {
  formatIdr,
  formatSignedPercent,
  getChangeColorClass,
} from '../utils/formatters';

interface ValuationMosPanelProps {
  stock: LiveStockQuote;
}

function getInvestabilityClass(label: InvestabilityLabel): string {
  switch (label) {
    case 'Layak Investasi (MoS Aman)':
      return 'text-emerald-700 dark:text-emerald-400';
    case 'Cukup Wajar (Akumulasi Bertahap)':
      return 'text-teal-700 dark:text-teal-400';
    case 'Sedikit Premium (Tunggu Koreksi)':
      return 'text-amber-700 dark:text-amber-400';
    case 'Overvalued (MoS Negatif)':
      return 'text-red-700 dark:text-red-400';
    default:
      return 'text-slate-600 dark:text-slate-400';
  }
}

function FutureValueTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: FutureYearPoint }>;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const pt = payload[0].payload;
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm px-3.5 py-2.5 text-xs space-y-1 font-mono tabular-nums">
      <div className="font-semibold text-slate-900 dark:text-slate-100">{pt.label}</div>
      <div className="text-teal-700 dark:text-teal-400">
        Total Future Value: <strong>Rp{formatIdr(pt.totalFutureValue)}</strong>
      </div>
      <div className="text-slate-600 dark:text-slate-400">
        Proyeksi Harga Saham: Rp{formatIdr(pt.projectedShareValue)}
      </div>
      <div className="text-emerald-700 dark:text-emerald-400">
        Akumulasi Dividen: +Rp{formatIdr(pt.cumulativeDividends)} (YoC {pt.yieldOnCostPct.toFixed(2)}%)
      </div>
    </div>
  );
}

export function ValuationMosPanel({ stock }: ValuationMosPanelProps) {
  const defaultGrowth = useMemo(() => estimateDefaultGrowthPct(stock), [stock]);
  const [horizonYears, setHorizonYears] = useState<1 | 3 | 5>(3);
  const [targetMosPct, setTargetMosPct] = useState<15 | 20 | 30>(20);
  const [growthRatePct, setGrowthRatePct] = useState<number>(defaultGrowth);

  // Sync default growth rate whenever user switches to another ticker
  useEffect(() => {
    setGrowthRatePct(defaultGrowth);
  }, [stock.ticker, defaultGrowth]);

  const analysis = useMemo(
    () =>
      computeStockValuationAnalysis(stock, {
        horizonYears,
        targetMosPct,
        growthRatePct,
      }),
    [stock, horizonYears, targetMosPct, growthRatePct]
  );

  // Gauge scale positions for Fair Value vs Safe Buy Price vs Market Price
  const gaugeMetrics = useMemo(() => {
    if (!analysis.fairValueIdr || analysis.currentPrice <= 0) return null;
    const maxScale = Math.max(analysis.fairValueIdr, analysis.currentPrice) * 1.15;
    const clampPct = (val: number) => Math.min(98, Math.max(2, (val / maxScale) * 100));
    return {
      safeBuyPct: analysis.maxSafeBuyPriceIdr ? clampPct(analysis.maxSafeBuyPriceIdr) : 0,
      fairPct: clampPct(analysis.fairValueIdr),
      marketPct: clampPct(analysis.currentPrice),
    };
  }, [analysis]);

  // Concrete Rp10,000,000 investment simulation at current live price
  const sampleInvestment = useMemo(() => {
    const budget = 10_000_000;
    if (analysis.currentPrice <= 0) return null;
    const lotCost = analysis.currentPrice * 100;
    const affordableLots = Math.floor(budget / lotCost);
    const actualInvested = affordableLots > 0 ? affordableLots * lotCost : budget;
    const shares = affordableLots > 0 ? affordableLots * 100 : budget / analysis.currentPrice;
    const annualCashDividendNow = Math.round(shares * analysis.effectiveDps);
    const futureValueTotal =
      analysis.projectedTotalFutureValueEnd !== null
        ? Math.round(shares * analysis.projectedTotalFutureValueEnd)
        : null;
    const futureDividendsTotal = Math.round(shares * analysis.projectedTotalDividendsEnd);

    return {
      affordableLots,
      actualInvested,
      annualCashDividendNow,
      futureValueTotal,
      futureDividendsTotal,
    };
  }, [analysis]);

  return (
    <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-6">
      {/* Header & Scenario Controls */}
      <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Dividen Yield Aktual, Margin of Safety & Proyeksi Future Value — {stock.ticker}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Evaluasi kelayakan harga masuk berdasarkan nilai intrinsik laporan keuangan, batas aman diskon (MoS), dan proyeksi nilai masa depan.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {/* Horizon Selector */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
            {([1, 3, 5] as const).map((yr) => (
              <button
                key={yr}
                type="button"
                onClick={() => setHorizonYears(yr)}
                className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  horizonYears === yr
                    ? 'bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                {yr} Tahun
              </button>
            ))}
          </div>

          {/* Target MoS Selector */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
            {([15, 20, 30] as const).map((mos) => (
              <button
                key={mos}
                type="button"
                onClick={() => setTargetMosPct(mos)}
                className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  targetMosPct === mos
                    ? 'bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                Target MoS {mos}%
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 4-Column Key Valuation, Yield, MoS & Future Value Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 border border-slate-200 dark:border-slate-800 rounded-lg divide-y sm:divide-y-0 sm:divide-x divide-slate-200 dark:divide-slate-800">
        {/* Live Dividend Yield */}
        <div className="p-4 space-y-1.5">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Dividen Yield (Harga Rp{formatIdr(analysis.currentPrice)})
          </div>
          <div className="text-xl font-semibold font-mono tabular-nums text-slate-900 dark:text-slate-100">
            {analysis.liveDividendYieldPct > 0
              ? `${analysis.liveDividendYieldPct.toFixed(2)}%`
              : '0,00%'}
          </div>
          <div className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
            DPS: {analysis.effectiveDps > 0 ? `Rp${formatIdr(analysis.effectiveDps)}/lbr` : 'Tidak rutin'}
            {analysis.payoutRatioPct !== null ? ` · Payout ~${analysis.payoutRatioPct}%` : ''}
          </div>
        </div>

        {/* Fair Value */}
        <div className="p-4 space-y-1.5">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Estimasi Nilai Wajar (Fair Value)
          </div>
          <div className="text-xl font-semibold font-mono tabular-nums text-slate-900 dark:text-slate-100">
            {analysis.fairValueIdr ? `Rp${formatIdr(analysis.fairValueIdr)}` : '—'}
          </div>
          <div className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
            {analysis.upsideToFairValuePct !== null ? (
              <span className={getChangeColorClass(analysis.upsideToFairValuePct)}>
                Potensi ke Nilai Wajar: {formatSignedPercent(analysis.upsideToFairValuePct)}
              </span>
            ) : (
              'EPS/Ekuitas belum positif'
            )}
          </div>
        </div>

        {/* Margin of Safety & Investability */}
        <div className="p-4 space-y-1.5">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Margin of Safety (MoS)
          </div>
          <div
            className={`text-xl font-semibold font-mono tabular-nums ${getInvestabilityClass(
              analysis.investabilityLabel
            )}`}
          >
            {analysis.marginOfSafetyPct !== null
              ? `${analysis.marginOfSafetyPct > 0 ? '+' : ''}${analysis.marginOfSafetyPct.toFixed(1)}%`
              : '—'}
          </div>
          <div className={`text-[11px] font-medium ${getInvestabilityClass(analysis.investabilityLabel)}`}>
            {analysis.investabilityLabel}
          </div>
          {analysis.maxSafeBuyPriceIdr && (
            <div className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
              Batas Beli Aman: <strong>Rp{formatIdr(analysis.maxSafeBuyPriceIdr)}</strong>
            </div>
          )}
        </div>

        {/* Future Value Horizon */}
        <div className="p-4 space-y-1.5">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Proyeksi Future Value ({horizonYears} Tahun)
          </div>
          <div className="text-xl font-semibold font-mono tabular-nums text-teal-700 dark:text-teal-400">
            {analysis.projectedTotalFutureValueEnd
              ? `Rp${formatIdr(analysis.projectedTotalFutureValueEnd)}`
              : '—'}
          </div>
          <div className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
            {analysis.projectedCagrPct !== null
              ? `CAGR ~${analysis.projectedCagrPct}%/thn · YoC Th-${horizonYears}: ${analysis.projectedYieldOnCostEndPct.toFixed(
                  2
                )}%`
              : 'Perlu basis harga & laba'}
          </div>
        </div>
      </div>

      {/* Main Split: MoS Breakdown & Gauge (Left) + Future Value Chart & Growth Control (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Valuation Models Breakdown + Margin of Safety Bar */}
        <div className="lg:col-span-5 space-y-5">
          {/* Price vs Fair Value Visual Bar */}
          {gaugeMetrics && analysis.fairValueIdr && analysis.maxSafeBuyPriceIdr && (
            <div className="space-y-3 pb-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  Posisi Harga Sekarang vs Zona Margin of Safety
                </span>
                <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400">
                  Target MoS {targetMosPct}%
                </span>
              </div>

              <div className="relative h-4 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                {/* Safe Zone up to Safe Buy Price */}
                <div
                  className="absolute inset-y-0 left-0 bg-emerald-500/25 dark:bg-emerald-500/30"
                  style={{ width: `${gaugeMetrics.safeBuyPct}%` }}
                />
                {/* Fair Value Zone */}
                <div
                  className="absolute inset-y-0 bg-amber-400/20 dark:bg-amber-400/20"
                  style={{
                    left: `${gaugeMetrics.safeBuyPct}%`,
                    width: `${Math.max(0, gaugeMetrics.fairPct - gaugeMetrics.safeBuyPct)}%`,
                  }}
                />
                {/* Fair Value Marker */}
                <div
                  className="absolute inset-y-0 w-0.5 bg-slate-700 dark:bg-slate-300"
                  style={{ left: `${gaugeMetrics.fairPct}%` }}
                  title={`Nilai Wajar: Rp${formatIdr(analysis.fairValueIdr)}`}
                />
                {/* Current Market Price Marker */}
                <div
                  className="absolute top-0.5 bottom-0.5 w-2 -ml-1 rounded-xs bg-teal-700 dark:bg-teal-400"
                  style={{ left: `${gaugeMetrics.marketPct}%` }}
                  title={`Harga Sekarang: Rp${formatIdr(analysis.currentPrice)}`}
                />
              </div>

              <div className="grid grid-cols-3 gap-2 text-[11px] font-mono tabular-nums">
                <div>
                  <div className="text-emerald-700 dark:text-emerald-400 font-medium">
                    Beli Aman (MoS)
                  </div>
                  <div className="text-slate-800 dark:text-slate-200">
                    ≤ Rp{formatIdr(analysis.maxSafeBuyPriceIdr)}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-slate-500 dark:text-slate-400">Nilai Wajar</div>
                  <div className="text-slate-800 dark:text-slate-200">
                    Rp{formatIdr(analysis.fairValueIdr)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-teal-700 dark:text-teal-400 font-medium">Harga Kini</div>
                  <div className="text-slate-900 dark:text-slate-100 font-semibold">
                    Rp{formatIdr(analysis.currentPrice)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Valuation Sub-Models Table */}
          <div className="space-y-2.5">
            <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Rincian Metode Penilaian Nilai Wajar
            </h3>
            <div className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
              <div className="py-2 flex items-center justify-between gap-2">
                <div>
                  <div className="font-medium text-slate-900 dark:text-slate-100">
                    Angka Konservatif Benjamin Graham
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    √(22,5 × EPS × BVPS)
                  </div>
                </div>
                <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100">
                  {analysis.grahamValueIdr ? `Rp${formatIdr(analysis.grahamValueIdr)}` : '—'}
                </span>
              </div>

              <div className="py-2 flex items-center justify-between gap-2">
                <div>
                  <div className="font-medium text-slate-900 dark:text-slate-100">
                    Valuasi Kelipatan Laba Sektor
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    EPS × PER Wajar Sektor ({analysis.sectorFairPer}x)
                  </div>
                </div>
                <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100">
                  {analysis.earningsFairValueIdr
                    ? `Rp${formatIdr(analysis.earningsFairValueIdr)}`
                    : '—'}
                </span>
              </div>

              <div className="py-2 flex items-center justify-between gap-2">
                <div>
                  <div className="font-medium text-slate-900 dark:text-slate-100">
                    Valuasi Ekuitas Berbasis ROE
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    BVPS × Justified PBV ({analysis.justifiedPbv.toFixed(2)}x)
                  </div>
                </div>
                <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100">
                  {analysis.bookFairValueIdr ? `Rp${formatIdr(analysis.bookFairValueIdr)}` : '—'}
                </span>
              </div>
            </div>
          </div>

          {/* Concrete Rp10M Simulation Callout */}
          {sampleInvestment && (
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2 text-xs">
              <div className="font-semibold text-slate-900 dark:text-slate-100">
                Simulasi Praktis Modal Rp10.000.000 pada Harga Sekarang
              </div>
              <div className="grid grid-cols-2 gap-3 font-mono tabular-nums">
                <div>
                  <div className="text-[11px] font-sans text-slate-500 dark:text-slate-400">
                    Kepemilikan Setara
                  </div>
                  <div className="text-slate-900 dark:text-slate-100 font-semibold">
                    {sampleInvestment.affordableLots > 0
                      ? `${sampleInvestment.affordableLots} Lot (Rp${formatIdr(
                          sampleInvestment.actualInvested
                        )})`
                      : 'Di bawah 1 Lot'}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] font-sans text-slate-500 dark:text-slate-400">
                    Estimasi Dividen Tahun Ini
                  </div>
                  <div className="text-emerald-700 dark:text-emerald-400 font-semibold">
                    Rp{formatIdr(sampleInvestment.annualCashDividendNow)} / thn
                  </div>
                </div>
                {sampleInvestment.futureValueTotal !== null && (
                  <>
                    <div>
                      <div className="text-[11px] font-sans text-slate-500 dark:text-slate-400">
                        Proyeksi Nilai Total Th-{horizonYears}
                      </div>
                      <div className="text-teal-700 dark:text-teal-400 font-semibold">
                        Rp{formatIdr(sampleInvestment.futureValueTotal)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] font-sans text-slate-500 dark:text-slate-400">
                        Akumulasi Dividen {horizonYears} Thn
                      </div>
                      <div className="text-slate-900 dark:text-slate-100 font-semibold">
                        +Rp{formatIdr(sampleInvestment.futureDividendsTotal)}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right: Future Value Chart & Growth Assumption Slider */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Grafik Proyeksi Future Value (Harga + Akumulasi Dividen)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Estimasi pertumbuhan nilai per lembar dari tahun ke-0 hingga tahun ke-{horizonYears}
              </p>
            </div>

            <div className="flex items-center gap-3 text-xs">
              <label
                htmlFor="val-growth-slider"
                className="text-slate-600 dark:text-slate-400 whitespace-nowrap"
              >
                Asumsi Growth Laba:
              </label>
              <input
                id="val-growth-slider"
                type="range"
                min={0}
                max={25}
                step={0.5}
                value={growthRatePct}
                onChange={(e) => setGrowthRatePct(Number(e.target.value))}
                className="w-28 accent-teal-700 cursor-pointer"
              />
              <span className="font-mono tabular-nums font-semibold text-teal-700 dark:text-teal-400 w-14 text-right">
                {growthRatePct.toFixed(1)}%
              </span>
              {growthRatePct !== defaultGrowth && (
                <button
                  type="button"
                  onClick={() => setGrowthRatePct(defaultGrowth)}
                  className="text-[11px] text-slate-500 hover:text-teal-700 dark:hover:text-teal-400 underline cursor-pointer"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={analysis.yearlySeries}
                margin={{ top: 10, right: 16, left: 4, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.22} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) => `Rp${formatIdr(v)}`}
                  width={74}
                />
                <Tooltip content={<FutureValueTooltip />} />
                <Area
                  type="monotone"
                  dataKey="totalFutureValue"
                  name="Total Future Value"
                  stroke="#0f766e"
                  strokeWidth={2}
                  fill="#0f766e"
                  fillOpacity={0.18}
                />
                <Area
                  type="monotone"
                  dataKey="projectedShareValue"
                  name="Proyeksi Harga Saham"
                  stroke="#64748b"
                  strokeWidth={1.75}
                  strokeDasharray="4 4"
                  fill="#64748b"
                  fillOpacity={0.07}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-500 dark:text-slate-400 pt-1">
            <div className="flex flex-wrap items-center gap-5">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-teal-700 inline-block" />
                Total Future Value (Harga + Dividen)
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-slate-500 inline-block border-b border-dashed" />
                Proyeksi Harga Saham Saja
              </span>
            </div>
            <span className="font-mono tabular-nums">
              Pertumbuhan dasar model: {defaultGrowth.toFixed(1)}%/thn
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
