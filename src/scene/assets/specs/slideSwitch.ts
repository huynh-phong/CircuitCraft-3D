import { buildSlideSwitch } from '../builders/slideSwitch';
import { defineSpec } from './types';

export const slideSwitchSpec = defineSpec({
  id: 'slide-switch-spst',
  definitionIds: ['switch'],
  reference: 'Miniature slide switch (SS-12D00 family): shell 10.6 x 5.2 x 3.6 mm on a 1.4 mm base, lever travel 2 mm each way; tabs on the existing 8 mm anchors',
  builder: buildSlideSwitch,
  params: (instance, options) => ({
    pinA: 'pin1',
    onPin: 'pin2',
    bodyLength: 10.6,
    bodyDepth: 5.2,
    baseHeight: 1.4,
    shellHeight: 3.6,
    leverTravel: 2.0,
    // Same rule as the solver (isSwitchClosed): the runtime toggle wins, then the stored state
    closed: options.switchClosed ?? instance.state?.open === false,
  }),
  pins: {
    pin1: { role: 'passive', direction: 'down' },
    pin2: { role: 'passive', direction: 'down' },
  },
});
