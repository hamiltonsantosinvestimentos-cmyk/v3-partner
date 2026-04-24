import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return NextResponse.json({ error: "RESEND_API_KEY não configurada" }, { status: 500 });

  const { to } = await req.json() as { to: string };

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "V3 Partners <onboarding@resend.dev>",
      to: [to],
      subject: "Teste de E-mail — V3 Partners",
      html: "<p>Este é um e-mail de teste da plataforma V3 Partners.</p>",
    }),
  });

  const data = await res.json();
  return NextResponse.json({ status: res.status, resend_response: data });
}
