/**
 * CircuitCraft 3D - Board Geometry Engine
 * Handles polygon representations, perimeter snapping, cutting path splitting,
 * and point-in-polygon verification for custom boards and cut operations.
 */

import { BoardDefinition, ComponentInstance, Vector3D } from './types';

export interface Point2D {
  x: number;
  z: number;
}

/**
 * Computes the polygon perimeter vertices (in mm on the X-Z board plane)
 */
export function getBoardPerimeter(board: BoardDefinition): Point2D[] {
  if (board.shape === 'polygon' && board.outline && board.outline.length >= 3) {
    return board.outline.map((p) => ({ x: p.x, z: p.z }));
  }

  const w = Math.max(20, board.width);
  const d = Math.max(20, board.depth);
  const hw = w / 2;
  const hd = d / 2;

  if (board.shape === 'square') {
    const s = Math.max(20, w);
    const hs = s / 2;
    return [
      { x: -hs, z: -hs },
      { x: hs, z: -hs },
      { x: hs, z: hs },
      { x: -hs, z: hs },
    ];
  }

  if (board.shape === 'circle') {
    const radius = board.radius || hw;
    const segments = 36;
    const pts: Point2D[] = [];
    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      pts.push({
        x: Math.cos(angle) * radius,
        z: Math.sin(angle) * radius,
      });
    }
    return pts;
  }

  if (board.shape === 'triangle') {
    return [
      { x: 0, z: -hd },
      { x: hw, z: hd },
      { x: -hw, z: hd },
    ];
  }

  // Default: Rectangle
  return [
    { x: -hw, z: -hd },
    { x: hw, z: -hd },
    { x: hw, z: hd },
    { x: -hw, z: hd },
  ];
}

/**
 * Checks if a 2D point is inside the given board geometry
 */
export function isPointInsideBoard(point: Point2D, board: BoardDefinition): boolean {
  if (board.shape === 'polygon' && board.outline && board.outline.length >= 3) {
    return isPointInPolygon(point, board.outline);
  }

  const hw = Math.max(20, board.width) / 2;
  const hd = Math.max(20, board.depth) / 2;

  if (board.shape === 'circle') {
    const r = board.radius || Math.min(hw, hd);
    return Math.abs(point.x) <= r && Math.abs(point.z) <= r;
  }

  if (board.shape === 'square') {
    const hs = Math.max(hw, hd);
    return Math.abs(point.x) <= hs && Math.abs(point.z) <= hs;
  }

  // Default: Rectangle
  return Math.abs(point.x) <= hw && Math.abs(point.z) <= hd;
}

/**
 * Ray-casting algorithm to test if a 2D point is inside a closed polygon
 */
export function isPointInPolygon(point: Point2D, polygon: Point2D[]): boolean {
  let inside = false;
  const n = polygon.length;
  if (n < 3) return false;

  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i].x;
    const zi = polygon[i].z;
    const xj = polygon[j].x;
    const zj = polygon[j].z;

    const intersect =
      zi > point.z !== zj > point.z &&
      point.x < ((xj - xi) * (point.z - zi)) / (zj - zi + 1e-9) + xi;

    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Calculates signed polygon area using the Shoelace formula
 */
export function calculatePolygonArea(polygon: Point2D[]): number {
  let area = 0;
  const n = polygon.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += polygon[i].x * polygon[j].z;
    area -= polygon[j].x * polygon[i].z;
  }
  return Math.abs(area / 2);
}

/**
 * Finds the closest point on any segment of a polygon perimeter
 */
export function getClosestPointOnPerimeter(
  point: Point2D,
  perimeter: Point2D[]
): { point: Point2D; segmentIndex: number; distance: number; t: number } {
  let minDistance = Infinity;
  let bestPoint = { x: point.x, z: point.z };
  let bestSegIndex = 0;
  let bestT = 0;

  const n = perimeter.length;
  for (let i = 0; i < n; i++) {
    const p1 = perimeter[i];
    const p2 = perimeter[(i + 1) % n];

    const dx = p2.x - p1.x;
    const dz = p2.z - p1.z;
    const lenSq = dx * dx + dz * dz;

    if (lenSq < 1e-6) continue;

    let t = ((point.x - p1.x) * dx + (point.z - p1.z) * dz) / lenSq;
    t = Math.max(0, Math.min(1, t));

    const projX = p1.x + t * dx;
    const projZ = p1.z + t * dz;
    const dist = Math.hypot(point.x - projX, point.z - projZ);

    if (dist < minDistance) {
      minDistance = dist;
      bestPoint = { x: projX, z: projZ };
      bestSegIndex = i;
      bestT = t;
    }
  }

  return { point: bestPoint, segmentIndex: bestSegIndex, distance: minDistance, t: bestT };
}

/**
 * Splits a closed polygon into two valid closed polygons given a cut path
 * that starts and ends on the perimeter.
 */
