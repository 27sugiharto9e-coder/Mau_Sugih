import type { LiveStockQuote } from '../types';

export interface ValuationOverrides {
  horizonYears?: number;
  growthRatePct?: number;
  targetMosPct?: number;
}

export interface FutureYearPoint {
  year: number;
  label: string;
  projectedShareValue: number;
  annualDps: number;
  cumulativeDividends: number;
  totalFutureValue: number;
  yieldOnCostPct: number;
}

export type InvestabilityLabel =
  | 'Layak Investasi (MoS Aman)'
  | 'Cukup Wajar (Akumulasi Bertahap)'
  | 'Sedikit Premium (Tunggu Koreksi)'
  | 'Overvalued (MoS Negatif)'
  | 'Data Valuasi Belum Memadai';

export interface StockValuationAnalysis {
  currentPrice: number;
  effectiveDps: number;
  liveDividendYieldPct: number;
  payoutRatioPct: number | null;
  sectorFairPer: number;
  justifiedPbv: number;
  grahamValueIdr: number | null;
  earningsFairValueIdr: number | null;
  bookFairValueIdr: number | null;
  fairValueIdr: number | null;
  marginOfSafetyPct: number | null;
  upsideToFairValuePct: number | null;
  maxSafeBuyPriceIdr: number | null;
  investabilityLabel: InvestabilityLabel;
  defaultGrowthRatePct: number;
  appliedGrowthRatePct: number;
  horizonYears: number;
  targetMosPct: number;
  projectedSharePriceEnd: number | null;
  projectedTotalDividendsEnd: number;
  projectedTotalFutureValueEnd: number | null;
  projectedTotalReturnPct: number | null;
  projectedCagrPct: number | null;
  projectedYieldOnCostEndPct: number;
  yearlySeries: FutureYearPoint[];
}

function getSectorBasePer(sector: string): number {
  switch (sector) {
    case 'Konsumer Primer':
    case 'Kesehatan':
    case 'Teknologi':
      return 17;
    case 'Infrastruktur':
    case 'Konsumer Siklikal':
      return 14;
    case 'Keuangan':
      return 13;
    case 'Barang Baku':
    case 'Perindustrian':
    case 'Properti & Real Estat':
      return 12;
    case 'Energi':
      return 9;
    default:
      return 13;
  }
}

export function estimateDefaultGrowthPct(stock: LiveStockQuote): number {
  const candidates: number[] = [];
  if (stock.netProfitGrowthYoY > -20 && stock.netProfitGrowthYoY < 40) {
    candidates.push(stock.netProfitGrowthYoY);
  }
  if (stock.revenueGrowthYoY > -15 && stock.revenueGrowthYoY < 35) {
    candidates.push(stock.revenueGrowthYoY);
  }
  if (stock.roe > 0) {
    const retention =
      stock.epsTtm > 0 && stock.dps > 0
        ? Math.max(0.2, 1 - Math.min(0.85, stock.dps / stock.epsTtm))
        : 0.65;
    candidates.push(stock.roe * retention);
  }

  if (candidates.length === 0) return 8;
  const avg = candidates.reduce((a, b) => a + b, 0) / candidates.length;
  return Number(Math.min(18, Math.max(3, avg)).toFixed(1));
}

