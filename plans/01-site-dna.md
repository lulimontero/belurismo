# Site DNA — belo Travel (https://www.belo.app/ar/travel)

AUDIT_MODE: high-fidelity

Capturado 2026-10-28, viewport 1440x900, locale es-AR (forzado vía navigator.language; sin eso Framer redirige a /en-us/).
Screenshots de referencia: `plans/shots/vp-00..07.png` (scroll de a 800px), `full.png`, `hover-nav.png`, `faq-open.png`, `partners-head.png`.

---

## 1.1 — PAGE ARCHITECTURE

Altura total: 6359px. Sitio Framer: no usa `<section>` a nivel raíz; un único div raíz contiene todo. Secciones identificadas por bloques visuales/top offsets.

```
╔══════════════════════════════════════════════════════════════╗
║  S0: NAV (pill blanca flotante)       top 50 · H 64          ║
║  BG: #FFFFFF r=66px sobre página #FAFAFA · NO sticky         ║
╠══════════════════════════════════════════════════════════════╣
║  S1: HERO texto centrado              top ~280 · H ~300      ║
║  BG: #FAFAFA · centrado, max-w ~900                          ║
╠══════════════════════════════════════════════════════════════╣
║  S2: MARQUEE HOTELES                  top 656 · H ~580       ║
║  BG: #FAFAFA · full-bleed, cards 387x387 r=10 + caption      ║
║  + botón "Ver más destinos" centrado (top 1236)              ║
╠══════════════════════════════════════════════════════════════╣
║  S3: ¿POR QUÉ ELEGIR belo TRAVEL?     top 1396 · H ~700      ║
║  BG: #FAFAFA · 3 columnas, max-w ~960 centrado               ║
╠══════════════════════════════════════════════════════════════╣
║  S4: ¿CÓMO FUNCIONA? (slider)         top 2158 · H 926       ║
║  BG: imagen gradiente navy→azul (YMSD5…png) full-bleed       ║
╠══════════════════════════════════════════════════════════════╣
║  S5: COMPLETÁ TU VIAJE (partners)     top ~3150 · H ~1250    ║
║  BG: #FAFAFA · grilla 3x2 cards 313x313 r=20                 ║
╠══════════════════════════════════════════════════════════════╣
║  S6: PREGUNTAS FRECUENTES             top 4527 · H ~600      ║
║  BG: #FAFAFA · alineado izq, max-w ~1000                     ║
╠══════════════════════════════════════════════════════════════╣
║  S7: CTA FINAL                        top 5127 · H 661       ║
║  BG: misma imagen gradiente que S4 · 2 columnas              ║
╠══════════════════════════════════════════════════════════════╣
║  S8: FOOTER                           top 5788 · H 557       ║
║  BG: imagen XNzzw…png (navy casi negro → violeta abajo-izq)  ║
╚══════════════════════════════════════════════════════════════╝
```

OVERLAPPING: el dropdown del nav (mega-menú) se superpone sobre el hero (absolute, z alto). Ninguna otra superposición.

---

## 1.2 — DESIGN TOKENS

