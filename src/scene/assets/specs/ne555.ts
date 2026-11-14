import { buildDipIc } from '../builders/dipIc';
import { defineSpec } from './types';

export const ne555Spec = defineSpec({
  id: 'ne555-dip8',
  definitionIds: ['ne555'],
  reference: 'NE555P, PDIP-8: body 9.8 x 6.35 x 3.3 mm, 2.54 mm pitch, 7.62 mm row spacing',
  builder: buildDipIc,
  params: () => ({ pin1: 'gnd', bodyWidth: 6.35, bodyHeight: 3.3, standoff: 1.0, marking: 'NE555P' }),
  pins: {},
});
