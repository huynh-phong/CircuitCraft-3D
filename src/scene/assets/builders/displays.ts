import * as THREE from 'three';
import { Materials } from '../materials';
import { box, chamferBox, cylinder, disc, domeProfile, label, lathe, part, ring } from '../primitives';
import { pick } from '../quality';
import type { Builder } from '../specs/types';
import { formedLead, pinCentre, straightLeads } from './common';

/**
 * Four-lead RGB LED (5 mm, diffused): one lens, leads formed out to the pins. The lens colour is
 * the mix of the three SOLVED channel levels; dark when the solver reports nothing.
 */
export interface RgbLedParams {
  lensDiameter: number;
  lensHeight: number;
  flangeDiameter: number;
  flangeHeight: number;
  standoff: number;
  /** Lead spacing where the leads enter the lens. */
  bodyPitch: number;
  /** Pin with the longest lead (common cathode / anode). */
  commonPin: string;
  /** Channel levels 0..1 from the solver. */
  rgb: [number, number, number];
}

export const buildRgbLed: Builder<RgbLedParams> = (ctx, p) => {
  const d = ctx.detail;
  const g = ctx.group;
  const pins = [...ctx.pins].sort((a, b) => a.position.x - b.position.x);
  const c = pinCentre(pins);
  const R = p.lensDiameter / 2;
  const lensBottom = p.standoff + p.flangeHeight;
  const barrel = p.lensHeight - p.flangeHeight - R;

  const peak = Math.max(...p.rgb);
  const lit = peak > 0.04;
  const off = Materials.glass(0xf1f5f9, 0.86);
  let lens: THREE.Material = off;
  let mix: THREE.Color | null = null;
  if (lit) {
    mix = new THREE.Color(p.rgb[0] / peak, p.rgb[1] / peak, p.rgb[2] / peak);
    // Owned by this mesh (the colour is continuous): disposed with it, like the legacy model
    lens = new THREE.MeshStandardMaterial({ color: mix, emissive: mix, emissiveIntensity: 0.4 + peak, roughness: 0.2, metalness: 0.1, transparent: true, opacity: 0.9 });
  }
  const blink = { blinkOn: lens, blinkOff: off };
  part(g, cylinder(p.flangeDiameter / 2, p.flangeDiameter / 2, p.flangeHeight, d), off, { at: [c.x, p.standoff + p.flangeHeight / 2, c.z], castShadow: false });
  part(
    g,
    lathe(`rgb-lens-${p.lensDiameter}-${p.lensHeight}`, [[R, 0], [R, barrel], ...domeProfile(R, barrel, pick(d, 3, 6, 10)).slice(1)], d, 1.3),
    lens,
    { at: [c.x, lensBottom, c.z], dynamic: true, userData: lit ? blink : {} }
  );
  if (lit && mix) {
    const glow = new THREE.PointLight(mix, 2 * peak, 35, 1.5);
    glow.name = 'sim-glow';
    glow.position.set(c.x, lensBottom + barrel, c.z);
    g.add(glow);
  }

  pins.forEach((pin, i) => {
    const x = c.x + (i - (pins.length - 1) / 2) * p.bodyPitch;
    formedLead(ctx, `rgb-${i}-${pin.position.x}-${pin.position.z}-${pin.id === p.commonPin}`, pin, [x, p.standoff + 0.2, c.z], p.standoff * 0.45, 0.24, pin.id === p.commonPin ? 4.2 : 3.2);
  });
};

/**
 * Single-digit seven-segment LED display. Each segment lights from its own SOLVED level.
 * The top of the digit is towards -z.
 */
export interface SevenSegmentParams {
  width: number;
  depth: number;
  height: number;
  /** Underside of the package above the board. */
  seat: number;
  segmentHex: number;
  /** Solved level per segment key: a b c d e f g dp. */
  levels: Record<string, number>;
}

