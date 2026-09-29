import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

import { logAgentAuditEvent } from "@/lib/socios-notify";
import { notifyUser, SOCIOS_IDS } from "@/lib/contract-notify";
import { triggerContractRevisionAgent } from "@/lib/contract-revision-agent";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// Grupos de revisor. Atualizado em 29/09/2026 (decisão de João): não existe
// mais jurídico interno nomeado (Dr. Luis Athaydes saiu do time). O voto de
// aprovação passa a ser só o quórum dos 3 sócios diretores (COMPLIANCE_SOCIO)
// -- ver ~/.claude/rules/v3-contract-legal-gate.md e session-decisions.md
// (entrada 29/09/2026). O grupo JURIDICO e o caminho de quórum que dispensava
// 1 dos 2 sócios foram removidos; a auditoria de forma continua sendo o
// @contract-legal-guardian, que roda ANTES do voto (nunca substitui o voto).
// Hamilton tem 2 contas: 27a8a72e... (hamilton@, PARTNER_PRO, demonstração
// pra prospects/partners) e 75c6cac4... (suporte@, ADMIN, conta real dele).
// Usa a real aqui — mesma correção aplicada em contracts/approve/route.ts.
const COMPLIANCE_SOCIO: Record<string, string> = {
  "d5f26efd-8ed5-4d90-b3f4-9ce0004803c5": "Robson Lino", // compliance
  "d0af8eaa-9f3c-4e7a-b8c6-613736524317": "João Lemos", // sócio diretor
  "75c6cac4-8d30-436e-b9a6-d5d494d7470b": "Hamilton Santos", // sócio diretor
};

async function getReviewer() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  if (COMPLIANCE_SOCIO[user.id]) return { userId: user.id, name: COMPLIANCE_SOCIO[user.id], type: "compliance_socio" as const };
  return null;
}

