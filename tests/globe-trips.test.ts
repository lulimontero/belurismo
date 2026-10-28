import assert from "node:assert/strict";
import test from "node:test";
import { emptyWorkspace } from "../lib/turi/domain";
import { locateDestination, readGlobeTrips, tripStatus } from "../lib/travel/globe-trips";

test("trip stages respect the destination timezone and include the final day", () => {
  const now = new Date("2026-10-29T01:00:00Z");
  assert.equal(tripStatus("2026-10-25", "2026-10-28", "America/Argentina/Buenos_Aires", now), "active");
  assert.equal(tripStatus("2026-10-25", "2026-10-27", "America/Argentina/Buenos_Aires", now), "completed");
  assert.equal(tripStatus("2026-10-29", "2026-11-01", "America/Argentina/Buenos_Aires", now), "upcoming");
  assert.equal(tripStatus("", "", "America/Argentina/Buenos_Aires", now), "upcoming");
});

test("places match complete names, accents and aliases without inventing unknown city coordinates", () => {
  assert.equal(locateDestination("Río de Janeiro, Brasil").coordinates?.lat, -22.907);
  assert.equal(locateDestination("Escapada a CDMX").country, "México");
  assert.equal(locateDestination("Colombia").coordinates?.approximate, true);
  assert.equal(locateDestination("Madrid").coordinates, null);
  assert.equal(locateDestination("Rosario").coordinates, null);
  assert.equal(locateDestination("Córdoba, España").coordinates, null);
  assert.equal(locateDestination("San Juan, Argentina").country, "Argentina");
});

test("current and archived trips retain their actual itinerary and expenses", () => {
  const state = emptyWorkspace();
  state.trip.destination = "Cusco"; state.trip.startDate = "2026-06-14"; state.trip.endDate = "2026-06-21";
  state.trip.budget = 1200;
  state.expenses.push({ id: "e1", description: "Tren", amount: 170, currency: "USD", homeAmount: 170, date: "2026-06-18", category: "Transporte", payer: "me", shares: [] });
  const trips = readGlobeTrips(JSON.stringify({ state }), new Date("2026-10-28T12:00:00Z"));
  assert.equal(trips.length, 1); assert.equal(trips[0].source, "current");
  assert.equal(trips[0].status, "completed"); assert.equal(trips[0].spent, 170);
  assert.equal(trips[0].expenses[0].description, "Tren");
  state.postTrip.archivedTrips.push({ id: "archive-1", name: "Cusco", createdAt: "2026-06-22T12:00:00Z", snapshot: { trip: state.trip, expenses: state.expenses, members: [], itinerary: [], reminders: [], rateAlerts: [], assistantPreferences: state.assistantPreferences, remainder: null } });
  const archived = readGlobeTrips(JSON.stringify({ state }));
  assert.equal(archived.length, 1); assert.equal(archived[0].source, "archive");
  state.trip = { ...state.trip, destination: "Bariloche", startDate: "2027-07-16", endDate: "2027-07-23" };
  const both = readGlobeTrips(JSON.stringify({ state }), new Date("2026-10-28T12:00:00Z"));
  assert.equal(both.length, 2); assert.equal(both[1].status, "upcoming");
});

test("invalid storage and missing dates are safe; unmapped destinations remain accessible", () => {
  for (const input of [null, "{", "null", '{"state":{}}']) assert.deepEqual(readGlobeTrips(input), []);
  const state = emptyWorkspace(); state.trip.destination = "Rosario";
  const trips = readGlobeTrips(JSON.stringify({ state }));
  assert.equal(trips.length, 1); assert.equal(trips[0].coordinates, null); assert.equal(trips[0].status, "upcoming");
});
