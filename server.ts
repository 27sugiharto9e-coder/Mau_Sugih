import 'dotenv/config';
import { createHash } from 'crypto';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import Parser from 'rss-parser';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import { IDX_CATALOG } from './server/idxCatalog.ts';
import { computeStockValuationAnalysis } from './src/utils/valuation.ts';
import type {
  AiDigestSummary,
  AiNewsImpactResponse,
  AiStockDiagnosis,
  BenchmarkQuote,
  CandlePoint,
  CompanyBusinessProfile,
  FinancialPeriodRow,
  LiveStockQuote,
  MarketOverviewResponse,
  NewsArticle,
  NewsFeedResponse,
  ScreenerItem,
  ScreenerPageResponse,
  SectorCapEntry,
  SectorCapsResponse,
  SentimentLabel,
  StockChartResponse,
  StockSearchResult,
  TrendingTopic,
} from './src/types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const isProduction = process.env.NODE_ENV === 'production';

const rssParser = new Parser({
  timeout: 8000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; MauSugihBot/1.0)',
    Accept: 'application/rss+xml, application/xml, text/xml',
  },
});

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY belum dikonfigurasi pada server.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function formatWibTime(date = new Date()): string {
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);
}

function formatWibShortDate(date: Date): string {
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

interface YahooChartMeta {
  regularMarketPrice?: number;
  chartPreviousClose?: number;
  previousClose?: number;
  regularMarketDayHigh?: number;
  regularMarketDayLow?: number;
  regularMarketVolume?: number;
  longName?: string;
  shortName?: string;
}

interface YahooChartResult {
  meta?: YahooChartMeta;
  timestamp?: number[];
  indicators?: {
    quote?: Array<{
      open?: Array<number | null>;
      high?: Array<number | null>;
      low?: Array<number | null>;
      close?: Array<number | null>;
      volume?: Array<number | null>;
    }>;
  };
}

async function fetchYahooChart(symbol: string, interval: string, range: string): Promise<YahooChartResult | null> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}`;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(7000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { chart?: { result?: YahooChartResult[] } };
    return json?.chart?.result?.[0] ?? null;
  } catch {
    return null;
  }
}

let yahooAuthCache: { cookie: string; crumb: string; expiresAt: number } | null = null;

async function getYahooAuth(forceRefresh = false): Promise<{ cookie: string; crumb: string } | null> {
  if (!forceRefresh && yahooAuthCache && Date.now() < yahooAuthCache.expiresAt) {
    return yahooAuthCache;
  }
  try {
    const r1 = await fetch('https://fc.yahoo.com', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      signal: AbortSignal.timeout(5000),
    });
    const setCookies = r1.headers.getSetCookie?.() ?? [];
    const cookie = setCookies.map((c) => c.split(';')[0]).join('; ');
    if (!cookie) return null;

    const r2 = await fetch('https://query1.finance.yahoo.com/v1/test/getcrumb', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Cookie: cookie,
      },
      signal: AbortSignal.timeout(5000),
    });
    if (!r2.ok) return null;
    const crumb = (await r2.text()).trim();
    if (!crumb) return null;

    yahooAuthCache = {
      cookie,
      crumb,
      expiresAt: Date.now() + 25 * 60_000,
    };
    return yahooAuthCache;
  } catch {
    return null;
  }
}

function mapYahooSectorToIdx(sector?: string): string {
  const s = (sector ?? '').toLowerCase();
  if (s.includes('financial')) return 'Keuangan';
  if (s.includes('energy')) return 'Energi';
  if (s.includes('basic materials')) return 'Barang Baku';
  if (s.includes('consumer defensive')) return 'Konsumer Primer';
  if (s.includes('consumer cyclical')) return 'Konsumer Siklikal';
  if (s.includes('communication') || s.includes('utilities')) return 'Infrastruktur';
  if (s.includes('industrial')) return 'Perindustrian';
  if (s.includes('technology')) return 'Teknologi';
  if (s.includes('healthcare')) return 'Kesehatan';
  if (s.includes('real estate')) return 'Properti & Real Estat';
  return sector || 'Bursa Efek Indonesia';
}

// In-memory cache to respect upstream rate limits
let marketCache: { data: MarketOverviewResponse; expiresAt: number } | null = null;
const chartCache = new Map<string, { data: StockChartResponse; expiresAt: number }>();
const detailCache = new Map<string, { data: LiveStockQuote; expiresAt: number }>();
const searchCache = new Map<string, { data: StockSearchResult[]; expiresAt: number }>();
let newsCache: { data: NewsFeedResponse; expiresAt: number } | null = null;

async function buildMarketOverview(): Promise<MarketOverviewResponse> {
  if (marketCache && Date.now() < marketCache.expiresAt) {
    return marketCache.data;
  }

  const nowStr = formatWibTime();

  const buildBenchmark = async (symbol: string, label: string): Promise<BenchmarkQuote> => {
    const result = await fetchYahooChart(symbol, '5m', '1d');
    const meta = result?.meta;
    const closes = (result?.indicators?.quote?.[0]?.close ?? []).filter(
      (n): n is number => typeof n === 'number' && Number.isFinite(n)
    );
    const price = meta?.regularMarketPrice ?? closes[closes.length - 1] ?? 0;
    const prev = meta?.chartPreviousClose ?? meta?.previousClose ?? price;
    const change = price - prev;
    const changePercent = prev > 0 ? (change / prev) * 100 : 0;

    return {
      symbol,
      label,
      price,
      previousClose: prev,
      change,
      changePercent,
      dayHigh: meta?.regularMarketDayHigh ?? (closes.length ? Math.max(...closes) : price),
      dayLow: meta?.regularMarketDayLow ?? (closes.length ? Math.min(...closes) : price),
      sparkline: closes.slice(-28),
      isLive: price > 0,
      updatedAtWib: nowStr,
    };
  };

  const [ihsg, usdidr] = await Promise.all([
    buildBenchmark('^JKSE', 'IHSG (IDX Composite)'),
    buildBenchmark('IDR=X', 'USD / IDR'),
  ]);

  // Fetch stocks in controlled batches of 6
  const stocks: LiveStockQuote[] = [];
  const batchSize = 6;
  for (let i = 0; i < IDX_CATALOG.length; i += batchSize) {
    const slice = IDX_CATALOG.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      slice.map(async (item): Promise<LiveStockQuote> => {
        const symbol = `${item.ticker}.JK`;
        const result = await fetchYahooChart(symbol, '15m', '1d');
        const meta = result?.meta;
        const quote = result?.indicators?.quote?.[0];
        const closes = (quote?.close ?? []).filter(
          (n): n is number => typeof n === 'number' && Number.isFinite(n)
        );
        const volumes = (quote?.volume ?? []).filter(
          (n): n is number => typeof n === 'number' && Number.isFinite(n)
        );

        const price = meta?.regularMarketPrice ?? closes[closes.length - 1] ?? 0;
        const previousClose = meta?.chartPreviousClose ?? meta?.previousClose ?? price;
        const change = price - previousClose;
        const changePercent = previousClose > 0 ? (change / previousClose) * 100 : 0;
        const volume =
          meta?.regularMarketVolume ?? volumes.reduce((acc, v) => acc + v, 0);

        const per = item.epsTtm > 0 && price > 0 ? Number((price / item.epsTtm).toFixed(2)) : 0;
        const pbv = item.bvps > 0 && price > 0 ? Number((price / item.bvps).toFixed(2)) : 0;
        const dividendYield =
          item.dps > 0 && price > 0 ? Number(((item.dps / price) * 100).toFixed(2)) : 0;
        const marketCapT =
          price > 0 ? Number(((price * item.sharesOutstandingB) / 1000).toFixed(1)) : 0;

        return {
          ...item,
          symbol,
          price,
          previousClose,
          change,
          changePercent,
          dayHigh: meta?.regularMarketDayHigh ?? (closes.length ? Math.max(...closes) : price),
          dayLow: meta?.regularMarketDayLow ?? (closes.length ? Math.min(...closes) : price),
          volume,
          per,
          pbv,
          dividendYield,
          marketCapT,
          sparkline: closes.slice(-24),
          isLive: price > 0,
          sourceLabel: price > 0 ? 'Yahoo Finance IDX' : 'Tidak Tersedia',
          updatedAtWib: nowStr,
        };
      })
    );
    stocks.push(...batchResults);
  }

  const response: MarketOverviewResponse = {
    benchmarks: { ihsg, usdidr },
    stocks,
    fetchedAtWib: nowStr,
    sourceNote: 'Harga pasar dari Yahoo Finance IDX (.JK); laporan keuangan bersumber dari rilis kuartalan emiten (End-of-Day).',
  };

  marketCache = {
    data: response,
    expiresAt: Date.now() + 20_000,
  };

  return response;
}

async function searchIdxStocks(rawQuery: string): Promise<StockSearchResult[]> {
  const q = rawQuery.trim();
  if (!q) {
    return IDX_CATALOG.map((item) => ({
      ticker: item.ticker,
      symbol: `${item.ticker}.JK`,
      name: item.name,
      exchange: 'IDX',
      inCatalog: true,
    }));
  }

  const cacheKey = q.toLowerCase();
  const cached = searchCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.data;
  }

  const resultsMap = new Map<string, StockSearchResult>();

  // 1. Local catalog matches first
  for (const item of IDX_CATALOG) {
    if (
      item.ticker.toLowerCase().includes(cacheKey) ||
      item.name.toLowerCase().includes(cacheKey) ||
      item.sector.toLowerCase().includes(cacheKey)
    ) {
      resultsMap.set(item.ticker, {
        ticker: item.ticker,
        symbol: `${item.ticker}.JK`,
        name: item.name,
        exchange: 'IDX',
        inCatalog: true,
      });
    }
  }

  // 2. Live Yahoo Finance Search across all 900+ .JK stocks
  const searchQueries = [q];
  if (/^[a-zA-Z]{2,5}$/.test(q) && !q.toLowerCase().endsWith('.jk')) {
    searchQueries.push(`${q.toUpperCase()}.JK`);
  }

  await Promise.all(
    searchQueries.map(async (sq) => {
      try {
        const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(sq)}&quotesCount=15&newsCount=0&region=ID`;
        const res = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
          signal: AbortSignal.timeout(5000),
        });
        if (!res.ok) return;
        const json = (await res.json()) as {
          quotes?: Array<{
            symbol?: string;
            shortname?: string;
            longname?: string;
            exchange?: string;
            quoteType?: string;
          }>;
        };
        for (const qt of json.quotes ?? []) {
          const sym = qt.symbol ?? '';
          if (!sym.endsWith('.JK')) continue;
          const ticker = sym.replace('.JK', '').toUpperCase();
          if (!resultsMap.has(ticker)) {
            resultsMap.set(ticker, {
              ticker,
              symbol: sym,
              name: qt.longname || qt.shortname || `Emiten ${ticker}`,
              exchange: 'IDX',
              inCatalog: false,
            });
          }
        }
      } catch {
        // Continue gracefully
      }
    })
  );

  // 3. Direct 4-letter IDX ticker fallback if user typed a valid ticker code
  const cleanCode = q.toUpperCase().replace('.JK', '');
  if (/^[A-Z]{4}$/.test(cleanCode) && !resultsMap.has(cleanCode)) {
    resultsMap.set(cleanCode, {
      ticker: cleanCode,
      symbol: `${cleanCode}.JK`,
      name: `Cari langsung emiten ${cleanCode} di IDX`,
      exchange: 'IDX',
      inCatalog: false,
    });
  }

  const finalList = Array.from(resultsMap.values()).slice(0, 15);
  searchCache.set(cacheKey, { data: finalList, expiresAt: Date.now() + 300_000 });
  return finalList;
}

