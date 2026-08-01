import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";
import { CHECKLISTS, DEFAULT_CHECKLIST, LEVEL_LINES } from "@/lib/credit-checklists";

/** Parseia valor em formato BRL ("5.000,00") — não confundir com dígitos crus. */
function parseBRL(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v !== "string" || !v.trim()) return 0;
  return parseFloat(v.replace(/\./g, "").replace(",", ".")) || 0;
}

function serviceClient() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

function normalizeStr(s: string) {
  return s.toUpperCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Gera o próximo code sequencial (`PREFIX-NNNN`) a partir do maior número já
 *  usado na tabela — nunca de COUNT(*), que diverge do real assim que existe
 *  qualquer gap (linha deletada ou code fora do padrão) e gera colisão
 *  determinística de unique constraint. Usar sempre dentro de um loop de
 *  retry no insert (ver `insertWithUniqueCode`), pois mesmo lendo o MAX real
 *  duas requisições concorrentes podem calcular o mesmo próximo número. */
async function nextSequentialCode(
  svc: ReturnType<typeof serviceClient>,
  table: string,
  prefix: string,
): Promise<string> {
  const { data } = await svc.from(table).select("code").like("code", `${prefix}-%`);
  const re = new RegExp(`^${prefix}-(\\d+)$`);
  let max = 0;
  for (const row of (data ?? []) as { code: string }[]) {
    const match = row.code.match(re);
    if (match) {
      const n = parseInt(match[1], 10);
      if (n > max) max = n;
    }
  }
  return `${prefix}-${String(max + 1).padStart(4, "0")}`;
}

/** Insere com code gerado por `nextSequentialCode`, retentando com o próximo
 *  número em caso de unique_violation (23505) — cobre a race condition entre
 *  requisições concorrentes que o simples cálculo do MAX não elimina sozinho. */
async function insertWithUniqueCode<T extends Record<string, unknown>>(
  svc: ReturnType<typeof serviceClient>,
  table: string,
  prefix: string,
  buildRow: (code: string) => T,
  maxAttempts = 5,
): Promise<{ data: Record<string, unknown> | null; error: { message: string; code?: string } | null }> {
  let lastError: { message: string; code?: string } | null = null;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const code = await nextSequentialCode(svc, table, prefix);
    const { data, error } = await svc.from(table).insert(buildRow(code)).select("*").single();
    if (!error) return { data, error: null };
    lastError = error;
    if (error.code !== "23505") return { data: null, error };
  }
  return { data: null, error: lastError };
}

type ChecklistItem = { id: string; label: string };
type PortfolioLinha = { nome: string; documentos_pf?: { id: string; nome: string; obrigatorio: boolean }[]; documentos_pj?: { id: string; nome: string; obrigatorio: boolean }[] };

/** Resolve a checklist de documentos da mesma forma que o PropostaDetailModal:
 *  portfolio_linhas (nome normalizado) → CHECKLISTS (linhas fixas) → DEFAULT_CHECKLIST. */
function resolveChecklist(creditLine: string, clientType: "PF" | "PJ", portfolioLinhas: PortfolioLinha[]): ChecklistItem[] {
  const cl = normalizeStr(creditLine || "");

  const linha = portfolioLinhas.find(l => {
    const n = normalizeStr(l.nome);
    return n === cl || n.startsWith(cl) || cl.startsWith(n);
  });
  if (linha) {
    const docs = clientType === "PJ" ? linha.documentos_pj : linha.documentos_pf;
    if (docs && docs.length > 0) return docs.map(d => ({ id: d.id, label: d.nome }));
  }

  const checklistKey = Object.keys(CHECKLISTS).find(key => {
    const n = normalizeStr(key);
    return n === cl || n.startsWith(cl) || cl.startsWith(n);
  });
  if (checklistKey) {
    return CHECKLISTS[checklistKey][clientType].map(d => ({ id: d.id, label: d.label }));
  }

  return DEFAULT_CHECKLIST[clientType].map(d => ({ id: d.id, label: d.label }));
}

