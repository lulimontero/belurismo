import Faq from "@/components/Faq";
import HotelMarquee from "@/components/HotelMarquee";
import HowItWorks from "@/components/HowItWorks";
import Nav from "@/components/Nav";
import TuriBot from "@/components/TuriBot";
import TravelHero from "@/components/travel/TravelHero";

const TRAVEL = "https://travel.belo.app/access";

const WHY = [
  { img: "8okd7IOy8NWq5GoJsxKW84S5W0Y", title: "Descuentos increíbles", desc: "Reservá con tarifas exclusivas y viajá accediendo al mejor precio posible. Cada día surgen nuevas oportunidades para que tu próxima escapada esté un paso más cerca." },
  { img: "OnstBX9Qc2HTXeXnHqmVeoiyCdY", title: "Múltiples formas de pago", desc: "Elegí tu próximo destino y pagalo con USDT, USDC, pesos o cualquiera de las monedas disponibles en tu cuenta de belo a través de tu belo Mastercard." },
  { img: "d9WUZ4miQqWJPQhEnHN2DvFu1Hs", title: "Cambios de plan sin drama", desc: "Opciones con cancelación reembolsable y alojamientos con desayuno y otros amenities incluidos para viajar sin preocupaciones." },
];

// "\n" = line break present in the original copy
const PARTNERS = [
  { name: "Civitatis", img: "M8oUoyw9iz6wEFMsDrYLQDK8Kjw", desc: "Excursiones y experiencias\núnicas en tu destino.", promo: "Free tours y muchos beneficios más…" },
  { name: "AXA Assistance", img: "TopIpQwilJ7veE7pDAakh91TeM", desc: "Asistencia al viajero con\ncobertura internacional.", promo: "50% descuento en\ntodas las coberturas", href: "https://belotravel.axa-assistance.com.ar/" },
  { name: "Rentcars", img: "uu7APXqRHlZZYEb7Fhzua4rdo7w", desc: "Alquiler de vehículos\nen todo el mundo", promo: "10% OFF en alquiler de autos" },
  { name: "Airalo", img: "PJSD5Ef03uyGXaHv1dvFqDtE8fE", desc: "eSIM para viajar conectado desde que aterrizás.", promo: "20% de descuento en todos los\nplanes" },
  { name: "Radical Storage", img: "TELyzpmAS3ElzoI6LaeK9s628jA", desc: "Guarda tu equipaje de forma segura en cualquier ciudad.", promo: "10% de descuento en todo el sitio" },
  { name: "USA Visa Travel", img: "Zg6lZrBdZJqD6Ra9GJI2SGIadyI", desc: "Gestión rápida y simple de tu visa para EE.UU.", promo: "10% de descuento en todas las visas", href: "https://usavisa.travel/tramite" },
];

const FOOTER = [
  { h: "¿Qué es belo?", links: [["Blog", "https://www.belo.app/blog"], ["Eventos", "https://www.elcaminodelfreelancer.com/novedades"], ["Freelancers", "https://elcaminodelfreelancer.com/"]] },
  { h: "Assets", links: [["Toolkit", "https://www.elcaminodelfreelancer.com/toolkit"], ["Media kit", "https://esbiensimple.com/mediakit"], ["Comunidad", "https://discord.com/invite/MwaBDsnSt4"]] },
  { h: "Interno", links: [["Trabajá en belo", "https://work.belo.app/"], ["Colaborá en belo", "https://tally.so/r/npv7Mq"], ["Ayuda", "https://help.belo.app/"]] },
  { h: "Legales", links: [["Privacidad", "https://help.belo.app/es/articles/5362781-politicas-de-privacidad"], ["Términos", "https://help.belo.app/es/collections/3016716-terminos-y-condiciones"], ["Aviso de Riesgo", "https://help.belo.app/es/articles/11780143-aviso-de-riesgos"]] },
];

const legal = "text-[10px] font-medium leading-[14px] tracking-[-0.01em] text-ash";