function formatQuarterLabel(isoOrEpoch: string | number): string {
  const d = typeof isoOrEpoch === 'number' ? new Date(isoOrEpoch * 1000) : new Date(isoOrEpoch);
  if (Number.isNaN(d.getTime())) return String(isoOrEpoch);
  const q = Math.floor(d.getUTCMonth() / 3) + 1;
  return `Q${q} ${d.getUTCFullYear()}`;
}

async function fetchDynamicStockDetail(rawTicker: string): Promise<LiveStockQuote> {
  const ticker = rawTicker.toUpperCase().replace('.JK', '').trim();
  const cached = detailCache.get(ticker);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.data;
  }

  const nowStr = formatWibTime();
  const symbol = `${ticker}.JK`;
  const catalogItem = IDX_CATALOG.find((c) => c.ticker === ticker);

  // Always fetch live chart quote
  const chartRes = await fetchYahooChart(symbol, '15m', '1d');
  const meta = chartRes?.meta;
  const quoteSeries = chartRes?.indicators?.quote?.[0];
  const closes = (quoteSeries?.close ?? []).filter(
    (n): n is number => typeof n === 'number' && Number.isFinite(n)
  );
  const volumes = (quoteSeries?.volume ?? []).filter(
    (n): n is number => typeof n === 'number' && Number.isFinite(n)
  );

  const price = meta?.regularMarketPrice ?? closes[closes.length - 1] ?? 0;
  const previousClose = meta?.chartPreviousClose ?? meta?.previousClose ?? price;
  const change = price - previousClose;
  const changePercent = previousClose > 0 ? (change / previousClose) * 100 : 0;
  const volume = meta?.regularMarketVolume ?? volumes.reduce((acc, v) => acc + v, 0);

  if (catalogItem) {
    const per = catalogItem.epsTtm > 0 && price > 0 ? Number((price / catalogItem.epsTtm).toFixed(2)) : 0;
    const pbv = catalogItem.bvps > 0 && price > 0 ? Number((price / catalogItem.bvps).toFixed(2)) : 0;
    const dividendYield =
      catalogItem.dps > 0 && price > 0 ? Number(((catalogItem.dps / price) * 100).toFixed(2)) : 0;
    const marketCapT =
      price > 0 ? Number(((price * catalogItem.sharesOutstandingB) / 1000).toFixed(1)) : 0;

    const result: LiveStockQuote = {
      ...catalogItem,
      symbol,
      price,
      previousClose,
      change,
      changePercent,
      dayHigh: meta?.regularMarketDayHigh ?? (closes.length ? Math.max(...closes) : price),
      dayLow: meta?.regularMarketDayLow ?? (closes.length ? Math.min(...closes) : price),
      volume,
      per,
      pbv,
      dividendYield,
      marketCapT,
      sparkline: closes.slice(-24),
      isLive: price > 0,
      sourceLabel: price > 0 ? 'Yahoo Finance IDX' : 'Tidak Tersedia',
      updatedAtWib: nowStr,
    };
    detailCache.set(ticker, { data: result, expiresAt: Date.now() + 30_000 });
    return result;
  }

  // Dynamic fetch for ANY IDX stock outside the default 16 catalog
  let auth = await getYahooAuth();
  let summaryData: Record<string, any> | null = null;

  const fetchSummary = async (authPair: { cookie: string; crumb: string }) => {
    const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=price,summaryDetail,defaultKeyStatistics,financialData,assetProfile&crumb=${encodeURIComponent(authPair.crumb)}`;
    return fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Cookie: authPair.cookie,
      },
      signal: AbortSignal.timeout(7000),
    });
  };

  if (auth) {
    let r = await fetchSummary(auth);
    if (r.status === 401) {
      auth = await getYahooAuth(true);
      if (auth) r = await fetchSummary(auth);
    }
    if (r.ok) {
      const json = (await r.json()) as { quoteSummary?: { result?: Array<Record<string, any>> } };
      summaryData = json?.quoteSummary?.result?.[0] ?? null;
    }
  }

  // Fetch quarterly + 5-year annual fundamentals-timeseries (no crumb required)
  const period1 = Math.floor(Date.now() / 1000) - 60 * 60 * 24 * 365 * 5.5;
  const period2 = Math.floor(Date.now() / 1000) + 86400;
  const tsTypes = [
    'quarterlyTotalRevenue',
    'quarterlyGrossProfit',
    'quarterlyOperatingIncome',
    'quarterlyNetIncome',
    'quarterlyTotalAssets',
    'quarterlyTotalLiabilitiesNetMinorityInterest',
    'quarterlyStockholdersEquity',
    'quarterlyCashAndCashEquivalents',
    'quarterlyOperatingCashFlow',
    'quarterlyCashFlowFromContinuingOperatingActivities',
    'quarterlyCapitalExpenditure',
    'quarterlyFreeCashFlow',
    'annualTotalRevenue',
    'annualGrossProfit',
    'annualOperatingIncome',
    'annualNetIncome',
    'annualTotalAssets',
    'annualTotalLiabilitiesNetMinorityInterest',
    'annualStockholdersEquity',
    'annualCashAndCashEquivalents',
    'annualOperatingCashFlow',
    'annualCashFlowFromContinuingOperatingActivities',
    'annualCapitalExpenditure',
    'annualFreeCashFlow',
  ].join(',');

  const usdIdrMultiplier =
    marketCache?.data?.benchmarks?.usdidr?.price && marketCache.data.benchmarks.usdidr.price > 10000
      ? marketCache.data.benchmarks.usdidr.price
      : 16000;

  const periodMap = new Map<string, FinancialPeriodRow>();
  const annualMap = new Map<string, FinancialPeriodRow>();
  try {
    const tsRes = await fetch(
      `https://query1.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries/${encodeURIComponent(symbol)}?type=${tsTypes}&period1=${period1}&period2=${period2}`,
      {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        signal: AbortSignal.timeout(7000),
      }
    );
    if (tsRes.ok) {
      const tsJson = (await tsRes.json()) as {
        timeseries?: { result?: Array<Record<string, any>> };
      };
      for (const series of tsJson.timeseries?.result ?? []) {
        const typeKey = series?.meta?.type?.[0] as string | undefined;
        if (!typeKey || !Array.isArray(series[typeKey])) continue;
        const isAnnual = typeKey.startsWith('annual');
        const targetMap = isAnnual ? annualMap : periodMap;

        for (const entry of series[typeKey]) {
          const asOf = entry?.asOfDate as string | undefined;
          const rawVal = entry?.reportedValue?.raw as number | undefined;
          if (!asOf || typeof rawVal !== 'number' || !Number.isFinite(rawVal)) continue;

          const mapKey = isAnnual ? asOf.slice(0, 4) : asOf;
          const label = isAnnual ? `FY ${asOf.slice(0, 4)}` : formatQuarterLabel(asOf);
          const row = targetMap.get(mapKey) ?? {
            period: label,
            revenueB: null,
            grossProfitB: null,
            operatingIncomeB: null,
            netIncomeB: null,
            totalAssetsB: null,
            totalLiabilitiesB: null,
            totalEquityB: null,
            cashAndEquivalentsB: null,
            operatingCashFlowB: null,
            capexB: null,
            freeCashFlowB: null,
          };

          const currencyMult = entry?.currencyCode === 'USD' ? usdIdrMultiplier : 1;
          const valB = Math.round((rawVal * currencyMult) / 1e9);
          const baseKey = typeKey.replace(/^(quarterly|annual)/, '');

          if (baseKey === 'TotalRevenue') row.revenueB = valB;
          else if (baseKey === 'GrossProfit') row.grossProfitB = valB;
          else if (baseKey === 'OperatingIncome') row.operatingIncomeB = valB;
          else if (baseKey === 'NetIncome') row.netIncomeB = valB;
          else if (baseKey === 'TotalAssets') row.totalAssetsB = valB;
          else if (baseKey === 'TotalLiabilitiesNetMinorityInterest') row.totalLiabilitiesB = valB;
          else if (baseKey === 'StockholdersEquity') row.totalEquityB = valB;
          else if (baseKey === 'CashAndCashEquivalents') row.cashAndEquivalentsB = valB;
          else if (
            baseKey === 'OperatingCashFlow' ||
            baseKey === 'CashFlowFromContinuingOperatingActivities'
          ) {
            row.operatingCashFlowB = row.operatingCashFlowB ?? valB;
          } else if (baseKey === 'CapitalExpenditure') {
            row.capexB = Math.abs(valB);
          } else if (baseKey === 'FreeCashFlow') {
            row.freeCashFlowB = valB;
          }

          targetMap.set(mapKey, row);
        }
      }
    }
  } catch {
    // Gracefully fallback to summary metrics if timeseries is unavailable
  }

  const sortedFinancials = Array.from(periodMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-4)
    .map(([, row]) => row);

  const sortedAnnualFinancials = Array.from(annualMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-5)
    .map(([, row]) => row);

  const priceBlock = summaryData?.price;
  const summaryDetail = summaryData?.summaryDetail;
  const keyStats = summaryData?.defaultKeyStatistics;
  const finData = summaryData?.financialData;
  const profile = summaryData?.assetProfile;

  const effectivePrice = price || priceBlock?.regularMarketPrice?.raw || 0;
  const effectivePrev = previousClose || priceBlock?.regularMarketPreviousClose?.raw || effectivePrice;
  const epsTtm = Number((keyStats?.trailingEps?.raw ?? 0).toFixed(2));
  const bvps = Number((keyStats?.bookValue?.raw ?? 0).toFixed(2));
  const rawDps = summaryDetail?.dividendRate?.raw ?? 0;
  const rawYield = summaryDetail?.dividendYield?.raw ?? 0;
  const dps =
    rawDps > 0
      ? Number(rawDps.toFixed(2))
      : rawYield > 0 && effectivePrice > 0
      ? Number((rawYield * effectivePrice).toFixed(2))
      : 0;
  const per =
    summaryDetail?.trailingPE?.raw
      ? Number(summaryDetail.trailingPE.raw.toFixed(2))
      : epsTtm > 0 && effectivePrice > 0
      ? Number((effectivePrice / epsTtm).toFixed(2))
      : 0;
  const pbv =
    keyStats?.priceToBook?.raw
      ? Number(keyStats.priceToBook.raw.toFixed(2))
      : bvps > 0 && effectivePrice > 0
      ? Number((effectivePrice / bvps).toFixed(2))
      : 0;
  const dividendYield =
    dps > 0 && effectivePrice > 0
      ? Number(((dps / effectivePrice) * 100).toFixed(2))
      : rawYield > 0
      ? Number((rawYield * 100).toFixed(2))
      : 0;
  const roe = finData?.returnOnEquity?.raw ? Number((finData.returnOnEquity.raw * 100).toFixed(1)) : 0;
  const der = finData?.debtToEquity?.raw ? Number((finData.debtToEquity.raw / 100).toFixed(2)) : 0;
  const revenueGrowthYoY = finData?.revenueGrowth?.raw
    ? Number((finData.revenueGrowth.raw * 100).toFixed(1))
    : 0;
  const netProfitGrowthYoY = finData?.earningsGrowth?.raw
    ? Number((finData.earningsGrowth.raw * 100).toFixed(1))
    : 0;
  const sharesB = keyStats?.sharesOutstanding?.raw
    ? Number((keyStats.sharesOutstanding.raw / 1e9).toFixed(2))
    : 0;
  const marketCapRaw = summaryDetail?.marketCap?.raw ?? priceBlock?.marketCap?.raw ?? 0;
  const marketCapT =
    marketCapRaw > 0
      ? Number((marketCapRaw / 1e12).toFixed(1))
      : effectivePrice > 0 && sharesB > 0
      ? Number(((effectivePrice * sharesB) / 1000).toFixed(1))
      : 0;

  const companyName =
    meta?.longName ||
    priceBlock?.longName ||
    priceBlock?.shortName ||
    meta?.shortName ||
    `Emiten ${ticker} Tbk`;

  const mappedSector = mapYahooSectorToIdx(profile?.sector);
  const mappedSubsector = profile?.industry || 'Bursa Efek Indonesia';
  const rawBizSummary =
    typeof profile?.longBusinessSummary === 'string' && profile.longBusinessSummary.trim().length > 0
      ? profile.longBusinessSummary.trim()
      : undefined;

  const cachedBizProfile = businessProfileCache.get(ticker);
  const validBizProfile =
    cachedBizProfile && Date.now() < cachedBizProfile.expiresAt ? cachedBizProfile.data : undefined;

  const buildAnnualGrowthSummary = (): string => {
    const revRows = sortedAnnualFinancials.filter((r) => r.revenueB !== null);
    const niRows = sortedAnnualFinancials.filter((r) => r.netIncomeB !== null);
    if (revRows.length < 2) {
      return `Data historis tahunan 3–5 tahun untuk ${ticker} belum lengkap pada umpan bursa; pantau pertumbuhan YoY terkini sebesar ${revenueGrowthYoY.toFixed(1)}%.`;
    }
    const firstRev = revRows[0];
    const lastRev = revRows[revRows.length - 1];
    const revChg =
      firstRev.revenueB && firstRev.revenueB > 0 && lastRev.revenueB !== null
        ? ((lastRev.revenueB - firstRev.revenueB) / firstRev.revenueB) * 100
        : null;
    const firstNi = niRows[0];
    const lastNi = niRows[niRows.length - 1];
    const niText =
      firstNi && lastNi && firstNi.netIncomeB !== null && lastNi.netIncomeB !== null
        ? `, sedangkan laba bersih bergerak dari Rp${firstNi.netIncomeB.toLocaleString('id-ID')} M menjadi Rp${lastNi.netIncomeB.toLocaleString('id-ID')} M`
        : '';
    return `Sepanjang ${firstRev.period}–${lastRev.period}, pendapatan usaha ${ticker} tercatat ${
      revChg !== null ? `${revChg >= 0 ? 'tumbuh +' : 'terkoreksi '}${revChg.toFixed(1)}%` : 'berubah'
    } dari Rp${(firstRev.revenueB ?? 0).toLocaleString('id-ID')} M menjadi Rp${(lastRev.revenueB ?? 0).toLocaleString('id-ID')} M${niText}.`;
  };

  const fallbackBizProfile: CompanyBusinessProfile = validBizProfile ?? {
    businessModel: `${companyName} beroperasi pada sektor ${mappedSector} (subsektor ${mappedSubsector}) di Bursa Efek Indonesia.`,
    profitDrivers: [
      `Pendapatan usaha utama berasal dari aktivitas inti pada bidang ${mappedSubsector}.`,
      'Efisiensi margin operasional dan pengelolaan struktur modal terhadap beban bunga.',
    ],
    productsAndServices: [
      `Produk dan layanan utama di segmen ${mappedSubsector}`,
    ],
    growth3to5YOverview: buildAnnualGrowthSummary(),
    longBusinessSummaryRaw: rawBizSummary,
  };

  const result: LiveStockQuote = {
    ticker,
    symbol,
    name: companyName,
    sector: mappedSector,
    subsector: mappedSubsector,
    epsTtm,
    bvps,
    dps,
    roe,
    der,
    revenueGrowthYoY,
    netProfitGrowthYoY,
    sharesOutstandingB: sharesB,
    reportPeriodLabel: sortedFinancials.length
      ? `${sortedFinancials[sortedFinancials.length - 1].period} (Yahoo IDX Fundamentals)`
      : 'Data Pasar Terkini (Yahoo Finance)',
    keywords: [ticker.toLowerCase(), companyName.toLowerCase()],
    financials: sortedFinancials,
    annualFinancials: sortedAnnualFinancials,
    businessProfile: fallbackBizProfile,
    price: effectivePrice,
    previousClose: effectivePrev,
    change: effectivePrice - effectivePrev,
    changePercent: effectivePrev > 0 ? ((effectivePrice - effectivePrev) / effectivePrev) * 100 : 0,
    dayHigh: meta?.regularMarketDayHigh ?? (closes.length ? Math.max(...closes) : effectivePrice),
    dayLow: meta?.regularMarketDayLow ?? (closes.length ? Math.min(...closes) : effectivePrice),
    volume,
    per,
    pbv,
    dividendYield,
    marketCapT,
    sparkline: closes.slice(-24),
    isLive: effectivePrice > 0,
    sourceLabel: effectivePrice > 0 ? 'Yahoo Finance IDX' : 'Ticker Tidak Ditemukan',
    updatedAtWib: nowStr,
  };

  detailCache.set(ticker, { data: result, expiresAt: Date.now() + 45_000 });
  return result;
}

