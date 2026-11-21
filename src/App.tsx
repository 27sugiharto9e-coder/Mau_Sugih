import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  FileSpreadsheet,
  Filter,
  GraduationCap,
  Menu,
  Moon,
  Newspaper,
  RefreshCw,
  Sun,
  TrendingUp,
  X,
} from 'lucide-react';
import type {
  ActiveTab,
  AiDigestSummary,
  AiStockDiagnosis,
  LiveStockQuote,
  MarketOverviewResponse,
  NewsFeedResponse,
  SectorCapsResponse,
  ThemeMode,
} from './types';
import {
  formatIdr,
  formatSignedPercent,
  getChangeColorClass,
} from './utils/formatters';
import { StockSearchBox } from './components/StockSearchBox';
import { DailyDigestView } from './components/DailyDigestView';
import { StockAnalysisView } from './components/StockAnalysisView';
import { ScreenerView } from './components/ScreenerView';
import { FundamentalsView } from './components/FundamentalsView';
import { SentimentNewsView } from './components/SentimentNewsView';
import { BeginnerAcademyView } from './components/BeginnerAcademyView';

const NAV_ITEMS: Array<{
  id: ActiveTab;
  label: string;
  breadcrumb: string;
  icon: typeof Newspaper;
}> = [
  {
    id: 'digest',
    label: 'Ringkasan Harian',
    breadcrumb: 'Ringkasan Ekonomi Harian',
    icon: Newspaper,
  },
  {
    id: 'analysis',
    label: 'Analisis Saham',
    breadcrumb: 'Analisis Teknikal & Saham IDX',
    icon: BarChart3,
  },
  {
    id: 'screener',
    label: 'Screener IDX',
    breadcrumb: 'Screener Fundamental IDX',
    icon: Filter,
  },
  {
    id: 'fundamentals',
    label: 'Laporan Keuangan',
    breadcrumb: 'Fundamental & Valuasi',
    icon: FileSpreadsheet,
  },
  {
    id: 'sentiment',
    label: 'Sentimen Berita',
    breadcrumb: 'Dampak Berita & Sentimen',
    icon: TrendingUp,
  },
  {
    id: 'academy',
    label: 'Belajar & Simulasi',
    breadcrumb: 'Akademi Pemula & Simulasi Investasi',
    icon: GraduationCap,
  },
];

const DEFAULT_WATCHLIST = ['BBCA', 'BBRI', 'BMRI', 'TLKM', 'ANTM', 'ADRO'];

