import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

function svc() {
  return sc(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// POST — dispara e-mail de boas-vindas uma única vez por partner
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  // Verifica se já foi enviado (evita duplicate)
  if (user.user_metadata?.welcome_email_sent) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const { data: profile } = await svc()
    .from("profiles")
    .select("full_name, email, role")
    .eq("id", user.id)
    .single();

  if (!profile) return NextResponse.json({ ok: true });

  const isPartner = ["PARTNER", "PARTNER_PRO"].includes(profile.role);
  if (!isPartner) return NextResponse.json({ ok: true });

  // Marca como enviado ANTES de enviar (evita race condition)
  await svc().auth.admin.updateUserById(user.id, {
    user_metadata: { ...user.user_metadata, welcome_email_sent: true },
  });

  // Dispara e-mail
  try {
    const { notifyBoasVindasPartner } = await import("@/lib/email");
    await notifyBoasVindasPartner({
      partnerEmail: profile.email,
      partnerName: profile.full_name || "Parceiro",
      plano: profile.role,
    });
  } catch {
    // silent — não bloqueia onboarding
  }

  return NextResponse.json({ ok: true });
}