function computeSMA(values: number[], period: number, index: number): number | null {
  if (index + 1 < period) return null;
  let sum = 0;
  for (let i = index - period + 1; i <= index; i++) {
    sum += values[i];
  }
  return Number((sum / period).toFixed(2));
}

function computeRSI(values: number[], period = 14): Array<number | null> {
  const result: Array<number | null> = new Array(values.length).fill(null);
  if (values.length <= period) return result;

  let gainSum = 0;
  let lossSum = 0;
  for (let i = 1; i <= period; i++) {
    const diff = values[i] - values[i - 1];
    if (diff >= 0) gainSum += diff;
    else lossSum += Math.abs(diff);
  }

  let avgGain = gainSum / period;
  let avgLoss = lossSum / period;
  result[period] = avgLoss === 0 ? 100 : Number((100 - 100 / (1 + avgGain / avgLoss)).toFixed(2));

  for (let i = period + 1; i < values.length; i++) {
    const diff = values[i] - values[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    result[i] = avgLoss === 0 ? 100 : Number((100 - 100 / (1 + avgGain / avgLoss)).toFixed(2));
  }

  return result;
}

async function fetchStockChart(ticker: string, rangeKey: string): Promise<StockChartResponse> {
  const cleanTicker = ticker.toUpperCase().replace('.JK', '');
  const cacheKey = `${cleanTicker}:${rangeKey}`;
  const cached = chartCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.data;
  }

  const symbol = cleanTicker === 'IHSG' || cleanTicker === '^JKSE' ? '^JKSE' : `${cleanTicker}.JK`;
  const rangeMap: Record<string, { interval: string; range: string }> = {
    '1d': { interval: '5m', range: '1d' },
    '5d': { interval: '30m', range: '5d' },
    '1mo': { interval: '1d', range: '1mo' },
    '3mo': { interval: '1d', range: '3mo' },
    '1y': { interval: '1d', range: '1y' },
  };
  const cfg = rangeMap[rangeKey] ?? rangeMap['3mo'];

  const raw = await fetchYahooChart(symbol, cfg.interval, cfg.range);
  const timestamps = raw?.timestamp ?? [];
  const quote = raw?.indicators?.quote?.[0];

  const validPoints: Array<{
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }> = [];

  for (let i = 0; i < timestamps.length; i++) {
    const o = quote?.open?.[i];
    const h = quote?.high?.[i];
    const l = quote?.low?.[i];
    const c = quote?.close?.[i];
    const v = quote?.volume?.[i] ?? 0;
    if (
      typeof o === 'number' &&
      typeof h === 'number' &&
      typeof l === 'number' &&
      typeof c === 'number' &&
      Number.isFinite(o) &&
      Number.isFinite(c)
    ) {
      validPoints.push({
        time: timestamps[i] * 1000,
        open: o,
        high: h,
        low: l,
        close: c,
        volume: typeof v === 'number' && Number.isFinite(v) ? v : 0,
      });
    }
  }

  const closes = validPoints.map((p) => p.close);
  const rsiSeries = computeRSI(closes, 14);
  const isIntraday = rangeKey === '1d' || rangeKey === '5d';

  const candles: CandlePoint[] = validPoints.map((p, idx) => {
    const d = new Date(p.time);
    const dateLabel = isIntraday
      ? new Intl.DateTimeFormat('id-ID', {
          timeZone: 'Asia/Jakarta',
          day: '2-digit',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }).format(d)
      : new Intl.DateTimeFormat('id-ID', {
          timeZone: 'Asia/Jakarta',
          day: '2-digit',
          month: 'short',
          year: '2-digit',
        }).format(d);

    return {
      time: p.time,
      dateLabel,
      open: Number(p.open.toFixed(2)),
      high: Number(p.high.toFixed(2)),
      low: Number(p.low.toFixed(2)),
      close: Number(p.close.toFixed(2)),
      volume: p.volume,
      ma20: computeSMA(closes, 20, idx),
      ma50: computeSMA(closes, 50, idx),
      rsi14: rsiSeries[idx],
    };
  });

  const payload: StockChartResponse = {
    ticker: cleanTicker,
    range: rangeKey,
    candles,
    isLive: candles.length > 0,
    fetchedAtWib: formatWibTime(),
  };

  chartCache.set(cacheKey, { data: payload, expiresAt: Date.now() + 30_000 });
  return payload;
}

