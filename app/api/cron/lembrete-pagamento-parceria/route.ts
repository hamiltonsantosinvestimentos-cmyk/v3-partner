import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";
import { sendText } from "@/lib/whatsapp/openwa-client";
import { isContratoParceriaTemplateName } from "@/lib/contrato-parceria-partner";
import {
  LEMBRETE_PAGAMENTO_NOTA, LEMBRETE_PAGAMENTO_WHATSAPP, dataPagamentoDoContrato, hojeBrasilia,
  lembreteDevido, mensagemLembrete, planoDoContrato, dataBRdeIso,
} from "@/lib/lembrete-pagamento-parceria";

// GET /api/cron/lembrete-pagamento-parceria — cron diário (vercel.json, 12h UTC
// = 9h de Brasília). Para cada Contrato de Parceria com "Data prevista de
// pagamento" chegando (até 2 dias antes), avisa no WhatsApp da V3
// (lib/lembrete-pagamento-parceria.ts). Pula contrato cancelado/excluído e
// cadastro com a cobrança Cora já paga.

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

type Parte = { role?: string; name?: string | null; email?: string | null; display_label?: string | null };

export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const db = svc();

  const { data: templates } = await db.from("contract_templates").select("id, template_name").eq("contract_series", "V3C-PAR");
  const templateIds = (templates ?? []).filter((t) => isContratoParceriaTemplateName(t.template_name)).map((t) => t.id);
  if (templateIds.length === 0) return NextResponse.json({ ok: true, enviados: 0 });

  const { data: contratos, error } = await db
    .from("operation_contracts")
    .select("id, contract_code, status_signature, rendered_html, parties, created_by")
    .in("template_id", templateIds)
    .is("deleted_at", null)
    .neq("status_signature", "cancelado");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const hoje = hojeBrasilia();
  const enviados: string[] = [];
  for (const c of contratos ?? []) {
    const dataPagamento = dataPagamentoDoContrato(c.rendered_html as string | null);
    if (!dataPagamento || !lembreteDevido(dataPagamento, hoje)) continue;

    const { data: notas } = await db
      .from("contract_notes")
      .select("id")
      .eq("contract_id", c.id)
      .like("content", `${LEMBRETE_PAGAMENTO_NOTA}%`)
      .limit(1);
    if (notas && notas.length > 0) continue;

    const licenciado = ((c.parties as Parte[] | null) ?? []).find((p) => p.role === "cedente");
    const email = licenciado?.email ?? null;
    const { data: reg } = email
      ? await db.from("partner_registrations").select("telefone, cora_invoice_status").eq("email", email).order("created_at", { ascending: false }).limit(1).maybeSingle()
      : { data: null };
    if (reg?.cora_invoice_status === "PAID") continue;

    // Nota antes do envio: duas execuções sobrepostas não mandam em dobro.
    const { error: notaErro } = await db.from("contract_notes").insert({
      contract_id: c.id,
      author_id: c.created_by,
      author_name: "Sistema",
      note_type: "sistema",
      content: `${LEMBRETE_PAGAMENTO_NOTA} no WhatsApp ${LEMBRETE_PAGAMENTO_WHATSAPP} (pagamento previsto para ${dataBRdeIso(dataPagamento)}).`,
    });
    if (notaErro) {
      console.error("[lembrete-pagamento-parceria] nota:", notaErro.message);
      continue;
    }

    const nome = licenciado?.display_label?.replace(/^Licenciado,\s*/i, "") || licenciado?.name || "Partner";
    const msg = mensagemLembrete({
      nome,
      dataPagamento,
      hoje,
      plano: planoDoContrato(c.rendered_html as string | null),
      contractCode: c.contract_code as string | null,
      statusContrato: c.status_signature as string,
      telefone: reg?.telefone ?? null,
      email,
    });
    await sendText(LEMBRETE_PAGAMENTO_WHATSAPP, msg).catch(() => false);
    enviados.push(c.contract_code as string);
  }

  return NextResponse.json({ ok: true, hoje, enviados });
}
