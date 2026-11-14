import * as THREE from 'three';
import type { BoardDefinition } from '../../domain/project/types';
import { Materials } from '../assets/materials';
import {
  bakeStatic,
  box,
  cable,
  chamferBox,
  cylinder,
  disc,
  group,
  ignoreRaycast,
  label,
  lathe,
  part,
  plane,
  roundedFrame,
  roundedSlab,
  sphere,
  spring,
  thread,
  torus,
} from '../assets/primitives';
import type { DetailLevel } from '../assets/quality';
import { SCENE_UNITS_PER_MM } from '../assets/units';

/**
 * Electronics workbench around the board: ESD mat on a desk plus decorative tools.
 *
 * SCENE ONLY. Nothing here is read from or written to the ProjectDocument, nothing goes through
 * the CommandHistory, and no object can be picked: the group is never given to the raycaster and
 * every object ignores raycasts anyway (`ignoreRaycast`).
 *
 * Everything is built from the asset library (primitives + shared materials) in millimetres, with
 * the mat surface at y = 0 of the returned group. Static meshes are merged per material
 * (`bakeStatic`), so the whole bench costs about one draw call per material.
 */

export type WorkbenchTheme = 'dark' | 'light';

export interface WorkbenchOptions {
  /** Half extents of the area that must stay free: the board and the part placement range. */
  keepX: number;
  keepZ: number;
  detail: DetailLevel;
  /** Decorative tools on/off (the mat and the desk stay). */
  decor: boolean;
  theme: WorkbenchTheme;
}

/** Parts can be dragged this far from the centre (see the drag clamp in ThreeScene). */
export const PLACEMENT_HALF_X = 175;
export const PLACEMENT_HALF_Z = 115;
const KEEP_MARGIN = 12;
/** Width of the strip of mat around the free area where the tools sit. */
const DECOR_BAND_X = 112;
const DECOR_BAND_Z = 122;

/** The free area for a board: decoration always stays outside of it, whatever the board size. */
export function workbenchKeepOut(board: Pick<BoardDefinition, 'width' | 'depth' | 'shape' | 'radius'>): { keepX: number; keepZ: number } {
  const square = board.shape === 'square' ? Math.max(board.width, board.depth) : 0;
  const halfW = board.shape === 'circle' ? board.radius || board.width / 2 : (square || board.width) / 2;
  const halfD = board.shape === 'circle' ? board.radius || board.width / 2 : (square || board.depth) / 2;
  // Rounded so that small board edits do not rebuild the bench
  const round = (v: number) => Math.ceil(v / 10) * 10;
  return {
    keepX: round(Math.max(PLACEMENT_HALF_X, halfW) + KEEP_MARGIN),
    keepZ: round(Math.max(PLACEMENT_HALF_Z, halfD) + KEEP_MARGIN),
  };
}

export function workbenchSignature(o: WorkbenchOptions): string {
  return [o.keepX, o.keepZ, o.detail, o.decor ? 1 : 0, o.theme].join('|');
}

type Item = (g: THREE.Group, d: DetailLevel) => void;

const UP_TO_X: [number, number, number] = [0, 0, -Math.PI / 2]; // +Y axis -> +X
const FACE_FRONT: [number, number, number] = [Math.PI / 2, 0, 0]; // up-facing plane -> faces +Z

function shadowBlob(g: THREE.Object3D, w: number, d: number, at: [number, number] = [0, 0]) {
  const material = Materials.contactShadow();
  if (material) part(g, plane(w, d), material, { at: [at[0], 0.06, at[1]], castShadow: false });
}

// --------------------------------------------------------------------------------------
// Decoration items. Origin = centre of the footprint on the surface, +z = towards the board
// unless the item is rotated when placed.
// --------------------------------------------------------------------------------------

