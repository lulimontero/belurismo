"use client";

import { motion, useAnimationFrame, useInView, useMotionValue, useReducedMotion, wrap } from "framer-motion";
import { useRef } from "react";

// order + image pairing taken from the live DOM (the DNA list had captions rotated)
const HOTELS = [
  { img: "qwJUERfvInM8U8pMYk64HYhJluA", stars: 5, name: "Four Seasons Resort Orlando at WALT DISNEY WORLD® Resort" },
  { img: "S75fbSUheHzV1PVf3b4fNlAI14", stars: 5, name: "Hard Rock Hotel Ibiza" },
  { img: "nPytuKYJFJNsSfWrNGsZxckLKI", stars: 5, kind: "Hotel & Resort", name: "Sheraton Grand Rio" },
  { img: "l4Nf3xqsM2KqFYT4LMG3tXR9io", stars: 4, kind: "All inclusive", name: "Dreams Tulum Resort & Spa" },
  { img: "DOAc5yqweORJq85HOmjg55JLc", stars: 5, kind: "All inclusive", name: "Iberostar Selection Hacienda Dominicus" },
  { img: "OUBOAtrgm2kC73ea0g1HOybsU", stars: 4, name: "Novotel Paris Centre Tour Eiffel" },
];

const SPEED = 100; // px/s, measured on the original

function Star() {
  return (
    <svg viewBox="0 0 24 24" width={12} height={12} aria-hidden>
      <path
        transform="translate(2.251 2.25)"
        fill="#F5B82E"
        d="M 9.749 15.477 L 14.879 18.632 C 15.151 18.797 15.496 18.782 15.753 18.594 C 16.01 18.406 16.128 18.082 16.053 17.772 L 14.658 11.886 L 19.223 7.948 C 19.461 7.739 19.552 7.409 19.455 7.108 C 19.357 6.806 19.09 6.592 18.774 6.563 L 12.783 6.075 L 10.475 0.488 C 10.354 0.193 10.068 0 9.749 0 C 9.431 0 9.144 0.193 9.023 0.488 L 6.715 6.075 L 0.724 6.563 C 0.406 6.59 0.136 6.806 0.038 7.109 C -0.06 7.412 0.034 7.745 0.275 7.953 L 4.84 11.89 L 3.445 17.772 C 3.37 18.082 3.488 18.406 3.745 18.594 C 4.002 18.782 4.347 18.797 4.619 18.632 Z"
      />
    </svg>
  );
}

export default function HotelMarquee() {
  const box = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLUListElement>(null);
  const inView = useInView(box);
  const reduce = useReducedMotion();
  const x = useMotionValue(0);

  useAnimationFrame((_, delta) => {
    if (!inView || reduce || !track.current) return;
    const set = track.current.scrollWidth / 3; // track holds 3 identical sets
    x.set(wrap(-set, 0, x.get() - (SPEED * delta) / 1000));
  });

  return (
    <div ref={box} className="mx-[10px] overflow-hidden">
      <motion.ul ref={track} style={{ x }} className="flex w-max">
        {[0, 1, 2].flatMap((n) =>
          HOTELS.map((h) => (
            <li key={`${n}-${h.img}`} aria-hidden={n > 0} className="mr-[10px] w-[280px] shrink-0 md:w-[387px]">
              <img src={`/img/${h.img}.png`} alt={h.name} className="aspect-square w-full rounded-[10px] object-cover" />
              <div className="mt-[9px] flex justify-center gap-[6px]">
                {Array.from({ length: h.stars }, (_, i) => <Star key={i} />)}
              </div>
              <p className="mt-[10px] h-8 text-center text-[16px] font-medium leading-4 tracking-[-0.04em]">
                {h.kind && <>{h.kind}<br /></>}
                {h.name}
              </p>
            </li>
          )),
        )}
      </motion.ul>
    </div>
  );
}
