import test from "node:test";
import assert from "node:assert/strict";
import { replyWithReferenceFlow } from "../lib/turi/conversation-flow";
import {
  emptyWorkspace,
  messageSchema,
  workspaceSchema,
  expenseSchema,
  type Workspace,
} from "../lib/turi/domain";
import { readConversationWidget, type ConversationWidget } from "../lib/turi/conversation-widgets";
import { executeTool } from "../lib/turi/agent";

type History = { role: "user" | "assistant"; text: string }[];
type Event = { type: string; [key: string]: unknown };
const users = (...texts: string[]): History => texts.map((text) => ({ role: "user", text }));
function run(history: History, state: Workspace = emptyWorkspace()) {
  const events: Event[] = [];
  const handled = replyWithReferenceFlow(history, state, (event) => events.push(event));
  const widgets = events.filter((event) => event.type === "widget").map((event) => {
    const widget = readConversationWidget(event.widget);
    assert.ok(widget, "every emitted widget must survive persistence validation");
    return widget;
  });
  return { handled, events, widgets, text: events.filter((event) => event.type === "delta").map((event) => String(event.text)).join("") };
}

test("phase entry emits a short answer and usable quick replies instead of demo records", () => {
  const before = run(users("Antes del viaje"));
  const after = run(users("Ya volví"));
  assert.equal(before.handled, true);
  assert.equal(after.handled, true);
  for (const result of [before, after]) {
    assert.equal(result.events.length, 2);
    assert.doesNotMatch(result.text, /Florianópolis|Lu, Marcos|300\.000|240/);
  }
  const beforeWidget = before.widgets[0];
  assert.equal(beforeWidget.type, "quick-replies");
  if (beforeWidget.type === "quick-replies") {
    assert.ok(beforeWidget.choices.length > 0 && beforeWidget.choices.length <= 6);
    assert.ok(beforeWidget.choices.every((choice) => choice.label && choice.text));
  }
  assert.deepEqual(after.widgets.map(widget => widget.type === "panel" ? widget.kind : widget.type), ["post-trip-overview"]);
});

const postTripReferenceScenarios = [
  ["Simular notificación del fin del viaje", "post-trip-notice"],
  ["Mostrame el resumen de gastos del viaje", "summary"],
  ["¿En qué días me pasé y qué aprendo para el próximo?", "daily"],
  ["¿Cómo quedaron las cuentas con el grupo?", "group"],
  ["¿Qué hago con los reales que me sobraron?", "leftover"],
  ["¿Me cobraron de más en algún lado?", "price-review"],
  ["Armame un resumen para compartir con el grupo", "recap"],
  ["Guardá este viaje para el próximo", "template"],
  ["Quiero dejar mi opinión del viaje", "feedback"],
  ["¿Adónde puedo ir la próxima vez?", "next-trip"],
] as const;
test("the ten posttrip HTML scenarios take priority over incomplete or completed hotel history", () => {
  const incomplete = "Busco hotel en Lisboa";
  const complete = "Busco hotel en Lisboa del 5 al 10 de enero de 2027 para 2 adultos. Presupuesto total de USD 1500 para todo el grupo.";
  for (const previous of [incomplete, complete]) {
    for (const includePhase of [false, true]) {
      for (const [question, expected] of postTripReferenceScenarios) {
        const result = run(users(previous, ...(includePhase ? ["Ya volví"] : []), question));
        assert.equal(result.handled, true, `${previous} → ${question}`);
        assert.deepEqual(result.widgets.map(widget => widget.type === "panel" ? widget.kind : widget.type), [expected], question);
        assert.equal(result.widgets.some(widget => widget.type === "planning"), false, "closing never opens a hotel date picker");
      }
    }
  }
});

