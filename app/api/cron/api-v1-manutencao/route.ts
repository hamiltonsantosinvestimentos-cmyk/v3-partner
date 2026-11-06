// GET /api/cron/api-v1-manutencao (diário): retenção de 12 meses do log de chamadas da API
// (Termo v2.1, 9.2), limpeza de códigos e bloqueios vencidos, e aviso por e-mail 30 dias antes
// de a chave vencer. /api/cron/ é público no proxy.ts e esta rota APAGA dados: o Bearer
// CRON_SECRET é validado aqui dentro, sempre.
import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";
import { enviarEmailHtml } from "@/lib/email";
import { emailHtml } from "@/lib/integracao-api";

export const maxDuration = 60;

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const db = svc();
  const agora = Date.now();

  const limite12m = new Date(agora);
  limite12m.setUTCMonth(limite12m.getUTCMonth() - 12);
  const { count: logs, error: e1 } = await db.from("partner_api_requests").delete({ count: "exact" }).lt("created_at", limite12m.toISOString());
  const { count: codigos } = await db.from("partner_api_codigos").delete({ count: "exact" }).lt("expira_em", new Date(agora - 86_400_000).toISOString());
  const { count: bloqueios } = await db.from("partner_api_bloqueios").delete({ count: "exact" }).lt("ate", new Date(agora - 7 * 86_400_000).toISOString());
  if (e1) console.error("[cron api-v1-manutencao] falha na retenção do log", e1.message);

  // Aviso de vencimento: uma vez por chave, 30 dias antes.
  const { data: vencendo } = await db.from("partner_api_keys")
    .select("id, partner_id, nome, prefixo, expira_em")
    .is("revogada_em", null).is("aviso_vencimento_em", null)
    .gt("expira_em", new Date(agora).toISOString())
    .lte("expira_em", new Date(agora + 30 * 86_400_000).toISOString());
  let avisos = 0;
  for (const k of (vencendo ?? []) as { id: string; partner_id: string; nome: string; prefixo: string; expira_em: string }[]) {
    const { data: u } = await db.auth.admin.getUserById(k.partner_id);
    const email = u?.user?.email;
    if (email) {
      try {
        await enviarEmailHtml(email, "Sua chave de API da V3 vence em breve", emailHtml("Chave de API perto de vencer", [
          `A chave <b>${k.nome}</b> (${k.prefixo}…) vence em ${new Date(k.expira_em).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}.`,
          "Crie a chave nova em app.v3partners.com.br/integracao-api, troque no seu sistema e depois revogue a antiga.",
        ]));
        avisos++;
      } catch { continue; }
    }
    await db.from("partner_api_keys").update({ aviso_vencimento_em: new Date().toISOString() }).eq("id", k.id);
  }

  return NextResponse.json({ ok: !e1, log_apagado: logs ?? 0, codigos_apagados: codigos ?? 0, bloqueios_apagados: bloqueios ?? 0, avisos_vencimento: avisos });
}
