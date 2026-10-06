import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

// Revelação do CPF no Cliente 360 (05/10/2026). O segmento dinâmico se chama [documento] só porque
// o Next exige o mesmo nome no mesmo nível de /api/clientes/[documento]; aqui ele recebe o ID do
// v3_clients (UUID), nunca o documento. O valor real só sai DEPOIS de o log em audit_logs ser
// gravado com await. Falhou o log, nada é devolvido. Nunca usar `void db...insert()`.

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const ALLOWED_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const NO_STORE = { "Cache-Control": "no-store" };
const ACTION = "cliente_360_revelacao";

export async function POST(req: NextRequest, { params }: { params: Promise<{ documento: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401, headers: NO_STORE });

  const db = svc();
  const { data: profile } = await db.from("profiles").select("role").eq("id", user.id).single();
  if (!ALLOWED_ROLES.includes(profile?.role as string)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403, headers: NO_STORE });
  }

  const { documento: id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404, headers: NO_STORE });

  const { data: client } = await db.from("v3_clients").select("id, document_number").eq("id", id).maybeSingle();
  if (!client) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404, headers: NO_STORE });

  // Limite de taxa contado no próprio log (a Vercel tem várias instâncias, contador em memória não vale).
  const since = new Date(Date.now() - RATE_WINDOW_MS).toISOString();
  const { count, error: countError } = await db
    .from("audit_logs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("action", ACTION)
    .gte("created_at", since);
  if (countError) {
    return NextResponse.json({ error: "Não foi possível registrar o acesso, tente novamente" }, { status: 500, headers: NO_STORE });
  }
  if ((count ?? 0) >= RATE_LIMIT) {
    return NextResponse.json({ error: "Muitas revelações em pouco tempo, aguarde alguns minutos" }, { status: 429, headers: NO_STORE });
  }

  // Log ANTES do dado. Nunca registrar o valor em mensagem de erro.
  const { error: logError } = await db.from("audit_logs").insert({
    user_id: user.id,
    action: ACTION,
    entity: "v3_clients",
    entity_id: client.id,
    ip_address: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip") ?? null,
  });
  if (logError) {
    console.error("[clientes 360 reveal] falha ao gravar log de revelacao", { client_id: client.id, code: logError.code });
    return NextResponse.json({ error: "Não foi possível registrar o acesso, tente novamente" }, { status: 500, headers: NO_STORE });
  }

  return NextResponse.json({ value: client.document_number }, { headers: NO_STORE });
}
