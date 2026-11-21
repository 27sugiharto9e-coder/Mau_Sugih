import { useMemo, useState } from 'react';
import type { LiveStockQuote } from '../types';
import {
  formatIdr,
  formatSignedPercent,
  getChangeColorClass,
} from '../utils/formatters';

interface SectorPerformancePanelProps {
  stocks: LiveStockQuote[];
  fetchedAtWib: string;
  onSelectStock: (ticker: string) => void;
  onSelectSectorInScreener: (sector: string) => void;
}

type WeightMode = 'mcap' | 'equal';
type ViewMode = 'bars' | 'matrix';

interface SectorSummary {
  sector: string;
  stocks: LiveStockQuote[];
  avgChangePercent: number;
  weightedChangePercent: number;
  totalMarketCapT: number;
  advancers: number;
  decliners: number;
  leader: LiveStockQuote | null;
}

export function SectorPerformancePanel({
  stocks,
  fetchedAtWib,
  onSelectStock,
  onSelectSectorInScreener,
}: SectorPerformancePanelProps) {
  const [weightMode, setWeightMode] = useState<WeightMode>('mcap');
  const [viewMode, setViewMode] = useState<ViewMode>('bars');
  const [expandedSector, setExpandedSector] = useState<string | null>(null);

  const sectorSummaries = useMemo(() => {
    const groups = new Map<string, LiveStockQuote[]>();
    for (const s of stocks) {
      if (!s.isLive) continue;
      const list = groups.get(s.sector) ?? [];
      list.push(s);
      groups.set(s.sector, list);
    }

    const result: SectorSummary[] = [];
    for (const [sector, list] of groups.entries()) {
      const sorted = [...list].sort((a, b) => b.changePercent - a.changePercent);
      const avgChangePercent =
        list.reduce((acc, s) => acc + s.changePercent, 0) / Math.max(list.length, 1);

      const totalMcap = list.reduce((acc, s) => acc + Math.max(s.marketCapT, 0), 0);
      const weightedChangePercent =
        totalMcap > 0
          ? list.reduce((acc, s) => acc + s.changePercent * s.marketCapT, 0) / totalMcap
          : avgChangePercent;

      const advancers = list.filter((s) => s.changePercent > 0).length;
      const decliners = list.filter((s) => s.changePercent < 0).length;

      result.push({
        sector,
        stocks: sorted,
        avgChangePercent,
        weightedChangePercent,
        totalMarketCapT: totalMcap,
        advancers,
        decliners,
        leader: sorted[0] ?? null,
      });
    }

    return result.sort((a, b) => {
      const av = weightMode === 'mcap' ? a.weightedChangePercent : a.avgChangePercent;
      const bv = weightMode === 'mcap' ? b.weightedChangePercent : b.avgChangePercent;
      return bv - av;
    });
  }, [stocks, weightMode]);

  const maxAbsChange = useMemo(() => {
    if (sectorSummaries.length === 0) return 1;
    const maxVal = Math.max(
      ...sectorSummaries.map((sec) =>
        Math.abs(weightMode === 'mcap' ? sec.weightedChangePercent : sec.avgChangePercent)
      ),
      0.5
    );
    return maxVal;
  }, [sectorSummaries, weightMode]);

  const marketBreadth = useMemo(() => {
    const live = stocks.filter((s) => s.isLive);
    return {
      up: live.filter((s) => s.changePercent > 0).length,
      flat: live.filter((s) => s.changePercent === 0).length,
      down: live.filter((s) => s.changePercent < 0).length,
    };
  }, [stocks]);

  const leadingSector = sectorSummaries[0] ?? null;
  const leadingVal = leadingSector
    ? weightMode === 'mcap'
      ? leadingSector.weightedChangePercent
      : leadingSector.avgChangePercent
    : 0;

  return (
    <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
      {/* Header & Controls */}
      <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Kinerja Sektor Industri IDX (Real-Time)
          </h2>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-1">
            {leadingSector ? (
              <>
                <span>
                  Sektor Memimpin:{' '}
                  <strong className="text-slate-900 dark:text-slate-100">
                    {leadingSector.sector}
                  </strong>{' '}
                  <span className={`font-mono tabular-nums font-semibold ${getChangeColorClass(leadingVal)}`}>
                    {formatSignedPercent(leadingVal)}
                  </span>
                </span>
                <span aria-hidden="true">·</span>
              </>
            ) : null}
            <span className="font-mono tabular-nums">
              Breadth: {marketBreadth.up} Naik / {marketBreadth.flat} Tetap / {marketBreadth.down} Turun
            </span>
            {fetchedAtWib && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">Data per {fetchedAtWib} WIB</span>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {/* Weighting Toggle */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
            <button
              type="button"
              onClick={() => setWeightMode('mcap')}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                weightMode === 'mcap'
                  ? 'bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              Bobot M.Cap
            </button>
            <button
              type="button"
              onClick={() => setWeightMode('equal')}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                weightMode === 'equal'
                  ? 'bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              Rata-rata Setara
            </button>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
            <button
              type="button"
              onClick={() => setViewMode('bars')}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                viewMode === 'bars'
                  ? 'bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              Grafik Sektor
            </button>
            <button
              type="button"
              onClick={() => setViewMode('matrix')}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                viewMode === 'matrix'
                  ? 'bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              Peta Emiten
            </button>
          </div>
        </div>
      </div>

      {sectorSummaries.length === 0 ? (
        <div className="py-10 text-sm text-slate-500 dark:text-slate-400">
          Menunggu data kuotasi real-time untuk menghitung kinerja sektor IDX...
        </div>
      ) : viewMode === 'bars' ? (
        <div className="mt-5 divide-y divide-slate-100 dark:divide-slate-800/80">
          {sectorSummaries.map((sec, idx) => {
            const val = weightMode === 'mcap' ? sec.weightedChangePercent : sec.avgChangePercent;
            const barRatio = Math.min(100, (Math.abs(val) / maxAbsChange) * 100);
            const isPositive = val >= 0;
            const isExpanded = expandedSector === sec.sector;

            return (
              <div key={sec.sector} className="py-3 first:pt-1 last:pb-1">
                <div className="grid grid-cols-1 md:grid-cols-12 items-center gap-3">
                  {/* Sector Label & Rank */}
                  <div className="md:col-span-4 flex items-center justify-between gap-2 min-w-0">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedSector((prev) => (prev === sec.sector ? null : sec.sector))
                      }
                      className="text-left group flex items-center gap-2.5 min-w-0 cursor-pointer"
                    >
                      <span className="font-mono tabular-nums text-xs text-slate-400 dark:text-slate-500 w-5 shrink-0">
                        {String(idx + 1).padStart(2, '0')}
                      </span>
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-slate-900 dark:text-slate-100 group-hover:text-teal-700 dark:group-hover:text-teal-400 truncate">
                          {sec.sector}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                          {sec.stocks.length} emiten · {sec.advancers} naik / {sec.decliners} turun
                        </div>
                      </div>
                    </button>

                    <span
                      className={`md:hidden font-mono tabular-nums text-xs font-semibold shrink-0 ${getChangeColorClass(
                        val
                      )}`}
                    >
                      {formatSignedPercent(val)}
                    </span>
                  </div>

                  {/* Diverging Center-Zero Bar */}
                  <div className="md:col-span-5 flex items-center gap-2">
                    {/* Negative Left Half */}
                    <div className="flex-1 h-2.5 bg-slate-100 dark:bg-slate-800/80 rounded-l-full flex justify-end overflow-hidden">
                      {!isPositive && (
                        <div
                          className="h-full bg-red-600 dark:bg-red-500 rounded-l-full transition-all duration-300"
                          style={{ width: `${Math.max(4, barRatio)}%` }}
                        />
                      )}
                    </div>

                    {/* Zero Divider */}
                    <div className="w-px h-4 bg-slate-300 dark:bg-slate-700 shrink-0" />

                    {/* Positive Right Half */}
                    <div className="flex-1 h-2.5 bg-slate-100 dark:bg-slate-800/80 rounded-r-full flex justify-start overflow-hidden">
                      {isPositive && (
                        <div
                          className="h-full bg-emerald-600 dark:bg-emerald-500 rounded-r-full transition-all duration-300"
                          style={{ width: `${Math.max(val === 0 ? 0 : 4, barRatio)}%` }}
                        />
                      )}
                    </div>
                  </div>

                  {/* Numeric Value & Sector Leader */}
                  <div className="md:col-span-3 flex items-center justify-between md:justify-end gap-4 text-xs">
                    {sec.leader && (
                      <button
                        type="button"
                        onClick={() => onSelectStock(sec.leader!.ticker)}
                        className="font-mono tabular-nums text-slate-500 dark:text-slate-400 hover:text-teal-700 dark:hover:text-teal-400 whitespace-nowrap cursor-pointer"
                      >
                        Top: <strong className="text-slate-800 dark:text-slate-200">{sec.leader.ticker}</strong>{' '}
                        <span className={getChangeColorClass(sec.leader.changePercent)}>
                          {formatSignedPercent(sec.leader.changePercent)}
                        </span>
                      </button>
                    )}
                    <span
                      className={`hidden md:inline-block w-18 text-right font-mono tabular-nums font-semibold shrink-0 ${getChangeColorClass(
                        val
                      )}`}
                    >
                      {formatSignedPercent(val)}
                    </span>
                  </div>
                </div>

                {/* Expandable Constituent Tickers for Clicked Sector */}
                {isExpanded && (
                  <div className="mt-3 pt-3 pl-7 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      {sec.stocks.map((st) => (
                        <button
                          key={st.ticker}
                          type="button"
                          onClick={() => onSelectStock(st.ticker)}
                          className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 hover:border-teal-600 text-xs font-mono tabular-nums flex items-center gap-2 transition-colors cursor-pointer"
                        >
                          <strong className="text-slate-900 dark:text-slate-100">{st.ticker}</strong>
                          <span className="text-slate-500 dark:text-slate-400">
                            Rp{formatIdr(st.price)}
                          </span>
                          <span className={getChangeColorClass(st.changePercent)}>
                            {formatSignedPercent(st.changePercent)}
                          </span>
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => onSelectSectorInScreener(sec.sector)}
                      className="text-xs font-medium text-teal-700 dark:text-teal-400 hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      Saring sektor {sec.sector} di Screener →
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* Sector Breadth Matrix View */
        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {sectorSummaries.map((sec) => {
            const val = weightMode === 'mcap' ? sec.weightedChangePercent : sec.avgChangePercent;
            return (
              <div
                key={sec.sector}
                className="border border-slate-200 dark:border-slate-800 rounded-lg p-4 flex flex-col justify-between gap-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => onSelectSectorInScreener(sec.sector)}
                    className="text-left hover:text-teal-700 dark:hover:text-teal-400 cursor-pointer"
                  >
                    <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {sec.sector}
                    </div>
                    <div className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                      M.Cap Rp{sec.totalMarketCapT.toLocaleString('id-ID')} T
                    </div>
                  </button>
                  <span
                    className={`font-mono tabular-nums text-xs font-semibold shrink-0 ${getChangeColorClass(
                      val
                    )}`}
                  >
                    {formatSignedPercent(val)}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  {sec.stocks.map((st) => {
                    const bgClass =
                      st.changePercent > 0
                        ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200/70 dark:border-emerald-900/50'
                        : st.changePercent < 0
                        ? 'bg-red-50 dark:bg-red-950/30 border-red-200/70 dark:border-red-900/50'
                        : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800';

                    return (
                      <button
                        key={st.ticker}
                        type="button"
                        onClick={() => onSelectStock(st.ticker)}
                        className={`px-2.5 py-2 rounded-md border text-left transition-opacity hover:opacity-85 cursor-pointer ${bgClass}`}
                      >
                        <div className="font-mono text-xs font-semibold text-slate-900 dark:text-slate-100">
                          {st.ticker}
                        </div>
                        <div
                          className={`font-mono tabular-nums text-[11px] font-medium ${getChangeColorClass(
                            st.changePercent
                          )}`}
                        >
                          {formatSignedPercent(st.changePercent)}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
