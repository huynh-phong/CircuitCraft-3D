import * as THREE from 'three';
import { Materials } from '../materials';
import { box, cylinder, domeProfile, extrude, group, lathe, leadFlat, part, sphere } from '../primitives';
import { pick } from '../quality';
import type { Builder } from '../specs/types';

/**
 * Round through-hole LED (T-1 3 mm, T-1¾ 5 mm): clear epoxy lens with a flange, a flat on the
 * cathode side, two square leads and the lead frame (anvil + post) visible inside the lens.
 */
export interface RadialLedParams {
  anodePin: string;
  cathodePin: string;
  lensDiameter: number;
  /** Flange underside to the top of the dome. */
  lensHeight: number;
  flangeDiameter: number;
  flangeHeight: number;
  leadSide: number;
  /** Clearance between the board and the flange. */
  standoff: number;
  /** Lead length under the board; the anode lead is the longer one. */
  anodeBelow: number;
  cathodeBelow: number;
  /** Epoxy material now and when dark (the scene swaps them while blinking). */
  lensMaterial: THREE.Material;
  lensOffMaterial: THREE.Material;
  /** Light emitted, from the SOLVED LED current only. `level` 1 = rated current. Null when dark. */
  glow: { hex: number; level: number } | null;
}

export const buildRadialLed: Builder<RadialLedParams> = (ctx, p) => {
  const anode = ctx.pin(p.anodePin);
  const cathode = ctx.pin(p.cathodePin);
  const pitch = Math.hypot(cathode.x - anode.x, cathode.z - anode.z);
  const R = p.lensDiameter / 2;
  const base = p.standoff;
  const lensBottom = base + p.flangeHeight;
  const cylinderHeight = p.lensHeight - p.flangeHeight - R;
  const tin = Materials.tin();

  // Local frame: origin on the board midway between the leads, +x towards the cathode
  const led = group(ctx.group, {
    at: [(anode.x + cathode.x) / 2, 0, (anode.z + cathode.z) / 2],
    rot: [0, Math.atan2(-(cathode.z - anode.z), cathode.x - anode.x), 0],
  });

  // Flange with the cathode flat (a chord cut on +x)
  const fr = p.flangeDiameter / 2;
  const cut = Math.acos((fr - 0.45) / fr);
  const flange = new THREE.Shape();
  flange.absarc(0, 0, fr, cut, Math.PI * 2 - cut, false);
  flange.closePath();
  part(led, extrude(`led-flange-${p.flangeDiameter}`, flange, p.flangeHeight, ctx.detail, { curveSegments: pick(ctx.detail, 8, 14, 22) }), p.lensMaterial, {
    at: [0, base, 0],
    dynamic: true,
    castShadow: false,
    userData: { blinkOn: p.lensMaterial, blinkOff: p.lensOffMaterial },
  });

  // Lens: straight barrel + hemispherical dome, one body of revolution
  const lens = lathe(
    `led-lens-${p.lensDiameter}-${p.lensHeight}`,
    [[R, 0], [R, cylinderHeight], ...domeProfile(R, cylinderHeight, pick(ctx.detail, 3, 6, 10)).slice(1)],
    ctx.detail,
    1.3
  );
  part(led, lens, p.lensMaterial, {
    at: [0, lensBottom, 0],
    dynamic: true,
    userData: { blinkOn: p.lensMaterial, blinkOff: p.lensOffMaterial },
  });

  // Leads: square wire from under the board up into the lens
  const inside = lensBottom + cylinderHeight * 0.42;
  part(led, leadFlat(inside, p.anodeBelow, p.leadSide, p.leadSide), tin, { at: [-pitch / 2, 0, 0] });
  part(led, leadFlat(inside, p.cathodeBelow, p.leadSide, p.leadSide), tin, { at: [pitch / 2, 0, 0] });
  if (ctx.detail !== 'low') {
    // Tie-bar stops just under the flange
    part(led, box(p.leadSide * 1.9, 0.55, p.leadSide), tin, { at: [-pitch / 2, base - 0.5, 0], castShadow: false });
    part(led, box(p.leadSide * 1.9, 0.55, p.leadSide), tin, { at: [pitch / 2, base - 0.5, 0], castShadow: false });
  }

  // Lead frame inside the epoxy: the large anvil (cathode) carries the die in a reflector cup,
  // the small post (anode) is bonded to it
  const anvilY = inside + 0.75;
  part(led, box(pitch * 0.62, 1.5, p.leadSide), tin, { at: [pitch / 2 - pitch * 0.2, anvilY, 0], castShadow: false });
  part(led, cylinder(0.72, 0.4, 0.5, ctx.detail, { radialFactor: 0.6 }), tin, { at: [pitch * 0.1, anvilY + 1.0, 0], castShadow: false });
  part(led, box(pitch * 0.22, 1.15, p.leadSide), tin, { at: [-pitch / 2 + pitch * 0.02, anvilY - 0.1, 0], castShadow: false });

  if (p.glow) {
    const k = Math.min(1.5, p.glow.level);
    const top = lensBottom + cylinderHeight;
    const light = new THREE.PointLight(p.glow.hex, 2.5 * k, 40, 1.5);
    light.name = 'sim-glow';
    light.position.set(0, top + R * 0.4, 0);
    led.add(light);
    part(led, sphere(R * 1.4, ctx.detail), Materials.halo(p.glow.hex, Math.round(0.35 * Math.min(1, k) * 20)), {
      at: [0, top, 0],
      name: 'sim-glow',
      dynamic: true,
      castShadow: false,
    });
  }
};
