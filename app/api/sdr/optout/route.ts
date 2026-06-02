import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.v3partners.com.br";

// GET — link de opt-out clicado no email → redireciona para página de confirmação
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.redirect(`${APP_URL}/optout?erro=token_invalido`);
  }

  // Busca contato pelo token
  const { data: contato } = await svc()
    .from("sdr_campanha_contatos")
    .select("email, nome")
    .eq("track_token", token)
    .single();

  if (!contato) {
    return NextResponse.redirect(`${APP_URL}/optout?erro=token_invalido`);
  }

  // Registra opt-out global
  await svc().from("sdr_optouts").upsert({
    email: contato.email.toLowerCase(),
    motivo: "link_email",
    created_at: new Date().toISOString(),
  }, { onConflict: "email" });

  // Marca contato como optout
  await svc()
    .from("sdr_campanha_contatos")
    .update({ status: "optout" })
    .eq("track_token", token);

  return NextResponse.redirect(`${APP_URL}/optout?descadastrado=1&email=${encodeURIComponent(contato.email)}`);
}

// POST — opt-out manual via API
export async function POST(req: NextRequest) {
  const { email, motivo } = await req.json() as { email: string; motivo?: string };
  if (!email) return NextResponse.json({ error: "email obrigatório" }, { status: 400 });

  await svc().from("sdr_optouts").upsert({
    email: email.toLowerCase().trim(),
    motivo: motivo ?? "manual",
    created_at: new Date().toISOString(),
  }, { onConflict: "email" });

  // Marca todos os contatos deste email como optout
  await svc().from("sdr_campanha_contatos").update({ status: "optout" }).eq("email", email.toLowerCase().trim());

  return NextResponse.json({ ok: true });
}
