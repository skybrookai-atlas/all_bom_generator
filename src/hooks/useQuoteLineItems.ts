import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { queryClient } from '../lib/queryClient';

export type QuoteLineItemKind =
  | 'calculated'
  | 'catalogue'
  | 'manual'
  | 'library'
  | 'heading'
  | 'text';

/** Row shape of quote_line_items (internal, staff-only — never exposed to the portal). */
export interface QuoteLineItem {
  id: string;
  org_id: string;
  quote_id: string;
  sort_order: number;
  kind: QuoteLineItemKind;
  title: string;
  description: string | null;
  quantity: number;
  unit: string;
  /** Ex-GST sell price per unit. */
  unit_price: number;
  is_optional: boolean;
  material_cost: number | null;
  labor_cost: number | null;
  markup_pct: number | null;
  bom_snapshot: unknown | null;
  supplier_item_id: string | null;
  metadata: Record<string, unknown> | null;
}

/** Editable draft — same columns; new rows carry a client-generated uuid so upsert works. */
export type QuoteLineItemDraft = QuoteLineItem;

export function newLineItemId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function serialise(item: QuoteLineItemDraft): string {
  return JSON.stringify([
    item.sort_order,
    item.kind,
    item.title,
    item.description,
    item.quantity,
    item.unit,
    item.unit_price,
    item.is_optional,
    item.material_cost,
    item.labor_cost,
    item.markup_pct,
    item.bom_snapshot,
    item.supplier_item_id,
    item.metadata,
  ]);
}

export function useQuoteLineItems(quoteId: string | undefined) {
  const lineItemsQuery = useQuery({
    queryKey: ['quote-line-items', quoteId],
    enabled: !!quoteId,
    queryFn: async (): Promise<QuoteLineItem[]> => {
      const { data, error } = await supabase
        .from('quote_line_items')
        .select('*')
        .eq('quote_id', quoteId!)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return (data ?? []) as QuoteLineItem[];
    },
  });

  /**
   * Diff-and-save: compares the edited list against the last-loaded server rows.
   * - rows whose id no longer appears → deleted
   * - new ids or changed rows → upserted (sort_order is re-derived from array position)
   * Unchanged rows are skipped entirely.
   */
  const saveLineItems = useMutation({
    mutationFn: async (items: QuoteLineItemDraft[]) => {
      if (!quoteId) throw new Error('Missing quote id');

      const serverRows =
        queryClient.getQueryData<QuoteLineItem[]>(['quote-line-items', quoteId]) ??
        lineItemsQuery.data ??
        [];
      const serverById = new Map(serverRows.map((row) => [row.id, row]));

      const normalised = items.map((item, index) => ({
        ...item,
        quote_id: quoteId,
        sort_order: index + 1,
      }));

      const keptIds = new Set(normalised.map((item) => item.id));
      const deletedIds = serverRows
        .map((row) => row.id)
        .filter((id) => !keptIds.has(id));

      const changed = normalised.filter((item) => {
        const existing = serverById.get(item.id);
        if (!existing) return true; // new row
        return serialise(existing) !== serialise(item);
      });

      if (deletedIds.length > 0) {
        const { error } = await supabase
          .from('quote_line_items')
          .delete()
          .in('id', deletedIds);
        if (error) throw error;
      }

      if (changed.length > 0) {
        const { error } = await supabase
          .from('quote_line_items')
          .upsert(changed, { onConflict: 'id' });
        if (error) throw error;
      }

      return { upserted: changed.length, deleted: deletedIds.length };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['quote-line-items', quoteId] });
    },
  });

  return { lineItemsQuery, saveLineItems };
}
