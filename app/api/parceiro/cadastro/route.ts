import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { notifyNovoLeadParceiro } from "@/lib/email";

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { nome, email, telefone, segmento, plano, instagram, linkedin } = body as {
    nome?: string; email?: string; telefone?: string;
    segmento?: string; plano?: string; instagram?: string; linkedin?: string;
  };

  if (!nome || !email || !telefone) {
    return NextResponse.json({ error: "Campos obrigatórios ausentes." }, { status: 400 });
  }

  const supabase = serviceClient();
  const planoLabel = plano ?? "PARTNER";
  const extras = [
    segmento   ? `Segmento: ${segmento}`   : "",
    instagram  ? `Instagram: ${instagram}` : "",
    linkedin   ? `LinkedIn: ${linkedin}`   : "",
    `Licenciamento de interesse: ${planoLabel}`,
  ].filter(Boolean).join("\n");

  const notas = `Lead captado pela landing page /parceiro.\n${extras}`;

  const { error } = await supabase.from("prospeccao_leads").insert({
    nome,
    email:    email   || null,
    telefone: telefone || null,
    origem:   "landing_parceiro",
    notas,
    etapa:    "prospect",
  });

  if (error) {
    console.error("[parceiro/cadastro]", error);
    return NextResponse.json({ error: "Erro ao registrar interesse." }, { status: 500 });
  }

  // Notifica equipe V3 — fire-and-forget
  notifyNovoLeadParceiro({ nome, email, telefone, segmento: segmento || "", plano: planoLabel, instagram: instagram || "", linkedin: linkedin || "" }).catch(() => {});

  return NextResponse.json({ success: true });
}
