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

function Row({
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
    <div className="flex justify-between items-baseline text-sm">
      <span className={emphasis ? "font-semibold text-brand-text" : "text-brand-muted"}>
        {label}
      </span>
      <span
        className={`font-mono tabular-nums ${emphasis ? "text-base font-bold text-brand-accent" : "text-brand-text"} ${valueClass ?? ""}`}
      >
        {value}
      </span>
    </div>
  );
}

export function TotalsPanel({
  totals,
  depositPct,
}: {
  totals: QuoteTotals;
  depositPct: number | null;
}) {
  return (
    <div className="bg-brand-card border border-brand-border rounded-xl p-5 space-y-2 lg:sticky lg:top-4">
      <h3 className="text-sm font-semibold text-brand-text mb-3">Totals</h3>

      <Row label="Subtotal (ex GST)" value={formatAud(totals.subtotalExGst)} />
      {totals.optionalTotalExGst > 0 && (
        <Row
          label="Optional items (ex GST)"
          value={`+ ${formatAud(totals.optionalTotalExGst)}`}
          valueClass="text-brand-muted"
        />
      )}
      <Row label="GST (10%)" value={formatAud(totals.gst)} />
      <div className="border-t border-brand-border/60 pt-2">
        <Row
          label="Total (inc GST)"
          value={formatAud(totals.totalIncGst)}
          emphasis
        />
      </div>
      {depositPct != null && depositPct > 0 && (
        <Row
          label={`Deposit (${depositPct}%)`}
          value={formatAud((totals.totalIncGst * depositPct) / 100)}
        />
      )}

      <div className="mt-4 pt-3 border-t border-dashed border-brand-border space-y-2 rounded-b-xl">
        <div className="flex items-center gap-1.5">
          <Lock size={11} className="text-brand-muted" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-brand-muted">
            Internal
          </span>
        </div>
        <Row label="Total material" value={formatAud(totals.totalMaterial)} />
        <Row label="Total labour" value={formatAud(totals.totalLabor)} />
        <Row
          label="Margin"
          value={`${formatAud(totals.marginDollars)}${totals.marginPct != null ? ` (${totals.marginPct.toFixed(1)}%)` : ""}`}
          valueClass={
            totals.marginDollars >= 0 ? "text-emerald-500" : "text-brand-danger"
          }
        />
      </div>
    </div>
  );
}
