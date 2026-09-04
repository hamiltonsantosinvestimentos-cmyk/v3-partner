import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";
import { normalizeDocument, detectDocumentType } from "@/lib/v3-clients";
import { findValidKycDocument, kycValidUntil, type KycDocumentKind } from "@/lib/kyc-documents";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// CPF (PF) sempre pede a foto de identificação; CNPJ (PJ) sempre pede o contrato
// social -- mesmo mapeamento usado no upload (app/api/cm/qualificacao/[token]/documents).
const KIND_BY_DOC_TYPE: Record<"CPF" | "CNPJ", KycDocumentKind> = {
  CPF: "identificacao_foto",
  CNPJ: "contrato_social",
};

/** GET /api/cm/kyc/check?token=X&document=Y — verifica, silenciosamente (sem expor o
 *  arquivo em si), se a V3 já tem um documento de KYC válido (< 12 meses) para este
 *  CPF/CNPJ, para o formulário público pular o upload e mostrar o badge de reaproveitamento.
 *
 *  SEGURANÇA (decisão registrada no BRIEF de 04/09/2026): esta rota é gated por um
 *  `token` de qualificação PENDENTE e ainda não preenchida -- nunca aberta sem token.
 *  Sem esse gate, seria um oráculo público de enumeração (qualquer CPF/CNPJ poderia ser
 *  varrido para descobrir quem já é cliente validado da V3). Com o gate, o risco fica
 *  restrito a quem já recebeu um convite real (token UUID aleatório, enviado só por
 *  e-mail do envolvido) -- residual, mas não fechado por completo: quem tem um token
 *  válido ainda pode consultar qualquer CPF/CNPJ, não só o próprio. Aceito conscientemente,
 *  registrado no BRIEF, não corrigido silenciosamente aqui.
 *
 *  Nunca cria cliente novo (ao contrário de resolveClient()): uma consulta de
 *  verificação não deve poluir v3_clients com números possivelmente digitados errado
 *  antes da confirmação final no submit. */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  const rawDocument = searchParams.get("document");

  if (!token || !rawDocument) {
    return NextResponse.json({ error: "token e document são obrigatórios" }, { status: 422 });
  }

  const db = svc();

  const { data: qualification } = await db
    .from("cm_party_qualifications")
    .select("id, status")
    .eq("qualification_token", token)
    .single();

  if (!qualification) return NextResponse.json({ error: "Link inválido ou expirado" }, { status: 404 });
  if (qualification.status === "preenchido") {
    return NextResponse.json({ error: "Este link já foi preenchido." }, { status: 409 });
  }

  const digits = normalizeDocument(rawDocument);
  const docType = detectDocumentType(digits);
  if (!docType) return NextResponse.json({ valid: false });

  const { data: client } = await db
    .from("v3_clients")
    .select("id")
    .eq("document_number", digits)
    .maybeSingle();

  if (!client) return NextResponse.json({ valid: false });

  const kind = KIND_BY_DOC_TYPE[docType];
  const doc = await findValidKycDocument(db, client.id, kind);
  if (!doc) return NextResponse.json({ valid: false });

  return NextResponse.json({
    valid: true,
    document_kind: kind,
    uploaded_at: doc.uploaded_at,
    valid_until: kycValidUntil(doc.uploaded_at),
  });
}
