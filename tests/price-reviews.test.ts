import test from "node:test";
import assert from "node:assert/strict";
import { buildPriceReview, priceReviewClassification } from "../lib/turi/price-reviews";
import { readConversationWidget } from "../lib/turi/conversation-widgets";
import { emptyWorkspace, expenseSchema } from "../lib/turi/domain";
import { messageForAssistant, workspaceForAssistant } from "../lib/turi/assistant-context";
import { executeTool } from "../lib/turi/agent";

const expenses = [{ id: "receipt", description: "Bebida", amount: 75, currency: "BRL" }];
const input = { expenseId: "receipt", referenceMin: 20, referenceMax: 35, currency: "BRL", quantity: 2, unit: "bebida", evidence: "La carta publica BRL 20 y BRL 35 por bebida.", sourceTitle: "Carta consultada", sourceUrl: "https://example.com/carta", conditions: "Dos bebidas informadas; revisar tamaño, fecha y adicionales del comprobante." };
test("a comparison-only message carries receipt, units, source and limitations into text and resumed voice", () => {
  const comparison = buildPriceReview(input, expenses);
  const text = messageForAssistant({ text: "", widgets: [{ id: "comparison", type: "price-review-result", comparison }] });
  assert.match(text, /pagado BRL 75/);
  assert.match(text, /por bebida, cantidad 2/);
  assert.ok(text.includes(input.sourceUrl));
  assert.ok(text.includes(input.conditions));
  assert.match(text, /no verifica un cobro indebido/);
});
test("a documented comparison uses the recorded original amount and matched quantity, then survives message persistence", () => {
  const result = buildPriceReview(input, expenses, new Date("2026-10-28T12:00:00Z"));
  assert.equal(result.paid, 75); assert.equal(result.referenceTotalMax, 70); assert.equal(result.difference, 5);
  assert.equal(readConversationWidget({ id: "comparison", type: "price-review-result", comparison: JSON.parse(JSON.stringify(result)) })?.type, "price-review-result");
});
test("review refuses a missing receipt, mixed currencies, ambiguous currency and invented reference values", () => {
  assert.throws(() => buildPriceReview({ ...input, expenseId: "unknown" }, expenses));
  assert.throws(() => buildPriceReview({ ...input, currency: "USD" }, expenses), /misma moneda/);
  assert.throws(() => buildPriceReview({ ...input, evidence: "El precio es $20 a $35" }, expenses), /identificar la moneda/);
  assert.throws(() => buildPriceReview({ ...input, referenceMax: 60 }, expenses), /importes publicados/);
  assert.throws(() => buildPriceReview({ ...input, referenceMin: 40 }, expenses));
  assert.throws(() => buildPriceReview({ ...input, evidence: "La carta publica USD 20 a USD 35 por bebida. También acepta BRL para pagar." }, expenses), /mezcla monedas/);
  assert.throws(() => buildPriceReview({ ...input, evidence: "BRL 20 a BRL 35 por bebida; equivalente EUR 5." }, expenses), /mezcla monedas/);
  assert.throws(() => buildPriceReview({ ...input, evidence: "BRL 20 a BRL 35 por bebida; el rango original está en dólares." }, expenses), /mezcla monedas/);
  assert.throws(() => buildPriceReview({ ...input, evidence: "BRL 20 a BRL 35 por bebida; equivalente U$D 5." }, expenses), /mezcla monedas/);
});

test("an AR$ reference is not mistaken for Brazilian R$ or an ambiguous dollar", () => {
  const result = buildPriceReview({ ...input, currency: "ARS", evidence: "La carta publica AR$ 20 a AR$ 35 por bebida." }, [{ ...expenses[0], currency: "ARS" }]);
  assert.equal(result.currency, "ARS");
  assert.equal(result.referenceTotalMin, 40);
});

test("paid below the minimum is not labelled as within the published interval", () => {
  const below = buildPriceReview(input, [{ ...expenses[0], amount: 10 }]);
  assert.equal(priceReviewClassification(below), "below");
  assert.equal(below.difference, 0);
  assert.equal(priceReviewClassification(buildPriceReview(input, [{ ...expenses[0], amount: 50 }])), "within");
  assert.equal(priceReviewClassification(buildPriceReview(input, expenses)), "above");
});
test("the real backend emits comparison cards and gives recoverable errors without inventing ranges", async () => {
  const state = emptyWorkspace(); state.expenses = [expenseSchema.parse({ ...expenses[0], homeAmount: 20000, date: "2026-10-20", category: "Comida" })];
  const events: Record<string, unknown>[] = [];
  const result = await executeTool("test", "present_price_review", input, state, event => events.push(event));
  assert.equal((result as { status: string }).status, "shown_in_chat"); assert.equal(events[0].type, "widget");
  const invalid = await executeTool("test", "present_price_review", { ...input, referenceMax: 100 }, state, () => assert.fail("invalid reference must not render"));
  assert.equal((invalid as { shown: boolean }).shown, false);
});
test("assistant context omits the private archive and library without altering persisted state", () => {
  const state = emptyWorkspace(); state.postTrip.flightWatches = [{ id: "watch", destination: "Roma", currency: "USD", maxPrice: 500, createdAt: "2026-10-28T12:00:00Z" }];
  const context = workspaceForAssistant(state);
  assert.deepEqual(context.postTrip.flightWatches, []); assert.equal(state.postTrip.flightWatches.length, 1);
  assert.equal(context.postTrip.tripId, state.postTrip.tripId);
});
