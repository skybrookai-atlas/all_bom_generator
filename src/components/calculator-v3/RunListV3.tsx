import { useCalculator } from "../../context/CalculatorContext";
import type { CanonicalPayload, CanonicalRun } from "../../types/canonical.types";
import { initialVariablesForSystem } from "../../lib/productOptionRules";
import { localFenceProducts } from "../../lib/localSeedData";
import { groupProductsByFamily, SLAT_VARIANT_LABELS } from "../../lib/fenceFamilies";
import type { ParseResult } from "../../lib/describeFenceParser";
import { DescribeFenceBox } from "../calculator/DescribeFenceBox";
import { RunCard } from "./RunCard";

const SYSTEM_BUTTON_LABELS: Record<string, string> = {
  QSHS: "Quick Screen Horizontal Slats",
  VS: "Vertical Slats",
  XPL: "Xpress Plus",
  BAYG: "Build As You Go",
  COLORBOND: "ColorBond Steel Fence",
};

export function RunListV3({
  autoOpenFirstRunId,
  onAutoOpenConsumed,
  onDescribeApply,
  initialDescription = "",
}: {
  autoOpenFirstRunId?: string | null;
  onAutoOpenConsumed?: () => void;
  onDescribeApply?: (result: ParseResult) => void;
  initialDescription?: string;
}) {
  const { state, dispatch } = useCalculator();
  const payload = state.payload;
  const hasRuns = Boolean(payload?.runs.length);

  if (!payload) return null;
  const currentPayload = payload;

  function createPayloadForSystem(productCode: string): CanonicalPayload {
    const variables = initialVariablesForSystem(productCode);
    const initialHeight = Number(variables.target_height_mm ?? 1800);
    const runId = crypto.randomUUID();
    return {
      productCode,
      schemaVersion: "v1",
      variables,
      ...(currentPayload.propertyAnchor
        ? { propertyAnchor: currentPayload.propertyAnchor }
        : {}),
      ...(currentPayload.snapshot ? { snapshot: currentPayload.snapshot } : {}),
      runs: [
        {
          runId,
          productCode,
          variables,
          leftBoundary: { type: "product_post" },
          rightBoundary: { type: "product_post" },
          segments: [
            {
              segmentId: crypto.randomUUID(),
              sortOrder: 1,
              segmentKind: "panel",
              segmentWidthMm: 0,
              targetHeightMm: initialHeight,
              variables: productCode === "BAYG" ? { panel_quantity: 1 } : undefined,
            },
          ],
          corners: [],
        },
      ],
    };
  }

  function startFirstRun(productCode: string) {
    const nextPayload = createPayloadForSystem(productCode);
    const firstRun = nextPayload.runs[0];
    dispatch({ type: "SET_PAYLOAD", payload: nextPayload });
    window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent("qsbom:open-run", { detail: firstRun.runId }));
    }, 80);
  }

  function addRun() {
    const firstRun = payload!.runs[0];
    const productCode = firstRun?.productCode ?? payload!.productCode;
    const variables = {
      ...(payload!.variables ?? {}),
      ...(firstRun?.variables ?? {}),
    };
    const initialHeight = Number(variables.target_height_mm ?? 1800);
    const newRun: CanonicalRun = {
      runId: crypto.randomUUID(),
      productCode,
      variables,
      leftBoundary: firstRun?.leftBoundary ?? { type: "product_post" },
      rightBoundary: firstRun?.rightBoundary ?? { type: "product_post" },
      segments: [
        {
          segmentId: crypto.randomUUID(),
          sortOrder: 1,
          segmentKind: "panel",
          segmentWidthMm: 0,
          targetHeightMm: initialHeight,
          variables: productCode === "BAYG" ? { panel_quantity: 1 } : undefined,
        },
      ],
      corners: [],
    };
    dispatch({ type: "UPSERT_RUN", run: newRun });
  }

  return (
    <div className="space-y-5">
      {!hasRuns && (
        <section className="space-y-3 rounded-2xl border border-brand-primary/30 bg-brand-primary/5 p-3">
          <p className="text-sm font-black text-brand-text">Choose a fence system</p>
          <div className="grid gap-2">
            {groupProductsByFamily(localFenceProducts).map((family) =>
              family.products.length > 1 ? (
                <div
                  key={family.key}
                  className="rounded-lg border border-brand-primary bg-brand-primary px-4 py-4 text-white shadow-sm"
                >
                  <p className="text-2xl font-black">{family.label}</p>
                  <p className="mb-3 text-sm font-extrabold leading-tight">
                    Choose a style
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {family.products.map((product) => (
                      <button
                        key={product.system_type}
                        type="button"
                        onClick={() => startFirstRun(product.system_type)}
                        className="rounded-md border border-white/40 bg-white/10 px-3 py-2.5 text-left text-sm font-extrabold transition hover:bg-white/25"
                        data-testid={`landing-system-${product.system_type}`}
                      >
                        {SLAT_VARIANT_LABELS[product.system_type] ??
                          SYSTEM_BUTTON_LABELS[product.system_type] ??
                          product.name}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <button
                  key={family.key}
                  type="button"
                  onClick={() => startFirstRun(family.products[0].system_type)}
                  className="flex min-h-[88px] items-center justify-between gap-3 rounded-lg border border-brand-primary bg-brand-primary px-4 py-4 text-left text-white shadow-sm transition hover:bg-brand-primary/90 hover:shadow-md"
                  data-testid={`landing-system-${family.products[0].system_type}`}
                >
                  <span className="grid gap-1">
                    <span className="text-2xl font-black">{family.label}</span>
                    {SYSTEM_BUTTON_LABELS[family.products[0].system_type] &&
                      SYSTEM_BUTTON_LABELS[family.products[0].system_type] !== family.label && (
                        <span className="text-sm font-extrabold leading-tight">
                          {SYSTEM_BUTTON_LABELS[family.products[0].system_type]}
                        </span>
                      )}
                  </span>
                </button>
              ),
            )}
          </div>
          {onDescribeApply && (
            <div className="pt-2 text-center">
              <DescribeFenceBox
                title="Describe your fence"
                compact
                initialDescription={initialDescription}
                onApply={onDescribeApply}
              />
              <p className="mt-1 text-xs font-semibold text-brand-muted">
                (Click to describe)
              </p>
            </div>
          )}
        </section>
      )}
      {payload.runs.map((run, runIdx) => (
        <RunCard
          key={run.runId}
          run={run}
          runIdx={runIdx}
          autoOpenFirstSection={autoOpenFirstRunId === run.runId}
          onAutoOpenConsumed={onAutoOpenConsumed}
        />
      ))}
      {hasRuns && (
        <button
          type="button"
          onClick={addRun}
          className="min-h-11 w-full rounded-lg border border-brand-primary/50 bg-brand-primary px-4 py-3 text-sm font-black text-white shadow-sm transition-all hover:bg-brand-primary/90 hover:shadow-md"
        >
          + Add run
        </button>
      )}
    </div>
  );
}
