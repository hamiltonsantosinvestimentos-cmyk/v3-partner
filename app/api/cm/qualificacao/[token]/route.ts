import { NextRequest, NextResponse } from "next/server";
import { createClient as sc, type SupabaseClient } from "@supabase/supabase-js";
import { isValidCPF, isValidCNPJ } from "@/lib/validators/cpf-cnpj";
import { REQUIRED_REPRESENTATIVE_TYPES, type PartyNature, type RepresentativeType, type CompanyLegalNature, type LegalQualificationRepresentation } from "@/lib/legal-qualification";
import { resolveClient } from "@/lib/v3-clients";
import { findValidKycDocument, KYC_DOCUMENT_KIND_LABELS, type KycDocumentKind } from "@/lib/kyc-documents";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// Reaproveitamento de KYC (04/09/2026): naturezas cuja PARTE PRINCIPAL fornece o
// próprio documento de identificação -- INCAPAZ_ABSOLUTO/ESPOLIO não (quem assina
// de fato é o representante, cujo documento é exigido separadamente na cadeia
// de representação, nunca no topo).
const NATURES_REQUIRE_OWN_ID_DOC: PartyNature[] = ["PF", "PF_PROCURACAO", "INCAPAZ_RELATIVO"];

type DocRef = { reuse: true } | { document_id: string } | null | undefined;

/** Confirma que o documento (reaproveitado ou recém-enviado nesta própria qualificação)
 *  é válido para o v3_client_id/kind exigidos. Nunca confia no client sem reconferir no
 *  banco -- um document_id só é aceito se pertencer a ESTA qualificação e a este mesmo
 *  v3_client_id, e um "reuse" só é aceito se o banco confirmar validade (< 12 meses) agora. */
async function resolveDocumentSlot(
  db: SupabaseClient,
  qualificationId: string,
  v3ClientId: string | null,
  kind: KycDocumentKind,
  ref: DocRef
): Promise<string | null> {
  const label = KYC_DOCUMENT_KIND_LABELS[kind];
  if (!v3ClientId) return `Não foi possível validar o CPF/CNPJ para conferir o(a) ${label}.`;
  if (!ref) return `${label} é obrigatório.`;

  if ("reuse" in ref && ref.reuse) {
    const existing = await findValidKycDocument(db, v3ClientId, kind);
    return existing ? null : `Não há ${label} válido (menos de 12 meses) em nome deste CPF/CNPJ para reaproveitar -- envie um novo.`;
  }
  if ("document_id" in ref && ref.document_id) {
    const { data: doc } = await db
      .from("cm_party_qualification_documents")
      .select("id, v3_client_id, document_kind, uploaded_by_qualification_id")
      .eq("id", ref.document_id)
      .maybeSingle();
    const belongsHere = doc && doc.uploaded_by_qualification_id === qualificationId && doc.document_kind === kind && doc.v3_client_id === v3ClientId;
    return belongsHere ? null : `${label} inválido ou não pertence a esta qualificação.`;
  }
  return `${label} é obrigatório.`;
}

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  nda_quadripartite: "NDA Quadripartite",
  fpa_venda: "FPA Venda",
  fpa_compra: "FPA Compra",
  mandato: "Mandato",
  contrato_final: "Contrato Final",
  contrato_parceria: "Contrato de Parceria",
  ncnda_ma: "NCNDA Mesa M&A",
};

// Papéis que recebem repasse de comissão precisam ADICIONALMENTE de dados
// bancários/PIX (mesmo padrão desde 28/07, Bolsa de Ativos) — isso é dado
// financeiro pro repasse, não faz parte da qualificação civil em si.
const ROLES_QUE_RECEBEM_REPASSE = ["mandatario", "intermediario_finder_venda", "intermediario_finder_compra"];

const VALID_NATURES: PartyNature[] = ["PF", "PF_PROCURACAO", "INCAPAZ_RELATIVO", "INCAPAZ_ABSOLUTO", "ESPOLIO", "PJ"];
const VALID_REPRESENTATIVE_TYPES: RepresentativeType[] = ["procurador", "genitor", "curador", "tutor", "inventariante", "administrador", "representante_legal"];

