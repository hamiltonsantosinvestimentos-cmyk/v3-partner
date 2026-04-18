import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";

// ROTA TEMPORÁRIA — executar uma vez para criar tabela ma_captacao_links
// Remover após execução bem-sucedida

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (secret !== "v3ma2026") {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const svc = sc(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Verifica se tabela já existe tentando um select
  const { error: checkError } = await svc.from("ma_captacao_links").select("id").limit(1);

  if (!checkError) {
    return NextResponse.json({ ok: true, message: "Tabela ma_captacao_links já existe." });
  }

  // Tenta criar via rpc se disponível
  const { error: rpcError } = await svc.rpc("exec_ddl", {
    sql: `
      CREATE TABLE IF NOT EXISTS ma_captacao_links (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        token       TEXT UNIQUE NOT NULL,
        partner_id  UUID REFERENCES profiles(id) ON DELETE CASCADE,
        partner_name TEXT NOT NULL DEFAULT '',
        active      BOOLEAN NOT NULL DEFAULT TRUE,
        uses_count  INTEGER NOT NULL DEFAULT 0,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS ma_captacao_links_partner_id_idx ON ma_captacao_links(partner_id);
      CREATE INDEX IF NOT EXISTS ma_captacao_links_token_idx ON ma_captacao_links(token);
    `,
  });

  if (rpcError) {
    return NextResponse.json({
      error: rpcError.message,
      hint: "Execute o SQL manualmente no Supabase Dashboard > SQL Editor.",
      sql: `CREATE TABLE IF NOT EXISTS ma_captacao_links (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token       TEXT UNIQUE NOT NULL,
  partner_id  UUID REFERENCES profiles(id) ON DELETE CASCADE,
  partner_name TEXT NOT NULL DEFAULT '',
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  uses_count  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ma_captacao_links_partner_id_idx ON ma_captacao_links(partner_id);
CREATE INDEX IF NOT EXISTS ma_captacao_links_token_idx ON ma_captacao_links(token);
ALTER TABLE ma_captacao_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "partner_own_ma_links" ON ma_captacao_links FOR ALL USING (partner_id = auth.uid()) WITH CHECK (partner_id = auth.uid());
CREATE POLICY "admin_all_ma_links" ON ma_captacao_links FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('ADMIN','GESTAO')));
CREATE POLICY "service_role_ma_links" ON ma_captacao_links FOR ALL TO service_role USING (true) WITH CHECK (true);`,
    }, { status: 500 });
  }

  return NextResponse.json({ ok: true, message: "Tabela ma_captacao_links criada com sucesso!" });
}
