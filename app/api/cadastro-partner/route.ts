import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";
import { coraFetch } from "@/lib/cora";
import { randomUUID } from "crypto";

const PLANO_VALOR: Record<string, number> = {
  STARTER:     29700,   // R$ 297,00 em centavos
  PARTNER:     49700,   // R$ 497,00 em centavos
  PARTNER_PRO: 89700,   // R$ 897,00 em centavos
  ENTERPRISE:  250000,  // R$ 2.500,00 em centavos
};

async function gerarCobrancaCora(params: {
  regId: string;
  plano: string;
  nome: string;
  documento: string;
  email: string;
}): Promise<{
  invoiceId?: string;
  pixEmv?: string;
  pixQrCode?: string;
  boletoPdf?: string;
  boletoBarcode?: string;
  paymentUrl?: string;
}> {
  try {
    const valor = PLANO_VALOR[params.plano] ?? 29700;
    const vencimento = new Date();
    vencimento.setDate(vencimento.getDate() + 3); // 3 dias para pagar
    const vencStr = vencimento.toISOString().split("T")[0];

    const payload = {
      code: params.regId.slice(0, 8).toUpperCase(),
      customer: {
        name: params.nome,
        document: {
          identity: params.documento.replace(/\D/g, ""),
          type: params.documento.replace(/\D/g, "").length === 11 ? "CPF" : "CNPJ",
        },
        contacts: params.email ? [{ contact: params.email, type: "EMAIL" }] : [],
      },
      payment_terms: { due_date: vencStr, amount: valor },
      payment_options: {
        interest: { type: "MONTHLY_PERCENTAGE", value: 1 },
        fine: { type: "PERCENTAGE", value: 2 },
      },
      payment_forms: ["BANK_SLIP", "PIX"],
      services: [{ name: `V3 Partners — Adesão ${
        params.plano === "ENTERPRISE" ? "Enterprise"
        : params.plano === "PARTNER_PRO" ? "Partner PRO"
        : params.plano === "STARTER" ? "Starter"
        : "Partner"
      }`, amount: valor }],
      notifications: {
        formats: ["EMAIL"],
        by_email: { should_notify: true },
      },
    };

    const res = await coraFetch("/v2/invoices", {
      method: "POST",
      body: JSON.stringify(payload),
      idempotencyKey: randomUUID(),
    });

    if (!res.ok) return {};
    const data = await res.json() as {
      id?: string;
      pix?: { emv?: string; qr_code?: string };
      payment_options?: { bank_slip?: { digitable?: string; url?: string } };
      payment_url?: string;
    };

    return {
      invoiceId: data.id,
      pixEmv: data.pix?.emv,
      pixQrCode: data.pix?.qr_code,
      boletoPdf: data.payment_options?.bank_slip?.url,
      boletoBarcode: data.payment_options?.bank_slip?.digitable,
      paymentUrl: data.payment_url,
    };
  } catch (e) {
    console.error("Erro ao gerar cobrança Cora:", e);
    return {};
  }
}

