import { buildTo220 } from '../builders/transistorPackages';
import { defineSpec } from './types';

export const voltageReg7805Spec = defineSpec({
  id: 'lm7805-to220',
  definitionIds: ['voltage-reg-7805'],
  reference: 'L7805CV, TO-220: body 10 x 9.2 x 4.5 mm, tab 6.4 mm with 3.7 mm hole, 2.54 mm lead pitch',
  builder: buildTo220,
  params: () => ({ marking: 'L7805CV', bodyWidth: 10, bodyHeight: 9.2, bodyDepth: 4.5, tabHeight: 6.4, seat: 4.0 }),
  pins: {},
});
