import { Lock } from "lucide-react";
import type { QuoteLineItemDraft } from "../../hooks/useQuoteLineItems";
import { formatAud } from "./currency";

export interface QuoteTotals {
  subtotalExGst: number;
  optionalTotalExGst: number;
  gst: number;
  totalIncGst: number;
  totalMaterial: number;
  totalLabor: number;
  marginDollars: number;
  marginPct: number | null;
}

/** Totals over non-optional lines; optional lines reported separately. */
export function computeQuoteTotals(items: QuoteLineItemDraft[]): QuoteTotals {
  let subtotal = 0;
  let optionalTotal = 0;
  let totalMaterial = 0;
  let totalLabor = 0;

  for (const item of items) {
    // Structure-only rows carry no pricing.
    if (item.kind === "heading" || item.kind === "text") continue;
    const lineTotal = item.quantity * item.unit_price;
    if (item.is_optional) {
      optionalTotal += lineTotal;
      continue;
    }
    subtotal += lineTotal;
    totalMaterial += item.material_cost ?? 0;
    totalLabor += item.labor_cost ?? 0;
  }

  const gst = subtotal * 0.1;
  const marginDollars = subtotal - totalMaterial - totalLabor;

  return {
    subtotalExGst: subtotal,
    optionalTotalExGst: optionalTotal,
    gst,
    totalIncGst: subtotal + gst,
    totalMaterial,
    totalLabor,
    marginDollars,
    marginPct: subtotal > 0 ? (marginDollars / subtotal) * 100 : null,
  };
}

function Stat({
  label,
  value,
  emphasis,
  valueClass,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
  valueClass?: string;
}) {
  return (
    <div className="flex flex-col items-end gap-0">
      <span className="text-[10px] uppercase tracking-wider text-brand-muted">
        {label}
      </span>
      <span
        className={`font-mono tabular-nums ${emphasis ? "text-base font-bold text-brand-accent" : "text-sm font-semibold text-brand-text"} ${valueClass ?? ""}`}
      >
        {value}
      </span>
    </div>
  );
}

/**
 * Slim sticky totals footer — mirrors the replica's always-visible totals
 * summary (Subtotal / GST / Grand Total) with the internal margin at a glance.
 */
export function TotalsFooter({
  totals,
  depositPct,
}: {
  totals: QuoteTotals;
  depositPct: number | null;
}) {
  return (
    <div className="sticky bottom-0 z-20 -mx-4 sm:mx-0">
      <div className="border-t border-brand-border bg-brand-card/95 px-4 py-2.5 shadow-[0_-4px_16px_rgba(0,0,0,0.12)] backdrop-blur sm:rounded-t-xl sm:border-x">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
          {/* Internal margin at a glance (staff-only figure) */}
          <div className="flex items-center gap-2">
            <Lock size={11} className="text-brand-muted" />
            <div className="flex flex-col">
              <span className="text-[10px] uppercase tracking-wider text-brand-muted">
                Margin (internal)
              </span>
              <span
                data-testid="totals-footer-margin"
                className={`font-mono text-sm font-semibold tabular-nums ${totals.marginDollars >= 0 ? "text-emerald-500" : "text-brand-danger"}`}
              >
                {formatAud(totals.marginDollars)}
                {totals.marginPct != null
                  ? ` (${totals.marginPct.toFixed(1)}%)`
                  : ""}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            {totals.optionalTotalExGst > 0 && (
              <Stat
                label="Optional"
                value={`+ ${formatAud(totals.optionalTotalExGst)}`}
                valueClass="text-brand-muted"
              />
            )}
            {depositPct != null && depositPct > 0 && (
              <Stat
                label={`Deposit ${depositPct}%`}
                value={formatAud((totals.totalIncGst * depositPct) / 100)}
              />
            )}
            <Stat label="Subtotal ex GST" value={formatAud(totals.subtotalExGst)} />
            <Stat label="GST 10%" value={formatAud(totals.gst)} />
            <Stat
              label="Total inc GST"
              value={formatAud(totals.totalIncGst)}
              emphasis
            />
          </div>
        </div>
      </div>
    </div>
  );
}
