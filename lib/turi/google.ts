import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { z } from "zod";
import { AppError, cookieOptions, required, seal, unseal } from "./security";
import {
  loadAccount,
  patchAccount,
  cloudConfigured,
  type GoogleService,
} from "./storage";
import { itinerarySchema, type Attachment, type Workspace } from "./domain";

export const googleScopes: Record<GoogleService, string> = {
  gmail: "https://www.googleapis.com/auth/gmail.readonly",
  "gmail-send": "https://www.googleapis.com/auth/gmail.send",
  calendar: "https://www.googleapis.com/auth/calendar.app.created",
  drive: "https://www.googleapis.com/auth/drive.file",
};
export const googleConfigured = () =>
  Boolean(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    cloudConfigured(),
  );
export function appUrl(request?: Request) {
  return (
    process.env.APP_URL ||
    (process.env.NODE_ENV !== "production" && request
      ? new URL(request.url).origin
      : "https://belurismo.vercel.app")
  );
}

export async function startGoogle(
  request: Request,
  id: string,
  service: GoogleService,
) {
  if (!googleConfigured())
    throw new AppError(
      "La conexión con Google está preparada. Faltan las credenciales OAuth y el almacenamiento seguro.",
      503,
    );
  const nonce = randomBytes(24).toString("hex"),
    verifier = randomBytes(32).toString("base64url");
  (await cookies()).set(
    "turi_oauth",
    seal({ id, service, nonce, verifier, expires: Date.now() + 600000 }),
    { ...cookieOptions, maxAge: 600 },
  );
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  const params = {
    client_id: required("GOOGLE_CLIENT_ID"),
    redirect_uri: `${appUrl(request)}/api/turi/google/callback`,
    response_type: "code",
    scope: googleScopes[service],
    state: nonce,
    access_type: "offline",
    prompt: "consent",
    code_challenge: createHash("sha256").update(verifier).digest("base64url"),
    code_challenge_method: "S256",
  };
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return Response.redirect(url.toString());
}

export async function finishGoogle(request: Request, id: string) {
  const url = new URL(request.url),
    jar = await cookies(),
    cookie = jar.get("turi_oauth")?.value;
  jar.delete("turi_oauth");
  if (!cookie)
    throw new AppError(
      "La autorización venció. Volvé a iniciar la conexión.",
      401,
    );
  const flow = unseal<{
    id: string;
    service: GoogleService;
    nonce: string;
    verifier: string;
    expires: number;
  }>(cookie);
  if (
    flow.id !== id ||
    flow.nonce !== url.searchParams.get("state") ||
    flow.expires < Date.now()
  )
    throw new AppError("La autorización no corresponde a esta sesión.", 403);
  if (url.searchParams.has("error"))
    return Response.redirect(
      `${appUrl(request)}/?turi=connections&connection=cancelled`,
    );
  const code = url.searchParams.get("code");
  if (!code)
    throw new AppError("Google no devolvió el código de autorización.");
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: required("GOOGLE_CLIENT_ID"),
      client_secret: required("GOOGLE_CLIENT_SECRET"),
      redirect_uri: `${appUrl(request)}/api/turi/google/callback`,
      grant_type: "authorization_code",
      code_verifier: flow.verifier,
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok)
    throw new AppError(
      "Google rechazó la autorización. Probá conectar de nuevo.",
      401,
    );
  const data = await response.json(),
    account = await loadAccount(id);
  const scopes = String(data.scope || "").split(" ");
  if (!data.access_token || !scopes.includes(googleScopes[flow.service]))
    throw new AppError("No se concedió el permiso necesario.", 403);
  await patchAccount(id, {
    google: {
      ...account.google,
      [flow.service]: {
        accessToken: data.access_token,
        refreshToken:
          data.refresh_token || account.google?.[flow.service]?.refreshToken,
        expiresAt: Date.now() + Number(data.expires_in) * 1000,
        scopes,
        calendarId: account.google?.[flow.service]?.calendarId,
      },
    },
  });
  return Response.redirect(
    `${appUrl(request)}/?turi=connections&connection=${flow.service}`,
  );
}

export async function googleAccess(id: string, service: GoogleService) {
  const account = await loadAccount(id),
    connection = account.google?.[service];
  if (!connection?.scopes.includes(googleScopes[service]))
    throw new AppError(
      `Conectá ${service === "gmail-send" ? "el permiso de envío de Gmail" : service} primero.`,
      401,
    );
  if (connection.expiresAt > Date.now() + 60000) return connection.accessToken;
  if (!connection.refreshToken)
    throw new AppError("El permiso de Google venció. Volvé a conectar.", 401);
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: required("GOOGLE_CLIENT_ID"),
      client_secret: required("GOOGLE_CLIENT_SECRET"),
      refresh_token: connection.refreshToken,
      grant_type: "refresh_token",
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok)
    throw new AppError(
      "Google necesita que vuelvas a autorizar la conexión.",
      401,
    );
  const data = await response.json();
  await patchAccount(id, {
    google: {
      ...account.google,
      [service]: {
        ...connection,
        accessToken: data.access_token,
        expiresAt: Date.now() + Number(data.expires_in) * 1000,
      },
    },
  });
  return String(data.access_token);
}

