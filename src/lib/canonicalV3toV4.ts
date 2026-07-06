// canonicalV3toV4.ts — Pure client-side translation of V3-shaped canonical
// payloads (segmentKind / run boundaries / corners[]) into the V4 segment
// shape the bom-calculator edge function consumes (kind + terminations).
//
// WHY THIS EXISTS
// ---------------
// The /fence-calculator (V3) page builds payloads where fence/gate topology is
// described at run level (leftBoundary, rightBoundary, corners[]) and segments
// are classified by `segmentKind`. The server engine only walks the V4 shape:
// every segment carries `kind: 'fence' | 'gate'`, a `productCode`, and
// structured `leftTermination` / `rightTermination` objects. Without this
// translation every server call from the V3 page crashes with
// "Cannot read properties of undefined (reading 'kind')".
//
// GUARANTEES
// ----------
// • Pure: never mutates the input payload.
// • runId / segmentId / variables are preserved verbatim.
// • V3-only fields (segmentKind, bayCount, gateProductCode, …) are kept on the
//   output segments — the canonical schema allows both shapes and the engine
//   ignores the extras. This keeps the translated payload round-trippable.
// • Payloads that already look V4 (every segment has kind + both terminations)
//   are passed through unchanged (same object reference).

import type {
  CanonicalBoundary,
  CanonicalPayload,
  CanonicalRun,
  CanonicalSegment,
  SegmentTermination,
} from '../types/canonical.types';
import {
  cornerDegreesFromVars,
  effectiveLegacyBoundaryType,
  type LegacyBoundaryType,
} from './segmentTermination';

const DEFAULT_GATE_PRODUCT_CODE = 'QS_GATE';

// ---------------------------------------------------------------------------
// V4 detection
// ---------------------------------------------------------------------------

function segmentIsV4(segment: CanonicalSegment): boolean {
  return (
    (segment.kind === 'fence' || segment.kind === 'gate') &&
    segment.leftTermination !== undefined &&
    segment.rightTermination !== undefined
  );
}

/** True when every segment in every run already carries the V4 shape. */
export function isV4Payload(payload: CanonicalPayload): boolean {
  return payload.runs.every((run) => run.segments.every(segmentIsV4));
}

// ---------------------------------------------------------------------------
// Termination mapping
// ---------------------------------------------------------------------------

/** Clamp a corner angle into the range the engine schema accepts ((0, 179]). */
function clampCornerAngle(angleDeg: number | undefined): number {
  if (
    angleDeg === undefined ||
    !Number.isFinite(angleDeg) ||
    angleDeg <= 0
  ) {
    return 90;
  }
  return Math.min(179, Math.round(angleDeg));
}

function legacyBoundaryToTermination(
  type: LegacyBoundaryType,
  cornerAngleDeg?: number,
): SegmentTermination {
  switch (type) {
    case 'wall':
      return { kind: 'non_system', subtype: 'wall' };
    case 'brick_post':
    case 'existing_post':
      return { kind: 'non_system', subtype: 'post' };
    case 'corner_90':
      return { kind: 'system_corner', angleDeg: clampCornerAngle(cornerAngleDeg) };
    case 'product_post':
    default:
      return { kind: 'system' };
  }
}

/**
 * Termination for an outer end of a run (first segment's left / last
 * segment's right). Segment-level termination variables (set by the canvas for
 * drawn wall/pillar attachments) take precedence over the run boundary.
 */
function endpointTermination(
  side: 'left' | 'right',
  segment: CanonicalSegment,
  runBoundary: CanonicalBoundary | undefined,
): SegmentTermination {
  const legacy = effectiveLegacyBoundaryType(
    runBoundary?.type ?? 'product_post',
    segment.variables,
    side,
  );
  return legacyBoundaryToTermination(legacy, cornerDegreesFromVars(segment.variables, side));
}

/**
 * Angle for a corners[] entry. '90' / '135' are explicit; 'custom' corners
 * fall back to the measured degrees the canvas adapter stores on the left
 * segment's variables, and finally to 90 when nothing is stored.
 */
function cornerEntryAngleDeg(
  cornerType: '90' | '135' | 'custom',
  leftSegment: CanonicalSegment,
): number {
  if (cornerType === '90') return 90;
  if (cornerType === '135') return 135;
  const stored =
    cornerDegreesFromVars(leftSegment.variables, 'right') ??
    (() => {
      const raw = leftSegment.variables?.right_corner_measured_degrees;
      const n = typeof raw === 'number' ? raw : Number(raw);
      return Number.isFinite(n) ? n : undefined;
    })();
  return clampCornerAngle(stored);
}

// ---------------------------------------------------------------------------
// Segment mapping
// ---------------------------------------------------------------------------

function isGateSegment(segment: CanonicalSegment): boolean {
  return segment.segmentKind === 'gate_opening' || segment.kind === 'gate';
}

/** Resolve the fence segment width, expanding bay groups when needed. */
function fenceSegmentWidthMm(segment: CanonicalSegment): number | undefined {
  if (segment.segmentWidthMm !== undefined && segment.segmentWidthMm > 0) {
    return Math.round(segment.segmentWidthMm);
  }
  if (segment.segmentKind === 'bay_group' && segment.bayCount) {
    // Some V3 producers put panelWidthMm directly on the segment (not in the
    // typed shape); others store panel_width_mm in variables.
    const loose = (segment as { panelWidthMm?: unknown }).panelWidthMm;
    const raw = loose ?? segment.variables?.panel_width_mm;
    const panelWidthMm = typeof raw === 'number' ? raw : Number(raw);
    if (Number.isFinite(panelWidthMm) && panelWidthMm > 0) {
      return Math.round(segment.bayCount * panelWidthMm);
    }
  }
  return segment.segmentWidthMm;
}

