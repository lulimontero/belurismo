# Turi: activación y alcance

La burbuja de la landing abre una conversación real preparada para OpenAI. El chat procesa las solicitudes con el modelo y los paneles calculan sus valores con los datos del viaje. No se cargan datos ficticios ni simulaciones de pagos en el producto. Sin credenciales, la interfaz informa el estado pendiente y permite organizar el viaje manualmente.

## Qué está implementado

- Chat de texto por streaming con Responses, búsqueda web con fuentes y llamadas a herramientas.
- Recomendaciones dentro de la respuesta con tarjetas de hoteles, restaurantes, actividades, playas y lugares: foto publicada en la fuente, zona, servicios, pros/contras y condiciones por confirmar. Una tarifa requiere evidencia del importe publicado; el presupuesto del viajero no se muestra como precio. Las fotos se obtienen de metadatos de páginas públicas con tiempo/tamaño acotados y validación de red; si la fuente bloquea la carga o no tiene foto utilizable, se informa y se conserva el enlace. Nunca se reemplaza por una foto genérica.
- Flujo de previa: datos faltantes de a uno, fechas/noches, ocupación/edades de menores, presupuesto por noche/estadía y alcance del gasto; recomendaciones adaptadas, checklist y propuestas revisables. No se reutilizan precios, promociones ni comercios ficticios de los prototipos.
- Voz speech-to-speech con OpenAI Realtime y WebRTC. Audio directo entre navegador y OpenAI; el servidor negocia SDP y conserva la API key. Detección semántica de turnos, interrupciones, transcripción, mute y cierre de pistas al terminar. La sesión de la interfaz se cierra a los 10 minutos.
- Imágenes JPEG/PNG/WebP y PDF. Hasta 3 archivos, 2,5 MB combinados. Validación de tamaño y firma del archivo. No se guardan los archivos en localStorage ni en Redis; sólo el texto de la conversación y los nombres para el historial local. La política del proveedor sigue aplicándose al procesamiento de los archivos.
- Contexto de viaje, fechas, zona horaria, viajeros, preferencias, presupuesto total/diario/por categoría y reserva organizativa para la vuelta.
- Gastos en dos monedas con equivalencia aportada por el usuario; referencia cambiaria diaria con fuente y fecha. No se toma la referencia como tasa bancaria.
- Grupo organizativo con adultos y consentimiento confirmado, belotags voluntarios, partes iguales o personalizadas y balance por centavos. No son sub-wallets ni cuentas administradas.
- Itinerario, recordatorios, alertas de umbral cambiario, resumen por categorías y exportación JSON. Los datos se guardan localmente; con Redis también se sincronizan con la sesión del servidor.
- Propuestas del agente para revisión antes de registrar datos. El asistente no inventa reservas, comisiones ni operaciones confirmadas.

## Respuestas visuales e interacción dentro del chat

Los patrones de `turi-pretrip.html` y `turi-posttrip.html` se portaron a componentes React dentro de la respuesta de Turi: selección de fechas, viajeros, edades y presupuesto; respuestas rápidas; barras de presupuesto y gasto diario; listas de preparación; selección de plantilla y puntajes. Se conservan sus interacciones útiles, pero los destinos, gastos, tasas, promociones, saldos y acciones simuladas de esos archivos no se cargan como datos reales.

### Opciones compactas y detalle

`TravelOptions` muestra opciones compactas con miniatura de 78 px, nombre, zona, referencia de precio y un pro y un punto a considerar. Los textos largos se presentan como extractos con puntos suspensivos; el texto completo permanece disponible en la descripción accesible y en el detalle. Se usan dos columnas sólo cuando caben dos tarjetas de al menos 250 px; en móvil se apilan sin foto de portada que ocupe toda la conversación.

Pulsar la tarjeta, o activarla con teclado, abre un `dialog` nativo con foto grande, resumen, moneda y base del precio, estimación por noches cuando corresponde, datos, pros/contras completos, limitaciones, fuente y fecha de consulta. El detalle tiene desplazamiento interno y se cierra con Escape, el botón de cierre o el fondo; el foco vuelve a la tarjeta. “Me interesa” cierra el detalle y envía un mensaje contextual para seguir evaluando: no reserva ni confirma una compra.

Las fotos corresponden a la fuente consultada. Ante ausencia o error, se muestra “Sin foto” o “Foto no disponible” y un acceso a la fuente; no se intercala una imagen genérica. Un enlace citado por la búsqueda no se convierte automáticamente en una recomendación ni en una tarjeta.

### Paneles del viaje

