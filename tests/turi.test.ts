import test from "node:test";
import assert from "node:assert/strict";
import {
  emptyWorkspace,
  equalShares,
  settleExpenses,
  budgetSummary,
  applyLocalAction,
  localTimeToIso,
  expenseSchema,
  workspaceSchema,
} from "../lib/turi/domain";
import {
  seal,
  unseal,
  assertSameOrigin,
  safeEqual,
} from "../lib/turi/security";
import { beloPermission } from "../lib/turi/belo";
import { validateAttachments } from "../lib/turi/agent";

test("centavos compartidos se conservan y las transferencias saldan todas las cuentas", () => {
  const shares = equalShares(100, ["me", "b", "c"]);
  assert.equal(
    shares.reduce((sum, item) => sum + Math.round(item.amount * 100), 0),
    10000,
  );
  const expense = expenseSchema.parse({
    id: "1",
    description: "Cena",
    amount: 100,
    currency: "ARS",
    homeAmount: 100,
    date: "2026-10-28",
    payer: "me",
    category: "Comida",
    shares,
  });
  const result = settleExpenses([expense]);
  assert.deepEqual(result.transfers, [
    { from: "b", to: "me", amount: 33.33 },
    { from: "c", to: "me", amount: 33.33 },
  ]);
  assert.equal(
    Object.values(result.net).reduce((sum, n) => sum + Math.round(n * 100), 0),
    0,
  );
});
test("el gasto personalizado exige participantes y partes que coincidan con el total", () => {
  const state = emptyWorkspace();
  state.members.push({
    id: "b",
    name: "Lu",
    email: "",
    belotag: "",
    adultConfirmed: true,
    consentConfirmed: true,
  });
  const expense = {
    id: "1",
    description: "Taxi",
    amount: 100,
    currency: "ARS",
    homeAmount: 100,
    date: "2026-10-28",
    payer: "me",
    category: "Transporte",
    shares: [
      { memberId: "me", amount: 40 },
      { memberId: "b", amount: 50 },
    ],
  };
  assert.throws(
    () =>
      applyLocalAction(state, {
        type: "expense",
        label: "Taxi",
        data: expense,
      }),
    /suma/,
  );
  assert.throws(
    () =>
      applyLocalAction(state, {
        type: "expense",
        label: "Taxi",
        data: { ...expense, shares: [{ memberId: "extraño", amount: 100 }] },
      }),
    /integrantes/,
  );
  assert.throws(() => equalShares(100, ["me", "me"]), /distintos/);
});
test("la reserva de vuelta no se cuenta como gastada y el presupuesto usa los días correctos", () => {
  const state = emptyWorkspace();
  state.trip = {
    ...state.trip,
    budget: 300000,
    returnReserve: 30000,
    startDate: "2026-01-01",
    endDate: "2026-01-10",
  };
  const expense = (id: string, date: string, amount: number) =>
    expenseSchema.parse({
      id,
      date,
      amount,
      homeAmount: amount,
      description: "Gasto",
      category: "Comida",
      currency: "ARS",
    });
  state.expenses = [
    expense("1", "2026-01-03", 90000),
    expense("2", "2026-01-04", 50000),
  ];
  const summary = budgetSummary(state, "2026-01-04");
  assert.equal(summary.days, 10);
  assert.equal(summary.daysLeft, 6);
  assert.equal(summary.spent, 140000);
  assert.equal(summary.spentToday, 50000);
  assert.equal(summary.available, 130000);
  assert.equal(summary.remaining, 160000);
  assert.equal(summary.daily, 27000);
  assert.equal(summary.projected, 350000);
  assert.equal(budgetSummary(state, "2025-12-01").daysLeft, 10);
  assert.equal(budgetSummary(state, "2025-12-01").projected, 140000);
});
test("una propuesta de gasto se aplica una sola vez y no mezcla importes de la misma moneda", () => {
  const state = emptyWorkspace(),
    action = {
      type: "expense" as const,
      label: "Comida",
      data: {
        id: "same",
        description: "Cena",
        amount: 20,
        homeAmount: 20,
        currency: "ARS",
        date: "2026-10-28",
        category: "Comida",
      },
    };
  const once = applyLocalAction(state, action);
  assert.equal(applyLocalAction(once, action).expenses.length, 1);
  assert.throws(
    () =>
      applyLocalAction(state, {
        ...action,
        data: { ...action.data, homeAmount: 1 },
      }),
    /misma moneda/,
  );
  assert.throws(
    () =>
      applyLocalAction(state, {
        type: "trip",
        label: "Viaje",
        data: { budget: 20, returnReserve: 21 },
      }),
    /monto/,
  );
  assert.throws(() =>
    workspaceSchema.parse({
      ...state,
      trip: { ...state.trip, timeZone: "inventada" },
    }),
  );
});
test("los horarios del viaje se convierten usando su zona, no la del servidor", () => {
  assert.equal(
    localTimeToIso("2026-01-05T10:00", "America/Sao_Paulo"),
    "2026-01-05T13:00:00.000Z",
  );
  assert.equal(
    localTimeToIso("2026-07-05T10:00", "Europe/Madrid"),
    "2026-07-05T08:00:00.000Z",
  );
  assert.throws(
    () => localTimeToIso("2026-03-08T02:30", "America/New_York"),
    /no existe/,
  );
});
test("las credenciales cifradas detectan cambios y no se ven en el valor almacenado", () => {
  process.env.TURI_SESSION_SECRET = "secret-for-unit-tests-only-32-characters";
  const encoded = seal({ token: "private-credential", id: "test-user" });
  assert.ok(!encoded.includes("private-credential"));
  assert.deepEqual(unseal(encoded), {
    token: "private-credential",
    id: "test-user",
  });
  const bytes = Buffer.from(encoded, "base64url");
  bytes[30] ^= 1;
  assert.throws(() => unseal(bytes.toString("base64url")), /sesión/);
  assert.equal(safeEqual("test", "test"), true);
  assert.equal(safeEqual("test", "test-long"), false);
});
test("los endpoints de escritura rechazan solicitudes de otros sitios o sin origen", () => {
  assert.throws(
    () =>
      assertSameOrigin(
        new Request("https://belurismo.vercel.app/api/turi/chat", {
          headers: { origin: "https://otro.example" },
        }),
      ),
    /otro origen/,
  );
  assert.throws(
    () =>
      assertSameOrigin(
        new Request("https://belurismo.vercel.app/api/turi/chat"),
      ),
    /otro origen/,
  );
  assert.doesNotThrow(() =>
    assertSameOrigin(
      new Request("https://belurismo.vercel.app/api/turi/chat", {
        headers: { origin: "https://belurismo.vercel.app" },
      }),
    ),
  );
});
test("MCP niega por defecto todo y sólo acepta nombres exactos revisados", () => {
  process.env.BELO_READ_TOOLS = "get_my_balance";
  process.env.BELO_PREPARE_TOOLS = "prepare_conversion";
  assert.equal(beloPermission("get_my_balance"), "read");
  assert.equal(beloPermission("prepare_conversion"), "prepare");
  assert.equal(beloPermission("execute_transfer"), null);
  assert.equal(beloPermission("get_my_balance_extra"), null);
  assert.equal(beloPermission("create_card"), null);
});
test("adjuntos rechazan tipos falsificados y tamaños que no coinciden", () => {
  const bytes = Buffer.from("%PDF-1.7\nSample");
  const file = {
    name: "reserva.pdf",
    type: "application/pdf",
    size: bytes.length,
    data: `data:application/pdf;base64,${bytes.toString("base64")}`,
  };
  assert.doesNotThrow(() => validateAttachments([file]));
  assert.throws(() => validateAttachments([{ ...file, size: 5000 }]), /tamaño/);
  const fake = Buffer.from("not a PDF");
  assert.throws(
    () =>
      validateAttachments([
        {
          ...file,
          size: fake.length,
          data: `data:application/pdf;base64,${fake.toString("base64")}`,
        },
      ]),
    /contenido/,
  );
});
