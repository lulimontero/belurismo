"use client";

import { ArrowUpRightIcon, CalendarBlankIcon, CheckIcon, ClockIcon, MapPinIcon, UsersThreeIcon, XIcon } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { formatTripDate, TRIP_STATUS, tripMoney, type GlobeTrip } from "@/lib/travel/globe-trips";

export default function TripDrawer({ trip, onClose }: { trip: GlobeTrip; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [tab, setTab] = useState<"summary" | "itinerary" | "expenses">("summary");
  const status = TRIP_STATUS[trip.status];
  const remaining = trip.budget - trip.spent;
  const tabs = [{ id: "summary", label: "Resumen" }, { id: "itinerary", label: "Itinerario" }, { id: "expenses", label: "Gastos" }] as const;
  useEffect(() => {
    const node = dialog.current, previousOverflow = document.body.style.overflow;
    node?.showModal(); document.body.style.overflow = "hidden";
    return () => { node?.close(); document.body.style.overflow = previousOverflow; };
  }, []);

  return (
    <dialog ref={dialog} className="travel-trip-dialog" aria-labelledby="travel-trip-title" onCancel={(event) => { event.preventDefault(); onClose(); }} onClick={(event) => { if (event.target === dialog.current) onClose(); }}>
      <article className="travel-trip-panel">
        <header className="travel-trip-topline">
          <span>Tu pasaporte de viajes</span><button onClick={onClose} aria-label="Cerrar detalle del viaje" autoFocus><XIcon size={21} /></button>
        </header>
        <div className={`travel-trip-cover travel-trip-cover-${trip.status}`} aria-hidden="true">
          <span className="travel-ticket-grid" /><MapPinIcon size={77} weight="duotone" /><span className="travel-ticket-country">{trip.country || "BELO TRAVEL"}</span>
          <span className="travel-ticket-stamp">{trip.status === "completed" ? "UN VIAJE PARA RECORDAR" : trip.status === "active" ? "AHORA, ACÁ" : "LO MEJOR ESTÁ POR VENIR"}</span>
        </div>
        <div className="travel-trip-content">
          <div className="travel-trip-meta"><span className={`travel-status travel-status-${trip.status}`}>{trip.status === "completed" ? <CheckIcon size={13} weight="bold" /> : <ClockIcon size={13} />}{status.label}</span>{trip.source === "example" && <span className="travel-example-label">Viaje de ejemplo</span>}</div>
          <p className="travel-trip-intro">{status.action}</p>
          <h2 id="travel-trip-title">{trip.destination}</h2>
          <p className="travel-trip-dates"><CalendarBlankIcon size={16} />{trip.startDate ? `${formatTripDate(trip.startDate)}${trip.endDate ? ` al ${formatTripDate(trip.endDate)}` : ""}` : "Fechas por definir"}</p>
          <div className="travel-trip-group"><UsersThreeIcon size={17} /><span>{trip.travelers} {trip.travelers === 1 ? "viajero" : "viajeros"}{trip.members.length ? ` · ${trip.members.join(", ")}` : ""}</span></div>
          {trip.coordinates?.approximate && <p className="travel-location-note">Ubicación aproximada del país. Agregá la ciudad en Turi para ubicar el pin con más precisión.</p>}
          {!trip.coordinates && <p className="travel-location-note">Este destino todavía no tiene una ubicación en el planeta de Latinoamérica. Toda su información está disponible acá.</p>}
          <div className="travel-detail-tabs" role="tablist" aria-label="Información del viaje">
            {tabs.map((item) => <button key={item.id} role="tab" id={`travel-tab-${item.id}`} aria-controls={`travel-panel-${item.id}`} aria-selected={tab === item.id} tabIndex={tab === item.id ? 0 : -1} onClick={() => setTab(item.id)} onKeyDown={(event) => {
              if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
              event.preventDefault();
              const index = tabs.findIndex((item) => item.id === tab);
              const next = event.key === "Home" ? 0 : event.key === "End" ? 2 : (index + (event.key === "ArrowRight" ? 1 : -1) + 3) % 3;
              setTab(tabs[next].id); document.getElementById(`travel-tab-${tabs[next].id}`)?.focus();
            }}>{item.label}{item.id === "itinerary" && trip.itinerary.length > 0 && <small>{trip.itinerary.length}</small>}</button>)}
          </div>
          <div role="tabpanel" id={`travel-panel-${tab}`} aria-labelledby={`travel-tab-${tab}`} className="travel-detail-body" tabIndex={0}>
            {tab === "summary" && <>
              <h3>{trip.status === "completed" ? "Lo que dejó el viaje" : trip.status === "active" ? "Tu viaje, hasta ahora" : "El plan va tomando forma"}</h3>
              <p className="travel-detail-description">{trip.status === "completed" ? "Tus recorridos, los gastos y el grupo. Todo lo que registraste, en un mismo lugar." : trip.status === "active" ? "Seguí el itinerario y mirá cuánto registraste de tu presupuesto mientras disfrutás del viaje." : "Fechas, presupuesto y actividades. Esto es lo que ya tenés organizado para tu próxima aventura."}</p>
              <dl className="travel-budget-summary">
                <div><dt>{trip.status === "completed" ? "Gasto registrado" : trip.status === "active" ? "Llevás registrado" : "Gastos registrados"}</dt><dd>{tripMoney(trip.spent, trip.currency)}</dd></div>
                <div><dt>Presupuesto</dt><dd>{trip.budget ? tripMoney(trip.budget, trip.currency) : "Por definir"}</dd></div>
                <div><dt>{remaining < 0 ? "Sobre el presupuesto" : "Margen del presupuesto"}</dt><dd>{trip.budget ? tripMoney(Math.abs(remaining), trip.currency) : "Por definir"}</dd></div>
              </dl>
              {trip.reserve > 0 && <p className="travel-location-note">Incluye {tripMoney(trip.reserve, trip.currency)} previstos para la vuelta. Es parte del plan de gastos.</p>}
              <div className="travel-trip-summary-links">
                <button onClick={() => setTab("itinerary")}><CalendarBlankIcon size={20} /><span><strong>{trip.itinerary.length} {trip.itinerary.length === 1 ? "actividad registrada" : "actividades registradas"}</strong><small>{trip.status === "completed" ? "Volvé a recorrer tu itinerario" : "Abrí todo lo que está planificado"}</small></span><ArrowUpRightIcon size={18} /></button>
                <button onClick={() => setTab("expenses")}><span className="travel-expense-symbol">$</span><span><strong>El detalle de tus gastos</strong><small>{trip.expenses.length} {trip.expenses.length === 1 ? "registro" : "registros"} en este viaje</small></span><ArrowUpRightIcon size={18} /></button>
              </div>
            </>}
            {tab === "itinerary" && <>
              <h3>{trip.status === "completed" ? "El viaje que viviste" : "Todo lo que está en el plan"}</h3>
              {trip.itinerary.length === 0 ? <p className="travel-detail-empty">Todavía no hay actividades registradas. Podés sumarlas a tu viaje con Turi.</p> : <ol className="travel-itinerary">{[...trip.itinerary].sort((a, b) => a.start.localeCompare(b.start)).map((item, index) => <li key={item.id}><span className="travel-itinerary-number">{String(index + 1).padStart(2, "0")}</span><div><time dateTime={item.start}>{formatTripDate(item.start)}</time><h4>{item.title}</h4>{item.location && <p className="travel-itinerary-location"><MapPinIcon size={13} />{item.location}</p>}{item.notes && <p>{item.notes}</p>}</div></li>)}</ol>}
            </>}
            {tab === "expenses" && <>
              <h3>Los gastos, a mano</h3>
              <p className="travel-detail-description">Importes registrados en el viaje, en la moneda de cada gasto.</p>
              {trip.expenses.length === 0 ? <p className="travel-detail-empty">Todavía no registraste gastos en este viaje.</p> : <ul className="travel-expenses">{[...trip.expenses].sort((a, b) => b.date.localeCompare(a.date)).map((expense) => <li key={expense.id}><div><strong>{expense.description}</strong><span>{expense.category} · {formatTripDate(expense.date)}</span></div><b>{tripMoney(expense.amount, expense.currency)}</b></li>)}</ul>}
            </>}
          </div>
        </div>
        <footer className="travel-trip-footer">{trip.source === "example" ? <p>Vista de ejemplo para explorar las tres etapas del viaje.</p> : <p>Datos de tus viajes guardados con Turi.</p>}<button onClick={() => { onClose(); window.dispatchEvent(new Event("turi:open")); }}>{trip.source === "example" ? "Planear mi propio viaje" : "Abrir Turi"}<ArrowUpRightIcon size={18} /></button></footer>
      </article>
    </dialog>
  );
}
