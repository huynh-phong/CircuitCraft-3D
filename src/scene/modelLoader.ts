import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const gltfCache = new Map<string, THREE.Group>();
const gltfPromises = new Map<string, Promise<THREE.Group>>();

/**
 * Fit a 3D model to target bounding dimensions and ensure it sits nicely at Y=0.
 */
export function fitModelToBounds(
  model: THREE.Group | THREE.Object3D,
  bounds: { width: number; height: number; depth: number }
): void {
  // First reset transforms to compute clean native bounding box
  model.position.set(0, 0, 0);
  model.rotation.set(0, 0, 0);
  model.scale.set(1, 1, 1);
  model.updateMatrixWorld(true);

  let box = new THREE.Box3().setFromObject(model);
  let size = box.getSize(new THREE.Vector3());

  if (size.x === 0 || size.y === 0 || size.z === 0) return;

  // CRITICAL: Lay model flat horizontally if exported upright
  // In Three.js: PCB sits on the horizontal X-Z plane, and Y is UP (vertical height).
  if (size.z < size.x * 0.55 && size.z < size.y * 0.55) {
    // Model thickness is along Z (exported standing upright in XY plane, like Sketchfab FBX).
    // Rotating -90° around X brings the PCB flat into the XZ plane with top components facing +Y (UP).
    model.rotation.x = -Math.PI / 2;
    model.updateMatrixWorld(true);
    box = new THREE.Box3().setFromObject(model);
    size = box.getSize(new THREE.Vector3());
  } else if (size.x < size.y * 0.55 && size.x < size.z * 0.55) {
    // Model thickness is along X. Rotating 90° around Z lays it flat.
    model.rotation.z = Math.PI / 2;
    model.updateMatrixWorld(true);
    box = new THREE.Box3().setFromObject(model);
    size = box.getSize(new THREE.Vector3());
  }

  // Calculate target scale fitting bounds proportionally along horizontal footprint (X/Z)
  const scaleX = bounds.width / size.x;
  const scaleZ = bounds.depth / size.z;
  const scale = Math.min(scaleX, scaleZ);
  model.scale.set(scale, scale, scale);
  model.updateMatrixWorld(true);

  // Center horizontally and align bottom to y=0
  const scaledBox = new THREE.Box3().setFromObject(model);
  const scaledCenter = scaledBox.getCenter(new THREE.Vector3());

  model.position.x = -scaledCenter.x;
  model.position.z = -scaledCenter.z;
  model.position.y = -scaledBox.min.y;
  model.updateMatrixWorld(true);

  // Enable shadows and proper materials
  model.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
}

/**
 * Safely clone a loaded GLTF scene.
 */
function cloneModel(source: THREE.Group): THREE.Group {
  return source.clone(true) as THREE.Group;
}

/**
 * Loads a GLB model with memory caching and bounds fitting.
 */
export function loadGLBModel(
  url: string,
  onLoaded: (model: THREE.Group) => void,
  targetBounds?: { width: number; height: number; depth: number }
): void {
  if (gltfCache.has(url)) {
    const cached = gltfCache.get(url)!;
    const cloned = cloneModel(cached);
    if (targetBounds) {
      fitModelToBounds(cloned, targetBounds);
    }
    onLoaded(cloned);
    return;
  }

  let p = gltfPromises.get(url);
  if (!p) {
    const loader = new GLTFLoader();
    p = new Promise<THREE.Group>((resolve, reject) => {
      loader.load(
        url,
        (gltf) => {
          const scene = gltf.scene;
          gltfCache.set(url, scene);
          resolve(scene);
        },
        undefined,
        (err) => {
          console.warn(`Failed to load GLB model from ${url}:`, err);
          reject(err);
        }
      );
    });
    gltfPromises.set(url, p);
  }

  p.then((scene) => {
    const cloned = cloneModel(scene);
    if (targetBounds) {
      fitModelToBounds(cloned, targetBounds);
    }
    onLoaded(cloned);
  }).catch((err) => {
    console.warn(`Error rendering GLB model ${url}:`, err);
  });
}
