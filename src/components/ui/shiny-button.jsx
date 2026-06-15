"use client";

import React from "react";
import { motion } from "framer-motion";

import { cn } from "../../lib/utils.js";

const animationProps = {
  initial: { "--x": "100%", scale: 0.8 },
  animate: { "--x": "-100%", scale: 1 },
  whileTap: { scale: 0.95 },
  transition: {
    repeat: Infinity,
    repeatType: "loop",
    repeatDelay: 1,
    type: "spring",
    stiffness: 20,
    damping: 15,
    mass: 2,
    scale: {
      type: "spring",
      stiffness: 200,
      damping: 5,
      mass: 0.5
    }
  }
};

export function ShinyButton({ children, className, ...props }) {
  return (
    <motion.button
      {...animationProps}
      {...props}
      className={cn("shiny-button", className)}
    >
      <span
        className="shiny-button-label"
        style={{
          maskImage:
            "linear-gradient(-75deg,hsl(var(--primary, 0 84% 60%)) calc(var(--x) + 20%),transparent calc(var(--x) + 30%),hsl(var(--primary, 0 84% 60%)) calc(var(--x) + 100%))"
        }}
      >
        {children}
      </span>
      <span
        aria-hidden="true"
        style={{
          mask: "linear-gradient(rgb(0,0,0), rgb(0,0,0)) content-box,linear-gradient(rgb(0,0,0), rgb(0,0,0))",
          maskComposite: "exclude"
        }}
        className="shiny-button-border"
      />
    </motion.button>
  );
}

export default { ShinyButton };
