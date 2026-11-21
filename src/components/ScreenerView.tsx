import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowUpDown,
  Bookmark,
  BookmarkCheck,
  ChevronLeft,
  ChevronRight,
  Search,
} from 'lucide-react';
import type {
  LiveStockQuote,
  ScreenerItem,
  ScreenerPageResponse,
  StockSearchResult,
} from '../types';
import {
  formatCompactVolume,
  formatIdr,
  formatSignedPercent,
  getChangeColorClass,
} from '../utils/formatters';

interface ScreenerViewProps {
  stocks: LiveStockQuote[];
  watchlist: string[];
  initialSector?: string;
  onToggleWatchlist: (ticker: string) => void;
  onSelectStock: (ticker: string) => void;
  onOpenFundamentals: (ticker: string) => void;
}

type SortKey =
  | 'ticker'
  | 'price'
  | 'changePercent'
  | 'volume'
  | 'per'
  | 'pbv'
  | 'marketCapT';

const SECTORS = [
  'Semua',
  'Keuangan',
  'Energi',
  'Barang Baku',
  'Infrastruktur',
  'Konsumer Primer',
  'Konsumer Siklikal',
  'Perindustrian',
  'Teknologi',
  'Kesehatan',
  'Properti & Real Estat',
];

const PAGE_SIZE_OPTIONS = [15, 20, 30, 50];

function buildPaginationRange(current: number, total: number): Array<number | 'ellipsis'> {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const pages: Array<number | 'ellipsis'> = [1];
  const left = Math.max(2, current - 1);
  const right = Math.min(total - 1, current + 1);

  if (left > 2) pages.push('ellipsis');
  for (let p = left; p <= right; p++) {
    pages.push(p);
  }
  if (right < total - 1) pages.push('ellipsis');
  pages.push(total);
  return pages;
}

