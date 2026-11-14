import type * as THREE from 'three';
import { Materials } from '../materials';
import { box, cylinder, disc, part, ring } from '../primitives';
import type { Builder } from '../specs/types';
import { pinCentre, straightLeads } from './common';

/**
 * Upright cylindrical two-lead part: electrolytic capacitor (sleeve, vent, negative stripe) or
 * buzzer (sound port, "+" mark). The can is centred between the two pins.
 */
export interface RadialCanParams {
  diameter: number;
  height: number;
  standoff: number;
  bodyMaterial: THREE.Material;
  topMaterial: THREE.Material;
  /** Light stripe down the side, facing this pin (capacitor negative side). */
  stripe?: { pin: string; hex: number };
  /** Pressure vent cross on the top (capacitor). */
  vent?: boolean;
  /** Radius of the sound port in the top (buzzer). */
  port?: number;
  /** A "+" mark on the top, next to this pin (buzzer). */
  plusPin?: string;
  /** Sound waves, shown only while the solver reports the part as on. */
  sounding?: boolean;
}

export const buildRadialCan: Builder<RadialCanParams> = (ctx, p) => {
  const d = ctx.detail;
  const g = ctx.group;
  const c = pinCentre(ctx.pins);
  const R = p.diameter / 2;
  const top = p.standoff + p.height;
  const dark = Materials.flat(0x0b0d11);

  part(g, cylinder(R, R, p.height, d), p.bodyMaterial, { at: [c.x, p.standoff + p.height / 2, c.z] });
  part(g, disc(R * 0.93, d), p.topMaterial, { at: [c.x, top + 0.02, c.z], castShadow: false });
  part(g, cylinder(R * 0.9, R * 0.9, 0.5, d), Materials.rubber(0x15171b), { at: [c.x, p.standoff - 0.2, c.z], castShadow: false });

  if (p.stripe) {
    const pin = ctx.pin(p.stripe.pin);
    const facing = Math.atan2(pin.x - c.x, pin.z - c.z);
    const width = 0.95;
    part(
      g,
      cylinder(R + 0.04, R + 0.04, p.height * 0.94, d, { open: true, thetaStart: -width / 2, thetaLength: width }),
      Materials.paint(p.stripe.hex, 0.5),
      { at: [c.x, p.standoff + p.height / 2, c.z], rot: [0, facing, 0], castShadow: false }
    );
    if (d !== 'low') {
      // Minus marks printed on the stripe
      for (const k of [-0.28, 0, 0.28]) {
        part(g, box(0.5, p.height * 0.1, 0.06), Materials.flat(0x1f2937), {
          at: [c.x + Math.sin(facing) * (R + 0.07), p.standoff + p.height * (0.5 + k), c.z + Math.cos(facing) * (R + 0.07)],
          rot: [0, facing, Math.PI / 2],
          castShadow: false,
        });
      }
    }
  }
  if (p.vent && d !== 'low') {
    part(g, box(R * 1.5, 0.05, 0.14), dark, { at: [c.x, top + 0.04, c.z], castShadow: false });
    part(g, box(0.14, 0.05, R * 1.5), dark, { at: [c.x, top + 0.04, c.z], castShadow: false });
  }
  if (p.port) part(g, disc(p.port, d), dark, { at: [c.x, top + 0.04, c.z], castShadow: false });
  if (p.plusPin) {
    const pin = ctx.pin(p.plusPin);
    const k = 0.62;
    const mark = Materials.flat(0xf8fafc);
    const at: [number, number, number] = [c.x + (pin.x - c.x) * k * (R / Math.max(0.1, Math.hypot(pin.x - c.x, pin.z - c.z))), top + 0.05, c.z];
    part(g, box(1.6, 0.05, 0.36), mark, { at, castShadow: false });
    part(g, box(0.36, 0.05, 1.6), mark, { at, castShadow: false });
  }
  if (p.sounding) {
    for (const [r, y] of [[R * 0.55, 1.6], [R * 0.85, 3.2]] as const) {
      part(g, ring(r, r + 0.5, d), Materials.halo(0x38bdf8, 14), { at: [c.x, top + y, c.z], name: 'sim-glow', dynamic: true, castShadow: false });
    }
  }

  straightLeads(ctx, p.standoff);
};
