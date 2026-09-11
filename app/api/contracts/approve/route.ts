import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { notifyUser } from "@/lib/contract-notify";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// Hamilton tem 2 contas: 27a8a72e... (hamilton@, PARTNER_PRO, conta de
// demonstração pra prospects/partners) e 75c6cac4... (suporte@, ADMIN, conta
// real dele). Achado real 11/08/2026: este array usava a conta de demo desde
// sempre — Hamilton nunca conseguiu aprovar contrato com a conta admin real,
// sempre tomaria 403 mesmo sendo sócio de verdade. Corrigido.
const SOCIOS = [
  "d0af8eaa-9f3c-4e7a-b8c6-613736524317", // João Lemos
  "75c6cac4-8d30-436e-b9a6-d5d494d7470b", // Hamilton Santos (conta admin real, suporte@)
  "d5f26efd-8ed5-4d90-b3f4-9ce0004803c5", // Robson Lino
];

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  if (!SOCIOS.includes(user.id))
    return NextResponse.json({ error: "Apenas sócios podem aprovar contratos (João, Hamilton, Robson)" }, { status: 403 });

  const { data: profile } = await svc().from("profiles").select("full_name").eq("id", user.id).single();

  const { contract_id, decision, comment } = await req.json();

  if (!contract_id || !decision)
    return NextResponse.json({ error: "contract_id e decision obrigatórios" }, { status: 422 });

  if (!["aprovado", "reprovado"].includes(decision))
    return NextResponse.json({ error: "decision deve ser 'aprovado' ou 'reprovado'" }, { status: 422 });

  const { data: existing } = await svc()
    .from("contract_approvals")
    .select("id")
    .eq("contract_id", contract_id)
    .eq("approver_id", user.id)
    .single();

  if (existing)
    return NextResponse.json({ error: "Você já votou neste contrato" }, { status: 409 });

  const { data: contract } = await svc()
    .from("operation_contracts")
    .select("id, contract_code, contract_title, status_signature, loi_matching_status, created_by")
    .eq("id", contract_id)
    .single();

  if (!contract)
    return NextResponse.json({ error: "Contrato não encontrado" }, { status: 404 });

  if (contract.status_signature === "assinado")
    return NextResponse.json({ error: "Contrato já assinado — não pode ser alterado" }, { status: 409 });

  // LOI Casada (BRIEF 2, 30/08/2026): contrato sem par de compra casado
  // exige unanimidade, não o 2/3 padrão. O gate real (bloqueio de fato)
  // acontece em /api/contracts/[id]/send; aqui só ajusta a mensagem pra
  // não informar "liberado" com 2/3 quando na prática falta 1 sócio ainda.
  const quorumNecessario = contract.loi_matching_status === "nao_casada" ? 3 : 2;

  const { data: approval, error } = await svc()
    .from("contract_approvals")
    .insert({
      contract_id,
      approver_id: user.id,
      approver_name: profile?.full_name ?? "Sócio",
      decision,
      comment: comment ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: allApprovals } = await svc()
    .from("contract_approvals")
    .select("approver_name, decision")
    .eq("contract_id", contract_id);

  const approvedCount = (allApprovals ?? []).filter((a: any) => a.decision === "aprovado").length;
  const quorumMet = approvedCount >= quorumNecessario;
  const contractLabel = contract.contract_code ?? contract.contract_title;
  const contractLink = `https://app.v3partners.com.br/juridico/contratos?contract_id=${contract_id}`;

  // Gap 4 do Fluxograma de Notificações (11/09/2026): antes disso nenhuma
  // notificação saía daqui, mesmo padrão de silêncio da revisão de minuta.
  if (decision === "reprovado") {
    if (contract.created_by && contract.created_by !== user.id) {
      await notifyUser({
        userId: contract.created_by,
        title: `Contrato reprovado: ${contractLabel}`,
        message: `${profile?.full_name ?? "Um sócio"} reprovou o contrato ${contractLabel}.${comment ? ` Motivo: ${comment}` : ""}`,
        type: "contrato_reprovado",
        actionUrl: contractLink,
      });
    }
  } else if (quorumMet) {
    if (contract.created_by && contract.created_by !== user.id) {
      await notifyUser({
        userId: contract.created_by,
        title: `Contrato aprovado: ${contractLabel}`,
        message: `O contrato ${contractLabel} atingiu quórum de aprovação (${approvedCount}/${quorumNecessario}). Já pode ser enviado para assinatura.`,
        type: "contrato_aprovado",
        actionUrl: contractLink,
      });
    }
  } else {
    // Ainda falta quórum: avisa os sócios que ainda não votaram (nunca
    // quem já votou) que um voto novo chegou.
    const jaVotaram = new Set((allApprovals ?? []).map((a: any) => a.approver_id));
    const pendentes = SOCIOS.filter((sid) => sid !== user.id && !jaVotaram.has(sid));
    await Promise.all(
      pendentes.map((uid) =>
        notifyUser({
          userId: uid,
          title: `Voto pendente: ${contractLabel}`,
          message: `${profile?.full_name ?? "Um sócio"} aprovou o contrato ${contractLabel}. Ainda falta seu voto (${approvedCount}/${quorumNecessario}).`,
          type: "contrato_voto_pendente",
          actionUrl: contractLink,
        })
      )
    );
    if (contract.created_by && contract.created_by !== user.id) {
      await notifyUser({
        userId: contract.created_by,
        title: `Voto registrado: ${contractLabel}`,
        message: `${profile?.full_name ?? "Um sócio"} aprovou o contrato ${contractLabel} (${approvedCount}/${quorumNecessario}). Ainda aguardando quórum.`,
        type: "contrato_voto_registrado",
        actionUrl: contractLink,
      });
    }
  }

  return NextResponse.json({
    approval,
    quorum: { approved: approvedCount, required: quorumNecessario, met: quorumMet },
    message: quorumMet
      ? quorumNecessario === 3
        ? "Unanimidade atingida (3/3 sócios). Carta de Intenção sem par casado liberada para assinatura."
        : "Quórum atingido (2/3 sócios). Contrato liberado para assinatura."
      : decision === "reprovado"
        ? "Contrato reprovado. Nova rodada de aprovação necessária após revisão."
        : `Aprovação registrada (${approvedCount}/${quorumNecessario}). Aguardando mais ${quorumNecessario - approvedCount} sócio(s)${quorumNecessario === 3 ? ", unanimidade exigida por ser LOI sem par casado" : ""}.`,
  }, { status: 201 });
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const contractId = new URL(req.url).searchParams.get("contract_id");
  if (!contractId) return NextResponse.json({ error: "contract_id obrigatório" }, { status: 422 });

  const { data, error } = await svc()
    .from("contract_approvals")
    .select("*")
    .eq("contract_id", contractId)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: contract } = await svc()
    .from("operation_contracts")
    .select("loi_matching_status")
    .eq("id", contractId)
    .single();
  const required = contract?.loi_matching_status === "nao_casada" ? 3 : 2;

  const approved = (data ?? []).filter((a: any) => a.decision === "aprovado").length;

  return NextResponse.json({
    approvals: data ?? [],
    quorum: { approved, required, met: approved >= required },
  });
}