const TOPIC_LEXICON: Array<{ topic: string; patterns: string[]; tickers: string[] }> = [
  { topic: 'IHSG & Bursa', patterns: ['ihsg', 'bursa', 'bei', 'idx', 'indeks'], tickers: ['BBCA', 'BBRI', 'BMRI', 'TLKM'] },
  { topic: 'Nilai Tukar Rupiah', patterns: ['rupiah', 'kurs', 'dolar', 'usd', 'valas'], tickers: ['BBCA', 'ICBP', 'KLBF', 'ASII'] },
  { topic: 'Suku Bunga & BI', patterns: ['bank indonesia', 'bi rate', 'suku bunga', 'the fed', 'moneter'], tickers: ['BBCA', 'BBRI', 'BMRI', 'BBNI'] },
  { topic: 'Perbankan & Kredit', patterns: ['bank', 'perbankan', 'kredit', 'laba bank', 'likuiditas'], tickers: ['BBCA', 'BBRI', 'BMRI', 'BBNI'] },
  { topic: 'Komoditas & Emas', patterns: ['emas', 'nikel', 'tembaga', 'komoditas', 'tambang', 'smelter'], tickers: ['ANTM', 'AMMN', 'MDKA'] },
  { topic: 'Energi & Batu Bara', patterns: ['batu bara', 'energi', 'migas', 'minyak', 'geotermal', 'listrik'], tickers: ['ADRO', 'UNTR', 'BREN'] },
  { topic: 'Inflasi & Konsumsi', patterns: ['inflasi', 'pangan', 'daya beli', 'konsumsi', 'ritel'], tickers: ['ICBP', 'INDF', 'ASII'] },
  { topic: 'Digital & Telco', patterns: ['telkom', 'digital', 'teknologi', 'data center', 'fintech', 'ai'], tickers: ['TLKM', 'GOTO'] },
];

function classifyBaselineSentiment(text: string): { sentiment: SentimentLabel; driver: string } {
  const lower = text.toLowerCase();
  const positiveWords = ['naik', 'menguat', 'rekor', 'melonjak', 'laba', 'surplus', 'tumbuh', 'optimis', 'dividen', 'ekspansi', 'rebound', 'positif', 'melesat', 'cuan'];
  const negativeWords = ['turun', 'melemah', 'anjlok', 'koreksi', 'tekanan', 'defisit', 'rugi', 'inflasi naik', 'lesu', 'merosot', 'ambruk', 'risiko', 'waspada', 'negatif'];

  let score = 0;
  for (const w of positiveWords) {
    if (lower.includes(w)) score += 1;
  }
  for (const w of negativeWords) {
    if (lower.includes(w)) score -= 1;
  }

  if (score > 0) return { sentiment: 'Positif', driver: 'Momentum Katalis Positif' };
  if (score < 0) return { sentiment: 'Negatif', driver: 'Tekanan & Risiko Pasar' };
  return { sentiment: 'Netral', driver: 'Konsolidasi & Pemantauan' };
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchIndonesianEconomicNews(): Promise<NewsFeedResponse> {
  if (newsCache && Date.now() < newsCache.expiresAt) {
    return newsCache.data;
  }

  const sources = [
    { name: 'CNBC Indonesia', url: 'https://www.cnbcindonesia.com/market/rss' },
    { name: 'Antara Ekonomi', url: 'https://www.antaranews.com/rss/ekonomi.xml' },
    {
      name: 'Google News IDX',
      url: 'https://news.google.com/rss/search?q=IHSG+OR+saham+IDX+OR+Bank+Indonesia+when:2d&hl=id&gl=ID&ceid=ID:id',
    },
  ];

  const collected: NewsArticle[] = [];
  const activeSources: string[] = [];

  await Promise.all(
    sources.map(async (src) => {
      try {
        const feed = await rssParser.parseURL(src.url);
        activeSources.push(src.name);
        for (const item of (feed.items ?? []).slice(0, 12)) {
          const title = stripHtml(item.title ?? '');
          if (!title) continue;
          const summaryRaw = stripHtml(item.contentSnippet ?? item.content ?? '');
          const summary =
            summaryRaw.length > 210 ? `${summaryRaw.slice(0, 207)}...` : summaryRaw || title;

          const combined = `${title} ${summary}`.toLowerCase();
          const matchedTickers = new Set<string>();
          let sectorTag = 'Makroekonomi';

          for (const stock of IDX_CATALOG) {
            if (
              combined.includes(stock.ticker.toLowerCase()) ||
              stock.keywords.some((kw) => combined.includes(kw))
            ) {
              matchedTickers.add(stock.ticker);
              sectorTag = stock.sector;
            }
          }

          if (matchedTickers.size === 0) {
            for (const entry of TOPIC_LEXICON) {
              if (entry.patterns.some((p) => combined.includes(p))) {
                entry.tickers.slice(0, 2).forEach((t) => matchedTickers.add(t));
              }
            }
          }

          const { sentiment, driver } = classifyBaselineSentiment(combined);
          const pubDateObj = item.pubDate ? new Date(item.pubDate) : new Date();
          const safeDate = Number.isNaN(pubDateObj.getTime()) ? new Date() : pubDateObj;

          const uniqueSeed = `${src.name}:${item.link ?? ''}:${title}`;
          const articleId = createHash('sha256')
            .update(uniqueSeed)
            .digest('base64url')
            .slice(0, 16);

          collected.push({
            id: articleId,
            title,
            summary,
            source: src.name,
            link: item.link ?? '#',
            pubDate: safeDate.toISOString(),
            pubTimeWib: `${formatWibShortDate(safeDate)} WIB`,
            sentiment,
            emotionDriver: driver,
            relatedTickers: Array.from(matchedTickers).slice(0, 4),
            sectorTag,
          });
        }
      } catch {
        // Skip source if unreachable, continue with other feeds
      }
    })
  );

  // Deduplicate by normalized title and ID, and sort newest first
  const seenTitles = new Set<string>();
  const seenIds = new Set<string>();
  const uniqueArticles = collected
    .sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime())
    .filter((art) => {
      const titleKey = art.title.toLowerCase().slice(0, 55);
      if (seenTitles.has(titleKey) || seenIds.has(art.id)) return false;
      seenTitles.add(titleKey);
      seenIds.add(art.id);
      return true;
    })
    .slice(0, 24);

  // Compute Trending Topics 24h percentage
  const total = Math.max(uniqueArticles.length, 1);
  const trendingTopics: TrendingTopic[] = TOPIC_LEXICON.map((entry) => {
    const count = uniqueArticles.filter((art) => {
      const hay = `${art.title} ${art.summary}`.toLowerCase();
      return entry.patterns.some((p) => hay.includes(p));
    }).length;
    return {
      topic: entry.topic,
      count,
      percentage: Number(((count / total) * 100).toFixed(1)),
      relatedTickers: entry.tickers,
    };
  })
    .filter((t) => t.count > 0)
    .sort((a, b) => b.count - a.count);

  const response: NewsFeedResponse = {
    articles: uniqueArticles,
    trendingTopics,
    fetchedAtWib: formatWibTime(),
    sourcesChecked: activeSources,
  };

  newsCache = {
    data: response,
    expiresAt: Date.now() + 120_000,
  };

  return response;
}

const app = express();
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, timeWib: formatWibTime() });
});

app.get('/api/market/overview', async (_req, res) => {
  try {
    const data = await buildMarketOverview();
    res.json(data);
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Gagal mengambil data pasar IDX.',
    });
  }
});

app.get('/api/market/stream', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  let active = true;
  req.on('close', () => {
    active = false;
  });

  const pushSnapshot = async () => {
    if (!active) return;
    try {
      const overview = await buildMarketOverview();
      res.write(`data: ${JSON.stringify(overview)}\n\n`);
    } catch {
      // Keep stream alive
    }
  };

  await pushSnapshot();
  const intervalId = setInterval(pushSnapshot, 15_000);

  req.on('close', () => {
    clearInterval(intervalId);
  });
});

const screenerCache = new Map<string, { data: ScreenerPageResponse; expiresAt: number }>();

const IDX_TO_YAHOO_SECTOR: Record<string, string[]> = {
  Keuangan: ['Financial Services'],
  Energi: ['Energy'],
  'Barang Baku': ['Basic Materials'],
  'Konsumer Primer': ['Consumer Defensive'],
  'Konsumer Siklikal': ['Consumer Cyclical'],
  Infrastruktur: ['Communication Services', 'Utilities'],
  Perindustrian: ['Industrials'],
  Teknologi: ['Technology'],
  Kesehatan: ['Healthcare'],
  'Properti & Real Estat': ['Real Estate'],
};

const SCREENER_SORT_FIELDS: Record<string, string> = {
  marketCapT: 'intradaymarketcap',
  price: 'intradayprice',
  changePercent: 'percentchange',
  volume: 'dayvolume',
  per: 'peratio.lasttwelvemonths',
  pbv: 'pricebookratio.quarterly',
  ticker: 'ticker',
};

