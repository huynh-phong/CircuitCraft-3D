import { buildTerminalBlock } from '../builders/terminalBlock';
import { defineSpec } from './types';

export const terminalBlockSpec = defineSpec({
  id: 'terminal-block-2p-508',
  definitionIds: ['connector'],
  reference: 'PCB screw terminal block 2-pole, 5.08 mm pitch (KF301-2P): 10.16 x 7.6 x 10 mm',
  builder: buildTerminalBlock,
  params: () => ({
    pitch: 5.08,
    depth: 7.6,
    height: 10,
    stepHeight: 6.2,
    bodyHex: 0x2f9e4f,
  }),
  pins: {
    pin1: { role: 'passive', direction: 'down' },
    pin2: { role: 'passive', direction: 'down' },
  },
});
