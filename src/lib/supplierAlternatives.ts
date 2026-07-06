// Cross-supplier equivalents for COLORBOND BOM lines.
//
// The three colorbond supplier ranges use structured SKUs that map 1:1 on
// size, so equivalents can be derived deterministically:
//   Glass Outlet:    FNP{colour}{height} / FRM{colour}{23|31} /
//                    (FZS|FMS|FNS){colour}{height} / CCAP{colour}
//   Amazing Fencing: AF- prefix, same scheme (Metzag/FZS profile only)
//   Oxworks:         OX-CPOST-{height} / OX-RAIL-{23|31} /
//                    OX-SHEET-{SAW|EZY|TRIM}-{height} / OX-POSTCAP
//                    (colour chosen at order time — no colour in SKU)
//
// Profile mapping: FZS (Metzag/GO-Zag) ↔ SAW, FMS (Metline/GO-Line) ↔ EZY,
// FNS (Trimclad/GO-Trim) ↔ TRIM.
//
// Oxworks-sourced lines are not offered alternatives (their SKUs carry no
// colour, so the coloured equivalents can't be derived from the SKU alone).

export interface SupplierAlternative {
  sku: string;
  supplierLabel: string;
}

const SHEET_TO_OX: Record<string, string> = { FZS: "SAW", FMS: "EZY", FNS: "TRIM" };

const LABELS = {
  go: "Glass Outlet",
  af: "Amazing Fencing",
  ox: "Oxworks",
};

/** Returns alternative-supplier SKUs for a BOM line, excluding the line's own. */
export function supplierAlternativesFor(sku: string): SupplierAlternative[] {
  if (!sku) return [];

  let m = sku.match(/^(AF-)?FNP([A-Z]{2})(\d{2})$/);
  if (m) {
    const [, af, colour, h] = m;
    return [
      af
        ? { sku: `FNP${colour}${h}`, supplierLabel: LABELS.go }
        : { sku: `AF-FNP${colour}${h}`, supplierLabel: LABELS.af },
      { sku: `OX-CPOST-${h}`, supplierLabel: LABELS.ox },
    ];
  }

  m = sku.match(/^(AF-)?FRM([A-Z]{2})(23|31)$/);
  if (m) {
    const [, af, colour, len] = m;
    return [
      af
        ? { sku: `FRM${colour}${len}`, supplierLabel: LABELS.go }
        : { sku: `AF-FRM${colour}${len}`, supplierLabel: LABELS.af },
      { sku: `OX-RAIL-${len}`, supplierLabel: LABELS.ox },
    ];
  }

  m = sku.match(/^(AF-)?(FZS|FMS|FNS)([A-Z]{2})(\d{2})$/);
  if (m) {
    const [, af, profile, colour, h] = m;
    const out: SupplierAlternative[] = [];
    if (af) out.push({ sku: `${profile}${colour}${h}`, supplierLabel: LABELS.go });
    else if (profile === "FZS")
      out.push({ sku: `AF-FZS${colour}${h}`, supplierLabel: LABELS.af });
    out.push({ sku: `OX-SHEET-${SHEET_TO_OX[profile]}-${h}`, supplierLabel: LABELS.ox });
    return out;
  }

  m = sku.match(/^CCAP([A-Z]{2})$/);
  if (m) return [{ sku: "OX-POSTCAP", supplierLabel: LABELS.ox }];

  return [];
}
