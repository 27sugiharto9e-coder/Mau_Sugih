import { RefreshCw } from 'lucide-react';
import type {
  AiStockDiagnosis,
  FinancialHealthStatus,
  PillarStatus,
  RecommendationAction,
  RiskSeverity,
  ValuationVerdict,
} from '../types';

interface AiStockDiagnosisPanelProps {
  ticker: string;
  stockName?: string;
  diagnosis: AiStockDiagnosis | null;
  loading: boolean;
  error: string | null;
  onRunDiagnosis: (forceRefresh?: boolean) => void;
}

function getHealthClass(status: FinancialHealthStatus): string {
  switch (status) {
    case 'Sangat Sehat':
    case 'Sehat':
      return 'text-emerald-700 dark:text-emerald-400';
    case 'Waspada':
      return 'text-amber-700 dark:text-amber-400';
    case 'Rentan':
      return 'text-red-700 dark:text-red-400';
    default:
      return 'text-slate-700 dark:text-slate-300';
  }
}

function getValuationClass(verdict: ValuationVerdict): string {
  switch (verdict) {
    case 'Undervalued':
      return 'text-emerald-700 dark:text-emerald-400';
    case 'Wajar (Fair Value)':
      return 'text-teal-700 dark:text-teal-400';
    case 'Premium / Overvalued':
      return 'text-amber-700 dark:text-amber-400';
    default:
      return 'text-slate-600 dark:text-slate-400';
  }
}

function getActionClass(action: RecommendationAction): string {
  switch (action) {
    case 'Akumulasi Bertahap':
      return 'text-emerald-700 dark:text-emerald-400';
    case 'Tahan / Pantau':
      return 'text-sky-700 dark:text-sky-400';
    case 'Tunggu Koreksi':
      return 'text-amber-700 dark:text-amber-400';
    case 'Hati-hati / Hindari':
      return 'text-red-700 dark:text-red-400';
    default:
      return 'text-slate-700 dark:text-slate-300';
  }
}

function getPillarStatusClass(status: PillarStatus): string {
  switch (status) {
    case 'Kuat':
      return 'text-emerald-700 dark:text-emerald-400';
    case 'Cukup':
      return 'text-amber-700 dark:text-amber-400';
    case 'Perlu Perhatian':
      return 'text-red-700 dark:text-red-400';
    default:
      return 'text-slate-600 dark:text-slate-400';
  }
}

function getRiskSeverityClass(severity: RiskSeverity): string {
  switch (severity) {
    case 'Tinggi':
      return 'text-red-700 dark:text-red-400';
    case 'Sedang':
      return 'text-amber-700 dark:text-amber-400';
    case 'Rendah':
      return 'text-emerald-700 dark:text-emerald-400';
    default:
      return 'text-slate-600 dark:text-slate-400';
  }
}

