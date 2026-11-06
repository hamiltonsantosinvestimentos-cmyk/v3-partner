// POST /api/integracao-api/codigo — envia ao e-mail da conta o código de 6 dígitos para criar chave.
import { NextRequest, NextResponse } from "next/server";
import { chamador, emailHtml, podeUsarApi, svcDb } from "@/lib/integracao-api";
import { CODIGO_VALIDADE_MS, gerarCodigoEmail } from "@/lib/api-keys";
import { enviarEmailHtml } from "@/lib/email";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const c = await chamador(req);
  if (!c) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if (!podeUsarApi(c)) return NextResponse.json({ error: "A integração por API está disponível nos planos Partner PRO, Gold, Diamante e Enterprise." }, { status: 403 });
  if (!c.email) return NextResponse.json({ error: "Sua conta não tem e-mail cadastrado. Fale com a V3." }, { status: 400 });

  const db = svcDb();
  // No máximo um código por minuto.
  const { data: ultimo } = await db.from("partner_api_codigos").select("created_at").eq("partner_id", c.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (ultimo && Date.now() - new Date((ultimo as { created_at: string }).created_at).getTime() < 60_000) {
    return NextResponse.json({ error: "Aguarde 1 minuto para pedir outro código." }, { status: 429 });
  }

  const { codigo, hash } = gerarCodigoEmail();
  const { error } = await db.from("partner_api_codigos").insert({ partner_id: c.id, codigo_hash: hash, expira_em: new Date(Date.now() + CODIGO_VALIDADE_MS).toISOString() });
  if (error) return NextResponse.json({ error: "Não foi possível gerar o código. Tente de novo." }, { status: 500 });

  try {
    await enviarEmailHtml(c.email, "Código para criar a chave de API da V3", emailHtml("Código para criar a chave de API", [
      `Seu código é <b style="color:#E8C97A;font-size:20px;letter-spacing:.2em">${codigo}</b>.`,
      "Ele vale por 10 minutos e só pode ser usado uma vez.",
      "Ninguém da V3 pede este código. Não repasse a outra pessoa.",
    ]));
  } catch {
    return NextResponse.json({ error: "Não foi possível enviar o e-mail. Tente de novo em alguns minutos." }, { status: 502 });
  }
  const [u, dom] = c.email.split("@");
  return NextResponse.json({ ok: true, enviado_para: `${u.slice(0, 2)}***@${dom}` });
}