Los mensajes admiten descriptores `widgets` validados en `lib/turi/conversation-widgets.ts`. `ConversationWidgets` renderiza los formularios de previa, las respuestas rápidas y `ConversationPanels`; la herramienta `show_trip_panel` permite al agente mostrar un panel. Los cálculos de estos últimos salen de `buildConversationPanels(state)`, en `lib/turi/conversation-panels.ts`, y reflejan el estado actual del viaje incluso cuando se vuelve a una respuesta anterior.

| Panel | Datos y acciones reales |
| --- | --- |
| `summary` | Total registrado, tu parte, lo pagado por vos, presupuesto, reserva para la vuelta, promedio, tope diario y categorías. El margen organizativo no se presenta como saldo bancario. |
| `daily` | Barras por fecha, línea del tope y excesos calculados. Un día sin registros no equivale a gasto cero confirmado. La recomendación usa el promedio registrado + 5%, redondeado; es una referencia histórica, no un precio futuro. |
| `group` | Gastos repartidos y transferencias calculadas por centavos. Permite preparar borradores de recordatorios y pedir revisión de evidencia de pago. No marca automáticamente una deuda como saldada. |
| `recap` | Vista previa sólo de gastos comunes y sus agregados. “Copiar resumen” escribe realmente en el portapapeles; no lo envía a un grupo ni incluye gastos personales, saldos o contactos. |
| `checklist` | Ocho verificaciones de previa: documentación, asistencia, conectividad, pagos, reservas, check-in, equipaje/cuidado personal y copias. Sólo el usuario marca lo que verificó. |
| `template` | Selección de itinerario, lugares consultados elegidos como favoritos, topes por categoría e integrantes con permiso adulto confirmado. Inicia una descarga JSON real con `importReview: true`; no crea una plantilla en la nube. Los integrantes exportados llevan sólo ID y nombre. |
| `feedback` | Puntajes de 1 a 5 para lugares o actividades del propio viaje. Se puede agregar un nombre manualmente; recién al elegir estrellas se guarda el puntaje. El aporte anónimo tiene consentimiento separado y revocable, y su servicio externo continúa pendiente. |
| `leftover` | Recibe un monto aportado por el usuario, con hasta dos decimales, para consultar conversión a ARS/USD o planificar conservarlo. No deduce el saldo de una cuenta ni inventa comisiones. |
| `price-review` | Selección de un gasto existente para pedir fuentes comparables. Tener un gasto alto no prueba un cobro indebido. |
| `next-trip` | Promedio histórico y margen del 5% como orientación; los destinos se eligen para iniciar una búsqueda nueva, sin factores de costo inventados. |
| `post-trip-notice` | Preferencia de avisos, conexiones pendientes y solicitud de una propuesta de recordatorio dentro de dos días. Un botón no confirma que exista un envío programado. |

### Qué se conserva y qué sigue pendiente

Los descriptores de widgets y opciones se conservan en el historial validado. En `state.assistantPreferences` se guardan las verificaciones de previa, las selecciones de plantilla/favoritos, los puntajes y `anonymousPriceConsent`. `alertsConsent` guarda por separado la preferencia de avisos. Estos datos siguen el almacenamiento local y, si está configurado Redis, la sincronización de la sesión existente. No se marcan verificaciones ni consentimientos a partir de una búsqueda o una respuesta del modelo.

El portapapeles y la descarga de plantilla actúan en el navegador. La plantilla descargada es un archivo para revisar y reutilizar; no hay importación automática de archivos JSON ni recuperación de plantillas desde una cuenta en la nube. “Planificar con esta plantilla” retoma la conversación con las secciones elegidas y pide revisar fechas, destino y presupuesto antes de crear otro plan.

Siguen pendientes la publicación de aportes anónimos, la disponibilidad comercial de Belo Travel, la operación financiera con el MCP de Belo y la validación de Belo Air. Los avisos externos necesitan Telegram vinculado, Redis y un planificador configurado. Las conexiones Google requieren sus credenciales y permisos descritos más abajo. Conservar una preferencia o preparar un borrador no activa ninguno de esos servicios.

## Activar chat y voz

1. En Vercel → belurismo → Settings → Environment Variables, agregar `OPENAI_API_KEY` para Production y Preview.
2. La clave debe permitir `gpt-realtime-2.1`, el modelo de texto y el de búsqueda. Opcionalmente cambiar `OPENAI_REALTIME_MODEL`, `OPENAI_CHAT_MODEL` o `OPENAI_SEARCH_MODEL`. Predeterminados: texto `gpt-4.1-mini`, búsqueda con fuentes `gpt-5.4-mini` (razonamiento bajo). La búsqueda usa la misma API key y tiene consumo adicional de modelo y búsqueda web.
3. Redeploy para aplicar las variables. Para desarrollo, agregar la clave en `.env.local` y reiniciar el servidor.
4. Probar desde HTTPS, habilitar micrófono y conversar/interrumpir/mutear/cerrar. La API key no llega al navegador. No se usa una cadena de grabación → transcripción → chat → síntesis para la llamada.

