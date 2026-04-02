import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/supabase";

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || url.includes("SEU_PROJETO") || !key || key.includes("SUA_")) {
    throw new Error("Supabase não configurado — modo demo ativo");
  }

  return createBrowserClient<Database>(url, key);
}