async function fetchPaginatedIdxScreener(params: {
  page: number;
  pageSize: number;
  sector: string;
  maxPer: number | null;
  maxPbv: number | null;
  minRoe: number | null;
  minYield: number | null;
  sortBy: string;
  sortDir: 'asc' | 'desc';
}): Promise<ScreenerPageResponse> {
  const safePage = Math.max(1, Math.floor(params.page));
  const safeSize = Math.min(50, Math.max(10, Math.floor(params.pageSize)));
  const offset = (safePage - 1) * safeSize;
  const sortField = SCREENER_SORT_FIELDS[params.sortBy] ?? 'intradaymarketcap';
  const sortType = params.sortDir === 'asc' ? 'ASC' : 'DESC';

  const cacheKey = JSON.stringify({
    safePage,
    safeSize,
    sector: params.sector,
    maxPer: params.maxPer,
    maxPbv: params.maxPbv,
    minRoe: params.minRoe,
    minYield: params.minYield,
    sortField,
    sortType,
  });

  const cached = screenerCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.data;
  }

  const operands: Array<Record<string, unknown>> = [
    { operator: 'eq', operands: ['region', 'id'] },
    { operator: 'eq', operands: ['exchange', 'JKT'] },
  ];

  const yahooSectors = IDX_TO_YAHOO_SECTOR[params.sector];
  if (yahooSectors && yahooSectors.length === 1) {
    operands.push({ operator: 'eq', operands: ['sector', yahooSectors[0]] });
  } else if (yahooSectors && yahooSectors.length > 1) {
    operands.push({
      operator: 'or',
      operands: yahooSectors.map((sec) => ({ operator: 'eq', operands: ['sector', sec] })),
    });
  }

  if (params.maxPer !== null && Number.isFinite(params.maxPer) && params.maxPer > 0) {
    operands.push({ operator: 'lt', operands: ['peratio.lasttwelvemonths', params.maxPer] });
  }
  if (params.maxPbv !== null && Number.isFinite(params.maxPbv) && params.maxPbv > 0) {
    operands.push({ operator: 'lt', operands: ['pricebookratio.quarterly', params.maxPbv] });
  }
  if (params.minRoe !== null && Number.isFinite(params.minRoe) && params.minRoe > -50) {
    operands.push({ operator: 'gt', operands: ['returnonequity.lasttwelvemonths', params.minRoe] });
  }
  if (params.minYield !== null && Number.isFinite(params.minYield) && params.minYield > 0) {
    operands.push({ operator: 'gt', operands: ['forward_dividend_yield', params.minYield] });
  }

  const body = {
    size: safeSize,
    offset,
    sortField,
    sortType,
    quoteType: 'EQUITY',
    query: {
      operator: 'AND',
      operands,
    },
  };

  let auth = await getYahooAuth();
  if (!auth) {
    throw new Error('Gagal menginisialisasi sesi data bursa IDX.');
  }

  const executeScreener = async (authPair: { cookie: string; crumb: string }) => {
    return fetch(
      `https://query1.finance.yahoo.com/v1/finance/screener?crumb=${encodeURIComponent(authPair.crumb)}`,
      {
        method: 'POST',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          Cookie: authPair.cookie,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(8000),
      }
    );
  };

  let res = await executeScreener(auth);
  if (res.status === 401) {
    auth = await getYahooAuth(true);
    if (auth) res = await executeScreener(auth);
  }

  if (!res.ok) {
    throw new Error(`Layanan screener bursa merespons status ${res.status}.`);
  }

  const json = (await res.json()) as {
    finance?: {
      result?: Array<{
        total?: number;
        quotes?: Array<Record<string, any>>;
      }>;
    };
  };

  const resultBlock = json.finance?.result?.[0];
  const total = resultBlock?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / safeSize));

  const catalogByTicker = new Map(IDX_CATALOG.map((c) => [c.ticker, c]));

  const items: ScreenerItem[] = (resultBlock?.quotes ?? []).map((q) => {
    const symbol = String(q.symbol ?? '');
    const ticker = symbol.replace('.JK', '').toUpperCase();
    const catalogMatch = catalogByTicker.get(ticker);

    const price = Number(q.regularMarketPrice ?? 0);
    const changePercent = Number(q.regularMarketChangePercent ?? 0);
    const volume = Number(q.regularMarketVolume ?? 0);
    const per = typeof q.trailingPE === 'number' && Number.isFinite(q.trailingPE)
      ? Number(q.trailingPE.toFixed(2))
      : 0;
    const pbv = typeof q.priceToBook === 'number' && Number.isFinite(q.priceToBook)
      ? Number(q.priceToBook.toFixed(2))
      : 0;

    const eps = typeof q.epsTrailingTwelveMonths === 'number' ? q.epsTrailingTwelveMonths : 0;
    const bvps = typeof q.bookValue === 'number' ? q.bookValue : 0;
    const impliedRoe =
      catalogMatch?.roe ??
      (eps !== 0 && bvps > 0 ? Number(((eps / bvps) * 100).toFixed(1)) : 0);

    let divYield = 0;
    if (typeof q.dividendYield === 'number' && Number.isFinite(q.dividendYield)) {
      divYield = Number(q.dividendYield.toFixed(2));
    } else if (
      typeof q.trailingAnnualDividendYield === 'number' &&
      Number.isFinite(q.trailingAnnualDividendYield)
    ) {
      divYield = Number((q.trailingAnnualDividendYield * 100).toFixed(2));
    }

    const marketCapT =
      typeof q.marketCap === 'number' && Number.isFinite(q.marketCap)
        ? Number((q.marketCap / 1e12).toFixed(2))
        : 0;

    const sectorLabel =
      params.sector !== 'Semua'
        ? params.sector
        : catalogMatch?.sector ?? 'Bursa Efek Indonesia';

    return {
      ticker,
      symbol,
      name: String(q.longName || q.shortName || catalogMatch?.name || `Emiten ${ticker}`),
      sector: sectorLabel,
      price,
      changePercent,
      volume,
      per,
      pbv,
      roe: impliedRoe,
      dividendYield: divYield,
      marketCapT,
      isLive: price > 0,
    };
  });

  const payload: ScreenerPageResponse = {
    items,
    page: safePage,
    pageSize: safeSize,
    total,
    totalPages,
    fetchedAtWib: formatWibTime(),
  };

  screenerCache.set(cacheKey, { data: payload, expiresAt: Date.now() + 30_000 });
  return payload;
}

app.get('/api/stocks/screener', async (req, res) => {
  try {
    const page = Number(req.query.page ?? 1) || 1;
    const pageSize = Number(req.query.pageSize ?? 20) || 20;
    const sector = typeof req.query.sector === 'string' ? req.query.sector : 'Semua';
    const maxPer = req.query.maxPer ? Number(req.query.maxPer) : null;
    const maxPbv = req.query.maxPbv ? Number(req.query.maxPbv) : null;
    const minRoe = req.query.minRoe ? Number(req.query.minRoe) : null;
    const minYield = req.query.minYield ? Number(req.query.minYield) : null;
    const sortBy = typeof req.query.sortBy === 'string' ? req.query.sortBy : 'marketCapT';
    const sortDir = req.query.sortDir === 'asc' ? 'asc' : 'desc';

    const data = await fetchPaginatedIdxScreener({
      page,
      pageSize,
      sector,
      maxPer: maxPer && Number.isFinite(maxPer) ? maxPer : null,
      maxPbv: maxPbv && Number.isFinite(maxPbv) ? maxPbv : null,
      minRoe: minRoe !== null && Number.isFinite(minRoe) ? minRoe : null,
      minYield: minYield && Number.isFinite(minYield) ? minYield : null,
      sortBy,
      sortDir,
    });
    res.json(data);
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Gagal memuat daftar emiten IDX.',
    });
  }
});

let sectorCapsCache: { data: SectorCapsResponse; expiresAt: number } | null = null;

async function fetchSectorMarketCaps(): Promise<SectorCapsResponse> {
  if (sectorCapsCache && Date.now() < sectorCapsCache.expiresAt) {
    return sectorCapsCache.data;
  }

  let auth = await getYahooAuth();
  if (!auth) {
    throw new Error('Gagal menginisialisasi sesi data kapitalisasi sektor IDX.');
  }

  const sectorEntries = Object.entries(IDX_TO_YAHOO_SECTOR);

  const runSectorQuery = async (
    label: string,
    yahooSecs: string[],
    authPair: { cookie: string; crumb: string }
  ) => {
    const secOp =
      yahooSecs.length === 1
        ? { operator: 'eq', operands: ['sector', yahooSecs[0]] }
        : {
            operator: 'or',
            operands: yahooSecs.map((s) => ({ operator: 'eq', operands: ['sector', s] })),
          };

    const res = await fetch(
      `https://query1.finance.yahoo.com/v1/finance/screener?crumb=${encodeURIComponent(authPair.crumb)}`,
      {
        method: 'POST',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          Cookie: authPair.cookie,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          size: 150,
          offset: 0,
          sortField: 'intradaymarketcap',
          sortType: 'DESC',
          quoteType: 'EQUITY',
          query: {
            operator: 'AND',
            operands: [
              { operator: 'eq', operands: ['region', 'id'] },
              { operator: 'eq', operands: ['exchange', 'JKT'] },
              secOp,
            ],
          },
        }),
        signal: AbortSignal.timeout(8000),
      }
    );
    return { label, res };
  };

  let rawResults = await Promise.all(
    sectorEntries.map(([label, yahooSecs]) => runSectorQuery(label, yahooSecs, auth!))
  );

  if (rawResults.some((r) => r.res.status === 401)) {
    const refreshed = await getYahooAuth(true);
    if (refreshed) {
      auth = refreshed;
      rawResults = await Promise.all(
        sectorEntries.map(([label, yahooSecs]) => runSectorQuery(label, yahooSecs, refreshed))
      );
    }
  }

  const parsedSectors: Array<Omit<SectorCapEntry, 'sharePercent'>> = [];
  for (const { label, res } of rawResults) {
    if (!res.ok) continue;
    const json = (await res.json()) as {
      finance?: {
        result?: Array<{
          total?: number;
          quotes?: Array<Record<string, any>>;
        }>;
      };
    };
    const block = json.finance?.result?.[0];
    const quotes = block?.quotes ?? [];
    const count = block?.total ?? quotes.length;

    let sumMcap = 0;
    let weightedChgSum = 0;
    for (const q of quotes) {
      const mcap = typeof q.marketCap === 'number' && Number.isFinite(q.marketCap) ? q.marketCap : 0;
      const chg =
        typeof q.regularMarketChangePercent === 'number' &&
        Number.isFinite(q.regularMarketChangePercent)
          ? q.regularMarketChangePercent
          : 0;
      sumMcap += mcap;
      weightedChgSum += mcap * chg;
    }

    const topQuote = quotes[0];
    const topTicker = String(topQuote?.symbol ?? '').replace('.JK', '').toUpperCase();
    const topTickerName = String(topQuote?.shortName || topQuote?.longName || topTicker);

    parsedSectors.push({
      sector: label,
      count,
      totalMarketCapT: Number((sumMcap / 1e12).toFixed(1)),
      weightedChangePercent: sumMcap > 0 ? Number((weightedChgSum / sumMcap).toFixed(2)) : 0,
      topTicker,
      topTickerName,
    });
  }

  const totalMarketCapT = Number(
    parsedSectors.reduce((acc, s) => acc + s.totalMarketCapT, 0).toFixed(1)
  );
  const totalIssuers = parsedSectors.reduce((acc, s) => acc + s.count, 0);

  const sectors: SectorCapEntry[] = parsedSectors
    .map((s) => ({
      ...s,
      sharePercent:
        totalMarketCapT > 0 ? Number(((s.totalMarketCapT / totalMarketCapT) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.totalMarketCapT - a.totalMarketCapT);

  const payload: SectorCapsResponse = {
    sectors,
    totalMarketCapT,
    totalIssuers,
    fetchedAtWib: formatWibTime(),
  };

  sectorCapsCache = { data: payload, expiresAt: Date.now() + 30_000 };
  return payload;
}

app.get('/api/market/sector-caps', async (_req, res) => {
  try {
    const data = await fetchSectorMarketCaps();
    res.json(data);
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Gagal memuat kapitalisasi pasar per sektor.',
    });
  }
});

app.get('/api/stocks/search', async (req, res) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q : '';
    const results = await searchIdxStocks(q);
    res.json({ results });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Gagal mencari saham IDX.',
    });
  }
});

