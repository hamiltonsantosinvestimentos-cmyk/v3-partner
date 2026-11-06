// POST /api/webhooks/resend — eventos do Resend (enviado, entregue, aberto, atrasado, devolvido, spam).
// Público no proxy.ts: a segurança é a assinatura Svix conferida aqui, ANTES de qualquer gravação.
// Evento repetido (mesmo svix-id) é ignorado. Só atualiza e-mails dos encaminhamentos de proposta.
// BRIEF 2026-11-06_encaminhar-proposta-instituicao.
import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";
import { EVENTO_PARA_SITUACAO, proximaSituacao, type Situacao } from "@/lib/encaminhar-instituicao";
import { assinaturaSvixValida } from "@/lib/encaminhar-instituicao-webhook";
import { recalcularStatusEnvio } from "@/lib/encaminhar-instituicao-servidor";
import { notifyByRoles } from "@/lib/notify";

export const dynamic = "force-dynamic";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const CAMPO_DATA: Partial<Record<Situacao, string>> = { enviado: "enviado_em", entregue: "entregue_em", aberto: "aberto_em", devolvido: "devolvido_em", spam: "devolvido_em" };

export async function POST(req: NextRequest) {
  const corpo = await req.text();
  const ok = assinaturaSvixValida({
    segredo: process.env.RESEND_WEBHOOK_SECRET ?? "",
    id: req.headers.get("svix-id"),
    timestamp: req.headers.get("svix-timestamp"),
    assinatura: req.headers.get("svix-signature"),
    corpo,
  });
  if (!ok) return NextResponse.json({ error: "Assinatura inválida" }, { status: 401 });

  let ev: { type?: string; created_at?: string; data?: { email_id?: string; to?: string[]; bounce?: { message?: string; type?: string } } };
  try { ev = JSON.parse(corpo); } catch { return NextResponse.json({ error: "JSON inválido" }, { status: 400 }); }
  const tipo = ev.type ?? "";
  const resendId = ev.data?.email_id ?? null;
  const db = svc();

  const { error: dup } = await db.from("email_eventos").insert({
    svix_id: req.headers.get("svix-id"), resend_id: resendId, tipo,
    destinatario: ev.data?.to?.[0] ?? null, ocorrido_em: ev.created_at ?? null,
  });
  if (dup) {
    if ((dup as { code?: string }).code === "23505") return NextResponse.json({ ok: true, repetido: true });
    return NextResponse.json({ error: "Falha ao registrar o evento" }, { status: 500 });
  }

  const nova = EVENTO_PARA_SITUACAO[tipo];
  if (!nova || !resendId) return NextResponse.json({ ok: true, ignorado: true });

  const { data: dest } = await db.from("credit_proposal_envio_destinatarios")
    .select("id, envio_id, email, status, devolvido_em").eq("resend_id", resendId).maybeSingle();
  if (!dest) return NextResponse.json({ ok: true, ignorado: true }); // e-mail que não é de encaminhamento

  const atual = dest.status as Situacao;
  const proxima = proximaSituacao(atual, nova);
  const quando = ev.created_at ?? new Date().toISOString();
  const update: Record<string, unknown> = { atualizado_em: new Date().toISOString() };
  if (proxima !== atual) update.status = proxima;
  const campo = CAMPO_DATA[nova];
  if (campo) update[campo] = quando;
  if (nova === "devolvido" || nova === "spam") update.motivo = (ev.data?.bounce?.message ?? (nova === "spam" ? "Marcado como spam pelo destinatário" : "Devolvido")).slice(0, 300);
  await db.from("credit_proposal_envio_destinatarios").update(update).eq("id", dest.id);

  if ((nova === "devolvido" || nova === "spam") && atual !== nova) {
    await recalcularStatusEnvio(db, dest.envio_id as string);
    const { data: envio } = await db.from("credit_proposal_envios").select("instituicao_nome, credit_desk_proposals(code)").eq("id", dest.envio_id).maybeSingle();
    const code = (envio as { credit_desk_proposals?: { code?: string } | null } | null)?.credit_desk_proposals?.code ?? "";
    await notifyByRoles(["ADMIN", "GESTAO", "MESA_OPERACIONAL"], {
      type: "proposal",
      title: `E-mail da proposta ${code} voltou`,
      message: `O e-mail para ${dest.email} (${(envio as { instituicao_nome?: string } | null)?.instituicao_nome ?? "instituição"}) ${nova === "spam" ? "foi marcado como spam" : "foi devolvido"}: ${String(update.motivo)}. Corrija o e-mail e reenvie.`,
      action_url: "/mesa-operacional/envios",
    });
  }
  return NextResponse.json({ ok: true });
}