export const buildSevenSegment: Builder<SevenSegmentParams> = (ctx, p) => {
  const d = ctx.detail;
  const g = ctx.group;
  const top = p.seat + p.height;
  part(g, chamferBox(p.width, p.height, p.depth, 0.35, d), Materials.plastic(0xd7dce2, 0.5), { at: [0, p.seat + p.height / 2, 0] });
  part(g, box(p.width - 0.9, 0.24, p.depth - 0.9), Materials.plastic(0x101216, 0.3), { at: [0, top + 0.1, 0], castShadow: false });

  const offMat = Materials.plastic(0x3a424e, 0.3);
  const onMat = Materials.emissive(p.segmentHex, 1.1);
  const h = box(5.0, 0.14, 1.15);
  const v = box(1.15, 0.14, 5.0);
  const segments: Array<[string, THREE.BufferGeometry, number, number]> = [
    ['a', h, 0, -6.0],
    ['g', h, 0, 0],
    ['d', h, 0, 6.0],
    ['f', v, -2.8, -3.0],
    ['b', v, 2.8, -3.0],
    ['e', v, -2.8, 3.0],
    ['c', v, 2.8, 3.0],
    ['dp', cylinder(0.65, 0.65, 0.14, d, { radialFactor: 0.7 }), 4.6, 7.4],
  ];
  for (const [key, geometry, x, z] of segments) {
    const on = (p.levels[key] ?? 0) > 0.04;
    part(g, geometry, on ? onMat : offMat, {
      at: [x, top + 0.29, z],
      castShadow: false,
      dynamic: on,
      userData: on ? { blinkOn: onMat, blinkOff: offMat } : {},
    });
  }
  straightLeads(ctx, p.seat + 0.2, { flat: [0.5, 0.3] });
};

/**
 * 0.96" OLED module: PCB lying flat on a four-pin header, glass panel, flex tail, mounting holes.
 * The panel only lights when the solver reports display data.
 */
export interface OledModuleParams {
  pcbSize: number;
  pcbHex: number;
  glassWidth: number;
  glassDepth: number;
  displayOn: boolean;
  silk: string;
}

export const buildOledModule: Builder<OledModuleParams> = (ctx, p) => {
  const d = ctx.detail;
  const g = ctx.group;
  const header = pinCentre(ctx.pins);
  const pinY = ctx.pins[0].position.y;
  const pcbBottom = pinY - 0.3;
  const pcbTop = pcbBottom + 1.6;
  part(g, box(p.pcbSize, 1.6, p.pcbSize), Materials.pcb(p.pcbHex), { at: [0, pcbBottom + 0.8, 0] });
  // Header: plastic spacer under the PCB, pins through it
  part(g, box(ctx.pins.length * 2.54, pcbBottom, 2.5), Materials.plastic(0x15171b, 0.6), { at: [header.x, pcbBottom / 2, header.z], castShadow: false });
  straightLeads(ctx, pcbTop + 0.9, { flat: [0.64, 0.64] });
  // Glass panel with the active area
  const gz = 2.0;
  part(g, box(p.glassWidth, 1.3, p.glassDepth), Materials.plastic(0x07090d, 0.12), { at: [0, pcbTop + 0.65, gz] });
  part(g, box(p.glassWidth - 3, 0.06, p.glassDepth - 5.5), p.displayOn ? Materials.emissive(0x06b6d4, 0.5) : Materials.plastic(0x020308, 0.08), {
    at: [0, pcbTop + 1.32, gz - 1.2],
    castShadow: false,
  });
  part(g, box(9, 0.25, 3.2), Materials.plastic(0x7a4a1e, 0.5), { at: [0, pcbTop + 0.14, gz + p.glassDepth / 2 + 1.2], castShadow: false });
  if (d !== 'low') {
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const at: [number, number, number] = [sx * (p.pcbSize / 2 - 2.2), pcbTop + 0.02, sz * (p.pcbSize / 2 - 2.2)];
        part(g, ring(1.1, 1.8, d), Materials.tin(), { at, castShadow: false });
        part(g, disc(1.1, d), Materials.flat(0x05070a), { at, castShadow: false });
      }
    }
    label(g, p.silk, 11.5, 1.5, { at: [header.x, pcbTop + 0.02, header.z + 2.4], color: '#ffffff', font: '600 sans-serif' });
  }
};
