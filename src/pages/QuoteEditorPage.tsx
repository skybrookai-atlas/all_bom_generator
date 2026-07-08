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
  Heading1,
  Text as TextIcon,
  BookMarked,
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
import { LineItemRow } from "../components/quote-editor/LineItemRow";
import {
  ClientPicker,
  type ClientRow,
  type ContactSnapshot,
} from "../components/quote-editor/ClientPicker";
import {
  CatalogueSearchModal,
  type SupplierSearchItem,
} from "../components/quote-editor/CatalogueSearchModal";
import {
  LibrarySearchModal,
  type LibraryItem,
} from "../components/quote-editor/LibrarySearchModal";
import {
  TotalsFooter,
  computeQuoteTotals,
} from "../components/quote-editor/TotalsPanel";
import { ConfirmButton } from "../components/shared/ConfirmButton";
import { QuoteComments } from "../components/quote/QuoteComments";
import { formatAud } from "../components/quote-editor/currency";
import type { QuoteStatus, SavedQuote } from "../types/quote.types";

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

// ─── Editor form state ────────────────────────────────────────────────────────

interface EditorFields {
  title: string;
  expiry_days: number;
  notes: string;
  client_id: string | null;
  contact: ContactSnapshot;
  // Quote details rail (Quotient parity)
  assigned_installer_id: string | null;
  install_date: string | null;
  use_splits: boolean;
  split_ratio_a: number;
  split_ratio_b: number;
  discount_pct: number;
}

