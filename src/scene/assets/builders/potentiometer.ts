import { Materials } from '../materials';
import { box, cylinder, group, knurled, lathe, leadFlat, part, thread } from '../primitives';
import type { Builder } from '../specs/types';
import { LEAD_DEPTH_MM } from '../units';

/**
 * Rotary potentiometer: plastic base, round metal can, threaded bushing, knurled shaft with an
 * indicator line, and one solder tab per pin. The shaft is turned to the current wiper position.
 */
export interface PotentiometerParams {
  bodyDiameter: number;
  baseHeight: number;
  canHeight: number;
  bushingDiameter: number;
  bushingHeight: number;
  shaftDiameter: number;
  shaftHeight: number;
  /** Mechanical rotation between the end stops, degrees. */
  sweepDeg: number;
  /** Wiper position 0..1 (0 = fully counter-clockwise). */
  position: number;
  baseHex: number;
}

export const buildPotentiometer: Builder<PotentiometerParams> = (ctx, p) => {
  const d = ctx.detail;
  const g = ctx.group;
  const R = p.bodyDiameter / 2;
  // The anchors sit on the tabs just under the base
  const baseBottom = Math.max(...ctx.pins.map((pin) => pin.position.y)) + 0.6;
  const canBottom = baseBottom + p.baseHeight;
  const canTop = canBottom + p.canHeight;
  const bushingTop = canTop + p.bushingHeight;

  part(g, cylinder(R, R, p.baseHeight, d), Materials.plastic(p.baseHex, 0.6), { at: [0, baseBottom + p.baseHeight / 2, 0] });
  part(
    g,
    lathe(
      `pot-can-${p.bodyDiameter}-${p.canHeight}`,
      [[R * 0.97, 0], [R * 0.97, p.canHeight - 0.5], [R * 0.86, p.canHeight], [0, p.canHeight]],
      d
    ),
    Materials.steel(),
    { at: [0, canBottom, 0] }
  );
  part(g, thread(p.bushingDiameter / 2, p.bushingHeight, 0.5, d), Materials.brass(), { at: [0, canTop + p.bushingHeight / 2, 0], castShadow: false });
  // Hex nut seated on the can
  part(g, cylinder(p.bushingDiameter / 2 + 1.1, p.bushingDiameter / 2 + 1.1, 0.7, 'low', { radialFactor: 0.75 }), Materials.steel(), {
    at: [0, canTop + 0.35, 0],
    castShadow: false,
  });

  // Shaft: clockwise as the position increases, centred at mid travel
  const angle = -((Math.min(1, Math.max(0, p.position)) - 0.5) * p.sweepDeg * Math.PI) / 180;
  const shaft = group(g, { at: [0, bushingTop, 0], rot: [0, angle, 0] });
  const sr = p.shaftDiameter / 2;
  part(shaft, knurled(sr, p.shaftHeight, 18, d), Materials.plastic(0x2a2f38, 0.5), {});
  part(shaft, cylinder(sr * 0.8, sr * 0.92, 0.3, d), Materials.plastic(0x2a2f38, 0.5), { at: [0, p.shaftHeight + 0.15, 0], castShadow: false });
  // Indicator line, pointing to -z at mid travel
  part(shaft, box(0.55, 0.08, sr * 0.9), Materials.flat(0xf8fafc), { at: [0, p.shaftHeight + 0.33, -sr * 0.42], castShadow: false });
  part(shaft, box(0.4, p.shaftHeight * 0.55, 0.12), Materials.flat(0xf8fafc), { at: [0, p.shaftHeight * 0.7, -sr - 0.01], castShadow: false });

  for (const pin of ctx.pins) {
    // Tabs face the shaft axis
    part(g, leadFlat(baseBottom, LEAD_DEPTH_MM, 1.2, 0.35), Materials.tin(), {
      at: [pin.position.x, 0, pin.position.z],
      rot: [0, Math.atan2(pin.position.x, pin.position.z), 0],
      castShadow: false,
    });
  }
};
