import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Plus,
  PackageSearch,
  Calculator,
  Save,
  Send,
  ExternalLink,
  Copy,
  ArrowLeft,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "../components/layout/AppShell";
import { supabase } from "../lib/supabase";
import { queryClient } from "../lib/queryClient";
import {
  useQuoteLineItems,
  newLineItemId,
  type QuoteLineItemDraft,
} from "../hooks/useQuoteLineItems";
import { useProfile } from "../context/ProfileContext";
import { getJobName } from "../lib/quoteListMeta";
import {
  QuoteHeaderCard,
  type QuoteHeaderFields,
} from "../components/quote-editor/QuoteHeaderCard";
import { LineItemRow } from "../components/quote-editor/LineItemRow";
import {
  CatalogueSearchModal,
  type SupplierSearchItem,
} from "../components/quote-editor/CatalogueSearchModal";
import {
  TotalsPanel,
  computeQuoteTotals,
} from "../components/quote-editor/TotalsPanel";
import { ConfirmButton } from "../components/shared/ConfirmButton";
import { formatAud } from "../components/quote-editor/currency";
import type { SavedQuote } from "../types/quote.types";

// ─── quote.bom shape helpers ──────────────────────────────────────────────────
// quotes.bom is a BOMResult ({ fenceItems, gateItems, total, gst, grandTotal })
// but legacy/local rows may carry { items, grandTotal } instead — handle both.

interface LooseBomLine {
  description?: string;
  name?: string;
  sku?: string;
  quantity?: number;
  lineTotal?: number;
}

function getBomLines(bom: unknown): LooseBomLine[] {
  if (!bom || typeof bom !== "object") return [];
  const record = bom as Record<string, unknown>;
  const lines: LooseBomLine[] = [];
  for (const key of ["fenceItems", "gateItems", "items"]) {
    const value = record[key];
    if (Array.isArray(value)) lines.push(...(value as LooseBomLine[]));
  }
  return lines;
}

/** Grand total ex GST, derived from whichever totals the saved bom JSON carries. */
function getBomTotalExGst(bom: unknown): number {
  if (!bom || typeof bom !== "object") return 0;
  const record = bom as Record<string, unknown>;
  if (typeof record.total === "number" && Number.isFinite(record.total)) {
    return record.total;
  }
  if (typeof record.grandTotal === "number" && Number.isFinite(record.grandTotal)) {
    if (typeof record.gst === "number" && Number.isFinite(record.gst)) {
      return record.grandTotal - record.gst;
    }
    return record.grandTotal / 1.1; // inc-GST fallback
  }
  return getBomLines(bom).reduce((sum, line) => sum + (line.lineTotal ?? 0), 0);
}

function hasBomContent(bom: unknown): boolean {
  return getBomLines(bom).length > 0 || getBomTotalExGst(bom) > 0;
}

