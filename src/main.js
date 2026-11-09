import {
  createClientForEnvironment,
  isDemo,
  demoLogin,
} from "./services/client.js";
import { state } from "./state.js";
import { safe, money, dateBR, errorMessage as msg } from "./lib/format.js";
import { asCsv } from "./lib/analytics.js";
import { createAdminViews } from "./ui/admin.js";
import { createCollaboratorViews } from "./ui/collaborator.js";
import { createBindings } from "./ui/bindings.js";
const supabase = createClientForEnvironment();
const $ = (s) => document.querySelector(s);
function toast(message, type = "ok") {
  const box = document.createElement("div");
  box.className = "toast" + (type === "error" ? " error" : "");
  const span = document.createElement("span");
  span.textContent = (type === "error" ? "⚠ " : "✓ ") + message;
  const x = document.createElement("button");
  x.type = "button";
  x.textContent = "×";
  x.onclick = () => box.remove();
  box.append(span, x);
  $("#toasts").prepend(box);
  setTimeout(() => box.remove(), 6500);
}
function setBusy(v) {
  state.busy = v;
  document
    .querySelectorAll("button[type=submit]")
    .forEach((b) => (b.disabled = v));
}
async function run(fn) {
  if (state.busy) return;
  setBusy(true);
  try {
    await fn();
  } catch (e) {
    toast(msg(e), "error");
    console.error(e);
  } finally {
    setBusy(false);
  }
}
function check(res) {
  if (res.error) throw res.error;
  return res.data;
}
function activeEvents() {
  return state.events.filter((x) => x.active);
}
function stallName(id) {
  const s = state.stalls.find((x) => x.id === id);
  return s ? s.emoji + " " + s.name : "Barraca";
}
function profileName(id) {
  return state.profiles.find((x) => x.id === id)?.full_name || "Colaborador";
}
function eventName(id) {
  return state.events.find((x) => x.id === id)?.title || "Evento";
}
function pill(status) {
  return (
    '<span class="pill ' +
    safe(status) +
    '">' +
    ({
      approved: "Aprovado",
      pending: "Pendente",
      correction: "Correção solicitada",
      resubmitted: "Reenviado",
    }[status] || safe(status)) +
    "</span>"
  );
}
async function load() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error && error.name !== "AuthSessionMissingError") console.warn(error);
  state.user = user || null;
  if (!user) {
    showLogin();
    return;
  }
  const p = check(
    await supabase
      .from("profiles")
      .select("id,full_name,email,role,active")
      .eq("id", user.id)
      .maybeSingle(),
  );
  if (!p || !p.active) {
    showLogin("Sua conta ainda não foi ativada pela administração.");
    return;
  }
  state.profile = p;
  const admin = p.role === "admin";
  const rq = [
    supabase.from("stalls").select("*").order("sort_order"),
    supabase
      .from("events")
      .select("*")
      .order("starts_on", { ascending: false }),
    supabase.from("profile_stalls").select("*"),
    supabase
      .from("report_shares")
      .select("*")
      .order("created_at", { ascending: false }),
  ];
  if (admin) {
    rq.push(
      supabase.from("profiles").select("id,full_name,email,role,active"),
      supabase
        .from("closings")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("audit_log")
        .select("id,actor_id,action,created_at")
        .order("created_at", { ascending: false })
        .limit(100),
    );
  } else {
    rq.push(
      supabase
        .from("closing_feedback")
        .select("*")
        .order("updated_at", { ascending: false }),
    );
  }
  const results = await Promise.all(rq);
  results.forEach(check);
  [state.stalls, state.events, state.assignments, state.shares] = results
    .slice(0, 4)
    .map((x) => x.data || []);
  if (admin) {
    [state.profiles, state.closings, state.audit] = results
      .slice(4)
      .map((x) => x.data || []);
  } else {
    state.feedback = results[4].data || [];
    state.profiles = [];
    state.closings = [];
    state.audit = [];
  }
  $("#login-view").classList.add("hidden");
  $("#app-view").classList.remove("hidden");
  $("#logout").classList.remove("hidden");
  $("#current-user").textContent = p.full_name;
  const tabs = admin
    ? [
        "overview",
        "comparisonPage",
        "stallsPage",
        "review",
        "sharing",
        "team",
        "events",
        "audit",
      ]
    : ["register", "reports", "feedback"];
  state.tab = tabs.includes(state.tab) ? state.tab : tabs[0];
  render();
}
function showLogin(message = "") {
  $("#app-view").classList.add("hidden");
  $("#login-view").classList.remove("hidden");
  $("#logout").classList.add("hidden");
  $("#current-user").textContent = "";
  $("#login-warning").textContent = message;
  $("#login-warning").classList.toggle("hidden", !message);
}
function render() {
  const admin = state.profile.role === "admin";
  const menus = admin
    ? [
        ["overview", "Visão geral"],
        ["comparisonPage", "Comparativos"],
        ["stallsPage", "Barracas"],
        ["review", "Conferência"],
        ["sharing", "Compartilhar"],
        ["team", "Equipe e acessos"],
        ["events", "Eventos"],
        ["audit", "Auditoria"],
      ]
    : [
        ["register", "Novo fechamento"],
        ["reports", "Relatórios liberados"],
        ["feedback", "Retornos da coordenação"],
      ];
  const titles = {
    comparisonPage: "Comparativo entre quermesses",
    stallsPage: "Gestão de barracas",
    overview: "Visão geral",
    review: "Conferência de fechamentos",
    sharing: "Compartilhamentos",
    team: "Equipe e acessos",
    events: "Gestão de eventos",
    audit: "Auditoria",
    register: "Registrar fechamento",
    reports: "Relatórios liberados",
    feedback: "Acompanhamento",
  };
  $("#role-kicker").textContent = admin
    ? "Área restrita · Administração"
    : "Área do colaborador";
  $("#role-tag").textContent = admin ? "Administrador" : "Colaborador";
  $("#page-title").textContent = titles[state.tab];
  $("#page-description").textContent = admin
    ? "Informações administrativas protegidas por permissões no Supabase."
    : "Acesso aos resultados apenas quando autorizado pela coordenação.";
  $("#nav").innerHTML = menus
    .map(
      ([id, label]) =>
        '<button class="' +
        (state.tab === id ? "active" : "") +
        '" data-tab="' +
        id +
        '">' +
        label +
        "</button>",
    )
    .join("");
  $("#nav")
    .querySelectorAll("[data-tab]")
    .forEach(
      (b) =>
        (b.onclick = () => {
          state.tab = b.dataset.tab;
          render();
        }),
    );
  const renders = views;
  $("#page").innerHTML = renders[state.tab]();
  bind();
}
const viewContext = {
  state,
  safe,
  money,
  dateBR,
  stallName,
  profileName,
  eventName,
  pill,
  activeEvents,
};
const views = {
  ...createAdminViews(viewContext),
  ...createCollaboratorViews(viewContext),
};
const bind = createBindings({
  state,
  supabase,
  $,
  run,
  check,
  toast,
  load,
  render,
  safe,
  asCsv,
});
if (isDemo) {
  const box = $("#demo-controls");
  box.classList.remove("hidden");
  box.innerHTML =
    '<strong>Portfólio · demonstração com dados fictícios</strong><p class="tiny">Nenhuma conexão com o banco real da igreja. Selecione um papel para explorar o sistema.</p><div class="demo-actions"><button class="btn primary" id="demo-admin" type="button">Explorar como administrador</button><button class="btn" id="demo-collab" type="button">Explorar como colaborador</button></div>';
  $("#demo-admin").onclick = () =>
    run(async () => {
      demoLogin("admin");
      await load();
    });
  $("#demo-collab").onclick = () =>
    run(async () => {
      demoLogin("collaborator");
      await load();
    });
  document
    .querySelectorAll("[data-auth-action]")
    .forEach((el) => el.classList.add("hidden"));
  $("#login-form").classList.add("hidden");
  document.querySelector(".login-card .note.warn").classList.add("hidden");
  $("#page-description").textContent = "Ambiente fictício de demonstração.";
}
$("#login-form").addEventListener("submit", (e) => {
  e.preventDefault();
  run(async () => {
    const email = $("#email").value.trim(),
      password = $("#password").value;
    check(await supabase.auth.signInWithPassword({ email, password }));
    toast("Login efetuado");
    await load();
  });
});
$("#password-reset").onclick = () =>
  run(async () => {
    const email = $("#email").value.trim();
    if (!email) throw Error("Digite seu e-mail antes de recuperar a senha");
    check(await supabase.auth.resetPasswordForEmail(email));
    toast("Se houver uma conta, você receberá instruções por e-mail");
  });
$("#initial-signup").onclick = () =>
  run(async () => {
    const email = $("#email").value.trim(),
      password = $("#password").value;
    if (!email || password.length < 8)
      throw Error(
        "Para solicitar o acesso inicial, informe e-mail e uma senha de pelo menos 8 caracteres",
      );
    if (
      !confirm(
        "O acesso inicial só será habilitado após o primeiro perfil de administrador ser ativado no Supabase. Deseja continuar?",
      )
    )
      return;
    check(await supabase.auth.signUp({ email, password }));
    toast(
      "Solicitação enviada. Confira seu e-mail e aguarde a ativação do perfil",
    );
  });
$("#logout").onclick = () =>
  run(async () => {
    check(await supabase.auth.signOut());
    state.tab = null;
    state.profile = null;
    showLogin();
    toast("Sessão encerrada");
  });
(async () => {
  try {
    await load();
  } catch (e) {
    console.error(e);
    showLogin("Não foi possível carregar sua conta: " + msg(e));
    toast("Erro ao carregar sua conta", "error");
  }
})();
