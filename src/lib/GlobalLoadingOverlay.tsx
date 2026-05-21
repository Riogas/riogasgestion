"use client";
import { motion, AnimatePresence } from "framer-motion";
import { useLoading } from "@/lib/LoadingContext";
import { useEffect, useState } from "react";

export function GlobalLoadingOverlay() {
  const { isLoading, message } = useLoading();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) return null;

  return (
    <AnimatePresence>
      {isLoading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-center justify-center"
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-background/70 backdrop-blur-md" />

          {/* Content card */}
          <motion.div
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.92, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 26 }}
            className="relative z-10 surface-glass rounded-[var(--radius-xl)] shadow-lg p-7 mx-4 max-w-xs w-full text-center"
          >
            <div className="flex flex-col items-center space-y-4">
              {/* Gradient spinner */}
              <div className="relative">
                <svg className="h-12 w-12 animate-spin" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <defs>
                    <linearGradient id="goya-spin-lg" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="var(--primary)" />
                      <stop offset="100%" stopColor="var(--accent)" />
                    </linearGradient>
                  </defs>
                  <circle cx="24" cy="24" r="20" stroke="var(--muted)" strokeWidth="3.5" />
                  <path d="M44 24 A20 20 0 0 0 24 4" stroke="url(#goya-spin-lg)" strokeWidth="3.5" strokeLinecap="round" />
                </svg>
                {/* Pulse ring (subtle) */}
                <motion.div
                  animate={{ scale: [1, 1.35, 1], opacity: [0.35, 0, 0.35] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute inset-0 border-2 border-primary/40 rounded-full"
                />
              </div>

              <div className="space-y-1.5">
                <motion.h3
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="text-base font-semibold text-foreground"
                >
                  Procesando…
                </motion.h3>
                {message && (
                  <motion.p
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
                    className="text-xs text-muted-foreground"
                  >
                    {message}
                  </motion.p>
                )}
              </div>

              {/* Animated dots */}
              <div className="flex space-x-1.5">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    animate={{ y: [0, -6, 0], opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.15, ease: "easeInOut" }}
                    className="w-1.5 h-1.5 bg-gradient-to-br from-primary to-accent rounded-full"
                  />
                ))}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
