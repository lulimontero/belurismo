import test from "node:test";
import assert from "node:assert/strict";
import { buildPriceReview, priceReviewClassification } from "../lib/turi/price-reviews";
import { readConversationWidget } from "../lib/turi/conversation-widgets";
import { emptyWorkspace, expenseSchema } from "../lib/turi/domain";
import { messageForAssistant, workspaceForAssistant } from "../lib/turi/assistant-context";
import { executeTool, realtimeTools, responseTools } from "../lib/turi/agent";
import { backedPriceReviewInput, createSearchSourceProofs, supportedMonetaryAmounts } from "../lib/turi/price-review-sources";
import { seal } from "../lib/turi/security";

process.env.TURI_SESSION_SECRET = "unit-test-price-proof-secret-not-a-real-credential";
const expenses = [{ id: "receipt", description: "Bebida", amount: 75, currency: "BRL" }];
const input = { expenseId: "receipt", referenceMin: 20, referenceMax: 35, currency: "BRL", quantity: 2, unit: "bebida", evidence: "La carta publica BRL 20 y BRL 35 por bebida.", sourceTitle: "Carta consultada", sourceUrl: "https://example.com/carta", conditions: "Dos bebidas informadas; revisar tamaño, fecha y adicionales del comprobante." };
const NOW = Date.parse("2026-10-28T12:00:00.000Z");
function searchOutput(evidence = input.evidence, sourceUrl = input.sourceUrl) {
  const text = evidence + " [1]";
  return [
    { id: "search", type: "web_search_call", status: "completed", action: { type: "search", sources: [{ type: "url", url: sourceUrl }] } },
    { id: "message", type: "message", role: "assistant", status: "completed", content: [{ type: "output_text", text, annotations: [{ type: "url_citation", url: sourceUrl, title: "Carta consultada", start_index: text.length - 3, end_index: text.length }] }] },
  ];
}
function proof(evidence = input.evidence, now = Date.now(), session = "test", sourceUrl = input.sourceUrl) {
  const result = createSearchSourceProofs(session, searchOutput(evidence, sourceUrl), now);
  assert.equal(result.length, 1);
  return result[0];
}
function workspace() {
  const state = emptyWorkspace();
  state.expenses = [expenseSchema.parse({ ...expenses[0], homeAmount: 20000, date: "2026-10-20", category: "Comida" })];
  return state;
}

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
  const result = buildPriceReview(input, expenses, new Date(NOW));
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
  assert.deepEqual(supportedMonetaryAmounts("AR$ 20 a AR$ 35; abre de 10 a 18.", "BRL"), []);
});
test("paid below the minimum is not labelled as within the published interval", () => {
  const below = buildPriceReview(input, [{ ...expenses[0], amount: 10 }]);
  assert.equal(priceReviewClassification(below), "below");
  assert.equal(below.difference, 0);
  assert.equal(priceReviewClassification(buildPriceReview(input, [{ ...expenses[0], amount: 50 }])), "within");
  assert.equal(priceReviewClassification(buildPriceReview(input, expenses)), "above");
});
test("the real backend requires a signed search proof and never persists it in the comparison widget", async () => {
  const events: Record<string, unknown>[] = [];
  const sourceProof = proof().sourceProof;
  const result = await executeTool("test", "present_price_review", { ...input, sourceProof }, workspace(), event => events.push(event));
  assert.equal((result as { status: string }).status, "shown_in_chat");
  assert.equal(events[0].type, "widget");
  assert.doesNotMatch(JSON.stringify(events), /sourceProof/);
  assert.ok(!JSON.stringify(result).includes(sourceProof));
  const invalid = await executeTool("test", "present_price_review", { ...input, sourceProof, referenceMax: 100 }, workspace(), () => assert.fail("invalid reference must not render"));
  assert.equal((invalid as { shown: boolean }).shown, false);
  assert.equal((invalid as { recoverable: boolean }).recoverable, true);
});
test("missing, forged and cookie-purpose proofs give a recoverable failure with zero widgets", async () => {
  const cookie = seal({ id: "test", expires: Date.now() + 900000 });
  for (const sourceProof of [undefined, "invented-proof", cookie]) {
    const result = await executeTool("test", "present_price_review", { ...input, sourceProof }, workspace(), () => assert.fail("unproven price must not render"));
    assert.equal((result as { shown: boolean }).shown, false);
    assert.equal((result as { recoverable: boolean }).recoverable, true);
    assert.match((result as { note: string }).note, /search_travel/);
  }
});
test("proof is transportable and bound to the session, exact source and fifteen-minute validity", () => {
  const source = JSON.parse(JSON.stringify(proof(input.evidence, NOW)));
  assert.equal(backedPriceReviewInput("test", { ...input, sourceProof: source.sourceProof }, NOW + 899999).referenceMax, 35);
  assert.throws(() => backedPriceReviewInput("another-session", { ...input, sourceProof: source.sourceProof }, NOW), /sesión/);
  assert.throws(() => backedPriceReviewInput("test", { ...input, sourceUrl: "https://example.com/invented-empty-page", sourceProof: source.sourceProof }, NOW), /fuente/);
  assert.throws(() => backedPriceReviewInput("test", { ...input, sourceProof: source.sourceProof }, NOW + 900000), /venció/);
  assert.throws(() => backedPriceReviewInput("test", { ...input, sourceProof: proof(input.evidence, NOW + 1).sourceProof }, NOW), /venció/);
  const changed = source.sourceProof.slice(0, 35) + (source.sourceProof[35] === "A" ? "B" : "A") + source.sourceProof.slice(36);
  assert.throws(() => backedPriceReviewInput("test", { ...input, sourceProof: changed }, NOW), /no es válida/);
});
test("free-model evidence cannot replace signed search text or invent a different price range", () => {
  const sourceProof = proof("La entrada general cuesta R$ 40. Abierto de 10 a 18; edades de 3 a 12.", NOW).sourceProof;
  const valid = { ...input, referenceMin: 40, referenceMax: 40, evidence: "La entrada general cuesta R$ 40.", sourceProof };
  assert.equal(backedPriceReviewInput("test", valid, NOW).referenceMin, 40);
  assert.throws(() => backedPriceReviewInput("test", { ...valid, referenceMin: 30, referenceMax: 35, evidence: "La entrada general cuesta R$ 30 a R$ 35." }, NOW), /no coincide/);
  assert.throws(() => backedPriceReviewInput("test", { ...valid, referenceMin: 10, referenceMax: 18, evidence: "La entrada general cuesta R$ 40. Abierto de 10 a 18; edades de 3 a 12." }, NOW), /importes y su moneda/);
  assert.throws(() => backedPriceReviewInput("test", { ...valid, currency: "USD" }, NOW), /importes y su moneda/);
  assert.deepEqual(supportedMonetaryAmounts("Entrada R$ 40; abre de 10 a 18; menores de 3 a 12.", "BRL"), [40]);
  assert.deepEqual(supportedMonetaryAmounts("BRL 1.234,50 a BRL 2.000,75", "BRL"), [1234.5, 2000.75]);
});
test("search URL lists, fabricated citations, malformed spans and mixed-source paragraphs mint no proof", () => {
  const sourceOnly = searchOutput().slice(0, 1);
  assert.deepEqual(createSearchSourceProofs("test", sourceOnly, NOW), []);
  assert.deepEqual(createSearchSourceProofs("test", searchOutput().slice(1), NOW), []);
  const fakeCitation = searchOutput();
  const message = fakeCitation[1] as { content: { annotations: { url: string }[] }[] };
  message.content[0].annotations[0].url = "https://example.com/not-returned-by-web";
  assert.deepEqual(createSearchSourceProofs("test", fakeCitation, NOW), []);
  const malformed = searchOutput();
  (malformed[1] as { content: { annotations: { end_index: number }[] }[] }).content[0].annotations[0].end_index = 99999;
  assert.deepEqual(createSearchSourceProofs("test", malformed, NOW), []);
  const mixed = searchOutput();
  const mixedMessage = mixed[1] as { content: { annotations: Record<string, unknown>[] }[] };
  mixedMessage.content[0].annotations.push({ ...mixedMessage.content[0].annotations[0], url: "https://another.example/price" });
  assert.deepEqual(createSearchSourceProofs("test", mixed, NOW), []);
});
test("separate paragraphs cannot lend another source's monetary amounts to a comparison", () => {
  const first = "Entrada R$ 40. [1]", second = "Bebida R$ 10 a R$ 18. [2]";
  const output = [
    { type: "web_search_call", status: "completed", action: { sources: [{ type: "url", url: input.sourceUrl }, { type: "url", url: "https://another.example/menu" }] } },
    { type: "message", content: [{ type: "output_text", text: `${first}\n\n${second}`, annotations: [
      { type: "url_citation", url: input.sourceUrl, title: "Entrada", start_index: first.length - 3, end_index: first.length },
      { type: "url_citation", url: "https://another.example/menu", title: "Bebida", start_index: first.length + 2 + second.length - 3, end_index: first.length + 2 + second.length },
    ] }] },
  ];
  const sources = createSearchSourceProofs("test", output, NOW);
  assert.equal(sources.length, 2);
  assert.equal(sources[0].evidence, "Entrada R$ 40.");
  assert.throws(() => backedPriceReviewInput("test", { ...input, referenceMin: 10, referenceMax: 18, evidence: "Bebida R$ 10 a R$ 18.", sourceProof: sources[0].sourceProof }, NOW), /no coincide/);
});
test("search_travel mints usable proofs from actual provider response metadata without an arbitrary page fetch", async () => {
  process.env.OPENAI_API_KEY = "unit-test-placeholder-not-a-real-key";
  const originalFetch = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = async request => {
    const url = request instanceof Request ? request.url : String(request);
    assert.equal(url, "https://api.openai.com/v1/responses");
    requests++;
    return new Response(JSON.stringify({ id: "response-test", object: "response", status: "completed", output: searchOutput(), output_text: input.evidence + " [1]" }), { status: 200, headers: { "content-type": "application/json" } });
  };
  try {
    const sourceEvents: Record<string, unknown>[] = [];
    const searched = await executeTool("test", "search_travel", { query: "Consultar carta publicada y precio por bebida" }, workspace(), event => sourceEvents.push(event)) as { sourceProofs: { sourceProof: string }[] };
    assert.equal(requests, 1, "the only fetch must be the mocked search provider, never a page supplied by the model");
    assert.equal(searched.sourceProofs.length, 1);
    assert.doesNotMatch(JSON.stringify(sourceEvents), /sourceProof/);
    const events: Record<string, unknown>[] = [];
    const result = await executeTool("test", "present_price_review", { ...input, sourceProof: searched.sourceProofs[0].sourceProof }, workspace(), event => events.push(event));
    assert.equal((result as { status: string }).status, "shown_in_chat");
    assert.equal(events.length, 1);
    assert.doesNotMatch(JSON.stringify(events), /sourceProof/);
  } finally { globalThis.fetch = originalFetch; }
});
test("both text and Realtime require the proof in their tool schema without changing the persisted widget schema", () => {
  for (const tools of [responseTools, realtimeTools]) {
    const tool = tools.find(tool => "name" in tool && tool.name === "present_price_review") as { parameters: { required: string[]; properties: Record<string, unknown> } };
    assert.ok(tool.parameters.required.includes("sourceProof"));
    assert.ok(tool.parameters.properties.sourceProof);
  }
  const comparison = buildPriceReview({ ...input, sourceProof: "must-not-persist" }, expenses);
  assert.doesNotMatch(JSON.stringify(comparison), /sourceProof|must-not-persist/);
});
test("assistant context omits the private archive and library without altering persisted state", () => {
  const state = emptyWorkspace(); state.postTrip.flightWatches = [{ id: "watch", destination: "Roma", currency: "USD", maxPrice: 500, createdAt: "2026-10-28T12:00:00Z" }];
  const context = workspaceForAssistant(state);
  assert.deepEqual(context.postTrip.flightWatches, []); assert.equal(state.postTrip.flightWatches.length, 1);
  assert.equal(context.postTrip.tripId, state.postTrip.tripId);
});
