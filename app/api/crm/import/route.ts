import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { leads } = (await req.json()) as {
    leads: Array<{
      nome: string;
      email?: string;
      telefone?: string;
      cidade?: string;
      estado?: string;
      observacoes?: string;
    }>;
  };

  if (!Array.isArray(leads) || leads.length === 0) {
    return NextResponse.json({ error: "No leads provided" }, { status: 400 });
  }

  const rows = leads
    .filter((l) => l.nome?.trim())
    .map((l) => ({
      partner_id: user.id,
      full_name: l.nome.trim(),
      name: l.nome.trim(),
      email: l.email?.trim() || null,
      phone: l.telefone?.trim() || null,
      city: l.cidade?.trim() || null,
      state: l.estado?.trim() || null,
      notes: l.observacoes?.trim() || null,
      status: "prospect",
      source: "importacao_csv",
    }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await supabase.from("crm_leads").insert(rows as any).select("id");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ imported: data?.length ?? 0 });
}
