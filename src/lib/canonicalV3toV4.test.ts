import { describe, expect, it } from 'vitest';
import { isV4Payload, translateCanonicalV3toV4 } from './canonicalV3toV4';
import type {
  CanonicalPayload,
  CanonicalRun,
  CanonicalSegment,
} from '../types/canonical.types';

const RUN_ID = '11111111-1111-4111-8111-111111111111';
const SEG_1 = 'aaaa0001-0000-4000-8000-000000000001';
const SEG_2 = 'aaaa0002-0000-4000-8000-000000000002';
const SEG_3 = 'aaaa0003-0000-4000-8000-000000000003';
const CORNER_1 = 'cccc0001-0000-4000-8000-000000000001';

function makePayload(run: Partial<CanonicalRun>): CanonicalPayload {
  return {
    productCode: 'QSHS',
    schemaVersion: 'v1',
    variables: { target_height_mm: 1800 },
    runs: [
      {
        runId: RUN_ID,
        productCode: 'QSHS',
        segments: [],
        ...run,
      },
    ],
  };
}

function seg(overrides: Partial<CanonicalSegment>): CanonicalSegment {
  return { segmentId: SEG_1, sortOrder: 0, ...overrides };
}

describe('translateCanonicalV3toV4', () => {
  it('translates a single panel segment with product_post boundaries to both-system', () => {
    const payload = makePayload({
      leftBoundary: { type: 'product_post' },
      rightBoundary: { type: 'product_post' },
      segments: [seg({ segmentKind: 'panel', segmentWidthMm: 12000 })],
    });

    const out = translateCanonicalV3toV4(payload);
    const s = out.runs[0].segments[0];

    expect(s.kind).toBe('fence');
    expect(s.productCode).toBe('QSHS');
    expect(s.confirmed).toBe(true);
    expect(s.segmentWidthMm).toBe(12000);
    expect(s.targetHeightMm).toBe(1800);
    expect(s.leftTermination).toEqual({ kind: 'system' });
    expect(s.rightTermination).toEqual({ kind: 'system' });
    // stable ids preserved
    expect(out.runs[0].runId).toBe(RUN_ID);
    expect(s.segmentId).toBe(SEG_1);
    // input not mutated
    expect(payload.runs[0].segments[0].kind).toBeUndefined();
  });

  it('maps wall / brick_post boundaries to non_system terminations', () => {
    const payload = makePayload({
      leftBoundary: { type: 'wall' },
      rightBoundary: { type: 'brick_post' },
      segments: [seg({ segmentKind: 'panel', segmentWidthMm: 6000 })],
    });

    const s = translateCanonicalV3toV4(payload).runs[0].segments[0];
    expect(s.leftTermination).toEqual({ kind: 'non_system', subtype: 'wall' });
    expect(s.rightTermination).toEqual({ kind: 'non_system', subtype: 'post' });
  });

  it('turns a corners[] entry between two segments into system_corner terminations', () => {
    const payload = makePayload({
      leftBoundary: { type: 'product_post' },
      rightBoundary: { type: 'product_post' },
      corners: [{ cornerId: CORNER_1, afterSegmentId: SEG_1, type: '90' }],
      segments: [
        seg({ segmentId: SEG_1, sortOrder: 0, segmentKind: 'panel', segmentWidthMm: 6000 }),
        seg({ segmentId: SEG_2, sortOrder: 1, segmentKind: 'panel', segmentWidthMm: 4000 }),
      ],
    });

    const [a, b] = translateCanonicalV3toV4(payload).runs[0].segments;
    expect(a.leftTermination).toEqual({ kind: 'system' });
    expect(a.rightTermination).toEqual({ kind: 'system_corner', angleDeg: 90 });
    expect(b.leftTermination).toEqual({ kind: 'system_corner', angleDeg: 90 });
    expect(b.rightTermination).toEqual({ kind: 'system' });
  });

  it('uses segment_join at plain interior junctions and 135 for obtuse corners', () => {
    const payload = makePayload({
      corners: [{ cornerId: CORNER_1, afterSegmentId: SEG_2, type: '135' }],
      segments: [
        seg({ segmentId: SEG_1, sortOrder: 0, segmentKind: 'panel', segmentWidthMm: 3000 }),
        seg({ segmentId: SEG_2, sortOrder: 1, segmentKind: 'panel', segmentWidthMm: 3000 }),
        seg({ segmentId: SEG_3, sortOrder: 2, segmentKind: 'panel', segmentWidthMm: 3000 }),
      ],
    });

    const [a, b, c] = translateCanonicalV3toV4(payload).runs[0].segments;
    expect(a.rightTermination).toEqual({ kind: 'segment_join' });
    expect(b.leftTermination).toEqual({ kind: 'segment_join' });
    expect(b.rightTermination).toEqual({ kind: 'system_corner', angleDeg: 135 });
    expect(c.leftTermination).toEqual({ kind: 'system_corner', angleDeg: 135 });
  });

  it('maps gate_opening between fence segments to kind gate with gateProductCode', () => {
    const payload = makePayload({
      leftBoundary: { type: 'product_post' },
      rightBoundary: { type: 'product_post' },
      segments: [
        seg({ segmentId: SEG_1, sortOrder: 0, segmentKind: 'panel', segmentWidthMm: 4000 }),
        seg({
          segmentId: SEG_2,
          sortOrder: 1,
          segmentKind: 'gate_opening',
          gateProductCode: 'QS_GATE',
          segmentWidthMm: 1000,
        }),
        seg({ segmentId: SEG_3, sortOrder: 2, segmentKind: 'panel', segmentWidthMm: 4000 }),
      ],
    });

    const [a, g, c] = translateCanonicalV3toV4(payload).runs[0].segments;
    expect(a.kind).toBe('fence');
    expect(g.kind).toBe('gate');
    expect(g.productCode).toBe('QS_GATE');
    expect(g.confirmed).toBe(true);
    expect(g.leftTermination).toEqual({ kind: 'segment_join' });
    expect(g.rightTermination).toEqual({ kind: 'segment_join' });
    expect(c.kind).toBe('fence');
    expect(c.rightTermination).toEqual({ kind: 'system' });
  });

  it('folds segmentKind corner marker segments into terminations without emitting them', () => {
    const payload = makePayload({
      segments: [
        seg({ segmentId: SEG_1, sortOrder: 0, segmentKind: 'panel', segmentWidthMm: 5000 }),
        seg({
          segmentId: SEG_2,
          sortOrder: 1,
          segmentKind: 'corner',
          variables: { corner_degrees: 90 },
        }),
        seg({ segmentId: SEG_3, sortOrder: 2, segmentKind: 'panel', segmentWidthMm: 5000 }),
      ],
    });

    const segments = translateCanonicalV3toV4(payload).runs[0].segments;
    expect(segments).toHaveLength(2);
    expect(segments.map((s) => s.segmentId)).toEqual([SEG_1, SEG_3]);
    expect(segments[0].rightTermination).toEqual({ kind: 'system_corner', angleDeg: 90 });
    expect(segments[1].leftTermination).toEqual({ kind: 'system_corner', angleDeg: 90 });
  });

  it('expands bay_group width from bayCount x panel width when segmentWidthMm is absent', () => {
    const payload = makePayload({
      segments: [
        seg({
          segmentKind: 'bay_group',
          bayCount: 4,
          variables: { panel_width_mm: 2400 },
        }),
      ],
    });

    const s = translateCanonicalV3toV4(payload).runs[0].segments[0];
    expect(s.segmentWidthMm).toBe(9600);
  });

  it('passes fully-V4 payloads through unchanged (same reference)', () => {
    const payload = makePayload({
      segments: [
        seg({
          kind: 'fence',
          productCode: 'QSHS',
          confirmed: true,
          segmentWidthMm: 12000,
          targetHeightMm: 1800,
          leftTermination: { kind: 'system' },
          rightTermination: { kind: 'non_system', subtype: 'wall' },
        }),
      ],
    });

    expect(isV4Payload(payload)).toBe(true);
    expect(translateCanonicalV3toV4(payload)).toBe(payload);
  });
});
