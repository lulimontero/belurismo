"use client";

import { useId, useMemo, useState, type ReactNode } from "react";
import PostTripPanels from "./PostTripPanels";
import { PostTripNext, PostTripRemainder } from "./PostTripFinance";
import {
  buildConversationPanels,
  preTripChecks,
  type ConversationPanelKind,
  type ConversationPanels as PanelData,
} from "@/lib/turi/conversation-panels";
import type { TuriController } from "./useTuri";
import "./conversation-panels.css";

type Props = {
  kind: ConversationPanelKind | "template" | "post-trip-overview";
  turi: TuriController;
  onSend: (text: string) => void;
  disabled?: boolean;
};
type DataProps = Props & { data: PanelData };

const money = (amount: number, currency: string) => new Intl.NumberFormat("es-AR", {
  style: "currency", currency, currencyDisplay: "code", minimumFractionDigits: 0, maximumFractionDigits: 2,
}).format(amount);
const shortDate = (date: string) => date ? new Intl.DateTimeFormat("es-AR", {
  day: "numeric", month: "short", timeZone: "UTC",
}).format(new Date(`${date}T00:00:00Z`)) : "Sin fecha";
const percent = (value: number) => Math.round(value * 100);

function Panel({ title, children, tone = "", subtitle }: { title: string; children: ReactNode; tone?: string; subtitle?: string }) {
  return <section className={`turi-conversation-panel ${tone}`} aria-label={title}>
    <h3>{title}</h3>{subtitle && <p className="turi-panel-subtitle">{subtitle}</p>}{children}
  </section>;
}
function Row({ label, value }: { label: ReactNode; value: ReactNode }) {
  return <div className="turi-panel-row"><span>{label}</span><strong>{value}</strong></div>;
}
function Meter({ value, label, warning = false }: { value: number; label: string; warning?: boolean }) {
  return <div className={`turi-panel-meter ${warning ? "warning" : ""}`} role="meter" aria-label={label}
    aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, Math.max(0, percent(value)))} aria-valuetext={`${percent(value)}%`}>
    <span style={{ width: `${Math.min(100, Math.max(0, value * 100))}%` }} />
  </div>;
}

function Summary({ data, onSend, disabled }: DataProps) {
  const s = data.summary;
  const currency = s.currency;
  return <div className="turi-panel-stack">
    <Panel title="Resumen de gastos" subtitle={s.destination || "Tu viaje"} tone={s.delta > 0 && s.budget > 0 ? "alert" : ""}>
      <div className="turi-panel-total-row"><div><small>Total registrado</small><strong className="turi-panel-big">{money(s.total, currency)}</strong></div>
        {s.ratio !== null && <span className={`turi-panel-badge ${s.delta > 0 ? "warning" : "positive"}`}>{percent(s.ratio)}% del presupuesto</span>}
      </div>
      {s.ratio !== null && <Meter value={s.ratio} warning={s.delta > 0} label="Presupuesto utilizado" />}
      <Row label="Presupuesto previsto" value={s.budget > 0 ? money(s.budget, currency) : "A definir"} />
      {s.budget > 0 && <Row label={s.remaining < 0 ? "Por encima del presupuesto" : "Margen del presupuesto"} value={money(Math.abs(s.remaining), currency)} />}
      <div className="turi-panel-divider" />
      <Row label="Tu parte de los gastos" value={money(s.personalTotal, currency)} />
      <Row label="Pagado por vos" value={money(s.paidByMe, currency)} />
      <Row label="Promedio diario registrado" value={s.averageDaily === null ? "Faltan fechas" : money(s.averageDaily, currency)} />
      <Row label="Tope diario previsto" value={s.dailyLimit === null ? "Faltan fechas o presupuesto" : money(s.dailyLimit, currency)} />
      {s.returnReserve > 0 && <p className="turi-panel-note">Reserva para la vuelta: {money(s.returnReserve, currency)}. El tope diario la mantiene separada.</p>}
      <p className="turi-panel-note">{s.expenseCount ? `${s.expenseCount} gastos registrados. El total incluye todos los registros del viaje.` : "Todavía no hay gastos registrados. Podés enviar un comprobante o contarme un gasto para revisarlo."} El margen del presupuesto no es el saldo de tu billetera.</p>
    </Panel>
    {s.expenseCount > 0 && <Panel title="Por categoría">
      {s.categories.filter(row => row.amount > 0 || row.budget !== null).map(row => <div className="turi-panel-category" key={row.category}>
        <Row label={row.category} value={`${money(row.amount, currency)} · ${percent(row.share)}%`} />
        <Meter value={row.share} label={`Participación de ${row.category}`} />
        {row.budget !== null && <small>Tope {money(row.budget, currency)} · {row.remaining! < 0 ? "exceso" : "disponible"} {money(Math.abs(row.remaining!), currency)}</small>}
      </div>)}
      {s.topCategory && <p className="turi-panel-note">{s.topCategory.category} concentra el {percent(s.topCategory.share)}% del total registrado.</p>}
      <div className="turi-panel-buttons"><button disabled={disabled} onClick={() => onSend("Mostrame los gastos día por día y qué puedo aprender para el próximo viaje.")}>Ver día por día</button></div>
    </Panel>}
  </div>;
}

