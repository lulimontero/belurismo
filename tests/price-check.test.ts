import test from "node:test";
import assert from "node:assert/strict";
import { buildPriceCheck, priceCheckRatio, priceCheckToText } from "../lib/turi/price-check";
import { readConversationWidget } from "../lib/turi/conversation-widgets";

const references = [
  { label: "Quiosque de playa", min: 20, max: 35 },
  { label: "Bar / centro", min: 18, max: 28 },
  { label: "Restaurante", min: 22, max: 35 },
];
const base = { item: "una caipirinha", currency: "BRL", references, homeCurrency: "ARS", sourceTitle: null, sourceUrl: null, phrase: null };
const rates: Record<string, number> = { "ARS-BRL": 1 / 268, "BRL-ARS": 268 };
const quote = async (from: string, to: string) => ({ rate: rates[`${from}-${to}`], updatedAt: "2026-10-28T00:00:00.000Z" });

test("convierte lo que le piden y lo compara con el máximo típico", async () => {
  const check = await buildPriceCheck({ ...base, asked: { amount: 20000, currency: "ARS" } }, quote);
  assert.equal(check.askedInCurrency, 74.63);
  assert.equal(check.homeRate, 268);
  assert.equal(priceCheckRatio(check), 2.1);
  assert.match(priceCheckToText(check), /x2\.1 del máximo típico/);
  assert.ok(readConversationWidget({ id: "w1", type: "price-check", check }));
});

test("sin precio pedido muestra rangos con equivalente y la frase", async () => {
  const check = await buildPriceCheck({ ...base, asked: null, sourceTitle: "Guía", sourceUrl: "https://example.com/precios",
    phrase: { language: "portugués", text: "Uma caipirinha de limão, por favor.", pronunciation: "úma caipirínia de limãu, por favór", translation: null } }, quote);
  assert.equal(priceCheckRatio(check), null);
  assert.equal(check.homeRate, 268);
  assert.match(priceCheckToText(check), /Cómo pedirlo en portugués/);
});

test("rechaza rangos invertidos y buscadores como fuente", async () => {
  await assert.rejects(buildPriceCheck({ ...base, asked: null, references: [{ label: "Bar", min: 40, max: 20 }] }, quote));
  await assert.rejects(buildPriceCheck({ ...base, asked: null, sourceUrl: "https://www.google.com/search?q=caipirinha" }, quote));
});
