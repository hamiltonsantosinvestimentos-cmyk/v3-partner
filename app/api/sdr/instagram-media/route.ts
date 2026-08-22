import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { listRecentInstagramMedia, InstagramDmError } from "@/lib/instagram-dm";

const ADMIN_ROLES = ["ADMIN", "GESTAO"] as const;

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

async function authGuard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await svc().from("profiles").select("id, full_name, role").eq("id", user.id).single();
  if (!ADMIN_ROLES.includes(profile?.role as typeof ADMIN_ROLES[number])) return null;
  return { user, profile };
}

// GET — lista os posts recentes da conta do Instagram, pra escolher o post
// de um gatilho de Comment-to-DM (o media_id não dá pra resolver a partir
// de uma URL colada, então buscamos direto da API pra usuário selecionar).
export async function GET() {
  const auth = await authGuard();
  if (!auth) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const media = await listRecentInstagramMedia();
    return NextResponse.json({ media });
  } catch (e) {
    const msg = e instanceof InstagramDmError ? e.message : "Erro ao consultar posts do Instagram";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
