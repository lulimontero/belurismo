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
- Cierre del viaje con resumen, diario, cuentas del grupo, remanente informado, comparación documentada de precios, opiniones y resumen compartible. Biblioteca de plantillas y archivo privado del viaje anterior al iniciar otro, siempre después de revisar los nuevos datos.
- Propuestas del agente para revisión antes de registrar datos. El asistente no inventa reservas, comisiones ni operaciones confirmadas.

## Respuestas visuales e interacción dentro del chat

El agente comparte la identidad de la página: blanco y lavanda en las superficies, violeta `#5300da` en acciones y cifras, y menta para estados positivos. Los tokens están definidos en `components/turi/turi.css` y se usan también en formularios, tarjetas, detalles, voz y conexiones. La tipografía continúa siendo la de la página. En móvil se apilan los formularios estrechos y los campos mantienen un tamaño legible; se respetan las preferencias de movimiento y transparencia reducidos.

Los patrones de `turi-pretrip.html` y `turi-posttrip.html` se portaron a componentes React dentro de la respuesta de Turi: selección de fechas, viajeros, edades y presupuesto; respuestas rápidas; barras de presupuesto y gasto diario; listas de preparación; selección de plantilla y puntajes. Se conservan sus interacciones útiles, pero los destinos, gastos, tasas, promociones, saldos y acciones simuladas de esos archivos no se cargan como datos reales.

### Opciones compactas y detalle

`TravelOptions` muestra opciones compactas con miniatura de 78 px, nombre, zona, referencia de precio y un pro y un punto a considerar. Los textos largos se presentan como extractos con puntos suspensivos; el texto completo permanece disponible en la descripción accesible y en el detalle. Se usan dos columnas sólo cuando caben dos tarjetas de al menos 250 px; en móvil se apilan sin foto de portada que ocupe toda la conversación.

Pulsar la tarjeta, o activarla con teclado, abre un `dialog` nativo con foto grande, resumen, moneda y base del precio, estimación por noches cuando corresponde, datos, pros/contras completos, limitaciones, fuente y fecha de consulta. El detalle tiene desplazamiento interno y se cierra con Escape, el botón de cierre o el fondo; el foco vuelve a la tarjeta. “Me interesa” cierra el detalle y envía un mensaje contextual para seguir evaluando: no reserva ni confirma una compra.

Las fotos corresponden a la fuente consultada. Ante ausencia o error, se muestra “Sin foto” o “Foto no disponible” y un acceso a la fuente; no se intercala una imagen genérica. Un enlace citado por la búsqueda no se convierte automáticamente en una recomendación ni en una tarjeta.

### Paneles del viaje

Los mensajes admiten descriptores `widgets` validados en `lib/turi/conversation-widgets.ts`. `ConversationWidgets` renderiza los formularios de previa, las respuestas rápidas y los paneles de `ConversationPanels`, `PostTripPanels` y `PostTripFinance`; la herramienta `show_trip_panel` permite al agente mostrar un panel. Los cálculos salen de `buildConversationPanels(state)`, en `lib/turi/conversation-panels.ts`, y de los helpers de cierre del viaje. Reflejan el estado actual incluso cuando se vuelve a una respuesta anterior. Las comparaciones documentadas se conservan como widgets `price-review-result`, con la referencia y fecha de su consulta.

