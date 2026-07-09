import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { randomBytes } from "crypto";

function generateTempPassword(): string {
  return randomBytes(9).toString("base64").replace(/[+/=]/g, "").slice(0, 12);
}

/**
 * POST /api/cm/deal-intermediaries/quick-partner — cadastro rapido de Partner
 * a partir da tela de Cadeia de Intermediarios, quando o Mandatario desejado
 * ainda nao existe na plataforma. ADMIN-only, mesma restricao de /api/usuarios.
 * Nao reutiliza o arquivo de /api/usuarios diretamente para nao arriscar
 * regressao num modulo ja em producao — duplica so o essencial.
 */
export async function POST(req: NextRequest) {
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const supabase = await createServiceClient();
  const { data: caller } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (caller?.role !== "ADMIN")
    return NextResponse.json({ error: "Apenas administradores podem cadastrar novo Partner" }, { status: 403 });

  const { email, full_name, phone, document_cpf } = await req.json();
  if (!email || !full_name)
    return NextResponse.json({ error: "email e full_name são obrigatórios" }, { status: 422 });

  const tempPassword = generateTempPassword();

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { full_name },
  });

  if (authError) return NextResponse.json({ error: authError.message }, { status: 400 });

  const { data: newProfile, error: profileError } = await supabase
    .from("profiles")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update({ role: "PARTNER", phone: phone ?? null, full_name, document_cpf: document_cpf ?? null } as any)
    .eq("id", authData.user.id)
    .select("id, full_name, email, role")
    .single();

  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });

  if (process.env.RESEND_API_KEY) {
    try {
      const { Resend } = await import("resend");
      const resend = new Resend(process.env.RESEND_API_KEY);
      await resend.emails.send({
        from: "V3 Partners <noreply@v3partners.com.br>",
        to: email,
        subject: "Seus dados de acesso — V3 Partners",
        html: `<p>Olá ${full_name},</p>
               <p>Você foi cadastrado como Partner V3 para atuar como Mandatário em uma operação da Bolsa de Ativos.</p>
               <p><strong>Email:</strong> ${email}<br/><strong>Senha temporária:</strong> ${tempPassword}</p>
               <p>Acesse a plataforma e assine o Contrato de Parceria: https://app.v3partners.com.br/contrato-parceria</p>`,
      });
    } catch (err) {
      console.error("[quick-partner] falha ao enviar email de acesso:", err);
    }
  }

  return NextResponse.json({ partner: newProfile }, { status: 201 });
}
