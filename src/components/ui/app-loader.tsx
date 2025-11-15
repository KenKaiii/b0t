'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

/**
 * Initial app loading screen shown on page refresh
 * Fades out once the app is hydrated and ready
 */
export function AppLoader() {
  const [isVisible, setIsVisible] = useState(true);
  const [isFadingOut, setIsFadingOut] = useState(false);

  useEffect(() => {
    // Start fade-out animation after 2 seconds
    const fadeTimer = setTimeout(() => {
      setIsFadingOut(true);
    }, 2000);

    // Remove component completely after fade animation completes
    const removeTimer = setTimeout(() => {
      setIsVisible(false);
    }, 2600); // 2000ms delay + 600ms fade duration

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(removeTimer);
    };
  }, []);

  if (!isVisible) return null;

  return (
    <div
      className="fixed inset-0 z-[10000] bg-background flex items-center justify-center transition-all duration-[600ms] ease-out"
      style={{
        opacity: isFadingOut ? 0 : 1,
        transform: isFadingOut ? 'scale(0.95)' : 'scale(1)',
        isolation: 'isolate',
        backfaceVisibility: 'hidden',
      }}
    >
      {/* Darkened gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-background" />
      {/* Animated background blobs */}
      <motion.div
        className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl"
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.3, 0.5, 0.3],
          x: [0, 50, 0],
          y: [0, -30, 0]
        }}
        transition={{ repeat: Infinity, duration: 8, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl"
        animate={{
          scale: [1, 1.3, 1],
          opacity: [0.2, 0.4, 0.2],
          x: [0, -40, 0],
          y: [0, 40, 0]
        }}
        transition={{ repeat: Infinity, duration: 10, ease: "easeInOut" }}
      />

      {/* Main loader content */}
      <div className="relative z-10 flex flex-col items-center gap-8">
        {/* b0t text with individual letter animations */}
        <div className="flex items-center gap-1">
          <motion.span
            className="text-9xl font-bold bg-gradient-to-br from-primary via-blue-500 to-primary bg-clip-text text-transparent"
            animate={{
              y: [0, -20, 0],
              rotate: [0, -5, 0]
            }}
            transition={{
              repeat: Infinity,
              duration: 2,
              delay: 0,
              ease: "easeInOut"
            }}
          >
            b
          </motion.span>
          <motion.span
            className="text-9xl font-bold bg-gradient-to-br from-blue-500 via-primary to-blue-500 bg-clip-text text-transparent"
            animate={{
              scale: [1, 1.3, 1],
              rotate: [0, 180, 360]
            }}
            transition={{
              repeat: Infinity,
              duration: 2,
              delay: 0.2,
              ease: "easeInOut"
            }}
          >
            0
          </motion.span>
          <motion.span
            className="text-9xl font-bold bg-gradient-to-br from-primary via-blue-500 to-primary bg-clip-text text-transparent"
            animate={{
              y: [0, -20, 0],
              rotate: [0, 5, 0]
            }}
            transition={{
              repeat: Infinity,
              duration: 2,
              delay: 0.4,
              ease: "easeInOut"
            }}
          >
            t
          </motion.span>
        </div>

        {/* Pulsing glow effect behind text */}
        <motion.div
          className="absolute inset-0 bg-primary/20 rounded-full blur-3xl"
          animate={{
            scale: [1, 1.5, 1],
            opacity: [0.2, 0.4, 0.2]
          }}
          transition={{
            repeat: Infinity,
            duration: 2,
            ease: "easeInOut"
          }}
        />

        {/* Audio visualizer bars */}
        <div className="flex gap-2 items-end h-12">
          {[0, 0.1, 0.2, 0.3, 0.2, 0.1, 0].map((delay, i) => (
            <motion.div
              key={i}
              className="w-2 bg-gradient-to-t from-primary to-blue-500 rounded-full"
              animate={{
                height: ["16px", "48px", "16px"]
              }}
              transition={{
                repeat: Infinity,
                duration: 1.2,
                delay,
                ease: "easeInOut"
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
