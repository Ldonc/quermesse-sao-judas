import test from "node:test";
import assert from "node:assert/strict";
import { createAdminViews } from "../src/ui/admin.js";
import { createCollaboratorViews } from "../src/ui/collaborator.js";
import { safe, money, dateBR } from "../src/lib/format.js";
const state = {
  user: { id: "u1" },
  profile: { full_name: "Pessoa Exemplo", role: "admin" },
  stalls: [
    { id: "s1", name: "Fogaça", emoji: "🥟", active: true, sort_order: 1 },
  ],
  events: [
    {
      id: "e1",
      title: "Quermesse 2026",
      starts_on: "2026-11-01",
      ends_on: "2026-11-15",
      active: true,
    },
    {
      id: "e0",
      title: "Quermesse 2025",
      starts_on: "2025-11-01",
      ends_on: "2025-11-15",
      active: false,
    },
  ],
  profiles: [
    { id: "u1", full_name: "Pessoa Exemplo", role: "admin", active: true },
    {
      id: "u2",
      full_name: "Colaborador Exemplo",
      role: "collaborator",
      active: true,
    },
  ],
  assignments: [{ user_id: "u2", stall_id: "s1" }],
  closings: [
    {
      id: "c1",
      stall_id: "s1",
      event_id: "e1",
      submitted_by: "u2",
      closing_date: "2026-11-09",
      amount: 120,
      receipt_path: "sample.png",
      note: "",
      status: "approved",
      created_at: "2026-11-09",
    },
  ],
  feedback: [],
  shares: [],
  audit: [],
  filters: { event: "", stall: "", status: "", search: "" },
  comparison: { left: "e0", right: "e1" },
};
const ctx = {
  state,
  safe,
  money,
  dateBR,
  stallName: (id) => state.stalls.find((x) => x.id === id)?.name || "",
  profileName: (id) => state.profiles.find((x) => x.id === id)?.full_name || "",
  eventName: (id) => state.events.find((x) => x.id === id)?.title || "",
  pill: (x) => x,
  activeEvents: () => state.events.filter((x) => x.active),
};
test("todas as telas administrativas podem ser renderizadas", () => {
  const v = createAdminViews(ctx);
  for (const [name, render] of Object.entries(v)) {
    assert.equal(typeof render, "function", name);
    assert.match(render(), /<(div|section|form)/, name);
  }
  assert.match(v.comparisonPage(), /Detalhamento por barraca/);
  assert.match(v.review(), /filter-form/);
  assert.match(v.stallsPage(), /stall-form/);
});
test("todas as telas de colaborador podem ser renderizadas", () => {
  const v = createCollaboratorViews(ctx);
  for (const [name, render] of Object.entries(v))
    assert.match(render(), /<(div|section)/, name);
  assert.match(v.register(), /Novo fechamento/);
  assert.match(v.reports(), /Relatórios liberados/);
});
