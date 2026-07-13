import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const ALLOWED_ROLES = ["ADMIN", "SDR", "CLOSER", "GESTAO"];

/** POST /api/prospeccao/link — gera token único de cadastro para o prospect */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: me } = await svc().from("profiles").select("role").eq("id", user.id).single();
  if (!ALLOWED_ROLES.includes((me as { role: string } | null)?.role ?? "")) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const { leadId } = await req.json() as { leadId: string };
  if (!leadId) return NextResponse.json({ error: "leadId obrigatório" }, { status: 400 });

  const db = svc();

  // Verifica se já tem token
  const { data: lead } = await db
    .from("prospeccao_leads")
    .select("id, link_token, nome, email")
    .eq("id", leadId)
    .single();

  if (!lead) return NextResponse.json({ error: "Prospect não encontrado" }, { status: 404 });

  // Reutiliza token existente ou gera novo com verificação de unicidade
  let token = (lead as { link_token?: string }).link_token;
  if (!token) {
    // Gera token único com loop de verificação para evitar colisões
    let attempts = 0;
    while (!token && attempts < 5) {
      attempts++;
      const candidate = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 9)}`.toUpperCase().slice(0, 14);
      const { data: existing } = await db
        .from("prospeccao_leads")
        .select("id")
        .eq("link_token", candidate)
        .limit(1);
      if (!existing || existing.length === 0) token = candidate;
    }
    if (!token) return NextResponse.json({ error: "Erro ao gerar token único" }, { status: 500 });

    await db
      .from("prospeccao_leads")
      .update({ link_token: token, link_gerado_em: new Date().toISOString() })
      .eq("id", leadId);
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.v3partners.com.br";
  const url = `${baseUrl}/indicacao?ref=${token}`;

  // Mensagem WhatsApp pré-formatada
  const nome = (lead as { nome: string }).nome;
  const whatsappMsg = encodeURIComponent(
    `Olá ${nome}! 👋\n\nVocê foi convidado(a) para se tornar um Partner V3 Partners.\n\nAcesse o link abaixo para fazer seu cadastro gratuito e começar no período de trial de 30 dias:\n\n${url}\n\n*V3 Partners* — Boutique institucional multiproduto de securitização e estruturação financeira.`
  );
  const whatsappUrl = `https://wa.me/?text=${whatsappMsg}`;

  // Mensagem Email pré-formatada
  const emailSubject = encodeURIComponent("Convite V3 Partners — Torne-se um Partner");
  const emailBody = encodeURIComponent(
    `Olá ${nome},\n\nVocê foi convidado(a) para fazer parte da rede de partners V3 Partners.\n\nClique no link abaixo para realizar seu cadastro:\n${url}\n\nO trial é gratuito por 30 dias. Sem necessidade de cartão de crédito.\n\nEquipe V3 Partners`
  );
  const emailUrl = `mailto:${(lead as { email?: string }).email ?? ""}?subject=${emailSubject}&body=${emailBody}`;

  return NextResponse.json({ token, url, whatsappUrl, emailUrl });
}
