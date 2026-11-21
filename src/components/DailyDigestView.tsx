import { ArrowUpRight, RefreshCw } from 'lucide-react';
import type {
  AiDigestSummary,
  MarketOverviewResponse,
  NewsArticle,
  NewsFeedResponse,
  SectorCapsResponse,
} from '../types';
import {
  formatCompactVolume,
  formatIdr,
  formatSignedPercent,
  getChangeColorClass,
  getSentimentTextClass,
} from '../utils/formatters';
import { Sparkline } from './Sparkline';
import { SectorPerformancePanel } from './SectorPerformancePanel';
import { SectorMarketCapChart } from './SectorMarketCapChart';

interface DailyDigestViewProps {
  market: MarketOverviewResponse | null;
  news: NewsFeedResponse | null;
  sectorCaps: SectorCapsResponse | null;
  sectorCapsLoading: boolean;
  aiDigest: AiDigestSummary | null;
  aiLoading: boolean;
  aiError: string | null;
  onGenerateAiDigest: () => void;
  onSelectStock: (ticker: string) => void;
  onOpenSentimentTab: (topicFilter?: string) => void;
  onSelectSectorInScreener: (sector: string) => void;
}

export function DailyDigestView({
  market,
  news,
  sectorCaps,
  sectorCapsLoading,
  aiDigest,
  aiLoading,
  aiError,
  onGenerateAiDigest,
  onSelectStock,
  onOpenSentimentTab,
  onSelectSectorInScreener,
}: DailyDigestViewProps) {
  const stocks = market?.stocks ?? [];
  const topGainer = [...stocks]
    .filter((s) => s.isLive)
    .sort((a, b) => b.changePercent - a.changePercent)[0];
  const topVolume = [...stocks]
    .filter((s) => s.isLive)
    .sort((a, b) => b.volume - a.volume)[0];

  const sentimentOverrideMap = new Map(
    (aiDigest?.articleSentiments ?? []).map((item) => [item.id, item])
  );

  const enrichedArticles: NewsArticle[] = (news?.articles ?? []).slice(0, 8).map((art) => {
    const override = sentimentOverrideMap.get(art.id);
    return override
      ? { ...art, sentiment: override.sentiment, emotionDriver: override.driver }
      : art;
  });

  return (
    <div className="space-y-8">
      {/* Page Title & Data Timestamp */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100 text-balance">
            Ringkasan Ekonomi Harian & Denyut IDX
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Sintesis berita makroekonomi Indonesia 24 jam terakhir beserta pergerakan indeks dan emiten likuid Bursa Efek Indonesia.
          </p>
        </div>
        <div className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400 whitespace-nowrap shrink-0">
          {market ? `Data per ${market.fetchedAtWib} WIB` : 'Memuat jadwal pasar...'}
        </div>
      </div>

      {/* 4-Column Market Pulse Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 dark:divide-slate-800">
        {/* IHSG */}
        <div className="p-5 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs text-slate-500 dark:text-slate-400">IHSG (IDX Composite)</div>
            <div className="text-xl font-semibold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-1">
              {market?.benchmarks.ihsg.isLive
                ? formatIdr(market.benchmarks.ihsg.price, 2)
                : '—'}
            </div>
            <div
              className={`text-xs font-mono tabular-nums mt-1 ${getChangeColorClass(
                market?.benchmarks.ihsg.changePercent ?? 0
              )}`}
            >
              {market?.benchmarks.ihsg.isLive
                ? `${formatSignedPercent(market.benchmarks.ihsg.changePercent)} (${
                    market.benchmarks.ihsg.change >= 0 ? 'Naik' : 'Turun'
                  })`
                : 'Menunggu feed pasar'}
            </div>
          </div>
          <Sparkline
            data={market?.benchmarks.ihsg.sparkline ?? []}
            positive={(market?.benchmarks.ihsg.changePercent ?? 0) >= 0}
          />
        </div>

        {/* USD/IDR */}
        <div className="p-5 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs text-slate-500 dark:text-slate-400">Kurs USD / IDR</div>
            <div className="text-xl font-semibold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-1">
              {market?.benchmarks.usdidr.isLive
                ? `Rp${formatIdr(market.benchmarks.usdidr.price, 0)}`
                : '—'}
            </div>
            <div
              className={`text-xs font-mono tabular-nums mt-1 ${getChangeColorClass(
                -(market?.benchmarks.usdidr.changePercent ?? 0)
              )}`}
            >
              {market?.benchmarks.usdidr.isLive
                ? `${formatSignedPercent(market.benchmarks.usdidr.changePercent)} harian`
                : 'Menunggu feed kurs'}
            </div>
          </div>
          <Sparkline
            data={market?.benchmarks.usdidr.sparkline ?? []}
            positive={(market?.benchmarks.usdidr.changePercent ?? 0) <= 0}
          />
        </div>

        {/* Top Gainer IDX */}
        <button
          type="button"
          onClick={() => topGainer && onSelectStock(topGainer.ticker)}
          className="p-5 flex items-center justify-between gap-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
        >
          <div className="min-w-0">
            <div className="text-xs text-slate-500 dark:text-slate-400">Penguatan Tertinggi</div>
            <div className="text-xl font-semibold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-1">
              {topGainer ? `${topGainer.ticker} · Rp${formatIdr(topGainer.price)}` : '—'}
            </div>
            <div
              className={`text-xs font-mono tabular-nums mt-1 ${getChangeColorClass(
                topGainer?.changePercent ?? 0
              )}`}
            >
              {topGainer
                ? `${formatSignedPercent(topGainer.changePercent)} · ${topGainer.sector}`
                : '—'}
            </div>
          </div>
          <Sparkline
            data={topGainer?.sparkline ?? []}
            positive={(topGainer?.changePercent ?? 0) >= 0}
          />
        </button>

        {/* Top Volume IDX */}
        <button
          type="button"
          onClick={() => topVolume && onSelectStock(topVolume.ticker)}
          className="p-5 flex items-center justify-between gap-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
        >
          <div className="min-w-0">
            <div className="text-xs text-slate-500 dark:text-slate-400">Volume Teraktif</div>
            <div className="text-xl font-semibold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-1">
              {topVolume ? `${topVolume.ticker} · ${formatCompactVolume(topVolume.volume)}` : '—'}
            </div>
            <div className="text-xs font-mono tabular-nums text-slate-600 dark:text-slate-400 mt-1">
              {topVolume
                ? `Rp${formatIdr(topVolume.price)} (${formatSignedPercent(topVolume.changePercent)})`
                : '—'}
            </div>
          </div>
          <Sparkline
            data={topVolume?.sparkline ?? []}
            positive={(topVolume?.changePercent ?? 0) >= 0}
          />
        </button>
      </div>

      {/* Real-Time Sector Industry Performance Visualization */}
      <SectorPerformancePanel
        stocks={stocks}
        fetchedAtWib={market?.fetchedAtWib ?? ''}
        onSelectStock={onSelectStock}
        onSelectSectorInScreener={onSelectSectorInScreener}
      />

      {/* Sector Market Cap Dominance Chart (Recharts) */}
      <SectorMarketCapChart
        sectorCaps={sectorCaps}
        fallbackStocks={stocks}
        loading={sectorCapsLoading}
        onSelectStock={onSelectStock}
        onSelectSectorInScreener={onSelectSectorInScreener}
      />

      {/* Main 2-Column Split: AI Executive Summary + Trending Topics 24h */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* AI Executive Briefing */}
        <section className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  Ringkasan Eksekutif Harian
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Sintesis otomatis berita makroekonomi & sentimen saham IDX
                  {aiDigest ? ` · Diperbarui ${aiDigest.generatedAtWib} WIB` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={onGenerateAiDigest}
                disabled={aiLoading}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg bg-teal-700 hover:bg-teal-800 disabled:opacity-60 text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${aiLoading ? 'animate-spin' : ''}`} />
                {aiLoading ? 'Menyusun Ringkasan...' : aiDigest ? 'Perbarui Ringkasan AI' : 'Buat Ringkasan AI'}
              </button>
            </div>

            {aiError && (
              <div className="mt-4 p-4 rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50/70 dark:bg-red-950/30 text-xs text-red-800 dark:text-red-300">
                <strong className="font-semibold">Gagal memproses ringkasan AI:</strong> {aiError}
              </div>
            )}

            {aiDigest ? (
              <div className="mt-5 space-y-5">
                <div className="text-xs font-mono tabular-nums text-slate-600 dark:text-slate-400">
                  Arah Sentimen Pasar:{' '}
                  <strong
                    className={
                      aiDigest.marketBias === 'Bullish'
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : aiDigest.marketBias === 'Bearish'
                        ? 'text-red-700 dark:text-red-400'
                        : 'text-amber-700 dark:text-amber-400'
                    }
                  >
                    {aiDigest.marketBias}
                  </strong>
                  <span aria-hidden="true"> · </span>
                  Sektor Sorotan: <strong className="text-slate-900 dark:text-slate-100">{aiDigest.sectorSpotlight.sector}</strong>
                </div>

                <p className="text-[15px] leading-relaxed text-slate-800 dark:text-slate-200 max-w-prose">
                  {aiDigest.executiveSummary}
                </p>

                <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
                  <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-3">
                    Poin Penting untuk Investor
                  </h3>
                  <ul className="space-y-2.5 text-sm text-slate-700 dark:text-slate-300">
                    {aiDigest.keyTakeaways.map((point, idx) => (
                      <li key={idx} className="flex items-start gap-2.5">
                        <span className="font-mono tabular-nums text-xs text-slate-400 dark:text-slate-500 mt-0.5 shrink-0">
                          0{idx + 1}.
                        </span>
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <div className="py-10 space-y-4">
                <p className="text-sm text-slate-600 dark:text-slate-400 max-w-prose leading-relaxed">
                  Klik tombol <strong>Buat Ringkasan AI</strong> untuk merangkum {news?.articles.length ?? 0} berita ekonomi terbaru dari CNBC Indonesia, Antara Ekonomi, dan Google News IDX menjadi satu briefing eksekutif beserta klasifikasi sentimen tiap artikel.
                </p>
                {news && news.articles.length > 0 && (
                  <div className="pt-3 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
                    Berita utama terdeteksi: <span className="text-slate-800 dark:text-slate-200 font-medium">{news.articles[0].title}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {aiDigest && (
            <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-slate-600 dark:text-slate-400">
                Prospek Sektor: <span className="text-slate-800 dark:text-slate-200">{aiDigest.sectorSpotlight.outlook}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {aiDigest.sectorSpotlight.tickers.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => onSelectStock(t)}
                    className="px-2.5 py-1 text-xs font-mono font-medium rounded-md border border-slate-200 dark:border-slate-700 hover:border-teal-600 text-slate-800 dark:text-slate-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Trending Topics 24h */}
        <section className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  Topik Tren 24 Jam
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Persentase kemunculan topik pada pemberitaan ekonomi Indonesia
                </p>
              </div>
              <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400 shrink-0">
                {news ? `${news.articles.length} berita` : '—'}
              </span>
            </div>

            {news && news.trendingTopics.length > 0 ? (
              <div className="mt-5 space-y-4">
                {news.trendingTopics.slice(0, 6).map((item) => (
                  <div key={item.topic} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => onOpenSentimentTab(item.topic)}
                        className="font-medium text-slate-800 dark:text-slate-200 hover:text-teal-700 dark:hover:text-teal-400 transition-colors text-left cursor-pointer"
                      >
                        {item.topic}
                      </button>
                      <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400 shrink-0">
                        {item.percentage.toFixed(1)}% ({item.count})
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-teal-600 dark:bg-teal-500 rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(100, Math.max(8, item.percentage * 1.4))}%` }}
                      />
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                      <span>Emiten terkait:</span>
                      {item.relatedTickers.slice(0, 4).map((t, i) => (
                        <span key={t} className="inline-flex items-center gap-1">
                          {i > 0 && <span aria-hidden="true">·</span>}
                          <button
                            type="button"
                            onClick={() => onSelectStock(t)}
                            className="font-mono hover:text-teal-700 dark:hover:text-teal-400 underline decoration-slate-300 dark:decoration-slate-700 cursor-pointer"
                          >
                            {t}
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-10 text-sm text-slate-500 dark:text-slate-400">
                Memuat agregasi topik berita ekonomi Indonesia...
              </div>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 flex items-center justify-between gap-2">
            <span>Sumber: {news?.sourcesChecked.join(' · ') || 'RSS Ekonomi Indonesia'}</span>
            <button
              type="button"
              onClick={() => onOpenSentimentTab()}
              className="font-medium text-teal-700 dark:text-teal-400 hover:underline whitespace-nowrap shrink-0 cursor-pointer"
            >
              Semua Sentimen Berita →
            </button>
          </div>
        </section>
      </div>

      {/* Latest News Impact List */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Sorotan Berita & Keterkaitan Saham
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Klik kode saham untuk memeriksa grafik candlestick dan analisis valuasi secara langsung
            </p>
          </div>
          <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400 shrink-0">
            {news ? `Update ${news.fetchedAtWib} WIB` : ''}
          </span>
        </div>

        <div className="divide-y divide-slate-200 dark:divide-slate-800">
          {enrichedArticles.length === 0 ? (
            <div className="p-6 text-sm text-slate-500 dark:text-slate-400">
              Sedang mengambil berita ekonomi terkini...
            </div>
          ) : (
            enrichedArticles.map((art) => (
              <article
                key={art.id}
                className="px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors"
              >
                <div className="space-y-1.5 max-w-3xl">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span className="font-medium text-slate-700 dark:text-slate-300">{art.source}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">{art.pubTimeWib}</span>
                    <span aria-hidden="true">·</span>
                    <span className={`font-medium ${getSentimentTextClass(art.sentiment)}`}>
                      Sentimen: {art.sentiment}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{art.emotionDriver}</span>
                  </div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 leading-snug">
                    <a
                      href={art.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-teal-700 dark:hover:text-teal-400 inline-flex items-center gap-1"
                    >
                      <span>{art.title}</span>
                      <ArrowUpRight className="w-3.5 h-3.5 shrink-0 opacity-60" />
                    </a>
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
                    {art.summary}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {art.relatedTickers.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => onSelectStock(t)}
                      className="px-2.5 py-1.5 text-xs font-mono font-medium rounded-md border border-slate-200 dark:border-slate-700 hover:border-teal-600 hover:text-teal-700 dark:hover:text-teal-400 text-slate-700 dark:text-slate-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
