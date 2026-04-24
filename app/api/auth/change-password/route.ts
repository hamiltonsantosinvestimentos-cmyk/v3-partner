import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { password } = await req.json() as { password: string };
  if (!password || password.length < 6) {
    return NextResponse.json({ error: "Senha deve ter no mínimo 6 caracteres" }, { status: 400 });
  }

  const svc = sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  // Atualiza senha via service role (evita restrições do cliente)
  const { error: pwErr } = await svc.auth.admin.updateUserById(user.id, {
    password,
    app_metadata: { must_change_password: false },
  });

  if (pwErr) return NextResponse.json({ error: pwErr.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
