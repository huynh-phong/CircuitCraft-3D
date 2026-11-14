import { buildLdr } from '../builders/boxParts';
import { defineSpec } from './types';

export const ldrSpec = defineSpec({
  id: 'ldr-cds-disc',
  definitionIds: ['ldr'],
  reference: 'CdS photoresistor (GL55 series) drawn with a 6.6 mm head to span the existing 5.08 mm anchors',
  builder: buildLdr,
  params: () => ({ headDiameter: 6.6, headHeight: 1.9, seat: 5.0 }),
  pins: {},
});
