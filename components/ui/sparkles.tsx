"use client";

import type { Variants } from "motion/react";
import type { HTMLAttributes } from "react";
import { useEffect } from "react";
import { motion, useAnimation } from "motion/react";

import { cn } from "@/lib/utils";

interface SparklesIconProps extends HTMLAttributes<HTMLDivElement> {
  size?: number;
  isAnimating?: boolean;
}

const SPARKLE_VARIANTS: Variants = {
  initial: {
    y: 0,
    fill: "none",
  },
  hover: {
    y: [0, -1, 0],
    fill: ["none", "currentColor", "none"],
    transition: {
      duration: 1.2,
      repeat: Infinity,
      ease: "easeInOut",
    },
  },
};

const STAR_VARIANTS: Variants = {
  initial: {
    opacity: 1,
  },
  blink: {
    opacity: [1, 0.3, 1, 0.3, 1],
    transition: {
      duration: 1.5,
      repeat: Infinity,
      ease: "easeInOut",
    },
  },
};

function SparklesIcon({
  onMouseEnter,
  onMouseLeave,
  className,
  size = 28,
  isAnimating,
  ...props
}: SparklesIconProps) {
  const starControls = useAnimation();
  const sparkleControls = useAnimation();

  useEffect(() => {
    if (isAnimating !== undefined) {
      if (isAnimating) {
        sparkleControls.start("hover");
        starControls.start("blink");
      } else {
        sparkleControls.start("initial");
        starControls.start("initial");
      }
    }
  }, [isAnimating, sparkleControls, starControls]);

  const handleMouseEnter = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isAnimating === undefined) {
      sparkleControls.start("hover");
      starControls.start("blink");
    }
    onMouseEnter?.(e);
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isAnimating === undefined) {
      sparkleControls.start("initial");
      starControls.start("initial");
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
          d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"
          variants={SPARKLE_VARIANTS}
          animate={sparkleControls}
          initial="initial"
        />
        <motion.path
          d="M20 3v4"
          variants={STAR_VARIANTS}
          animate={starControls}
          initial="initial"
        />
        <motion.path
          d="M22 5h-4"
          variants={STAR_VARIANTS}
          animate={starControls}
          initial="initial"
        />
        <motion.path
          d="M4 17v2"
          variants={STAR_VARIANTS}
          animate={starControls}
          initial="initial"
        />
        <motion.path
          d="M5 18H3"
          variants={STAR_VARIANTS}
          animate={starControls}
          initial="initial"
        />
      </svg>
    </div>
  );
}

SparklesIcon.displayName = "SparklesIcon";

export { SparklesIcon };
