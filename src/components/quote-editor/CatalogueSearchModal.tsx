import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, X, Loader2 } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { Select } from "../ui/Select";
import { formatAud } from "./currency";

export interface SupplierSearchItem {
  id: string;
  sku: string;
  description: string;
  category: string | null;
  system: string | null;
  colour: string | null;
  material: string | null;
  unit: string | null;
  /** COST price — internal only. */
  price: number;
  supplier_name: string;
  supplier_slug: string;
}

interface Supplier {
  id: string;
  name: string;
  slug: string;
}

export function CatalogueSearchModal({
  onPick,
  onClose,
}: {
  onPick: (item: SupplierSearchItem) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [supplierSlug, setSupplierSlug] = useState("");
  const [results, setResults] = useState<SupplierSearchItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const requestSeq = useRef(0);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const suppliersQuery = useQuery({
    queryKey: ["suppliers"],
    queryFn: async (): Promise<Supplier[]> => {
      const { data, error } = await supabase
        .from("suppliers")
        .select("id, name, slug")
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Supplier[];
    },
  });

  // Debounced typeahead against the search-supplier-items edge function.
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setSearching(false);
      setSearchError(null);
      return;
    }
    setSearching(true);
    setSearchError(null);
    const seq = ++requestSeq.current;
    const timer = window.setTimeout(async () => {
      try {
        const { data, error } = await supabase.functions.invoke(
          "search-supplier-items",
          {
            body: {
              query: trimmed,
              supplierSlug: supplierSlug || undefined,
              limit: 25,
            },
          },
        );
        if (seq !== requestSeq.current) return;
        if (error) throw error;
        setResults(
          ((data as { items?: SupplierSearchItem[] } | null)?.items ?? []),
        );
      } catch (err) {
        if (seq !== requestSeq.current) return;
        console.warn("[CatalogueSearchModal] search failed", err);
        setResults([]);
        setSearchError("Search failed — please try again.");
      } finally {
        if (seq === requestSeq.current) setSearching(false);
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [query, supplierSlug]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 pt-[10vh]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-brand-card border border-brand-border rounded-xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[70vh]">
        <div className="flex items-center justify-between px-4 py-3 border-b border-brand-border">
          <h3 className="text-sm font-semibold text-brand-text">
            Add catalogue item
          </h3>
          <button
            type="button"
            onClick={onClose}
            title="Close"
            className="p-1 text-brand-muted hover:text-brand-text transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 p-4 border-b border-brand-border/60">
          <div className="relative flex-1">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-muted pointer-events-none"
            />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by SKU or description…"
              data-testid="catalogue-search-input"
              className="w-full pl-9 pr-3 py-2 text-sm bg-white dark:bg-brand-bg border border-brand-border rounded-md text-brand-text placeholder:text-brand-muted/60 focus:outline-none focus:ring-1 focus:ring-brand-accent/40 focus:border-brand-accent"
            />
          </div>
          <Select
            value={supplierSlug}
            onChange={(e) => setSupplierSlug(e.target.value)}
            aria-label="Supplier"
            className="sm:w-48 py-2"
          >
            <option value="">All suppliers</option>
            {(suppliersQuery.data ?? []).map((supplier) => (
              <option key={supplier.id} value={supplier.slug}>
                {supplier.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex-1 overflow-y-auto">
          {searching && (
            <div className="flex items-center gap-2 px-4 py-6 text-sm text-brand-muted">
              <Loader2 size={14} className="animate-spin" /> Searching…
            </div>
          )}
          {!searching && searchError && (
            <p className="px-4 py-6 text-sm text-brand-danger">{searchError}</p>
          )}
          {!searching && !searchError && query.trim().length < 2 && (
            <p className="px-4 py-6 text-sm text-brand-muted">
              Type at least 2 characters to search the supplier catalogue.
            </p>
          )}
          {!searching &&
            !searchError &&
            query.trim().length >= 2 &&
            results.length === 0 && (
              <p className="px-4 py-6 text-sm text-brand-muted">
                No matching items found.
              </p>
            )}
          {!searching && results.length > 0 && (
            <ul className="divide-y divide-brand-border/60">
              {results.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => onPick(item)}
                    data-testid="catalogue-result-row"
                    className="w-full text-left px-4 py-2.5 hover:bg-brand-bg/50 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-brand-text truncate">
                          {item.description}
                        </p>
                        <p className="text-xs text-brand-muted truncate">
                          {item.sku} · {item.supplier_name}
                          {item.colour ? ` · ${item.colour}` : ""}
                          {item.unit ? ` · per ${item.unit}` : ""}
                        </p>
                      </div>
                      <span className="shrink-0 font-mono tabular-nums text-xs text-brand-muted">
                        Cost {formatAud(item.price)}
                      </span>
                    </div>
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
