import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";
import { isValidCPF, isValidCNPJ } from "@/lib/validators/cpf-cnpj";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  nda_quadripartite: "NDA Quadripartite",
  fpa_venda: "FPA Venda",
  fpa_compra: "FPA Compra",
  mandato: "Mandato",
  contrato_final: "Contrato Final",
  contrato_parceria: "Contrato de Parceria",
};

// Papéis que recebem repasse de comissão precisam ADICIONALMENTE de dados
// bancários/PIX (mesmo padrão desde 28/07, Bolsa de Ativos) — isso é dado
// financeiro pro repasse, não faz parte da qualificação civil em si.
const ROLES_QUE_RECEBEM_REPASSE = ["mandatario", "intermediario_finder_venda", "intermediario_finder_compra"];

// Monta o endereço em prosa a partir das partes estruturadas, no mesmo
// formato da cláusula de qualificação real de contrato (31/08/2026, pedido
// explícito de João). Nunca deixa a Mesa/o indicado digitar o texto livre —
// isso evita CEP colado errado, cidade sem estado, etc., e garante que os
// 3 consumidores existentes (lib/qualification-roles.ts,
// api/cm/qualifications/legal-text, api/contracts/generate) continuem
// funcionando sem mudança nenhuma, porque endereco_completo/company_address
// seguem sendo uma string pronta, só que agora sempre bem formada.
function montarEndereco(parts: { rua?: string; numero?: string; bairro?: string; cidade?: string; estado?: string; cep?: string }): string | null {
  const { rua, numero, bairro, cidade, estado, cep } = parts;
  if (!rua?.trim() || !numero?.trim() || !bairro?.trim() || !cidade?.trim() || !estado?.trim() || !cep?.trim()) return null;
  return `${rua.trim()}, ${numero.trim()}, Bairro ${bairro.trim()}, ${cidade.trim()} – ${estado.trim()}, CEP ${cep.trim()}`;
}

// GET /api/cm/qualificacao/[token] — contexto público para o envolvido preencher.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const { data: qualification } = await svc()
    .from("cm_party_qualifications")
    .select("id, full_name, email, role_in_document, status, batch_id, cm_qualification_batches(document_type, cm_asset_listings(anonymous_id))")
    .eq("qualification_token", token)
    .single();

  if (!qualification) return NextResponse.json({ error: "Link inválido ou expirado" }, { status: 404 });

  const batch = qualification.cm_qualification_batches as any;
  const docLabel = DOCUMENT_TYPE_LABELS[batch?.document_type] ?? batch?.document_type;

  if (qualification.status === "preenchido") {
    return NextResponse.json({ locked: true, message: `Qualificação já enviada. Aguarde a geração do ${docLabel}.` }, { status: 409 });
  }

  return NextResponse.json({
    full_name: qualification.full_name,
    email: qualification.email,
    role_in_document: qualification.role_in_document,
    document_type_label: docLabel,
    anonymous_id: batch?.cm_asset_listings?.anonymous_id ?? null,
  });
}