function Daily({ data, turi }: DataProps) {
  const [expanded, setExpanded] = useState(false);
  const d = data.daily;
  const max = Math.max(1, d.dailyLimit || 0, ...d.days.map(row => row.amount)) * 1.1;
  const rows = expanded ? d.days : d.days.slice(0, 10);
  return <div className="turi-panel-stack"><Panel title="Día por día" subtitle={d.dailyLimit === null ? "Definí fechas y presupuesto para comparar con un tope." : `Tope previsto: ${money(d.dailyLimit, d.currency)} por día`}>
    {!rows.length ? <p className="turi-panel-empty">Todavía no hay fechas ni gastos para armar este gráfico.</p> : <>
      <div className="turi-panel-chart-scroll">{rows.map(row => <div className="turi-panel-day" key={row.date}>
        <span title={row.date}>Día {row.day}<small>{shortDate(row.date)}</small></span>
        <div className="turi-panel-day-track" aria-label={`${shortDate(row.date)}: ${money(row.amount, d.currency)}${row.excess ? `, exceso ${money(row.excess, d.currency)}` : ""}`}>
          <i className={row.excess > 0 ? "excess" : ""} style={{ width: `${row.amount / max * 100}%` }} />
          {d.dailyLimit !== null && <b aria-hidden="true" style={{ left: `${d.dailyLimit / max * 100}%` }} />}
        </div><strong>{money(row.amount, d.currency)}</strong>
      </div>)}</div>
      {d.days.length > 10 && <button className="turi-panel-text-button" onClick={() => setExpanded(!expanded)}>{expanded ? "Mostrar menos días" : `Ver los ${d.days.length} días`}</button>}
      <p className="turi-panel-note">{d.dailyLimit !== null && "La línea negra marca el tope diario. "}Un día sin registros no confirma que no hayas gastado.</p>
      {d.truncated && <p className="turi-panel-note">Se muestran hasta 366 días.</p>}
      {d.outsideTripCount > 0 && <p className="turi-panel-note">Hay {d.outsideTripCount} gastos fuera de las fechas del viaje por {money(d.outsideTripAmount, d.currency)}; no aparecen en estas barras.</p>}
    </>}
  </Panel>{data.summary.expenseCount > 0 && <Panel title="Lo que aprendimos">
    <ul className="turi-panel-tips">
      {d.overDays.length > 0 ? <li>Los días {d.overDays.join(", ")} superaron el tope por {money(d.totalExcess, d.currency)} en conjunto; el resto de los días puede compensar parte.</li> : <li>{d.dailyLimit === null ? "Falta definir un tope diario para evaluar excesos." : "Ningún día registrado supera el tope previsto."}</li>}
      {d.largestDay && <li>El mayor gasto registrado fue el día {d.largestDay.day}, {shortDate(d.largestDay.date)}: {money(d.largestDay.amount, d.currency)}.</li>}
      {d.largestDay && <li>En ese día: {turi.state.expenses.filter(expense => expense.date === d.largestDay!.date).sort((a, b) => b.homeAmount - a.homeAmount).slice(0, 4).map(expense => `${expense.description} (${money(expense.homeAmount, d.currency)})`).join("; ")}. Los importes son los registrados, no una causa confirmada de un exceso.</li>}
      {d.recommendedDaily !== null && <li>Para planificar un viaje parecido, referencia de {money(d.recommendedDaily, d.currency)} por día.</li>}
    </ul><p className="turi-panel-note">{d.recommendationNote}</p>
  </Panel>}</div>;
}