/**
 * Angle carried by a `segmentKind: 'corner'` marker segment. These segments
 * describe a corner fitting between their neighbours and never become V4
 * segments — their angle folds into the adjacent terminations.
 */
function cornerMarkerAngleDeg(segment: CanonicalSegment): number {
  const candidates = [
    cornerDegreesFromVars(segment.variables, 'right'),
    cornerDegreesFromVars(segment.variables, 'left'),
    (() => {
      const raw = segment.variables?.corner_degrees;
      const n = typeof raw === 'number' ? raw : Number(raw);
      return Number.isFinite(n) ? n : undefined;
    })(),
  ];
  return clampCornerAngle(candidates.find((v) => v !== undefined));
}

// ---------------------------------------------------------------------------
// Run translation
// ---------------------------------------------------------------------------

function translateRun(run: CanonicalRun, payload: CanonicalPayload): CanonicalRun {
  const sorted = [...run.segments].sort((a, b) => a.sortOrder - b.sortOrder);

  // corners[] entries keyed by the segment they come AFTER.
  const cornerAfterSegmentId = new Map(
    (run.corners ?? []).map((corner) => [corner.afterSegmentId, corner] as const),
  );

  // Fold `segmentKind: 'corner'` marker segments into terminations — they
  // describe a corner fitting between their neighbours and must NOT be
  // emitted as V4 segments.
  const kept: CanonicalSegment[] = [];
  const markerCornerAngleAfterId = new Map<string, number>();
  let leadingCornerAngle: number | undefined;
  for (const segment of sorted) {
    if (segment.segmentKind === 'corner') {
      const angleDeg = cornerMarkerAngleDeg(segment);
      const prevKept = kept[kept.length - 1];
      if (prevKept) markerCornerAngleAfterId.set(prevKept.segmentId, angleDeg);
      else leadingCornerAngle = angleDeg;
      continue;
    }
    kept.push(segment);
  }

  const runTargetHeightRaw =
    run.variables?.target_height_mm ?? payload.variables?.target_height_mm;
  const runTargetHeightMm = (() => {
    const n =
      typeof runTargetHeightRaw === 'number'
        ? runTargetHeightRaw
        : Number(runTargetHeightRaw);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  })();

  /** system_corner angle at the junction AFTER `leftSegment`, if any. */
  const junctionCornerAngle = (leftSegment: CanonicalSegment): number | undefined => {
    const marker = markerCornerAngleAfterId.get(leftSegment.segmentId);
    if (marker !== undefined) return marker;
    const corner = cornerAfterSegmentId.get(leftSegment.segmentId);
    return corner ? cornerEntryAngleDeg(corner.type, leftSegment) : undefined;
  };

  const translated = kept.map((segment, index) => {
    const isFirst = index === 0;
    const isLast = index === kept.length - 1;
    const prev = index > 0 ? kept[index - 1] : undefined;

    // Left termination
    let leftTermination: SegmentTermination;
    if (isFirst) {
      leftTermination =
        leadingCornerAngle !== undefined
          ? { kind: 'system_corner', angleDeg: leadingCornerAngle }
          : endpointTermination('left', segment, run.leftBoundary);
    } else {
      const angleDeg = prev ? junctionCornerAngle(prev) : undefined;
      leftTermination =
        angleDeg !== undefined
          ? { kind: 'system_corner', angleDeg }
          : { kind: 'segment_join' };
    }

    // Right termination
    let rightTermination: SegmentTermination;
    const trailingAngle = isLast ? markerCornerAngleAfterId.get(segment.segmentId) : undefined;
    if (isLast) {
      rightTermination =
        trailingAngle !== undefined
          ? { kind: 'system_corner', angleDeg: trailingAngle }
          : endpointTermination('right', segment, run.rightBoundary);
    } else {
      const angleDeg = junctionCornerAngle(segment);
      rightTermination =
        angleDeg !== undefined
          ? { kind: 'system_corner', angleDeg }
          : { kind: 'segment_join' };
    }

    if (isGateSegment(segment)) {
      return {
        ...segment,
        kind: 'gate' as const,
        productCode:
          segment.gateProductCode ?? segment.productCode ?? DEFAULT_GATE_PRODUCT_CODE,
        confirmed: true,
        leftTermination,
        rightTermination,
      };
    }

    return {
      ...segment,
      kind: 'fence' as const,
      productCode: segment.productCode ?? run.productCode,
      confirmed: true,
      segmentWidthMm: fenceSegmentWidthMm(segment),
      targetHeightMm: segment.targetHeightMm ?? runTargetHeightMm,
      leftTermination,
      rightTermination,
    };
  });

  return { ...run, segments: translated };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Translate a V3-shaped canonical payload into the V4 segment shape consumed
 * by the bom-calculator edge function. Payloads that are already fully V4 are
 * returned unchanged (same reference).
 */
export function translateCanonicalV3toV4(payload: CanonicalPayload): CanonicalPayload {
  if (isV4Payload(payload)) return payload;
  return {
    ...payload,
    runs: payload.runs.map((run) => translateRun(run, payload)),
  };
}