```
PALETTE:
  Page BG "Fog":           #FAFAFA  → fondo general de S1,S2,S3,S5,S6
  Surface "White":         #FFFFFF  → nav pill, dropdown, FAQ items, mockups
  Ink "Black":             #000000  → headings sobre claro, botones (bg)
  Muted "Ash":             #999999  → subtítulos, descripciones, links nav, footer
  Muted-2:                 #636363  → íconos +/− del FAQ
  Overlay:                 rgba(0,0,0,0.2)
  belo Violet (logo):      ~#5B2BE0 → "belo" del logo (imagen)
  belo Mint (logo smile):  ~#2EE8A5 → sonrisa del logo, badge "-60% OFF", botón "Regístrate" del mockup
  Deep Navy (grad top):    ~#1E0E8F / #22128F → arriba de S4 y S7
  Sky Blue (grad bottom):  ~#4A8BFF → #6BB6FF → abajo de S4 y S7
  Footer Night:            ~#05031F → violeta ~#6A1FD6 en esquina inferior izquierda
  Star Gold:               ~#F5B82E → estrellas de hoteles
  Partner tiles (logos, son imágenes): Civitatis #F50B5A, AXA #00008F, Rentcars #F5A70D, Airalo #F3EDE5, Radical #222, USAVisa #FFF

TYPOGRAPHY SCALE (todo Inter Variable, font-feature-settings "cv01","cv05","cv09","cv11","ss03"):
  Role          | Family         | Weight (wght var) | Size  | Tracking  | LH    | Color
  ──────────────────────────────────────────────────────────────────────────────────────
  Display H1    | Inter Variable | 700 (opsz 32)     | 58px  | -2.32px (-0.04em) | 1.0  | #000
  Section H2    | Inter Variable | 700 (opsz 32)     | 58px  | -2.32px   | 1.0   | #000
  H2 sobre azul | Inter Variable | 700               | 45px  | -1.8px    | 1.0   | #FFF
  FAQ H2        | Inter Variable | 700               | 66px  | -1.98px   | 1.0   | #000 (2 líneas, alineado izq)
  CTA H2        | Inter          | 700               | 50px  | -2.5px    | 55px  | #FFF
  Card title    | Inter Variable | 600               | 22px  | -0.44px   | 1.0   | #000 / #FFF
  Body grande   | Inter Variable | 400               | 18-20px | -0.18/-0.2px | 1.2 | #999
  Subtítulo     | Inter          | 500               | 18px  | -0.72px   | 1.0   | #999
  Partner promo | Inter          | 700 italic        | 17px  | -0.17px   | 1.2   | #999
  Hotel caption | Inter          | 500               | 16px  | -0.64px   | 1.0   | #000 (centrado, 2 líneas: tipo + nombre)
  FAQ q/a       | Inter Variable | 400               | 15px  | -0.15px   | 18/19.5px | q #000, a #999
  Nav link      | Inter          | 600               | 14px  | -0.28px   | 16.8px| #999
  Button        | Inter Variable | 600               | 14px  | ~-0.2px   | 1     | #FFF
  Dropdown desc | Inter          | 400               | 11px  | -0.22px   | 17.6px| #999
  Footer col h  | Inter          | 700               | 15px  | -0.3px    | 1     | #999
  Legal         | Inter          | 500               | 10px  | -0.1px    | 14px  | #999
  ⚑ DRAMA NOTES: titulares a wght 700 con tracking -0.04em y line-height 1.0 → bloques compactos, casi "pegados". Contra subtítulos gris #999 peso 500 a 18px. Ese contraste negro-apretado vs gris-aireado ES la identidad. No soltar el tracking negativo.

SPACING: base 4/8. Gutter de grillas 10px (marquee 397-387) y ~10-20px (cards). Secciones separadas ~150-200px verticales.
BORDER RADIUS: pill 100px (botones) · 66px (nav) · 25px (items nav) · 20px (cards features/partners/slider) · 13px (thumbs dropdown) · 10px (cards hotel) · ~10px FAQ items
SHADOW: casi nula. Dropdown: sombra suave grande (~0 10px 40px rgba(0,0,0,0.08)).
TEXTURE: ninguna; los fondos azules son imágenes de gradiente con viñeteado suave.
```

---

## 1.3 — SECTION BLUEPRINTS

### SECTION 0: NAV
Height 64 · pill blanca w=1110 centrada, top 50, r=66, sin borde ni sombra. Contenedor 1385 de ancho (framer-name "Menú V2 1200 - AR").
```
┌──────────────────────────────────────────────────────────────────┐
│ (belo® logo 52x?)          Recibir Transferir Cuenta personal    │
│                            Travel Comunidad Empresas APIs   🌎   │
└──────────────────────────────────────────────────────────────────┘
Flex row, logo izq (padding ~30px), links a la derecha con gap ~30px.
```
Hover sobre un link abre un DROPDOWN (card blanca r=~20, sombra suave, aparece ~45px debajo del pill) con título gris "Transferir" y N cards: thumb 153x82 r=13 (gradiente navy→violeta con ícono 3D) + título 14/600 #999 + desc 11px #999.
- Transferir: Nacional ("Transferí dinero a bancos y billeteras dentro de Argentina desde belo"), Internacional ("Transferencias internacionales a cuentas y billeteras de todo el mundo").
- Comunidad: Blog, Beneficios, belo Plus, Ayuda (textos en 1.2 captura).

