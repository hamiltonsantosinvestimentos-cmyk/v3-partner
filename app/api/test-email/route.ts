import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

// Endpoint de diagnóstico — apenas ADMIN pode chamar
// GET /api/test-email?to=email@teste.com
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const svc = sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: profile } = await svc.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "ADMIN") return NextResponse.json({ error: "Apenas ADMIN" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const to = searchParams.get("to") ?? user.email!;

  const resendKey = process.env.RESEND_API_KEY;

  const diagnostico = {
    RESEND_API_KEY: resendKey ? `✅ configurada (${resendKey.slice(0, 8)}...)` : "❌ NÃO CONFIGURADA",
    EMAIL_FROM: process.env.EMAIL_FROM ?? "(não definido — usará onboarding@resend.dev)",
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? "(não definido)",
    destinatario: to,
    resultado: null as unknown,
  };

  if (!resendKey) {
    return NextResponse.json({ diagnostico, erro: "RESEND_API_KEY não configurada no Vercel" });
  }

  // Tenta enviar e-mail de teste
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || "V3 Partners <onboarding@resend.dev>",
      to: [to],
      subject: "✅ Teste de e-mail — V3 Partners",
      html: `
        <div style="font-family:Arial;padding:32px;background:#09081A;color:#F0ECE4;">
          <h2 style="color:#C9A84C;">Teste de E-mail V3 Partners</h2>
          <p>Se você está vendo este e-mail, a integração com o Resend está funcionando corretamente.</p>
          <p style="color:#7A8FA8;font-size:12px;">Enviado em: ${new Date().toLocaleString("pt-BR")}</p>
        </div>
      `,
    }),
  });

  const body = await res.json();
  diagnostico.resultado = { status: res.status, ok: res.ok, body };

  return NextResponse.json({ diagnostico });
}
