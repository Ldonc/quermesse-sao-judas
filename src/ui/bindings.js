import { parseBRL } from "../lib/format.js";
export function createBindings({
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
}) {
  function bind() {
    const page = $("#page");
    if (state.tab === "review") {
      page.querySelectorAll("[data-approve]").forEach(
        (b) =>
          (b.onclick = () =>
            run(async () => {
              if (!confirm("Confirmar aprovação do fechamento?")) return;
              check(
                await supabase
                  .from("closings")
                  .update({
                    status: "approved",
                    review_note: null,
                    reviewed_by: state.user.id,
                    reviewed_at: new Date().toISOString(),
                  })
                  .eq("id", b.dataset.approve)
                  .select("id")
                  .single(),
              );
              toast("Fechamento aprovado com sucesso");
              await load();
            })),
      );
      page.querySelectorAll("[data-correct]").forEach(
        (b) =>
          (b.onclick = () =>
            run(async () => {
              const note = prompt(
                "Informe o motivo da correção (obrigatório):",
              );
              if (note === null) return;
              if (note.trim().length < 5)
                throw Error(
                  "Informe uma justificativa com pelo menos 5 caracteres",
                );
              check(
                await supabase
                  .from("closings")
                  .update({
                    status: "correction",
                    review_note: note.trim(),
                    reviewed_by: state.user.id,
                    reviewed_at: new Date().toISOString(),
                  })
                  .eq("id", b.dataset.correct)
                  .select("id")
                  .single(),
              );
              toast("Correção solicitada ao colaborador");
              await load();
            })),
      );
      page.querySelectorAll("[data-receipt]").forEach(
        (b) =>
          (b.onclick = () =>
            run(async () => {
              const path = b.dataset.receipt;
              const { data, error } = await supabase.storage
                .from("closing-receipts")
                .createSignedUrl(path, 90);
              if (error) throw error;
              const link = document.createElement("a");
              link.href = data.signedUrl;
              link.target = "_blank";
              link.rel = "noopener noreferrer";
              document.body.appendChild(link);
              link.click();
              link.remove();
              toast("Link temporário do comprovante gerado");
            })),
      );
    }
    if (state.tab === "sharing") {
      const form = $("#share-form");
      form?.addEventListener("submit", (e) => {
        e.preventDefault();
        run(async () => {
          const d = new FormData(form);
          if (
            !confirm(
              "Liberar este resumo financeiro para o colaborador selecionado?",
            )
          )
            return;
          check(
            await supabase
              .from("report_shares")
              .insert({
                event_id: d.get("event"),
                stall_id: d.get("stall") || null,
                recipient_id: d.get("recipient"),
                created_by: state.user.id,
              })
              .select("id")
              .single(),
          );
          toast("Relatório liberado com sucesso");
          await load();
        });
      });
      page.querySelectorAll("[data-revoke]").forEach(
        (b) =>
          (b.onclick = () =>
            run(async () => {
              if (!confirm("Revogar o acesso ao relatório?")) return;
              check(
                await supabase
                  .from("report_shares")
                  .update({ revoked_at: new Date().toISOString() })
                  .eq("id", b.dataset.revoke)
                  .select("id")
                  .single(),
              );
              toast("Acesso revogado");
              await load();
            })),
      );
    }
    if (state.tab === "team") {
      const form = $("#invite-form");
      form?.addEventListener("submit", (e) => {
        e.preventDefault();
        run(async () => {
          const d = new FormData(form);
          const result = await supabase.functions.invoke(
            "invite-collaborator",
            {
              body: {
                full_name: d.get("full_name"),
                email: d.get("email"),
                stall_ids: [d.get("stall")],
              },
            },
          );
          if (result.error) {
            let detail = "Não foi possível enviar o convite";
            try {
              const body = await result.error.context?.json();
              detail = body?.error || detail;
            } catch {}
            throw Error(detail);
          }
          if (!result.data?.ok)
            throw Error(result.data?.error || "Convite não concluído");
          toast("Convite enviado e perfil criado");
          await load();
        });
      });
      page.querySelectorAll("[data-toggle]").forEach(
        (b) =>
          (b.onclick = () =>
            run(async () => {
              const active = b.dataset.active === "true";
              if (
                !confirm(
                  (active ? "Desativar" : "Reativar") + " este colaborador?",
                )
              )
                return;
              check(
                await supabase
                  .from("profiles")
                  .update({ active: !active })
                  .eq("id", b.dataset.toggle)
                  .select("id")
                  .single(),
              );
              toast("Permissão atualizada");
              await load();
            })),
      );
    }
    if (state.tab === "events") {
      $("#event-form")?.addEventListener("submit", (e) => {
        e.preventDefault();
        run(async () => {
          const d = new FormData(e.target);
          if (d.get("ends_on") < d.get("starts_on"))
            throw Error("A data final deve ser igual ou posterior à inicial");
          check(
            await supabase
              .from("events")
              .insert({
                title: String(d.get("title")).trim(),
                starts_on: d.get("starts_on"),
                ends_on: d.get("ends_on"),
              })
              .select("id")
              .single(),
          );
          toast("Quermesse cadastrada com sucesso");
          await load();
        });
      });
    }
    if (state.tab === "overview") {
      $("#export-approved")?.addEventListener("click", () => {
        const rows = state.closings.filter((x) => x.status === "approved");
        if (!rows.length) {
          toast("Não existem fechamentos aprovados para exportar", "error");
          return;
        }
        const csv = "\uFEFF" + asCsv(rows);
        const url = URL.createObjectURL(
          new Blob([csv], { type: "text/csv;charset=utf-8" }),
        );
        const a = document.createElement("a");
        a.href = url;
        a.download = "fechamentos_aprovados.csv";
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        toast("CSV gerado com os fechamentos aprovados");
      });
    }
    if (state.tab === "stallsPage") {
      $("#stall-form")?.addEventListener("submit", (e) => {
        e.preventDefault();
        run(async () => {
          const d = new FormData(e.target),
            name = String(d.get("name") || "").trim(),
            emoji = String(d.get("emoji") || "🍽️").trim() || "🍽️";
          if (name.length < 2)
            throw Error("Informe um nome com pelo menos dois caracteres");
          check(
            await supabase
              .from("stalls")
              .insert({
                name,
                emoji,
                slug: crypto.randomUUID(),
                sort_order: state.stalls.length + 1,
              })
              .select("id")
              .single(),
          );
          toast("Barraca cadastrada");
          await load();
        });
      });
      page.querySelectorAll("[data-toggle-stall]").forEach(
        (button) =>
          (button.onclick = () =>
            run(async () => {
              const active = button.dataset.active === "true";
              if (
                !confirm(
                  `${active ? "Desativar" : "Reativar"} esta barraca? O histórico financeiro será preservado.`,
                )
              )
                return;
              check(
                await supabase
                  .from("stalls")
                  .update({ active: !active })
                  .eq("id", button.dataset.toggleStall)
                  .select("id")
                  .single(),
              );
              toast("Barraca atualizada");
              await load();
            })),
      );
      page.querySelectorAll("[data-edit-stall]").forEach(
        (button) =>
          (button.onclick = () =>
            run(async () => {
              const current = state.stalls.find(
                (x) => x.id === button.dataset.editStall,
              );
              const next = prompt("Novo nome da barraca:", current?.name || "");
              if (next === null) return;
              const name = next.trim();
              if (name.length < 2)
                throw Error("O nome precisa ter pelo menos 2 caracteres");
              check(
                await supabase
                  .from("stalls")
                  .update({ name })
                  .eq("id", current.id)
                  .select("id")
                  .single(),
              );
              toast("Barraca renomeada");
              await load();
            })),
      );
    }
    if (state.tab === "review") {
      $("#filter-form")?.addEventListener("submit", (e) => {
        e.preventDefault();
        const f = new FormData(e.target);
        state.filters = {
          event: String(f.get("event") || ""),
          stall: String(f.get("stall") || ""),
          status: String(f.get("status") || ""),
          search: String(f.get("search") || "").trim(),
        };
        render();
      });
      $("#clear-filters")?.addEventListener("click", () => {
        state.filters = { event: "", stall: "", status: "", search: "" };
        render();
      });
    }
    if (state.tab === "comparisonPage") {
      $("#comparison-form")?.addEventListener("submit", (e) => {
        e.preventDefault();
        const f = new FormData(e.target);
        state.comparison = {
          left: String(f.get("left")),
          right: String(f.get("right")),
        };
        render();
      });
    }
    if (state.tab === "register") {
      const form = $("#closing-form");
      const replacement = $("#replace");
      replacement?.addEventListener("change", () => {
        const f = state.feedback.find(
          (x) => x.closing_id === replacement.value,
        );
        if (f) {
          form.elements.event.value = f.event_id;
          form.elements.stall.value = f.stall_id;
          form.elements.date.value = f.closing_date;
        }
      });
      form?.addEventListener("submit", (e) => {
        e.preventDefault();
        run(async () => {
          const d = new FormData(form);
          const ev = d.get("event"),
            st = d.get("stall"),
            date = d.get("date");
          const raw = String(d.get("amount") || "")
            .trim()
            .replace(/\s/g, "");
          const normalized = raw.includes(",")
            ? raw.replace(/\./g, "").replace(",", ".")
            : raw;
          const amount = parseBRL(raw);
          const event = state.events.find((x) => x.id === ev);
          if (!event || date < event.starts_on || date > event.ends_on)
            throw Error("Data fora do período da quermesse");
          const f = d.get("receipt");
          if (!(f instanceof File) || !f.size)
            throw Error("Selecione a foto do comprovante");
          if (f.size > 8 * 1024 * 1024) throw Error("Foto maior que 8 MB");
          if (!["image/jpeg", "image/png", "image/webp"].includes(f.type))
            throw Error("Formato de foto não permitido");
          const replace = d.get("replace") || null;
          const target = state.feedback.find(
            (x) => x.closing_id === replace && x.status === "correction",
          );
          if (replace && !target) throw Error("Correção inválida");
          if (
            target &&
            (target.event_id !== ev ||
              target.stall_id !== st ||
              target.closing_date !== date)
          )
            throw Error("Mantenha os dados originais da correção");
          const ext =
            f.type === "image/png"
              ? "png"
              : f.type === "image/webp"
                ? "webp"
                : "jpg";
          const path = state.user.id + "/" + crypto.randomUUID() + "." + ext;
          const upload = await supabase.storage
            .from("closing-receipts")
            .upload(path, f, {
              contentType: f.type,
              cacheControl: "3600",
              upsert: false,
            });
          if (upload.error) throw upload.error;
          const inserted = await supabase.from("closings").insert({
            event_id: ev,
            stall_id: st,
            submitted_by: state.user.id,
            closing_date: date,
            amount,
            receipt_path: path,
            note: String(d.get("note") || "").trim() || null,
            replaces_id: replace,
          });
          if (inserted.error)
            throw Error(
              "Comprovante enviado, mas não foi possível registrar o fechamento. Avise a administração: " +
                inserted.error.message,
            );
          toast("Fechamento enviado! Aguardando conferência");
          await load();
        });
      });
    }
  }
  return bind;
}
