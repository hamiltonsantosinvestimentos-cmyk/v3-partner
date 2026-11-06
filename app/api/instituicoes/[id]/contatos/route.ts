// GET/POST /api/instituicoes/{id}/contatos — contatos da instituição (vários e-mails, UF do gerente).
// Só ADMIN, GESTAO e MESA_OPERACIONAL (BRIEF 2026-11-06_encaminhar-proposta-instituicao).
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { chamador, svcDb } from "@/lib/integracao-api";
import { PAPEIS_MESA } from "@/lib/encaminhar-instituicao-servidor";
import { ordenarContatos, UFS, type Contato } from "@/lib/encaminhar-instituicao";

export const dynamic = "force-dynamic";

const contatoSchema = z.object({
  nome: z.string().trim().max(120).nullable().optional(),
  email: z.string().trim().toLowerCase().max(200).regex(/^[^@\s]+@[^@\s]+\.[^@\s]+$/, "E-mail inválido."),
  uf: z.enum(UFS).nullable().optional(),
  cargo: z.string().trim().min(1).max(80).optional(),
  telefone: z.string().trim().regex(/^\+[1-9]\d{9,14}$/, "Telefone no formato +5511987654321.").nullable().optional(),
  principal: z.boolean().optional(),
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await chamador(req);
  if (!c) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if (!PAPEIS_MESA.includes(c.role ?? "")) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  const { data, error } = await svcDb().from("instituicao_contatos").select("*").eq("instituicao_id", id).eq("ativo", true);
  if (error) return NextResponse.json({ error: "Não foi possível carregar os contatos." }, { status: 500 });
  return NextResponse.json({ contatos: ordenarContatos((data ?? []) as Contato[]) });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await chamador(req);
  if (!c) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if (!PAPEIS_MESA.includes(c.role ?? "")) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  const parsed = contatoSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  const db = svcDb();
  if (parsed.data.principal) await db.from("instituicao_contatos").update({ principal: false }).eq("instituicao_id", id);
  const { data, error } = await db.from("instituicao_contatos").insert({ ...parsed.data, instituicao_id: id }).select().single();
  if (error) {
    if ((error as { code?: string }).code === "23505") {
      // E-mail que já existiu e foi removido: reativa com os dados novos.
      const { data: antigo } = await db.from("instituicao_contatos").select("id, ativo").eq("instituicao_id", id).ilike("email", parsed.data.email).maybeSingle();
      if (antigo && !antigo.ativo) {
        const { data: reativado } = await db.from("instituicao_contatos")
          .update({ ...parsed.data, ativo: true, updated_at: new Date().toISOString() }).eq("id", antigo.id).select().single();
        return NextResponse.json({ contato: reativado });
      }
      return NextResponse.json({ error: "Este e-mail já está cadastrado nesta instituição." }, { status: 409 });
    }
    return NextResponse.json({ error: "Não foi possível salvar o contato." }, { status: 500 });
  }
  return NextResponse.json({ contato: data });
}
