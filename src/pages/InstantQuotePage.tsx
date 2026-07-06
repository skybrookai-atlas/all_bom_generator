import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useSearchParams } from "react-router-dom";
import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import {
  CheckCircle2,
  Eraser,
  Loader2,
  Pencil,
  Ruler,
  Undo2,
} from "lucide-react";

/**
 * Public embeddable instant-quote widget.
 *
 * Lives at /embed/instant-quote?token=... — rendered inside an <iframe> on a
 * marketing website. NO auth, no AppShell: talks to the `instant-quote` edge
 * function with the anon key only. Never renders costs or margins (the API
 * cannot return them).
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

async function invokeInstantQuote<T>(body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/instant-quote`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify(body),
  });
  let json: { error?: string } & T;
  try {
    json = (await res.json()) as { error?: string } & T;
  } catch {
    throw new Error("Something went wrong — please try again");
  }
  if (!res.ok || json.error) {
    throw new Error(json.error ?? "Something went wrong — please try again");
  }
  return json;
}

interface WidgetOptionValue {
  value: string;
  label: string;
}
interface WidgetOption {
  name: string;
  label: string;
  values: WidgetOptionValue[];
}
interface WidgetSystem {
  systemType: string;
  label: string;
  heights: number[];
  options: WidgetOption[];
}
interface WidgetConfig {
  companyName: string;
  logoUrl: string | null;
  primaryColor: string | null;
  systems: WidgetSystem[];
}
interface PriceRange {
  rangeLowIncGst: number;
  rangeHighIncGst: number;
}

type Point = { x: number; y: number };
type MeasureMode = "type" | "draw";

const VIEW_W = 800;
const VIEW_H = 450;
/** Default drawing scale: 1 canvas px = 2 cm. */
const DEFAULT_CM_PER_PX = 2;

const audFmt = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  maximumFractionDigits: 0,
});

function polylineLengthPx(points: Point[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  return total;
}

/** Simple self-contained click-to-draw polyline canvas (SVG). */
function DrawMeasureCanvas({
  points,
  onChange,
  cmPerPx,
  onCmPerPxChange,
  accent,
}: {
  points: Point[];
  onChange: (points: Point[]) => void;
  cmPerPx: number;
  onCmPerPxChange: (v: number) => void;
  accent: string;
}) {
  const svgRef = useRef<SVGSVGElement>(null);

  function handlePointerDown(event: ReactPointerEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * VIEW_W;
    const y = ((event.clientY - rect.top) / rect.height) * VIEW_H;
    onChange([...points, { x, y }]);
  }

  const metresPerPx = cmPerPx / 100;
  const totalM = polylineLengthPx(points) * metresPerPx;

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">
        Tap or click to drop corner points along your fence line — a rough
        sketch is all we need.
      </p>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          className="block w-full cursor-crosshair touch-none select-none"
          style={{ aspectRatio: `${VIEW_W} / ${VIEW_H}` }}
          onPointerDown={handlePointerDown}
          role="img"
          aria-label="Fence sketch canvas"
        >
          {/* light grid */}
          <defs>
            <pattern id="iq-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#e2e8f0" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width={VIEW_W} height={VIEW_H} fill="url(#iq-grid)" />

          {points.length > 1 && (
            <polyline
              points={points.map((p) => `${p.x},${p.y}`).join(" ")}
              fill="none"
              stroke={accent}
              strokeWidth={4}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}
          {/* segment length labels */}
          {points.slice(1).map((p, i) => {
            const prev = points[i];
            const midX = (prev.x + p.x) / 2;
            const midY = (prev.y + p.y) / 2;
            const lenM = Math.hypot(p.x - prev.x, p.y - prev.y) * metresPerPx;
            return (
              <g key={`seg-${i}`} pointerEvents="none">
                <rect
                  x={midX - 26}
                  y={midY - 22}
                  width={52}
                  height={18}
                  rx={4}
                  fill="white"
                  stroke="#cbd5e1"
                />
                <text
                  x={midX}
                  y={midY - 9}
                  textAnchor="middle"
                  fontSize={12}
                  fill="#334155"
                >
                  {lenM.toFixed(1)} m
                </text>
              </g>
            );
          })}
          {points.map((p, i) => (
            <circle
              key={`pt-${i}`}
              cx={p.x}
              cy={p.y}
              r={6}
              fill="white"
              stroke={accent}
              strokeWidth={3}
              pointerEvents="none"
            />
          ))}
          {points.length === 0 && (
            <text
              x={VIEW_W / 2}
              y={VIEW_H / 2}
              textAnchor="middle"
              fontSize={18}
              fill="#94a3b8"
              pointerEvents="none"
            >
              Click to start drawing your fence
            </text>
          )}
        </svg>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => onChange(points.slice(0, -1))}
          disabled={points.length === 0}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
        >
          <Undo2 size={14} /> Undo point
        </button>
        <button
          type="button"
          onClick={() => onChange([])}
          disabled={points.length === 0}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
        >
          <Eraser size={14} /> Clear
        </button>
        <div className="ml-auto text-sm font-semibold text-slate-800 tabular-nums">
          Total: {totalM.toFixed(1)} m
        </div>
      </div>

      <label className="block text-xs text-slate-500">
        Drawing scale — 1 pixel = {cmPerPx} cm
        <input
          type="range"
          min={0.5}
          max={10}
          step={0.5}
          value={cmPerPx}
          onChange={(e) => onCmPerPxChange(Number(e.target.value))}
          className="mt-1 block w-full"
          style={{ accentColor: accent }}
        />
      </label>
    </div>
  );
}

