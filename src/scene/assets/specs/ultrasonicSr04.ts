import { buildUltrasonicModule } from '../builders/modules';
import { defineSpec } from './types';

export const ultrasonicSr04Spec = defineSpec({
  id: 'hc-sr04',
  definitionIds: ['ultrasonic-sr04'],
  reference: 'HC-SR04 ultrasonic ranging module: PCB 45 x 20 mm, 16 mm transducers 26 mm apart, right-angle 4-pin header',
  builder: buildUltrasonicModule,
  params: () => ({ pcbWidth: 45, pcbHeight: 20, pcbHex: 0x1d4ed8, canDiameter: 16, canLength: 12, canSpacing: 26, marking: 'HC-SR04' }),
  pins: {},
});
