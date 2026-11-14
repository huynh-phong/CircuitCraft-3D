/**
 * Exports every v2 component model of the asset library to binary glTF (.glb), for use in
 * Blender or any other tool.
 *
 *   npm run export:models                 -> exports/models/<definitionId>.glb (detail: high)
 *   npm run export:models -- balanced     -> another detail level (low | balanced | high)
 *
 * The models are the same objects the workspace draws (registry + specs), built without
 * simulation state. Units are millimetres, Y up, Y = 0 on the board surface.
 * Not exported: pin hit targets, printed labels (canvas textures need a browser), GLB-backed
 * parts (Arduino, breadboard: their source files are already in public/3d-model).
 */
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { COMPONENT_DEFINITION_MAP } from '../src/domain/components/definitions';
import type { ComponentInstance } from '../src/domain/project/types';
import type { DetailLevel } from '../src/scene/assets/quality';
import { listModelSpecs } from '../src/scene/assets/registry';
import { createComponentMesh } from '../src/scene/models';

// GLTFExporter reads its buffers through FileReader, which Node does not have
class NodeFileReader {
  result: ArrayBuffer | string | null = null;
  onloadend: (() => void) | null = null;
  readAsArrayBuffer(blob: Blob) {
    blob.arrayBuffer().then((buffer) => {
      this.result = buffer;
      this.onloadend?.();
    });
  }
  readAsDataURL(blob: Blob) {
    blob.arrayBuffer().then((buffer) => {
      this.result = `data:${blob.type};base64,${Buffer.from(buffer).toString('base64')}`;
      this.onloadend?.();
    });
  }
}
(globalThis as any).FileReader = NodeFileReader;

const detail = (process.argv[2] as DetailLevel) || 'high';
if (!['low', 'balanced', 'high'].includes(detail)) {
  console.error(`Unknown detail level "${detail}" (use low | balanced | high)`);
  process.exit(1);
}
const outDir = path.resolve('exports', 'models');
fs.mkdirSync(outDir, { recursive: true });

function exportable(definitionId: string): THREE.Object3D {
  const definition = COMPONENT_DEFINITION_MAP.get(definitionId)!;
  const instance: ComponentInstance = {
    instanceId: definitionId,
    definitionId,
    name: definitionId,
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    parameters: { ...definition.defaultParameters },
  };
  const group = createComponentMesh(instance, definition, {}, { modelSet: 'v2', detail });
  // Keep the visible model only: drop the invisible pin hit targets
  for (const child of [...group.children]) if (child.userData?.isPin) group.remove(child);
  group.name = definitionId;
  return group;
}

const exporter = new GLTFExporter();
let failed = 0;
for (const spec of listModelSpecs()) {
  const definitionId = spec.definitionIds[0];
  try {
    const glb = (await exporter.parseAsync(exportable(definitionId), { binary: true })) as ArrayBuffer;
    const file = path.join(outDir, `${definitionId}.glb`);
    fs.writeFileSync(file, Buffer.from(glb));
    console.log(`  ✓ ${definitionId.padEnd(18)} ${(glb.byteLength / 1024).toFixed(1).padStart(7)} kB  (${spec.id})`);
  } catch (err: any) {
    failed += 1;
    console.log(`  ✗ ${definitionId}: ${err?.message || err}`);
  }
}
console.log(`\n${listModelSpecs().length - failed} exported to ${outDir}, ${failed} failed (detail: ${detail})`);
process.exit(failed ? 1 : 0);
