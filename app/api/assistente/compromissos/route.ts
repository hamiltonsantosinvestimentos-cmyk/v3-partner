import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { exigirUsuarioAutorizado } from "@/lib/assistente/acesso";

// Rotas de tela: sessão do usuário, com a RLS valendo.
const campos = z.object({
  titulo: z.string().trim().min(1).max(200),
  inicio: z.string().datetime({ offset: true }),
  fim: z.string().datetime({ offset: true }).nullable(),
  local: z.string().trim().max(200).nullable(),
  notas: z.string().trim().max(1000).nullable(),
}).refine((c) => !c.fim || new Date(c.fim) >= new Date(c.inicio));
const naoAutorizado = () => NextResponse.json({ error: "Não autorizado" }, { status: 403 });
const invalido = () => NextResponse.json({ error: "Confira título, data e horário." }, { status: 400 });
const falha = () => NextResponse.json({ error: "Não foi possível concluir. Tente novamente." }, { status: 500 });

export async function GET(req: NextRequest) {
  const auth = await exigirUsuarioAutorizado();
  if (!auth) return naoAutorizado();
  const anteriores = req.nextUrl.searchParams.get("periodo") === "anteriores";
  const agora = new Date().toISOString();
  const base = auth.supabase.from("assistente_compromissos").select("id, titulo, inicio, fim, local, notas, origem");
  const { data, error } = anteriores
    ? await base.lt("inicio", agora).order("inicio", { ascending: false })
    : await base.gte("inicio", agora).order("inicio", { ascending: true });
  if (error) return falha();
  return NextResponse.json({ compromissos: data });
}

export async function POST(req: NextRequest) {
  const auth = await exigirUsuarioAutorizado();
  if (!auth) return naoAutorizado();
  const corpo = campos.safeParse(await req.json().catch(() => null));
  if (!corpo.success) return invalido();
  const { error } = await auth.supabase.from("assistente_compromissos").insert({ ...corpo.data, user_id: auth.user.id, origem: "tela" });
  if (error) return falha();
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest) {
  const auth = await exigirUsuarioAutorizado();
  if (!auth) return naoAutorizado();
  const bruto = await req.json().catch(() => null) as { id?: unknown } | null;
  const id = z.string().uuid().safeParse(bruto?.id);
  const corpo = campos.safeParse(bruto);
  if (!id.success || !corpo.success) return invalido();
  const { error } = await auth.supabase.from("assistente_compromissos")
    .update({ ...corpo.data, updated_at: new Date().toISOString() }).eq("id", id.data).eq("user_id", auth.user.id);
  if (error) return falha();
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const auth = await exigirUsuarioAutorizado();
  if (!auth) return naoAutorizado();
  const id = z.string().uuid().safeParse(req.nextUrl.searchParams.get("id"));
  if (!id.success) return invalido();
  const { error } = await auth.supabase.from("assistente_compromissos").delete().eq("id", id.data).eq("user_id", auth.user.id);
  if (error) return falha();
  return NextResponse.json({ ok: true });
}