export function splitPolygonByCutPath(
  perimeter: Point2D[],
  cutPath: Point2D[]
): { regionA: Point2D[]; regionB: Point2D[] } | null {
  if (perimeter.length < 3 || cutPath.length < 2) return null;

  const startPt = cutPath[0];
  const endPt = cutPath[cutPath.length - 1];

  const snapStart = getClosestPointOnPerimeter(startPt, perimeter);
  const snapEnd = getClosestPointOnPerimeter(endPt, perimeter);

  const startOnEdge = snapStart.point;
  const endOnEdge = snapEnd.point;

  const intermediate = cutPath.slice(1, -1);

  const n = perimeter.length;
  const idxA = snapStart.segmentIndex;
  const idxB = snapEnd.segmentIndex;

  // Build Cycle 1: startOnEdge -> intermediate -> endOnEdge -> perimeter traversal back to start
  const cycle1: Point2D[] = [startOnEdge, ...intermediate, endOnEdge];
  let curr = (idxB + 1) % n;
  while (curr !== (idxA + 1) % n) {
    cycle1.push({ ...perimeter[curr] });
    curr = (curr + 1) % n;
  }

  // Build Cycle 2: endOnEdge -> reversed intermediate -> startOnEdge -> perimeter traversal back to end
  const revIntermediate = [...intermediate].reverse();
  const cycle2: Point2D[] = [endOnEdge, ...revIntermediate, startOnEdge];
  curr = (idxA + 1) % n;
  while (curr !== (idxB + 1) % n) {
    cycle2.push({ ...perimeter[curr] });
    curr = (curr + 1) % n;
  }

  // Sanitize: filter duplicates or very close vertices (< 0.2mm)
  const sanitize = (poly: Point2D[]): Point2D[] => {
    const res: Point2D[] = [];
    for (let i = 0; i < poly.length; i++) {
      const prev = res[res.length - 1];
      if (!prev || Math.hypot(poly[i].x - prev.x, poly[i].z - prev.z) > 0.2) {
        res.push(poly[i]);
      }
    }
    if (res.length > 2 && Math.hypot(res[0].x - res[res.length - 1].x, res[0].z - res[res.length - 1].z) < 0.2) {
      res.pop();
    }
    return res;
  };

  const cleanA = sanitize(cycle1);
  const cleanB = sanitize(cycle2);

  if (cleanA.length < 3 || cleanB.length < 3) return null;

  return { regionA: cleanA, regionB: cleanB };
}

/**
 * Splits a polygon by a cutting line, keeping the primary portion containing the origin
 */
export function splitPolygonByCuttingLine(
  polygon: Point2D[],
  cutLine: Point2D[]
): { kept: Point2D[]; discarded: Point2D[]; regionA: Point2D[]; regionB: Point2D[] } | null {
  const res = splitPolygonByCutPath(polygon, cutLine);
  if (!res) return null;

  const keepsOriginA = isPointInPolygon({ x: 0, z: 0 }, res.regionA);
  const keepsOriginB = isPointInPolygon({ x: 0, z: 0 }, res.regionB);

  let kept = res.regionA;
  let discarded = res.regionB;

  if (keepsOriginB && !keepsOriginA) {
    kept = res.regionB;
    discarded = res.regionA;
  } else if (keepsOriginA === keepsOriginB) {
    if (calculatePolygonArea(res.regionB) > calculatePolygonArea(res.regionA)) {
      kept = res.regionB;
      discarded = res.regionA;
    }
  }

  return {
    kept,
    discarded,
    regionA: res.regionA,
    regionB: res.regionB,
  };
}

/**
 * Finds all components located within a candidate polygon
 */
export function findComponentsInPolygon(
  components: ComponentInstance[],
  polygon: Point2D[]
): ComponentInstance[] {
  return components.filter((comp) => {
    const pt: Point2D = { x: comp.position.x, z: comp.position.z };
    return isPointInPolygon(pt, polygon);
  });
}

/**
 * Checks if all components are inside a given polygon or board definition
 */
export function areAllComponentsContained(
  components: ComponentInstance[],
  boardOrPolygon: BoardDefinition | Point2D[],
  margin = 3
): {
  allContained: boolean;
  ok: boolean;
  outsideCount: number;
  outsideComponents: ComponentInstance[];
  outsideComponentIds: string[];
} {
  const outsideComponents: ComponentInstance[] = [];
  const outsideComponentIds: string[] = [];

  for (const comp of components) {
    const pt: Point2D = { x: comp.position.x, z: comp.position.z };
    const isInside = Array.isArray(boardOrPolygon)
      ? isPointInPolygon(pt, boardOrPolygon)
      : isPointInsideBoard(pt, boardOrPolygon);

    if (!isInside) {
      outsideComponents.push(comp);
      outsideComponentIds.push(comp.instanceId || (comp as any).id);
    }
  }

  const allContained = outsideComponents.length === 0;
  return {
    allContained,
    ok: allContained,
    outsideCount: outsideComponents.length,
    outsideComponents,
    outsideComponentIds,
  };
}
