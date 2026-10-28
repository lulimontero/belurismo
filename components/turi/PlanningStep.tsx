"use client";

import { useId, useState, type FormEvent } from "react";
import {
  budgetOptions,
  formatRange,
  type PlanningResult,
} from "@/lib/turi/planning-flow";
import "./planning-step.css";

type Props = {
  context: PlanningResult;
  disabled?: boolean;
  onSend: (text: string) => void;
};
const destinations = ["Florianópolis", "São Paulo", "Río de Janeiro"];
const ageBands = ["0–2", "3–5", "6–9", "10–17"];
const currencies = ["ARS", "USD", "BRL", "EUR", "UYU", "CLP", "MXN"];
const spendingCaps: Record<string, number[]> = {
  ARS: [50000, 80000, 120000],
  USD: [50, 100, 150],
  BRL: [200, 350, 500],
  EUR: [50, 100, 150],
  UYU: [2000, 3500, 5000],
  CLP: [50000, 80000, 120000],
  MXN: [1000, 1800, 2500],
};
const titles = {
  destination: "Tu destino",
  dates: "Fechas del viaje",
  travelers: "Quiénes viajan",
  ages: "Edades de los menores",
  budget: "Presupuesto de alojamiento",
  ready: "",
};
function money(amount: number, currency: string) {
  return `${currency} ${amount.toLocaleString("es-AR", { maximumFractionDigits: 2 })}`;
}
function localToday() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

// The HTML uses small, single-use controls directly inside each chat bubble.
// Remounting when the context changes starts the next step with clean form state.
export default function PlanningStep(props: Props) {
  if (props.context.step === "ready") return null;
  return <PlanningStepForm key={JSON.stringify(props.context)} {...props} />;
}

