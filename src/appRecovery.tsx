import React, { lazy } from 'react';

/**
 * Keeps the app usable across deployments.
 *
 * Every deploy replaces the hashed JS chunks. A tab opened before the deploy still runs the old code
 * and, when it lazy-loads a page, asks for a chunk that no longer exists (404). Without handling,
 * React unmounts the whole tree and the user sees an empty page. Here such a failure reloads the page
 * once (loading the new version); any other render error shows a message with a reload button.
 */

const RELOAD_KEY = 'cc3d:new-version-reload-at';
const RELOAD_GUARD_MS = 30_000;

/** True for the errors browsers raise when a JS module / chunk cannot be fetched. */
export function isChunkLoadError(err: unknown): boolean {
  const msg = String((err as any)?.message || err || '');
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|ChunkLoadError|Loading chunk [\w-]+ failed|Unable to preload CSS/i.test(msg);
}

/** Reloads the page once per 30 s window. Returns false when a reload just happened (avoid loops). */
export function reloadOnceForNewVersion(): boolean {
  try {
    const last = Number(window.sessionStorage.getItem(RELOAD_KEY) || 0);
    if (Date.now() - last < RELOAD_GUARD_MS) return false;
    window.sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    // sessionStorage unavailable: still reload once (this page instance)
    if ((window as any).__cc3dReloaded) return false;
    (window as any).__cc3dReloaded = true;
  }
  window.location.reload();
  return true;
}

/** Vite fires this when a dynamic import's preload fails (stale chunk after a deploy). */
export function installStaleChunkRecovery(): void {
  window.addEventListener('vite:preloadError', (event) => {
    if (reloadOnceForNewVersion()) event.preventDefault();
  });
}

/** React.lazy that reloads into the new deployment when its chunk is gone. */
export function lazyWithReload<T extends React.ComponentType<any>>(factory: () => Promise<{ default: T }>) {
  return lazy(() =>
    factory().catch((err) => {
      if (isChunkLoadError(err) && reloadOnceForNewVersion()) {
        // The page is reloading: never resolve, so nothing half-rendered flashes
        return new Promise<{ default: T }>(() => {});
      }
      throw err;
    })
  );
}

interface BoundaryState {
  error: Error | null;
}

/** Last line of defence: an error message instead of a blank page. */
export class AppErrorBoundary extends React.Component<{ children: React.ReactNode }, BoundaryState> {
  state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[App] Unhandled render error:', error, info?.componentStack);
    if (isChunkLoadError(error)) reloadOnceForNewVersion();
  }

  render() {
    if (!this.state.error) return this.props.children;
    const newVersion = isChunkLoadError(this.state.error);
    // Inline styles: this screen must render even if the stylesheet failed to load
    return (
      <div role="alert" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: '#020617', color: '#e2e8f0', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ maxWidth: 420, width: '100%', textAlign: 'center', border: '1px solid rgba(34,211,238,0.3)', borderRadius: 24, padding: 28, background: '#061224' }}>
          <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>{newVersion ? 'CircuitCraft 3D vừa được cập nhật' : 'Đã xảy ra lỗi hiển thị'}</div>
          <p style={{ fontSize: 13, lineHeight: 1.6, color: '#94a3b8', margin: '0 0 18px' }}>
            {newVersion
              ? 'Trang đang dùng phiên bản cũ. Tải lại để dùng phiên bản mới; dữ liệu đã lưu không bị mất.'
              : 'Trang gặp lỗi không mong muốn. Tải lại trang để tiếp tục; dữ liệu đã lưu không bị mất.'}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{ padding: '10px 22px', borderRadius: 999, border: 'none', background: 'linear-gradient(90deg,#06b6d4,#3b82f6)', color: 'white', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
          >
            Tải lại trang
          </button>
        </div>
      </div>
    );
  }
}