/** Soldering iron resting in a spring stand, with a cleaning sponge and brass wool. */
const solderingStation: Item = (g, d) => {
  const black = Materials.plastic(0x1c1f25, 0.6);
  const steel = Materials.steel();
  shadowBlob(g, 150, 100);
  part(g, roundedSlab(120, 76, 7, 9, d, 1), Materials.darkSteel(), {});
  // Sponge in its tray
  part(g, box(48, 3, 48), black, { at: [-30, 8.5, 6] });
  part(g, roundedSlab(43, 43, 8, 6, d, 1.5), Materials.foam(0xe8c84a), { at: [-30, 9, 6] });
  // Brass wool tip cleaner
  part(g, cylinder(15, 13, 17, d), black, { at: [-34, 15.5, -24] });
  part(g, sphere(13, d), Materials.brass(), { at: [-34, 22, -24], scale: [1, 0.55, 1] });
  // Spring holder on a post, tilted towards +x
  const tilt = -1.05;
  part(g, cylinder(2.4, 2.4, 30, d, { radialFactor: 0.6 }), steel, { at: [18, 22, 0] });
  const holder = group(g, { at: [10, 34, 0], rot: [0, 0, tilt] });
  part(holder, spring(10, 1.2, 9, 72, d), steel, {});
  part(holder, torus(10, 1.6, d), steel, { at: [0, 72, 0], rot: [Math.PI / 2, 0, 0] });
  // The iron inside the holder: tip down in the spring, handle sticking out
  const iron = group(holder, { at: [0, 4, 0] });
  part(iron, cylinder(0.8, 2.6, 16, d, { radialFactor: 0.6 }), Materials.chrome(), { at: [0, 8, 0] });
  part(iron, cylinder(3.2, 3.2, 62, d, { radialFactor: 0.7 }), steel, { at: [0, 47, 0] });
  part(iron, cylinder(8, 5, 10, d), black, { at: [0, 83, 0] });
  part(iron, cylinder(8.5, 8.5, 86, d), Materials.rubber(0x1d4ed8), { at: [0, 131, 0] });
  part(iron, cylinder(9.2, 9.2, 5, d), black, { at: [0, 96, 0] });
  part(iron, cylinder(4, 8.5, 12, d), black, { at: [0, 180, 0] });
  // Mains lead, from the handle end down to the desk and away
  const hx = 10 + Math.sin(-tilt) * 190;
  const hy = 34 + Math.cos(tilt) * 190;
  part(
    g,
    cable('iron-lead', [[hx, hy, 0], [hx + 28, hy - 20, -6], [hx + 46, 40, -22], [hx + 40, 4, -52], [hx + 4, 2.2, -84], [hx - 50, 2.2, -100]], 2.2, d),
    Materials.rubber(0x15171b),
    {}
  );
};

/** Spool of solder wire with a loose end. */
const solderSpool: Item = (g, d) => {
  const flange = Materials.plastic(0x2563eb, 0.45);
  shadowBlob(g, 62, 62);
  part(g, cylinder(23, 23, 2.4, d), flange, { at: [0, 1.2, 0] });
  part(g, thread(18, 27, 1.5, d), Materials.tin(), { at: [0, 16, 0] });
  part(g, cylinder(23, 23, 2.4, d), flange, { at: [0, 30.8, 0] });
  part(g, cylinder(6, 6, 0.3, d), Materials.flat(0x0b0d11), { at: [0, 32.1, 0], castShadow: false });
  part(g, cable('solder-end', [[18, 22, 0], [26, 20, 8], [30, 6, 22], [22, 0.8, 38], [2, 0.8, 46]], 0.7, d), Materials.tin(), { castShadow: false });
};

