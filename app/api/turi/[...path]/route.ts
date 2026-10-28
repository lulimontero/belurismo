import { cookies } from "next/headers";
import { z } from "zod";
import {
  AppError,
  assertSameOrigin,
  publicError,
  readJson,
  required,
  safeEqual,
  sessionId,
} from "@/lib/turi/security";
import {
  cloudConfigured,
  loadAccount,
  patchAccount,
  mutateAccount,
  rateLimit,
  redis,
  type GoogleService,
} from "@/lib/turi/storage";
import { messageSchema, workspaceSchema, type Status } from "@/lib/turi/domain";
import {
  attachmentSchema,
  connectionsFor,
  executeTool,
  realtimeTools,
  runAgent,
  validateAttachments,
} from "@/lib/turi/agent";
import {
  googleConfigured,
  googleScopes,
  startGoogle,
  finishGoogle,
  searchMail,
  importMail,
  sendInvitations,
  syncCalendar,
  pickerConfig,
  importDriveFile,
  saveToDrive,
} from "@/lib/turi/google";
import { beloTools, beloCallSchema, callBelo } from "@/lib/turi/belo";
import {
  telegramConfigured,
  telegramLink,
  receiveTelegram,
  sendDueReminders,
} from "@/lib/turi/telegram";
import { turiInstructions } from "@/lib/turi/prompt";
import { exchangeQuote } from "@/lib/turi/exchange";

export const maxDuration = 120;
const locationSchema = z
  .object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  })
  .optional();
const chatSchema = z.object({
  state: workspaceSchema,
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        text: z.string().max(20000),
      }),
    )
    .min(1)
    .max(30),
  attachments: z.array(attachmentSchema).max(3).default([]),
  location: locationSchema,
});
const json = (value: unknown, status = 200) =>
  Response.json(value, { status, headers: { "Cache-Control": "no-store" } });
