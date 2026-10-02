import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { csvCell, fetchAuditPage, parseFilters, type AuditItem, type Cursor } from "@/lib/access-audit";

// Exportação CSV da auditoria. SÓ ADMIN. IP mascarado. A exportação é REGISTRADA (quem, quando,
// filtros, linhas) em cm_compliance_export_log ANTES de devolver o arquivo; falhou, nada sai.
// Uso interno (segurança e auditoria), sem repasse. Limite de 10.000 linhas, com aviso de truncamento.
const MAX_ROWS = 10000;
const PAGE = 1000;
const svc = () => sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const NO_STORE = { "Cache-Control": "no-store" };

const SOURCE_LABEL = { campo: "Revelação de campo", documento: "Abertura de documento", apagamento: "Apagamento de log" } as const;

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401, headers: NO_STORE });
  const db = svc();
  const { data: profile } = await db.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "ADMIN") return NextResponse.json({ error: "Não autorizado" }, { status: 403, headers: NO_STORE });

  const parsed = parseFilters(new URL(req.url).searchParams);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 422, headers: NO_STORE });

  const rows: AuditItem[] = [];
  let cursor: Cursor = null;
  let truncated = false;
  try {
    while (rows.length < MAX_ROWS) {
      const { items, next } = await fetchAuditPage(db, parsed.f, parsed.fromIso, parsed.toIso, cursor, PAGE);
      rows.push(...items);
      if (!next) break;
      const [at, id] = next.split("|");
      cursor = { at, id };
      if (rows.length >= MAX_ROWS) truncated = true;
    }
  } catch {
    return NextResponse.json({ error: "Não foi possível gerar o arquivo" }, { status: 500, headers: NO_STORE });
  }
  const out = rows.slice(0, MAX_ROWS);

  // Registro da exportação ANTES do arquivo.
  const { error: logError } = await db.from("cm_compliance_export_log").insert({
    exported_by: user.id, filters: parsed.f, row_count: out.length, truncated,
  });
  if (logError) {
    console.error("[access-audit export] falha ao registrar exportacao", { code: logError.code });
    return NextResponse.json({ error: "Não foi possível registrar a exportação, tente novamente" }, { status: 500, headers: NO_STORE });
  }

  const fmt = (iso: string) => new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const header = ["Data e hora", "Quem acessou", "Parte", "Tipo", "O que foi acessado", "IP (mascarado)"];
  const lines = [header.map(csvCell).join(";")];
  for (const r of out) lines.push([fmt(r.at), r.user_name, r.party_name, SOURCE_LABEL[r.source], r.what, r.ip_masked].map(csvCell).join(";"));
  if (truncated) lines.push(csvCell("Exportação limitada a 10.000 linhas. Refine o período para ver o restante."));

  return new NextResponse("﻿" + lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="auditoria-acessos-${new Date().toISOString().slice(0, 10)}.csv"`,
      ...NO_STORE,
    },
  });
}
