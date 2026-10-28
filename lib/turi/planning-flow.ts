import type { Workspace } from "./domain";
import { detectConversationPanel } from "./conversation-panels";

// Ported from the pretrip HTML's parseHotelRequest, nextQuestion,
// nightsOf, formatRange and budgetOptions. Values describe the user's plan,
// never hotel availability or prices returned by a provider.
export type PlanningStep =
  | "destination"
  | "dates"
  | "travelers"
  | "ages"
  | "budget"
  | "ready";
export type PlanningContext = {
  destination?: string;
  startDate?: string;
  endDate?: string;
  nights?: number;
  adults?: number;
  children?: number;
  ages?: string[];
  currency?: string;
  budget?: number;
  budgetScope?: "night" | "total";
  budgetAudience?: "group" | "person";
};
export type PlanningResult = PlanningContext & { step: PlanningStep };
type HistoryMessage = { role: "user" | "assistant"; text: string };
type ParsedRequest = PlanningContext & {
  datesMentioned?: boolean;
  accommodationBudget?: boolean;
};

const MONTHS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
const KNOWN_DESTINATIONS: [RegExp, string][] = [
  [/\b(?:florian[oó]polis|floripa)\b/i, "Florianópolis"],
  [/\b(?:san pablo|s[aã]o paulo)\b/i, "São Paulo"],
  [/\br[ií]o de janeiro\b/i, "Río de Janeiro"],
];
const LODGING = /\b(?:hotel(?:es)?|alojamiento|hospedaje|habitaci[oó]n(?:es)?|pousadas?|hostel)\b/i;
const OTHER_TOPIC = /\b(?:comer|restaurantes?|almorzar|cenar|actividades?|playas?|precauciones|checklist|documentaci[oó]n|gastos?|deudas?|caipirinha|cotizaci[oó]n|convertir|resumen|opini[oó]n|plantilla)\b/i;
const EXPLICIT_LODGING = /(?:busc(?:o|ar|ame)|quiero|necesito|compar(?:ar|[aá])|mostr(?:ame|[aá])|recomend(?:ame|[aá])|opciones?\s+de|cambiar)\b[^.!?\n]{0,70}\b(?:hotel(?:es)?|alojamiento|hospedaje|habitaci[oó]n(?:es)?|pousadas?|hostel)\b/i;
const NEW_TRIP = /\b(?:quiero|queremos|vamos a|necesito|organizar|armar|planear|planificar|empezar|organicemos|armemos)\s+(?:(?:organizar|armar|planear|planificar|empezar)\s+)?(?:(?:un|el)\s+)?(?:otro|nuevo)\s+viaje\b/i;
const KEEP_DATES = /\b(?:mismas fechas|conservar (?:las )?fechas|mantener (?:las )?fechas|manten[eé](?:mos)? (?:las )?fechas|sin cambiar (?:las )?fechas)\b/i;
const CHANGE_DATES = /\b(?:otras fechas|fechas diferentes|no\b[^.!?;\n]{0,25}(?:mismas fechas|mantener (?:las )?fechas|conservar (?:las )?fechas))\b/i;

function accommodationIntent(text: string) {
  if (!LODGING.test(text) && /\b(?:elegir (?:un |el )?destino|ideas? (?:de |para )?destinos?|qu[eé] destino|ad[oó]nde (?:ir|viajar)|destino (?:me |nos )?recomend[aá]s)\b/i.test(text)) return false;
  return EXPLICIT_LODGING.test(text) || NEW_TRIP.test(text) || (LODGING.test(text) && !OTHER_TOPIC.test(text)) ||
    (/\b(?:quiero|queremos|quisiera|me gustar[ií]a)\s+(?:viajar|ir)\s+a\s+/i.test(text) && Boolean(destinationFrom(text))) ||
    /\b(?:organizar|armar|planear|planificar)\s+(?:(?:un|mi|el|nuestro|otro)\s+)?viaje\b/i.test(text);
}

export function isAccommodationPlanningRequest(text: string) {
  return accommodationIntent(text);
}

export function isPostTripPhaseEntry(text: string) {
  const value = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  return /^(?:despues (?:de viajar|del viaje)|cerrar viaje|ya volvi)\s*[.!]?$/i.test(value);
}

export function isExplicitTripReport(text: string) {
  const kind = detectConversationPanel(text);
  if (!kind) return false;
  if (kind === "summary")
    return /resumen|cu[aá]nto|gastos del|gastos de mi|mis gastos|c[oó]mo|balance|me queda|gasto total/i.test(text);
  // A concrete new plan is distinct from asking for next-trip inspiration.
  if (kind === "next-trip") return !accommodationIntent(text);
  return true;
}