app.get('/api/stock/:ticker/detail', async (req, res) => {
  try {
    const detail = await fetchDynamicStockDetail(req.params.ticker);
    if (!detail.isLive && detail.financials.length === 0) {
      res.status(404).json({
        error: `Kode saham ${req.params.ticker.toUpperCase()} tidak ditemukan di Bursa Efek Indonesia (.JK).`,
      });
      return;
    }
    res.json(detail);
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Gagal mengambil detail emiten IDX.',
    });
  }
});

app.get('/api/market/quotes', async (req, res) => {
  try {
    const raw = typeof req.query.tickers === 'string' ? req.query.tickers : '';
    const tickers = raw
      .split(',')
      .map((t) => t.trim().toUpperCase())
      .filter((t) => /^[A-Z0-9]{2,6}$/.test(t))
      .slice(0, 20);

    const stocks = await Promise.all(tickers.map((t) => fetchDynamicStockDetail(t)));
    res.json({ stocks, fetchedAtWib: formatWibTime() });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Gagal memuat kuotasi saham pilihan.',
    });
  }
});

app.get('/api/stock/:ticker/chart', async (req, res) => {
  try {
    const range = typeof req.query.range === 'string' ? req.query.range : '3mo';
    const chart = await fetchStockChart(req.params.ticker, range);
    res.json(chart);
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Gagal memuat grafik candlestick saham.',
    });
  }
});

app.get('/api/news', async (_req, res) => {
  try {
    const news = await fetchIndonesianEconomicNews();
    res.json(news);
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Gagal memuat umpan berita ekonomi.',
    });
  }
});

app.post('/api/digest/summarize', async (req, res) => {
  try {
    const ai = getGeminiClient();
    const news = await fetchIndonesianEconomicNews();
    const overview = await buildMarketOverview();

    const topArticles = (req.body?.articles as NewsArticle[] | undefined)?.slice(0, 10) ??
      news.articles.slice(0, 10);

    if (topArticles.length === 0) {
      res.status(400).json({ error: 'Tidak ada berita ekonomi yang tersedia untuk dirangkum.' });
      return;
    }

    const marketContext = `IHSG: ${overview.benchmarks.ihsg.price.toLocaleString('id-ID')} (${overview.benchmarks.ihsg.changePercent >= 0 ? '+' : ''}${overview.benchmarks.ihsg.changePercent.toFixed(2)}%), USD/IDR: Rp${overview.benchmarks.usdidr.price.toLocaleString('id-ID')}`;
    const headlinesText = topArticles
      .map(
        (a, idx) =>
          `[${idx + 1}] ID="${a.id}" | Sumber=${a.source} | Judul="${a.title}" | Ringkasan="${a.summary}" | SahamTerkait=${a.relatedTickers.join(',') || 'Umum'}`
      )
      .join('\n');

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: `Anda adalah analis riset ekuitas pasar modal Indonesia (IDX/BEI).
Data Pasar Terkini: ${marketContext}

Berita Ekonomi & Pasar Modal Indonesia Terbaru:
${headlinesText}

Buat ringkasan eksekutif harian dalam Bahasa Indonesia yang tajam, objektif, dan profesional untuk investor saham IDX, serta evaluasi sentimen untuk masing-masing artikel di atas.`,
      config: {
        systemInstruction:
          'Berikan analisis ringkas, faktual berdasarkan data berita dan indeks yang diberikan, tanpa klaim yang dibuat-buat. Gunakan Bahasa Indonesia bisnis yang jelas.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            executiveSummary: {
              type: Type.STRING,
              description: 'Satu paragraf ringkasan eksekutif (3-5 kalimat) mengenai kondisi ekonomi & IHSG hari ini.',
            },
            marketBias: {
              type: Type.STRING,
              description: 'Harus salah satu dari: Bullish, Bearish, Netral-Waspada',
            },
            keyTakeaways: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: '3 sampai 4 poin inti pergerakan makro dan pasar modal hari ini.',
            },
            sectorSpotlight: {
              type: Type.OBJECT,
              properties: {
                sector: { type: Type.STRING },
                outlook: { type: Type.STRING },
                tickers: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
              },
              required: ['sector', 'outlook', 'tickers'],
            },
            articleSentiments: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  sentiment: {
                    type: Type.STRING,
                    description: 'Harus salah satu dari: Positif, Negatif, Netral',
                  },
                  driver: {
                    type: Type.STRING,
                    description: 'Alasan pendorong singkat maksimal 4 kata.',
                  },
                },
                required: ['id', 'sentiment', 'driver'],
              },
            },
          },
          required: [
            'executiveSummary',
            'marketBias',
            'keyTakeaways',
            'sectorSpotlight',
            'articleSentiments',
          ],
        },
      },
    });

    const rawText = (response.text ?? '').trim();
    const parsed = JSON.parse(rawText) as Omit<AiDigestSummary, 'generatedAtWib'>;
    const payload: AiDigestSummary = {
      ...parsed,
      generatedAtWib: formatWibTime(),
    };
    res.json(payload);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Gagal menghasilkan ringkasan AI.';
    const status = message.includes('GEMINI_API_KEY') ? 400 : 500;
    res.status(status).json({ error: message });
  }
});

app.post('/api/news/impact', async (req, res) => {
  try {
    const ai = getGeminiClient();
    const { title, summary, ticker } = req.body as {
      title?: string;
      summary?: string;
      ticker?: string;
    };

    if (!title || !ticker) {
      res.status(400).json({ error: 'Judul berita dan kode emiten IDX wajib disertakan.' });
      return;
    }

    const cleanTicker = ticker.toUpperCase().replace('.JK', '');
    const overview = await buildMarketOverview();
    let stock = overview.stocks.find((s) => s.ticker === cleanTicker);
    if (!stock) {
      stock = await fetchDynamicStockDetail(cleanTicker);
    }
    const stockContext = stock && stock.isLive
      ? `${stock.ticker} (${stock.name}) | Sektor: ${stock.sector} | Harga: Rp${stock.price.toLocaleString('id-ID')} (${stock.changePercent >= 0 ? '+' : ''}${stock.changePercent.toFixed(2)}%) | PER: ${stock.per}x | PBV: ${stock.pbv}x | ROE: ${stock.roe}% | Div Yield: ${stock.dividendYield}%`
      : `Emiten ${cleanTicker}`;

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: `Evaluasi keterkaitan berita berikut terhadap pergerakan dan valuasi saham IDX:
Berita: "${title}"
Ringkasan: "${summary ?? title}"
Data Saham Terkini: ${stockContext}`,
      config: {
        systemInstruction:
          'Berikan analisis dampak berita yang ringkas, objektif, dan terstruktur dalam Bahasa Indonesia untuk investor ritel IDX.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            catalystSummary: { type: Type.STRING },
            valuationImpact: { type: Type.STRING },
            riskWatch: { type: Type.STRING },
            actionBias: {
              type: Type.STRING,
              description: 'Harus salah satu dari: Positif, Negatif, Netral',
            },
          },
          required: ['catalystSummary', 'valuationImpact', 'riskWatch', 'actionBias'],
        },
      },
    });

    const parsed = JSON.parse((response.text ?? '{}').trim()) as Omit<
      AiNewsImpactResponse,
      'ticker' | 'headline' | 'generatedAtWib'
    >;

    res.json({
      ticker: ticker.toUpperCase(),
      headline: title,
      ...parsed,
      generatedAtWib: formatWibTime(),
    } satisfies AiNewsImpactResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Gagal menganalisis dampak berita.';
    res.status(500).json({ error: message });
  }
});

const businessProfileCache = new Map<string, { data: CompanyBusinessProfile; expiresAt: number }>();

app.post('/api/stock/:ticker/business-profile', async (req, res) => {
  try {
    const cleanTicker = req.params.ticker.toUpperCase().replace('.JK', '').trim();
    if (!/^[A-Z0-9]{2,6}$/.test(cleanTicker)) {
      res.status(400).json({ error: 'Kode saham IDX tidak valid.' });
      return;
    }

    const catalogMatch = IDX_CATALOG.find((c) => c.ticker === cleanTicker);
    if (catalogMatch?.businessProfile) {
      res.json(catalogMatch.businessProfile);
      return;
    }

    const cached = businessProfileCache.get(cleanTicker);
    if (cached && Date.now() < cached.expiresAt) {
      res.json(cached.data);
      return;
    }

    const ai = getGeminiClient();
    const stock = await fetchDynamicStockDetail(cleanTicker);
    const annualRows = stock.annualFinancials ?? [];
    const fmtB = (val: number | null) =>
      val === null ? 'N/A' : `Rp${val.toLocaleString('id-ID')} M`;

    const annualSummary =
      annualRows.length > 0
        ? annualRows
            .map(
              (r) =>
                `${r.period}: Pendapatan=${fmtB(r.revenueB)} | LabaBersih=${fmtB(
                  r.netIncomeB
                )} | Ekuitas=${fmtB(r.totalEquityB)} | FCF=${fmtB(r.freeCashFlowB)}`
            )
            .join('\n')
        : 'Data tahunan historis tidak tersedia di timeseries.';

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: `Susun profil bisnis dan pertumbuhan historis dalam Bahasa Indonesia yang jelas dan mudah dipahami investor atas emiten Bursa Efek Indonesia berikut:
Kode: ${stock.ticker} (${stock.name})
Sektor / Subsektor: ${stock.sector} / ${stock.subsector}
Deskripsi Bisnis Resmi (Sumber Bursa/Yahoo): ${stock.businessProfile?.longBusinessSummaryRaw || 'Tidak tersedia'}
Riwayat Kinerja Tahunan (3-5 Tahun Terakhir):
${annualSummary}`,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        systemInstruction:
          'Anda adalah analis riset perusahaan IDX. Jelaskan secara faktual dalam Bahasa Indonesia apa bisnis yang dijalankan perusahaan, dari mana sumber keuntungannya, produk atau layanan yang diciptakan, dan bagaimana pertumbuhan bisnisnya dalam 3–5 tahun terakhir berdasarkan angka nyata di atas.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            businessModel: {
              type: Type.STRING,
              description: 'Penjelasan 2-3 kalimat mengenai bisnis utama yang dijalankan perusahaan ini.',
            },
            profitDrivers: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: '3 sampai 4 poin spesifik dari mana perusahaan menghasilkan pendapatan dan keuntungan.',
            },
            productsAndServices: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: '3 sampai 5 produk, merek, atau layanan utama yang diciptakan perusahaan.',
            },
            growth3to5YOverview: {
              type: Type.STRING,
              description: 'Ringkasan 2-3 kalimat tentang tren pertumbuhan pendapatan dan laba dalam 3-5 tahun terakhir berdasarkan angka di atas.',
            },
          },
          required: ['businessModel', 'profitDrivers', 'productsAndServices', 'growth3to5YOverview'],
        },
      },
    });

    const parsed = JSON.parse((response.text ?? '{}').trim()) as Omit<
      CompanyBusinessProfile,
      'longBusinessSummaryRaw'
    >;
    const enriched: CompanyBusinessProfile = {
      ...parsed,
      longBusinessSummaryRaw: stock.businessProfile?.longBusinessSummaryRaw,
    };

    businessProfileCache.set(cleanTicker, {
      data: enriched,
      expiresAt: Date.now() + 24 * 60 * 60_000,
    });
    detailCache.delete(cleanTicker);

    res.json(enriched);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Gagal menyusun profil bisnis emiten.';
    const status = message.includes('GEMINI_API_KEY') ? 400 : 500;
    res.status(status).json({ error: message });
  }
});

