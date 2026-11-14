import { buildSevenSegment } from '../builders/displays';
import { drawLevel } from './simulation';
import { defineSpec } from './types';

const SEGMENT_HEX: Record<string, number> = { red: 0xef4444, green: 0x22c55e, blue: 0x3b82f6 };

export const sevenSegmentSpec = defineSpec({
  id: 'seven-segment-056',
  definitionIds: ['7seg-display'],
  reference: '0.56 inch single-digit seven-segment display: 12.6 x 19 x 8 mm, 2 x 5 pins, 15.24 mm row spacing',
  builder: buildSevenSegment,
  params: (instance, options) => {
    const solved = options.visual?.segments || {};
    const levels: Record<string, number> = {};
    for (const key of Object.keys(solved)) levels[key] = drawLevel(solved[key], options);
    return {
      width: 12.6,
      depth: 19,
      height: 6.4,
      seat: 1.5,
      segmentHex: SEGMENT_HEX[String(instance.parameters?.color || 'red')] ?? SEGMENT_HEX.red,
      levels,
    };
  },
  pins: {},
});
