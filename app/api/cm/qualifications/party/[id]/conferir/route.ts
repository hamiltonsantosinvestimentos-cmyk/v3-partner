import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { logAuditStrict } from "@/lib/audit";
import { declaracoesCompletas, montarConferencia } from "@/lib/qualification-conferencia";
import { calcularExigidos } from "@/lib/qualification-conferencia-server";

// "Liberar qualificação" (BRIEF Trava de Liberação, seção 2). Só ADMIN e GESTAO. O servidor calcula o que é
// exigido (documentos ativos da ficha e campos a revelar, inclusive a cadeia de representantes) e entrega à
// função fn_liberar_qualificacao, que confere no banco que o MESMO usuário abriu e revelou tudo depois do
// preenchimento. O corpo nunca traz lista de documentos nem de campos: só as declarações marcadas.

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const NO_STORE = { "Cache-Control": "no-store" };
const ALLOWED_ROLES = ["ADMIN", "GESTAO"];

async function getCaller() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await svc().from("profiles").select("id, role, full_name").eq("id", user.id).single();
  if (!profile || !ALLOWED_ROLES.includes(profile.role as string)) return null;
  return { userId: user.id, name: (profile.full_name as string | null) ?? "Usuário" };
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: "Não autorizado" }, { status: 401, headers: NO_STORE });

  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { declaracoes?: unknown };
  const db = svc();

  const { data: row } = await db
    .from("cm_party_qualifications")
    .select("id, status, deleted_at, person_type, v3_client_id, filled_at, cpf_cnpj, rg, id_number, representation, conferida_em")
    .eq("id", id)
    .single();
  if (!row) return NextResponse.json({ error: "Qualificação não encontrada" }, { status: 404, headers: NO_STORE });
  if (row.deleted_at || row.status !== "preenchido") {
    return NextResponse.json({ error: "Só se libera qualificação preenchida" }, { status: 409, headers: NO_STORE });
  }

  const exigidos = await calcularExigidos(db, row as never);
  if (!declaracoesCompletas(body.declaracoes, exigidos.declaracoes)) {
    return NextResponse.json({ error: "Marque a declaração de conferência de cada campo exigido." }, { status: 422, headers: NO_STORE });
  }
  const documentos = exigidos.documentos.map((d) => d.id);
  if (documentos.length === 0) {
    return NextResponse.json({ error: "A ficha não tem documento de identificação para conferir." }, { status: 422, headers: NO_STORE });
  }
  const campos = exigidos.campos;
  const conferencia = montarConferencia(documentos, campos, exigidos.declaracoes);

  // Log antes do efeito (await): se falhar, a liberação não acontece.
  try {
    await logAuditStrict({
      userId: caller.userId,
      userName: caller.name,
      action: "UPDATE",
      entity: "cm_party_qualifications",
      entityId: id,
      newData: { evento: "qualificacao_liberada", documentos: documentos.length, campos: campos.length },
    });
  } catch {
    return NextResponse.json({ error: "Não foi possível registrar a liberação, tente novamente" }, { status: 500, headers: NO_STORE });
  }

  const { error } = await db.rpc("fn_liberar_qualificacao", {
    p_qualification_id: id,
    p_user_id: caller.userId,
    p_conferencia: conferencia,
  });
  if (error) {
    // Mensagem do banco sem dado pessoal: diz o que falta abrir ou revelar.
    return NextResponse.json({ error: error.message }, { status: 422, headers: NO_STORE });
  }
  return NextResponse.json({ success: true }, { headers: NO_STORE });
}
