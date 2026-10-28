import { z } from "zod";
import { publishedOptionPrice } from "./travel-options";

export const priceReviewInputSchema = z.object({
  expenseId: z.string().min(1).max(80),
  referenceMin: z.number().finite().positive().max(1e9),
  referenceMax: z.number().finite().positive().max(1e9),
  currency: z.enum(["ARS", "BRL", "USD", "EUR", "UYU", "CLP", "MXN"]),
  quantity: z.number().finite().positive().max(10000),
  unit: z.string().min(1).max(100),
  evidence: z.string().min(8).max(800),
  sourceTitle: z.string().min(1).max(200),
  sourceUrl: z.url().max(2000).refine(url => /^https:\/\//i.test(url)),
  conditions: z.string().min(1).max(700),
});
export const priceReviewResultSchema = priceReviewInputSchema.extend({
  description: z.string().min(1).max(180),
  paid: z.number().finite().min(0).max(1e9),
  referenceTotalMin: z.number().finite().min(0).max(1e12),
  referenceTotalMax: z.number().finite().min(0).max(1e12),
  difference: z.number().finite().min(0).max(1e12),
  checkedAt: z.iso.datetime(),
});
export type PriceReviewResult = z.infer<typeof priceReviewResultSchema>;

export function buildPriceReview(input: unknown, expenses: readonly { id: string; description: string; amount: number; currency: string }[], now = new Date()): PriceReviewResult {
  const parsed = priceReviewInputSchema.parse(input);
  const expense = expenses.find(item => item.id === parsed.expenseId);
  if (!expense) throw new Error("Elegí un gasto registrado antes de comparar.");
  if (expense.currency !== parsed.currency) throw new Error("La referencia y el comprobante necesitan la misma moneda. Confirmá primero la conversión y sus condiciones.");
  const markers: Record<string, RegExp> = {
    BRL: /\bBRL\b|(?:^|[^a-z])R\s*\$|\breales\b|\breal brasileno\b/i,
    USD: /\bUSD\b|US\s*\$|U\s*\$D|\bdolares\b|\bdolar estadounidense\b/i,
    ARS: /\bARS\b|AR\s*\$|\bpesos argentinos\b/i,
    EUR: /\bEUR\b|€|\beuros?\b/i,
    UYU: /\bUYU\b|\bpesos uruguayos\b/i,
    CLP: /\bCLP\b|\bpesos chilenos\b/i,
    MXN: /\bMXN\b|\bpesos mexicanos\b/i,
  };
  const evidence = parsed.evidence.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (!markers[parsed.currency].test(evidence)) throw new Error("La evidencia debe identificar la moneda del rango; un símbolo $ ambiguo no confirma la moneda.");
  if (Object.entries(markers).some(([currency, pattern]) => currency !== parsed.currency && pattern.test(evidence)))
    throw new Error("La evidencia mezcla monedas explícitas. Usá el fragmento con los importes y la moneda de esta referencia; no interpretes un precio de otra moneda como equivalente.");
  if (parsed.referenceMin > parsed.referenceMax) throw new Error("El mínimo de referencia no puede superar el máximo.");
  if (/google\.[^/]+\/maps|maps\.google|bing\.com\/search|google\.[^/]+\/search/i.test(parsed.sourceUrl)) throw new Error("Usá la página específica de la referencia, no un buscador.");
  for (const amount of [parsed.referenceMin, parsed.referenceMax]) {
    if (!publishedOptionPrice({ amount, currency: parsed.currency, basis: "person", note: "Referencia publicada", evidence: parsed.evidence, stayNights: null }))
      throw new Error("La evidencia tiene que contener los importes publicados. Si falta un precio comparable, explicá qué dato falta sin inventar un rango.");
  }
  const rounded = (value: number) => Math.round(value * 100) / 100;
  const max = rounded(parsed.referenceMax * parsed.quantity);
  return priceReviewResultSchema.parse({ ...parsed, description: expense.description, paid: expense.amount,
    referenceTotalMin: rounded(parsed.referenceMin * parsed.quantity), referenceTotalMax: max,
    difference: rounded(Math.max(0, expense.amount - max)), checkedAt: now.toISOString() });
}

export function priceReviewClassification(result: Pick<PriceReviewResult, "paid" | "referenceTotalMin" | "referenceTotalMax">): "above" | "below" | "within" {
  if (result.paid > result.referenceTotalMax) return "above";
  if (result.paid < result.referenceTotalMin) return "below";
  return "within";
}

export function priceReviewToText(result: PriceReviewResult): string {
  return `${result.description}: pagado ${result.currency} ${result.paid}. Referencia ${result.currency} ${result.referenceMin}–${result.referenceMax} por ${result.unit}, cantidad ${result.quantity}. Diferencia frente al máximo: ${result.currency} ${result.difference}. ${result.conditions} Fuente: ${result.sourceTitle}, ${result.sourceUrl}, consultada ${result.checkedAt}. Comparación orientativa; no verifica un cobro indebido.`;
}
