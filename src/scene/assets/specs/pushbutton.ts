import { buildTactButton } from '../builders/boxParts';
import { defineSpec } from './types';

export const pushbuttonSpec = defineSpec({
  id: 'tact-switch-12mm',
  definitionIds: ['pushbutton'],
  reference: 'Tactile switch 12 x 12 mm (B3F-4xxx class), round actuator; legs on the existing 8 x 6 mm anchors',
  builder: buildTactButton,
  params: (instance) => ({
    size: 11.6,
    baseHeight: 3.4,
    actuatorDiameter: 6.6,
    actuatorTravel: 1.3,
    actuatorHex: 0xdc2626,
    pressed: Boolean(instance.parameters?.pressed),
  }),
  pins: {},
});
