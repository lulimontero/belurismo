"use client";

import { useId, useMemo, useState, type ReactNode } from "react";
import { CheckIcon, CopyIcon, DownloadSimpleIcon, StarIcon } from "@phosphor-icons/react";
import {
  buildConversationPanels,
  preTripChecks,
  type ConversationPanelKind,
  type ConversationPanels as PanelData,
} from "@/lib/turi/conversation-panels";
import type { TuriController } from "./useTuri";
import "./conversation-panels.css";

type Props = {
  kind: ConversationPanelKind | "template";
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

function Daily({ data }: DataProps) {
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
      {d.recommendedDaily !== null && <li>Para planificar un viaje parecido, referencia de {money(d.recommendedDaily, d.currency)} por día.</li>}
    </ul><p className="turi-panel-note">{d.recommendationNote}</p>
  </Panel>}</div>;
}

function Group({ data, onSend, disabled }: DataProps) {
  const [preview, setPreview] = useState(false);
  const g = data.group;
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
    {g.transfers.length > 0 && <div className="turi-panel-buttons"><button disabled={disabled} onClick={() => setPreview(!preview)}>Preparar recordatorios</button><button className="secondary" disabled={disabled} onClick={() => onSend("Quiero revisar un comprobante de pago de las cuentas del grupo antes de dar una deuda por saldada. Pedime los datos y la evidencia necesaria.")}>Revisar un pago</button></div>}
    {preview && <div className="turi-panel-preview"><h4>Recordatorios para revisar</h4>{g.transfers.map((transfer, index) => <p key={index}>Hola {transfer.fromName}, queda una cuenta del viaje por {money(transfer.amount, g.currency)} para {transfer.toName}. ¿La revisamos?</p>)}<small>Vista previa. Todavía no se envió ningún mensaje.</small><div className="turi-panel-buttons"><button disabled={disabled} onClick={() => onSend("Quiero revisar destinatarios, importes y texto de los recordatorios de las cuentas del grupo. Mostrame una propuesta para aprobar; todavía no envíes nada.")}>Revisar cómo enviarlos</button></div></div>}
  </Panel></div>;
}

