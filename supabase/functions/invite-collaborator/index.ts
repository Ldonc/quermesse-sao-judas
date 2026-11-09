/**
 * Edge Function: convida um colaborador e atribui barracas autorizadas.
 * Apenas administradores ATIVOS, verificados no banco, podem invocá-la.
 * Segredos devem existir SOMENTE no ambiente das Edge Functions.
 */
import { createClient } from "npm:@supabase/supabase-js@2.95.0";

const origin = Deno.env.get("ALLOWED_ORIGIN") || "*";
const headers = {
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};
const respond = (status: number, value: unknown) =>
  new Response(JSON.stringify(value), { status, headers });
const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST")
    return respond(405, { error: "Método não permitido" });
  const authorization = request.headers.get("Authorization") || "";
  if (!authorization.startsWith("Bearer "))
    return respond(401, { error: "Faça login para continuar" });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anon =
      Deno.env.get("SUPABASE_ANON_KEY") ||
      JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") || "{}").default;
    const secret =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
      JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}").default;
    if (!supabaseUrl || !anon || !secret)
      return respond(503, { error: "Configuração do servidor incompleta" });

    const actor = createClient(supabaseUrl, anon, {
      global: { headers: { Authorization: authorization } },
    });
    const token = authorization.slice("Bearer ".length);
    const {
      data: { user },
      error: sessionError,
    } = await actor.auth.getUser(token);
    if (sessionError || !user)
      return respond(401, { error: "Sessão inválida" });

    const admin = createClient(supabaseUrl, secret, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("id,role,active")
      .eq("id", user.id)
      .single();
    if (
      profileError ||
      !profile ||
      profile.role !== "admin" ||
      !profile.active
    ) {
      return respond(403, {
        error: "Somente um administrador ativo pode convidar pessoas",
      });
    }

    const body = await request.json();
    const name = String(body?.full_name || "")
      .trim()
      .replace(/\s+/g, " ");
    const email = String(body?.email || "")
      .trim()
      .toLowerCase();
    const stalls = Array.isArray(body?.stall_ids)
      ? [...new Set(body.stall_ids.map(String))]
      : [];
    if (name.length < 3 || name.length > 120)
      return respond(400, {
        error: "Informe nome completo (3 a 120 caracteres)",
      });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)
      return respond(400, { error: "E-mail inválido" });
    if (
      stalls.length < 1 ||
      stalls.length > 20 ||
      stalls.some((id: string) => !uuidRegex.test(id))
    ) {
      return respond(400, { error: "Selecione entre 1 e 20 barracas válidas" });
    }
    const { data: activeStalls, error: stallError } = await admin
      .from("stalls")
      .select("id")
      .in("id", stalls)
      .eq("active", true);
    if (stallError || activeStalls?.length !== stalls.length)
      return respond(400, { error: "Barracas inválidas ou inativas" });

    const { data: existing } = await admin
      .from("profiles")
      .select("id")
      .ilike("email", email)
      .maybeSingle();
    if (existing)
      return respond(409, { error: "Este e-mail já está cadastrado" });
    const { data: invite, error: inviteError } =
      await admin.auth.admin.inviteUserByEmail(email, {
        data: { full_name: name },
      });
    if (inviteError || !invite.user)
      return respond(400, {
        error: inviteError?.message || "Falha ao enviar o convite",
      });

    const id = invite.user.id;
    const { error: profileSaveError } = await admin.from("profiles").insert({
      id,
      email,
      full_name: name,
      role: "collaborator",
      active: true,
    });
    const { error: assignError } = profileSaveError
      ? { error: null }
      : await admin
          .from("profile_stalls")
          .insert(stalls.map((stall_id) => ({ user_id: id, stall_id })));

    if (profileSaveError || assignError) {
      // Evita deixar um usuário recém-convidado com acesso incompleto.
      await admin.auth.admin.deleteUser(id);
      return respond(500, {
        error: "Falha ao finalizar cadastro. Nenhum perfil foi liberado.",
      });
    }
    return respond(200, { ok: true, invite_sent: true, user_id: id });
  } catch {
    return respond(500, { error: "Erro inesperado ao processar convite" });
  }
});
