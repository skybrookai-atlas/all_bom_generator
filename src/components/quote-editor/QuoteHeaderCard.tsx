import { Input } from "../ui/Input";
import type { QuoteStatus } from "../../types/quote.types";

export interface QuoteHeaderFields {
  title: string;
  expiry_days: number;
  notes: string;
  contact: {
    name: string;
    email: string;
    phone: string;
    address: string;
  };
}

const STATUS_COLOURS: Record<QuoteStatus, string> = {
  draft: "text-brand-muted bg-brand-border/30",
  sent: "text-brand-primary bg-brand-primary/10",
  accepted: "text-emerald-400 bg-emerald-500/10",
  expired: "text-rose-400 bg-rose-500/10",
};

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-brand-muted">{label}</span>
      {children}
    </label>
  );
}

export function QuoteHeaderCard({
  fields,
  status,
  quoteNumber,
  onChange,
}: {
  fields: QuoteHeaderFields;
  status: QuoteStatus;
  quoteNumber: number | null;
  onChange: (fields: QuoteHeaderFields) => void;
}) {
  const setContact = (key: keyof QuoteHeaderFields["contact"], value: string) =>
    onChange({ ...fields, contact: { ...fields.contact, [key]: value } });

  return (
    <div className="bg-brand-card border border-brand-border rounded-xl p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-brand-text">Quote details</h2>
        <div className="flex items-center gap-2">
          {quoteNumber != null && (
            <span className="text-xs text-brand-muted">#{quoteNumber}</span>
          )}
          <span
            data-testid="editor-status-badge"
            className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOURS[status] ?? "text-brand-muted bg-brand-border/30"}`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Quote title">
          <Input
            value={fields.title}
            onChange={(e) => onChange({ ...fields, title: e.target.value })}
            placeholder="e.g. Smith residence — rear fence"
            data-testid="quote-title-input"
          />
        </Field>
        <Field label="Expiry (days)">
          <Input
            type="number"
            min={1}
            value={String(fields.expiry_days)}
            onChange={(e) =>
              onChange({
                ...fields,
                expiry_days: Math.max(1, Math.round(Number(e.target.value) || 0)),
              })
            }
            className="max-w-[8rem]"
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Client name">
          <Input
            value={fields.contact.name}
            onChange={(e) => setContact("name", e.target.value)}
            placeholder="Full name"
          />
        </Field>
        <Field label="Client email">
          <Input
            type="email"
            value={fields.contact.email}
            onChange={(e) => setContact("email", e.target.value)}
            placeholder="email@example.com"
          />
        </Field>
        <Field label="Client phone">
          <Input
            value={fields.contact.phone}
            onChange={(e) => setContact("phone", e.target.value)}
            placeholder="04xx xxx xxx"
          />
        </Field>
        <Field label="Site / delivery address">
          <Input
            value={fields.contact.address}
            onChange={(e) => setContact("address", e.target.value)}
            placeholder="Street address"
          />
        </Field>
      </div>

      <Field label="Notes">
        <textarea
          value={fields.notes}
          onChange={(e) => onChange({ ...fields, notes: e.target.value })}
          rows={2}
          placeholder="Internal or client-facing notes…"
          className="bg-white border border-brand-border dark:bg-brand-card dark:border-brand-border rounded-[var(--brand-radius-sm)] px-3 py-2 text-sm text-brand-text focus:outline-none focus:ring-1 focus:ring-brand-accent/50 focus:border-brand-accent resize-y"
        />
      </Field>
    </div>
  );
}
