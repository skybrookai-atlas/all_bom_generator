export type ColorBondDiagramScope = "fence" | "gate";
export type ColorBondFenceDiagramNumber = 1 | 2 | 3 | 4 | 5;
export type ColorBondGateDiagramNumber = 1 | 2 | 3 | 4;
export type ColorBondDiagramNumber =
  | ColorBondFenceDiagramNumber
  | ColorBondGateDiagramNumber;

export type ColorBondDiagramReference = {
  scope: ColorBondDiagramScope;
  number: ColorBondDiagramNumber;
};

export const COLORBOND_FENCE_COMPONENTS: Record<ColorBondFenceDiagramNumber, string> = {
  1: "Post cap for channel post",
  2: "Channel post",
  3: "Top & bottom rail",
  4: "Infill sheets",
  5: "Tek screws",
};

export const COLORBOND_GATE_COMPONENTS: Record<ColorBondGateDiagramNumber, string> = {
  1: "Gate stile",
  2: "Top & bottom rail",
  3: "Infill sheet",
  4: "Tek screws",
};

const COLORBOND_FENCE_MATCHERS: Array<[RegExp, ColorBondFenceDiagramNumber[]]> = [
  [/^CB-POSTCAP-/i, [1]],
  [/^CB-CPOST-/i, [2]],
  [/^CB-RAIL-/i, [3]],
  [/^CB-(GLINE|GZAG|GTRIM)-/i, [4]],
  [/^CB-TS-/i, [5]],
];

const COLORBOND_GATE_MATCHERS: Array<[RegExp, ColorBondGateDiagramNumber[]]> = [
  [/^CB-(1500|1800|2100)GS-/i, [1]],
  [/^CB-GATE-R-830-/i, [2]],
  [/^CB-(GLINE|GZAG|GTRIM)-/i, [3]],
  [/^CB-TS-/i, [4]],
];

export function colorBondDiagramReferencesForSku(
  sku: string,
  scope: ColorBondDiagramScope,
): ColorBondDiagramReference[] {
  const matchers =
    scope === "gate" ? COLORBOND_GATE_MATCHERS : COLORBOND_FENCE_MATCHERS;
  const match = matchers.find(([pattern]) => pattern.test(sku));
  return (
    match?.[1].map((number) => ({
      scope,
      number,
    })) ?? []
  );
}

export function colorBondDiagramReferenceTitle(ref: ColorBondDiagramReference): string {
  const label =
    ref.scope === "gate"
      ? COLORBOND_GATE_COMPONENTS[ref.number as ColorBondGateDiagramNumber]
      : COLORBOND_FENCE_COMPONENTS[ref.number as ColorBondFenceDiagramNumber];
  return `${ref.number}. ${label}`;
}

export function sameColorBondDiagramReference(
  a: ColorBondDiagramReference | null,
  b: ColorBondDiagramReference | null,
) {
  return Boolean(a && b && a.scope === b.scope && a.number === b.number);
}
