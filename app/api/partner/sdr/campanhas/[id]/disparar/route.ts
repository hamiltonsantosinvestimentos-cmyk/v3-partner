import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { sendText, getSessionStatus } from "@/lib/whatsapp/openwa-client";

export const maxDuration = 300;

const PARTNER_ROLES = ["STARTER", "PARTNER", "PARTNER_PRO", "ENTERPRISE"] as const;

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

async function authGuard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!PARTNER_ROLES.includes(profile?.role as typeof PARTNER_ROLES[number])) return null;
  return { user };
}

function renderTemplate(template: string, nome: string | null): string {
  return template.replace(/\{\{\s*nome\s*\}\}/gi, nome?.trim() || "tudo bem");
}

// POST — envia a fila pendente da campanha, um a um, respeitando o intervalo
// configurado, pela sessão WhatsApp do próprio partner.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authGuard();
  if (!auth) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { id } = await params;

  const db = svc();

  const [{ data: campanha }, { data: conexao }] = await Promise.all([
    db.from("sdr_campanhas_whatsapp").select("*").eq("id", id).eq("partner_id", auth.user.id).single(),
    db.from("partner_sdr_connections").select("addon_ativo, openwa_session_id").eq("partner_id", auth.user.id).maybeSingle(),
  ]);

  if (!campanha) return NextResponse.json({ error: "Campanha não encontrada" }, { status: 404 });
  if (!conexao?.addon_ativo) return NextResponse.json({ error: "Add-on não contratado" }, { status: 403 });
  if (!conexao.openwa_session_id) return NextResponse.json({ error: "WhatsApp ainda não conectado" }, { status: 400 });
  if (campanha.status !== "pronta_para_envio") {
    return NextResponse.json({ error: "Campanha precisa estar com status 'pronta_para_envio' para disparar" }, { status: 400 });
  }

  const session = await getSessionStatus(conexao.openwa_session_id).catch(() => null);
  if (!session || session.status !== "ready") {
    return NextResponse.json({ error: "WhatsApp não está conectado (verifique Conectar WhatsApp)" }, { status: 409 });
  }

  const { data: pendentes } = await db
    .from("sdr_campanha_whatsapp_contatos")
    .select("id, phone, nome")
    .eq("campanha_id", id)
    .eq("status", "pendente")
    .order("created_at", { ascending: true });

  if (!pendentes || pendentes.length === 0) {
    return NextResponse.json({ ok: true, enviados: 0, erros: 0, restantes: 0, mensagem: "Nenhum contato pendente" });
  }

  const intervaloMs = Math.max(5, campanha.intervalo_segundos ?? 30) * 1000;
  let enviados = 0;
  let erros = 0;

  for (let i = 0; i < pendentes.length; i++) {
    const contato = pendentes[i];
    const mensagem = renderTemplate(campanha.mensagem_template, contato.nome);

    try {
      const ok = await sendText(contato.phone, mensagem, conexao.openwa_session_id);
      await db.from("sdr_campanha_whatsapp_contatos")
        .update({ status: ok ? "enviado" : "erro", erro_detalhe: ok ? null : "Falha no envio via WhatsApp" })
        .eq("id", contato.id);
      if (ok) enviados++; else erros++;
    } catch (e) {
      await db.from("sdr_campanha_whatsapp_contatos")
        .update({ status: "erro", erro_detalhe: String(e).slice(0, 500) })
        .eq("id", contato.id);
      erros++;
    }

    if (i < pendentes.length - 1) {
      await new Promise((r) => setTimeout(r, intervaloMs));
    }
  }

  const restantes = pendentes.length - enviados - erros;
  if (restantes === 0) {
    await db.from("sdr_campanhas_whatsapp").update({ status: "pausada" }).eq("id", id);
  }

  return NextResponse.json({ ok: true, enviados, erros, restantes });
}
