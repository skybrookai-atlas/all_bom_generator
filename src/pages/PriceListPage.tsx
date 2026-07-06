import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Loader2, Search } from "lucide-react";
import { AppShell } from "../components/layout/AppShell";
import { supabase } from "../lib/supabase";
import { formatAud } from "../components/quote-editor/currency";

const PAGE_SIZE = 50;

interface CatalogueRow {
  id: string;
  sku: string | null;
  description: string;
  category: string | null;
  material: string | null;
  unit: string | null;
  price: number;
  last_invoice_date: string | null;
  supplier_name: string;
  supplier_slug: string;
}

type SortKey = "description" | "price" | "price_desc" | "supplier";

export function PriceListPage() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selectedSuppliers, setSelectedSuppliers] = useState<Set<string>>(new Set());
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState<SortKey>("description");
  const [page, setPage] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQuery(query);
      setPage(0);
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const suppliersQuery = useQuery({
    queryKey: ["suppliers-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suppliers")
        .select("name, slug")
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return data as Array<{ name: string; slug: string }>;
    },
  });

  const supplierSlugs = useMemo(() => [...selectedSuppliers], [selectedSuppliers]);

  const itemsQuery = useQuery({
    queryKey: ["catalogue-browse", debouncedQuery, supplierSlugs, category, sort, page],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("search-supplier-items", {
        body: {
          query: debouncedQuery,
          supplierSlugs,
          category,
          sort,
          offset: page * PAGE_SIZE,
          limit: PAGE_SIZE,
        },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      return data as { items: CatalogueRow[]; total: number; categories: string[] };
    },
  });

  const toggleSupplier = (slug: string) => {
    setSelectedSuppliers((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
    setPage(0);
  };

  const total = itemsQuery.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-4 px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-brand-text">Price list</h1>
            <p className="mt-0.5 text-sm text-brand-muted">
              {itemsQuery.isFetching
                ? "Loading…"
                : `${total.toLocaleString()} items across your suppliers`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search
                size={14}
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-brand-muted"
              />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search SKU or description…"
                className="w-64 rounded-lg border border-brand-border bg-brand-card py-2 pl-8 pr-3 text-sm text-brand-text outline-none focus:border-brand-accent"
              />
            </div>
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setPage(0);
              }}
              className="rounded-lg border border-brand-border bg-brand-card px-2.5 py-2 text-sm text-brand-text"
            >
              <option value="">All categories</option>
              {(itemsQuery.data?.categories ?? []).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="rounded-lg border border-brand-border bg-brand-card px-2.5 py-2 text-sm text-brand-text"
            >
              <option value="description">Sort: Product A–Z</option>
              <option value="supplier">Sort: Supplier</option>
              <option value="price">Sort: Price low → high</option>
              <option value="price_desc">Sort: Price high → low</option>
            </select>
          </div>
        </div>

        {/* Supplier filter chips */}
        <div className="flex flex-wrap gap-1.5">
          {(suppliersQuery.data ?? []).map((s) => {
            const on = selectedSuppliers.has(s.slug);
            return (
              <button
                key={s.slug}
                type="button"
                onClick={() => toggleSupplier(s.slug)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  on
                    ? "border-brand-accent bg-brand-accent text-white"
                    : "border-brand-border bg-brand-card text-brand-muted hover:border-brand-accent/60 hover:text-brand-text"
                }`}
              >
                {s.name}
              </button>
            );
          })}
          {selectedSuppliers.size > 0 && (
            <button
              type="button"
              onClick={() => {
                setSelectedSuppliers(new Set());
                setPage(0);
              }}
              className="rounded-full px-3 py-1.5 text-xs font-semibold text-brand-danger hover:underline"
            >
              Clear suppliers
            </button>
          )}
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-xl border border-brand-border bg-brand-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-brand-border/60 text-left text-xs uppercase tracking-wide text-brand-muted">
                <th className="px-4 py-2.5 font-semibold">Product</th>
                <th className="px-4 py-2.5 font-semibold">SKU</th>
                <th className="px-4 py-2.5 font-semibold">Supplier</th>
                <th className="px-4 py-2.5 font-semibold">Category</th>
                <th className="px-4 py-2.5 text-right font-semibold">Cost (ex GST)</th>
                <th className="px-4 py-2.5 text-right font-semibold">Last bought</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-border/40">
              {itemsQuery.isLoading && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-brand-muted">
                    <Loader2 size={16} className="mr-2 inline animate-spin" />
                    Loading catalogue…
                  </td>
                </tr>
              )}
              {!itemsQuery.isLoading &&
                (itemsQuery.data?.items ?? []).map((row) => (
                  <tr key={row.id} className="text-brand-text hover:bg-brand-bg/40">
                    <td className="max-w-md truncate px-4 py-2" title={row.description}>
                      {row.description}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-brand-muted">
                      {row.sku ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-xs">{row.supplier_name}</td>
                    <td className="px-4 py-2 text-xs text-brand-muted">
                      {row.category ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-right font-mono tabular-nums">
                      {formatAud(row.price)}
                    </td>
                    <td className="px-4 py-2 text-right text-xs text-brand-muted">
                      {row.last_invoice_date ?? "—"}
                    </td>
                  </tr>
                ))}
              {!itemsQuery.isLoading && (itemsQuery.data?.items ?? []).length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-brand-muted">
                    No items match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between text-sm text-brand-muted">
          <span>
            Page {page + 1} of {pageCount}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="inline-flex items-center gap-1 rounded-lg border border-brand-border px-3 py-1.5 text-brand-text disabled:opacity-40"
            >
              <ChevronLeft size={14} /> Prev
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              disabled={page >= pageCount - 1}
              className="inline-flex items-center gap-1 rounded-lg border border-brand-border px-3 py-1.5 text-brand-text disabled:opacity-40"
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
