"use client";
import { motion, AnimatePresence } from "framer-motion";
import { Spinner } from "@phosphor-icons/react";
import { useLoading } from "@/lib/LoadingContext";

export function GlobalLoadingOverlay() {
  const { isLoading, message } = useLoading();

  console.log("GlobalLoadingOverlay: isLoading:", isLoading, "message:", message);

  return (
    <AnimatePresence>
      {isLoading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center"
        >
          {/* Backdrop blur */}
          <motion.div
            initial={{ backdropFilter: "blur(0px)" }}
            animate={{ backdropFilter: "blur(8px)" }}
            exit={{ backdropFilter: "blur(0px)" }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 bg-background/50"
          />

          {/* Loading content */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 25, duration: 0.4 }}
            className="relative z-10 bg-card/95 backdrop-blur-sm border border-border rounded-xl shadow-2xl p-8 mx-4 max-w-sm w-full text-center"
          >
            <div className="flex flex-col items-center space-y-4">
              {/* Animated spinner */}
              <motion.div
                animate={{ rotate: 360, scale: [1, 1.1, 1] }}
                transition={{ rotate: { duration: 1, repeat: Infinity, ease: "linear" }, scale: { duration: 2, repeat: Infinity, ease: "easeInOut" } }}
                className="relative"
              >
                <Spinner className="w-12 h-12 text-primary" weight="bold" />
                {/* Pulse ring */}
                <motion.div
                  animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute inset-0 border-2 border-primary rounded-full"
                />
              </motion.div>

              {/* Loading text */}
              <div className="space-y-2">
                <motion.h3 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="text-lg font-semibold text-foreground">
                  Procesando...
                </motion.h3>
                {message && (
                  <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="text-sm text-muted-foreground">
                    {message}
                  </motion.p>
                )}
              </div>

              {/* Animated dots */}
              <div className="flex space-x-1">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    animate={{ y: [0, -8, 0], opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2, ease: "easeInOut" }}
                    className="w-2 h-2 bg-primary rounded-full"
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
