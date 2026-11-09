import { createClient } from "@supabase/supabase-js";
import { createDemoClient, selectDemoRole } from "./demoClient.js";
// Nunca há fallback do ambiente de produção para dados da igreja.
export const isDemo = import.meta.env?.VITE_DEMO_MODE !== "false";
export function createClientForEnvironment() {
  if (isDemo) return createDemoClient();
  const url = import.meta.env?.VITE_SUPABASE_URL;
  const key = import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key)
    throw new Error(
      "Configure VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY no seu .env local.",
    );
  if (!/^sb_publishable_/.test(key) && !/^eyJ/.test(key))
    throw new Error("Use apenas uma chave pública do Supabase");
  return createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
}
export function demoLogin(role) {
  if (!isDemo) throw new Error("Demo desativada");
  return selectDemoRole(role);
}
