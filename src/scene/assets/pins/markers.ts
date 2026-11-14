import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Vector3D } from '../../../domain/project/types';

/**
 * Pin markers shown while the wiring tool is active: one glowing ring + dot per pin, coloured by
 * state. All markers of the scene are ONE InstancedMesh (one draw call), whatever the pin count
 * (a breadboard alone has several hundred tie points).
 *
 * Positions come from the domain pin anchors (see ./index.ts); nothing is hard-coded here.
 */

export type PinMarkerState = 'free' | 'connected' | 'valid' | 'hover' | 'start';

export const PIN_MARKER_COLORS: Record<PinMarkerState, number> = {
  free: 0x22d3ee, // cyan: nothing connected yet
  connected: 0x22c55e, // green: already has a wire
  valid: 0x60a5fa, // blue: can end the wire being drawn
  hover: 0xfde047, // yellow: under the pointer
  start: 0xf59e0b, // amber: where the wire being drawn starts
};

const STATE_SCALE: Record<PinMarkerState, number> = { free: 1, connected: 1, valid: 1.1, hover: 1.55, start: 1.45 };

export interface PinMarkerItem {
  position: Vector3D;
  state: PinMarkerState;
  /** Extra size factor, e.g. smaller markers on dense breadboard rows. */
  scale?: number;
}

function markerGeometry(): THREE.BufferGeometry {
  const ringGeo = new THREE.RingGeometry(0.95, 1.5, 24);
  ringGeo.rotateX(-Math.PI / 2);
  const dot = new THREE.SphereGeometry(0.55, 10, 8);
  const merged = mergeGeometries([ringGeo, dot], false)!;
  ringGeo.dispose();
  dot.dispose();
  return merged;
}

export class PinMarkerLayer {
  readonly object = new THREE.Group();
  private mesh: THREE.InstancedMesh | null = null;
  private capacity = 0;
  private readonly geometry = markerGeometry();
  private readonly material = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0.95,
    depthTest: false, // a pin under a component body must stay visible while wiring
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  private readonly dummy = new THREE.Object3D();
  private readonly color = new THREE.Color();

  constructor() {
    this.object.name = 'pin-markers';
    // Markers are an overlay: they never take part in picking
    this.object.raycast = () => {};
  }

  update(items: PinMarkerItem[]): void {
    if (items.length === 0) {
      if (this.mesh) this.mesh.visible = false;
      return;
    }
    if (!this.mesh || items.length > this.capacity) {
      this.releaseMesh();
      this.capacity = Math.max(64, 2 ** Math.ceil(Math.log2(items.length)));
      this.mesh = new THREE.InstancedMesh(this.geometry, this.material, this.capacity);
      this.mesh.frustumCulled = false;
      this.mesh.renderOrder = 999;
      this.mesh.raycast = () => {};
      this.object.add(this.mesh);
    }
    const mesh = this.mesh;
    mesh.visible = true;
    mesh.count = items.length;
    items.forEach((item, i) => {
      const s = STATE_SCALE[item.state] * (item.scale ?? 1);
      this.dummy.position.set(item.position.x, item.position.y + 0.3, item.position.z);
      this.dummy.scale.setScalar(s);
      this.dummy.updateMatrix();
      mesh.setMatrixAt(i, this.dummy.matrix);
      mesh.setColorAt(i, this.color.setHex(PIN_MARKER_COLORS[item.state]));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }

  get count(): number {
    return this.mesh?.visible ? this.mesh.count : 0;
  }

  private releaseMesh() {
    if (!this.mesh) return;
    this.object.remove(this.mesh);
    this.mesh.dispose(); // instance buffers only; geometry and material are owned by the layer
    this.mesh = null;
  }

  dispose(): void {
    this.releaseMesh();
    this.geometry.dispose();
    this.material.dispose();
  }
}
