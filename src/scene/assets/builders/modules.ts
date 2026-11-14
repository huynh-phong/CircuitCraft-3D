import { Materials } from '../materials';
import { box, cable, chamferBox, cylinder, cylinderZ, disc, extrude, group, label, part } from '../primitives';
import { pick } from '../quality';
import type { Builder } from '../specs/types';
import { ALONG_Z, FACE_BACK, FACE_FRONT, pinCentre, straightLeads } from './common';

/**
 * HC-SR04 style ultrasonic module: PCB standing upright behind a right-angle header, two
 * transducer cans looking towards -z, crystal between them.
 */
export interface UltrasonicModuleParams {
  pcbWidth: number;
  pcbHeight: number;
  pcbHex: number;
  canDiameter: number;
  canLength: number;
  canSpacing: number;
  marking: string;
}

export const buildUltrasonicModule: Builder<UltrasonicModuleParams> = (ctx, p) => {
  const d = ctx.detail;
  const g = ctx.group;
  const header = pinCentre(ctx.pins);
  const pinY = ctx.pins[0].position.y;
  const pcbZ = header.z - 1.6; // PCB just in front of the header
  const pcbBottom = pinY - 1.2;
  const cy = pcbBottom + p.pcbHeight / 2;
  const front = pcbZ - 0.8;
  part(g, box(p.pcbWidth, p.pcbHeight, 1.6), Materials.pcb(p.pcbHex), { at: [0, cy, pcbZ] });

  const R = p.canDiameter / 2;
  for (const s of [-1, 1]) {
    const x = (s * p.canSpacing) / 2;
    part(g, cylinder(R, R, p.canLength, d), Materials.steel(), { at: [x, cy + 0.6, front - p.canLength / 2], rot: ALONG_Z });
    // Mesh grille in the mouth of the can
    part(g, disc(R * 0.86, d), Materials.flat(0x1a1d22), { at: [x, cy + 0.6, front - p.canLength - 0.03], rot: FACE_BACK, castShadow: false });
    if (d !== 'low') part(g, disc(R * 0.3, d), Materials.steel(), { at: [x, cy + 0.6, front - p.canLength - 0.06], rot: FACE_BACK, castShadow: false });
  }
  part(g, chamferBox(10, 3.6, 3.2, 0.8, d), Materials.steel(), { at: [0, pcbBottom + p.pcbHeight - 3.2, front - 1.6] });
  if (d !== 'low') {
    label(g, p.marking, 14, 2.2, { at: [0, pcbBottom + 2.6, front - 0.02], rot: FACE_BACK, color: '#ffffff', font: '700 sans-serif' });
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        part(g, disc(1.0, d), Materials.flat(0x05070a), { at: [sx * (p.pcbWidth / 2 - 1.8), cy + sy * (p.pcbHeight / 2 - 1.8), front - 0.02], rot: FACE_BACK, castShadow: false });
      }
    }
  }

  // Right-angle header on the back of the PCB: plastic body, pins down into the board
  part(g, box(ctx.pins.length * 2.54, 2.5, 2.5), Materials.plastic(0x15171b, 0.6), { at: [header.x, pinY + 0.2, header.z + 0.45], castShadow: false });
  for (const pin of ctx.pins) {
    part(g, box(0.64, 0.64, 2.2), Materials.tin(), { at: [pin.position.x, pinY + 0.2, header.z - 0.3], castShadow: false });
  }
  straightLeads(ctx, pinY + 0.5, { flat: [0.64, 0.64] });
};

/**
 * Micro servo (SG90 class): case with mounting ears, output turret with a single-arm horn turned to
 * the commanded angle, and a three-wire lead ending in a pin housing that sits on the pin anchors.
 */
export interface MicroServoParams {
  length: number;
  width: number;
  height: number;
  caseHex: number;
  /** Horn angle in degrees (0..180), from the solver when it drives the servo. */
  angleDeg: number;
  /** Wire colour per pin id. */
  wires: Record<string, number>;
  marking: string;
}

