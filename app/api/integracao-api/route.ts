// GET /api/integracao-api — dados da tela do partner: plano, termo vigente, aceite e chaves.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { chamador, podeUsarApi, svcDb, trechosEmDestaque } from "@/lib/integracao-api";
import { aceitouTermo, termoVigente } from "@/lib/api-v1/auth";
import { ordenarChaves } from "@/lib/api-keys";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const c = await chamador(req);
  if (!c) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if (!podeUsarApi(c)) return NextResponse.json({ plano_ok: false });

  const db = svcDb();
  const termo = await termoVigente(db);
  const aceito = termo ? await aceitouTermo(db, c.id, termo.versao) : false;

  // Chaves lidas com a sessão do partner (view security_invoker + política por auth.uid()).
  // A view é nova e ainda não está nos tipos gerados do banco: cliente sem tipagem de tabelas.
  const supabase = (await createClient()) as unknown as SupabaseClient;
  const { data: chaves, error } = await supabase
    .from("partner_api_keys_minhas")
    .select("id, nome, prefixo, escopos, ips_permitidos, expira_em, limite_por_minuto, limite_propostas_dia, ultimo_uso_em, ultimo_ip, revogada_em, motivo_revogacao, created_at");
  if (error) return NextResponse.json({ error: "Não foi possível carregar as chaves." }, { status: 500 });

  return NextResponse.json({
    plano_ok: true,
    email: c.email,
    ip_atual: c.ip,
    termo: termo ? { versao: termo.versao, texto: termo.texto, hash: termo.hash, vigencia_inicio: termo.vigencia_inicio, destaques: trechosEmDestaque(termo.texto) } : null,
    aceito,
    chaves: ordenarChaves((chaves ?? []) as unknown as { revogada_em: string | null; expira_em: string; created_at: string }[]),
  });
}
