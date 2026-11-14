import { SceneMaterialRegistry } from '../../materials';
import type { ComponentMeshOptions } from '../../models/types';
import { buildRadialLed } from '../builders/radialLed';
import { drawLevel } from './simulation';
import { defineSpec } from './types';

const GLOW_HEX: Record<string, number> = { red: 0xff0000, green: 0x00ff44, blue: 0x0088ff, yellow: 0xffcc00, white: 0xffffff };

/** Light level to draw, taken ONLY from the solver result (`visual.brightness`, 1 = rated 20 mA). */
export function ledLevel(options: ComponentMeshOptions): number {
  return drawLevel(options.visual?.brightness ?? (options.isSimulationOn ? 1 : 0), options);
}

export const led5mmSpec = defineSpec({
  id: 'led-5mm-round',
  definitionIds: ['led', 'led_basic'],
  reference: 'T-1 3/4 (5 mm) round LED: lens dia 5.0, flange dia 5.8 x 1.0, height 8.6, leads 0.5 mm square at 2.54 mm',
  builder: buildRadialLed,
  params: (instance, options) => {
    const color = String(instance.parameters?.color || 'red');
    const level = ledLevel(options);
    const lit = Boolean(options.isSimulationOn) && level > 0.04;
    const registry = SceneMaterialRegistry.getInstance();
    return {
      anodePin: 'anode',
      cathodePin: 'cathode',
      lensDiameter: 5.0,
      lensHeight: 8.6,
      flangeDiameter: 5.8,
      flangeHeight: 1.0,
      leadSide: 0.5,
      standoff: 2.6,
      anodeBelow: 4.5,
      cathodeBelow: 3.8,
      lensMaterial: registry.getLedMaterial(color, lit),
      lensOffMaterial: registry.getLedMaterial(color, false),
      glow: lit ? { hex: GLOW_HEX[color] ?? GLOW_HEX.red, level } : null,
    };
  },
  pins: {
    anode: { role: 'power', direction: 'down' },
    cathode: { role: 'ground', direction: 'down' },
  },
});