### SECTION 1: HERO
```
┌──────────────────────────────────────────────┐
│     Hoteles, all inclusives y resorts        │  H1 58/700 centrado, 2 líneas
│          con hasta 65% OFF                   │
│   Más de 100.000 alojamientos con            │  18/500 #999, 2 líneas
│   descuentos increíbles en todo el mundo     │
│        [ Buscar mi próximo destino ]         │  pill negra 253x40, padding 20/40
└──────────────────────────────────────────────┘
```
Links CTA → https://travel.belo.app/access

### SECTION 2: MARQUEE HOTELES
6 cards repetidas x3 (loop infinito). Card: imagen cuadrada 387x387 r=10, debajo 5 estrellas doradas (o 4) centradas y caption 2 líneas.
Orden: 1 Sheraton Grand Rio ("Hotel & Resort") · 2 Dreams Tulum Resort & Spa ("All inclusive") · 3 Iberostar Selection Hacienda Dominicus ("All inclusive") · 4 Novotel Paris Centre Tour Eiffel · 5 Four Seasons Resort Orlando at WALT DISNEY WORLD® Resort · 6 Hard Rock Hotel Ibiza.
Imágenes (en orden de la UL): qwJUERfvInM8U8pMYk64HYhJluA, S75fbSUheHzV1PVf3b4fNlAI14, nPytuKYJFJNsSfWrNGsZxckLKI, l4Nf3xqsM2KqFYT4LMG3tXR9io, DOAc5yqweORJq85HOmjg55JLc, OUBOAtrgm2kC73ea0g1HOybsU (todas `https://framerusercontent.com/images/<id>.png`).
Gap 10px. Bordes laterales: fade/clip en los extremos (card cortada en x=10 y x=1415).
Debajo: pill negra "Ver más destinos" 193x40 centrada.

### SECTION 3: ¿POR QUÉ ELEGIR belo TRAVEL?
```
            ¿Por qué elegir belo Travel?          (H2 58/700 centrado)
┌──────────┐ ┌──────────┐ ┌──────────┐
│ img 307² │ │ img 307² │ │ img 307² │   r=20, mockups de UI sobre gradiente navy→celeste
└──────────┘ └──────────┘ └──────────┘
 Título 22/600  ...                        
 Desc 18/400 #999 (4-5 líneas)
```
1. Descuentos increíbles · "Reservá con tarifas exclusivas y viajá accediendo al mejor precio posible. Cada día surgen nuevas oportunidades para que tu próxima escapada esté un paso más cerca." · img 8okd7IOy8NWq5GoJsxKW84S5W0Y
2. Múltiples formas de pago · "Elegí tu próximo destino y pagalo con USDT, USDC, pesos o cualquiera de las monedas disponibles en tu cuenta de belo a través de tu belo Mastercard." · img OnstBX9Qc2HTXeXnHqmVeoiyCdY
3. Cambios de plan sin drama · "Opciones con cancelación reembolsable y alojamientos con desayuno y otros amenities incluidos para viajar sin preocupaciones." · img d9WUZ4miQqWJPQhEnHN2DvFu1Hs
Columnas x=240/567/893 → cards ~307 ancho, gap ~20.