function Recap({ data, turi }: DataProps) {
  const [copiedText, setCopiedText] = useState("");
  const recap = data.recap;
  const content = [
    `Resumen del viaje${recap.destination ? ` a ${recap.destination}` : ""}`,
    recap.startDate && recap.endDate ? `${recap.startDate} al ${recap.endDate} · ${recap.days} días` : "Fechas sin definir",
    `Gastos comunes: ${money(recap.sharedTotal, recap.currency)} · ${recap.sharedExpenseCount} registros`,
    `${recap.participantCount} participantes en gastos comunes`,
    recap.topCategory ? `Categoría principal en comunes: ${recap.topCategory}` : "",
    recap.largestDay ? `Día de mayor gasto común: ${shortDate(recap.largestDay.date)} · ${money(recap.largestDay.amount, recap.currency)}` : "",
    `Transferencias calculadas por revisar: ${recap.pendingTransfers}`,
  ].filter(Boolean).join("\n");
  const copied = copiedText === content;
  return <Panel title="Resumen para compartir" subtitle="Vista previa sólo con gastos comunes">
    <div className="turi-panel-share-preview">{content}</div>
    <p className="turi-panel-note">No incluye gastos personales, saldos, contactos ni presupuestos privados. Al copiarlo, vos elegís dónde compartirlo.</p>
    <div className="turi-panel-buttons"><button disabled={!recap.sharedExpenseCount} onClick={async () => { try { await navigator.clipboard.writeText(content); setCopiedText(content); } catch { turi.setError("No pude copiarlo. Podés seleccionar el texto de la vista previa y copiarlo."); } }}><CopyIcon size={15} />{copied ? "Copiado" : "Copiar resumen"}</button></div>
    {copied && <small className="turi-panel-status" role="status">El resumen se copió al portapapeles.</small>}
  </Panel>;
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

function Template({ data, turi, onSend, disabled }: DataProps) {
  const [downloaded, setDownloaded] = useState(false);
  const checked = turi.state.assistantPreferences.checklist;
  const options = [...new Map(turi.messages.flatMap(message => message.options || []).map(option => [option.id, option])).values()];
  const favorites = options.filter(option => checked[`template-favorite:${option.id}`]);
  const items = data.checklist.items.map(item => item.id === "favorites" ? { ...item, available: options.length > 0, description: options.length ? "Elegí abajo cuáles de las opciones consultadas querés conservar." : item.description } : item);
  const chosen = items.filter(item => item.available && checked[`template:${item.id}`]);
  const selectedFavorites = chosen.some(item => item.id === "favorites") ? favorites : [];
  const toggle = (key: string, value: boolean) => {
    setDownloaded(false);
    turi.setState(previous => ({ ...previous, assistantPreferences: { ...previous.assistantPreferences, checklist: { ...previous.assistantPreferences.checklist, [key]: value } } }));
  };
  const buildTemplate = () => ({
    format: "turi.trip-template.v1", importReview: true, exportedAt: new Date().toISOString(),
    origin: { destination: turi.state.trip.destination, days: data.summary.days },
    ...(chosen.some(item => item.id === "itinerary") ? { itinerary: turi.state.itinerary.map(({ title, start, end, location, notes }) => ({ title, start, end, location, notes })) } : {}),
    ...(chosen.some(item => item.id === "favorites") ? { favorites: favorites.map(({ name, kind, location, summary, sourceUrl }) => ({ name, kind, location, summary, sourceUrl })) } : {}),
    ...(chosen.some(item => item.id === "category-budgets") ? { categoryBudgets: turi.state.trip.categoryBudgets, currency: turi.state.trip.currency } : {}),
    ...(chosen.some(item => item.id === "members") ? { members: turi.state.members.filter(member => member.adultConfirmed && member.consentConfirmed).map(({ id, name }) => ({ id, name })) } : {}),
  });
  const valid = chosen.length > 0 && (!chosen.some(item => item.id === "favorites") || favorites.length > 0);
  return <Panel title="¿Qué querés conservar?" subtitle="Armá una plantilla que puedas descargar y revisar al planificar otro viaje.">
    {items.map(item => <div key={item.id}><label className="turi-panel-check"><input type="checkbox" disabled={!item.available} checked={item.available && !!checked[`template:${item.id}`]} onChange={event => toggle(`template:${item.id}`, event.target.checked)} /><span><strong>{item.label}</strong><small>{item.description}</small></span></label>
      {item.id === "favorites" && checked["template:favorites"] && options.length > 0 && <div className="turi-panel-nested-checks">{options.map(option => <label className="turi-panel-check" key={option.id}><input type="checkbox" checked={!!checked[`template-favorite:${option.id}`]} onChange={event => toggle(`template-favorite:${option.id}`, event.target.checked)} /><span>{option.name}<small>{option.location}</small></span></label>)}</div>}
    </div>)}
    <p className="turi-panel-note">El archivo conserva sólo tu selección. Las fechas y presupuestos históricos necesitan revisión; no son reservas ni precios para el próximo viaje.</p>
    <div className="turi-panel-buttons"><button disabled={!valid} onClick={() => {
      try {
        const url = URL.createObjectURL(new Blob([JSON.stringify(buildTemplate(), null, 2)], { type: "application/json" }));
        const link = document.createElement("a"); link.href = url; link.download = "turi-plantilla-viaje.json"; link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000); setDownloaded(true);
      } catch { turi.setError("No pude descargar la plantilla. Intentá nuevamente."); }
    }}><DownloadSimpleIcon size={16} />Descargar plantilla</button><button className="secondary" disabled={disabled || !valid} onClick={() => onSend(`Quiero reutilizar como referencia el viaje a ${turi.state.trip.destination || "mi destino anterior"}. Elegí conservar: ${chosen.map(item => item.label).join(", ")}${selectedFavorites.length ? `. Lugares seleccionados: ${selectedFavorites.map(option => option.name).join(", ")}` : ""}. Ayudame a definir nuevas fechas, destino y presupuesto antes de crear otro itinerario.`)}>Planificar con esta plantilla</button></div>
    {downloaded && <small role="status" className="turi-panel-status"><CheckIcon size={14} />Descarga iniciada. No se guardó una plantilla en la nube.</small>}
  </Panel>;
}