// POST /api/contracts/templates/[id]/review — jurídico ou compliance/sócio
// aprova ou reprova uma minuta em revisão. Pode editar o corpo direto aqui
// (body_text_raw opcional) em vez de só aprovar/reprovar e devolver pro
// autor — pedido explícito de João (11/08/2026): "é importante que o
// jurídico possa operar e fazer alteração dentro dessa visão também".
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const reviewer = await getReviewer();
  if (!reviewer)
    return NextResponse.json({ error: "Apenas sócio diretor (João, Hamilton ou Robson) pode revisar minutas" }, { status: 403 });

  const { id } = await params;
  const { decision, comment, body_text_raw } = await req.json();

  if (!["aprovado", "reprovado"].includes(decision))
    return NextResponse.json({ error: "decision deve ser 'aprovado' ou 'reprovado'" }, { status: 422 });
  if (decision === "reprovado" && !comment?.trim())
    return NextResponse.json({ error: "Reprovação exige comentário explicando o motivo" }, { status: 422 });

  const db = svc();

  const { data: template } = await db
    .from("contract_templates")
    .select("id, template_name, approval_status, review_round, body_text_raw, version, valor_operacao_estimado, origem, created_by, vertical, contract_series")
    .eq("id", id)
    .single();

  if (!template) return NextResponse.json({ error: "Minuta não encontrada" }, { status: 404 });
  if (template.approval_status !== "em_revisao")
    return NextResponse.json({ error: `Minuta não está em revisão (status atual: ${template.approval_status})` }, { status: 409 });

  // Revisor pode editar o corpo direto na tela de revisão antes de decidir.
  const bodyEdited = typeof body_text_raw === "string" && body_text_raw.trim() && body_text_raw !== template.body_text_raw;
  if (bodyEdited) {
    const vars = (body_text_raw.match(/\{\{([^}]+)\}\}/g) || []).map((v: string) => v.replace(/\{\{|\}\}/g, "").trim());
    await db.from("contract_templates").update({
      body_text_raw,
      variables_map: vars.map((v: string) => ({ key: v, label: v.replace(/_/g, " "), source: "auto" })),
      version: (template.version ?? 1) + 1,
    }).eq("id", id);
  }

  // 17/08/2026: upsert em vez de insert puro. Achado real: Hamilton e
  // Robson tinham voto duplicado na mesma minuta/rodada (clique duplo ou
  // reenvio), sem nenhuma guarda — inflava o histórico e a contagem de
  // quórum por sócio (ver migration 20260817b + constraint UNIQUE
  // template_id+review_round+reviewer_id). Reenviar o voto agora
  // atualiza a decisão existente em vez de duplicar linha.
  await db.from("contract_template_reviews").upsert({
    template_id: id,
    review_round: template.review_round,
    reviewer_id: reviewer.userId,
    reviewer_name: reviewer.name,
    reviewer_type: reviewer.type,
    decision,
    comment: comment?.trim() || null,
    body_edited: !!bodyEdited,
  }, { onConflict: "template_id,review_round,reviewer_id" });

  const reviewLink = `https://app.v3partners.com.br/juridico/contratos?tab=minutas&template_id=${id}`;

  if (decision === "reprovado") {
    await db.from("contract_templates").update({ approval_status: "reprovado" }).eq("id", id);

    // Gap 3 do Fluxograma de Notificações (11/09/2026): antes disso quem
    // submeteu a minuta nunca sabia que ela tinha sido reprovada, só
    // descobrindo ao reabrir a tela manualmente.
    if (template.created_by && template.created_by !== reviewer.userId) {
      await notifyUser({
        userId: template.created_by,
        title: `Minuta reprovada: ${template.template_name}`,
        message: `${reviewer.name} reprovou a minuta "${template.template_name}". Motivo: ${comment.trim()}`,
        type: "minuta_reprovada",
        actionUrl: reviewLink,
      });
    }

    // Ajuste automático (14/09/2026, pedido de João/Dr. Athaydes): a
    // recomendação do revisor vira instrução pra IA na hora, em vez de
    // esperar alguém copiar o comentário e clicar em "Pedir Ajuste ao
    // Agente" manualmente -- achado real: a minuta Rio Pardo levou 2
    // rodadas de reprovação pelo MESMO motivo porque ninguém aplicou a
    // correção que o Dr. Luis já tinha pedido na primeira.
    //
    // Restrito a origem != agente_ia/agente_ia_estruturador de propósito:
    // essas duas usam draft-callback/analysis-callback, que nunca avançam
    // review_round (correto pra elas, que sempre nascem em rodada nova) --
    // disparar o ajuste automático nelas depois de um voto de reprovação
    // reintroduziria o bug já corrigido uma vez de voto antigo contando pro
    // texto novo (ver revision-callback/route.ts). Fica pra quando/se essas
    // duas origens precisarem do mesmo tratamento.
    //
    // Best-effort: falha aqui nunca desfaz o registro do voto de reprovação
    // acima, só fica sem o ajuste automático (o fluxo manual de "Corrigir e
    // Reenviar" continua funcionando como sempre).
    if (template.origem !== "agente_ia" && template.origem !== "agente_ia_estruturador") {
      const revisionResult = await triggerContractRevisionAgent(db, template, comment.trim(), {
        actorId: reviewer.userId,
        actorName: reviewer.name,
      });
      if (!revisionResult.ok) {
        console.error(`[review] ajuste automático não disparou para minuta ${id}:`, revisionResult.error);
      }
    }

    if (template.origem === "agente_ia") {
      await logAgentAuditEvent({
        templateId: id,
        eventType: "voto_registrado",
        actorId: reviewer.userId,
        actorName: reviewer.name,
        detail: { decision, comment: comment?.trim() || null, reviewer_type: reviewer.type },
      });
      await logAgentAuditEvent({
        templateId: id,
        eventType: "minuta_reprovada",
        actorId: reviewer.userId,
        actorName: reviewer.name,
        detail: { comment: comment?.trim() || null },
      });
    }
    return NextResponse.json({ approval_status: "reprovado" });
  }

  // decision === "aprovado": checar se o quórum do round atual já fechou.
  // Atualizado em 29/09/2026 (Dr. Luis Athaydes saiu do time, decisão de
  // João): o caminho que dispensava 1 dos 2 sócios com o voto do jurídico
  // foi removido. Só existe mais o quórum dos 3 sócios diretores
  // (compliance_socio). Constraint UNIQUE (migration 20260817b) garante
  // que cada reviewer_id conta uma vez só por rodada, então contar linhas
  // já equivale a contar pessoas distintas.
  const { data: roundReviews } = await db
    .from("contract_template_reviews")
    .select("reviewer_id, reviewer_type, decision")
    .eq("template_id", id)
    .eq("review_round", template.review_round);

  const approvedSocios = (roundReviews ?? []).filter((r) => r.reviewer_type === "compliance_socio" && r.decision === "aprovado");
  const socioMajority = approvedSocios.length >= 2;

  // Regra de Quórum dos 3 Sócios (atualiza a Regra de Quórum Soberano do
  // BRIEF 2, 30/08/2026, depois da saída do jurídico interno em 29/09/2026):
  // dois caminhos possíveis, nesta ordem de prioridade.
  //   (a) UNANIMIDADE (3/3 sócios) sempre fecha quórum, qualquer valor.
  //   (b) Valor declarado <= R$50 mil: maioria de sócios (2/3) fecha
  //       quórum (trilho rápido original).
  // Valor declarado > R$50 mil sem unanimidade NÃO fecha mais quórum (antes
  // esse caso exigia o voto do jurídico + 1 sócio; sem jurídico, exige os
  // 3 sócios). Minutas sem valor declarado (fluxo manual antigo) sempre
  // caem no caminho (b), comportamento idêntico ao que já existia antes.
  const VALOR_LIMITE_MAIORIA = 50000;
  const valorDeclarado = template.valor_operacao_estimado;
  const valorAcimaDoLimite = typeof valorDeclarado === "number" && valorDeclarado > VALOR_LIMITE_MAIORIA;
  const unanimidade = approvedSocios.length >= 3;
  const maioriaValidaPorValor = socioMajority && !valorAcimaDoLimite;
  const quorumMet = unanimidade || maioriaValidaPorValor;

  if (quorumMet) {
    await db.from("contract_templates").update({ approval_status: "aprovado" }).eq("id", id);
  }

  // Gaps 2 e 3 do Fluxograma de Notificações (11/09/2026): antes disso
  // nenhuma notificação saía daqui, nem pra quem submeteu (não sabia que
  // já podia gerar o contrato, ou que faltava mais alguém votar), nem pro
  // outro grupo ainda pendente (o jurídico não sabia que um sócio já
  // aprovou e falta só ele, ou vice-versa).
  if (quorumMet) {
    if (template.created_by && template.created_by !== reviewer.userId) {
      await notifyUser({
        userId: template.created_by,
        title: `Minuta aprovada: ${template.template_name}`,
        message: `A minuta "${template.template_name}" atingiu quórum de aprovação. Já pode gerar o contrato.`,
        type: "minuta_aprovada",
        actionUrl: reviewLink,
      });
    }
  } else {
    // Quórum ainda não fechou: avisa quem falta votar nesta rodada (nunca
    // quem já votou), e também quem submeteu, pra acompanhar o andamento.
    const jaVotaram = new Set((roundReviews ?? []).map((r) => r.reviewer_id));
    const pendentes = SOCIOS_IDS.filter((sid) => !jaVotaram.has(sid)).filter((uid) => uid !== reviewer.userId);

    await Promise.all(
      pendentes.map((uid) =>
        notifyUser({
          userId: uid,
          title: `Voto pendente: ${template.template_name}`,
          message: `${reviewer.name} aprovou a minuta "${template.template_name}". Ainda falta seu voto para fechar o quórum.`,
          type: "minuta_voto_pendente",
          actionUrl: reviewLink,
        })
      )
    );

    if (template.created_by && template.created_by !== reviewer.userId) {
      await notifyUser({
        userId: template.created_by,
        title: `Voto registrado: ${template.template_name}`,
        message: `${reviewer.name} aprovou a minuta "${template.template_name}" (${approvedSocios.length}/3 sócios). Ainda aguardando quórum.`,
        type: "minuta_voto_registrado",
        actionUrl: reviewLink,
      });
    }
  }

  // Auditoria dedicada (BRIEF 2, item 3): só grava para minutas geradas
  // pelo Agente Revisor de Riscos (contract_ai_agent_audit_log.template_id
  // não é útil pro fluxo manual, que já tem sua própria trilha em
  // contract_template_reviews desde sempre).
  if (template.origem === "agente_ia") {
    await logAgentAuditEvent({
      templateId: id,
      eventType: "voto_registrado",
      actorId: reviewer.userId,
      actorName: reviewer.name,
      detail: { decision, comment: comment?.trim() || null, reviewer_type: reviewer.type },
    });
    if (quorumMet) {
      await logAgentAuditEvent({
        templateId: id,
        eventType: "minuta_aprovada",
        actorName: "Sistema",
        detail: {
          via: unanimidade ? "unanimidade_3_socios" : "maioria_socios",
          socios_aprovaram: approvedSocios.length,
          valor_operacao_estimado: valorDeclarado,
        },
      });
    }
  }

  return NextResponse.json({
    approval_status: quorumMet ? "aprovado" : "em_revisao",
    quorum: {
      socios_aprovaram: approvedSocios.length,
      met: quorumMet,
      unanimidade,
      bloqueado_por_valor: valorAcimaDoLimite && !unanimidade,
    },
    message: quorumMet
      ? unanimidade
        ? `Quórum atingido por unanimidade dos 3 sócios. Minuta aprovada, liberada para gerar contrato.`
        : `Quórum atingido por maioria de sócios (${approvedSocios.length}/3). Minuta aprovada, liberada para gerar contrato.`
      : valorAcimaDoLimite && socioMajority && !unanimidade
        ? `Maioria de sócios atingida (${approvedSocios.length}/3), mas o valor declarado da operação (R$${valorDeclarado?.toLocaleString("pt-BR")}) passa de R$50.000: precisa da unanimidade dos 3 sócios. Aguardando.`
        : `Aprovação de sócio diretor registrada (${approvedSocios.length}/3 sócios). Aguardando 2 sócios${valorAcimaDoLimite ? " (ou os 3 sócios, dado o valor acima de R$50 mil)" : ""}.`,
  });
}

// GET /api/contracts/templates/[id]/review — histórico de revisões da minuta.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const reviewer = await getReviewer();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  // Leitura também liberada pra quem só administra minutas (ADMIN/GESTAO),
  // não só quem pode votar.
  if (!reviewer) {
    const { data: profile } = await svc().from("profiles").select("role").eq("id", user.id).single();
    if (!profile || !["ADMIN", "GESTAO"].includes(profile.role as string))
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const { data, error } = await svc()
    .from("contract_template_reviews")
    .select("*")
    .eq("template_id", id)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ reviews: data ?? [] });
}
