import { Materials } from '../materials';
import { box, cable, chamferBox, cylinder, label, part, slottedScrew, spring } from '../primitives';
import type { Builder } from '../specs/types';

/**
 * Open two-cell battery holder: black tray, two cells in series (positive nub on opposite ends),
 * coil springs on the negative contacts, plates on the positive ones, a bridge strap, and red /
 * black leads running to two solder lugs that sit exactly on the pin anchors.
 */
export interface BatteryHolderParams {
  positivePin: string;
  negativePin: string;
  /** Outer size of the tray. */
  length: number;
  width: number;
  wallHeight: number;
  wall: number;
  floor: number;
  cellDiameter: number;
  /** Width of the wiring channel between the two cells. */
  channelWidth: number;
  trayHex: number;
  cellHex: number;
  cellBandHex: number;
}

export const buildBatteryHolder: Builder<BatteryHolderParams> = (ctx, p) => {
  const d = ctx.detail;
  const pos = ctx.pin(p.positivePin);
  const neg = ctx.pin(p.negativePin);
  const g = ctx.group;
  const tray = Materials.plastic(p.trayHex, 0.62);
  const tin = Materials.tin();
  const L = p.length;
  const W = p.width;
  const innerHalf = L / 2 - p.wall;

  // ---- Tray ----
  part(g, chamferBox(L, p.floor, W, 0.3, d), tray, { at: [0, p.floor / 2, 0], receiveShadow: true });
  for (const s of [-1, 1]) {
    part(g, box(L, p.wallHeight, p.wall), tray, { at: [0, p.wallHeight / 2, s * (W / 2 - p.wall / 2)] });
    part(g, box(p.wall, p.wallHeight, W - 2 * p.wall), tray, { at: [s * (L / 2 - p.wall / 2), p.wallHeight / 2, 0] });
  }

  // ---- Wiring channel with the two terminals on the pin anchors ----
  const lugY = pos.y; // anchor height from the domain definition
  const plinthTop = lugY - 0.35;
  part(g, box(L - 2 * p.wall - 5, plinthTop - p.floor, p.channelWidth), tray, { at: [0, (plinthTop + p.floor) / 2, 0] });
  for (const [pin, text, color] of [
    [pos, '+', '#f87171'],
    [neg, '−', '#e5e7eb'],
  ] as const) {
    part(g, cylinder(1.25, 1.25, 0.35, d), Materials.brass(), { at: [pin.x, plinthTop + 0.175, pin.z], castShadow: false });
    slottedScrew(g, [pin.x, lugY + 0.3, pin.z], 0.8, d, Materials.steel(), Materials.flat(0x111318));
    if (d !== 'low') {
      const out = Math.sign(pin.x) || 1;
      label(g, text, 2.4, 2.4, { at: [pin.x - out * 3.4, plinthTop + 0.03, pin.z], color });
    }
  }

  // ---- Cells, axis along x. Cell A (z < 0) has its positive nub at -x, cell B at +x ----
  const R = p.cellDiameter / 2;
  const cellZ = p.channelWidth / 2 + R + 0.05;
  const cellY = p.floor + R + 0.15;
  const springLength = 3.0;
  const plate = 0.4;
  const nub = 0.8;
  const cellLength = innerHalf * 2 - springLength - plate - nub - 0.3;
  const wrap = Materials.paint(p.cellHex, 0.38);
  for (const s of [-1, 1]) {
    // `s` = which end (+x / -x) carries the positive nub: cell A (z<0) -> -x, cell B (z>0) -> +x
    const z = s * cellZ;
    const positiveEnd = s; // -1 for cell A, +1 for cell B
    const bodyCentre = positiveEnd * (innerHalf - plate - nub - cellLength / 2);
    const sideways: [number, number, number] = [0, 0, Math.PI / 2];
    part(g, cylinder(R, R, cellLength, d), wrap, { at: [bodyCentre, cellY, z], rot: sideways });
    part(g, cylinder(R + 0.03, R + 0.03, cellLength * 0.2, d, { open: true }), Materials.paint(p.cellBandHex, 0.4), {
      at: [bodyCentre + positiveEnd * cellLength * 0.22, cellY, z],
      rot: sideways,
      castShadow: false,
    });
    // steel end caps + positive nub
    if (d !== 'low') {
      part(g, cylinder(R * 0.92, R * 0.92, 0.12, d), Materials.steel(), { at: [bodyCentre + positiveEnd * (cellLength / 2 + 0.03), cellY, z], rot: sideways, castShadow: false });
      part(g, cylinder(R * 0.92, R * 0.92, 0.12, d), Materials.steel(), { at: [bodyCentre - positiveEnd * (cellLength / 2 + 0.03), cellY, z], rot: sideways, castShadow: false });
    }
    part(g, cylinder(R * 0.32, R * 0.32, nub, d, { radialFactor: 0.7 }), Materials.steel(), {
      at: [bodyCentre + positiveEnd * (cellLength / 2 + nub / 2), cellY, z],
      rot: sideways,
      castShadow: false,
    });
    // positive contact plate, negative coil spring (its axis runs from the wall to the cell)
    part(g, box(plate, R * 1.5, R * 1.5), tin, { at: [positiveEnd * (innerHalf - plate / 2), cellY, z], castShadow: false });
    if (d === 'low') {
      // Low detail: a plain contact stub instead of the coil spring
      part(g, box(springLength, R * 0.9, R * 0.9), tin, { at: [-positiveEnd * (innerHalf - springLength / 2), cellY, z], castShadow: false });
    } else {
      part(g, spring(R * 0.62, 0.22, 3.5, springLength, d), tin, {
        at: [-positiveEnd * innerHalf, cellY, z],
        rot: [0, 0, -positiveEnd * (Math.PI / 2)],
        castShadow: false,
      });
    }
  }

  // Bridge strap at +x: negative spring of cell A to the positive plate of cell B (series)
  part(g, box(0.3, 1.0, cellZ * 2), tin, { at: [innerHalf - 0.16, p.floor + 0.6, 0], castShadow: false });

  // ---- Leads: red from cell A's positive plate (-x end), black from cell B's spring (-x end) ----
  const wireR = 0.42;
  const wy = plinthTop + wireR;
  const end = -innerHalf + 0.6;
  part(
    g,
    cable('bat-red', [[end, cellY - 0.6, -cellZ + 0.4], [end + 0.9, wy + 0.5, -1.4], [pos.x - 2.2, wy, -0.7], [pos.x - 0.9, wy, pos.z]], wireR, d),
    Materials.rubber(0xc81e1e),
    { castShadow: false }
  );
  const side = p.channelWidth / 2 - wireR - 0.05;
  part(
    g,
    cable(
      'bat-black',
      [[end, cellY - 0.6, cellZ - 0.4], [end + 0.9, wy + 0.5, side + 0.2], [pos.x - 1.5, wy, side], [pos.x + 2.5, wy, side], [neg.x - 2.4, wy, side * 0.7], [neg.x - 0.9, wy, neg.z]],
      wireR,
      d
    ),
    Materials.rubber(0x16181d),
    { castShadow: false }
  );
};
