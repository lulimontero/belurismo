"use client";

import { useEffect, useState } from "react";
import { motion, useAnimate, useReducedMotion } from "framer-motion";
import "./belo-cards.css";

export type ShowcaseCard = { holder: string; lastFour: string; limitUsd: string };

const SPIN_S = 1.9;
const STAGGER_S = 0.28;

function SpinningCard({ card, index, run }: { card: ShowcaseCard; index: number; run: number }) {
  const [scope, animate] = useAnimate();
  const reduce = useReducedMotion();

  useEffect(() => {
    if (reduce) return;
    const delay = index * STAGGER_S;
    const face = scope.current.querySelector(".belo-card");
    const glow = scope.current.querySelector(".card-showcase-glow");
    // All three share delay and duration: one small hop while the card turns,
    // and the gold light grows through the spin and fades as it settles facing front.
    // Explicit keyframes from 0 so a replay spins again instead of starting at 360.
    const timing = { duration: SPIN_S, delay };
    animate(face, { rotateY: [0, 360] }, { ...timing, ease: [0.12, 0.85, 0.18, 1] });
    animate(face, { y: [0, -18, 0] }, { ...timing, times: [0, 0.45, 1], ease: "easeInOut" });
    animate(glow, { opacity: [0, 0.45, 1, 0.85, 0], scale: [0.7, 1, 1.25, 1.15, 0.8] }, { ...timing, times: [0, 0.2, 0.55, 0.75, 1], ease: "easeInOut" });
  }, [run, index, reduce, animate, scope]);

  return (
    <li ref={scope} className="card-showcase-slot">
      <motion.span className="card-showcase-glow" aria-hidden initial={{ opacity: 0 }} />
      <motion.div
        className="belo-card"
        style={{ transformPerspective: 1100 }}
        aria-label={`Tarjeta de ${card.holder}, terminada en ${card.lastFour}, activa`}
      >
        <div className="belo-card-top">
          <img src="/img/logo-belo.svg" alt="belo" className="belo-card-logo" />
          <span className="belo-card-type">Virtual</span>
        </div>
        <span className="belo-card-chip" aria-hidden />
        <p className="belo-card-number" aria-hidden>•••• •••• •••• {card.lastFour}</p>
        <div className="belo-card-bottom">
          <div>
            <small>Titular</small>
            <strong>{card.holder}</strong>
          </div>
          <div className="belo-card-limit">
            <small>Tope Turi</small>
            <strong>USD {card.limitUsd}</strong>
          </div>
        </div>
        <span className="belo-card-status">✓ Activa</span>
      </motion.div>
    </li>
  );
}

export default function CardShowcase({ cards }: { cards: ShowcaseCard[] }) {
  const [run, setRun] = useState(0);
  return (
    <section className="card-showcase" aria-label="Tarjetas de belo del grupo">
      <ul>{cards.map((card, index) => <SpinningCard key={card.lastFour} card={card} index={index} run={run} />)}</ul>
      <button type="button" onClick={() => setRun((n) => n + 1)}>Repetir animación</button>
    </section>
  );
}
