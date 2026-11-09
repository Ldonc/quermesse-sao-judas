import {
  comparison,
  filterClosings,
  approvedClosings,
  totalAmount,
  asCsv,
} from "../lib/analytics.js";
export function createAdminViews({
  state,
  safe,
  money,
  dateBR,
  stallName,
  profileName,
  eventName,
  pill,
}) {
  function overview() {
    const approved = state.closings.filter((x) => x.status === "approved");
    const sum = approved.reduce((n, x) => n + Number(x.amount), 0);
    const pending = state.closings.filter((x) => x.status === "pending").length;
    const groups = state.stalls
      .map((s) => ({
        name: s.name,
        emoji: s.emoji,
        total: approved
          .filter((x) => x.stall_id === s.id)
          .reduce((n, x) => n + Number(x.amount), 0),
      }))
      .sort((a, b) => b.total - a.total);
    return `<div class="stats"><div class="stat"><p>Arrecadação aprovada</p><strong>${money(sum)}</strong></div><div class="stat"><p>Aguardando conferência</p><strong>${pending}</strong></div><div class="stat"><p>Comprovantes aprovados</p><strong>${approved.length}</strong></div></div><div class="split"><section class="card"><p class="section-title">Visão por barraca</p><h2>Arrecadação aprovada</h2><button type="button" class="btn sm" id="export-approved" style="margin-bottom:12px">Exportar CSV dos aprovados</button>${groups.map((g) => `<div class="flex item"><span>${safe(g.emoji)} ${safe(g.name)}</span><strong>${money(g.total)}</strong></div>`).join("")}</section><section class="card"><p class="section-title">Gestão da quermesse</p><h2>Operação segura</h2><p>Os valores aprovados entram nos indicadores administrativos. Os colaboradores somente poderão ver resumos publicados diretamente para suas contas.</p><div class="note">Os comprovantes ficam em um bucket privado do Supabase. O compartilhamento de relatórios não concede acesso às imagens.</div></section></div>`;
  }
  function review() {
    const filtered = filterClosings(
      state.closings,
      state.filters,
      stallName,
      eventName,
      profileName,
    );
    return `<section class="card"><p class="section-title">Somente administradores</p><h2>Fechamentos recebidos</h2><p class="muted tiny">Abra a foto para conferir o valor. Aprovações e pedidos de correção são registrados no banco.</p><form id="filter-form" class="filter-panel" aria-label="Filtros de conferência"><div class="field"><label>Quermesse</label><select name="event"><option value="">Todas</option>${state.events.map((e) => `<option value="${e.id}" ${state.filters.event === e.id ? "selected" : ""}>${safe(e.title)}</option>`).join("")}</select></div><div class="field"><label>Barraca</label><select name="stall"><option value="">Todas</option>${state.stalls.map((e) => `<option value="${e.id}" ${state.filters.stall === e.id ? "selected" : ""}>${safe(e.name)}</option>`).join("")}</select></div><div class="field"><label>Status</label><select name="status"><option value="">Todos</option>${[
      ["pending", "Pendente"],
      ["approved", "Aprovado"],
      ["correction", "Correção solicitada"],
    ]
      .map(
        ([id, label]) =>
          `<option value="${id}" ${state.filters.status === id ? "selected" : ""}>${label}</option>`,
      )
      .join(
        "",
      )}</select></div><div class="field"><label>Busca</label><input name="search" placeholder="Nome, observação..." value="${safe(state.filters.search)}"></div><button class="btn primary" type="submit">Aplicar filtros</button><button class="btn" id="clear-filters" type="button">Limpar</button></form><p class="tiny muted">${filtered.length} fechamento(s) encontrado(s).</p><div class="stack">${filtered.length ? filtered.map((x) => `<div class="item"><div class="flex"><div><strong>${safe(stallName(x.stall_id))}</strong> · ${dateBR(x.closing_date)} ${pill(x.status)}<p class="muted tiny">${safe(profileName(x.submitted_by))} · ${safe(eventName(x.event_id))}</p><div class="money">${money(x.amount)}</div><p>${safe(x.note || "Sem observações")}</p>${x.review_note ? `<p class="tiny">Última observação: ${safe(x.review_note)}</p>` : ""}</div><div class="actions"><button class="btn sm" data-receipt="${safe(x.receipt_path)}">Ver foto</button>${x.status === "pending" ? `<button class="btn primary sm" data-approve="${x.id}">Aprovar</button><button class="btn danger sm" data-correct="${x.id}">Pedir correção</button>` : ""}</div></div></div>`).join("") : '<div class="limited">Nenhum fechamento registrado ainda.</div>'}</div></section>`;
  }
  function sharing() {
    const members = state.profiles.filter(
      (p) => p.role === "collaborator" && p.active,
    );
    return `<div class="split"><section class="card"><p class="section-title">Permissões individuais</p><h2>Liberar relatório</h2><p class="muted tiny">Publicação de um resumo congelado dos fechamentos aprovados. Fotos e nomes não são compartilhados.</p><form id="share-form"><div class="field"><label>Colaborador</label><select name="recipient" required>${members.map((x) => `<option value="${x.id}">${safe(x.full_name)}</option>`).join("")}</select></div><div class="field"><label>Quermesse</label><select name="event" required>${state.events.map((x) => `<option value="${x.id}">${safe(x.title)}</option>`).join("")}</select></div><div class="field"><label>Escopo</label><select name="stall"><option value="">Todas as barracas</option>${state.stalls.map((x) => `<option value="${x.id}">${safe(x.name)}</option>`).join("")}</select></div><button class="btn primary full" ${!members.length || !state.events.length ? "disabled" : ""}>Liberar estatísticas →</button></form></section><section class="card"><p class="section-title">Acessos concedidos</p><h2>Relatórios publicados</h2>${state.shares.length ? state.shares.map((x) => `<div class="item"><div class="flex"><div><strong>${safe(x.report_title)}</strong><p class="tiny muted">Para: ${safe(profileName(x.recipient_id))}</p><p class="money">${money(x.total)}</p><p class="tiny">${x.revoked_at ? "Acesso revogado" : "Acesso ativo"} · ${x.closing_count} fechamento(s)</p></div>${!x.revoked_at ? `<button class="btn danger sm" data-revoke="${x.id}">Revogar</button>` : ""}</div></div>`).join("") : '<div class="limited">Ainda não há relatórios compartilhados.</div>'}</section></div>`;
  }
  function team() {
    const members = state.profiles.filter((x) => x.role === "collaborator");
    return `<div class="split"><section class="card"><p class="section-title">Convites pelo servidor</p><h2>Convidar colaborador</h2><p class="tiny muted">O sistema envia um convite por e-mail. Não gera nem exibe senhas.</p><form id="invite-form"><div class="field"><label>Nome completo</label><input name="full_name" required minlength="3" maxlength="120" placeholder="Nome e sobrenome"></div><div class="field"><label>E-mail</label><input name="email" type="email" required placeholder="nome@exemplo.com"></div><div class="field"><label>Barraca atribuída</label><select name="stall" required>${state.stalls
      .filter((x) => x.active)
      .map((x) => `<option value="${x.id}">${safe(x.name)}</option>`)
      .join(
        "",
      )}</select></div><button class="btn primary full">Enviar convite →</button></form><div class="note" style="margin-top:19px">A conta só funcionará depois do convite e da configuração de senha pelo destinatário.</div></section><section class="card"><p class="section-title">Usuários cadastrados</p><h2>Equipe e acessos</h2>${
      members.length
        ? members
            .map(
              (m) =>
                `<div class="item"><div class="flex"><div><strong>${safe(m.full_name)}</strong><p class="tiny muted">${safe(m.email)}</p><p class="tiny">${
                  state.assignments
                    .filter((a) => a.user_id === m.id)
                    .map((a) => safe(stallName(a.stall_id)))
                    .join(", ") || "Sem barraca"
                }</p></div><button class="btn sm ${m.active ? "danger" : ""}" data-toggle="${m.id}" data-active="${m.active}">${m.active ? "Desativar" : "Reativar"}</button></div></div>`,
            )
            .join("")
        : '<div class="limited">Nenhum colaborador convidado.</div>'
    }</section></div>`;
  }
  function events() {
    return `<div class="split"><section class="card"><p class="section-title">Edições da festa</p><h2>Criar quermesse</h2><form id="event-form"><div class="field"><label>Nome da edição</label><input name="title" required minlength="3" maxlength="140" placeholder="Quermesse São Judas 2027"></div><div class="grid2"><div class="field"><label>Data de início</label><input name="starts_on" type="date" required></div><div class="field"><label>Data de término</label><input name="ends_on" type="date" required></div></div><button class="btn primary full">Criar evento →</button></form></section><section class="card"><p class="section-title">Edições cadastradas</p><h2>Quermesses</h2>${state.events.map((x) => `<div class="item"><strong>${safe(x.title)}</strong><p class="tiny muted">${dateBR(x.starts_on)} a ${dateBR(x.ends_on)}</p>${x.active ? '<span class="pill approved">Ativo</span>' : '<span class="pill">Inativo</span>'}</div>`).join("") || '<div class="limited">Crie uma quermesse para começar.</div>'}</section></div>`;
  }
  function audit() {
    return `<section class="card"><p class="section-title">Registro de operações</p><h2>Histórico administrativo</h2><div class="tablewrap"><table class="table"><thead><tr><th>Quando</th><th>Ação</th><th>Responsável</th></tr></thead><tbody>${state.audit.map((x) => `<tr><td>${new Date(x.created_at).toLocaleString("pt-BR")}</td><td>${safe(x.action)}</td><td>${safe(profileName(x.actor_id))}</td></tr>`).join("") || '<tr><td colspan="3">Sem atividades.</td></tr>'}</tbody></table></div></section>`;
  }

  function stallsPage() {
    return `<div class="split"><section class="card"><p class="section-title">Cadastro de barracas</p><h2>Adicionar barraca</h2><p class="tiny muted">Desative barracas que não participam mais. A exclusão física não é necessária e preserva o histórico das quermesses.</p><form id="stall-form"><div class="field"><label>Nome da barraca</label><input name="name" required minlength="2" maxlength="80" placeholder="Ex.: Pastel"></div><div class="field"><label>Ícone</label><input name="emoji" maxlength="8" value="🍽️"></div><button class="btn primary full" type="submit">Cadastrar barraca →</button></form></section><section class="card"><p class="section-title">Barracas cadastradas</p><h2>Organização da festa</h2>${state.stalls.map((x) => `<div class="item"><div class="flex"><div><strong>${safe(x.emoji)} ${safe(x.name)}</strong><p class="tiny muted">${x.active ? "Ativa" : "Inativa"} · Ordem ${x.sort_order}</p></div><div class="actions"><button class="btn sm" data-edit-stall="${x.id}">Editar</button><button class="btn sm ${x.active ? "danger" : ""}" data-toggle-stall="${x.id}" data-active="${x.active}">${x.active ? "Desativar" : "Reativar"}</button></div></div></div>`).join("") || '<div class="empty-hint">Nenhuma barraca cadastrada.</div>'}</section></div>`;
  }
  function comparisonPage() {
    const available = state.events;
    const left = state.comparison.left || available.at(-1)?.id || "";
    const right = state.comparison.right || available[0]?.id || "";
    const stats =
      left && right
        ? comparison(state.closings, state.stalls, left, right)
        : null;
    const eventLabel = (id) =>
      safe(available.find((e) => e.id === id)?.title || "—");
    return `<section class="card"><p class="section-title">Análise histórica</p><h2>Comparar quermesses</h2><p class="tiny muted">Somente fechamentos aprovados entram nos cálculos. Este painel fica disponível apenas para administradores.</p>
    <form id="comparison-form" class="filter-panel"><div class="field"><label>Edição A (base)</label><select name="left" required>${available.map((e) => `<option value="${e.id}" ${left === e.id ? "selected" : ""}>${safe(e.title)}</option>`).join("")}</select></div><div class="field"><label>Edição B (comparação)</label><select name="right" required>${available.map((e) => `<option value="${e.id}" ${right === e.id ? "selected" : ""}>${safe(e.title)}</option>`).join("")}</select></div><button class="btn primary" type="submit">Comparar edições</button></form>
    ${!stats ? '<p class="empty-hint">Cadastre pelo menos duas quermesses para fazer comparações.</p>' : `<div class="stats"><div class="stat"><p>${eventLabel(left)}</p><strong>${money(stats.leftTotal)}</strong><small>${stats.leftCount} fechamentos</small></div><div class="stat"><p>${eventLabel(right)}</p><strong>${money(stats.rightTotal)}</strong><small>${stats.rightCount} fechamentos</small></div><div class="stat"><p>Variação</p><strong class="${stats.delta >= 0 ? "delta-positive" : "delta-negative"}">${money(stats.delta)}</strong><small>${stats.percent === null ? "Sem base comparável" : stats.percent.toFixed(1) + "%"}</small></div></div><h2>Detalhamento por barraca</h2><div class="tablewrap"><table class="table"><thead><tr><th>Barraca</th><th>Edição A</th><th>Edição B</th><th>Diferença</th><th>Variação</th></tr></thead><tbody>${stats.stalls.map((x) => `<tr><td>${safe(x.emoji)} ${safe(x.name)}</td><td>${money(x.left)}</td><td>${money(x.right)}</td><td class="${x.delta >= 0 ? "delta-positive" : "delta-negative"}">${money(x.delta)}</td><td>${x.percent === null ? "—" : x.percent.toFixed(1) + "%"}</td></tr>`).join("")}</tbody></table></div>`}
  </section>`;
  }
  return {
    overview,
    review,
    sharing,
    team,
    events,
    audit,
    stallsPage,
    comparisonPage,
  };
}
