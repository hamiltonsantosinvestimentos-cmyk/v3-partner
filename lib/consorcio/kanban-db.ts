// Kanban de Consórcio › Projetos: acesso ao banco compartilhado pelas rotas (service role).
// BRIEF docs/briefs/2026-11-27_kanban-consorcio-projetos.md
// Tolerante à migration 20261127b ainda não aplicada: tabela/coluna ausente vira "sem comentários".
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AlvoTipo } from "@/lib/consorcio/kanban";

export function faltaNoBanco(e: { code?: string; message?: string } | null | undefined): boolean {
  if (!e) return false;
  return e.code === "42P01" || e.code === "42703" || e.code === "PGRST205" || e.code === "PGRST204"
    || /does not exist|schema cache|could not find/i.test(e.message ?? "");
}

/** Comentários (sem eventos) por item, contando só o que o viewer pode ver. */
export async function contarComentarios(db: SupabaseClient, tipo: AlvoTipo, ids: string[], interno: boolean): Promise<Map<string, number>> {
  const mapa = new Map<string, number>();
  if (!ids.length) return mapa;
  try {
    let q = db.from("consorcio_comentarios").select("alvo_id").eq("alvo_tipo", tipo).eq("evento", false).in("alvo_id", ids);
    if (!interno) q = q.eq("visivel_partner", true);
    const { data, error } = await q.limit(5000);
    if (error) {
      if (!faltaNoBanco(error)) console.error("[consorcio/kanban] contar comentários", error.code);
      return mapa;
    }
    for (const r of (data ?? []) as { alvo_id: string }[]) mapa.set(r.alvo_id, (mapa.get(r.alvo_id) ?? 0) + 1);
  } catch (e) {
    console.error("[consorcio/kanban] contar comentários", e instanceof Error ? e.message : e);
  }
  return mapa;
}

/** Evento de etapa no fio (visível ao partner). Falha não desfaz a mudança. */
export async function registrarEvento(db: SupabaseClient, tipo: AlvoTipo, alvoId: string, autorId: string, texto: string): Promise<void> {
  const { error } = await db.from("consorcio_comentarios").insert({
    alvo_tipo: tipo, alvo_id: alvoId, autor_id: autorId, texto, visivel_partner: true, evento: true,
  });
  if (error && !faltaNoBanco(error)) console.error("[consorcio/kanban] evento", error.code);
}

/** Avisos no sino (sem o texto do comentário). */
export async function avisar(db: SupabaseClient, ids: string[], titulo: string, mensagem: string, link: string): Promise<void> {
  const unicos = [...new Set(ids.filter(Boolean))];
  if (!unicos.length) return;
  const { error } = await db.from("notifications").insert(unicos.map((user_id) => ({
    user_id, title: titulo, message: mensagem, type: "CONSORCIO_KANBAN", action_url: link, read: false,
  })));
  if (error) console.error("[consorcio/kanban] notificações", error.code);
}

/** ADMIN e GESTAO ativos. */
export async function equipeQueMove(db: SupabaseClient): Promise<string[]> {
  const { data } = await db.from("profiles").select("id").in("role", ["ADMIN", "GESTAO"]).eq("is_active", true);
  return ((data ?? []) as { id: string }[]).map((p) => p.id);
}

/** Quem enviou o item + o master dele (se for usuário de uma equipe Enterprise e o master estiver ativo). */
export async function donoEMaster(db: SupabaseClient, createdBy: string | null): Promise<string[]> {
  if (!createdBy) return [];
  const { data } = await db.from("profiles").select("enterprise_id").eq("id", createdBy).maybeSingle();
  const masterId = (data as { enterprise_id?: string | null } | null)?.enterprise_id ?? null;
  if (!masterId || masterId === createdBy) return [createdBy];
  const { data: m } = await db.from("profiles").select("is_active").eq("id", masterId).maybeSingle();
  return (m as { is_active?: boolean } | null)?.is_active === false ? [createdBy] : [createdBy, masterId];
}
