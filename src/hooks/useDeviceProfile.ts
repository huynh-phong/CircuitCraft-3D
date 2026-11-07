import { useSyncExternalStore } from 'react';

/**
 * What kind of screen the app is on, from capabilities rather than the user agent:
 * pointer precision, hover support, touch points and the size of the screen itself.
 *
 * - desktop: a fine pointer with hover (mouse / trackpad), whatever the window size. A narrow
 *   desktop window is still a desktop: it never gets the rotate-device overlay.
 * - phone:   touch-first, short side of the screen under 600 CSS px.
 * - tablet:  touch-first, larger (iPad, Galaxy Tab, foldables unfolded). iPadOS in desktop mode
 *   reports a Mac user agent but still has a coarse pointer and touch points, so it lands here.
 *
 * Orientation follows the current viewport, so iPad Split View / Stage Manager / resized windows
 * are handled by what the app actually has, not by how the device is held.
 */
export type DeviceClass = 'phone' | 'tablet' | 'desktop';

export interface DeviceProfile {
  device: DeviceClass;
  isTouch: boolean;
  orientation: 'portrait' | 'landscape';
  width: number;
  height: number;
  /** Height that is really visible (shrinks while the on-screen keyboard is open). */
  visibleHeight: number;
  /** Phone held sideways, or any touch screen this short: the workspaces use their compact layout. */
  isCompactLandscape: boolean;
}

function mq(query: string): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(query).matches;
}

function compute(): DeviceProfile {
  if (typeof window === 'undefined') {
    return { device: 'desktop', isTouch: false, orientation: 'landscape', width: 1280, height: 800, visibleHeight: 800, isCompactLandscape: false };
  }
  const width = window.innerWidth;
  const height = window.innerHeight;
  const visibleHeight = Math.round(window.visualViewport?.height || height);
  const isTouch = (navigator.maxTouchPoints || 0) > 0 || mq('(any-pointer: coarse)');
  const primaryFine = mq('(pointer: fine)') && mq('(hover: hover)');
  const screenShort = Math.min(window.screen?.width || width, window.screen?.height || height);

  let device: DeviceClass = 'desktop';
  if (isTouch && !primaryFine) device = screenShort < 600 ? 'phone' : 'tablet';

  const orientation = width >= height ? 'landscape' : 'portrait';
  const isCompactLandscape = device !== 'desktop' && orientation === 'landscape' && (device === 'phone' || height < 520);
  return { device, isTouch, orientation, width, height, visibleHeight, isCompactLandscape };
}

let current: DeviceProfile = compute();
const listeners = new Set<() => void>();
let started = false;
let pending: ReturnType<typeof setTimeout> | null = null;

function publish() {
  pending = null;
  const next = compute();
  const changed = (Object.keys(next) as Array<keyof DeviceProfile>).some((key) => next[key] !== current[key]);
  // The real visible height, for layouts that must fit above the on-screen keyboard
  document.documentElement.style.setProperty('--app-height', `${next.visibleHeight}px`);
  if (!changed) return;
  current = next;
  const root = document.documentElement.dataset;
  root.device = next.device;
  root.orientation = next.orientation;
  for (const listener of listeners) listener();
}

// A timer, not requestAnimationFrame: frames are paused in background tabs and the profile must
// still be right when the page comes back
function schedule() {
  if (!pending) pending = setTimeout(publish, 60);
}

function start() {
  if (started || typeof window === 'undefined') return;
  started = true;
  window.addEventListener('resize', schedule);
  window.addEventListener('orientationchange', schedule);
  window.visualViewport?.addEventListener('resize', schedule);
  window.matchMedia?.('(pointer: fine)').addEventListener?.('change', schedule);
  document.addEventListener('visibilitychange', schedule);
  const root = document.documentElement.dataset;
  root.device = current.device;
  root.orientation = current.orientation;
  document.documentElement.style.setProperty('--app-height', `${current.visibleHeight}px`);
}

function subscribe(listener: () => void) {
  start();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getDeviceProfile(): DeviceProfile {
  return current;
}

export function useDeviceProfile(): DeviceProfile {
  return useSyncExternalStore(subscribe, getDeviceProfile, getDeviceProfile);
}

/** Starts tracking before React renders, so the first paint already has the right attributes. */
export function initDeviceProfile(): void {
  start();
}
