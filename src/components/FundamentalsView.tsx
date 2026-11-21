import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { AiStockDiagnosis, LiveStockQuote } from '../types';
import {
  formatBillionIdr,
  formatIdr,
  formatSignedPercent,
  getChangeColorClass,
} from '../utils/formatters';
import { StockSearchBox } from './StockSearchBox';
import { AiStockDiagnosisPanel } from './AiStockDiagnosisPanel';
import { ValuationMosPanel } from './ValuationMosPanel';
import { CompanyBusinessProfilePanel } from './CompanyBusinessProfilePanel';

interface FundamentalsViewProps {
  stocks: LiveStockQuote[];
  selectedTicker: string;
  onSelectTicker: (ticker: string) => void;
  stockLoading: boolean;
  stockError: string | null;
  onOpenChart: (ticker: string) => void;
  aiDiagnosis: AiStockDiagnosis | null;
  aiDiagnosisLoading: boolean;
  aiDiagnosisError: string | null;
  onRunAiDiagnosis: (forceRefresh?: boolean) => void;
}

type StatementTab = 'income' | 'balance' | 'cashflow';
type PeriodGranularity = 'quarterly' | 'annual';

export function FundamentalsView({
  stocks,
  selectedTicker,
  onSelectTicker,
  stockLoading,
  stockError,
  onOpenChart,
  aiDiagnosis,
  aiDiagnosisLoading,
  aiDiagnosisError,
  onRunAiDiagnosis,
}: FundamentalsViewProps) {
  const [statementTab, setStatementTab] = useState<StatementTab>('income');
  const [periodGranularity, setPeriodGranularity] = useState<PeriodGranularity>('quarterly');
  const stock = stocks.find((s) => s.ticker === selectedTicker) ?? null;

  if (stockLoading && !stock) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8 flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
        <Loader2 className="w-4 h-4 animate-spin text-teal-600" />
        <span>Mengambil laporan keuangan & rasio valuasi {selectedTicker}.JK...</span>
      </div>
    );
  }

  if (!stock) {
    return (
      <div className="space-y-4">
        <div className="max-w-md">
          <StockSearchBox onSelectTicker={onSelectTicker} currentTicker={selectedTicker} />
        </div>
        {stockError ? (
          <div className="p-4 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/30 text-sm text-red-800 dark:text-red-300">
            {stockError}
          </div>
        ) : (
          <div className="p-8 text-sm text-slate-500 dark:text-slate-400">
            Pilih atau cari kode saham IDX untuk melihat laporan keuangan dan valuasi.
          </div>
        )}
      </div>
    );
  }

  const quarterlyPeriods = stock.financials ?? [];
  const annualPeriods = stock.annualFinancials ?? [];
  const effectiveGranularity: PeriodGranularity =
    periodGranularity === 'annual' && annualPeriods.length > 0
      ? 'annual'
      : quarterlyPeriods.length > 0
      ? 'quarterly'
      : 'annual';
  const periods = effectiveGranularity === 'annual' ? annualPeriods : quarterlyPeriods;
  const maxRevenue = Math.max(...periods.map((p) => p.revenueB ?? 0), 1);
  const maxNetIncome = Math.max(...periods.map((p) => Math.abs(p.netIncomeB ?? 0)), 1);

  return (
    <div className="space-y-6">
      {/* Header & Universal Stock Search */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
            Analisis Fundamental & Laporan Keuangan
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Valuasi otomatis berdasarkan harga pasar terkini dibandingkan dengan laporan keuangan ({stock.reportPeriodLabel}).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="w-full sm:w-80">
            <StockSearchBox
              onSelectTicker={onSelectTicker}
              currentTicker={stock.ticker}
              compact
              placeholder="Cari emiten IDX lain (mis. BRIS, PTBA)..."
            />
          </div>
          <button
            type="button"
            onClick={() => onOpenChart(stock.ticker)}
            className="px-3.5 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 hover:border-teal-600 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Buka Grafik Saham
          </button>
        </div>
      </div>

      {/* Auto-Valuation Dashboard */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Dashboard Valuasi Otomatis — {stock.ticker} ({stock.name})
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Harga pasar Rp{formatIdr(stock.price)} · Sektor {stock.sector} · Basis {stock.reportPeriodLabel}
            </p>
          </div>
          <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
            Update {stock.updatedAtWib} WIB
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-6 pt-5">
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400">PER (TTM)</div>
            <div className="text-lg font-semibold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-1">
              {stock.per > 0 ? `${stock.per.toFixed(2)}x` : '—'}
            </div>
            <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-0.5">
              EPS {stock.epsTtm !== 0 ? `Rp${formatIdr(stock.epsTtm)}` : '—'}
            </div>
          </div>

          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400">PBV</div>
            <div className="text-lg font-semibold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-1">
              {stock.pbv > 0 ? `${stock.pbv.toFixed(2)}x` : '—'}
            </div>
            <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-0.5">
              BVPS {stock.bvps > 0 ? `Rp${formatIdr(stock.bvps)}` : '—'}
            </div>
          </div>

          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Dividen Yield</div>
            <div className="text-lg font-semibold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-1">
              {stock.dividendYield > 0 ? `${stock.dividendYield.toFixed(2)}%` : '0,00%'}
            </div>
            <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-0.5">
              DPS {stock.dps > 0 ? `Rp${formatIdr(stock.dps)}` : '—'}
            </div>
          </div>

          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400">ROE</div>
            <div className="text-lg font-semibold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-1">
              {stock.roe !== 0 ? `${stock.roe.toFixed(1)}%` : '—'}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Return on Equity
            </div>
          </div>

          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400">DER</div>
            <div className="text-lg font-semibold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-1">
              {stock.der > 0 ? `${stock.der.toFixed(2)}x` : '—'}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Debt to Equity
            </div>
          </div>

          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Pendapatan YoY</div>
            <div
              className={`text-lg font-semibold font-mono tabular-nums mt-1 ${getChangeColorClass(
                stock.revenueGrowthYoY
              )}`}
            >
              {stock.revenueGrowthYoY !== 0 ? formatSignedPercent(stock.revenueGrowthYoY) : '—'}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Pertumbuhan Kuartal
            </div>
          </div>

          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Laba Bersih YoY</div>
            <div
              className={`text-lg font-semibold font-mono tabular-nums mt-1 ${getChangeColorClass(
                stock.netProfitGrowthYoY
              )}`}
            >
              {stock.netProfitGrowthYoY !== 0 ? formatSignedPercent(stock.netProfitGrowthYoY) : '—'}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Pertumbuhan Kuartal
            </div>
          </div>
        </div>
      </section>

      {/* Business Model, Profit Drivers, Products & 3-5 Year Growth */}
      <CompanyBusinessProfilePanel stock={stock} />

      {/* Live Dividend Yield, Margin of Safety & Future Value Calculator */}
      <ValuationMosPanel stock={stock} />

      {/* AI Financial Health, Strategic Advice & Risk Projection */}
      <AiStockDiagnosisPanel
        ticker={stock.ticker}
        stockName={stock.name}
        diagnosis={aiDiagnosis}
        loading={aiDiagnosisLoading}
        error={aiDiagnosisError}
        onRunDiagnosis={onRunAiDiagnosis}
      />

      {periods.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8 text-sm text-slate-600 dark:text-slate-400">
          Rincian tabel laporan keuangan kuartalan untuk emiten <strong>{stock.ticker}</strong> belum dipublikasikan dalam umpan data timeseries, namun rasio valuasi dan data harga terkini tetap dapat dianalisis di atas serta pada grafik teknikal.
        </div>
      ) : (
        <>
          {/* Period Granularity Switcher */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Rincian Laporan Keuangan ({effectiveGranularity === 'annual' ? 'Tahunan 3–5 Tahun' : 'Kuartalan Terkini'})
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Pilih rentang periode untuk meninjau tren pertumbuhan dan pos laporan resmi.
              </p>
            </div>
            {quarterlyPeriods.length > 0 && annualPeriods.length > 0 && (
              <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                <button
                  type="button"
                  onClick={() => setPeriodGranularity('quarterly')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    effectiveGranularity === 'quarterly'
                      ? 'bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  Kuartalan
                </button>
                <button
                  type="button"
                  onClick={() => setPeriodGranularity('annual')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    effectiveGranularity === 'annual'
                      ? 'bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  Tahunan (3–5 Thn)
                </button>
              </div>
            )}
          </div>

          {/* YoY Growth Visual Trajectory */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">
                {effectiveGranularity === 'annual'
                  ? 'Tren Pendapatan Tahunan (Miliar / Triliun IDR)'
                  : 'Tren Pendapatan Kuartalan (Miliar / Triliun IDR)'}
              </h3>
              <div className="space-y-3">
                {periods.map((p) => (
                  <div key={p.period} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono text-slate-600 dark:text-slate-400">{p.period}</span>
                      <span className="font-mono tabular-nums font-medium text-slate-900 dark:text-slate-100">
                        {formatBillionIdr(p.revenueB)}
                      </span>
                    </div>
                    <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-slate-800 dark:bg-slate-300 rounded-full"
                        style={{
                          width: `${p.revenueB !== null ? Math.max(8, (Math.abs(p.revenueB) / maxRevenue) * 100) : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">
                {effectiveGranularity === 'annual'
                  ? 'Tren Laba Bersih Tahunan (Miliar / Triliun IDR)'
                  : 'Tren Laba Bersih Kuartalan (Miliar / Triliun IDR)'}
              </h3>
              <div className="space-y-3">
                {periods.map((p) => (
                  <div key={p.period} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono text-slate-600 dark:text-slate-400">{p.period}</span>
                      <span
                        className={`font-mono tabular-nums font-medium ${getChangeColorClass(
                          p.netIncomeB
                        )}`}
                      >
                        {formatBillionIdr(p.netIncomeB)}
                      </span>
                    </div>
                    <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          (p.netIncomeB ?? 0) >= 0 ? 'bg-teal-600 dark:bg-teal-500' : 'bg-red-600'
                        }`}
                        style={{
                          width: `${
                            p.netIncomeB !== null
                              ? Math.max(8, (Math.abs(p.netIncomeB) / maxNetIncome) * 100)
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Structured Financial Statement Tables */}
          <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                <button
                  type="button"
                  onClick={() => setStatementTab('income')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    statementTab === 'income'
                      ? 'bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  Laba Rugi
                </button>
                <button
                  type="button"
                  onClick={() => setStatementTab('balance')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    statementTab === 'balance'
                      ? 'bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  Neraca
                </button>
                <button
                  type="button"
                  onClick={() => setStatementTab('cashflow')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    statementTab === 'cashflow'
                      ? 'bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  Arus Kas
                </button>
              </div>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {effectiveGranularity === 'annual'
                  ? 'Seluruh angka dalam Miliar / Triliun Rupiah (Laporan Tahunan FY)'
                  : 'Seluruh angka dalam Miliar / Triliun Rupiah (End-of-Day Kuartalan)'}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 text-xs font-medium text-slate-500 dark:text-slate-400">
                    <th className="py-3 pl-6 pr-4">Pos Laporan Keuangan</th>
                    {periods.map((p) => (
                      <th key={p.period} className="py-3 px-4 text-right font-mono tabular-nums">
                        {p.period}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                  {statementTab === 'income' && (
                    <>
                      <tr>
                        <td className="py-3 pl-6 pr-4 font-medium text-slate-900 dark:text-slate-100">
                          Pendapatan Usaha
                        </td>
                        {periods.map((p) => (
                          <td key={p.period} className="py-3 px-4 text-right font-mono tabular-nums text-slate-800 dark:text-slate-200">
                            {formatBillionIdr(p.revenueB)}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="py-3 pl-6 pr-4 font-medium text-slate-900 dark:text-slate-100">
                          Laba Kotor
                        </td>
                        {periods.map((p) => (
                          <td key={p.period} className="py-3 px-4 text-right font-mono tabular-nums text-slate-800 dark:text-slate-200">
                            {formatBillionIdr(p.grossProfitB)}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="py-3 pl-6 pr-4 font-medium text-slate-900 dark:text-slate-100">
                          Laba Operasional
                        </td>
                        {periods.map((p) => (
                          <td key={p.period} className="py-3 px-4 text-right font-mono tabular-nums text-slate-800 dark:text-slate-200">
                            {formatBillionIdr(p.operatingIncomeB)}
                          </td>
                        ))}
                      </tr>
                      <tr className="bg-slate-50/50 dark:bg-slate-950/30">
                        <td className="py-3 pl-6 pr-4 font-semibold text-slate-900 dark:text-slate-100">
                          Laba Bersih Tahun Berjalan
                        </td>
                        {periods.map((p) => (
                          <td
                            key={p.period}
                            className={`py-3 px-4 text-right font-mono tabular-nums font-semibold ${getChangeColorClass(
                              p.netIncomeB
                            )}`}
                          >
                            {formatBillionIdr(p.netIncomeB)}
                          </td>
                        ))}
                      </tr>
                    </>
                  )}

                  {statementTab === 'balance' && (
                    <>
                      <tr>
                        <td className="py-3 pl-6 pr-4 font-medium text-slate-900 dark:text-slate-100">
                          Total Aset
                        </td>
                        {periods.map((p) => (
                          <td key={p.period} className="py-3 px-4 text-right font-mono tabular-nums text-slate-800 dark:text-slate-200">
                            {formatBillionIdr(p.totalAssetsB)}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="py-3 pl-6 pr-4 font-medium text-slate-900 dark:text-slate-100">
                          Total Liabilitas
                        </td>
                        {periods.map((p) => (
                          <td key={p.period} className="py-3 px-4 text-right font-mono tabular-nums text-slate-800 dark:text-slate-200">
                            {formatBillionIdr(p.totalLiabilitiesB)}
                          </td>
                        ))}
                      </tr>
                      <tr className="bg-slate-50/50 dark:bg-slate-950/30">
                        <td className="py-3 pl-6 pr-4 font-semibold text-slate-900 dark:text-slate-100">
                          Total Ekuitas
                        </td>
                        {periods.map((p) => (
                          <td key={p.period} className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100">
                            {formatBillionIdr(p.totalEquityB)}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="py-3 pl-6 pr-4 font-medium text-slate-900 dark:text-slate-100">
                          Kas & Setara Kas
                        </td>
                        {periods.map((p) => (
                          <td key={p.period} className="py-3 px-4 text-right font-mono tabular-nums text-slate-800 dark:text-slate-200">
                            {formatBillionIdr(p.cashAndEquivalentsB)}
                          </td>
                        ))}
                      </tr>
                    </>
                  )}

                  {statementTab === 'cashflow' && (
                    <>
                      <tr>
                        <td className="py-3 pl-6 pr-4 font-medium text-slate-900 dark:text-slate-100">
                          Arus Kas Operasi
                        </td>
                        {periods.map((p) => (
                          <td key={p.period} className="py-3 px-4 text-right font-mono tabular-nums text-slate-800 dark:text-slate-200">
                            {formatBillionIdr(p.operatingCashFlowB)}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="py-3 pl-6 pr-4 font-medium text-slate-900 dark:text-slate-100">
                          Belanja Modal (CapEx)
                        </td>
                        {periods.map((p) => (
                          <td key={p.period} className="py-3 px-4 text-right font-mono tabular-nums text-slate-600 dark:text-slate-400">
                            {formatBillionIdr(p.capexB)}
                          </td>
                        ))}
                      </tr>
                      <tr className="bg-slate-50/50 dark:bg-slate-950/30">
                        <td className="py-3 pl-6 pr-4 font-semibold text-slate-900 dark:text-slate-100">
                          Arus Kas Bebas (Free Cash Flow)
                        </td>
                        {periods.map((p) => (
                          <td
                            key={p.period}
                            className={`py-3 px-4 text-right font-mono tabular-nums font-semibold ${getChangeColorClass(
                              p.freeCashFlowB
                            )}`}
                          >
                            {formatBillionIdr(p.freeCashFlowB)}
                          </td>
                        ))}
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
