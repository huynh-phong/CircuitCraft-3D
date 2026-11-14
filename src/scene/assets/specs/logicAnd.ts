import { buildDipIc } from '../builders/dipIc';
import { defineSpec } from './types';

export const logicAndSpec = defineSpec({
  id: '74hc08-dip14',
  definitionIds: ['logic-and'],
  reference: '74HC08 quad 2-input AND, PDIP-14: body 19.3 x 6.35 x 3.3 mm, 2.54 mm pitch',
  builder: buildDipIc,
  params: () => ({ pin1: 'in_a', bodyWidth: 6.35, bodyHeight: 3.3, standoff: 1.0, marking: '74HC08N' }),
  pins: {},
});
