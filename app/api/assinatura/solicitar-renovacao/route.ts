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
    .select("full_name, email, role, trial_expires_at, created_at")
    .eq("id", user.id)
    .single();

  if (!["STARTER", "PARTNER", "PARTNER_PRO", "ENTERPRISE"].includes(profile?.role ?? "")) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }

  const planoLabel = profile?.role === "ENTERPRISE" ? "Enterprise" : profile?.role === "PARTNER_PRO" ? "Partner PRO" : profile?.role === "STARTER" ? "Starter" : "Partner";
  const nome = profile?.full_name ?? profile?.email ?? "Partner";

  const expiresDate = profile?.trial_expires_at
    ? new Date(profile.trial_expires_at).toLocaleDateString("pt-BR")
    : new Date(new Date(profile!.created_at).getTime() + 30 * 86400000).toLocaleDateString("pt-BR");

  // Busca todos os admins
  const { data: admins } = await svc()
    .from("profiles")
    .select("id")
    .eq("role", "ADMIN")
    .eq("is_active", true);

  if (admins && admins.length > 0) {
    await svc().from("notifications").insert(
      admins.map((a) => ({
        user_id: a.id,
        title: "Solicitação de Renovação",
        message: `${nome} (${planoLabel}) solicitou renovação de acesso. Expira em ${expiresDate}.`,
        type: "RENEWAL_REQUEST",
        action_url: "/usuarios",
        read: false,
      }))
    );
  }

  return NextResponse.json({ ok: true });
}
