import test from "node:test";
import assert from "node:assert/strict";
import { emptyWorkspace } from "../lib/turi/domain";
import {
  budgetOptions,
  formatRange,
  nightsOf,
  parseHotelRequest,
  planningStepFor,
} from "../lib/turi/planning-flow";

const users = (...texts: string[]) => texts.map((text) => ({ role: "user" as const, text }));
const ready = [
  "Quiero un hotel en Lisboa",
  "Fechas: 2027-01-05 a 2027-01-10",
  "Viajeros: 2 adultos y 1 menor (edad: 7)",
  "Alojamiento: presupuesto total de USD 1500 para todo el grupo",
];

test("el flujo del HTML avanza un dato a la vez y acepta una ciudad fuera de las demos", () => {
  const workspace = emptyWorkspace();
  assert.equal(planningStepFor(users("Busco alojamiento"), workspace)?.step, "destination");
  assert.equal(planningStepFor(users("Busco alojamiento", "Lisboa"), workspace)?.step, "dates");
  assert.equal(planningStepFor(users(...ready.slice(0, 2)), workspace)?.step, "travelers");
  assert.equal(planningStepFor(users(...ready.slice(0, 3)), workspace)?.step, "budget");
  const result = planningStepFor(users(...ready), workspace);
  assert.equal(result?.step, "ready");
  assert.equal(result?.destination, "Lisboa");
  assert.equal(result?.nights, 5);
  assert.equal(result?.adults, 2);
  assert.equal(result?.children, 1);
  assert.deepEqual(result?.ages, ["7"]);
  assert.equal(result?.budget, 1500);
  assert.equal(result?.currency, "USD");
  assert.equal(result?.budgetScope, "total");
});

test("un mensaje completo habilita buscar sin repetir el cuestionario", () => {
  const result = planningStepFor(users("Busco un hotel en Mar del Plata del 5 al 10 de enero de 2027 para 2 adultos. Presupuesto de ARS 80.000 por noche para todo el grupo."), emptyWorkspace());
  assert.equal(result?.step, "ready");
  assert.equal(result?.destination, "Mar del Plata");
  assert.equal(result?.budget, 80000);
  assert.equal(result?.budgetScope, "night");
  assert.equal(result?.children, 0);
});

test("destinos del HTML se normalizan sin asumir Florianópolis si falta el dato", () => {
  assert.equal(parseHotelRequest("Hotel en Floripa con pileta").destination, "Florianópolis");
  assert.equal(parseHotelRequest("Busco hotel en San Pablo para 2 adultos").destination, "São Paulo");
  assert.equal(parseHotelRequest("Hotel en Río de Janeiro").destination, "Río de Janeiro");
  assert.equal(planningStepFor(users("Busco hotel con pileta"), emptyWorkspace())?.step, "destination");
});

test("no procesa recomendaciones de comida ni conversaciones ajenas como hotel", () => {
  assert.equal(planningStepFor(users("¿Cuánto está el real?"), emptyWorkspace()), undefined);
  assert.equal(planningStepFor(users(...ready, "¿Dónde puedo comer cerca del hotel?"), emptyWorkspace()), undefined);
  assert.equal(planningStepFor(users(...ready, "Armame un checklist antes de viajar"), emptyWorkspace()), undefined);
  assert.equal(planningStepFor(users("Organizar mi viaje", "Destino: Kioto"), emptyWorkspace())?.destination, "Kioto");
});

test("viajar a un destino concreto abre fechas; elegir ideas todavía pasa al agente", () => {
  assert.equal(planningStepFor(users("Quiero viajar a Lisboa"), emptyWorkspace())?.step, "dates");
  assert.equal(planningStepFor(users("Quiero viajar a Florianópolis del 5 al 10 de enero de 2027"), emptyWorkspace())?.step, "travelers");
  assert.equal(planningStepFor(users("Quiero viajar"), emptyWorkspace()), undefined);
  assert.equal(planningStepFor(users("Quiero viajar a algún lugar barato"), emptyWorkspace()), undefined);
  assert.equal(planningStepFor(users("Quiero organizar un viaje. Ayudame a elegir destino"), emptyWorkspace()), undefined);
});

test("fechas sin año o imposibles siguen en fechas, sin inventar el año", () => {
  for (const text of [
    "Quiero hotel en Roma del 5 al 10 de enero",
    "Quiero hotel en Roma del 30 al 31 de febrero de 2027",
    "Quiero hotel en Roma. Fechas: 2027-01-10 a 2027-01-05",
    "Quiero hotel en Roma. Fechas: 2027-02-29 a 2027-03-02",
  ]) assert.equal(planningStepFor(users(text), emptyWorkspace())?.step, "dates");
});