/** Digital multimeter lying on the mat with its two probes. */
const multimeter: Item = (g, d) => {
  const dark = Materials.plastic(0x23272e, 0.55);
  shadowBlob(g, 96, 164);
  part(g, roundedSlab(76, 146, 36, 12, d, 3), Materials.rubber(0xf2b10a), {});
  part(g, roundedSlab(64, 132, 2, 7, d), dark, { at: [0, 35.2, 0] });
  // Display
  part(g, box(50, 1.2, 24), Materials.plastic(0x0f1216, 0.3), { at: [0, 37.6, -44] });
  part(g, plane(45, 19), Materials.plastic(0xa9b8a2, 0.25), { at: [0, 38.3, -44], castShadow: false });
  label(g, '0.00', 34, 14, { at: [3, 38.4, -44], color: '#1b241b', font: '700 monospace' });
  // Range dial
  part(g, cylinder(19, 19, 5, d), Materials.plastic(0x15181d, 0.5), { at: [0, 39.5, 6] });
  part(g, chamferBox(8, 6, 30, 2, d), dark, { at: [0, 43, 6], rot: [0, 0.6, 0] });
  part(g, box(1.6, 0.3, 11), Materials.flat(0xf8fafc), { at: [-5.2, 46.1, -1.6], rot: [0, 0.6, 0], castShadow: false });
  // Input jacks and probe leads
  const jacks: Array<[number, number]> = [[-20, 0xdc2626], [0, 0x111318], [20, 0xdc2626]];
  for (const [x, hex] of jacks) {
    part(g, cylinder(5, 5, 3, d), Materials.plastic(hex, 0.5), { at: [x, 38, 52] });
    part(g, cylinder(2.2, 2.2, 0.4, d), Materials.flat(0x05070a), { at: [x, 39.6, 52], castShadow: false });
  }
  const probes: Array<{ x: number; hex: number; path: Array<[number, number, number]>; at: [number, number, number]; rot: number }> = [
    { x: 0, hex: 0x15171b, path: [[0, 46, 52], [2, 54, 62], [16, 34, 88], [36, 2, 100], [50, 1.6, 90], [51, 1.6, 66]], at: [51, 4, 34], rot: 0.03 },
    { x: 20, hex: 0xc81e1e, path: [[20, 46, 52], [24, 54, 64], [44, 30, 92], [60, 2, 96], [63, 1.6, 78], [62, 1.6, 50]], at: [62, 4, 18], rot: -0.04 },
  ];
  for (const p of probes) {
    part(g, cylinder(3, 3, 9, d, { radialFactor: 0.6 }), Materials.plastic(p.hex, 0.5), { at: [p.x, 43, 52] });
    part(g, cable(`probe-lead-${p.hex}`, p.path, 1.5, d), Materials.rubber(p.hex), {});
    const probe = group(g, { at: p.at, rot: [Math.PI / 2, 0, p.rot] }); // lying, pointing to -z
    part(probe, cylinder(3.6, 4.2, 62, d, { radialFactor: 0.7 }), Materials.plastic(p.hex, 0.5), {});
    part(probe, cylinder(5.4, 5.4, 2, d, { radialFactor: 0.7 }), Materials.plastic(p.hex, 0.5), { at: [0, -22, 0] });
    part(probe, cylinder(1.9, 3.4, 10, d, { radialFactor: 0.6 }), Materials.plastic(p.hex, 0.5), { at: [0, -36, 0] });
    part(probe, cylinder(0.3, 1, 20, d, { radialFactor: 0.5 }), Materials.chrome(), { at: [0, -51, 0] });
  }
};

/** "Third hand": weighted base, cross bar with two alligator clips and a magnifying glass. */
const thirdHand: Item = (g, d) => {
  const steel = Materials.steel();
  const brass = Materials.brass();
  shadowBlob(g, 80, 80);
  part(g, cylinder(27, 30, 11, d), Materials.darkSteel(), { at: [0, 5.5, 0] });
  part(g, cylinder(2.6, 2.6, 62, d, { radialFactor: 0.6 }), steel, { at: [0, 42, 0] });
  part(g, sphere(5, d), brass, { at: [0, 73, 0] });
  part(g, cylinder(2.2, 2.2, 136, d, { radialFactor: 0.6 }), steel, { at: [0, 73, 0], rot: UP_TO_X });
  for (const s of [-1, 1]) {
    part(g, sphere(4.2, d), brass, { at: [s * 68, 73, 0] });
    const arm = group(g, { at: [s * 68, 73, 0], rot: [0, 0, s * 0.5] });
    part(arm, cylinder(1.6, 1.6, 22, d, { radialFactor: 0.5 }), steel, { at: [0, 11, 0] });
    // Alligator clip: two jaws
    part(arm, box(3.6, 26, 5), steel, { at: [-1.6, 34, 0], rot: [0, 0, 0.09] });
    part(arm, box(3.6, 26, 5), steel, { at: [1.6, 34, 0], rot: [0, 0, -0.09] });
  }
  // Magnifier on a goose-neck
  part(g, cable('third-hand-neck', [[0, 74, 0], [0, 96, -6], [0, 112, -20], [0, 120, -34]], 2, d), steel, {});
  const lens = group(g, { at: [0, 128, -58], rot: [1.0, 0, 0] });
  part(lens, torus(28, 2.4, d), Materials.chrome(), { rot: [Math.PI / 2, 0, 0] });
  part(lens, cylinder(27, 27, 1.6, d), Materials.glass(0xdbeafe, 0.26), { castShadow: false });
};