function PlanningStepForm({ context, disabled = false, onSend }: Props) {
  const id = useId();
  const [sent, setSent] = useState(false), [error, setError] = useState("");
  const [destination, setDestination] = useState(context.destination ?? "");
  const [from, setFrom] = useState(context.startDate ?? ""),
    [to, setTo] = useState(context.endDate ?? "");
  const [adults, setAdults] = useState(String(context.adults ?? 2)),
    [children, setChildren] = useState(String(context.children ?? 0));
  const [ages, setAges] = useState(() => Array.from(
    { length: Math.min(49, Math.max(1, context.children ?? 1)) },
    (_, index) => context.ages?.[index] ?? "",
  ));
  const [currency, setCurrency] = useState(context.currency ?? "ARS");
  const [basis, setBasis] = useState<"night" | "total">(context.budgetScope ?? "night");
  const [amount, setAmount] = useState(
    context.budget && context.budgetAudience !== "person" ? String(context.budget) : "",
  );
  const locked = disabled || sent;
  const totalPeople = Number(adults) + Number(children);
  const dates = from && to ? formatRange(from, to) : undefined;
  const tomorrow = from && /^\d{4}-\d{2}-\d{2}$/.test(from)
    ? new Date(Date.parse(from) + 864e5).toISOString().slice(0, 10)
    : undefined;
  const nights = context.nights;
  const numericAmount = Number(amount);
  const totalBudget = nights && numericAmount > 0
    ? basis === "night" ? numericAmount * nights : numericAmount
    : undefined;

  function send(text: string) {
    if (locked) return;
    setError("");
    setSent(true);
    try { onSend(text); }
    catch { setSent(false); setError("No pude enviar ese dato. Probá de nuevo."); }
  }
  function submitDestination(event: FormEvent) {
    event.preventDefault();
    const value = destination.trim();
    if (value.length < 2 || value.length > 120) {
      setError("Escribí el nombre de una ciudad o destino.");
      return;
    }
    send(`Destino: ${value}`);
  }
  function submitDates(event: FormEvent) {
    event.preventDefault();
    if (!dates) {
      setError("Elegí ida y vuelta; la vuelta tiene que ser posterior a la ida y hasta un año después.");
      return;
    }
    send(`Fechas: ${from} a ${to}`);
  }
  function submitTravelers(event: FormEvent) {
    event.preventDefault();
    const adultCount = Number(adults), childCount = Number(children);
    if (!Number.isInteger(adultCount) || adultCount < 1 ||
      !Number.isInteger(childCount) || childCount < 0 || totalPeople > 50) {
      setError("Indicá al menos un adulto y hasta 50 viajeros en total.");
      return;
    }
    send(`Viajeros: ${adultCount} ${adultCount === 1 ? "adulto" : "adultos"} y ${childCount} ${childCount === 1 ? "menor" : "menores"}`);
  }
  function submitAges(event: FormEvent) {
    event.preventDefault();
    if (ages.some((age) => !age ||
      (!ageBands.includes(age) && (!/^\d{1,2}$/.test(age) || +age > 17)))) {
      setError("Completá la edad o elegí un rango para cada menor.");
      return;
    }
    send(`Edades: ${ages.join(", ")}`);
  }
  function submitBudget(value: number, scope = basis) {
    if (!Number.isFinite(value) || value <= 0 || value > 1e9 ||
      (scope === "night" && nights && value * nights > 1e9)) {
      setError("Indicá un presupuesto mayor a cero para todo el grupo.");
      return;
    }
    send(`Alojamiento: presupuesto ${scope === "total" ? "total de" : "por noche de"} ${currency} ${value} para todo el grupo`);
  }
  function changeAge(index: number, value: string) {
    setAges((previous) => previous.map((age, position) => position === index ? value : age));
  }

  return (
    <section className={`turi-planning-step step-${context.step}${sent ? " is-consumed" : ""}`} aria-labelledby={`${id}-title`}>
      <div className="turi-planning-heading">
        <h4 id={`${id}-title`}>{titles[context.step]}</h4>
        {sent && <span className="turi-planning-selected" role="status">Elegido</span>}
      </div>
      {context.step === "destination" && (
        <>
          <div className="turi-planning-chips" role="group" aria-label="Destinos sugeridos">
            {destinations.map((place) => <button key={place} type="button" disabled={locked} onClick={() => send(`Destino: ${place}`)}>{place}</button>)}
          </div>
          <form onSubmit={submitDestination} className="turi-planning-inline">
            <label className="turi-planning-field">
              <span>O elegí otro destino</span>
              <input value={destination} onChange={(event) => setDestination(event.target.value)} placeholder="Ciudad o destino" maxLength={120} required disabled={locked} autoComplete="off" aria-describedby={error ? `${id}-error` : undefined} />
            </label>
            <button className="turi-planning-confirm" disabled={locked} type="submit">Continuar</button>
          </form>
        </>
      )}
      {context.step === "dates" && (
        <form onSubmit={submitDates}>
          <div className="turi-planning-columns">
            <label className="turi-planning-field"><span>Ida / entrada</span><input type="date" value={from} min={localToday()} onChange={(event) => { setFrom(event.target.value); setError(""); }} required disabled={locked} /></label>
            <label className="turi-planning-field"><span>Vuelta / salida</span><input type="date" value={to} min={tomorrow ?? localToday()} onChange={(event) => { setTo(event.target.value); setError(""); }} required disabled={locked} /></label>
          </div>
          {dates && <p className="turi-planning-note">{dates.label} · <strong>{dates.nights} {dates.nights === 1 ? "noche" : "noches"}</strong></p>}
          <button className="turi-planning-confirm" type="submit" disabled={locked}>Confirmar fechas</button>
        </form>
      )}
      {context.step === "travelers" && (
        <form onSubmit={submitTravelers}>
          <div className="turi-planning-chips" role="group" aria-label="Cantidad de viajeros">
            {[1, 2, 3, 4, 5].map((count) => <button key={count} type="button" aria-pressed={count === 5 ? totalPeople >= 5 : totalPeople === count} disabled={locked} onClick={() => { setAdults(String(Math.max(1, count - Number(children)))); if (Number(children) >= count) setChildren(String(count - 1)); }}>{count === 5 ? "5 o más" : count}</button>)}
          </div>
          <div className="turi-planning-columns">
            <label className="turi-planning-field"><span>Adultos (18 o más)</span><input type="number" inputMode="numeric" min={1} max={50} step={1} required disabled={locked} value={adults} onChange={(event) => setAdults(event.target.value)} /></label>
            <label className="turi-planning-field"><span>Menores de 18</span><input type="number" inputMode="numeric" min={0} max={49} step={1} required disabled={locked} value={children} onChange={(event) => setChildren(event.target.value)} /></label>
          </div>
          <p className="turi-planning-note">{totalPeople} {totalPeople === 1 ? "persona" : "personas"} en total. Después vemos las edades de los menores.</p>
          <button className="turi-planning-confirm" type="submit" disabled={locked}>Confirmar viajeros</button>
        </form>
      )}
      {context.step === "ages" && (
        <form onSubmit={submitAges}>
          <p className="turi-planning-note">Indicá una edad o un rango por menor para adaptar alojamiento y actividades.</p>
          <div className="turi-planning-ages">
            {ages.map((age, index) => (
              <div className="turi-planning-age" key={index}>
                <label className="turi-planning-field"><span>Menor {index + 1}</span><input type="number" inputMode="numeric" min={0} max={17} step={1} value={age.includes("–") ? "" : age} placeholder="Edad" required={!age.includes("–")} disabled={locked} onChange={(event) => changeAge(index, event.target.value)} /></label>
                <div className="turi-planning-chips" role="group" aria-label={`Rangos de edad para menor ${index + 1}`}>
                  {ageBands.map((band) => <button key={band} type="button" aria-pressed={age === band} disabled={locked} onClick={() => changeAge(index, band)}>{band}</button>)}
                </div>
              </div>
            ))}
          </div>
          <button className="turi-planning-confirm" type="submit" disabled={locked}>Confirmar edades</button>
        </form>
      )}
      {context.step === "budget" && (
        <form onSubmit={(event) => { event.preventDefault(); submitBudget(numericAmount); }}>
          <p className="turi-planning-note">Definí cuánto querés destinar al alojamiento <strong>de todo el grupo</strong>{nights ? ` por ${nights} ${nights === 1 ? "noche" : "noches"}` : ""}.</p>
          <div className="turi-planning-budget-controls">
            <label className="turi-planning-field"><span>Moneda</span><select value={currency} disabled={locked} onChange={(event) => { setCurrency(event.target.value); setAmount(""); }}>{currencies.map((code) => <option key={code} value={code}>{code}</option>)}</select></label>
            <div className="turi-planning-basis" role="group" aria-label="Alcance del presupuesto">
              <button type="button" aria-pressed={basis === "night"} disabled={locked} onClick={() => { setBasis("night"); setAmount(""); }}>Por noche</button>
              <button type="button" aria-pressed={basis === "total"} disabled={locked} onClick={() => { setBasis("total"); setAmount(""); }}>Total estadía</button>
            </div>
          </div>
          {!!nights && (
            <div className="turi-planning-budget-ranges" role="group" aria-label="Topes de presupuesto para elegir">
              {budgetOptions(nights, currency, spendingCaps[currency] ?? spendingCaps.ARS).map((option) => <button key={option.cap} type="button" disabled={locked} onClick={() => submitBudget(option.cap, "night")}><strong>Hasta {money(option.cap, currency)} / noche</strong><span>{money(option.total, currency)} en total · grupo completo</span></button>)}
            </div>
          )}
          <div className="turi-planning-inline">
            <label className="turi-planning-field"><span>Otro monto {basis === "night" ? "por noche" : "en total"}</span><input type="number" inputMode="decimal" min={0.01} max={1e9} step={0.01} required disabled={locked} value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="Tu presupuesto" /></label>
            <button className="turi-planning-confirm" type="submit" disabled={locked}>Confirmar presupuesto</button>
          </div>
          {totalBudget !== undefined && nights && <p className="turi-planning-budget-total">Tu tope: <strong>{money(totalBudget / nights, currency)} / noche</strong> · <strong>{money(totalBudget, currency)} en total</strong></p>}
          <p className="turi-planning-footnote">Son topes que podés elegir, no tarifas de hoteles.</p>
        </form>
      )}
      {error && <p className="turi-planning-error" id={`${id}-error`} role="alert">{error}</p>}
    </section>
  );
}
