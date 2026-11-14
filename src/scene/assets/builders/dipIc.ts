import { Materials } from '../materials';
import { box, chamferBox, cylinder, disc, label, leadFlat, part } from '../primitives';
import type { Builder } from '../specs/types';
import { LEAD_DEPTH_MM } from '../units';

/**
 * Dual in-line IC (DIP-8, DIP-14, ...). The package length and row spacing are taken from the pin
 * anchors; pin 1 gets the index notch on its end of the package and the dot beside it.
 */
export interface DipIcParams {
  /** Id of pin 1 (decides where the notch and the dot go). */
  pin1: string;
  bodyWidth: number;
  bodyHeight: number;
  /** Clearance between the board and the underside of the package. */
  standoff: number;
  /** Text printed on the package. */
  marking: string;
}

export const buildDipIc: Builder<DipIcParams> = (ctx, p) => {
  const d = ctx.detail;
  const g = ctx.group;
  const xs = ctx.pins.map((pin) => pin.position.x);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const length = maxX - minX + 2.2;
  const cx = (minX + maxX) / 2;
  const top = p.standoff + p.bodyHeight;
  const epoxy = Materials.plastic(0x1c1e23, 0.62);
  const tin = Materials.tin();

  part(g, chamferBox(length, p.bodyHeight, p.bodyWidth, 0.25, d), epoxy, { at: [cx, p.standoff + p.bodyHeight / 2, 0] });

  // Index notch (half disc) on the pin-1 end and the pin-1 dot
  const one = ctx.pin(p.pin1);
  const end = one.x < cx ? -1 : 1;
  part(g, cylinder(0.85, 0.85, 0.06, d, { thetaStart: 0, thetaLength: Math.PI }), Materials.flat(0x08090c), {
    at: [cx + end * (length / 2), top + 0.02, 0],
    rot: [0, end < 0 ? 0 : Math.PI, 0],
    castShadow: false,
  });
  part(g, disc(0.42, d), Materials.flat(0x8b95a3), {
    at: [one.x - end * 0.15, top + 0.03, Math.sign(one.z) * (p.bodyWidth / 2 - 1.05)],
    castShadow: false,
  });
  if (d !== 'low') label(g, p.marking, Math.min(length * 0.62, 12), 1.9, { at: [cx + 0.4, top + 0.03, 0], color: '#aeb7c4', font: '600 monospace' });

  // Legs: wide shoulder out of the package, narrow tip into the board
  const shoulderY = p.standoff + p.bodyHeight * 0.45;
  for (const pin of ctx.pins) {
    const side = Math.sign(pin.position.z) || 1;
    const reach = Math.abs(pin.position.z) - p.bodyWidth / 2;
    part(g, box(1.3, 0.25, reach + 0.2), tin, { at: [pin.position.x, shoulderY, side * (p.bodyWidth / 2 + reach / 2)], castShadow: false });
    part(g, box(1.3, shoulderY - 0.9, 0.25), tin, { at: [pin.position.x, (shoulderY + 0.9) / 2, pin.position.z], castShadow: false });
    part(g, leadFlat(0.9, LEAD_DEPTH_MM, 0.5, 0.25), tin, { at: [pin.position.x, 0, pin.position.z], castShadow: false });
  }
};
