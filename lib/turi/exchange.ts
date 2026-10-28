import { z } from "zod";
import { currencies } from "./domain";
import { AppError } from "./security";

const cached = new Map<
  string,
  { expires: number; updatedAt: string; rates: Record<string, number> }
>();
export const exchangeSchema = z.object({
  from: z.enum(currencies),
  to: z.enum(currencies),
  amount: z.number().min(0).max(1e9).default(1),
});
export async function exchangeQuote(input: unknown) {
  const data = exchangeSchema.parse(input);
  let table = cached.get(data.from);
  if (!table || table.expires < Date.now()) {
    const response = await fetch(
      `https://open.er-api.com/v6/latest/${data.from}`,
      { signal: AbortSignal.timeout(12000), next: { revalidate: 3600 } },
    );
    if (!response.ok)
      throw new AppError(
        "La fuente de cotizaciones no está disponible. No voy a usar una tasa inventada.",
        502,
      );
    const result = await response.json();
    if (
      result.result !== "success" ||
      !result.rates ||
      !result.time_last_update_unix
    )
      throw new AppError("La cotización recibida no es válida.", 502);
    table = {
      expires: Date.now() + 3600000,
      updatedAt: new Date(result.time_last_update_unix * 1000).toISOString(),
      rates: result.rates,
    };
    cached.set(data.from, table);
  }
  const rate = Number(table.rates[data.to]);
  if (
    !Number.isFinite(rate) ||
    rate <= 0 ||
    Date.now() - Date.parse(table.updatedAt) > 3 * 86400000
  )
    throw new AppError(
      "No hay una cotización reciente verificable para esa moneda.",
      502,
    );
  return {
    from: data.from,
    to: data.to,
    amount: data.amount,
    converted: Math.round(data.amount * rate * 100) / 100,
    rate,
    updatedAt: table.updatedAt,
    source: "ExchangeRate-API",
    sourceUrl: "https://www.exchangerate-api.com",
    indicative: true,
    note: "Referencia de mercado de actualización diaria. No incluye comisiones ni representa la tasa de Belo, Pix o tarjeta. Confirmá la cotización del proveedor antes de pagar.",
  };
}
