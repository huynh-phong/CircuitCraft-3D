import { buildRelay } from '../builders/boxParts';
import { defineSpec } from './types';

export const relaySpec = defineSpec({
  id: 'relay-spdt-sugar-cube',
  definitionIds: ['relay'],
  reference: 'SRD-05VDC-SL-C PCB relay: 19 x 15.2 x 15 mm; legs on the existing anchors',
  builder: buildRelay,
  params: () => ({
    length: 19,
    width: 15.2,
    height: 14.6,
    caseHex: 0x1d5fbf,
    marking: 'SRD-05VDC-SL-C',
    coilMarking: '5VDC  10A',
  }),
  pins: {
    coil_pos: { role: 'power' },
    coil_neg: { role: 'ground' },
  },
});
