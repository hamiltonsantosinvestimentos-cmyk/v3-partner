// /api/usuarios/permissoes-mesa (BRIEF Permissões do Analista de Mesa, 17/11/2026).
// GET lista os Analistas de Mesa e o estado da chave; POST concede; DELETE revoga a permissão de excluir documento de
// qualificação. Cinco regras, nas três rotas: (1) papel ADMIN validado aqui dentro, com a chave de serviço (esconder a tela
// não protege a rota); (2) o alvo precisa ter o papel MESA_OPERACIONAL; (3) a chave vem de uma lista fechada; (4) ninguém
// altera a própria permissão; (5) a auditoria é gravada com await ANTES de mudar o estado: sem trilha não há mudança.
// O GET devolve só nome, id e se a chave está concedida, em ordem alfabética (pt-BR).
import { NextRequest, NextResponse } from "next/server";
import { chamador, svcDb } from "@/lib/integracao-api";
import {
  FEATURE_EXCLUIR_DOCUMENTO,
  FEATURES_PERMISSOES_MESA,
  PAPEL_ANALISTA,
  validarPedidoPermissao,
} from "@/lib/cm/exclusao-acesso";

export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "no-store" };

async function adminOuErro(req: NextRequest) {
  const c = await chamador(req);
  if (!c) return { erro: NextResponse.json({ error: "Não autorizado" }, { status: 401, headers: NO_STORE }) };
  if (c.role !== "ADMIN") return { erro: NextResponse.json({ error: "Acesso restrito ao ADMIN." }, { status: 403, headers: NO_STORE }) };
  return { c };
}

export async function GET(req: NextRequest) {
  const r = await adminOuErro(req);
  if (r.erro) return r.erro;
  const db = svcDb();
  const { data: analistas, error } = await db.from("profiles").select("id, full_name").eq("role", PAPEL_ANALISTA).eq("is_active", true);
  if (error) return NextResponse.json({ error: "Não foi possível carregar a lista." }, { status: 500, headers: NO_STORE });
  const ids = (analistas ?? []).map((a) => a.id as string);
  const concedidos = new Set<string>();
  if (ids.length) {
    const { data: linhas } = await db.from("user_feature_access").select("user_id").eq("feature", FEATURE_EXCLUIR_DOCUMENTO).in("user_id", ids);
    for (const l of linhas ?? []) concedidos.add(l.user_id as string);
  }
  const lista = (analistas ?? [])
    .map((a) => ({ id: a.id as string, nome: ((a.full_name as string | null) ?? "Usuário sem nome").trim(), excluir_documento: concedidos.has(a.id as string) }))
    .sort((x, y) => x.nome.localeCompare(y.nome, "pt-BR"));
  return NextResponse.json({ chaves: FEATURES_PERMISSOES_MESA, analistas: lista }, { headers: NO_STORE });
}

async function alterar(req: NextRequest, acao: "conceder" | "revogar") {
  const r = await adminOuErro(req);
  if (r.erro) return r.erro;
  const c = r.c!;
  const body = await req.json().catch(() => null);
  const db = svcDb();
  const alvoId = typeof (body as { user_id?: unknown } | null)?.user_id === "string" ? (body as { user_id: string }).user_id : "";
  const { data: alvo } = alvoId ? await db.from("profiles").select("id, role").eq("id", alvoId).maybeSingle() : { data: null };
  const v = validarPedidoPermissao(body, c.id, (alvo as { role?: string | null } | null)?.role);
  if (!v.ok) return NextResponse.json({ error: v.erro }, { status: v.status, headers: NO_STORE });
  const { pedido } = v;

  const { data: antes } = await db.from("user_feature_access").select("id, access_level").eq("user_id", pedido.user_id).eq("feature", pedido.feature).maybeSingle();
  const { error: erroAuditoria } = await db.from("audit_logs").insert({
    user_id: c.id,
    user_name: c.nome,
    action: acao === "conceder" ? "feature_grant" : "feature_revoke",
    entity: "user_feature_access",
    entity_id: pedido.user_id,
    old_data: antes ?? null,
    new_data: { evento: acao === "conceder" ? "permissao_mesa_concedida" : "permissao_mesa_revogada", feature: pedido.feature, alvo: pedido.user_id },
    ip_address: c.ip,
  });
  if (erroAuditoria) {
    console.error("[usuarios/permissoes-mesa] falha ao gravar a auditoria", { code: erroAuditoria.code });
    return NextResponse.json({ error: "Não foi possível registrar a auditoria. Nada foi alterado." }, { status: 500, headers: NO_STORE });
  }

  const { error } = acao === "conceder"
    ? await db.from("user_feature_access").upsert({ user_id: pedido.user_id, feature: pedido.feature, access_level: "operator" }, { onConflict: "user_id,feature" })
    : await db.from("user_feature_access").delete().eq("user_id", pedido.user_id).eq("feature", pedido.feature);
  if (error) {
    console.error("[usuarios/permissoes-mesa] falha ao alterar a permissão", { code: error.code });
    return NextResponse.json({ error: "Não foi possível alterar a permissão. Tente novamente." }, { status: 500, headers: NO_STORE });
  }
  return NextResponse.json({ ok: true }, { headers: NO_STORE });
}

export async function POST(req: NextRequest) { return alterar(req, "conceder"); }
export async function DELETE(req: NextRequest) { return alterar(req, "revogar"); }
