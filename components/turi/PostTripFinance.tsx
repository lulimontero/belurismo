"use client";

import { useEffect, useRef, useState } from "react";
import { currencies, type Workspace } from "@/lib/turi/domain";
import { setReportedRemainder } from "@/lib/turi/posttrip";
import { priceReviewClassification, type PriceReviewResult } from "@/lib/turi/price-reviews";
import {
  appendFlightWatch, appendRateAlert, formatExchangeRate, nextReferenceCurrency,
  originCurrencyFromText, remainderMatchesDraft, removeFlightWatch, removeRateAlert,
  validRateThreshold,
} from "@/lib/turi/posttrip-finance";
import { buildConversationPanels } from "@/lib/turi/conversation-panels";
import { api, type TuriController } from "./useTuri";
import "./post-trip-finance.css";

type Props = { turi: TuriController; onSend: (text: string) => void; disabled?: boolean };
type Currency = Workspace["trip"]["currency"];
type Quote = { from: Currency; to: Currency; amount: number; converted: number; rate: number; updatedAt: string; source: string; sourceUrl: string; note: string };
const money = (amount: number, currency: string) => new Intl.NumberFormat("es-AR", { style: "currency", currency, currencyDisplay: "code", maximumFractionDigits: 2 }).format(amount);
const dateLabel = (date: string) => new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(date));
const validAmount = (value: string) => { const cents = Number(value) * 100; return Number.isFinite(cents) && cents >= 1 && cents <= 1e11 && Math.abs(cents - Math.round(cents)) < 1e-6; };
function updateFinance(turi: TuriController, build: (state: Workspace) => Workspace, onError: (message: string) => void) {
  try {
    // Validate before React schedules an update, so invalid/over-limit drafts
    // become a local message instead of throwing from a React updater.
    const next = build(turi.state);
    turi.setState(next);
    return true;
  } catch (error) {
    onError(error instanceof Error ? error.message : "No pude guardar el cambio. Revisá los datos.");
    return false;
  }
}

