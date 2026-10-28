"use client";

import type { ConversationWidget } from "@/lib/turi/conversation-widgets";
import "./belo-hotels.css";

type Widget = Extract<ConversationWidget, { type: "belo-hotels" }>;

const ars = (value: number) => `ARS ${Math.round(value).toLocaleString("es-AR")}`;
const day = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("es-AR", { day: "numeric", month: "short" });

// Mirrors a travel.belo.app search result: photo with discount tag, stars, rating box,
// struck list price, price per night and "Impuestos incluidos".
export default function BeloHotels({ widget }: { widget: Widget }) {
  return (
    <section className="belo-hotels" aria-label={`Hoteles de belo travel en ${widget.destination}`}>
      <header>
        <div>
          <strong>{widget.hotels.length} hoteles en belo travel</strong>
          <span>
            {widget.destination} · precios publicados el {day(widget.checkedAt)} para 1 noche
            ({day(widget.checkedDates[0])} al {day(widget.checkedDates[1])}). Confirmá disponibilidad para tus fechas.
          </span>
        </div>
        <a href={widget.searchUrl} target="_blank" rel="noopener noreferrer">Ver búsqueda en belo travel ↗</a>
      </header>
      <ul>
        {widget.hotels.map((hotel) => (
          <li key={hotel.id}>
            <a className="belo-hotel" href={hotel.url} target="_blank" rel="noopener noreferrer"
              aria-label={`${hotel.name}, ${hotel.address}. ${ars(hotel.price)} por noche. Abrir en belo travel`}>
              <div className="belo-hotel-photo">
                {hotel.image
                  ? <img src={hotel.image} alt="" loading="lazy" />
                  : <span className="belo-hotel-nophoto">Foto en belo travel</span>}
                <span className="belo-hotel-discount">-{hotel.discount}% DTO</span>
              </div>
              <div className="belo-hotel-info">
                {hotel.stars && <span className="belo-hotel-stars" aria-label={`${hotel.stars} estrellas`}>
                  {"★".repeat(hotel.stars)}<span>{"★".repeat(5 - hotel.stars)}</span>
                </span>}
                <h4>{hotel.name}</h4>
                <p>{hotel.address}</p>
                <div className="belo-hotel-rating">
                  <span>{hotel.ratingLabel}</span>
                  <b>{hotel.rating}</b>
                </div>
              </div>
              <div className="belo-hotel-price">
                <small>1 habitación, {widget.adults} adulto{widget.adults === 1 ? "" : "s"}</small>
                <s>{ars(hotel.listPrice)}</s>
                <strong>{ars(hotel.price)}</strong>
                <small>/ 1 noche</small>
                <small className="belo-hotel-taxes">✓ Impuestos incluidos</small>
              </div>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
