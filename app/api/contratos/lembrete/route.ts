import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  notifyContratoCliente,
  notifyV3ParaAssinar,
  notifyTestemunhaParaAssinar,
  notifyTestemunha2ParaAssinar,
} from "@/lib/email";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://v3-partner.vercel.app";

export async function GET(req: NextRequest) {
  // Proteção por secret para chamadas externas (cron do Vercel passa Authorization)
  const authHeader = req.headers.get("authorization");
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const agora = new Date();
  const doisDiasAtras = new Date(agora.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString();

  // Busca todos os contratos pendentes
  const { data: contratos } = await supabase
    .from("contratos_mandato")
    .select("id, status, expires_at, token, v3_token, testemunha_token, testemunha2_token, client_name, client_email, credit_line, proposal_code, deal_value, signed_at, v3_signed_at, v3_email, testemunha_nome, testemunha_email, testemunha2_nome, testemunha2_email, created_at, testemunha_signed_at")
    .in("status", ["PENDENTE", "AGUARDANDO_V3", "AGUARDANDO_TESTEMUNHA", "AGUARDANDO_TESTEMUNHA2"]);

  if (!contratos?.length) {
    return NextResponse.json({ ok: true, expirados: 0, lembretes: 0 });
  }

  let expirados = 0;
  let lembretes = 0;

  for (const c of contratos) {
    const expiresAt = new Date(c.expires_at);

    // ── Marcar como EXPIRADO ─────────────────────────────────────────────────
    if (expiresAt < agora) {
      await supabase
        .from("contratos_mandato")
        .update({ status: "EXPIRADO" })
        .eq("id", c.id);
      expirados++;
      continue;
    }

    // ── Lembrete após 2 dias sem ação ────────────────────────────────────────
    switch (c.status) {
      case "PENDENTE": {
        if (c.created_at > doisDiasAtras) break; // criado há menos de 2 dias, aguarda
        const signingUrl = `${APP_URL}/assinar/${c.token}`;
        await notifyContratoCliente({
          clientEmail: c.client_email,
          clientName: c.client_name,
          proposalCode: c.proposal_code ?? "",
          creditLine: c.credit_line ?? "",
          requestedValue: c.deal_value ?? 0,
          signingUrl,
          expiresAt: c.expires_at,
        });
        lembretes++;
        break;
      }

      case "AGUARDANDO_V3": {
        if (!c.signed_at || c.signed_at > doisDiasAtras) break;
        const v3Url = `${APP_URL}/assinar/v3/${c.v3_token}`;
        await notifyV3ParaAssinar({
          repEmail: c.v3_email ?? (process.env.EMAIL_V3_SIGNER ?? "joao.lemos@v3partners.com.br"),
          clientName: c.client_name,
          clientEmail: c.client_email,
          proposalCode: c.proposal_code ?? "",
          creditLine: c.credit_line ?? "",
          signedAt: c.signed_at,
          v3SigningUrl: v3Url,
        });
        lembretes++;
        break;
      }

      case "AGUARDANDO_TESTEMUNHA": {
        if (!c.v3_signed_at || c.v3_signed_at > doisDiasAtras) break;
        const testemunhaUrl = `${APP_URL}/assinar/testemunha/${c.testemunha_token}`;
        await notifyTestemunhaParaAssinar({
          testemunhaEmail: c.testemunha_email as string,
          testemunhaNome: (c.testemunha_nome as string) ?? "Parceiro",
          clientName: c.client_name,
          proposalCode: c.proposal_code ?? "",
          creditLine: c.credit_line ?? "",
          testemunhaUrl,
        });
        lembretes++;
        break;
      }

      case "AGUARDANDO_TESTEMUNHA2": {
        if (!c.testemunha_signed_at || c.testemunha_signed_at > doisDiasAtras) break;
        const t2Url = `${APP_URL}/assinar/testemunha2/${c.testemunha2_token}`;
        await notifyTestemunha2ParaAssinar({
          testemunhaEmail: c.testemunha2_email as string,
          testemunhaNome: (c.testemunha2_nome as string) ?? "Aline Rodrigues dos Santos",
          clientName: c.client_name,
          proposalCode: c.proposal_code ?? "",
          creditLine: c.credit_line ?? "",
          testemunhaUrl: t2Url,
        });
        lembretes++;
        break;
      }
    }
  }

  return NextResponse.json({ ok: true, expirados, lembretes });
}
