import type * as THREE from 'three';
import { Materials } from '../materials';
import { cylinder, group, lathe, leadBent, part } from '../primitives';
import type { Builder } from '../specs/types';
import { LEAD_DEPTH_MM } from '../units';

/**
 * Axial through-hole part lying along the line between its two pins: resistor, diode, ...
 * The body sits centred between the pins; both leads bend down into the pin anchors.
 */
export interface AxialBand {
  hex: number;
  metallic?: boolean;
  /** Centre of the band along the body, mm from the body centre (towards pin B is positive). */
  offset: number;
  width: number;
}

export interface AxialParams {
  pinA: string;
  pinB: string;
  bodyLength: number;
  bodyDiameter: number;
  leadDiameter: number;
  /** Clearance between the board and the underside of the body. */
  standoff: number;
  /** 'dogbone': end caps wider than the waist (film resistors). 'cylinder': straight body (diodes). */
  shape: 'dogbone' | 'cylinder';
  bodyMaterial: THREE.Material;
  bands: AxialBand[];
}

export const buildAxial: Builder<AxialParams> = (ctx, p) => {
  const a = ctx.pin(p.pinA);
  const b = ctx.pin(p.pinB);
  const span = Math.hypot(b.x - a.x, b.z - a.z);
  const angle = Math.atan2(-(b.z - a.z), b.x - a.x);
  const R = p.bodyDiameter / 2;
  const half = p.bodyLength / 2;
  const bodyY = p.standoff + R;
  const cap = p.bodyLength * 0.24;
  const waist = p.shape === 'dogbone' ? R * 0.84 : R;

  // Local frame: origin on the board midway between the pins, +x towards pin B
  const holder = group(ctx.group, { at: [(a.x + b.x) / 2, 0, (a.z + b.z) / 2], rot: [0, angle, 0] });

  const profile: Array<[number, number]> =
    p.shape === 'dogbone'
      ? [
          [0, -half],
          [R * 0.6, -half],
          [R * 0.92, -half + R * 0.18],
          [R, -half + R * 0.5],
          [R, -half + cap - R * 0.2],
          [waist, -half + cap + R * 0.25],
          [waist, half - cap - R * 0.25],
          [R, half - cap + R * 0.2],
          [R, half - R * 0.5],
          [R * 0.92, half - R * 0.18],
          [R * 0.6, half],
          [0, half],
        ]
      : [
          [0, -half],
          [R * 0.86, -half],
          [R, -half + R * 0.14],
          [R, half - R * 0.14],
          [R * 0.86, half],
          [0, half],
        ];

  // The lathe axis is Y: rotating by -90° about Z lays it along +x
  part(holder, lathe(`axial-${p.shape}-${p.bodyLength}-${p.bodyDiameter}`, profile, ctx.detail), p.bodyMaterial, {
    at: [0, bodyY, 0],
    rot: [0, 0, -Math.PI / 2],
  });

  for (const band of p.bands) {
    const onCap = Math.abs(band.offset) > half - cap;
    const r = (onCap ? R : waist) + 0.035;
    part(
      holder,
      cylinder(r, r, band.width, ctx.detail, { open: true }),
      band.metallic ? Materials.metallicPaint(band.hex) : Materials.paint(band.hex),
      { at: [band.offset, bodyY, 0], rot: [0, 0, -Math.PI / 2], castShadow: false }
    );
  }

  const run = span / 2 - half + 0.15; // distance from a pin to the body end
  const lead = leadBent(run, bodyY, LEAD_DEPTH_MM + 1.3, p.leadDiameter / 2, ctx.detail);
  part(holder, lead, Materials.tin(), { at: [-span / 2, 0, 0] });
  part(holder, lead, Materials.tin(), { at: [span / 2, 0, 0], rot: [0, Math.PI, 0] });
};
