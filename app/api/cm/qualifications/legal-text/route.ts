import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { wrapContractInV3Html } from "@/lib/contract-render";
import { ROLE_LABELS } from "@/lib/qualification-roles";
import { buildLegalQualification, PARTY_NATURE_LABELS, type PartyNature } from "@/lib/legal-qualification";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// Exclusivo de Mesa/Governança -- nunca Partner. O texto expõe CPF/CNPJ e
// endereço real de terceiro, mesmo gate de role usado no resto da esteira
// de qualificação (route.ts irmão), decisão registrada no BRIEF de 13/08/2026.
const ALLOWED_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"];

// Cláusula de Não Circunvenção e Confidencialidade, adaptada da Cláusula
// Terceira real do contrato de parceria Home Cash (11/08/2026, migration
// 20260811d_contratos_esteira_e_2_contratos_reais.sql), generalizada para
// qualquer comissionado indicado (não só contraparte de parceria). Texto
// nunca inventado do zero -- é a mesma cláusula já usada e aceita em
// instrumento real da V3, só parametrizada com o nome/documento da parte.
function ncndClause(partyLabel: string): string {
  return `<h2>CLÁUSULA ÚNICA, DA NÃO-CIRCUNVENÇÃO E CONFIDENCIALIDADE</h2>
<p>1.1. ${partyLabel} compromete-se a não contornar, contatar ou negociar diretamente, durante a vigência desta qualificação e pelo prazo de 12 (doze) meses após o encerramento da operação a que se refere, com clientes, fundos, parceiros financeiros ou oportunidades apresentados pela V3 PARTNERS, sem a prévia e expressa autorização por escrito.</p>
<p>1.2. ${partyLabel} manterá estrito sigilo sobre todas as informações estratégicas, dados de clientes, termos comerciais e demais informações confidenciais a que tiver acesso em razão desta qualificação, durante a vigência e pelo prazo de 5 (cinco) anos após o seu término.</p>
<p>1.3. Na hipótese de descumprimento do disposto nesta cláusula, a parte infratora ficará sujeita ao pagamento de multa compensatória equivalente a 2 (duas) vezes o montante total das comissões/honorários estimados que seriam devidos na operação circunventada, sem prejuízo de apuração de perdas e danos adicionais.</p>`;
}

// GET /api/cm/qualifications/legal-text?id=<party_qualification_id> —
// gera a minuta de qualificação (PF ou PJ) de uma parte já preenchida.
// Fase 2 do BRIEF de 13/08/2026 (continuação da Fase 1, indicação rápida).
// Não é o instrumento final: sempre marcado como pendente de revisão
// jurídica. O dispatch formal (Fase 3) fica a cargo da Governança.
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const db = svc();
  const { data: profile } = await db.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !ALLOWED_ROLES.includes(profile.role as string)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id é obrigatório" }, { status: 422 });

  const { data: party, error } = await db
    .from("cm_party_qualifications")
    .select(`
      id, full_name, email, role_in_document, status, filled_at,
      cpf_cnpj, rg, endereco_completo,
      person_type, party_nature, company_name, company_cnpj, company_address, company_legal_nature, representation,
      nationality, marital_status, profession, birth_date, phone,
      cm_qualification_batches(id, side, document_type)
    `)
    .eq("id", id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!party) return NextResponse.json({ error: "Qualificação não encontrada" }, { status: 404 });
  if (party.status !== "preenchido") {
    return NextResponse.json({ error: "Esta parte ainda não preencheu os dados de qualificação." }, { status: 422 });
  }

  const roleLabel = ROLE_LABELS[party.role_in_document] ?? party.role_in_document;
  const nature: PartyNature = (party.party_nature as PartyNature | null) ?? (party.person_type === "PJ" ? "PJ" : "PF");
  const isPJ = nature === "PJ";
  const partyLabel = isPJ
    ? `${party.company_name ?? "[RAZÃO SOCIAL NÃO INFORMADA]"} (CNPJ ${party.company_cnpj ?? "[NÃO INFORMADO]"}), doravante representada por ${party.full_name}`
    : party.full_name;

  // Motor único (01/09/2026, diretriz Dr. Athaydes): monta a qualificação
  // civil completa (PF/Procuração/Incapaz/Espólio/PJ, com representação
  // recursiva quando houver) em lib/legal-qualification.ts. Este bloco só
  // adiciona o título por natureza, a prosa em si nunca é duplicada aqui.
  const identBlock = `<h2>IDENTIFICAÇÃO, ${PARTY_NATURE_LABELS[nature].toUpperCase()}</h2>
<p>${buildLegalQualification(party)}</p>`;

  const body = `
<div style="background:rgba(190,72,72,.12);border:1px solid rgba(190,72,72,.45);border-radius:6px;padding:12px 16px;margin-bottom:24px;text-align:center">
  <p style="color:#F5F1E8;font-weight:700;font-size:11px;letter-spacing:.05em;text-transform:uppercase;margin:0">
    MINUTA, PENDENTE DE REVISÃO JURÍDICA. NÃO CONSTITUI INSTRUMENTO VÁLIDO ATÉ APROVAÇÃO FORMAL.
  </p>
</div>
<p><strong>Papel na operação:</strong> ${roleLabel}</p>
${identBlock}
${ncndClause(isPJ ? "A CONTRATADA" : "O(A) QUALIFICADO(A)")}
<p style="margin-top:32px;font-size:10px;color:#9BAFC5">Texto gerado a partir dos dados fornecidos pelo próprio indicado via link de intake, em ${party.filled_at ? new Date(party.filled_at).toLocaleDateString("pt-BR") : "data não registrada"}.</p>`;

  const html = wrapContractInV3Html(
    `Minuta de Qualificação, ${roleLabel}`,
    body,
    [{ role: roleLabel, name: partyLabel, doc: isPJ ? party.company_cnpj : party.cpf_cnpj }]
  );

  return NextResponse.json({
    html,
    party_name: party.full_name,
    person_type: party.person_type,
    role_label: roleLabel,
  });
}
