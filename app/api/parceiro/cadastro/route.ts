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
  const { nome, email, telefone, segmento, plano } = body as {
    nome?: string;
    email?: string;
    telefone?: string;
    segmento?: string;
    plano?: string;
  };

  if (!nome || !email || !telefone) {
    return NextResponse.json({ error: "Campos obrigatórios ausentes." }, { status: 400 });
  }

  const supabase = serviceClient();
  const planoLabel = plano === "PARTNER_PRO" ? "PARTNER_PRO" : "PARTNER";
  const notas = `Lead captado pela landing page /parceiro. Plano de interesse: ${planoLabel === "PARTNER_PRO" ? "Partner PRO (R$397/mês - 50%)" : "Partner (R$197/mês - 30%)"}${segmento ? `\nSegmento: ${segmento}` : ""}`;

  const { error } = await supabase.from("prospeccao_leads").insert({
    nome,
    email:    email || null,
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
  notifyNovoLeadParceiro({ nome, email, telefone, segmento: segmento || "", plano: planoLabel }).catch(() => {});

  return NextResponse.json({ success: true });
}
