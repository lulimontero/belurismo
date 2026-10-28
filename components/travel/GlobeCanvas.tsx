"use client";

import { ArrowCounterClockwiseIcon, ArrowLeftIcon, ArrowRightIcon, MinusIcon, PlusIcon } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { TRIP_STATUS, type GlobeTrip } from "@/lib/travel/globe-trips";
import { createGlobe, type GlobeEngine, type LatinAmerica } from "./globe-engine";

type Props = { trips: GlobeTrip[]; selectedId: string | null; onSelect: (trip: GlobeTrip) => void };

export default function GlobeCanvas({ trips, selectedId, onSelect }: Props) {
  const host = useRef<HTMLDivElement>(null), labels = useRef<HTMLDivElement>(null), engine = useRef<GlobeEngine | null>(null);
  const latest = useRef(trips);
  const [state, setState] = useState<"loading" | "ready" | "unavailable">("loading");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => { latest.current = trips; engine.current?.setTrips(trips); }, [trips]);
  useEffect(() => { engine.current?.select(selectedId); }, [selectedId]);
  useEffect(() => {
    const controller = new AbortController();
    let globe: GlobeEngine | undefined;
    void (async () => {
      try {
        const response = await fetch("/data/latin-america.geojson", { signal: controller.signal });
        if (!response.ok) throw new Error("Cartografía no disponible");
        const geography: LatinAmerica = await response.json();
        if (controller.signal.aborted || !host.current || !labels.current) return;
        globe = createGlobe(host.current, labels.current, geography, () => { globe?.dispose(); engine.current = null; setState("unavailable"); });
        engine.current = globe; globe.setTrips(latest.current); setState("ready");
      } catch {
        if (!controller.signal.aborted) setState("unavailable");
      }
    })();
    return () => { controller.abort(); globe?.dispose(); engine.current = null; };
  }, [attempt]);

  return (
    <div className="travel-globe-interactive" data-globe-state={state}>
      <div ref={host} className="travel-globe-canvas" role="img" aria-label="Planeta 3D con el relieve de Latinoamérica. Los destinos también están disponibles en la lista de viajes." />
      <div className="travel-globe-shadow" aria-hidden="true" />
      <div ref={labels} className="travel-globe-pins" aria-label="Destinos en el planeta">
        {trips.filter((trip) => trip.coordinates).map((trip) => (
          <button key={trip.id} data-trip-id={trip.id} data-status={trip.status} className={`travel-globe-pin ${selectedId === trip.id ? "is-selected" : ""}`}
            aria-label={`${trip.destination}, ${TRIP_STATUS[trip.status].label}. Ver viaje${trip.source === "example" ? " de ejemplo" : ""}`}
            aria-pressed={selectedId === trip.id} aria-haspopup="dialog" onPointerEnter={() => engine.current?.pause(true)} onFocus={() => engine.current?.pause(true)} onClick={() => onSelect(trip)} style={{ visibility: "hidden" }}>
            <span className="travel-pin-target" aria-hidden="true" />
            <span className="travel-pin-name" aria-hidden="true">
              <span className="travel-pin-status" />
              {trip.destination}
              <span className="travel-pin-detail">{TRIP_STATUS[trip.status].label}<span>Ver viaje ↗</span></span>
            </span>
          </button>
        ))}
      </div>
      {state === "loading" && <div className="travel-globe-loading" role="status"><span className="travel-globe-skeleton" /><span>Preparando tu mundo…</span></div>}
      {state === "unavailable" && <div className="travel-globe-fallback" role="status"><strong>Tu viaje sigue acá.</strong><p>El planeta 3D no pudo cargarse en este dispositivo. Podés abrir cada destino desde la lista.</p><button onClick={() => { setState("loading"); setAttempt((value) => value + 1); }}>Volver a cargar el planeta</button></div>}
      {state === "ready" && <div className="travel-globe-controls" aria-label="Controles del planeta">
        <span className="travel-drag-hint">Arrastrá para explorar</span>
        <div>
          <button aria-label="Girar planeta a la izquierda" onClick={() => engine.current?.rotate(-1)}><ArrowLeftIcon size={16} /></button>
          <button aria-label="Girar planeta a la derecha" onClick={() => engine.current?.rotate(1)}><ArrowRightIcon size={16} /></button>
          <span className="travel-control-divider" />
          <button aria-label="Alejar planeta" onClick={() => engine.current?.zoom(-1)}><MinusIcon size={16} /></button>
          <button aria-label="Acercar planeta" onClick={() => engine.current?.zoom(1)}><PlusIcon size={16} /></button>
          <button aria-label="Restablecer vista de Latinoamérica" onClick={() => engine.current?.reset()}><ArrowCounterClockwiseIcon size={16} /></button>
        </div>
      </div>}
    </div>
  );
}
