import React from 'react';
import { motion } from 'motion/react';
import { pageTransitionVariants, isPrefersReducedMotion } from '../../theme/motionTokens';

interface PageTransitionProps {
  children: React.ReactNode;
  routeKey: string;
  className?: string;
}

export const PageTransition: React.FC<PageTransitionProps> = ({
  children,
  routeKey,
  className = 'w-full h-full flex-1 overflow-auto',
}) => {
  const reducedMotion = isPrefersReducedMotion();

  if (reducedMotion) {
    return <div className={className}>{children}</div>;
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
      {children}
    </motion.div>
  );
};