function Feedback({ turi }: DataProps) {
  const [newPlace, setNewPlace] = useState("");
  const [addedPlaces, setAddedPlaces] = useState<string[]>([]);
  const preferences = turi.state.assistantPreferences;
  const suggestions = [...new Set([...turi.state.itinerary.map(item => item.title), ...turi.state.expenses.filter(item => ["Comida", "Alojamiento", "Actividades"].includes(item.category)).map(item => item.description)])].slice(0, 8);
  const places = [...new Set([...Object.keys(preferences.ratings), ...addedPlaces, ...suggestions])];
  const rate = (place: string, value: number) => turi.setState(previous => ({ ...previous, assistantPreferences: { ...previous.assistantPreferences, ratings: { ...previous.assistantPreferences.ratings, [place]: value } } }));
  return <Panel title="Tu opinión del viaje" subtitle="Calificá sólo los lugares o actividades que visitaste. Tus puntajes quedan guardados en este viaje.">
    {places.map(place => <div className="turi-panel-rating" key={place}><strong>{place}</strong><div className="turi-panel-stars" role="group" aria-label={`Puntaje para ${place}`}>
      {[1, 2, 3, 4, 5].map(value => <button type="button" key={value} aria-label={`${value} ${value === 1 ? "estrella" : "estrellas"} para ${place}`} aria-pressed={preferences.ratings[place] === value} className={value <= (preferences.ratings[place] || 0) ? "selected" : ""} onClick={() => rate(place, value)}><StarIcon size={18} weight={value <= (preferences.ratings[place] || 0) ? "fill" : "regular"} /></button>)}
      <small>{preferences.ratings[place] ? `${preferences.ratings[place]}/5` : "Sin puntaje"}</small>
    </div></div>)}
    <form className="turi-panel-form" onSubmit={event => { event.preventDefault(); const place = newPlace.trim(); if (place) { setAddedPlaces(previous => [...new Set([...previous, place])]); setNewPlace(""); } }}><label>Lugar o actividad para calificar<input value={newPlace} onChange={event => setNewPlace(event.target.value)} maxLength={160} placeholder="Nombre del lugar que visitaste" /></label><button disabled={!newPlace.trim()}>Agregar</button></form>
    <label className="turi-panel-switch"><input type="checkbox" checked={preferences.anonymousPriceConsent} onChange={event => {
      const consent = event.target.checked;
      turi.setState(previous => ({ ...previous, assistantPreferences: { ...previous.assistantPreferences, anonymousPriceConsent: consent } }));
    }} /><span><strong>Aportar mis precios de forma anónima cuando esté disponible</strong><small>Guardamos tu preferencia, que podés revocar acá. El servicio de aportes aún no está conectado: no se publicó ni envió ningún precio.</small></span></label>
  </Panel>;
}

function Leftover({ data, onSend, disabled }: DataProps) {
  const [amount, setAmount] = useState("");
  const currency = data.leftover.currency;
  const cents = Number(amount) * 100;
  const valid = Number.isFinite(cents) && cents >= 1 && cents <= 1e11 && Math.abs(cents - Math.round(cents)) < 1e-6;
  return <Panel title="Lo que te quedó del viaje" subtitle="Indicá el monto que querés evaluar. No se calculó un saldo de billetera.">
    <div className="turi-panel-form"><label>Monto que informás ({currency})<input type="number" inputMode="decimal" min="0.01" max="1000000000" step="0.01" value={amount} onChange={event => setAmount(event.target.value)} placeholder="0,00" /></label></div>
    <div className="turi-panel-buttons">{["ARS", "USD"].filter(target => target !== currency).map(target => <button key={target} disabled={disabled || !valid} onClick={() => onSend(`Informo que me sobraron ${money(Number(amount), currency)} del viaje. Quiero evaluar convertirlos a ${target}. Consultá una cotización actual con fuente y fecha, separá referencia de mercado de una cotización ejecutable de Belo y mostrame qué costos habría que confirmar. Todavía no operes ni asumas mi saldo.`)}>Comparar a {target}</button>)}<button className="secondary" disabled={disabled || !valid} onClick={() => onSend(`Informo que me quedaron ${money(Number(amount), currency)} y prefiero conservarlos para otro viaje. Ayudame a planificar sin convertir ni mover dinero; si propongo una alerta, pedime umbral y consentimiento.`)}>Conservar para otro viaje</button></div>
    <p className="turi-panel-note">Cualquier propuesta financiera requiere validar la conexión con Belo y aprobar la operación en su app.</p>
  </Panel>;
}

function PriceReview({ data, onSend, disabled }: DataProps) {
  const [selected, setSelected] = useState("");
  const radioGroup = useId();
  const expense = data.priceReview.candidates.find(item => item.id === selected);
  return <Panel title="Cobros para revisar" subtitle="Elegí un gasto registrado para buscar referencias comparables. Sin fuentes verificadas no se puede concluir que hubo un sobreprecio.">
    {!data.priceReview.candidates.length && <p className="turi-panel-empty">Primero registrá el gasto o adjuntá el comprobante que querés revisar.</p>}
    {data.priceReview.candidates.map(item => <label className="turi-panel-check" key={item.id}><input type="radio" name={radioGroup} checked={selected === item.id} onChange={() => setSelected(item.id)} /><span><strong>{item.description}</strong><small>{shortDate(item.date)} · {item.category} · {money(item.amount, item.currency)}</small></span></label>)}
    <div className="turi-panel-buttons"><button disabled={disabled || !expense} onClick={() => { if (expense) onSend(`Quiero revisar el gasto registrado "${expense.description}" del ${expense.date}, por ${money(expense.amount, expense.currency)}. Buscá referencias verificables para el mismo producto, zona y condiciones. Pedime los datos que falten; indicá fuente, fecha y límites de la comparación, sin afirmar un cobro indebido sin evidencia.`); }}>Buscar referencias de este gasto</button></div>
  </Panel>;
}

