import React, { useCallback, useEffect, useRef, useState } from 'react';

/**
 * A floating round button (chat launchers) that the user can move.
 *
 * - Tap / click: does what the button does.
 * - Touch or pen: press and hold ~0.35 s, then drag. Holding is required so a normal swipe over the
 *   button still scrolls the page and a tap is never mistaken for a drag.
 * - Mouse: drag after moving a few pixels.
 *
 * The position is kept as distances from the right / bottom edges, clamped inside the visible
 * viewport (safe areas included) and above the mobile bottom navigation bar, so by default and
 * after any rotation the button never covers it. It is remembered per launcher.
 */

const HOLD_MS = 350;
const MOUSE_DRAG_THRESHOLD = 6;
const EDGE = 12;
/** Height reserved for the phone bottom navigation bar (bar + its margin). */
const BOTTOM_NAV_SPACE = 92;

interface Offset {
  right: number;
  bottom: number;
}

function readStored(key: string): Offset | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const value = JSON.parse(raw);
    return typeof value?.right === 'number' && typeof value?.bottom === 'number' ? value : null;
  } catch {
    return null;
  }
}

function bottomNavVisible(): boolean {
  // The bar stays in the DOM on wide screens (hidden by CSS): only a rendered bar counts
  const bar = document.querySelector('[data-bottom-nav="visible"]');
  return Boolean(bar && bar.getClientRects().length > 0);
}

export function useDraggableFab(storageKey: string, size = 56, defaults: Offset = { right: 20, bottom: 20 }) {
  const [offset, setOffset] = useState<Offset>(() => readStored(storageKey) || defaults);
  const [isDragging, setIsDragging] = useState(false);
  const [, setLayoutTick] = useState(0);
  const press = useRef<{
    id: number;
    startX: number;
    startY: number;
    startOffset: Offset;
    type: string;
    armed: boolean;
    timer: ReturnType<typeof setTimeout> | null;
  } | null>(null);
  const suppressClick = useRef(false);

  const clamp = useCallback(
    (value: Offset): Offset => {
      const vw = window.innerWidth;
      const vh = window.visualViewport?.height || window.innerHeight;
      const minBottom = (bottomNavVisible() ? BOTTOM_NAV_SPACE : 0) + EDGE;
      return {
        right: Math.min(Math.max(EDGE, value.right), Math.max(EDGE, vw - size - EDGE)),
        bottom: Math.min(Math.max(minBottom, value.bottom), Math.max(minBottom, vh - size - EDGE)),
      };
    },
    [size]
  );

  // Re-check after layout changes: rotation, keyboard, the bottom bar appearing on another page
  useEffect(() => {
    const onLayout = () => setLayoutTick((n) => n + 1);
    window.addEventListener('resize', onLayout);
    window.visualViewport?.addEventListener('resize', onLayout);
    const observer = new MutationObserver(onLayout);
    observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['data-bottom-nav'], childList: true });
    return () => {
      window.removeEventListener('resize', onLayout);
      window.visualViewport?.removeEventListener('resize', onLayout);
      observer.disconnect();
    };
  }, []);

  const save = (value: Offset) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(value));
    } catch {
      // private mode: the position lasts for this page only
    }
  };

  const endPress = () => {
    if (press.current?.timer) clearTimeout(press.current.timer);
    press.current = null;
  };

  const onPointerDown = (e: React.PointerEvent<HTMLElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    suppressClick.current = false;
    const state = {
      id: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startOffset: clamp(offset),
      type: e.pointerType,
      armed: false,
      timer: null as ReturnType<typeof setTimeout> | null,
    };
    if (e.pointerType !== 'mouse') {
      state.timer = setTimeout(() => {
        if (press.current !== state) return;
        state.armed = true;
        setIsDragging(true);
        if ((navigator as any).userActivation?.hasBeenActive) navigator.vibrate?.(10);
      }, HOLD_MS);
    }
    press.current = state;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // not essential
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLElement>) => {
    const state = press.current;
    if (!state || state.id !== e.pointerId) return;
    const dx = e.clientX - state.startX;
    const dy = e.clientY - state.startY;
    if (!state.armed) {
      if (state.type === 'mouse' && Math.hypot(dx, dy) > MOUSE_DRAG_THRESHOLD) {
        state.armed = true;
        setIsDragging(true);
      } else if (state.type !== 'mouse' && Math.hypot(dx, dy) > 10) {
        // Moved before the hold completed: it is a scroll or a swipe, not a drag
        endPress();
      }
      if (!state.armed) return;
    }
    e.preventDefault();
    setOffset(clamp({ right: state.startOffset.right - dx, bottom: state.startOffset.bottom - dy }));
  };

  const onPointerUp = (e: React.PointerEvent<HTMLElement>) => {
    const state = press.current;
    if (!state || state.id !== e.pointerId) return;
    if (state.armed) {
      suppressClick.current = true;
      setIsDragging(false);
      setOffset((current) => {
        const next = clamp(current);
        save(next);
        return next;
      });
    }
    endPress();
  };

  const onPointerCancel = () => {
    if (press.current?.armed) setIsDragging(false);
    endPress();
  };

  /** Wrap the button's onClick: a drag that ends on the button is not a click. */
  const guardClick = (handler: () => void) => (e: React.MouseEvent) => {
    if (suppressClick.current) {
      suppressClick.current = false;
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    handler();
  };

  useEffect(() => () => endPress(), []);

  const position = clamp(offset);
  return {
    isDragging,
    /** Spread on the fixed container. */
    containerStyle: {
      right: `calc(${position.right}px + env(safe-area-inset-right))`,
      bottom: `calc(${position.bottom}px + env(safe-area-inset-bottom))`,
    } as React.CSSProperties,
    /** Spread on the button that is pressed and dragged. */
    handleProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
      onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
      // The launcher is small: it never scrolls the page, so a hold-then-drag is not taken over by the browser
      style: { touchAction: 'none', WebkitTouchCallout: 'none', WebkitUserSelect: 'none' } as React.CSSProperties,
    },
    guardClick,
  };
}