function normalizedDestination(value: string): string | undefined {
  const clean = value.trim().replace(/[,:]+$/, "").trim();
  if (clean.length < 2 || clean.length > 120 || /[<>\n\d]/.test(clean) ||
    /^(?:(?:un|alg[uú]n|cualquier|otro)\s+(?:destino|lugar|pa[ií]s|sitio)|la playa|la montaña|d[oó]nde)\b/i.test(clean) ||
    /^(?:s[ií]|no|dale|hola|gracias|no s[eé]|todav[ií]a no|cualquier(?: lugar| destino)?|alg[uú]n lugar|un lugar|cerca(?: de .*)?|ah[ií]|all[ií]|mi ubicaci[oó]n|donde sea|vos eleg[ií])$/i.test(clean)) return;
  return KNOWN_DESTINATIONS.find(([pattern]) => pattern.test(clean))?.[1] ?? clean;
}

function destinationFrom(text: string, allowPlain = false): string | undefined {
  const explicit = text.match(/(?:^|\n)\s*destino\s*:\s*([^\n;!?]+)/i)?.[1];
  const location = explicit ?? text.match(/\b(?:hotel(?:es)?|alojamiento|hospedaje|habitaci[oó]n(?:es)?|pousadas?|hostel)\b[^.!?\n]{0,45}?\ben\s+([^.!?;\n]+)/i)?.[1] ??
    text.match(/\b(?:viaje|viajar|viajamos|vamos|ir)\s+a\s+([^.!?;\n]+)/i)?.[1];
  if (location) {
    const place = location
      .split(/\s+(?:(?:del?|desde|entre|el)\s+\d|para\b|con\b|sin\b|por\b|hasta\b|presupuesto\b|pero\b|en\s+(?:otras fechas|enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\b)/i)[0];
    return normalizedDestination(place);
  }
  const known = KNOWN_DESTINATIONS.find(([pattern]) => pattern.test(text));
  if (known && (accommodationIntent(text) || allowPlain)) return known[1];
  if (allowPlain && /^[\p{L}\p{M}\s.'’,-]{2,100}$/u.test(text.trim()) &&
    !/\b(?:quiero|busco|necesito|viaje|hotel|adultos?|menor(?:es)?|presupuesto|d[oó]lares|pesos|reales|personas?|familia|amigos|pareja)\b/i.test(text))
    return normalizedDestination(text.replace(/^en\s+/i, ""));
}

function isoDate(year: number, month: number, day: number) {
  if (year < 2000 || year > 2199 || month < 1 || month > 12 || day < 1 || day > 31) return;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
function validIso(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match && isoDate(+match[1], +match[2], +match[3]) === value;
}

export function nightsOf(startDate: string, endDate: string): number | undefined {
  if (!validIso(startDate) || !validIso(endDate)) return;
  const nights = (Date.parse(endDate) - Date.parse(startDate)) / 864e5;
  return nights >= 1 && nights <= 365 ? nights : undefined;
}
export function formatRange(from: string, to: string) {
  const nights = nightsOf(from, to);
  if (!nights) return;
  const [ay, am, ad] = from.split("-").map(Number);
  const [by, bm, bd] = to.split("-").map(Number);
  const label = am === bm && ay === by
    ? `${ad} al ${bd} de ${MONTHS[bm - 1]} de ${by}`
    : `${ad} de ${MONTHS[am - 1]} de ${ay} al ${bd} de ${MONTHS[bm - 1]} de ${by}`;
  return { label, nights };
}

function dateRangeFrom(text: string): Pick<ParsedRequest, "startDate" | "endDate" | "nights" | "datesMentioned"> {
  const rawIso = text.match(/\b(\d{4}-\d{2}-\d{2})\s*(?:a|al|hasta|→|—|–)\s*(\d{4}-\d{2}-\d{2})\b/i);
  const numeric = text.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\s*(?:a|al|hasta|→|—|–)\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\b/i);
  const sameMonth = text.match(/\b(\d{1,2})\s*(?:al|a|hasta)\s*(\d{1,2})\s+de\s+([a-záéíóúñ]+)\s+(?:de\s+)?(\d{4})\b/i);
  const mixedMonths = text.match(/\b(\d{1,2})\s+de\s+([a-záéíóúñ]+)(?:\s+(?:de\s+)?(\d{4}))?\s*(?:al|a|hasta)\s*(\d{1,2})\s+de\s+([a-záéíóúñ]+)\s+(?:de\s+)?(\d{4})\b/i);
  let startDate: string | undefined, endDate: string | undefined;
  if (rawIso) [startDate, endDate] = [rawIso[1], rawIso[2]];
  else if (numeric) {
    startDate = isoDate(+numeric[3], +numeric[2], +numeric[1]);
    endDate = isoDate(+numeric[6], +numeric[5], +numeric[4]);
  } else if (sameMonth) {
    const month = MONTHS.indexOf(sameMonth[3].toLowerCase()) + 1;
    startDate = isoDate(+sameMonth[4], month, +sameMonth[1]);
    endDate = isoDate(+sameMonth[4], month, +sameMonth[2]);
  } else if (mixedMonths) {
    const startMonth = MONTHS.indexOf(mixedMonths[2].toLowerCase()) + 1;
    const endMonth = MONTHS.indexOf(mixedMonths[5].toLowerCase()) + 1;
    const endYear = +mixedMonths[6];
    // An omitted first year is unambiguous within the same calendar year.
    // Crossing New Year needs both years, rather than quietly inventing one.
    const startYear = mixedMonths[3] ? +mixedMonths[3] : startMonth <= endMonth ? endYear : undefined;
    if (startYear) startDate = isoDate(startYear, startMonth, +mixedMonths[1]);
    endDate = isoDate(endYear, endMonth, +mixedMonths[4]);
  }
  const datesMentioned = Boolean(rawIso || numeric || sameMonth || mixedMonths ||
    /\bfechas?\s*:|\b\d{1,2}\s*(?:al|a|hasta)\s*\d{1,2}\s+de\s|\b(?:del?|desde|entre)\s+\d{1,2}\s+de\s/i.test(text));
  const nights = startDate && endDate ? nightsOf(startDate, endDate) : undefined;
  return nights ? { startDate, endDate, nights, datesMentioned } : { datesMentioned };
}

function occupantsFrom(text: string): Pick<PlanningContext, "adults" | "children"> {
  const adults = text.match(/\b(\d{1,2})\s*adult[oa]s?\b/i)?.[1];
  const children = text.match(/\b(\d{1,2})\s*(?:menor(?:es)?|niñ[oa]s?|chic[oa]s?|hij[oa]s?)\b/i)?.[1];
  const ageQualifiedExclusion = /\b(?:sin|no (?:viajan|hay|viajamos con))\s+(?:menores|niños|niñas|chicos|hijos)\s+de\s+\d/i.test(text);
  const withoutChildren = !ageQualifiedExclusion && /\b(?:sin (?:menores|niños|niñas|chicos|hijos)|no (?:viajan|hay|viajamos con) (?:menores|niños|chicos)|todos (?:somos )?adultos|s[oó]lo adultos)\b/i.test(text);
  if (adults || children) {
    const result: Pick<PlanningContext, "adults" | "children"> = {};
    if (adults && +adults >= 1 && +adults <= 50) result.adults = +adults;
    if (children && +children <= 49) result.children = +children;
    else if (adults && (!/\b(?:menores|niñ[oa]s?|chic[oa]s?|hij[oa]s?)\b/i.test(text) || withoutChildren)) result.children = 0;
    if (withoutChildren) result.children = 0;
    return result;
  }
  if (/\b(?:viajo|voy) sol[oa]\b/i.test(text)) return { adults: 1, children: 0 };
  if (/\b(?:en|somos una) pareja\b/i.test(text) && !/\b(?:menores|niñ[oa]s?|chic[oa]s?|hij[oa]s?)\b/i.test(text)) return { adults: 2, children: 0 };
  if (withoutChildren) return { children: 0 };
  return {};
}

function agesFrom(text: string, allowPlain: boolean): string[] | undefined {
  const marked = text.match(/\b(?:edad(?:es)?|rangos? de edad)(?:\s+de\s+(?:los\s+)?menores)?\s*[:=]\s*([^\n);.]+)/i)?.[1] ??
    text.match(/\b(?:menor(?:es)?|niñ[oa]s?|chic[oa]s?|hij[oa]s?)\s+de\s+([^\n);.]+?)\s+años\b/i)?.[1];
  const value = marked ?? (allowPlain && /^(?:\d{1,2}(?:\s*[–-]\s*\d{1,2})?(?:\s*(?:,|y|\/)\s*)?)+(?:\s*años)?$/i.test(text.trim()) ? text.trim() : undefined);
  if (!value) return;
  const parts = value.match(/\d{1,2}(?:\s*[–-]\s*\d{1,2})?/g) ?? [];
  const ages = parts.flatMap((part) => {
    const range = part.split(/[–-]/).map((number) => +number.trim());
    if (range.some((age) => age < 0 || age > 17) || (range.length === 2 && range[0] > range[1])) return [];
    return [range.length === 2 ? `${range[0]}–${range[1]}` : String(range[0])];
  });
  return ages.length ? ages : undefined;
}

