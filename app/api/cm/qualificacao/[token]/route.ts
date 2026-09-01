import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";
import { isValidCPF, isValidCNPJ } from "@/lib/validators/cpf-cnpj";
import { REQUIRED_REPRESENTATIVE_TYPES, type PartyNature, type RepresentativeType, type CompanyLegalNature, type LegalQualificationRepresentation } from "@/lib/legal-qualification";

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

const VALID_NATURES: PartyNature[] = ["PF", "PF_PROCURACAO", "INCAPAZ_RELATIVO", "INCAPAZ_ABSOLUTO", "ESPOLIO", "PJ"];
const VALID_REPRESENTATIVE_TYPES: RepresentativeType[] = ["procurador", "genitor", "curador", "tutor", "inventariante", "administrador", "representante_legal"];

interface EnderecoParts {
  rua?: string; numero?: string; bairro?: string; cidade?: string; estado?: string; cep?: string;
}

// Monta o endereço em prosa a partir das partes estruturadas, no mesmo
// formato da cláusula de qualificação real de contrato (31/08/2026, pedido
// explícito de João). Nunca deixa a Mesa/o indicado digitar o texto livre —
// isso evita CEP colado errado, cidade sem estado, etc. Reaproveitada
// (01/09/2026) para montar também o endereço de qualquer representante na
// cadeia, sem duplicar a lógica.
function montarEndereco(parts: EnderecoParts): string | null {
  const { rua, numero, bairro, cidade, estado, cep } = parts;
  if (!rua?.trim() || !numero?.trim() || !bairro?.trim() || !cidade?.trim() || !estado?.trim() || !cep?.trim()) return null;
  return `${rua.trim()}, ${numero.trim()}, Bairro ${bairro.trim()}, ${cidade.trim()} – ${estado.trim()}, CEP ${cep.trim()}`;
}

function req(missing: string[], value: unknown, field: string) {
  if (!value || String(value).trim() === "") missing.push(field);
}

// Campos próprios exigidos por natureza (01/09/2026, diretriz Dr. Athaydes:
// cada template A1/B1/B2/B3/C1/D1 pede um subconjunto diferente, nunca o
// conjunto uniforme de ontem). RG passa a ser "(se houver)" em todos os
// templates que o citam -- opcional, revoga a obrigatoriedade de 31/08.
function missingBaseFields(nature: PartyNature, b: Record<string, unknown>): string[] {
  const missing: string[] = [];
  switch (nature) {
    case "PF":
    case "PF_PROCURACAO":
    case "INCAPAZ_RELATIVO":
      req(missing, b.cpf_cnpj, "cpf_cnpj");
      req(missing, b.nationality, "nationality");
      req(missing, b.marital_status, "marital_status");
      req(missing, b.profession, "profession");
      req(missing, b.birth_date, "birth_date");
      req(missing, b.phone, "phone");
      req(missing, b.endereco_rua, "endereco_rua"); req(missing, b.endereco_numero, "endereco_numero");
      req(missing, b.endereco_bairro, "endereco_bairro"); req(missing, b.endereco_cidade, "endereco_cidade");
      req(missing, b.endereco_estado, "endereco_estado"); req(missing, b.endereco_cep, "endereco_cep");
      break;
    case "INCAPAZ_ABSOLUTO":
      // Menor impúbere: template B3 só cita nome, nacionalidade, CPF e RG
      // (se houver). Sem profissão/estado civil/endereço, por desenho.
      req(missing, b.cpf_cnpj, "cpf_cnpj");
      req(missing, b.nationality, "nationality");
      req(missing, b.birth_date, "birth_date");
      break;
    case "ESPOLIO":
      // full_name/cpf_cnpj aqui são os dados do FALECIDO (já vêm de
      // qualification.full_name, cadastrado pela Mesa; cpf_cnpj é digitado).
      req(missing, b.cpf_cnpj, "cpf_cnpj");
      break;
    case "PJ":
      req(missing, b.company_name, "company_name");
      req(missing, b.company_cnpj, "company_cnpj");
      req(missing, b.company_rua, "company_rua"); req(missing, b.company_numero, "company_numero");
      req(missing, b.company_bairro, "company_bairro"); req(missing, b.company_cidade, "company_cidade");
      req(missing, b.company_estado, "company_estado"); req(missing, b.company_cep, "company_cep");
      break;
  }
  return missing;
}

