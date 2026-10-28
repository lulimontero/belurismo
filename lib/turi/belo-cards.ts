import { mkdir, readFile, writeFile } from "node:fs/promises";
import { AppError, required } from "./security";
import { cloudConfigured, redis } from "./storage";

// Cards belong to the organization behind BELO_API_KEY, not to a traveler account.
export type SavedCard = {
  id: string;
  holder: string;
  limitUsd: string | null;
  lastFour: string | null;
  status: string;
  createdAt: string;
};
type ApiCard = {
  id: string;
  name: string | null;
  lastFour: string | null;
  brand: string;
  type: string;
  status: string;
  canFreeze: boolean;
};

const errorText: Record<string, string> = {
  card_not_allowed:
    "Las tarjetas no están habilitadas o la solicitud con el emisor no está aprobada.",
  unauthenticated: "La API key de belo no es válida para esta operación.",
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const CARD_GAP_MS = 2000;
const MAX_RETRIES = 3;

async function beloApi<T>(path: string, init: RequestInit = {}): Promise<T> {
  const base = process.env.BELO_API_BASE || "https://b2b.stgbelo.app/api/v1";
  let response: Response;
  // Retries reuse init, so a POST keeps its Idempotency-Key and can't issue a card twice.
  for (let attempt = 0; ; attempt++) {
    response = await fetch(`${base}${path}`, {
      ...init,
      headers: {
        Authorization: `ApiKey ${required("BELO_API_KEY")}`,
        "Content-Type": "application/json",
        ...init.headers,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(60000),
    });
    if (response.status !== 429 || attempt === MAX_RETRIES) break;
    const retryAfter = Number(response.headers.get("retry-after"));
    await sleep(Math.min(retryAfter > 0 ? retryAfter * 1000 : 2000 * 2 ** attempt, 20000));
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const code: string = body?.error?.code || "";
    throw new AppError(
      errorText[code] ||
        (response.status === 429
          ? "belo está limitando las solicitudes. Probá de nuevo en un minuto."
          : response.status === 422
          ? "belo rechazó la tarjeta: se alcanzó el tope de tarjetas virtuales o falta saldo."
          : body?.error?.message || "belo no respondió."),
      response.status,
    );
  }
  return body as T;
}

// ponytail: Redis when configured, local JSON file otherwise (fine for the local demo, not for serverless).
const storeKey = "turi:belo:cards";
const storeFile = `${process.cwd()}/.turi/cards.json`;
export async function loadCards(): Promise<SavedCard[]> {
  if (cloudConfigured()) {
    const raw = await redis<string | null>("GET", storeKey);
    return raw ? JSON.parse(raw) : [];
  }
  try {
    return JSON.parse(await readFile(storeFile, "utf8"));
  } catch {
    return [];
  }
}
async function saveCards(cards: SavedCard[]) {
  if (cloudConfigured()) return redis("SET", storeKey, JSON.stringify(cards));
  await mkdir(`${process.cwd()}/.turi`, { recursive: true });
  await writeFile(storeFile, JSON.stringify(cards, null, 2));
}

export async function listCards() {
  const [{ data }, saved] = await Promise.all([
    beloApi<{ data: ApiCard[] }>("/cards"),
    loadCards(),
  ]);
  return data.map((card) => {
    const local = saved.find((s) => s.id === card.id);
    return { ...card, holder: local?.holder ?? card.name, limitUsd: local?.limitUsd ?? null };
  });
}

// Creates one card per holder, one request at a time; failures don't stop the batch.
export async function createCards(holders: string[], limitUsd: string | null) {
  const results: { holder: string; ok: boolean; card?: SavedCard; error?: string }[] = [];
  for (const [index, holder] of holders.entries()) {
    if (index) await sleep(CARD_GAP_MS);
    try {
      const card = await beloApi<ApiCard>("/cards", {
        method: "POST",
        headers: { "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({ name: holder }),
      });
      const saved: SavedCard = {
        id: card.id,
        holder,
        limitUsd,
        lastFour: card.lastFour,
        status: card.status,
        createdAt: new Date().toISOString(),
      };
      // Persist after every success so a later failure never loses a card already issued.
      await saveCards([...(await loadCards()), saved]);
      results.push({ holder, ok: true, card: saved });
    } catch (error) {
      results.push({ holder, ok: false, error: (error as Error).message });
    }
  }
  return results;
}