export function PostTripRemainder({ turi, disabled = false }: Props) {
  const reported = turi.state.postTrip.remainder;
  const latest = turi.messages.filter(message => message.role === "user").at(-1)?.text || "";
  const requested = originCurrencyFromText(latest);
  const [currency, setCurrency] = useState<Currency>(requested || reported?.currency || turi.state.trip.destinationCurrency);
  const [amount, setAmount] = useState(reported && (!requested || requested === reported.currency) ? String(reported.amount) : "");
  const [quote, setQuote] = useState<Quote | null>(null), [busy, setBusy] = useState(false), [notice, setNotice] = useState("");
  const [showAlert, setShowAlert] = useState(false);
  const keeping = reported?.status === "keep" && remainderMatchesDraft(reported, currency, amount);
  const [target, setTarget] = useState<Currency>(nextReferenceCurrency(currency, turi.state.trip.currency)), [threshold, setThreshold] = useState("");
  const [direction, setDirection] = useState<"above" | "below">("above"), [consent, setConsent] = useState(false);
  const request = useRef(0);
  useEffect(() => () => { request.current++; }, []);
  const resetQuote = () => { request.current++; setQuote(null); setBusy(false); setNotice(""); };
  const compare = async (to: Currency) => {
    if (!validAmount(amount) || to === currency || disabled) return;
    const attempt = ++request.current;
    // A market quote is exploratory; it never changes the saved remainder or
    // an existing decision to keep it. Cancelling therefore preserves both.
    setBusy(true); setNotice(""); setQuote(null);
    try { const result = await api<Quote>("exchange", { from: currency, to, amount: Number(amount) }); if (attempt === request.current) setQuote(result); }
    catch (error) { if (attempt === request.current) setNotice((error as Error).message); }
    finally { if (attempt === request.current) setBusy(false); }
  };
  return <section className="turi-conversation-panel turi-post-finance" aria-label="Lo que te quedó del viaje">
    <h3>Lo que te quedó del viaje</h3><p className="turi-panel-subtitle">Ingresá lo que te sobró. Es un monto informado por vos; no consultamos un saldo de billetera.</p>
    <div className="turi-post-fields"><label>Moneda<select value={currency} disabled={disabled} onChange={event => { const next = event.target.value as Currency; setCurrency(next); setTarget(previous => nextReferenceCurrency(next, previous)); setAmount(""); setThreshold(""); setConsent(false); setShowAlert(false); resetQuote(); }}>{currencies.map(code => <option key={code}>{code}</option>)}</select></label><label>Monto que te sobró<input type="number" min="0.01" max="1000000000" step="0.01" inputMode="decimal" value={amount} disabled={disabled} onChange={event => { setAmount(event.target.value); setConsent(false); resetQuote(); }} /></label></div>
    <div className="turi-panel-buttons">{(["ARS", "USD"] as const).filter(code => code !== currency).map(code => <button key={code} disabled={disabled || busy || !validAmount(amount)} onClick={() => void compare(code)}>Pasar a {code === "ARS" ? "pesos" : "dólares"}</button>)}<button className="secondary" disabled={disabled || busy || !validAmount(amount)} onClick={() => { resetQuote(); if (updateFinance(turi, previous => setReportedRemainder(previous, { amount: Number(amount), currency, status: "keep" }), setNotice)) setNotice(`Guardamos tu decisión de conservar ${money(Number(amount), currency)}. No se movió dinero.`); }}>Guardar para el próximo viaje</button></div>
    {busy && <p role="status">Consultando una referencia actual…</p>}
    {quote && <div className="turi-post-quote"><h4>{money(quote.amount, quote.from)} → {quote.to}</h4><span className="turi-panel-badge">Referencia de mercado</span><div className="turi-panel-row"><span>Por 1 {quote.from}</span><strong>{formatExchangeRate(quote.rate, quote.to)}</strong></div><div className="turi-panel-row"><span>Importe bruto indicativo</span><strong>{money(quote.converted, quote.to)}</strong></div><div className="turi-panel-row"><span>Comisiones y costos de Belo</span><strong>Por confirmar</strong></div><div className="turi-panel-row"><span>Importe neto ejecutable</span><strong>Por confirmar en Belo</strong></div><p className="turi-panel-note">{quote.note}</p><a href={quote.sourceUrl} target="_blank" rel="noreferrer">{quote.source}</a><small>Actualizada: {dateLabel(quote.updatedAt)}</small><div className="turi-panel-buttons"><button disabled>Aprobar en Belo · conexión pendiente</button><button className="secondary" onClick={() => { resetQuote(); setNotice("Propuesta descartada. Tu decisión anterior se conserva; no se movió dinero."); }}>Cancelar</button></div></div>}
    {keeping && <div className="turi-post-quote"><h4>Los conservás en {currency}</h4><p>Podés definir un valor y recibir un aviso cuando la referencia lo cruce.</p><div className="turi-panel-buttons"><button className="secondary" disabled={disabled} onClick={() => setShowAlert(!showAlert)}>Elegir umbral cambiario</button><button className="secondary" disabled={disabled} onClick={() => { setShowAlert(false); setNotice("Sin alertas nuevas. Conservás tu decisión para el próximo viaje."); }}>No, gracias</button></div></div>}
    {keeping && showAlert && <form className="turi-post-quote" onSubmit={event => { event.preventDefault(); if (disabled) return; if (updateFinance(turi, previous => appendRateAlert(previous, { from: currency, to: target, threshold: Number(threshold), direction, consent }), setNotice)) { setShowAlert(false); setConsent(false); setNotice("Umbral guardado. El envío requiere Telegram vinculado y planificador configurado; la fuente es de actualización diaria."); } }}><h4>Avisame por 1 {currency}</h4><div className="turi-post-fields"><label>Moneda de referencia<select value={target} disabled={disabled} onChange={event => { setTarget(event.target.value as Currency); setThreshold(""); setConsent(false); }}>{currencies.filter(code => code !== currency).map(code => <option key={code}>{code}</option>)}</select></label><label>Valor del umbral<input type="number" min="0" step="any" max="1000000000" required disabled={disabled} value={threshold} onChange={event => setThreshold(event.target.value)} /></label><label>Cuando la referencia<select value={direction} disabled={disabled} onChange={event => { setDirection(event.target.value as "above" | "below"); setConsent(false); }}><option value="above">Sea igual o mayor</option><option value="below">Sea igual o menor</option></select></label></div><label className="turi-panel-check"><input type="checkbox" checked={consent} disabled={disabled} onChange={event => setConsent(event.target.checked)} required /><span>Quiero recibir este aviso por el canal vinculado.</span></label><div className="turi-panel-buttons"><button disabled={disabled || !consent || !validRateThreshold(threshold) || target === currency || turi.state.rateAlerts.length >= 20}>Guardar umbral</button></div><small>No predice el mejor momento ni compra moneda automáticamente.</small>{turi.state.rateAlerts.length >= 20 && <p role="status">Ya tenés 20 alertas. Quitá una de la lista para agregar otra.</p>}</form>}
    {!!turi.state.rateAlerts.length && <details><summary>Alertas cambiarias guardadas ({turi.state.rateAlerts.length}/20)</summary>{turi.state.rateAlerts.map(alert => <div className="turi-panel-row" key={alert.id}><span>1 {alert.from} {alert.direction === "above" ? "≥" : "≤"} {formatExchangeRate(alert.threshold, alert.to)}{alert.sent ? " · aviso enviado" : " · pendiente"}</span><button className="turi-panel-text-button" disabled={disabled} onClick={() => { if (updateFinance(turi, previous => removeRateAlert(previous, alert.id), setNotice)) setNotice("Alerta quitada. Las demás se conservan."); }}>Quitar</button></div>)}</details>}
    {notice && <p role="status" className="turi-panel-note">{notice}</p>}
  </section>;
}

