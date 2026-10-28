"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useState, useSyncExternalStore } from "react";

const VIOLET = "#5300DA";
const MINT = "#00FFB2";
const noop = () => () => {};
const SMILE = "M9 21 Q17 28 25 21";
const GRIN = "M8 20 Q17 31 26 20";
const still = { duration: 0 };

export default function TuriBot() {
  // server can't know the media query: render the animated tree for hydration, then honor the preference
  const hydrated = useSyncExternalStore(noop, () => true, () => false);
  const prefersReduced = useReducedMotion();
  const reduce = hydrated && prefersReduced;
  const [hello, setHello] = useState(false);
  const loop = { repeat: Infinity, ease: "easeInOut" } as const;

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col items-end gap-3">
      <AnimatePresence>
        {hello && (
          <motion.div
            role="status"
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="flex items-center gap-2 rounded-[20px] rounded-br-[6px] bg-white py-3 pl-4 pr-2 text-[15px] font-medium tracking-[-0.02em] shadow-[0_10px_30px_rgba(0,0,0,0.12)]"
          >
            Hola, soy Turi 👋
            <button
              aria-label="Cerrar"
              onClick={() => setHello(false)}
              className="flex h-6 w-6 items-center justify-center rounded-full text-ash hover:bg-black/5 hover:text-black"
            >
              ×
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative h-16 w-16">
        {!reduce && (
          <motion.span
            aria-hidden
            className="absolute inset-0 rounded-full border-2"
            style={{ borderColor: MINT }}
            initial={{ scale: 1, opacity: 0.7 }}
            animate={{ scale: 1.7, opacity: 0 }}
            transition={{ ...loop, duration: 2, ease: "easeOut" }}
          />
        )}
        <motion.div
          className="h-full w-full"
          animate={reduce ? { scale: 1 } : { scale: [1, 1.05, 1] }}
          transition={reduce ? still : { ...loop, duration: 2.8 }}
        >
          <motion.button
            aria-label="Turi, tu copiloto de viaje"
            onClick={() => setHello((v) => !v)}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.95 }}
            className="flex h-full w-full items-center justify-center rounded-full shadow-[0_8px_24px_rgba(83,0,218,0.35)]"
            style={{ background: VIOLET }}
          >
            <svg width="34" height="34" viewBox="0 0 34 34" aria-hidden>
              {/* eyes: blink every ~4s */}
              <motion.g
                animate={reduce ? { scaleY: 1 } : { scaleY: [1, 1, 0.1, 1] }}
                transition={reduce ? still : { repeat: Infinity, duration: 4, times: [0, 0.9, 0.95, 1], repeatDelay: 0.6 }}
              >
                <ellipse cx="11" cy="13" rx="2.6" ry="3.4" fill="#fff" />
                <ellipse cx="23" cy="13" rx="2.6" ry="3.4" fill="#fff" />
              </motion.g>
              {/* belo smile: widens now and then */}
              <motion.path
                d={SMILE}
                fill="none"
                stroke={MINT}
                strokeWidth="3.2"
                strokeLinecap="round"
                animate={reduce ? { d: SMILE } : { d: [SMILE, SMILE, GRIN, SMILE] }}
                transition={reduce ? still : { repeat: Infinity, duration: 6, times: [0, 0.75, 0.85, 1] }}
              />
            </svg>
          </motion.button>
        </motion.div>
      </div>
    </div>
  );
}
