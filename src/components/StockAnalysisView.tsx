import { useEffect, useState } from 'react';
import { Bookmark, BookmarkCheck, Loader2 } from 'lucide-react';
import type {
  AiNewsImpactResponse,
  AiStockDiagnosis,
  LiveStockQuote,
  NewsArticle,
  StockChartResponse,
} from '../types';
import {
  formatCompactVolume,
  formatIdr,
  formatSignedPercent,
  getChangeColorClass,
  getSentimentTextClass,
} from '../utils/formatters';
import { CandlestickChart } from './CandlestickChart';
import { StockSearchBox } from './StockSearchBox';
import { AiStockDiagnosisPanel } from './AiStockDiagnosisPanel';

interface StockAnalysisViewProps {
  stocks: LiveStockQuote[];
  selectedTicker: string;
  onSelectTicker: (ticker: string) => void;
  stockLoading: boolean;
  stockError: string | null;
  watchlist: string[];
  onToggleWatchlist: (ticker: string) => void;
  newsArticles: NewsArticle[];
  onOpenFundamentals: (ticker: string) => void;
  aiDiagnosis: AiStockDiagnosis | null;
  aiDiagnosisLoading: boolean;
  aiDiagnosisError: string | null;
  onRunAiDiagnosis: (forceRefresh?: boolean) => void;
}