export function PriceReviewComparison({ comparison, onSend }: { comparison: PriceReviewResult; onSend: (text: string) => void }) {
  const [dismissed, setDismissed] = useState(false);
  const classification = priceReviewClassification(comparison);
  if (dismissed) return <p role="status" className="turi-panel-note">Comparación cerrada. El gasto original sigue registrado.</p>;
  return <section className="turi-conversation-panel turi-post-finance" aria-label={`Comparación de ${comparison.description}`}><h3>{comparison.description}</h3><span className={`turi-panel-badge ${classification === "above" ? "warning" : "positive"}`}>{classification === "above" ? "Diferencia para revisar" : classification === "below" ? "Por debajo de la referencia consultada" : "Dentro de la referencia consultada"}</span><div className="turi-panel-row"><span>Pagaste</span><strong>{money(comparison.paid, comparison.currency)}</strong></div><div className="turi-panel-row"><span>Referencia por {comparison.unit}</span><strong>{money(comparison.referenceMin, comparison.currency)} – {money(comparison.referenceMax, comparison.currency)}</strong></div><div className="turi-panel-row"><span>Para {comparison.quantity} unidades</span><strong>{money(comparison.referenceTotalMin, comparison.currency)} – {money(comparison.referenceTotalMax, comparison.currency)}</strong></div><div className="turi-panel-row"><span>Diferencia frente al máximo</span><strong>{money(comparison.difference, comparison.currency)}</strong></div><p>{comparison.conditions}</p><p className="turi-panel-note">La diferencia no demuestra un cobro indebido. Compará producto, cantidad, fecha, impuestos y condiciones; conservá el comprobante.</p><a href={comparison.sourceUrl} target="_blank" rel="noreferrer">{comparison.sourceTitle}</a><small>Consultado: {dateLabel(comparison.checkedAt)}</small><details><summary>Ver los datos de la referencia</summary><p>{comparison.evidence}</p></details><div className="turi-panel-buttons"><button onClick={() => onSend(`Quiero revisar el comprobante de "${comparison.description}" y las condiciones de esta comparación: ${comparison.sourceUrl}. Pedime cantidad, producto y datos que falten; no des por confirmado un cobro indebido.`)}>Revisar comprobante</button><button className="secondary" onClick={() => setDismissed(true)}>Cerrar comparación</button></div></section>;
}