| Panel | Datos y acciones reales |
| --- | --- |
| `post-trip-overview` | Accesos dentro de la conversación para revisar gastos, grupo, remanente, precios, resumen para compartir, plantillas, opiniones y próximo viaje. Cada acceso abre su flujo con datos del viaje actual. |
| `summary` | Total registrado, tu parte, lo pagado por vos, presupuesto, reserva para la vuelta, promedio, tope diario y categorías. El margen organizativo no se presenta como saldo bancario. |
| `daily` | Barras por fecha, línea del tope y excesos calculados. Un día sin registros no equivale a gasto cero confirmado. La recomendación usa el promedio registrado + 5%, redondeado; es una referencia histórica, no un precio futuro. |
| `group` | Gastos repartidos y transferencias calculadas por centavos. Permite preparar borradores de recordatorios y pedir revisión de evidencia de pago. No marca automáticamente una deuda como saldada. |
| `recap` | Vista previa de gastos comunes y sus agregados, con un lugar favorito opcional elegido entre los puntajes del usuario. Permite copiar, abrir la función de compartir del navegador o cancelar. No incluye gastos personales, presupuesto privado, saldos ni contactos; el usuario elige el destino al compartir. |
| `checklist` | Ocho verificaciones de previa: documentación, asistencia, conectividad, pagos, reservas, check-in, equipaje/cuidado personal y copias. Sólo el usuario marca lo que verificó. |
| `template` | Guarda en una biblioteca de la sesión las secciones elegidas: itinerario, hasta 12 favoritos consultados, topes por categoría e integrantes adultos con consentimiento. Los integrantes se conservan sólo por nombre. Permite exportar JSON, quitar con confirmación y revisar una plantilla para archivar el viaje actual e iniciar otro. |
| `feedback` | Puntajes de 1 a 5 para lugares o actividades del propio viaje, incluidos nombres agregados manualmente. El aporte de precios es un flujo separado: selección de registros, concepto/zona/mes revisados, vista previa y consentimiento revocable antes de guardar y exportar sólo lo seleccionado. No publica datos. |
| `leftover` | Guarda el monto y la moneda de origen que el usuario declara, o su decisión de conservarlos. Consulta una referencia real para convertir a ARS/USD y muestra fuente, fecha e importe bruto indicativo; las comisiones y el neto de Belo siguen por confirmar. Permite guardar un umbral cambiario con consentimiento. |
| `price-review` y `price-review-result` | Selecciona un gasto registrado y muestra, si hay evidencia comparable, lo pagado, rango publicado, moneda, unidad/cantidad, diferencia, condiciones, fuente y fecha. Exige la misma moneda del comprobante y evidencia de los importes; si faltan datos, se piden. Una diferencia no demuestra un cobro indebido ni altera el gasto. |
| `next-trip` | Promedio histórico y margen del 5% para la cantidad de días elegida; los destinos abren una búsqueda de precios actuales. Permite guardar destino, moneda y precio máximo de interés para vuelos, con estado de monitoreo pendiente y opción de quitarlo. No hay proveedor de vuelos conectado ni avisos de vuelos programados. |
| `post-trip-notice` | Evalúa fechas, consentimiento, cuentas calculadas y remanente informado. Conserva la pausa de dos días, el descarte por viaje y el último envío; el cron respeta esas decisiones. Los envíos externos requieren Telegram vinculado y habilitado, Redis y un planificador configurado. |

### Qué se conserva y qué sigue pendiente

Los descriptores de widgets y opciones se conservan en el historial validado. En `state.assistantPreferences` se guardan las verificaciones de previa, las selecciones de plantilla/favoritos, los puntajes y `anonymousPriceConsent`. `alertsConsent` guarda por separado la preferencia de avisos. `state.postTrip` conserva el remanente declarado, la pausa y el descarte del aviso, la biblioteca de plantillas, los viajes archivados, los aportes preparados y los intereses de vuelos. Todo sigue el almacenamiento local y, con Redis configurado, la sincronización de la misma sesión del navegador. No se marcan verificaciones ni consentimientos a partir de una búsqueda o una respuesta del modelo.

La biblioteca se recupera al volver a la misma sesión; exportar una plantilla no la elimina. Para reutilizarla se revisan destino, fechas, viajeros, presupuesto, su moneda, moneda del destino y zona horaria IANA y se confirma “Archivar e iniciar nuevo viaje”. El archivo conserva los gastos y cuentas anteriores como copia privada; el nuevo viaje recibe identificadores nuevos y empieza sin gastos, recordatorios ni alertas heredados. Se limpian las propuestas y la conversación activa, y se detiene la llamada de voz para no seguir usando el contexto anterior. No se copian reservas, contactos, consentimientos del grupo ni vínculos de Google Calendar. Las conexiones de la sesión se administran por separado.

Si cambia el destino, el itinerario y los favoritos anteriores quedan como referencia histórica en la plantilla. Si cambia la moneda, no se trasladan topes por categoría mediante una conversión implícita. Para la misma moneda se valida que los topes quepan en el nuevo presupuesto disponible; las actividades reutilizadas deben caber en las nuevas fechas. Los archivos privados se pueden exportar y quitar con confirmación. No hay importación automática de JSON ni biblioteca de cuentas permanentes entre dispositivos.

El aporte revisado exporta únicamente concepto, zona, importe, moneda original y mes de los registros elegidos. No lleva IDs de gastos, integrantes, contactos ni credenciales. Los campos libres se revisan para evitar datos personales; no se convierte a BRL ni a otra moneda sin una equivalencia comprobada. Revocar el consentimiento impide una nueva exportación. No hay publicación ni envío automático a un servicio externo.

