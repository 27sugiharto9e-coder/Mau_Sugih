import { useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CheckCircle2, RotateCcw, XCircle } from 'lucide-react';
import type { LiveStockQuote } from '../types';
import { BEGINNER_QUIZ_QUESTIONS } from '../data/glossaryTerms';
import {
  formatIdr,
  formatSignedPercent,
  getChangeColorClass,
} from '../utils/formatters';
import { StockSearchBox } from './StockSearchBox';
import { InteractiveGlossaryPanel } from './InteractiveGlossaryPanel';

interface BeginnerAcademyViewProps {
  stocks: LiveStockQuote[];
  selectedTicker: string;
  onEnsureStockLoaded: (ticker: string) => void;
  stockLoading: boolean;
  onSelectStock: (ticker: string) => void;
}

type AcademySubTab = 'glossary' | 'trading' | 'compounding';

interface SimPosition {
  ticker: string;
  lots: number;
  avgPrice: number;
}

interface SimOrderRecord {
  id: string;
  timestampWib: string;
  side: 'BELI' | 'JUAL';
  ticker: string;
  lots: number;
  price: number;
  fee: number;
  netAmount: number;
}

interface SimPortfolioState {
  initialCash: number;
  cash: number;
  positions: Record<string, SimPosition>;
  orders: SimOrderRecord[];
}

const INITIAL_VIRTUAL_CASH = 100_000_000;
const BUY_FEE_RATE = 0.0015; // 0.15%
const SELL_FEE_RATE = 0.0025; // 0.25% (termasuk PPh final 0.1%)
const SIM_STORAGE_KEY = 'mausugih_sim_portfolio_v1';

function createDefaultPortfolio(): SimPortfolioState {
  return {
    initialCash: INITIAL_VIRTUAL_CASH,
    cash: INITIAL_VIRTUAL_CASH,
    positions: {},
    orders: [],
  };
}

function formatWibNow(): string {
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date());
}

