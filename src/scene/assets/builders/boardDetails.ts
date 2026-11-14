import * as THREE from 'three';
import { Materials } from '../materials';
import { bakeStatic, disc, group, label, part, ring } from '../primitives';
import type { DetailLevel } from '../quality';

/**
 * Light details on the plain v2 board surface (rectangular boards): a mounting hole with its
 * annular ring in each corner and a small "CircuitCraft" silkscreen mark. Display only: the board
 * shape, size and solder mask still come from the ProjectDocument.
 */
export function addBoardDetails(boardGroup: THREE.Group, width: number, depth: number, detail: DetailLevel): void {
  const inset = 5; // mm from each edge, inside the silkscreen frame
  if (width < 30 || depth < 30) return;
  const y = 0.07;
  const details = group(boardGroup, { name: 'board-details' });
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const x = sx * (width / 2 - inset);
      const z = sz * (depth / 2 - inset);
      part(details, ring(1.6, 2.7, detail), Materials.tin(), { at: [x, y, z], castShadow: false });
      part(details, disc(1.6, detail), Materials.flat(0x05070a), { at: [x, y, z], castShadow: false });
    }
  }
  if (width >= 60) {
    label(details, 'CircuitCraft', 21, 3.4, {
      at: [-width / 2 + inset + 15.5, y, depth / 2 - inset - 0.2],
      color: '#ffffff',
      font: '600 sans-serif',
    });
  }
  // One mesh per material instead of one per hole
  bakeStatic(details);
}
