import { useState } from "react";
import { ArrowLeftRight, Loader2 } from "lucide-react";
import { supabase } from "../../lib/supabase";
import {
  supplierAlternativesFor,
  type SupplierAlternative,
} from "../../lib/supplierAlternatives";
import type { BOMLineItem } from "../../types/bom.types";

export interface SwapChoice {
  sku: string;
  supplierLabel: string;
  name: string;
  unitPrice: number;
}

interface Props {
  item: BOMLineItem;
  onSwap: (item: BOMLineItem, choice: SwapChoice) => void;
}

/**
 * "Swap supplier" affordance for BOM lines with known cross-supplier
 * equivalents (colorbond posts/rails/sheets/caps). Prices come from the
 * server via the search-products edge function — never bundled client-side.
 */
export function SupplierSwapButton({ item, onSwap }: Props) {
  const alternatives = supplierAlternativesFor(item.sku);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [choices, setChoices] = useState<SwapChoice[] | null>(null);

  if (!alternatives.length) return null;

  const load = async () => {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    if (choices) return;
    setLoading(true);
    try {
      const found: SwapChoice[] = [];
      await Promise.all(
        alternatives.map(async (alt: SupplierAlternative) => {
          const { data, error } = await supabase.functions.invoke("search-products", {
            body: { query: alt.sku, limit: 3 },
          });
          if (error) return;
          const hit = (data?.items ?? []).find(
            (i: { sku: string }) => i.sku === alt.sku,
          );
          if (hit && Number(hit.default_price) > 0) {
            found.push({
              sku: alt.sku,
              supplierLabel: alt.supplierLabel,
              name: hit.name ?? alt.sku,
              unitPrice: Number(hit.default_price),
            });
          }
        }),
      );
      found.sort((a, b) => a.unitPrice - b.unitPrice);
      setChoices(found);
    } finally {
      setLoading(false);
    }
  };

  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <button
        type="button"
        onClick={() => void load()}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-brand-accent/40 bg-brand-accent/5 px-3 py-2 text-xs font-black text-brand-accent transition-colors hover:bg-brand-accent/15"
        title="Show this item from other suppliers"
      >
        {loading ? <Loader2 size={13} className="animate-spin" /> : <ArrowLeftRight size={13} />}
        Swap supplier
      </button>
      {open && choices && choices.length === 0 && !loading && (
        <span className="text-[11px] font-semibold text-brand-muted">
          No priced equivalents found
        </span>
      )}
      {open &&
        choices?.map((choice) => (
          <button
            key={choice.sku}
            type="button"
            onClick={() => {
              setOpen(false);
              onSwap(item, choice);
            }}
            className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-brand-border bg-brand-card px-3 py-2 text-xs font-bold text-brand-text transition-colors hover:border-brand-accent hover:text-brand-accent"
            title={choice.name}
          >
            {choice.supplierLabel}
            <span className="font-black">${choice.unitPrice.toFixed(2)}</span>
          </button>
        ))}
    </span>
  );
}
