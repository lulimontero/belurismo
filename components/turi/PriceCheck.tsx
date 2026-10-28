"use client";

import { WarningIcon } from "@phosphor-icons/react";
import { priceCheckRatio, type PriceCheckResult } from "@/lib/turi/price-check";
import "./price-check.css";

// es-AR prints "BRL 20"; travelers read the local symbols.
const symbols: Record<string, string> = { ARS: "$", BRL: "R$", USD: "US$", EUR: "€" };
const amount = (value: number, currency: string) =>
  `${symbols[currency] ?? currency} ${value.toLocaleString("es-AR", {
    maximumFractionDigits: value >= 1000 || Number.isInteger(value) ? 0 : 1,
  })}`;
const range = (min: number, max: number, currency: string) =>
  `${amount(min, currency)} – ${amount(max, currency)}`;

export default function PriceCheck({ check }: { check: PriceCheckResult }) {
  const ratio = priceCheckRatio(check);
  const asked = check.askedInCurrency;
  const status = ratio === null ? "typical" : ratio > 1.2 ? "high" : ratio > 1 ? "above" : "ok";
  // Bars share one scale so the red line reads the same across rows.
  const scale = Math.max(asked ?? 0, ...check.references.map((reference) => reference.max)) * 1.08;
  const position = (value: number) => `${Math.min(100, (value / scale) * 100)}%`;
  const title = status === "high" ? "Posible cobro abusivo"
    : status === "above" ? "Un poco por encima de lo habitual"
    : status === "ok" ? "Precio dentro de lo habitual"
    : `Precio típico de ${check.item}`;

  return <div className="turi-price-check">
    <section className={`turi-price-card ${status}`} aria-label={title}>
      <header>
        <h3>{status === "high" && <WarningIcon size={18} weight="bold" aria-hidden />}{title}</h3>
        {ratio !== null && ratio > 1 && <span className="turi-price-ratio">x{ratio.toLocaleString("es-AR")} del máximo típico</span>}
      </header>
      {asked !== null && check.asked && <p className="turi-price-lead">
        Lo que suele pagar la gente por {check.item}{check.sourceUrl ? "" : " (referencia orientativa)"}. La línea {status === "ok" ? "violeta" : "roja"} es lo que te piden: <strong>{amount(check.asked.amount, check.asked.currency)}</strong>
        {check.asked.currency !== check.currency && <> ≈ <strong>{amount(asked, check.currency)}</strong></>}
      </p>}
      <ul>
        {check.references.map((reference) => <li key={reference.label}>
          <div className="turi-price-row">
            <span>{reference.label}</span>
            <strong>{range(reference.min, reference.max, check.currency)}</strong>
          </div>
          {asked === null && check.homeCurrency && check.homeRate && <small>
            ≈ {range(reference.min * check.homeRate, reference.max * check.homeRate, check.homeCurrency)}
          </small>}
          {asked !== null && <div className="turi-price-bar" aria-hidden>
            <span className="turi-price-band" style={{ left: position(reference.min), width: `calc(${position(reference.max)} - ${position(reference.min)})` }} />
            <span className="turi-price-marker" style={{ left: position(asked) }} />
          </div>}
        </li>)}
      </ul>
      <footer>
        {check.sourceUrl
          ? <a href={check.sourceUrl} target="_blank" rel="noreferrer">{check.sourceTitle ?? new URL(check.sourceUrl).hostname}</a>
          : <span>Referencia orientativa: sin fuente verificada.</span>}
        {check.quoteUpdatedAt && <span> · Cotización indicativa de mercado (ExchangeRate-API), no la de Belo, Pix o tarjeta.</span>}
        {status === "high" && <span> Pedí la carta o el precio por escrito y verificá el destinatario antes de pagar.</span>}
      </footer>
    </section>
    {check.phrase && <section className="turi-price-card phrase" aria-label={`Cómo pedirlo en ${check.phrase.language}`}>
      <h3>Cómo pedirlo en {check.phrase.language}</h3>
      <p className="turi-price-phrase" lang={check.phrase.language.toLowerCase().startsWith("portu") ? "pt" : undefined}>“{check.phrase.text}”</p>
      <small>{check.phrase.pronunciation}</small>
      {check.phrase.translation && <small className="turi-price-translation">{check.phrase.translation}</small>}
    </section>}
  </div>;
}
