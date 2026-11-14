import { Materials } from '../materials';
import { box, chamferBox, label, leadFlat, part } from '../primitives';
import type { Builder } from '../specs/types';
import { LEAD_DEPTH_MM } from '../units';

/**
 * Miniature slide switch: plastic base, stamped metal shell with a slot, sliding lever and two
 * solder tabs. The lever sits towards `onPin` when the switch is closed.
 */
export interface SlideSwitchParams {
  pinA: string;
  /** The lever moves towards this pin when the switch is ON (closed). */
  onPin: string;
  bodyLength: number;
  bodyDepth: number;
  baseHeight: number;
  shellHeight: number;
  leverTravel: number;
  closed: boolean;
}

export const buildSlideSwitch: Builder<SlideSwitchParams> = (ctx, p) => {
  const d = ctx.detail;
  const g = ctx.group;
  const a = ctx.pin(p.pinA);
  const on = ctx.pin(p.onPin);
  const cx = (a.x + on.x) / 2;
  const cz = (a.z + on.z) / 2;
  const dir = Math.sign(on.x - a.x) || 1;
  // The anchors sit on the tabs just under the body
  const baseBottom = a.y + 0.4;
  const shellBottom = baseBottom + p.baseHeight;
  const top = shellBottom + p.shellHeight;
  const black = Materials.plastic(0x1b1e24, 0.6);
  const steel = Materials.steel();

  part(g, box(p.bodyLength, p.baseHeight, p.bodyDepth), black, { at: [cx, baseBottom + p.baseHeight / 2, cz] });
  part(g, chamferBox(p.bodyLength, p.shellHeight, p.bodyDepth + 0.1, 0.35, d), steel, { at: [cx, shellBottom + p.shellHeight / 2, cz] });
  // Slot in the shell and the four crimp tabs folded over the base
  part(g, box(p.leverTravel * 2 + 2.6, 0.08, 2.1), Materials.flat(0x0b0d11), { at: [cx, top + 0.03, cz], castShadow: false });
  if (d !== 'low') {
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        part(g, box(1.5, p.baseHeight + 0.5, 0.25), steel, {
          at: [cx + sx * p.bodyLength * 0.3, baseBottom + p.baseHeight / 2 + 0.1, cz + sz * (p.bodyDepth / 2 + 0.1)],
          castShadow: false,
        });
      }
    }
    label(g, 'ON', 2.6, 1.3, { at: [cx + dir * (p.bodyLength / 2 - 1.5), top + 0.02, cz + p.bodyDepth / 2 - 0.8], color: '#111827' });
  }

  // Lever: its own mesh, the scene toggles the switch when it is clicked
  part(g, chamferBox(2.2, 3.2, 1.9, 0.3, d), black, {
    at: [cx + dir * (p.closed ? p.leverTravel : -p.leverTravel), top + 1.3, cz],
    name: 'switch-toggle-knob',
    dynamic: true,
    userData: { type: 'switch-toggle', componentId: ctx.instance.instanceId },
  });

  for (const pin of ctx.pins) {
    part(g, leadFlat(baseBottom, LEAD_DEPTH_MM, 0.9, 0.35), Materials.tin(), { at: [pin.position.x, 0, pin.position.z], castShadow: false });
  }
};
