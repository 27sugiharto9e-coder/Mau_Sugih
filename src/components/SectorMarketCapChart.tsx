import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { LiveStockQuote, SectorCapEntry, SectorCapsResponse } from '../types';
import { formatSignedPercent, getChangeColorClass } from '../utils/formatters';

interface SectorMarketCapChartProps {
  sectorCaps: SectorCapsResponse | null;
  fallbackStocks: LiveStockQuote[];
  loading: boolean;
  onSelectStock: (ticker: string) => void;
  onSelectSectorInScreener: (sector: string) => void;
}

type ChartMode = 'donut' | 'bar';

const SECTOR_PALETTE = [
  '#0f766e', // Teal 700
  '#0284c7', // Sky 600
  '#4338ca', // Indigo 700
  '#059669', // Emerald 600
  '#d97706', // Amber 600
  '#0891b2', // Cyan 600
  '#4f46e5', // Indigo 600
  '#65a30d', // Lime 600
  '#e11d48', // Rose 600
  '#475569', // Slate 600
];

function formatTrillionIdr(value: number): string {
  return value.toLocaleString('id-ID', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

interface TooltipPayloadItem {
  payload: SectorCapEntry & { color: string };
}

function SectorCapTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
}) {
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0].payload;

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm px-3.5 py-2.5 text-xs space-y-1">
      <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100">
        <span
          className="w-2.5 h-2.5 rounded-xs shrink-0"
          style={{ backgroundColor: item.color }}
        />
        <span>{item.sector}</span>
      </div>
      <div className="font-mono tabular-nums text-slate-700 dark:text-slate-300">
        Kapitalisasi: <strong>Rp{formatTrillionIdr(item.totalMarketCapT)} T</strong> (
        {item.sharePercent.toFixed(1)}%)
      </div>
      <div className="font-mono tabular-nums text-slate-500 dark:text-slate-400">
        {item.count} emiten · Harian:{' '}
        <span className={getChangeColorClass(item.weightedChangePercent)}>
          {formatSignedPercent(item.weightedChangePercent)}
        </span>
      </div>
      {item.topTicker && (
        <div className="text-slate-500 dark:text-slate-400">
          Terbesar: <span className="font-mono font-medium text-slate-800 dark:text-slate-200">{item.topTicker}</span>
        </div>
      )}
    </div>
  );
}

