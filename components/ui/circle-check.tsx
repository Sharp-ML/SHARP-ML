'use client';

import type { Variants } from 'motion/react';
import type { HTMLAttributes } from 'react';
import { useEffect, useRef } from 'react';
import { motion, useAnimation } from 'motion/react';

import { cn } from '@/lib/utils';

interface CircleCheckIconProps extends HTMLAttributes<HTMLDivElement> {
  size?: number;
  isAnimating?: boolean;
}

const PATH_VARIANTS: Variants = {
  normal: {
    opacity: 1,
    pathLength: 1,
    transition: {
      duration: 0.3,
      opacity: { duration: 0.1 },
    },
  },
  animate: {
    opacity: [0, 1],
    pathLength: [0, 1],
    transition: {
      duration: 0.4,
      opacity: { duration: 0.1 },
    },
  },
};

function CircleCheckIcon({ 
  onMouseEnter, 
  onMouseLeave, 
  className, 
  size = 28, 
  isAnimating,
  ...props 
}: CircleCheckIconProps) {
  const controls = useAnimation();
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (isAnimating !== undefined) {
      if (isAnimating && !hasAnimated.current) {
        // Only animate once when first triggered
        controls.start('animate');
        hasAnimated.current = true;
      } else if (!isAnimating) {
        controls.start('normal');
        hasAnimated.current = false;
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
        <circle cx="12" cy="12" r="10" />
        <motion.path
          variants={PATH_VARIANTS}
          initial="normal"
          animate={controls}
          d="m9 12 2 2 4-4"
        />
      </svg>
    </div>
  );
}

CircleCheckIcon.displayName = 'CircleCheckIcon';

export { CircleCheckIcon };
