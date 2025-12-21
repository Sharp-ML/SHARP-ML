'use client';

import type { Variants } from 'motion/react';
import type { HTMLAttributes } from 'react';
import { useEffect } from 'react';
import { motion, useAnimation } from 'motion/react';

import { cn } from '@/lib/utils';

interface CheckIconProps extends HTMLAttributes<HTMLDivElement> {
  size?: number;
  isAnimating?: boolean;
}

const PATH_VARIANTS: Variants = {
  normal: {
    opacity: 1,
    pathLength: 1,
    scale: 1,
    transition: {
      duration: 0.3,
      opacity: { duration: 0.1 },
    },
  },
  animate: {
    opacity: [0, 1],
    pathLength: [0, 1],
    scale: [0.5, 1],
    transition: {
      duration: 0.4,
      opacity: { duration: 0.1 },
    },
  },
};

function CheckIcon({ 
  onMouseEnter, 
  onMouseLeave, 
  className, 
  size = 28, 
  isAnimating,
  ...props 
}: CheckIconProps) {
  const controls = useAnimation();

  useEffect(() => {
    if (isAnimating !== undefined) {
      if (isAnimating) {
        controls.start('animate');
      } else {
        controls.start('normal');
      }
    }
  }, [isAnimating, controls]);

  const handleMouseEnter = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isAnimating === undefined) {
      controls.start('animate');
    }
    onMouseEnter?.(e);
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isAnimating === undefined) {
      controls.start('normal');
    }
    onMouseLeave?.(e);
  };

  return (
    <div
      className={cn(className)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      {...props}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <motion.path
          variants={PATH_VARIANTS}
          initial="normal"
          animate={controls}
          d="M4 12 9 17L20 6"
        />
      </svg>
    </div>
  );
}

CheckIcon.displayName = 'CheckIcon';

export { CheckIcon };
