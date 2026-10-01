import { NextRequest, NextResponse } from "next/server";
import { createClient as sc, type SupabaseClient } from "@supabase/supabase-js";
import { resolveClient, resolvePassportClient } from "@/lib/v3-clients";
import { findValidKycDocument, KYC_DOCUMENT_KIND_LABELS, KYC_REUSABLE_KINDS, type KycDocumentKind } from "@/lib/kyc-documents";
import { lookupCnpj, nameMatchesSocios } from "@/lib/cnpj-lookup";
import { fetchCep } from "@/lib/viacep";
import {
  normalizeSubmission,
  toRepresentationJson,
  type NormalizedParty,
  type NormalizedRepresentation,
  type RepresentationInput,
  type SubmissionInput,
} from "@/lib/qualification-submit";
import { INSTRUMENT_DOCUMENT_KIND } from "@/lib/qualification-schema";
import type { LegalQualificationRepresentation, PartyNature } from "@/lib/legal-qualification";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// Reaproveitamento de KYC (04/09/2026): naturezas cuja PARTE PRINCIPAL fornece o
// próprio documento de identificação -- INCAPAZ_ABSOLUTO/ESPOLIO não (quem assina
// de fato é o representante, cujo documento é exigido separadamente na cadeia
// de representação, nunca no topo).
const NATURES_REQUIRE_OWN_ID_DOC: PartyNature[] = ["PF", "PF_PROCURACAO", "INCAPAZ_RELATIVO"];

// Naturezas que exigem o anexo do instrumento de representação nesta entrega (BRIEF 5.11):
// B1 (mandato) e C1 (termo de inventariante). B2 e B3 ficam para a sub-entrega 1D.
const NATURES_REQUIRE_INSTRUMENT: PartyNature[] = ["PF_PROCURACAO", "ESPOLIO"];

type DocRef = { reuse: true } | { document_id: string } | null | undefined;
type RepInputWithDocs = RepresentationInput & { documents?: { identificacao_foto?: DocRef; contrato_social?: DocRef } };

/** Confirma que o documento (reaproveitado ou recém-enviado nesta própria qualificação)
 *  é válido para o v3_client_id/kind exigidos. Nunca confia no client sem reconferir no
 *  banco -- um document_id só é aceito se pertencer a ESTA qualificação e a este mesmo
 *  v3_client_id, e um "reuse" só é aceito se o banco confirmar validade (< 12 meses) agora.
 *  O instrumento de representação nunca é reaproveitado (allowReuse false por tipo). */