function parseAmount(raw: string): number | undefined {
  let value = raw.replace(/\s/g, "");
  if (!value) return;
  const lastComma = value.lastIndexOf(","), lastDot = value.lastIndexOf(".");
  const decimalAt = Math.max(lastComma, lastDot);
  if (decimalAt >= 0 && value.length - decimalAt - 1 <= 2) {
    value = value.slice(0, decimalAt).replace(/[.,]/g, "") + "." + value.slice(decimalAt + 1);
  } else value = value.replace(/[.,]/g, "");
  const number = Number(value);
  return Number.isFinite(number) && number > 0 && number <= 1e9 ? number : undefined;
}
function currencyFrom(text: string): string | undefined {
  const currencies = [
    [/\bUSD\b|US\$|U\$D|\bd[oó]lares(?: estadounidenses)?\b/i, "USD"],
    [/\bBRL\b|R\$|\breales\b/i, "BRL"],
    [/\bARS\b|\bpesos argentinos\b/i, "ARS"],
    [/\bEUR\b|€|\beuros\b/i, "EUR"],
    [/\bUYU\b|\bpesos uruguayos\b/i, "UYU"],
    [/\bCLP\b|\bpesos chilenos\b/i, "CLP"],
    [/\bMXN\b|\bpesos mexicanos\b/i, "MXN"],
  ] as const;
  const matches = currencies.filter(([pattern]) => pattern.test(text));
  return matches.length === 1 ? matches[0][1] : undefined;
}
function budgetFrom(text: string, allowFollowup: boolean): ParsedRequest {
  // A whole-trip allowance cannot quietly become a hotel allowance.
  if (/\b(?:todo el viaje|viaje completo|presupuesto(?: total)? (?:del|para el) viaje)\b/i.test(text) &&
    !/\b(?:para el hotel|para alojamiento|de alojamiento|de hotel|s[oó]lo (?:el )?hotel)\b/i.test(text)) return {};
  const isBudget = /\b(?:presupuesto|por noche|cada noche|la noche|alojamiento|hasta|en total|estad[ií]a|todo el grupo|por persona)\b|\/noche/i.test(text);
  if (!isBudget && !allowFollowup) return {};
  const currency = currencyFrom(text);
  const byCurrency = text.match(/(?:USD|US\$|U\$D|BRL|R\$|ARS|EUR|UYU|CLP|MXN|€)\s*([\d][\d.,]*(?:\s\d{3})*)/i)?.[1] ??
    text.match(/\b([\d][\d.,]*(?:\s\d{3})*)\s*(?:USD|BRL|ARS|EUR|UYU|CLP|MXN|d[oó]lares|reales|pesos(?: argentinos| uruguayos| chilenos| mexicanos)?|euros)\b/i)?.[1];
  const bare = /\b(?:presupuesto|hasta|total|noche)\b[^\d\n]{0,25}([\d][\d.,]*(?:\s\d{3})*)/i.exec(text)?.[1] ??
    (allowFollowup && /^\s*\$?\s*[\d][\d.,]*(?:\s\d{3})*\s*$/.test(text) ? text.replace(/\$/g, "").trim() : undefined);
  const budget = parseAmount(byCurrency ?? bare ?? "");
  const budgetScope = /(?:\b(?:por|la|cada)\s+noche\b|\/\s*noche\b)/i.test(text) ? "night" :
    /\b(?:total|toda (?:la )?estad[ií]a|estad[ií]a completa|todas las noches)\b/i.test(text) ? "total" : undefined;
  const budgetAudience = /\b(?:por persona|cada uno|por viajero)\b/i.test(text) ? "person" :
    /\b(?:todo el grupo|toda la familia|por habitaci[oó]n|habitaci[oó]n completa|para todos|para el grupo)\b/i.test(text) ? "group" : undefined;
  return {
    ...(currency ? { currency } : {}),
    ...(budget ? { budget } : {}),
    ...(budgetScope ? { budgetScope } : {}),
    ...(budgetAudience ? { budgetAudience } : {}),
    ...(isBudget && (currency || budget || budgetScope || budgetAudience) ? { accommodationBudget: true } : {}),
  };
}