export function AiStockDiagnosisPanel({
  ticker,
  stockName,
  diagnosis,
  loading,
  error,
  onRunDiagnosis,
}: AiStockDiagnosisPanelProps) {
  return (
    <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
      {/* Header & CTA */}
      <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Kesimpulan Kesehatan Fundamental, Saran & Proyeksi Risiko AI — {ticker}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {diagnosis
              ? `${diagnosis.dataBasisNote} · Disusun pukul ${diagnosis.generatedAtWib} WIB`
              : `Audit terpadu atas laporan keuangan kuartalan, rasio valuasi, posisi teknikal 3 bulan, dan faktor risiko ${stockName ? `${stockName} (${ticker})` : ticker}.`}
          </p>
        </div>

        <button
          type="button"
          onClick={() => onRunDiagnosis(Boolean(diagnosis))}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg bg-teal-700 hover:bg-teal-800 disabled:opacity-60 text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>
            {loading
              ? 'Menganalisis Data...'
              : diagnosis
              ? 'Perbarui Analisis AI'
              : 'Analisis Kesehatan & Risiko AI'}
          </span>
        </button>
      </div>

      {error && (
        <div className="mt-4 p-4 rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50/70 dark:bg-red-950/30 text-xs text-red-800 dark:text-red-300">
          <strong className="font-semibold">Gagal memproses analisis AI:</strong> {error}
        </div>
      )}

      {loading && !diagnosis ? (
        <div className="mt-5 space-y-4 animate-pulse">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-28 rounded-lg bg-slate-100 dark:bg-slate-800/60" />
            ))}
          </div>
          <div className="h-40 rounded-lg bg-slate-100 dark:bg-slate-800/60" />
        </div>
      ) : !diagnosis ? (
        <div className="py-7 space-y-3">
          <p className="text-sm text-slate-600 dark:text-slate-400 max-w-3xl leading-relaxed">
            Klik tombol <strong>Analisis Kesehatan & Risiko AI</strong> untuk memperoleh kesimpulan valid mengenai kesehatan neraca, kualitas laba & arus kas, kewajaran harga (PER/PBV), saran strategi investasi terbaik, serta daftar risiko yang berpotensi muncul ke depan untuk saham <strong>{ticker}</strong>.
          </p>
          <div className="text-xs text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-2">
            <span>Cakupan audit:</span>
            <span className="text-slate-700 dark:text-slate-300 font-medium">Model Bisnis & Sumber Untung</span>
            <span aria-hidden="true">·</span>
            <span className="text-slate-700 dark:text-slate-300 font-medium">Pertumbuhan 3–5 Tahun</span>
            <span aria-hidden="true">·</span>
            <span className="text-slate-700 dark:text-slate-300 font-medium">Laba Rugi & ROE</span>
            <span aria-hidden="true">·</span>
            <span className="text-slate-700 dark:text-slate-300 font-medium">Solvabilitas & Arus Kas</span>
            <span aria-hidden="true">·</span>
            <span className="text-slate-700 dark:text-slate-300 font-medium">Proyeksi Risiko</span>
          </div>
        </div>
      ) : (
        <div className={`mt-5 space-y-6 ${loading ? 'opacity-65 transition-opacity' : ''}`}>
          {/* 3-Column Core Verdict Strip */}
          <div className="grid grid-cols-1 md:grid-cols-3 border border-slate-200 dark:border-slate-800 rounded-lg divide-y md:divide-y-0 md:divide-x divide-slate-200 dark:divide-slate-800">
            <div className="p-4 space-y-1.5">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Status Kesehatan Fundamental
              </div>
              <div className={`text-lg font-semibold ${getHealthClass(diagnosis.healthStatus)}`}>
                {diagnosis.healthStatus}
              </div>
              <p className="text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                {diagnosis.healthSummary}
              </p>
            </div>

            <div className="p-4 space-y-1.5">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Evaluasi Kewajaran Valuasi
              </div>
              <div className={`text-lg font-semibold ${getValuationClass(diagnosis.valuationVerdict)}`}>
                {diagnosis.valuationVerdict}
              </div>
              <p className="text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                {diagnosis.valuationSummary}
              </p>
            </div>

            <div className="p-4 space-y-1.5">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Saran Strategi Terbaik
              </div>
              <div className={`text-lg font-semibold ${getActionClass(diagnosis.recommendationAction)}`}>
                {diagnosis.recommendationAction}
              </div>
              <p className="text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                {diagnosis.recommendationReason}
              </p>
              <div className="pt-1 text-[11px] text-slate-500 dark:text-slate-400">
                Profil sesuai: <strong className="text-slate-800 dark:text-slate-200">{diagnosis.investorSuitability}</strong>
              </div>
            </div>
          </div>

          {/* Dividend Yield, Margin of Safety & Future Value AI Assessment */}
          {(diagnosis.dividendYieldAssessment ||
            diagnosis.marginOfSafetyAssessment ||
            diagnosis.futureValueProjection) && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 py-4 border-y border-slate-100 dark:border-slate-800">
              <div className="space-y-1">
                <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  Evaluasi Dividen Yield Aktual
                </div>
                <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                  {diagnosis.dividendYieldAssessment}
                </p>
              </div>
              <div className="space-y-1">
                <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  Kelayakan & Margin of Safety (MoS)
                </div>
                <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                  {diagnosis.marginOfSafetyAssessment}
                </p>
              </div>
              <div className="space-y-1">
                <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  Proyeksi Future Value (3–5 Tahun)
                </div>
                <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                  {diagnosis.futureValueProjection}
                </p>
              </div>
            </div>
          )}

          {/* AI Business Model, Profit Sources, Products & 3-5Y Growth */}
          {(diagnosis.businessModelSummary ||
            diagnosis.revenueProfitDrivers ||
            diagnosis.historicalGrowth3to5Y) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="space-y-3">
                {diagnosis.businessModelSummary && (
                  <div className="space-y-1">
                    <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                      Menjalankan Bisnis Apa
                    </div>
                    <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                      {diagnosis.businessModelSummary}
                    </p>
                  </div>
                )}
                {diagnosis.revenueProfitDrivers && (
                  <div className="space-y-1">
                    <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                      Mendapatkan Untung Darimana
                    </div>
                    <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                      {diagnosis.revenueProfitDrivers}
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                {diagnosis.keyProductsServices && diagnosis.keyProductsServices.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                      Produk & Layanan yang Diciptakan
                    </div>
                    <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                      {diagnosis.keyProductsServices.join(' · ')}
                    </p>
                  </div>
                )}
                {diagnosis.historicalGrowth3to5Y && (
                  <div className="space-y-1">
                    <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                      Pertumbuhan Bisnis 3–5 Tahun Terakhir
                    </div>
                    <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                      {diagnosis.historicalGrowth3to5Y}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 4 Fundamental Audit Pillars */}
          <div>
            <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-3">
              Rincian Audit 4 Pilar Fundamental & Teknikal
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 divide-y md:divide-y-0 divide-slate-100 dark:divide-slate-800">
              {diagnosis.fundamentalPillars.map((pillar) => (
                <div
                  key={pillar.title}
                  className="pt-3 first:pt-0 md:pt-0 pb-3 border-b border-slate-100 dark:border-slate-800/80 space-y-1"
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                      {pillar.title}
                    </span>
                    <span className={`font-mono font-semibold shrink-0 ${getPillarStatusClass(pillar.status)}`}>
                      Kondisi: {pillar.status}
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                    {pillar.analysis}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Future Risk Projection + Catalysts & Conclusion Split */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-2 border-t border-slate-200 dark:border-slate-800">
            {/* Upcoming Risks */}
            <div className="lg:col-span-7 space-y-3">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Proyeksi Risiko Mendatang & Indikator Pemantauan
              </h3>
              <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {diagnosis.futureRisks.map((risk, idx) => (
                  <div key={idx} className="py-3 first:pt-1 last:pb-1 space-y-1">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        0{idx + 1}. {risk.riskTitle}
                      </span>
                      <span className={`font-mono font-semibold shrink-0 ${getRiskSeverityClass(risk.severity)}`}>
                        Tingkat Risiko: {risk.severity}
                      </span>
                    </div>
                    <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                      {risk.impactDetail}
                    </p>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      Pantau indikator:{' '}
                      <span className="text-slate-800 dark:text-slate-200 font-medium">
                        {risk.mitigationWatch}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Catalysts & Final Conclusion */}
            <div className="lg:col-span-5 space-y-5">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2.5">
                  Katalis Penggerak ke Depan
                </h3>
                <ul className="space-y-2 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                  {diagnosis.catalystsToWatch.map((cat, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="font-mono tabular-nums text-slate-400 dark:text-slate-500 shrink-0">
                        +
                      </span>
                      <span>{cat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Kesimpulan Analis AI
                </h3>
                <p className="text-xs sm:text-[13px] leading-relaxed text-slate-800 dark:text-slate-200">
                  {diagnosis.executiveConclusion}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed pt-1">
                  Catatan: Kesimpulan disusun dari data kuartalan dan pasar terkini sebagai alat bantu riset mandiri, bukan ajakan membeli/menjual secara mutlak.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
