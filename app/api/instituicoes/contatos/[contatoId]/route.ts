// PATCH/DELETE /api/instituicoes/contatos/{contatoId} — editar ou remover contato.
// Remover marca como inativo: envios já feitos continuam no histórico.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { chamador, svcDb } from "@/lib/integracao-api";
import { PAPEIS_MESA } from "@/lib/encaminhar-instituicao-servidor";
import { UFS } from "@/lib/encaminhar-instituicao";

export const dynamic = "force-dynamic";

const parcial = z.object({
  nome: z.string().trim().max(120).nullable().optional(),
  email: z.string().trim().toLowerCase().max(200).regex(/^[^@\s]+@[^@\s]+\.[^@\s]+$/, "E-mail inválido.").optional(),
  uf: z.enum(UFS).nullable().optional(),
  cargo: z.string().trim().min(1).max(80).optional(),
  telefone: z.string().trim().regex(/^\+[1-9]\d{9,14}$/, "Telefone no formato +5511987654321.").nullable().optional(),
  principal: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ contatoId: string }> }) {
  const { contatoId } = await params;
  const c = await chamador(req);
  if (!c) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if (!PAPEIS_MESA.includes(c.role ?? "")) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  const parsed = parcial.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  const db = svcDb();
  const { data: atual } = await db.from("instituicao_contatos").select("instituicao_id").eq("id", contatoId).maybeSingle();
  if (!atual) return NextResponse.json({ error: "Contato não encontrado." }, { status: 404 });
  if (parsed.data.principal) await db.from("instituicao_contatos").update({ principal: false }).eq("instituicao_id", atual.instituicao_id);
  const { data, error } = await db.from("instituicao_contatos").update({ ...parsed.data, updated_at: new Date().toISOString() }).eq("id", contatoId).select().single();
  if (error) {
    if ((error as { code?: string }).code === "23505") return NextResponse.json({ error: "Este e-mail já está cadastrado nesta instituição." }, { status: 409 });
    return NextResponse.json({ error: "Não foi possível salvar o contato." }, { status: 500 });
  }
  return NextResponse.json({ contato: data });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ contatoId: string }> }) {
  const { contatoId } = await params;
  const c = await chamador(req);
  if (!c) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if (!PAPEIS_MESA.includes(c.role ?? "")) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  const { error } = await svcDb().from("instituicao_contatos").update({ ativo: false, principal: false, updated_at: new Date().toISOString() }).eq("id", contatoId);
  if (error) return NextResponse.json({ error: "Não foi possível remover o contato." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
