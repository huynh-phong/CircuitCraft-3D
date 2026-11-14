import { buildBatteryHolder } from '../builders/batteryHolder';
import { defineSpec } from './types';

/**
 * DC source drawn as a two-cell battery holder.
 *
 * NOTE: the tray is sized to the existing domain footprint (30 x 20 mm, used by DRC collision
 * checks) and its terminals sit on the existing anchors (x = ±8, y = 3). A real 2 x AA holder is
 * about 58 x 32 mm, so the cells are drawn smaller than AA. Changing that needs a decision on the
 * domain definition, which this visual task must not touch.
 */
export const dcSourceSpec = defineSpec({
  id: 'battery-holder-2cell',
  definitionIds: ['dc-source'],
  reference: 'Open 2-cell holder with solder lugs; proportions of a Keystone 2-cell holder scaled to the 30 x 20 mm footprint',
  builder: buildBatteryHolder,
  params: () => ({
    positivePin: 'vcc',
    negativePin: 'gnd',
    length: 30,
    width: 20,
    wallHeight: 6.4,
    wall: 1.0,
    floor: 1.2,
    cellDiameter: 6.6,
    channelWidth: 4.4,
    trayHex: 0x16181d,
    cellHex: 0x1d5fbf,
    cellBandHex: 0xd9dde3,
  }),
  pins: {
    vcc: { role: 'power', direction: 'up' },
    gnd: { role: 'ground', direction: 'up' },
  },
});
