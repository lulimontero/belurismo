# Brand Interview — belurismo (Turi Belo)

Reference site: https://www.belo.app/ar/travel
Date: 2026-10-28

Entrevista no corrida: el pedido fue copiar la página tal cual como landing. Respuestas por defecto según el pedido; ajustar si cambia la dirección.

## 1. PRODUCT IDENTITY
Turi Belo: copiloto de dinero para viajar (planear, entender gastos y preparar operaciones que el usuario aprueba). Fintech / travel. Proyecto de la hackathon de belo.

## 2. AUDIENCE PERSONA
Argentinos de 22 a 45 que viajan a Brasil, usuarios de app bancaria, buscan pagar menos.

## 3. BRAND FEELING
Confiable, luminoso, directo.

## 4. COLOR PALETTE
La del original (ver 01-site-dna.md §1.2).

## 5. PAGE SECTIONS
Nav, Hero, Marquee hoteles, ¿Por qué elegir?, ¿Cómo funciona?, Partners, FAQ, CTA final, Footer + bot flotante.

## 6. PRIMARY HEADLINE
Headline: "Hoteles, all inclusives y resorts con hasta 65% OFF"
Subheadline: "Más de 100.000 alojamientos con descuentos increíbles en todo el mundo"

## 7. PRIMARY CTA
Action: entrar a belo travel
Button label: "Buscar mi próximo destino"

## 8. KEY DIFFERENTIATOR
Pagar el viaje con cualquier moneda de la cuenta belo.

## 9. ANIMATION INTENSITY
Level: 3 (marquee + slider + accordion + dropdown, todo con framer-motion, y el bot con pulso de vida).

## 10. TECH STACK
Next.js (App Router) + TypeScript + Tailwind + framer-motion.

## 11. CONTENT ASSETS
Logo: sí, los PNG/SVG del original (framerusercontent.com), descargados a `public/`.
Photography: las imágenes del original.

## 12. SECTION MODIFICATIONS
- Nav: KEEP AS-IS (con dropdowns de Transferir y Comunidad; el resto de links sin dropdown alcanza)
- Hero: KEEP AS-IS
- Marquee hoteles: KEEP AS-IS
- ¿Por qué elegir?: KEEP AS-IS
- ¿Cómo funciona?: KEEP AS-IS
- Partners: KEEP AS-IS (título en negro, el original lo tiene blanco invisible)
- FAQ: KEEP AS-IS
- CTA final: KEEP AS-IS
- Footer: KEEP AS-IS

ADDED sections:
- Bot flotante: botón fijo abajo a la derecha (no se mueve al scrollear), con "pulso de vida" animado en framer-motion. Es la entrada a Turi Belo (el copiloto). Sin lógica de chat por ahora.
