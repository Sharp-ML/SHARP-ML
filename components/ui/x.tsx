"use client";

import type { Variants } from "motion/react";
import type { HTMLAttributes } from "react";
import { useEffect } from "react";
import { motion, useAnimation } from "motion/react";

import { cn } from "@/lib/utils";

interface XIconProps extends HTMLAttributes<HTMLDivElement> {
  size?: number;
  isAnimating?: boolean;
}

const PATH_VARIANTS: Variants = {
  normal: {
    rotate: 0,
    scale: 1,
  },
  animate: {
    rotate: 90,
    scale: [1, 1.1, 1],
    transition: {
      type: "spring",
      stiffness: 200,
      damping: 15,
    },
  },
};

function XIcon({
  onMouseEnter,
  onMouseLeave,
  className,
  size = 28,
  isAnimating,
  ...props
}: XIconProps) {
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
      <motion.svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        variants={PATH_VARIANTS}
        animate={controls}
        initial="normal"
      >
        <path d="M18 6 6 18" />
        <path d="m6 6 12 12" />
      </motion.svg>
    </div>
  );
}

XIcon.displayName = "XIcon";

export { XIcon };