async function googleRequest(
  id: string,
  service: GoogleService,
  url: string,
  init: RequestInit = {},
) {
  const token = await googleAccess(id, service);
  const response = await fetch(url, {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${token}` },
    cache: "no-store",
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok)
    throw new AppError(
      `Google no pudo completar la operación (${response.status}). Revisá el permiso de ${service}.`,
      response.status === 401 || response.status === 403 ? 401 : 502,
    );
  return response;
}
const gmailBase = "https://gmail.googleapis.com/gmail/v1/users/me/messages";
type MailPart = {
  mimeType?: string;
  body?: { data?: string };
  parts?: MailPart[];
};
function mailText(part: MailPart): string {
  return (
    (part.mimeType === "text/plain" && part.body?.data
      ? Buffer.from(part.body.data, "base64url").toString("utf8")
      : "") + (part.parts || []).map(mailText).join("\n")
  );
}
export async function searchMail(id: string, query: string) {
  const data = await (
    await googleRequest(
      id,
      "gmail",
      `${gmailBase}?maxResults=12&q=${encodeURIComponent(query.slice(0, 300))}`,
    )
  ).json();
  return Promise.all(
    (data.messages || []).map(async (message: { id: string }) => {
      const detail = await (
        await googleRequest(
          id,
          "gmail",
          `${gmailBase}/${message.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
        )
      ).json();
      const header = (name: string) =>
        detail.payload?.headers?.find(
          (h: { name: string }) => h.name.toLowerCase() === name.toLowerCase(),
        )?.value || "";
      return {
        id: message.id,
        subject: header("Subject"),
        from: header("From"),
        date: header("Date"),
        snippet: detail.snippet,
      };
    }),
  );
}
export async function importMail(id: string, ids: string[]) {
  if (
    !ids.length ||
    ids.length > 8 ||
    ids.some((x) => !/^[a-zA-Z0-9_-]{1,100}$/.test(x))
  )
    throw new AppError("Elegí hasta 8 correos.");
  return Promise.all(
    ids.map(async (messageId) => {
      const data = await (
        await googleRequest(
          id,
          "gmail",
          `${gmailBase}/${messageId}?format=full`,
        )
      ).json();
      const subject =
        data.payload?.headers?.find(
          (h: { name: string }) => h.name.toLowerCase() === "subject",
        )?.value || "Reserva";
      return {
        id: messageId,
        subject,
        text: (mailText(data.payload || {}) || data.snippet || "").slice(
          0,
          14000,
        ),
      };
    }),
  );
}
export const invitationSchema = z.object({
  recipients: z.array(z.email()).min(1).max(15),
  subject: z.string().min(1).max(180),
  text: z.string().min(1).max(6000),
  adultsConfirmed: z.literal(true),
  approved: z.literal(true),
});
export async function sendInvitations(id: string, input: unknown) {
  const data = invitationSchema.parse(input);
  if (
    /[\r\n]/.test(data.subject) ||
    data.recipients.some((x) => /[\r\n]/.test(x))
  )
    throw new AppError("Los destinatarios o el asunto no son válidos.");
  // One message per recipient: companions' email addresses remain private.
  const sent: string[] = [];
  for (const recipient of [...new Set(data.recipients)]) {
    const raw = [
      `To: ${recipient}`,
      `Subject: =?UTF-8?B?${Buffer.from(data.subject).toString("base64")}?=`,
      "MIME-Version: 1.0",
      "Content-Type: text/plain; charset=UTF-8",
      "Content-Transfer-Encoding: base64",
      "",
      Buffer.from(data.text).toString("base64"),
    ].join("\r\n");
    try {
      const result = await (
        await googleRequest(id, "gmail-send", `${gmailBase}/send`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ raw: Buffer.from(raw).toString("base64url") }),
        })
      ).json();
      sent.push(result.id);
    } catch {
      throw new AppError(
        `Se enviaron ${sent.length} invitaciones antes de un error. No reenvíes sin revisar Enviados en Gmail.`,
        502,
      );
    }
  }
  return { sent: sent.length };
}