function SectionHeading({
  step,
  title,
  accent,
}: {
  step: number;
  title: string;
  accent: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
        style={{ backgroundColor: accent }}
      >
        {step}
      </span>
      <h2 className="text-lg font-bold text-slate-900">{title}</h2>
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-offset-0";

export function InstantQuotePage() {
  const [searchParams] = useSearchParams();
  const token = (searchParams.get("token") ?? "").trim();

  const configQuery = useQuery({
    queryKey: ["instant-quote-config", token],
    queryFn: () => invokeInstantQuote<WidgetConfig>({ action: "config", token }),
    enabled: !!token,
    staleTime: Infinity,
    retry: 1,
  });
  const config = configQuery.data;
  const accent = config?.primaryColor || "#16a34a";

  // ── Step 1: measure ────────────────────────────────────────────────────────
  const [mode, setMode] = useState<MeasureMode>("type");
  const [typedLength, setTypedLength] = useState<string>("");
  const [points, setPoints] = useState<Point[]>([]);
  const [cmPerPx, setCmPerPx] = useState<number>(DEFAULT_CM_PER_PX);

  const drawnLengthM = useMemo(
    () => polylineLengthPx(points) * (cmPerPx / 100),
    [points, cmPerPx],
  );
  const lengthM =
    mode === "type"
      ? Number(typedLength) || 0
      : Math.round(drawnLengthM * 100) / 100;

  // ── Step 2: system + options ───────────────────────────────────────────────
  const [systemType, setSystemType] = useState<string | null>(null);
  const [heightMm, setHeightMm] = useState<number>(1800);
  const [variables, setVariables] = useState<Record<string, string>>({});

  const selectedSystem = config?.systems.find((s) => s.systemType === systemType);

  function selectSystem(system: WidgetSystem) {
    setSystemType(system.systemType);
    setHeightMm(system.heights.includes(1800) ? 1800 : system.heights[0]);
    setVariables(
      Object.fromEntries(
        system.options.map((o) => [o.name, o.values[0]?.value ?? ""]),
      ),
    );
  }

  // Auto-select when there's only one system on offer.
  useEffect(() => {
    if (config && config.systems.length === 1 && !systemType) {
      selectSystem(config.systems[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  // ── Step 3: live price range (debounced 500ms) ────────────────────────────
  const priceRequest = useMemo(() => {
    if (!token || !systemType || lengthM < 1) return null;
    return {
      token,
      systemType,
      lengthM: Math.round(lengthM * 100) / 100,
      heightMm,
      variables,
    };
  }, [token, systemType, lengthM, heightMm, variables]);

  const [debouncedRequest, setDebouncedRequest] = useState<typeof priceRequest>(null);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedRequest(priceRequest), 500);
    return () => clearTimeout(timer);
  }, [priceRequest]);

  const priceQuery = useQuery({
    queryKey: ["instant-quote-price", debouncedRequest],
    queryFn: () =>
      invokeInstantQuote<PriceRange>({ action: "price", ...debouncedRequest }),
    enabled: !!debouncedRequest,
    placeholderData: keepPreviousData,
    retry: false,
    staleTime: 60_000,
  });

  // ── Step 4: lead form ──────────────────────────────────────────────────────
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactAddress, setContactAddress] = useState("");

  const leadMutation = useMutation({
    mutationFn: () =>
      invokeInstantQuote<{ ok: true }>({
        action: "lead",
        token,
        systemType,
        lengthM: Math.round(lengthM * 100) / 100,
        heightMm,
        variables,
        contact: {
          name: contactName.trim(),
          email: contactEmail.trim(),
          phone: contactPhone.trim(),
          address: contactAddress.trim(),
        },
        drawing:
          mode === "draw" && points.length > 1
            ? {
                points,
                cmPerPx,
                totalLengthM: Math.round(drawnLengthM * 100) / 100,
              }
            : null,
      }),
  });

  const canSubmitLead =
    !!priceRequest &&
    contactName.trim().length > 0 &&
    (contactEmail.trim().length > 0 || contactPhone.trim().length > 0);

  // ── Render states ──────────────────────────────────────────────────────────
  if (!token) {
    return (
      <WidgetFrame>
        <p className="text-center text-sm text-slate-500">
          This quote calculator isn&apos;t set up correctly (missing widget
          token). Please contact the website owner.
        </p>
      </WidgetFrame>
    );
  }

  if (configQuery.isLoading) {
    return (
      <WidgetFrame>
        <div className="flex items-center justify-center gap-2 py-16 text-slate-500">
          <Loader2 size={18} className="animate-spin" />
          <span className="text-sm">Loading quote calculator…</span>
        </div>
      </WidgetFrame>
    );
  }

  if (configQuery.isError || !config) {
    return (
      <WidgetFrame>
        <p className="text-center text-sm text-slate-500">
          The quote calculator couldn&apos;t load right now. Please refresh the
          page or try again later.
        </p>
      </WidgetFrame>
    );
  }

  if (config.systems.length === 0) {
    return (
      <WidgetFrame config={config}>
        <p className="text-center text-sm text-slate-500">
          Instant quotes aren&apos;t available just yet — please get in touch
          with {config.companyName || "us"} directly for a quote.
        </p>
      </WidgetFrame>
    );
  }

  const price = priceQuery.data;
  const priceReady = !!price && !!debouncedRequest;

  return (
    <WidgetFrame config={config}>
      <div className="space-y-8">
        {/* ── 1. Measure ── */}
        <section className="space-y-4">
          <SectionHeading step={1} title="Measure your fence" accent={accent} />
          <div className="flex gap-1 rounded-xl bg-slate-100 p-1" role="tablist">
            {(
              [
                { id: "type", label: "Type it in", icon: Ruler },
                { id: "draw", label: "Draw it", icon: Pencil },
              ] as const
            ).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={mode === id}
                onClick={() => setMode(id)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                  mode === id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <Icon size={15} />
                {label}
              </button>
            ))}
          </div>

          {mode === "type" ? (
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">
                Total fence length (metres)
              </span>
              <input
                type="number"
                inputMode="decimal"
                min={1}
                max={500}
                step={0.5}
                value={typedLength}
                onChange={(e) => setTypedLength(e.target.value)}
                placeholder="e.g. 24"
                className={inputCls}
                style={{ ["--tw-ring-color" as string]: accent }}
                data-testid="iq-length-input"
              />
            </label>
          ) : (
            <DrawMeasureCanvas
              points={points}
              onChange={setPoints}
              cmPerPx={cmPerPx}
              onCmPerPxChange={setCmPerPx}
              accent={accent}
            />
          )}
          {lengthM > 0 && lengthM < 1 && (
            <p className="text-xs text-amber-600">
              Fence length must be at least 1 metre.
            </p>
          )}
        </section>

        {/* ── 2. Choose fence ── */}
        <section className="space-y-4">
          <SectionHeading step={2} title="Choose your fence" accent={accent} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {config.systems.map((system) => {
              const active = system.systemType === systemType;
              return (
                <button
                  key={system.systemType}
                  type="button"
                  onClick={() => selectSystem(system)}
                  className={`rounded-xl border-2 bg-white p-4 text-left transition-colors ${
                    active ? "shadow-sm" : "border-slate-200 hover:border-slate-300"
                  }`}
                  style={active ? { borderColor: accent } : undefined}
                  data-testid={`iq-system-${system.systemType}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold text-slate-900">
                      {system.label}
                    </span>
                    {active && <CheckCircle2 size={18} style={{ color: accent }} />}
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    Heights {Math.min(...system.heights) / 1000}m –{" "}
                    {Math.max(...system.heights) / 1000}m
                  </p>
                </button>
              );
            })}
          </div>

          {selectedSystem && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-700">
                  Fence height
                </span>
                <select
                  value={heightMm}
                  onChange={(e) => setHeightMm(Number(e.target.value))}
                  className={inputCls}
                  data-testid="iq-height-select"
                >
                  {selectedSystem.heights.map((h) => (
                    <option key={h} value={h}>
                      {(h / 1000).toFixed(1)}m ({h}mm)
                    </option>
                  ))}
                </select>
              </label>
              {selectedSystem.options.map((option) => (
                <label key={option.name} className="block">
                  <span className="mb-1.5 block text-sm font-medium text-slate-700">
                    {option.label}
                  </span>
                  <select
                    value={variables[option.name] ?? option.values[0]?.value}
                    onChange={(e) =>
                      setVariables((prev) => ({
                        ...prev,
                        [option.name]: e.target.value,
                      }))
                    }
                    className={inputCls}
                    data-testid={`iq-option-${option.name}`}
                  >
                    {option.values.map((v) => (
                      <option key={v.value} value={v.value}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          )}
        </section>

        {/* ── 3. Live price range ── */}
        <section
          className="rounded-2xl border-2 p-6 text-center"
          style={{ borderColor: accent, backgroundColor: `${accent}0d` }}
        >
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Your estimated price
          </p>
          {priceQuery.isError ? (
            <p className="mt-3 text-sm text-amber-700">
              {priceQuery.error instanceof Error
                ? priceQuery.error.message
                : "We couldn't price that combination — try different options."}
            </p>
          ) : priceReady ? (
            <p
              className={`mt-2 text-3xl font-black tabular-nums sm:text-4xl ${
                priceQuery.isFetching ? "opacity-50" : ""
              }`}
              style={{ color: accent }}
              data-testid="iq-price-range"
            >
              {audFmt.format(price.rangeLowIncGst)} –{" "}
              {audFmt.format(price.rangeHighIncGst)}
              <span className="ml-2 text-sm font-semibold text-slate-500">
                inc GST
              </span>
            </p>
          ) : debouncedRequest || priceQuery.isFetching ? (
            <div className="mt-3 flex items-center justify-center gap-2 text-slate-500">
              <Loader2 size={16} className="animate-spin" />
              <span className="text-sm">Calculating…</span>
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-500">
              Enter your fence length and pick a fence type to see your price
              range.
            </p>
          )}
          <p className="mt-3 text-xs text-slate-500">
            Final quote confirmed after a quick site check.
          </p>
        </section>

        {/* ── 4. Lead capture ── */}
        <section className="space-y-4">
          <SectionHeading step={3} title="Get your exact quote" accent={accent} />
          {leadMutation.isSuccess ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
              <CheckCircle2 size={32} className="mx-auto text-emerald-600" />
              <p className="mt-3 text-base font-bold text-emerald-900">
                Thanks {contactName.trim().split(" ")[0]}! Your detailed quote
                is on its way — we&apos;ll be in touch shortly.
              </p>
            </div>
          ) : (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (canSubmitLead && !leadMutation.isPending) leadMutation.mutate();
              }}
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <input
                  type="text"
                  required
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="Your name *"
                  className={inputCls}
                  data-testid="iq-contact-name"
                />
                <input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="Email"
                  className={inputCls}
                  data-testid="iq-contact-email"
                />
                <input
                  type="tel"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="Phone"
                  className={inputCls}
                  data-testid="iq-contact-phone"
                />
                <input
                  type="text"
                  value={contactAddress}
                  onChange={(e) => setContactAddress(e.target.value)}
                  placeholder="Property address"
                  className={inputCls}
                  data-testid="iq-contact-address"
                />
              </div>
              <p className="text-xs text-slate-500">
                We just need your name and an email or phone number.
              </p>
              {leadMutation.isError && (
                <p className="text-sm text-red-600">
                  {leadMutation.error instanceof Error
                    ? leadMutation.error.message
                    : "Something went wrong — please try again."}
                </p>
              )}
              <button
                type="submit"
                disabled={!canSubmitLead || leadMutation.isPending}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold text-white transition-opacity disabled:opacity-40 sm:w-auto"
                style={{ backgroundColor: accent }}
                data-testid="iq-lead-submit"
              >
                {leadMutation.isPending && (
                  <Loader2 size={15} className="animate-spin" />
                )}
                {leadMutation.isPending ? "Sending…" : "Get my exact quote"}
              </button>
            </form>
          )}
        </section>
      </div>
    </WidgetFrame>
  );
}

/** Slim self-contained chrome — light background, brand header, footer note. */
function WidgetFrame({
  config,
  children,
}: {
  config?: WidgetConfig;
  children: React.ReactNode;
}) {
  const accent = config?.primaryColor || "#16a34a";
  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
        <header className="mb-6 flex items-center gap-3">
          {config?.logoUrl ? (
            <img
              src={config.logoUrl}
              alt=""
              className="h-10 w-auto max-w-[140px] object-contain"
            />
          ) : (
            <span
              className="flex h-10 w-10 items-center justify-center rounded-xl text-lg font-black text-white"
              style={{ backgroundColor: accent }}
            >
              {(config?.companyName || "Q").charAt(0)}
            </span>
          )}
          <div>
            <p className="text-sm font-bold leading-tight text-slate-900">
              {config?.companyName || "Instant fence quote"}
            </p>
            <p className="text-xs text-slate-500">
              Instant fence quote — takes about a minute
            </p>
          </div>
        </header>
        <main className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          {children}
        </main>
        <footer className="mt-4 text-center text-[11px] text-slate-400">
          Prices are an estimate range including GST. Final quote confirmed
          after a site check.
        </footer>
      </div>
    </div>
  );
}
