import { NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

const svc = () =>
  sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// GET — leitura pública das configurações da plataforma
export async function GET() {
  const { data, error } = await svc()
    .from("platform_settings")
    .select("key, value")
    .in("key", ["founder_video_url"]);

  if (error) {
    // Tabela ainda não existe — retorna defaults
    return NextResponse.json({
      founder_video_url: "https://www.youtube.com/embed/dQw4w9WgXcQ",
    });
  }

  const settings: Record<string, string> = {
    founder_video_url: "https://www.youtube.com/embed/dQw4w9WgXcQ",
  };
  for (const row of data ?? []) {
    settings[row.key as string] = row.value as string;
  }

  return NextResponse.json(settings);
}

// PATCH — apenas ADMIN pode alterar
export async function PATCH(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: profile } = await svc()
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || (profile.role as string) !== "ADMIN") {
    return NextResponse.json({ error: "Acesso restrito a ADMIN" }, { status: 403 });
  }

  const body = await req.json();
  const allowed = ["founder_video_url"];
  const updates = Object.entries(body as Record<string, string>).filter(([k]) =>
    allowed.includes(k)
  );

  if (updates.length === 0) {
    return NextResponse.json({ error: "Nenhuma chave válida" }, { status: 400 });
  }

  for (const [key, value] of updates) {
    const { error } = await svc()
      .from("platform_settings")
      .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