export async function syncCalendar(id: string, input: unknown) {
  const data = z
    .object({
      approved: z.literal(true),
      timeZone: z.string().max(80),
      items: z.array(itinerarySchema).min(1).max(100),
    })
    .parse(input);
  try {
    new Intl.DateTimeFormat("es", { timeZone: data.timeZone });
  } catch {
    throw new AppError("La zona horaria no es válida.");
  }
  const account = await loadAccount(id);
  let calendarId = account.google?.calendar?.calendarId;
  if (!calendarId) {
    const created = await (
      await googleRequest(
        id,
        "calendar",
        "https://www.googleapis.com/calendar/v3/calendars",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            summary: "Turi Belo",
            description:
              "Itinerario revisado y aprobado desde Turi. Sin invitados automáticos.",
            timeZone: data.timeZone,
          }),
        },
      )
    ).json();
    calendarId = String(created.id);
    const latest = await loadAccount(id);
    await patchAccount(id, {
      google: {
        ...latest.google,
        calendar: { ...latest.google!.calendar!, calendarId },
      },
    });
  }
  const result = [];
  for (const item of data.items) {
    if (
      !Number.isFinite(Date.parse(item.start)) ||
      Date.parse(item.end) <= Date.parse(item.start)
    )
      throw new AppError("Revisá los horarios antes de guardar en Calendar.");
    // Derive event IDs from the local ID, not from client-supplied calendar IDs.
    const eventId = createHash("sha256")
      .update(`${id}:${item.id}`)
      .digest("hex");
    const endpoint = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;
    const event = {
      summary: item.title,
      location: item.location,
      description: item.notes,
      start: { dateTime: item.start, timeZone: data.timeZone },
      end: { dateTime: item.end, timeZone: data.timeZone },
      reminders: {
        useDefault: false,
        overrides: [{ method: "popup", minutes: item.reminderMinutes }],
      },
    };
    const response = await fetch(`${endpoint}/${eventId}?sendUpdates=none`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${await googleAccess(id, "calendar")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(event),
      signal: AbortSignal.timeout(20000),
    });
    let saved;
    if (response.status === 404) {
      const inserted = await fetch(`${endpoint}?sendUpdates=none`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${await googleAccess(id, "calendar")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ...event, id: eventId }),
        signal: AbortSignal.timeout(20000),
      });
      if (!inserted.ok)
        throw new AppError(
          "No se pudo guardar una actividad. Revisá Calendar antes de reintentar.",
          502,
        );
      saved = await inserted.json();
    } else {
      if (!response.ok)
        throw new AppError(
          "No se pudo actualizar una actividad. Revisá Calendar antes de reintentar.",
          502,
        );
      saved = await response.json();
    }
    result.push({ localId: item.id, eventId: saved.id, url: saved.htmlLink });
  }
  return { calendarId, events: result };
}

export async function pickerConfig(id: string) {
  const token = await googleAccess(id, "drive"),
    account = await loadAccount(id);
  if (
    account.google?.drive?.scopes.some((scope) => scope !== googleScopes.drive)
  )
    throw new AppError(
      "Reconectá Drive con el permiso exclusivo drive.file antes de usar el selector.",
      403,
    );
  return {
    token,
    apiKey: required("GOOGLE_PICKER_API_KEY"),
    appId: required("GOOGLE_CLOUD_PROJECT_NUMBER"),
  };
}
export async function importDriveFile(
  id: string,
  fileId: string,
): Promise<Attachment> {
  if (!/^[a-zA-Z0-9_-]{1,200}$/.test(fileId))
    throw new AppError("El archivo no es válido.");
  const base = `https://www.googleapis.com/drive/v3/files/${fileId}`;
  const file = await (
    await googleRequest(id, "drive", `${base}?fields=id,name,mimeType,size`)
  ).json();
  const supported = [
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/webp",
  ];
  if (!supported.includes(file.mimeType))
    throw new AppError("Elegí un PDF o una imagen PNG, JPEG o WebP.");
  if (Number(file.size || 0) > 2_500_000)
    throw new AppError("Elegí un archivo de hasta 2,5 MB.", 413);
  const response = await googleRequest(id, "drive", `${base}?alt=media`),
    bytes = await response.arrayBuffer();
  if (bytes.byteLength > 2_500_000)
    throw new AppError("El archivo supera 2,5 MB.", 413);
  return {
    name: String(file.name).slice(0, 160),
    type: file.mimeType,
    size: bytes.byteLength,
    data: `data:${file.mimeType};base64,${Buffer.from(bytes).toString("base64")}`,
  };
}
export async function saveToDrive(id: string, state: Workspace) {
  const text = `# Mi viaje a ${state.trip.destination || "un nuevo destino"}\n\n${state.trip.startDate} — ${state.trip.endDate}\n\n${state.itinerary.map((e) => `## ${e.title}\n${e.start} — ${e.end}\n${e.location}\n${e.notes}`).join("\n\n")}\n`;
  const form = new FormData();
  form.append(
    "metadata",
    new Blob(
      [
        JSON.stringify({
          name: `Turi Belo — ${state.trip.destination || "Mi itinerario"}.md`,
          mimeType: "text/markdown",
        }),
      ],
      { type: "application/json" },
    ),
  );
  form.append("file", new Blob([text], { type: "text/markdown" }));
  const data = await (
    await googleRequest(
      id,
      "drive",
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink",
      { method: "POST", body: form },
    )
  ).json();
  return {
    id: data.id,
    url: data.webViewLink || `https://drive.google.com/file/d/${data.id}/view`,
  };
}