function serviceClient() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const plano       = formData.get("plano") as string;
    const tipoPessoa  = formData.get("tipo_pessoa") as string;
    const email       = formData.get("email") as string;
    const telefone    = formData.get("telefone") as string;

    // Validações básicas
    if (!plano || !tipoPessoa || !email || !telefone) {
      return NextResponse.json({ error: "Campos obrigatórios faltando" }, { status: 400 });
    }
    if (!["STARTER", "PARTNER", "PARTNER_PRO", "ENTERPRISE"].includes(plano)) {
      return NextResponse.json({ error: "Plano inválido" }, { status: 400 });
    }
    if (!["PF", "PJ"].includes(tipoPessoa)) {
      return NextResponse.json({ error: "Tipo de pessoa inválido" }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "E-mail inválido" }, { status: 400 });
    }

    const svc = serviceClient();

    // Garante que o bucket existe
    await svc.storage.createBucket("partner-docs", { public: false }).catch(() => {});

    // Upload de documentos para Supabase Storage
    async function uploadFiles(files: File[], folder: string): Promise<string[]> {
      const paths: string[] = [];
      for (const file of files) {
        const ext = file.name.split(".").pop() ?? "bin";
        const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const buffer = await file.arrayBuffer();
        const { error } = await svc.storage
          .from("partner-docs")
          .upload(path, buffer, { contentType: file.type, upsert: false });
        if (!error) paths.push(path);
      }
      return paths;
    }

    // Coletar arquivos
    const filesIdentidade = formData.getAll("doc_identidade") as File[];
    const filesCnpj       = formData.getAll("doc_cnpj") as File[];
    const filesSocio      = formData.getAll("doc_socio") as File[];

    const regId = crypto.randomUUID();
    const docIdentidade = filesIdentidade.length > 0 ? await uploadFiles(filesIdentidade, `${regId}/identidade`) : [];
    const docCnpj       = filesCnpj.length > 0       ? await uploadFiles(filesCnpj, `${regId}/cnpj`)       : [];
    const docSocio      = filesSocio.length > 0      ? await uploadFiles(filesSocio, `${regId}/socio`)      : [];

    // IP do solicitante
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? req.headers.get("x-real-ip") ?? null;

    const referredByPartnerId = formData.get("referred_by_partner_id") as string | null;

    // Montar payload
    const payload: Record<string, unknown> = {
      id:          regId,
      plano,
      tipo_pessoa: tipoPessoa,
      email,
      telefone,
      // Endereço
      cep:         formData.get("cep"),
      logradouro:  formData.get("logradouro"),
      numero:      formData.get("numero"),
      complemento: formData.get("complemento"),
      bairro:      formData.get("bairro"),
      cidade:      formData.get("cidade"),
      estado:      formData.get("estado"),
      // Documentos
      doc_identidade: docIdentidade,
      doc_cnpj:       docCnpj,
      doc_socio:      docSocio,
      // Controle
      status:    "PENDENTE",
      ip_origem: ip,
      // Referral
      ...(referredByPartnerId ? { referred_by_partner_id: referredByPartnerId } : {}),
    };

    if (tipoPessoa === "PF") {
      payload.nome_completo   = formData.get("nome_completo");
      payload.cpf             = formData.get("cpf");
      payload.data_nascimento = formData.get("data_nascimento");
    } else {
      payload.razao_social  = formData.get("razao_social");
      payload.nome_fantasia = formData.get("nome_fantasia");
      payload.cnpj          = formData.get("cnpj");
      // sócios PJ
      payload.nome_completo = formData.get("nome_socio");
      payload.cpf           = formData.get("cpf_socio");
    }

    const { error } = await svc.from("partner_registrations").insert(payload);

    if (error) {
      console.error("Erro ao salvar cadastro:", error.message);
      return NextResponse.json({ error: "Erro ao salvar cadastro" }, { status: 500 });
    }

    // Gera cobrança Cora automaticamente
    const nome = tipoPessoa === "PF"
      ? (formData.get("nome_completo") as string ?? "")
      : (formData.get("razao_social") as string ?? "");
    const documento = tipoPessoa === "PF"
      ? (formData.get("cpf") as string ?? "")
      : (formData.get("cnpj") as string ?? "");

    const cora = await gerarCobrancaCora({ regId, plano, nome, documento, email });

    if (cora.invoiceId) {
      await svc.from("partner_registrations").update({
        cora_invoice_id:     cora.invoiceId,
        cora_invoice_status: "PENDING",
        cora_pix_emv:        cora.pixEmv,
        cora_pix_qr_code:    cora.pixQrCode,
        cora_boleto_pdf:     cora.boletoPdf,
        cora_boleto_barcode: cora.boletoBarcode,
        cora_payment_url:    cora.paymentUrl,
        cora_amount_cents:   PLANO_VALOR[plano] ?? 29700,
      }).eq("id", regId);
    }

    // Envia e-mail com dados de pagamento (#6)
    try {
      const { Resend } = await import("resend");
      const resend = new Resend(process.env.RESEND_API_KEY);
      const valorFmt = ((PLANO_VALOR[plano] ?? 29700) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
      const planoLabel = plano === "ENTERPRISE" ? "V3 Enterprise"
        : plano === "PARTNER_PRO" ? "V3 Partner PRO"
        : plano === "STARTER" ? "V3 Starter"
        : "V3 Partner";
      const vencimento = new Date(Date.now() + 3 * 86400000).toLocaleDateString("pt-BR");

      await resend.emails.send({
        from: "V3 Partners <noreply@v3partners.com.br>",
        to: email,
        subject: `Bem-vindo à V3 Partners — Conclua seu pagamento de ${valorFmt}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #09081A; color: #F0ECE4; padding: 32px; border-radius: 16px;">
            <img src="https://app.v3partners.com.br/logo.jpg" alt="V3 Partners" style="height: 40px; margin-bottom: 24px;" />
            <h1 style="color: #C9A84C; font-size: 24px; margin-bottom: 8px;">Cadastro Recebido!</h1>
            <p style="color: #7A8FA8; margin-bottom: 24px;">Olá <strong style="color:#F0ECE4">${nome}</strong>, seu cadastro no plano <strong style="color:#C9A84C">${planoLabel}</strong> foi recebido com sucesso.</p>

            <div style="background: #111F35; border: 1px solid #243A66; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
              <p style="margin: 0 0 8px; color: #7A8FA8; font-size: 12px;">VALOR DA ADESÃO</p>
              <p style="margin: 0 0 16px; color: #C9A84C; font-size: 28px; font-weight: bold;">${valorFmt}</p>
              <p style="margin: 0; color: #7A8FA8; font-size: 12px;">Vencimento: <strong style="color:#F0ECE4">${vencimento}</strong></p>
            </div>

            ${cora.pixEmv ? `
            <div style="background: #111F35; border: 1px solid #243A66; border-radius: 12px; padding: 20px; margin-bottom: 16px;">
              <p style="margin: 0 0 8px; color: #10b981; font-size: 13px; font-weight: bold;">✓ Pague via Pix (aprovação instantânea)</p>
              <p style="margin: 0 0 8px; color: #7A8FA8; font-size: 11px;">Pix Copia e Cola:</p>
              <p style="margin: 0; background: #0A1628; padding: 12px; border-radius: 8px; font-family: monospace; font-size: 11px; color: #7A8FA8; word-break: break-all;">${cora.pixEmv}</p>
            </div>` : ""}

            ${cora.boletoPdf ? `
            <div style="margin-bottom: 16px;">
              <a href="${cora.boletoPdf}" style="display: inline-block; padding: 12px 24px; background: #243A66; color: #F0ECE4; text-decoration: none; border-radius: 8px; font-size: 13px;">Ver Boleto Bancário</a>
            </div>` : ""}

            ${cora.paymentUrl ? `
            <div style="margin-bottom: 16px;">
              <a href="${cora.paymentUrl}" style="display: inline-block; padding: 12px 24px; background: #C9A84C; color: #09081A; text-decoration: none; border-radius: 8px; font-size: 13px; font-weight: bold;">Ir para Pagamento</a>
            </div>` : ""}

            <hr style="border: none; border-top: 1px solid #243A66; margin: 24px 0;" />
            <p style="color: #7A8FA8; font-size: 11px; margin: 0;">Dúvidas? Responda este e-mail ou entre em contato: contato@v3partners.com.br</p>
            <p style="color: #3A5070; font-size: 10px; margin: 8px 0 0;">V3 Partners Soluções Ltda · CNPJ 14.219.287/0001-50</p>
          </div>
        `,
      });
    } catch (emailErr) {
      console.error("Erro ao enviar e-mail de cadastro:", emailErr);
      // Não bloqueia o retorno — e-mail é secundário
    }

    return NextResponse.json({
      ok: true,
      id: regId,
      cobranca: {
        invoiceId:    cora.invoiceId,
        pixEmv:       cora.pixEmv,
        pixQrCode:    cora.pixQrCode,
        boletoPdf:    cora.boletoPdf,
        boletoBarcode: cora.boletoBarcode,
        paymentUrl:   cora.paymentUrl,
        valor:        PLANO_VALOR[plano] ?? 29700,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// GET — listagem para admin
export async function GET(req: NextRequest) {
  // Verifica autenticação via cookie/header (chamado do painel admin)
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (!["ADMIN"].includes(profile?.role ?? "")) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: "Erro de autenticação" }, { status: 401 });
  }

  const svc = serviceClient();
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? "PENDENTE";

  const { data, error } = await svc
    .from("partner_registrations")
    .select("*")
    .eq("status", status)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ registrations: data ?? [] });
}

// PATCH — aprovar/reprovar
export async function PATCH(req: NextRequest) {
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (!["ADMIN"].includes(profile?.role ?? "")) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: "Erro de autenticação" }, { status: 401 });
  }

  const { id, status, observacao } = await req.json();
  if (!id || !status) return NextResponse.json({ error: "Payload inválido" }, { status: 400 });

  const svc = serviceClient();
  const { error } = await svc
    .from("partner_registrations")
    .update({ status, observacao, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
