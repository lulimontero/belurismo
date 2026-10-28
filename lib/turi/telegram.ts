import { after } from "next/server";
import { AppError, required, safeEqual, seal, unseal } from "./security";
import {
  redis,
  loadAccount,
  patchAccount,
  mutateAccount,
  cloudConfigured,
  rateLimit,
} from "./storage";
import { appUrl } from "./google";
import {
  emptyWorkspace,
  budgetSummary,
  money,
  today,
  type Attachment,
  type Message,
  type LocalAction,
} from "./domain";
import { runAgent, validateAttachments } from "./agent";
import { exchangeQuote } from "./exchange";

type TelegramMessage = {
  message_id: number;
  chat: { id: number; type: string };
  text?: string;
  caption?: string;
  voice?: unknown;
  photo?: { file_id: string; file_size?: number }[];
  document?: {
    file_id: string;
    file_size?: number;
    file_name?: string;
    mime_type?: string;
  };
};
export const telegramConfigured = () =>
  Boolean(
    process.env.TELEGRAM_BOT_TOKEN &&
    process.env.TELEGRAM_BOT_USERNAME &&
    process.env.TELEGRAM_WEBHOOK_SECRET &&
    cloudConfigured(),
  );
async function telegram(method: string, body: object) {
  const response = await fetch(
    `https://api.telegram.org/bot${required("TELEGRAM_BOT_TOKEN")}/${method}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    },
  );
  const data = await response.json();
  if (!response.ok || !data.ok)
    throw new AppError("Telegram no pudo completar la operación.", 502);
  return data.result;
}
export async function sendTelegram(chatId: number, text: string) {
  for (let index = 0; index < text.length; index += 3800)
    await telegram("sendMessage", {
      chat_id: chatId,
      text: text.slice(index, index + 3800),
      link_preview_options: { is_disabled: true },
    });
}
export async function telegramLink(id: string) {
  if (!telegramConfigured())
    throw new AppError(
      "Telegram está preparado. Faltan el bot, el secreto del webhook y el almacenamiento seguro.",
      503,
    );
  const code = crypto.randomUUID().replaceAll("-", "");
  await redis("SET", `turi:tg-link:${code}`, seal({ id }), "EX", 600);
  return {
    url: `https://t.me/${required("TELEGRAM_BOT_USERNAME").replace(/^@/, "")}?start=${code}`,
    expiresAt: new Date(Date.now() + 600000).toISOString(),
  };
}
async function telegramAttachment(
  message: TelegramMessage,
): Promise<Attachment | undefined> {
  const photo = message.photo?.at(-1),
    document = message.document;
  if (!photo && !document) return;
  const type = document?.mime_type || "image/jpeg";
  if (
    !["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(type)
  )
    throw new AppError("Mandame un PDF o una imagen PNG, JPEG o WebP.");
  const item = document || photo!;
  if ((item.file_size || 0) > 2_500_000)
    throw new AppError("El comprobante debe pesar hasta 2,5 MB.");
  const data = await telegram("getFile", { file_id: item.file_id });
  if (
    !data.file_path ||
    !/^[a-zA-Z0-9_./-]+$/.test(data.file_path) ||
    data.file_path.includes("..") ||
    data.file_size > 2_500_000
  )
    throw new AppError("No pude descargar ese comprobante.");
  const response = await fetch(
    `https://api.telegram.org/file/bot${required("TELEGRAM_BOT_TOKEN")}/${data.file_path}`,
    { signal: AbortSignal.timeout(15000) },
  );
  if (!response.ok)
    throw new AppError("Telegram no pudo descargar el comprobante.");
  const bytes = Buffer.from(await response.arrayBuffer());
  const attachment = {
    name: document?.file_name || "comprobante.jpg",
    type,
    size: bytes.length,
    data: `data:${type};base64,${bytes.toString("base64")}`,
  };
  validateAttachments([attachment]);
  return attachment;
}
async function processMessage(message: TelegramMessage) {
  const chatId = message.chat.id,
    text =
      message.text ||
      message.caption ||
      "Revisá este comprobante y prepará los datos para mi viaje.";
  if (message.chat.type !== "private") return; // No account data, replies, or attachments in groups.
  const linkCode = message.text?.match(/^\/start ([a-zA-Z0-9_-]{20,64})$/)?.[1];
  if (linkCode) {
    const linked = await redis<string | null>(
      "GETDEL",
      `turi:tg-link:${linkCode}`,
    );
    if (!linked) {
      await sendTelegram(
        chatId,
        "El enlace venció o ya se usó. Generá uno nuevo desde Conexiones en Turi.",
      );
      return;
    }
    const { id } = unseal<{ id: string }>(linked),
      previous = await redis<string | null>("GET", `turi:tg-chat:${chatId}`),
      current = await loadAccount(id);
    if (previous && unseal<{ id: string }>(previous).id !== id) {
      await sendTelegram(
        chatId,
        "Este chat ya está vinculado a otra sesión. Desvinculalo primero desde Turi.",
      );
      return;
    }
    if (current.telegram && current.telegram.chatId !== chatId) {
      await sendTelegram(
        chatId,
        "Esta sesión ya tiene otro chat vinculado. Desvinculalo primero desde Turi.",
      );
      return;
    }
    await patchAccount(id, { telegram: { chatId, alerts: false } });
    await redis(
      "SET",
      `turi:tg-chat:${chatId}`,
      seal({ id }),
      "EX",
      90 * 86400,
    );
    await sendTelegram(
      chatId,
      "Soy Turi. Ya vinculamos este chat privado con tu viaje. Podés escribirme y mandarme comprobantes. Las alertas están apagadas: las activás desde Conexiones en la web. Ningún movimiento de plata se aprueba por Telegram.",
    );
    return;
  }
  const linked = await redis<string | null>("GET", `turi:tg-chat:${chatId}`);
  if (!linked) {
    await sendTelegram(
      chatId,
      `Para usar Turi con tu viaje, vinculá este chat desde ${appUrl()}/?turi=connections. No compartas el enlace de vinculación.`,
    );
    return;
  }
  const { id } = unseal<{ id: string }>(linked),
    account = await loadAccount(id);
  if (account.telegram?.chatId !== chatId) return;
  if (message.text === "/stop") {
    await patchAccount(id, { telegram: { chatId, alerts: false } });
    await sendTelegram(
      chatId,
      "Alertas desactivadas. Podés seguir hablando conmigo o desvincular Telegram desde la web.",
    );
    return;
  }
  if (message.voice) {
    await sendTelegram(
      chatId,
      `La voz en vivo está en la web: ${appUrl()}/?turi=chat. Las notas de voz de Telegram quedan para la próxima etapa; por acá podés escribir o adjuntar un comprobante.`,
    );
    return;
  }
  await rateLimit(id, "telegram", 15);
  if (!process.env.OPENAI_API_KEY) {
    await sendTelegram(
      chatId,
      "El chat ya está vinculado. Falta activar la conexión de inteligencia artificial para poder responder.",
    );
    return;
  }
  const attachment = await telegramAttachment(message),
    history = [
      ...(account.messages || []).slice(-16),
      { id: crypto.randomUUID(), role: "user" as const, text },
    ];
  await telegram("sendChatAction", { chat_id: chatId, action: "typing" });
  let answer = "",
    needsReview = false;
  const proposals: LocalAction[] = [],
    beloProposals: NonNullable<typeof account.beloProposals> = [];
  await runAgent(
    {
      id,
      state: account.workspace || emptyWorkspace(),
      messages: history,
      attachments: attachment ? [attachment] : [],
      channel: "telegram privado vinculado",
    },
    (event) => {
      if (event.type === "delta") answer += String(event.text);
      if (event.type === "proposal") {
        needsReview = true;
        proposals.push(event.action as LocalAction);
      }
      if (event.type === "belo_review") {
        needsReview = true;
        beloProposals.push(
          event.proposal as NonNullable<typeof account.beloProposals>[number],
        );
      }
    },
  );
  if (needsReview)
    answer += `\n\nDejé la propuesta para que la revises en ${appUrl()}/?turi=chat desde el navegador que vinculaste. No se guardó ningún cambio ni se movió dinero.`;
  if (!answer) answer = "No pude generar una respuesta. Intentá nuevamente.";
  await sendTelegram(chatId, answer);
  const messages: Message[] = [
    ...history,
    { id: crypto.randomUUID(), role: "assistant" as const, text: answer },
  ].slice(-30);
  await mutateAccount(id, (latest) => ({
    ...latest,
    messages,
    proposals: [...(latest.proposals || []), ...proposals].slice(-20),
    beloProposals: [...(latest.beloProposals || []), ...beloProposals].slice(
      -10,
    ),
    updatedAt: Date.now(),
  }));
}
export async function receiveTelegram(request: Request) {
  if (
    !telegramConfigured() ||
    !safeEqual(
      request.headers.get("x-telegram-bot-api-secret-token") || "",
      process.env.TELEGRAM_WEBHOOK_SECRET || "",
    )
  )
    throw new AppError("Webhook no autorizado.", 403);
  const body = await request.text();
  if (body.length > 100000) throw new AppError("Evento demasiado grande.", 413);
  let update: { update_id: number; message?: TelegramMessage };
  try {
    update = JSON.parse(body);
  } catch {
    throw new AppError("Evento inválido.");
  }
  if (!Number.isSafeInteger(update.update_id))
    throw new AppError("Evento inválido.");
  if (!update.message || update.message.chat.type !== "private")
    return Response.json({ ok: true });
  const message = update.message;
  if (
    !(await redis(
      "SET",
      `turi:tg-update:${update.update_id}`,
      "processing",
      "NX",
      "EX",
      86400,
    ))
  )
    return Response.json({ ok: true });
  after(async () => {
    try {
      await processMessage(message);
    } catch (error) {
      await sendTelegram(
        message.chat.id,
        error instanceof AppError
          ? error.message
          : "No pude completar la consulta. Intentá nuevamente en un momento.",
      ).catch(() => {});
    }
  });
  return Response.json({ ok: true });
}

export async function sendDueReminders() {
  const ids = await redis<string[]>("SMEMBERS", "turi:alerts-users");
  let sent = 0;
  for (const id of ids.slice(0, 500)) {
    const account = await loadAccount(id);
    if (!account.telegram?.alerts || !account.workspace?.alertsConsent)
      continue;
    for (const reminder of account.workspace.reminders.filter(
      (r) =>
        !r.sent &&
        Date.parse(r.at) <= Date.now() &&
        Date.parse(r.at) >= Date.now() - 86400000,
    )) {
      const claim = await redis(
        "SET",
        `turi:reminder:${id}:${reminder.id}`,
        "claimed",
        "NX",
        "EX",
        7 * 86400,
      );
      if (!claim) continue;
      try {
        await sendTelegram(
          account.telegram.chatId,
          `Recordatorio de Turi: ${reminder.title}`,
        );
        reminder.sent = true;
        sent++;
      } catch {
        await redis("DEL", `turi:reminder:${id}:${reminder.id}`);
      }
    }
    const summary = budgetSummary(account.workspace),
      date = today(account.workspace.trip.timeZone);
    if (
      account.workspace.trip.budget > 0 &&
      (summary.available < 0 ||
        (summary.daily > 0 && summary.spentToday > summary.daily))
    ) {
      const alertKey = `turi:budget-alert:${id}:${date}`;
      if (await redis("SET", alertKey, "sent", "NX", "EX", 2 * 86400)) {
        try {
          await sendTelegram(
            account.telegram.chatId,
            `Tu presupuesto de viaje: hoy registraste ${money(summary.spentToday, account.workspace.trip.currency)}. Te quedan ${money(summary.available, account.workspace.trip.currency)} disponibles en tu plan. Revisá el ritmo antes del próximo gasto. Son gastos aportados por vos, no el saldo bancario.`,
          );
          sent++;
        } catch {
          await redis("DEL", alertKey);
        }
      }
    }
    for (const alert of account.workspace.rateAlerts.filter((a) => !a.sent)) {
      try {
        const quote = await exchangeQuote({
          from: alert.from,
          to: alert.to,
          amount: 1,
        });
        if (
          (alert.direction === "below" && quote.rate <= alert.threshold) ||
          (alert.direction === "above" && quote.rate >= alert.threshold)
        ) {
          const key = `turi:rate-alert:${id}:${alert.id}`;
          if (await redis("SET", key, "sent", "NX", "EX", 90 * 86400)) {
            try {
              await sendTelegram(
                account.telegram.chatId,
                `Tu alerta de cotización: 1 ${alert.from} ≈ ${quote.rate} ${alert.to}. Referencia diaria del ${quote.updatedAt}. Fuente: ${quote.sourceUrl}. No es una recomendación de compra ni la tasa de Belo/Pix/tarjeta. Revisá costos antes de operar.`,
              );
              alert.sent = true;
              sent++;
            } catch {
              await redis("DEL", key);
            }
          }
        }
      } catch {
        /* no notification with stale or invented rates */
      }
    }
    const sentReminderIds = new Set(
        account.workspace.reminders.filter((r) => r.sent).map((r) => r.id),
      ),
      sentAlertIds = new Set(
        account.workspace.rateAlerts.filter((r) => r.sent).map((r) => r.id),
      );
    await mutateAccount(id, (latest) =>
      latest.workspace
        ? {
            ...latest,
            updatedAt: Date.now(),
            workspace: {
              ...latest.workspace,
              reminders: latest.workspace.reminders.map((r) =>
                sentReminderIds.has(r.id) ? { ...r, sent: true } : r,
              ),
              rateAlerts: latest.workspace.rateAlerts.map((r) =>
                sentAlertIds.has(r.id) ? { ...r, sent: true } : r,
              ),
            },
          }
        : latest,
    );
  }
  return { sent };
}