function NextTrip({ data, onSend, disabled }: DataProps) {
  const next = data.nextTrip;
  return <Panel title="Ideas para el próximo viaje" subtitle="Usamos tu experiencia como referencia y buscamos precios nuevos para el destino que elijas.">
    {next.historicalDaily !== null ? <><Row label="Promedio diario registrado" value={money(next.historicalDaily, next.currency)} /><Row label="Referencia con margen del 5%" value={money(next.suggestedDaily!, next.currency)} />{next.suggestedTotal !== null && <Row label={`Para ${next.days} días similares`} value={money(next.suggestedTotal, next.currency)} />}<p className="turi-panel-note">Estimación sobre tus registros, redondeada hacia arriba. No contempla cambios de precios ni diferencias de costo entre destinos; no es una cotización.</p></> : <p className="turi-panel-empty">Cuando tengas gastos y fechas registrados, podemos tomar tu promedio como punto de partida.</p>}
    <div className="turi-panel-buttons">{["Río de Janeiro", "Salvador de Bahía", "Búzios"].map(destination => <button className="secondary" key={destination} disabled={disabled} onClick={() => onSend(`Me interesa planificar mi próximo viaje a ${destination}. Buscá opciones actuales con fotos, pros y contras; primero confirmá conmigo fechas, viajeros y presupuesto. Usá mi historial sólo como referencia orientativa, sin trasladar sus precios al nuevo destino.`)}>{destination}</button>)}</div>
  </Panel>;
}

function PostTripNotice({ data, turi, onSend, disabled }: DataProps) {
  const pending = turi.status?.connections.filter(connection => !connection.connected) || [];
  return <Panel title={data.postTripNotice?.title || "Revisamos el cierre del viaje"}>
    <p>{data.postTripNotice?.body || (data.group.transfers.length ? `Hay ${data.group.transfers.length} cuentas calculadas para revisar con tu grupo.` : "Podés revisar el resumen y las cuentas registradas al terminar el viaje.")}</p>
    <label className="turi-panel-switch"><input type="checkbox" checked={turi.state.alertsConsent} onChange={event => { const consent = event.target.checked; turi.setState(previous => ({ ...previous, alertsConsent: consent })); }} /><span><strong>Permitir avisos del viaje</strong><small>Esta preferencia no programa un envío por sí sola. Podés desactivarla cuando quieras.</small></span></label>
    {pending.length > 0 && <p className="turi-panel-note">Conexiones pendientes: {pending.map(connection => connection.name).join(", ")}. Los avisos externos necesitan un canal configurado y vinculado.</p>}
    <div className="turi-panel-buttons"><button disabled={disabled} onClick={() => onSend("Mostrame el resumen de gastos del viaje y las cuentas pendientes con el grupo.")}>Ver resumen del viaje</button><button className="secondary" disabled={disabled} onClick={() => onSend("Prepará una propuesta para recordarme dentro de 2 días que revise el cierre del viaje. Mostrame fecha, hora y canal para aprobarlo; no confirmes un envío programado si falta configurar la conexión.")}>Proponer recordatorio en 2 días</button></div>
  </Panel>;
}

/** Cards, daily bars, checkboxes and stars adapted from the supplied posttrip
 * and pretrip HTML. All values come from workspace state; demo fixtures and
 * simulated sends, rates or payment approvals are intentionally excluded. */
export default function ConversationPanels(props: Props) {
  const data = useMemo(() => buildConversationPanels(props.turi.state), [props.turi.state]);
  const panelProps = { ...props, data };
  switch (props.kind) {
    case "summary": return <Summary {...panelProps} />;
    case "daily": return <Daily {...panelProps} />;
    case "group": return <Group {...panelProps} />;
    case "recap": return <Recap {...panelProps} />;
    case "checklist": return <Checklist {...panelProps} />;
    case "template": return <Template {...panelProps} />;
    case "feedback": return <Feedback {...panelProps} />;
    case "leftover": return <Leftover {...panelProps} />;
    case "price-review": return <PriceReview {...panelProps} />;
    case "next-trip": return <NextTrip {...panelProps} />;
    case "post-trip-notice": return <PostTripNotice {...panelProps} />;
  }
}
