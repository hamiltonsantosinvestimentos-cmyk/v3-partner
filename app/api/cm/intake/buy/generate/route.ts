import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const ALLOWED_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"];

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: profile } = await svc().from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !ALLOWED_ROLES.includes(profile.role as string))
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const token = randomUUID().replace(/-/g, "");

  const { data: demand, error } = await svc()
    .from("investor_demands")
    .insert({
      nome_contato: "Pendente",
      email: "pendente@pendente.com",
      setores: ["precatorio"],
      ufs: ["RJ"],
      ticket_min: 0,
      ticket_max: 0,
      tipos_operacao: ["compra"],
      origem: "intake_buy",
      status: "pendente",
      intake_token: token,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const host = req.headers.get("host") ?? "app.v3partners.com.br";
  const protocol = host.includes("localhost") ? "http" : "https";
  return NextResponse.json({
    token,
    url: `${protocol}://${host}/intake/buy/${token}`,
    demand_id: demand.id,
  }, { status: 201 });
}
