import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { X, Loader2, Calculator, ArrowLeft, ExternalLink, AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useBomCalculator } from "../../hooks/useBomCalculator";
import { localFenceProducts } from "../../lib/localSeedData";
import { groupProductsByFamily, SLAT_VARIANT_LABELS } from "../../lib/fenceFamilies";
import {
  initialVariablesForSystem,
  normaliseVariablesForSystem,
  colourOptionsForSystem,
  heightOptionsForSystem,
  genericHeightOptionsForSystem,
  isGenericSystem,
  COLORBOND_HEIGHTS,
} from "../../lib/productOptionRules";
import {
  COLORBOND_COLOUR_NAMES,
  COLOUR_DISPLAY_NAMES,
  displayName,
} from "../../lib/displayNames";
import { formatAud } from "./currency";
import type { CanonicalPayload } from "../../types/canonical.types";
import type { QuoteLineItemDraft } from "../../hooks/useQuoteLineItems";

// ─── engine result helpers (server + local fallback both handled) ───────────

interface EngineLine {
  sku?: string;
  name?: string;
  description?: string;
  quantity?: number;
  unit?: string;
  unitPrice?: number;
  lineTotal?: number;
}

interface EngineResult {
  lines: EngineLine[];
  subtotalExGst: number;
  warnings: string[];
  errors: string[];
  raw: Record<string, unknown>;
}

function messageOf(entry: unknown): string {
  if (typeof entry === "string") return entry;
  if (entry && typeof entry === "object") {
    const rec = entry as Record<string, unknown>;
    if (typeof rec.message === "string") return rec.message;
  }
  return String(entry ?? "");
}

function parseEngineResult(data: Record<string, unknown>): EngineResult {
  const lines = Array.isArray(data.lines) ? (data.lines as EngineLine[]) : [];
  let subtotal = 0;
  const totals = data.totals;
  if (totals && typeof totals === "object") {
    const t = totals as Record<string, unknown>;
    if (typeof t.subtotal === "number") subtotal = t.subtotal;
  } else if (typeof totals === "number") {
    subtotal = totals;
  }
  if (!subtotal) {
    subtotal = lines.reduce((sum, line) => sum + (line.lineTotal ?? 0), 0);
  }
  return {
    lines,
    subtotalExGst: Math.round(subtotal * 100) / 100,
    warnings: Array.isArray(data.warnings) ? data.warnings.map(messageOf) : [],
    errors: Array.isArray(data.errors) ? data.errors.map(messageOf) : [],
    raw: data,
  };
}

// ─── component ───────────────────────────────────────────────────────────────