/** Compartment box with a few small parts inside. */
const partsBox: Item = (g, d) => {
  const shell = Materials.plastic(0xd5dde6, 0.4);
  const W = 124;
  const D = 82;
  const H = 20;
  shadowBlob(g, W + 22, D + 22);
  part(g, roundedSlab(W, D, 2.4, 5, d), shell, {});
  for (const s of [-1, 1]) {
    part(g, box(W, H, 1.8), shell, { at: [0, H / 2, s * (D / 2 - 0.9)] });
    part(g, box(1.8, H, D), shell, { at: [s * (W / 2 - 0.9), H / 2, 0] });
  }
  part(g, box(W - 2, H - 3, 1.4), shell, { at: [0, (H - 3) / 2, 0] });
  for (const x of [-31, 0, 31]) part(g, box(1.4, H - 3, D - 2), shell, { at: [x, (H - 3) / 2, 0] });

  // Contents: resistors, LEDs, ceramic capacitors, DIP chips, electrolytics
  const cell = (cx: number, cz: number) => [(cx - 1.5) * 31, cz * 20] as const;
  const body = lathe('mini-resistor', [[0, -3.2], [1.1, -3.2], [1.2, -2.2], [1.0, -1.4], [1.0, 1.4], [1.2, 2.2], [1.1, 3.2], [0, 3.2]], 'low');
  const lead = cylinder(0.3, 0.3, 22, 'low');
  const [rx, rz] = cell(0, -1);
  for (let i = 0; i < 5; i++) {
    const rot: [number, number, number] = [Math.PI / 2, 0, 0.5 + i * 0.7];
    const at: [number, number, number] = [rx - 8 + i * 4, 3.6 + (i % 2) * 1.4, rz + ((i * 7) % 9) - 4];
    part(g, body, Materials.resistorBody(), { at, rot, castShadow: false });
    part(g, lead, Materials.tin(), { at, rot, castShadow: false });
  }
  const ledHex = [0xef4444, 0x22c55e, 0xeab308, 0x3b82f6];
  const [lx, lz] = cell(1, -1);
  ledHex.forEach((hex, i) => {
    const at: [number, number, number] = [lx - 9 + i * 6, 5, lz - 3 + (i % 2) * 6];
    part(g, cylinder(2.5, 2.5, 5, 'low'), Materials.paint(hex, 0.25), { at, rot: [Math.PI / 2, 0, i * 0.8], castShadow: false });
    part(g, sphere(2.5, 'low'), Materials.paint(hex, 0.25), { at: [at[0] - Math.sin(i * 0.8) * 2.5, 5, at[2] + Math.cos(i * 0.8) * 2.5], castShadow: false });
  });
  const [cx2, cz2] = cell(2, -1);
  for (let i = 0; i < 4; i++) {
    part(g, cylinder(2.6, 2.6, 1.4, 'low'), Materials.paint(0xd97706, 0.5), { at: [cx2 - 8 + i * 5.5, 3.4, cz2 - 4 + ((i * 5) % 8)], rot: [0.3, i, 0], castShadow: false });
  }
  const [ix, iz] = cell(3, -1);
  for (let i = 0; i < 3; i++) {
    part(g, box(9.8, 3.3, 6.4), Materials.plastic(0x1b1d22, 0.6), { at: [ix - 4 + i * 3, 4.2 + i * 1.2, iz - 5 + i * 5], rot: [0, 0.3 + i * 0.5, 0], castShadow: false });
  }
  const [ex, ez] = cell(0, 1);
  for (let i = 0; i < 3; i++) {
    part(g, cylinder(3.2, 3.2, 11, 'low'), Materials.paint(0x1e3a8a, 0.4), { at: [ex - 7 + i * 7, 5.6, ez - 3 + i * 3], rot: [Math.PI / 2, 0, 0.4 + i], castShadow: false });
  }
  const [tx, tz] = cell(2, 1);
  for (let i = 0; i < 3; i++) {
    part(g, box(6.2, 6.2, 3.6), Materials.plastic(0x1b1d22, 0.6), { at: [tx - 7 + i * 7, 4.2, tz - 3 + i * 3], rot: [0, i * 0.9, 0], castShadow: false });
    part(g, cylinder(1.7, 1.7, 2, 'low'), Materials.paint(0xdc2626, 0.4), { at: [tx - 7 + i * 7, 7, tz - 3 + i * 3], castShadow: false });
  }
};

