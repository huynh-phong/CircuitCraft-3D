import { buildAxial } from '../builders/axial';
import { Materials } from '../materials';
import { defineSpec } from './types';

export const diodeSpec = defineSpec({
  id: 'diode-do41',
  definitionIds: ['diode'],
  reference: '1N4007 rectifier, DO-41 package: body 5.2 x 2.7 mm, lead 0.8 mm',
  builder: buildAxial,
  params: () => ({
    pinA: 'anode',
    pinB: 'cathode',
    bodyLength: 5.2,
    bodyDiameter: 2.7,
    leadDiameter: 0.8,
    standoff: 1.0,
    shape: 'cylinder' as const,
    bodyMaterial: Materials.plastic(0x18181b, 0.5),
    // Silver band on the cathode end
    bands: [{ hex: 0xe2e8f0, metallic: true, offset: 1.75, width: 0.85 }],
  }),
  pins: {
    anode: { role: 'power', direction: 'side' },
    cathode: { role: 'ground', direction: 'side' },
  },
});