export function PostTripNext({ turi, onSend, disabled = false }: Props) {
  const data = buildConversationPanels(turi.state).nextTrip;
  const [days, setDays] = useState("7"), [showWatch, setShowWatch] = useState(false), [destination, setDestination] = useState("");
  const [maximum, setMaximum] = useState(""), [currency, setCurrency] = useState<Currency>(turi.state.trip.currency), [notice, setNotice] = useState("");
  const count = Number(days), valid = Number.isInteger(count) && count >= 1 && count <= 365;
  const watches = turi.state.postTrip.flightWatches;
  return <section className="turi-conversation-panel turi-post-finance" aria-label="Ideas para el próximo viaje">
    <h3>Ideas para el próximo viaje</h3>
    <p>Tomemos tu ritmo de gasto como punto de partida y busquemos precios actuales para el destino que elijas.</p>
    <div className="turi-post-fields"><label>Días del próximo viaje<input type="number" min="1" max="365" step="1" value={days} disabled={disabled} onChange={event => setDays(event.target.value)} /></label></div>
    {data.suggestedDaily !== null && valid ? <>
      <div className="turi-panel-row"><span>Referencia diaria con margen del 5%</span><strong>{money(data.suggestedDaily, data.currency)}</strong></div>
      <div className="turi-panel-row"><span>Para {days} días de ritmo similar</span><strong>{money(data.suggestedDaily * count, data.currency)}</strong></div>
    </> : <p className="turi-panel-note">Faltan gastos o fechas para calcular una referencia histórica.</p>}
    <p className="turi-panel-note">Incluye las categorías de tus registros. No estima el costo de otra ciudad ni separa vuelos/hotel sin datos; no es un precio futuro.</p>
    <div className="turi-panel-buttons">{["Río de Janeiro", "Salvador de Bahía", "Búzios"].map(place => <button className="secondary" key={place} disabled={disabled || !valid} onClick={() => onSend(`Me interesa planificar mi próximo viaje a ${place} por ${days} días. Buscá opciones actuales con fotos, pros y contras; confirmá fechas con año, viajeros y presupuesto antes de buscar tarifas. Mi promedio anterior es sólo referencia; no cambies el viaje actual ni mezcles sus gastos.`)}>{place}</button>)}</div>
    <h4 className="turi-post-subheading">¿Querés un aviso de precios de vuelos?</h4>
    <div className="turi-panel-buttons"><button className="secondary" disabled={disabled} onClick={() => setShowWatch(true)}>Sí, avisame</button><button className="secondary" disabled={disabled} onClick={() => { setShowWatch(false); setNotice("Sin nuevos avisos de vuelos."); }}>Ahora no</button></div>
    {showWatch && <form className="turi-post-quote" onSubmit={event => {
      event.preventDefault();
      if (disabled || !validAmount(maximum)) return;
      if (updateFinance(turi, previous => appendFlightWatch(previous, { destination, maxPrice: Number(maximum), currency }), setNotice)) {
        setShowWatch(false);
        setNotice("Preferencia guardada. El monitoreo de vuelos está pendiente de conectar una fuente de precios; todavía no se programaron avisos.");
      }
    }}>
      <div className="turi-post-fields">
        <label>Destino del vuelo<input required minLength={2} maxLength={120} value={destination} disabled={disabled} onChange={event => setDestination(event.target.value)} /></label>
        <label>Moneda<select value={currency} disabled={disabled} onChange={event => { setCurrency(event.target.value as Currency); setMaximum(""); }}>{currencies.map(code => <option key={code}>{code}</option>)}</select></label>
        <label>Precio máximo<input type="number" required min="0.01" max="1000000000" step="0.01" value={maximum} disabled={disabled} onChange={event => setMaximum(event.target.value)} /></label>
      </div>
      <p className="turi-panel-note">La fuente de vuelos todavía no está conectada. Guardamos lo que te interesa para completar la configuración después.</p>
      {watches.length >= 10 && <p role="status">Ya tenés 10 intereses de vuelos. Quitá uno de la lista para agregar otro.</p>}
      <div className="turi-panel-buttons"><button disabled={disabled || destination.trim().length < 2 || !validAmount(maximum) || watches.length >= 10}>Guardar preferencia</button></div>
    </form>}
    {!!watches.length && <details><summary>Intereses de vuelos guardados ({watches.length}/10)</summary>{watches.map(watch => <div className="turi-panel-row" key={watch.id}>
      <span>{watch.destination} · hasta {money(watch.maxPrice, watch.currency)} · monitoreo pendiente</span>
      <button className="turi-panel-text-button" disabled={disabled} onClick={() => { if (updateFinance(turi, previous => removeFlightWatch(previous, watch.id), setNotice)) setNotice("Interés de vuelo quitado. Los demás se conservan."); }}>Quitar</button>
    </div>)}</details>}
    {notice && <p role="status" className="turi-panel-note">{notice}</p>}
  </section>;
}
