import test from "node:test";
import assert from "node:assert/strict";
import { mergeTravelOptions, optionToText, publishedOptionPrice, readTravelOptions, travelOptionsInputSchema, type TravelOption } from "../lib/turi/travel-options";
import { messageSchema } from "../lib/turi/domain";

const option: TravelOption = {
  id: "hotel-one",
  kind: "hotel",
  name: "Alojamiento de prueba",
  location: "Zona de prueba",
  summary: "Datos de una ficha de prueba, no una oferta real.",
  price: { amount: 120, currency: "USD", basis: "night", note: "Referencia publicada; tarifa para las fechas por confirmar.", evidence: "Desde USD 120 por noche.", stayNights: 5 },
  facts: [{ label: "Ocupación", value: "2 adultos" }, { label: "Desayuno", value: "Por confirmar" }],
  pros: ["Permite comparar servicios"],
  cons: ["No confirma disponibilidad"],
  caveat: "Impuestos y cancelación por confirmar.",
  sourceUrl: "https://hotel.com/alojamiento",
  sourceTitle: "Ficha de alojamiento de prueba",
  checkedAt: "2026-10-28T17:00:00.000Z",
};

test("el contexto de las tarjetas conserva datos decisivos al seguir el chat o pasar a voz", () => {
  const text = optionToText(option);
  for (const data of ["2 adultos", "Desayuno: Por confirmar", "5 noches", "USD 600", option.checkedAt, option.sourceUrl, option.caveat])
    assert.ok(text.includes(data), data);
  assert.match(optionToText({ ...option, price: null }), /Precio a consultar/);
});

test("un presupuesto o una tarifa no publicada no se muestran como precio del alojamiento", () => {
  assert.equal(publishedOptionPrice({ ...option.price!, amount: 1500, evidence: "Presupuesto USD 1500 para cinco noches" }), null);
  assert.equal(publishedOptionPrice({ ...option.price!, note: "Precio a consultar para la estadía" }), null);
  assert.equal(publishedOptionPrice({ ...option.price!, evidence: "Consultar disponibilidad" }), null);
  assert.equal(publishedOptionPrice({ ...option.price!, amount: 1500, evidence: "Desde USD 120 por noche" }), null);
  assert.equal(publishedOptionPrice({ ...option.price!, amount: 0, evidence: "Entrada gratuita" })?.amount, 0);
  assert.equal(publishedOptionPrice(null), null);
  assert.equal(publishedOptionPrice(option.price)?.amount, 120);
});

test("dos tandas de tarjetas sobreviven al guardado y las actualizaciones no duplican un lugar", () => {
  const second = { ...option, id: "hotel-two", name: "Segunda opción", sourceUrl: "https://otro-hotel.com/" };
  const combined = mergeTravelOptions([option], [second]);
  const restored = messageSchema.parse(JSON.parse(JSON.stringify({ id: "assistant", role: "assistant", text: "", options: combined })));
  assert.deepEqual(restored.options?.map((card) => card.name), [option.name, second.name]);
  const refreshed = mergeTravelOptions(combined, [{ ...option, summary: "Información actualizada" }]);
  assert.equal(refreshed.length, 2);
  assert.equal(refreshed[0].summary, "Información actualizada");
  assert.equal(mergeTravelOptions([], Array.from({ length: 15 }, (_, index) => ({ ...option, name: `Opción ${index}` }))).length, 12);
});

test("las tarjetas requieren páginas concretas y precios con moneda y base válidas", () => {
  assert.equal(travelOptionsInputSchema.safeParse({ options: [option] }).success, true);
  assert.equal(travelOptionsInputSchema.safeParse({ options: [{ ...option, sourceUrl: "https://www.google.com/maps/search/hotel" }] }).success, false);
  assert.equal(travelOptionsInputSchema.safeParse({ options: [{ ...option, price: { ...option.price, amount: -20 } }] }).success, false);
  assert.equal(travelOptionsInputSchema.safeParse({ options: [{ ...option, sourceUrl: "javascript:alert(1)" }] }).success, false);
  assert.equal(readTravelOptions([{ ...option, price: null }]).length, 1);
  const signedImageUrl = `https://cdn.hotel.com/photo.jpg?signature=${"a".repeat(2100)}`;
  assert.equal(readTravelOptions([{ ...option, image: { url: signedImageUrl, sourceUrl: option.sourceUrl } }]).length, 1);
});
