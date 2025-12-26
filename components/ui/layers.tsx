"use client";

import type { Variants } from "motion/react";
import type { HTMLAttributes } from "react";
import { useEffect } from "react";
import { motion, useAnimation } from "motion/react";

import { cn } from "@/lib/utils";

interface LayersIconProps extends HTMLAttributes<HTMLDivElement> {
  size?: number;
  isAnimating?: boolean;
}

const LAYER_1_VARIANTS: Variants = {
  normal: { y: 0 },
  animate: {
    y: [0, -2, 0],
    transition: {
      duration: 0.8,
      repeat: Infinity,
      ease: "easeInOut",
    },
  },
};

const LAYER_2_VARIANTS: Variants = {
  normal: { y: 0 },
  animate: {
    y: [0, -1, 0],
    transition: {
      duration: 0.8,
      repeat: Infinity,
      ease: "easeInOut",
      delay: 0.1,
    },
  },
};

const LAYER_3_VARIANTS: Variants = {
  normal: { y: 0 },
  animate: {
    y: [0, 0.5, 0],
    transition: {
      duration: 0.8,
      repeat: Infinity,
      ease: "easeInOut",
      delay: 0.2,
    },
  },
};

function LayersIcon({
  onMouseEnter,
  onMouseLeave,
  className,
  size = 28,
  isAnimating,
  ...props
}: LayersIconProps) {
  const controls = useAnimation();

  useEffect(() => {
    if (isAnimating !== undefined) {
      if (isAnimating) {
        controls.start("animate");
      } else {
        controls.start("normal");
      }
    }
  }, [isAnimating, controls]);

  const handleMouseEnter = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isAnimating === undefined) {
      controls.start("animate");
    }
    onMouseEnter?.(e);
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isAnimating === undefined) {
      controls.start("normal");
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
        {/* Top layer */}
        <motion.path
          d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z"
          variants={LAYER_1_VARIANTS}
          animate={controls}
          initial="normal"
        />
        {/* Middle layer */}
        <motion.path
          d="M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12"
          variants={LAYER_2_VARIANTS}
          animate={controls}
          initial="normal"
        />
        {/* Bottom layer */}
        <motion.path
          d="M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17"
          variants={LAYER_3_VARIANTS}
          animate={controls}
          initial="normal"
        />
      </svg>
    </div>
  );
}

LayersIcon.displayName = "LayersIcon";

export { LayersIcon };