test("a short followup after returning does not reactivate an old hotel flow", () => {
  for (const followup of ["Sí", "240 reales", "Pasar a dólares", "No, gracias"]) {
    const result = run(users("Busco hotel en Lisboa", "Ya volví", "¿Qué hago con los reales que me sobraron?", followup));
    assert.equal(result.handled, false, followup);
    assert.deepEqual(result.events, [], "the agent must interpret the followup in the closing context");
  }
});

test("short reference-HTML action labels continue the previous task instead of opening an unrelated panel", () => {
  const stories = [
    ["¿Qué hago con los reales que me sobraron?", "Guardar para el próximo viaje"],
    ["¿Qué hago con los reales que me sobraron?", "Guardarlos para el próximo viaje"],
    ["Guardá este viaje para el próximo", "Reutilizar viaje a Lisboa"],
  ];
  for (const [initial, action] of stories) {
    const result = run(users("Busco hotel en Lisboa", "Ya volví", initial, action));
    assert.equal(result.handled, false, action);
    assert.deepEqual(result.events, [], "the agent needs to continue keeping the currency or preparing the new plan");
  }
});

test("a real new plan after closing requests fresh dates rather than showing next-trip inspiration", () => {
  const state = emptyWorkspace();
  state.trip = { ...state.trip, destination: "Roma", startDate: "2026-01-05", endDate: "2026-01-10" };
  const result = run(users("Busco hotel en Roma", "Ya volví", "Quiero organizar otro viaje a Lisboa"), state);
  assert.equal(result.handled, true);
  assert.equal(result.widgets[0].type, "planning");
  if (result.widgets[0].type === "planning") {
    assert.equal(result.widgets[0].context.destination, "Lisboa");
    assert.equal(result.widgets[0].context.step, "dates");
    assert.equal(result.widgets[0].context.startDate, undefined);
  }
});

test("the hotel conversation advances through each missing form, then hands off for real search", () => {
  const story = [
    "Quiero buscar un hotel",
    "Destino: Lisboa",
    "Fechas: 2027-01-05 a 2027-01-10",
    "Viajeros: 2 adultos y 1 menor",
    "Edades: 7",
    "Alojamiento: presupuesto total de USD 1500 para todo el grupo",
  ];
  const expected = ["destination", "dates", "travelers", "ages", "budget"];
  for (let index = 0; index < expected.length; index++) {
    const result = run(users(...story.slice(0, index + 1)));
    assert.equal(result.handled, true);
    assert.equal(result.widgets.length, 1);
    const widget = result.widgets[0];
    assert.equal(widget.type, "planning");
    if (widget.type === "planning") assert.equal(widget.context.step, expected[index]);
  }
  const ready = run(users(...story));
  assert.equal(ready.handled, false, "a complete plan needs provider search, not another deterministic form");
  assert.deepEqual(ready.events, []);
});

test("explicit reports emit typed panels and keep the original trip unchanged", () => {
  const state = emptyWorkspace();
  state.expenses = [expenseSchema.parse({ id: "1", description: "Cena", amount: 15, homeAmount: 15, currency: "ARS", date: "2027-01-05", category: "Comida" })];
  const saved = JSON.stringify(state);
  const cases = [
    ["Mostrame el resumen de gastos del viaje", "summary"],
    ["Mostrame los gastos día por día", "daily"],
    ["¿Cómo quedaron las cuentas con el grupo?", "group"],
    ["Armame un resumen para compartir", "recap"],
    ["Checklist antes de viajar", "checklist"],
    ["Guardar este viaje como plantilla", "template"],
    ["Quiero dejar mi opinión del viaje", "feedback"],
    ["¿Qué hago con los reales que me sobraron?", "leftover"],
    ["¿Me cobraron de más?", "price-review"],
    ["¿Adónde puedo ir la próxima?", "next-trip"],
  ] as const;
  for (const [text, expected] of cases) {
    const result = run(users(text), state);
    assert.equal(result.handled, true, text);
    assert.deepEqual(result.widgets.map((widget) => widget.type === "panel" ? widget.kind : widget.type), [expected], text);
  }
  assert.equal(JSON.stringify(state), saved);
});

