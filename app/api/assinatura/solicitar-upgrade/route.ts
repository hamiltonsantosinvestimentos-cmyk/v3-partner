import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: profile } = await svc()
    .from("profiles")
    .select("full_name, email, role")
    .eq("id", user.id)
    .single();

  // Upgrade só disponível para PARTNER (não PRO)
  if (profile?.role !== "PARTNER") {
    return NextResponse.json({ error: "Não aplicável ao seu plano" }, { status: 400 });
  }

  const nome = profile?.full_name ?? profile?.email ?? "Partner";

  // Notifica todos os admins
  const { data: admins } = await svc()
    .from("profiles")
    .select("id")
    .eq("role", "ADMIN")
    .eq("is_active", true);

  if (admins && admins.length > 0) {
    await svc().from("notifications").insert(
      admins.map((a) => ({
        user_id: a.id,
        title: "Solicitação de Upgrade para PRO",
        message: `${nome} quer fazer upgrade de Partner para Partner PRO (R$ 397/mês · 50% comissão).`,
        type: "UPGRADE_REQUEST",
        action_url: "/usuarios",
        read: false,
      }))
    );
  }

  return NextResponse.json({ ok: true });
}
