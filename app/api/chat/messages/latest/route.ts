import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const ADMIN_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"];

// GET — última mensagem de qualquer sala (para admins) ou da sala do partner
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: profile } = await svc()
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const role = (profile?.role as string) ?? "";
  const isAdmin = ADMIN_ROLES.includes(role);

  if (!isAdmin) {
    return NextResponse.json({ error: "Acesso restrito" }, { status: 403 });
  }

  // Busca a mensagem mais recente de qualquer sala enviada por partners
  const { data, error } = await svc()
    .from("chat_messages")
    .select("id, room_id, sender_id, sender_name, sender_role, content, created_at")
    .not("sender_role", "in", `(${ADMIN_ROLES.join(",")})`)
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ messages: data ?? [] });
}
