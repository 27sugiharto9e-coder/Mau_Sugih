import { useEffect, useRef, useState } from 'react';
import { Loader2, Search, X } from 'lucide-react';
import type { StockSearchResult } from '../types';

interface StockSearchBoxProps {
  onSelectTicker: (ticker: string) => void;
  placeholder?: string;
  compact?: boolean;
  currentTicker?: string;
}

export function StockSearchBox({
  onSelectTicker,
  placeholder = 'Cari semua saham IDX (mis. BRIS, PTBA, BUMI)...',
  compact = false,
  currentTicker,
}: StockSearchBoxProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<StockSearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  useEffect(() => {
    if (!open) return;

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/stocks/search?q=${encodeURIComponent(query.trim())}`);
        if (res.ok) {
          const data = (await res.json()) as { results: StockSearchResult[] };
          setResults(data.results ?? []);
          setHighlightIndex(0);
        }
      } catch {
        // Keep previous results on transient errors
      } finally {
        setLoading(false);
      }
    }, query.trim() ? 220 : 0);

    return () => clearTimeout(timer);
  }, [query, open]);

  const handlePick = (ticker: string) => {
    onSelectTicker(ticker);
    setQuery('');
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      setOpen(true);
      return;
    }
    if (e.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex((i) => Math.min(results.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[highlightIndex]) {
        handlePick(results[highlightIndex].ticker);
      } else if (/^[a-zA-Z]{4}$/.test(query.trim())) {
        handlePick(query.trim().toUpperCase());
      }
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          aria-label="Cari saham Bursa Efek Indonesia"
          className={`w-full pl-9 pr-8 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600 ${
            compact ? 'py-2 text-xs' : 'py-2.5 text-sm'
          }`}
        />
        {loading ? (
          <Loader2 className="w-3.5 h-3.5 text-teal-600 animate-spin absolute right-2.5 top-1/2 -translate-y-1/2" />
        ) : query ? (
          <button
            type="button"
            onClick={() => setQuery('')}
            aria-label="Hapus kata kunci pencarian"
            className="p-0.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        ) : null}
      </div>

      {open && (
        <div className="absolute left-0 right-0 mt-1.5 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
          {results.length === 0 && !loading ? (
            <div className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
              Ketik kode 4 huruf emiten IDX (mis. BRIS, PTBA, PANI, BUMI) atau nama perusahaan.
            </div>
          ) : (
            results.map((item, idx) => (
              <button
                key={item.symbol}
                type="button"
                onClick={() => handlePick(item.ticker)}
                onMouseEnter={() => setHighlightIndex(idx)}
                className={`w-full px-3.5 py-2.5 text-left flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                  idx === highlightIndex
                    ? 'bg-slate-100 dark:bg-slate-800/70'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-slate-900 dark:text-slate-100">
                      {item.ticker}
                    </span>
                    <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500">
                      {item.symbol}
                    </span>
                    {currentTicker === item.ticker && (
                      <span className="text-[11px] text-teal-700 dark:text-teal-400 font-medium">
                        Aktif
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-400 truncate">
                    {item.name}
                  </div>
                </div>
                <span className="text-[11px] font-medium text-teal-700 dark:text-teal-400 shrink-0">
                  Analisa
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
