import { buildTo92 } from '../builders/transistorPackages';
import { defineSpec } from './types';

export const transistorNpnSpec = defineSpec({
  id: 'npn-to92',
  definitionIds: ['transistor-npn'],
  reference: 'NPN small-signal transistor in TO-92 (PN2222 / 2N2222 family): body 4.8 x 4.8 mm, formed leads',
  builder: buildTo92,
  params: () => ({ marking: '2N2222', bodyDiameter: 4.8, bodyHeight: 4.8, seat: 4.6, bodyPitch: 1.27 }),
  pins: {},
});
