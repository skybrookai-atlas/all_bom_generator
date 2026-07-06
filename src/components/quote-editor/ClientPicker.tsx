import { useEffect, useRef, useState } from "react";
import { Loader2, Plus, Search, UserRound, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "../../lib/supabase";
import { Input } from "../ui/Input";

/** Row from the clients table (migration 040). */
export interface ClientRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  company: string | null;
}

export interface ContactSnapshot {
  name: string;
  email: string;
  phone: string;
  address: string;
}

/**
 * Quotient-replica-style "Client Details" block:
 * - typeahead over the org's clients table ("Type to search…" like the
 *   replica's library autocomplete pattern, applied to clients)
 * - picking a client links quotes.client_id AND fills the contact snapshot
 * - "+ New client" opens an inline mini-form that inserts into clients
 * - editing the snapshot fields below only changes the quote's contact JSONB,
 *   never the client record.
 */
export function ClientPicker({
  orgId,
  clientId,
  contact,
  onPickClient,
  onClearClient,
  onContactChange,
}: {
  orgId: string | null;
  clientId: string | null;
  contact: ContactSnapshot;
  onPickClient: (client: ClientRow) => void;
  onClearClient: () => void;
  onContactChange: (contact: ContactSnapshot) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ClientRow[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [linkedClient, setLinkedClient] = useState<ClientRow | null>(null);

  // New-client inline mini-form
  const [showNewForm, setShowNewForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ name: "", email: "", phone: "", address: "" });

  const containerRef = useRef<HTMLDivElement>(null);

  // Resolve the linked client's name for the chip.
  useEffect(() => {
    if (!clientId) {
      setLinkedClient(null);
      return;
    }
    if (linkedClient?.id === clientId) return;
    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from("clients")
        .select("id, name, email, phone, address, company")
        .eq("id", clientId)
        .maybeSingle();
      if (!cancelled && data) setLinkedClient(data as ClientRow);
    })();
    return () => {
      cancelled = true;
    };
  }, [clientId, linkedClient?.id]);

  // Debounced typeahead over clients (name/email/company).
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setSearching(true);
    const t = setTimeout(async () => {
      let q = supabase
        .from("clients")
        .select("id, name, email, phone, address, company")
        .order("name", { ascending: true })
        .limit(8);
      const trimmed = query.trim();
      if (trimmed.length > 0) {
        q = q.or(
          `name.ilike.%${trimmed}%,email.ilike.%${trimmed}%,company.ilike.%${trimmed}%`,
        );
      }
      const { data } = await q;
      if (!cancelled) {
        setResults((data as ClientRow[]) ?? []);
        setSearching(false);
      }
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, open]);

  // Close the dropdown on outside click (replica closes autocomplete the same way).
  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, []);

  const pick = (client: ClientRow) => {
    setLinkedClient(client);
    setOpen(false);
    setQuery("");
    onPickClient(client);
  };

  const createClient = async () => {
    const name = draft.name.trim();
    if (!name || creating) return;
    if (!orgId) {
      toast.error("Missing organisation — try reloading");
      return;
    }
    setCreating(true);
    try {
      const { data, error } = await supabase
        .from("clients")
        .insert({
          org_id: orgId,
          name,
          email: draft.email.trim() || null,
          phone: draft.phone.trim() || null,
          address: draft.address.trim() || null,
        })
        .select("id, name, email, phone, address, company")
        .single();
      if (error) throw error;
      toast.success(`Client "${name}" added`);
      setShowNewForm(false);
      setDraft({ name: "", email: "", phone: "", address: "" });
      pick(data as ClientRow);
    } catch (err) {
      console.error("[ClientPicker] create client failed", err);
      toast.error("Failed to add client");
    } finally {
      setCreating(false);
    }
  };

  const setSnapshot = (key: keyof ContactSnapshot, value: string) =>
    onContactChange({ ...contact, [key]: value });

  return (
    <section className="bg-brand-card border border-brand-border rounded-xl p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-brand-text">
          <UserRound size={15} className="text-brand-accent" />
          Client
        </h2>
        <button
          type="button"
          onClick={() => setShowNewForm((v) => !v)}
          data-testid="new-client-btn"
          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-brand-accent border border-brand-accent/40 bg-brand-accent/5 rounded-lg hover:bg-brand-accent/15 transition-colors"
        >
          <Plus size={12} /> New client
        </button>
      </div>

      {/* Linked client chip OR search box */}
      {clientId && linkedClient ? (
        <div
          data-testid="linked-client-chip"
          className="flex items-center justify-between gap-3 rounded-lg border border-brand-accent/40 bg-brand-accent/5 px-3 py-2"
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-brand-text">
              {linkedClient.name}
              {linkedClient.company ? (
                <span className="ml-2 font-normal text-brand-muted">
                  {linkedClient.company}
                </span>
              ) : null}
            </p>
            <p className="truncate text-xs text-brand-muted">
              {[linkedClient.email, linkedClient.phone].filter(Boolean).join(" · ") ||
                "No contact details on record"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setLinkedClient(null);
              onClearClient();
            }}
            title="Unlink client"
            className="shrink-0 p-1 text-brand-muted hover:text-brand-danger transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <div ref={containerRef} className="relative">
          <Search
            size={14}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-brand-muted"
          />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder="Type to search clients…"
            data-testid="client-search-input"
            className="w-full rounded-lg border border-brand-border bg-brand-bg py-2 pl-8 pr-3 text-sm text-brand-text outline-none focus:border-brand-accent"
          />
          {open && (
            <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-lg border border-brand-border bg-brand-card shadow-xl">
              {searching && (
                <p className="flex items-center gap-2 px-3 py-2 text-xs text-brand-muted">
                  <Loader2 size={12} className="animate-spin" /> Searching…
                </p>
              )}
              {!searching && results.length === 0 && (
                <p className="px-3 py-2 text-xs text-brand-muted">
                  No clients found — use “New client” to add one.
                </p>
              )}
              {!searching &&
                results.map((client) => (
                  <button
                    key={client.id}
                    type="button"
                    onClick={() => pick(client)}
                    data-testid="client-result-row"
                    className="block w-full px-3 py-2 text-left transition-colors hover:bg-brand-bg/60"
                  >
                    <span className="block truncate text-sm font-medium text-brand-text">
                      {client.name}
                      {client.company ? (
                        <span className="ml-2 text-xs font-normal text-brand-muted">
                          {client.company}
                        </span>
                      ) : null}
                    </span>
                    <span className="block truncate text-xs text-brand-muted">
                      {[client.email, client.phone].filter(Boolean).join(" · ")}
                    </span>
                  </button>
                ))}
            </div>
          )}
        </div>
      )}

      {/* Inline "+ New client" mini-form */}
      {showNewForm && (
        <div className="space-y-2 rounded-lg border border-dashed border-brand-border bg-brand-bg/40 p-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Input
              autoFocus
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="Full name (required)"
              data-testid="new-client-name-input"
            />
            <Input
              type="email"
              value={draft.email}
              onChange={(e) => setDraft({ ...draft, email: e.target.value })}
              placeholder="Email address"
              data-testid="new-client-email-input"
            />
            <Input
              value={draft.phone}
              onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
              placeholder="Phone number"
            />
            <Input
              value={draft.address}
              onChange={(e) => setDraft({ ...draft, address: e.target.value })}
              placeholder="Property / billing address"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void createClient()}
              disabled={!draft.name.trim() || creating}
              data-testid="save-new-client-btn"
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-accent px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-accent-hover disabled:opacity-50"
            >
              {creating ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
              Save client
            </button>
            <button
              type="button"
              onClick={() => setShowNewForm(false)}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-brand-muted transition-colors hover:text-brand-text"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Contact snapshot — what the portal renders. Editing here never
          touches the client record (replica keeps quote details point-in-time). */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-brand-muted">Full name</span>
          <Input
            value={contact.name}
            onChange={(e) => setSnapshot("name", e.target.value)}
            placeholder="Full name"
            data-testid="contact-name-input"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-brand-muted">Email address</span>
          <Input
            type="email"
            value={contact.email}
            onChange={(e) => setSnapshot("email", e.target.value)}
            placeholder="email@example.com"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-brand-muted">Phone number</span>
          <Input
            value={contact.phone}
            onChange={(e) => setSnapshot("phone", e.target.value)}
            placeholder="04xx xxx xxx"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-brand-muted">
            Property / delivery address
          </span>
          <Input
            value={contact.address}
            onChange={(e) => setSnapshot("address", e.target.value)}
            placeholder="Street address"
          />
        </label>
      </div>
      {clientId && (
        <p className="text-[11px] text-brand-muted">
          These details are a snapshot for this quote — editing them won’t change the
          saved client.
        </p>
      )}
    </section>
  );
}