export function parseHotelRequest(text: string): ParsedRequest {
  return {
    ...(destinationFrom(text) ? { destination: destinationFrom(text) } : {}),
    ...dateRangeFrom(text),
    ...occupantsFrom(text),
    ...(agesFrom(text, false) ? { ages: agesFrom(text, false) } : {}),
    ...budgetFrom(text, false),
  };
}

export function nextQuestion(context: PlanningContext): PlanningStep {
  if (!context.destination) return "destination";
  if (!context.startDate || !context.endDate || !nightsOf(context.startDate, context.endDate)) return "dates";
  if (!context.adults || context.children === undefined || context.adults + context.children > 50) return "travelers";
  if (context.children && (!context.ages?.length ||
    (!context.ages.some((age) => age.includes("–")) && context.ages.length < context.children))) return "ages";
  if (!context.budget || !context.currency || !context.budgetScope ||
    (context.budgetAudience !== "group" && context.adults + context.children > 1)) return "budget";
  return "ready";
}

/** Same ranges as the HTML, explicitly spending limits, never market-price estimates. */
export function budgetOptions(nights: number, currency = "ARS", caps: readonly number[] = [50000, 80000, 120000]) {
  if (!Number.isInteger(nights) || nights < 1 || nights > 365) return [];
  const format = (amount: number) => `${currency} ${amount.toLocaleString("es-AR", { maximumFractionDigits: 2 })}`;
  return caps.filter((cap) => Number.isFinite(cap) && cap > 0 && cap * nights <= 1e9).map((cap) => ({
    cap,
    currency,
    total: cap * nights,
    label: `Hasta ${format(cap)} por noche · ${format(cap * nights)} en total para el grupo`,
  }));
}