export function FenceBuilderModal({
  orgId,
  onAdd,
  onClose,
}: {
  orgId: string | null;
  onAdd: (overrides: Partial<QuoteLineItemDraft>) => void;
  onClose: () => void;
}) {
  const [productCode, setProductCode] = useState<string | null>(null);
  const [productName, setProductName] = useState<string>("");
  const [lengthM, setLengthM] = useState<string>("");
  const [heightMm, setHeightMm] = useState<number>(1800);
  const [colour, setColour] = useState<string>("");
  const [labour, setLabour] = useState<string>("");
  const [labourDirty, setLabourDirty] = useState(false);
  const [markupPct, setMarkupPct] = useState<string>("30");
  const [markupDirty, setMarkupDirty] = useState(false);
  const [result, setResult] = useState<EngineResult | null>(null);
  const [calcError, setCalcError] = useState<string | null>(null);

  const bomMutation = useBomCalculator();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  // Labour $/m + default margin come from the same table the website widget
  // uses (Admin → Settings → Instant quote rates).
  const ratesQuery = useQuery({
    queryKey: ["instant-quote-rates", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("instant_quote_settings")
        .select("system_type, labor_per_m, margin_pct")
        .eq("org_id", orgId!);
      if (error) return [];
      return (data ?? []) as Array<{
        system_type: string;
        labor_per_m: number | null;
        margin_pct: number | null;
      }>;
    },
  });

  const rates = useMemo(() => {
    const map = new Map<string, { labor_per_m: number | null; margin_pct: number | null }>();
    for (const row of ratesQuery.data ?? []) {
      map.set(row.system_type, {
        labor_per_m: row.labor_per_m,
        margin_pct: row.margin_pct,
      });
    }
    return map;
  }, [ratesQuery.data]);

  const lengthNum = Number(lengthM);
  const lengthValid = Number.isFinite(lengthNum) && lengthNum > 0;

  // Prefill labour ($/m × length) and margin whenever the inputs they derive
  // from change — unless the user has typed their own figure.
  useEffect(() => {
    if (!productCode) return;
    const rate = rates.get(productCode);
    if (!labourDirty) {
      const perM = rate?.labor_per_m;
      setLabour(
        perM != null && lengthValid
          ? String(Math.round(perM * lengthNum * 100) / 100)
          : "",
      );
    }
    if (!markupDirty && rate?.margin_pct != null) {
      setMarkupPct(String(rate.margin_pct));
    }
  }, [productCode, lengthNum, lengthValid, rates, labourDirty, markupDirty]);

  // Any config change invalidates a previously calculated BOM.
  useEffect(() => {
    setResult(null);
    setCalcError(null);
  }, [productCode, lengthM, heightMm, colour]);

  const pickSystem = (code: string, name: string) => {
    setProductCode(code);
    setProductName(name);
    const vars = initialVariablesForSystem(code);
    const defaultHeight = Number(vars.target_height_mm ?? 1800);
    const heights = heightsFor(code);
    setHeightMm(
      heights.length === 0 || heights.includes(defaultHeight)
        ? defaultHeight
        : heights.reduce((best, h) =>
            Math.abs(h - defaultHeight) < Math.abs(best - defaultHeight) ? h : best,
          ),
    );
    setColour(String(vars.colour_code ?? ""));
  };

  function heightsFor(code: string): number[] {
    if (code === "COLORBOND") return COLORBOND_HEIGHTS;
    if (isGenericSystem(code)) return genericHeightOptionsForSystem(code);
    return heightOptionsForSystem(code, initialVariablesForSystem(code));
  }

  const heightOptions = productCode ? heightsFor(productCode) : [];
  const colourOptions = useMemo(() => {
    if (!productCode || isGenericSystem(productCode)) return [];
    return colourOptionsForSystem(initialVariablesForSystem(productCode), productCode);
  }, [productCode]);

  const colourLabel = (code: string) =>
    productCode === "COLORBOND"
      ? displayName(COLORBOND_COLOUR_NAMES, code, code)
      : displayName(COLOUR_DISPLAY_NAMES, code, code);

  const buildPayload = (): CanonicalPayload => {
    const code = productCode!;
    const base = initialVariablesForSystem(code);
    const variables = normaliseVariablesForSystem(code, {
      ...base,
      ...(colour
        ? { colour_code: colour, post_colour_code: colour }
        : {}),
      target_height_mm: heightMm,
    });
    return {
      productCode: code,
      schemaVersion: "v1",
      variables,
      runs: [
        {
          runId: crypto.randomUUID(),
          productCode: code,
          variables,
          leftBoundary: { type: "product_post" },
          rightBoundary: { type: "product_post" },
          segments: [
            {
              segmentId: crypto.randomUUID(),
              sortOrder: 1,
              segmentKind: "panel",
              segmentWidthMm: Math.round(lengthNum * 1000),
              targetHeightMm: heightMm,
              variables: code === "BAYG" ? { panel_quantity: 1 } : undefined,
            },
          ],
          corners: [],
        },
      ],
    };
  };

  const handleCalculate = async () => {
    if (!productCode || !lengthValid || bomMutation.isPending) return;
    setCalcError(null);
    try {
      const data = (await bomMutation.mutateAsync({
        payload: buildPayload(),
      })) as Record<string, unknown>;
      const parsed = parseEngineResult(data);
      if (parsed.errors.length > 0) {
        setCalcError(parsed.errors.join(" · "));
        setResult(null);
      } else {
        setResult(parsed);
      }
    } catch (err) {
      console.error("[FenceBuilderModal] calculate failed", err);
      setCalcError("Couldn't calculate materials — check the fence details and try again.");
    }
  };

  const labourNum = Number(labour) || 0;
  const markupNum = Number(markupPct) || 0;
  const materialCost = result?.subtotalExGst ?? 0;
  const sellExGst =
    Math.round((materialCost + labourNum) * (1 + markupNum / 100) * 100) / 100;

  const handleAdd = () => {
    if (!result || !productCode) return;
    const heightLabel = `${heightMm}mm high`;
    const colourText = colour ? `, ${colourLabel(colour)}` : "";
    onAdd({
      kind: "calculated",
      title: `${productName} — ${lengthNum}m × ${heightLabel}`,
      description: `Supply and install ${lengthNum}m of ${productName.toLowerCase()}, ${heightLabel}${colourText}. Includes all posts, panels, fixings and concrete as required.`,
      quantity: 1,
      unit: "job",
      unit_price: sellExGst,
      material_cost: materialCost,
      labor_cost: labourNum || null,
      markup_pct: markupNum || null,
      bom_snapshot: {
        items: result.lines,
        total: materialCost,
      },
      metadata: {
        fence: {
          product_code: productCode,
          length_m: lengthNum,
          height_mm: heightMm,
          colour_code: colour || null,
        },
      },
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-[8vh]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-brand-border bg-brand-card shadow-2xl">
        {/* header */}
        <div className="flex items-center justify-between border-b border-brand-border px-4 py-3">
          <div className="flex items-center gap-2">
            {productCode && (
              <button
                type="button"
                onClick={() => setProductCode(null)}
                title="Choose a different fence type"
                className="rounded-md p-1 text-brand-muted transition-colors hover:text-brand-text"
              >
                <ArrowLeft size={16} />
              </button>
            )}
            <Calculator size={16} className="text-brand-accent" />
            <h2 className="text-sm font-bold text-brand-text">
              {productCode ? productName : "Add a fence — choose the type"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-brand-muted transition-colors hover:text-brand-text"
          >
            <X size={16} />
          </button>
        </div>

        {/* ── step 1: fence type picker (family grouped, like the calculator) ── */}
        {!productCode ? (
          <div className="space-y-2 p-4" data-testid="fence-builder-picker">
            {groupProductsByFamily(localFenceProducts).map((family) =>
              family.products.length > 1 ? (
                <div
                  key={family.key}
                  className="rounded-xl border border-brand-border bg-brand-bg/40 p-3"
                >
                  <p className="mb-2 text-sm font-bold text-brand-text">{family.label}</p>
                  <div className="flex flex-wrap gap-2">
                    {family.products.map((p) => (
                      <button
                        key={p.system_type}
                        type="button"
                        onClick={() => pickSystem(p.system_type, `${family.label} (${SLAT_VARIANT_LABELS[p.system_type] ?? p.name})`)}
                        data-testid={`fence-builder-system-${p.system_type}`}
                        className="rounded-lg border border-brand-border bg-brand-card px-3 py-2 text-sm font-medium text-brand-text transition-colors hover:border-brand-accent hover:text-brand-accent"
                      >
                        {SLAT_VARIANT_LABELS[p.system_type] ?? p.name}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                family.products.map((p) => (
                  <button
                    key={p.system_type}
                    type="button"
                    onClick={() => pickSystem(p.system_type, p.name)}
                    data-testid={`fence-builder-system-${p.system_type}`}
                    className="flex w-full items-center justify-between rounded-xl border border-brand-border bg-brand-bg/40 px-4 py-3 text-left transition-colors hover:border-brand-accent"
                  >
                    <span className="text-sm font-bold text-brand-text">{p.name}</span>
                    {p.description ? (
                      <span className="ml-3 truncate text-xs text-brand-muted">
                        {p.description}
                      </span>
                    ) : null}
                  </button>
                ))
              ),
            )}
            <p className="pt-1 text-xs text-brand-muted">
              Need gates, corners or multiple runs?{" "}
              <Link
                to="/fence-calculator"
                className="inline-flex items-center gap-1 font-medium text-brand-accent hover:underline"
              >
                Open the full calculator <ExternalLink size={11} />
              </Link>
            </p>
          </div>
        ) : (
          /* ── step 2: dimensions + options + costing ── */
          <div className="space-y-4 p-4" data-testid="fence-builder-config">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-brand-muted">Length (m)</span>
                <input
                  type="number"
                  min={0.5}
                  step="0.1"
                  value={lengthM}
                  onChange={(e) => setLengthM(e.target.value)}
                  placeholder="e.g. 25"
                  autoFocus
                  data-testid="fence-builder-length"
                  className="rounded-lg border border-brand-border bg-brand-bg/60 px-3 py-2 text-sm text-brand-text outline-none focus:border-brand-accent"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-brand-muted">Height</span>
                {heightOptions.length > 0 ? (
                  <select
                    value={heightMm}
                    onChange={(e) => setHeightMm(Number(e.target.value))}
                    data-testid="fence-builder-height"
                    className="rounded-lg border border-brand-border bg-brand-bg/60 px-3 py-2 text-sm text-brand-text outline-none focus:border-brand-accent"
                  >
                    {heightOptions.map((h) => (
                      <option key={h} value={h}>
                        {h}mm
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="number"
                    min={300}
                    max={2400}
                    step={10}
                    value={heightMm}
                    onChange={(e) => setHeightMm(Number(e.target.value) || 1800)}
                    data-testid="fence-builder-height"
                    className="rounded-lg border border-brand-border bg-brand-bg/60 px-3 py-2 text-sm text-brand-text outline-none focus:border-brand-accent"
                  />
                )}
              </label>
              {colourOptions.length > 0 && (
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-brand-muted">Colour</span>
                  <select
                    value={colour}
                    onChange={(e) => setColour(e.target.value)}
                    data-testid="fence-builder-colour"
                    className="rounded-lg border border-brand-border bg-brand-bg/60 px-3 py-2 text-sm text-brand-text outline-none focus:border-brand-accent"
                  >
                    {colourOptions.map((code) => (
                      <option key={code} value={code}>
                        {colourLabel(code)}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void handleCalculate()}
                disabled={!lengthValid || bomMutation.isPending}
                data-testid="fence-builder-calculate"
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-accent-hover disabled:opacity-50"
              >
                {bomMutation.isPending ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Calculator size={14} />
                )}
                Calculate materials
              </button>
              <Link
                to="/fence-calculator"
                className="inline-flex items-center gap-1 text-xs font-medium text-brand-accent hover:underline"
              >
                Gates or corners? Full calculator <ExternalLink size={11} />
              </Link>
            </div>

            {calcError && (
              <p className="flex items-start gap-2 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-400">
                <AlertTriangle size={14} className="mt-px shrink-0" /> {calcError}
              </p>
            )}

            {result && (
              <div className="space-y-3 rounded-xl border border-brand-border bg-brand-bg/40 p-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-brand-muted">
                    Materials ({result.lines.length} lines)
                  </span>
                  <span
                    className="font-mono text-sm font-bold tabular-nums text-brand-text"
                    data-testid="fence-builder-material-total"
                  >
                    {formatAud(materialCost)} ex GST
                  </span>
                </div>

                <ul className="max-h-36 space-y-0.5 overflow-y-auto text-xs text-brand-muted">
                  {result.lines.map((line, i) => (
                    <li key={`${line.sku ?? i}`} className="flex justify-between gap-3">
                      <span className="truncate">
                        {line.quantity ?? 1}× {line.name || line.description || line.sku}
                      </span>
                      <span className="shrink-0 font-mono tabular-nums">
                        {formatAud(line.lineTotal ?? 0)}
                      </span>
                    </li>
                  ))}
                </ul>

                {result.warnings.length > 0 && (
                  <ul className="space-y-1 text-xs text-amber-500">
                    {result.warnings.map((w, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <AlertTriangle size={12} className="mt-px shrink-0" /> {w}
                      </li>
                    ))}
                  </ul>
                )}

                <div className="grid grid-cols-2 gap-3 border-t border-dashed border-brand-border pt-3 sm:grid-cols-4">
                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] text-brand-muted">Labour (total $)</span>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={labour}
                      onChange={(e) => {
                        setLabour(e.target.value);
                        setLabourDirty(true);
                      }}
                      placeholder="0"
                      data-testid="fence-builder-labour"
                      className="rounded-lg border border-brand-border bg-brand-card px-2 py-1.5 text-right text-sm text-brand-text outline-none focus:border-brand-accent"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] text-brand-muted">Markup %</span>
                    <input
                      type="number"
                      step="any"
                      value={markupPct}
                      onChange={(e) => {
                        setMarkupPct(e.target.value);
                        setMarkupDirty(true);
                      }}
                      data-testid="fence-builder-markup"
                      className="rounded-lg border border-brand-border bg-brand-card px-2 py-1.5 text-right text-sm text-brand-text outline-none focus:border-brand-accent"
                    />
                  </label>
                  <div className="col-span-2 flex flex-col items-end justify-end gap-0.5">
                    <span className="text-[10px] uppercase tracking-wider text-brand-muted">
                      Sell price
                    </span>
                    <span
                      className="font-mono text-lg font-bold tabular-nums text-brand-accent"
                      data-testid="fence-builder-sell-price"
                    >
                      {formatAud(sellExGst)} <span className="text-xs font-medium">ex GST</span>
                    </span>
                    <span className="font-mono text-xs tabular-nums text-brand-muted">
                      {formatAud(Math.round(sellExGst * 1.1 * 100) / 100)} inc GST
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleAdd}
                  data-testid="fence-builder-add"
                  className="w-full rounded-lg bg-brand-accent px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-accent-hover"
                >
                  Add to quote — {formatAud(sellExGst)} ex GST
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