function Group({ data, onSend, disabled }: DataProps) {
  const [preview, setPreview] = useState(false);
  const g = data.group;
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);
  const recipients = g.transfers.filter(transfer => transfer.from !== "me");
  const keyFor = (transfer: (typeof g.transfers)[number]) => `${transfer.from}:${transfer.to}:${transfer.amount}`;
  const draftFor = (transfer: (typeof g.transfers)[number]) => drafts[keyFor(transfer)] ?? `Hola ${transfer.fromName}, queda una cuenta del viaje por ${money(transfer.amount, g.currency)} para ${transfer.toName}. ¿La revisamos?`;
  const chosen = recipients.filter(transfer => selected[keyFor(transfer)] !== false);
  return <div className="turi-panel-stack"><Panel title="Gastos compartidos">
    {!g.sharedExpenses.length ? <p className="turi-panel-empty">Todavía no hay gastos con reparto registrado. Contame quién pagó, el importe y entre quiénes se divide.</p> : <>
      {g.sharedExpenses.map(expense => <div className="turi-panel-ledger" key={expense.id}><Row label={expense.description} value={money(expense.amount, g.currency)} /><small>{shortDate(expense.date)} · pagó {expense.payerName} · {expense.participants.length} participantes</small></div>)}
      <Row label="Total compartido registrado" value={money(g.sharedTotal, g.currency)} />
    </>}
  </Panel><Panel title="Quién le debe a quién">
    {g.transfers.length ? <>{g.transfers.map((transfer, index) => <Row key={index} label={`${transfer.fromName} → ${transfer.toName}`} value={money(transfer.amount, g.currency)} />)}
      <div className="turi-panel-divider" /><Row label="A vos te toca pagar" value={money(g.totalToPay, g.currency)} /><Row label="A vos te toca cobrar" value={money(g.totalToCollect, g.currency)} />
    </> : <p className="turi-panel-empty">No hay transferencias pendientes calculadas con los repartos actuales.</p>}
    <p className="turi-panel-note">Son cuentas calculadas a partir de los gastos. Un pago sólo se da por saldado después de revisar evidencia verificable.</p>
    <span className="turi-panel-badge">Belo Air: conexión pendiente de validar</span>
    {g.transfers.length > 0 && <div className="turi-panel-buttons"><button disabled={disabled || !recipients.length} onClick={() => setPreview(!preview)}>Preparar recordatorios</button><button className="secondary" disabled={disabled} onClick={() => onSend("Quiero revisar un comprobante de pago de las cuentas del grupo antes de dar una deuda por saldada. Pedime los datos y la evidencia necesaria.")}>Revisar un pago</button></div>}
    {preview && <div className="turi-panel-preview"><h4>Recordatorios para revisar</h4>{recipients.map(transfer => <div key={keyFor(transfer)}><label className="turi-panel-check"><input type="checkbox" checked={selected[keyFor(transfer)] !== false} onChange={event => { setSelected(previous => ({ ...previous, [keyFor(transfer)]: event.target.checked })); setCopied(false); }} /><span>{transfer.fromName} → {transfer.toName} · {money(transfer.amount, g.currency)}</span></label><label className="turi-post-reminder-label">Texto para {transfer.fromName}<textarea maxLength={1200} value={draftFor(transfer)} onChange={event => { setDrafts(previous => ({ ...previous, [keyFor(transfer)]: event.target.value })); setCopied(false); }} /></label></div>)}<small>Vista previa. Todavía no se envió ningún mensaje. Las cuentas que pagás vos no se incluyen entre los destinatarios.</small><div className="turi-panel-buttons"><button disabled={disabled || !chosen.length} onClick={async () => { try { await navigator.clipboard.writeText(chosen.map(draftFor).join("\n\n")); setCopied(true); } catch { onSend("Ayudame a copiar los borradores revisados de recordatorios de las cuentas del grupo. No envíes nada."); } }}>Copiar textos revisados</button><button className="secondary" disabled={disabled || !chosen.length} onClick={() => onSend(`Quiero revisar cómo enviar estos recordatorios elegidos. Todavía no envíes nada. ${chosen.map(transfer => `${transfer.fromName}: ${draftFor(transfer)}`).join("\n")}`)}>Revisar cómo enviarlos</button><button className="secondary" onClick={() => setPreview(false)}>Cancelar</button></div>{copied && <small role="status">Textos copiados. No se enviaron mensajes.</small>}</div>}
  </Panel></div>;
}