Los límites son 10 plantillas, 10 viajes archivados, 50 aportes de precios guardados y 10 intereses de vuelos, con hasta 20 registros por selección de aporte y 250.000 bytes para el conjunto `postTrip`. Cada plantilla admite hasta 80 actividades y 12 favoritos. Al alcanzar un límite se informa el error y se pide exportar/quitar elementos; no se sobrescribe una plantilla ni se borra el archivo más antiguo silenciosamente. Las alertas cambiarias tienen un límite separado de 20.

Siguen pendientes la publicación externa de aportes, la disponibilidad comercial de Belo Travel, el proveedor de monitoreo de vuelos, la operación financiera con el MCP de Belo y la validación de Belo Air. Las referencias cambiarias son de mercado, no cotizaciones ejecutables de Belo: no se compran divisas, transfieren remanentes, cobran deudas ni confirman pagos. Los avisos externos necesitan Telegram vinculado, Redis y un planificador configurado. Las conexiones Google requieren sus credenciales y permisos descritos más abajo. Guardar una preferencia o un interés no activa esos servicios.

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

El contexto automático de texto y voz excluye la biblioteca de plantillas, los viajes archivados, los aportes guardados y los intereses de vuelos (`workspaceForAssistant`). Su consulta se realiza explícitamente en la interfaz; no se adjuntan completos en cada turno del agente. Reutilizar una plantilla incorpora únicamente las secciones revisadas al viaje nuevo. Las exportaciones de archivo privado sí contienen los datos financieros organizativos del viaje archivado y son distintas del resumen compartible y del aporte anónimo.

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

Después, el usuario vincula Telegram y aprueba las alertas tanto en el viaje como en el canal. `/stop` las desactiva. Se envían recordatorios vencidos en las últimas 24 horas, avisos de exceso de presupuesto según los gastos aportados hasta la fecha de fin del viaje y umbrales cambiarios indicativos. Hay deduplicación por recordatorio, día y alerta. La hora de entrega depende del scheduler y Telegram; las tasas se actualizan diariamente. Los popup de Calendar funcionan por separado.

El aviso posviaje se evalúa desde el día siguiente al regreso, en la zona horaria del viaje, durante 14 días. Requiere cuentas calculadas por revisar o un remanente positivo informado por el usuario, además del consentimiento. “Volver a mostrar en 2 días” guarda una pausa de 48 horas; una pausa explícita puede extender la ventana hasta su fecha. “Descartar este aviso” lo suprime para ese viaje. El cron respeta la pausa, el descarte y la deduplicación por viaje/episodio y guarda el último envío confirmado por Telegram. El mensaje abre el chat web para revisar el cierre; no cobra deudas ni supone un saldo bancario. Sin infraestructura externa, se conserva la preferencia y el panel permite revisar manualmente el cierre.

Los intereses de vuelos guardados no entran en este cron. Hace falta conectar y validar una fuente de precios antes de implementar un monitor o programar esos avisos.

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

Las pruebas cubren presupuesto/reserva, centavos y gastos personalizados, duplicados, zona horaria/DST, validación de archivos, cifrado, origen y allowlist de Belo. El cierre agrega casos de compatibilidad con estados anteriores, aviso/pausa/descarte, límites y archivos, reutilización revisada sin mezclar gastos ni convertir monedas, exportación selectiva de aportes, referencias documentadas de precios y exclusión de la biblioteca del contexto automático. También se prueban monedas de origen del remanente, umbrales inferiores a un centavo e intereses de vuelos sin proveedor. Estas pruebas no certifican una sesión Realtime real ni operaciones de Google, Telegram o Belo; verificar esas integraciones después de activarlas.

Fuentes técnicas: [OpenAI WebRTC](https://developers.openai.com/api/docs/guides/voice-webrtc), [Realtime conversations](https://developers.openai.com/api/docs/guides/realtime-conversations), [Responses streaming](https://developers.openai.com/api/docs/guides/streaming-responses), [Google OAuth](https://developers.google.com/identity/protocols/oauth2/web-server), [Calendar scopes](https://developers.google.com/workspace/calendar/api/auth), [Drive scopes](https://developers.google.com/workspace/drive/api/guides/api-specific-auth), [Google Picker](https://developers.google.com/workspace/drive/picker/guides/overview), [Telegram Bot API](https://core.telegram.org/bots/api), [Upstash REST](https://upstash.com/docs/redis/features/restapi), [ExchangeRate-API](https://www.exchangerate-api.com/docs/free).