const pathOf = (request: Request) =>
  new URL(request.url).pathname.replace(/^\/api\/turi\//, "");

async function statusFor(id: string): Promise<Status> {
  const account = await loadAccount(id);
  const googleMissing = [
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "UPSTASH_REDIS_REST_URL",
    "UPSTASH_REDIS_REST_TOKEN",
  ].filter((name) => !process.env[name]);
  return {
    ai: Boolean(process.env.OPENAI_API_KEY),
    realtime: Boolean(process.env.OPENAI_API_KEY),
    cloud: cloudConfigured(),
    connections: [
      {
        id: "telegram",
        name: "Telegram",
        description:
          "Tu viaje en un chat privado. Texto, comprobantes y alertas que vos activás.",
        configured: telegramConfigured(),
        connected: Boolean(account.telegram),
        missing: [
          "TELEGRAM_BOT_TOKEN",
          "TELEGRAM_BOT_USERNAME",
          "TELEGRAM_WEBHOOK_SECRET",
          "UPSTASH_REDIS_REST_URL",
          "UPSTASH_REDIS_REST_TOKEN",
        ].filter((name) => !process.env[name]),
      },
      {
        id: "gmail",
        name: "Gmail",
        description:
          "Elegí qué reservas y cambios de vuelo importar. No se leen correos de acompañantes.",
        configured: googleConfigured(),
        connected: Boolean(account.google?.gmail),
        missing: googleMissing,
      },
      {
        id: "calendar",
        name: "Google Calendar",
        description:
          "Un calendario Turi Belo para el itinerario que revisaste. Sin invitados automáticos.",
        configured: googleConfigured(),
        connected: Boolean(account.google?.calendar),
        missing: googleMissing,
      },
      {
        id: "drive",
        name: "Google Drive",
        description:
          "Importá un archivo elegido por vos o guardá tu itinerario. Acceso por archivo.",
        configured:
          googleConfigured() &&
          Boolean(
            process.env.GOOGLE_PICKER_API_KEY &&
            process.env.GOOGLE_CLOUD_PROJECT_NUMBER,
          ),
        connected: Boolean(account.google?.drive),
        missing: [
          ...googleMissing,
          ...["GOOGLE_PICKER_API_KEY", "GOOGLE_CLOUD_PROJECT_NUMBER"].filter(
            (name) => !process.env[name],
          ),
        ],
      },
      {
        id: "gmail-send",
        name: "Enviar invitaciones",
        description:
          "Permiso separado. Siempre revisás destinatarios mayores de 18, asunto y texto.",
        configured: googleConfigured(),
        connected: Boolean(account.google?.["gmail-send"]),
        missing: googleMissing,
      },
      {
        id: "belo",
        name: "Belo",
        description:
          "Tu conexión financiera personal. Travel, Air, Pix, QR y referidos sujetos a la API habilitada.",
        configured: Boolean(process.env.BELO_MCP_URL && cloudConfigured()),
        connected: Boolean(process.env.BELO_MCP_URL && account.beloToken),
        missing: [
          "BELO_MCP_URL",
          "BELO_READ_TOOLS",
          "BELO_PREPARE_TOOLS",
          "UPSTASH_REDIS_REST_URL",
          "UPSTASH_REDIS_REST_TOKEN",
        ].filter((name) => !process.env[name]),
      },
    ],
  };
}
export async function GET(request: Request) {
  try {
    const path = pathOf(request),
      url = new URL(request.url);
    if (path === "cron") {
      if (
        !process.env.CRON_SECRET ||
        !safeEqual(
          request.headers.get("authorization") || "",
          `Bearer ${process.env.CRON_SECRET}`,
        )
      )
        throw new AppError("No autorizado.", 401);
      return json(await sendDueReminders());
    }
    const id = await sessionId();
    if (path === "status") return json(await statusFor(id));
    if (path === "state") {
      const account = await loadAccount(id);
      return json({
        state: account.workspace || null,
        messages: account.messages || [],
        updatedAt: account.updatedAt || 0,
        proposals: account.proposals || [],
        beloProposals: account.beloProposals || [],
      });
    }
    if (path === "google/callback") return await finishGoogle(request, id);
    if (path === "google/connect") {
      if (request.headers.get("sec-fetch-site") === "cross-site")
        throw new AppError("Iniciá la conexión desde Turi.", 403);
      const service = url.searchParams.get("service") || "";
      if (!Object.hasOwn(googleScopes, service))
        throw new AppError("Conexión desconocida.");
      return await startGoogle(request, id, service as GoogleService);
    }
    throw new AppError("Ruta no encontrada.", 404);
  } catch (error) {
    const result = publicError(error);
    return json({ error: result.error }, result.status);
  }
}

export async function POST(request: Request) {
  try {
    const path = pathOf(request);
    if (path === "telegram/webhook") return await receiveTelegram(request);
    assertSameOrigin(request);
    const id = await sessionId(),
      ip =
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        "local";
    await rateLimit(ip, "ip", 80);
    if (path === "chat") {
      required("OPENAI_API_KEY");
      await rateLimit(id, "chat", 20);
      const data = chatSchema.parse(await readJson(request));
      validateAttachments(data.attachments);
      if (data.messages.at(-1)?.role !== "user")
        throw new AppError("Falta el mensaje del viajero.");
      if (data.location)
        data.messages[data.messages.length - 1].text +=
          `\n[Ubicación compartida voluntariamente para esta consulta: latitud ${data.location.latitude}, longitud ${data.location.longitude}.]`;
      const encoder = new TextEncoder();
      let closed = false;
      const stream = new ReadableStream({
        async start(controller) {
          const emit = (event: { type: string; [key: string]: unknown }) => {
            if (!closed) {
              try {
                controller.enqueue(
                  encoder.encode(`${JSON.stringify(event)}\n`),
                );
              } catch {
                closed = true;
              }
            }
          };
          try {
            await runAgent({ id, ...data, signal: request.signal }, emit);
            emit({ type: "done" });
          } catch (error) {
            emit({ type: "error", error: publicError(error).error });
          } finally {
            if (!closed) {
              closed = true;
              controller.close();
            }
          }
        },
        cancel() {
          closed = true;
        },
      });
      return new Response(stream, {
        headers: {
          "Content-Type": "application/x-ndjson; charset=utf-8",
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
    if (path === "realtime") {
      required("OPENAI_API_KEY");
      await rateLimit(id, "voice", 5, 600);
      await rateLimit(ip, "voice-ip", 5, 600);
      const data = z
        .object({ sdp: z.string().min(20).max(100000), state: workspaceSchema })
        .parse(await readJson(request, 350000));
      const form = new FormData();
      form.set("sdp", data.sdp);
      form.set(
        "session",
        JSON.stringify({
          type: "realtime",
          model: process.env.OPENAI_REALTIME_MODEL || "gpt-realtime-2.1",
          instructions: turiInstructions(data.state, await connectionsFor(id)),
          output_modalities: ["audio"],
          audio: {
            input: {
              transcription: {
                model: "gpt-4o-mini-transcribe",
                language: "es",
              },
              noise_reduction: { type: "near_field" },
              turn_detection: {
                type: "semantic_vad",
                eagerness: "high",
                create_response: true,
                interrupt_response: true,
              },
            },
            output: { voice: "marin" },
          },
          tools: realtimeTools,
          tool_choice: "auto",
        }),
      );
      const response = await fetch("https://api.openai.com/v1/realtime/calls", {
        method: "POST",
        headers: { Authorization: `Bearer ${required("OPENAI_API_KEY")}` },
        body: form,
        signal: AbortSignal.timeout(25000),
      });
      if (!response.ok)
        throw new AppError(
          response.status === 401
            ? "OpenAI rechazó la API key. Revisá la configuración."
            : response.status === 429
              ? "OpenAI alcanzó el límite de uso o saldo."
              : "No pude iniciar la sesión de voz con OpenAI.",
          response.status === 401 || response.status === 429
            ? response.status
            : 502,
        );
      return new Response(await response.text(), {
        headers: {
          "Content-Type": "application/sdp",
          "Cache-Control": "no-store",
        },
      });
    }
    if (path === "realtime/context") {
      const data = z
        .object({ state: workspaceSchema })
        .parse(await readJson(request, 350000));
      return json({
        instructions: turiInstructions(data.state, await connectionsFor(id)),
      });
    }
    if (path === "tool") {
      await rateLimit(id, "tool", 30);
      const data = z
        .object({
          name: z.string().max(100),
          args: z.record(z.string(), z.unknown()),
          state: workspaceSchema,
        })
        .parse(await readJson(request, 350000));
      const events: unknown[] = [],
        result = await executeTool(
          id,
          data.name,
          data.args,
          data.state,
          (event) => events.push(event),
        );
      return json({ result, events });
    }
    const body = await readJson(request, 700000);
    if (path === "exchange") {
      await rateLimit(id, "exchange", 15);
      return json(await exchangeQuote(body));
    }
    if (path === "state") {
      if (!cloudConfigured()) return json({ saved: false, localOnly: true });
      const data = z
        .object({
          state: workspaceSchema,
          messages: z.array(messageSchema).max(30),
          baseRevision: z.number().optional(),
          proposals: z
            .array(
              z.object({
                type: z.enum(["expense", "itinerary", "trip", "reminder"]),
                label: z.string().max(180),
                data: z.record(z.string(), z.unknown()),
              }),
            )
            .max(20)
            .default([]),
          beloProposals: z
            .array(
              z.object({
                label: z.string().max(300),
                name: z.string().max(160),
                args: z.record(z.string(), z.unknown()),
                token: z.string().max(20000),
              }),
            )
            .max(10)
            .default([]),
        })
        .parse(body);
      const saved = await mutateAccount(id, (account) => {
        if (
          data.baseRevision !== undefined &&
          data.baseRevision !== (account.updatedAt || 0)
        )
          throw new AppError(
            "El viaje cambió en otro canal. Cerrá y abrí Turi para sincronizar antes de seguir editando.",
            409,
          );
        return {
          ...account,
          workspace: data.state,
          messages: data.messages,
          proposals: data.proposals,
          beloProposals: data.beloProposals,
          updatedAt: Date.now(),
        };
      });
      return json({ saved: true, updatedAt: saved.updatedAt });
    }
    if (path === "telegram/link") return json(await telegramLink(id));
    if (path === "telegram/alerts") {
      const data = z
          .object({ enabled: z.boolean(), consent: z.boolean() })
          .parse(body),
        account = await loadAccount(id);
      if (!account.telegram) throw new AppError("Vinculá Telegram primero.");
      if (data.enabled && (!data.consent || !process.env.CRON_SECRET))
        throw new AppError(
          "Falta consentimiento o configurar el planificador de alertas.",
          503,
        );
      await patchAccount(id, {
        telegram: { ...account.telegram, alerts: data.enabled },
      });
      await redis(data.enabled ? "SADD" : "SREM", "turi:alerts-users", id);
      return json({ enabled: data.enabled });
    }
    if (path === "gmail/search") {
      const data = z.object({ query: z.string().min(1).max(300) }).parse(body);
      await rateLimit(id, "gmail-search", 15);
      return json({ messages: await searchMail(id, data.query) });
    }
    if (path === "gmail/import") {
      const data = z
        .object({ ids: z.array(z.string()).min(1).max(8) })
        .parse(body);
      return json({ messages: await importMail(id, data.ids) });
    }
    if (path === "gmail/send") {
      await rateLimit(id, "gmail-send", 3, 3600);
      return json(await sendInvitations(id, body));
    }
    if (path === "calendar/sync") return json(await syncCalendar(id, body));
    if (path === "drive/picker") return json(await pickerConfig(id));
    if (path === "drive/import") {
      const data = z.object({ id: z.string().max(200) }).parse(body);
      return json({ attachment: await importDriveFile(id, data.id) });
    }
    if (path === "drive/save") {
      const data = z
        .object({ approved: z.literal(true), state: workspaceSchema })
        .parse(body);
      return json(await saveToDrive(id, data.state));
    }
    if (path === "belo/connect") {
      const data = z
        .object({ token: z.string().min(10).max(6000) })
        .parse(body);
      if (!process.env.BELO_MCP_URL || !cloudConfigured())
        throw new AppError(
          "El MCP de Belo sigue pendiente de configuración.",
          503,
        );
      const account = await loadAccount(id);
      await patchAccount(id, { beloToken: data.token });
      try {
        return json({ tools: await beloTools(id) });
      } catch (error) {
        await patchAccount(id, { beloToken: account.beloToken });
        throw error;
      }
    }
    if (path === "belo/approve") {
      const data = beloCallSchema.parse(body);
      if (!data.token) throw new AppError("Falta revisar la propuesta.", 403);
      return json(await callBelo(id, data.name, data.args, data.token));
    }
    throw new AppError("Ruta no encontrada.", 404);
  } catch (error) {
    const result = publicError(error);
    return json({ error: result.error }, result.status);
  }
}

export async function DELETE(request: Request) {
  try {
    assertSameOrigin(request);
    const id = await sessionId(),
      path = pathOf(request),
      account = await loadAccount(id);
    if (path === "connections/telegram") {
      if (account.telegram)
        await redis("DEL", `turi:tg-chat:${account.telegram.chatId}`);
      await patchAccount(id, { telegram: undefined });
      await redis("SREM", "turi:alerts-users", id);
    } else if (path === "connections/belo")
      await patchAccount(id, { beloToken: undefined });
    else if (
      path.startsWith("connections/") &&
      Object.hasOwn(googleScopes, path.split("/")[1])
    ) {
      const service = path.split("/")[1] as GoogleService,
        google = { ...account.google };
      delete google[service];
      await patchAccount(id, { google });
    } else if (path === "state") {
      if (account.telegram)
        await redis("DEL", `turi:tg-chat:${account.telegram.chatId}`);
      if (cloudConfigured()) {
        await redis("DEL", `turi:account:${id}`);
        await redis("SREM", "turi:alerts-users", id);
      }
      (await cookies()).delete("turi_session");
    } else throw new AppError("Ruta no encontrada.", 404);
    return json({ ok: true });
  } catch (error) {
    const result = publicError(error);
    return json({ error: result.error }, result.status);
  }
}
