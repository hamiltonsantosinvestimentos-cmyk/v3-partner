// POST /api/admin/api-incidentes — ADMIN registra incidente de segurança (guardado 5 anos, Termo 9.3).
// Registro imutável: correção entra como novo registro com corrige_id.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { chamador, svcDb } from "@/lib/integracao-api";

export const dynamic = "force-dynamic";

const schema = z.object({
  ocorrido_em: z.string().refine((s) => !Number.isNaN(new Date(s).getTime()) && new Date(s).getTime() <= Date.now() + 60_000, "Data e hora inválida ou futura."),
  partner_id: z.string().uuid().nullable().optional(),
  key_id: z.string().uuid().nullable().optional(),
  descricao: z.string().trim().min(10, "Descreva com pelo menos 10 caracteres.").max(4000),
  medidas: z.string().trim().max(4000).nullable().optional(),
  corrige_id: z.string().uuid().nullable().optional(),
});

export async function POST(req: NextRequest) {
  const c = await chamador(req);
  if (!c) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if (c.role !== "ADMIN") return NextResponse.json({ error: "Acesso restrito ao ADMIN." }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });

  const { error } = await svcDb().from("partner_api_incidentes").insert({
    ...parsed.data,
    ocorrido_em: new Date(parsed.data.ocorrido_em).toISOString(),
    registrado_por: c.id,
  });
  if (error) return NextResponse.json({ error: "Não foi possível registrar. Tente de novo." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
