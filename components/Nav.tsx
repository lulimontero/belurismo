"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";

type Item = { title: string; desc: string; img: string; href: string };

const MENUS: Record<string, { left: number; items: Item[] }> = {
  Transferir: {
    left: 319,
    items: [
      { title: "Nacional", desc: "Transferí dinero a bancos y billeteras dentro de Argentina desde belo", img: "Iy6Efk8oeTwP7tjTjzkfq7seWbo", href: "https://www.belo.app/ar/nacional" },
      { title: "Internacional", desc: "Transferencias internacionales a cuentas y billeteras de todo el mundo", img: "XDraOE8yWSOgn2zXm7mU6lQZA", href: "https://www.belo.app/ar/internacional" },
    ],
  },
  Comunidad: {
    left: 339,
    items: [
      { title: "Blog", desc: "Artículos para freelancers, viajeros y quienes viven el mundo digital", img: "jX2PEbxUmFVO2n22fWN9kciumV0", href: "https://www.belo.app/blog" },
      { title: "Beneficios", desc: "Descuentos y beneficios exclusivos disponibles para usuarios de belo", img: "ANojiI1sF4OUA0cV4S3qgaeWtM", href: "https://www.belo.app/ar/beneficios" },
      { title: "belo Plus", desc: "Beneficios únicos para quienes eligen belo como su billetera principal", img: "yDOn45fRgY7UQXBGy65PvqUvYw", href: "https://www.belo.app/ar/beloplus" },
      { title: "Ayuda", desc: "Centro de ayuda con toda la información sobre tu cuenta belo", img: "9bZuD23bNl60ZkfhVnQSOHXaYI", href: "https://help.belo.app/" },
    ],
  },
};

// ponytail: Recibir / Cuenta personal / Travel have no verified href or dropdown content in the DNA, so they stay plain text.
const LINKS: { label: string; href?: string }[] = [
  { label: "Recibir" },
  { label: "Transferir" },
  { label: "Cuenta personal" },
  { label: "Travel" },
  { label: "Comunidad" },
  { label: "Empresas", href: "https://www.belo.app/business" },
  { label: "APIs", href: "https://www.belo.app/apis" },
];

const linkCls =
  "rounded-[25px] text-[14px] font-semibold leading-[16.8px] tracking-[-0.02em] text-ash transition-colors hover:text-black";

export default function Nav() {
  const [open, setOpen] = useState<string | null>(null);
  const menu = open ? MENUS[open] : null;

  return (
    <header className="relative z-40 px-4 pt-[50px] md:px-0">
      <nav
        className="relative mx-auto flex h-16 max-w-[1110px] items-center justify-between rounded-[66px] bg-white pl-[30px] pr-[45px] md:pr-[45px]"
        onMouseLeave={() => setOpen(null)}
      >
        <a href="./" aria-label="belo" className="flex h-[54px] w-[54px] items-center">
          <img src="/img/logo-belo.svg" alt="belo" width={53} height={26} />
        </a>

        <ul className="hidden items-center gap-[30px] md:flex">
          {LINKS.map(({ label, href }) => (
            <li key={label} onMouseEnter={() => setOpen(MENUS[label] ? label : null)}>
              {href ? (
                <a href={href} className={linkCls}>{label}</a>
              ) : (
                <span className={`${linkCls} cursor-default ${open === label ? "text-black!" : ""}`}>{label}</span>
              )}
            </li>
          ))}
          <li className="ml-4 text-[14px] leading-[16.8px]" onMouseEnter={() => setOpen(null)}>🌎</li>
        </ul>
        <span className="text-[14px] md:hidden">🌎</span>

        <AnimatePresence>
          {menu && (
            <motion.div
              key={open}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="absolute top-16 pt-[10px]"
              style={{ left: menu.left }}
            >
              <div className="rounded-[20px] bg-white p-5 pb-[40px] shadow-[0_10px_20px_rgba(0,0,0,0.05)]">
                <p className="text-[16px] font-semibold leading-[19.2px] tracking-[-0.02em] text-ash">{open}</p>
                <div className="mt-5 flex gap-[10px]">
                  {menu.items.map((it) => (
                    <a key={it.title} href={it.href} className="group block w-[153px]">
                      <img src={`/img/${it.img}.png`} alt="" width={153} height={82} className="h-[82px] w-[153px] rounded-[13px] object-cover" />
                      <p className="mt-[10px] text-[14px] font-semibold leading-[22.4px] tracking-[-0.02em] text-ash group-hover:text-black">{it.title}</p>
                      <p className="mt-[11px] text-[11px] leading-[17.6px] tracking-[-0.02em] text-ash">{it.desc}</p>
                    </a>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>
    </header>
  );
}
