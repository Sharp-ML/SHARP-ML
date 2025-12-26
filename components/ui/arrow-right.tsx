"use client";

import type { Variants } from "motion/react";
import type { HTMLAttributes } from "react";
import { useEffect } from "react";
import { motion, useAnimation } from "motion/react";

import { cn } from "@/lib/utils";

interface ArrowRightIconProps extends HTMLAttributes<HTMLDivElement> {
  size?: number;
  isAnimating?: boolean;
}

const ARROW_VARIANTS: Variants = {
  normal: { x: 0 },
  animate: {
    x: 3,
    transition: {
      type: "spring",
      stiffness: 200,
      damping: 10,
      mass: 1,
    },
  },
};

function ArrowRightIcon({
  onMouseEnter,
  onMouseLeave,
  className,
  size = 28,
  isAnimating,
  ...props
}: ArrowRightIconProps) {
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
        <motion.g variants={ARROW_VARIANTS} animate={controls} initial="normal">
          <path d="M5 12h14" />
          <path d="m12 5 7 7-7 7" />
        </motion.g>
      </svg>
    </div>
  );
}

ArrowRightIcon.displayName = "ArrowRightIcon";

export { ArrowRightIcon };
