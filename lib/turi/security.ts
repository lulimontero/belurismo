import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { cookies } from "next/headers";

export class AppError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function required(name: string) {
  const value = process.env[name];
  if (!value) throw new AppError(`Falta configurar ${name}.`, 503);
  return value;
}
function key() {
  return createHash("sha256").update(required("TURI_SESSION_SECRET")).digest();
}
export function seal(value: unknown) {
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final(),
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString(
    "base64url",
  );
}
export function unseal<T>(value: string): T {
  try {
    const data = Buffer.from(value, "base64url"),
      decipher = createDecipheriv("aes-256-gcm", key(), data.subarray(0, 12));
    decipher.setAuthTag(data.subarray(12, 28));
    return JSON.parse(
      Buffer.concat([
        decipher.update(data.subarray(28)),
        decipher.final(),
      ]).toString(),
    );
  } catch {
    throw new AppError("La sesión venció. Volvé a conectar tu cuenta.", 401);
  }
}
export const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 30,
};
export async function sessionId() {
  const jar = await cookies(),
    existing = jar.get("turi_session")?.value;
  if (existing) {
    try {
      const data = unseal<{ id: string; expires: number }>(existing);
      if (data.expires > Date.now() && /^[a-f0-9]{48}$/.test(data.id))
        return data.id;
    } catch {
      /* replace invalid cookie */
    }
  }
  const id = randomBytes(24).toString("hex");
  jar.set(
    "turi_session",
    seal({ id, expires: Date.now() + 30 * 86400000 }),
    cookieOptions,
  );
  return id;
}
export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin"),
    expected = new URL(request.url).origin;
  if (
    !origin ||
    origin !== expected ||
    request.headers.get("sec-fetch-site") === "cross-site"
  )
    throw new AppError("Solicitud de otro origen rechazada.", 403);
}
export function safeEqual(a: string, b: string) {
  const x = Buffer.from(a),
    y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
export async function readJson(request: Request, maxBytes = 4_200_000) {
  if (!request.headers.get("content-type")?.includes("application/json"))
    throw new AppError("Se requiere JSON.", 415);
  if (Number(request.headers.get("content-length") || 0) > maxBytes)
    throw new AppError("El archivo es demasiado grande.", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new AppError("La solicitud está vacía.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw new AppError("El archivo es demasiado grande.", 413);
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new AppError("El JSON no es válido.");
  }
}
export function publicError(error: unknown) {
  if (error instanceof AppError)
    return { error: error.message, status: error.status };
  if (error instanceof Error && error.name === "ZodError")
    return {
      error: "Revisá los datos enviados. Hay campos incompletos o inválidos.",
      status: 400,
    };
  // Provider responses can contain private account data; never relay arbitrary error bodies.
  const status = Number((error as { status?: number })?.status);
  if (status === 401)
    return {
      error:
        "La credencial fue rechazada. Revisá la conexión en Configuración.",
      status: 401,
    };
  if (status === 429)
    return {
      error:
        "Se alcanzó el límite del servicio. Esperá un momento o revisá el saldo de la API.",
      status: 429,
    };
  return {
    error: "No pude completar la conexión. Intentá de nuevo en un momento.",
    status: 502,
  };
}
