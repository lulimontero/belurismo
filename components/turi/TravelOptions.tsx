"use client";

import { useState } from "react";
import {
  ArrowUpRightIcon,
  CheckIcon,
  ImageIcon,
  MapPinIcon,
} from "@phosphor-icons/react";
import type { TravelOption } from "@/lib/turi/travel-options";
import "./travel-options.css";

const kindLabels: Record<TravelOption["kind"], string> = {
  hotel: "Alojamiento",
  restaurant: "Gastronomía",
  activity: "Actividad",
  beach: "Playa",
  place: "Para conocer",
};
const priceBasis = {
  night: "por noche",
  person: "por persona",
  total: "en total",
};

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    currencyDisplay: "code",
    maximumFractionDigits: 2,
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
  }).format(amount);
}

function OptionPhoto({ option }: { option: TravelOption }) {
  const [failedUrl, setFailedUrl] = useState<string>();
  const image = option.image;
  const hasImage = image && failedUrl !== image.url;
  return (
    <a
      className={`turi-option-photo ${hasImage ? "" : "unavailable"}`}
      href={image?.sourceUrl || option.sourceUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Ver fotos de ${option.name} en la fuente`}
    >
      {hasImage ? (
        // These source images are dynamic. Load them directly without allowing arbitrary hosts in the image optimizer.
        <img
          src={image.url}
          alt={image.alt || option.name}
          width={640}
          height={400}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailedUrl(image.url)}
        />
      ) : (
        <span className="turi-option-photo-fallback">
          <ImageIcon size={25} aria-hidden="true" />
          <strong>Foto no disponible</strong>
          <span>
            Ver fotos en la fuente <ArrowUpRightIcon size={12} aria-hidden="true" />
          </span>
        </span>
      )}
    </a>
  );
}

function OptionCard({
  option,
  disabled,
  onChoose,
}: {
  option: TravelOption;
  disabled: boolean;
  onChoose: (message: string) => void;
}) {
  const price = option.price;
  const checkedAt = new Intl.DateTimeFormat("es-AR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(option.checkedAt));
  return (
    <article className="turi-option" aria-label={option.name}>
      <div className="turi-option-overview">
        <OptionPhoto option={option} />
        <div className="turi-option-intro">
          <span className="turi-option-kind">{kindLabels[option.kind]}</span>
          <h3>{option.name}</h3>
          <p className="turi-option-location">
            <MapPinIcon size={13} aria-hidden="true" />
            {option.location}
          </p>
          <p className="turi-option-summary">{option.summary}</p>
        </div>
      </div>
      <div className="turi-option-details">
        <div className="turi-option-price">
          {price ? (
            <>
              <p>
                <strong>{formatMoney(price.amount, price.currency)}</strong>
                <span>{priceBasis[price.basis]}</span>
              </p>
              {price.basis === "night" && price.stayNights && (
                <p className="turi-option-estimate">
                  {formatMoney(price.amount * price.stayNights, price.currency)} estimados
                  {" "}para {price.stayNights} {price.stayNights === 1 ? "noche" : "noches"}.
                  {" "}Calculado desde el valor por noche.
                </p>
              )}
              <small>{price.note}</small>
            </>
          ) : (
            <>
              <p><strong>Precio a consultar</strong></p>
              <small>Para tus fechas y cantidad de viajeros.</small>
            </>
          )}
        </div>
        {!!option.facts.length && (
          <dl className="turi-option-facts">
            {option.facts.map((fact, index) => (
              <div key={`${fact.label}-${index}`}>
                <dt>{fact.label}</dt>
                <dd>{fact.value}</dd>
              </div>
            ))}
          </dl>
        )}
        <div className="turi-option-comparison">
          <div>
            <h4><CheckIcon size={14} aria-hidden="true" /> A favor</h4>
            <ul>{option.pros.map((pro, index) => <li key={index}>{pro}</li>)}</ul>
          </div>
          <div>
            <h4>A considerar</h4>
            <ul>{option.cons.map((con, index) => <li key={index}>{con}</li>)}</ul>
          </div>
        </div>
        <p className="turi-option-caveat">{option.caveat}</p>
        <p className="turi-option-availability">
          Disponibilidad y condiciones{option.kind === "hotel" ? " de cancelación" : " de la reserva"} a confirmar con la fuente.
        </p>
        <div className="turi-option-footer">
          <div className="turi-option-source">
            <a href={option.sourceUrl} target="_blank" rel="noopener noreferrer">
              {option.sourceTitle} <ArrowUpRightIcon size={12} aria-hidden="true" />
            </a>
            <small>Consultado el <time dateTime={option.checkedAt}>{checkedAt}</time></small>
          </div>
          <button
            type="button"
            className="turi-option-choose"
            disabled={disabled}
            aria-label={`Me interesa ${option.name}`}
            onClick={() => onChoose(
              `Me interesa ${option.name}, en ${option.location}. Fuente: ${option.sourceUrl}. Ayudame a evaluar si encaja con mi viaje y qué falta confirmar antes de decidir.`,
            )}
          >
            Me interesa <ArrowUpRightIcon size={15} aria-hidden="true" />
          </button>
        </div>
      </div>
    </article>
  );
}

export default function TravelOptions({
  options,
  disabled = false,
  onChoose,
}: {
  options: TravelOption[];
  disabled?: boolean;
  onChoose: (message: string) => void;
}) {
  return (
    <div className="turi-travel-options" aria-label="Opciones para tu viaje">
      {options.map((option) => (
        <OptionCard key={option.id} option={option} disabled={disabled} onChoose={onChoose} />
      ))}
    </div>
  );
}
