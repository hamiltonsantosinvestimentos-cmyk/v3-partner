import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { sendText } from "@/lib/whatsapp/openwa-client";
import { getSessionStatus } from "@/lib/whatsapp/openwa-client";

// Vercel Pro permite até 300s em funções Node — um disparo grande pode ser
// interrompido no meio; como cada contato só é reprocessado se ainda estiver
// "pendente", clicar em Disparar de novo retoma sem duplicar envios.
export const maxDuration = 300;

const ADMIN_ROLES = ["ADMIN", "GESTAO"] as const;

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

async function authGuard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("id, role").eq("id", user.id).single();
  if (!ADMIN_ROLES.includes(profile?.role as typeof ADMIN_ROLES[number])) return null;
  return { user, profile };
}

function renderTemplate(template: string, nome: string | null): string {
  return template.replaceAll("{{nome}}", nome?.trim() || "tudo bem");
}

// POST /api/sdr/campanhas-whatsapp/[id]/disparar — envia a fila pendente, um a um, respeitando o intervalo
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authGuard();
  if (!auth) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { id } = await params;

  const db = svc();

  const { data: campanha } = await db
    .from("sdr_campanhas_whatsapp")
    .select("*")
    .eq("id", id)
    .single();

  if (!campanha) return NextResponse.json({ error: "Campanha não encontrada" }, { status: 404 });
  if (campanha.status !== "pronta_para_envio") {
    return NextResponse.json({ error: "Campanha precisa estar com status 'pronta_para_envio' para disparar" }, { status: 400 });
  }

  const session = await getSessionStatus().catch(() => null);
  if (!session || session.status !== "ready") {
    return NextResponse.json({ error: "WhatsApp não está conectado (verifique a aba Conversas)" }, { status: 409 });
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
      const ok = await sendText(contato.phone, mensagem);
      await db.from("sdr_campanha_whatsapp_contatos")
        .update({ status: ok ? "enviado" : "erro", erro_detalhe: ok ? null : "Falha no envio via OpenWA" })
        .eq("id", contato.id);
      if (ok) enviados++; else erros++;
    } catch (e) {
      await db.from("sdr_campanha_whatsapp_contatos")
        .update({ status: "erro", erro_detalhe: String(e).slice(0, 500) })
        .eq("id", contato.id);
      erros++;
    }

    // Aguarda o intervalo configurado antes do próximo envio (não espera após o último)
    if (i < pendentes.length - 1) {
      await new Promise(r => setTimeout(r, intervaloMs));
    }

    // Se estourar ~90% do tempo máximo da função, para aqui — o restante fica "pendente"
    // e é retomado no próximo disparo (evita ser morto no meio de um envio).
  }

  const restantes = pendentes.length - enviados - erros;

  // Marca como pausada quando não sobrar nenhum pendente, sinalizando fim do disparo
  if (restantes === 0) {
    await db.from("sdr_campanhas_whatsapp").update({ status: "pausada" }).eq("id", id);
  }

  return NextResponse.json({ ok: true, enviados, erros, restantes });
}
