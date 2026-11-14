import { buildRadialCan } from '../builders/radialCan';
import { Materials } from '../materials';
import { defineSpec } from './types';

export const buzzerSpec = defineSpec({
  id: 'buzzer-active-12mm',
  definitionIds: ['buzzer'],
  reference: 'Active magnetic buzzer 12 x 9.5 mm (TMB12A05 class); leads on the existing 5.08 mm anchors',
  builder: buildRadialCan,
  params: (_instance, options) => ({
    diameter: 12,
    height: 9.5,
    standoff: 0.6,
    bodyMaterial: Materials.plastic(0x15171b, 0.5),
    topMaterial: Materials.plastic(0x1b1e24, 0.45),
    port: 1.1,
    plusPin: 'pin_pos',
    // Sound waves only while the solver reports the buzzer as driven
    sounding: Boolean(options.isSimulationOn),
  }),
  pins: {
    pin_pos: { role: 'power', direction: 'down' },
    pin_neg: { role: 'ground', direction: 'down' },
  },
});