function formatMillionShort(value: number): string {
  if (value >= 1_000_000_000) {
    return `Rp${(value / 1_000_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000_000) {
    return `Rp${(value / 1_000_000).toFixed(0)}Jt`;
  }
  return `Rp${formatIdr(value)}`;
}

interface CompoundPoint {
  year: number;
  label: string;
  invested: number;
  portfolioValue: number;
  gain: number;
}

function CompoundTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: CompoundPoint }>;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const pt = payload[0].payload;
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm px-3.5 py-2.5 text-xs space-y-1 font-mono tabular-nums">
      <div className="font-semibold text-slate-900 dark:text-slate-100">{pt.label}</div>
      <div className="text-teal-700 dark:text-teal-400">
        Nilai Portofolio: <strong>Rp{formatIdr(pt.portfolioValue)}</strong>
      </div>
      <div className="text-slate-600 dark:text-slate-400">
        Total Modal Disetor: Rp{formatIdr(pt.invested)}
      </div>
      <div className="text-emerald-700 dark:text-emerald-400">
        Keuntungan: +Rp{formatIdr(pt.gain)}
      </div>
    </div>
  );
}

export function BeginnerAcademyView({
  stocks,
  selectedTicker,
  onEnsureStockLoaded,
  stockLoading,
  onSelectStock,
}: BeginnerAcademyViewProps) {
  const [subTab, setSubTab] = useState<AcademySubTab>('glossary');

  // --- Mini-Quiz State ---
  const [showQuiz, setShowQuiz] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, number>>({});

  // --- Paper Trading Simulator State ---
  const [portfolio, setPortfolio] = useState<SimPortfolioState>(() => {
    try {
      const raw = localStorage.getItem(SIM_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as SimPortfolioState;
        if (typeof parsed.cash === 'number' && parsed.positions) {
          return parsed;
        }
      }
    } catch {
      // Ignore invalid localStorage
    }
    return createDefaultPortfolio();
  });

  const [tradeTicker, setTradeTicker] = useState<string>(selectedTicker || 'BBCA');
  const [tradeSide, setTradeSide] = useState<'BELI' | 'JUAL'>('BELI');
  const [lotInput, setLotInput] = useState<number>(5);
  const [tradeNotice, setTradeNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  // --- Compounding / DCA Simulator State ---
  const [initialDeposit, setInitialDeposit] = useState<number>(5_000_000);
  const [monthlyDeposit, setMonthlyDeposit] = useState<number>(1_000_000);
  const [years, setYears] = useState<number>(10);
  const [annualReturnPct, setAnnualReturnPct] = useState<number>(10);
  const [adjustInflation, setAdjustInflation] = useState<boolean>(false);

  useEffect(() => {
    try {
      localStorage.setItem(SIM_STORAGE_KEY, JSON.stringify(portfolio));
    } catch {
      // Ignore storage failures
    }
  }, [portfolio]);

  // Ensure any tickers held in virtual portfolio have live quotes loaded
  useEffect(() => {
    const heldTickers = Object.keys(portfolio.positions);
    for (const t of heldTickers) {
      if (!stocks.some((s) => s.ticker === t)) {
        onEnsureStockLoaded(t);
      }
    }
  }, [portfolio.positions, stocks, onEnsureStockLoaded]);

  const quizScore = useMemo(() => {
    let correct = 0;
    for (const q of BEGINNER_QUIZ_QUESTIONS) {
      if (quizAnswers[q.id] === q.correctIndex) correct += 1;
    }
    return correct;
  }, [quizAnswers]);

  // --- Paper Trading Derived Metrics ---
  const activeStock = stocks.find((s) => s.ticker === tradeTicker) ?? null;
  const activePrice = activeStock && activeStock.isLive ? activeStock.price : 0;
  const lotPrice = activePrice * 100;
  const currentPosition = portfolio.positions[tradeTicker] ?? null;

  const grossOrderValue = lotPrice * Math.max(0, lotInput);
  const feeRate = tradeSide === 'BELI' ? BUY_FEE_RATE : SELL_FEE_RATE;
  const estimatedFee = Math.round(grossOrderValue * feeRate);
  const netOrderTotal =
    tradeSide === 'BELI' ? grossOrderValue + estimatedFee : Math.max(0, grossOrderValue - estimatedFee);

  const portfolioValuation = useMemo(() => {
    const holdings = Object.values(portfolio.positions).map((pos) => {
      const live = stocks.find((s) => s.ticker === pos.ticker);
      const marketPrice = live && live.isLive ? live.price : pos.avgPrice;
      const shares = pos.lots * 100;
      const costBasis = shares * pos.avgPrice;
      const marketValue = shares * marketPrice;
      const unrealizedPl = marketValue - costBasis;
      const unrealizedPlPct = costBasis > 0 ? (unrealizedPl / costBasis) * 100 : 0;
      return {
        ...pos,
        name: live?.name ?? pos.ticker,
        marketPrice,
        shares,
        costBasis,
        marketValue,
        unrealizedPl,
        unrealizedPlPct,
      };
    });

    const totalStockValue = holdings.reduce((acc, h) => acc + h.marketValue, 0);
    const totalAssetValue = portfolio.cash + totalStockValue;
    const totalPl = totalAssetValue - portfolio.initialCash;
    const totalPlPct = portfolio.initialCash > 0 ? (totalPl / portfolio.initialCash) * 100 : 0;

    return {
      holdings,
      totalStockValue,
      totalAssetValue,
      totalPl,
      totalPlPct,
    };
  }, [portfolio, stocks]);

  const handleSelectTradeTicker = (ticker: string) => {
    const clean = ticker.toUpperCase().replace('.JK', '').trim();
    setTradeTicker(clean);
    setTradeNotice(null);
    onEnsureStockLoaded(clean);
  };

  const handleExecuteSimulatedOrder = () => {
    setTradeNotice(null);
    if (!activeStock || !activeStock.isLive || activePrice <= 0) {
      setTradeNotice({
        type: 'err',
        text: `Harga live untuk ${tradeTicker} belum tersedia. Tunggu sebentar atau pilih emiten lain.`,
      });
      return;
    }

    const lots = Math.floor(lotInput);
    if (!Number.isFinite(lots) || lots <= 0) {
      setTradeNotice({ type: 'err', text: 'Jumlah lot minimal adalah 1 Lot (100 lembar).' });
      return;
    }

    const gross = activePrice * 100 * lots;

    if (tradeSide === 'BELI') {
      const fee = Math.round(gross * BUY_FEE_RATE);
      const totalDebit = gross + fee;
      if (totalDebit > portfolio.cash) {
        setTradeNotice({
          type: 'err',
          text: `Kas virtual tidak cukup. Dibutuhkan Rp${formatIdr(totalDebit)}, tersedia Rp${formatIdr(portfolio.cash)}.`,
        });
        return;
      }

      setPortfolio((prev) => {
        const existing = prev.positions[tradeTicker];
        const prevShares = (existing?.lots ?? 0) * 100;
        const addedShares = lots * 100;
        const newLots = (existing?.lots ?? 0) + lots;
        const newAvgPrice =
          prevShares > 0
            ? (prevShares * existing.avgPrice + addedShares * activePrice) / (prevShares + addedShares)
            : activePrice;

        const order: SimOrderRecord = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          timestampWib: formatWibNow(),
          side: 'BELI',
          ticker: tradeTicker,
          lots,
          price: activePrice,
          fee,
          netAmount: totalDebit,
        };

        return {
          ...prev,
          cash: prev.cash - totalDebit,
          positions: {
            ...prev.positions,
            [tradeTicker]: {
              ticker: tradeTicker,
              lots: newLots,
              avgPrice: Math.round(newAvgPrice),
            },
          },
          orders: [order, ...prev.orders].slice(0, 30),
        };
      });

      setTradeNotice({
        type: 'ok',
        text: `Berhasil simulasi BELI ${lots} Lot ${tradeTicker} @ Rp${formatIdr(activePrice)} (Total Rp${formatIdr(totalDebit)}).`,
      });
    } else {
      const existing = portfolio.positions[tradeTicker];
      if (!existing || existing.lots < lots) {
        setTradeNotice({
          type: 'err',
          text: `Kepemilikan ${tradeTicker} tidak cukup. Anda hanya memiliki ${existing?.lots ?? 0} Lot.`,
        });
        return;
      }

      const fee = Math.round(gross * SELL_FEE_RATE);
      const netProceeds = Math.max(0, gross - fee);

      setPortfolio((prev) => {
        const cur = prev.positions[tradeTicker];
        if (!cur) return prev;
        const remainingLots = cur.lots - lots;
        const nextPositions = { ...prev.positions };
        if (remainingLots <= 0) {
          delete nextPositions[tradeTicker];
        } else {
          nextPositions[tradeTicker] = { ...cur, lots: remainingLots };
        }

        const order: SimOrderRecord = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          timestampWib: formatWibNow(),
          side: 'JUAL',
          ticker: tradeTicker,
          lots,
          price: activePrice,
          fee,
          netAmount: netProceeds,
        };

        return {
          ...prev,
          cash: prev.cash + netProceeds,
          positions: nextPositions,
          orders: [order, ...prev.orders].slice(0, 30),
        };
      });

      setTradeNotice({
        type: 'ok',
        text: `Berhasil simulasi JUAL ${lots} Lot ${tradeTicker} @ Rp${formatIdr(activePrice)} (Diterima Rp${formatIdr(netProceeds)}).`,
      });
    }
  };

  const handleQuickMaxLots = (ratio: number) => {
    if (tradeSide === 'BELI') {
      if (lotPrice <= 0) return;
      const maxLots = Math.floor((portfolio.cash * ratio) / (lotPrice * (1 + BUY_FEE_RATE)));
      setLotInput(Math.max(1, maxLots));
    } else {
      const owned = currentPosition?.lots ?? 0;
      if (owned <= 0) return;
      setLotInput(Math.max(1, Math.floor(owned * ratio)));
    }
  };

  const handleResetPortfolio = () => {
    setPortfolio(createDefaultPortfolio());
    setConfirmReset(false);
    setTradeNotice({
      type: 'ok',
      text: 'Portofolio simulasi berhasil direset ke saldo awal Rp100.000.000.',
    });
  };

  // --- Compounding / DCA Calculation ---
  const compoundingSeries = useMemo(() => {
    const inflationPct = adjustInflation ? 3.5 : 0;
    const effectiveAnnualRate = (1 + annualReturnPct / 100) / (1 + inflationPct / 100) - 1;
    const monthlyRate = Math.pow(1 + effectiveAnnualRate, 1 / 12) - 1;

    const points: CompoundPoint[] = [
      {
        year: 0,
        label: 'Tahun 0',
        invested: initialDeposit,
        portfolioValue: initialDeposit,
        gain: 0,
      },
    ];

    let balance = initialDeposit;
    let totalInvested = initialDeposit;

    for (let y = 1; y <= years; y += 1) {
      for (let m = 0; m < 12; m += 1) {
        balance = balance * (1 + monthlyRate) + monthlyDeposit;
        totalInvested += monthlyDeposit;
      }
      const roundedBalance = Math.round(balance);
      const roundedInvested = Math.round(totalInvested);
      points.push({
        year: y,
        label: `Tahun ${y}`,
        invested: roundedInvested,
        portfolioValue: roundedBalance,
        gain: roundedBalance - roundedInvested,
      });
    }

    return points;
  }, [initialDeposit, monthlyDeposit, years, annualReturnPct, adjustInflation]);

  const finalCompound = compoundingSeries[compoundingSeries.length - 1];

  return (
    <div className="space-y-6">
      {/* Page Title & Sub-Tab Switcher */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100 text-balance">
            Akademi Pemula & Simulasi Investasi IDX
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Pelajari istilah pasar modal Indonesia, berlatih jual-beli saham tanpa risiko uang sungguhan, dan simulasikan pertumbuhan investasi jangka panjang.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg shrink-0">
          <button
            type="button"
            onClick={() => setSubTab('glossary')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              subTab === 'glossary'
                ? 'bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            Kamus Istilah IDX
          </button>
          <button
            type="button"
            onClick={() => setSubTab('trading')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              subTab === 'trading'
                ? 'bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            Simulasi Jual-Beli
          </button>
          <button
            type="button"
            onClick={() => setSubTab('compounding')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              subTab === 'compounding'
                ? 'bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            Simulasi Nabung & DCA
          </button>
        </div>
      </div>

      {/* ==================== TAB 1: PANEL INTERAKTIF ISTILAH & KUIS PEMULA ==================== */}
      {subTab === 'glossary' && (
        <div className="space-y-6">
          <InteractiveGlossaryPanel stocks={stocks} onSelectStock={onSelectStock} />

          {/* Beginner Quiz Action Strip */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-6 py-4 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Uji Pemahaman Istilah Pasar Modal IDX
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Latih pemahaman konsep Lot, PER/PBV, DER bank, DCA, dan RSI melalui 5 soal studi kasus singkat.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowQuiz((prev) => !prev)}
              className={`px-4 py-2 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                showQuiz
                  ? 'bg-teal-700 border-teal-700 text-white'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 hover:border-teal-600'
              }`}
            >
              {showQuiz ? 'Tutup Latihan Kuis' : 'Mulai Latihan Kuis Pemula (5 Soal)'}
            </button>
          </div>

          {/* Interactive Beginner Quiz */}
          {showQuiz && (
            <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
                <div>
                  <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                    Latihan Pemahaman Dasar Pasar Modal IDX
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Pilih jawaban yang paling tepat untuk menguji pemahaman istilah Lot, PER/PBV, DER, DCA, dan RSI.
                  </p>
                </div>
                <div className="flex items-center gap-3 text-xs font-mono tabular-nums">
                  <span className="text-slate-700 dark:text-slate-300 font-semibold">
                    Benar: {quizScore} / {BEGINNER_QUIZ_QUESTIONS.length}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQuizAnswers({})}
                    className="text-teal-700 dark:text-teal-400 hover:underline cursor-pointer"
                  >
                    Ulangi Kuis
                  </button>
                </div>
              </div>

              <div className="divide-y divide-slate-200 dark:divide-slate-800">
                {BEGINNER_QUIZ_QUESTIONS.map((q, idx) => {
                  const chosen = quizAnswers[q.id];
                  const answered = chosen !== undefined;
                  return (
                    <div key={q.id} className="py-4 first:pt-1 last:pb-1 space-y-3">
                      <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                        <span className="font-mono text-slate-400 mr-2">0{idx + 1}.</span>
                        {q.question}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {q.options.map((opt, optIdx) => {
                          const isSelected = chosen === optIdx;
                          const isCorrect = optIdx === q.correctIndex;
                          let style =
                            'border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/60 text-slate-800 dark:text-slate-200 hover:border-teal-600';
                          if (answered) {
                            if (isCorrect) {
                              style =
                                'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200';
                            } else if (isSelected) {
                              style =
                                'border-red-400 bg-red-50 dark:bg-red-950/40 text-red-900 dark:text-red-200';
                            } else {
                              style =
                                'border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-500 opacity-75';
                            }
                          }

                          return (
                            <button
                              key={optIdx}
                              type="button"
                              onClick={() =>
                                setQuizAnswers((prev) => ({ ...prev, [q.id]: optIdx }))
                              }
                              className={`px-3.5 py-2.5 text-left text-xs rounded-lg border transition-colors flex items-center justify-between gap-2 cursor-pointer ${style}`}
                            >
                              <span>{opt}</span>
                              {answered && isCorrect && (
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                              )}
                              {answered && isSelected && !isCorrect && (
                                <XCircle className="w-4 h-4 text-red-600 shrink-0" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                      {answered && (
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                          <strong className="text-slate-800 dark:text-slate-200">Pembahasan:</strong>{' '}
                          {q.explanation}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      )}

      {/* ==================== TAB 2: SIMULASI JUAL-BELI SAHAM (PAPER TRADING) ==================== */}
      {subTab === 'trading' && (
        <div className="space-y-6">
          {/* 4-Column Virtual Portfolio Valuation Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 dark:divide-slate-800">
            <div className="p-5">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Total Nilai Portofolio Virtual
              </div>
              <div className="text-xl font-semibold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-1">
                Rp{formatIdr(portfolioValuation.totalAssetValue)}
              </div>
              <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-1">
                Modal Awal: Rp{formatIdr(portfolio.initialCash)}
              </div>
            </div>

            <div className="p-5">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Sisa Kas Virtual Tersedia
              </div>
              <div className="text-xl font-semibold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-1">
                Rp{formatIdr(portfolio.cash)}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Siap dibelikan saham IDX
              </div>
            </div>

            <div className="p-5">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Total Nilai Saham Dimiliki
              </div>
              <div className="text-xl font-semibold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-1">
                Rp{formatIdr(portfolioValuation.totalStockValue)}
              </div>
              <div className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400 mt-1">
                {portfolioValuation.holdings.length} emiten aktif
              </div>
            </div>

            <div className="p-5 flex items-start justify-between gap-3">
              <div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Total Imbal Hasil Simulasi
                </div>
                <div
                  className={`text-xl font-semibold font-mono tabular-nums mt-1 ${getChangeColorClass(
                    portfolioValuation.totalPl
                  )}`}
                >
                  {portfolioValuation.totalPl >= 0 ? '+' : ''}
                  Rp{formatIdr(portfolioValuation.totalPl)}
                </div>
                <div
                  className={`text-xs font-mono tabular-nums mt-1 ${getChangeColorClass(
                    portfolioValuation.totalPlPct
                  )}`}
                >
                  {formatSignedPercent(portfolioValuation.totalPlPct)}
                </div>
              </div>

              {!confirmReset ? (
                <button
                  type="button"
                  onClick={() => setConfirmReset(true)}
                  title="Reset portofolio simulasi ke Rp100 Juta"
                  className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:border-slate-400 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              ) : (
                <div className="flex flex-col items-end gap-1">
                  <button
                    type="button"
                    onClick={handleResetPortfolio}
                    className="px-2.5 py-1 text-[11px] font-medium rounded-md bg-red-600 text-white cursor-pointer whitespace-nowrap"
                  >
                    Ya, Reset
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmReset(false)}
                    className="text-[11px] text-slate-500 hover:underline cursor-pointer"
                  >
                    Batal
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left: Realistic Order Execution Ticket */}
            <section className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5">
              <div className="pb-3 border-b border-slate-200 dark:border-slate-800">
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  Order Simulasi Saham BEI (1 Lot = 100 Lembar)
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Harga mengikuti kuotasi pasar IDX real-time tanpa risiko dana asli.
                </p>
              </div>

              <div className="space-y-3">
                <StockSearchBox
                  compact
                  currentTicker={tradeTicker}
                  onSelectTicker={handleSelectTradeTicker}
                  placeholder="Cari saham IDX untuk simulasi (BBCA, BRIS, PTBA...)"
                />
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  {['BBCA', 'BBRI', 'TLKM', 'ADRO', 'ANTM', 'BRIS'].map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => handleSelectTradeTicker(t)}
                      className={`px-2.5 py-1 font-mono rounded-md transition-colors cursor-pointer ${
                        tradeTicker === t
                          ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 font-medium'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Selected Stock Live Quote Box */}
              <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-mono font-semibold text-sm text-slate-900 dark:text-slate-100">
                    {tradeTicker}{' '}
                    <span className="font-sans font-normal text-xs text-slate-500 dark:text-slate-400">
                      {activeStock?.name ?? (stockLoading ? 'Memuat...' : '')}
                    </span>
                  </div>
                  <div className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400 mt-0.5">
                    1 Lot = Rp{activePrice > 0 ? formatIdr(lotPrice) : '—'} · Dimiliki:{' '}
                    <strong className="text-slate-800 dark:text-slate-200">
                      {currentPosition?.lots ?? 0} Lot
                    </strong>
                  </div>
                </div>
                <div className="text-right font-mono tabular-nums shrink-0">
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {activePrice > 0 ? `Rp${formatIdr(activePrice)}` : '—'}
                  </div>
                  {activeStock && (
                    <div className={`text-xs ${getChangeColorClass(activeStock.changePercent)}`}>
                      {formatSignedPercent(activeStock.changePercent)}
                    </div>
                  )}
                </div>
              </div>

              {/* Buy / Sell Toggle */}
              <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                <button
                  type="button"
                  onClick={() => {
                    setTradeSide('BELI');
                    setTradeNotice(null);
                  }}
                  className={`py-2 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                    tradeSide === 'BELI'
                      ? 'bg-emerald-700 text-white'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  Beli Saham (Buy)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTradeSide('JUAL');
                    setTradeNotice(null);
                  }}
                  className={`py-2 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                    tradeSide === 'JUAL'
                      ? 'bg-red-700 text-white'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  Jual Saham (Sell)
                </button>
              </div>

              {/* Lot Input */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <label
                    htmlFor="sim-lot-input"
                    className="font-medium text-slate-700 dark:text-slate-300"
                  >
                    Jumlah Lot ({Math.max(0, lotInput) * 100} lembar)
                  </label>
                  <div className="flex items-center gap-1.5 font-mono">
                    <button
                      type="button"
                      onClick={() => setLotInput(1)}
                      className="px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 hover:border-teal-600 text-slate-600 dark:text-slate-300 cursor-pointer"
                    >
                      1
                    </button>
                    <button
                      type="button"
                      onClick={() => setLotInput(5)}
                      className="px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 hover:border-teal-600 text-slate-600 dark:text-slate-300 cursor-pointer"
                    >
                      5
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickMaxLots(0.25)}
                      className="px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 hover:border-teal-600 text-slate-600 dark:text-slate-300 cursor-pointer"
                    >
                      25%
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickMaxLots(0.5)}
                      className="px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 hover:border-teal-600 text-slate-600 dark:text-slate-300 cursor-pointer"
                    >
                      50%
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickMaxLots(1)}
                      className="px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 hover:border-teal-600 text-slate-600 dark:text-slate-300 cursor-pointer"
                    >
                      Maks
                    </button>
                  </div>
                </div>
                <input
                  id="sim-lot-input"
                  type="number"
                  min={1}
                  step={1}
                  value={lotInput}
                  onChange={(e) => setLotInput(Math.max(1, Number(e.target.value) || 1))}
                  className="w-full px-3.5 py-2.5 text-sm font-mono tabular-nums rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-teal-600"
                />
              </div>

              {/* Order Summary Breakdown */}
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2 text-xs font-mono tabular-nums">
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Nilai Transaksi Bruto</span>
                  <span>Rp{formatIdr(grossOrderValue)}</span>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>
                    Estimasi Biaya Broker ({tradeSide === 'BELI' ? '0,15%' : '0,25% + PPh'})
                  </span>
                  <span>Rp{formatIdr(estimatedFee)}</span>
                </div>
                <div className="flex justify-between text-sm font-semibold text-slate-900 dark:text-slate-100 pt-1 border-t border-slate-100 dark:border-slate-800">
                  <span>{tradeSide === 'BELI' ? 'Total Dibayar' : 'Estimasi Diterima'}</span>
                  <span>Rp{formatIdr(netOrderTotal)}</span>
                </div>
              </div>

              {tradeNotice && (
                <div
                  className={`p-3 rounded-lg border text-xs ${
                    tradeNotice.type === 'ok'
                      ? 'border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300'
                      : 'border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-300'
                  }`}
                >
                  {tradeNotice.text}
                </div>
              )}

              <button
                type="button"
                onClick={handleExecuteSimulatedOrder}
                disabled={activePrice <= 0}
                className={`w-full py-2.5 px-4 text-sm font-semibold rounded-lg text-white transition-colors disabled:opacity-50 cursor-pointer ${
                  tradeSide === 'BELI'
                    ? 'bg-emerald-700 hover:bg-emerald-800'
                    : 'bg-red-700 hover:bg-red-800'
                }`}
              >
                {tradeSide === 'BELI'
                  ? `Eksekusi Simulasi Beli ${lotInput} Lot ${tradeTicker}`
                  : `Eksekusi Simulasi Jual ${lotInput} Lot ${tradeTicker}`}
              </button>
            </section>

            {/* Right: Holdings Table & Order History */}
            <div className="lg:col-span-7 space-y-6">
              {/* Virtual Holdings */}
              <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                      Kepemilikan Saham Virtual
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Valuasi bergerak mengikuti harga pasar live IDX
                    </p>
                  </div>
                  <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                    {portfolioValuation.holdings.length} posisi
                  </span>
                </div>

                {portfolioValuation.holdings.length === 0 ? (
                  <div className="p-6 text-sm text-slate-500 dark:text-slate-400">
                    Portofolio simulasi masih kosong. Pilih emiten di panel sebelah kiri (mis. BBCA atau TLKM) dan lakukan pembelian pertama Anda dengan saldo virtual Rp100.000.000.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 text-xs font-medium text-slate-500 dark:text-slate-400">
                          <th className="py-3 pl-6 pr-3">Emiten</th>
                          <th className="py-3 px-3 text-right">Lot</th>
                          <th className="py-3 px-3 text-right">Harga Rata-rata</th>
                          <th className="py-3 px-3 text-right">Harga Pasar</th>
                          <th className="py-3 px-3 text-right">Untung/Rugi</th>
                          <th className="py-3 pl-3 pr-6 text-right">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                        {portfolioValuation.holdings.map((h) => (
                          <tr key={h.ticker} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30">
                            <td className="py-3 pl-6 pr-3">
                              <button
                                type="button"
                                onClick={() => onSelectStock(h.ticker)}
                                className="font-mono font-semibold text-slate-900 dark:text-slate-100 hover:text-teal-700 dark:hover:text-teal-400 cursor-pointer"
                              >
                                {h.ticker}
                              </button>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[140px]">
                                {h.name}
                              </div>
                            </td>
                            <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-800 dark:text-slate-200">
                              {h.lots}
                            </td>
                            <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-600 dark:text-slate-400">
                              Rp{formatIdr(h.avgPrice)}
                            </td>
                            <td className="py-3 px-3 text-right font-mono tabular-nums font-medium text-slate-900 dark:text-slate-100">
                              Rp{formatIdr(h.marketPrice)}
                            </td>
                            <td
                              className={`py-3 px-3 text-right font-mono tabular-nums font-semibold ${getChangeColorClass(
                                h.unrealizedPl
                              )}`}
                            >
                              <div>
                                {h.unrealizedPl >= 0 ? '+' : ''}Rp{formatIdr(h.unrealizedPl)}
                              </div>
                              <div className="text-[11px] font-normal">
                                {formatSignedPercent(h.unrealizedPlPct)}
                              </div>
                            </td>
                            <td className="py-3 pl-3 pr-6 text-right">
                              <button
                                type="button"
                                onClick={() => {
                                  handleSelectTradeTicker(h.ticker);
                                  setTradeSide('JUAL');
                                  setLotInput(h.lots);
                                }}
                                className="px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700 hover:border-red-500 text-slate-700 dark:text-slate-300 cursor-pointer"
                              >
                                Jual
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              {/* Simulated Order History */}
              <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
                  <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                    Riwayat Transaksi Simulasi
                  </h2>
                  <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                    {portfolio.orders.length} transaksi
                  </span>
                </div>

                {portfolio.orders.length === 0 ? (
                  <div className="p-6 text-xs text-slate-500 dark:text-slate-400">
                    Belum ada transaksi simulasi yang dieksekusi.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-200 dark:divide-slate-800">
                    {portfolio.orders.slice(0, 12).map((ord) => (
                      <div
                        key={ord.id}
                        className="px-6 py-3 flex flex-wrap items-center justify-between gap-3 text-xs font-mono tabular-nums"
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={`font-semibold ${
                              ord.side === 'BELI'
                                ? 'text-emerald-700 dark:text-emerald-400'
                                : 'text-red-700 dark:text-red-400'
                            }`}
                          >
                            {ord.side}
                          </span>
                          <span className="font-semibold text-slate-900 dark:text-slate-100">
                            {ord.ticker}
                          </span>
                          <span className="text-slate-500 dark:text-slate-400">
                            {ord.lots} Lot @ Rp{formatIdr(ord.price)}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-right">
                          <span className="text-slate-800 dark:text-slate-200 font-medium">
                            Rp{formatIdr(ord.netAmount)}
                          </span>
                          <span className="text-[11px] text-slate-400">{ord.timestampWib}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </div>
        </div>
      )}

      {/* ==================== TAB 3: SIMULASI NABUNG & COMPOUNDING (DCA) ==================== */}
      {subTab === 'compounding' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Zone (65%): Chart & Result Outcomes */}
          <section className="lg:col-span-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  Proyeksi Nabung Saham Rutin (DCA) & Efek Compounding
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Perbandingan total modal yang Anda setor vs pertumbuhan nilai aset selama {years} tahun
                  {adjustInflation ? ' (disesuaikan inflasi 3,5%/tahun)' : ''}.
                </p>
              </div>
              <span className="text-xs font-mono tabular-nums text-teal-700 dark:text-teal-400 font-semibold">
                Asumsi Return: {annualReturnPct}% / tahun
              </span>
            </div>

            {/* 3-Column Outcome Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-3 border border-slate-200 dark:border-slate-800 rounded-lg divide-y sm:divide-y-0 sm:divide-x divide-slate-200 dark:divide-slate-800">
              <div className="p-4">
                <div className="text-xs text-slate-500 dark:text-slate-400">Total Modal Disetor</div>
                <div className="text-lg font-semibold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-1">
                  Rp{formatIdr(finalCompound.invested)}
                </div>
              </div>
              <div className="p-4">
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Estimasi Keuntungan Compounding
                </div>
                <div className="text-lg font-semibold font-mono tabular-nums text-emerald-700 dark:text-emerald-400 mt-1">
                  +Rp{formatIdr(finalCompound.gain)}
                </div>
              </div>
              <div className="p-4">
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Estimasi Nilai Akhir ({years} Tahun)
                </div>
                <div className="text-lg font-semibold font-mono tabular-nums text-teal-700 dark:text-teal-400 mt-1">
                  Rp{formatIdr(finalCompound.portfolioValue)}
                </div>
              </div>
            </div>

            {/* Recharts Area Chart */}
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={compoundingSeries}
                  margin={{ top: 10, right: 16, left: 6, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.22} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={formatMillionShort}
                    width={64}
                  />
                  <Tooltip content={<CompoundTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="portfolioValue"
                    name="Nilai Portofolio"
                    stroke="#0f766e"
                    strokeWidth={2}
                    fill="#0f766e"
                    fillOpacity={0.18}
                  />
                  <Area
                    type="monotone"
                    dataKey="invested"
                    name="Modal Disetor"
                    stroke="#64748b"
                    strokeWidth={1.75}
                    strokeDasharray="4 4"
                    fill="#64748b"
                    fillOpacity={0.08}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="flex flex-wrap items-center gap-6 text-xs text-slate-600 dark:text-slate-400">
              <div className="flex items-center gap-2">
                <span className="w-3 h-0.5 bg-teal-700 inline-block" />
                <span>Estimasi Nilai Portofolio (Modal + Return Compounding)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-0.5 bg-slate-500 inline-block border-b border-dashed" />
                <span>Total Modal Pokok Disetor</span>
              </div>
            </div>
          </section>

          {/* Right Zone (35%): Labeled Simulation Sliders */}
          <section className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5">
            <div className="pb-3 border-b border-slate-200 dark:border-slate-800">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Parameter Simulasi Investasi
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Geser pengatur di bawah untuk menguji berbagai skenario menabung saham.
              </p>
            </div>

            {/* Modal Awal */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <label htmlFor="sim-init-deposit" className="font-medium text-slate-700 dark:text-slate-300">
                  Modal Awal
                </label>
                <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100">
                  Rp{formatIdr(initialDeposit)}
                </span>
              </div>
              <input
                id="sim-init-deposit"
                type="range"
                min={0}
                max={100_000_000}
                step={1_000_000}
                value={initialDeposit}
                onChange={(e) => setInitialDeposit(Number(e.target.value))}
                className="w-full accent-teal-700 cursor-pointer"
              />
              <div className="flex flex-wrap gap-1.5 text-[11px] font-mono">
                {[0, 5_000_000, 10_000_000, 25_000_000].map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setInitialDeposit(v)}
                    className={`px-2 py-0.5 rounded border cursor-pointer ${
                      initialDeposit === v
                        ? 'border-teal-600 text-teal-700 dark:text-teal-400 font-semibold'
                        : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {v === 0 ? 'Rp0' : `Rp${v / 1_000_000} Jt`}
                  </button>
                ))}
              </div>
            </div>

            {/* Setoran Rutin Bulanan */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <label htmlFor="sim-monthly" className="font-medium text-slate-700 dark:text-slate-300">
                  Nabung Rutin / Bulan (DCA)
                </label>
                <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100">
                  Rp{formatIdr(monthlyDeposit)}
                </span>
              </div>
              <input
                id="sim-monthly"
                type="range"
                min={0}
                max={20_000_000}
                step={250_000}
                value={monthlyDeposit}
                onChange={(e) => setMonthlyDeposit(Number(e.target.value))}
                className="w-full accent-teal-700 cursor-pointer"
              />
            </div>

            {/* Jangka Waktu */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <label htmlFor="sim-years" className="font-medium text-slate-700 dark:text-slate-300">
                  Durasi Investasi
                </label>
                <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100">
                  {years} Tahun
                </span>
              </div>
              <input
                id="sim-years"
                type="range"
                min={1}
                max={25}
                step={1}
                value={years}
                onChange={(e) => setYears(Number(e.target.value))}
                className="w-full accent-teal-700 cursor-pointer"
              />
            </div>

            {/* Asumsi Imbal Hasil Tahunan */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <label htmlFor="sim-return" className="font-medium text-slate-700 dark:text-slate-300">
                  Estimasi Return / Tahun
                </label>
                <span className="font-mono tabular-nums font-semibold text-teal-700 dark:text-teal-400">
                  {annualReturnPct.toFixed(1)}% / thn
                </span>
              </div>
              <input
                id="sim-return"
                type="range"
                min={2}
                max={22}
                step={0.5}
                value={annualReturnPct}
                onChange={(e) => setAnnualReturnPct(Number(e.target.value))}
                className="w-full accent-teal-700 cursor-pointer"
              />
              <div className="flex flex-wrap gap-1.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => setAnnualReturnPct(6)}
                  className="px-2 py-1 rounded border border-slate-200 dark:border-slate-700 hover:border-teal-600 text-slate-600 dark:text-slate-300 cursor-pointer"
                >
                  Konservatif (6%)
                </button>
                <button
                  type="button"
                  onClick={() => setAnnualReturnPct(10)}
                  className="px-2 py-1 rounded border border-slate-200 dark:border-slate-700 hover:border-teal-600 text-slate-600 dark:text-slate-300 cursor-pointer"
                >
                  Moderat IHSG (10%)
                </button>
                <button
                  type="button"
                  onClick={() => setAnnualReturnPct(15)}
                  className="px-2 py-1 rounded border border-slate-200 dark:border-slate-700 hover:border-teal-600 text-slate-600 dark:text-slate-300 cursor-pointer"
                >
                  Agresif (15%)
                </button>
              </div>
            </div>

            {/* Inflation Adjustment */}
            <label className="flex items-start gap-2.5 pt-2 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
              <input
                type="checkbox"
                checked={adjustInflation}
                onChange={(e) => setAdjustInflation(e.target.checked)}
                className="mt-0.5 accent-teal-700"
              />
              <span>
                Hitung nilai daya beli riil setelah dipotong estimasi inflasi <strong>3,5% / tahun</strong>
              </span>
            </label>

            <div className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed pt-1">
              Simulasi bersifat matematis edukatif. Kinerja saham di bursa berfluktuasi dan tidak selalu linier setiap tahunnya.
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