// Valida um representante (recursivo, se ele também for PJ e precisar de
// representante próprio). Máximo 5 níveis de encadeamento -- suficiente
// pra qualquer estrutura societária real, evita abuso/loop.
function validateRepresentative(rep: any, allowedTypes: RepresentativeType[], depth = 0): string | null {
  if (depth > 5) return "Cadeia de representação excede o limite permitido (5 níveis).";
  if (!rep || typeof rep !== "object") return "Representante é obrigatório para esta natureza de parte.";
  if (!VALID_REPRESENTATIVE_TYPES.includes(rep.representative_type)) {
    return "Tipo de representante inválido.";
  }
  if (!allowedTypes.includes(rep.representative_type)) {
    return `Para esta natureza de parte, o representante precisa ser: ${allowedTypes.join(" ou ")}.`;
  }

  const repNature: "PF" | "PJ" = rep.party_nature === "PJ" ? "PJ" : "PF";
  if (repNature === "PF") {
    const missing: string[] = [];
    req(missing, rep.full_name, "full_name");
    req(missing, rep.cpf_cnpj, "cpf_cnpj");
    req(missing, rep.nationality, "nationality");
    req(missing, rep.marital_status, "marital_status");
    req(missing, rep.profession, "profession");
    req(missing, rep.phone, "phone");
    req(missing, rep.endereco_rua, "endereco_rua"); req(missing, rep.endereco_numero, "endereco_numero");
    req(missing, rep.endereco_bairro, "endereco_bairro"); req(missing, rep.endereco_cidade, "endereco_cidade");
    req(missing, rep.endereco_estado, "endereco_estado"); req(missing, rep.endereco_cep, "endereco_cep");
    if (missing.length > 0) return `Campos obrigatórios ausentes no representante: ${missing.join(", ")}`;
    if (!isValidCPF(rep.cpf_cnpj)) return "CPF do representante inválido.";
  } else {
    const missing: string[] = [];
    req(missing, rep.company_name, "company_name");
    req(missing, rep.company_cnpj, "company_cnpj");
    req(missing, rep.company_rua, "company_rua"); req(missing, rep.company_numero, "company_numero");
    req(missing, rep.company_bairro, "company_bairro"); req(missing, rep.company_cidade, "company_cidade");
    req(missing, rep.company_estado, "company_estado"); req(missing, rep.company_cep, "company_cep");
    if (missing.length > 0) return `Campos obrigatórios ausentes no representante (PJ): ${missing.join(", ")}`;
    if (!isValidCNPJ(rep.company_cnpj)) return "CNPJ do representante inválido.";
    // Encadeamento: uma PJ representante também precisa do próprio
    // administrador/representante legal (nota de arquitetura do BRIEF:
    // o representante final é sempre uma Pessoa Física).
    const nestedError = validateRepresentative(rep.representation, ["administrador", "representante_legal"], depth + 1);
    if (nestedError) return nestedError;
  }
  return null;
}