const STATUS_COLOURS: Record<QuoteStatus, string> = {
  draft: "text-brand-muted bg-brand-border/30",
  sent: "text-brand-primary bg-brand-primary/10",
  accepted: "text-emerald-400 bg-emerald-500/10",
  expired: "text-rose-400 bg-rose-500/10",
};

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
  const { orgId: profileOrgId, user: profileUser } = useProfile();

  const quote = quoteQuery.data;
  const orgId = profileOrgId ?? quote?.org_id ?? null;

  const [fields, setFields] = useState<EditorFields | null>(null);
  const [items, setItems] = useState<QuoteLineItemDraft[] | null>(null);
  const [showCatalogueModal, setShowCatalogueModal] = useState(false);
  const [showLibraryModal, setShowLibraryModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);

  // Initialise header fields from the loaded quote (once).
  useEffect(() => {
    if (!quote || fields !== null) return;
    setFields({
      title: quote.title ?? getJobName(quote) ?? "",
      expiry_days: quote.expiry_days ?? 30,
      notes: quote.notes ?? "",
      client_id: quote.client_id ?? null,
      contact: {
        name: quote.contact?.fullName ?? "",
        email: quote.contact?.email ?? "",
        phone: quote.contact?.phone ?? "",
        address: quote.contact?.deliveryAddress ?? "",
      },
      assigned_installer_id: quote.assigned_installer_id ?? null,
      install_date: quote.install_date ?? null,
      use_splits: quote.use_splits ?? false,
      split_ratio_a: Number(quote.split_ratio_a ?? 50),
      split_ratio_b: Number(quote.split_ratio_b ?? 50),
      discount_pct: Number((quote as { discount_pct?: number }).discount_pct ?? 0),
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

  const totals = useMemo(
    () => computeQuoteTotals(items ?? [], fields?.discount_pct ?? 0),
    [items, fields?.discount_pct],
  );

  // Installers for the assignment dropdown (same source as the calculator page).
  const installersQuery = useQuery({
    queryKey: ["installers", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("installers")
        .select("id, name")
        .eq("org_id", orgId!)
        .eq("status", "Active")
        .order("name");
      if (error) return [] as Array<{ id: string; name: string }>;
      return (data ?? []) as Array<{ id: string; name: string }>;
    },
  });
  const hasBom = useMemo(() => hasBomContent(quote?.bom), [quote?.bom]);
  const portalUrl = quoteId
    ? `${window.location.origin}/q/${quoteId}`
    : "";
  const isSentOrAccepted =
    quote?.status === "sent" || quote?.status === "accepted";

  // ── client picker handlers ────────────────────────────────────────────────

  // Picking a client links quotes.client_id AND writes the contact snapshot
  // the portal renders — same as the replica filling the Client Details block.
  const handlePickClient = (client: ClientRow) => {
    setFields((prev) =>
      prev
        ? {
            ...prev,
            client_id: client.id,
            contact: {
              name: client.name,
              email: client.email ?? "",
              phone: client.phone ?? "",
              address: client.address ?? "",
            },
          }
        : prev,
    );
  };

  const handleClearClient = () => {
    setFields((prev) => (prev ? { ...prev, client_id: null } : prev));
  };

  // Editing the snapshot fields only touches the quote's contact JSONB.
  const handleContactChange = (contact: ContactSnapshot) => {
    setFields((prev) => (prev ? { ...prev, contact } : prev));
  };

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
    image_url: null,
    metadata: null,
    ...overrides,
  });

  const addManualLine = () => {
    setItems((prev) => [...(prev ?? []), blankDraft({ kind: "manual" })]);
  };

  const addHeading = () => {
    setItems((prev) => [
      ...(prev ?? []),
      blankDraft({ kind: "heading", quantity: 0, unit_price: 0 }),
    ]);
  };

  const addText = () => {
    setItems((prev) => [
      ...(prev ?? []),
      blankDraft({ kind: "text", title: "Text", quantity: 0, unit_price: 0 }),
    ]);
  };

  const addLibraryLine = (libItem: LibraryItem) => {
    setItems((prev) => [
      ...(prev ?? []),
      blankDraft({
        kind: "library",
        title: libItem.title,
        description: libItem.body ?? "",
        quantity: 1,
        unit: libItem.unit ?? "each",
        unit_price: libItem.unit_price,
        image_url: libItem.image_url,
        metadata: { library_item_id: libItem.id },
      }),
    ]);
    setShowLibraryModal(false);
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
    const updates: Partial<SavedQuote> & Record<string, unknown> = {
      title: fields.title.trim() || null,
      expiry_days: fields.expiry_days,
      notes: fields.notes,
      client_id: fields.client_id,
      contact: {
        ...quote.contact,
        fullName: fields.contact.name,
        email: fields.contact.email,
        phone: fields.contact.phone,
        deliveryAddress: fields.contact.address,
        fulfilment: quote.contact?.fulfilment ?? "pickup",
      },
      assigned_installer_id: fields.assigned_installer_id,
      install_date: fields.install_date || null,
      use_splits: fields.use_splits,
      split_ratio_a: fields.split_ratio_a,
      split_ratio_b: fields.split_ratio_b,
      discount_pct: fields.discount_pct,
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
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16 flex items-center justify-center gap-2 text-sm text-brand-muted">
          <Loader2 size={16} className="animate-spin" /> Loading quote editor…
        </div>
      </AppShell>
    );
  }

  const itemList = items ?? [];
  const status = quote.status;

  return (
    <AppShell>
      {/* ── Compact sticky action bar (replica: editor header w/ Save) ── */}
      <div className="sticky top-0 z-30 border-b border-brand-border bg-brand-bg/90 backdrop-blur">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-2 px-4 py-2 sm:px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            <Link
              to="/quotes"
              title="Back to quotes"
              className="rounded-md border border-brand-border bg-brand-card p-1.5 text-brand-muted transition-colors hover:text-brand-text"
            >
              <ArrowLeft size={15} />
            </Link>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-brand-text">
                {fields.title.trim() || getJobName(quote) || "Untitled quote"}
              </p>
              <div className="flex items-center gap-1.5 text-[11px] text-brand-muted">
                {quote.quote_number != null && <span>#{quote.quote_number}</span>}
                <span
                  data-testid="editor-status-badge"
                  className={`rounded-full px-1.5 py-px font-medium ${STATUS_COLOURS[status] ?? "text-brand-muted bg-brand-border/30"}`}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <a
              href={portalUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-brand-border bg-brand-card px-3 py-1.5 text-sm font-medium text-brand-text transition-colors hover:bg-brand-bg/60"
            >
              <ExternalLink size={14} />
              Preview
            </a>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving || sending}
              data-testid="quote-editor-save-btn"
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-accent px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-brand-accent-hover disabled:opacity-50"
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
              className="inline-flex items-center gap-1.5 rounded-lg border border-brand-border bg-brand-card px-4 py-1.5 text-sm font-semibold text-brand-text transition-colors hover:bg-brand-bg/60 disabled:opacity-50"
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
      </div>

      {/* ── Single centered document column (replica: one quote form card) ── */}
      <div className="mx-auto max-w-4xl space-y-5 px-4 py-6 sm:px-6">
        {/* Portal link once sent */}
        {isSentOrAccepted && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-brand-border bg-brand-card px-4 py-2.5">
            <span className="text-xs font-medium text-brand-muted">
              Client link:
            </span>
            <code className="break-all rounded border border-brand-border/60 bg-brand-bg/60 px-2 py-1 text-xs text-brand-text">
              {portalUrl}
            </code>
            <button
              type="button"
              onClick={handleCopyPortalLink}
              className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-semibold text-brand-accent transition-colors hover:bg-brand-accent/10"
            >
              <Copy size={12} /> Copy
            </button>
          </div>
        )}

        {/* Quote title — large editable text, replica's "Job Name / Description" */}
        <div className="space-y-2">
          <input
            value={fields.title}
            onChange={(e) => setFields({ ...fields, title: e.target.value })}
            placeholder="e.g. Boundary fence replacement at 12 Paterson St"
            data-testid="quote-title-input"
            className="w-full border-0 bg-transparent px-0 py-1 text-2xl font-black tracking-tight text-brand-text outline-none placeholder:font-bold placeholder:text-brand-muted/40 sm:text-3xl"
          />
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-brand-muted">
            <label className="flex items-center gap-1.5">
              Valid for
              <input
                type="number"
                min={1}
                value={String(fields.expiry_days)}
                onChange={(e) =>
                  setFields({
                    ...fields,
                    expiry_days: Math.max(
                      1,
                      Math.round(Number(e.target.value) || 0),
                    ),
                  })
                }
                className="w-14 rounded-md border border-brand-border bg-brand-card px-1.5 py-0.5 text-right text-xs text-brand-text outline-none focus:border-brand-accent"
              />
              days
            </label>
            <label className="flex items-center gap-1.5">
              Installer
              <select
                value={fields.assigned_installer_id ?? ""}
                onChange={(e) =>
                  setFields({
                    ...fields,
                    assigned_installer_id: e.target.value || null,
                  })
                }
                data-testid="quote-installer-select"
                className="rounded-md border border-brand-border bg-brand-card px-1.5 py-0.5 text-xs text-brand-text outline-none focus:border-brand-accent"
              >
                <option value="">Unassigned</option>
                {(installersQuery.data ?? []).map((installer) => (
                  <option key={installer.id} value={installer.id}>
                    {installer.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-1.5">
              Install date
              <input
                type="date"
                value={fields.install_date ?? ""}
                onChange={(e) =>
                  setFields({ ...fields, install_date: e.target.value || null })
                }
                className="rounded-md border border-brand-border bg-brand-card px-1.5 py-0.5 text-xs text-brand-text outline-none focus:border-brand-accent"
              />
            </label>
            <label className="flex items-center gap-1.5">
              Discount
              <input
                type="number"
                min={0}
                max={100}
                step="0.5"
                value={String(fields.discount_pct)}
                onChange={(e) =>
                  setFields({
                    ...fields,
                    discount_pct: Math.min(
                      100,
                      Math.max(0, Number(e.target.value) || 0),
                    ),
                  })
                }
                data-testid="quote-discount-input"
                className="w-14 rounded-md border border-brand-border bg-brand-card px-1.5 py-0.5 text-right text-xs text-brand-text outline-none focus:border-brand-accent"
              />
              %
            </label>
            <label className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={fields.use_splits}
                onChange={(e) =>
                  setFields({ ...fields, use_splits: e.target.checked })
                }
                className="h-3.5 w-3.5 accent-brand-accent"
              />
              Neighbour split
            </label>
            {fields.use_splits && (
              <label className="flex items-center gap-1.5">
                A
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={String(fields.split_ratio_a)}
                  onChange={(e) => {
                    const a = Math.min(100, Math.max(0, Number(e.target.value) || 0));
                    setFields({
                      ...fields,
                      split_ratio_a: a,
                      split_ratio_b: Math.round((100 - a) * 100) / 100,
                    });
                  }}
                  className="w-14 rounded-md border border-brand-border bg-brand-card px-1.5 py-0.5 text-right text-xs text-brand-text outline-none focus:border-brand-accent"
                />
                % / B
                <span className="font-semibold text-brand-text">
                  {fields.split_ratio_b}%
                </span>
              </label>
            )}
          </div>
        </div>

        {/* Client block — replica's Client Details section + client book */}
        <ClientPicker
          orgId={orgId}
          clientId={fields.client_id}
          contact={fields.contact}
          onPickClient={handlePickClient}
          onClearClient={handleClearClient}
          onContactChange={handleContactChange}
        />

        {/* ── Line-item document ─────────────────────────────── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-brand-text">
              Quote line items
            </h2>
            <span className="text-xs text-brand-muted">
              {itemList.length} item{itemList.length !== 1 ? "s" : ""}
            </span>
          </div>

          {lineItemsQuery.isLoading && items === null ? (
            <p className="rounded-xl border border-brand-border bg-brand-card py-6 text-center text-sm text-brand-muted">
              Loading line items…
            </p>
          ) : itemList.length === 0 ? (
            <p className="rounded-xl border border-dashed border-brand-border bg-brand-card py-8 text-center text-sm text-brand-muted">
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
              onClick={addHeading}
              data-testid="add-heading-btn"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-brand-text bg-brand-card border border-brand-border rounded-lg hover:bg-brand-bg/60 transition-colors"
            >
              <Heading1 size={14} /> Heading
            </button>
            <button
              type="button"
              onClick={addText}
              data-testid="add-text-btn"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-brand-text bg-brand-card border border-brand-border rounded-lg hover:bg-brand-bg/60 transition-colors"
            >
              <TextIcon size={14} /> Text
            </button>
            <button
              type="button"
              onClick={() => setShowLibraryModal(true)}
              data-testid="add-library-line-btn"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-brand-accent bg-brand-accent/5 border border-brand-accent/40 rounded-lg hover:bg-brand-accent/15 transition-colors"
            >
              <BookMarked size={14} /> Library item
            </button>
            <button
              type="button"
              onClick={addManualLine}
              data-testid="add-manual-line-btn"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-brand-text bg-brand-card border border-brand-border rounded-lg hover:bg-brand-bg/60 transition-colors"
            >
              <Plus size={14} /> Priced item
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

        {/* Notes */}
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-brand-muted">Notes</span>
          <textarea
            value={fields.notes}
            onChange={(e) => setFields({ ...fields, notes: e.target.value })}
            rows={2}
            placeholder="Internal or client-facing notes…"
            className="bg-white border border-brand-border dark:bg-brand-card dark:border-brand-border rounded-[var(--brand-radius-sm)] px-3 py-2 text-sm text-brand-text focus:outline-none focus:ring-1 focus:ring-brand-accent/50 focus:border-brand-accent resize-y"
          />
        </label>

        {/* Discussion thread — same comments the client sees on the portal,
            plus private staff notes (Quotient's Q&A on the quote). */}
        {quoteId && (
          <div className="rounded-xl border border-brand-border bg-brand-card p-4">
            <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-brand-muted">
              Discussion & private notes
            </h3>
            <QuoteComments
              quoteId={quoteId}
              currentUser={
                profileUser
                  ? { email: profileUser.email ?? "", name: profileUser.email ?? "" }
                  : null
              }
              orgId={orgId ?? undefined}
              clientName={fields.contact.name || "Client"}
            />
          </div>
        )}

        {/* ── Slim sticky totals footer ──────────────────────── */}
        <TotalsFooter totals={totals} depositPct={depositQuery.data ?? null} />
      </div>

      {showCatalogueModal && (
        <CatalogueSearchModal
          onPick={addCatalogueLine}
          onClose={() => setShowCatalogueModal(false)}
        />
      )}
      {showLibraryModal && (
        <LibrarySearchModal
          onPick={addLibraryLine}
          onClose={() => setShowLibraryModal(false)}
        />
      )}
    </AppShell>
  );
}
