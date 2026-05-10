import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// PATCH — reagenda next_contact de um lead sem abrir modal completo
export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id, next_contact } = await req.json();
  if (!id || !next_contact) {
    return NextResponse.json({ error: "id e next_contact são obrigatórios" }, { status: 400 });
  }

  // Valida formato YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(next_contact)) {
    return NextResponse.json({ error: "Formato de data inválido. Use YYYY-MM-DD" }, { status: 400 });
  }

  const { error } = await supabase
    .from("crm_leads")
    .update({ next_contact, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("partner_id", user.id); // garante que só o dono pode reagendar

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
