import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { resolveContractVariables, wrapContractInV3Html } from "@/lib/contract-render";
import type { V3Series } from "@/lib/v3-codes";
import { resolveDeskHead, VERTICAL_TO_DESK_ORIGIN } from "@/lib/ncnda-desk-head";
import { renderPartyQualificationProse } from "@/lib/qualification-roles";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// 14/08/2026: MESA_OPERACIONAL adicionado. Achado real ao destravar NDA da
// Mesa de Crédito (Hamilton reportou não conseguir gerar): sem isso, a
// analista de crédito de plantão (ex: Taisa Pedroso, mesmo padrão de bug já
// corrigido em outras 5 rotas em 04/07/2026) veria o botão novo no modal da
// proposta e tomaria 401 clicando nele.
async function requireRole(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await svc().from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !["ADMIN", "GESTAO", "MESA_OPERACIONAL"].includes(profile.role as string)) return null;
  return { userId: user.id, role: profile.role as string };
}

export async function POST(req: NextRequest) {
  const caller = await requireRole(req);
  if (!caller) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { template_id, listing_id, bid_id, deal_id, credit_proposal_id, ticket_id, qualification_batch_id, commission_percent, extra_data, avulso_parties, is_master_agreement, valor_operacao, loi_side, loi_matched_contract_id, loi_override_justification } = await req.json();

  if (!template_id) return NextResponse.json({ error: "template_id obrigatório" }, { status: 422 });

  // Origem "avulso" (19/08/2026, item 1 dos ajustes de governança pedidos
  // por João): contrato de parceria com um grupo livre de indicadores, sem
  // nenhuma das 5 origens operacionais (listing/bid/deal/credit_proposal/
  // ticket) exigir um registro pré-existente. Cada parte já entra completa
  // no payload — nada é resolvido a partir de outra tabela.
  let avulsoParties: { role: string; name: string; doc: string | null; email: string }[] | null = null;
  if (Array.isArray(avulso_parties) && avulso_parties.length > 0) {
    const invalid = avulso_parties.some((p: any) => !p?.name?.trim() || !p?.email?.trim());
    if (invalid) {
      return NextResponse.json({ error: "Cada indicador precisa de nome e e-mail preenchidos." }, { status: 422 });
    }
    avulsoParties = avulso_parties.map((p: any) => ({
      role: (p.role as string)?.trim() || "indicador",
      name: (p.name as string).trim(),
      doc: p.doc?.trim() || null,
      email: (p.email as string).trim(),
    }));
  }

  const { data: template } = await svc()
    .from("contract_templates")
    .select("*")
    .eq("id", template_id)
    .eq("is_active", true)
    .single();

  if (!template) return NextResponse.json({ error: "Template não encontrado ou inativo" }, { status: 404 });

  // Gate de revisão jurídica (11/08/2026): minuta só gera contrato depois de
  // aprovada pelo jurídico + compliance/sócio diretor. approval_status
  // grandfathered para 'aprovado' nas minutas já existentes antes desta data.
  if (template.approval_status !== "aprovado") {
    return NextResponse.json(
      { error: `Minuta "${template.template_name}" ainda não foi aprovada pelo jurídico (status atual: ${template.approval_status}). Envie para revisão em Central de Contratos > Minutas antes de gerar contrato.` },
      { status: 422 }
    );
  }

  const variables: Record<string, any> = {
    data_geracao: new Date().toLocaleDateString("pt-BR"),
    data_geracao_extenso: new Date().toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" }),
    ...(extra_data ?? {}),
  };

  // Head automático por setor (04/09/2026, pedido explícito de João: "o Head
  // da operação precisa ser preenchido automaticamente", achado ao vivo na
  // NCNDA Mestre de Bolsa de Ativos). Generaliza o mesmo mecanismo que já
  // existia só para credit_proposal_id (Mesa de Crédito) para qualquer
  // minuta cujo vertical tenha Head fixo mapeado (ver
  // VERTICAL_TO_DESK_ORIGIN em lib/ncnda-desk-head.ts — "clientes" e
  // "institucional" ficam de fora, decisão explícita). Roda ANTES do bloco
  // credit_proposal_id abaixo, que sobrescreve com resolução mais precisa
  // (escopo nacional/internacional) quando presente.
  const verticalDeskOrigin = VERTICAL_TO_DESK_ORIGIN[template.vertical as string];
  if (verticalDeskOrigin) {
    const head = await resolveDeskHead(verticalDeskOrigin);
    if (head.cpf) {
      Object.assign(variables, {
        head_role_label: head.roleLabel,
        head_full_name: head.fullName,
        head_qualificacao: head.qualificacao,
        head_cpf: head.cpf,
        head_email: head.email,
      });
    }
    // CPF ausente (Head não preencheu /perfil ainda): não bloqueia aqui,
    // silenciosamente deixa sem head_* — mesmo padrão de tolerância que o
    // resto do motor já usa pra variável opcional ausente. O bloco
    // credit_proposal_id abaixo é quem bloqueia com 422 explícito quando o
    // Head É estritamente obrigatório (aquele fluxo sempre precisa dele).
  }

  if (listing_id) {
    const { data: listing } = await svc()
      .from("cm_asset_listings")
      .select("*")
      .eq("id", listing_id)
      .single();

    if (listing) {
      Object.assign(variables, {
        nome_cedente: listing.seller_name,
        cpf_cnpj_cedente: listing.seller_cpf_cnpj ?? "[CPF/CNPJ]",
        tipo_ativo: listing.asset_type,
        anonymous_id: listing.anonymous_id,
        ente_devedor: listing.ente_devedor ?? "[Ente Devedor]",
        esfera: listing.esfera ?? "[Esfera]",
        tribunal: listing.tribunal ?? "[Tribunal]",
        natureza: listing.natureza ?? "[Natureza]",
        numero_processo: listing.numero_processo ?? "[Processo]",
        valor_face: listing.valor_face,
        valor_atualizado: listing.valor_atualizado ?? listing.valor_face,
        desagio_pretendido: listing.desagio_pretendido ?? 0,
        prazo_estimado_meses: listing.prazo_estimado_meses ?? "[Prazo]",
      });
    }
  }

  if (bid_id) {
    const { data: bid } = await svc()
      .from("cm_bids")
      .select("*")
      .eq("id", bid_id)
      .single();

    if (bid) {
      Object.assign(variables, {
        valor_oferta: bid.bid_value,
        desagio_oferecido: bid.desagio_oferecido ?? 0,
        tipo_pagamento: bid.payment_type === "a_vista" ? "À Vista" : bid.payment_type === "parcelado" ? "Parcelado" : "Escrow",
        notas_comprador: bid.notes ?? "",
      });
    }
  }

  if (deal_id) {
    const { data: deal } = await svc()
      .from("ma_deals")
      .select("asset_name, deal_value, sector, v3_code")
      .eq("id", deal_id)
      .single();

    if (deal) {
      Object.assign(variables, {
        nome_ativo: deal.asset_name,
        valor_deal: deal.deal_value,
        setor: deal.sector,
        v3_code: deal.v3_code ?? "[V3 Code]",
      });
    }
  }

  // NCNDA Mestre / Mesa de Crédito (14/08/2026): credit_proposal_id já era
  // aceito e gravado desde sempre, mas nunca resolvia variável nenhuma —
  // bloco morto, causa raiz real de "Hamilton não consegue gerar NDA pela
  // Mesa de Crédito" (nenhum template de vertical='credito' existia
  // também, ver migration 20260814b). deal_origin_desk fixo em
  // CREDITO_ESTRUTURADO porque hoje só a Mesa de Crédito chama esta rota
  // com credit_proposal_id preenchido; se outra mesa vier a usar o mesmo
  // template no futuro, resolver por outro sinal (não por credit_proposal_id).
  // Partner que originou/cadastrou o cliente — quando presente, entra no
  // NDA como testemunha (17/08/2026, pedido direto do Hamilton: o NDA do
  // cliente vai pro cliente, pro representante legal da V3 e pro partner
  // que trouxe esse cliente, pra todo mundo da cadeia acompanhar).
  let partnerParty: { role: string; name: string; doc: string | null; email: string } | null = null;

  if (credit_proposal_id) {
    const { data: proposal } = await svc()
      .from("credit_desk_proposals")
      .select("code, client_name, partner_id, credit_line_id")
      .eq("id", credit_proposal_id)
      .single();

    // 18/08/2026: achado real ao João pedir link de qualificação pra uma
    // operação de crédito internacional — o Head sempre resolvia
    // CREDITO_ESTRUTURADO (Hamilton), mesmo quando a linha é de escopo
    // internacional (que o próprio ncnda-desk-head.ts já previa dever ser
    // Robson, CREDITO_INTERNACIONAL, só nunca tinha sido de fato checado
    // aqui). Resolvido pelo escopo real da linha vinculada à proposta
    // (regras_linhas_credito.escopo), nunca hardcoded.
    let deskOrigin: "CREDITO_ESTRUTURADO" | "CREDITO_INTERNACIONAL" = "CREDITO_ESTRUTURADO";
    if (proposal?.credit_line_id) {
      const { data: linha } = await svc()
        .from("regras_linhas_credito")
        .select("escopo")
        .eq("id", proposal.credit_line_id)
        .maybeSingle();
      if (linha?.escopo === "internacional") deskOrigin = "CREDITO_INTERNACIONAL";
    }

    // 17/08/2026: resolvido em tempo real via profiles (cada Head
    // preenche o próprio CPF/qualificação em /perfil), não mais hardcode.
    const head = await resolveDeskHead(deskOrigin);
    if (!head.cpf) {
      return NextResponse.json({
        error: `Bloco de assinatura da Mesa de Crédito incompleto: ${head.fullName} ainda não preencheu CPF em /perfil (aba Meu Perfil, bloco "Dados para Assinatura de Contratos"). Peça a ele para preencher antes de gerar contratos de crédito por esta rota.`,
      }, { status: 422 });
    }

    Object.assign(variables, {
      deal_id: proposal?.code ?? credit_proposal_id,
      deal_origin_desk: deskOrigin === "CREDITO_INTERNACIONAL" ? "Mesa de Crédito, Crédito Internacional" : "Mesa de Crédito, Crédito Estruturado",
      considerando_escopo_mesa: deskOrigin === "CREDITO_INTERNACIONAL"
        ? "estruturação, análise e intermediação de operações de crédito internacional, financiamento a brasileiros no exterior e demais linhas de escopo internacional, no âmbito da Mesa de Crédito V3 Partners"
        : "estruturação, análise e intermediação de operações de crédito estruturado, home equity e capital de giro lastreado em garantias reais, no âmbito da Mesa de Crédito V3 Partners",
      objeto_operacao_detalhado:
        `Modelagem financeira, securitização de recebíveis, emissão de debêntures, estruturação de CRI/CRA ou estruturação de funding com lastro em ativos reais sob o Deal nº ${proposal?.code ?? credit_proposal_id}${proposal?.client_name ? `, tomador ${proposal.client_name}` : ""}.`,
      head_role_label: head.roleLabel,
      head_full_name: head.fullName,
      head_qualificacao: head.qualificacao,
      head_cpf: head.cpf,
      head_email: head.email,
    });

    if (proposal?.partner_id) {
      const { data: partnerProfile } = await svc()
        .from("profiles")
        .select("full_name, email")
        .eq("id", proposal.partner_id)
        .single();
      // full_name precisa ter pelo menos 2 palavras pra ClickSign aceitar
      // como nome de signatário — sem isso, não adiciona (melhor pular a
      // testemunha do que quebrar o envio inteiro).
      if (partnerProfile?.email && partnerProfile.full_name && partnerProfile.full_name.trim().split(/\s+/).length >= 2) {
        partnerParty = { role: "testemunha", name: partnerProfile.full_name.trim(), doc: null, email: partnerProfile.email };
      }
    }
  }

  // Mesa Operacional: ticket não tem contraparte cadastrada (é um ticket
  // interno, não um deal/listing com "cedente"), então a contraparte do
  // documento vem inteira de extra_data (nome/CPF-CNPJ/e-mail digitados no
  // botão "Enviar NDA" do modal do ticket) — aqui só valida que o ticket
  // existe e guarda code/título como referência.
  if (ticket_id) {
    const { data: ticket } = await svc()
      .from("operational_tickets")
      .select("code, title")
      .eq("id", ticket_id)
      .single();

    if (!ticket) return NextResponse.json({ error: "Ticket não encontrado" }, { status: 404 });

    Object.assign(variables, {
      ticket_code: ticket.code,
      ticket_titulo: ticket.title,
    });
  }

  // Padronização via Central de Contratos (decisão 2026-07-28): quando o
  // contrato nasce de um lote da esteira de qualificação (NDA Quadripartite,
  // FPA Venda/Compra, Mandato, Contrato Final), as partes e as variáveis do
  // template vêm de cm_party_qualifications, não do cedente único da
  // listagem. Convenção de variável por parte: {{<role_in_document>_nome}},
  // {{<role_in_document>_cpf_cnpj}}, {{<role_in_document>_rg}},
  // {{<role_in_document>_endereco}}, {{<role_in_document>_email}} — ex:
  // {{mandatario_nome}}, {{intermediario_finder_venda_cpf_cnpj}}. Dr. Luis
  // deve escrever os 4 templates reais usando essas chaves.
  let qualificationParties: { role: string; name: string; doc: string | null; email: string }[] | null = null;

  // Qualificação Antecipada vinculada à Minuta (02/09/2026, P1): se a Mesa
  // não passou qualification_batch_id explicitamente, procurar um lote
  // completo e ainda não consumido para a MESMA minuta (template_id). Isso
  // é o que faz o botão "Gerar Link de Qualificação Antecipada" (na tela da
  // Minuta) surtir efeito automaticamente na primeira geração de contrato,
  // sem a Mesa precisar selecionar o lote manualmente.
  //
  // Single-use, decisão de negócio de João (Opção A, confirmada
  // explicitamente): minutas são reutilizáveis para múltiplas operações e
  // clientes distintos neste modelo de negócio (M&A/Estruturação).
  // Reaproveitar o mesmo lote em contratos diferentes vazaria CPF/RG/
  // endereço de um cliente/deal para outro (risco real de LGPD e sigilo de
  // parceiros) -- por isso o filtro `consumido_por_contract_id is null`
  // abaixo, e por isso o lote é marcado como consumido logo após o insert
  // do contrato ter sucesso (ver bloco depois do insert).
  let effectiveQualificationBatchId: string | null = qualification_batch_id ?? null;
  let autoDetectedBatch = false;
  if (!effectiveQualificationBatchId) {
    const { data: earlyBatch } = await svc()
      .from("cm_qualification_batches")
      .select("id")
      .eq("template_id", template_id)
      .eq("status", "completo")
      .is("consumido_por_contract_id", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (earlyBatch?.id) {
      effectiveQualificationBatchId = earlyBatch.id;
      autoDetectedBatch = true;
    }
  }

  if (effectiveQualificationBatchId) {
    const { data: qualifications } = await svc()
      .from("cm_party_qualifications")
      .select("full_name, email, phone, role_in_document, cpf_cnpj, rg, endereco_completo, person_type, party_nature, company_name, company_cnpj, company_address, company_legal_nature, representation, nationality, marital_status, profession, birth_date")
      .eq("batch_id", effectiveQualificationBatchId);

    if (qualifications && qualifications.length > 0) {
      qualificationParties = qualifications.map((q) => ({
        role: q.role_in_document,
        name: q.full_name,
        doc: q.cpf_cnpj,
        email: q.email,
      }));

      for (const q of qualifications) {
        variables[`${q.role_in_document}_nome`] = q.full_name;
        variables[`${q.role_in_document}_cpf_cnpj`] = q.cpf_cnpj ?? "[CPF/CNPJ]";
        variables[`${q.role_in_document}_rg`] = q.rg ?? "[RG]";
        variables[`${q.role_in_document}_endereco`] = q.endereco_completo ?? "[Endereço]";
        variables[`${q.role_in_document}_email`] = q.email;
      }

      qualificationParties.push({ role: "v3_partners", name: "V3 Partners Soluções Ltda", doc: "14.219.287/0001-50", email: "" });

      // NCNDA Mestre / credit_proposal_id: Head da mesa também é signatário
      // fixo quando o template resolveu head_*, mesmo com lote de
      // qualificação presente. variables.head_* já foi setado acima
      // (bloco credit_proposal_id roda antes deste).
      if (typeof variables.head_email === "string" && typeof variables.head_full_name === "string") {
        qualificationParties.push({
          role: "head_mesa",
          name: variables.head_full_name,
          doc: typeof variables.head_cpf === "string" ? variables.head_cpf : null,
          email: variables.head_email,
        });
      }

      // NCNDA Mestre (14/08/2026): mesmo dado, formato de prosa corrida em
      // vez de variável por chave de role, reaproveitado de
      // app/api/cm/qualifications/legal-text/route.ts (identBlock), mesma
      // regra PF/PJ. Só populado quando o template usa esse placeholder.
      variables.party_qualifications_block = qualifications.map(renderPartyQualificationProse).join("<br/>");
      variables.official_emails_protocol = Array.from(new Set([
        "joao.lemos@v3partners.com.br",
        typeof variables.head_email === "string" ? variables.head_email : null,
        ...qualifications.map((q) => q.email),
      ].filter((e): e is string => !!e))).join(", ");
    }
  }

  // Placeholders honestos (nunca "[party_qualifications_block]" literal via
  // o fallback padrão de resolveContractVariables) quando o template pede
  // esses blocos mas nenhum lote de qualificação foi selecionado ainda —
  // caso normal na primeira geração, antes de "Gerar Link de Qualificação".
  if (variables.party_qualifications_block === undefined) {
    variables.party_qualifications_block =
      "[Nenhuma parte aderente qualificada até o momento da geração desta minuta. Use \"Gerar Link de Qualificação\" para incluir intermediários/mandatários.]";
  }
  if (variables.official_emails_protocol === undefined) {
    variables.official_emails_protocol = Array.from(new Set([
      "joao.lemos@v3partners.com.br",
      typeof variables.head_email === "string" ? variables.head_email : null,
    ].filter((e): e is string => !!e))).join(", ");
  }

  if (commission_percent !== undefined) {
    variables.comissao_total = commission_percent;
    variables.comissao_v3 = (commission_percent * 0.5).toFixed(2);
    variables.comissao_partner = (commission_percent * 0.3).toFixed(2);
    variables.comissao_intermediario = (commission_percent * 0.2).toFixed(2);
  }

  // NCNDA Mestre / credit_proposal_id: V3 Partners + Head da mesa são
  // signatários fixos desde a primeira geração (mesmo sem nenhum
  // intermediário/mandatário qualificado ainda, ver Cláusula das Partes
  // Signatárias do template) — sem isso, "Enviar para Assinatura" nunca
  // aparece em contracts-panel-client.tsx (exige ao menos 1 parte não-V3
  // com e-mail).
  const headParty = typeof variables.head_email === "string" && typeof variables.head_full_name === "string"
    ? [{ role: "head_mesa", name: variables.head_full_name, doc: typeof variables.head_cpf === "string" ? variables.head_cpf : null, email: variables.head_email }]
    : [];

  // E-mail é obrigatório pra cada parte poder assinar de verdade (gate de
  // /api/contracts/[id]/send bloqueia parte sem e-mail) — esse fallback
  // genérico (fora da esteira de qualificação) nunca preenchia email, então
  // nenhum contrato gerado por aqui conseguia ser enviado. extra_data.email_cedente
  // é o e-mail digitado no formulário de quem está gerando (ex: botão
  // "Enviar NDA" da Mesa Operacional).
  //
  // 17/08/2026, confirmado direto pelo Hamilton: o NDA do cliente (branch
  // nome_cedente) sempre assina com João Lemos como representante legal da
  // V3 — não varia por mesa de origem (diferente do headParty abaixo, que é
  // o instrumento interno entre V3 e intermediários, esse sim por Head da
  // mesa). Quando a proposta tem partner_id resolvido, o partner que
  // cadastrou o cliente entra como testemunha, pra acompanhar o envio.
  // Nome do signatário na ClickSign precisa ser de pessoa física (mínimo 2
  // palavras, sem números — confirmado na doc oficial deles) — "V3 Partners
  // Soluções Ltda" quebra a validação por causa do "3" em "V3" ("name não
  // está em um formato válido"). Nas outras linhas de resolvedParties que
  // também usam esse texto, ele nunca chega em signers de verdade (email
  // vazio ou ausente); aqui é a única com e-mail real, então é a única que
  // precisava do nome de pessoa.
  const resolvedParties = avulsoParties ? [
    ...avulsoParties,
    { role: "v3_partners", name: "João Lemos Netto", doc: "14.219.287/0001-50", email: "joao.lemos@v3partners.com.br" },
  ] : qualificationParties ?? (variables.nome_cedente ? [
    { role: "cedente", name: variables.nome_cedente, doc: variables.cpf_cnpj_cedente, email: variables.email_cedente ?? null },
    { role: "v3_partners", name: "João Lemos Netto", doc: "14.219.287/0001-50", email: "joao.lemos@v3partners.com.br" },
    ...(partnerParty ? [partnerParty] : []),
  ] : headParty.length > 0 ? [
    ...headParty,
    { role: "v3_partners", name: "V3 Partners Soluções Ltda", doc: "14.219.287/0001-50" },
  ] : template.requires_counterparty_signature === false ? [
    // Documento unilateral (03/09/2026): Carta de Intenção de Compra V3 para
    // Terceiros e futuros templates equivalentes. O destinatário só recebe a
    // manifestação (nome/documento entram como variável de texto no corpo,
    // nunca como "parte"), quem assina de verdade é só a V3, via João Lemos
    // Netto, com e-mail real para poder ser enviado ao ClickSign como
    // envelope de signatário único.
    { role: "v3_partners", name: "João Lemos Netto", doc: "14.219.287/0001-50", email: "joao.lemos@v3partners.com.br" },
  ] : []);

  const renderedBody = resolveContractVariables(template.body_text_raw, variables);
  const contractTitle = resolveContractVariables(template.template_name, variables);
  const renderedHtml = wrapContractInV3Html(contractTitle, renderedBody, resolvedParties);

  // Governanca de Numeracao V3 (10/08/2026): corrige P0 achado ao vivo.
  // A migration 20260807b tornou operation_contracts.contract_code
  // obrigatorio e unico, emitido por next_v3_code(template.contract_series,
  // null) "no momento da geracao, nunca calculado na rota" (comentario da
  // propria migration) — mas esta rota nunca foi atualizada para de fato
  // chamar isso. Resultado: toda geracao de contrato falhava com violacao de
  // not-null desde 07/08/2026, confirmado por teste real antes deste fix
  // (zero contratos criados depois da migration, ultimo real de 28/07).
  if (!template.contract_series) {
    return NextResponse.json({ error: `Template "${template.template_name}" não declara contract_series — não é possível gerar contrato sem série de numeração.` }, { status: 422 });
  }
  const { data: contractCode, error: codeError } = await svc().rpc("next_v3_code", {
    p_series: template.contract_series as V3Series,
    p_class: null,
  });
  if (codeError || !contractCode) {
    return NextResponse.json({ error: `Falha ao emitir número do contrato: ${codeError?.message ?? "resposta vazia"}` }, { status: 500 });
  }

  // Trava de LOI Casada (BRIEF 2, 30/08/2026, item 3): qualquer operação da
  // série V3C-LOI do lado "venda" só pode ser emitida sem risco de expor a
  // V3 se já existir uma LOI de compra casada, com valor igual ou superior.
  // Gate SOFT por desenho (decisão de João em conversa anterior à mesma
  // sessão): nunca bloqueia a criação, mas exige justificativa quando não
  // há par casado, e o envio real para assinatura (send/route.ts) exige
  // depois aprovação unânime dos 3 sócios nesse caso.
  let loiMatchingStatus: "casada" | "nao_casada" | null = null;
  if (template.contract_series === "V3C-LOI" && loi_side === "venda") {
    if (loi_matched_contract_id) {
      const { data: matched } = await svc()
        .from("operation_contracts")
        .select("id, loi_side, valor_operacao")
        .eq("id", loi_matched_contract_id)
        .single();
      const valorValido =
        typeof matched?.valor_operacao === "number" &&
        typeof valor_operacao === "number" &&
        matched.valor_operacao >= valor_operacao;
      loiMatchingStatus = matched?.loi_side === "compra" && valorValido ? "casada" : "nao_casada";
    } else {
      loiMatchingStatus = "nao_casada";
    }
    if (loiMatchingStatus === "nao_casada" && !loi_override_justification?.trim()) {
      return NextResponse.json(
        {
          error:
            "Carta de Intenção de venda sem par de compra casado (valor igual ou superior). Informe loi_matched_contract_id com uma LOI de compra válida, ou justifique explicitamente em loi_override_justification para emitir mesmo assim — neste caso o envio para assinatura exigirá aprovação unânime dos 3 sócios.",
        },
        { status: 422 }
      );
    }
  }

  const { data: contract, error } = await svc()
    .from("operation_contracts")
    .insert({
      template_id,
      contract_code: contractCode,
      vertical: template.vertical,
      listing_id: listing_id ?? null,
      bid_id: bid_id ?? null,
      deal_id: deal_id ?? null,
      credit_proposal_id: credit_proposal_id ?? null,
      ticket_id: ticket_id ?? null,
      qualification_batch_id: effectiveQualificationBatchId,
      is_master_agreement: is_master_agreement === true,
      contract_title: contractTitle,
      rendered_html: renderedHtml,
      status_signature: "rascunho",
      commission_percent: commission_percent ?? null,
      valor_operacao: typeof valor_operacao === "number" ? valor_operacao : null,
      loi_side: loi_side ?? null,
      loi_matched_contract_id: loi_matched_contract_id ?? null,
      loi_matching_status: loiMatchingStatus,
      loi_override_justification: loiMatchingStatus === "nao_casada" ? loi_override_justification.trim() : null,
      parties: resolvedParties,
      created_by: caller.userId,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Single-use (02/09/2026, P1): consome o lote de qualificação antecipada
  // agora que o contrato nasceu com os dados herdados. Best-effort -- uma
  // falha aqui nunca desfaz o contrato já criado, só significa que o
  // próximo contrato desta mesma minuta poderia (no pior caso) reencontrar
  // este lote; o filtro por template_id+status+consumido_por_contract_id
  // continua correto mesmo assim porque o UPDATE abaixo é a única gravação
  // que zera essa janela, e é síncrona com o insert acima.
  if (effectiveQualificationBatchId) {
    try {
      const { error: consumeError } = await svc()
        .from("cm_qualification_batches")
        .update({ consumido_por_contract_id: contract.id })
        .eq("id", effectiveQualificationBatchId);
      if (consumeError) console.error("[contracts/generate] falha ao marcar lote como consumido:", consumeError);
    } catch (e) {
      console.error("[contracts/generate] falha ao marcar lote como consumido:", e);
    }
  }

  return NextResponse.json({
    contract,
    preview_html: renderedHtml,
    variables_resolved: Object.keys(variables).length,
    qualification_batch_auto_detected: autoDetectedBatch,
  }, { status: 201 });
}
