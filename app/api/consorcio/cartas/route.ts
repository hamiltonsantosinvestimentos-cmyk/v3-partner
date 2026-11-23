import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { z } from "zod";
import { issueV3Code } from "@/lib/v3-codes";
import { reservarVagaOuNegar } from "@/lib/creation-quota-route";
import { cartaParaVitrine, ehInterno } from "../vitrine";

function serviceClient() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

async function getAuthedUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, profile: null };
  const svc = serviceClient();
  const { data: profile } = await svc.from("profiles").select("id, full_name, role").eq("id", user.id).single();
  return { user, profile };
}

const createSchema = z.object({
  type: z.enum(["IMOVEL", "VEICULO", "SERVICO", "OUTROS"]),
  credit_value: z.number().positive(),
  admin: z.string().min(1).max(200),
  group_name: z.string().max(50).optional().nullable(),
  quota: z.string().max(50).optional().nullable(),
  status: z.enum(["DISPONIVEL","NEGOCIACAO","VENDIDA","UTILIZADA"]).default("DISPONIVEL"),
  asking_price: z.number().positive(),
  discount: z.number().min(0).max(100),
});

export async function GET() {
  const { user, profile } = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  // Preço de custo e margem só para a equipe interna (BRIEF 2026-11-21 Consórcio, item 3).
  const interno = ehInterno(profile?.role);
  const svc = serviceClient();
  const { data, error } = await svc.from("consorcio_cartas").select("*").is("deleted_at", null).order("created_at", { ascending: false });
  if (error) {
    console.error("[consorcio/cartas GET]", error.message);
    return NextResponse.json({ error: "Não foi possível carregar as cartas." }, { status: 500 });
  }
  return NextResponse.json({ cartas: ((data ?? []) as Record<string, unknown>[]).map((c) => cartaParaVitrine(c, interno)) });
}

export async function POST(req: NextRequest) {
  const { user, profile } = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  // Só a equipe interna inclui carta (decisão do Hamilton, 23/11/2026). Perfil não encontrado também cai aqui.
  if (!ehInterno(profile?.role)) return NextResponse.json({ error: "Só a equipe interna inclui cartas." }, { status: 403 });
  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  const d = parsed.data;
  const svc = serviceClient();

  // Cota de criação (BRIEF 15/11/2026): vaga reservada antes de emitir o código e devolvida se a criação falhar.
  const vaga = await reservarVagaOuNegar(req, svc, { kind: "user", id: user.id, via: "consorcio-cartas", papel: profile?.role, nomeUsuario: profile?.full_name });
  if (vaga.negado) return vaga.negado;

  // Codigo emitido pelo banco. O calculo anterior (COUNT(*)+1) estava a uma
  // exclusao de quebrar: sao 301 cartas com numeracao perfeitamente densa, entao
  // apagar qualquer uma faria COUNT+1 apontar para um codigo ja existente e toda
  // emissao de carta passaria a falhar com 23505, exatamente como aconteceu em
  // ma_deals em 05/08/2026.
  // As 301 cartas no formato CARTA-26-NNN permanecem intocadas: a serie CS vale
  // da emissao em diante, conforme decisao de congelar o historico (05/08/2026).
  let code: string;
  try {
    code = await issueV3Code("CS", null, svc);
  } catch (codeErr) {
    console.error("[consorcio/cartas POST] falha ao emitir código:", codeErr instanceof Error ? codeErr.message : String(codeErr));
    await vaga.devolver();
    return NextResponse.json({ error: "Não foi possível concluir o cadastro agora. Tente novamente em instantes." }, { status: 500 });
  }

  const { data, error } = await svc.from("consorcio_cartas").insert({
    code, ...d, created_by: user.id,
  }).select().single();
  if (error) {
    console.error("[consorcio/cartas POST] falha ao gravar:", error.message);
    await vaga.devolver();
    return NextResponse.json({ error: "Não foi possível concluir o cadastro agora. Tente novamente em instantes." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, carta: cartaParaVitrine(data as Record<string, unknown>, true) });
}

// DELETE — descontinuado: exclusão agora passa por soft delete + governança
// em POST /api/consorcio/cartas/[id]/delete (ver lib/governance-delete.ts).
export async function DELETE() {
  return NextResponse.json(
    { error: "Use POST /api/consorcio/cartas/{id}/delete — exclusão direta foi descontinuada (soft delete + governança)" },
    { status: 410 }
  );
}
