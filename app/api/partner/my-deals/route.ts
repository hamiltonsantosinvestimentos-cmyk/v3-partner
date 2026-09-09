import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const ALLOWED_ROLES = ["ADMIN", "GESTAO", "PARTNER", "PARTNER_PRO", "MESA_OPERACIONAL"];

// GET — lista os próprios Deals (Crédito + M&A) do partner autenticado, pra
// alimentar o dropdown "Vincular a um Deal" em Meus Links de Serviço
// (09/09/2026). Mesmo filtro de dono já usado em
// app/(platform)/minhas-operacoes/page.tsx: credit_desk_proposals por
// partner_id, ma_deals por created_by. ADMIN/GESTAO/MESA_OPERACIONAL veem
// todos os deals (podem vincular análise em nome de qualquer partner).
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const role = (profile as { role: string } | null)?.role ?? "";
  if (!ALLOWED_ROLES.includes(role)) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const db = svc();
  const isAdmin = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"].includes(role);

  const creditQuery = db
    .from("credit_desk_proposals")
    .select("id, code, title, client_name")
    .order("created_at", { ascending: false })
    .limit(200);
  if (!isAdmin) creditQuery.eq("partner_id", user.id);

  const maQuery = db
    .from("ma_deals")
    .select("id, code, title, target_company")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(200);
  if (!isAdmin) maQuery.eq("created_by", user.id);

  const [{ data: propostas, error: creditErr }, { data: deals, error: maErr }] = await Promise.all([creditQuery, maQuery]);

  if (creditErr) return NextResponse.json({ error: creditErr.message }, { status: 500 });
  if (maErr) return NextResponse.json({ error: maErr.message }, { status: 500 });

  return NextResponse.json({
    credit: (propostas ?? []).map(p => ({ id: p.id, code: p.code, label: `${p.code} · ${p.client_name}` })),
    ma: (deals ?? []).map(d => ({ id: d.id, code: d.code, label: `${d.code} · ${d.target_company ?? d.title}` })),
  });
}
