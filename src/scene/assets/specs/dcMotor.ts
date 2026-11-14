import { buildDcMotor } from '../builders/modules';
import { defineSpec } from './types';

export const dcMotorSpec = defineSpec({
  id: 'dc-motor-130',
  definitionIds: ['dc-motor'],
  reference: 'FA-130 size brushed DC motor: can 20.4 x 15.1 mm, about 25 mm long, 2 mm shaft',
  builder: buildDcMotor,
  params: (_instance, options) => ({
    canDiameter: 20.4,
    canFlatHeight: 15.1,
    canLength: 17,
    capLength: 4,
    capHex: 0xe5e7eb,
    shaftDiameter: 2,
    shaftLength: 8,
    rpm: options.visual?.rpm ?? 0,
  }),
  pins: {},
});
