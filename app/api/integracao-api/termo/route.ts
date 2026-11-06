// POST /api/integracao-api/termo — aceite eletrônico do Termo de Uso da API (cláusulas 14.3 a 14.6).
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { chamador, podeUsarApi, svcDb } from "@/lib/integracao-api";
import { aceitouTermo, termoVigente } from "@/lib/api-v1/auth";

export const dynamic = "force-dynamic";

const schema = z.object({
  versao: z.string().min(1).max(20),
  hash: z.string().regex(/^[0-9a-f]{64}$/),
  aceite_geral: z.literal(true),
  aceite_destaques: z.literal(true),
  poderes_confirmados: z.literal(true),
  dispositivo: z.string().max(200).optional(),
  sessao_id: z.string().max(100).optional(),
});

export async function POST(req: NextRequest) {
  const c = await chamador(req);
  if (!c) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if (!podeUsarApi(c)) return NextResponse.json({ error: "A integração por API está disponível nos planos Partner PRO, Gold, Diamante e Enterprise." }, { status: 403 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Marque as duas confirmações e a declaração de poderes para aceitar." }, { status: 400 });

  const db = svcDb();
  const termo = await termoVigente(db);
  if (!termo) return NextResponse.json({ error: "Nenhum termo publicado. Fale com a V3." }, { status: 409 });
  // O aceite vale para o texto que a pessoa leu: versão e hash precisam bater com o vigente.
  if (termo.versao !== parsed.data.versao || termo.hash !== parsed.data.hash) {
    return NextResponse.json({ error: "O termo foi atualizado enquanto você lia. Recarregue a página e leia a versão nova." }, { status: 409 });
  }
  if (await aceitouTermo(db, c.id, termo.versao)) return NextResponse.json({ ok: true, ja_aceito: true });

  const { error } = await db.from("partner_api_termo_aceites").insert({
    partner_id: c.id,
    user_id: c.id,
    versao: termo.versao,
    texto_hash: termo.hash,
    aceite_geral: true,
    aceite_destaques: true,
    poderes_confirmados: true,
    ip: c.ip,
    user_agent: c.userAgent?.slice(0, 400) ?? null,
    dispositivo: parsed.data.dispositivo ?? null,
    sessao_id: parsed.data.sessao_id ?? null,
  });
  if (error) return NextResponse.json({ error: "Não foi possível registrar o aceite. Tente de novo." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