### SECTION 4: ¿CÓMO FUNCIONA?
BG imagen YMSD5lClIyNop3F75yIYAoCbihc.png (1440x926, cover).
```
              ¿Cómo funciona?        (45/700 blanco)
              En 4 simples pasos     (18/500 #999)
   ┌────────────────────────────────────┐
   │  screenshot 765x453 r=20           │      (›) flecha circular a la derecha (x≈1280)
   └────────────────────────────────────┘
              Ingresar en belo travel   (22/600 blanco, caption del slide activo)
                  ( ● ○ ○ ○ )           dots en pill azul translúcida
```
Slides (img / caption):
1. hhfUIGGjVy7Kd6VLcHBCywvm8FY · "Ingresar en belo travel"
2. rZLLXAF6HLbWimdx3wHms90fYkY · "Crear cuenta o iniciar sesión"
3. YfvSmMGdHInrGAWA0MAjxVyrj8 · "Buscar alojamiento"
4. jghVUQxdLNFcGkfgZi2xlDKy1c · "Selecciona el método de pago"
Slides separados 948px (765 + gap). Solo uno visible (overflow hidden, ancho 900).

### SECTION 5: COMPLETÁ TU VIAJE CON belo 💜🚀
H2 45/700 centrado ("Completá tu viaje con belo 💜🚀") — en el original está en BLANCO sobre #FAFAFA (casi invisible, bug del sitio). En el clon: usar #000.
Sub "con nuestros partners podés sumar…" 18/500 #999.
Grilla 3x2, cards 313x313 r=20 (logo full-bleed), debajo título 22/600, desc 20/400 #999, promo 17/700 italic #999.
| Partner | img id | desc | promo |
|---|---|---|---|
| Civitatis | M8oUoyw9iz6wEFMsDrYLQDK8Kjw | Excursiones y experiencias únicas en tu destino. | Free tours y muchos beneficios más… |
| AXA Assistance | TopIpQwilJ7veE7pDAakh91TeM | Asistencia al viajero con cobertura internacional. | 50% descuento en todas las coberturas |
| Rentcars | uu7APXqRHlZZYEb7Fhzua4rdo7w | Alquiler de vehículos en todo el mundo | 10% OFF en alquiler de autos |
| Airalo | PJSD5Ef03uyGXaHv1dvFqDtE8fE | eSIM para viajar conectado desde que aterrizás. | 20% de descuento en todos los planes |
| Radical Storage | TELyzpmAS3ElzoI6LaeK9s628jA | Guarda tu equipaje de forma segura en cualquier ciudad. | 10% de descuento en todo el sitio |
| USA Visa Travel | Zg6lZrBdZJqD6Ra9GJI2SGIadyI | Gestión rápida y simple de tu visa para EE.UU. | 10% de descuento en todas las visas |
Links partners: AXA → https://belotravel.axa-assistance.com.ar/ · USAVisa → https://usavisa.travel/tramite

### SECTION 6: PREGUNTAS FRECUENTES
H2 "Preguntas / Frecuentes" 66/700 en 2 líneas, alineado izq x=212.
3 items acordeón, ancho ~1000, bg #FFF, r~10, alto 50 cerrado, gap 8. Ícono "+" #636363 a la izq → "−" al abrir. Respuesta 15px #999 con padding-left igual al texto de la pregunta.
1. ¿Qué medios de pago están disponibles? → "Podés pagar no solo con tu belo Mastercard, sino también con criptomonedas atadas al valor del dólar como USDT y USDC y tarjetas Visa, Mastercard y Amex. También es posible pagar con Apple Pay y Google Pay."
2. ¿Qué impuestos se aplican si pago con tarjeta argentina en pesos? → "Al pagar con tarjeta un consumo del exterior, se sumará al valor en USD mostrado en el sitio, una percepción del 30% aplicada a consumos en moneda extranjera a través de la Resolución General N° 5617 de AFIP."
3. ¿Cómo funciona el soporte? → "El soporte está disponible 24/7 y podés contactarte por: - Telegram - Formulario por correo. El soporte lo brinda Entravel como plataforma de gestión de reservas turísticas, y no belo. Quedate tranquilo, están disponibles en todo momento y desde belo estamos para acompañarte. Por el momento solo en inglés. Próximamente se sumarán español y portugués."
Debajo (margen ~90px): pill negra "Tengo otras preguntas" 228x40 alineada izq → https://help.belo.app/es/articles/11593995-preguntas-frecuentes-sobre-belo-travel