async function resolveDocumentSlot(
  db: SupabaseClient,
  qualificationId: string,
  v3ClientId: string | null,
  kind: KycDocumentKind,
  ref: DocRef
): Promise<string | null> {
  const label = KYC_DOCUMENT_KIND_LABELS[kind];
  if (!v3ClientId) return `Não foi possível validar o documento de identificação para conferir o(a) ${label}.`;
  if (!ref) return `${label} é obrigatório.`;

  if ("reuse" in ref && ref.reuse) {
    if (!KYC_REUSABLE_KINDS.includes(kind)) return `${label} não pode ser reaproveitado: envie o arquivo.`;
    const existing = await findValidKycDocument(db, v3ClientId, kind);
    return existing ? null : `Não há ${label} válido (menos de 12 meses) em nome deste documento para reaproveitar -- envie um novo.`;
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
// bancários/PIX (mesmo padrão desde 28/07, Bolsa de Ativos) — isso é dado financeiro
// pro repasse, não faz parte da qualificação civil em si.
const ROLES_QUE_RECEBEM_REPASSE = ["mandatario", "intermediario_finder_venda", "intermediario_finder_compra"];

/**
 * Resolve a identidade da pessoa no Client 360: CNPJ da empresa, CPF, ou, para estrangeiro
 * adulto que declarou não possuir CPF, o passaporte (chave PP:ISO2:NUMERO).
 */
async function resolveIdentityClient(db: SupabaseClient, v: NormalizedParty, legalName?: string | null): Promise<string | null> {
  if (v.company_cnpj) return resolveClient(v.company_cnpj, { vertical: "central_contratos", db });
  if (v.cpf_cnpj) return resolveClient(v.cpf_cnpj, { vertical: "central_contratos", db });
  if (v.cpf_waived && v.id_type === "passaporte") {
    return resolvePassportClient(v.id_country, v.id_number, { vertical: "central_contratos", db, legalName: legalName ?? v.full_name });
  }
  return null;
}

const semAcento = (s: string | null | undefined) =>
  (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();

interface AddressCheck { path: string; origin: "viacep" | "manual" | null; error?: string }

/**
 * Checa o CEP no ViaCEP (BRIEF 5.8). Encontrado: a cidade e a UF informadas precisam
 * conferir. Não encontrado (ou ViaCEP fora do ar) e sem o aceite de endereço manual: recusa.
 * Com o aceite manual, grava origem "manual" e a Mesa confere depois. Nunca trava a parte
 * por uma queda do serviço externo, desde que ela use o caminho manual.
 */
async function checkAddress(path: string, v: NormalizedParty): Promise<AddressCheck> {
  const isPj = v.profile === "PJ" || v.profile === "REP_PJ";
  const cep = isPj ? v.company_cep : v.endereco_cep;
  if (!cep) return { path, origin: null };
  const manual = isPj ? v.company_manual : v.endereco_manual;
  if (manual) return { path, origin: "manual" };
  const found = await fetchCep(cep);
  if (!found) {
    return { path, origin: null, error: "CEP não localizado. Confira o número ou escolha preencher o endereço manualmente." };
  }
  const cidade = isPj ? v.company_cidade : v.endereco_cidade;
  const uf = isPj ? v.company_estado : v.endereco_estado;
  if (semAcento(found.localidade) !== semAcento(cidade) || (found.uf ?? "").toUpperCase() !== (uf ?? "").toUpperCase()) {
    return { path, origin: null, error: "A cidade e a UF não conferem com o CEP informado." };
  }
  return { path, origin: "viacep" };
}

/** Monta o JSON gravado em `representation`, com o v3_client_id e a origem do endereço de cada nível. */
async function buildRepresentationJson(
  db: SupabaseClient,
  rep: NormalizedRepresentation,
  originByPath: Record<string, "viacep" | "manual" | null>,
  depth = 1
): Promise<LegalQualificationRepresentation> {
  const base = toRepresentationJson(rep);
  base.v3_client_id = await resolveIdentityClient(db, rep);
  base.endereco_origem = originByPath[`representante.${depth}`] ?? null;
  base.representation = rep.representation ? await buildRepresentationJson(db, rep.representation, originByPath, depth + 1) : null;
  return base;
}

// GET /api/cm/qualificacao/[token] — contexto público para o envolvido preencher.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const { data: qualification } = await svc()
    .from("cm_party_qualifications")
    .select("id, full_name, email, role_in_document, status, batch_id, cm_qualification_batches(document_type, cm_asset_listings(anonymous_id))")
    .eq("qualification_token", token)
    // Envolvido excluído/cancelado pela Mesa: o link deixa de valer (30/09/2026).
    .is("deleted_at", null)
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

// POST /api/cm/qualificacao/[token] — envolvido envia a qualificação civil completa.
// Fase 1B (BRIEF 30/09/2026): validação e normalização pelo registro único de campos
// (lib/qualification-submit.ts), listas fechadas, CEP checado, identidade em partes, passaporte
// para estrangeiro adulto sem CPF, e-mail do representante e e-mail editável da parte principal.
// Ao completar 100% do lote, marca o batch como "completo" e notifica a Mesa.
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const db = svc();

  const { data: qualification } = await db
    .from("cm_party_qualifications")
    .select("id, batch_id, status, role_in_document, full_name, email, email_convite")
    .eq("qualification_token", token)
    .is("deleted_at", null)
    .single();

  if (!qualification) return NextResponse.json({ error: "Link inválido ou expirado" }, { status: 404 });
  if (qualification.status === "preenchido") {
    return NextResponse.json({ error: "Este link já foi preenchido." }, { status: 409 });
  }

  const recebeRepasse = ROLES_QUE_RECEBEM_REPASSE.includes(qualification.role_in_document);

  const body = (await req.json().catch(() => ({}))) as SubmissionInput & {
    dados_bancarios?: { banco?: string; agencia?: string; conta?: string; tipo_conta?: string };
    pix_key?: string;
    documents?: { identificacao_foto?: DocRef; contrato_social?: DocRef; instrumento?: DocRef };
    lgpd_accepted?: boolean;
    nationality?: unknown;
    marital_status?: unknown;
  };
  const { dados_bancarios, pix_key, documents, lgpd_accepted } = body;

  if (lgpd_accepted !== true) {
    return NextResponse.json({ error: "É necessário aceitar o termo de consentimento LGPD para continuar." }, { status: 422 });
  }

  // Página aberta antes do deploy da Fase 1B manda estado civil e nacionalidade em texto livre.
  if (body.nationality !== undefined || body.marital_status !== undefined) {
    return NextResponse.json({ error: "Esta página está desatualizada. Recarregue o formulário e preencha novamente." }, { status: 422 });
  }

  // 1. Validação e normalização pelo registro único de campos.
  const result = normalizeSubmission(body, { inviteName: qualification.full_name, inviteEmail: qualification.email });
  if (!result.ok || !result.principal || !result.nature) {
    const msg = result.errors.map((e) => (e.path === "principal" ? e.message : `Representante: ${e.message}`)).join(" ");
    return NextResponse.json({ error: msg, errors: result.errors }, { status: 422 });
  }
  const nature = result.nature;
  const p = result.principal;
  const isPj = nature === "PJ";

  if (recebeRepasse && !pix_key && !dados_bancarios?.banco) {
    return NextResponse.json({ error: "Informe ao menos dados bancários ou chave PIX para eventual repasse." }, { status: 422 });
  }

  // Nós da cadeia (principal + representantes), alinhando o que foi normalizado com o que veio no corpo.
  const repNodes: Array<{ norm: NormalizedRepresentation; input: RepInputWithDocs | null | undefined; depth: number }> = [];
  {
    let n = result.representation;
    let i: RepInputWithDocs | null | undefined = body.representation;
    let d = 1;
    while (n) {
      repNodes.push({ norm: n, input: i, depth: d });
      n = n.representation;
      i = i?.representation;
      d += 1;
    }
  }

  // 2. CEP checado no servidor (em paralelo), principal e cada representante.
  const addressNodes: Array<{ path: string; v: NormalizedParty }> = [
    { path: "principal", v: p },
    ...repNodes.map((r) => ({ path: `representante.${r.depth}`, v: r.norm as NormalizedParty })),
  ];
  const checks = await Promise.all(addressNodes.map((a) => checkAddress(a.path, a.v)));
  const addressErrors = checks.filter((c) => c.error);
  if (addressErrors.length) {
    const msg = addressErrors.map((c) => (c.path === "principal" ? c.error : `Representante: ${c.error}`)).join(" ");
    return NextResponse.json({ error: msg, errors: addressErrors.map((c) => ({ path: c.path, field: "address", message: c.error })) }, { status: 422 });
  }
  const originByPath: Record<string, "viacep" | "manual" | null> = {};
  checks.forEach((c) => { originByPath[c.path] = c.origin; });

  // 3. Client 360 da parte principal e conferência dos anexos (nunca confia no client).
  const v3ClientId = await resolveIdentityClient(db, p, qualification.full_name);

  const docErrors: string[] = [];
  if (NATURES_REQUIRE_OWN_ID_DOC.includes(nature)) {
    const e = await resolveDocumentSlot(db, qualification.id, v3ClientId, "identificacao_foto", documents?.identificacao_foto);
    if (e) docErrors.push(e);
  }
  if (isPj) {
    const e = await resolveDocumentSlot(db, qualification.id, v3ClientId, "contrato_social", documents?.contrato_social);
    if (e) docErrors.push(e);
  }
  if (NATURES_REQUIRE_INSTRUMENT.includes(nature) && repNodes[0]) {
    const kind = INSTRUMENT_DOCUMENT_KIND[repNodes[0].norm.representative_type] as KycDocumentKind | null;
    if (kind) {
      const e = await resolveDocumentSlot(db, qualification.id, v3ClientId, kind, documents?.instrumento);
      if (e) docErrors.push(e);
    }
  }
  for (const r of repNodes) {
    const repClientId = await resolveIdentityClient(db, r.norm);
    const repDocs = r.input?.documents;
    const kind: KycDocumentKind = r.norm.party_nature === "PJ" ? "contrato_social" : "identificacao_foto";
    const e = await resolveDocumentSlot(db, qualification.id, repClientId, kind, repDocs?.[kind as "identificacao_foto" | "contrato_social"]);
    if (e) docErrors.push(`Representante: ${e}`);
  }
  if (docErrors.length) {
    return NextResponse.json({ error: docErrors.join(" ") }, { status: 422 });
  }

  // 4. E-mail da parte principal: editável, é o destinatário do link de assinatura.
  const inviteEmail = (qualification.email ?? "").trim().toLowerCase();
  const finalEmail = p.email ?? qualification.email;
  const emailChanged = !!p.email && p.email !== inviteEmail;

  const { error: updateError } = await db
    .from("cm_party_qualifications")
    .update({
      party_nature: nature,
      person_type: isPj ? "PJ" : "PF",
      cpf_cnpj: isPj ? null : p.cpf_cnpj,
      rg: p.rg,
      id_type: p.id_type,
      id_number: p.id_number,
      id_issuer: p.id_issuer,
      id_issuer_uf: p.id_issuer_uf,
      id_country: p.id_country,
      endereco_completo: p.endereco_completo,
      endereco_rua: p.endereco_rua,
      endereco_numero: p.endereco_numero,
      endereco_complemento: p.endereco_complemento,
      endereco_bairro: p.endereco_bairro,
      endereco_cidade: p.endereco_cidade,
      endereco_estado: p.endereco_estado,
      endereco_cep: p.endereco_cep,
      endereco_origem: isPj ? null : originByPath["principal"],
      dados_bancarios: dados_bancarios ?? null,
      pix_key: pix_key ?? null,
      company_name: isPj ? p.company_name : null,
      company_cnpj: isPj ? p.company_cnpj : null,
      company_address: isPj ? p.company_address : null,
      company_legal_nature: isPj ? (p.company_legal_nature ?? "privado") : null,
      company_rua: isPj ? p.company_rua : null,
      company_numero: isPj ? p.company_numero : null,
      company_complemento: isPj ? p.company_complemento : null,
      company_bairro: isPj ? p.company_bairro : null,
      company_cidade: isPj ? p.company_cidade : null,
      company_estado: isPj ? p.company_estado : null,
      company_cep: isPj ? p.company_cep : null,
      company_endereco_origem: isPj ? originByPath["principal"] : null,
      nationality: p.nationality,
      nationality_code: p.nationality_code,
      marital_status: p.marital_status,
      marital_status_code: p.marital_status_code,
      profession: p.profession,
      birth_date: p.birth_date,
      phone: p.phone,
      email: finalEmail,
      email_convite: qualification.email_convite ?? qualification.email,
      email_alterado_em: emailChanged ? new Date().toISOString() : null,
      v3_client_id: v3ClientId,
      representation: result.representation ? await buildRepresentationJson(db, result.representation, originByPath) : null,
      status: "preenchido",
      filled_at: new Date().toISOString(),
      // Compliance (11/09/2026, pedido de Robson Lino): IP de quem
      // efetivamente preencheu, pra auditoria/antifraude.
      filled_ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip") ?? null,
      // Sprint 1, Fase 4.2 (19/09/2026): mesmo padrao de filled_ip, registrado
      // so quando o aceite (ja validado como obrigatorio acima) acontece.
      lgpd_accepted_at: new Date().toISOString(),
      lgpd_accepted_ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip") ?? null,
    })
    .eq("id", qualification.id);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  // Checagem automática de CNPJ + quadro societário (14/09/2026, pedido de
  // João). Best-effort -- nunca desfaz o preenchimento já salvo acima se a
  // consulta à Receita Federal falhar ou demorar; o revisor sempre vê
  // "não verificado" nesse caso, nunca um resultado inventado.
  // CNPJ alfanumérico: a consulta automática ainda não aceita o formato novo (BrasilAPI e
  // ReceitaWS não confirmadas), então não é tentada e o motivo fica registrado com clareza.
  if (isPj && p.company_cnpj) {
    if (/[A-Z]/.test(p.company_cnpj)) {
      await db.from("cm_party_qualifications").update({
        cnpj_check_error: "CNPJ alfanumérico: consulta automática à Receita ainda não disponível",
        cnpj_checado_em: new Date().toISOString(),
      }).eq("id", qualification.id);
    } else {
      const lookup = await lookupCnpj(p.company_cnpj);
      if (lookup.ok) {
        await db.from("cm_party_qualifications").update({
          cnpj_situacao_cadastral: lookup.data.situacao_cadastral,
          cnpj_razao_social: lookup.data.razao_social,
          cnpj_socios: lookup.data.socios,
          cnpj_socio_informado_confere: qualification.full_name ? nameMatchesSocios(qualification.full_name, lookup.data.socios) : null,
          cnpj_checado_em: new Date().toISOString(),
          cnpj_check_error: null,
        }).eq("id", qualification.id);
      } else {
        await db.from("cm_party_qualifications").update({
          cnpj_check_error: lookup.error,
          cnpj_checado_em: new Date().toISOString(),
        }).eq("id", qualification.id);
      }
    }
  }

  // Exclusão individual (11/09/2026): envolvido soft-deletado nunca conta
  // pra "todos preencheram" -- senão um lote com 1 excluído ficaria
  // permanentemente incompleto mesmo com todo mundo ativo já qualificado.
  const { data: siblings } = await db
    .from("cm_party_qualifications")
    .select("status")
    .eq("batch_id", qualification.batch_id)
    .is("deleted_at", null);

  const allFilled = (siblings ?? []).length > 0 && (siblings ?? []).every((s) => s.status === "preenchido");

  // Notificação ao criador do lote: e-mail de assinatura alterado pela parte (BRIEF 5.10).
  // O e-mail novo passa a receber o link do ClickSign; a Mesa vê o aviso antes de gerar o contrato.
  const { data: batchInfo } = await db
    .from("cm_qualification_batches")
    .select("created_by, document_type, listing_id")
    .eq("id", qualification.batch_id)
    .single();

  if (emailChanged && batchInfo?.created_by) {
    const { error: notifError } = await db.from("notifications").insert({
      user_id: batchInfo.created_by,
      title: "E-mail de assinatura alterado pela parte",
      message: `${qualification.full_name} alterou o e-mail de assinatura de ${inviteEmail} para ${finalEmail}. Confira antes de gerar e enviar o contrato.`,
      type: "qualificacao_email_alterado",
      action_url: batchInfo.listing_id ? `/bolsa/mesa` : "/juridico/contratos",
      read: false,
    });
    if (notifError) console.error("[qualificacao/token] falha ao notificar e-mail alterado:", notifError.message);
  }

  if (allFilled) {
    const { data: batch } = await db
      .from("cm_qualification_batches")
      .update({ status: "completo", completed_at: new Date().toISOString() })
      .eq("id", qualification.batch_id)
      .select("created_by, document_type, listing_id, operation_contract_id")
      .single();

    if (batch?.created_by) {
      // Fase 5 (19/09/2026): o link de agendamento (Sprint 1, item 4.4) saiu
      // daqui -- movido para app/api/cm/intake/[token]/route.ts, disparando
      // logo apos o intake fechar (Etapa 2, inicio), nao mais so depois da
      // qualificacao terminar (fim da antiga Etapa 3). Nesta etapa a reuniao
      // ja deveria ter acontecido.
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
      // qualificação). Corrigido para MESCLAR: preserva toda parte
      // existente cujo e-mail não é de ninguém deste lote, e só então
      // acrescenta/atualiza as deste lote.
      const existingParties = (contract?.parties as Array<{ role: string; name: string; doc?: string | null; email?: string; qualification_id?: string | null }> | null) ?? [];
      const batchEmails = new Set((allQualifications ?? []).map((q) => q.email.toLowerCase()));
      const preservedParties = existingParties.filter((pt) => !pt.email || !batchEmails.has(pt.email.toLowerCase()));
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
            const clientId = await resolveClient(q.cpf_cnpj, { legalName: q.full_name, vertical: "ma", db });
            if (clientId) {
              await db.from("ma_deal_clients").upsert(
                { deal_id: contract.deal_id, v3_client_id: clientId, role: null, status: "prospecto", created_by: batch.created_by ?? null },
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