`TURI_SESSION_SECRET` es un secreto interno distinto de la API key. Debe mantenerse estable: cifra las sesiones y credenciales con AES-256-GCM. Rotarlo invalida cookies y datos cifrados anteriores. Nunca debe agregarse a GitHub.

## Almacenamiento y privacidad

Agregar `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN`. Cada sesión tiene un ID aleatorio en cookie HttpOnly, SameSite=Lax y Secure en producción. Los registros de cuenta, tokens OAuth y credenciales personales de Belo se cifran antes de guardarse. Las cuentas caducan tras 90 días sin actualizarse y la cookie dura 30 días.

Sin Redis, chat/voz y el viaje local funcionan, pero las conexiones externas, Telegram y avisos en segundo plano quedan pendientes. Los límites de uso en ese modo son por instancia; para uso público con API key, configurar Redis y límites de gasto de OpenAI/Vercel. El control de origen rechaza escrituras entre sitios.

La sesión identifica este navegador, no una identidad con contraseña. Para recuperar sesiones en otros dispositivos o brindar un servicio con cuentas permanentes, agregar un proveedor de inicio de sesión antes de esa etapa. La vinculación de Telegram sólo une el chat privado con esta sesión; no crea identidad bancaria.

## Las cuatro conexiones

### Google: configuración común

Crear un cliente OAuth de tipo **Web application** en Google Cloud. Habilitar Gmail API, Calendar API, Drive API y Google Picker API. Configurar pantalla de consentimiento, usuarios de prueba o verificación de la aplicación según los permisos. Gmail `readonly` es un permiso restringido y puede requerir verificación de Google para uso público.

Variables: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `APP_URL=https://belurismo.vercel.app`. Callback autorizado:

```text
https://belurismo.vercel.app/api/turi/google/callback
```

Para desarrollo, agregar también `http://localhost:3000/api/turi/google/callback` y usar `APP_URL=http://localhost:3000` localmente. El flujo incluye state con sesión/vencimiento y PKCE. Los permisos se solicitan por conexión, no todos juntos. Los tokens se guardan cifrados y se renuevan en el servidor.

### Gmail

- Lectura: `https://www.googleapis.com/auth/gmail.readonly`.
- La interfaz busca metadatos de hasta 12 resultados y comparte con el agente sólo el texto de los correos que el usuario selecciona para importar. No procesa adjuntos de email automáticamente: pueden subirse desde el dispositivo o elegirse desde Drive.
- Envío de invitaciones: conexión separada con `https://www.googleapis.com/auth/gmail.send`.
- El usuario revisa destinatarios, asunto y contenido y confirma que son mayores de 18. Se manda un mensaje por destinatario, sin exponer los demás emails. No hay recompensa de referido inventada.
- Si se desconecta desde Turi, se borra su token de esta sesión. Para revocación global del proveedor, usar la configuración de la cuenta de Google.

### Google Calendar

Permiso `https://www.googleapis.com/auth/calendar.app.created`: permite crear calendarios secundarios y trabajar en los creados por esta aplicación.

La primera revisión aprobada crea **Turi Belo**. Los eventos se insertan o actualizan allí, con IDs derivados del ID local para que reintentar no genere duplicados. `sendUpdates=none`; el cuerpo nunca incluye asistentes. Los horarios usan la zona elegida en el viaje. Los recordatorios popup de Calendar usan los minutos revisados.

Quitar una actividad del viaje no cancela silenciosamente un evento: por ahora la cancelación también debe revisarse en Google Calendar. Esa limitación se muestra en la interfaz.

### Google Drive

Sólo `https://www.googleapis.com/auth/drive.file`. No se solicita `drive` ni `drive.readonly`. No se enumera todo el Drive del usuario.

Agregar `GOOGLE_PICKER_API_KEY` (restringida por dominio y a Google Picker) y `GOOGLE_CLOUD_PROJECT_NUMBER` (número del proyecto). Autorizar el origen `https://belurismo.vercel.app` en el cliente OAuth y la clave de navegador.

El selector recibe exclusivamente el token de la conexión Drive. Si ese token contiene permisos adicionales, la aplicación lo rechaza. El usuario elige el archivo; se admite PDF o imagen de hasta 2,5 MB. Guardar itinerario crea una copia Markdown sólo al pulsar el botón de confirmación.

### Telegram

Crear un bot con BotFather. Variables: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `TELEGRAM_WEBHOOK_SECRET`, Redis y `APP_URL`. Registrar el webhook una vez después del despliegue:

