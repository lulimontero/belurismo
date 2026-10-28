"use client";

import dynamic from "next/dynamic";
import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import TuriMark from "./turi/TuriMark";
import "./turi/turi.css";

const TuriWorkspace = dynamic(() => import("./turi/TuriWorkspace"), {
  ssr: false,
});

export default function TuriBot() {
  const [open, setOpen] = useState(false),
    button = useRef<HTMLButtonElement>(null),
    reduce = useReducedMotion();
  useEffect(() => {
    const openTuri = () => setOpen(true);
    window.addEventListener("turi:open", openTuri);
    if (new URLSearchParams(location.search).has("turi"))
      button.current?.click();
    return () => window.removeEventListener("turi:open", openTuri);
  }, []);
  return (
    <>
      <div className="turi-launcher">
        <span className="turi-launcher-caption">¿A dónde nos vamos?</span>
        <motion.button
          ref={button}
          aria-label="Abrir chat con Turi, tu copiloto de viaje"
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => setOpen(true)}
          className="turi-launcher-button"
          whileHover={reduce ? undefined : { scale: 1.06 }}
          whileTap={{ scale: 0.94 }}
        >
          <TuriMark size={36} />
          <span className="turi-launcher-dot" />
        </motion.button>
      </div>
      {open && (
        <TuriWorkspace
          onClose={() => {
            setOpen(false);
            requestAnimationFrame(() => button.current?.focus());
          }}
        />
      )}
    </>
  );
}
