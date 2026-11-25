import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { logAudit, getClientIp } from "@/lib/audit";
import { carregarConcessoes } from "@/lib/governance/concessoes-server";
import { concessoesEfetivas, ehAdmin, filtrarListagem, MSG_SEM_ACESSO_PASTA } from "@/lib/governance/acesso-pasta";

// Listagem da Pasta Pública (BRIEF 2026-11-24): só o que foi concedido. Na raiz e nas pastas-mãe, só o caminho até
// as pastas concedidas; externo não vê subpasta oculta (duplo cego). Antes, a raiz e qualquer pasta-mãe eram
// listadas inteiras para qualquer usuário logado.

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const BUCKET = "v3-docs-publico";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const db = svc();
  const { data: profile } = await db.from("profiles").select("role, full_name").eq("id", user.id).single();
  const role = profile?.role ?? "";

  const folderPath = new URL(req.url).searchParams.get("path") ?? "";

  const efetivas = ehAdmin(role) ? [] : concessoesEfetivas(role, await carregarConcessoes(db, user.id), new Date().toISOString());

  // Pré-checagem (sem listar o Storage) para caminho claramente fora de alcance.
  const pre = filtrarListagem(role, efetivas, folderPath, []);
  if (!pre.ok) return NextResponse.json({ error: MSG_SEM_ACESSO_PASTA }, { status: 403 });

  const { data: items, error } = await db.storage.from(BUCKET).list(folderPath, { limit: 500 });
  if (error) return NextResponse.json({ error: "Não foi possível listar a pasta." }, { status: 500 });

  const brutos = (items ?? []).map(item => {
    const raw = item as unknown as Record<string, unknown>;
    const meta = raw.metadata as Record<string, unknown> | undefined;
    return {
      name: item.name,
      is_folder: item.id === null,
      size: meta?.size ?? 0,
      mime_type: meta?.mimetype ?? "",
      created_at: (raw.created_at as string) ?? null,
      updated_at: (raw.updated_at as string) ?? null,
      path: folderPath ? `${folderPath}/${item.name}` : item.name,
    };
  });

  const r = filtrarListagem(role, efetivas, folderPath, brutos);
  if (!r.ok) return NextResponse.json({ error: MSG_SEM_ACESSO_PASTA }, { status: 403 });

  if (!ehAdmin(role)) {
    // Quem listou qual caminho (não bloqueia a resposta).
    await logAudit({
      userId: user.id, userName: profile?.full_name, action: "ACCESS", entity: "profiles", entityId: user.id,
      newData: { pasta_publica_listou: folderPath || "/", itens: r.itens.length }, ipAddress: getClientIp(req),
    });
  }

  return NextResponse.json({
    path: folderPath || "/",
    files: r.itens,
    aviso: r.aviso,
    sem_concessao: !ehAdmin(role) && efetivas.length === 0,
  });
}
