import {
  COLORBOND_FENCE_COMPONENTS,
  COLORBOND_GATE_COMPONENTS,
  colorBondDiagramReferenceTitle,
  sameColorBondDiagramReference,
  type ColorBondDiagramReference,
  type ColorBondDiagramScope,
  type ColorBondFenceDiagramNumber,
  type ColorBondGateDiagramNumber,
} from "../../lib/colorbondDiagramMapping";
import {
  setColorBondDiagramHover,
  useColorBondDiagramHover,
} from "../../lib/colorbondDiagramHover";
import { NumberedBadge } from "../shared/NumberedBadge";

const FENCE_IMAGE = "/assets/colorbond/colorbond-panel-components.png";
const GATE_IMAGE = "/assets/colorbond/colorbond-gate-components.png";

const FENCE_BADGE_POSITIONS: Record<ColorBondFenceDiagramNumber, { left: string; top: string }> = {
  1: { left: "14.0%", top: "15.8%" },
  2: { left: "10.9%", top: "56.8%" },
  3: { left: "40.1%", top: "17.8%" },
  4: { left: "57.9%", top: "48.7%" },
  5: { left: "92.3%", top: "20.3%" },
};

const GATE_BADGE_POSITIONS: Record<ColorBondGateDiagramNumber, { left: string; top: string }> = {
  1: { left: "11.7%", top: "41.8%" },
  2: { left: "39.7%", top: "14.9%" },
  3: { left: "53.1%", top: "51.2%" },
  4: { left: "32.8%", top: "94.8%" },
};

type Props = {
  scope: ColorBondDiagramScope;
  profileCode?: string;
  targetHeightMm?: number;
  infillColourCode?: string;
  frameColourCode?: string;
  railLengthMm?: number;
  mountingType?: string;
};

function infillHeight(targetHeightMm?: number) {
  const height = Number(targetHeightMm ?? 1800);
  return Number.isFinite(height) ? height - 10 : 1790;
}

function gateStileHeight(targetHeightMm?: number) {
  const height = Number(targetHeightMm ?? 1800);
  if (height <= 1500) return 1500;
  if (height >= 2100) return 2100;
  return 1800;
}

function channelPostHeight(targetHeightMm?: number, mountingType?: string) {
  const height = Number(targetHeightMm ?? 1800);
  if (height <= 1500 && mountingType === "base_plate") return 1800;
  if (height <= 1800) return 2400;
  return 3000;
}

function fenceComponentCode({
  number,
  profileCode = "GZAG",
  targetHeightMm,
  infillColourCode = "MN",
  frameColourCode = "MN",
  railLengthMm = 2365,
  mountingType = "in_ground",
}: Props & { number: ColorBondFenceDiagramNumber }) {
  switch (number) {
    case 1:
      return "CB-POSTCAP-SGL / CB-POSTCAP-DBL";
    case 2:
      return `CB-CPOST-${channelPostHeight(targetHeightMm, mountingType)}-${frameColourCode}`;
    case 3:
      return `CB-RAIL-${railLengthMm === 3125 ? 3125 : 2365}-${frameColourCode}`;
    case 4:
      return `CB-${profileCode}-${infillHeight(targetHeightMm)}-${infillColourCode}`;
    case 5:
      return `CB-TS-${frameColourCode}-15PK`;
    default:
      return "";
  }
}

function gateComponentCode({
  number,
  profileCode = "GZAG",
  targetHeightMm,
  infillColourCode = "MN",
  frameColourCode = "MN",
}: Props & { number: ColorBondGateDiagramNumber }) {
  switch (number) {
    case 1:
      return `CB-${gateStileHeight(targetHeightMm)}GS-${frameColourCode}-2PK`;
    case 2:
      return `CB-GATE-R-830-${frameColourCode}`;
    case 3:
      return `CB-${profileCode}-${infillHeight(targetHeightMm)}-${infillColourCode}`;
    case 4:
      return `CB-TS-${frameColourCode}-15PK`;
    default:
      return "";
  }
}

