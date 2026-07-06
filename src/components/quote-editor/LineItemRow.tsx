import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  ArrowUp,
  ArrowDown,
  Trash2,
  Lock,
  X,
} from "lucide-react";
import { Input } from "../ui/Input";
import { ConfirmButton } from "../shared/ConfirmButton";
import type { QuoteLineItemDraft } from "../../hooks/useQuoteLineItems";
import { formatAud } from "./currency";

const KIND_LABELS: Record<QuoteLineItemDraft["kind"], string> = {
  calculated: "Calculator BOM",
  catalogue: "Catalogue",
  manual: "Manual",
  library: "Library",
  heading: "Heading",
  text: "Text",
};

const NUM_INPUT_CLASS = "px-2 py-1.5 text-sm w-full text-right";

function toNumber(raw: string): number {
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function toNullableNumber(raw: string): number | null {
  if (raw.trim() === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function LineItemRow({
  item,
  index,
  count,
  onChange,
  onMove,
  onDelete,
}: {
  item: QuoteLineItemDraft;
  index: number;
  count: number;
  onChange: (item: QuoteLineItemDraft) => void;
  onMove: (direction: -1 | 1) => void;
  onDelete: () => void;
}) {
  const [descriptionOpen, setDescriptionOpen] = useState(false);
  // Replica pattern: "Show Internal Costs & Margins" — closed by default.
  const [internalOpen, setInternalOpen] = useState(false);

  const lineTotal = item.quantity * item.unit_price;
  const materialCost = item.material_cost ?? 0;
  const laborCost = item.labor_cost ?? 0;
  const hasCosts = item.material_cost != null || item.labor_cost != null;
  const totalCost = materialCost + laborCost;
  const markupPct = item.markup_pct ?? 0;
  const suggestedLinePrice = totalCost * (1 + markupPct / 100);
  const suggestedUnitPrice =
    item.quantity > 0 ? suggestedLinePrice / item.quantity : null;
  const marginDollars = lineTotal - totalCost;
  const marginPct = lineTotal > 0 ? (marginDollars / lineTotal) * 100 : null;

  const set = <K extends keyof QuoteLineItemDraft>(
    key: K,
    value: QuoteLineItemDraft[K],
  ) => onChange({ ...item, [key]: value });

  // ── Structure-only rows (Quotient-style headings / free text) ─────────────
  if (item.kind === "heading" || item.kind === "text") {
    return (
      <div
        data-testid="line-item-row"
        className="group flex items-start gap-2 rounded-lg border border-transparent px-2 py-1.5 hover:border-brand-border/60"
      >
        <div className="flex shrink-0 flex-col gap-0.5 pt-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            onClick={() => onMove(-1)}
            disabled={index === 0}
            title="Move up"
            className="p-0.5 text-brand-muted hover:text-brand-text disabled:opacity-30"
          >
            <ArrowUp size={13} />
          </button>
          <button
            type="button"
            onClick={() => onMove(1)}
            disabled={index === count - 1}
            title="Move down"
            className="p-0.5 text-brand-muted hover:text-brand-text disabled:opacity-30"
          >
            <ArrowDown size={13} />
          </button>
        </div>
        {item.kind === "heading" ? (
          <input
            value={item.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="Section heading"
            className="min-w-0 flex-1 border-0 bg-transparent px-1 py-1 text-xl font-black tracking-tight text-brand-text outline-none placeholder:text-brand-muted/50"
          />
        ) : (
          <textarea
            value={item.description ?? ""}
            onChange={(e) => set("description", e.target.value)}
            placeholder="Write a note, terms, or any free text for the client…"
            rows={Math.max(2, (item.description ?? "").split("\n").length)}
            className="min-w-0 flex-1 resize-y rounded-md border-0 bg-transparent px-1 py-1 text-sm leading-relaxed text-brand-text outline-none placeholder:text-brand-muted/50"
          />
        )}
        <ConfirmButton
          onConfirm={onDelete}
          confirmLabel={<span className="text-xs px-1">Confirm?</span>}
          title={item.kind === "heading" ? "Delete heading" : "Delete text"}
          className="shrink-0 p-1.5 mt-1 rounded-md text-brand-muted hover:text-brand-danger transition-colors border border-transparent opacity-0 group-hover:opacity-100"
        >
          <Trash2 size={15} />
        </ConfirmButton>
      </div>
    );
  }

  return (
    <div
      data-testid="line-item-row"
      className="border border-brand-border rounded-lg bg-brand-card overflow-hidden"
    >
      {/* ── Card header (replica: "Item #N" + Optional badge + ✕ Remove) ── */}
      <div className="flex items-center justify-between gap-2 border-b border-brand-border/60 bg-brand-bg/40 px-3 py-1.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-xs font-semibold text-brand-muted">
            Item #{index + 1}
          </span>
          <span className="shrink-0 text-[10px] uppercase tracking-wider text-brand-muted bg-brand-bg/60 border border-brand-border/60 rounded px-1.5 py-0.5">
            {KIND_LABELS[item.kind]}
          </span>
          {item.is_optional && (
            <span
              data-testid="optional-badge"
              className="shrink-0 rounded bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-sky-500"
            >
              Optional
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {/* Prominent per-row optional toggle (replica keeps this front-and-centre) */}
          <label className="mr-1 flex cursor-pointer items-center gap-1.5 text-xs text-brand-muted hover:text-brand-text">
            <input
              type="checkbox"
              checked={item.is_optional}
              onChange={(e) => set("is_optional", e.target.checked)}
              className="accent-brand-accent rounded"
            />
            Optional
          </label>
          <button
            type="button"
            onClick={() => onMove(-1)}
            disabled={index === 0}
            title="Move up"
            className="p-1 text-brand-muted hover:text-brand-text disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ArrowUp size={13} />
          </button>
          <button
            type="button"
            onClick={() => onMove(1)}
            disabled={index === count - 1}
            title="Move down"
            className="p-1 text-brand-muted hover:text-brand-text disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ArrowDown size={13} />
          </button>
          <ConfirmButton
            onConfirm={onDelete}
            confirmLabel={<span className="text-xs px-1">Confirm?</span>}
            title="Delete line item"
            className="p-1 rounded-md text-brand-muted hover:text-brand-danger transition-colors"
          >
            <Trash2 size={14} />
          </ConfirmButton>
        </div>
      </div>

      {/* ── Client-facing fields ─────────────────────────────── */}
      <div className="flex items-start gap-3 p-3">
        {/* Item photo (replica renders scraped item images on priced rows) */}
        {item.image_url ? (
          <div className="group/img relative shrink-0">
            <img
              src={item.image_url}
              alt=""
              data-testid="line-item-image"
              className="h-16 w-16 rounded-lg border border-brand-border object-cover"
            />
            <button
              type="button"
              onClick={() => set("image_url", null)}
              title="Remove image"
              data-testid="remove-line-item-image"
              className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-brand-border bg-brand-card text-brand-muted opacity-0 shadow transition-opacity hover:text-brand-danger group-hover/img:opacity-100"
            >
              <X size={11} />
            </button>
          </div>
        ) : null}

        <div className="min-w-0 flex-1 space-y-2">
          <Input
            value={item.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="Item title"
            className="w-full px-2 py-1.5 font-medium"
          />

          <div className="grid grid-cols-2 items-center gap-2 sm:grid-cols-[6rem_6rem_8rem_1fr]">
            <label className="flex flex-col gap-0.5">
              <span className="text-[10px] text-brand-muted">Qty</span>
              <Input
                type="number"
                min={0}
                step="any"
                value={String(item.quantity)}
                onChange={(e) => set("quantity", toNumber(e.target.value))}
                className={NUM_INPUT_CLASS}
              />
            </label>
            <label className="flex flex-col gap-0.5">
              <span className="text-[10px] text-brand-muted">Unit</span>
              <Input
                value={item.unit}
                onChange={(e) => set("unit", e.target.value)}
                className="px-2 py-1.5 text-sm w-full"
              />
            </label>
            <label className="flex flex-col gap-0.5">
              <span className="text-[10px] text-brand-muted">
                Rate (ex GST)
              </span>
              <Input
                type="number"
                min={0}
                step="any"
                value={String(item.unit_price)}
                onChange={(e) => set("unit_price", toNumber(e.target.value))}
                className={NUM_INPUT_CLASS}
              />
            </label>
            <div className="flex flex-col gap-0.5 sm:items-end">
              <span className="text-[10px] text-brand-muted">Line total</span>
              <span className="py-1.5 font-mono text-sm font-semibold tabular-nums text-brand-text">
                {formatAud(lineTotal)}
              </span>
            </div>
          </div>

          <div>
            <button
              type="button"
              onClick={() => setDescriptionOpen((v) => !v)}
              className="inline-flex items-center gap-1 text-xs text-brand-muted hover:text-brand-text transition-colors"
            >
              {descriptionOpen ? (
                <ChevronUp size={12} />
              ) : (
                <ChevronDown size={12} />
              )}
              Description
              {!descriptionOpen && item.description?.trim() ? (
                <span className="truncate max-w-[24rem] text-brand-muted/70">
                  — {item.description.split("\n")[0]}
                </span>
              ) : null}
            </button>
            {descriptionOpen && (
              <textarea
                value={item.description ?? ""}
                onChange={(e) => set("description", e.target.value)}
                rows={3}
                placeholder="Client-facing description…"
                className="mt-1 w-full bg-white border border-brand-border dark:bg-brand-card dark:border-brand-border rounded-[var(--brand-radius-sm)] px-2 py-1.5 text-sm text-brand-text focus:outline-none focus:ring-1 focus:ring-brand-accent/50 focus:border-brand-accent resize-y"
              />
            )}
          </div>
        </div>
      </div>

      {/* ── Internal costing — collapsed behind a toggle, replica-style ── */}
      <div className="border-t border-dashed border-brand-border bg-brand-bg/60 px-3 py-2">
        <button
          type="button"
          onClick={() => setInternalOpen((v) => !v)}
          data-testid="internal-toggle-btn"
          className="flex w-full items-center justify-between gap-2 text-left"
        >
          <span className="inline-flex items-center gap-1.5">
            <Lock size={11} className="text-brand-muted" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-brand-muted">
              Internal — costs & margin
            </span>
          </span>
          <span className="inline-flex items-center gap-2">
            {hasCosts && !internalOpen && (
              <span
                className={`font-mono text-[11px] font-semibold tabular-nums ${marginDollars >= 0 ? "text-emerald-500" : "text-brand-danger"}`}
              >
                {formatAud(marginDollars)}
                {marginPct != null ? ` (${marginPct.toFixed(1)}%)` : ""}
              </span>
            )}
            {internalOpen ? (
              <ChevronUp size={12} className="text-brand-muted" />
            ) : (
              <ChevronDown size={12} className="text-brand-muted" />
            )}
          </span>
        </button>

        {internalOpen && (
          <div className="mt-2 grid grid-cols-2 items-end gap-2 sm:grid-cols-[8rem_8rem_6rem_1fr_1fr]">
            <label className="flex flex-col gap-0.5">
              <span className="text-[10px] text-brand-muted">Material cost</span>
              <Input
                type="number"
                min={0}
                step="any"
                value={item.material_cost == null ? "" : String(item.material_cost)}
                onChange={(e) =>
                  set("material_cost", toNullableNumber(e.target.value))
                }
                placeholder="—"
                className={NUM_INPUT_CLASS}
              />
            </label>
            <label className="flex flex-col gap-0.5">
              <span className="text-[10px] text-brand-muted">Labour cost</span>
              <Input
                type="number"
                min={0}
                step="any"
                value={item.labor_cost == null ? "" : String(item.labor_cost)}
                onChange={(e) =>
                  set("labor_cost", toNullableNumber(e.target.value))
                }
                placeholder="—"
                className={NUM_INPUT_CLASS}
              />
            </label>
            <label className="flex flex-col gap-0.5">
              <span className="text-[10px] text-brand-muted">Markup %</span>
              <Input
                type="number"
                step="any"
                value={item.markup_pct == null ? "" : String(item.markup_pct)}
                onChange={(e) =>
                  set("markup_pct", toNullableNumber(e.target.value))
                }
                placeholder="—"
                className={NUM_INPUT_CLASS}
              />
            </label>

            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] text-brand-muted">Suggested price</span>
              {hasCosts && suggestedUnitPrice != null ? (
                <button
                  type="button"
                  onClick={() =>
                    set(
                      "unit_price",
                      Math.round(suggestedUnitPrice * 100) / 100,
                    )
                  }
                  title="Set unit price to the suggested price"
                  className="inline-flex items-center gap-1.5 self-start px-2 py-1 rounded-full border border-brand-accent/50 text-xs font-medium text-brand-accent hover:bg-brand-accent/10 transition-colors"
                >
                  {formatAud(suggestedUnitPrice)}/{item.unit || "unit"}
                  <span className="text-[10px] uppercase tracking-wide">
                    Apply
                  </span>
                </button>
              ) : (
                <span className="text-xs text-brand-muted py-1">
                  {item.quantity > 0 ? "Enter costs" : "Qty required"}
                </span>
              )}
            </div>

            <div className="flex flex-col gap-0.5 sm:items-end">
              <span className="text-[10px] text-brand-muted">Line margin</span>
              {hasCosts ? (
                <span
                  className={`font-mono tabular-nums text-xs font-semibold py-1 ${marginDollars >= 0 ? "text-emerald-500" : "text-brand-danger"}`}
                >
                  {formatAud(marginDollars)}
                  {marginPct != null ? ` (${marginPct.toFixed(1)}%)` : ""}
                </span>
              ) : (
                <span className="text-xs text-brand-muted py-1">—</span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
