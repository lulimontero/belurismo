"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ConversationWidget } from "@/lib/turi/conversation-widgets";
import "./belo-cards.css";

type Card = Extract<ConversationWidget, { type: "cards" }>["cards"][number];

const statusLabel: Record<string, string> = {
  active: "Activa",
  frozen: "Congelada",
  pending: "En emisión",
  failed: "No se emitió",
};

function BeloCard({ card, index }: { card: Card; index: number }) {
  const reduce = useReducedMotion();
  const failed = Boolean(card.error);
  const delay = reduce ? 0 : 0.15 + index * 0.45;
  return (
    <motion.li
      className={`belo-card${failed ? " failed" : ""}`}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 60, rotate: -9, scale: 0.86 }}
      animate={{ opacity: 1, y: 0, rotate: 0, scale: 1 }}
      transition={reduce ? { duration: 0.2, delay } : { type: "spring", stiffness: 170, damping: 17, delay }}
      aria-label={failed
        ? `Tarjeta de ${card.holder}: no se emitió. ${card.error}`
        : `Tarjeta de ${card.holder}, terminada en ${card.lastFour ?? "sin número"}, ${statusLabel[card.status] ?? card.status}`}
    >
      {!failed && !reduce && (
        <motion.span className="belo-card-shine" aria-hidden
          initial={{ x: "-120%" }} animate={{ x: "220%" }}
          transition={{ duration: 0.9, delay: delay + 0.35, ease: "easeInOut" }} />
      )}
      <div className="belo-card-top">
        <img src="/img/logo-belo.svg" alt="belo" className="belo-card-logo" />
        <span className="belo-card-type">Virtual</span>
      </div>
      <span className="belo-card-chip" aria-hidden />
      <motion.p className="belo-card-number" aria-hidden
        initial={reduce ? false : { opacity: 0, filter: "blur(6px)" }}
        animate={{ opacity: 1, filter: "blur(0px)" }}
        transition={{ duration: 0.5, delay: delay + 0.5 }}>
        {failed ? card.error : `•••• •••• •••• ${card.lastFour ?? "····"}`}
      </motion.p>
      <div className="belo-card-bottom">
        <div>
          <small>Titular</small>
          <strong>{card.holder}</strong>
        </div>
        <div className="belo-card-limit">
          <small>Tope Turi</small>
          <strong>{card.limitUsd ? `USD ${card.limitUsd}` : "Sin tope"}</strong>
        </div>
      </div>
      <motion.span className="belo-card-status"
        initial={reduce ? false : { opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 14, delay: delay + 0.7 }}>
        {failed ? statusLabel.failed : `✓ ${statusLabel[card.status] ?? card.status}`}
      </motion.span>
    </motion.li>
  );
}

export default function BeloCards({ widget }: { widget: Extract<ConversationWidget, { type: "cards" }> }) {
  const issued = widget.cards.filter((card) => !card.error).length;
  return (
    <section className="belo-cards" aria-label="Tarjetas de belo">
      <header>
        <strong>{issued === widget.cards.length ? `${issued} tarjeta${issued === 1 ? "" : "s"} lista${issued === 1 ? "" : "s"}` : `${issued} de ${widget.cards.length} tarjetas emitidas`}</strong>
        <span>El tope lo registra Turi, belo no lo aplica.</span>
      </header>
      <ul>{widget.cards.map((card, index) => <BeloCard key={`${card.holder}-${index}`} card={card} index={index} />)}</ul>
    </section>
  );
}
