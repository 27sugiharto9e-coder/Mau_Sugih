import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { RefreshCw } from 'lucide-react';
import type { CompanyBusinessProfile, FinancialPeriodRow, LiveStockQuote } from '../types';
import {
  formatBillionIdr,
  formatSignedPercent,
  getChangeColorClass,
} from '../utils/formatters';

interface CompanyBusinessProfilePanelProps {
  stock: LiveStockQuote;
}

interface AnnualGrowthMetrics {
  yearsLabel: string;
  yearCount: number;
  revStartB: number | null;
  revEndB: number | null;
  revTotalGrowthPct: number | null;
  revCagrPct: number | null;
  niStartB: number | null;
  niEndB: number | null;
  niTotalGrowthPct: number | null;
  niCagrPct: number | null;
  avgNetMarginPct: number | null;
  equityGrowthPct: number | null;
}

function computeAnnualMetrics(rows: FinancialPeriodRow[]): AnnualGrowthMetrics | null {
  if (!rows || rows.length === 0) return null;

  const revRows = rows.filter((r) => r.revenueB !== null && r.revenueB !== undefined);
  const niRows = rows.filter((r) => r.netIncomeB !== null && r.netIncomeB !== undefined);
  const eqRows = rows.filter((r) => r.totalEquityB !== null && r.totalEquityB !== undefined);

  const firstPeriod = rows[0].period;
  const lastPeriod = rows[rows.length - 1].period;
  const spanYears = Math.max(1, rows.length - 1);

  const revStart = revRows[0]?.revenueB ?? null;
  const revEnd = revRows[revRows.length - 1]?.revenueB ?? null;
  const revTotalGrowthPct =
    revStart !== null && revEnd !== null && revStart > 0
      ? ((revEnd - revStart) / revStart) * 100
      : null;
  const revCagrPct =
    revStart !== null && revEnd !== null && revStart > 0 && revEnd > 0 && revRows.length >= 2
      ? (Math.pow(revEnd / revStart, 1 / (revRows.length - 1)) - 1) * 100
      : null;

  const niStart = niRows[0]?.netIncomeB ?? null;
  const niEnd = niRows[niRows.length - 1]?.netIncomeB ?? null;
  const niTotalGrowthPct =
    niStart !== null && niEnd !== null && Math.abs(niStart) > 0
      ? ((niEnd - niStart) / Math.abs(niStart)) * 100
      : null;
  const niCagrPct =
    niStart !== null && niEnd !== null && niStart > 0 && niEnd > 0 && niRows.length >= 2
      ? (Math.pow(niEnd / niStart, 1 / (niRows.length - 1)) - 1) * 100
      : null;

  const margins = rows
    .filter((r) => r.revenueB && r.revenueB > 0 && r.netIncomeB !== null)
    .map((r) => ((r.netIncomeB as number) / (r.revenueB as number)) * 100);
  const avgNetMarginPct =
    margins.length > 0 ? margins.reduce((a, b) => a + b, 0) / margins.length : null;

  const eqStart = eqRows[0]?.totalEquityB ?? null;
  const eqEnd = eqRows[eqRows.length - 1]?.totalEquityB ?? null;
  const equityGrowthPct =
    eqStart !== null && eqEnd !== null && eqStart > 0
      ? ((eqEnd - eqStart) / eqStart) * 100
      : null;

  return {
    yearsLabel: rows.length > 1 ? `${firstPeriod} – ${lastPeriod}` : firstPeriod,
    yearCount: spanYears + 1,
    revStartB: revStart,
    revEndB: revEnd,
    revTotalGrowthPct,
    revCagrPct,
    niStartB: niStart,
    niEndB: niEnd,
    niTotalGrowthPct,
    niCagrPct,
    avgNetMarginPct,
    equityGrowthPct,
  };
}