/** Fine-point tweezers lying on their side. */
const tweezers: Item = (g, d) => {
  const steel = Materials.steel();
  shadowBlob(g, 130, 22);
  for (const s of [-1, 1]) {
    const blade = group(g, { at: [-58, 0, 0], rot: [0, s * 0.045, 0] });
    part(blade, box(84, 7, 1.1), steel, { at: [42, 3.5, 0] });
    part(blade, box(36, 4, 0.9), steel, { at: [100, 2.2, 0], rot: [0, 0, 0.0] });
  }
  part(g, box(10, 7.4, 3), steel, { at: [-55, 3.7, 0] });
};

/** Flush cutters with red handles, lying flat. */
const sideCutters: Item = (g, d) => {
  const red = Materials.rubber(0xc81e1e);
  const steel = Materials.darkSteel();
  shadowBlob(g, 130, 60);
  for (const s of [-1, 1]) {
    const half = group(g, { rot: [0, s * 0.17, 0] });
    part(half, chamferBox(74, 9, 11, 3, d), red, { at: [-46, 4.5, s * 3] });
    part(half, box(26, 5, 8), steel, { at: [14, 4.5, -s * 1.5] });
    part(half, box(10, 4, 5), steel, { at: [30, 4.5, -s * 1.2], rot: [0, s * 0.2, 0] });
  }
  part(g, cylinder(6.5, 6.5, 6.4, d), Materials.steel(), { at: [2, 4.6, 0] });
  part(g, spring(3, 0.5, 5, 14, d), Materials.steel(), { at: [-14, 4.5, -7], rot: [Math.PI / 2, 0, 0], castShadow: false });
};

/** Small spools of hook-up wire in several colours. */
const wireSpools: Item = (g, d) => {
  const flange = Materials.plastic(0x23272e, 0.5);
  const spools: Array<{ hex: number; at: [number, number]; lying?: boolean }> = [
    { hex: 0xdc2626, at: [-36, 0] },
    { hex: 0xeab308, at: [0, -6] },
    { hex: 0x2563eb, at: [36, 2] },
    { hex: 0x16a34a, at: [14, 34], lying: true },
  ];
  for (const s of spools) {
    const spool = group(g, { at: s.lying ? [s.at[0], 16, s.at[1]] : [s.at[0], 0, s.at[1]], rot: s.lying ? [Math.PI / 2, 0, 0.4] : [0, 0, 0] });
    if (!s.lying) shadowBlob(g, 44, 44, s.at);
    else shadowBlob(g, 44, 34, s.at);
    part(spool, cylinder(16, 16, 2, d), flange, { at: [0, 1, 0] });
    part(spool, thread(12, 20, 1.6, d), Materials.rubber(s.hex), { at: [0, 12, 0] });
    part(spool, cylinder(16, 16, 2, d), flange, { at: [0, 23, 0] });
    part(spool, cylinder(4.5, 4.5, 0.3, d), Materials.flat(0x05070a), { at: [0, 24.1, 0], castShadow: false });
  }
  part(g, cable('spool-end-red', [[-36, 14, 12], [-34, 8, 22], [-22, 0.7, 34], [-6, 0.7, 50]], 0.7, d), Materials.rubber(0xdc2626), { castShadow: false });
};

