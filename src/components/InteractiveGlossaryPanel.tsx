import { useEffect, useMemo, useState } from 'react';
import { BookOpen, Calculator, ChevronRight, Search } from 'lucide-react';
import type { LiveStockQuote } from '../types';
import {
  GLOSSARY_CATEGORIES,
  GLOSSARY_TERMS,
  type GlossaryCategory,
  type GlossaryLevel,
  type GlossaryTerm,
} from '../data/glossaryTerms';
import { formatIdr } from '../utils/formatters';

interface InteractiveGlossaryPanelProps {
  stocks: LiveStockQuote[];
  onSelectStock: (ticker: string) => void;
}

const FEATURED_TERM_IDS = ['per', 'pbv', 'eps', 'dividend-yield', 'roe', 'margin-of-safety', 'lot'];

const CALCULABLE_TERM_IDS = new Set([
  'per',
  'pbv',
  'eps',
  'dividend-yield',
  'roe',
  'der',
  'margin-of-safety',
  'lot',
]);

export function InteractiveGlossaryPanel({
  stocks,
  onSelectStock,
}: InteractiveGlossaryPanelProps) {
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'Semua' | GlossaryCategory>('Semua');
  const [selectedLevel, setSelectedLevel] = useState<'Semua' | GlossaryLevel>('Semua');
  const [activeTermId, setActiveTermId] = useState<string>('per');

  // Interactive Sandbox Calculator Inputs (seeded with beginner-friendly numbers, or populated from a live IDX stock)
  const [calcPrice, setCalcPrice] = useState<number>(5000);
  const [calcEps, setCalcEps] = useState<number>(500);
  const [calcBvps, setCalcBvps] = useState<number>(2200);
  const [calcDps, setCalcDps] = useState<number>(250);
  const [calcRoe, setCalcRoe] = useState<number>(18);
  const [calcDer, setCalcDer] = useState<number>(0.85);
  const [calcFairValue, setCalcFairValue] = useState<number>(6250);
  const [calcLots, setCalcLots] = useState<number>(3);
  const [calcNetIncomeB, setCalcNetIncomeB] = useState<number>(500);
  const [calcSharesB, setCalcSharesB] = useState<number>(2);
  const [loadedLiveTicker, setLoadedLiveTicker] = useState<string | null>(null);

  const liveSampleStocks = useMemo(
    () => stocks.filter((s) => s.isLive && s.price > 0).slice(0, 6),
    [stocks]
  );

  const filteredTerms = useMemo(() => {
    const q = query.trim().toLowerCase();
    return GLOSSARY_TERMS.filter((item) => {
      if (selectedCategory !== 'Semua' && item.category !== selectedCategory) return false;
      if (selectedLevel !== 'Semua' && item.level !== selectedLevel) return false;
      if (!q) return true;
      return (
        item.term.toLowerCase().includes(q) ||
        (item.shortLabel?.toLowerCase().includes(q) ?? false) ||
        item.shortMeaning.toLowerCase().includes(q) ||
        item.explanation.toLowerCase().includes(q)
      );
    });
  }, [query, selectedCategory, selectedLevel]);

  // Keep activeTerm valid when filters narrow the list
  useEffect(() => {
    if (filteredTerms.length > 0 && !filteredTerms.some((t) => t.id === activeTermId)) {
      setActiveTermId(filteredTerms[0].id);
    }
  }, [filteredTerms, activeTermId]);

  const activeTerm: GlossaryTerm =
    filteredTerms.find((t) => t.id === activeTermId) ??
    GLOSSARY_TERMS.find((t) => t.id === activeTermId) ??
    GLOSSARY_TERMS[0];

  const handleLoadFromLiveStock = (s: LiveStockQuote) => {
    setCalcPrice(Math.round(s.price));
    setCalcEps(s.epsTtm > 0 ? Math.round(s.epsTtm) : 250);
    setCalcBvps(s.bvps > 0 ? Math.round(s.bvps) : 1500);
    const dpsVal =
      s.dps > 0 ? s.dps : s.dividendYield > 0 ? (s.dividendYield / 100) * s.price : 150;
    setCalcDps(Math.round(dpsVal));
    setCalcRoe(s.roe > 0 ? Number(s.roe.toFixed(1)) : 15);
    setCalcDer(s.der > 0 ? Number(s.der.toFixed(2)) : 0.9);
    const graham =
      s.epsTtm > 0 && s.bvps > 0 ? Math.round(Math.sqrt(22.5 * s.epsTtm * s.bvps)) : Math.round(s.price * 1.15);
    setCalcFairValue(graham);
    setCalcSharesB(s.sharesOutstandingB > 0 ? s.sharesOutstandingB : 2);
    setCalcNetIncomeB(
      s.epsTtm > 0 && s.sharesOutstandingB > 0
        ? Math.round(s.epsTtm * s.sharesOutstandingB)
        : 500
    );
    setLoadedLiveTicker(s.ticker);
  };

  const handleResetSampleNumbers = () => {
    setCalcPrice(5000);
    setCalcEps(500);
    setCalcBvps(2200);
    setCalcDps(250);
    setCalcRoe(18);
    setCalcDer(0.85);
    setCalcFairValue(6250);
    setCalcLots(3);
    setCalcNetIncomeB(500);
    setCalcSharesB(2);
    setLoadedLiveTicker(null);
  };

  // Live Interactive Calculation Readout per active term
  const sandboxOutput = useMemo(() => {
    switch (activeTerm.id) {
      case 'per': {
        const val = calcEps > 0 ? calcPrice / calcEps : 0;
        const verdict =
          calcEps <= 0
            ? 'EPS harus positif (> 0) untuk menghitung PER.'
            : val < 10
            ? 'Tergolong rendah/murah — periksa apakah laba stabil dan bukan untung satu kali.'
            : val <= 16
            ? 'Berada di zona wajar untuk mayoritas saham blue chip Indonesia.'
            : 'Tergolong premium — pastikan perusahaan punya pertumbuhan laba yang sepadan.';
        return {
          metricLabel: 'Hasil Hitung PER',
          metricValue: calcEps > 0 ? `${val.toFixed(2)}x` : 'N/A',
          detail: `Rp${formatIdr(calcPrice)} ÷ Rp${formatIdr(calcEps)} = ${val.toFixed(2)} tahun perkiraan balik modal laba`,
          verdict,
        };
      }
      case 'pbv': {
        const val = calcBvps > 0 ? calcPrice / calcBvps : 0;
        const verdict =
          calcBvps <= 0
            ? 'Nilai buku per saham (BVPS) harus > 0.'
            : val < 1
            ? 'Harga di bawah nilai kekayaan bersihnya (diskon nilai buku).'
            : val <= 2.2
            ? 'Wajar untuk emiten sehat dengan ROE di atas 12%.'
            : 'Harga pasar jauh di atas nilai buku — wajar hanya jika ROE sangat tinggi (>18%).';
        return {
          metricLabel: 'Hasil Hitung PBV',
          metricValue: calcBvps > 0 ? `${val.toFixed(2)}x` : 'N/A',
          detail: `Rp${formatIdr(calcPrice)} ÷ Rp${formatIdr(calcBvps)} = ${val.toFixed(2)}x nilai buku bersih`,
          verdict,
        };
      }
      case 'eps': {
        const val = calcSharesB > 0 ? calcNetIncomeB / calcSharesB : 0;
        return {
          metricLabel: 'Hasil Hitung EPS',
          metricValue: calcSharesB > 0 ? `Rp${formatIdr(Math.round(val))} / lembar` : 'N/A',
          detail: `Laba Rp${formatIdr(calcNetIncomeB)} Miliar ÷ ${calcSharesB} Miliar lembar saham`,
          verdict:
            val > 0
              ? `Setiap 1 Lot (100 lembar) saham menghasilkan jatah laba tahunan sebesar Rp${formatIdr(Math.round(val * 100))}.`
              : 'Masukkan jumlah saham beredar > 0.',
        };
      }
      case 'dividend-yield': {
        const val = calcPrice > 0 ? (calcDps / calcPrice) * 100 : 0;
        const cashPer10M = calcPrice > 0 ? Math.round((10_000_000 / calcPrice) * calcDps) : 0;
        const verdict =
          val >= 6
            ? 'Yield sangat menarik (di atas rata-rata deposito), pastikan arus kas bebas perusahaan positif.'
            : val >= 3
            ? 'Yield moderat & sehat untuk perusahaan yang masih giat berekspansi.'
            : 'Yield kecil — tipikal saham yang memutar kembali labanya untuk pertumbuhan bisnis.';
        return {
          metricLabel: 'Dividen Yield pada Harga Ini',
          metricValue: `${val.toFixed(2)}% / tahun`,
          detail: `Modal Rp10.000.000 menghasilkan estimasi dividen tunai ~Rp${formatIdr(cashPer10M)}/tahun`,
          verdict,
        };
      }
      case 'roe': {
        const verdict =
          calcRoe >= 15
            ? 'Profitabilitas sangat kompetitif dan efisien mengelola modal pemegang saham.'
            : calcRoe >= 8
            ? 'Cukup stabil, namun bandingkan dengan pemimpin industri di sektornya.'
            : 'Profitabilitas masih rendah dibanding biaya modal dan imbal hasil obligasi.';
        return {
          metricLabel: 'Tingkat Efisiensi Modal (ROE)',
          metricValue: `${calcRoe.toFixed(1)}% / tahun`,
          detail: `Setiap Rp100 modal ekuitas menghasilkan laba bersih Rp${calcRoe.toFixed(1)} per tahun`,
          verdict,
        };
      }
      case 'der': {
        const verdict =
          calcDer <= 1
            ? 'Struktur modal konservatif (utang tidak melebihi modal sendiri) untuk emiten non-bank.'
            : calcDer <= 2.5
            ? 'Leverage menengah — pantau kemampuan arus kas membayar bunga utang.'
            : 'Utang tinggi (wajar hanya untuk sektor perbankan karena simpanan nasabah dicatat sebagai liabilitas).';
        return {
          metricLabel: 'Rasio Utang vs Ekuitas (DER)',
          metricValue: `${calcDer.toFixed(2)}x`,
          detail: `Total kewajiban sebesar ${(calcDer * 100).toFixed(0)}% dari total modal ekuitas perusahaan`,
          verdict,
        };
      }
      case 'margin-of-safety': {
        const mos = calcFairValue > 0 ? ((calcFairValue - calcPrice) / calcFairValue) * 100 : 0;
        const safeBuy = Math.round(calcFairValue * 0.8);
        const verdict =
          mos >= 20
            ? `Layak Investasi — terdapat diskon aman ${mos.toFixed(1)}% di bawah nilai wajar Rp${formatIdr(calcFairValue)}.`
            : mos >= 0
            ? `Diskon tipis (${mos.toFixed(1)}%) — bisa akumulasi bertahap atau tunggu di batas aman Rp${formatIdr(safeBuy)}.`
            : `Overvalued (${mos.toFixed(1)}%) — harga pasar lebih mahal dari nilai wajar Rp${formatIdr(calcFairValue)}.`;
        return {
          metricLabel: 'Margin of Safety (MoS)',
          metricValue: `${mos > 0 ? '+' : ''}${mos.toFixed(1)}%`,
          detail: `Batas harga beli aman (target MoS 20%): ≤ Rp${formatIdr(safeBuy)}`,
          verdict,
        };
      }
      case 'lot': {
        const shares = calcLots * 100;
        const gross = shares * calcPrice;
        const withFee = Math.round(gross * 1.0015);
        return {
          metricLabel: 'Total Modal Pembelian',
          metricValue: `Rp${formatIdr(withFee)}`,
          detail: `${calcLots} Lot (${formatIdr(shares)} lembar) × Rp${formatIdr(calcPrice)} + biaya broker ~0,15%`,
          verdict: `Setiap kenaikan Rp100 per lembar akan menghasilkan keuntungan kotor Rp${formatIdr(shares * 100)}.`,
        };
      }
      default:
        return null;
    }
  }, [
    activeTerm.id,
    calcPrice,
    calcEps,
    calcBvps,
    calcDps,
    calcRoe,
    calcDer,
    calcFairValue,
    calcLots,
    calcNetIncomeB,
    calcSharesB,
  ]);

  return (
    <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
      {/* Top Bar: Search, Featured Quick Jump, Category & Level Filter */}
      <div className="p-5 border-b border-slate-200 dark:border-slate-800 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <BookOpen className="w-5 h-5 text-teal-700 dark:text-teal-400 shrink-0" />
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Panel Interaktif Kamus Istilah & Contoh Kasus Saham IDX
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Pilih istilah di sebelah kiri untuk melihat analogi pemula, contoh kasus nyata, dan simulasi hitung langsung.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cari istilah (PER, PBV, EPS...)"
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-teal-600"
              />
            </div>

            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
              {(['Semua', 'Pemula', 'Menengah'] as const).map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setSelectedLevel(lvl)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    selectedLevel === lvl
                      ? 'bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  {lvl === 'Semua' ? 'Semua Level' : lvl}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Essential Beginner Shortcut Strip + Category Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-slate-500 dark:text-slate-400 mr-1">Istilah Wajib Pemula:</span>
            {FEATURED_TERM_IDS.map((id) => {
              const found = GLOSSARY_TERMS.find((t) => t.id === id);
              if (!found) return null;
              const isSelected = activeTerm.id === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setSelectedCategory('Semua');
                    setSelectedLevel('Semua');
                    setQuery('');
                    setActiveTermId(id);
                  }}
                  className={`px-2.5 py-1 rounded-md font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    isSelected
                      ? 'bg-teal-700 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {found.shortLabel ?? found.term}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <button
              type="button"
              onClick={() => setSelectedCategory('Semua')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                selectedCategory === 'Semua'
                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              Semua ({GLOSSARY_TERMS.length})
            </button>
            {GLOSSARY_CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Interactive Split: Term Selector List (Left) + Guided Explanation, Case Study & Mini Calculator (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12">
        {/* Left: Scrollable Term List */}
        <div className="lg:col-span-4 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800 max-h-[340px] lg:max-h-[680px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80">
          {filteredTerms.length === 0 ? (
            <div className="p-6 text-xs text-slate-500 dark:text-slate-400">
              Tidak ditemukan istilah yang cocok dengan &ldquo;{query}&rdquo;.
            </div>
          ) : (
            filteredTerms.map((item) => {
              const isSelected = item.id === activeTerm.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTermId(item.id)}
                  className={`w-full px-5 py-3.5 text-left flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-teal-50/70 dark:bg-teal-950/35'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                      <span
                        className={
                          item.level === 'Pemula'
                            ? 'text-teal-700 dark:text-teal-400 font-semibold'
                            : 'text-amber-700 dark:text-amber-400 font-semibold'
                        }
                      >
                        {item.level}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="truncate">{item.category}</span>
                    </div>
                    <div
                      className={`text-sm font-medium truncate ${
                        isSelected
                          ? 'text-teal-900 dark:text-teal-200 font-semibold'
                          : 'text-slate-900 dark:text-slate-100'
                      }`}
                    >
                      {item.term}
                    </div>
                  </div>
                  <ChevronRight
                    className={`w-4 h-4 shrink-0 ${
                      isSelected ? 'text-teal-700 dark:text-teal-400' : 'text-slate-400'
                    }`}
                  />
                </button>
              );
            })
          )}
        </div>

        {/* Right: Active Term Detail, Analogy, Concrete Case Study & Interactive Calculator */}
        <div className="lg:col-span-8 p-6 space-y-6">
          {/* Header & Plain-Language Meaning */}
          <div className="space-y-2 pb-4 border-b border-slate-200 dark:border-slate-800">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span>
                <strong
                  className={
                    activeTerm.level === 'Pemula'
                      ? 'text-teal-700 dark:text-teal-400'
                      : 'text-amber-700 dark:text-amber-400'
                  }
                >
                  Level {activeTerm.level}
                </strong>{' '}
                · {activeTerm.category}
              </span>
              {activeTerm.exampleTicker && (
                <button
                  type="button"
                  onClick={() => onSelectStock(activeTerm.exampleTicker!)}
                  className="font-medium text-teal-700 dark:text-teal-400 hover:underline cursor-pointer"
                >
                  Buka Data Asli {activeTerm.exampleTicker} →
                </button>
              )}
            </div>

            <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
              {activeTerm.term}
            </h3>
            <p className="text-sm font-medium text-slate-800 dark:text-slate-200 leading-relaxed">
              {activeTerm.shortMeaning}
            </p>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              {activeTerm.explanation}
            </p>
          </div>

          {/* Beginner Analogy + Formula */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <div className="text-xs font-semibold text-teal-700 dark:text-teal-400">
                Analogi Sederhana untuk Pemula
              </div>
              <p className="text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                {activeTerm.beginnerAnalogy}
              </p>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                Cara Membaca & Rumus
              </div>
              {activeTerm.formula && (
                <div className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-900 dark:text-slate-100">
                  {activeTerm.formula}
                </div>
              )}
              <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                {activeTerm.howToRead}
              </p>
            </div>
          </div>

          {/* Concrete Case Study Block */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 space-y-2.5">
            <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
              {activeTerm.caseStudy.title}
            </div>
            <p className="text-xs leading-relaxed text-slate-700 dark:text-slate-300">
              <strong>Situasi:</strong> {activeTerm.caseStudy.scenario}
            </p>
            <div className="px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-mono tabular-nums text-slate-900 dark:text-slate-100">
              {activeTerm.caseStudy.calculation}
            </div>
            <p className="text-xs leading-relaxed text-teal-800 dark:text-teal-300">
              <strong>Kesimpulan Praktis:</strong> {activeTerm.caseStudy.takeaway}
            </p>
          </div>

          {/* Interactive Mini Calculator Sandbox (for calculable fundamental/valuation terms) */}
          {CALCULABLE_TERM_IDS.has(activeTerm.id) && sandboxOutput && (
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-900 dark:text-slate-100">
                  <Calculator className="w-4 h-4 text-teal-700 dark:text-teal-400" />
                  <span>Simulasi Hitung Interaktif ({activeTerm.shortLabel ?? activeTerm.term})</span>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                  <span className="text-slate-500 dark:text-slate-400">Isi data live:</span>
                  {liveSampleStocks.map((s) => (
                    <button
                      key={s.ticker}
                      type="button"
                      onClick={() => handleLoadFromLiveStock(s)}
                      className={`px-2 py-0.5 font-mono rounded border transition-colors cursor-pointer ${
                        loadedLiveTicker === s.ticker
                          ? 'border-teal-600 text-teal-700 dark:text-teal-400 font-semibold'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-teal-600'
                      }`}
                    >
                      {s.ticker}
                    </button>
                  ))}
                  {loadedLiveTicker && (
                    <button
                      type="button"
                      onClick={handleResetSampleNumbers}
                      className="text-slate-500 hover:underline ml-1 cursor-pointer"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                {/* Interactive Inputs */}
                <div className="md:col-span-6 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  {(activeTerm.id === 'per' ||
                    activeTerm.id === 'pbv' ||
                    activeTerm.id === 'dividend-yield' ||
                    activeTerm.id === 'margin-of-safety' ||
                    activeTerm.id === 'lot') && (
                    <label className="space-y-1">
                      <span className="text-slate-600 dark:text-slate-400 block">
                        Harga Saham (Rp/lembar)
                      </span>
                      <input
                        type="number"
                        min={50}
                        step={25}
                        value={calcPrice}
                        onChange={(e) => setCalcPrice(Math.max(1, Number(e.target.value) || 0))}
                        className="w-full px-3 py-1.5 font-mono tabular-nums rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-teal-600"
                      />
                    </label>
                  )}

                  {activeTerm.id === 'per' && (
                    <label className="space-y-1">
                      <span className="text-slate-600 dark:text-slate-400 block">
                        EPS Tahunan (Rp/lembar)
                      </span>
                      <input
                        type="number"
                        min={1}
                        step={10}
                        value={calcEps}
                        onChange={(e) => setCalcEps(Math.max(0, Number(e.target.value) || 0))}
                        className="w-full px-3 py-1.5 font-mono tabular-nums rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-teal-600"
                      />
                    </label>
                  )}

                  {activeTerm.id === 'pbv' && (
                    <label className="space-y-1">
                      <span className="text-slate-600 dark:text-slate-400 block">
                        Nilai Buku / BVPS (Rp)
                      </span>
                      <input
                        type="number"
                        min={1}
                        step={50}
                        value={calcBvps}
                        onChange={(e) => setCalcBvps(Math.max(0, Number(e.target.value) || 0))}
                        className="w-full px-3 py-1.5 font-mono tabular-nums rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-teal-600"
                      />
                    </label>
                  )}

                  {activeTerm.id === 'dividend-yield' && (
                    <label className="space-y-1">
                      <span className="text-slate-600 dark:text-slate-400 block">
                        Dividen / DPS (Rp/lembar)
                      </span>
                      <input
                        type="number"
                        min={0}
                        step={10}
                        value={calcDps}
                        onChange={(e) => setCalcDps(Math.max(0, Number(e.target.value) || 0))}
                        className="w-full px-3 py-1.5 font-mono tabular-nums rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-teal-600"
                      />
                    </label>
                  )}

                  {activeTerm.id === 'eps' && (
                    <>
                      <label className="space-y-1">
                        <span className="text-slate-600 dark:text-slate-400 block">
                          Laba Bersih (Miliar Rp)
                        </span>
                        <input
                          type="number"
                          min={0}
                          step={50}
                          value={calcNetIncomeB}
                          onChange={(e) =>
                            setCalcNetIncomeB(Math.max(0, Number(e.target.value) || 0))
                          }
                          className="w-full px-3 py-1.5 font-mono tabular-nums rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-teal-600"
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="text-slate-600 dark:text-slate-400 block">
                          Saham Beredar (Miliar lbr)
                        </span>
                        <input
                          type="number"
                          min={0.1}
                          step={0.5}
                          value={calcSharesB}
                          onChange={(e) =>
                            setCalcSharesB(Math.max(0.1, Number(e.target.value) || 0.1))
                          }
                          className="w-full px-3 py-1.5 font-mono tabular-nums rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-teal-600"
                        />
                      </label>
                    </>
                  )}

                  {activeTerm.id === 'roe' && (
                    <label className="space-y-1 sm:col-span-2">
                      <span className="text-slate-600 dark:text-slate-400 block">
                        ROE Perusahaan (%): <strong>{calcRoe.toFixed(1)}%</strong>
                      </span>
                      <input
                        type="range"
                        min={0}
                        max={40}
                        step={0.5}
                        value={calcRoe}
                        onChange={(e) => setCalcRoe(Number(e.target.value))}
                        className="w-full accent-teal-700 cursor-pointer"
                      />
                    </label>
                  )}

                  {activeTerm.id === 'der' && (
                    <label className="space-y-1 sm:col-span-2">
                      <span className="text-slate-600 dark:text-slate-400 block">
                        Rasio DER (x): <strong>{calcDer.toFixed(2)}x</strong>
                      </span>
                      <input
                        type="range"
                        min={0.1}
                        max={6}
                        step={0.05}
                        value={calcDer}
                        onChange={(e) => setCalcDer(Number(e.target.value))}
                        className="w-full accent-teal-700 cursor-pointer"
                      />
                    </label>
                  )}

                  {activeTerm.id === 'margin-of-safety' && (
                    <label className="space-y-1">
                      <span className="text-slate-600 dark:text-slate-400 block">
                        Estimasi Nilai Wajar (Rp)
                      </span>
                      <input
                        type="number"
                        min={50}
                        step={50}
                        value={calcFairValue}
                        onChange={(e) =>
                          setCalcFairValue(Math.max(1, Number(e.target.value) || 0))
                        }
                        className="w-full px-3 py-1.5 font-mono tabular-nums rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-teal-600"
                      />
                    </label>
                  )}

                  {activeTerm.id === 'lot' && (
                    <label className="space-y-1">
                      <span className="text-slate-600 dark:text-slate-400 block">
                        Jumlah Lot Dibeli
                      </span>
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={calcLots}
                        onChange={(e) => setCalcLots(Math.max(1, Number(e.target.value) || 1))}
                        className="w-full px-3 py-1.5 font-mono tabular-nums rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-teal-600"
                      />
                    </label>
                  )}
                </div>

                {/* Live Calculation Readout */}
                <div className="md:col-span-6 p-4 rounded-lg border border-slate-200 dark:border-slate-800 space-y-1.5">
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    {sandboxOutput.metricLabel}
                  </div>
                  <div className="text-lg font-bold font-mono tabular-nums text-teal-700 dark:text-teal-400">
                    {sandboxOutput.metricValue}
                  </div>
                  <div className="text-[11px] font-mono tabular-nums text-slate-600 dark:text-slate-400">
                    {sandboxOutput.detail}
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-300 pt-1">
                    {sandboxOutput.verdict}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Common Mistake Warning for Beginners */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            <strong className="text-amber-700 dark:text-amber-400">
              Hal yang Sering Salah Dipahami Pemula:
            </strong>{' '}
            {activeTerm.commonMistake}
          </div>
        </div>
      </div>
    </section>
  );
}
