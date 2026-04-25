import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { notifyContratoParceriaAssinado } from "@/lib/email";

function serviceClient() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// POST — assinar contrato
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await req.json() as {
    registration_id?: string;
    plano: string;
    razao_social?: string;
    cnpj_cpf?: string;
    endereco_completo?: string;
    nome_representante?: string;
    cpf_representante?: string;
    email: string;
    telefone?: string;
    valor_mensal: string;
    device_info?: string;
    contract_html?: string;
  };

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? req.headers.get("x-real-ip")
    ?? "desconhecido";

  const svc = serviceClient();

  // Verifica se já assinou
  const { data: existing } = await svc
    .from("partner_contracts")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (existing) {
    // Já assinou — só atualiza a flag
    await svc.auth.admin.updateUserById(user.id, {
      app_metadata: { must_change_password: false, contract_signed: true },
    });
    return NextResponse.json({ ok: true, already_signed: true });
  }

  // Salva contrato
  const { error } = await svc.from("partner_contracts").insert({
    user_id:           user.id,
    registration_id:   body.registration_id ?? null,
    plano:             body.plano,
    razao_social:      body.razao_social ?? null,
    cnpj_cpf:          body.cnpj_cpf ?? null,
    endereco_completo: body.endereco_completo ?? null,
    nome_representante: body.nome_representante ?? null,
    cpf_representante: body.cpf_representante ?? null,
    email:             body.email,
    telefone:          body.telefone ?? null,
    valor_mensal:      body.valor_mensal,
    ip_address:        ip,
    device_info:       body.device_info ?? null,
    contract_html:     body.contract_html ?? null,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Marca contrato como assinado no app_metadata
  await svc.auth.admin.updateUserById(user.id, {
    app_metadata: { must_change_password: false, contract_signed: true },
  });

  // Envia e-mail de confirmação ao partner (fire and forget)
  const partnerEmail = body.email;
  if (partnerEmail) {
    const planoLabel = body.plano === "PARTNER_PRO" ? "Partner PRO" : "Partner";
    const valorMensal = body.plano === "PARTNER_PRO" ? "R$ 397,00" : "R$ 197,00";
    const dataAssinatura = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
    notifyContratoParceriaAssinado({
      partnerEmail,
      partnerName: body.nome_representante ?? body.razao_social ?? "Partner",
      plano: planoLabel,
      valorMensal,
      dataAssinatura,
    });
  }

  return NextResponse.json({ ok: true });
}

// GET — busca contrato (admin ou próprio usuário)
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId") ?? user.id;

  // Se não é admin e está tentando ver outro usuário, nega
  if (userId !== user.id) {
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (profile?.role !== "ADMIN") return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const svc = serviceClient();
  const { data, error } = await svc
    .from("partner_contracts")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return NextResponse.json({ found: false });
  return NextResponse.json({ found: true, contract: data });
}
