import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { parseRevealField, resolveNodeValue } from "@/lib/qualification-mask";

// Revelação de dado sensível da ficha da Mesa (BRIEF 30/09/2026, 5.12 B, Fase 1C passo 1).
// O valor real só sai daqui, e SÓ DEPOIS de o registro em cm_party_qualification_field_views ser
// gravado com await. Se a gravação falhar, nada é devolvido. Nunca usar `void db...insert()`:
// o builder do supabase-js não envia a requisição sem await.

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const ALLOWED_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"];
const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 10 * 60 * 1000;

const NO_STORE = { "Cache-Control": "no-store" };

async function getCaller() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await svc().from("profiles").select("id, role").eq("id", user.id).single();
  if (!profile || !ALLOWED_ROLES.includes(profile.role as string)) return null;
  return { userId: user.id };
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: "Não autorizado" }, { status: 401, headers: NO_STORE });

  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { field?: unknown };
  const parsed = parseRevealField(body.field);
  if (!parsed) return NextResponse.json({ error: "Campo inválido" }, { status: 422, headers: NO_STORE });
  const loggedField = body.field as string;

  const db = svc();

  const { data: row } = await db
    .from("cm_party_qualifications")
    .select("id, status, deleted_at, cpf_cnpj, rg, id_number, pix_key, dados_bancarios, representation")
    .eq("id", id)
    .single();
  if (!row) return NextResponse.json({ error: "Qualificação não encontrada" }, { status: 404, headers: NO_STORE });
  if (row.deleted_at || row.status !== "preenchido") {
    return NextResponse.json({ error: "Esta qualificação não permite revelar dados" }, { status: 409, headers: NO_STORE });
  }

  // Limite de taxa contado no próprio log (a Vercel tem várias instâncias, contador em memória não vale).
  const since = new Date(Date.now() - RATE_WINDOW_MS).toISOString();
  const { count, error: countError } = await db
    .from("cm_party_qualification_field_views")
    .select("id", { count: "exact", head: true })
    .eq("viewed_by", caller.userId)
    .gte("viewed_at", since);
  if (countError) {
    return NextResponse.json({ error: "Não foi possível registrar o acesso, tente novamente" }, { status: 500, headers: NO_STORE });
  }
  if ((count ?? 0) >= RATE_LIMIT) {
    return NextResponse.json({ error: "Muitas revelações em pouco tempo, aguarde alguns minutos" }, { status: 429, headers: NO_STORE });
  }

  // Valor real. Nó da cadeia: valida posição e identificador (v3_client_id ou "sem-id").
  let value: unknown = null;
  if (parsed.kind === "principal") {
    value = (row as Record<string, unknown>)[parsed.field];
    if (parsed.field === "cpf_cnpj" && typeof value === "string" && value.replace(/[^0-9A-Za-z]/g, "").length === 14) {
      return NextResponse.json({ error: "CNPJ não é mascarado" }, { status: 422, headers: NO_STORE });
    }
  } else {
    value = resolveNodeValue(row.representation as any, parsed.index, parsed.id, parsed.field);
  }
  const empty = value == null || (typeof value === "string" && value.trim() === "") ||
    (typeof value === "object" && Object.values(value as Record<string, unknown>).every((x) => x == null || String(x).trim() === ""));
  if (empty) return NextResponse.json({ error: "Campo sem valor para revelar" }, { status: 404, headers: NO_STORE });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip") ?? "unknown";

  // Log ANTES do dado. Falhou, nada sai. Nunca registrar o valor em mensagem de erro.
  const { error: logError } = await db.from("cm_party_qualification_field_views").insert({
    qualification_id: id,
    field: loggedField,
    viewed_by: caller.userId,
    ip,
  });
  if (logError) {
    console.error("[qualificacao reveal] falha ao gravar log de revelacao", { qualification_id: id, field: loggedField, code: logError.code });
    return NextResponse.json({ error: "Não foi possível registrar o acesso, tente novamente" }, { status: 500, headers: NO_STORE });
  }

  return NextResponse.json({ value }, { headers: NO_STORE });
}
