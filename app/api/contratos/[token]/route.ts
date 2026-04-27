import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { notifyContratoAssinado, notifyV3ParaAssinar } from "@/lib/email";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "https://v3-partner.vercel.app").trim().replace(/\/+$/, "");
// Email do representante V3 que assina o contrato (João Lemos)
const V3_REP_EMAIL = process.env.EMAIL_V3_SIGNER ?? "joao.lemos@v3partners.com.br";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const { data, error } = await supabase
    .from("contratos_mandato")
    .select("id, status, client_name, client_cpf, client_email, commission_perc, deal_value, credit_line, proposal_code, expires_at, signed_at, telefone, endereco_cadastrado, bairro_cadastrado, municipio_cadastrado, estado_cadastrado, cep_cadastrado")
    .eq("token", token)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Contrato não encontrado" }, { status: 404 });
  }

  if (data.status === "PENDENTE" && new Date(data.expires_at) < new Date()) {
    await supabase.from("contratos_mandato").update({ status: "EXPIRADO" }).eq("token", token);
    return NextResponse.json({ error: "Link expirado" }, { status: 410 });
  }

  return NextResponse.json({ contrato: data });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const body = await req.json();
  const { endereco, bairro, municipio, estado, cep, nome_assinatura, birthdate, doc_image,
          nome_socio, cpf_socio, qualificacao_socio, nome_fantasia } = body;

  if (!nome_assinatura?.trim()) {
    return NextResponse.json({ error: "Nome para assinatura obrigatório" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("contratos_mandato")
    .select("id, status, client_name, client_email, credit_line, proposal_code, expires_at, v3_token, v3_signed_at, testemunha_email, testemunha_signed_at, testemunha2_email, testemunha2_signed_at")
    .eq("token", token)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Contrato não encontrado" }, { status: 404 });
  }

  if (data.status !== "PENDENTE") {
    return NextResponse.json({ error: `Contrato já está ${data.status.toLowerCase()}` }, { status: 409 });
  }

  if (new Date(data.expires_at) < new Date()) {
    await supabase.from("contratos_mandato").update({ status: "EXPIRADO" }).eq("token", token);
    return NextResponse.json({ error: "Link expirado" }, { status: 410 });
  }

  const ipRaw = req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "desconhecido";
  const ip = ipRaw.split(",")[0].trim();
  const signedAt = new Date().toISOString();

  // Upload da foto do documento (opcional)
  let clientDocUrl: string | null = null;
  if (doc_image && typeof doc_image === "string" && doc_image.startsWith("data:image")) {
    try {
      const base64Data = doc_image.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");
      const docPath = `documentos/${token}/doc.jpg`;
      const { error: docErr } = await supabase.storage
        .from("contratos")
        .upload(docPath, buffer, { contentType: "image/jpeg", upsert: true });
      if (!docErr) {
        const { data: docSigned } = await supabase.storage
          .from("contratos")
          .createSignedUrl(docPath, 60 * 60 * 24 * 365);
        clientDocUrl = docSigned?.signedUrl ?? null;
      }
    } catch {
      // foto é opcional — não bloqueia a assinatura
    }
  }

  // Recalcula status com base em quem já assinou (paralelo)
  const v3Signed = !!data.v3_signed_at;
  const t1Signed = !data.testemunha_email || !!data.testemunha_signed_at;
  const t2Signed = !data.testemunha2_email || !!data.testemunha2_signed_at;
  let novoStatus: string;
  if (v3Signed && t1Signed && t2Signed) novoStatus = "ASSINADO";
  else if (v3Signed && t1Signed)         novoStatus = "AGUARDANDO_TESTEMUNHA2";
  else if (v3Signed)                     novoStatus = "AGUARDANDO_TESTEMUNHA";
  else                                   novoStatus = "AGUARDANDO_V3";

  const { error: updateErr } = await supabase
    .from("contratos_mandato")
    .update({
      status: novoStatus,
      signed_at: signedAt,
      ip_address: ip,
      endereco: endereco ?? null,
      bairro: bairro ?? null,
      municipio: municipio ?? null,
      estado: estado ?? null,
      cep: cep ?? null,
      client_birthdate: birthdate ?? null,
      client_doc_url: clientDocUrl,
      nome_socio: nome_socio ?? null,
      cpf_socio: cpf_socio ?? null,
      qualificacao_socio: qualificacao_socio ?? null,
      nome_fantasia: nome_fantasia ?? null,
    })
    .eq("token", token);

  if (updateErr) {
    console.error("updateErr:", JSON.stringify(updateErr));
    return NextResponse.json({ error: "Erro ao registrar assinatura", detail: updateErr.message, hint: updateErr.hint ?? null }, { status: 500 });
  }

  const v3SigningUrl = `${APP_URL}/assinar/v3/${data.v3_token}`;

  await Promise.allSettled([
    notifyContratoAssinado({
      clientEmail: data.client_email,
      clientName: data.client_name,
      proposalCode: data.proposal_code ?? "",
      creditLine: data.credit_line ?? "",
      signedAt,
    }),
    notifyV3ParaAssinar({
      repEmail: V3_REP_EMAIL,
      clientName: data.client_name,
      clientEmail: data.client_email,
      proposalCode: data.proposal_code ?? "",
      creditLine: data.credit_line ?? "",
      signedAt,
      v3SigningUrl,
    }),
  ]);

  return NextResponse.json({ ok: true, signed_at: signedAt });
}
