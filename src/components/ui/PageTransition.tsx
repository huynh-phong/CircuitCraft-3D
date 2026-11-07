import React, { Suspense } from 'react';
import { motion } from 'motion/react';
import { pageTransitionVariants, isPrefersReducedMotion } from '../../theme/motionTokens';

/** Shown while a lazily loaded page or the 3D editor is being fetched. */
export const RouteFallback: React.FC = () => (
  <div className="flex-1 w-full h-full min-h-[40vh] flex items-center justify-center" role="status" aria-label="Loading">
    <div className="w-7 h-7 rounded-full border-2 border-cyan-500/30 border-t-cyan-400 animate-spin" />
  </div>
);

interface PageTransitionProps {
  children: React.ReactNode;
  routeKey: string;
  className?: string;
}

export const PageTransition: React.FC<PageTransitionProps> = ({
  children,
  routeKey,
  className = 'route-page w-full h-full flex-1 overflow-auto',
}) => {
  const reducedMotion = isPrefersReducedMotion();

  if (reducedMotion) {
    return (
      <div className={className}>
        <Suspense fallback={<RouteFallback />}>{children}</Suspense>
      </div>
    );
  }

  return (
    <motion.div
      key={routeKey}
      variants={pageTransitionVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className={className}
    >
      <Suspense fallback={<RouteFallback />}>{children}</Suspense>
    </motion.div>
  );
};