```powershell
node --env-file=.env.local scripts/setup-telegram.mjs
```

El script configura el webhook; no envía mensajes a personas. El servidor verifica `X-Telegram-Bot-Api-Secret-Token` y deduplica actualizaciones en Redis. Sólo procesa chats privados. El usuario genera desde Conexiones un código de vinculación de un solo uso que vence a los 10 minutos. Cada chat sólo puede vincular una sesión y cada sesión un chat.

P0: mensajes de texto, PDF e imágenes con la misma lógica del agente. Datos de viaje/cuenta sólo en el chat privado vinculado. Las propuestas de cambios se guardan pendientes en la sesión vinculada y se revisan en la web; Telegram no aprueba pagos. Las notas de voz de Telegram son P2 y el bot dirige al usuario a la llamada WebRTC de la web.

## Alertas en segundo plano

El endpoint `GET /api/turi/cron` está preparado, pero **no se registra un planificador automáticamente**. Antes de activar alertas, agregar `CRON_SECRET` y configurar un scheduler que lo invoque con `Authorization: Bearer <CRON_SECRET>`. Elegir frecuencia y proveedor según el plan de infraestructura; no suponer soporte de cron por minuto en todos los planes de Vercel.

Después, el usuario vincula Telegram y aprueba las alertas. `/stop` las desactiva. Se envían recordatorios vencidos en las últimas 24 horas, avisos de exceso de presupuesto según los gastos aportados y umbrales cambiarios indicativos. Hay deduplicación por recordatorio, día y alerta. La hora de entrega depende del scheduler y Telegram; las tasas se actualizan diariamente. Los popup de Calendar funcionan por separado.

Alertas de saldo bancario bajo o de aprobación financiera vencida requieren primero el MCP de Belo y datos verificables del proveedor. El modelo puede preparar recordatorios explícitos; no se consulta una cuenta no vinculada.

## Belo: pendiente por decisión del proyecto

No hay URL ni contratos de herramientas inventados. Al recibir la documentación real:

1. Configurar `BELO_MCP_URL` HTTPS y `BELO_MCP_TRANSPORT=http` (Streamable HTTP) o `sse`.
2. Revisar cada herramienta. Agregar sus nombres exactos a `BELO_READ_TOOLS` o `BELO_PREPARE_TOOLS`. **Todos los nombres están deshabilitados por defecto**. El SDK descubre los esquemas reales del servidor.
3. El usuario conecta su propio token desde Conexiones. No se reutiliza una cuenta financiera global en una web pública. Si Belo requiere OAuth, agregar su flujo conforme a la documentación antes de habilitarlo para usuarios.
4. Las herramientas de preparación muestran una propuesta firmada, vinculada a sesión/argumentos, de un uso y con 10 minutos de vigencia de revisión **de Turi**. No es el vencimiento de una operación de Belo. Después el proveedor debe devolver su enlace oficial y su propio vencimiento. Validar el resultado y dominios oficiales antes de abrir ese flujo en producción.
5. No habilitar herramientas de ejecución directa, tarjetas o sub-wallets. Verificar cotización, comisiones, aprobación y evidencia del estado final con casos reales antes de declarar integración completa.

Travel es la fuente deseada para disponibilidad. La búsqueda web y Gmail/Drive aportan contexto y comprobantes, no inventario de hoteles. Belo Air, QR, Pix/retiros y referidos requieren documentación, herramientas y pruebas propias. Tener Telegram o Google conectado no los habilita.

## Verificación

```powershell
npm ci
npm test
npm run lint
npm run build
npm run dev
```

Las pruebas cubren presupuesto/reserva, centavos y gastos personalizados, duplicados, zona horaria/DST, validación de archivos, cifrado, origen y allowlist de Belo. Sin credenciales no se puede certificar una sesión Realtime real ni operaciones de Google, Telegram o Belo; verificar esas integraciones después de activarlas.

Fuentes técnicas: [OpenAI WebRTC](https://developers.openai.com/api/docs/guides/voice-webrtc), [Realtime conversations](https://developers.openai.com/api/docs/guides/realtime-conversations), [Responses streaming](https://developers.openai.com/api/docs/guides/streaming-responses), [Google OAuth](https://developers.google.com/identity/protocols/oauth2/web-server), [Calendar scopes](https://developers.google.com/workspace/calendar/api/auth), [Drive scopes](https://developers.google.com/workspace/drive/api/guides/api-specific-auth), [Google Picker](https://developers.google.com/workspace/drive/picker/guides/overview), [Telegram Bot API](https://core.telegram.org/bots/api), [Upstash REST](https://upstash.com/docs/redis/features/restapi), [ExchangeRate-API](https://www.exchangerate-api.com/docs/free).
