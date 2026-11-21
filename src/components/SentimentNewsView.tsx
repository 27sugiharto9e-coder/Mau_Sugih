import { useMemo, useState } from 'react';
import { ArrowUpRight, Search } from 'lucide-react';
import type {
  AiDigestSummary,
  AiNewsImpactResponse,
  NewsArticle,
  NewsFeedResponse,
  SentimentLabel,
} from '../types';
import { getSentimentTextClass } from '../utils/formatters';

interface SentimentNewsViewProps {
  news: NewsFeedResponse | null;
  aiDigest: AiDigestSummary | null;
  initialQuery?: string;
  onSelectStock: (ticker: string) => void;
}

export function SentimentNewsView({
  news,
  aiDigest,
  initialQuery = '',
  onSelectStock,
}: SentimentNewsViewProps) {
  const [sentimentFilter, setSentimentFilter] = useState<'Semua' | SentimentLabel>('Semua');
  const [query, setQuery] = useState(initialQuery);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [impactByArticle, setImpactByArticle] = useState<Record<string, AiNewsImpactResponse>>({});
  const [impactErrors, setImpactErrors] = useState<Record<string, string>>({});

  const sentimentOverrideMap = new Map(
    (aiDigest?.articleSentiments ?? []).map((item) => [item.id, item])
  );

  const enriched = useMemo(() => {
    const articles = news?.articles ?? [];
    return articles.map((art) => {
      const override = sentimentOverrideMap.get(art.id);
      return override
        ? { ...art, sentiment: override.sentiment, emotionDriver: override.driver }
        : art;
    });
  }, [news, aiDigest]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return enriched.filter((art) => {
      if (sentimentFilter !== 'Semua' && art.sentiment !== sentimentFilter) return false;
      if (
        q &&
        !art.title.toLowerCase().includes(q) &&
        !art.summary.toLowerCase().includes(q) &&
        !art.source.toLowerCase().includes(q) &&
        !art.relatedTickers.some((t) => t.toLowerCase().includes(q))
      ) {
        return false;
      }
      return true;
    });
  }, [enriched, sentimentFilter, query]);

  const counts = useMemo(() => {
    let pos = 0;
    let neg = 0;
    let neu = 0;
    for (const a of enriched) {
      if (a.sentiment === 'Positif') pos++;
      else if (a.sentiment === 'Negatif') neg++;
      else neu++;
    }
    return { pos, neg, neu };
  }, [enriched]);

  const handleAnalyzeArticle = async (article: NewsArticle) => {
    const targetTicker = article.relatedTickers[0] ?? 'BBCA';
    setAnalyzingId(article.id);
    setImpactErrors((prev) => {
      const next = { ...prev };
      delete next[article.id];
      return next;
    });

    try {
      const res = await fetch('/api/news/impact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: article.title,
          summary: article.summary,
          ticker: targetTicker,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Gagal menganalisis dampak berita.');
      }
      setImpactByArticle((prev) => ({ ...prev, [article.id]: json as AiNewsImpactResponse }));
    } catch (err) {
      setImpactErrors((prev) => ({
        ...prev,
        [article.id]: err instanceof Error ? err.message : 'Gagal memanggil analisis AI.',
      }));
    } finally {
      setAnalyzingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
            Dampak Berita & Analisis Sentimen Pasar
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Pemantauan sentimen berita ekonomi Indonesia dan korelasinya terhadap saham emiten IDX.
          </p>
        </div>
        <div className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
          Positif: {counts.pos} · Netral: {counts.neu} · Negatif: {counts.neg}
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
          {(['Semua', 'Positif', 'Netral', 'Negatif'] as const).map((label) => (
            <button
              key={label}
              type="button"
              onClick={() => setSentimentFilter(label)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                sentimentFilter === label
                  ? 'bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="relative flex-1 min-w-[240px] max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter topik, sumber, atau kode saham..."
            className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-600"
          />
        </div>
      </div>

      {/* News List */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl divide-y divide-slate-200 dark:divide-slate-800">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
            Tidak ada artikel yang cocok dengan filter sentimen atau kata kunci Anda.
          </div>
        ) : (
          filtered.map((art) => {
            const impact = impactByArticle[art.id];
            const err = impactErrors[art.id];
            const isBusy = analyzingId === art.id;

            return (
              <article key={art.id} className="p-6 space-y-3">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
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
                      <span aria-hidden="true">·</span>
                      <span>{art.sectorTag}</span>
                    </div>

                    <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 leading-snug">
                      <a
                        href={art.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-teal-700 dark:hover:text-teal-400 inline-flex items-center gap-1"
                      >
                        <span>{art.title}</span>
                        <ArrowUpRight className="w-4 h-4 shrink-0 opacity-60" />
                      </a>
                    </h2>

                    <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                      {art.summary}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {art.relatedTickers.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => onSelectStock(t)}
                        className="px-2.5 py-1.5 text-xs font-mono font-medium rounded-md border border-slate-200 dark:border-slate-700 hover:border-teal-600 text-slate-800 dark:text-slate-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        {t}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => handleAnalyzeArticle(art)}
                      disabled={isBusy}
                      className="px-3 py-1.5 text-xs font-medium rounded-md bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:opacity-90 disabled:opacity-60 transition-opacity whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      {isBusy ? 'Menganalisis...' : 'Dampak AI'}
                    </button>
                  </div>
                </div>

                {err && (
                  <div className="p-3 rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50/70 dark:bg-red-950/30 text-xs text-red-700 dark:text-red-400">
                    {err}
                  </div>
                )}

                {impact && (
                  <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        Analisis Dampak ke Emiten{' '}
                        <button
                          type="button"
                          onClick={() => onSelectStock(impact.ticker)}
                          className="font-mono text-teal-700 dark:text-teal-400 underline cursor-pointer"
                        >
                          {impact.ticker}
                        </button>
                      </span>
                      <span className={`font-mono font-medium ${getSentimentTextClass(impact.actionBias)}`}>
                        Bias: {impact.actionBias} · {impact.generatedAtWib} WIB
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1 text-slate-600 dark:text-slate-400">
                      <div>
                        <strong className="text-slate-800 dark:text-slate-200 block mb-0.5">Katalis Utama</strong>
                        {impact.catalystSummary}
                      </div>
                      <div>
                        <strong className="text-slate-800 dark:text-slate-200 block mb-0.5">Dampak Harga & Valuasi</strong>
                        {impact.valuationImpact}
                      </div>
                      <div>
                        <strong className="text-slate-800 dark:text-slate-200 block mb-0.5">Risiko Dipantau</strong>
                        {impact.riskWatch}
                      </div>
                    </div>
                  </div>
                )}
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}
