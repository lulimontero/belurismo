import { z } from "zod";

const webUrl = z.url().max(4096).refine((value) => {
  const url = new URL(value);
  return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password;
}, "Se necesita un enlace web público.");

export const travelOptionInputSchema = z.object({
  kind: z.enum(["hotel", "restaurant", "activity", "beach", "place"]),
  name: z.string().min(1).max(140),
  location: z.string().min(1).max(180),
  summary: z.string().min(1).max(360),
  price: z.object({
    amount: z.number().finite().min(0).max(1e9),
    currency: z.string().regex(/^[A-Z]{3}$/),
    basis: z.enum(["night", "person", "total"]),
    note: z.string().min(1).max(300),
    evidence: z.string().min(1).max(350).describe("Fragmento de la fuente que publica ese importe y su base. Si no existe, price debe ser null. Nunca usar el presupuesto del viajero como precio."),
    stayNights: z.number().int().min(1).max(365).nullable().default(null),
  }).nullable().default(null),
  facts: z.array(z.object({
    label: z.string().min(1).max(50),
    value: z.string().min(1).max(160),
  })).max(6).default([]),
  pros: z.array(z.string().min(1).max(180)).min(1).max(3),
  cons: z.array(z.string().min(1).max(180)).min(1).max(3),
  caveat: z.string().min(1).max(360),
  sourceUrl: webUrl.refine((value) => {
    const url = new URL(value);
    return !(/(^|\.)(google\.[a-z.]+|bing\.com)$/.test(url.hostname) && /\/(maps|search)(\/|$)/.test(url.pathname));
  }, "Usá la página consultada del lugar o una ficha detallada del proveedor, no un enlace a Google Maps o un buscador."),
  sourceTitle: z.string().min(1).max(180),
});
export const travelOptionsInputSchema = z.object({
  options: z.array(travelOptionInputSchema).min(1).max(4),
});
export type TravelOptionInput = z.infer<typeof travelOptionInputSchema>;
export const travelOptionSchema = travelOptionInputSchema.extend({
  id: z.string().min(1).max(80),
  /** The published price in the traveler's budget currency, from a dated market quote. */
  homePrice: z.object({ amount: z.number().finite().min(0).max(1e12), currency: z.string().regex(/^[A-Z]{3}$/) }).optional(),
  checkedAt: z.iso.datetime(),
  image: z.object({
    url: webUrl,
    sourceUrl: webUrl,
    alt: z.string().max(250).optional(),
  }).optional(),
});
export type TravelOption = z.infer<typeof travelOptionSchema>;

export function publishedOptionPrice(price: TravelOption["price"]): TravelOption["price"] {
  if (!price) return null;
  const evidence = price.evidence.trim();
  const hasAmount = (evidence.match(/\d+(?:[.,]\d+)*/g) || []).some((number) =>
    [Number(number), Number(number.replace(/\./g, "").replace(",", ".")), Number(number.replace(/,/g, ""))]
      .some((value) => Math.abs(value - price.amount) < 0.001),
  ) || (price.amount === 0 && /gratis|gratuit[oa]|free|sem custo/i.test(evidence));
  if (!hasAmount || /presupuesto|tope del|budget|a consultar|por confirmar|no (?:hay|se public)/i.test(evidence) ||
    /(?:precio|tarifa|importe|valor)\s+(?:a|por)\s+(?:consultar|confirmar)/i.test(price.note)) return null;
  return price;
}

export function readTravelOptions(value: unknown): TravelOption[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 12).flatMap((item) => {
    const result = travelOptionSchema.safeParse(item);
    return result.success ? [result.data] : [];
  });
}

export function mergeTravelOptions(previous: TravelOption[], incoming: TravelOption[]): TravelOption[] {
  const options = new Map(previous.map((option) => [`${option.sourceUrl}|${option.name}`, option]));
  for (const option of incoming) options.set(`${option.sourceUrl}|${option.name}`, option);
  return [...options.values()].slice(-12);
}

export function optionToText(option: TravelOption) {
  const price = option.price
    ? `${option.price.currency} ${option.price.amount} ${{ night: "por noche", person: "por persona", total: "en total" }[option.price.basis] }. ${option.price.note}${option.price.basis === "night" && option.price.stayNights ? ` Estimado para ${option.price.stayNights} noches: ${option.price.currency} ${option.price.amount * option.price.stayNights}; calculado desde el precio por noche.` : ""}`
    : "Precio a consultar para tus fechas y viajeros.";
  return `${option.name} · ${option.location}\n${option.summary}\n${price}\n${option.facts.map(({ label, value }) => `${label}: ${value}`).join("\n")}\nA favor: ${option.pros.join("; ")}\nA considerar: ${option.cons.join("; ")}\n${option.caveat}\nFuente: ${option.sourceTitle}, ${option.sourceUrl}\nConsultado: ${option.checkedAt}. Disponibilidad y condiciones por confirmar.`;
}
