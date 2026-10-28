"use client";

import dynamic from "next/dynamic";
import { ArrowRightIcon, ArrowUpRightIcon, CheckIcon, GlobeHemisphereWestIcon, MapPinIcon, PlusIcon } from "@phosphor-icons/react";
import { useMemo, useState, useSyncExternalStore } from "react";
import { EXAMPLE_TRIPS, readGlobeTrips, TRIP_STATUS, type TripStatus } from "@/lib/travel/globe-trips";
import "./travel-hero.css";

const GlobeCanvas = dynamic(() => import("./GlobeCanvas"), { ssr: false, loading: () => <div className="travel-globe-module-loading" role="status"><span className="travel-globe-skeleton" />Preparando tu mundo…</div> });
const TripDrawer = dynamic(() => import("./TripDrawer"));
const STORAGE_KEY = "turi.workspace.v1";
function readWorkspace() { try { return localStorage.getItem(STORAGE_KEY); } catch { return null; } }
function subscribeWorkspace(callback: () => void) {
  const storageChanged = (event: StorageEvent) => { if (event.key === STORAGE_KEY || event.key === null) callback(); };
  window.addEventListener("storage", storageChanged); window.addEventListener("turi:workspace-updated", callback);
  return () => { window.removeEventListener("storage", storageChanged); window.removeEventListener("turi:workspace-updated", callback); };
}
function subscribeClock(callback: () => void) { const timer = setInterval(callback, 60000); return () => clearInterval(timer); }
const clockSnapshot = () => Math.floor(Date.now() / 60000);
const serverClock = () => 0;
const serverWorkspace = () => null;
const FILTERS: { id: "all" | TripStatus; label: string }[] = [{ id: "all", label: "Todos" }, { id: "completed", label: "Vividos" }, { id: "active", label: "En curso" }, { id: "upcoming", label: "Próximos" }];

export default function TravelHero() {
  const workspace = useSyncExternalStore(subscribeWorkspace, readWorkspace, serverWorkspace);
  const minute = useSyncExternalStore(subscribeClock, clockSnapshot, serverClock);
  const realTrips = useMemo(() => readGlobeTrips(workspace, new Date(minute * 60000)), [workspace, minute]);
  const [mode, setMode] = useState<"auto" | "examples" | "mine">("auto");
  const [filter, setFilter] = useState<"all" | TripStatus>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const examples = mode === "examples" || (mode === "auto" && realTrips.length === 0);
  const trips = examples ? EXAMPLE_TRIPS : realTrips;
  const visibleTrips = useMemo(() => trips.filter((trip) => filter === "all" || trip.status === filter), [trips, filter]);
  const selected = trips.find((trip) => trip.id === selectedId);
  const openTuri = () => window.dispatchEvent(new Event("turi:open"));

  return (
    <section className="travel-hero" aria-labelledby="travel-hero-title" id="mi-mundo">
      <div className="travel-hero-layout">
        <div className="travel-hero-copy">
          <a className="travel-brand-label" href="#mi-mundo"><GlobeHemisphereWestIcon size={19} weight="duotone" />belo <span>travel</span></a>
          <h1 id="travel-hero-title">Tu mundo,<br /><span>un viaje a la vez.</span></h1>
          <p>Los que viviste. El que estás viviendo. Los que vienen.<br className="travel-desktop-break" /> Todos tus viajes, en un mismo lugar.</p>
          <button className="travel-primary-cta" onClick={openTuri}>Planeá tu próximo viaje<span><ArrowUpRightIcon size={21} /></span></button>
          <div className="travel-hero-passport">
            <div className="travel-passport-symbol"><MapPinIcon size={25} weight="duotone" /></div>
            <div><strong>Cada pin, una historia tuya.</strong><span>Tocá un destino y abrí su viaje.</span></div>
          </div>
        </div>
        <div className="travel-world">
          <div className="travel-world-topline"><span><span className="travel-world-mark">↗</span> LATINOAMÉRICA</span><button onClick={() => { setMode(examples ? "mine" : "examples"); setSelectedId(null); setFilter("all"); }}>{examples ? "Vista de ejemplo" : "Mis viajes"}<span>{examples ? "Ver mis viajes" : "Ver ejemplo"}<ArrowRightIcon size={12} /></span></button></div>
          <GlobeCanvas trips={visibleTrips} selectedId={selectedId} onSelect={(trip) => setSelectedId(trip.id)} />
        </div>
      </div>
      <div className="travel-passport">
        <div className="travel-passport-heading"><span className="travel-passport-title">{examples ? "Un mundo de posibilidades" : "Tu pasaporte de viajes"}</span><div className="travel-trip-filters" aria-label="Filtrar viajes">{FILTERS.map((item) => <button key={item.id} aria-pressed={filter === item.id} onClick={() => setFilter(item.id)}>{item.label}<span>{item.id === "all" ? trips.length : trips.filter((trip) => trip.status === item.id).length}</span></button>)}</div></div>
        {visibleTrips.length ? <ul className="travel-destination-list">{visibleTrips.map((trip) => <li key={trip.id}><button onClick={() => setSelectedId(trip.id)} aria-haspopup="dialog" className="travel-destination" data-status={trip.status}><span className="travel-destination-icon">{trip.status === "completed" ? <CheckIcon size={17} weight="bold" /> : <MapPinIcon size={19} weight={trip.status === "active" ? "fill" : "regular"} />}</span><span><strong>{trip.destination}</strong><small>{TRIP_STATUS[trip.status].label}{trip.country ? ` · ${trip.country}` : ""}</small></span><ArrowUpRightIcon className="travel-destination-arrow" size={17} /></button></li>)}<li className="travel-add-trip"><button aria-label="Planear un nuevo viaje con Turi" onClick={openTuri}><PlusIcon size={20} /><span>El próximo</span></button></li></ul> : <div className="travel-passport-empty"><MapPinIcon size={26} weight="duotone" /><div><strong>{trips.length ? "Todavía no hay viajes en esta etapa." : "Tu primer pin empieza con un plan."}</strong><p>{trips.length ? "Explorá otra etapa para ver tus destinos." : "Los viajes que planifiques y archives con Turi van a aparecer acá."}</p></div><button onClick={trips.length ? () => setFilter("all") : openTuri}>{trips.length ? "Ver todos" : "Planear un viaje"}<ArrowUpRightIcon size={17} /></button></div>}
        <div className="travel-passport-footnote"><span>{examples ? "Destinos e importes de ejemplo. Explorá un pin para probar la experiencia." : "Conectado con tus viajes de Turi en este dispositivo."}</span><span>Antes. Durante. Después.</span></div>
      </div>
      {selected && <TripDrawer key={selected.id} trip={selected} onClose={() => setSelectedId(null)} />}
    </section>
  );
}
