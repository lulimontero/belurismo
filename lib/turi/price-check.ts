import { z } from "zod";

// An on-the-spot check of what a product usually costs, optionally against
// what the traveler is being asked to pay. Ranges come from the agent's search;
// conversions are computed here with a dated market quote.
// Listed here rather than imported: domain.ts already depends on the widget schemas.
const currency = z.enum(["ARS", "BRL", "USD", "EUR", "UYU", "CLP", "MXN"]);
export const priceCheckInputSchema = z.object({
  item: z.string().min(1).max(80),
  currency,
  references: z.array(z.object({
    label: z.string().min(1).max(60),
    min: z.number().finite().positive().max(1e9),
    max: z.number().finite().positive().max(1e9),
  })).min(1).max(4),
  asked: z.object({ amount: z.number().finite().positive().max(1e9), currency }).nullable(),
  homeCurrency: currency.nullable(),
  sourceTitle: z.string().max(200).nullable(),
  sourceUrl: z.string().max(2000).nullable(),
  phrase: z.object({
    language: z.string().min(1).max(40),
    text: z.string().min(1).max(200),
    pronunciation: z.string().min(1).max(200),
    translation: z.string().max(200).nullable(),
  }).nullable(),
});
export type PriceCheckInput = z.infer<typeof priceCheckInputSchema>;

export const priceCheckResultSchema = priceCheckInputSchema.extend({
  sourceUrl: z.url().max(2000).refine((url) => /^https:\/\//i.test(url)).nullable(),
  /** What is being asked, expressed in the references' currency. */
  askedInCurrency: z.number().finite().min(0).max(1e12).nullable(),
  /** Market rate from `currency` to `homeCurrency`. */
  homeRate: z.number().finite().positive().nullable(),
  quoteUpdatedAt: z.iso.datetime().nullable(),
  checkedAt: z.iso.datetime(),
});
export type PriceCheckResult = z.infer<typeof priceCheckResultSchema>;

type Quote = (from: string, to: string) => Promise<{ rate: number; updatedAt: string }>;

export async function buildPriceCheck(input: unknown, quote: Quote, now = new Date()): Promise<PriceCheckResult> {
  const parsed = priceCheckInputSchema.parse(input);
  if (parsed.references.some((reference) => reference.min > reference.max))
    throw new Error("El mínimo de cada referencia no puede superar el máximo.");
  const sourceUrl = parsed.sourceUrl?.trim() || null;
  if (sourceUrl && (!/^https:\/\//i.test(sourceUrl) ||
    /google\.[^/]+\/maps|maps\.google|bing\.com\/search|google\.[^/]+\/search/i.test(sourceUrl)))
    throw new Error("Usá la página específica de la referencia, no un buscador.");
  let askedInCurrency: number | null = null, homeRate: number | null = null, quoteUpdatedAt: string | null = null;
  if (parsed.asked) {
    if (parsed.asked.currency === parsed.currency) askedInCurrency = parsed.asked.amount;
    else {
      const result = await quote(parsed.asked.currency, parsed.currency);
      askedInCurrency = Math.round(parsed.asked.amount * result.rate * 100) / 100;
      quoteUpdatedAt = result.updatedAt;
    }
  }
  const home = parsed.homeCurrency ?? (parsed.asked && parsed.asked.currency !== parsed.currency ? parsed.asked.currency : null);
  if (home && home !== parsed.currency) {
    const result = await quote(parsed.currency, home);
    homeRate = result.rate;
    quoteUpdatedAt = result.updatedAt;
  }
  return priceCheckResultSchema.parse({
    ...parsed,
    homeCurrency: home && home !== parsed.currency ? home : null,
    sourceTitle: parsed.sourceTitle?.trim() || null,
    sourceUrl,
    askedInCurrency,
    homeRate,
    quoteUpdatedAt,
    checkedAt: now.toISOString(),
  });
}

/** How many times the asked price is the highest typical price; null without an asked price. */
export function priceCheckRatio(result: Pick<PriceCheckResult, "askedInCurrency" | "references">): number | null {
  if (result.askedInCurrency === null) return null;
  const top = Math.max(...result.references.map((reference) => reference.max));
  return Math.round((result.askedInCurrency / top) * 10) / 10;
}

export function priceCheckToText(result: PriceCheckResult): string {
  const ranges = result.references.map((reference) => `${reference.label} ${result.currency} ${reference.min}–${reference.max}`).join("; ");
  const ratio = priceCheckRatio(result);
  return [
    `Precio típico de ${result.item}: ${ranges}.`,
    result.asked ? `Le piden ${result.asked.currency} ${result.asked.amount} (≈ ${result.currency} ${result.askedInCurrency}, x${ratio} del máximo típico).` : "",
    result.phrase ? `Cómo pedirlo en ${result.phrase.language}: "${result.phrase.text}" (${result.phrase.pronunciation}).` : "",
    result.sourceUrl ? `Fuente: ${result.sourceTitle ?? result.sourceUrl}, ${result.sourceUrl}.` : "Referencia orientativa sin fuente verificada.",
  ].filter(Boolean).join(" ");
}