interface EnderecoParts {
  rua?: string; numero?: string; complemento?: string; bairro?: string; cidade?: string; estado?: string; cep?: string;
}

// Monta o endereço em prosa a partir das partes estruturadas, no mesmo
// formato da cláusula de qualificação real de contrato (31/08/2026, pedido
// explícito de João). Nunca deixa a Mesa/o indicado digitar o texto livre —
// isso evita CEP colado errado, cidade sem estado, etc. Reaproveitada
// (01/09/2026) para montar também o endereço de qualquer representante na
// cadeia, sem duplicar a lógica. Complemento (04/09/2026, achado real ao
// revisar um preenchimento): opcional, nunca bloqueia o endereço se ausente.
function montarEndereco(parts: EnderecoParts): string | null {
  const { rua, numero, complemento, bairro, cidade, estado, cep } = parts;
  if (!rua?.trim() || !numero?.trim() || !bairro?.trim() || !cidade?.trim() || !estado?.trim() || !cep?.trim()) return null;
  const complementoTrim = complemento?.trim();
  return `${rua.trim()}, ${numero.trim()}${complementoTrim ? `, ${complementoTrim}` : ""}, Bairro ${bairro.trim()}, ${cidade.trim()}, ${estado.trim()}, CEP ${cep.trim()}`;
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
// Reaproveitamento de KYC (04/09/2026): cada nível PF exige identificacao_foto
// (reaproveitada ou nova), cada nível PJ exige contrato_social -- validado
// contra o banco (nunca confia no client), db async por isso.
async function validateRepresentative(db: SupabaseClient, qualificationId: string, rep: any, allowedTypes: RepresentativeType[], depth = 0): Promise<string | null> {
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

    const repClientId = await resolveClient(rep.cpf_cnpj, { vertical: "central_contratos", db });
    const docError = await resolveDocumentSlot(db, qualificationId, repClientId, "identificacao_foto", rep.documents?.identificacao_foto);
    if (docError) return `Representante: ${docError}`;
  } else {
    const missing: string[] = [];
    req(missing, rep.company_name, "company_name");
    req(missing, rep.company_cnpj, "company_cnpj");
    req(missing, rep.company_rua, "company_rua"); req(missing, rep.company_numero, "company_numero");
    req(missing, rep.company_bairro, "company_bairro"); req(missing, rep.company_cidade, "company_cidade");
    req(missing, rep.company_estado, "company_estado"); req(missing, rep.company_cep, "company_cep");
    if (missing.length > 0) return `Campos obrigatórios ausentes no representante (PJ): ${missing.join(", ")}`;
    if (!isValidCNPJ(rep.company_cnpj)) return "CNPJ do representante inválido.";

    const repClientId = await resolveClient(rep.company_cnpj, { vertical: "central_contratos", db });
    const docError = await resolveDocumentSlot(db, qualificationId, repClientId, "contrato_social", rep.documents?.contrato_social);
    if (docError) return `Representante (empresa): ${docError}`;

    // Encadeamento: uma PJ representante também precisa do próprio
    // administrador/representante legal (nota de arquitetura do BRIEF:
    // o representante final é sempre uma Pessoa Física).
    const nestedError = await validateRepresentative(db, qualificationId, rep.representation, ["administrador", "representante_legal"], depth + 1);
    if (nestedError) return nestedError;
  }
  return null;
}

