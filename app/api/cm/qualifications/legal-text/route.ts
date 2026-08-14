import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { wrapContractInV3Html } from "@/lib/contract-render";
import { ROLE_LABELS } from "@/lib/qualification-roles";

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
      person_type, company_name, company_cnpj, company_address,
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
  const isPJ = party.person_type === "PJ";
  const partyLabel = isPJ
    ? `${party.company_name ?? "[RAZÃO SOCIAL NÃO INFORMADA]"} (CNPJ ${party.company_cnpj ?? "[NÃO INFORMADO]"}), doravante representada por ${party.full_name}`
    : party.full_name;

  const identBlock = isPJ
    ? `<h2>IDENTIFICAÇÃO, PESSOA JURÍDICA</h2>
<p><strong>Razão Social:</strong> ${party.company_name ?? "[NÃO INFORMADA]"}</p>
<p><strong>CNPJ:</strong> ${party.company_cnpj ?? "[NÃO INFORMADO]"}</p>
${party.company_address ? `<p><strong>Endereço da Sede:</strong> ${party.company_address}</p>` : ""}
<p><strong>Representada por:</strong> ${party.full_name}${party.nationality ? `, ${party.nationality}` : ""}${party.marital_status ? `, ${party.marital_status}` : ""}${party.profession ? `, ${party.profession}` : ""}, portador(a) do CPF ${party.cpf_cnpj ?? "[NÃO INFORMADO]"}${party.rg ? `, RG ${party.rg}` : ""}${party.endereco_completo ? `, residente e domiciliado(a) em ${party.endereco_completo}` : ""}.</p>`
    : `<h2>IDENTIFICAÇÃO, PESSOA FÍSICA</h2>
<p><strong>Nome:</strong> ${party.full_name}</p>
<p>${party.nationality ? `${party.nationality}, ` : ""}${party.marital_status ? `${party.marital_status}, ` : ""}${party.profession ? `${party.profession}, ` : ""}portador(a) do CPF/CNPJ ${party.cpf_cnpj ?? "[NÃO INFORMADO]"}${party.rg ? `, RG ${party.rg}` : ""}${party.birth_date ? `, nascido(a) em ${new Date(party.birth_date).toLocaleDateString("pt-BR")}` : ""}${party.endereco_completo ? `, residente e domiciliado(a) em ${party.endereco_completo}` : ""}.</p>`;

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