const aiDiagnosisCache = new Map<string, { data: AiStockDiagnosis; expiresAt: number }>();

app.post('/api/stock/:ticker/ai-diagnosis', async (req, res) => {
  try {
    const cleanTicker = req.params.ticker.toUpperCase().replace('.JK', '').trim();
    if (!/^[A-Z0-9]{2,6}$/.test(cleanTicker)) {
      res.status(400).json({ error: 'Kode saham IDX tidak valid.' });
      return;
    }

    const forceRefresh = Boolean((req.body as { forceRefresh?: boolean } | undefined)?.forceRefresh);
    const cached = aiDiagnosisCache.get(cleanTicker);
    if (!forceRefresh && cached && Date.now() < cached.expiresAt) {
      res.json(cached.data);
      return;
    }

    const ai = getGeminiClient();

    // Gather live fundamentals, valuation, 3mo technicals, and relevant Indonesian news in parallel
    const [overview, chart3mo, newsFeed] = await Promise.all([
      buildMarketOverview(),
      fetchStockChart(cleanTicker, '3mo').catch(() => null),
      fetchIndonesianEconomicNews().catch(() => null),
    ]);

    let stock = overview.stocks.find((s) => s.ticker === cleanTicker);
    if (!stock || stock.financials.length === 0) {
      stock = await fetchDynamicStockDetail(cleanTicker);
    }

    if (!stock || (!stock.isLive && stock.financials.length === 0)) {
      res.status(404).json({
        error: `Data emiten ${cleanTicker}.JK tidak tersedia untuk dianalisis saat ini.`,
      });
      return;
    }

    const latestCandle = chart3mo?.candles.at(-1) ?? null;
    const firstCandle = chart3mo?.candles[0] ?? null;
    const perf3mo =
      latestCandle && firstCandle && firstCandle.close > 0
        ? ((latestCandle.close - firstCandle.close) / firstCandle.close) * 100
        : null;

    const technicalContext = latestCandle
      ? `Harga Terakhir: Rp${latestCandle.close.toLocaleString('id-ID')} | Return 3 Bulan: ${
          perf3mo !== null ? `${perf3mo >= 0 ? '+' : ''}${perf3mo.toFixed(2)}%` : 'N/A'
        } | MA20: ${latestCandle.ma20 ? `Rp${latestCandle.ma20.toFixed(0)}` : 'N/A'} (${
          latestCandle.ma20 ? (latestCandle.close >= latestCandle.ma20 ? 'Di atas MA20' : 'Di bawah MA20') : ''
        }) | MA50: ${latestCandle.ma50 ? `Rp${latestCandle.ma50.toFixed(0)}` : 'N/A'} (${
          latestCandle.ma50 ? (latestCandle.close >= latestCandle.ma50 ? 'Di atas MA50' : 'Di bawah MA50') : ''
        }) | RSI(14): ${latestCandle.rsi14 !== null ? latestCandle.rsi14.toFixed(1) : 'N/A'}`
      : 'Data teknikal 3 bulan tidak tersedia.';

    const fmtB = (val: number | null) =>
      val === null ? 'N/A' : `${val.toLocaleString('id-ID', { maximumFractionDigits: 1 })} Miliar`;

    const financialsSummary =
      stock.financials.length > 0
        ? stock.financials
            .map(
              (f) =>
                `[${f.period}] Pendapatan=${fmtB(f.revenueB)} | LabaKotor=${fmtB(
                  f.grossProfitB
                )} | LabaOperasional=${fmtB(f.operatingIncomeB)} | LabaBersih=${fmtB(
                  f.netIncomeB
                )} | TotalAset=${fmtB(f.totalAssetsB)} | TotalLiabilitas=${fmtB(
                  f.totalLiabilitiesB
                )} | Ekuitas=${fmtB(f.totalEquityB)} | Kas=${fmtB(
                  f.cashAndEquivalentsB
                )} | ArusKasOperasi=${fmtB(f.operatingCashFlowB)} | CapEx=${fmtB(
                  f.capexB
                )} | FreeCashFlow=${fmtB(f.freeCashFlowB)}`
            )
            .join('\n')
        : 'Rincian tabel laporan keuangan kuartalan belum tersedia di timeseries; gunakan rasio utama.';

    const matchedNews = (newsFeed?.articles ?? [])
      .filter(
        (a) =>
          a.relatedTickers.includes(cleanTicker) ||
          a.title.toUpperCase().includes(cleanTicker) ||
          a.sectorTag === stock.sector
      )
      .slice(0, 4);

    const newsContext =
      matchedNews.length > 0
        ? matchedNews
            .map((a) => `- [${a.source}] ${a.title} (Sentimen: ${a.sentiment})`)
            .join('\n')
        : 'Tidak ada berita spesifik emiten dalam 24 jam terakhir.';

    const macroContext = `IHSG: ${overview.benchmarks.ihsg.price.toLocaleString('id-ID')} (${
      overview.benchmarks.ihsg.changePercent >= 0 ? '+' : ''
    }${overview.benchmarks.ihsg.changePercent.toFixed(2)}%) | USD/IDR: Rp${overview.benchmarks.usdidr.price.toLocaleString('id-ID')}`;

    const val3y = computeStockValuationAnalysis(stock, { horizonYears: 3, targetMosPct: 20 });
    const val5y = computeStockValuationAnalysis(stock, { horizonYears: 5, targetMosPct: 20 });

    const valuationModelContext = `
Model Valuasi Intrinsik, Margin of Safety & Proyeksi Future Value (berdasarkan harga pasar Rp${stock.price.toLocaleString('id-ID')}):
- Dividen Yield Live Sekarang: ${val3y.liveDividendYieldPct.toFixed(2)}% (DPS Rp${val3y.effectiveDps.toLocaleString('id-ID')}/lembar${
      val3y.payoutRatioPct !== null ? `, Payout Ratio ~${val3y.payoutRatioPct.toFixed(1)}%` : ''
    })
- Estimasi Nilai Wajar (Blended Fair Value): ${
      val3y.fairValueIdr ? `Rp${val3y.fairValueIdr.toLocaleString('id-ID')}` : 'N/A'
    } (Graham: ${val3y.grahamValueIdr ? `Rp${val3y.grahamValueIdr.toLocaleString('id-ID')}` : 'N/A'} | PER Sektor ${val3y.sectorFairPer}x: ${
      val3y.earningsFairValueIdr ? `Rp${val3y.earningsFairValueIdr.toLocaleString('id-ID')}` : 'N/A'
    } | Justified PBV ${val3y.justifiedPbv}x: ${
      val3y.bookFairValueIdr ? `Rp${val3y.bookFairValueIdr.toLocaleString('id-ID')}` : 'N/A'
    })
- Margin of Safety (MoS) Saat Ini: ${
      val3y.marginOfSafetyPct !== null ? `${val3y.marginOfSafetyPct.toFixed(1)}%` : 'N/A'
    } -> Status Model: ${val3y.investabilityLabel}
- Harga Beli Maksimal Ideal (dengan target MoS 20%): ${
      val3y.maxSafeBuyPriceIdr ? `Rp${val3y.maxSafeBuyPriceIdr.toLocaleString('id-ID')}` : 'N/A'
    }
- Proyeksi Future Value (Asumsi pertumbuhan konservatif ${val3y.appliedGrowthRatePct}%/tahun):
  * Horizon 3 Tahun: Harga Wajar ~Rp${
    val3y.projectedSharePriceEnd ? val3y.projectedSharePriceEnd.toLocaleString('id-ID') : 'N/A'
  } + Akumulasi Dividen Rp${val3y.projectedTotalDividendsEnd.toLocaleString('id-ID')} = Total Future Value Rp${
    val3y.projectedTotalFutureValueEnd ? val3y.projectedTotalFutureValueEnd.toLocaleString('id-ID') : 'N/A'
  } (CAGR ~${val3y.projectedCagrPct ?? 'N/A'}%/thn, Yield on Cost Th-3: ${val3y.projectedYieldOnCostEndPct.toFixed(2)}%)
  * Horizon 5 Tahun: Harga Wajar ~Rp${
    val5y.projectedSharePriceEnd ? val5y.projectedSharePriceEnd.toLocaleString('id-ID') : 'N/A'
  } + Akumulasi Dividen Rp${val5y.projectedTotalDividendsEnd.toLocaleString('id-ID')} = Total Future Value Rp${
    val5y.projectedTotalFutureValueEnd ? val5y.projectedTotalFutureValueEnd.toLocaleString('id-ID') : 'N/A'
  } (CAGR ~${val5y.projectedCagrPct ?? 'N/A'}%/thn, Yield on Cost Th-5: ${val5y.projectedYieldOnCostEndPct.toFixed(2)}%)`;

    const annualRows = stock.annualFinancials ?? [];
    const annualSummaryText =
      annualRows.length > 0
        ? annualRows
            .map(
              (f) =>
                `[${f.period}] Pendapatan=${fmtB(f.revenueB)} | LabaOperasional=${fmtB(
                  f.operatingIncomeB
                )} | LabaBersih=${fmtB(f.netIncomeB)} | TotalAset=${fmtB(
                  f.totalAssetsB
                )} | Ekuitas=${fmtB(f.totalEquityB)} | FreeCashFlow=${fmtB(f.freeCashFlowB)}`
            )
            .join('\n')
        : 'Rincian laporan tahunan 3–5 tahun tidak tersedia.';

    const bizContext = stock.businessProfile
      ? `Model Bisnis: ${stock.businessProfile.businessModel}
Sumber Untung: ${stock.businessProfile.profitDrivers.join('; ')}
Produk/Layanan: ${stock.businessProfile.productsAndServices.join('; ')}
Catatan Deskripsi Bursa: ${stock.businessProfile.longBusinessSummaryRaw ?? '-'}`
      : `Sektor: ${stock.sector} / ${stock.subsector}`;

    const prompt = `Anda adalah analis riset ekuitas senior bersertifikat untuk Bursa Efek Indonesia (IDX/BEI).
Lakukan audit menyeluruh atas profil bisnis (menjalankan bisnis apa, sumber keuntungan dari mana, produk yang diciptakan, dan pertumbuhan 3–5 tahun terakhir), kesehatan keuangan, kekuatan fundamental, kewajaran valuasi, dividen yield aktual terhadap harga sekarang, Margin of Safety (MoS), proyeksi Future Value 3-5 tahun, saran strategi investasi yang bijak, dan proyeksi risiko masa depan untuk saham berikut berdasarkan DATA NYATA di bawah ini.

Profil & Valuasi Emiten:
- Kode: ${stock.ticker} (${stock.name})
- Sektor / Subsektor: ${stock.sector} / ${stock.subsector}
- Harga Pasar: Rp${stock.price.toLocaleString('id-ID')} (Perubahan harian: ${
      stock.changePercent >= 0 ? '+' : ''
    }${stock.changePercent.toFixed(2)}%)
- Kapitalisasi Pasar: Rp${stock.marketCapT.toLocaleString('id-ID')} Triliun
- PER (TTM): ${stock.per > 0 ? `${stock.per.toFixed(2)}x` : 'N/A / Negatif'} | EPS TTM: Rp${stock.epsTtm.toLocaleString('id-ID')}
- PBV: ${stock.pbv > 0 ? `${stock.pbv.toFixed(2)}x` : 'N/A'} | BVPS: Rp${stock.bvps.toLocaleString('id-ID')}
- ROE: ${stock.roe !== 0 ? `${stock.roe.toFixed(2)}%` : 'N/A'} | DER: ${
      stock.der > 0 ? `${stock.der.toFixed(2)}x` : 'N/A'
    }
- Dividen Yield: ${val3y.liveDividendYieldPct.toFixed(2)}% (DPS: Rp${val3y.effectiveDps.toLocaleString('id-ID')})
- Pertumbuhan Pendapatan YoY: ${stock.revenueGrowthYoY.toFixed(2)}% | Pertumbuhan Laba Bersih YoY: ${stock.netProfitGrowthYoY.toFixed(2)}%
- Basis Laporan: ${stock.reportPeriodLabel}

Informasi Model Bisnis & Produk Emiten:
${bizContext}

${valuationModelContext}

Riwayat Laporan Keuangan Tahunan (3–5 Tahun Terakhir, dalam Miliar IDR):
${annualSummaryText}

Riwayat Laporan Keuangan Kuartalan (dalam Miliar IDR):
${financialsSummary}

Posisi Teknikal 3 Bulan:
${technicalContext}

Konteks Makro & Berita Terkini:
${macroContext}
${newsContext}

Instruksi Ketat:
1. Semua kesimpulan WAJIB merujuk angka nyata di atas (jangan mengarang angka atau skor yang tidak ada di data). Jika suatu pos bernilai N/A, nyatakan secara jujur keterbatasan data tersebut.
2. Jelaskan secara gamblang perusahaan ini menjalankan bisnis apa, dari mana sumber keuntungan utamanya berasal, produk/layanan konkret apa yang diciptakan, dan bagaimana tren pertumbuhan bisnisnya dalam 3–5 tahun terakhir berdasarkan data tahunan di atas.
3. Untuk bank/lembaga keuangan (jika sektor Keuangan), perhatikan bahwa DER tinggi dan CapEx/OCF memiliki karakter akuntansi perbankan yang berbeda dari manufaktur—jelaskan konteks tersebut dengan tepat agar user tidak salah menilai!
4. Evaluasi secara spesifik apakah Dividen Yield saat ini dan estimasi Margin of Safety (MoS) menjadikan saham ini layak dikoleksi pada harga sekarang atau lebih bijak menunggu harga batas aman, serta jelaskan prospek Future Value dalam 3–5 tahun.
5. Berikan perkiraan risiko mendatang yang spesifik terhadap model bisnis emiten, neraca/utangnya, valuasi saat ini, dan faktor makro Indonesia (suku bunga BI, kurs Rupiah, atau harga komoditas terkait).
6. Berikan saran strategis yang objektif dan terukur (bukan ajakan spekulatif), lengkap dengan profil investor yang sesuai.`;

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        systemInstruction:
          'Anda adalah analis fundamental & risiko ekuitas pasar modal Indonesia yang objektif, akurat secara matematis, dan transparan terhadap keterbatasan data. Selalu jawab dalam Bahasa Indonesia yang jelas dan terstruktur sesuai skema JSON.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            businessModelSummary: {
              type: Type.STRING,
              description: 'Penjelasan 1-2 kalimat mengenai bisnis apa yang dijalankan perusahaan.',
            },
            revenueProfitDrivers: {
              type: Type.STRING,
              description: 'Penjelasan 1-2 kalimat mengenai dari mana perusahaan mendapatkan pendapatan dan keuntungan utamanya.',
            },
            keyProductsServices: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: '3 sampai 5 produk, merek, atau layanan utama yang diciptakan perusahaan.',
            },
            historicalGrowth3to5Y: {
              type: Type.STRING,
              description: 'Analisis 2-3 kalimat mengenai pertumbuhan pendapatan, laba bersih, dan skala bisnis selama 3–5 tahun terakhir berdasarkan data tahunan.',
            },
            healthStatus: {
              type: Type.STRING,
              description: 'Harus salah satu dari: Sangat Sehat, Sehat, Waspada, Rentan',
            },
            healthSummary: {
              type: Type.STRING,
              description: 'Ringkasan 1-2 kalimat mengenai kondisi kesehatan neraca, profitabilitas, dan arus kas emiten.',
            },
            valuationVerdict: {
              type: Type.STRING,
              description: 'Harus salah satu dari: Undervalued, Wajar (Fair Value), Premium / Overvalued, Tidak Terdefinisi',
            },
            valuationSummary: {
              type: Type.STRING,
              description: 'Penjelasan 1-2 kalimat mengevaluasi PER, PBV, dan estimasi nilai wajar terhadap pertumbuhan laba/ROE.',
            },
            dividendYieldAssessment: {
              type: Type.STRING,
              description: 'Evaluasi 1-2 kalimat mengenai daya tarik Dividen Yield pada harga pasar saat ini (%), rasio pembagian dividen, dan keberlanjutannya dibanding bunga bebas risiko.',
            },
            marginOfSafetyAssessment: {
              type: Type.STRING,
              description: 'Evaluasi 1-2 kalimat mengenai Margin of Safety (%) antara harga pasar sekarang vs nilai wajar intrinsik serta kelayakan harga masuk yang aman.',
            },
            futureValueProjection: {
              type: Type.STRING,
              description: 'Proyeksi 1-2 kalimat mengenai perkiraan Future Value saham + akumulasi dividen (CAGR dan Yield on Cost) dalam horizon 3-5 tahun ke depan.',
            },
            recommendationAction: {
              type: Type.STRING,
              description: 'Harus salah satu dari: Akumulasi Bertahap, Tahan / Pantau, Tunggu Koreksi, Hati-hati / Hindari',
            },
            recommendationReason: {
              type: Type.STRING,
              description: 'Alasan taktis & fundamental terbaik (2-3 kalimat) yang menggabungkan kesehatan fundamental, Margin of Safety, dan posisi teknikal saat ini.',
            },
            investorSuitability: {
              type: Type.STRING,
              description: 'Tipe investor dan horizon waktu yang paling cocok (misal: Investor nilai/dividen jangka menengah-panjang, atau investor agresif dengan manajemen risiko ketat).',
            },
            fundamentalPillars: {
              type: Type.ARRAY,
              description: 'Tepat 4 pilar audit fundamental: 1. Profitabilitas & Pertumbuhan, 2. Solvabilitas & Struktur Modal, 3. Kualitas Arus Kas, 4. Valuasi & Posisi Teknikal.',
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  status: {
                    type: Type.STRING,
                    description: 'Harus salah satu dari: Kuat, Cukup, Perlu Perhatian',
                  },
                  analysis: {
                    type: Type.STRING,
                    description: 'Analisis 1-2 kalimat yang mengutip angka spesifik dari laporan keuangan atau rasio di atas.',
                  },
                },
                required: ['title', 'status', 'analysis'],
              },
            },
            futureRisks: {
              type: Type.ARRAY,
              description: '3 sampai 4 risiko nyata yang berpotensi muncul ke depan jika berinvestasi di saham ini.',
              items: {
                type: Type.OBJECT,
                properties: {
                  riskTitle: { type: Type.STRING },
                  severity: {
                    type: Type.STRING,
                    description: 'Harus salah satu dari: Tinggi, Sedang, Rendah',
                  },
                  impactDetail: {
                    type: Type.STRING,
                    description: 'Penjelasan bagaimana risiko ini dapat menekan kinerja laba, neraca, atau harga saham.',
                  },
                  mitigationWatch: {
                    type: Type.STRING,
                    description: 'Indikator atau angka spesifik yang harus dipantau investor untuk mendeteksi risiko lebih awal.',
                  },
                },
                required: ['riskTitle', 'severity', 'impactDetail', 'mitigationWatch'],
              },
            },
            catalystsToWatch: {
              type: Type.ARRAY,
              description: '2 sampai 3 katalis positif potensial yang dapat mendorong kinerja atau re-rating saham ke depan.',
              items: { type: Type.STRING },
            },
            executiveConclusion: {
              type: Type.STRING,
              description: 'Kesimpulan akhir 2-3 kalimat yang membantu user memahami keputusan terbaik, posisi Margin of Safety, dan keseimbangan return-vs-risiko.',
            },
          },
          required: [
            'businessModelSummary',
            'revenueProfitDrivers',
            'keyProductsServices',
            'historicalGrowth3to5Y',
            'healthStatus',
            'healthSummary',
            'valuationVerdict',
            'valuationSummary',
            'dividendYieldAssessment',
            'marginOfSafetyAssessment',
            'futureValueProjection',
            'recommendationAction',
            'recommendationReason',
            'investorSuitability',
            'fundamentalPillars',
            'futureRisks',
            'catalystsToWatch',
            'executiveConclusion',
          ],
        },
      },
    });

    const parsed = JSON.parse((response.text ?? '{}').trim()) as Omit<
      AiStockDiagnosis,
      'ticker' | 'name' | 'sector' | 'dataBasisNote' | 'generatedAtWib'
    >;

    const diagnosis: AiStockDiagnosis = {
      ticker: stock.ticker,
      name: stock.name,
      sector: stock.sector,
      ...parsed,
      dataBasisNote: `Harga Rp${stock.price.toLocaleString('id-ID')} · ${stock.reportPeriodLabel} · Teknikal 3M`,
      generatedAtWib: formatWibTime(),
    };

    aiDiagnosisCache.set(cleanTicker, {
      data: diagnosis,
      expiresAt: Date.now() + 5 * 60_000,
    });

    res.json(diagnosis);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Gagal menyusun diagnosis fundamental & risiko AI.';
    const status = message.includes('GEMINI_API_KEY') ? 400 : 500;
    res.status(status).json({ error: message });
  }
});

async function startServer() {
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Mau Sugih server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