/** Bench DC power supply. The front panel faces +z. */
const benchSupply: Item = (g, d) => {
  const W = 118;
  const H = 74;
  const D = 96;
  const front = D / 2;
  shadowBlob(g, W + 30, D + 30);
  part(g, chamferBox(W, H, D, 3, d), Materials.plastic(0x2a2f37, 0.55), { at: [0, H / 2 + 4, 0] });
  part(g, box(W - 6, H - 6, 1.2), Materials.plastic(0x3c434d, 0.5), { at: [0, H / 2 + 4, front + 0.3] });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) part(g, cylinder(5, 5, 4, d, { radialFactor: 0.6 }), Materials.rubber(0x111318), { at: [sx * (W / 2 - 12), 2, sz * (D / 2 - 12)] });
  // Voltage / current displays
  const displays: Array<[number, string, string]> = [[-27, '5.00', '#ff5a4d'], [27, '0.02', '#7dff8c']];
  for (const [x, text, color] of displays) {
    part(g, box(44, 20, 0.8), Materials.flat(0x0a0c10), { at: [x, 58, front + 1.1], castShadow: false });
    label(g, text, 36, 14, { at: [x, 58, front + 1.6], rot: FACE_FRONT, color, font: '700 monospace' });
  }
  label(g, 'V', 6, 6, { at: [-2, 51, front + 1.0], rot: FACE_FRONT, color: '#cbd5e1' });
  label(g, 'A', 6, 6, { at: [52, 51, front + 1.0], rot: FACE_FRONT, color: '#cbd5e1' });
  // Knobs
  for (const x of [-38, -14]) {
    part(g, cylinder(7.5, 8.5, 9, d), Materials.plastic(0x16191e, 0.45), { at: [x, 30, front + 5], rot: [Math.PI / 2, 0, 0] });
    part(g, box(1.2, 6, 0.4), Materials.flat(0xf8fafc), { at: [x, 33.5, front + 9.6], castShadow: false });
  }
  // Binding posts: +, GND, -
  const posts: Array<[number, number]> = [[14, 0xdc2626], [32, 0x16a34a], [50, 0x111318]];
  for (const [x, hex] of posts) {
    part(g, cylinder(5.5, 5.5, 3, d), Materials.plastic(0x16191e, 0.5), { at: [x, 24, front + 1.8], rot: [Math.PI / 2, 0, 0] });
    part(g, thread(2.2, 9, 1.2, d), Materials.brass(), { at: [x, 24, front + 6], rot: [Math.PI / 2, 0, 0], castShadow: false });
    part(g, cylinder(5, 5, 7, d, { radialFactor: 0.7 }), Materials.plastic(hex, 0.45), { at: [x, 24, front + 12], rot: [Math.PI / 2, 0, 0] });
  }
  // Power switch
  part(g, box(10, 16, 2), Materials.plastic(0x111318, 0.5), { at: [-46, 16, front + 1.4] });
  part(g, box(7, 6, 2.4), Materials.emissive(0x22c55e, 0.9), { at: [-46, 19.5, front + 2], castShadow: false });
};

/** Clamp desk lamp. Returns nothing; the warm light itself is added by `buildWorkbench` at high quality. */
const LAMP_HEAD: [number, number, number] = [-52, 172, 46];
const deskLamp: Item = (g, d) => {
  const metal = Materials.darkSteel();
  shadowBlob(g, 60, 60);
  part(g, chamferBox(34, 12, 42, 2, d), metal, { at: [0, 6, 0] });
  part(g, cylinder(4, 4, 16, d, { radialFactor: 0.6 }), metal, { at: [0, 20, 0] });
  const elbow: [number, number, number] = [26, 138, -6];
  part(g, cable('lamp-arm-1', [[0, 26, 0], [elbow[0] * 0.5, 82, -3], elbow], 2.6, d, 0.1), Materials.steel(), {});
  part(g, sphere(5.5, d), metal, { at: elbow });
  part(g, cable('lamp-arm-2', [elbow, [-14, 168, 20], LAMP_HEAD], 2.6, d, 0.1), Materials.steel(), {});
  // Shade aimed at the work area (down and towards +z)
  const head = group(g, { at: LAMP_HEAD, rot: [0.75, 0, 0.3] });
  part(head, cylinder(11, 30, 40, d, { open: true }), metal, { at: [0, -20, 0] });
  part(head, cylinder(11, 11, 10, d), metal, { at: [0, 4, 0] });
  part(head, sphere(9, d), Materials.emissive(0xffe6b3, 1.6), { at: [0, -22, 0], castShadow: false });
  part(head, disc(28.5, d), Materials.emissive(0xffd699, 0.5), { at: [0, -39, 0], rot: [Math.PI, 0, 0], castShadow: false });
};