export function planningStepFor(messages: readonly HistoryMessage[], workspace: Workspace): PlanningResult | undefined {
  const users = messages.filter((message) => message.role === "user");
  const latest = users.at(-1)?.text ?? "";
  if (!users.some((message) => accommodationIntent(message.text))) return;
  if (OTHER_TOPIC.test(latest) && !EXPLICIT_LODGING.test(latest)) return;

  const context: PlanningContext = {};
  if (workspace.trip.destination.trim()) context.destination = workspace.trip.destination.trim();
  const savedNights = nightsOf(workspace.trip.startDate, workspace.trip.endDate);
  if (savedNights) Object.assign(context, {
    startDate: workspace.trip.startDate,
    endDate: workspace.trip.endDate,
    nights: savedNights,
  });
  // Initial travelers=1, currency=ARS and the overall trip budget are defaults,
  // not confirmations of hotel occupancy, hotel currency or accommodation cap.
  let active = false;
  for (const message of users) {
    if (isPostTripPhaseEntry(message.text)) {
      active = false;
      for (const key of Object.keys(context) as (keyof PlanningContext)[]) delete context[key];
      continue;
    }
    if (isExplicitTripReport(message.text)) {
      active = false;
      continue;
    }
    if (accommodationIntent(message.text)) active = true;
    if (!active) continue;
    const changeDates = CHANGE_DATES.test(message.text);
    const keepDates = KEEP_DATES.test(message.text) && !changeDates;
    if (NEW_TRIP.test(message.text)) {
      const retained = keepDates
        ? { startDate: context.startDate, endDate: context.endDate, nights: context.nights }
        : {};
      for (const key of Object.keys(context) as (keyof PlanningContext)[]) delete context[key];
      Object.assign(context, retained);
    }
    const stepBefore = nextQuestion(context);
    const parsed = parseHotelRequest(message.text);
    const destination = parsed.destination ?? destinationFrom(message.text, stepBefore === "destination");
    if (destination) {
      const comparable = (value: string) => (normalizedDestination(value) ?? value)
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      const changed = !context.destination || comparable(destination) !== comparable(context.destination);
      if (changed && !keepDates) {
        delete context.startDate;
        delete context.endDate;
        delete context.nights;
      }
      context.destination = destination;
    }
    if (parsed.datesMentioned || changeDates) {
      delete context.startDate;
      delete context.endDate;
      delete context.nights;
    }
    if (parsed.startDate && parsed.endDate && parsed.nights)
      Object.assign(context, { startDate: parsed.startDate, endDate: parsed.endDate, nights: parsed.nights });
    if (parsed.children !== undefined && parsed.children !== context.children) delete context.ages;
    if (parsed.adults !== undefined) context.adults = parsed.adults;
    if (parsed.children !== undefined) context.children = parsed.children;
    const ages = parsed.ages ?? agesFrom(message.text, stepBefore === "ages");
    if (ages) context.ages = ages;
    if (context.children === 0) delete context.ages;
    const budget = budgetFrom(message.text, stepBefore === "budget");
    for (const key of ["currency", "budget", "budgetScope", "budgetAudience"] as const) {
      if (budget[key] !== undefined) Object.assign(context, { [key]: budget[key] });
    }
  }
  return active ? { ...context, step: nextQuestion(context) } : undefined;
}
