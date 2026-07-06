import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import { useProfile } from "../../context/ProfileContext";
import { toast } from "sonner";
import { Copy, ExternalLink, Save } from "lucide-react";

/**
 * Admin panel for the embeddable instant-quote widget:
 *  - per-system rate rows from instant_quote_settings (authenticated CRUD via RLS)
 *  - copyable <iframe> embed snippet built from quote_settings.embed_token
 *
 * Rates here are commercially sensitive admin data — they never reach the
 * public widget (it only ever sees a price range from the edge function).
 */

interface InstantQuoteSettingsRow {
  id: string;
  system_type: string;
  enabled: boolean;
  labor_per_m: number | null;
  margin_pct: number | null;
  range_spread_pct: number | null;
  min_job: number | null;
}

/** Editable draft — numbers held as strings so inputs can be emptied. */
interface DraftRow {
  id: string;
  system_type: string;
  enabled: boolean;
  labor_per_m: string;
  margin_pct: string;
  range_spread_pct: string;
  min_job: string;
}

function toDraft(row: InstantQuoteSettingsRow): DraftRow {
  return {
    id: row.id,
    system_type: row.system_type,
    enabled: !!row.enabled,
    labor_per_m: row.labor_per_m == null ? "" : String(row.labor_per_m),
    margin_pct: row.margin_pct == null ? "" : String(row.margin_pct),
    range_spread_pct:
      row.range_spread_pct == null ? "" : String(row.range_spread_pct),
    min_job: row.min_job == null ? "" : String(row.min_job),
  };
}

