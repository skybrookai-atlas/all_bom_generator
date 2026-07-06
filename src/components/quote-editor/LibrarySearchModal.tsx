import { useEffect, useState } from "react";
import { BookMarked, Loader2, Search, X } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { formatAud } from "./currency";

export interface LibraryItem {
  id: string;
  title: string;
  body: string | null;
  unit: string | null;
  unit_price: number;
  categories: string[] | null;
}

interface Props {
  onPick: (item: LibraryItem) => void;
  onClose: () => void;
}

/**
 * Quotient-style price item library picker. Reads quote_library_items
 * directly (RLS: own org). Empty search shows the whole library.
 */
export function LibrarySearchModal({ onPick, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      setLoading(true);
      let q = supabase
        .from("quote_library_items")
        .select("id, title, body, unit, unit_price, categories")
        .eq("active", true)
        .order("title", { ascending: true })
        .limit(50);
      if (query.trim().length > 0) q = q.ilike("title", `%${query.trim()}%`);
      const { data } = await q;
      if (!cancelled) {
        setResults((data as LibraryItem[]) ?? []);
        setLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-[8vh]"
      onClick={onClose}
    >
      <div
        className="flex max-h-[75vh] w-full max-w-xl flex-col overflow-hidden rounded-xl border border-brand-border bg-brand-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-brand-border px-4 py-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-brand-text">
            <BookMarked size={15} className="text-brand-accent" />
            Add from price item library
          </h3>
          <button
            type="button"
            onClick={onClose}
            title="Close"
            className="p-1 text-brand-muted transition-colors hover:text-brand-text"
          >
            <X size={16} />
          </button>
        </div>

        <div className="border-b border-brand-border/60 p-3">
          <div className="relative">
            <Search
              size={14}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-brand-muted"
            />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search your library (e.g. chain-link, pool fence, gate)…"
              className="w-full rounded-lg border border-brand-border bg-brand-bg py-2 pl-8 pr-3 text-sm text-brand-text outline-none focus:border-brand-accent"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {loading && (
            <p className="flex items-center gap-2 p-4 text-sm text-brand-muted">
              <Loader2 size={14} className="animate-spin" /> Loading library…
            </p>
          )}
          {!loading && results.length === 0 && (
            <p className="p-4 text-sm text-brand-muted">No library items match.</p>
          )}
          {!loading && results.length > 0 && (
            <ul className="divide-y divide-brand-border/60">
              {results.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => onPick(item)}
                    data-testid="library-result-row"
                    className="w-full px-4 py-2.5 text-left transition-colors hover:bg-brand-bg/50"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="min-w-0 truncate text-sm font-medium text-brand-text">
                        {item.title}
                      </span>
                      <span className="shrink-0 font-mono text-xs tabular-nums text-brand-accent">
                        {formatAud(item.unit_price)}
                      </span>
                    </div>
                    {item.body && (
                      <p className="mt-0.5 truncate text-xs text-brand-muted">
                        {item.body.split("\n")[0]}
                      </p>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
