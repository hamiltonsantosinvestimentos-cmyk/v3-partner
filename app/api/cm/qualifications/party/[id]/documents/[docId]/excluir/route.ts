import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { motivoValido } from "@/lib/motivo";
import { calcularExigidos } from "@/lib/qualification-conferencia-server";
import { mensagemBloqueio, motivoTemDocumento, papelRotulo, type LinhaImpacto } from "@/lib/qualification-exclusao";
import { MOTIVOS_EXCLUSAO, fraseMotivo } from "@/lib/comunicacao-externa";
import { avisarTitularDaQualificacao } from "@/lib/qualificacao/aviso-titular";

// Exclusão justificada de documento de qualificação (BRIEF Trava de Liberação, seção 3).
// GET  = impacto (quais fichas usam o documento e se há bloqueio), sem efeito algum.
// POST = exclui (lógico, Lixeira de 30 dias), reabre cada ficha preenchida afetada pelo MESMO link e
//        limpa a conferência, tudo numa função de banco atômica (fn_excluir_documento_qualificacao).
// Só ADMIN e GESTAO excluem direto. MESA_OPERACIONAL vê o impacto, mas não exclui (a solicitação ao
// sócio é outra entrega). Nenhum dado pessoal sai daqui: papel, estado e código do contrato.

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const NO_STORE = { "Cache-Control": "no-store" };
const VIEW_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"];
const DELETE_ROLES = ["ADMIN", "GESTAO"];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function getCaller() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await svc().from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !VIEW_ROLES.includes(profile.role as string)) return null;
  return { userId: user.id, role: profile.role as string };
}

/** O documento precisa aparecer na ficha onde o operador clicou (parte principal ou cadeia). */
async function documentoPertenceAFicha(db: ReturnType<typeof svc>, qualificationId: string, docId: string): Promise<boolean> {
  const { data: row } = await db
    .from("cm_party_qualifications")
    .select("id, person_type, v3_client_id, filled_at, cpf_cnpj, rg, id_number, representation, deleted_at")
    .eq("id", qualificationId)
    .single();
  if (!row || row.deleted_at) return false;
  const exigidos = await calcularExigidos(db, row as never);
  return exigidos.documentos.some((d) => d.id === docId);
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string; docId: string }> }) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: "Não autorizado" }, { status: 401, headers: NO_STORE });
  const { id, docId } = await params;
  if (!UUID_RE.test(docId)) return NextResponse.json({ error: "Documento inválido" }, { status: 422, headers: NO_STORE });

  const db = svc();
  if (!(await documentoPertenceAFicha(db, id, docId))) {
    return NextResponse.json({ error: "Documento não encontrado" }, { status: 404, headers: NO_STORE });
  }
  const { data, error } = await db.rpc("fn_documento_exclusao_impacto", { p_document_id: docId });
  if (error) return NextResponse.json({ error: "Não foi possível calcular o impacto" }, { status: 500, headers: NO_STORE });

  const linhas = (data ?? []) as LinhaImpacto[];
  return NextResponse.json({
    pode_excluir_direto: DELETE_ROLES.includes(caller.role),
    bloqueio: mensagemBloqueio(linhas),
    fichas: linhas.map((l) => ({
      papel: papelRotulo(l.role_in_document),
      estado: l.status,
      contrato: l.contract_code,
      bloqueio: l.bloqueio,
      reabre: l.status === "preenchido",
    })),
  }, { headers: NO_STORE });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; docId: string }> }) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: "Não autorizado" }, { status: 401, headers: NO_STORE });
  if (!DELETE_ROLES.includes(caller.role)) {
    return NextResponse.json({ error: "Só ADMIN e GESTAO excluem documento. Peça a um deles." }, { status: 403, headers: NO_STORE });
  }
  const { id, docId } = await params;
  if (!UUID_RE.test(docId)) return NextResponse.json({ error: "Documento inválido" }, { status: 422, headers: NO_STORE });

  const body = (await req.json().catch(() => ({}))) as { motivo?: unknown; motivo_codigo?: unknown };
  const motivo = motivoValido(body.motivo);
  if (!motivo) return NextResponse.json({ error: "Informe o motivo, de 5 a 500 caracteres." }, { status: 422, headers: NO_STORE });
  // Motivo padronizado (BRIEF Aviso ao titular, 15/11/2026): validado no servidor, não só no dropdown. Ausente ou fora do
  // catálogo: 422, sem alterar nada. O texto livre acima fica só na auditoria e nunca vai ao e-mail.
  if (!fraseMotivo(MOTIVOS_EXCLUSAO, body.motivo_codigo).ok) {
    return NextResponse.json({ error: "Escolha o motivo padronizado da exclusão." }, { status: 422, headers: NO_STORE });
  }
  const motivoCodigo = body.motivo_codigo as string;
  if (motivoTemDocumento(motivo)) {
    return NextResponse.json({ error: "O motivo não pode conter CPF nem CNPJ. Descreva sem o número do documento." }, { status: 422, headers: NO_STORE });
  }

  const db = svc();
  if (!(await documentoPertenceAFicha(db, id, docId))) {
    return NextResponse.json({ error: "Documento não encontrado" }, { status: 404, headers: NO_STORE });
  }

  // A função de banco devolve só contagens. Para avisar cada titular, capturo ANTES as fichas preenchidas que a exclusão
  // vai reabrir e o tipo do documento (nome externo vem do catálogo, nunca do arquivo).
  const { data: impacto } = await db.rpc("fn_documento_exclusao_impacto", { p_document_id: docId });
  const idsReabertas = ((impacto ?? []) as LinhaImpacto[]).filter((l) => l.status === "preenchido").map((l) => l.qualification_id);
  const { data: docRow } = await db.from("cm_party_qualification_documents").select("document_kind").eq("id", docId).maybeSingle();
  const documentKind = (docRow?.document_kind as string | null | undefined) ?? null;

  const { data, error } = await db.rpc("fn_excluir_documento_qualificacao", { p_document_id: docId, p_user_id: caller.userId, p_reason: motivo });
  if (error) {
    // 42501 papel; P0001 regra (bloqueio, motivo, já excluído). A mensagem do banco não tem dado pessoal.
    const status = error.code === "42501" ? 403 : error.code === "P0001" ? 409 : 500;
    return NextResponse.json({ error: status === 500 ? "Não foi possível excluir o documento." : error.message }, { status, headers: NO_STORE });
  }
  // Aviso ao titular de cada ficha reaberta: última etapa, em paralelo (cada um com o seu tempo limite), nunca lança e nunca
  // desfaz a exclusão. Chave desligada por padrão. O código do motivo também vai ao log, sem o texto livre.
  try {
    await db.from("audit_logs").insert({
      user_id: caller.userId, action: "UPDATE", entity: "cm_party_qualification_documents", entity_id: docId,
      new_data: { evento: "documento_qualificacao_motivo_padronizado", motivo_codigo: motivoCodigo, fichas_para_aviso: idsReabertas.length },
    });
  } catch { /* o log do código não desfaz a exclusão */ }
  const avisos = await Promise.all(
    idsReabertas.map((qualificationId) => avisarTitularDaQualificacao(db, { qualificationId, tipo: "exclusao", motivoCodigo, documentKind })),
  );
  return NextResponse.json({ success: true, ...(data as object), avisos_enviados: avisos.filter((a) => a === "enviado").length }, { headers: NO_STORE });
}