/** Resolve o nível (N1/N2/N3) pela linha de crédito escolhida — mesmo mapeamento
 *  usado na Mesa de Crédito (LEVEL_LINES). Casamento mais permissivo (includes
 *  nos dois sentidos) porque os valores do formulário público (ex: "AVAL",
 *  "HOME EQUITY") são mais curtos que os nomes completos das linhas (ex:
 *  "Crédito no Aval"). Sem linha reconhecida, cai no valor solicitado —
 *  respeitando sempre o mínimo de R$ 5.000.000 para Nível 3. */
function resolveLevel(creditLine: string, requestedValue: number): "NIVEL_1" | "NIVEL_2" | "NIVEL_3" {
  const cl = normalizeStr(creditLine || "");
  if (cl) {
    for (const nivel of ["NIVEL_1", "NIVEL_2", "NIVEL_3"] as const) {
      const match = LEVEL_LINES[nivel].some(l => {
        const n = normalizeStr(l);
        return n === cl || n.includes(cl) || cl.includes(n);
      });
      if (match) return nivel;
    }
  }
  return requestedValue >= 5_000_000 ? "NIVEL_3" : requestedValue >= 500_000 ? "NIVEL_2" : "NIVEL_1";
}

/** Copia um arquivo já enviado via link de captação (bucket captacao-documents,
 *  privado) para o bucket credit-documents, no formato que a proposta espera.
 *  `sourcePath` vem do que o próprio upload retornou (nunca de uma URL
 *  informada pelo cliente) e precisa começar com o token deste envio — evita
 *  que alguém informe o caminho de um documento de outro lead/parceiro. */
async function copyToProposalBucket(
  svc: ReturnType<typeof serviceClient>,
  sourcePath: string,
  token: string,
  ownerId: string,
  proposalId: string,
  docId: string,
  fileName: string,
): Promise<{ storage_path: string } | null> {
  if (!sourcePath.startsWith(`${token}/`)) return null;

  const { data: fileData, error: downloadError } = await svc.storage.from("captacao-documents").download(sourcePath);
  if (downloadError || !fileData) return null;

  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_").substring(0, 80);
  const storagePath = `${ownerId}/${proposalId}/${docId}_${Date.now()}_${safeName}`;

  const { error: uploadError } = await svc.storage
    .from("credit-documents")
    .upload(storagePath, await fileData.arrayBuffer(), { contentType: fileData.type || undefined, upsert: false });
  if (uploadError) return null;

  return { storage_path: storagePath };
}

/** Cria a proposta de crédito já vinculada ao lead, com os dados do formulário
 *  e os documentos anexados registrados contra o checklist da linha escolhida.
 *  Fica marcada como pendente de conferência do partner (crm_pending_review) —
 *  só aparece na Mesa de Crédito depois que o partner confirmar os documentos. */
