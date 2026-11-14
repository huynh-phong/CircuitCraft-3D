import { buildRgbLed } from '../builders/displays';
import { drawLevel } from './simulation';
import { defineSpec } from './types';

export const rgbLedSpec = defineSpec({
  id: 'rgb-led-5mm',
  definitionIds: ['rgb-led'],
  reference: '5 mm diffused RGB LED, common cathode: lens dia 5.0 x 8.6 mm; leads formed to the existing 2.54 mm anchors',
  builder: buildRgbLed,
  params: (_instance, options) => {
    const solved = options.visual?.rgb || [0, 0, 0];
    return {
      lensDiameter: 5.0,
      lensHeight: 8.6,
      flangeDiameter: 5.8,
      flangeHeight: 1.0,
      standoff: 3.0,
      bodyPitch: 1.27,
      commonPin: 'cathode',
      rgb: [0, 1, 2].map((i) => Math.min(1, drawLevel(solved[i], options))) as [number, number, number],
    };
  },
  pins: {
    cathode: { role: 'ground' },
  },
});
