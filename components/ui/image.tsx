'use client';

import type { Variants } from 'motion/react';
import type { HTMLAttributes } from 'react';
import { useEffect } from 'react';
import { motion, useAnimation } from 'motion/react';

import { cn } from '@/lib/utils';

interface ImageIconProps extends HTMLAttributes<HTMLDivElement> {
  size?: number;
  isAnimating?: boolean;
}

const FRAME_VARIANTS: Variants = {
  normal: {
    scale: 1,
  },
  animate: {
    scale: [1, 1.02, 1],
    transition: {
      duration: 0.8,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
};

const SUN_VARIANTS: Variants = {
  normal: {
    scale: 1,
    opacity: 1,
  },
  animate: {
    scale: [1, 1.2, 1],
    opacity: [1, 0.8, 1],
    transition: {
      duration: 1,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
};

const MOUNTAIN_VARIANTS: Variants = {
  normal: {
    y: 0,
  },
  animate: {
    y: [0, -0.5, 0],
    transition: {
      duration: 1.2,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
};

function ImageIcon({ 
  onMouseEnter, 
  onMouseLeave, 
  className, 
  size = 28, 
  isAnimating,
  ...props 
}: ImageIconProps) {
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
        <motion.rect
          width="18"
          height="18"
          x="3"
          y="3"
          rx="2"
          ry="2"
          variants={FRAME_VARIANTS}
          animate={controls}
          initial="normal"
        />
        <motion.circle
          cx="9"
          cy="9"
          r="2"
          variants={SUN_VARIANTS}
          animate={controls}
          initial="normal"
        />
        <motion.path
          d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"
          variants={MOUNTAIN_VARIANTS}
          animate={controls}
          initial="normal"
        />
      </svg>
    </div>
  );
}

ImageIcon.displayName = 'ImageIcon';

export { ImageIcon };
