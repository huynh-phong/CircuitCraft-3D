import { buildMicroServo } from '../builders/modules';
import { defineSpec } from './types';

export const servoSg90Spec = defineSpec({
  id: 'micro-servo-sg90',
  definitionIds: ['servo-sg90'],
  reference: 'SG90 micro servo: case 22.5 x 12.2 x 22.7 mm, 32 mm across the mounting ears; 3-pin housing on the existing anchors',
  builder: buildMicroServo,
  params: (instance, options) => {
    const p = instance.parameters || {};
    return {
      length: 22.5,
      width: 12.2,
      height: 22.7,
      caseHex: 0x1e63c9,
      // The solved control pulse when one is received, otherwise the angle stored on the part
      angleDeg: options.visual?.angleDeg ?? Number(p.angle ?? p.targetAngle ?? 90),
      wires: { pwm: 0xf97316, vcc: 0xdc2626, gnd: 0x7a4a1e },
      marking: 'SG90',
    };
  },
  pins: {},
});
