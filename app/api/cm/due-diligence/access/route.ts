import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hasDueDiligenceAccess } from "@/lib/cm/dd-access";
import { namesByUserId, svc } from "@/lib/cm/dd-party";
import { formatDateTimeBr } from "@/lib/cm-indicators";
import { maskIp } from "@/lib/cm/dd-report";

// Monitoramento de aberturas dos relatorios de Due Diligence (Entrega 3, 08/10/2026), SOMENTE LEITURA.
// Quem abriu, quando, qual relatorio (codigo do NCNDA e identificador curto da parte, nunca nome), IP mascarado.
// Acesso: papel ADMIN E permissao por usuario (due_diligence_qualificacao). Mais recente primeiro; empate por nome do usuario (pt-BR).
// Sinal "Acesso acima do usual": mais de 10 aberturas do mesmo usuario em 24 horas (limite proposto, a confirmar com o Robson).

const NO_STORE = { "Cache-Control": "no-store" };
const DAYS = 30;
const ALERT_LIMIT = 10;
const MAX_ROWS = 200;

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401, headers: NO_STORE });
  const db = svc();
  const { data: profile } = await db.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "ADMIN" || !(await hasDueDiligenceAccess(user.id))) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403, headers: NO_STORE });
  }

  const since = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await db
    .from("cm_party_dd_report_views")
    .select("contract_code, party_short, viewed_by, ip, viewed_at")
    .gte("viewed_at", since)
    .order("viewed_at", { ascending: false })
    .limit(MAX_ROWS);
  if (error) {
    console.error("[dd access] falha ao ler aberturas", { code: error.code });
    return NextResponse.json({ error: "Não foi possível carregar os acessos agora" }, { status: 500, headers: NO_STORE });
  }

  const rows = data ?? [];
  const names = await namesByUserId(db, rows.map((r) => r.viewed_by as string));
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const per24h = new Map<string, number>();
  for (const r of rows) {
    if (new Date(r.viewed_at as string).getTime() >= dayAgo) per24h.set(r.viewed_by as string, (per24h.get(r.viewed_by as string) ?? 0) + 1);
  }

  const items = rows
    .map((r) => ({
      who: names[r.viewed_by as string] ?? "Usuário",
      contract_code: r.contract_code as string,
      party_short: r.party_short as string,
      ip_masked: maskIp(r.ip as string | null),
      at: r.viewed_at as string,
      at_br: formatDateTimeBr(new Date(r.viewed_at as string)),
      above_usual: (per24h.get(r.viewed_by as string) ?? 0) > ALERT_LIMIT,
    }))
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime() || a.who.localeCompare(b.who, "pt-BR"))
    .map(({ at: _at, ...rest }) => rest);

  return NextResponse.json({ days: DAYS, alert_limit: ALERT_LIMIT, items, truncated: rows.length >= MAX_ROWS }, { headers: NO_STORE });
}
