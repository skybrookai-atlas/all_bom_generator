import { describe, expect, it } from "vitest";
import type { CanonicalPayload } from "../types/canonical.types";
import { calculateLocalBom } from "./localBomCalculator";

describe("calculateLocalBom", () => {
  it("uses section-level overrides when regenerating slat SKUs", () => {
    const payload: CanonicalPayload = {
      productCode: "QSHS",
      schemaVersion: "v3",
      variables: {
        colour_code: "B",
        finish_family: "standard",
        slat_size_mm: 65,
        slat_gap_mm: 9,
        target_height_mm: 1800,
        max_panel_width_mm: 2600,
        mounting_method: "in_ground",
      },
      runs: [
        {
          runId: "run-1",
          productCode: "QSHS",
          leftBoundary: { type: "product_post" },
          rightBoundary: { type: "product_post" },
          corners: [],
          variables: {},
          segments: [
            {
              segmentId: "section-1",
              sortOrder: 1,
              segmentKind: "panel",
              segmentWidthMm: 2400,
              targetHeightMm: 1800,
            },
            {
              segmentId: "section-2",
              sortOrder: 2,
              segmentKind: "panel",
              segmentWidthMm: 2400,
              targetHeightMm: 1800,
              variables: {
                colour_code: "MN",
                slat_size_mm: 90,
                slat_gap_mm: 20,
              },
            },
          ],
        },
      ],
    };

    const result = calculateLocalBom(payload);
    const skus = result.lines.map((line) => line.sku);

    expect(skus).toContain("XP-6100-S65-B");
    expect(skus).toContain("QS-6100-S90-MN");
  });

  it("calculates ColorBond fence and swing gate catalogue components", () => {
    const payload: CanonicalPayload = {
      productCode: "COLORBOND",
      schemaVersion: "v3",
      variables: {
        profile_code: "GZAG",
        colour_code: "MN",
        post_colour_code: "MN",
        target_height_mm: 1800,
        max_panel_width_mm: 2365,
        mounting_type: "in_ground",
      },
      runs: [
        {
          runId: "run-1",
          productCode: "COLORBOND",
          leftBoundary: { type: "product_post" },
          rightBoundary: { type: "product_post" },
          corners: [],
          variables: {},
          segments: [
            {
              segmentId: "section-1",
              sortOrder: 1,
              segmentKind: "panel",
              segmentWidthMm: 2365,
              targetHeightMm: 1800,
            },
            {
              segmentId: "gate-1",
              sortOrder: 2,
              segmentKind: "gate_opening",
              segmentWidthMm: 900,
              targetHeightMm: 1800,
              variables: {
                gate_movement: "single_swing",
              },
            },
          ],
        },
      ],
    };

    const result = calculateLocalBom(payload);
    const bySku = new Map(result.lines.map((line) => [line.sku, line]));

    expect(bySku.get("CB-GZAG-1790-MN")?.quantity).toBe(4);
    expect(bySku.get("CB-RAIL-2365-MN")?.quantity).toBe(2);
    expect(bySku.get("CB-CPOST-2400-MN")?.quantity).toBe(2);
    expect(bySku.get("CB-TS-MN-15PK")?.quantity).toBe(2);
    expect(bySku.get("CB-1800GS-MN-2PK")?.quantity).toBe(1);
    expect(bySku.get("CB-GATE-R-830-MN")?.quantity).toBe(2);
    expect(bySku.get("CB-HINGE-MN-2PK")?.quantity).toBe(1);
    expect(bySku.get("CB-LATCH-MN")?.quantity).toBe(1);
    expect(result.gateItems.map((line) => line.sku)).toContain("CB-1800GS-MN-2PK");
    expect(result.warnings.join(" ")).not.toContain("not wired");
  });
});
