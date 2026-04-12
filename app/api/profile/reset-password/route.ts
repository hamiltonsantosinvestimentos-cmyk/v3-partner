import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  // Usa supabase auth admin para enviar email de reset
  const svc = sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const redirectTo = `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://v3-partner.vercel.app"}/auth/callback?next=/configuracoes`;

  const { error } = await svc.auth.resetPasswordForEmail(user.email, { redirectTo });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, message: `Email de redefinição enviado para ${user.email}` });
}