### SECTION 7: CTA FINAL
BG misma imagen gradiente que S4.
```
┌──────────────────────────────┬──────────────────────────────┐
│  ◡ (sonrisa belo blanca 59x19)│                              │
│  ¿Listo para viajar          │   ilustración 3D 2 valijas   │
│  pagando menos?  (50/700)    │   celestes con stickers 🇧🇷🇦🇷   │
│  Creá tu cuenta en belo      │   501x501 (wuAwzL2qCt0xb1lYsVs7g5TcMHs) │
│  Travel y reservá al mejor   │                              │
│  precio. (22/400 blanco)     │                              │
│  [Reservá ahora con belo Travel] pill negra 242x44          │
└──────────────────────────────┴──────────────────────────────┘
Col izq x=150, col der x=789.
```
Sonrisa: oq3GLXpld25WUOGAN49tSr3Vek.svg

### SECTION 8: FOOTER
BG XNzzwSHSEVPNxElYFnksemF43w.png. Logo belo blanco 157x76 (JSMlPIk0kKoyhxUS3SpONTLKI.png) a la izq x=100.
4 columnas a la derecha (centradas c/u): ¿Qué es belo? (Blog, Eventos, Freelancers) · Assets (Toolkit, Media kit, Comunidad) · Interno (Trabajá en belo, Colaborá en belo, Ayuda) · Legales (Privacidad, Términos, Aviso de Riesgo). 15px #999.
Abajo: "® 2026 belo. Todos los derechos reservados." izq; disclaimer der alineado der: "belo no proporciona información ni recomendación financiera. Por favor, consulta con profesionales adecuados ante cualquier duda. Operar con criptoactivos conlleva ciertos riesgos. Es importante que leas nuestros Términos y Condiciones."
Legal full width: "belo Argentina S.A.- Proveedor de Servicios de Activos Virtuales (PSAV) inscripto bajo el N° 52 de fecha 19 de julio de 2024 en el Registro de Proveedores de Servicios de Activos Virtuales de CNV. Este registro es a los fines del control como Sujeto Obligado ante la Unidad de Información Financiera (UIF) y de todo otro ente regulador facultado a tal efecto, en el marco de sus competencias, y no implica licencia ni supervisión por parte de la COMISIÓN NACIONAL DE VALORES sobre la actividad realizada por el PSAV."

---

## 1.3b — COMPOSITION MAPS

### Feature cards (S3) — 3 objetos c/u
Fondo de card: gradiente vertical navy #2A1BA8 arriba → celeste #9CC8FF abajo, r=20. Dentro, un mockup blanco (r~8) recortado por el borde inferior/superior:
1. Lista de hoteles: 2 filas, foto con badge verde menta "-60% OFF"/"-50% OFF", estrellas, nombre "Búzios Beach Experience", "Insolito Bout…".
2. Selector de pago: checkboxes "Apple Pay & Google Pay", "Visa y Mastercard", "American Express", "Pagar con criptomonedas" (tildado violeta), luego USDC/USDT y redes TRON/Avalanche/Arbitrum/Ethereum/Optimism/Ton.
3. Resumen de reserva: "Stay information", Búzios Beach Resort, fechas, 1 room/2 adults, chip violeta "Reembolsable · Desayuno completo incluido".
Son imágenes estáticas: usar los PNG.

### CTA valijas (S7)
2 valijas isométricas celeste #8FD0FF con contorno negro grueso, manijas negras, sonrisa belo blanca en cada una, stickers bandera Brasil y Argentina en la izquierda. La derecha más baja y desplazada. Imagen PNG única.

---

## 1.4 — ANIMATION TIMELINES

