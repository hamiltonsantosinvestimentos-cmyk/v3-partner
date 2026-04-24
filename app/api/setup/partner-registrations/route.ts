import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

// Rota de setup — executa uma vez para criar a tabela partner_registrations
// Acessível apenas por ADMIN
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "ADMIN") return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const svc = sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const steps: string[] = [];

  // 1. Cria a tabela
  const { error: e1 } = await svc.rpc("exec_sql" as never, {
    sql_query: `
      CREATE TABLE IF NOT EXISTS partner_registrations (
        id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        plano           text NOT NULL CHECK (plano IN ('PARTNER', 'PARTNER_PRO')),
        tipo_pessoa     text NOT NULL CHECK (tipo_pessoa IN ('PF', 'PJ')),
        email           text NOT NULL,
        telefone        text NOT NULL,
        nome_completo   text,
        cpf             text,
        data_nascimento date,
        razao_social    text,
        nome_fantasia   text,
        cnpj            text,
        cep             text,
        logradouro      text,
        numero          text,
        complemento     text,
        bairro          text,
        cidade          text,
        estado          text,
        doc_identidade  text[],
        doc_cnpj        text[],
        doc_socio       text[],
        status          text NOT NULL DEFAULT 'PENDENTE'
                        CHECK (status IN ('PENDENTE','APROVADO','REPROVADO','EM_ANALISE')),
        observacao      text,
        revisado_por    uuid,
        revisado_em     timestamptz,
        ip_origem       text,
        created_at      timestamptz NOT NULL DEFAULT now(),
        updated_at      timestamptz NOT NULL DEFAULT now()
      );
    `
  } as never);

  // Se RPC não existir, tenta INSERT direto para testar se a tabela já existe
  if (e1 && e1.message?.includes("exec_sql")) {
    // Tabela pode já existir — tenta um select
    const { error: eCheck } = await svc.from("partner_registrations").select("id").limit(1);
    if (!eCheck) {
      return NextResponse.json({ ok: true, message: "Tabela já existe e está funcionando." });
    }
    return NextResponse.json({
      ok: false,
      message: "Função exec_sql não disponível. Execute o SQL manualmente no Supabase Dashboard.",
      sql: "Ver arquivo supabase-partner-registrations.sql no repositório"
    });
  }

  steps.push("Tabela partner_registrations criada");

  // 2. Cria o bucket de storage (silencioso se já existir)
  await svc.storage.createBucket("partner-docs", { public: false });
  steps.push("Bucket partner-docs criado");

  return NextResponse.json({ ok: true, steps });
}

// GET — verifica se a tabela existe
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const svc = sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { error } = await svc.from("partner_registrations").select("id").limit(1);

  if (error) {
    return NextResponse.json({ exists: false, error: error.message });
  }
  return NextResponse.json({ exists: true });
}