test("numeric expense entries and budget edits remain in the reviewed agent flow", () => {
  for (const text of [
    "Gasté 100 BRL en comida", "Anotá un gasto de USD 20 por taxi",
    "Registrá mis gastos del hotel: USD 100", "Mi presupuesto es USD 1500",
  ]) {
    const result = run(users(text));
    assert.equal(result.handled, false, text);
    assert.deepEqual(result.events, []);
  }
});

test("changing the hotel budget reopens only that control after a complete search plan", () => {
  const result = run(users(
    "Busco hotel en Lisboa del 5 al 10 de enero de 2027 para 2 adultos. Presupuesto total de USD 1500 para todo el grupo.",
    "Quiero cambiar el presupuesto del alojamiento. Mostrame las opciones de presupuesto otra vez.",
  ));
  assert.equal(result.handled, true);
  assert.equal(result.widgets.length, 1);
  const widget = result.widgets[0];
  assert.equal(widget.type, "planning");
  if (widget.type === "planning") {
    assert.equal(widget.context.step, "budget");
    assert.equal(widget.context.destination, "Lisboa");
    assert.equal(widget.context.nights, 5);
    assert.equal(widget.context.adults, 2);
  }
});

test("a combined closing request shows the report and the group accounts", () => {
  const result = run(users("Mostrame el resumen de gastos del viaje y las cuentas pendientes con el grupo."));
  assert.equal(result.handled, true);
  assert.deepEqual(result.widgets.map((widget) => widget.type === "panel" ? widget.kind : widget.type), ["summary", "group"]);
});

for (const text of [
  "Anotá en mis gastos cincuenta reales para el almuerzo",
  "Registrá 50 BRL en mis gastos y decime cuánto gasté en el viaje",
  "Gasté cincuenta reales en comida",
  "Quiero anotar cincuenta reales en mis gastos",
  "Anotame 50 BRL y decime cuánto gasté en el viaje",
]) test(`expense intent is never discarded for a report: ${text}`, () => {
  for (const history of [[], ["Busco hotel en Lisboa", "Ya volví"]]) {
    const result = run(users(...history, text));
    assert.equal(result.handled, false, "the agent must prepare the new expense before showing updated totals");
    assert.deepEqual(result.events, []);
  }
});

for (const text of [
  "Me quedo con Novotel Florianópolis. ¿Incluye desayuno?",
  "Ya elegí el hotel Majestic Palace. Ayudame a revisar su cancelación",
  "Me interesa Novotel Florianópolis, en Beira-Mar. Fuente: https://all.accor.com/hotel/5947/index.pt-br.shtml. Ayudame a evaluar si encaja con mi viaje y qué falta confirmar antes de decidir.",
]) test(`a selected hotel question reaches the agent instead of restarting dates: ${text}`, () => {
  const result = run(users("Busco hotel en Florianópolis", text));
  assert.equal(result.handled, false);
  assert.deepEqual(result.events, []);
});

const followups = [
  ["Checklist antes de viajar", "Ayudame a revisar los pendientes de mi checklist antes de viajar. No marques nada como listo sin que yo lo confirme."],
  ["Guardar este viaje como plantilla", "Quiero reutilizar como referencia el viaje a Lisboa. Elegí conservar: Itinerario por días. Ayudame a definir nuevas fechas, destino y presupuesto antes de crear otro itinerario."],
  ["¿Qué hago con los reales que me sobraron?", "Informo que me sobraron BRL 240 del viaje. Quiero evaluar convertirlos a ARS. Consultá una cotización actual con fuente y fecha, separá referencia de mercado de una cotización ejecutable de Belo y mostrame qué costos habría que confirmar. Todavía no operes ni asumas mi saldo."],
  ["¿Adónde puedo ir la próxima?", "Me interesa planificar mi próximo viaje a Río de Janeiro. Buscá opciones actuales con fotos, pros y contras; primero confirmá conmigo fechas, viajeros y presupuesto. Usá mi historial sólo como referencia orientativa, sin trasladar sus precios al nuevo destino."],
] as const;
for (const [initial, followup] of followups) test(`panel action continues the conversation instead of opening itself again: ${initial}`, () => {
  assert.equal(run(users(initial)).handled, true);
  const result = run([
    { role: "user", text: initial },
    { role: "assistant", text: "Revisemos las opciones del panel." },
    { role: "user", text: followup },
  ]);
  assert.equal(result.handled, false, "an actionable follow-up needs a real response/tool, not the same panel");
  assert.deepEqual(result.events, []);
});

