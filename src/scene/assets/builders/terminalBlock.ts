import { Materials } from '../materials';
import { box, cylinder, extrude, leadFlat, part, slottedScrew } from '../primitives';
import type { Builder } from '../specs/types';
import { LEAD_DEPTH_MM } from '../units';

/**
 * PCB screw terminal block: one pole per pin, stepped plastic housing, slotted clamp screws on top
 * and a wire entry with its clamp on the front (+z) face.
 */
export interface TerminalBlockParams {
  pitch: number;
  depth: number;
  height: number;
  /** Height of the lower front step where the wires enter. */
  stepHeight: number;
  bodyHex: number;
}

export const buildTerminalBlock: Builder<TerminalBlockParams> = (ctx, p) => {
  const d = ctx.detail;
  const g = ctx.group;
  const xs = ctx.pins.map((pin) => pin.position.x);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cz = ctx.pins[0].position.z;
  const length = Math.max(...xs) - Math.min(...xs) + p.pitch;
  const hd = p.depth / 2;
  const stepZ = hd * 0.42; // the tall part ends here, the lower step continues to the front
  const screwZ = (-hd + stepZ) / 2;
  const body = Materials.plastic(p.bodyHex, 0.5);
  const dark = Materials.flat(0x0d1410);

  // Housing: side profile [z, y] extruded along x
  part(
    g,
    extrude(
      `tb-${p.depth}-${p.height}-${p.stepHeight}`,
      [[-hd, 0], [hd, 0], [hd, p.stepHeight], [stepZ, p.stepHeight], [stepZ, p.height], [-hd, p.height]],
      length,
      d,
      { axis: 'x', bevel: 0.18 }
    ),
    body,
    { at: [cx, 0, cz] }
  );

  ctx.pins.forEach((pin, i) => {
    const x = pin.position.x;
    // Clamp screw in its well
    part(g, cylinder(1.95, 1.95, 0.1, d), dark, { at: [x, p.height + 0.03, cz + screwZ], castShadow: false });
    slottedScrew(g, [x, p.height + 0.22, cz + screwZ], 1.6, d, Materials.steel(), dark, 0.4 + i * 0.9);
    // Wire entry with the clamp plate inside
    part(g, box(p.pitch * 0.62, p.stepHeight * 0.55, 0.12), dark, { at: [x, p.stepHeight * 0.48, cz + hd + 0.02], castShadow: false });
    part(g, box(p.pitch * 0.5, 0.45, 0.2), Materials.tin(), { at: [x, p.stepHeight * 0.28, cz + hd + 0.05], castShadow: false });
    part(g, leadFlat(0.2, LEAD_DEPTH_MM, 1.0, 0.5), Materials.tin(), { at: [x, 0, pin.position.z], castShadow: false });
    // Groove between two poles
    if (i > 0) {
      part(g, box(0.16, 0.06, hd + stepZ - 0.6), dark, { at: [x - p.pitch / 2, p.height + 0.02, cz + screwZ], castShadow: false });
    }
  });
};
