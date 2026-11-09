// Simulador local para portfólio. NÃO é um backend seguro nem usa dados reais.
// O isolamento de autorização efetivo em produção é feito por RLS do Supabase.
const ADMIN = "11111111-1111-4111-8111-111111111111";
const COLLAB = "22222222-2222-4222-8222-222222222222";
const COLLAB2 = "33333333-3333-4333-8333-333333333333";
const events = [
  {
    id: "aaaa0000-0000-4000-8000-000000000024",
    title: "Quermesse de 2024",
    starts_on: "2024-10-11",
    ends_on: "2024-10-20",
    active: false,
  },
  {
    id: "aaaa0000-0000-4000-8000-000000000025",
    title: "Quermesse de 2025",
    starts_on: "2025-10-10",
    ends_on: "2025-10-19",
    active: false,
  },
  {
    id: "aaaa0000-0000-4000-8000-000000000026",
    title: "Quermesse de 2026",
    starts_on: "2026-11-01",
    ends_on: "2026-11-15",
    active: true,
  },
];
const stalls = [
  ["Fogaça", "🥟"],
  ["Churrasco", "🔥"],
  ["Hambúrguer", "🍔"],
  ["Cachorro-quente", "🌭"],
  ["Milho", "🌽"],
  ["Pipoca", "🍿"],
  ["Algodão-doce", "🍭"],
  ["Lanche de pernil", "🥪"],
].map(([name, emoji], i) => ({
  id: `bbbb0000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
  slug: `barraca-${i + 1}`,
  name,
  emoji,
  sort_order: i + 1,
  active: true,
}));
const profiles = [
  {
    id: ADMIN,
    full_name: "Marina (administradora demo)",
    email: "admin@exemplo.invalid",
    role: "admin",
    active: true,
  },
  {
    id: COLLAB,
    full_name: "João (colaborador demo)",
    email: "joao@exemplo.invalid",
    role: "collaborator",
    active: true,
  },
  {
    id: COLLAB2,
    full_name: "Ana (colaboradora demo)",
    email: "ana@exemplo.invalid",
    role: "collaborator",
    active: true,
  },
];
const iso = new Date().toISOString();
function seed() {
  const closings = [];
  for (let y = 0; y < 3; y++)
    for (let i = 0; i < 8; i++) {
      const event = events[y],
        stall = stalls[i];
      const amount = (1800 + i * 230) * (1 + y * 0.28);
      closings.push({
        id: `cccc${y}${String(i).padStart(3, "0")}-0000-4000-8000-${String(y * 8 + i + 1).padStart(12, "0")}`,
        event_id: event.id,
        stall_id: stall.id,
        submitted_by: i % 2 === 0 ? COLLAB : COLLAB2,
        closing_date: event.starts_on,
        amount: Number(amount.toFixed(2)),
        receipt_path: `demo/${i}.png`,
        note: "Exemplo fictício de prestação de contas",
        status: y === 2 && i === 7 ? "pending" : "approved",
        review_note: null,
        reviewed_by: ADMIN,
        reviewed_at: iso,
        replaces_id: null,
        created_at: iso,
      });
    }
  return {
    profiles: structuredClone(profiles),
    events: structuredClone(events),
    stalls: structuredClone(stalls),
    profile_stalls: [
      { user_id: COLLAB, stall_id: stalls[0].id },
      { user_id: COLLAB, stall_id: stalls[2].id },
      { user_id: COLLAB2, stall_id: stalls[1].id },
    ],
    closings,
    closing_feedback: closings.map((c) => ({
      closing_id: c.id,
      submitted_by: c.submitted_by,
      stall_id: c.stall_id,
      event_id: c.event_id,
      closing_date: c.closing_date,
      status: c.status,
      review_note: c.review_note,
      updated_at: iso,
    })),
    report_shares: [],
    audit_log: [],
  };
}
let memory;
let selectedUser = null;
const STORAGE_KEY = "quermesse-portfolio-demo-v55-v2";
function getDb() {
  if (!memory) {
    try {
      memory = JSON.parse(localStorage.getItem(STORAGE_KEY)) || seed();
    } catch {
      memory = seed();
    }
  }
  return memory;
}
function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(memory));
  } catch {
    /* Private mode / quota */
  }
}
function profile() {
  return getDb().profiles.find((p) => p.id === selectedUser);
}
function isAdmin() {
  const p = profile();
  return !!(p?.active && p.role === "admin");
}
function canSubmit(eventId, stallId) {
  const db = getDb();
  return !!(
    profile()?.active &&
    profile()?.role === "collaborator" &&
    db.events.some((e) => e.id === eventId && e.active) &&
    db.stalls.some((s) => s.id === stallId && s.active) &&
    db.profile_stalls.some(
      (a) => a.user_id === selectedUser && a.stall_id === stallId,
    )
  );
}
function err(message) {
  return { data: null, error: { message } };
}
function ok(data) {
  return { data, error: null };
}
function audit(action, id) {
  getDb().audit_log.unshift({
    id: Date.now(),
    actor_id: selectedUser,
    action,
    entity_id: id,
    created_at: new Date().toISOString(),
  });
}
function allowed(table, rows) {
  if (!profile()?.active) return [];
  if (table === "closings" || table === "audit_log")
    return isAdmin() ? rows : [];
  if (table === "profiles")
    return isAdmin() ? rows : rows.filter((p) => p.id === selectedUser);
  if (table === "profile_stalls")
    return isAdmin() ? rows : rows.filter((x) => x.user_id === selectedUser);
  if (table === "report_shares")
    return isAdmin()
      ? rows
      : rows.filter((x) => x.recipient_id === selectedUser && !x.revoked_at);
  if (table === "closing_feedback")
    return isAdmin()
      ? rows
      : rows.filter((x) => x.submitted_by === selectedUser);
  if (table === "events" || table === "stalls")
    return isAdmin() ? rows : rows.filter((x) => x.active);
  return [];
}
function newId() {
  return crypto.randomUUID();
}
class Query {
  constructor(table) {
    this.table = table;
    this.operation = "select";
    this.payload = null;
    this.columns = "*";
    this.filters = [];
    this.sort = null;
    this.rowLimit = null;
    this.resultType = "array";
  }
  select(columns = "*") {
    this.columns = columns;
    return this;
  }
  insert(payload) {
    this.operation = "insert";
    this.payload = payload;
    return this;
  }
  update(payload) {
    this.operation = "update";
    this.payload = payload;
    return this;
  }
  delete() {
    this.operation = "delete";
    return this;
  }
  eq(column, value) {
    this.filters.push((r) => r[column] === value);
    return this;
  }
  in(column, values) {
    this.filters.push((r) => values.includes(r[column]));
    return this;
  }
  ilike(column, value) {
    this.filters.push(
      (r) =>
        String(r[column] || "").toLowerCase() === String(value).toLowerCase(),
    );
    return this;
  }
  order(column, options = {}) {
    this.sort = { column, ascending: options.ascending !== false };
    return this;
  }
  limit(n) {
    this.rowLimit = n;
    return this;
  }
  maybeSingle() {
    this.resultType = "single";
    return Promise.resolve(this.execute());
  }
  single() {
    this.resultType = "single";
    return Promise.resolve(this.execute());
  }
  then(resolve, reject) {
    return Promise.resolve(this.execute()).then(resolve, reject);
  }
  execute() {
    const db = getDb();
    const data = db[this.table];
    if (!data) return err("Tabela indisponível na demonstração");
    if (this.operation === "select") {
      let rows = allowed(this.table, data).filter((r) =>
        this.filters.every((fn) => fn(r)),
      );
      if (this.sort)
        rows = rows.slice().sort((a, b) => {
          const cmp = String(a[this.sort.column] || "").localeCompare(
            String(b[this.sort.column] || ""),
          );
          return this.sort.ascending ? cmp : -cmp;
        });
      if (this.rowLimit) rows = rows.slice(0, this.rowLimit);
      const fields =
        this.columns === "*"
          ? null
          : this.columns.split(",").map((x) => x.trim());
      rows = rows.map((r) =>
        fields
          ? Object.fromEntries(fields.map((f) => [f, r[f]]))
          : structuredClone(r),
      );
      return ok(this.resultType === "single" ? rows[0] || null : rows);
    }
    if (this.operation === "insert") {
      const rows = Array.isArray(this.payload) ? this.payload : [this.payload];
      const inserted = [];
      for (const input of rows) {
        const r = {
          ...input,
          id: input.id || newId(),
          created_at: new Date().toISOString(),
        };
        if (this.table === "closings") {
          if (
            !canSubmit(r.event_id, r.stall_id) ||
            r.submitted_by !== selectedUser
          )
            return err("Acesso não autorizado à barraca");
          const ev = db.events.find((e) => e.id === r.event_id);
          if (r.closing_date < ev.starts_on || r.closing_date > ev.ends_on)
            return err("Data fora do período do evento");
          if (r.replaces_id) {
            const prior = db.closings.find((c) => c.id === r.replaces_id);
            const feedback = db.closing_feedback.find(
              (c) => c.closing_id === r.replaces_id,
            );
            if (
              !prior ||
              !feedback ||
              feedback.status !== "correction" ||
              prior.status !== "correction" ||
              prior.submitted_by !== selectedUser ||
              prior.event_id !== r.event_id ||
              prior.stall_id !== r.stall_id ||
              prior.closing_date !== r.closing_date ||
              db.closings.some((c) => c.replaces_id === r.replaces_id)
            )
              return err("Reenvio inválido (V5.5)");
            feedback.status = "resubmitted";
          }
          r.status = "pending";
          db.closing_feedback.push({
            closing_id: r.id,
            submitted_by: r.submitted_by,
            stall_id: r.stall_id,
            event_id: r.event_id,
            closing_date: r.closing_date,
            status: "pending",
            review_note: null,
            updated_at: iso,
          });
          audit("closings_insert", r.id);
        } else if (this.table === "events" || this.table === "stalls") {
          if (!isAdmin()) return err("Requer perfil de administrador");
          if (this.table === "events" && r.ends_on < r.starts_on)
            return err("Intervalo inválido");
          r.active = true;
        } else if (this.table === "report_shares") {
          if (!isAdmin() || r.created_by !== selectedUser)
            return err("Requer perfil de administrador");
          const closings = db.closings.filter(
            (x) =>
              x.status === "approved" &&
              x.event_id === r.event_id &&
              (!r.stall_id || x.stall_id === r.stall_id),
          );
          if (!closings.length)
            return err("Nenhum fechamento aprovado para compartilhar");
          const event = db.events.find((e) => e.id === r.event_id);
          const stall = db.stalls.find((s) => s.id === r.stall_id);
          r.report_title =
            event.title + " · " + (stall?.name || "Todas as barracas");
          r.total = closings.reduce((n, c) => n + Number(c.amount), 0);
          r.closing_count = closings.length;
          r.revoked_at = null;
          audit("report_shares_insert", r.id);
        } else if (this.table === "profile_stalls") {
          if (!isAdmin()) return err("Requer perfil de administrador");
        } else return err("Operação de criação indisponível");
        data.push(r);
        inserted.push(r);
      }
      save();
      return ok(
        this.resultType === "single"
          ? { id: inserted[0].id }
          : inserted.map((x) => ({ id: x.id })),
      );
    }
    if (this.operation === "update") {
      if (!isAdmin()) return err("Acesso administrativo necessário");
      const targets = data.filter((r) => this.filters.every((fn) => fn(r)));
      for (const row of targets) {
        if (this.table === "closings") {
          if (
            row.status !== "pending" ||
            !["approved", "correction"].includes(this.payload.status)
          )
            return err("Somente registros pendentes podem ser avaliados");
          if (
            this.payload.status === "correction" &&
            String(this.payload.review_note || "").trim().length < 5
          )
            return err("Justificativa precisa ter 5 caracteres");
          if (
            Object.keys(this.payload).some(
              (k) =>
                ![
                  "status",
                  "review_note",
                  "reviewed_by",
                  "reviewed_at",
                ].includes(k),
            )
          )
            return err("Campos financeiros imutáveis");
          Object.assign(row, this.payload);
          const fb = db.closing_feedback.find((f) => f.closing_id === row.id);
          if (fb) {
            fb.status = row.status;
            fb.review_note = row.review_note;
            fb.updated_at = iso;
          }
          audit("closings_update", row.id);
        } else if (this.table === "report_shares") {
          if (Object.keys(this.payload).some((k) => k !== "revoked_at"))
            return err("Somente revogação permitida");
          Object.assign(row, this.payload);
          audit("report_shares_update", row.id);
        } else if (["profiles", "stalls", "events"].includes(this.table)) {
          const fields =
            this.table === "profiles"
              ? ["active", "full_name"]
              : this.table === "stalls"
                ? ["name", "emoji", "active", "sort_order"]
                : ["title", "starts_on", "ends_on", "active"];
          if (Object.keys(this.payload).some((k) => !fields.includes(k)))
            return err("Campo não autorizado");
          Object.assign(row, this.payload);
        } else return err("Atualização não permitida");
      }
      save();
      return ok(
        this.resultType === "single"
          ? targets[0]
            ? { id: targets[0].id }
            : null
          : targets.map((x) => ({ id: x.id })),
      );
    }
    return err("Operação não disponível");
  }
}
const uploads = new Map();
export function createDemoClient() {
  return {
    from(table) {
      return new Query(table);
    },
    auth: {
      async getUser() {
        return ok({
          user: selectedUser
            ? { id: selectedUser, email: profile()?.email }
            : null,
        });
      },
      async signInWithPassword({ email }) {
        const u = getDb().profiles.find(
          (p) => p.email.toLowerCase() === email.toLowerCase(),
        );
        if (!u) return err("Na demonstração, use os botões abaixo");
        selectedUser = u.id;
        return ok({ user: { id: u.id } });
      },
      async signOut() {
        selectedUser = null;
        return ok({});
      },
      async resetPasswordForEmail() {
        return err("Recuperação de senha desabilitada no modo demo");
      },
      async signUp() {
        return err("Cadastro real desabilitado no modo demo");
      },
    },
    functions: {
      async invoke(name, { body } = {}) {
        if (name !== "invite-collaborator" || !isAdmin())
          return err("Somente a administração pode convidar");
        if (!body?.email || !body?.full_name || !body?.stall_ids?.length)
          return err("Dados inválidos");
        const db = getDb();
        if (db.profiles.some((x) => x.email === body.email))
          return err("E-mail já cadastrado");
        const p = {
          id: newId(),
          full_name: body.full_name,
          email: body.email,
          role: "collaborator",
          active: true,
        };
        db.profiles.push(p);
        db.profile_stalls.push(
          ...body.stall_ids.map((stall_id) => ({ user_id: p.id, stall_id })),
        );
        save();
        return ok({ ok: true, invite_sent: true, user_id: p.id });
      },
    },
    storage: {
      from(bucket) {
        return {
          async upload(path, file) {
            if (bucket !== "closing-receipts" || !selectedUser)
              return err("Upload não autorizado");
            uploads.set(path, URL.createObjectURL(file));
            return ok({ path });
          },
          async createSignedUrl(path) {
            if (!isAdmin())
              return err("Somente administração acessa comprovantes");
            return ok({
              signedUrl:
                uploads.get(path) ||
                `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="460" height="300"><rect width="100%" height="100%" fill="#f8f5ed"/><text x="25" y="150" font-size="24" fill="#174b38">Comprovante fictício</text></svg>')}`,
            });
          },
        };
      },
    },
  };
}
export function selectDemoRole(role) {
  selectedUser = role === "admin" ? ADMIN : COLLAB;
  return selectedUser;
}
export function resetDemo() {
  memory = seed();
  save();
  selectedUser = null;
}