test("widgets, ratings, consent and checked items survive the same schema round trip as local/cloud persistence", () => {
  const state = emptyWorkspace();
  state.assistantPreferences = {
    checklist: { "pretrip:documents": true, "template:itinerary": false },
    ratings: { "Mi hotel real": 4 }, anonymousPriceConsent: false,
  };
  const widgets: ConversationWidget[] = [
    { id: "planning-1", type: "planning", context: { step: "dates", destination: "Lisboa" } },
    { id: "panel-1", type: "panel", kind: "feedback" },
    { id: "quick-1", type: "quick-replies", choices: [{ label: "Ver gastos", text: "Mostrame mis gastos" }] },
  ];
  const message = messageSchema.parse({ id: "turn-1", role: "assistant", text: "", widgets });
  const restored = JSON.parse(JSON.stringify({ state, message }));
  assert.deepEqual(workspaceSchema.parse(restored.state).assistantPreferences, state.assistantPreferences);
  assert.deepEqual(messageSchema.parse(restored.message).widgets, widgets);
  const legacy = { ...state, assistantPreferences: undefined };
  assert.deepEqual(workspaceSchema.parse(legacy).assistantPreferences, { checklist: {}, ratings: {}, anonymousPriceConsent: false });
});

test("backend panel tools emit validated widgets and actual data without calling a provider", async () => {
  const state = emptyWorkspace();
  state.expenses = [expenseSchema.parse({ id: "1", description: "Cena", amount: 15, homeAmount: 15, currency: "ARS", date: "2027-01-05", category: "Comida" })];
  const events: Event[] = [];
  const result = await executeTool("test-local", "show_trip_panel", { kind: "summary" }, state, (event) => events.push(event));
  assert.equal((result as { status: string }).status, "shown_in_chat");
  assert.equal((result as { data: { total: number } }).data.total, 15);
  assert.equal(readConversationWidget(events[0].widget)?.type, "panel");
  events.length = 0;
  const context = { step: "dates", destination: "Lisboa" };
  const planning = await executeTool("test-local", "show_planning_step", context, state, (event) => events.push(event));
  assert.equal((planning as { status: string }).status, "awaiting_user_input");
  assert.equal(readConversationWidget(events[0].widget)?.type, "planning");
  events.length = 0;
  const ready = await executeTool("test-local", "show_planning_step", { step: "ready" }, state, (event) => events.push(event));
  assert.equal((ready as { status: string }).status, "ready_for_search");
  assert.deepEqual(events, [], "ready must continue searching without an invisible input control");
  state.assistantPreferences.checklist["pretrip:documents"] = true;
  const checklist = await executeTool("test-local", "show_trip_panel", { kind: "checklist" }, state, () => {}) as { data: { items: { id: string; checked: boolean }[] } };
  assert.equal(checklist.data.items.length, 8, "voice gets the same pre-trip checklist as the chat");
  assert.equal(checklist.data.items.find(item => item.id === "documents")?.checked, true);
  assert.equal(checklist.data.items.some(item => item.id === "itinerary"), false, "template selection is a different panel");
  await assert.rejects(executeTool("test-local", "show_trip_panel", { kind: "made-up" }, state, () => {}));
});
