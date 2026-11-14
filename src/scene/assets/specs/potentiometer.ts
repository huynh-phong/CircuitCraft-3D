import { buildPotentiometer } from '../builders/potentiometer';
import { defineSpec } from './types';

export const potentiometerSpec = defineSpec({
  id: 'potentiometer-rotary',
  definitionIds: ['potentiometer'],
  reference: 'Single-turn rotary potentiometer (9 mm class): body dia 10.4, bushing M7, knurled shaft dia 6, 300 degree travel; tabs on the existing triangular anchors',
  builder: buildPotentiometer,
  params: (instance) => {
    const p = instance.parameters || {};
    // Same reading as the solver: currentPosition (0..1), else the stored state value (0..100), else mid travel
    const stored = instance.state?.value !== undefined ? instance.state.value / 100 : undefined;
    const position = Number(p.currentPosition ?? stored ?? 0.5);
    return {
      bodyDiameter: 10.4,
      baseHeight: 1.2,
      canHeight: 3.4,
      bushingDiameter: 6.8,
      bushingHeight: 1.6,
      shaftDiameter: 6.0,
      shaftHeight: 5.6,
      sweepDeg: 300,
      position: Number.isFinite(position) ? position : 0.5,
      baseHex: 0x1f2937,
    };
  },
  pins: {
    pin1: { role: 'passive', direction: 'down' },
    wiper: { role: 'analog', direction: 'down' },
    pin2: { role: 'passive', direction: 'down' },
  },
});