export default function Home() {
  return (
    <main className="overflow-x-clip">
      <Nav />

      <TravelHero />

      {/* S2 marquee */}
      <section className="mt-[110px] text-center">
        <HotelMarquee />
        <a href={TRAVEL} className="pill mt-[130px]">Ver más destinos</a>
      </section>

      {/* S3 why */}
      <section className="mx-auto max-w-[992px] px-4 pb-[137px] pt-[120px]">
        <h2 className="h-display text-center text-[40px] md:text-[58px]">¿Por qué elegir belo Travel?</h2>
        <div className="mt-[100px] grid gap-10 md:grid-cols-3 md:gap-[19.5px]">
          {WHY.map((w) => (
            <article key={w.title}>
              <img src={`/img/${w.img}.png`} alt="" className="aspect-square w-full rounded-[20px] object-cover" />
              <h3 className="o32 mt-5 text-[22px] font-semibold leading-[22px] tracking-[-0.02em]">{w.title}</h3>
              <p className="o32 no-cv11 mt-[10px] text-balance text-[18px] font-medium leading-[21.6px] tracking-[-0.01em] text-ash">{w.desc}</p>
            </article>
          ))}
        </div>
      </section>

      {/* S4 how it works */}
      <HowItWorks />

      {/* S5 partners */}
      <section className="mx-auto max-w-[992px] px-4 pt-20 text-center">
        <h2 className="h-display text-[36px] md:text-[45px]">Completá tu viaje con belo 💜🚀</h2>
        <p className="mt-[15px] text-[18px] font-medium leading-[18px] tracking-[-0.04em] text-ash">con nuestros partners podés sumar…</p>
        <div className="mt-[60px] grid gap-x-[10px] gap-y-10 text-left sm:grid-cols-2 md:grid-cols-3">
          {PARTNERS.map((p) => {
            const img = <img src={`/img/${p.img}.png`} alt={p.name} className="aspect-square w-full rounded-[20px] object-cover" />;
            return (
              <article key={p.name}>
                {p.href ? <a href={p.href} target="_blank" rel="noopener noreferrer">{img}</a> : img}
                <h3 className="o32 mt-5 text-[22px] font-semibold leading-[22px] tracking-[-0.02em]">{p.name}</h3>
                <p className="o32 no-cv11 mt-5 whitespace-pre-line text-[20px] font-medium leading-6 tracking-[-0.01em] text-ash">{p.desc}</p>
                <p className="no-cv11 mt-5 whitespace-pre-line text-[17px] font-bold italic leading-[20.4px] tracking-[-0.01em] text-ash">{p.promo}</p>
              </article>
            );
          })}
        </div>
      </section>

      {/* S6 FAQ */}
      <section className="mx-auto max-w-[1030px] px-4 pb-20 pt-[150px] md:pt-[216px]">
        <h2 className="h-display text-[48px] tracking-[-0.03em] md:text-[66px]">
          Preguntas<br />Frecuentes
        </h2>
        <Faq />
        <a
          href="https://help.belo.app/es/articles/11593995-preguntas-frecuentes-sobre-belo-travel"
          className="pill mt-[90px]"
        >
          Tengo otras preguntas
        </a>
      </section>

      {/* S7 CTA */}
      <section
        className="bg-cover bg-center px-4"
        style={{ backgroundImage: "url(/img/YMSD5lClIyNop3F75yIYAoCbihc.png)" }}
      >
        <div className="mx-auto flex max-w-[1125px] flex-col justify-between gap-10 py-20 md:h-[661px] md:flex-row md:py-0">
          <div className="text-white md:pt-[168px]">
            <img src="/img/oq3GLXpld25WUOGAN49tSr3Vek.svg" alt="" width={59} height={19} />
            <h2 className="mt-[41px] text-[40px] font-bold leading-[1.1] tracking-[-0.05em] md:text-[50px]">
              ¿Listo para viajar<br />pagando menos?
            </h2>
            <p className="o32 no-cv11 mt-[22px] text-[22px] font-medium leading-[24.2px] tracking-[-0.01em]">
              Creá tu cuenta en belo Travel<br />y reservá al mejor precio.
            </p>
            <a href={TRAVEL} className="pill mt-[42px] h-11! px-[22px]!">Reservá ahora con belo Travel</a>
          </div>
          <img
            src="/img/wuAwzL2qCt0xb1lYsVs7g5TcMHs.png"
            alt="Dos valijas celestes con la sonrisa de belo"
            className="aspect-square w-full max-w-[501px] self-center object-cover md:mt-20 md:self-start"
          />
        </div>
      </section>

      {/* S8 footer */}
      <footer
        className="bg-cover bg-center px-4"
        style={{ backgroundImage: "url(/img/XNzzwSHSEVPNxElYFnksemF43w.png)" }}
      >
        <div className="mx-auto max-w-[1225px] py-[100px]">
          <div className="flex flex-col justify-between gap-12 md:flex-row">
            <img src="/img/JSMlPIk0kKoyhxUS3SpONTLKI.png" alt="belo" width={157} height={76} className="mt-[7px] h-[76px] w-[157px]" />
            <div className="grid grid-cols-2 gap-6 text-center md:flex">
              {FOOTER.map((c) => (
                <div key={c.h} className="flex flex-col items-center gap-[14px] text-[15px] leading-[15px] tracking-[-0.02em] text-ash">
                  <p className="font-bold">{c.h}</p>
                  {c.links.map(([label, href]) => (
                    <a key={label} href={href} className="transition-colors hover:text-white">{label}</a>
                  ))}
                </div>
              ))}
            </div>
          </div>
          <div className="mt-[165px] flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <p className={legal}>® 2026 belo. Todos los derechos reservados.</p>
            <p className={`${legal} max-w-[839px] text-balance md:text-right`}>
              belo no proporciona información ni recomendación financiera. Por favor, consulta con profesionales adecuados ante cualquier duda. Operar con criptoactivos conlleva ciertos riesgos. Es importante que leas nuestros Términos y Condiciones.
            </p>
          </div>
          <p className={`${legal} mt-[34px]`}>
            belo Argentina S.A.- Proveedor de Servicios de Activos Virtuales (PSAV) inscripto bajo el N° 52 de fecha 19 de julio de 2024 en el Registro de Proveedores de Servicios de Activos Virtuales de CNV. Este registro es a los fines del control como Sujeto Obligado ante la Unidad de Información Financiera (UIF) y de todo otro ente regulador facultado a tal efecto, en el marco de sus competencias, y no implica licencia ni supervisión por parte de la COMISIÓN NACIONAL DE VALORES sobre la actividad realizada por el PSAV.
          </p>
        </div>
      </footer>

      <TuriBot />
    </main>
  );
}
