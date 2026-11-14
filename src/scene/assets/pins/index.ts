import * as THREE from 'three';
import type { ComponentDefinition, PinDefinition, Vector3D } from '../../../domain/project/types';
import { cachedGeometry } from '../cache';
import { Materials } from '../materials';
import { mm } from '../units';

/**
 * Pin declaration standard of the asset library.
 *
 * SINGLE SOURCE OF TRUTH: a pin's id, name and anchor position come from the domain
 * `ComponentDefinition.pins` (domain/components/definitions.ts), the same data that wiring, the
 * MNA solver, DRC and AI proposal validation use. A model spec never repeats or moves an anchor:
 * it only adds VISUAL information per pin id (`PinVisualSpec`). Hit targets, pin markers and the
 * leads drawn by the builders all read the position from `resolvePins`.
 */

export type PinRole = 'power' | 'ground' | 'signal' | 'analog' | 'passive';

export interface PinVisualSpec {
  /** Electrical role shown by the marker / tooltip. Defaults to the role derived from the definition. */
  role?: PinRole;
  /** Which way the lead leaves the body (documentation + future lead builders). */
  direction?: 'down' | 'up' | 'side';
  /** Radius (mm) of the pointer hit target. Values below the default are raised to it. */
  touchRadius?: number;
}

export interface ResolvedPin {
  id: string;
  name: string;
  designator?: string;
  role: PinRole;
  direction: 'down' | 'up' | 'side';
  /** Anchor in mm, relative to the component origin. Straight from the domain definition. */
  position: Vector3D;
  touchRadius: number;
}

/** Hit target of the previous (legacy) models. New models must never be harder to touch than this. */
export const MIN_TOUCH_RADIUS_MM = 1.15;
export const TOUCH_HEIGHT_MM = 3.5;

export function pinRole(pin: PinDefinition): PinRole {
  const id = pin.id.toLowerCase();
  if (pin.type === 'ground' || id.includes('gnd') || id === 'cathode' || id.includes('neg')) return 'ground';
  if (pin.type === 'power' || id === 'vcc' || id === 'anode' || id.includes('pos') || id.includes('5v') || id.includes('3v3') || id.includes('vin')) {
    return 'power';
  }
  if (id === 'wiper' || /^pin_a\d$/.test(id) || /^a\d$/.test(id)) return 'analog';
  if (pin.type === 'input' || pin.type === 'output' || pin.type === 'bidirectional') return 'signal';
  return 'passive';
}

export function resolvePins(definition: ComponentDefinition, visuals: Record<string, PinVisualSpec> = {}): ResolvedPin[] {
  return definition.pins.map((pin) => {
    const visual = visuals[pin.id] ?? {};
    return {
      id: pin.id,
      name: pin.name,
      designator: pin.designator,
      role: visual.role ?? pinRole(pin),
      direction: visual.direction ?? 'down',
      position: { ...pin.localOffset },
      touchRadius: Math.max(MIN_TOUCH_RADIUS_MM, visual.touchRadius ?? MIN_TOUCH_RADIUS_MM),
    };
  });
}

/**
 * Invisible pointer target of one pin. Same object layout, names and userData as the legacy models
 * (`pin-<component>-<pin>` group at the anchor's x/z with the collider at the anchor's height), so
 * the existing picking code in ThreeScene works unchanged.
 */
export function createPinTarget(componentId: string, pin: ResolvedPin): THREE.Group {
  const target = new THREE.Group();
  target.name = `pin-${componentId}-${pin.id}`;
  target.position.set(mm(pin.position.x), 0, mm(pin.position.z));
  const userData = {
    type: 'pin',
    componentId,
    pinId: pin.id,
    name: pin.name,
    designator: pin.designator,
    role: pin.role,
    isPin: true,
    localOffset: { ...pin.position },
  };
  target.userData = userData;

  const radius = mm(pin.touchRadius);
  const geometry = cachedGeometry(`pin-hit|${radius.toFixed(3)}`, () => new THREE.CylinderGeometry(radius, radius, mm(TOUCH_HEIGHT_MM), 8));
  const hit = new THREE.Mesh(geometry, Materials.hitTarget());
  hit.position.set(0, mm(pin.position.y), 0);
  hit.userData = userData;
  target.add(hit);
  return target;
}