export function ScreenerView({
  stocks,
  watchlist,
  initialSector = 'Semua',
  onToggleWatchlist,
  onSelectStock,
  onOpenFundamentals,
}: ScreenerViewProps) {
  const [query, setQuery] = useState('');
  const [sector, setSector] = useState<string>(initialSector);

  useEffect(() => {
    setSector(initialSector);
    setPage(1);
  }, [initialSector]);
  const [maxPer, setMaxPer] = useState<string>('');
  const [maxPbv, setMaxPbv] = useState<string>('');
  const [minRoe, setMinRoe] = useState<string>('');
  const [minYield, setMinYield] = useState<string>('');

  const [sortKey, setSortKey] = useState<SortKey>('marketCapT');
  const [sortAsc, setSortAsc] = useState(false);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [serverPage, setServerPage] = useState<ScreenerPageResponse | null>(null);
  const [searchRows, setSearchRows] = useState<ScreenerItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const resetToFirstPage = () => setPage(1);

  const fetchScreenerPage = useCallback(async () => {
    const q = query.trim();
    if (q.length >= 2) return; // Handled by search effect

    setLoading(true);
    setError(null);

    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
      sector,
      sortBy: sortKey,
      sortDir: sortAsc ? 'asc' : 'desc',
    });

    if (maxPer.trim()) params.set('maxPer', maxPer.trim());
    if (maxPbv.trim()) params.set('maxPbv', maxPbv.trim());
    if (minRoe.trim()) params.set('minRoe', minRoe.trim());
    if (minYield.trim()) params.set('minYield', minYield.trim());

    try {
      const res = await fetch(`/api/stocks/screener?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Gagal memuat daftar emiten IDX.');
      }
      setSearchRows(null);
      setServerPage(json as ScreenerPageResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat screener IDX.');
    } finally {
      setLoading(false);
    }
  }, [query, page, pageSize, sector, maxPer, maxPbv, minRoe, minYield, sortKey, sortAsc]);

  // Debounced fetch when filters, page, or sort change (and query is empty)
  useEffect(() => {
    if (query.trim().length >= 2) return;
    const timer = setTimeout(() => {
      fetchScreenerPage();
    }, 180);
    return () => clearTimeout(timer);
  }, [query, fetchScreenerPage]);

  // Debounced IDX-wide search when query >= 2 chars
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setSearchRows(null);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const searchRes = await fetch(`/api/stocks/search?q=${encodeURIComponent(q)}`);
        const searchJson = (await searchRes.json()) as { results?: StockSearchResult[] };
        const tickers = (searchJson.results ?? []).map((r) => r.ticker).slice(0, 15);

        if (tickers.length === 0) {
          setSearchRows([]);
          setLoading(false);
          return;
        }

        const quotesRes = await fetch(
          `/api/market/quotes?tickers=${encodeURIComponent(tickers.join(','))}`
        );
        const quotesJson = (await quotesRes.json()) as { stocks?: LiveStockQuote[] };
        const mapped: ScreenerItem[] = (quotesJson.stocks ?? [])
          .filter((s) => s.isLive)
          .map((s) => ({
            ticker: s.ticker,
            symbol: s.symbol,
            name: s.name,
            sector: s.sector,
            price: s.price,
            changePercent: s.changePercent,
            volume: s.volume,
            per: s.per,
            pbv: s.pbv,
            roe: s.roe,
            dividendYield: s.dividendYield,
            marketCapT: s.marketCapT,
            isLive: s.isLive,
          }));
        setSearchRows(mapped);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Gagal mencari emiten IDX.');
      } finally {
        setLoading(false);
      }
    }, 260);

    return () => clearTimeout(timer);
  }, [query]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc((prev) => !prev);
    } else {
      setSortKey(key);
      setSortAsc(key === 'ticker');
    }
    resetToFirstPage();
  };

  const resetFilters = () => {
    setQuery('');
    setSector('Semua');
    setMaxPer('');
    setMaxPbv('');
    setMinRoe('');
    setMinYield('');
    setSortKey('marketCapT');
    setSortAsc(false);
    setPage(1);
  };

  // Fallback rows if server screener errored
  const fallbackRows: ScreenerItem[] = useMemo(
    () =>
      stocks.map((s) => ({
        ticker: s.ticker,
        symbol: s.symbol,
        name: s.name,
        sector: s.sector,
        price: s.price,
        changePercent: s.changePercent,
        volume: s.volume,
        per: s.per,
        pbv: s.pbv,
        roe: s.roe,
        dividendYield: s.dividendYield,
        marketCapT: s.marketCapT,
        isLive: s.isLive,
      })),
    [stocks]
  );

  const isSearchMode = query.trim().length >= 2;
  const activeItems = useMemo(() => {
    if (isSearchMode) {
      const list = searchRows ?? [];
      return [...list].sort((a, b) => {
        const av = a[sortKey];
        const bv = b[sortKey];
        if (typeof av === 'string' && typeof bv === 'string') {
          return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
        }
        const diff = Number(av) - Number(bv);
        return sortAsc ? diff : -diff;
      });
    }
    if (serverPage) return serverPage.items;
    return error ? fallbackRows : [];
  }, [isSearchMode, searchRows, serverPage, error, fallbackRows, sortKey, sortAsc]);

  const totalCount = isSearchMode
    ? activeItems.length
    : serverPage?.total ?? (error ? fallbackRows.length : 0);
  const totalPages = isSearchMode ? 1 : serverPage?.totalPages ?? 1;
  const currentPage = isSearchMode ? 1 : serverPage?.page ?? page;

  const startIdx = totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endIdx = isSearchMode
    ? totalCount
    : Math.min(totalCount, currentPage * pageSize);

  const paginationRange = useMemo(
    () => buildPaginationRange(currentPage, totalPages),
    [currentPage, totalPages]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
            Screener & Direktori Seluruh Emiten IDX
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Telusuri seluruh emiten Bursa Efek Indonesia dengan pagination cepat, penyaringan sektor, dan rasio valuasi real-time.
          </p>
        </div>
        <button
          type="button"
          onClick={resetFilters}
          className="px-3.5 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:border-slate-300 whitespace-nowrap shrink-0 cursor-pointer"
        >
          Reset Filter
        </button>
      </div>

      {/* Filter Controls */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="md:col-span-2">
            <label htmlFor="screener-search" className="block text-xs text-slate-500 dark:text-slate-400 mb-1.5">
              Cari Kode atau Nama Emiten IDX
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="screener-search"
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  resetToFirstPage();
                }}
                placeholder="Cari di seluruh IDX (mis. BRIS, PTBA, BUMI, Bank)..."
                className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>
          </div>

          <div>
            <label htmlFor="max-per" className="block text-xs text-slate-500 dark:text-slate-400 mb-1.5">
              Maks. PER (x)
            </label>
            <input
              id="max-per"
              type="number"
              min="1"
              max="500"
              placeholder="Semua"
              value={maxPer}
              onChange={(e) => {
                setMaxPer(e.target.value);
                resetToFirstPage();
              }}
              className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
          </div>

          <div>
            <label htmlFor="max-pbv" className="block text-xs text-slate-500 dark:text-slate-400 mb-1.5">
              Maks. PBV (x)
            </label>
            <input
              id="max-pbv"
              type="number"
              step="0.5"
              min="0.1"
              max="100"
              placeholder="Semua"
              value={maxPbv}
              onChange={(e) => {
                setMaxPbv(e.target.value);
                resetToFirstPage();
              }}
              className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="min-roe" className="block text-xs text-slate-500 dark:text-slate-400 mb-1.5">
                Min. ROE (%)
              </label>
              <input
                id="min-roe"
                type="number"
                placeholder="Semua"
                value={minRoe}
                onChange={(e) => {
                  setMinRoe(e.target.value);
                  resetToFirstPage();
                }}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>
            <div>
              <label htmlFor="min-yield" className="block text-xs text-slate-500 dark:text-slate-400 mb-1.5">
                Min. Yield (%)
              </label>
              <input
                id="min-yield"
                type="number"
                step="0.5"
                min="0"
                placeholder="0"
                value={minYield}
                onChange={(e) => {
                  setMinYield(e.target.value);
                  resetToFirstPage();
                }}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>
          </div>
        </div>

        {/* Sector Filter Buttons */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-200 dark:border-slate-800">
          {SECTORS.map((sec) => (
            <button
              key={sec}
              type="button"
              onClick={() => {
                setSector(sec);
                resetToFirstPage();
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                sector === sec
                  ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {sec}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/70 dark:bg-amber-950/30 text-xs text-amber-800 dark:text-amber-300 flex items-center justify-between gap-4">
          <span>{error} — Menampilkan daftar cadangan emiten unggulan.</span>
          <button
            type="button"
            onClick={fetchScreenerPage}
            className="font-medium underline whitespace-nowrap shrink-0 cursor-pointer"
          >
            Muat Ulang
          </button>
        </div>
      )}

      {/* Data Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        {/* Top Table Summary & Page Size */}
        <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
          <span className="font-mono tabular-nums">
            {loading
              ? 'Memuat halaman emiten IDX...'
              : totalCount > 0
              ? `Menampilkan ${startIdx}–${endIdx} dari ${totalCount.toLocaleString('id-ID')} emiten IDX`
              : '0 emiten ditemukan'}
          </span>

          {!isSearchMode && (
            <div className="flex items-center gap-2 shrink-0">
              <label htmlFor="page-size-select" className="text-slate-500 dark:text-slate-400">
                Baris/hal:
              </label>
              <select
                id="page-size-select"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="px-2 py-1 font-mono tabular-nums text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-600"
              >
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 text-xs font-medium text-slate-500 dark:text-slate-400">
                <th className="py-3 pl-5 pr-3">
                  <button
                    type="button"
                    onClick={() => handleSort('ticker')}
                    className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer"
                  >
                    Emiten <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3 px-3 text-right">
                  <button
                    type="button"
                    onClick={() => handleSort('price')}
                    className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer"
                  >
                    Harga <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3 px-3 text-right">
                  <button
                    type="button"
                    onClick={() => handleSort('changePercent')}
                    className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer"
                  >
                    Perubahan <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3 px-3 text-right">
                  <button
                    type="button"
                    onClick={() => handleSort('volume')}
                    className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer"
                  >
                    Volume <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3 px-3 text-right">
                  <button
                    type="button"
                    onClick={() => handleSort('per')}
                    className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer"
                  >
                    PER <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3 px-3 text-right">
                  <button
                    type="button"
                    onClick={() => handleSort('pbv')}
                    className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer"
                  >
                    PBV <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3 px-3 text-right">ROE</th>
                <th className="py-3 px-3 text-right">Div. Yield</th>
                <th className="py-3 px-3 text-right">
                  <button
                    type="button"
                    onClick={() => handleSort('marketCapT')}
                    className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer"
                  >
                    M.Cap <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3 pl-3 pr-5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
              {loading ? (
                Array.from({ length: Math.min(pageSize, 10) }).map((_, idx) => (
                  <tr key={`skeleton-${idx}`} className="animate-pulse">
                    <td className="py-3 pl-5 pr-3">
                      <div className="h-4 w-14 bg-slate-200 dark:bg-slate-800 rounded mb-1" />
                      <div className="h-3 w-36 bg-slate-100 dark:bg-slate-800/60 rounded" />
                    </td>
                    {Array.from({ length: 8 }).map((__, colIdx) => (
                      <td key={colIdx} className="py-3 px-3 text-right">
                        <div className="h-4 w-12 bg-slate-100 dark:bg-slate-800/60 rounded ml-auto" />
                      </td>
                    ))}
                    <td className="py-3 pl-3 pr-5 text-right">
                      <div className="h-4 w-10 bg-slate-100 dark:bg-slate-800/60 rounded ml-auto" />
                    </td>
                  </tr>
                ))
              ) : activeItems.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
                    Tidak ada emiten IDX yang cocok dengan kriteria filter saat ini. Coba longgarkan batas PER/PBV atau klik Reset Filter.
                  </td>
                </tr>
              ) : (
                activeItems.map((row) => {
                  const isSaved = watchlist.includes(row.ticker);
                  return (
                    <tr
                      key={row.ticker}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-2.5 pl-5 pr-3">
                        <button
                          type="button"
                          onClick={() => onSelectStock(row.ticker)}
                          className="text-left group cursor-pointer"
                        >
                          <div className="font-mono font-semibold text-slate-900 dark:text-slate-100 group-hover:text-teal-700 dark:group-hover:text-teal-400">
                            {row.ticker}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[220px]">
                            {row.name} · {row.sector}
                          </div>
                        </button>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums font-medium text-slate-900 dark:text-slate-100">
                        {row.isLive ? `Rp${formatIdr(row.price)}` : '—'}
                      </td>
                      <td
                        className={`py-2.5 px-3 text-right font-mono tabular-nums font-medium ${getChangeColorClass(
                          row.changePercent
                        )}`}
                      >
                        {row.isLive ? formatSignedPercent(row.changePercent) : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-600 dark:text-slate-400">
                        {formatCompactVolume(row.volume)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-800 dark:text-slate-200">
                        {row.per > 0 ? `${row.per.toFixed(1)}x` : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-800 dark:text-slate-200">
                        {row.pbv > 0 ? `${row.pbv.toFixed(2)}x` : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-800 dark:text-slate-200">
                        {row.roe !== 0 ? `${row.roe.toFixed(1)}%` : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-800 dark:text-slate-200">
                        {row.dividendYield > 0 ? `${row.dividendYield.toFixed(2)}%` : '0,00%'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                        {row.marketCapT > 0 ? `${row.marketCapT.toFixed(2)}T` : '—'}
                      </td>
                      <td className="py-2.5 pl-3 pr-5 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => onOpenFundamentals(row.ticker)}
                            className="text-xs font-medium text-teal-700 dark:text-teal-400 hover:underline whitespace-nowrap cursor-pointer"
                          >
                            LK
                          </button>
                          <button
                            type="button"
                            onClick={() => onToggleWatchlist(row.ticker)}
                            aria-label={`Simpan ${row.ticker} ke watchlist`}
                            className="p-1.5 rounded-md text-slate-400 hover:text-teal-700 dark:hover:text-teal-400 transition-colors cursor-pointer"
                          >
                            {isSaved ? (
                              <BookmarkCheck className="w-4 h-4 text-teal-700 dark:text-teal-400" />
                            ) : (
                              <Bookmark className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {!isSearchMode && totalPages > 1 && (
          <div className="px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
              Halaman {currentPage} dari {totalPages}
              {serverPage?.fetchedAtWib ? ` · Data per ${serverPage.fetchedAtWib} WIB` : ''}
            </div>

            <nav aria-label="Navigasi halaman screener" className="flex items-center gap-1">
              <button
                type="button"
                disabled={currentPage <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap shrink-0 cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Sebelumnya</span>
              </button>

              <div className="hidden sm:flex items-center gap-1">
                {paginationRange.map((entry, idx) =>
                  entry === 'ellipsis' ? (
                    <span
                      key={`ellipsis-${idx}`}
                      className="px-2 py-1 text-xs text-slate-400 dark:text-slate-500 font-mono"
                    >
                      …
                    </span>
                  ) : (
                    <button
                      key={entry}
                      type="button"
                      disabled={loading}
                      aria-current={entry === currentPage ? 'page' : undefined}
                      onClick={() => setPage(entry)}
                      className={`min-w-[32px] px-2.5 py-1.5 text-xs font-mono tabular-nums rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        entry === currentPage
                          ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-semibold'
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      {entry}
                    </button>
                  )
                )}
              </div>

              <button
                type="button"
                disabled={currentPage >= totalPages || loading}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap shrink-0 cursor-pointer"
              >
                <span>Berikutnya</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </nav>
          </div>
        )}
      </div>
    </div>
  );
}
