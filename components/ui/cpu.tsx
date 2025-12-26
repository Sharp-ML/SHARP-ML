"use client";

import type { Variants } from "motion/react";
import type { HTMLAttributes } from "react";
import { useEffect } from "react";
import { motion, useAnimation } from "motion/react";

import { cn } from "@/lib/utils";

interface CpuIconProps extends HTMLAttributes<HTMLDivElement> {
  size?: number;
  isAnimating?: boolean;
}

const Y_VARIANTS: Variants = {
  normal: {
    scaleY: 1,
    opacity: 1,
  },
  animate: {
    scaleY: [1, 1.5, 1],
    opacity: [1, 0.8, 1],
    transition: {
      duration: 0.6,
      ease: "easeInOut",
      repeat: Infinity,
      repeatDelay: 0.2,
    },
  },
};

const X_VARIANTS: Variants = {
  normal: {
    scaleX: 1,
    opacity: 1,
  },
  animate: {
    scaleX: [1, 1.5, 1],
    opacity: [1, 0.8, 1],
    transition: {
      duration: 0.6,
      ease: "easeInOut",
      repeat: Infinity,
      repeatDelay: 0.2,
    },
  },
};

function CpuIcon({
  onMouseEnter,
  onMouseLeave,
  className,
  size = 28,
  isAnimating,
  ...props
}: CpuIconProps) {
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
        <rect width="16" height="16" x="4" y="4" rx="2" />
        <rect width="6" height="6" x="9" rx="1" y="9" />
        <motion.path
          d="M15 2v2"
          variants={Y_VARIANTS}
          animate={controls}
          initial="normal"
        />
        <motion.path
          d="M15 20v2"
          variants={Y_VARIANTS}
          animate={controls}
          initial="normal"
        />
        <motion.path
          d="M2 15h2"
          variants={X_VARIANTS}
          animate={controls}
          initial="normal"
        />
        <motion.path
          d="M2 9h2"
          variants={X_VARIANTS}
          animate={controls}
          initial="normal"
        />
        <motion.path
          d="M20 15h2"
          variants={X_VARIANTS}
          animate={controls}
          initial="normal"
        />
        <motion.path
          d="M20 9h2"
          variants={X_VARIANTS}
          animate={controls}
          initial="normal"
        />
        <motion.path
          d="M9 2v2"
          variants={Y_VARIANTS}
          animate={controls}
          initial="normal"
        />
        <motion.path
          d="M9 20v2"
          variants={Y_VARIANTS}
          animate={controls}
          initial="normal"
        />
      </svg>
    </div>
  );
}

CpuIcon.displayName = "CpuIcon";

export { CpuIcon };
