import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createClient as sc } from "@supabase/supabase-js";
import { dispararAlertaCreditoIa, repoAuditLogs } from "@/lib/infra-alert";

// POST /api/cron/alerta-credito-ia: chamada pelo n8n (W0, Error Catch) quando um workflow falha por falta de crédito da
// API de IA (BRIEF camada 1, 15/11/2026). Mesmo padrão dos crons: Bearer CRON_SECRET, validado aqui dentro porque
// /api/cron/ é prefixo público no proxy. Chave `alerta_infra_credito_ia` desligada por padrão.
// Devolve só o resultado e, no primeiro alerta do dia, o assunto e o texto do e-mail que o n8n envia.
export const maxDuration = 30;

function segredoValido(recebido: string | null): boolean {
  const esperado = process.env.CRON_SECRET;
  if (!esperado) return false;
  const a = Buffer.from(recebido ?? "");
  const b = Buffer.from(`Bearer ${esperado}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  if (!segredoValido(req.headers.get("authorization"))) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const corpo = (await req.json().catch(() => ({}))) as { tipo?: unknown; origem?: unknown };
  if (corpo.tipo !== "credito_ia") {
    return NextResponse.json({ error: "Tipo de alerta desconhecido" }, { status: 422 });
  }
  const db = sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const resultado = await dispararAlertaCreditoIa(corpo.origem, { repo: repoAuditLogs(db) });
  return NextResponse.json(resultado, { headers: { "Cache-Control": "no-store" } });
}