async function createLinkedProposal(
  svc: ReturnType<typeof serviceClient>,
  lead: { id: string; code: string },
  formData: Record<string, unknown>,
  partnerId: string,
  token: string,
) {
  const clientType: "PF" | "PJ" = formData.personType === "PJ" ? "PJ" : "PF";
  const creditLine = (formData.creditLine as string) || (formData.productInterest as string) || "HOME EQUITY";
  const clientName = clientType === "PF" ? String(formData.name ?? "").trim() : String(formData.razaoSocial || formData.name || "").trim();

  const valorSolicitado = parseBRL(formData.valorSolicitado);
  const rendaOuFaturamento = clientType === "PF" ? parseBRL(formData.renda) : parseBRL(formData.faturamento);
  const baseVal = valorSolicitado || (rendaOuFaturamento > 0 ? Math.round(rendaOuFaturamento * 12 * 0.3) : 100000);
  const level = resolveLevel(creditLine, baseVal);
  const requestedValue = level === "NIVEL_3" ? Math.max(baseVal, 5_000_000) : baseVal;

  // Resolve checklist e registra os documentos já anexados no formulário
  const { data: portfolioLinhas } = await svc.from("portfolio_linhas").select("nome, documentos_pf, documentos_pj").eq("ativo", true);
  const checklist = resolveChecklist(creditLine, clientType, (portfolioLinhas ?? []) as PortfolioLinha[]);

  const documentosForm = Array.isArray(formData.documentos)
    ? (formData.documentos as { label: string; name: string; path?: string; url?: string }[])
    : [];

  const proposalIdForPath = crypto.randomUUID();
  const documents: { doc_id: string; file_name: string; storage_path: string; uploaded_at: string; uploaded_by: string }[] = [];
  const checklistChecked: Record<string, boolean> = {};

  for (let i = 0; i < documentosForm.length; i++) {
    const doc = documentosForm[i];
    // Só o "path" retornado pelo próprio upload é confiável — nunca uma URL
    // informada livremente no corpo da requisição.
    if (!doc?.path) continue;
    const labelNorm = normalizeStr(doc.label ?? "");
    const match = checklist.find(c => {
      const n = normalizeStr(c.label);
      return n === labelNorm || n.startsWith(labelNorm) || labelNorm.startsWith(n);
    });
    const docId = match?.id ?? `captacao_${i}`;
    const copied = await copyToProposalBucket(svc, doc.path, token, partnerId, proposalIdForPath, docId, doc.name ?? doc.label ?? "documento");
    if (copied) {
      documents.push({ doc_id: docId, file_name: doc.name ?? doc.label ?? "documento", storage_path: copied.storage_path, uploaded_at: new Date().toISOString(), uploaded_by: partnerId });
      if (match) checklistChecked[docId] = true;
    }
  }

  const { data: proposal, error } = await insertWithUniqueCode(
    svc,
    "credit_desk_proposals",
    "CRED-26",
    (code) => ({
      id: proposalIdForPath,
      code,
      title: `${creditLine} - ${clientName}`,
      client_name: clientName,
      client_cpf_cnpj: (formData.cpfCnpj as string) ?? null,
      credit_line: creditLine,
      requested_value: requestedValue,
      current_level: level,
      status: "PENDING",
      stage: "RECEBIDO",
      partner_id: partnerId,
      created_by: partnerId,
      documents,
      checklist: checklistChecked,
      metadata: {
        ...formData,
        crm_lead_id: lead.id,
        crm_lead_code: lead.code,
        client_type: clientType,
        email: formData.email,
        telefone: formData.phone,
        renda_mensal: clientType === "PF" ? rendaOuFaturamento : undefined,
        faturamento_mensal: clientType === "PJ" ? rendaOuFaturamento : undefined,
        estado_civil: formData.estadoCivil,
        nascimento: formData.nascimento,
        razao_social: formData.razaoSocial,
        nome_fantasia: formData.nomeFantasia,
        socio_responsavel: formData.socioResponsavel,
        endereco_rua: formData.enderecoRua,
        endereco_cep: formData.cep,
        endereco_cidade: formData.city,
        endereco_uf: formData.state,
        restricao_cliente: formData.restricao,
        prazo: formData.prazo,
        finalidade: formData.finalidade,
        observacoes: formData.observacoes,
        imoveis: formData.imoveis,
        documentos: formData.documentos,
        captacao_origin: true,
        crm_pending_review: true,
      },
    }),
  );

  if (error || !proposal) return null;
  const typedProposal = proposal as { id: string; code: string };

  await svc.from("crm_leads").update({ credit_proposal_id: typedProposal.id }).eq("id", lead.id);
  return typedProposal;
}