// --------------------------------------------------------------------------------------
// Surface: desk, ESD mat, grounding snap and cord
// --------------------------------------------------------------------------------------

const MAT_THICKNESS = 2;

function buildSurface(o: WorkbenchOptions, matHalfX: number, matHalfZ: number): THREE.Group {
  const g = new THREE.Group();
  g.name = 'workbench-surface';
  const d = o.detail;
  const deskHex = o.theme === 'light' ? 0xaab3c0 : 0x1d222b;
  part(g, box(1700, 40, 1500), Materials.desk(deskHex), { at: [0, -MAT_THICKNESS - 20, 0], castShadow: false, receiveShadow: true });
  part(g, roundedSlab(matHalfX * 2, matHalfZ * 2, MAT_THICKNESS, 26, d, 0.6), Materials.esdMat(), {
    at: [0, -MAT_THICKNESS, 0],
    castShadow: false,
    receiveShadow: true,
  });
  part(g, roundedFrame(matHalfX * 2 - 16, matHalfZ * 2 - 16, 19, 1.4, d), Materials.esdMatTrim(), { at: [0, 0.04, 0], castShadow: false });

  // Grounding snap in the front-left corner and its coiled cord leaving the mat
  const sx = -matHalfX + 26;
  const sz = matHalfZ - 26;
  part(g, cylinder(10, 10, 0.5, d), Materials.plastic(0x16191e, 0.6), { at: [sx, 0.25, sz], castShadow: false });
  part(g, cylinder(5.2, 6, 2.4, d), Materials.chrome(), { at: [sx, 1.7, sz], castShadow: false });
  part(g, sphere(3.4, d), Materials.chrome(), { at: [sx, 3.2, sz], scale: [1, 0.6, 1], castShadow: false });
  part(g, cylinder(7.5, 7.5, 3.4, d), Materials.plastic(0x16191e, 0.5), { at: [sx, 5.2, sz], castShadow: false });
  const cord: Array<[number, number, number]> = [[sx, 6, sz], [sx - 12, 4, sz + 10]];
  const turns = d === 'low' ? 4 : 9;
  for (let i = 0; i <= turns; i++) {
    cord.push([sx - 26 - i * 9, 2.2 + (i % 2) * 2.2, sz + 18 + Math.sin(i * 1.3) * 5 + i * 3]);
  }
  cord.push([sx - 60 - turns * 9, 1.8 - MAT_THICKNESS, sz + 40 + turns * 3]);
  part(g, cable(`ground-cord-${matHalfX}-${matHalfZ}-${turns}`, cord, 1.5, d), Materials.rubber(0x15171b), { castShadow: false });
  const end = cord[cord.length - 1];
  part(g, cylinder(3, 3, 18, d, { radialFactor: 0.6 }), Materials.plastic(0x84cc16, 0.5), { at: [end[0] - 8, end[1] + 1.4, end[2] + 2], rot: UP_TO_X, castShadow: false });
  part(g, cylinder(1.8, 1.8, 12, d, { radialFactor: 0.6 }), Materials.gold(), { at: [end[0] - 22, end[1] + 1.4, end[2] + 2], rot: UP_TO_X, castShadow: false });
  bakeStatic(g);
  return g;
}

interface Placement {
  item: Item;
  at: [number, number];
  rotY?: number;
  /** Lowest quality that shows the item. */
  from: DetailLevel;
}

