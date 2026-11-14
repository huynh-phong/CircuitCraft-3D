import { Materials } from '../materials';
import { box, chamferBox, cylinder, extrude, label, part } from '../primitives';
import { pick } from '../quality';
import type { Builder } from '../specs/types';
import { FACE_FRONT, formedLead, straightLeads } from './common';

/**
 * TO-92: small D-shaped plastic package with three leads (small-signal transistors, LM35, ...).
 * The flat face (with the marking) looks towards +z. The outer leads are formed out to the pins.
 */
export interface To92Params {
  marking: string;
  bodyDiameter: number;
  bodyHeight: number;
  /** Height of the underside of the package above the board. */
  seat: number;
  /** Lead spacing where the leads enter the package. */
  bodyPitch: number;
}

export const buildTo92: Builder<To92Params> = (ctx, p) => {
  const d = ctx.detail;
  const g = ctx.group;
  const pins = [...ctx.pins].sort((a, b) => a.position.x - b.position.x);
  const mid = pins[Math.floor(pins.length / 2)];
  const cx = mid.position.x;
  const cz = mid.position.z;
  const R = p.bodyDiameter / 2;
  const flat = R * 0.62; // distance from the axis to the flat face
  const alpha = Math.asin(flat / R);
  const steps = pick(d, 6, 10, 16);
  const outline: Array<[number, number]> = [];
  for (let i = 0; i <= steps; i++) {
    const a = Math.PI - alpha + (i / steps) * (Math.PI + 2 * alpha);
    outline.push([Math.cos(a) * R, Math.sin(a) * R]);
  }
  part(g, extrude(`to92-${p.bodyDiameter}`, outline, p.bodyHeight, d, { bevel: 0.15 }), Materials.plastic(0x1c1e23, 0.6), {
    at: [cx, p.seat, cz],
  });
  if (d !== 'low') {
    label(g, p.marking, p.bodyDiameter * 0.78, 1.5, { at: [cx, p.seat + p.bodyHeight * 0.62, cz + flat + 0.17], rot: FACE_FRONT, color: '#b6beca', font: '600 monospace' });
  }

  pins.forEach((pin, i) => {
    const offset = (i - (pins.length - 1) / 2) * p.bodyPitch;
    if (Math.abs(pin.position.x - (cx + offset)) < 0.05) straightLeads(ctx, p.seat + 0.3, { flat: [0.45, 0.4] }, [pin]);
    else formedLead(ctx, `to92-${i}-${p.seat}-${p.bodyPitch}-${pin.position.x}-${pin.position.z}`, pin, [cx + offset, p.seat + 0.3, cz], p.seat * 0.5, 0.23);
  });
};

/**
 * TO-220: power package standing on three leads, metal tab with a mounting hole at the back (-z).
 */
export interface To220Params {
  marking: string;
  bodyWidth: number;
  bodyHeight: number;
  bodyDepth: number;
  tabHeight: number;
  /** Height of the underside of the plastic body above the board. */
  seat: number;
}

export const buildTo220: Builder<To220Params> = (ctx, p) => {
  const d = ctx.detail;
  const g = ctx.group;
  const pins = [...ctx.pins].sort((a, b) => a.position.x - b.position.x);
  const mid = pins[Math.floor(pins.length / 2)];
  const cx = mid.position.x;
  const cz = mid.position.z;
  const steel = Materials.steel();
  const bodyTop = p.seat + p.bodyHeight;

  part(g, chamferBox(p.bodyWidth, p.bodyHeight, p.bodyDepth - 1.3, 0.3, d), Materials.plastic(0x1c1e23, 0.6), {
    at: [cx, p.seat + p.bodyHeight / 2, cz + 0.65],
  });
  // Tab: behind the plastic and standing above it, with the mounting hole
  const tabZ = cz - p.bodyDepth / 2 + 0.65;
  part(g, box(p.bodyWidth, p.bodyHeight + p.tabHeight, 1.3), steel, { at: [cx, p.seat + (p.bodyHeight + p.tabHeight) / 2, tabZ] });
  part(g, cylinder(1.85, 1.85, 1.36, d), Materials.flat(0x0b0d11), {
    at: [cx, bodyTop + p.tabHeight * 0.52, tabZ],
    rot: [Math.PI / 2, 0, 0],
    castShadow: false,
  });
  if (d !== 'low') {
    label(g, p.marking, p.bodyWidth * 0.8, 1.9, { at: [cx, p.seat + p.bodyHeight * 0.6, cz + p.bodyDepth / 2 + 0.02], rot: FACE_FRONT, color: '#b6beca', font: '600 monospace' });
  }
  // Leads: wide shoulder under the body, narrow into the board
  for (const pin of pins) {
    part(g, box(1.3, p.seat * 0.45, 0.5), Materials.tin(), { at: [pin.position.x, p.seat * 0.78, pin.position.z], castShadow: false });
  }
  straightLeads(ctx, p.seat * 0.6, { flat: [0.8, 0.5] });
};
