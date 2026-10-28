import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("lote de tarjetas: guarda las creadas aunque una falle", async () => {
  process.chdir(mkdtempSync(join(tmpdir(), "turi-cards-")));
  process.env.BELO_API_KEY = "belo_test_x";
  delete process.env.UPSTASH_REDIS_REST_URL;
  let n = 0;
  globalThis.fetch = (async (_url: string, init: RequestInit) => {
    const { name } = JSON.parse(String(init.body));
    if (name === "Francisco")
      return new Response(JSON.stringify({ error: { code: "x", message: "y" } }), { status: 422 });
    n++;
    return new Response(JSON.stringify({ id: `c${n}`, name, lastFour: `000${n}`, brand: "visa", type: "virtual", status: "active", canFreeze: true }), { status: 201 });
  }) as typeof fetch;
  const { createCards, loadCards } = await import("../lib/turi/belo-cards");
  const results = await createCards(["Marco", "Francisco", "Juan"], "100.00");
  assert.deepEqual(results.map((r) => r.ok), [true, false, true]);
  assert.match(results[1].error!, /tope de tarjetas virtuales o falta saldo/);
  const saved = await loadCards();
  assert.deepEqual(saved.map((c) => [c.holder, c.limitUsd]), [["Marco", "100.00"], ["Juan", "100.00"]]);
});

test("el widget de tarjetas acepta creadas y fallidas, y descarta datos sensibles", async () => {
  const { readConversationWidget } = await import("../lib/turi/conversation-widgets");
  const widget = readConversationWidget({ id: "w", type: "cards", cards: [
    { holder: "Marco", lastFour: "0001", status: "active", limitUsd: "100.00", pan: "4111111111111111" },
    { holder: "Francisco", lastFour: null, status: "failed", limitUsd: "100.00", error: "falta saldo" },
  ] });
  assert.equal(widget?.type, "cards");
  assert.equal(widget?.type === "cards" && "pan" in widget.cards[0], false);
});

test("ante un 429 de belo reintenta con la misma Idempotency-Key", async () => {
  process.env.BELO_API_KEY = "belo_test_x";
  const keys: string[] = [];
  globalThis.fetch = (async (_url: string, init: RequestInit) => {
    keys.push((init.headers as Record<string, string>)["Idempotency-Key"]);
    if (keys.length === 1) return new Response("{}", { status: 429, headers: { "retry-after": "1" } });
    return new Response(JSON.stringify({ id: "c9", name: "Ana", lastFour: "0009", brand: "visa", type: "virtual", status: "active", canFreeze: true }), { status: 201 });
  }) as typeof fetch;
  const { createCards } = await import("../lib/turi/belo-cards");
  const [result] = await createCards(["Ana"], null);
  assert.equal(result.ok, true);
  assert.equal(keys.length, 2);
  assert.equal(keys[0], keys[1]);
});
