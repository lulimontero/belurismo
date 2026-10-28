# Discovery · Turi por WhatsApp con Evolution API (Baileys)

Fecha: 2026-10-28. Fuente del contrato de Evolution: código de `evolution-foundation/evolution-api` en `main` (el repo `EvolutionAPI/evolution-api` se renombró).

## Resumen

Es viable y barato. El agente ya es independiente del canal: `runAgent(input, emit)` en `lib/turi/agent.ts` recibe historial, adjuntos y un `channel`, y emite eventos. Telegram (`lib/turi/telegram.ts`) es un adaptador de transporte sobre eso. WhatsApp sale como un segundo adaptador con la misma forma: `lib/turi/whatsapp.ts` clonando `processMessage` y cambiando solo la entrada (webhook de Evolution) y la salida (`sendText`).

El costo real está en infraestructura: Evolution API necesita un servidor persistente (Docker + Postgres, opcional Redis) con la sesión de WhatsApp viva. No corre en Vercel.

## Cómo encaja hoy Telegram (lo que se copia)

| Pieza | Telegram hoy | Dónde |
| --- | --- | --- |
| Entrada | `POST /api/turi/telegram/webhook` | `app/api/turi/[...path]/route.ts:217` |
| Auth del webhook | header `x-telegram-bot-api-secret-token` vs `TELEGRAM_WEBHOOK_SECRET` | `receiveTelegram` |
| Dedupe | `SET turi:tg-update:<update_id> NX` en Redis | `receiveTelegram` |
| Respuesta async | `after()` de Next, responde 200 al toque | `receiveTelegram` |
| Vinculación | código de un uso en Redis (10 min), deep link `t.me/<bot>?start=<code>` | `telegramLink` |
| Mapeo chat → sesión | `turi:tg-chat:<chatId>` sellado + `account.telegram` | `processMessage`, `lib/turi/storage.ts:22` |
| Agente | `runAgent(..., channel: "telegram privado vinculado")` | `processMessage` |
| Salida | `sendMessage` en trozos de 3800 | `sendTelegram` |
| Alertas | cron que manda por Telegram | `sendDueReminders` |

## Mapeo a Evolution API

| Concepto | Evolution API | Estado |
| --- | --- | --- |
| Auth del webhook | `webhook.headers` es configurable por instancia y se manda tal cual en cada POST. Ponemos `x-turi-secret: <WHATSAPP_WEBHOOK_SECRET>` | verificado en `webhook.controller.ts` |
| Payload | `{ event, instance, data, sender, server_url, apikey, date_time }` | verificado |
| Evento a escuchar | `MESSAGES_UPSERT` (llega como `messages.upsert`) | verificado |
| Chat / remitente | `data.key.remoteJid` (`549...@s.whatsapp.net`; grupos terminan en `@g.us`) | [INPUT] confirmar con un mensaje real |
| Ignorar propios | `data.key.fromMe === true` | [INPUT] idem |
| Dedupe | `data.key.id` | [INPUT] idem |
| Texto | `data.message.conversation` o `data.message.extendedTextMessage.text`; caption en `imageMessage.caption` / `documentMessage.caption` | [INPUT] idem |
| Adjuntos | con `webhook.base64: true` el archivo llega en `data.message.base64`. Evita un segundo request | verificado en `whatsapp.baileys.service.ts:1445` |
| Responder | `POST {EVOLUTION_URL}/message/sendText/{instance}`, header `apikey`, body `{ number, text }` | `SendTextDto` verificado; `number` viene de `Metadata` |
| "Escribiendo..." | `POST /chat/sendPresence/{instance}` | [INPUT] confirmar body |
| Vinculación | `https://wa.me/<numero>?text=TURI-<code>` (texto precargado). El webhook detecta `^TURI-([a-z0-9]{20,64})$` | diseño, igual que `/start <code>` |

## Cambios en el código

1. `lib/turi/whatsapp.ts` (nuevo, ~250 líneas): `whatsappConfigured`, `whatsappLink`, `receiveWhatsapp`, `sendWhatsapp`. Copia de la estructura de Telegram.
2. `lib/turi/storage.ts`: `whatsapp?: { jid: string; alerts: boolean }` en la cuenta.
3. `app/api/turi/[...path]/route.ts`: rutas `whatsapp/webhook`, `whatsapp/link`, `connections/whatsapp` (desvincular) y la fila en el listado de conexiones.
4. `lib/turi/agent.ts:436`: el chequeo `channel?.includes("telegram")` salta el flujo de referencia guiado (que usa widgets). Tiene que saltarlo también para WhatsApp. Lo mismo con `:215` (estado de conexiones que ve el modelo).
5. `components/turi/ConnectionsView.tsx`: botón "Vincular WhatsApp" igual al de Telegram.
6. Formato: el modelo responde en Markdown. WhatsApp usa `*negrita*`, `_itálica_`, sin links con texto. Conversión mínima de `**x**` a `*x*` y de `[t](url)` a `t: url`.
7. Alertas: `sendDueReminders` está atado a `account.telegram`. Para WhatsApp alcanza con elegir el canal vinculado al enviar. Diferible: las alertas proactivas por Baileys son las que más riesgo de ban tienen.
8. `scripts/setup-whatsapp.mjs`: llama a `POST /webhook/set/{instance}` con url, `headers`, `base64: true` y `events: ["MESSAGES_UPSERT"]`.

Variables nuevas: `EVOLUTION_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE`, `WHATSAPP_NUMBER` (para el link wa.me), `WHATSAPP_WEBHOOK_SECRET`.

## Mejora que WhatsApp pide

En WhatsApp la gente manda audios. Telegram hoy los rechaza (`message.voice` → "usá la web"). Con `base64: true` el audio llega en el webhook y se puede transcribir con la misma `OPENAI_API_KEY` antes de llamar a `runAgent`. Sugiero subirlo de P2 a P1 para este canal.

## Infra

- Evolution API v2 en Docker, con Postgres. Opciones: Railway, Render, Fly o un VPS. [INPUT] dónde se hostea y quién lo banca.
- Escanear el QR una vez con el número que va a ser Turi (`GET /instance/connect/{instance}`).
- La sesión vive en ese servidor: si se cae, Turi deja de responder en WhatsApp. La web y Telegram siguen funcionando.

## Riesgos

- **Baileys es no oficial.** WhatsApp puede banear el número, sobre todo con mensajes salientes masivos o a gente que no escribió primero. Usar un chip dedicado, nunca un número personal ni uno de belo.
- **Para producción real de belo** el camino es WhatsApp Cloud API (Evolution también la soporta como integración `WHATSAPP-BUSINESS`, con otro formato de payload). Para la hackathon y la demo, Baileys alcanza.
- Mismas reglas que Telegram: solo chats privados, ningún movimiento de plata se aprueba por WhatsApp, las propuestas quedan para revisar en la web.
- `after()` en Vercel tiene el límite de duración de la función. Las respuestas con búsqueda web ya conviven con eso en Telegram.

## Esfuerzo

Medio día de código (es un clon del adaptador de Telegram) más el setup del servidor de Evolution. La primera hora conviene gastarla en levantar Evolution y loguear un `messages.upsert` real para cerrar los `[INPUT]` del payload antes de escribir el parser.

## Pendientes

- [INPUT] hosting de Evolution y número dedicado.
- [INPUT] ¿solo demo o usuarios reales? Define Baileys vs Cloud API.
- [INPUT] payload real de `messages.upsert` (texto, imagen, PDF, audio) para fijar el parser.
