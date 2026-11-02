import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { exigirUsuarioAutorizado } from "@/lib/assistente/acesso";
import { CATEGORIAS, dataIsoValida, limitesDoMes, mesValido, VALOR_MAX_CENTAVOS, VALOR_MIN_CENTAVOS } from "@/lib/assistente/formato";

// Rotas de tela: sessão do usuário, com a RLS valendo.
const campos = z.object({
  tipo: z.enum(["entrada", "saida"]),
  valor_centavos: z.number().int().min(VALOR_MIN_CENTAVOS).max(VALOR_MAX_CENTAVOS),
  categoria: z.string().refine((c) => CATEGORIAS.includes(c)),
  descricao: z.string().trim().max(300).nullable(),
  data: z.string().refine(dataIsoValida),
});
const naoAutorizado = () => NextResponse.json({ error: "Não autorizado" }, { status: 403 });
const invalido = () => NextResponse.json({ error: "Confira valor, categoria e data." }, { status: 400 });
const falha = () => NextResponse.json({ error: "Não foi possível concluir. Tente novamente." }, { status: 500 });

export async function GET(req: NextRequest) {
  const auth = await exigirUsuarioAutorizado();
  if (!auth) return naoAutorizado();
  const mes = req.nextUrl.searchParams.get("mes");
  if (!mesValido(mes)) return NextResponse.json({ error: "Mês inválido" }, { status: 400 });
  const { inicio, fim } = limitesDoMes(mes);
  const { data, error } = await auth.supabase.from("assistente_lancamentos")
    .select("id, tipo, valor_centavos, categoria, descricao, data, origem")
    .gte("data", inicio).lt("data", fim)
    .order("data", { ascending: false }).order("created_at", { ascending: false });
  if (error) return falha();
  return NextResponse.json({ lancamentos: data });
}

export async function POST(req: NextRequest) {
  const auth = await exigirUsuarioAutorizado();
  if (!auth) return naoAutorizado();
  const corpo = campos.safeParse(await req.json().catch(() => null));
  if (!corpo.success) return invalido();
  const { error } = await auth.supabase.from("assistente_lancamentos").insert({ ...corpo.data, user_id: auth.user.id, origem: "tela" });
  if (error) return falha();
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest) {
  const auth = await exigirUsuarioAutorizado();
  if (!auth) return naoAutorizado();
  const corpo = campos.extend({ id: z.string().uuid() }).safeParse(await req.json().catch(() => null));
  if (!corpo.success) return invalido();
  const { id, ...resto } = corpo.data;
  const { error } = await auth.supabase.from("assistente_lancamentos")
    .update({ ...resto, updated_at: new Date().toISOString() }).eq("id", id).eq("user_id", auth.user.id);
  if (error) return falha();
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const auth = await exigirUsuarioAutorizado();
  if (!auth) return naoAutorizado();
  const id = z.string().uuid().safeParse(req.nextUrl.searchParams.get("id"));
  if (!id.success) return invalido();
  const { error } = await auth.supabase.from("assistente_lancamentos").delete().eq("id", id.data).eq("user_id", auth.user.id);
  if (error) return falha();
  return NextResponse.json({ ok: true });
}