// Monta endereco_completo/company_address de um representante antes de
// gravar (mesma regra do topo, aplicada recursivamente na cadeia).
// Reaproveitamento de KYC (04/09/2026): resolve e grava v3_client_id de CADA
// nível da cadeia (cada representante tem identidade/estoque de documentos
// próprio, independente da parte principal no topo) -- já validado contra o
// mesmo v3_client_id em validateRepresentative(), aqui só persiste.
async function assembleRepresentation(db: SupabaseClient, rep: any): Promise<LegalQualificationRepresentation> {
  const repNature: "PF" | "PJ" = rep.party_nature === "PJ" ? "PJ" : "PF";
  const v3ClientId = await resolveClient(repNature === "PJ" ? rep.company_cnpj : rep.cpf_cnpj, { vertical: "central_contratos", db });
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
    endereco_completo: montarEndereco({ rua: rep.endereco_rua, numero: rep.endereco_numero, complemento: rep.endereco_complemento, bairro: rep.endereco_bairro, cidade: rep.endereco_cidade, estado: rep.endereco_estado, cep: rep.endereco_cep }),
    company_name: rep.company_name ?? null,
    company_cnpj: rep.company_cnpj ?? null,
    company_address: montarEndereco({ rua: rep.company_rua, numero: rep.company_numero, complemento: rep.company_complemento, bairro: rep.company_bairro, cidade: rep.company_cidade, estado: rep.company_estado, cep: rep.company_cep }),
    company_legal_nature: (rep.company_legal_nature as CompanyLegalNature) ?? null,
    v3_client_id: v3ClientId,
    representation: rep.representation ? await assembleRepresentation(db, rep.representation) : null,
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
    endereco_rua, endereco_numero, endereco_complemento, endereco_bairro, endereco_cidade, endereco_estado, endereco_cep,
    company_rua, company_numero, company_complemento, company_bairro, company_cidade, company_estado, company_cep,
    representation, documents,
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
    endereco_rua?: string; endereco_numero?: string; endereco_complemento?: string; endereco_bairro?: string;
    endereco_cidade?: string; endereco_estado?: string; endereco_cep?: string;
    company_rua?: string; company_numero?: string; company_complemento?: string; company_bairro?: string;
    company_cidade?: string; company_estado?: string; company_cep?: string;
    representation?: any;
    // Reaproveitamento de KYC (04/09/2026): { identificacao_foto?: DocRef, contrato_social?: DocRef }
    documents?: { identificacao_foto?: DocRef; contrato_social?: DocRef };
  };

  const nature: PartyNature = VALID_NATURES.includes(party_nature as PartyNature) ? (party_nature as PartyNature) : "PF";
  const personType: "PF" | "PJ" = nature === "PJ" ? "PJ" : "PF";
  const db = svc();

  const endereco_completo = montarEndereco({ rua: endereco_rua, numero: endereco_numero, complemento: endereco_complemento, bairro: endereco_bairro, cidade: endereco_cidade, estado: endereco_estado, cep: endereco_cep });
  const company_address = montarEndereco({ rua: company_rua, numero: company_numero, complemento: company_complemento, bairro: company_bairro, cidade: company_cidade, estado: company_estado, cep: company_cep });

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

  // Reaproveitamento de KYC (04/09/2026): resolve a identidade Client 360 da
  // PARTE PRINCIPAL (CPF se não-PJ, CNPJ da empresa se PJ) e exige o
  // documento correspondente -- reaproveitado de operação anterior (< 12
  // meses) ou recém-enviado nesta própria qualificação. INCAPAZ_ABSOLUTO e
  // ESPOLIO não fornecem documento próprio aqui (quem assina de fato é o
  // representante, validado abaixo).
  const topDocumentNumber = nature === "PJ" ? company_cnpj : cpf_cnpj;
  const v3ClientId = await resolveClient(topDocumentNumber, { vertical: "central_contratos", db });

  if (NATURES_REQUIRE_OWN_ID_DOC.includes(nature)) {
    const docError = await resolveDocumentSlot(db, qualification.id, v3ClientId, "identificacao_foto", documents?.identificacao_foto);
    if (docError) return NextResponse.json({ error: docError }, { status: 422 });
  }
  if (nature === "PJ") {
    const docError = await resolveDocumentSlot(db, qualification.id, v3ClientId, "contrato_social", documents?.contrato_social);
    if (docError) return NextResponse.json({ error: docError }, { status: 422 });
  }

  // Representação obrigatória para toda natureza exceto PF simples,
  // recursiva quando o representante também é PJ (encadeamento até chegar
  // numa Pessoa Física, nota de arquitetura do BRIEF de 01/09/2026).
  const requiredRepTypes = REQUIRED_REPRESENTATIVE_TYPES[nature];
  if (requiredRepTypes) {
    const repError = await validateRepresentative(db, qualification.id, representation, requiredRepTypes);
    if (repError) return NextResponse.json({ error: repError }, { status: 422 });
  }

  if (recebeRepasse && !pix_key && !dados_bancarios?.banco) {
    return NextResponse.json({ error: "Informe ao menos dados bancários ou chave PIX para eventual repasse." }, { status: 422 });
  }

  const { error: updateError } = await db
    .from("cm_party_qualifications")
    .update({
      party_nature: nature,
      person_type: personType,
      cpf_cnpj: nature === "PJ" ? null : cpf_cnpj,
      rg: rg?.trim() || null,
      endereco_completo,
      endereco_rua, endereco_numero, endereco_complemento: endereco_complemento?.trim() || null, endereco_bairro, endereco_cidade, endereco_estado, endereco_cep,
      dados_bancarios: dados_bancarios ?? null,
      pix_key: pix_key ?? null,
      company_name: nature === "PJ" ? company_name!.trim() : null,
      company_cnpj: nature === "PJ" ? company_cnpj!.trim() : null,
      company_address: nature === "PJ" ? company_address : null,
      company_legal_nature: nature === "PJ" ? (company_legal_nature ?? "privado") : null,
      company_rua: nature === "PJ" ? company_rua : null,
      company_numero: nature === "PJ" ? company_numero : null,
      company_complemento: nature === "PJ" ? (company_complemento?.trim() || null) : null,
      company_bairro: nature === "PJ" ? company_bairro : null,
      company_cidade: nature === "PJ" ? company_cidade : null,
      company_estado: nature === "PJ" ? company_estado : null,
      company_cep: nature === "PJ" ? company_cep : null,
      nationality: nationality?.trim() || null,
      marital_status: marital_status?.trim() || null,
      profession: profession?.trim() || null,
      birth_date: birth_date?.trim() || null,
      phone: phone?.trim() || null,
      v3_client_id: v3ClientId,
      representation: requiredRepTypes ? await assembleRepresentation(db, representation) : null,
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
        .select("id, full_name, email, role_in_document, cpf_cnpj")
        .eq("batch_id", qualification.batch_id);

      const { data: contract } = await db
        .from("operation_contracts")
        .select("parties, deal_id")
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
      const existingParties = (contract?.parties as Array<{ role: string; name: string; doc?: string | null; email?: string; qualification_id?: string | null }> | null) ?? [];
      const batchEmails = new Set((allQualifications ?? []).map((q) => q.email.toLowerCase()));
      const preservedParties = existingParties.filter((p) => !p.email || !batchEmails.has(p.email.toLowerCase()));
      // qualification_id (04/09/2026): aditivo -- permite ao painel "clicar no nome
      // para ver a ficha completa" (GET /api/cm/qualifications/party/[id]) buscar
      // os dados civis + documentos KYC a partir da lista final de partes do contrato.
      const novasPartes = (allQualifications ?? []).map((q) => ({
        role: q.role_in_document,
        name: q.full_name,
        doc: q.cpf_cnpj ?? null,
        email: q.email,
        qualification_id: q.id,
      }));

      await db.from("operation_contracts").update({
        parties: [...preservedParties, ...novasPartes],
      }).eq("id", batch.operation_contract_id);

      // Client 360 (05/09/2026, BRIEF NCNDA Mesa M&A): fecha a ponte com
      // ma_deal_clients assim que a qualificação de um NCNDA de M&A
      // completa, não só estruturalmente (deal_id já resolvido em
      // operation_contracts desde 07/08) mas com o dado real presente.
      // Best-effort -- nunca desfaz a atualização de parties acima nem
      // bloqueia a resposta ao envolvido se falhar.
      if (batch.document_type === "ncnda_ma" && contract?.deal_id) {
        for (const q of allQualifications ?? []) {
          if (q.role_in_document === "v3_partners" || !q.cpf_cnpj) continue;
          try {
            const v3ClientId = await resolveClient(q.cpf_cnpj, { legalName: q.full_name, vertical: "ma", db });
            if (v3ClientId) {
              await db.from("ma_deal_clients").upsert(
                { deal_id: contract.deal_id, v3_client_id: v3ClientId, role: null, status: "prospecto", created_by: batch.created_by ?? null },
                { onConflict: "deal_id,v3_client_id", ignoreDuplicates: true }
              );
            }
          } catch (e) {
            console.error("[qualificacao/token] falha ao vincular Client 360 (ma_deal_clients):", e);
          }
        }
      }
    }
  }

  return NextResponse.json({ success: true, batch_complete: allFilled });
}
