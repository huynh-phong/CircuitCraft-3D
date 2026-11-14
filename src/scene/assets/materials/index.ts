import * as THREE from 'three';
import { cachedMaterial, cachedTexture } from '../cache';

/**
 * Shared PBR material palette. One material object per look: never create a material per instance.
 * Metals rely on the scene environment map (ThreeScene) for their reflections.
 */
const std = (key: string, params: THREE.MeshStandardMaterialParameters) =>
  cachedMaterial(key, () => new THREE.MeshStandardMaterial(params));

const hexKey = (hex: number) => hex.toString(16).padStart(6, '0');

/** Fine speckle used as the colour map of matte surfaces (ESD mat, foam). Null without a DOM. */
function speckleTexture(key: string, base: string, dark: string, light: string, repeat: number): THREE.Texture | null {
  return cachedTexture(`speckle:${key}`, () => {
    if (typeof document === 'undefined') return null;
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, size, size);
    // Deterministic pseudo-random speckle: the same texture on every load
    let seed = 1234567;
    const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    for (let i = 0; i < 2600; i++) {
      ctx.fillStyle = rnd() > 0.5 ? dark : light;
      ctx.globalAlpha = 0.1 + rnd() * 0.16;
      ctx.fillRect(rnd() * size, rnd() * size, 1 + rnd() * 1.5, 1 + rnd() * 1.5);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeat, repeat);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  });
}

export const Materials = {
  // ---- Metals (leads, contacts, screws) ----
  tin: () => std('metal:tin', { color: 0xd4d7dc, metalness: 0.92, roughness: 0.28 }),
  gold: () => std('metal:gold', { color: 0xe3b341, metalness: 1, roughness: 0.3 }),
  copper: () => std('metal:copper', { color: 0xc77b4a, metalness: 1, roughness: 0.35 }),
  brass: () => std('metal:brass', { color: 0xc9a44c, metalness: 0.95, roughness: 0.35 }),
  steel: () => std('metal:steel', { color: 0xaab2bb, metalness: 0.9, roughness: 0.38 }),
  chrome: () => std('metal:chrome', { color: 0xe8ebef, metalness: 1, roughness: 0.14 }),
  darkSteel: () => std('metal:dark', { color: 0x3a4048, metalness: 0.85, roughness: 0.45 }),

  // ---- Plastics, rubber, paint ----
  plastic: (hex: number, roughness = 0.55) =>
    std(`plastic:${hexKey(hex)}:${roughness}`, { color: hex, roughness, metalness: 0.02 }),
  rubber: (hex: number) => std(`rubber:${hexKey(hex)}`, { color: hex, roughness: 0.92, metalness: 0 }),
  /** Glossy enamel (resistor body, colour bands, painted tool handles). */
  paint: (hex: number, roughness = 0.42) =>
    std(`paint:${hexKey(hex)}:${roughness}`, { color: hex, roughness, metalness: 0.03 }),
  metallicPaint: (hex: number) => std(`paint-metal:${hexKey(hex)}`, { color: hex, roughness: 0.3, metalness: 0.85 }),
  resistorBody: () => std('resistor:body', { color: 0xd8c39b, roughness: 0.5, metalness: 0.03 }),
  ceramic: (hex = 0xe7e2d6) => std(`ceramic:${hexKey(hex)}`, { color: hex, roughness: 0.75, metalness: 0 }),

  // ---- PCB ----
  pcb: (hex: number) => std(`pcb:${hexKey(hex)}`, { color: hex, roughness: 0.38, metalness: 0.08 }),
  fr4: () => std('pcb:fr4', { color: 0xa38048, roughness: 0.8, metalness: 0.05 }),
  silkscreen: () =>
    cachedMaterial('pcb:silk', () => new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 })),
  /** Flat unlit colour for printed marks and dark recesses. */
  flat: (hex: number) => cachedMaterial(`flat:${hexKey(hex)}`, () => new THREE.MeshBasicMaterial({ color: hex })),

  // ---- Transparent ----
  /** Clear glass / acrylic without the transmission pass (cheap): lenses, box lids. */
  glass: (hex = 0xdbeafe, opacity = 0.28) =>
    std(`glass:${hexKey(hex)}:${opacity}`, {
      color: hex,
      roughness: 0.08,
      metalness: 0.1,
      transparent: true,
      opacity,
      depthWrite: false,
    }),
  emissive: (hex: number, intensity = 1.2) =>
    std(`emissive:${hexKey(hex)}:${intensity}`, { color: hex, emissive: hex, emissiveIntensity: intensity, roughness: 0.4 }),
  /** Unlit translucent colour, e.g. the halo of a lit LED. `opacityStep` is 0..20 (5 % steps). */
  halo: (hex: number, opacityStep: number) =>
    cachedMaterial(
      `halo:${hexKey(hex)}:${opacityStep}`,
      () => new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: opacityStep / 20, depthWrite: false })
    ),

  // ---- Workbench ----
  esdMat: () =>
    std('bench:esd-mat', {
      color: 0x1f6444,
      roughness: 0.93,
      metalness: 0,
      map: speckleTexture('esd', '#ffffff', '#9fb8a8', '#ffffff', 26),
    }),
  esdMatTrim: () => std('bench:esd-trim', { color: 0x2f8058, roughness: 0.9, metalness: 0 }),
  desk: (hex: number) => std(`bench:desk:${hexKey(hex)}`, { color: hex, roughness: 0.82, metalness: 0.02 }),
  foam: (hex: number) =>
    std(`bench:foam:${hexKey(hex)}`, { color: hex, roughness: 1, metalness: 0, map: speckleTexture('foam', '#ffffff', '#b9b190', '#ffffff', 3) }),
  /** Soft dark blob under an object (fake contact shadow). Null without a DOM. */
  contactShadow: (): THREE.Material | null => {
    const tex = cachedTexture('bench:contact-shadow', () => {
      if (typeof document === 'undefined') return null;
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 64;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      const g = ctx.createRadialGradient(32, 32, 4, 32, 32, 32);
      g.addColorStop(0, 'rgba(0,0,0,0.55)');
      g.addColorStop(0.6, 'rgba(0,0,0,0.22)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 64, 64);
      return new THREE.CanvasTexture(canvas);
    });
    if (!tex) return null;
    return cachedMaterial(
      'bench:contact-shadow',
      () => new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 })
    );
  },

  /** Raycast-only material of pin hit targets: never drawn (no draw call), still hit by the raycaster. */
  hitTarget: () => cachedMaterial('pin:hit', () => new THREE.MeshBasicMaterial({ visible: false })),
};

export type MaterialName = keyof typeof Materials;