function Checklist({ turi, onSend, disabled }: DataProps) {
  const done = turi.state.assistantPreferences.checklist;
  const count = preTripChecks.filter(item => done[`pretrip:${item.id}`]).length;
  return <Panel title="Checklist antes de viajar" subtitle={`${count} de ${preTripChecks.length} listos. Marcá sólo lo que ya verificaste.`}>
    <Meter value={count / preTripChecks.length} label="Preparación del viaje" />
    {preTripChecks.map(item => <label className="turi-panel-check" key={item.id}><input type="checkbox" checked={!!done[`pretrip:${item.id}`]} onChange={event => {
      const checked = event.target.checked;
      turi.setState(previous => ({ ...previous, assistantPreferences: { ...previous.assistantPreferences, checklist: { ...previous.assistantPreferences.checklist, [`pretrip:${item.id}`]: checked } } }));
    }} /><span><strong>{item.label}</strong><small>{item.description}</small></span></label>)}
    <div className="turi-panel-buttons"><button disabled={disabled} onClick={() => onSend("Ayudame a revisar los pendientes de mi checklist antes de viajar. No marques nada como listo sin que yo lo confirme.")}>Revisar pendientes con Turi</button></div>
  </Panel>;
}

function PriceReview({ data, onSend, disabled }: DataProps) {
  const [selected, setSelected] = useState("");
  const radioGroup = useId();
  const expense = data.priceReview.candidates.find(item => item.id === selected);
  return <Panel title="Cobros para revisar" subtitle="Elegí un gasto registrado para buscar referencias comparables. Sin fuentes verificadas no se puede concluir que hubo un sobreprecio.">
    {!data.priceReview.candidates.length && <p className="turi-panel-empty">Primero registrá el gasto o adjuntá el comprobante que querés revisar.</p>}
    {data.priceReview.candidates.map(item => <label className="turi-panel-check" key={item.id}><input type="radio" name={radioGroup} checked={selected === item.id} onChange={() => setSelected(item.id)} /><span><strong>{item.description}</strong><small>{shortDate(item.date)} · {item.category} · {money(item.amount, item.currency)}</small></span></label>)}
    <div className="turi-panel-buttons"><button disabled={disabled || !expense} onClick={() => { if (expense) onSend(`Quiero revisar el gasto registrado ID ${expense.id}: "${expense.description}" del ${expense.date}, por ${money(expense.amount, expense.currency)}. Buscá referencias verificables para el mismo producto, zona, cantidad y condiciones. Pedime los datos que falten. Mostrá la ficha comparativa dentro del chat con fuente, fecha, moneda y límites; sin afirmar un cobro indebido sin evidencia ni inventar un rango.`); }}>Buscar referencias de este gasto</button></div>
  </Panel>;
}

/** Cards, daily bars, checkboxes and stars adapted from the supplied posttrip
 * and pretrip HTML. All values come from workspace state; demo fixtures and
 * simulated sends, rates or payment approvals are intentionally excluded. */
export default function ConversationPanels(props: Props) {
  const data = useMemo(() => buildConversationPanels(props.turi.state), [props.turi.state]);
  const panelProps = { ...props, data };
  switch (props.kind) {
    case "post-trip-overview":
    case "template":
    case "feedback":
    case "post-trip-notice":
    case "recap": return <PostTripPanels {...props} kind={props.kind} />;
    case "summary": return <Summary {...panelProps} />;
    case "daily": return <Daily {...panelProps} />;
    case "group": return <Group {...panelProps} />;
    case "checklist": return <Checklist {...panelProps} />;
    case "leftover": return <PostTripRemainder {...props} />;
    case "price-review": return <PriceReview {...panelProps} />;
    case "next-trip": return <PostTripNext {...props} />;
  }
}