export function StockAnalysisView({
  stocks,
  selectedTicker,
  onSelectTicker,
  stockLoading,
  stockError,
  watchlist,
  onToggleWatchlist,
  newsArticles,
  onOpenFundamentals,
  aiDiagnosis,
  aiDiagnosisLoading,
  aiDiagnosisError,
  onRunAiDiagnosis,
}: StockAnalysisViewProps) {
  const [range, setRange] = useState('3mo');
  const [chartData, setChartData] = useState<StockChartResponse | null>(null);
  const [chartLoading, setChartLoading] = useState(true);

  const [impactLoading, setImpactLoading] = useState(false);
  const [impactError, setImpactError] = useState<string | null>(null);
  const [impactResult, setImpactResult] = useState<AiNewsImpactResponse | null>(null);
  const [activeNewsId, setActiveNewsId] = useState<string | null>(null);

  const stock = stocks.find((s) => s.ticker === selectedTicker) ?? null;

  useEffect(() => {
    let cancelled = false;
    setChartLoading(true);
    fetch(`/api/stock/${encodeURIComponent(selectedTicker)}/chart?range=${encodeURIComponent(range)}`)
      .then((res) => res.json())
      .then((data: StockChartResponse) => {
        if (!cancelled) {
          setChartData(data);
          setChartLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setChartLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedTicker, range]);

  useEffect(() => {
    setImpactResult(null);
    setImpactError(null);
    setActiveNewsId(null);
  }, [selectedTicker]);

  const relatedNews = newsArticles.filter(
    (art) =>
      art.relatedTickers.includes(selectedTicker) ||
      art.title.toLowerCase().includes(selectedTicker.toLowerCase()) ||
      (stock && art.sectorTag === stock.sector)
  );

  const handleAnalyzeNewsImpact = async (article: NewsArticle) => {
    setActiveNewsId(article.id);
    setImpactLoading(true);
    setImpactError(null);
    try {
      const res = await fetch('/api/news/impact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: article.title,
          summary: article.summary,
          ticker: selectedTicker,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Gagal menganalisis dampak berita.');
      }
      setImpactResult(json as AiNewsImpactResponse);
    } catch (err) {
      setImpactError(err instanceof Error ? err.message : 'Terjadi kesalahan analisis AI.');
    } finally {
      setImpactLoading(false);
    }
  };

  const quickTickers = Array.from(new Set([selectedTicker, ...watchlist, 'BBCA', 'BBRI', 'BRIS', 'PTBA', 'TLKM'])).slice(0, 8);
  const isSaved = watchlist.includes(selectedTicker);

  return (
    <div className="space-y-6">
      {/* Universal IDX Search & Quick Ticker Switcher */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex-1 max-w-lg">
            <StockSearchBox
              onSelectTicker={onSelectTicker}
              currentTicker={selectedTicker}
              placeholder="Cari semua saham IDX (kode atau nama, mis. BRIS, PTBA, BUMI, PANI)..."
            />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onToggleWatchlist(selectedTicker)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                isSaved
                  ? 'border-teal-600 bg-teal-50/70 dark:bg-teal-950/40 text-teal-800 dark:text-teal-300'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:border-slate-300'
              }`}
            >
              {isSaved ? <BookmarkCheck className="w-3.5 h-3.5" /> : <Bookmark className="w-3.5 h-3.5" />}
              {isSaved ? 'Dalam Watchlist' : 'Simpan Watchlist'}
            </button>
            <button
              type="button"
              onClick={() => onOpenFundamentals(selectedTicker)}
              className="px-3.5 py-2 text-xs font-medium rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:opacity-90 transition-opacity whitespace-nowrap shrink-0 cursor-pointer"
            >
              Lihat Laporan Keuangan
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs">
          <span className="text-slate-500 dark:text-slate-400 mr-1">Akses cepat:</span>
          {quickTickers.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onSelectTicker(t)}
              className={`px-2.5 py-1 font-mono rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                selectedTicker === t
                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 font-medium'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {stockError && (
        <div className="p-4 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/30 text-sm text-red-800 dark:text-red-300">
          {stockError}
        </div>
      )}

      {/* Stock Header & Live Key Valuation Strip */}
      {stockLoading && !stock ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8 flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
          <Loader2 className="w-4 h-4 animate-spin text-teal-600" />
          <span>Mengambil kuotasi real-time dan rasio fundamental {selectedTicker}.JK...</span>
        </div>
      ) : stock ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
          <div className="flex flex-wrap items-end justify-between gap-6 pb-5 border-b border-slate-200 dark:border-slate-800">
            <div>
              <div className="text-xs font-mono text-slate-500 dark:text-slate-400">
                {stock.symbol} · {stock.sector} · {stock.subsector} · Data per {stock.updatedAtWib} WIB
              </div>
              <div className="flex flex-wrap items-baseline gap-4 mt-1.5">
                <h1 className="text-2xl md:text-3xl font-semibold text-slate-900 dark:text-slate-100">
                  {stock.ticker}
                </h1>
                <span className="text-sm text-slate-600 dark:text-slate-400 font-medium">
                  {stock.name}
                </span>
              </div>
              <div className="flex flex-wrap items-baseline gap-3 mt-2">
                <span className="text-2xl md:text-3xl font-semibold font-mono tabular-nums text-slate-900 dark:text-slate-100">
                  {stock.isLive ? `Rp${formatIdr(stock.price)}` : '—'}
                </span>
                <span
                  className={`text-sm font-mono tabular-nums font-medium ${getChangeColorClass(
                    stock.changePercent
                  )}`}
                >
                  {stock.isLive
                    ? `${stock.change >= 0 ? '+' : ''}${formatIdr(stock.change)} (${formatSignedPercent(
                        stock.changePercent
                      )})`
                    : 'Harga belum tersedia'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-8 gap-y-3 text-xs">
              <div>
                <div className="text-slate-500 dark:text-slate-400">Rentang Harian</div>
                <div className="font-mono tabular-nums font-medium text-slate-900 dark:text-slate-100 mt-0.5">
                  {stock.isLive ? `${formatIdr(stock.dayLow)} – ${formatIdr(stock.dayHigh)}` : '—'}
                </div>
              </div>
              <div>
                <div className="text-slate-500 dark:text-slate-400">Volume</div>
                <div className="font-mono tabular-nums font-medium text-slate-900 dark:text-slate-100 mt-0.5">
                  {formatCompactVolume(stock.volume)}
                </div>
              </div>
              <div>
                <div className="text-slate-500 dark:text-slate-400">PER / PBV</div>
                <div className="font-mono tabular-nums font-medium text-slate-900 dark:text-slate-100 mt-0.5">
                  {stock.per > 0 ? `${stock.per.toFixed(1)}x` : '—'} / {stock.pbv > 0 ? `${stock.pbv.toFixed(2)}x` : '—'}
                </div>
              </div>
              <div>
                <div className="text-slate-500 dark:text-slate-400">Kapitalisasi Pasar</div>
                <div className="font-mono tabular-nums font-medium text-slate-900 dark:text-slate-100 mt-0.5">
                  {stock.marketCapT > 0 ? `Rp${stock.marketCapT.toLocaleString('id-ID')} T` : '—'}
                </div>
              </div>
            </div>
          </div>

          {/* Fundamental Quick Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 pt-4 text-xs">
            <div>
              <span className="text-slate-500 dark:text-slate-400">ROE</span>
              <div className="font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                {stock.roe !== 0 ? `${stock.roe.toFixed(1)}%` : '—'}
              </div>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400">DER</span>
              <div className="font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                {stock.der > 0 ? `${stock.der.toFixed(2)}x` : '—'}
              </div>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400">Dividen Yield</span>
              <div className="font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                {stock.dividendYield > 0 ? `${stock.dividendYield.toFixed(2)}%` : '0,00%'}
              </div>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400">Pendapatan YoY</span>
              <div
                className={`font-mono tabular-nums font-semibold mt-0.5 ${getChangeColorClass(
                  stock.revenueGrowthYoY
                )}`}
              >
                {stock.revenueGrowthYoY !== 0 ? formatSignedPercent(stock.revenueGrowthYoY) : '—'}
              </div>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400">Laba Bersih YoY</span>
              <div
                className={`font-mono tabular-nums font-semibold mt-0.5 ${getChangeColorClass(
                  stock.netProfitGrowthYoY
                )}`}
              >
                {stock.netProfitGrowthYoY !== 0 ? formatSignedPercent(stock.netProfitGrowthYoY) : '—'}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Candlestick Chart */}
      <CandlestickChart
        ticker={selectedTicker}
        candles={chartData?.candles ?? []}
        range={range}
        onRangeChange={setRange}
        loading={chartLoading}
        relatedNews={relatedNews}
        onSelectNews={handleAnalyzeNewsImpact}
      />

      {/* AI Fundamental Health, Advice & Future Risk Assessment */}
      <AiStockDiagnosisPanel
        ticker={selectedTicker}
        stockName={stock?.name}
        diagnosis={aiDiagnosis}
        loading={aiDiagnosisLoading}
        error={aiDiagnosisError}
        onRunDiagnosis={onRunAiDiagnosis}
      />

      {/* News Impact & Correlation Section */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Berita Terkait & Analisis Dampak ke {selectedTicker}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Hubungkan sentimen berita makro atau sektoral langsung dengan pergerakan harga {selectedTicker}
            </p>
          </div>
        </div>

        {(impactLoading || impactError || impactResult) && (
          <div className="px-6 py-5 bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800">
            {impactLoading ? (
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Menganalisis dampak berita terhadap valuasi & pergerakan {selectedTicker}...
              </p>
            ) : impactError ? (
              <p className="text-xs text-red-700 dark:text-red-400">{impactError}</p>
            ) : impactResult ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    Hasil Analisis Dampak AI — {impactResult.ticker}
                  </span>
                  <span className={`font-mono font-medium ${getSentimentTextClass(impactResult.actionBias)}`}>
                    Bias Dampak: {impactResult.actionBias} · {impactResult.generatedAtWib} WIB
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs leading-relaxed">
                  <div>
                    <div className="font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Katalis Utama
                    </div>
                    <p className="text-slate-600 dark:text-slate-400">{impactResult.catalystSummary}</p>
                  </div>
                  <div>
                    <div className="font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Dampak ke Harga & Valuasi
                    </div>
                    <p className="text-slate-600 dark:text-slate-400">{impactResult.valuationImpact}</p>
                  </div>
                  <div>
                    <div className="font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Risiko yang Perlu Dipantau
                    </div>
                    <p className="text-slate-600 dark:text-slate-400">{impactResult.riskWatch}</p>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        )}

        <div className="divide-y divide-slate-200 dark:divide-slate-800">
          {relatedNews.length === 0 ? (
            <div className="p-6 text-sm text-slate-500 dark:text-slate-400">
              Belum ada berita spesifik yang menyebut {selectedTicker} dalam umpan 24 jam terakhir. Gunakan menu Sentimen Berita untuk menganalisis dampak berita makro terhadap {selectedTicker}.
            </div>
          ) : (
            relatedNews.slice(0, 5).map((art) => (
              <div
                key={art.id}
                className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span className="font-medium text-slate-700 dark:text-slate-300">{art.source}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">{art.pubTimeWib}</span>
                    <span aria-hidden="true">·</span>
                    <span className={`font-medium ${getSentimentTextClass(art.sentiment)}`}>
                      Sentimen: {art.sentiment}
                    </span>
                  </div>
                  <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    {art.title}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleAnalyzeNewsImpact(art)}
                  disabled={impactLoading && activeNewsId === art.id}
                  className="px-3.5 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 hover:border-teal-600 text-slate-800 dark:text-slate-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {impactLoading && activeNewsId === art.id
                    ? 'Menganalisis...'
                    : 'Analisis Dampak AI'}
                </button>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