// Monta endereco_completo/company_address de um representante antes de
// gravar (mesma regra do topo, aplicada recursivamente na cadeia).
function assembleRepresentation(rep: any): LegalQualificationRepresentation {
  const repNature: "PF" | "PJ" = rep.party_nature === "PJ" ? "PJ" : "PF";
  return {
    representative_type: rep.representative_type,
    party_nature: repNature,
    full_name: rep.full_name ?? null,
    cpf_cnpj: rep.cpf_cnpj ?? null,
    rg: rep.rg?.trim() || null,
    email: rep.email ?? null,
    nationality: rep.nationality ?? null,
    marital_status: rep.marital_status ?? null,
    profession: rep.profession ?? null,
    phone: rep.phone ?? null,
    endereco_completo: montarEndereco({ rua: rep.endereco_rua, numero: rep.endereco_numero, bairro: rep.endereco_bairro, cidade: rep.endereco_cidade, estado: rep.endereco_estado, cep: rep.endereco_cep }),
    company_name: rep.company_name ?? null,
    company_cnpj: rep.company_cnpj ?? null,
    company_address: montarEndereco({ rua: rep.company_rua, numero: rep.company_numero, bairro: rep.company_bairro, cidade: rep.company_cidade, estado: rep.company_estado, cep: rep.company_cep }),
    company_legal_nature: (rep.company_legal_nature as CompanyLegalNature) ?? null,
    representation: rep.representation ? assembleRepresentation(rep.representation) : null,
  };
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

// POST /api/cm/qualificacao/[token] — envolvido envia a qualificação civil
// completa (01/09/2026, diretriz Dr. Athaydes: 6 naturezas de parte, com
// representação recursiva quando aplicável) e dados bancários/PIX quando
// recebe repasse. Ao completar 100% do lote, marca o batch como "completo"
// e notifica a Mesa.
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
    party_nature, cpf_cnpj, rg, dados_bancarios, pix_key,
    company_name, company_cnpj, company_legal_nature,
    nationality, marital_status, profession, birth_date, phone,
    endereco_rua, endereco_numero, endereco_bairro, endereco_cidade, endereco_estado, endereco_cep,
    company_rua, company_numero, company_bairro, company_cidade, company_estado, company_cep,
    representation,
  } = body as {
    party_nature?: PartyNature;
    cpf_cnpj?: string;
    rg?: string;
    dados_bancarios?: { banco?: string; agencia?: string; conta?: string; tipo_conta?: string };
    pix_key?: string;
    company_name?: string;
    company_cnpj?: string;
    company_legal_nature?: CompanyLegalNature;
    nationality?: string;
    marital_status?: string;
    profession?: string;
    birth_date?: string;
    phone?: string;
    endereco_rua?: string; endereco_numero?: string; endereco_bairro?: string;
    endereco_cidade?: string; endereco_estado?: string; endereco_cep?: string;
    company_rua?: string; company_numero?: string; company_bairro?: string;
    company_cidade?: string; company_estado?: string; company_cep?: string;
    representation?: any;
  };

  const nature: PartyNature = VALID_NATURES.includes(party_nature as PartyNature) ? (party_nature as PartyNature) : "PF";
  const personType: "PF" | "PJ" = nature === "PJ" ? "PJ" : "PF";

  const endereco_completo = montarEndereco({ rua: endereco_rua, numero: endereco_numero, bairro: endereco_bairro, cidade: endereco_cidade, estado: endereco_estado, cep: endereco_cep });
  const company_address = montarEndereco({ rua: company_rua, numero: company_numero, bairro: company_bairro, cidade: company_cidade, estado: company_estado, cep: company_cep });

  // Campos próprios da natureza (01/09/2026, diretriz Dr. Athaydes) — cada
  // natureza exige um subconjunto diferente, ver missingBaseFields().
  const missing = missingBaseFields(nature, { cpf_cnpj, nationality, marital_status, profession, birth_date, phone, endereco_rua, endereco_numero, endereco_bairro, endereco_cidade, endereco_estado, endereco_cep, company_name, company_cnpj, company_rua, company_numero, company_bairro, company_cidade, company_estado, company_cep });
  if (missing.length > 0) {
    return NextResponse.json({ error: `Campos obrigatórios ausentes: ${missing.join(", ")}` }, { status: 422 });
  }

  // Validação de documento por natureza. cpf_cnpj não se aplica a PJ (o
  // documento pessoal de quem assina mora dentro de `representation`,
  // nunca no topo — o template D1 nunca cita CPF da própria empresa).
  if (nature !== "PJ") {
    if (!isValidCPF(cpf_cnpj!)) {
      return NextResponse.json({ error: "CPF inválido, confira o número informado." }, { status: 422 });
    }
  } else {
    if (!isValidCNPJ(company_cnpj!)) {
      return NextResponse.json({ error: "CNPJ da empresa inválido, confira o número informado." }, { status: 422 });
    }
  }

  // Representação obrigatória para toda natureza exceto PF simples,
  // recursiva quando o representante também é PJ (encadeamento até chegar
  // numa Pessoa Física, nota de arquitetura do BRIEF de 01/09/2026).
  const requiredRepTypes = REQUIRED_REPRESENTATIVE_TYPES[nature];
  if (requiredRepTypes) {
    const repError = validateRepresentative(representation, requiredRepTypes);
    if (repError) return NextResponse.json({ error: repError }, { status: 422 });
  }

  if (recebeRepasse && !pix_key && !dados_bancarios?.banco) {
    return NextResponse.json({ error: "Informe ao menos dados bancários ou chave PIX para eventual repasse." }, { status: 422 });
  }

  const db = svc();

  const { error: updateError } = await db
    .from("cm_party_qualifications")
    .update({
      party_nature: nature,
      person_type: personType,
      cpf_cnpj: nature === "PJ" ? null : cpf_cnpj,
      rg: rg?.trim() || null,
      endereco_completo,
      endereco_rua, endereco_numero, endereco_bairro, endereco_cidade, endereco_estado, endereco_cep,
      dados_bancarios: dados_bancarios ?? null,
      pix_key: pix_key ?? null,
      company_name: nature === "PJ" ? company_name!.trim() : null,
      company_cnpj: nature === "PJ" ? company_cnpj!.trim() : null,
      company_address: nature === "PJ" ? company_address : null,
      company_legal_nature: nature === "PJ" ? (company_legal_nature ?? "privado") : null,
      company_rua: nature === "PJ" ? company_rua : null,
      company_numero: nature === "PJ" ? company_numero : null,
      company_bairro: nature === "PJ" ? company_bairro : null,
      company_cidade: nature === "PJ" ? company_cidade : null,
      company_estado: nature === "PJ" ? company_estado : null,
      company_cep: nature === "PJ" ? company_cep : null,
      nationality: nationality?.trim() || null,
      marital_status: marital_status?.trim() || null,
      profession: profession?.trim() || null,
      birth_date: birth_date?.trim() || null,
      phone: phone?.trim() || null,
      representation: requiredRepTypes ? assembleRepresentation(representation) : null,
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