```
ANIMATION: Marquee hoteles
Section: S2 · Trigger: siempre (auto) · Library: Framer Ticker
  UL translateX disminuye ~100px/s (−1022.79 → −1223.61 en 2000ms), lineal.
  Loop: set de 6 cards = 6×397 = 2382px → ciclo ≈ 23.8s, ease linear, infinito.
  Se pausa cuando sale del viewport (medido: no avanza con la sección fuera de vista).
  Dirección: hacia la izquierda.

ANIMATION: Slider "Cómo funciona"
Section: S4 · Trigger: click en flecha › / dots · NO auto-avanza (medido 8s sin cambio)
  Slide out/in: translateX −948px, ~500ms, ease-out (spring Framer). Caption cambia con el slide.

ANIMATION: Dropdown nav
Trigger: hover link · fade + leve translateY (≈ −8px → 0), ~200ms ease-out.

ANIMATION: FAQ accordion
Trigger: click · altura auto 0 → contenido, ~300ms ease; ícono + → −.

ANIMATION: Entradas al scroll
No se detectaron reveals significativos (contenido ya visible al hacer scroll).
```

---

## 1.5 — MICRO-INTERACTIONS

```
INTERACTION: Pill CTA negra (4 instancias)
STATE   | background | color | transform | other
DEFAULT | #000       | #FFF  | none      | r=100px, padding 20/40 (h 40), font 14/600
HOVER   | #000       | #FFF  | none      | sin cambio medible (opcional: opacity .85)
MECHANISM: ninguno visible.

INTERACTION: Link nav
DEFAULT color #999 · HOVER color #000 + abre dropdown. r=25 en el ítem.

INTERACTION: Flecha slider
Círculo ~28px bg rgba(255,255,255,0.15) / navy, chevron blanco.

INTERACTION: Dots slider
Pill contenedora azul translúcida (~rgba(40,80,200,0.6)) 82x28, 4 dots 8px; activo blanco, inactivos blanco 50%.
```

---

## 1.6 — STATE MACHINES

```
STATE MACHINE: Slider cómo funciona
STATES: 0..3 (slides). INITIAL 0. next: i=(i+1)%4. dot click: i=n.
LOOP: user-controlled.

STATE MACHINE: FAQ
Cada item toggle independiente (abrir uno no cierra otros — verificado con uno abierto y los demás cerrados).

STATE MACHINE: Nav dropdown
closed ↔ open(menuId) por hover; un menú a la vez.
```

---

## 1.7 — SCROLL CHOREOGRAPHY MAP

```
Scroll % │ Posición                 │ Evento
0%       │ load                     │ marquee corre
~10%     │ marquee visible          │ sigue corriendo; fuera de vista se pausa
~35%     │ S4 entra                 │ nada automático
resto    │                          │ sin parallax, sin sticky
NAV: NO sticky (scrollea con la página). Sin cambio de estado por scroll.
```

---

## 1.8 — TECHNICAL STACK

```
Framework: Framer (sitio publicado) — confidence: high (data-framer-component-type, framerusercontent.com)
Animation: Framer Motion interno (Ticker, Slideshow)
Scroll:    nativo
UI Lib:    estilos inline de Framer
Fonts:     Inter + Inter Variable (Google Fonts "Inter" con eje opsz sirve)
```

---

## 1.9 — MOTION PHILOSOPHY + COPY VOICE

```
MOTION PHILOSOPHY:
Funcional y casi quieta. Lo único que se mueve solo es el marquee de hoteles, lento y lineal, que da sensación de catálogo infinito sin pedir atención. Todo lo demás espera al usuario (hover, click). La calma transmite confianza financiera; la sección de destinos es la única "vidriera".

COPY VOICE PATTERN:
  Tone: conversacional, voseo rioplatense, beneficio directo.
  Sentence form: titulares cortos con número ("hasta 65% OFF", "En 4 simples pasos") + bajada de una frase.
  Key device: pregunta como titular ("¿Por qué elegir…?", "¿Cómo funciona?", "¿Listo para viajar pagando menos?").
  Example pattern: "¿Listo para [beneficio]? Creá tu cuenta en [producto] y [acción] al mejor precio."
```