function numOrNull(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

const SYSTEM_LABELS: Record<string, string> = {
  TP_PALING: "Treated Pine Paling",
  COLORBOND: "Colorbond Steel",
};

const cellInputCls =
  "w-full bg-brand-bg border border-brand-border rounded-lg px-2.5 py-1.5 text-sm text-brand-text placeholder:text-brand-muted/50 focus:outline-none focus:border-brand-accent transition-colors tabular-nums";

export function InstantQuoteSettings() {
  const { orgId } = useProfile();
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState<DraftRow[]>([]);

  const rowsQuery = useQuery({
    queryKey: ["instant-quote-settings", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("instant_quote_settings")
        .select(
          "id, system_type, enabled, labor_per_m, margin_pct, range_spread_pct, min_job",
        )
        .eq("org_id", orgId)
        .order("system_type");
      if (error) throw error;
      return (data ?? []) as InstantQuoteSettingsRow[];
    },
    enabled: !!orgId,
  });

  useEffect(() => {
    if (rowsQuery.data) setDrafts(rowsQuery.data.map(toDraft));
  }, [rowsQuery.data]);

  const tokenQuery = useQuery({
    queryKey: ["instant-quote-embed-token", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quote_settings")
        .select("embed_token")
        .eq("org_id", orgId)
        .maybeSingle();
      if (error) throw error;
      return (data?.embed_token as string | null) ?? null;
    },
    enabled: !!orgId,
  });

  const saveMutation = useMutation({
    mutationFn: async (rows: DraftRow[]) => {
      for (const row of rows) {
        const { error } = await supabase
          .from("instant_quote_settings")
          .update({
            enabled: row.enabled,
            labor_per_m: numOrNull(row.labor_per_m),
            margin_pct: numOrNull(row.margin_pct),
            range_spread_pct: numOrNull(row.range_spread_pct),
            min_job: numOrNull(row.min_job),
          })
          .eq("id", row.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["instant-quote-settings", orgId],
      });
      toast.success("Instant quote rates saved.");
    },
    onError: (err) => {
      toast.error(
        err instanceof Error ? err.message : "Failed to save instant quote rates.",
      );
    },
  });

  function updateDraft(id: string, updates: Partial<DraftRow>) {
    setDrafts((prev) =>
      prev.map((row) => (row.id === id ? { ...row, ...updates } : row)),
    );
  }

  const embedToken = tokenQuery.data;
  const widgetUrl = embedToken
    ? `${window.location.origin}/embed/instant-quote?token=${embedToken}`
    : null;
  const embedSnippet = widgetUrl
    ? `<iframe src="${widgetUrl}" style="width:100%;min-height:820px;border:0;" title="Instant fence quote"></iframe>`
    : null;

  async function copySnippet() {
    if (!embedSnippet) return;
    try {
      await navigator.clipboard.writeText(embedSnippet);
      toast.success("Embed snippet copied to clipboard.");
    } catch {
      toast.error("Couldn't copy — select the snippet text and copy manually.");
    }
  }

  return (
    <section className="max-w-2xl space-y-6">
      <div className="bg-brand-card border border-brand-border rounded-xl p-6 space-y-4 shadow-sm">
        <div>
          <h2 className="text-sm font-semibold text-brand-text">
            Website Instant Quote — Rates
          </h2>
          <p className="text-xs text-brand-muted mt-0.5">
            Per-system rates used by the public widget. A system only appears
            on your website once it&apos;s enabled and has a labour rate.
            Customers only ever see a price range — never these numbers.
          </p>
        </div>

        {rowsQuery.isLoading ? (
          <div className="text-sm text-brand-muted animate-pulse">
            Loading rates…
          </div>
        ) : rowsQuery.isError ? (
          <div className="text-sm text-brand-danger">
            Failed to load instant quote settings.
          </div>
        ) : drafts.length === 0 ? (
          <div className="text-sm text-brand-muted">
            No instant quote systems configured for this organisation yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold text-brand-muted uppercase tracking-wider">
                  <th className="pb-2 pr-3">System</th>
                  <th className="pb-2 pr-3">Enabled</th>
                  <th className="pb-2 pr-3">Labour $/m</th>
                  <th className="pb-2 pr-3">Margin %</th>
                  <th className="pb-2 pr-3">Range ±%</th>
                  <th className="pb-2">Min job $</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border/60">
                {drafts.map((row) => (
                  <tr key={row.id} data-testid={`iq-settings-row-${row.system_type}`}>
                    <td className="py-2.5 pr-3 font-medium text-brand-text whitespace-nowrap">
                      {SYSTEM_LABELS[row.system_type] ?? row.system_type}
                    </td>
                    <td className="py-2.5 pr-3">
                      <input
                        type="checkbox"
                        checked={row.enabled}
                        onChange={(e) =>
                          updateDraft(row.id, { enabled: e.target.checked })
                        }
                        className="w-4 h-4 accent-brand-accent border-brand-border rounded bg-brand-bg cursor-pointer"
                        data-testid={`iq-enabled-${row.system_type}`}
                      />
                    </td>
                    <td className="py-2.5 pr-3">
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={row.labor_per_m}
                        onChange={(e) =>
                          updateDraft(row.id, { labor_per_m: e.target.value })
                        }
                        placeholder="—"
                        className={`${cellInputCls} w-24`}
                        data-testid={`iq-labor-${row.system_type}`}
                      />
                    </td>
                    <td className="py-2.5 pr-3">
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={row.margin_pct}
                        onChange={(e) =>
                          updateDraft(row.id, { margin_pct: e.target.value })
                        }
                        placeholder="30"
                        className={`${cellInputCls} w-20`}
                      />
                    </td>
                    <td className="py-2.5 pr-3">
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={row.range_spread_pct}
                        onChange={(e) =>
                          updateDraft(row.id, {
                            range_spread_pct: e.target.value,
                          })
                        }
                        placeholder="8"
                        className={`${cellInputCls} w-20`}
                      />
                    </td>
                    <td className="py-2.5">
                      <input
                        type="number"
                        min="0"
                        step="50"
                        value={row.min_job}
                        onChange={(e) =>
                          updateDraft(row.id, { min_job: e.target.value })
                        }
                        placeholder="0"
                        className={`${cellInputCls} w-24`}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="border-t border-brand-border/60 pt-4 flex justify-end">
          <button
            type="button"
            onClick={() => saveMutation.mutate(drafts)}
            disabled={saveMutation.isPending || drafts.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 bg-brand-accent hover:bg-brand-accent-hover text-white text-sm font-semibold rounded-lg transition-colors shadow-sm disabled:opacity-50"
            data-testid="iq-settings-save-btn"
          >
            <Save size={16} />
            {saveMutation.isPending ? "Saving…" : "Save Rates"}
          </button>
        </div>
      </div>

      <div className="bg-brand-card border border-brand-border rounded-xl p-6 space-y-3 shadow-sm">
        <div>
          <h2 className="text-sm font-semibold text-brand-text">
            Embed on your website
          </h2>
          <p className="text-xs text-brand-muted mt-0.5">
            Paste this snippet into any page of your marketing website to show
            the instant quote calculator.
          </p>
        </div>

        {tokenQuery.isLoading ? (
          <div className="text-sm text-brand-muted animate-pulse">
            Loading embed token…
          </div>
        ) : embedSnippet ? (
          <>
            <pre className="bg-brand-bg border border-brand-border rounded-lg p-3 text-xs text-brand-text whitespace-pre-wrap break-all font-mono">
              {embedSnippet}
            </pre>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={copySnippet}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-accent hover:bg-brand-accent-hover text-white text-xs font-semibold rounded-lg transition-colors"
                data-testid="iq-copy-embed-btn"
              >
                <Copy size={13} />
                Copy snippet
              </button>
              <a
                href={widgetUrl ?? "#"}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-brand-border text-brand-muted hover:text-brand-text text-xs font-semibold rounded-lg transition-colors"
              >
                <ExternalLink size={13} />
                Preview widget
              </a>
            </div>
          </>
        ) : (
          <div className="text-sm text-brand-muted">
            No embed token found — save your quote settings above first to
            create one.
          </div>
        )}
      </div>
    </section>
  );
}