test("cuenta noches al cruzar meses, años y el horario de verano", () => {
  assert.equal(nightsOf("2027-01-30", "2027-02-02"), 3);
  assert.equal(nightsOf("2027-12-30", "2028-01-05"), 6);
  assert.equal(nightsOf("2027-03-13", "2027-03-15"), 2);
  assert.equal(nightsOf("2027-01-05", "2027-01-05"), undefined);
  assert.deepEqual(formatRange("2027-12-30", "2028-01-05"), {
    label: "30 de diciembre de 2027 al 5 de enero de 2028", nights: 6,
  });
  assert.equal(parseHotelRequest("del 30 de diciembre de 2027 al 5 de enero de 2028").nights, 6);
  assert.equal(parseHotelRequest("del 30 de diciembre al 5 de enero de 2028").nights, undefined);
  assert.equal(parseHotelRequest("del 30 de enero al 2 de febrero de 2027").nights, 3);
  assert.equal(parseHotelRequest("Fechas: 05/01/2027 al 10/01/2027").nights, 5);
});

test("cambiar a fechas ambiguas no conserva silenciosamente las anteriores", () => {
  const result = planningStepFor(users(...ready, "Mejor del 10 al 15 de febrero"), emptyWorkspace());
  assert.equal(result?.step, "dates");
  assert.equal(result?.startDate, undefined);
  assert.equal(result?.budget, 1500);
});

test("los valores iniciales y presupuesto global del formulario no confirman el hotel", () => {
  const workspace = emptyWorkspace();
  workspace.trip = { ...workspace.trip, destination: "Roma", startDate: "2027-01-05", endDate: "2027-01-10", travelers: 4, budget: 1500, currency: "USD" };
  const result = planningStepFor(users("Quiero un hotel"), workspace);
  assert.equal(result?.step, "travelers");
  assert.equal(result?.nights, 5);
  assert.equal(result?.budget, undefined);
  assert.equal(result?.adults, undefined);
  assert.equal(result?.currency, undefined);
});

test("cambiar de destino no hereda fechas del viaje guardado sin confirmación", () => {
  const workspace = emptyWorkspace();
  workspace.trip = { ...workspace.trip, destination: "Roma", startDate: "2027-01-05", endDate: "2027-01-10" };
  const changed = planningStepFor(users("Quiero un hotel en Lisboa"), workspace);
  assert.equal(changed?.destination, "Lisboa");
  assert.equal(changed?.step, "dates");
  assert.equal(changed?.startDate, undefined);
  assert.equal(changed?.endDate, undefined);
  assert.equal(changed?.nights, undefined);
  const same = planningStepFor(users("Quiero un hotel en Roma"), workspace);
  assert.equal(same?.step, "travelers");
  assert.equal(same?.nights, 5);
  const confirmed = planningStepFor(users("Quiero un hotel en Lisboa con las mismas fechas"), workspace);
  assert.equal(confirmed?.step, "travelers");
  assert.equal(confirmed?.startDate, "2027-01-05");
  const explicit = planningStepFor(users("Quiero un hotel en Lisboa del 3 al 8 de febrero de 2028"), workspace);
  assert.equal(explicit?.startDate, "2028-02-03");
  assert.equal(explicit?.nights, 5);
  const differentDates = planningStepFor(users("Quiero un hotel en Roma en otras fechas"), workspace);
  assert.equal(differentDates?.destination, "Roma");
  assert.equal(differentDates?.step, "dates");
  const negative = planningStepFor(users("Quiero un hotel en Lisboa pero no las mismas fechas"), workspace);
  assert.equal(negative?.step, "dates");
  assert.equal(negative?.startDate, undefined);
});

test("cambiar el destino de un flujo listo vuelve a pedir fechas", () => {
  const result = planningStepFor(users(...ready, "Destino: Madrid"), emptyWorkspace());
  assert.equal(result?.destination, "Madrid");
  assert.equal(result?.step, "dates");
  assert.equal(result?.startDate, undefined);
  const completed = planningStepFor(users(...ready, "Destino: Madrid", "Fechas: 2028-02-02 a 2028-02-08"), emptyWorkspace());
  assert.equal(completed?.step, "ready");
  assert.equal(completed?.nights, 6);
});

