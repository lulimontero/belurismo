import { currencies, workspaceSchema, type Workspace } from "./domain";

export type FinanceCurrency = Workspace["trip"]["currency"];
const normalized = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const markers: Record<FinanceCurrency, RegExp> = {
  USD: /\bUSD\b|US\s*\$|U\s*\$D|\bdolares(?: estadounidenses)?\b/i,
  BRL: /\bBRL\b|R\s*\$|\breales\b/i,
  ARS: /\bARS\b|AR\s*\$|\bpesos argentinos\b/i,
  EUR: /\bEUR\b|€|\beuros\b/i,
  UYU: /\bUYU\b|\bpesos uruguayos\b/i,
  CLP: /\bCLP\b|\bpesos chilenos\b/i,
  MXN: /\bMXN\b|\bpesos mexicanos\b/i,
};

/** Currency attached to the reported remainder, not the desired conversion. */
export function originCurrencyFromText(text: string): FinanceCurrency | undefined {
  const value = normalized(text);
  const tokens = value.matchAll(/\b(?:USD|ARS|BRL|EUR|UYU|CLP|MXN)\b|US\s*\$|U\s*\$D|R\s*\$|AR\s*\$|€|\b(?:dolares(?: estadounidenses)?|reales|euros|pesos argentinos|pesos uruguayos|pesos chilenos|pesos mexicanos)\b/gi);
  const origins = new Set<FinanceCurrency>();
  for (const token of tokens) {
    const currency = currencies.find(code => markers[code].test(token[0]));
    if (!currency) continue;
    const before = value.slice(0, token.index);
    const after = value.slice(token.index! + token[0].length);
    const sourceAfter = /^\s*(?:que\s+)?(?:me\s+)?(?:sobraron|sobro|quedaron|quedo)\b/.test(after);
    const sourceBefore = /\b(?:sobraron|sobro|quedaron|quedo|tengo|saldo|conservo|remanente|origen)\b[^.!?;\n]{0,65}$/.test(before) &&
      !/\b(?:pasar|convertir|cambiar|convertidos?|cambiados?)\b[^.!?;\n]*$|\b(?:a|hacia)\s*$/.test(before);
    const conversionSource = /\b(?:convertir|cambiar|pasar)\s+(?:[\d.,]+\s*)?$/.test(before);
    if (sourceAfter || sourceBefore || conversionSource) origins.add(currency);
  }
  // Multiple stated remainders need an explicit choice in the currency control.
  return origins.size === 1 ? [...origins][0] : undefined;
}

export function nextReferenceCurrency(origin: FinanceCurrency, desired?: FinanceCurrency): FinanceCurrency {
  if (desired && desired !== origin && currencies.includes(desired)) return desired;
  return origin === "ARS" ? "USD" : "ARS";
}

export function validRateThreshold(value: string | number): boolean {
  if (typeof value === "string" && !value.trim()) return false;
  const number = Number(value);
  return Number.isFinite(number) && number > 0 && number <= 1e9;
}

export function formatExchangeRate(value: number, currency: FinanceCurrency): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency", currency, currencyDisplay: "code",
    minimumFractionDigits: 2, maximumFractionDigits: 12,
    ...(value !== 0 && Math.abs(value) < 1e-12 ? { notation: "scientific" as const } : {}),
  }).format(value);
}

export function remainderMatchesDraft(
  remainder: Workspace["postTrip"]["remainder"],
  currency: FinanceCurrency,
  amount: string,
): boolean {
  return Boolean(remainder && remainder.currency === currency && amount.trim() && remainder.amount === Number(amount));
}

export function appendRateAlert(state: Workspace, input: {
  from: FinanceCurrency; to: FinanceCurrency; threshold: number;
  direction: "above" | "below"; consent: boolean;
}): Workspace {
  if (!input.consent) throw new Error("Activá el permiso para guardar este aviso.");
  if (input.from === input.to || !validRateThreshold(input.threshold)) throw new Error("Revisá las monedas y un umbral mayor a cero.");
  if (state.rateAlerts.some(alert => alert.from === input.from && alert.to === input.to && alert.threshold === input.threshold && alert.direction === input.direction))
    throw new Error("Ya guardaste una alerta con esas monedas, valor y dirección.");
  if (state.rateAlerts.length >= 20) throw new Error("Ya tenés 20 alertas. Quitá una antes de guardar otra; conservamos las anteriores.");
  return workspaceSchema.parse({
    ...state, alertsConsent: true,
    rateAlerts: [...state.rateAlerts, {
      id: crypto.randomUUID(), from: input.from, to: input.to,
      threshold: input.threshold, direction: input.direction, sent: false,
    }],
  });
}

export function removeRateAlert(state: Workspace, id: string): Workspace {
  return workspaceSchema.parse({ ...state, rateAlerts: state.rateAlerts.filter(alert => alert.id !== id) });
}

export function appendFlightWatch(state: Workspace, input: {
  destination: string; currency: FinanceCurrency; maxPrice: number;
}): Workspace {
  const destination = input.destination.trim().replace(/\s+/g, " ");
  if (destination.length < 2 || destination.length > 120 || /[<>\u0000-\u001f]/.test(destination)) throw new Error("Revisá el destino del vuelo.");
  if (!validRateThreshold(input.maxPrice)) throw new Error("Indicá un precio máximo mayor a cero.");
  if (state.postTrip.flightWatches.some(watch => normalized(watch.destination) === normalized(destination) && watch.currency === input.currency && watch.maxPrice === input.maxPrice))
    throw new Error("Ese destino y precio máximo ya están guardados.");
  if (state.postTrip.flightWatches.length >= 10) throw new Error("Ya tenés 10 intereses de vuelos. Quitá uno antes de agregar otro; conservamos los anteriores.");
  return workspaceSchema.parse({ ...state, postTrip: { ...state.postTrip,
    flightWatches: [...state.postTrip.flightWatches, { id: crypto.randomUUID(), destination,
      currency: input.currency, maxPrice: input.maxPrice, createdAt: new Date().toISOString() }],
  } });
}

export function removeFlightWatch(state: Workspace, id: string): Workspace {
  return workspaceSchema.parse({ ...state, postTrip: { ...state.postTrip,
    flightWatches: state.postTrip.flightWatches.filter(watch => watch.id !== id),
  } });
}
