import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { buscarProcessosEscavador } from "@/lib/escavador";

export const maxDuration = 60;

const ALLOWED_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"];

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const svc = sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { data: profile } = await svc.from("profiles").select("role").eq("id", user.id).single();
    if (!ALLOWED_ROLES.includes(profile?.role ?? "")) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }

    const token = process.env.ESCAVADOR_API_TOKEN;
    if (!token) return NextResponse.json({ error: "ESCAVADOR_API_TOKEN não configurado" }, { status: 500 });

    const body = await req.json();
    const { tipo, valor, credit_profile_id } = body;
    if (!tipo || !valor?.trim()) {
      return NextResponse.json({ error: "tipo e valor são obrigatórios" }, { status: 400 });
    }

    let result;
    try {
      result = await buscarProcessosEscavador(tipo, valor, token);
    } catch (err) {
      return NextResponse.json(
        { error: `Erro ao consultar Escavador: ${err instanceof Error ? err.message : String(err)}` },
        { status: 502 }
      );
    }

    // Persistência best-effort: relatório final (lib/credit-report-data.ts) lê
    // credit_profiles.escavador_data para montar a seção própria do Escavador.
    if (credit_profile_id) {
      await svc.from("credit_profiles").update({ escavador_data: result }).eq("id", credit_profile_id).then(null, () => {});
    }

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: `Erro interno: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    );
  }
}
