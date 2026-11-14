import * as THREE from 'three';
import type { WorkbenchTheme } from './workbench';

/**
 * Backdrop behind the workbench: a soft vertical gradient (a blurred wall with a faint glow at
 * desk height) instead of a flat empty colour, plus matching fog so the far edge of the desk
 * dissolves into it. Stays in the dark tone of the UI; the light theme gets a light variant.
 */
export interface BackdropStyle {
  /** Gradient stops from the top of the view to the bottom. */
  top: string;
  horizon: string;
  bottom: string;
  /** Flat colour used where a canvas is unavailable, and by the fog. */
  fog: number;
  fogNear: number;
  fogFar: number;
}

export function backdropStyle(theme: WorkbenchTheme, presentation: boolean): BackdropStyle {
  if (theme === 'light') {
    return { top: '#dfe5ec', horizon: '#f4f6f9', bottom: '#cfd6df', fog: 0xe6eaf0, fogNear: 520, fogFar: 1150 };
  }
  return presentation
    ? { top: '#0d1422', horizon: '#243044', bottom: '#151c29', fog: 0x1c2534, fogNear: 520, fogFar: 1150 }
    : { top: '#070a12', horizon: '#1c2636', bottom: '#111722', fog: 0x161e2b, fogNear: 520, fogFar: 1150 };
}

/** The caller owns the texture and must dispose it when it is replaced. */
export function createBackdropTexture(style: BackdropStyle): THREE.Texture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, style.top);
  gradient.addColorStop(0.46, style.horizon);
  gradient.addColorStop(0.62, style.horizon);
  gradient.addColorStop(1, style.bottom);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
