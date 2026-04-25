import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { notifyContratoCompleto, notifyTestemunhaParaAssinar } from "@/lib/email";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://v3-partner.vercel.app";
const V3_REP_EMAIL = process.env.EMAIL_MESA_OPERACIONAL ?? process.env.EMAIL_ADMIN ?? "mesa@v3partners.com.br";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const { data, error } = await supabase
    .from("contratos_mandato")
    .select("id, status, client_name, client_cpf, client_email, commission_perc, deal_value, credit_line, proposal_code, signed_at, v3_signed_at, endereco, bairro, municipio, estado, cep, telefone")
    .eq("v3_token", token)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Contrato não encontrado" }, { status: 404 });
  }

  return NextResponse.json({ contrato: data });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const { nome_assinatura, cpf, birthdate, address } = await req.json();

  if (!nome_assinatura?.trim()) {
    return NextResponse.json({ error: "Nome para assinatura obrigatório" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("contratos_mandato")
    .select("id, status, client_name, client_email, credit_line, proposal_code, signed_at, testemunha_email, testemunha_nome, testemunha_token")
    .eq("v3_token", token)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Contrato não encontrado" }, { status: 404 });
  }

  if (data.status !== "AGUARDANDO_V3") {
    return NextResponse.json({ error: `Contrato está ${data.status.toLowerCase()}` }, { status: 409 });
  }

  const v3SignedAt = new Date().toISOString();
  const temTestemunha = !!(data.testemunha_email && data.testemunha_token);
  const novoStatus = temTestemunha ? "AGUARDANDO_TESTEMUNHA" : "ASSINADO";

  const ipRaw = req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "desconhecido";
  const v3Ip = ipRaw.split(",")[0].trim();

  const { error: updateErr } = await supabase
    .from("contratos_mandato")
    .update({
      status: novoStatus,
      v3_signed_at: v3SignedAt,
      v3_signer_name: nome_assinatura.trim(),
      v3_cpf: cpf ?? null,
      v3_birthdate: birthdate ?? null,
      v3_address: address ?? null,
      v3_ip_address: v3Ip,
    })
    .eq("v3_token", token);

  if (updateErr) {
    return NextResponse.json({ error: "Erro ao registrar assinatura" }, { status: 500 });
  }

  if (temTestemunha) {
    const testemunhaUrl = `${APP_URL}/assinar/testemunha/${data.testemunha_token}`;
    await notifyTestemunhaParaAssinar({
      testemunhaEmail: data.testemunha_email as string,
      testemunhaNome: (data.testemunha_nome as string) ?? "Parceiro",
      clientName: data.client_name,
      proposalCode: data.proposal_code ?? "",
      creditLine: data.credit_line ?? "",
      testemunhaUrl,
    });
  } else {
    await notifyContratoCompleto({
      clientEmail: data.client_email,
      clientName: data.client_name,
      repEmail: V3_REP_EMAIL,
      proposalCode: data.proposal_code ?? "",
      creditLine: data.credit_line ?? "",
      clientSignedAt: data.signed_at ?? v3SignedAt,
      v3SignedAt,
      v3SignerName: nome_assinatura.trim(),
    });
  }

  return NextResponse.json({ ok: true, v3_signed_at: v3SignedAt, status: novoStatus });
}