const RANK: Record<DetailLevel, number> = { low: 0, balanced: 1, high: 2 };

/**
 * Where each tool sits, in the band between the keep-out area and the mat edge. The default camera
 * looks from (+x, +z) towards (-x, -z): tall items go to the far sides (-x, -z), flat ones to the
 * near sides, so nothing stands between a preset camera and the board.
 */
function placements(o: WorkbenchOptions): Placement[] {
  const x = (offset: number) => o.keepX + offset; // distance past the free area, towards +x
  const z = (offset: number) => o.keepZ + offset;
  return [
    // far side (-z): tall equipment
    { item: benchSupply, at: [-o.keepX * 0.42, -z(66)], from: 'balanced' },
    { item: deskLamp, at: [o.keepX * 0.5, -z(94)], from: 'balanced' },
    // far-left (-x): third hand and the soldering station (iron leaning away from the board)
    { item: thirdHand, at: [-x(36), -o.keepZ * 0.5], rotY: Math.PI / 2, from: 'balanced' },
    { item: solderingStation, at: [-x(50), o.keepZ * 0.5], rotY: Math.PI / 2, from: 'low' },
    // near side (+z) and right (+x): flat items only
    { item: multimeter, at: [x(46), -o.keepZ * 0.3], rotY: 0.05, from: 'low' },
    { item: tweezers, at: [x(36), o.keepZ * 0.55], rotY: 1.2, from: 'balanced' },
    { item: sideCutters, at: [x(48), o.keepZ * 0.9], rotY: 1.9, from: 'balanced' },
    { item: partsBox, at: [o.keepX * 0.3, z(52)], rotY: 0.06, from: 'low' },
    { item: solderSpool, at: [-o.keepX * 0.3, z(34)], from: 'balanced' },
    { item: wireSpools, at: [-o.keepX * 0.8, z(54)], rotY: 0.3, from: 'balanced' },
  ];
}

/**
 * Builds the workbench. Group origin: centre of the mat, y = 0 on the mat surface (the caller puts
 * it just under the board). Dispose it with `disposeObjectTree`: shared library resources are kept.
 */
export function buildWorkbench(o: WorkbenchOptions): THREE.Group {
  const root = new THREE.Group();
  root.name = 'workbench';
  root.userData = { type: 'workbench', sceneOnly: true, signature: workbenchSignature(o) };
  const matHalfX = o.keepX + DECOR_BAND_X;
  const matHalfZ = o.keepZ + DECOR_BAND_Z;
  root.add(buildSurface(o, matHalfX, matHalfZ));

  if (o.decor) {
    const decor = new THREE.Group();
    decor.name = 'workbench-decor';
    const list = placements(o).filter((p) => RANK[o.detail] >= RANK[p.from]);
    for (const p of list) {
      const holder = group(decor, { at: [p.at[0], 0, p.at[1]], rot: [0, p.rotY ?? 0, 0] });
      p.item(holder, o.detail);
    }
    // Decoration never casts into the shadow map: at balanced / high it gets soft contact blobs
    // instead, at low quality no shadow at all
    const blob = Materials.contactShadow();
    const blobs: THREE.Object3D[] = [];
    decor.traverse((object) => {
      object.castShadow = false;
      if (o.detail === 'low' && blob && (object as THREE.Mesh).material === blob) blobs.push(object);
    });
    for (const b of blobs) b.removeFromParent();
    bakeStatic(decor);
    root.add(decor);

    if (o.detail === 'high') {
      // Warm light from the desk lamp onto the work area
      const lamp = placements(o).find((p) => p.item === deskLamp)!;
      const light = new THREE.SpotLight(0xffd9a3, 1.1, 0, 0.62, 0.75, 0);
      light.name = 'workbench-lamp-light';
      light.position.set(lamp.at[0] + LAMP_HEAD[0], LAMP_HEAD[1] - 20, lamp.at[1] + LAMP_HEAD[2]);
      light.target.position.set(0, 0, 0);
      root.add(light);
      root.add(light.target);
    }
  }

  root.scale.setScalar(SCENE_UNITS_PER_MM);
  ignoreRaycast(root);
  return root;
}
