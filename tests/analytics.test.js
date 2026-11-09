import test from "node:test";
import assert from "node:assert/strict";
import {
  totalAmount,
  approvedClosings,
  comparison,
  filterClosings,
  asCsv,
} from "../src/lib/analytics.js";
import { safe, parseBRL, money, dateBR } from "../src/lib/format.js";
const stalls = [
  { id: "s1", name: "Fogaça", emoji: "🥟" },
  { id: "s2", name: "Milho", emoji: "🌽" },
];
const rows = [
  {
    id: "a",
    event_id: "2025",
    stall_id: "s1",
    amount: 100,
    status: "approved",
    submitted_by: "u",
    note: "Sem problemas",
  },
  {
    id: "b",
    event_id: "2025",
    stall_id: "s1",
    amount: 999,
    status: "pending",
    submitted_by: "u",
  },
  {
    id: "c",
    event_id: "2026",
    stall_id: "s1",
    amount: 160,
    status: "approved",
    submitted_by: "u",
  },
  {
    id: "d",
    event_id: "2026",
    stall_id: "s2",
    amount: 40,
    status: "approved",
    submitted_by: "v",
  },
];
test("considera somente aprovados nas análises", () =>
  assert.equal(totalAmount(approvedClosings(rows)), 300));
test("compara totais, variação e detalhes por barraca", () => {
  const r = comparison(rows, stalls, "2025", "2026");
  assert.equal(r.leftTotal, 100);
  assert.equal(r.rightTotal, 200);
  assert.equal(r.delta, 100);
  assert.equal(r.percent, 100);
  assert.equal(r.stalls.find((x) => x.id === "s1").delta, 60);
});
test("filtra por edição, barraca, status e busca", () => {
  const r = filterClosings(
    rows,
    { event: "2026", stall: "s1", status: "approved", search: "foga" },
    (id) => stalls.find((x) => x.id === id)?.name,
    () => "",
    () => "",
  );
  assert.equal(r.length, 1);
  assert.equal(r[0].id, "c");
});
test("CSV utiliza escaping contra aspas e separadores", () => {
  const csv = asCsv([
    {
      id: 'x";y',
      event_id: "e",
      stall_id: "s",
      closing_date: "2026-11-01",
      amount: 42,
      status: "approved",
      created_at: "now",
    },
  ]);
  assert.match(csv, /"x"";y"/);
});
test("trata entrada em reais", () => {
  assert.equal(parseBRL("1.250,50"), 1250.5);
  assert.equal(parseBRL("350.00"), 350);
  assert.throws(() => parseBRL(""), /valor positivo/);
  assert.throws(() => parseBRL("-20"), /valor positivo/);
});
test("escapa conteúdo exibido na interface", () =>
  assert.equal(safe('<script>"'), "&lt;script&gt;&quot;"));
test("formata valores e datas em pt-BR", () => {
  assert.match(money(100), /100,00/);
  assert.equal(dateBR("2026-11-09"), "09/11/2026");
});
