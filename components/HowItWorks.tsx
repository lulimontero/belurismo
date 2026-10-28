"use client";

import { motion } from "framer-motion";
import { useState } from "react";

const SLIDES = [
  { img: "hhfUIGGjVy7Kd6VLcHBCywvm8FY", caption: "Ingresar en belo travel" },
  { img: "rZLLXAF6HLbWimdx3wHms90fYkY", caption: "Crear cuenta o iniciar sesión" },
  { img: "YfvSmMGdHInrGAWA0MAjxVyrj8", caption: "Buscar alojamiento" },
  { img: "jghVUQxdLNFcGkfgZi2xlDKy1c", caption: "Selecciona el método de pago" },
];

const arrowCls =
  "absolute top-1/2 z-10 flex h-[25px] w-[25px] -translate-y-1/2 items-center justify-center rounded-full bg-black/20 transition-opacity";

export default function HowItWorks() {
  const [i, setI] = useState(0);

  return (
    <section
      className="bg-cover bg-center px-4 pb-[50px] pt-[100px] text-center"
      style={{ backgroundImage: "url(/img/YMSD5lClIyNop3F75yIYAoCbihc.png)" }}
    >
      <h2 className="h-display text-[36px] text-white md:text-[45px]">¿Cómo funciona?</h2>
      <p className="mt-[18px] text-[18px] font-medium leading-[18px] tracking-[-0.04em] text-ash">En 4 simples pasos</p>

      <div className="relative mx-auto h-[360px] max-w-[1200px] md:h-[695px]">
        <button
          aria-label="Anterior"
          onClick={() => setI((i + 3) % 4)}
          className={`${arrowCls} left-0 md:left-5 ${i === 0 ? "pointer-events-none opacity-0" : ""}`}
        >
          <img src="/img/6tTbkXggWgQCAJ4DO2QEdXXmgM.svg" alt="" width={25} height={25} />
        </button>
        <button aria-label="Siguiente" onClick={() => setI((i + 1) % 4)} className={`${arrowCls} right-0 md:right-5`}>
          <img src="/img/11KSGbIZoRSg4pjdnUoif6MKHI.svg" alt="" width={25} height={25} />
        </button>

        <div className="absolute inset-x-6 top-[50px] overflow-hidden md:inset-x-[150px] md:top-[99px]">
          <motion.ul
            className="flex"
            animate={{ x: `${-i * 100}%` }}
            transition={{ type: "spring", stiffness: 260, damping: 34 }}
          >
            {SLIDES.map((s, n) => (
              <li key={s.img} aria-hidden={n !== i} className="w-full shrink-0">
                <img
                  src={`/img/${s.img}.png`}
                  alt={s.caption}
                  className="mx-auto aspect-[765/453] w-full max-w-[765px] rounded-[20px] object-cover"
                />
                <p className="o32 mt-[37px] text-[22px] font-semibold leading-[22px] tracking-[-0.02em] text-white">{s.caption}</p>
              </li>
            ))}
          </motion.ul>
        </div>

        <div className="absolute bottom-0 left-1/2 flex h-7 -translate-x-1/2 items-center rounded-full bg-[rgba(30,70,210,0.55)] px-[5px]">
          {SLIDES.map((s, n) => (
            <button
              key={s.img}
              aria-label={`Paso ${n + 1}`}
              onClick={() => setI(n)}
              className="flex h-7 w-[18px] items-center justify-center"
            >
              <span className={`h-2 w-2 rounded-full bg-white transition-opacity ${n === i ? "opacity-100" : "opacity-50"}`} />
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
