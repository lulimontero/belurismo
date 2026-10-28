import { seal, unseal, AppError, required } from "./security";
import type { Workspace, Message, LocalAction } from "./domain";

export type GoogleConnection = {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  scopes: string[];
  calendarId?: string;
};
export type GoogleService = "gmail" | "gmail-send" | "calendar" | "drive";
export type Account = {
  proposals?: LocalAction[];
  beloProposals?: {
    label: string;
    name: string;
    args: Record<string, unknown>;
    token: string;
  }[];
  google?: Partial<Record<GoogleService, GoogleConnection>>;
  beloToken?: string;
  telegram?: { chatId: number; alerts: boolean };
  workspace?: Workspace;
  messages?: Message[];
  updatedAt?: number;
};
export const cloudConfigured = () =>
  Boolean(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN,
  );
export async function redis<T = unknown>(
  ...command: (string | number)[]
): Promise<T> {
  const url = required("UPSTASH_REDIS_REST_URL");
  if (!url.startsWith("https://"))
    throw new AppError("La base de datos debe usar HTTPS.", 503);
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${required("UPSTASH_REDIS_REST_TOKEN")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok)
    throw new AppError("No se pudo acceder al almacenamiento seguro.", 503);
  const data = await response.json();
  if (data.error)
    throw new AppError("El almacenamiento no está disponible.", 503);
  return data.result as T;
}
export async function loadAccount(id: string): Promise<Account> {
  if (!cloudConfigured()) return {};
  const data = await redis<string | null>("GET", `turi:account:${id}`);
  return data ? unseal<Account>(data) : {};
}
export async function saveAccount(id: string, account: Account) {
  await redis("SET", `turi:account:${id}`, seal(account), "EX", 90 * 86400);
}
export async function patchAccount(id: string, patch: Partial<Account>) {
  return mutateAccount(id, (account) => ({
    ...account,
    ...patch,
    ...(patch.workspace ||
    patch.messages ||
    patch.proposals ||
    patch.beloProposals
      ? { updatedAt: Date.now() }
      : {}),
  }));
}
export async function mutateAccount(
  id: string,
  update: (account: Account) => Account,
) {
  // Serialize read/modify/write across serverless instances, including web/Telegram.
  const lock = `turi:lock:${id}`,
    token = crypto.randomUUID();
  const acquired = await redis("SET", lock, token, "NX", "EX", 15);
  if (!acquired)
    throw new AppError("Tu viaje se está actualizando. Probá nuevamente.", 409);
  try {
    const account = update(await loadAccount(id));
    await saveAccount(id, account);
    return account;
  } finally {
    await redis(
      "EVAL",
      "if redis.call('get',KEYS[1]) == ARGV[1] then return redis.call('del',KEYS[1]) else return 0 end",
      1,
      lock,
      token,
    );
  }
}
const windows = new Map<string, { count: number; reset: number }>();
export async function rateLimit(
  id: string,
  name: string,
  limit = 20,
  seconds = 60,
) {
  const bucket = `turi:rate:${name}:${id}:${Math.floor(Date.now() / (seconds * 1000))}`;
  if (cloudConfigured()) {
    const value = await redis<number>("INCR", bucket);
    if (value === 1) await redis("EXPIRE", bucket, seconds + 1);
    if (value > limit)
      throw new AppError(
        "Llegaste al límite de consultas. Probá en un minuto.",
        429,
      );
  } else {
    if (windows.size > 3000)
      for (const [key, value] of windows)
        if (value.reset < Date.now()) windows.delete(key);
    const value = windows.get(bucket) || {
      count: 0,
      reset: Date.now() + seconds * 1000,
    };
    value.count++;
    windows.set(bucket, value);
    if (value.count > limit)
      throw new AppError(
        "Llegaste al límite de consultas. Probá en un minuto.",
        429,
      );
  }
}
