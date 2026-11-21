export type ThemeMode = 'light' | 'dark';

export type ActiveTab =
  | 'digest'
  | 'analysis'
  | 'screener'
  | 'fundamentals'
  | 'sentiment'
  | 'academy';

export type SentimentLabel = 'Positif' | 'Negatif' | 'Netral';

export type SectorName =
  | 'Keuangan'
  | 'Infrastruktur'
  | 'Energi'
  | 'Barang Baku'
  | 'Konsumer Primer'
  | 'Konsumer Siklikal'
  | 'Perindustrian'
  | 'Teknologi'
  | 'Kesehatan'
  | 'Properti & Real Estat'
  | 'Transportasi & Logistik'
  | string;

export interface StockSearchResult {
  ticker: string;
  symbol: string;
  name: string;
  exchange: string;
  inCatalog: boolean;
}

export interface FinancialPeriodRow {
  period: string;
  revenueB: number | null;
  grossProfitB: number | null;
  operatingIncomeB: number | null;
  netIncomeB: number | null;
  totalAssetsB: number | null;
  totalLiabilitiesB: number | null;
  totalEquityB: number | null;
  cashAndEquivalentsB: number | null;
  operatingCashFlowB: number | null;
  capexB: number | null;
  freeCashFlowB: number | null;
}

export interface CompanyBusinessProfile {
  businessModel: string;
  profitDrivers: string[];
  productsAndServices: string[];
  growth3to5YOverview: string;
  longBusinessSummaryRaw?: string;
}

export interface StockFundamentals {
  ticker: string;
  name: string;
  sector: SectorName;
  subsector: string;
  epsTtm: number;
  bvps: number;
  dps: number;
  roe: number;
  der: number;
  revenueGrowthYoY: number;
  netProfitGrowthYoY: number;
  sharesOutstandingB: number;
  reportPeriodLabel: string;
  keywords: string[];
  financials: FinancialPeriodRow[];
  annualFinancials?: FinancialPeriodRow[];
  businessProfile?: CompanyBusinessProfile;
}

export interface LiveStockQuote extends StockFundamentals {
  symbol: string;
  price: number;
  previousClose: number;
  change: number;
  changePercent: number;
  dayHigh: number;
  dayLow: number;
  volume: number;
  per: number;
  pbv: number;
  dividendYield: number;
  marketCapT: number;
  sparkline: number[];
  isLive: boolean;
  sourceLabel: string;
  updatedAtWib: string;
}

export interface BenchmarkQuote {
  symbol: string;
  label: string;
  price: number;
  previousClose: number;
  change: number;
  changePercent: number;
  dayHigh: number;
  dayLow: number;
  sparkline: number[];
  isLive: boolean;
  updatedAtWib: string;
}

export interface MarketOverviewResponse {
  benchmarks: {
    ihsg: BenchmarkQuote;
    usdidr: BenchmarkQuote;
  };
  stocks: LiveStockQuote[];
  fetchedAtWib: string;
  sourceNote: string;
}

export interface CandlePoint {
  time: number;
  dateLabel: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  ma20: number | null;
  ma50: number | null;
  rsi14: number | null;
}

export interface StockChartResponse {
  ticker: string;
  range: string;
  candles: CandlePoint[];
  isLive: boolean;
  fetchedAtWib: string;
}

export interface TrendingTopic {
  topic: string;
  count: number;
  percentage: number;
  relatedTickers: string[];
}

export interface NewsArticle {
  id: string;
  title: string;
  summary: string;
  source: string;
  link: string;
  pubDate: string;
  pubTimeWib: string;
  sentiment: SentimentLabel;
  emotionDriver: string;
  relatedTickers: string[];
  sectorTag: string;
}

export interface NewsFeedResponse {
  articles: NewsArticle[];
  trendingTopics: TrendingTopic[];
  fetchedAtWib: string;
  sourcesChecked: string[];
}

export interface AiDigestSummary {
  executiveSummary: string;
  marketBias: 'Bullish' | 'Bearish' | 'Netral-Waspada';
  keyTakeaways: string[];
  sectorSpotlight: {
    sector: string;
    outlook: string;
    tickers: string[];
  };
  articleSentiments: Array<{
    id: string;
    sentiment: SentimentLabel;
    driver: string;
  }>;
  generatedAtWib: string;
}

export interface AiNewsImpactResponse {
  ticker: string;
  headline: string;
  catalystSummary: string;
  valuationImpact: string;
  riskWatch: string;
  actionBias: SentimentLabel;
  generatedAtWib: string;
}

export interface ScreenerItem {
  ticker: string;
  symbol: string;
  name: string;
  sector: string;
  price: number;
  changePercent: number;
  volume: number;
  per: number;
  pbv: number;
  roe: number;
  dividendYield: number;
  marketCapT: number;
  isLive: boolean;
}

export interface ScreenerPageResponse {
  items: ScreenerItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  fetchedAtWib: string;
}

export interface SectorCapEntry {
  sector: string;
  count: number;
  totalMarketCapT: number;
  sharePercent: number;
  weightedChangePercent: number;
  topTicker: string;
  topTickerName: string;
}

export interface SectorCapsResponse {
  sectors: SectorCapEntry[];
  totalMarketCapT: number;
  totalIssuers: number;
  fetchedAtWib: string;
}

export type FinancialHealthStatus = 'Sangat Sehat' | 'Sehat' | 'Waspada' | 'Rentan';
export type ValuationVerdict =
  | 'Undervalued'
  | 'Wajar (Fair Value)'
  | 'Premium / Overvalued'
  | 'Tidak Terdefinisi';
export type RecommendationAction =
  | 'Akumulasi Bertahap'
  | 'Tahan / Pantau'
  | 'Tunggu Koreksi'
  | 'Hati-hati / Hindari';
export type PillarStatus = 'Kuat' | 'Cukup' | 'Perlu Perhatian';
export type RiskSeverity = 'Tinggi' | 'Sedang' | 'Rendah';

export interface AiFundamentalPillar {
  title: string;
  status: PillarStatus;
  analysis: string;
}

export interface AiFutureRisk {
  riskTitle: string;
  severity: RiskSeverity;
  impactDetail: string;
  mitigationWatch: string;
}

export interface AiStockDiagnosis {
  ticker: string;
  name: string;
  sector: string;
  businessModelSummary?: string;
  revenueProfitDrivers?: string;
  keyProductsServices?: string[];
  historicalGrowth3to5Y?: string;
  healthStatus: FinancialHealthStatus;
  healthSummary: string;
  valuationVerdict: ValuationVerdict;
  valuationSummary: string;
  dividendYieldAssessment: string;
  marginOfSafetyAssessment: string;
  futureValueProjection: string;
  recommendationAction: RecommendationAction;
  recommendationReason: string;
  investorSuitability: string;
  fundamentalPillars: AiFundamentalPillar[];
  futureRisks: AiFutureRisk[];
  catalystsToWatch: string[];
  executiveConclusion: string;
  dataBasisNote: string;
  generatedAtWib: string;
}