export function SectorMarketCapChart({
  sectorCaps,
  fallbackStocks,
  loading,
  onSelectStock,
  onSelectSectorInScreener,
}: SectorMarketCapChartProps) {
  const [chartMode, setChartMode] = useState<ChartMode>('donut');
  const [hoveredSector, setHoveredSector] = useState<string | null>(null);

  const resolvedData = useMemo(() => {
    if (sectorCaps && sectorCaps.sectors.length > 0) {
      return {
        sectors: sectorCaps.sectors,
        totalMarketCapT: sectorCaps.totalMarketCapT,
        totalIssuers: sectorCaps.totalIssuers,
        fetchedAtWib: sectorCaps.fetchedAtWib,
        isFullUniverse: true,
      };
    }

    // Fallback aggregation from loaded catalog quotes if full screener caps unavailable
    const groups = new Map<string, LiveStockQuote[]>();
    for (const s of fallbackStocks) {
      if (!s.isLive || s.marketCapT <= 0) continue;
      const list = groups.get(s.sector) ?? [];
      list.push(s);
      groups.set(s.sector, list);
    }

    const rawEntries: Array<Omit<SectorCapEntry, 'sharePercent'>> = [];
    for (const [sector, list] of groups.entries()) {
      const sorted = [...list].sort((a, b) => b.marketCapT - a.marketCapT);
      const totalMcapT = Number(list.reduce((acc, s) => acc + s.marketCapT, 0).toFixed(1));
      const weightedChangePercent =
        totalMcapT > 0
          ? Number(
              (
                list.reduce((acc, s) => acc + s.changePercent * s.marketCapT, 0) / totalMcapT
              ).toFixed(2)
            )
          : 0;
      const top = sorted[0];
      rawEntries.push({
        sector,
        count: list.length,
        totalMarketCapT: totalMcapT,
        weightedChangePercent,
        topTicker: top?.ticker ?? '',
        topTickerName: top?.name ?? '',
      });
    }

    const totalMarketCapT = Number(
      rawEntries.reduce((acc, s) => acc + s.totalMarketCapT, 0).toFixed(1)
    );
    const totalIssuers = rawEntries.reduce((acc, s) => acc + s.count, 0);
    const sectors: SectorCapEntry[] = rawEntries
      .map((s) => ({
        ...s,
        sharePercent:
          totalMarketCapT > 0 ? Number(((s.totalMarketCapT / totalMarketCapT) * 100).toFixed(1)) : 0,
      }))
      .sort((a, b) => b.totalMarketCapT - a.totalMarketCapT);

    return {
      sectors,
      totalMarketCapT,
      totalIssuers,
      fetchedAtWib: '',
      isFullUniverse: false,
    };
  }, [sectorCaps, fallbackStocks]);

  const chartItems = useMemo(() => {
    return resolvedData.sectors.map((sec, idx) => ({
      ...sec,
      color: SECTOR_PALETTE[idx % SECTOR_PALETTE.length],
    }));
  }, [resolvedData.sectors]);

  const dominantSector = chartItems[0] ?? null;
  const activeItem =
    (hoveredSector ? chartItems.find((c) => c.sector === hoveredSector) : null) ??
    dominantSector;

  return (
    <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
      {/* Header & Chart Type Switcher */}
      <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Dominasi Kapitalisasi Pasar per Sektor IDX
          </h2>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-1">
            {dominantSector ? (
              <>
                <span>
                  Sektor Dominan:{' '}
                  <strong className="text-slate-900 dark:text-slate-100">
                    {dominantSector.sector}
                  </strong>{' '}
                  <span className="font-mono tabular-nums font-semibold text-teal-700 dark:text-teal-400">
                    {dominantSector.sharePercent.toFixed(1)}%
                  </span>
                </span>
                <span aria-hidden="true">·</span>
              </>
            ) : null}
            <span className="font-mono tabular-nums">
              Total M.Cap: Rp{formatTrillionIdr(resolvedData.totalMarketCapT)} T ({resolvedData.totalIssuers} emiten)
            </span>
            {resolvedData.fetchedAtWib && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">
                  Data per {resolvedData.fetchedAtWib} WIB
                </span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg shrink-0">
          <button
            type="button"
            onClick={() => setChartMode('donut')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              chartMode === 'donut'
                ? 'bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            Diagram Donat
          </button>
          <button
            type="button"
            onClick={() => setChartMode('bar')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              chartMode === 'bar'
                ? 'bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            Diagram Batang
          </button>
        </div>
      </div>

      {loading && chartItems.length === 0 ? (
        <div className="mt-5 grid grid-cols-1 lg:grid-cols-12 gap-6 animate-pulse">
          <div className="lg:col-span-5 h-72 rounded-lg bg-slate-100 dark:bg-slate-800/60" />
          <div className="lg:col-span-7 space-y-3 py-2">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div key={n} className="h-8 rounded-md bg-slate-100 dark:bg-slate-800/60" />
            ))}
          </div>
        </div>
      ) : chartItems.length === 0 ? (
        <div className="py-10 text-sm text-slate-500 dark:text-slate-400">
          Menunggu data kapitalisasi pasar lintas sektor Bursa Efek Indonesia...
        </div>
      ) : (
        <div className="mt-5 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Left: Recharts Visualization */}
          <div className="lg:col-span-5 relative h-80 w-full">
            {chartMode === 'donut' ? (
              <>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartItems}
                      dataKey="totalMarketCapT"
                      nameKey="sector"
                      cx="50%"
                      cy="50%"
                      innerRadius={74}
                      outerRadius={116}
                      paddingAngle={1.5}
                      stroke="none"
                      onMouseEnter={(_, index) => {
                        const target = chartItems[index];
                        if (target) setHoveredSector(target.sector);
                      }}
                      onMouseLeave={() => setHoveredSector(null)}
                      onClick={(_, index) => {
                        const target = chartItems[index];
                        if (target) onSelectSectorInScreener(target.sector);
                      }}
                      className="cursor-pointer outline-none"
                    >
                      {chartItems.map((entry) => {
                        const dimmed =
                          hoveredSector !== null && hoveredSector !== entry.sector;
                        return (
                          <Cell
                            key={entry.sector}
                            fill={entry.color}
                            fillOpacity={dimmed ? 0.35 : 1}
                          />
                        );
                      })}
                    </Pie>
                    <Tooltip content={<SectorCapTooltip />} />
                  </PieChart>
                </ResponsiveContainer>

                {/* Center Readout inside Donut Hole */}
                {activeItem && (
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center px-10">
                    <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate max-w-[130px]">
                      {activeItem.sector}
                    </span>
                    <span className="text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-0.5">
                      {activeItem.sharePercent.toFixed(1)}%
                    </span>
                    <span className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                      Rp{formatTrillionIdr(activeItem.totalMarketCapT)} T
                    </span>
                  </div>
                )}
              </>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartItems}
                  layout="vertical"
                  margin={{ top: 4, right: 16, left: 4, bottom: 4 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    horizontal={false}
                    stroke="#94a3b8"
                    strokeOpacity={0.22}
                  />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(val: number) => `${Math.round(val)}T`}
                  />
                  <YAxis
                    type="category"
                    dataKey="sector"
                    width={118}
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    content={<SectorCapTooltip />}
                    cursor={{ fill: 'rgba(148, 163, 184, 0.1)' }}
                  />
                  <Bar
                    dataKey="totalMarketCapT"
                    radius={[0, 4, 4, 0]}
                    onMouseEnter={(_, index) => {
                      const target = chartItems[index];
                      if (target) setHoveredSector(target.sector);
                    }}
                    onMouseLeave={() => setHoveredSector(null)}
                    onClick={(_, index) => {
                      const target = chartItems[index];
                      if (target) onSelectSectorInScreener(target.sector);
                    }}
                    className="cursor-pointer"
                  >
                    {chartItems.map((entry) => {
                      const dimmed =
                        hoveredSector !== null && hoveredSector !== entry.sector;
                      return (
                        <Cell
                          key={entry.sector}
                          fill={entry.color}
                          fillOpacity={dimmed ? 0.35 : 1}
                        />
                      );
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Right: Hairline-Divided Sector Breakdown Table */}
          <div className="lg:col-span-7 divide-y divide-slate-100 dark:divide-slate-800/80">
            {chartItems.map((row) => {
              const isHighlighted = hoveredSector === row.sector;
              return (
                <div
                  key={row.sector}
                  onMouseEnter={() => setHoveredSector(row.sector)}
                  onMouseLeave={() => setHoveredSector(null)}
                  className={`py-2.5 px-2 -mx-2 rounded-lg flex items-center justify-between gap-3 transition-colors ${
                    isHighlighted ? 'bg-slate-50 dark:bg-slate-800/40' : ''
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-xs shrink-0"
                      style={{ backgroundColor: row.color }}
                      aria-hidden="true"
                    />
                    <div className="min-w-0">
                      <button
                        type="button"
                        onClick={() => onSelectSectorInScreener(row.sector)}
                        className="text-xs sm:text-sm font-medium text-slate-900 dark:text-slate-100 hover:text-teal-700 dark:hover:text-teal-400 truncate block text-left cursor-pointer"
                      >
                        {row.sector}
                      </button>
                      <div className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-1.5">
                        <span>{row.count} emiten</span>
                        {row.topTicker && (
                          <>
                            <span aria-hidden="true">·</span>
                            <button
                              type="button"
                              onClick={() => onSelectStock(row.topTicker)}
                              className="hover:text-teal-700 dark:hover:text-teal-400 cursor-pointer"
                              title={row.topTickerName}
                            >
                              Leader:{' '}
                              <strong className="text-slate-700 dark:text-slate-300">
                                {row.topTicker}
                              </strong>
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 shrink-0 font-mono tabular-nums text-xs text-right">
                    <div className="hidden sm:block text-slate-700 dark:text-slate-300 font-medium w-24">
                      Rp{formatTrillionIdr(row.totalMarketCapT)} T
                    </div>
                    <div className="w-14 font-semibold text-slate-900 dark:text-slate-100">
                      {row.sharePercent.toFixed(1)}%
                    </div>
                    <div className={`w-16 font-medium ${getChangeColorClass(row.weightedChangePercent)}`}>
                      {formatSignedPercent(row.weightedChangePercent)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!resolvedData.isFullUniverse && chartItems.length > 0 && (
        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400">
          Menampilkan agregasi sementara dari emiten unggulan yang dimuat.
        </div>
      )}
    </section>
  );
}
