import { buildConversationPanels, detectConversationPanel } from "./conversation-panels";
import {
  planningStepFor,
  formatRange,
  isPostTripPhaseEntry,
  isExplicitTripReport,
} from "./planning-flow";
import type { Workspace } from "./domain";
import type { ConversationWidget } from "./conversation-widgets";

type Emit = (event: { type: string; [key: string]: unknown }) => void;

/** The two HTML demos chain short replies, controls and panels. This adapter
 * ports that interaction flow to the live chat, without their sample records. */
export function replyWithReferenceFlow(
  messages: { role: "user" | "assistant"; text: string }[],
  state: Workspace,
  emit: Emit,
): boolean {
  const latest = messages.filter((message) => message.role === "user").at(-1)?.text ?? "";
  const normalized = latest.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const widget = (data: Omit<Extract<ConversationWidget, { type: "panel" }>, "id"> | Omit<Extract<ConversationWidget, { type: "planning" }>, "id">) =>
    emit({ type: "widget", widget: { id: crypto.randomUUID(), ...data } });
  const text = (value: string) => emit({ type: "delta", text: value });
  // The demos route initial intents. Follow-up instructions from their buttons
  // need the agent (quote, review, new plan), rather than reopening that panel.
  if (/^\s*(?:por favor\s+)?(?:ayudame\b|informo\b|prepara\b|anota(?:me)?\b|registra(?:me)?\b|agrega(?:me)?\b|carga(?:me)?\b|marca\b|quiero\s+(?:revisar|reutilizar|evaluar|comparar|anotar|registrar|agregar|cargar)\b|me (?:interesa|quedo con)\b|ya (?:elegi|reserve|tengo)\b)/i.test(normalized)) return false;
  if (/^\s*(?:hoy\s+)?(?:(?:yo|me)\s+)?(?:gaste|pague)\b/i.test(normalized)) return false;
  if (/^\s*(?:reutiliz(?:a|ar|ame)\b|guardar (?:para )?(?:el )?proximo viaje\b|guardarlos? para (?:el )?proximo viaje\b)/i.test(normalized)) return false;
  if (/^antes (?:de viajar|del viaje)\s*[.!]?$/i.test(latest.trim()) || isPostTripPhaseEntry(latest)) {
    const before = /^antes/i.test(latest.trim());
    text(before ? "Armemos tu viaje. ¿Por dónde querés empezar?" : "¡Bienvenido de vuelta! Armemos el cierre de tu viaje. ¿Qué revisamos primero?");
    if (!before) {
      widget({ type: "panel", kind: "post-trip-overview" });
      return true;
    }
    const choices = [
      { label: "Buscar hotel", text: "Quiero organizar un viaje y buscar alojamiento" },
      { label: "Con quién viajo", text: "Quiero organizar el viaje con mi familia. Ayudame con los viajeros y las edades." },
      { label: "Dónde comer", text: "¿Dónde puedo comer cerca de mi alojamiento?" },
      { label: "Actividades y playas", text: "Recomendame actividades y playas para mi grupo" },
      { label: "Checklist", text: "Checklist antes de viajar" },
    ];
    emit({ type: "widget", widget: { id: crypto.randomUUID(), type: "quick-replies", choices } });
    return true;
  }
  // A closing report is a new conversation intent. Historic hotel questions
  // cannot capture it or reactivate a date picker after the user has returned.
  const report = isExplicitTripReport(latest);
  const collected = report ? undefined : planningStepFor(messages, state);
  const planning = collected && /cambiar (?:el )?presupuesto|cambiemos (?:el )?presupuesto/i.test(latest)
    ? { ...collected, step: "budget" as const } : collected;
  if (planning && planning.step !== "ready") {
    const dates = planning.startDate && planning.endDate ? formatRange(planning.startDate, planning.endDate) : undefined;
    const replies = {
      destination: "¿A dónde nos vamos? Elegí un destino o escribime el que tengas en mente.",
      dates: planning.datesToConfirm && dates
        ? `${planning.destination ? `${planning.destination}, anotado. ` : ""}¿Viajás del ${dates.label}? Son ${dates.nights} noches: confirmá las fechas o cambialas.`
        : `${planning.destination ? `${planning.destination}, anotado. ` : ""}¿Cuándo viajás? Elegí entrada y salida para contar bien las noches.`,
      travelers: `Perfecto${planning.destination ? `: ${planning.destination}` : ""}${dates ? `, ${dates.label} (${dates.nights} noches)` : ""}. ¿Para cuántas personas es la habitación?`,
      ages: "¿Qué edades tienen los chicos? Me sirve para la habitación y para recomendar actividades para todos.",
      budget: `¿Cuál es tu presupuesto aproximado para el hotel?${planning.nights ? ` Son ${planning.nights} noches: podés elegir un tope por noche o por toda la estadía.` : ""} Indicá la moneda y el monto para todo el grupo.`,
    };
    text(replies[planning.step]);
    widget({ type: "planning", context: planning });
    return true;
  }
  if (planning) return false;
  // Amounts newly spent or an unqualified budget belong to the agent's reviewed
  // expense/setup flow, rather than being mistaken for a request for a report.
  if (/\d/.test(latest) && /gast[eé]|pagu[eé]|anot|registr|agreg|presupuesto/i.test(latest) &&
    !/resumen|d[ií]a por d[ií]a|cu[aá]nto|cuentas pendientes/i.test(latest)) return false;
  const kind = detectConversationPanel(latest);
  if (!kind) return false;
  if (kind === "summary" && !/resumen|cu[aá]nto|gastos del|gastos de mi|mis gastos|c[oó]mo|balance|me queda|gasto total/i.test(latest)) return false;
  if (/plantilla|reutiliz|guardar (?:este |el |mi )?viaje|guard[aá] (?:este |el |mi )?viaje/i.test(latest)) {
    text("¿Qué querés conservar para el próximo viaje? Elegí los datos y guardá tu plantilla.");
    emit({ type: "widget", widget: { id: crypto.randomUUID(), type: "panel", kind: "template" } });
    return true;
  }
  const panels = buildConversationPanels(state);
  const replies = {
    summary: panels.summary.expenseCount
      ? "Así quedó el viaje con los gastos que registraste. ¿Querés ver día por día dónde se fue la plata?"
      : "Todavía no hay gastos registrados. A medida que los agregues, acá vas a ver el total, las categorías y cómo venís con el presupuesto.",
    daily: "Miremos los días y qué podemos aprender para el próximo viaje.",
    group: "Así quedaron las cuentas del grupo. Cada uno regulariza lo suyo desde su propia cuenta.",
    recap: "Te preparé una vista previa para compartir. Incluye sólo los gastos comunes del grupo.",
    checklist: "Antes de salir, repasemos lo importante. Marcá lo que ya tengas listo.",
    "post-trip-notice": "Podemos revisar lo que quedó pendiente del viaje. Los avisos dependen del canal y los permisos que actives.",
    leftover: "Podés convertir lo que te sobró, guardarlo para otro viaje o dejarlo en la misma moneda. ¿Cuánto te quedó y qué preferís hacer?",
    "price-review": "Podemos revisar tus comprobantes y compararlos con referencias de la zona. Elegí un gasto: un importe alto, por sí solo, no confirma un cobro indebido.",
    feedback: "¿Cómo estuvo cada lugar? Tu opinión queda guardada para tu próximo viaje.",
    "next-trip": "Tomemos lo que aprendimos de este viaje para armar el próximo. ¿Buscás playa, ciudad o naturaleza?",
  };
  text(replies[kind]);
  if (kind === "group" && /resumen/i.test(latest)) widget({ type: "panel", kind: "summary" });
  widget({ type: "panel", kind });
  return true;
}
