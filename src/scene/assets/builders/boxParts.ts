import { Materials } from '../materials';
import { box, chamferBox, cylinder, disc, label, part } from '../primitives';
import type { Builder } from '../specs/types';
import { pinCentre, straightLeads } from './common';

/**
 * Tactile push button: square plastic base, metal cover plate with four stakes, round actuator
 * that sits lower while pressed, one leg per pin.
 */
export interface TactButtonParams {
  size: number;
  baseHeight: number;
  actuatorDiameter: number;
  actuatorTravel: number;
  actuatorHex: number;
  pressed: boolean;
}

export const buildTactButton: Builder<TactButtonParams> = (ctx, p) => {
  const d = ctx.detail;
  const g = ctx.group;
  const c = pinCentre(ctx.pins);
  const bottom = 0.5;
  const top = bottom + p.baseHeight;
  part(g, chamferBox(p.size, p.baseHeight, p.size, 0.4, d), Materials.plastic(0x1f2329, 0.6), { at: [c.x, bottom + p.baseHeight / 2, c.z] });
  part(g, box(p.size - 0.8, 0.3, p.size - 0.8), Materials.steel(), { at: [c.x, top + 0.15, c.z], castShadow: false });
  if (d !== 'low') {
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        part(g, disc(0.7, d), Materials.flat(0x15171b), { at: [c.x + sx * (p.size / 2 - 1.6), top + 0.32, c.z + sz * (p.size / 2 - 1.6)], castShadow: false });
      }
    }
  }
  const height = p.pressed ? p.actuatorTravel * 0.6 : p.actuatorTravel * 0.6 + p.actuatorTravel;
  const r = p.actuatorDiameter / 2;
  part(g, cylinder(r, r, height, d), Materials.plastic(p.actuatorHex, 0.4), { at: [c.x, top + 0.3 + height / 2, c.z] });
  straightLeads(ctx, bottom + 0.4, { flat: [0.9, 0.3] });
};

/**
 * Sugar-cube PCB relay: sealed plastic case with the printed type label on top, one leg per pin.
 */
export interface RelayParams {
  length: number;
  width: number;
  height: number;
  caseHex: number;
  marking: string;
  coilMarking: string;
}

export const buildRelay: Builder<RelayParams> = (ctx, p) => {
  const d = ctx.detail;
  const g = ctx.group;
  const bottom = 0.4;
  const top = bottom + p.height;
  part(g, chamferBox(p.length, p.height, p.width, 0.7, d), Materials.plastic(p.caseHex, 0.42), { at: [0, bottom + p.height / 2, 0] });
  if (d !== 'low') {
    label(g, p.marking, p.length * 0.74, 2.3, { at: [0, top + 0.03, -2.2], color: '#f8fafc', font: '700 sans-serif' });
    label(g, p.coilMarking, p.length * 0.5, 1.8, { at: [0, top + 0.03, 1.2], color: '#f8fafc', font: '600 sans-serif' });
    // Vent nib in a corner
    part(g, cylinder(0.7, 0.7, 0.4, d, { radialFactor: 0.6 }), Materials.plastic(p.caseHex, 0.42), {
      at: [p.length / 2 - 2, top + 0.2, p.width / 2 - 2],
      castShadow: false,
    });
  }
  straightLeads(ctx, bottom + 0.3, { flat: [1.0, 0.4] });
};

/**
 * Light dependent resistor: ceramic disc facing up with the serpentine CdS track under a clear
 * coating, on two straight leads.
 */
export interface LdrParams {
  headDiameter: number;
  headHeight: number;
  /** Height of the underside of the head above the board. */
  seat: number;
}

export const buildLdr: Builder<LdrParams> = (ctx, p) => {
  const d = ctx.detail;
  const g = ctx.group;
  const c = pinCentre(ctx.pins);
  const R = p.headDiameter / 2;
  const top = p.seat + p.headHeight;
  part(g, cylinder(R, R, p.headHeight, d), Materials.ceramic(0xb9772a), { at: [c.x, p.seat + p.headHeight / 2, c.z] });
  part(g, disc(R * 0.92, d), Materials.ceramic(0xf2dfae), { at: [c.x, top + 0.02, c.z], castShadow: false });
  // Serpentine photoconductive track
  const track = Materials.flat(0xb23a1e);
  const rows = d === 'low' ? 3 : 5;
  for (let i = 0; i < rows; i++) {
    const z = (i - (rows - 1) / 2) * (R * 1.3) / rows;
    const half = Math.sqrt(Math.max(0.1, (R * 0.8) ** 2 - z * z));
    part(g, box(half * 2, 0.04, 0.26), track, { at: [c.x, top + 0.04, c.z + z], castShadow: false });
    if (i < rows - 1) {
      const side = i % 2 === 0 ? 1 : -1;
      part(g, box(0.26, 0.04, (R * 1.3) / rows), track, { at: [c.x + side * (half - 0.13), top + 0.04, c.z + z + (R * 1.3) / rows / 2], castShadow: false });
    }
  }
  part(g, cylinder(R * 0.96, R * 0.96, 0.35, d), Materials.glass(0xfff1c2, 0.3), { at: [c.x, top + 0.2, c.z], castShadow: false });
  straightLeads(ctx, p.seat + 0.2);
};