// POST /api/cm/qualificacao/[token] — envolvido envia CPF/CNPJ, RG, endereço
// e dados bancários/PIX. Ao completar 100% do lote, marca o batch como
// "completo" e notifica a Mesa — a geração do instrumento jurídico
// (NDA Quadripartite/FPA/Mandato/Contrato Final) continua manual a partir
// daqui: os textos desses 4 documentos ainda não existem em contract_templates
// (só "NDA (Comprador Bolsa de Ativos)" e "Anexo FPA/NCND" existem hoje) e
// autoria de texto jurídico novo não é decisão que este código deve tomar.
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const { data: qualification } = await svc()
    .from("cm_party_qualifications")
    .select("id, batch_id, status, role_in_document")
    .eq("qualification_token", token)
    .single();

  if (!qualification) return NextResponse.json({ error: "Link inválido ou expirado" }, { status: 404 });
  if (qualification.status === "preenchido") {
    return NextResponse.json({ error: "Este link já foi preenchido." }, { status: 409 });
  }

  const recebeRepasse = ROLES_QUE_RECEBEM_REPASSE.includes(qualification.role_in_document);

  const body = await req.json().catch(() => ({}));
  const {
    cpf_cnpj, rg, dados_bancarios, pix_key,
    person_type, company_name, company_cnpj,
    nationality, marital_status, profession, birth_date, phone,
    endereco_rua, endereco_numero, endereco_bairro, endereco_cidade, endereco_estado, endereco_cep,
    company_rua, company_numero, company_bairro, company_cidade, company_estado, company_cep,
  } = body as {
    cpf_cnpj?: string;
    rg?: string;
    dados_bancarios?: { banco?: string; agencia?: string; conta?: string; tipo_conta?: string };
    pix_key?: string;
    person_type?: "PF" | "PJ";
    company_name?: string;
    company_cnpj?: string;
    nationality?: string;
    marital_status?: string;
    profession?: string;
    birth_date?: string;
    phone?: string;
    // Endereço estruturado (31/08/2026, pedido explícito de João, modelo de
    // cláusula de qualificação civil real): substitui o campo de texto
    // livre. montarEndereco() monta a string final antes de gravar.
    endereco_rua?: string; endereco_numero?: string; endereco_bairro?: string;
    endereco_cidade?: string; endereco_estado?: string; endereco_cep?: string;
    company_rua?: string; company_numero?: string; company_bairro?: string;
    company_cidade?: string; company_estado?: string; company_cep?: string;
  };

  const endereco_completo = montarEndereco({ rua: endereco_rua, numero: endereco_numero, bairro: endereco_bairro, cidade: endereco_cidade, estado: endereco_estado, cep: endereco_cep });
  const company_address = montarEndereco({ rua: company_rua, numero: company_numero, bairro: company_bairro, cidade: company_cidade, estado: company_estado, cep: company_cep });

  if (person_type && !["PF", "PJ"].includes(person_type)) {
    return NextResponse.json({ error: "person_type inválido, use PF ou PJ." }, { status: 422 });
  }

  // Qualificação civil completa obrigatória pra QUALQUER papel (31/08/2026,
  // pedido explícito de João: modelo de cláusula real exige RG, endereço,
  // nacionalidade, estado civil, profissão, nascimento e telefone de todo
  // signatário, não só de quem recebe repasse). Testemunha/Parte Principal
  // deixam de ter caminho simplificado — essa era a regra desde 11/08,
  // revogada aqui por decisão de negócio, não por engano.
  const required: Record<string, unknown> = {
    cpf_cnpj, rg, nationality, marital_status, profession, birth_date, phone,
    endereco_rua, endereco_numero, endereco_bairro, endereco_cidade, endereco_estado, endereco_cep,
  };
  if (person_type === "PJ") {
    Object.assign(required, { company_rua, company_numero, company_bairro, company_cidade, company_estado, company_cep });
  }
  const missing = Object.entries(required).filter(([, v]) => !v || String(v).trim() === "").map(([k]) => k);
  if (missing.length > 0) {
    return NextResponse.json({ error: `Campos obrigatórios ausentes: ${missing.join(", ")}` }, { status: 422 });
  }

  // cpf_cnpj é sempre o documento PESSOAL de quem assina (mesmo em caso PJ,
  // é o representante) -- comentário original da coluna, migration
  // 20260813_qualificacoes_pf_pj_fpa.sql. Quando person_type é conhecido,
  // valida estritamente como CPF. Fluxo antigo (sem seletor, pré-13/08)
  // preserva o auto-detect por tamanho, para não quebrar link já enviado.
  const docDigits = String(cpf_cnpj).replace(/\D/g, "");
  const validDoc = person_type ? isValidCPF(cpf_cnpj!) : (docDigits.length > 11 ? isValidCNPJ(cpf_cnpj!) : isValidCPF(cpf_cnpj!));
  if (!validDoc) {
    return NextResponse.json({ error: person_type ? "CPF inválido, confira o número informado (documento pessoal de quem assina)." : "CPF/CNPJ inválido, confira o número informado." }, { status: 422 });
  }
  if (recebeRepasse && !pix_key && !dados_bancarios?.banco) {
    return NextResponse.json({ error: "Informe ao menos dados bancários ou chave PIX para eventual repasse." }, { status: 422 });
  }
  if (person_type === "PJ") {
    if (!company_name?.trim() || !company_cnpj?.trim()) {
      return NextResponse.json({ error: "Razão social e CNPJ da empresa são obrigatórios para pessoa jurídica." }, { status: 422 });
    }
    if (!isValidCNPJ(company_cnpj)) {
      return NextResponse.json({ error: "CNPJ da empresa inválido, confira o número informado." }, { status: 422 });
    }
  }

  const db = svc();

  const { error: updateError } = await db
    .from("cm_party_qualifications")
    .update({
      cpf_cnpj,
      rg,
      endereco_completo,
      endereco_rua, endereco_numero, endereco_bairro, endereco_cidade, endereco_estado, endereco_cep,
      dados_bancarios: dados_bancarios ?? null,
      pix_key: pix_key ?? null,
      person_type: person_type ?? null,
      company_name: person_type === "PJ" ? company_name!.trim() : null,
      company_cnpj: person_type === "PJ" ? company_cnpj!.trim() : null,
      company_address: person_type === "PJ" ? (company_address?.trim() || null) : null,
      company_rua: person_type === "PJ" ? company_rua : null,
      company_numero: person_type === "PJ" ? company_numero : null,
      company_bairro: person_type === "PJ" ? company_bairro : null,
      company_cidade: person_type === "PJ" ? company_cidade : null,
      company_estado: person_type === "PJ" ? company_estado : null,
      company_cep: person_type === "PJ" ? company_cep : null,
      nationality: nationality?.trim() || null,
      marital_status: marital_status?.trim() || null,
      profession: profession?.trim() || null,
      birth_date: birth_date?.trim() || null,
      phone: phone?.trim() || null,
      status: "preenchido",
      filled_at: new Date().toISOString(),
    })
    .eq("id", qualification.id);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  const { data: siblings } = await db
    .from("cm_party_qualifications")
    .select("status")
    .eq("batch_id", qualification.batch_id);

  const allFilled = (siblings ?? []).every((s) => s.status === "preenchido");

  if (allFilled) {
    const { data: batch } = await db
      .from("cm_qualification_batches")
      .update({ status: "completo", completed_at: new Date().toISOString() })
      .eq("id", qualification.batch_id)
      .select("created_by, document_type, listing_id, operation_contract_id")
      .single();

    if (batch?.created_by) {
      await db.from("notifications").insert({
        user_id: batch.created_by,
        title: "Qualificação de partes completa",
        message: `Todos os envolvidos preencheram os dados de qualificação para ${DOCUMENT_TYPE_LABELS[batch.document_type] ?? batch.document_type}. Pronto para gerar o documento.`,
        type: "qualificacao_completa",
        action_url: batch.listing_id ? `/bolsa/mesa` : "/juridico/contratos",
        read: false,
      });
    }

    // Central de Contratos (11/08/2026): quando o lote pertence a um
    // operation_contract_id (não Bolsa de Ativos), os dados reais coletados
    // (nome, e-mail, CPF/CNPJ) viram parties do contrato automaticamente —
    // sem isso o botão "Enviar para Assinatura" nunca teria e-mail de quem
    // acabou de se qualificar (testemunha, parte principal, etc).
    if (batch?.operation_contract_id) {
      const { data: allQualifications } = await db
        .from("cm_party_qualifications")
        .select("full_name, email, role_in_document, cpf_cnpj")
        .eq("batch_id", qualification.batch_id);

      const { data: contract } = await db
        .from("operation_contracts")
        .select("parties")
        .eq("id", batch.operation_contract_id)
        .single();

      // P0 real achado 11/08/2026, corrigido no mesmo bloco: esta rota
      // sobrescrevia o array `parties` INTEIRO só com o que veio deste
      // lote + v3_partners, apagando silenciosamente qualquer outra parte
      // já existente no contrato (ex: a contraparte principal, cadastrada
      // na criação do contrato, nunca parte de nenhum lote de
      // qualificação). Isso derrubou a contraparte de 2 contratos reais
      // (Iris no Closer, Daniel+Diogo no Home Cash) do array de
      // signatários sem ninguém perceber, porque o "Enviar para
      // Assinatura" nunca avisa quem ficou de fora. Corrigido para
      // MESCLAR: preserva toda parte existente cujo e-mail não é de
      // ninguém deste lote, e só então acrescenta/atualiza as deste lote.
      const existingParties = (contract?.parties as Array<{ role: string; name: string; doc?: string | null; email?: string }> | null) ?? [];
      const batchEmails = new Set((allQualifications ?? []).map((q) => q.email.toLowerCase()));
      const preservedParties = existingParties.filter((p) => !p.email || !batchEmails.has(p.email.toLowerCase()));
      const novasPartes = (allQualifications ?? []).map((q) => ({
        role: q.role_in_document,
        name: q.full_name,
        doc: q.cpf_cnpj ?? null,
        email: q.email,
      }));

      await db.from("operation_contracts").update({
        parties: [...preservedParties, ...novasPartes],
      }).eq("id", batch.operation_contract_id);
    }
  }

  return NextResponse.json({ success: true, batch_complete: allFilled });
}
