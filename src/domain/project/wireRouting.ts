/**
 * CircuitCraft 3D - Intelligent Orthogonal Wire Routing Engine
 * Generates Manhattan (90-degree bend) collision-free paths between pins,
 * navigating around component obstacles on the circuit board.
 */

import { Vector3D, ComponentInstance, Connection } from './types';
import { COMPONENT_DEFINITION_MAP } from '../components/definitions';

export interface BoundingBox2D {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  componentId: string;
}

/**
 * Computes 2D bounding boxes on the X-Z board plane for components with safety clearance
 */
export function getComponentObstacles(
  components: ComponentInstance[],
  excludeStartId?: string,
  excludeEndId?: string,
  clearance = 2.5
): BoundingBox2D[] {
  const obstacles: BoundingBox2D[] = [];

  for (const comp of components) {
    // Don't treat the connected source/target components as complete obstacles
    // (wires must be able to reach their pins)
    if (comp.instanceId === excludeStartId || comp.instanceId === excludeEndId) {
      continue;
    }

    const def = COMPONENT_DEFINITION_MAP.get(comp.definitionId);
    const halfX = def ? def.dimensions.x / 2 + clearance : 6 + clearance;
    const halfZ = def ? def.dimensions.z / 2 + clearance : 6 + clearance;

    obstacles.push({
      minX: comp.position.x - halfX,
      maxX: comp.position.x + halfX,
      minZ: comp.position.z - halfZ,
      maxZ: comp.position.z + halfZ,
      componentId: comp.instanceId,
    });
  }

  return obstacles;
}

/**
 * Checks if an orthogonal 2D line segment intersects any obstacle bounding box
 */
export function segmentIntersectsObstacles(
  p1: { x: number; z: number },
  p2: { x: number; z: number },
  obstacles: BoundingBox2D[]
): BoundingBox2D | null {
  const minX = Math.min(p1.x, p2.x);
  const maxX = Math.max(p1.x, p2.x);
  const minZ = Math.min(p1.z, p2.z);
  const maxZ = Math.max(p1.z, p2.z);

  for (const obs of obstacles) {
    if (maxX >= obs.minX && minX <= obs.maxX && maxZ >= obs.minZ && minZ <= obs.maxZ) {
      return obs;
    }
  }
  return null;
}

/**
 * Computes an intelligent orthogonal obstacle-avoidance route between two pins
 */
export function computeOrthogonalWireRoute(
  startPin: Vector3D,
  endPin: Vector3D,
  components: ComponentInstance[],
  startCompId: string,
  endCompId: string,
  customControlPoints?: Vector3D[]
): Vector3D[] {
  // If user defined manual bend points, respect them
  if (customControlPoints && customControlPoints.length > 0) {
    return [startPin, ...customControlPoints, endPin];
  }

  const traceY = Math.max(startPin.y, endPin.y) + 1.2;
  const obstacles = getComponentObstacles(components, startCompId, endCompId);

  const startPt = { x: startPin.x, z: startPin.z };
  const endPt = { x: endPin.x, z: endPin.z };

  // Candidate 1: L-path via (endPt.x, startPt.z)
  const mid1 = { x: endPt.x, z: startPt.z };
  const col1A = segmentIntersectsObstacles(startPt, mid1, obstacles);
  const col1B = segmentIntersectsObstacles(mid1, endPt, obstacles);

  // Candidate 2: L-path via (startPt.x, endPt.z)
  const mid2 = { x: startPt.x, z: endPt.z };
  const col2A = segmentIntersectsObstacles(startPt, mid2, obstacles);
  const col2B = segmentIntersectsObstacles(mid2, endPt, obstacles);

  const waypoints: Array<{ x: number; z: number }> = [];

  if (!col1A && !col1B) {
    waypoints.push(mid1);
  } else if (!col2A && !col2B) {
    waypoints.push(mid2);
  } else {
    // Both simple L-routes collided with an obstacle.
    // Try U-shaped detours around the obstacle (test minZ, maxZ, minX, maxX)
    const blocker = col1A || col1B || col2A || col2B!;
    const candidateDetours: Array<Array<{ x: number; z: number }>> = [
      // Detour Z min
      [
        { x: startPt.x, z: blocker.minZ - 3.5 },
        { x: endPt.x, z: blocker.minZ - 3.5 },
      ],
      // Detour Z max
      [
        { x: startPt.x, z: blocker.maxZ + 3.5 },
        { x: endPt.x, z: blocker.maxZ + 3.5 },
      ],
      // Detour X min
      [
        { x: blocker.minX - 3.5, z: startPt.z },
        { x: blocker.minX - 3.5, z: endPt.z },
      ],
      // Detour X max
      [
        { x: blocker.maxX + 3.5, z: startPt.z },
        { x: blocker.maxX + 3.5, z: endPt.z },
      ],
    ];

    let chosenDetour = candidateDetours[0];
    for (const cand of candidateDetours) {
      const s1 = segmentIntersectsObstacles(startPt, cand[0], obstacles);
      const s2 = segmentIntersectsObstacles(cand[0], cand[1], obstacles);
      const s3 = segmentIntersectsObstacles(cand[1], endPt, obstacles);
      if (!s1 && !s2 && !s3) {
        chosenDetour = cand;
        break;
      }
    }

    waypoints.push(...chosenDetour);
  }

  // Assemble full 3D point array: takeoff -> waypoints on trace plane -> landing
  const result: Vector3D[] = [];
  result.push(startPin);
  result.push({ x: startPin.x, y: traceY, z: startPin.z });

  for (const wp of waypoints) {
    result.push({ x: wp.x, y: traceY, z: wp.z });
  }

  result.push({ x: endPin.x, y: traceY, z: endPin.z });
  result.push(endPin);

  return result;
}
