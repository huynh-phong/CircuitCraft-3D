import { buildRadialCan } from '../builders/radialCan';
import { Materials } from '../materials';
import { defineSpec } from './types';

export const capacitorSpec = defineSpec({
  id: 'capacitor-electrolytic-8x11',
  definitionIds: ['capacitor'],
  reference: 'Radial aluminium electrolytic capacitor, 8 x 11.5 mm can; leads on the existing 5.08 mm anchors',
  builder: buildRadialCan,
  params: () => ({
    diameter: 8,
    height: 11.5,
    standoff: 1.0,
    bodyMaterial: Materials.paint(0x17233a, 0.35),
    topMaterial: Materials.tin(),
    stripe: { pin: 'pin_neg', hex: 0xe5e7eb },
    vent: true,
  }),
  pins: {
    pin_pos: { role: 'power', direction: 'down' },
    pin_neg: { role: 'ground', direction: 'down' },
  },
});
