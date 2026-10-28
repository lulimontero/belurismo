# Belurismo · Turi

Landing de belo Travel y asistente de viaje con chat, voz OpenAI Realtime por WebRTC, adjuntos, itinerario, presupuesto y gastos compartidos.

Web: https://belurismo.vercel.app

## Desarrollo

```powershell
npm ci
npm run dev
```

Copiar las variables necesarias desde `.env.example` a `.env.local`. No subir claves a GitHub. Para chat y voz, agregar `OPENAI_API_KEY`; las demás conexiones se activan por separado.

## Verificación

```powershell
npm test
npm run lint
npm run build
```

## Conexiones

Telegram, Gmail, Google Calendar y Google Drive tienen flujos de integración preparados y permisos por función. El MCP de Belo está pendiente de documentación y acceso. La interfaz muestra qué servicios están configurados y cuáles faltan.

La guía completa de activación, variables, permisos, límites y capacidades pendientes está en [docs/turi-setup.md](docs/turi-setup.md).

GitHub `main` está conectado a Vercel para despliegue automático.
