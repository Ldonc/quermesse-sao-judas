export function createCollaboratorViews({
  state,
  safe,
  money,
  dateBR,
  stallName,
  profileName,
  eventName,
  pill,
  activeEvents,
}) {
  function register() {
    const mine = state.assignments
      .filter((x) => x.user_id === state.user.id)
      .map((x) => x.stall_id);
    const stalls = state.stalls.filter((x) => mine.includes(x.id) && x.active);
    const eventOptions = activeEvents();
    const corrections = state.feedback.filter((x) => x.status === "correction");
    return `<div class="split"><section class="card"><p class="section-title">Passo 1 · Envio seguro</p><h2>Novo fechamento</h2><form id="closing-form"><div class="field"><label>Responsável</label><input readonly value="${safe(state.profile.full_name)}"></div><div class="grid2"><div class="field"><label>Quermesse</label><select name="event" required>${eventOptions.map((x) => `<option value="${x.id}">${safe(x.title)}</option>`).join("")}</select></div><div class="field"><label>Barraca</label><select name="stall" required>${stalls.map((x) => `<option value="${x.id}">${safe(x.emoji)} ${safe(x.name)}</option>`).join("")}</select></div></div><div class="grid2"><div class="field"><label>Data do fechamento</label><input name="date" type="date" required></div><div class="field"><label>Valor total (R$)</label><input name="amount" inputmode="decimal" placeholder="Ex.: 1.250,00" required></div></div><div class="field"><label>Observações</label><textarea name="note" rows="2" maxlength="1000" placeholder="Informações adicionais (opcional)"></textarea></div><div class="field"><label>Foto do comprovante (até 8 MB)</label><input name="receipt" type="file" accept="image/jpeg,image/png,image/webp" required></div><div class="field"><label>Reenvio de correção (se solicitado)</label><select id="replace" name="replace"><option value="">Novo fechamento</option>${corrections.map((x) => `<option value="${x.closing_id}">${safe(stallName(x.stall_id))} · ${dateBR(x.closing_date)} · ${safe(x.review_note || "Correção solicitada")}</option>`).join("")}</select></div><button class="btn primary full" ${!eventOptions.length || !stalls.length ? "disabled" : ""}>Enviar para conferência →</button></form>${!eventOptions.length ? '<div class="note warn">A administração precisa cadastrar a quermesse antes de receber fechamentos.</div>' : ""}${!stalls.length ? '<div class="note warn">Você precisa ter uma barraca atribuída pela administração.</div>' : ""}</section><aside class="card"><p class="section-title">Privacidade</p><h2>O que acontece depois?</h2><div class="item"><strong>01 · Envio</strong><p class="tiny muted">Seu comprovante é armazenado em uma área privada.</p></div><div class="item"><strong>02 · Conferência</strong><p class="tiny muted">A administração verifica os valores e a fotografia.</p></div><div class="item"><strong>03 · Resultado</strong><p class="tiny muted">Você poderá visualizar somente relatórios que forem liberados para o seu perfil.</p></div><div class="note">Os valores dos fechamentos enviados não são disponibilizados aos colaboradores para consulta posterior.</div></aside></div>`;
  }
  function reports() {
    const valid = state.shares.filter((x) => !x.revoked_at);
    return `<section class="card"><p class="section-title">Somente conteúdos autorizados</p><h2>Relatórios liberados para você</h2><p class="tiny muted">Você verá aqui os resumos publicados individualmente pela administração. Os relatórios não incluem imagens nem nomes.</p><div class="grid3" style="margin-top:20px">${valid.length ? valid.map((x) => `<div class="item"><p class="section-title">Compartilhado em ${dateBR(x.created_at)}</p><h3>${safe(x.report_title)}</h3><div class="money">${money(x.total)}</div><p class="tiny muted">${x.closing_count} fechamento(s) aprovado(s) na data da publicação.</p></div>`).join("") : '<div class="limited">Nenhum relatório liberado para sua conta.</div>'}</div></section>`;
  }
  function feedback() {
    return `<section class="card"><p class="section-title">Acompanhamento sem valores</p><h2>Retornos da coordenação</h2>${state.feedback.length ? state.feedback.map((x) => `<div class="item"><div class="flex"><div><strong>${safe(stallName(x.stall_id))}</strong> · ${dateBR(x.closing_date)} ${pill(x.status)}<p class="tiny">${safe(x.review_note || "Sem observações da coordenação.")}</p></div>${x.status === "correction" ? '<span class="tag">Reenvie em Novo fechamento</span>' : ""}</div></div>`).join("") : '<div class="limited">Você ainda não possui fechamentos para acompanhar.</div>'}</section>`;
  }
  return { register, reports, feedback };
}