// POST — recebe dados do formulário público de captação (sem auth)
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { token, ...formData } = body;

  if (!token) return NextResponse.json({ error: "Token obrigatório" }, { status: 400 });
  if (!formData.lgpdConsent) return NextResponse.json({ error: "Autorização LGPD obrigatória" }, { status: 400 });

  const svc = serviceClient();

  // Valida token
  const { data: link, error: linkError } = await svc
    .from("captacao_links")
    .select("id, partner_id, partner_name, active, uses_count")
    .eq("token", token)
    .single();

  if (linkError || !link || !link.active) {
    return NextResponse.json({ error: "Link inválido ou desativado" }, { status: 404 });
  }

  // Monta nome do cliente
  const clientName = formData.personType === "PF"
    ? (formData.name ?? "").trim()
    : (formData.razaoSocial || formData.name || "").trim();

  if (!clientName) return NextResponse.json({ error: "Nome do cliente obrigatório" }, { status: 400 });

  // Calcula receita anual aproximada
  const annualRevenue = formData.personType === "PF"
    ? parseBRL(formData.renda) * 12
    : parseBRL(formData.faturamento) * 12;

  // Insere lead no CRM (code gerado a partir do MAX real + retry em conflito —
  // nunca COUNT(*), que diverge do real assim que há qualquer gap na tabela)
  const { data: lead, error } = await insertWithUniqueCode(
    svc,
    "crm_leads",
    "CRM-26",
    (code) => ({
    code,
    name: clientName,
    document:         formData.cpfCnpj ?? null,
    person_type:      formData.personType ?? "PF",
    email:            formData.email ?? null,
    phone:            formData.phone ?? null,
    segment:          formData.productInterest ?? formData.segment ?? null,
    annual_revenue:   annualRevenue,
    city:             formData.city ?? null,
    state:            formData.state ?? null,
    status:           "prospect",
    source:           "digital",
    visit_date:       null,
    next_contact:     null,
    notes:            formData.observacoes ?? null,
    product_interest: formData.productInterest ?? null,
    credit_line:      formData.creditLine ?? null,
    partner_id:       link.partner_id,
    partner_name:     link.partner_name,
    created_by:       link.partner_id,
    interactions:     [],
    metadata:         {
      ...formData,
      lgpdConsent: true,
      captacao_token: token,
      submitted_at: new Date().toISOString(),
    },
    }),
  );

  if (error || !lead) return NextResponse.json({ error: error?.message ?? "Erro ao gerar código único do lead" }, { status: 500 });
  const typedLead = lead as { id: string; code: string };

  // Incrementa uses_count
  await svc
    .from("captacao_links")
    .update({ uses_count: (link.uses_count ?? 0) + 1 })
    .eq("id", link.id);

  // Espelha o lead na tabela prospeccao_leads para visibilidade de ADMIN/SDR/CLOSER
  await svc.from("prospeccao_leads").insert({
    nome:                     clientName,
    documento:                formData.cpfCnpj ?? null,
    email:                    formData.email ?? null,
    telefone:                 formData.phone ?? null,
    cidade:                   formData.city ?? null,
    estado:                   formData.state ?? null,
    origem:                   "indicacao_partner",
    indicado_por_partner_id:  link.partner_id,
    indicado_por_nome:        link.partner_name ?? null,
    responsavel_id:            null,
    responsavel_nome:         null,
    notas:                    formData.observacoes
                                ? `Produto: ${formData.productInterest ?? "-"}\n${formData.observacoes}`
                                : `Produto: ${formData.productInterest ?? "-"}`,
    etapa:                    "prospect",
    created_by:               link.partner_id,
    crm_lead_id:              typedLead.id,
  }).then(() => {}, () => {}); // fire-and-forget, não bloqueia resposta

  // Cria a proposta de crédito já vinculada ao lead, com dados e documentos do
  // formulário registrados contra o checklist — pendente de conferência do
  // partner antes de aparecer na Mesa de Crédito. Não bloqueia a resposta.
  try {
    await createLinkedProposal(svc, typedLead, formData, link.partner_id, token);
  } catch (e) {
    console.error("[captacao/submit] Erro ao criar proposta vinculada:", e);
  }

  return NextResponse.json({ ok: true, code: typedLead.code });
}
