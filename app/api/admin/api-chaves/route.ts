// GET /api/admin/api-chaves — ADMIN: todas as chaves de API, os termos publicados e os incidentes.
import { NextRequest, NextResponse } from "next/server";
import { chamador, svcDb } from "@/lib/integracao-api";
import { situacaoDaChave } from "@/lib/api-keys";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const c = await chamador(req);
  if (!c) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if (c.role !== "ADMIN") return NextResponse.json({ error: "Acesso restrito ao ADMIN." }, { status: 403 });

  const db = svcDb();
  const [chavesR, termosR, incR] = await Promise.all([
    db.from("partner_api_keys").select("id, partner_id, nome, prefixo, escopos, ips_permitidos, expira_em, limite_por_minuto, limite_propostas_dia, ultimo_uso_em, ultimo_ip, revogada_em, motivo_revogacao, created_at"),
    db.from("partner_api_termos").select("versao, hash, vigencia_inicio, created_at").order("vigencia_inicio", { ascending: false }),
    db.from("partner_api_incidentes").select("id, ocorrido_em, partner_id, key_id, descricao, medidas, corrige_id, registrado_por, created_at").order("ocorrido_em", { ascending: false }),
  ]);
  if (chavesR.error || termosR.error || incR.error) return NextResponse.json({ error: "Não foi possível carregar. A migration da API já foi aplicada?" }, { status: 500 });

  const chaves = (chavesR.data ?? []) as { partner_id: string; revogada_em: string | null; expira_em: string; created_at: string }[];
  const ids = [...new Set([...chaves.map((k) => k.partner_id), ...((incR.data ?? []) as { partner_id: string | null; registrado_por: string }[]).flatMap((i) => [i.partner_id, i.registrado_por]).filter(Boolean) as string[]])];
  const { data: perfis } = ids.length ? await db.from("profiles").select("id, full_name, role").in("id", ids) : { data: [] };
  const porId = new Map(((perfis ?? []) as { id: string; full_name: string | null; role: string | null }[]).map((p) => [p.id, p]));

  // Bloqueio: chave ativa cujo partner saiu dos planos com API.
  const lista = chaves.map((k) => {
    const p = porId.get(k.partner_id);
    return { ...k, partner_nome: p?.full_name ?? "(sem nome)", plano: p?.role ?? null, situacao: situacaoDaChave(k) };
  }).sort((a, b) => a.partner_nome.localeCompare(b.partner_nome, "pt-BR") || b.created_at.localeCompare(a.created_at));

  const incidentes = ((incR.data ?? []) as Record<string, unknown>[]).map((i) => ({
    ...i,
    partner_nome: i.partner_id ? porId.get(i.partner_id as string)?.full_name ?? null : null,
    registrado_por_nome: porId.get(i.registrado_por as string)?.full_name ?? null,
  }));

  return NextResponse.json({ chaves: lista, termos: termosR.data ?? [], incidentes });
}