export function CompanyBusinessProfilePanel({ stock }: CompanyBusinessProfilePanelProps) {
  const [enrichedProfiles, setEnrichedProfiles] = useState<Record<string, CompanyBusinessProfile>>(
    {}
  );
  const [loadingTicker, setLoadingTicker] = useState<string | null>(null);
  const [enrichError, setEnrichError] = useState<string | null>(null);

  const isGenericFallbackProfile = useMemo(() => {
    const bp = stock.businessProfile;
    if (!bp) return true;
    return (
      bp.productsAndServices.length <= 1 &&
      Boolean(bp.productsAndServices[0]?.startsWith('Produk dan layanan utama di segmen'))
    );
  }, [stock.businessProfile]);

  const activeProfile: CompanyBusinessProfile | undefined =
    enrichedProfiles[stock.ticker] ?? stock.businessProfile;

  const fetchIndonesianProfile = async (ticker: string) => {
    setLoadingTicker(ticker);
    setEnrichError(null);
    try {
      const res = await fetch(`/api/stock/${encodeURIComponent(ticker)}/business-profile`, {
        method: 'POST',
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Gagal menyusun profil bisnis emiten.');
      }
      setEnrichedProfiles((prev) => ({
        ...prev,
        [ticker]: json as CompanyBusinessProfile,
      }));
    } catch (err) {
      setEnrichError(
        err instanceof Error ? err.message : 'Gagal menyusun ringkasan bisnis dalam Bahasa Indonesia.'
      );
    } finally {
      setLoadingTicker((prev) => (prev === ticker ? null : prev));
    }
  };

  useEffect(() => {
    setEnrichError(null);
    if (
      isGenericFallbackProfile &&
      !enrichedProfiles[stock.ticker] &&
      loadingTicker !== stock.ticker
    ) {
      fetchIndonesianProfile(stock.ticker);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stock.ticker, isGenericFallbackProfile]);

  const annualRows = stock.annualFinancials ?? [];
  const metrics = useMemo(() => computeAnnualMetrics(annualRows), [annualRows]);

  const useTrillionScale = useMemo(() => {
    const maxVal = Math.max(
      ...annualRows.map((r) => Math.max(Math.abs(r.revenueB ?? 0), Math.abs(r.netIncomeB ?? 0))),
      0
    );
    return maxVal >= 1500;
  }, [annualRows]);

  const chartData = useMemo(
    () =>
      annualRows.map((r) => ({
        period: r.period,
        pendapatan:
          r.revenueB !== null
            ? Number((useTrillionScale ? r.revenueB / 1000 : r.revenueB).toFixed(2))
            : 0,
        labaBersih:
          r.netIncomeB !== null
            ? Number((useTrillionScale ? r.netIncomeB / 1000 : r.netIncomeB).toFixed(2))
            : 0,
        rawRevenueB: r.revenueB,
        rawNetIncomeB: r.netIncomeB,
      })),
    [annualRows, useTrillionScale]
  );

  const isEnriching = loadingTicker === stock.ticker;

  return (
    <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Profil Bisnis, Sumber Keuntungan & Pertumbuhan 3–5 Tahun — {stock.ticker}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {stock.name} · Sektor {stock.sector} · Subsektor {stock.subsector}
            {metrics ? ` · Rekam Kinerja ${metrics.yearsLabel}` : ''}
          </p>
        </div>

        {(isGenericFallbackProfile || enrichError) && (
          <button
            type="button"
            onClick={() => fetchIndonesianProfile(stock.ticker)}
            disabled={isEnriching}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-200 hover:border-teal-600 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isEnriching ? 'animate-spin' : ''}`} />
            <span>{isEnriching ? 'Menyusun Profil Bisnis...' : 'Perbarui Ringkasan Bisnis'}</span>
          </button>
        )}
      </div>

      {enrichError && (
        <div className="p-3.5 rounded-lg border border-amber-200 dark:border-amber-900/60 bg-amber-50/70 dark:bg-amber-950/30 text-xs text-amber-800 dark:text-amber-300">
          Catatan profil otomatis: {enrichError} Menampilkan profil dasar dan data laporan tahunan resmi di bawah ini.
        </div>
      )}

      {/* 3-Column Business Model, Profit Sources, Products & Services */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 divide-y lg:divide-y-0 lg:divide-x divide-slate-200 dark:divide-slate-800">
        {/* 1. Menjalankan Bisnis Apa */}
        <div className="space-y-2.5 lg:pr-4">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Menjalankan Bisnis Apa
          </h3>
          {isEnriching && isGenericFallbackProfile && !enrichedProfiles[stock.ticker] ? (
            <div className="space-y-2 animate-pulse pt-1">
              <div className="h-3.5 bg-slate-100 dark:bg-slate-800 rounded w-full" />
              <div className="h-3.5 bg-slate-100 dark:bg-slate-800 rounded w-11/12" />
              <div className="h-3.5 bg-slate-100 dark:bg-slate-800 rounded w-4/5" />
            </div>
          ) : (
            <p className="text-xs sm:text-[13px] leading-relaxed text-slate-700 dark:text-slate-300">
              {activeProfile?.businessModel ??
                `${stock.name} beroperasi pada sektor ${stock.sector} (${stock.subsector}).`}
            </p>
          )}
          {activeProfile?.longBusinessSummaryRaw && isGenericFallbackProfile && !enrichedProfiles[stock.ticker] && (
            <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400 pt-1 line-clamp-4">
              Ringkasan bursa: {activeProfile.longBusinessSummaryRaw}
            </p>
          )}
        </div>

        {/* 2. Mendapatkan Untung Darimana */}
        <div className="pt-4 lg:pt-0 lg:px-5 space-y-2.5">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Mendapatkan Untung Darimana
          </h3>
          {isEnriching && isGenericFallbackProfile && !enrichedProfiles[stock.ticker] ? (
            <div className="space-y-2 animate-pulse pt-1">
              <div className="h-3.5 bg-slate-100 dark:bg-slate-800 rounded w-full" />
              <div className="h-3.5 bg-slate-100 dark:bg-slate-800 rounded w-10/12" />
              <div className="h-3.5 bg-slate-100 dark:bg-slate-800 rounded w-9/12" />
            </div>
          ) : (
            <ul className="space-y-2 text-xs sm:text-[13px] text-slate-700 dark:text-slate-300 leading-relaxed">
              {(activeProfile?.profitDrivers ?? []).map((driver, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="font-mono text-teal-700 dark:text-teal-400 font-semibold shrink-0">
                    {idx + 1}.
                  </span>
                  <span>{driver}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* 3. Produk & Layanan yang Diciptakan */}
        <div className="pt-4 lg:pt-0 lg:pl-5 space-y-2.5">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Produk & Layanan yang Diciptakan
          </h3>
          {isEnriching && isGenericFallbackProfile && !enrichedProfiles[stock.ticker] ? (
            <div className="space-y-2 animate-pulse pt-1">
              <div className="h-3.5 bg-slate-100 dark:bg-slate-800 rounded w-5/6" />
              <div className="h-3.5 bg-slate-100 dark:bg-slate-800 rounded w-4/6" />
              <div className="h-3.5 bg-slate-100 dark:bg-slate-800 rounded w-5/6" />
            </div>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs sm:text-[13px] text-slate-700 dark:text-slate-300">
              {(activeProfile?.productsAndServices ?? []).map((prod, idx) => (
                <li key={idx} className="py-1.5 first:pt-0 last:pb-0 leading-relaxed">
                  {prod}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* 3-5 Year Business Growth Section */}
      <div className="pt-5 border-t border-slate-200 dark:border-slate-800 space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Pertumbuhan Bisnis 3–5 Tahun Terakhir ({metrics ? metrics.yearsLabel : 'Data Tahunan'})
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Perbandingan skala pendapatan usaha dan laba bersih tahunan dalam{' '}
              {useTrillionScale ? 'Triliun Rupiah (Rp T)' : 'Miliar Rupiah (Rp M)'}.
            </p>
          </div>
          {annualRows.length > 0 && (
            <div className="flex items-center gap-4 text-xs text-slate-600 dark:text-slate-400">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-slate-800 dark:bg-slate-300 inline-block" />
                Pendapatan
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-teal-600 dark:bg-teal-400 inline-block" />
                Laba Bersih
              </span>
            </div>
          )}
        </div>

        {annualRows.length === 0 ? (
          <div className="py-4 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Data deret waktu tahunan 3–5 tahun untuk emiten <strong>{stock.ticker}</strong> belum lengkap pada umpan bursa.{' '}
            {activeProfile?.growth3to5YOverview}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* BarChart */}
            <div className="lg:col-span-7 h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.22)" vertical={false} />
                  <XAxis
                    dataKey="period"
                    tick={{ fontSize: 12, fill: '#64748b' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    axisLine={false}
                    tickLine={false}
                    width={56}
                    tickFormatter={(val: number) =>
                      useTrillionScale ? `${val.toLocaleString('id-ID')}T` : `${val.toLocaleString('id-ID')}M`
                    }
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(148, 163, 184, 0.1)' }}
                    content={({ active, payload, label }) => {
                      if (!active || !payload || payload.length === 0) return null;
                      const row = payload[0]?.payload as (typeof chartData)[number];
                      return (
                        <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs shadow-sm space-y-1">
                          <div className="font-semibold text-slate-900 dark:text-slate-100">
                            {label}
                          </div>
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-slate-500 dark:text-slate-400">Pendapatan:</span>
                            <span className="font-mono tabular-nums font-medium text-slate-900 dark:text-slate-100">
                              {formatBillionIdr(row.rawRevenueB)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-slate-500 dark:text-slate-400">Laba Bersih:</span>
                            <span
                              className={`font-mono tabular-nums font-semibold ${getChangeColorClass(
                                row.rawNetIncomeB
                              )}`}
                            >
                              {formatBillionIdr(row.rawNetIncomeB)}
                            </span>
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Bar
                    dataKey="pendapatan"
                    name="Pendapatan"
                    fill="#334155"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={42}
                  />
                  <Bar
                    dataKey="labaBersih"
                    name="Laba Bersih"
                    fill="#0d9488"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={42}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Quantitative Metrics & Narrative */}
            <div className="lg:col-span-5 space-y-4">
              {metrics && (
                <div className="grid grid-cols-2 gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
                  <div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      Pertumbuhan Pendapatan ({metrics.yearCount} Thn)
                    </div>
                    <div
                      className={`text-base font-semibold font-mono tabular-nums mt-0.5 ${getChangeColorClass(
                        metrics.revTotalGrowthPct
                      )}`}
                    >
                      {metrics.revTotalGrowthPct !== null
                        ? formatSignedPercent(metrics.revTotalGrowthPct)
                        : '—'}
                    </div>
                    <div className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                      CAGR:{' '}
                      {metrics.revCagrPct !== null
                        ? `${formatSignedPercent(metrics.revCagrPct)}/thn`
                        : '—'}
                    </div>
                  </div>

                  <div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      Pertumbuhan Laba ({metrics.yearCount} Thn)
                    </div>
                    <div
                      className={`text-base font-semibold font-mono tabular-nums mt-0.5 ${getChangeColorClass(
                        metrics.niTotalGrowthPct
                      )}`}
                    >
                      {metrics.niTotalGrowthPct !== null
                        ? formatSignedPercent(metrics.niTotalGrowthPct)
                        : '—'}
                    </div>
                    <div className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                      CAGR:{' '}
                      {metrics.niCagrPct !== null
                        ? `${formatSignedPercent(metrics.niCagrPct)}/thn`
                        : 'Rugi / Transisi'}
                    </div>
                  </div>

                  <div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      Rata-rata Margin Laba Bersih
                    </div>
                    <div className="text-base font-semibold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-0.5">
                      {metrics.avgNetMarginPct !== null
                        ? `${metrics.avgNetMarginPct.toFixed(1)}%`
                        : '—'}
                    </div>
                  </div>

                  <div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      Ekspansi Ekuitas Pemegang Saham
                    </div>
                    <div
                      className={`text-base font-semibold font-mono tabular-nums mt-0.5 ${getChangeColorClass(
                        metrics.equityGrowthPct
                      )}`}
                    >
                      {metrics.equityGrowthPct !== null
                        ? formatSignedPercent(metrics.equityGrowthPct)
                        : '—'}
                    </div>
                  </div>
                </div>
              )}

              <p className="text-xs sm:text-[13px] leading-relaxed text-slate-700 dark:text-slate-300">
                {activeProfile?.growth3to5YOverview}
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