export function ColorBondComponentList(props: Props) {
  const hoveredRef = useColorBondDiagramHover();
  const isGate = props.scope === "gate";
  const components = isGate ? COLORBOND_GATE_COMPONENTS : COLORBOND_FENCE_COMPONENTS;
  const numbers = Object.keys(components).map(Number) as Array<
    ColorBondFenceDiagramNumber | ColorBondGateDiagramNumber
  >;

  return (
    <div className="rounded-lg border border-brand-border bg-brand-card p-3">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-black text-brand-text">
            {isGate ? "ColorBond gate components" : "ColorBond fence components"}
          </p>
          <p className="text-xs font-semibold text-brand-muted">
            Hover a number to match it to the BOM rows.
          </p>
        </div>
        <span className="rounded-full border border-brand-border bg-brand-bg px-2 py-1 text-[11px] font-black uppercase tracking-wide text-brand-muted">
          {isGate ? "gate" : "fence"}
        </span>
      </div>
      <div className="divide-y divide-brand-border/60 overflow-hidden rounded-lg border border-brand-border/70">
        {numbers.map((number) => {
          const ref: ColorBondDiagramReference = {
            scope: props.scope,
            number,
          };
          const active = sameColorBondDiagramReference(hoveredRef, ref);
          const label = isGate
            ? COLORBOND_GATE_COMPONENTS[number as ColorBondGateDiagramNumber]
            : COLORBOND_FENCE_COMPONENTS[number as ColorBondFenceDiagramNumber];
          const code = isGate
            ? gateComponentCode({ ...props, number: number as ColorBondGateDiagramNumber })
            : fenceComponentCode({ ...props, number: number as ColorBondFenceDiagramNumber });

          return (
            <div
              key={`${props.scope}-${number}`}
              onMouseEnter={() => setColorBondDiagramHover(ref)}
              onMouseLeave={() => setColorBondDiagramHover(null)}
              className={`grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1 px-3 py-2 text-sm transition-colors sm:grid-cols-[auto_1fr_auto] ${
                active ? "bg-brand-warning/15" : "bg-brand-card hover:bg-brand-accent/5"
              }`}
              title={colorBondDiagramReferenceTitle(ref)}
            >
              <NumberedBadge active={active}>{number}</NumberedBadge>
              <span className="font-bold text-brand-text">{label}</span>
              <span className="col-start-2 font-mono text-xs font-bold text-brand-primary sm:col-start-auto">
                {code}
              </span>
            </div>
          );
        })}
      </div>
      <div className="relative mt-3 overflow-hidden rounded-lg border border-brand-border/70 bg-white">
        <img
          src={isGate ? GATE_IMAGE : FENCE_IMAGE}
          alt={isGate ? "Typical ColorBond gate component overview" : "Typical ColorBond panel component overview"}
          className="w-full object-contain"
          loading="lazy"
        />
        {numbers.map((number) => {
          const ref: ColorBondDiagramReference = {
            scope: props.scope,
            number,
          };
          const active = sameColorBondDiagramReference(hoveredRef, ref);
          const position = isGate
            ? GATE_BADGE_POSITIONS[number as ColorBondGateDiagramNumber]
            : FENCE_BADGE_POSITIONS[number as ColorBondFenceDiagramNumber];

          return (
            <button
              key={`${props.scope}-image-${number}`}
              type="button"
              onMouseEnter={() => setColorBondDiagramHover(ref)}
              onMouseLeave={() => setColorBondDiagramHover(null)}
              onFocus={() => setColorBondDiagramHover(ref)}
              onBlur={() => setColorBondDiagramHover(null)}
              className={`absolute z-10 flex h-7 min-w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-orange-500 bg-orange-400 px-2 text-xs font-black leading-none text-black shadow-md transition ${
                active
                  ? "scale-110 ring-4 ring-orange-500/35 ring-offset-2 ring-offset-white"
                  : "hover:scale-105 focus:outline-none focus:ring-4 focus:ring-orange-500/35"
              }`}
              style={position}
              title={colorBondDiagramReferenceTitle(ref)}
              aria-label={colorBondDiagramReferenceTitle(ref)}
            >
              {number}
            </button>
          );
        })}
      </div>
    </div>
  );
}
