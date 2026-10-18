/**
 * Central Motion Design Tokens for CircuitCraft 3D
 * Standardized easing curves, durations, spring physics, and reusable animation variants.
 */

export const MOTION_DURATIONS = {
  instant: 0.1,    // 100ms - micro-clicks, active press
  fast: 0.18,      // 180ms - tooltips, hover states, toggles
  normal: 0.28,    // 280ms - dropdowns, popovers, tabs
  medium: 0.38,    // 380ms - modals, drawers, panels
  page: 0.42,      // 420ms - page transitions
  camera: 0.65,    // 650ms - 3D camera preset transitions
  cinematic: 0.95, // 950ms - presentation mode, showcase
} as const;

export const MOTION_EASINGS = {
  // Natural deceleration for entering elements
  easeOutCubic: [0.215, 0.61, 0.355, 1],
  // Smooth symmetric transition for state changes
  easeInOutCubic: [0.645, 0.045, 0.355, 1],
  // Snappy responsive ease for buttons and micro-feedback
  snappyOut: [0.16, 1, 0.3, 1],
  // Linear for continuous rotations
  linear: [0, 0, 1, 1],
} as const;

export const MOTION_SPRINGS = {
  // Ultra-snappy for buttons and direct interactions
  tactile: { type: 'spring', damping: 20, stiffness: 350, mass: 0.8 },
  // Smooth and buttery for navigation tabs and indicators
  smooth: { type: 'spring', damping: 26, stiffness: 240, mass: 1 },
  // Bouncy for celebrations and success badges
  playful: { type: 'spring', damping: 14, stiffness: 200, mass: 0.9 },
  // Heavy inertia for 3D camera damping
  inertia: { damping: 0.92, friction: 0.08 },
} as const;

/**
 * Reusable animation variants for Framer Motion / Motion components
 */
export const pageTransitionVariants = {
  initial: {
    opacity: 0,
  },
  animate: {
    opacity: 1,
    transition: {
      duration: 0.22,
      ease: MOTION_EASINGS.easeOutCubic,
    },
  },
  exit: {
    opacity: 0,
    transition: {
      duration: 0.16,
      ease: MOTION_EASINGS.easeInOutCubic,
    },
  },
};

export const modalVariants = {
  initial: {
    opacity: 0,
    scale: 0.96,
    y: 8,
  },
  animate: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      duration: MOTION_DURATIONS.normal,
      ease: MOTION_EASINGS.snappyOut,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.97,
    y: 4,
    transition: {
      duration: 0.16,
      ease: MOTION_EASINGS.easeInOutCubic,
    },
  },
};

export const dropdownVariants = {
  initial: {
    opacity: 0,
    scale: 0.95,
    y: -4,
  },
  animate: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      duration: 0.18,
      ease: MOTION_EASINGS.snappyOut,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.96,
    y: -3,
    transition: {
      duration: 0.12,
      ease: 'easeIn',
    },
  },
};

export const cardStaggerVariants = {
  container: {
    animate: {
      transition: {
        staggerChildren: 0.04,
      },
    },
  },
  item: {
    initial: { opacity: 0, y: 16 },
    animate: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.32,
        ease: MOTION_EASINGS.easeOutCubic,
      },
    },
  },
};

/**
 * Check if the user has requested reduced motion in their OS / browser
 */
export function isPrefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