export function computeStockValuationAnalysis(
  stock: LiveStockQuote,
  overrides: ValuationOverrides = {}
): StockValuationAnalysis {
  const currentPrice = stock.price > 0 ? stock.price : 0;
  const horizonYears = overrides.horizonYears ?? 3;
  const targetMosPct = overrides.targetMosPct ?? 20;

  // Compute live dividend per share and live yield strictly against current price
  const effectiveDps =
    stock.dps > 0
      ? stock.dps
      : stock.dividendYield > 0 && currentPrice > 0
      ? Number(((stock.dividendYield / 100) * currentPrice).toFixed(2))
      : 0;

  const liveDividendYieldPct =
    effectiveDps > 0 && currentPrice > 0
      ? Number(((effectiveDps / currentPrice) * 100).toFixed(2))
      : stock.dividendYield;

  const payoutRatioPct =
    stock.epsTtm > 0 && effectiveDps > 0
      ? Number(Math.min(120, (effectiveDps / stock.epsTtm) * 100).toFixed(1))
      : null;

  const sectorFairPer = getSectorBasePer(stock.sector);
  const justifiedPbv =
    stock.roe > 0
      ? Number(Math.min(4.2, Math.max(0.85, stock.roe / 11)).toFixed(2))
      : 1.2;

  const grahamValueIdr =
    stock.epsTtm > 0 && stock.bvps > 0
      ? Math.round(Math.sqrt(22.5 * stock.epsTtm * stock.bvps))
      : null;

  const earningsFairValueIdr =
    stock.epsTtm > 0 ? Math.round(stock.epsTtm * sectorFairPer) : null;

  const bookFairValueIdr =
    stock.bvps > 0 ? Math.round(stock.bvps * justifiedPbv) : null;

  const validModels = [grahamValueIdr, earningsFairValueIdr, bookFairValueIdr].filter(
    (v): v is number => v !== null && v > 0
  );

  const fairValueIdr =
    validModels.length > 0
      ? Math.round(validModels.reduce((acc, v) => acc + v, 0) / validModels.length)
      : null;

  const marginOfSafetyPct =
    fairValueIdr && fairValueIdr > 0 && currentPrice > 0
      ? Number((((fairValueIdr - currentPrice) / fairValueIdr) * 100).toFixed(1))
      : null;

  const upsideToFairValuePct =
    fairValueIdr && currentPrice > 0
      ? Number((((fairValueIdr - currentPrice) / currentPrice) * 100).toFixed(1))
      : null;

  const maxSafeBuyPriceIdr = fairValueIdr
    ? Math.round(fairValueIdr * (1 - targetMosPct / 100))
    : null;

  let investabilityLabel: InvestabilityLabel = 'Data Valuasi Belum Memadai';
  if (marginOfSafetyPct !== null) {
    if (marginOfSafetyPct >= targetMosPct) {
      investabilityLabel = 'Layak Investasi (MoS Aman)';
    } else if (marginOfSafetyPct >= 0) {
      investabilityLabel = 'Cukup Wajar (Akumulasi Bertahap)';
    } else if (marginOfSafetyPct >= -15) {
      investabilityLabel = 'Sedikit Premium (Tunggu Koreksi)';
    } else {
      investabilityLabel = 'Overvalued (MoS Negatif)';
    }
  }

  const defaultGrowthRatePct = estimateDefaultGrowthPct(stock);
  const appliedGrowthRatePct =
    overrides.growthRatePct !== undefined ? overrides.growthRatePct : defaultGrowthRatePct;

  const g = appliedGrowthRatePct / 100;
  const gDiv = Math.min(g, 0.12);
  const baseValuationAnchor = fairValueIdr && fairValueIdr > 0 ? fairValueIdr : currentPrice;

  const yearlySeries: FutureYearPoint[] = [
    {
      year: 0,
      label: 'Saat Ini',
      projectedShareValue: currentPrice,
      annualDps: effectiveDps,
      cumulativeDividends: 0,
      totalFutureValue: currentPrice,
      yieldOnCostPct: liveDividendYieldPct,
    },
  ];

  let cumulativeDiv = 0;
  for (let y = 1; y <= horizonYears; y += 1) {
    // Share price gradually converges toward growing intrinsic value over the investment horizon
    const grownIntrinsic = Math.round(baseValuationAnchor * Math.pow(1 + g, y));
    const annualDps = effectiveDps > 0 ? Number((effectiveDps * Math.pow(1 + gDiv, y)).toFixed(1)) : 0;
    cumulativeDiv += annualDps;
    const totalVal = Math.round(grownIntrinsic + cumulativeDiv);
    const yoc = currentPrice > 0 && annualDps > 0 ? Number(((annualDps / currentPrice) * 100).toFixed(2)) : 0;

    yearlySeries.push({
      year: y,
      label: `Tahun ${y}`,
      projectedShareValue: grownIntrinsic,
      annualDps,
      cumulativeDividends: Math.round(cumulativeDiv),
      totalFutureValue: totalVal,
      yieldOnCostPct: yoc,
    });
  }

  const finalPoint = yearlySeries[yearlySeries.length - 1];
  const projectedSharePriceEnd =
    baseValuationAnchor > 0 ? finalPoint.projectedShareValue : null;
  const projectedTotalDividendsEnd = finalPoint.cumulativeDividends;
  const projectedTotalFutureValueEnd =
    baseValuationAnchor > 0 ? finalPoint.totalFutureValue : null;

  const projectedTotalReturnPct =
    projectedTotalFutureValueEnd !== null && currentPrice > 0
      ? Number((((projectedTotalFutureValueEnd - currentPrice) / currentPrice) * 100).toFixed(1))
      : null;

  const projectedCagrPct =
    projectedTotalFutureValueEnd !== null && currentPrice > 0 && horizonYears > 0
      ? Number(
          ((Math.pow(projectedTotalFutureValueEnd / currentPrice, 1 / horizonYears) - 1) * 100).toFixed(1)
        )
      : null;

  return {
    currentPrice,
    effectiveDps,
    liveDividendYieldPct,
    payoutRatioPct,
    sectorFairPer,
    justifiedPbv,
    grahamValueIdr,
    earningsFairValueIdr,
    bookFairValueIdr,
    fairValueIdr,
    marginOfSafetyPct,
    upsideToFairValuePct,
    maxSafeBuyPriceIdr,
    investabilityLabel,
    defaultGrowthRatePct,
    appliedGrowthRatePct,
    horizonYears,
    targetMosPct,
    projectedSharePriceEnd,
    projectedTotalDividendsEnd,
    projectedTotalFutureValueEnd,
    projectedTotalReturnPct,
    projectedCagrPct,
    projectedYieldOnCostEndPct: finalPoint.yieldOnCostPct,
    yearlySeries,
  };
}
