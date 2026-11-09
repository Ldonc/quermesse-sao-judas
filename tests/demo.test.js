import test from "node:test";
import assert from "node:assert/strict";
import {
  createDemoClient,
  selectDemoRole,
  resetDemo,
} from "../src/services/demoClient.js";
globalThis.localStorage = {
  data: new Map(),
  getItem(k) {
    return this.data.get(k) || null;
  },
  setItem(k, v) {
    this.data.set(k, v);
  },
};
const client = createDemoClient();
const admin = "11111111-1111-4111-8111-111111111111";
const collab = "22222222-2222-4222-8222-222222222222";
test("demo sem login não expõe fechamentos", async () => {
  resetDemo();
  const r = await client.from("closings").select("*");
  assert.equal(r.data.length, 0);
});
test("colaborador fictício não consulta dados financeiros", async () => {
  selectDemoRole("collaborator");
  const r = await client.from("closings").select("*");
  assert.deepEqual(r.data, []);
  const p = await client.from("profiles").select("*");
  assert.equal(p.data.length, 1);
  assert.equal(p.data[0].id, collab);
});
test("admin fictício acessa registros e cenários", async () => {
  selectDemoRole("admin");
  const r = await client.from("closings").select("*");
  assert.ok(r.data.length > 20);
  const events = await client.from("events").select("*");
  assert.equal(events.data.length, 3);
});
test("admin pode cadastrar barraca; colaborador não", async () => {
  selectDemoRole("admin");
  const result = await client
    .from("stalls")
    .insert({ name: "Pastel", emoji: "🥟", slug: "pastel-test", sort_order: 9 })
    .select("id")
    .single();
  assert.ok(result.data.id);
  selectDemoRole("collaborator");
  const bad = await client
    .from("stalls")
    .insert({ name: "Falsa", emoji: "🍕", slug: "falsa" })
    .select("id")
    .single();
  assert.ok(bad.error);
});
test("nega alteração direta de fechamento por colaborador", async () => {
  const bad = await client
    .from("closings")
    .update({ amount: 0 })
    .eq("id", "x")
    .select("id")
    .single();
  assert.ok(bad.error);
});
test("relatório exige perfil admin e dados aprovados", async () => {
  selectDemoRole("admin");
  const user = await client
    .from("profiles")
    .select("*")
    .eq("id", admin)
    .maybeSingle();
  assert.equal(user.data.role, "admin");
  const e = (await client.from("events").select("*")).data[0];
  const res = await client
    .from("report_shares")
    .insert({
      event_id: e.id,
      stall_id: null,
      recipient_id: collab,
      created_by: admin,
    })
    .select("id")
    .single();
  assert.ok(res.data.id);
  selectDemoRole("collaborator");
  const shared = await client.from("report_shares").select("*");
  assert.equal(shared.data.length, 1);
  assert.ok(shared.data[0].total > 0);
});
