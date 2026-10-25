"use client";

import { motion, useReducedMotion } from "motion/react";

// Right-hand detail drawer. Parents wrap it in <AnimatePresence> so it slides out on close.
export function Drawer({ label, children }: { label: string; children: React.ReactNode }) {
  const reduce = useReducedMotion();
  const off = reduce ? { opacity: 0 } : { x: 32, opacity: 0 };
  return (
    <motion.aside
      aria-label={label}
      initial={off}
      animate={{ x: 0, opacity: 1 }}
      exit={off}
      transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
      className="absolute inset-y-0 right-0 z-[1001] flex w-[440px] max-w-full flex-col overflow-y-auto border-l bg-background shadow-2xl"
    >
      {children}
    </motion.aside>
  );
}