function summariseBom(bom: unknown): string {
  const lines = getBomLines(bom);
  if (lines.length === 0) return "Materials package from fence calculator.";
  const top = [...lines]
    .sort((a, b) => (b.lineTotal ?? 0) - (a.lineTotal ?? 0))
    .slice(0, 5)
    .map(
      (line) =>
        `${line.quantity ?? 1}× ${line.name || line.description || line.sku || "item"}`,
    );
  const more = lines.length > 5 ? ` + ${lines.length - 5} more lines` : "";
  return `Calculated materials package (${lines.length} lines): ${top.join(", ")}${more}.`;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function QuoteEditorPage() {
  const { quoteId } = useParams<{ quoteId: string }>();
  // Fetch the quotes row directly. useQuote() is calculator-oriented: it
  // reconstructs a canonical payload and falls back to a mock quote when that
  // fails — which it always does for quotes that were never drawn (empty
  // fence_config, no runs). The editor only needs the row.
  const quoteQuery = useQuery<SavedQuote>({
    queryKey: ["quote-row", quoteId],
    enabled: Boolean(quoteId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quotes")
        .select("*")
        .eq("id", quoteId!)
        .single();
      if (error) throw error;
      return data as SavedQuote;
    },
  });
  const { lineItemsQuery, saveLineItems } = useQuoteLineItems(quoteId);
  const { orgId: profileOrgId } = useProfile();

  const quote = quoteQuery.data;
  const orgId = profileOrgId ?? quote?.org_id ?? null;

  const [fields, setFields] = useState<QuoteHeaderFields | null>(null);
  const [items, setItems] = useState<QuoteLineItemDraft[] | null>(null);
  const [showCatalogueModal, setShowCatalogueModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);

  // Initialise header fields from the loaded quote (once).
  useEffect(() => {
    if (!quote || fields !== null) return;
    setFields({
      title: quote.title ?? getJobName(quote) ?? "",
      expiry_days: quote.expiry_days ?? 30,
      notes: quote.notes ?? "",
      contact: {
        name: quote.contact?.fullName ?? "",
        email: quote.contact?.email ?? "",
        phone: quote.contact?.phone ?? "",
        address: quote.contact?.deliveryAddress ?? "",
      },
    });
  }, [quote, fields]);

  // Initialise line items from the server list (once).
  useEffect(() => {
    if (items !== null || !lineItemsQuery.data) return;
    setItems(lineItemsQuery.data.map((row) => ({ ...row })));
  }, [lineItemsQuery.data, items]);

  const depositQuery = useQuery({
    queryKey: ["quote-settings-deposit", quote?.org_id],
    enabled: !!quote?.org_id,
    queryFn: async (): Promise<number | null> => {
      const { data, error } = await supabase
        .from("quote_settings")
        .select("default_deposit")
        .eq("org_id", quote!.org_id)
        .maybeSingle();
      if (error) return null;
      return typeof data?.default_deposit === "number"
        ? data.default_deposit
        : null;
    },
  });

  const totals = useMemo(() => computeQuoteTotals(items ?? []), [items]);
  const hasBom = useMemo(() => hasBomContent(quote?.bom), [quote?.bom]);
  const portalUrl = quoteId
    ? `${window.location.origin}/q/${quoteId}`
    : "";
  const isSentOrAccepted =
    quote?.status === "sent" || quote?.status === "accepted";

  // ── line item mutations (local state) ─────────────────────────────────────

  const blankDraft = (
    overrides: Partial<QuoteLineItemDraft>,
  ): QuoteLineItemDraft => ({
    id: newLineItemId(),
    org_id: orgId ?? "",
    quote_id: quoteId ?? "",
    sort_order: (items?.length ?? 0) + 1,
    kind: "manual",
    title: "",
    description: "",
    quantity: 1,
    unit: "each",
    unit_price: 0,
    is_optional: false,
    material_cost: null,
    labor_cost: null,
    markup_pct: null,
    bom_snapshot: null,
    supplier_item_id: null,
    metadata: null,
    ...overrides,
  });

  const addManualLine = () => {
    setItems((prev) => [...(prev ?? []), blankDraft({ kind: "manual" })]);
  };

  const addCatalogueLine = (item: SupplierSearchItem) => {
    setItems((prev) => [
      ...(prev ?? []),
      blankDraft({
        kind: "catalogue",
        title: item.description,
        description: `${item.sku} / ${item.supplier_name}`,
        quantity: 1,
        unit: item.unit || "each",
        material_cost: item.price, // cost price × default qty 1
        supplier_item_id: item.id,
        metadata: {
          sku: item.sku,
          supplier_slug: item.supplier_slug,
          supplier_name: item.supplier_name,
          unit_cost: item.price,
        },
      }),
    ]);
    setShowCatalogueModal(false);
  };

  const addBomLine = () => {
    if (!quote || !hasBom) return;
    const materialCost = Math.round(getBomTotalExGst(quote.bom) * 100) / 100;
    setItems((prev) => [
      ...(prev ?? []),
      blankDraft({
        kind: "calculated",
        title:
          (fields?.title?.trim() || getJobName(quote)) + " — fence supply",
        description: summariseBom(quote.bom),
        quantity: 1,
        unit: "job",
        material_cost: materialCost,
        bom_snapshot: quote.bom ?? null,
      }),
    ]);
  };

  const updateItem = (index: number, next: QuoteLineItemDraft) => {
    setItems((prev) => {
      if (!prev) return prev;
      const copy = [...prev];
      copy[index] = next;
      return copy;
    });
  };

  const moveItem = (index: number, direction: -1 | 1) => {
    setItems((prev) => {
      if (!prev) return prev;
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const copy = [...prev];
      [copy[index], copy[target]] = [copy[target], copy[index]];
      return copy;
    });
  };

  const deleteItem = (index: number) => {
    setItems((prev) => (prev ? prev.filter((_, i) => i !== index) : prev));
  };

  // ── persistence ───────────────────────────────────────────────────────────

  const persistQuoteFields = async () => {
    if (!quote || !fields) return;
    const updates: Partial<SavedQuote> = {
      title: fields.title.trim() || null,
      expiry_days: fields.expiry_days,
      notes: fields.notes,
      contact: {
        ...quote.contact,
        fullName: fields.contact.name,
        email: fields.contact.email,
        phone: fields.contact.phone,
        deliveryAddress: fields.contact.address,
        fulfilment: quote.contact?.fulfilment ?? "pickup",
      },
    };
    const { error } = await supabase
      .from("quotes")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", quote.id);
    if (error) throw error;
  };

  const handleSave = async () => {
    if (!quote || !fields || saving) return;
    setSaving(true);
    try {
      await persistQuoteFields();
      if (items) await saveLineItems.mutateAsync(items);
      await queryClient.invalidateQueries({ queryKey: ["quote-row", quoteId] });
      await queryClient.invalidateQueries({ queryKey: ["quote", quoteId] });
      await queryClient.invalidateQueries({ queryKey: ["quotes"] });
      toast.success("Quote saved");
    } catch (err) {
      console.error("[QuoteEditorPage] save failed", err);
      toast.error("Failed to save quote");
    } finally {
      setSaving(false);
    }
  };

  const handleSend = async () => {
    if (!quote || sending) return;
    setSending(true);
    try {
      await persistQuoteFields();
      if (items) await saveLineItems.mutateAsync(items);
      const { error } = await supabase
        .from("quotes")
        .update({ status: "sent", updated_at: new Date().toISOString() })
        .eq("id", quote.id);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["quote-row", quoteId] });
      await queryClient.invalidateQueries({ queryKey: ["quote", quoteId] });
      await queryClient.invalidateQueries({ queryKey: ["quotes"] });
      toast.success("Quote marked as sent — share the client link below");
    } catch (err) {
      console.error("[QuoteEditorPage] send failed", err);
      toast.error("Failed to send quote");
    } finally {
      setSending(false);
    }
  };

  const handleCopyPortalLink = () => {
    void navigator.clipboard.writeText(portalUrl);
    toast.success("Client link copied to clipboard");
  };

  // ── render ────────────────────────────────────────────────────────────────

  if (quoteQuery.isLoading || !quote || !fields) {
    return (
      <AppShell>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 flex items-center justify-center gap-2 text-sm text-brand-muted">
          <Loader2 size={16} className="animate-spin" /> Loading quote editor…
        </div>
      </AppShell>
    );
  }

  const itemList = items ?? [];

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        {/* ── Page header ─────────────────────────────────────── */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              to="/quotes"
              title="Back to quotes"
              className="p-1.5 rounded-md text-brand-muted hover:text-brand-text border border-brand-border bg-brand-card transition-colors"
            >
              <ArrowLeft size={16} />
            </Link>
            <div>
              <h1 className="text-lg font-bold text-brand-text">
                Quote editor
              </h1>
              <p className="text-xs text-brand-muted">
                {fields.title.trim() || getJobName(quote)}
              </p>
            </div>
          </div>

          {/* Actions bar */}
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={portalUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-brand-text bg-brand-card border border-brand-border rounded-lg hover:bg-brand-bg/60 transition-colors"
            >
              <ExternalLink size={14} />
              Preview client view
            </a>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving || sending}
              data-testid="quote-editor-save-btn"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-brand-accent hover:bg-brand-accent-hover rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Save size={14} />
              )}
              Save
            </button>
            <ConfirmButton
              onConfirm={() => void handleSend()}
              disabled={sending || saving}
              confirmLabel={
                <span className="inline-flex items-center gap-1.5">
                  <Send size={14} /> Confirm send?
                </span>
              }
              data-testid="quote-editor-send-btn"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg border border-brand-border bg-brand-card text-brand-text hover:bg-brand-bg/60 transition-colors disabled:opacity-50"
            >
              <span className="inline-flex items-center gap-1.5">
                {sending ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Send size={14} />
                )}
                Send
              </span>
            </ConfirmButton>
          </div>
        </div>

        {/* Portal link once sent */}
        {isSentOrAccepted && (
          <div className="flex flex-wrap items-center gap-2 bg-brand-card border border-brand-border rounded-lg px-4 py-2.5">
            <span className="text-xs font-medium text-brand-muted">
              Client link:
            </span>
            <code className="text-xs text-brand-text bg-brand-bg/60 border border-brand-border/60 rounded px-2 py-1 break-all">
              {portalUrl}
            </code>
            <button
              type="button"
              onClick={handleCopyPortalLink}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-brand-accent hover:bg-brand-accent/10 rounded transition-colors"
            >
              <Copy size={12} /> Copy
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
          {/* ── Left: header + line items ─────────────────────── */}
          <div className="lg:col-span-2 space-y-5">
            <QuoteHeaderCard
              fields={fields}
              status={quote.status}
              quoteNumber={quote.quote_number ?? null}
              onChange={setFields}
            />

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-brand-text">
                  Line items
                </h2>
                <span className="text-xs text-brand-muted">
                  {itemList.length} item{itemList.length !== 1 ? "s" : ""}
                </span>
              </div>

              {lineItemsQuery.isLoading && items === null ? (
                <p className="text-sm text-brand-muted py-6 text-center bg-brand-card border border-brand-border rounded-xl">
                  Loading line items…
                </p>
              ) : itemList.length === 0 ? (
                <p className="text-sm text-brand-muted py-8 text-center bg-brand-card border border-dashed border-brand-border rounded-xl">
                  No line items yet — add one below.
                </p>
              ) : (
                <div className="space-y-3">
                  {itemList.map((item, index) => (
                    <LineItemRow
                      key={item.id}
                      item={item}
                      index={index}
                      count={itemList.length}
                      onChange={(next) => updateItem(index, next)}
                      onMove={(direction) => moveItem(index, direction)}
                      onDelete={() => deleteItem(index)}
                    />
                  ))}
                </div>
              )}

              {/* Add buttons */}
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={addManualLine}
                  data-testid="add-manual-line-btn"
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-brand-text bg-brand-card border border-brand-border rounded-lg hover:bg-brand-bg/60 transition-colors"
                >
                  <Plus size={14} /> Manual line
                </button>
                <button
                  type="button"
                  onClick={() => setShowCatalogueModal(true)}
                  data-testid="add-catalogue-line-btn"
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-brand-text bg-brand-card border border-brand-border rounded-lg hover:bg-brand-bg/60 transition-colors"
                >
                  <PackageSearch size={14} /> Catalogue item
                </button>
                <button
                  type="button"
                  onClick={addBomLine}
                  disabled={!hasBom}
                  title={
                    hasBom
                      ? "Import the saved calculator BOM as a line item"
                      : "This quote has no saved calculator BOM"
                  }
                  data-testid="add-bom-line-btn"
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-brand-text bg-brand-card border border-brand-border rounded-lg hover:bg-brand-bg/60 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Calculator size={14} /> From calculator BOM
                  {hasBom && (
                    <span className="text-xs text-brand-muted">
                      ({formatAud(getBomTotalExGst(quote.bom))} ex GST)
                    </span>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* ── Right: totals ─────────────────────────────────── */}
          <TotalsPanel totals={totals} depositPct={depositQuery.data ?? null} />
        </div>
      </div>

      {showCatalogueModal && (
        <CatalogueSearchModal
          onPick={addCatalogueLine}
          onClose={() => setShowCatalogueModal(false)}
        />
      )}
    </AppShell>
  );
}
