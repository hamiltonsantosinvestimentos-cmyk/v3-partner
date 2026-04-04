import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// GET — lê config do Pipefy M&A salva no banco
export async function GET() {
  try {
    const supabase = serviceClient();
    const { data } = await supabase
      .from("app_config")
      .select("value")
      .eq("key", "pipefy_ma")
      .single();
    return NextResponse.json({ config: data?.value ?? null });
  } catch {
    return NextResponse.json({ config: null });
  }
}

// POST — salva config do Pipefy M&A no banco (admin/gestao)
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const { data: profile } = await supabase
      .from("profiles").select("role").eq("id", user.id).single();
    if (!["ADMIN", "GESTAO"].includes(profile?.role ?? "")) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }

    const body = await req.json();
    const { token, pipeId, formUrl } = body;
    if (!token || !pipeId) {
      return NextResponse.json({ error: "token e pipeId obrigatórios" }, { status: 400 });
    }

    const svc = serviceClient();
    await svc.from("app_config").upsert(
      { key: "pipefy_ma", value: { token, pipeId, formUrl: formUrl ?? "" }, updated_at: new Date().toISOString() },
      { onConflict: "key" }
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
