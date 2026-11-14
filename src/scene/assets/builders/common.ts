import type * as THREE from 'three';
import { Materials } from '../materials';
import type { ResolvedPin } from '../pins';
import { cable, leadFlat, leadRound, part } from '../primitives';
import type { BuildContext } from '../specs/types';
import { LEAD_DEPTH_MM } from '../units';

/** Rotations of an up-facing plane (labels, discs) onto the vertical faces of a part. */
export const FACE_FRONT: [number, number, number] = [Math.PI / 2, 0, 0]; // faces +z
export const FACE_BACK: [number, number, number] = [-Math.PI / 2, Math.PI, 0]; // faces -z
/** A +Y axis (cylinder, spring) laid along +X. */
export const ALONG_X: [number, number, number] = [0, 0, -Math.PI / 2];
/** A +Y axis laid along +Z. */
export const ALONG_Z: [number, number, number] = [Math.PI / 2, 0, 0];

export interface LeadStyle {
  /** Flat stamped lead [width, thickness]; omit for a round wire. */
  flat?: [number, number];
  radius?: number;
  below?: number;
  material?: THREE.Material;
}

/** One straight lead per pin, from under the board up to `topY`, exactly on the pin anchor. */
export function straightLeads(ctx: BuildContext, topY: number, style: LeadStyle = {}, pins: ResolvedPin[] = ctx.pins): void {
  const below = style.below ?? LEAD_DEPTH_MM;
  const geometry = style.flat
    ? leadFlat(topY, below, style.flat[0], style.flat[1])
    : leadRound(topY, below, style.radius ?? 0.28, ctx.detail);
  for (const pin of pins) {
    part(ctx.group, geometry, style.material ?? Materials.tin(), { at: [pin.position.x, 0, pin.position.z], castShadow: false });
  }
}

/**
 * Formed lead: starts under the board on the pin anchor, rises to `kneeY`, then leans over to
 * `to` (where it enters the body). For parts whose body is narrower than their pin spacing.
 */
export function formedLead(
  ctx: BuildContext,
  id: string,
  pin: ResolvedPin,
  to: [number, number, number],
  kneeY: number,
  radius = 0.25,
  below = LEAD_DEPTH_MM
): void {
  const { x, z } = pin.position;
  part(
    ctx.group,
    cable(`formed-${id}`, [[x, -below, z], [x, kneeY * 0.5, z], [x, kneeY, z], [to[0], to[1], to[2]]], radius, ctx.detail, 0.15),
    Materials.tin(),
    { castShadow: false }
  );
}

/** Centre of the pins on the board plane. */
export function pinCentre(pins: ResolvedPin[]): { x: number; z: number } {
  const xs = pins.map((p) => p.position.x);
  const zs = pins.map((p) => p.position.z);
  return { x: (Math.min(...xs) + Math.max(...xs)) / 2, z: (Math.min(...zs) + Math.max(...zs)) / 2 };
}
