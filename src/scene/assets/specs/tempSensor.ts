import { buildTo92 } from '../builders/transistorPackages';
import { defineSpec } from './types';

export const tempSensorSpec = defineSpec({
  id: 'lm35-to92',
  definitionIds: ['temp-sensor'],
  reference: 'LM35DZ, TO-92: body 4.8 x 4.8 mm, leads formed to the existing 2.54 mm anchors',
  builder: buildTo92,
  params: () => ({ marking: 'LM35', bodyDiameter: 4.8, bodyHeight: 4.8, seat: 4.6, bodyPitch: 1.27 }),
  pins: {},
});
