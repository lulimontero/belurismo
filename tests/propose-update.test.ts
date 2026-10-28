import test from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { executeTool, responseTools, toolArgumentError } from "../lib/turi/agent";
import { emptyWorkspace, expenseSchema, type LocalAction } from "../lib/turi/domain";

type Event = { type: string; [key: string]: unknown };
type Result = { error?: string; recoverable?: boolean; fields?: { field: string; message: string }[]; note?: string; status?: string; action?: LocalAction; participants?: { id: string; name: string }[]; budgetCurrency?: string };
function fixture() {
  const state = emptyWorkspace();
  state.trip = { ...state.trip, destination: "Río · QA ficticio", currency: "BRL", budget: 10000, startDate: "2026-11-10", endDate: "2026-11-15" };
  state.members = ["ana-qa", "bruno-qa"].map((id, index) => ({ id, name: index ? "Bruno QA" : "Ana QA", email: "private@example.test", belotag: "private-qa", adultConfirmed: true, consentConfirmed: true }));
  return state;
}
const valid = () => ({ description: "Alojamiento · simulación QA", amount: 4200, currency: "BRL", homeAmount: 4200, date: "2026-11-10", category: "Alojamiento", payer: "me", shares: [{ memberId: "me", amount: 1400 }, { memberId: "ana-qa", amount: 1400 }, { memberId: "bruno-qa", amount: 1400 }] });
const args = (data: Record<string, unknown>) => ({ type: "expense", label: "Revisar alojamiento del viaje", data });

test("malformed shares produce actionable field paths, no proposal and no ledger change", async () => {
  const state = fixture(), before = structuredClone(state), events: Event[] = [];
  const result = await executeTool("isolated-proposal-qa", "propose_update", args({ ...valid(), shares: [{ name: "Vos", value: 1400 }] }), state, event => events.push(event)) as Result;
  assert.equal(result.error, "invalid_tool_arguments");
  assert.equal(result.recoverable, true);
  assert.ok(result.fields?.some(field => field.field === "data.shares.0.memberId"));
  assert.ok(result.fields?.some(field => field.field === "data.shares.0.amount"));
  assert.match(result.note || "", /no elimines shares/);
  assert.equal(result.budgetCurrency, "BRL");
  assert.deepEqual(result.participants, [{ id: "me", name: "Vos" }, { id: "ana-qa", name: "Ana QA" }, { id: "bruno-qa", name: "Bruno QA" }]);
  assert.doesNotMatch(JSON.stringify(result), /private@example|private-qa/);
  assert.deepEqual(events, []);
  assert.deepEqual(state, before);
});

test("invalid or missing shares, IDs and monetary semantics stay recoverable without becoming personal expenses", async () => {
  const cases: [string, Record<string, unknown>, RegExp][] = [
    ["object instead of array", { ...valid(), shares: { me: 1400, "ana-qa": 1400, "bruno-qa": 1400 } }, /array/i],
    ["unknown participant", { ...valid(), shares: [{ memberId: "stranger", amount: 4200 }] }, /integrantes/],
    ["duplicate participant", { ...valid(), shares: [{ memberId: "me", amount: 2100 }, { memberId: "me", amount: 2100 }] }, /repetidos/],
    ["wrong sum", { ...valid(), shares: [{ memberId: "me", amount: 1400 }] }, /suma/],
    ["display name as payer", { ...valid(), payer: "Vos" }, /integrantes/],
    ["negative share", { ...valid(), shares: [{ memberId: "me", amount: -4200 }] }, /0/],
    ["missing shares", Object.fromEntries(Object.entries(valid()).filter(([key]) => key !== "shares")), /array/i],
    ["missing conversion", Object.fromEntries(Object.entries({ ...valid(), currency: "USD" }).filter(([key]) => key !== "homeAmount")), /number/i],
  ];
  for (const [label, data, message] of cases) {
    const state = fixture(), before = structuredClone(state), events: Event[] = [];
    const result = await executeTool("isolated-proposal-qa", "propose_update", args(data), state, event => events.push(event)) as Result;
    assert.equal(result.recoverable, true, label);
    assert.match(result.fields?.map(field => field.message).join(" ") || "", message, label);
    assert.deepEqual(events, [], label);
    assert.deepEqual(state, before, label);
  }
});

test("a corrected retry emits exactly the requested reviewed proposal and never applies it", async () => {
  const state = fixture(), before = structuredClone(state), events: Event[] = [];
  const invalid = await executeTool("isolated-proposal-qa", "propose_update", args({ ...valid(), shares: ["me", "ana-qa", "bruno-qa"] }), state, event => events.push(event)) as Result;
  assert.equal(invalid.recoverable, true);
  assert.deepEqual(events, []);
  const requested = valid();
  const result = await executeTool("isolated-proposal-qa", "propose_update", args(requested), state, event => events.push(event)) as Result;
  assert.equal(result.status, "awaiting_user_review");
  assert.equal(events.length, 1);
  assert.equal(events[0].type, "proposal");
  assert.deepEqual(events[0].action, result.action);
  const expense = expenseSchema.parse(result.action?.data);
  assert.deepEqual({ ...expense, id: undefined }, { ...requested, id: undefined });
  assert.deepEqual(state, before);
  assert.equal(state.expenses.length, 0);
});

test("the model sees the payer/shares contract, and general tool errors retain safe field diagnostics", () => {
  const tool = responseTools.find(tool => tool.type === "function" && tool.name === "propose_update");
  assert.ok(tool && tool.type === "function");
  assert.match(tool.description || "", /payer es 'me'/);
  const schema = tool.parameters as { properties: { data: { properties: { shares: { type: string; items: { required: string[] } } } } } };
  assert.equal(schema.properties.data.properties.shares.type, "array");
  assert.deepEqual(schema.properties.data.properties.shares.items.required, ["memberId", "amount"]);
  const failure = z.object({ data: z.object({ amount: z.number() }) }).safeParse({ data: { amount: "private raw value" } });
  assert.equal(failure.success, false);
  if (failure.success) return;
  const result = toolArgumentError(failure.error);
  assert.equal(result?.recoverable, true);
  assert.equal(result?.fields[0].field, "data.amount");
  assert.doesNotMatch(JSON.stringify(result), /private raw value/);
  const json = toolArgumentError(new SyntaxError("raw secret in JSON body"));
  assert.equal(json?.fields[0].field, "arguments");
  assert.doesNotMatch(JSON.stringify(json), /raw secret/);
  assert.equal(toolArgumentError(new Error("unrelated failure")), undefined);
});
