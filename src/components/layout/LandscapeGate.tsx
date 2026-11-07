import React, { useCallback, useEffect, useRef, useState } from 'react';
import { RotateCw, Smartphone, X } from 'lucide-react';
import { useDeviceProfile } from '../../hooks/useDeviceProfile';
import { useI18n } from '../../i18n/context';

/**
 * Wraps a workspace that is meant to be used sideways (3D Workspace, Practice Lab, Theory Learning).
 *
 * On a phone or tablet held upright it shows a rotate prompt ON TOP of the workspace: the workspace
 * stays mounted underneath, so the project, chat history and slide position survive any rotation.
 * Desktops never see the prompt, whatever their window size.
 *
 * "Xoay tự động" asks the browser to lock landscape. Most browsers only allow that in fullscreen and
 * from a tap, so it enters fullscreen first. iOS Safari has no orientation lock (and no fullscreen for
 * pages on iPhone): the request fails and the prompt says to rotate by hand. The user can always
 * continue upright; the choice is remembered for the session so the prompt never loops.
 * Whatever this component locked or made fullscreen is released when the workspace is left.
 */

const DISMISS_KEY = 'cc3d:landscape-prompt-dismissed';

type LockResult = 'locked' | 'unsupported' | 'denied';

function readDismissed(): boolean {
  try {
    return sessionStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

export const LandscapeGate: React.FC<{ area: 'workspace' | 'practice' | 'theory'; children: React.ReactNode }> = ({ area, children }) => {
  const profile = useDeviceProfile();
  const { language } = useI18n();
  const [dismissed, setDismissed] = useState(readDismissed);
  const [lockState, setLockState] = useState<LockResult | 'idle' | 'working'>('idle');
  const lockedByUs = useRef(false);
  const fullscreenByUs = useRef(false);

  const needsPrompt = profile.device !== 'desktop' && profile.orientation === 'portrait' && !dismissed;

  // Release what this workspace took when the user leaves it
  useEffect(() => {
    return () => {
      const orientation = (screen as any).orientation;
      if (lockedByUs.current && orientation?.unlock) {
        try {
          orientation.unlock();
        } catch {
          // already released by the browser
        }
      }
      if (fullscreenByUs.current && document.fullscreenElement) {
        document.exitFullscreen?.().catch(() => undefined);
      }
    };
  }, []);

  // Leaving fullscreen with the system gesture also ends the lock: forget it, ask again only on tap
  useEffect(() => {
    const onFullscreenChange = () => {
      if (!document.fullscreenElement) {
        fullscreenByUs.current = false;
        lockedByUs.current = false;
      }
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  const tryRotate = useCallback(async () => {
    setLockState('working');
    const orientation = (screen as any).orientation;
    if (!orientation?.lock) {
      setLockState('unsupported');
      return;
    }
    try {
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen({ navigationUI: 'hide' } as any);
        fullscreenByUs.current = true;
      }
      await orientation.lock('landscape');
      lockedByUs.current = true;
      setLockState('locked');
    } catch {
      // Refused or not available here (iOS, desktop-class browsers, policies): undo what we did
      if (fullscreenByUs.current && document.fullscreenElement) {
        await document.exitFullscreen?.().catch(() => undefined);
        fullscreenByUs.current = false;
      }
      setLockState('denied');
    }
  }, []);

  const continuePortrait = useCallback(() => {
    try {
      sessionStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // private mode: remembered for this page only
    }
    setDismissed(true);
  }, []);

  const areaName =
    area === 'theory'
      ? language === 'vi' ? 'Phòng học lý thuyết' : 'Theory classroom'
      : area === 'practice'
      ? language === 'vi' ? 'Phòng thực hành' : 'Practice Lab'
      : language === 'vi' ? 'Không gian thiết kế 3D' : '3D Workspace';

  return (
    <>
      {children}
      {needsPrompt && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="rotate-title"
          className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/95 backdrop-blur-sm p-6 text-center text-slate-100"
          style={{ paddingTop: 'max(1.5rem, env(safe-area-inset-top))', paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
        >
          <div className="max-w-sm w-full space-y-5">
            <div className="mx-auto w-20 h-20 rounded-3xl bg-cyan-500/15 border border-cyan-400/40 flex items-center justify-center">
              <Smartphone className="w-10 h-10 text-cyan-300 rotate-90 motion-safe:animate-pulse" />
            </div>
            <div className="space-y-2">
              <h2 id="rotate-title" className="text-lg font-bold">
                {language === 'vi' ? 'Xoay ngang thiết bị' : 'Rotate your device'}
              </h2>
              <p className="text-sm text-slate-300 leading-relaxed">
                {language === 'vi'
                  ? `${areaName} được thiết kế cho màn hình ngang để có đủ chỗ cho khung làm việc và các công cụ.`
                  : `${areaName} is designed for landscape so the canvas and tools have room.`}
              </p>
            </div>

            {lockState === 'unsupported' || lockState === 'denied' ? (
              <p className="text-xs text-amber-300 bg-amber-500/10 border border-amber-400/30 rounded-xl p-3" role="status">
                {language === 'vi'
                  ? 'Trình duyệt này không cho phép tự xoay màn hình. Hãy xoay thiết bị bằng tay (và tắt khóa xoay màn hình nếu đang bật).'
                  : 'This browser cannot rotate the screen for you. Please turn the device (and turn off rotation lock if it is on).'}
              </p>
            ) : null}

            <div className="flex flex-col gap-2.5">
              {lockState !== 'unsupported' && lockState !== 'denied' && (
                <button
                  type="button"
                  onClick={tryRotate}
                  disabled={lockState === 'working'}
                  className="w-full min-h-12 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  <RotateCw className="w-4 h-4" />
                  {language === 'vi' ? 'Xoay ngang tự động' : 'Rotate automatically'}
                </button>
              )}
              <button
                type="button"
                onClick={continuePortrait}
                className="w-full min-h-12 rounded-2xl border border-slate-600 hover:border-slate-400 text-slate-200 font-semibold text-sm flex items-center justify-center gap-2"
              >
                <X className="w-4 h-4" />
                {language === 'vi' ? 'Tiếp tục ở màn hình dọc' : 'Continue in portrait'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