export default function App() {
  const [theme, setTheme] = useState<ThemeMode>(() => {
    try {
      const saved = localStorage.getItem('nusaticker_theme');
      return saved === 'dark' ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  });

  const [activeTab, setActiveTab] = useState<ActiveTab>('digest');
  const [selectedTicker, setSelectedTicker] = useState<string>('BBCA');
  const [sentimentQuery, setSentimentQuery] = useState<string>('');
  const [screenerSector, setScreenerSector] = useState<string>('Semua');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [watchlist, setWatchlist] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem('nusaticker_watchlist');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // Fallback to default
    }
    return DEFAULT_WATCHLIST;
  });

  const [market, setMarket] = useState<MarketOverviewResponse | null>(null);
  const [customStocks, setCustomStocks] = useState<Record<string, LiveStockQuote>>({});
  const [stockLoading, setStockLoading] = useState(false);
  const [stockError, setStockError] = useState<string | null>(null);

  const [news, setNews] = useState<NewsFeedResponse | null>(null);
  const [sectorCaps, setSectorCaps] = useState<SectorCapsResponse | null>(null);
  const [sectorCapsLoading, setSectorCapsLoading] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);

  const [aiDigest, setAiDigest] = useState<AiDigestSummary | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const [aiDiagnoses, setAiDiagnoses] = useState<Record<string, AiStockDiagnosis>>({});
  const [aiDiagnosisLoadingTicker, setAiDiagnosisLoadingTicker] = useState<string | null>(null);
  const [aiDiagnosisErrors, setAiDiagnosisErrors] = useState<Record<string, string | null>>({});

  // Sync dark mode class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      localStorage.setItem('nusaticker_theme', theme);
    } catch {
      // Ignore storage failures
    }
  }, [theme]);

  useEffect(() => {
    try {
      localStorage.setItem('nusaticker_watchlist', JSON.stringify(watchlist));
    } catch {
      // Ignore storage failures
    }
  }, [watchlist]);

  const allStocks = useMemo(() => {
    const map = new Map<string, LiveStockQuote>();
    for (const s of market?.stocks ?? []) {
      map.set(s.ticker, s);
    }
    for (const [ticker, s] of Object.entries(customStocks)) {
      map.set(ticker, s);
    }
    return Array.from(map.values());
  }, [market, customStocks]);

  const loadCustomWatchlistQuotes = useCallback(async (baseStocks: LiveStockQuote[]) => {
    const baseTickers = new Set(baseStocks.map((s) => s.ticker));
    const extraTickers = watchlist.filter((t) => !baseTickers.has(t));
    if (extraTickers.length === 0) return;

    try {
      const res = await fetch(
        `/api/market/quotes?tickers=${encodeURIComponent(extraTickers.join(','))}`
      );
      if (res.ok) {
        const json = (await res.json()) as { stocks: LiveStockQuote[] };
        setCustomStocks((prev) => {
          const next = { ...prev };
          for (const s of json.stocks ?? []) {
            if (s.isLive) next[s.ticker] = s;
          }
          return next;
        });
      }
    } catch {
      // Non-blocking for watchlist custom quotes
    }
  }, [watchlist]);

  const loadSectorCaps = useCallback(async () => {
    try {
      const res = await fetch('/api/market/sector-caps');
      if (res.ok) {
        const json = (await res.json()) as SectorCapsResponse;
        setSectorCaps(json);
      }
    } catch {
      // Non-blocking; fallback aggregation remains available
    } finally {
      setSectorCapsLoading(false);
    }
  }, []);

  const loadData = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const [marketRes, newsRes] = await Promise.all([
        fetch('/api/market/overview'),
        fetch('/api/news'),
      ]);
      if (!marketRes.ok) throw new Error('Gagal mengambil data pasar IDX.');
      if (!newsRes.ok) throw new Error('Gagal mengambil feed berita ekonomi.');

      const [marketJson, newsJson] = await Promise.all([
        marketRes.json() as Promise<MarketOverviewResponse>,
        newsRes.json() as Promise<NewsFeedResponse>,
      ]);

      setMarket(marketJson);
      setNews(newsJson);
      setDataError(null);
      loadCustomWatchlistQuotes(marketJson.stocks);
      loadSectorCaps();
    } catch (err) {
      setDataError(err instanceof Error ? err.message : 'Terjadi gangguan koneksi server.');
    } finally {
      setInitialLoading(false);
      setRefreshing(false);
    }
  }, [loadCustomWatchlistQuotes, loadSectorCaps]);

  // Initial load + Real-time SSE market stream + 30s sector caps refresh
  useEffect(() => {
    loadData(false);

    const evtSource = new EventSource('/api/market/stream');
    evtSource.onmessage = (event) => {
      try {
        const snapshot = JSON.parse(event.data) as MarketOverviewResponse;
        setMarket(snapshot);
      } catch {
        // Ignore malformed frame
      }
    };

    const capsInterval = window.setInterval(() => {
      loadSectorCaps();
    }, 30_000);

    return () => {
      evtSource.close();
      window.clearInterval(capsInterval);
    };
  }, [loadData, loadSectorCaps]);

  const ensureStockLoaded = useCallback(
    async (rawTicker: string) => {
      const ticker = rawTicker.toUpperCase().replace('.JK', '').trim();
      setSelectedTicker(ticker);
      setStockError(null);

      const existsInCatalog = (market?.stocks ?? []).some((s) => s.ticker === ticker);
      const existsInCustom = Boolean(customStocks[ticker]);
      if (existsInCatalog || existsInCustom) return;

      setStockLoading(true);
      try {
        const res = await fetch(`/api/stock/${encodeURIComponent(ticker)}/detail`);
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.error || `Gagal memuat data emiten ${ticker}.`);
        }
        const detail = json as LiveStockQuote;
        setCustomStocks((prev) => ({ ...prev, [detail.ticker]: detail }));
      } catch (err) {
        setStockError(
          err instanceof Error ? err.message : `Gagal memuat data saham ${ticker}.`
        );
      } finally {
        setStockLoading(false);
      }
    },
    [market, customStocks]
  );

  const handleGenerateAiDigest = async () => {
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await fetch('/api/digest/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articles: news?.articles.slice(0, 10) ?? [] }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Gagal menyusun ringkasan AI.');
      }
      setAiDigest(json as AiDigestSummary);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Gagal menghubungi layanan AI.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleRunStockDiagnosis = useCallback(async (rawTicker: string, forceRefresh = false) => {
    const ticker = rawTicker.toUpperCase().replace('.JK', '').trim();
    setAiDiagnosisLoadingTicker(ticker);
    setAiDiagnosisErrors((prev) => ({ ...prev, [ticker]: null }));
    try {
      const res = await fetch(`/api/stock/${encodeURIComponent(ticker)}/ai-diagnosis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forceRefresh }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || `Gagal menyusun analisis fundamental AI untuk ${ticker}.`);
      }
      setAiDiagnoses((prev) => ({ ...prev, [ticker]: json as AiStockDiagnosis }));
    } catch (err) {
      setAiDiagnosisErrors((prev) => ({
        ...prev,
        [ticker]: err instanceof Error ? err.message : 'Gagal menghubungi layanan analisis AI.',
      }));
    } finally {
      setAiDiagnosisLoadingTicker((prev) => (prev === ticker ? null : prev));
    }
  }, []);

  const handleToggleWatchlist = (ticker: string) => {
    setWatchlist((prev) =>
      prev.includes(ticker) ? prev.filter((t) => t !== ticker) : [...prev, ticker]
    );
  };

  const handleOpenStockAnalysis = (ticker: string) => {
    ensureStockLoaded(ticker);
    setActiveTab('analysis');
    setMobileMenuOpen(false);
  };

  const handleOpenFundamentals = (ticker: string) => {
    ensureStockLoaded(ticker);
    setActiveTab('fundamentals');
    setMobileMenuOpen(false);
  };

  const handleOpenSentimentTab = (topicFilter?: string) => {
    setSentimentQuery(topicFilter ?? '');
    setActiveTab('sentiment');
    setMobileMenuOpen(false);
  };

  const handleSelectSectorInScreener = (sector: string) => {
    setScreenerSector(sector);
    setActiveTab('screener');
    setMobileMenuOpen(false);
  };

  const activeNav = NAV_ITEMS.find((item) => item.id === activeTab) ?? NAV_ITEMS[0];
  const watchlistStocks = watchlist
    .map((t) => allStocks.find((s) => s.ticker === t))
    .filter((s): s is LiveStockQuote => Boolean(s));

  const sidebarContent = (
    <div className="flex flex-col h-full justify-between py-5 px-4">
      <div className="space-y-5">
        {/* Single-element Brand Zone */}
        <div className="px-2 flex items-center justify-between">
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('digest');
              setMobileMenuOpen(false);
            }}
            className="font-display text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap shrink-0"
          >
            Mau Sugih
          </a>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="lg:hidden p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer"
            aria-label="Tutup menu navigasi"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Universal IDX Stock Search */}
        <div>
          <StockSearchBox
            compact
            currentTicker={selectedTicker}
            placeholder="Cari saham IDX (BRIS, PTBA...)"
            onSelectTicker={(ticker) => {
              if (activeTab === 'fundamentals') {
                handleOpenFundamentals(ticker);
              } else {
                handleOpenStockAnalysis(ticker);
              }
            }}
          />
        </div>

        {/* Navigation Links */}
        <nav aria-label="Navigasi utama" className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (item.id === 'sentiment') setSentimentQuery('');
                  setActiveTab(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Live Watchlist Panel */}
        <div className="pt-5 border-t border-slate-200 dark:border-slate-800">
          <div className="px-2 flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400 mb-3">
            <span>Watchlist Pilihan</span>
            <span className="font-mono tabular-nums">{watchlist.length}</span>
          </div>
          {watchlistStocks.length === 0 ? (
            <p className="px-2 text-xs text-slate-500 dark:text-slate-400">
              Belum ada saham di watchlist. Cari atau tambahkan melalui Screener IDX.
            </p>
          ) : (
            <div className="space-y-0.5">
              {watchlistStocks.map((s) => (
                <button
                  key={s.ticker}
                  type="button"
                  onClick={() => handleOpenStockAnalysis(s.ticker)}
                  className={`w-full px-2.5 py-2 rounded-lg flex items-center justify-between gap-2 text-left transition-colors cursor-pointer ${
                    activeTab === 'analysis' && selectedTicker === s.ticker
                      ? 'bg-teal-50 dark:bg-teal-950/40'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="text-xs font-mono font-semibold text-slate-900 dark:text-slate-100">
                      {s.ticker}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[100px]">
                      {s.sector}
                    </div>
                  </div>
                  <div className="text-right font-mono tabular-nums shrink-0">
                    <div className="text-xs font-medium text-slate-900 dark:text-slate-100">
                      {s.isLive ? formatIdr(s.price) : '—'}
                    </div>
                    <div className={`text-[11px] ${getChangeColorClass(s.changePercent)}`}>
                      {s.isLive ? formatSignedPercent(s.changePercent) : '—'}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Data Transparency Note */}
      <div className="px-2 pt-4 border-t border-slate-200 dark:border-slate-800 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
        Mendukung pencarian seluruh emiten IDX (.JK). Laporan keuangan bersumber dari rilis kuartalan (End-of-Day).
      </div>
    </div>
  );

  return (
    <div id="top" className="min-h-screen flex bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Desktop Sidebar (256px) */}
      <aside className="hidden lg:block w-64 shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 sticky top-0 h-screen overflow-y-auto">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/40"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative w-72 max-w-[82vw] bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 h-full overflow-y-auto z-10">
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Main Content Shell */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Bar Contract: Breadcrumb on left, max 2 clean actions on right */}
        <header className="sticky top-0 z-30 h-14 px-4 sm:px-6 lg:px-8 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs flex items-center justify-between gap-8">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 -ml-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              aria-label="Buka menu navigasi"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-xs sm:text-sm truncate">
              <span className="text-slate-500 dark:text-slate-400 whitespace-nowrap">Pasar Modal Indonesia</span>
              <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">/</span>
              <span className="font-medium text-slate-900 dark:text-slate-100 truncate">
                {activeNav.breadcrumb}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setTheme((prev) => (prev === 'light' ? 'dark' : 'light'))}
              aria-label={theme === 'light' ? 'Aktifkan mode gelap' : 'Aktifkan mode terang'}
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={() => loadData(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 hover:border-teal-600 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span>{refreshing ? 'Memperbarui...' : 'Segarkan Data'}</span>
            </button>
          </div>
        </header>

        {/* Main Viewport */}
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-7 max-w-[1360px] w-full mx-auto">
          {dataError && (
            <div className="mb-6 p-4 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/30 text-sm text-red-800 dark:text-red-300 flex items-center justify-between gap-4">
              <span>{dataError}</span>
              <button
                type="button"
                onClick={() => loadData(true)}
                className="px-3 py-1.5 text-xs font-medium rounded-md bg-red-700 text-white whitespace-nowrap shrink-0 cursor-pointer"
              >
                Coba Lagi
              </button>
            </div>
          )}

          {initialLoading ? (
            <div className="space-y-6 animate-pulse">
              <div className="h-8 w-80 bg-slate-200 dark:bg-slate-800 rounded-lg" />
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((n) => (
                  <div key={n} className="h-28 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl" />
                ))}
              </div>
              <div className="h-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl" />
            </div>
          ) : (
            <>
              {activeTab === 'digest' && (
                <DailyDigestView
                  market={market}
                  news={news}
                  sectorCaps={sectorCaps}
                  sectorCapsLoading={sectorCapsLoading}
                  aiDigest={aiDigest}
                  aiLoading={aiLoading}
                  aiError={aiError}
                  onGenerateAiDigest={handleGenerateAiDigest}
                  onSelectStock={handleOpenStockAnalysis}
                  onOpenSentimentTab={handleOpenSentimentTab}
                  onSelectSectorInScreener={handleSelectSectorInScreener}
                />
              )}
              {activeTab === 'analysis' && (
                <StockAnalysisView
                  stocks={allStocks}
                  selectedTicker={selectedTicker}
                  onSelectTicker={ensureStockLoaded}
                  stockLoading={stockLoading}
                  stockError={stockError}
                  watchlist={watchlist}
                  onToggleWatchlist={handleToggleWatchlist}
                  newsArticles={news?.articles ?? []}
                  onOpenFundamentals={handleOpenFundamentals}
                  aiDiagnosis={aiDiagnoses[selectedTicker] ?? null}
                  aiDiagnosisLoading={aiDiagnosisLoadingTicker === selectedTicker}
                  aiDiagnosisError={aiDiagnosisErrors[selectedTicker] ?? null}
                  onRunAiDiagnosis={(forceRefresh) =>
                    handleRunStockDiagnosis(selectedTicker, forceRefresh)
                  }
                />
              )}
              {activeTab === 'screener' && (
                <ScreenerView
                  stocks={allStocks}
                  watchlist={watchlist}
                  initialSector={screenerSector}
                  onToggleWatchlist={handleToggleWatchlist}
                  onSelectStock={handleOpenStockAnalysis}
                  onOpenFundamentals={handleOpenFundamentals}
                />
              )}
              {activeTab === 'fundamentals' && (
                <FundamentalsView
                  stocks={allStocks}
                  selectedTicker={selectedTicker}
                  onSelectTicker={ensureStockLoaded}
                  stockLoading={stockLoading}
                  stockError={stockError}
                  onOpenChart={handleOpenStockAnalysis}
                  aiDiagnosis={aiDiagnoses[selectedTicker] ?? null}
                  aiDiagnosisLoading={aiDiagnosisLoadingTicker === selectedTicker}
                  aiDiagnosisError={aiDiagnosisErrors[selectedTicker] ?? null}
                  onRunAiDiagnosis={(forceRefresh) =>
                    handleRunStockDiagnosis(selectedTicker, forceRefresh)
                  }
                />
              )}
              {activeTab === 'sentiment' && (
                <SentimentNewsView
                  news={news}
                  aiDigest={aiDigest}
                  initialQuery={sentimentQuery}
                  onSelectStock={handleOpenStockAnalysis}
                />
              )}
              {activeTab === 'academy' && (
                <BeginnerAcademyView
                  stocks={allStocks}
                  selectedTicker={selectedTicker}
                  onEnsureStockLoaded={ensureStockLoaded}
                  stockLoading={stockLoading}
                  onSelectStock={handleOpenStockAnalysis}
                />
              )}
            </>
          )}
        </main>

        {/* Quiet Legal/Transparency Footer */}
        <footer className="px-4 sm:px-6 lg:px-8 py-4 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 flex flex-wrap items-center justify-between gap-2 max-w-[1360px] w-full mx-auto">
          <span>
            Mau Sugih · Analisis riset pasar modal Indonesia untuk tujuan informasi, bukan rekomendasi beli/jual.
          </span>
          <span className="font-mono tabular-nums">
            {market ? `Sinkronisasi terakhir ${market.fetchedAtWib} WIB` : ''}
          </span>
        </footer>
      </div>
    </div>
  );
}