export const buildMicroServo: Builder<MicroServoParams> = (ctx, p) => {
  const d = ctx.detail;
  const g = ctx.group;
  const bottom = 1;
  const top = bottom + p.height;
  const plastic = Materials.plastic(p.caseHex, 0.36);
  const white = Materials.plastic(0xf1f5f9, 0.4);
  part(g, chamferBox(p.length, p.height, p.width, 0.5, d), plastic, { at: [0, bottom + p.height / 2, 0] });
  // Mounting ears with screw holes
  const earY = bottom + p.height * 0.7;
  part(g, box(p.length + 9.4, 2.4, p.width), plastic, { at: [0, earY, 0] });
  for (const s of [-1, 1]) part(g, disc(1.1, d), Materials.flat(0x05070a), { at: [s * (p.length / 2 + 2.4), earY + 1.22, 0], castShadow: false });
  // Gear housing on top and the output shaft
  const shaftX = p.length / 2 - 6;
  part(g, cylinder(5.9, 5.9, 4, d), plastic, { at: [shaftX, top + 2, 0] });
  part(g, cylinder(2.6, 2.6, 4, d), plastic, { at: [shaftX - 6.2, top + 2, 0] });
  part(g, cylinder(2.3, 2.3, 3, d, { radialFactor: 0.7 }), white, { at: [shaftX, top + 5.3, 0] });
  // Horn: same convention as before (90° = arm along +x)
  const angle = Number.isFinite(p.angleDeg) ? p.angleDeg : 90;
  const horn = group(g, { at: [shaftX, top + 6.4, 0], rot: [0, ((90 - angle) * Math.PI) / 180, 0] });
  part(horn, cylinder(3.4, 3.4, 1.6, d), white, {});
  part(horn, chamferBox(15, 1.4, 4.2, 1.2, d), white, { at: [6.5, 0, 0] });
  part(horn, cylinder(0.9, 0.9, 0.5, d, { radialFactor: 0.6 }), Materials.steel(), { at: [0, 0.9, 0], castShadow: false });
  if (d !== 'low') {
    label(g, p.marking, 12, 4.4, { at: [-2, bottom + p.height * 0.36, p.width / 2 + 0.03], rot: FACE_FRONT, color: '#0f2a5c', background: '#f1f5f9', font: '700 sans-serif' });
  }

  // Lead: out of the case side, round to the pin housing standing on the anchors
  const header = pinCentre(ctx.pins);
  const pinY = ctx.pins[0].position.y;
  const housingTop = pinY + 5;
  part(g, box(ctx.pins.length * 2.54, 6, 2.5), Materials.plastic(0x15171b, 0.6), { at: [header.x, pinY + 2, header.z] });
  straightLeads(ctx, pinY - 0.6, { flat: [0.64, 0.64] });
  const exit: [number, number, number] = [-p.length / 2 - 0.1, bottom + 2.2, 0];
  for (const pin of ctx.pins) {
    const dx = pin.position.x - header.x;
    part(
      g,
      cable(
        `servo-wire-${pin.id}-${pin.position.x}-${pin.position.z}`,
        [
          [exit[0], exit[1], exit[2] + dx * 0.35],
          [exit[0] - 3.4, exit[1] - 0.6, 3 + dx * 0.3],
          [exit[0] + 1, housingTop + 1.5, header.z + 2.6],
          [pin.position.x, housingTop + 2.4, header.z + 1.2],
          [pin.position.x, housingTop - 0.2, header.z],
        ],
        0.45,
        d
      ),
      Materials.rubber(p.wires[pin.id] ?? 0x6b7280),
      { castShadow: false }
    );
  }
};

/**
 * Small brushed DC motor (130 size): flat-sided steel can along z, plastic end cap carrying the
 * two terminals on the pin anchors, shaft towards -z. The scene spins the shaft at the SOLVED rpm.
 */
export interface DcMotorParams {
  canDiameter: number;
  canFlatHeight: number;
  canLength: number;
  capLength: number;
  capHex: number;
  shaftDiameter: number;
  shaftLength: number;
  /** Revolutions per minute from the solver; 0 = at rest. */
  rpm: number;
}

export const buildDcMotor: Builder<DcMotorParams> = (ctx, p) => {
  const d = ctx.detail;
  const g = ctx.group;
  const terminals = pinCentre(ctx.pins);
  const R = p.canDiameter / 2;
  const hy = p.canFlatHeight / 2;
  const cy = 0.4 + hy;
  // The end cap ends just behind the terminals; everything else follows from there
  const capEnd = terminals.z + 1.0;
  const capStart = capEnd - p.capLength;
  const canStart = capStart - p.canLength;

  // Cross-section: a circle with flats top and bottom
  const steps = pick(d, 4, 7, 12);
  const a0 = Math.asin(hy / R);
  const section: Array<[number, number]> = [];
  for (const side of [0, Math.PI]) {
    for (let i = 0; i <= steps; i++) {
      const a = side - a0 + (i / steps) * 2 * a0;
      section.push([Math.cos(a) * R, Math.sin(a) * R]);
    }
  }
  const can = extrude(`motor-can-${p.canDiameter}-${p.canFlatHeight}`, section, 1, d);
  // extrude() grows along +Y from 0..1: lay it along +Z and stretch to the length
  part(g, can, Materials.steel(), { at: [terminals.x, cy, canStart], rot: ALONG_Z, scale: [1, p.canLength, 1] });
  part(g, can, Materials.plastic(p.capHex, 0.5), { at: [terminals.x, cy, capStart], rot: ALONG_Z, scale: [0.97, p.capLength, 0.97] });
  // Front bearing boss and two vent slots
  part(g, cylinderZ(3.1, 2, d, 0.7), Materials.steel(), { at: [terminals.x, cy, canStart - 1] });
  if (d !== 'low') {
    for (const s of [-1, 1]) {
      part(g, box(0.1, 3.6, p.canLength * 0.42), Materials.flat(0x0b0d11), { at: [terminals.x + s * (R + 0.02), cy, canStart + p.canLength * 0.5], castShadow: false });
    }
  }
  // Terminals: brass tabs through the end cap, ending on the pin anchors
  for (const pin of ctx.pins) {
    part(g, box(1.8, 0.4, 3.2), Materials.brass(), { at: [pin.position.x, pin.position.y, pin.position.z + 0.2], castShadow: false });
  }

  // Shaft with a flag so the rotation is visible; rotated around z by the scene loop
  const shaft = part(g, cylinderZ(p.shaftDiameter / 2, p.shaftLength, d, 0.7), Materials.tin(), {
    at: [terminals.x, cy, canStart - 2 - p.shaftLength / 2],
    dynamic: true,
  });
  part(shaft, box(6, 0.8, 0.8), Materials.paint(0xfacc15, 0.4), { at: [2.5, 0, -p.shaftLength / 2 + 1], castShadow: false });
  if (p.rpm) shaft.userData.spinRpm = p.rpm;
};
