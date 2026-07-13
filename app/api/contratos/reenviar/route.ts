import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  notifyContratoCliente,
  notifyV3ParaAssinar,
  notifyTestemunhaParaAssinar,
  notifyTestemunha2ParaAssinar,
} from "@/lib/email";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.v3partners.com.br";

export async function POST(req: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const body = await req.json();
  const { proposal_id, contrato_id } = body;
  if (!proposal_id && !contrato_id) {
    return NextResponse.json({ error: "proposal_id ou contrato_id obrigatório" }, { status: 400 });
  }

  let query = supabase
    .from("contratos_mandato")
    .select("id, token, status, expires_at, client_name, client_email, credit_line, proposal_code, signed_at, v3_signed_at, v3_signer_name, v3_email, v3_token, testemunha_nome, testemunha_email, testemunha_token, testemunha2_nome, testemunha2_email, testemunha2_token, deal_value")
    .not("status", "in", '("ASSINADO","CANCELADO","EXPIRADO")');

  if (contrato_id) {
    query = query.eq("id", contrato_id);
  } else {
    query = query.eq("proposal_id", proposal_id).order("created_at", { ascending: false }).limit(1);
  }

  const { data, error } = await query.maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: "Nenhum contrato pendente encontrado" }, { status: 404 });
  }

  // Proroga expiração por mais 7 dias ao reenviar
  const novaExpiracao = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  await supabase
    .from("contratos_mandato")
    .update({ expires_at: novaExpiracao })
    .eq("id", data.id);

  switch (data.status) {
    case "PENDENTE": {
      const signingUrl = `${APP_URL}/assinar/${data.token}`;
      await notifyContratoCliente({
        clientEmail: data.client_email,
        clientName: data.client_name,
        proposalCode: data.proposal_code ?? "",
        creditLine: data.credit_line ?? "",
        requestedValue: data.deal_value ?? 0,
        signingUrl,
        expiresAt: novaExpiracao,
      });
      return NextResponse.json({ ok: true, reenviado_para: data.client_email });
    }

    case "AGUARDANDO_V3": {
      const v3Url = `${APP_URL}/assinar/v3/${data.v3_token}`;
      await notifyV3ParaAssinar({
        repEmail: data.v3_email ?? (process.env.EMAIL_V3_SIGNER ?? "joao.lemos@v3partners.com.br"),
        clientName: data.client_name,
        clientEmail: data.client_email,
        proposalCode: data.proposal_code ?? "",
        creditLine: data.credit_line ?? "",
        signedAt: data.signed_at ?? new Date().toISOString(),
        v3SigningUrl: v3Url,
      });
      return NextResponse.json({ ok: true, reenviado_para: data.v3_email });
    }

    case "AGUARDANDO_TESTEMUNHA": {
      const testemunhaUrl = `${APP_URL}/assinar/testemunha/${data.testemunha_token}`;
      await notifyTestemunhaParaAssinar({
        testemunhaEmail: data.testemunha_email as string,
        testemunhaNome: (data.testemunha_nome as string) ?? "Parceiro",
        clientName: data.client_name,
        proposalCode: data.proposal_code ?? "",
        creditLine: data.credit_line ?? "",
        testemunhaUrl,
      });
      return NextResponse.json({ ok: true, reenviado_para: data.testemunha_email });
    }

    case "AGUARDANDO_TESTEMUNHA2": {
      const t2Url = `${APP_URL}/assinar/testemunha2/${data.testemunha2_token}`;
      await notifyTestemunha2ParaAssinar({
        testemunhaEmail: data.testemunha2_email as string,
        testemunhaNome: (data.testemunha2_nome as string) ?? "Aline Rodrigues dos Santos",
        clientName: data.client_name,
        proposalCode: data.proposal_code ?? "",
        creditLine: data.credit_line ?? "",
        testemunhaUrl: t2Url,
      });
      return NextResponse.json({ ok: true, reenviado_para: data.testemunha2_email });
    }

    default:
      return NextResponse.json({ error: "Status não permite reenvio" }, { status: 409 });
  }
}