test("un nuevo viaje reinicia el contexto del anterior aunque repita el destino", () => {
  const workspace = emptyWorkspace();
  workspace.trip = { ...workspace.trip, destination: "Roma", startDate: "2027-01-05", endDate: "2027-01-10" };
  const fresh = planningStepFor(users("Quiero organizar otro viaje"), workspace);
  assert.equal(fresh?.step, "destination");
  assert.equal(fresh?.destination, undefined);
  assert.equal(fresh?.startDate, undefined);
  const repeated = planningStepFor(users(...ready, "Quiero un nuevo viaje a Lisboa"), workspace);
  assert.equal(repeated?.step, "dates");
  assert.equal(repeated?.destination, "Lisboa");
  assert.equal(repeated?.budget, undefined);
  assert.equal(repeated?.adults, undefined);
});

test("pedir cuántos son no permite convertir a todos en adultos", () => {
  const history = ready.slice(0, 2);
  assert.equal(planningStepFor(users(...history, "Somos 4"), emptyWorkspace())?.step, "travelers");
  assert.equal(planningStepFor(users(...history, "Viajeros: 2 adultos y 2 menores"), emptyWorkspace())?.step, "ages");
  assert.equal(planningStepFor(users(...history, "Viajo solo"), emptyWorkspace())?.step, "budget");
});

test("edades exactas y bandas del selector se conservan sin convertir bandas a edades", () => {
  const history = [...ready.slice(0, 2), "Viajeros: 2 adultos y 2 menores"];
  assert.equal(planningStepFor(users(...history, "7 años"), emptyWorkspace())?.step, "ages");
  const exact = planningStepFor(users(...history, "Edades: 7 y 10"), emptyWorkspace());
  assert.equal(exact?.step, "budget");
  assert.deepEqual(exact?.ages, ["7", "10"]);
  const bands = planningStepFor(users(...history, "Rangos de edad: 3–5, 6–9"), emptyWorkspace());
  assert.equal(bands?.step, "budget");
  assert.deepEqual(bands?.ages, ["3–5", "6–9"]);
  assert.equal(planningStepFor(users(...history, "Edades: 19"), emptyWorkspace())?.step, "ages");
});

test("cambiar la cantidad de menores invalida edades anteriores", () => {
  const result = planningStepFor(users(...ready, "Viajeros: 2 adultos y 2 menores"), emptyWorkspace());
  assert.equal(result?.step, "ages");
  assert.equal(result?.ages, undefined);
  assert.equal(planningStepFor(users(...ready, "Viajeros: 2 adultos sin menores"), emptyWorkspace())?.step, "ready");
});

test("el presupuesto necesita moneda, base por noche o total y alcance del grupo", () => {
  const history = ready.slice(0, 3);
  assert.equal(planningStepFor(users(...history, "Presupuesto: $1500 total para todo el grupo"), emptyWorkspace())?.step, "budget");
  assert.equal(planningStepFor(users(...history, "Presupuesto USD 1500 para todo el grupo"), emptyWorkspace())?.step, "budget");
  assert.equal(planningStepFor(users(...history, "Presupuesto total de USD 1500 por persona"), emptyWorkspace())?.step, "budget");
  const result = planningStepFor(users(...history, "Presupuesto: $1500 total para todo el grupo", "USD"), emptyWorkspace());
  assert.equal(result?.step, "ready");
  assert.equal(result?.currency, "USD");
});

test("el presupuesto completo del viaje no se toma como tope de hotel", () => {
  const result = planningStepFor(users(...ready.slice(0, 3), "Tengo un presupuesto total del viaje de USD 1500 para todo el grupo"), emptyWorkspace());
  assert.equal(result?.step, "budget");
  assert.equal(result?.budget, undefined);
  assert.equal(result?.currency, undefined);
  const rawTotal = planningStepFor(users(...ready.slice(0, 3), "US$ 1500 para todo el viaje"), emptyWorkspace());
  assert.equal(rawTotal?.budget, undefined);
});

test("no viajar con menores de cierta edad no se interpreta como ausencia de todos los menores", () => {
  const parsed = parseHotelRequest("Somos 2 adultos, no viajamos con menores de 10 años");
  assert.equal(parsed.children, undefined);
});

test("los presupuestos preservan monedas y decimales; no usan cotizaciones del demo", () => {
  assert.equal(parseHotelRequest("Alojamiento BRL 1.500,50 por noche para todo el grupo").budget, 1500.5);
  assert.equal(parseHotelRequest("Alojamiento USD 1,500.50 en total para todo el grupo").budget, 1500.5);
  assert.equal(parseHotelRequest("Alojamiento 1 500 euros en total para todo el grupo").currency, "EUR");
  const ranges = budgetOptions(5);
  assert.equal(ranges[0].cap, 50000);
  assert.equal(ranges[0].total, 250000);
  assert.match(ranges[0].label, /por noche.*en total para el grupo/);
  assert.equal(budgetOptions(0).length, 0);
});
