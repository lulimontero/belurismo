"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";

const FAQS = [
  {
    q: "¿Qué medios de pago están disponibles?",
    a: "Podés pagar no solo con tu belo Mastercard, sino también con criptomonedas atadas al valor del dólar como USDT y USDC y tarjetas Visa, Mastercard y Amex. También es posible pagar con Apple Pay y Google Pay.",
  },
  {
    q: "¿Qué impuestos se aplican si pago con tarjeta argentina en pesos?",
    a: "Al pagar con tarjeta un consumo del exterior, se sumará al valor en USD mostrado en el sitio, una percepción del 30% aplicada a consumos en moneda extranjera a través de la Resolución General N° 5617 de AFIP.",
  },
  {
    q: "¿Cómo funciona el soporte?",
    a: "El soporte está disponible 24/7 y podés contactarte por:\n\n- Telegram\n- Formulario por correo\n\nEl soporte lo brinda Entravel como plataforma de gestión de reservas turísticas, y no belo. Quedate tranquilo, están disponibles en todo momento y desde belo estamos para acompañarte.\n\nPor el momento solo en inglés. Próximamente se sumarán español y portugués.",
  },
];

function Item({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="rounded-[10px] bg-white">
      <button
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex min-h-[50px] w-full items-center gap-[14px] py-[14px] pl-[12px] pr-6 text-left o24 font-medium text-[15px] leading-[18px] tracking-[-0.01em]"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden className="shrink-0">
          <path d="M0 7h14" stroke="#636363" strokeWidth="1.3" />
          <motion.path d="M7 0v14" stroke="#636363" strokeWidth="1.3" animate={{ scaleY: open ? 0 : 1 }} style={{ originY: "50%" }} transition={{ duration: 0.25 }} />
        </svg>
        {q}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0, marginTop: 0 }}
            animate={{ height: "auto", opacity: 1, marginTop: -5 }}
            exit={{ height: 0, opacity: 0, marginTop: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <p className="whitespace-pre-line text-balance pb-[9px] pl-10 pr-[27px] o24 font-medium text-[15px] leading-[19.5px] tracking-[-0.01em] text-ash">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}

export default function Faq() {
  return (
    <ul className="mt-[90px] flex flex-col gap-2">
      {FAQS.map((f) => (
        <Item key={f.q} {...f} />
      ))}
    </ul>
  );
}
