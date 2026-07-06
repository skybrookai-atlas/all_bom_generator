// Fence families group the internal system codes into how a fencer actually
// thinks about products: "Aluminium Slat fence" first, variant second. The
// engine keeps its per-system codes — this is presentation-level grouping.

export interface FamilyProduct {
  system_type: string;
  name: string;
  description?: string | null;
}

export interface FenceFamilyGroup<P extends FamilyProduct = FamilyProduct> {
  key: string;
  label: string;
  products: P[];
}

/** The four Glass Outlet QuickScreen ranges are all aluminium slat systems. */
export const ALUMINIUM_SLAT_SYSTEMS = ["QSHS", "VS", "XPL", "BAYG"] as const;

export const SLAT_VARIANT_LABELS: Record<string, string> = {
  QSHS: "Horizontal Slats",
  VS: "Vertical Slats",
  XPL: "XPress Plus",
  BAYG: "Build As You Go",
};

export function fenceFamilyLabel(systemType: string, fallback: string): string {
  return (ALUMINIUM_SLAT_SYSTEMS as readonly string[]).includes(systemType)
    ? "Aluminium Slat Fence"
    : fallback;
}

/**
 * Group a flat product list into families: one "Aluminium Slat Fence" group
 * for the slat systems (in their original order) and one group per remaining
 * product. Preserves the incoming order for non-slat products.
 */
export function groupProductsByFamily<P extends FamilyProduct>(
  products: P[],
): FenceFamilyGroup<P>[] {
  const slat = products.filter((p) =>
    (ALUMINIUM_SLAT_SYSTEMS as readonly string[]).includes(p.system_type),
  );
  const groups: FenceFamilyGroup<P>[] = [];
  let slatInserted = false;
  for (const p of products) {
    if ((ALUMINIUM_SLAT_SYSTEMS as readonly string[]).includes(p.system_type)) {
      if (!slatInserted) {
        groups.push({ key: "ALUM_SLAT", label: "Aluminium Slat Fence", products: slat });
        slatInserted = true;
      }
    } else {
      groups.push({ key: p.system_type, label: p.name, products: [p] });
    }
  }
  return groups;
}
