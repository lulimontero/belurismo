import test from "node:test";
import assert from "node:assert/strict";
import { currencies, emptyWorkspace } from "../lib/turi/domain";
import { setReportedRemainder } from "../lib/turi/posttrip";
import {
  appendFlightWatch, appendRateAlert, formatExchangeRate,
  nextReferenceCurrency, originCurrencyFromText, remainderMatchesDraft,
  removeFlightWatch, removeRateAlert, validRateThreshold,
} from "../lib/turi/posttrip-finance";

test("remainder origin is attached to the leftover, never a desired target mentioned later", () => {
  const cases = [
    ["Me sobraron 240 reales y quiero pasarlos a dólares", "BRL"],
    ["Informo que me sobraron BRL 240 y quiero convertirlos a USD", "BRL"],
    ["¿Qué hago con los dólares que me sobraron?", "USD"],
    ["Quiero convertir 100 euros a dólares", "EUR"],
    ["Me quedaron ARS 1000 y los quiero convertir a BRL", "ARS"],
    ["Tengo R$ 240, quiero pasar a USD", "BRL"],
    ["Me sobraron 240 reales y 100 dólares", undefined],
    ["Quiero pasar a dólares", undefined],
    ["Quiero convertir a USD", undefined],
    ["Me sobraron $240", undefined],
  ] as const;
  for (const [text, expected] of cases) assert.equal(originCurrencyFromText(text), expected, text);
});

test("a reference currency remains selectable when source changes or USD is also the home currency", () => {
  for (const origin of currencies) {
    for (const desired of currencies) {
      const target = nextReferenceCurrency(origin, desired);
      assert.notEqual(target, origin);
      assert.ok(currencies.includes(target));
      if (desired !== origin) assert.equal(target, desired);
    }
  }
  assert.equal(nextReferenceCurrency("USD", "USD"), "ARS");
  assert.equal(nextReferenceCurrency("ARS", "ARS"), "USD");
});

test("small exchange rates stay visible and valid rather than being rounded to zero or rejected as fractional cents", () => {
  assert.equal(validRateThreshold("0.00000001"), true);
  assert.equal(validRateThreshold("0.0007"), true);
  assert.equal(validRateThreshold("1.123456789"), true);
  for (const value of ["", " ", "0", "-0.1", "Infinity", "NaN", "1000000001"]) assert.equal(validRateThreshold(value), false, value);
  assert.match(formatExchangeRate(0.00000001, "USD"), /0,00000001/);
  assert.match(formatExchangeRate(0.0007, "USD"), /0,0007/);
  assert.equal(validRateThreshold("0.000000000000001"), true);
  assert.match(formatExchangeRate(1e-15, "USD"), /1,00E-15/);
});

test("a keeping decision only applies to the same stated amount and origin currency", () => {
  const state = setReportedRemainder(emptyWorkspace(), { amount: 240, currency: "BRL", status: "keep" });
  assert.equal(remainderMatchesDraft(state.postTrip.remainder, "BRL", "240"), true);
  assert.equal(remainderMatchesDraft(state.postTrip.remainder, "USD", "240"), false);
  assert.equal(remainderMatchesDraft(state.postTrip.remainder, "BRL", "241"), false);
  assert.equal(remainderMatchesDraft(state.postTrip.remainder, "BRL", ""), false);
  assert.equal(state.postTrip.remainder?.status, "keep");
});

test("saving a sub-cent currency threshold preserves existing alerts and requires consent and different currencies", () => {
  const state = emptyWorkspace();
  const next = appendRateAlert(state, { from: "ARS", to: "USD", threshold: 0.0007, direction: "below", consent: true });
  assert.equal(next.rateAlerts[0].threshold, 0.0007);
  assert.equal(next.alertsConsent, true);
  assert.equal(state.rateAlerts.length, 0);
  assert.throws(() => appendRateAlert(next, { from: "ARS", to: "USD", threshold: 0.0007, direction: "below", consent: true }), /Ya guardaste/);
  assert.throws(() => appendRateAlert(state, { from: "ARS", to: "ARS", threshold: 1, direction: "above", consent: true }), /monedas/);
  assert.throws(() => appendRateAlert(state, { from: "ARS", to: "USD", threshold: 0.0007, direction: "below", consent: false }), /permiso/);
});

test("a full alert list refuses additions without dropping its oldest entry, then removing one frees that slot", () => {
  const state = emptyWorkspace();
  state.rateAlerts = Array.from({ length: 20 }, (_, index) => ({ id: `alert-${index}`, from: "BRL", to: "ARS", threshold: index + 1, direction: "above", sent: false }));
  const saved = JSON.stringify(state);
  assert.throws(() => appendRateAlert(state, { from: "BRL", to: "ARS", threshold: 100, direction: "above", consent: true }), /20 alertas/);
  assert.equal(JSON.stringify(state), saved);
  const removed = removeRateAlert(state, "alert-7");
  const appended = appendRateAlert(removed, { from: "BRL", to: "ARS", threshold: 100, direction: "above", consent: true });
  assert.equal(appended.rateAlerts.length, 20);
  assert.ok(appended.rateAlerts.some(item => item.id === "alert-0"));
  assert.ok(!appended.rateAlerts.some(item => item.id === "alert-7"));
});

test("flight interests enforce their limit without deleting older destinations and can be removed explicitly", () => {
  const state = emptyWorkspace();
  state.postTrip.flightWatches = Array.from({ length: 10 }, (_, index) => ({ id: `watch-${index}`, destination: `Destino ${index}`, maxPrice: 500, currency: "USD", createdAt: "2026-10-28T12:00:00Z" }));
  const saved = JSON.stringify(state);
  assert.throws(() => appendFlightWatch(state, { destination: "Lisboa", currency: "USD", maxPrice: 700 }), /10 intereses/);
  assert.equal(JSON.stringify(state), saved);
  const removed = removeFlightWatch(state, "watch-4");
  const appended = appendFlightWatch(removed, { destination: "Lisboa", currency: "USD", maxPrice: 700 });
  assert.equal(appended.postTrip.flightWatches.length, 10);
  assert.ok(appended.postTrip.flightWatches.some(item => item.id === "watch-0"));
  assert.ok(!appended.postTrip.flightWatches.some(item => item.id === "watch-4"));
  assert.throws(() => appendFlightWatch(appended, { destination: "LISBOA", currency: "USD", maxPrice: 700 }), /ya est[aá]n guardados/);
});
