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
  const code = `LP-${Date.now().toString(36).toUpperCase()}`;
  const planoLabel = plano === "PARTNER_PRO" ? "PARTNER_PRO" : "PARTNER";
  const notes = `Lead captado pela landing page /parceiro. Plano de interesse: ${planoLabel === "PARTNER_PRO" ? "Partner PRO (R$397/mês - 50%)" : "Partner (R$197/mês - 30%)"}`;

  const { error } = await supabase.from("crm_leads").insert({
    code,
    name:             nome,
    email,
    phone:            telefone,
    segment:          segmento || null,
    status:           "prospect",
    source:           "landing_parceiro",
    notes,
    person_type:      "PF",
    annual_revenue:   0,
    interactions:     [],
  });

  if (error) {
    console.error("[parceiro/cadastro]", error);
    return NextResponse.json({ error: "Erro ao registrar interesse." }, { status: 500 });
  }

  // Notifica equipe V3 — fire-and-forget
  notifyNovoLeadParceiro({ nome, email, telefone, segmento: segmento || "", plano: planoLabel }).catch(() => {});

  return NextResponse.json({ success: true });
}
