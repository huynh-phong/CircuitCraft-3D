import { ComponentDefinition, ComponentInstance, Vector3D, DerivedPinWorldPosition } from './types';

/**
 * Derives the world coordinate of a pin in millimeters on the board.
 * Board Plane:
 *  - X: Width [-boardWidth/2, +boardWidth/2]
 *  - Z: Depth [-boardDepth/2, +boardDepth/2]
 *  - Y: Height above board surface (Y = 0 is top plane of PCB)
 * Rotation is around Y-axis (vertical) in degrees.
 */
export function calculatePinWorldPosition(
  instance: ComponentInstance,
  pinLocalOffset: Vector3D
): Vector3D {
  const rad = (instance.rotation.y * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  // Rotate local offset around Y axis
  const rotatedX = pinLocalOffset.x * cos - pinLocalOffset.z * sin;
  const rotatedZ = pinLocalOffset.x * sin + pinLocalOffset.z * cos;
  const rotatedY = pinLocalOffset.y;

  return {
    x: Number((instance.position.x + rotatedX).toFixed(3)),
    y: Number((instance.position.y + rotatedY).toFixed(3)),
    z: Number((instance.position.z + rotatedZ).toFixed(3)),
  };
}

/**
 * Computes all pin world positions for the entire project document
 */
export function deriveAllPinPositions(
  instances: ComponentInstance[],
  definitionMap: Map<string, ComponentDefinition>
): DerivedPinWorldPosition[] {
  const results: DerivedPinWorldPosition[] = [];

  for (const inst of instances) {
    const def = definitionMap.get(inst.definitionId);
    if (!def) continue;

    for (const pin of def.pins) {
      results.push({
        componentId: inst.instanceId,
        pinId: pin.id,
        worldPosition: calculatePinWorldPosition(inst, pin.localOffset),
      });
    }
  }

  return results;
}

/**
 * Snaps a coordinate in mm to the standard PCB pitch grid (default 2.54mm)
 */
export function snapToGrid(val: number, step = 2.54): number {
  return Number((Math.round(val / step) * step).toFixed(3));
}

/**
 * Checks if component position is within board limits
 */
export function isInsideBoard(
  pos: Vector3D,
  boardWidth: number,
  boardDepth: number,
  margin = 2
): boolean {
  const halfW = boardWidth / 2 - margin;
  const halfD = boardDepth / 2 - margin;
  return pos.x >= -halfW && pos.x <= halfW && pos.z >= -halfD && pos.z <= halfD;
}
