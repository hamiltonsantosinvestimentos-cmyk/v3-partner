// POST /api/integracao-api/chaves — cria chave: exige plano, termo vigente aceito e o código do e-mail.
// A chave em texto volta só nesta resposta; o banco guarda o hash.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { chamador, emailHtml, podeUsarApi, svcDb } from "@/lib/integracao-api";
import { aceitouTermo, termoVigente } from "@/lib/api-v1/auth";
import { CODIGO_MAX_TENTATIVAS, ESCOPOS, gerarChave, hashCodigo, MAX_IPS, normalizarFaixa, VALIDADE_DIAS } from "@/lib/api-keys";
import { enviarEmailHtml } from "@/lib/email";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const schema = z.object({
  nome: z.string().trim().min(3, "Nome com pelo menos 3 caracteres.").max(80),
  ips: z.array(z.string().trim().min(1)).min(1, "Informe pelo menos 1 IP.").max(MAX_IPS, `No máximo ${MAX_IPS} IPs.`),
  escopos: z.array(z.enum(ESCOPOS)).min(1, "Escolha pelo menos uma permissão."),
  codigo: z.string().trim().regex(/^\d{6}$/, "O código tem 6 dígitos."),
});

export async function POST(req: NextRequest) {
  const c = await chamador(req);
  if (!c) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if (!podeUsarApi(c)) return NextResponse.json({ error: "A integração por API está disponível nos planos Partner PRO, Gold, Diamante e Enterprise." }, { status: 403 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  const d = parsed.data;

  const faixas: string[] = [];
  for (const ip of d.ips) {
    const f = normalizarFaixa(ip);
    if (!f) return NextResponse.json({ error: `IP ou faixa inválida: ${ip}. Use um IP (ex.: 200.150.10.20) ou uma faixa de até /16.` }, { status: 400 });
    if (!faixas.includes(f)) faixas.push(f);
  }

  const db = svcDb();
  const termo = await termoVigente(db);
  if (!termo || !(await aceitouTermo(db, c.id, termo.versao))) {
    return NextResponse.json({ error: "Aceite o Termo de Uso da API antes de criar a chave." }, { status: 403 });
  }

  // Código do e-mail: o mais recente, não usado, dentro da validade e das tentativas.
  const { data: cod } = await db.from("partner_api_codigos")
    .select("id, codigo_hash, expira_em, usado_em, tentativas")
    .eq("partner_id", c.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
  const codigo = cod as { id: string; codigo_hash: string; expira_em: string; usado_em: string | null; tentativas: number } | null;
  if (!codigo || codigo.usado_em || new Date(codigo.expira_em).getTime() < Date.now() || codigo.tentativas >= CODIGO_MAX_TENTATIVAS) {
    return NextResponse.json({ error: "Código vencido ou já usado. Peça um novo código." }, { status: 400 });
  }
  if (codigo.codigo_hash !== hashCodigo(d.codigo)) {
    await db.from("partner_api_codigos").update({ tentativas: codigo.tentativas + 1 }).eq("id", codigo.id);
    return NextResponse.json({ error: "Código incorreto." }, { status: 400 });
  }
  const { data: usado } = await db.from("partner_api_codigos").update({ usado_em: new Date().toISOString() }).eq("id", codigo.id).is("usado_em", null).select("id");
  if (!usado?.length) return NextResponse.json({ error: "Código já usado. Peça um novo código." }, { status: 400 });

  const { chave, prefixo, hash } = gerarChave();
  const expira = new Date(Date.now() + VALIDADE_DIAS * 86_400_000).toISOString();
  const { data: criada, error } = await db.from("partner_api_keys").insert({
    partner_id: c.id,
    nome: d.nome,
    prefixo,
    key_hash: hash,
    escopos: d.escopos,
    ips_permitidos: faixas,
    expira_em: expira,
    termo_versao: termo.versao,
    criada_por: c.id,
  }).select("id").single();
  if (error || !criada) return NextResponse.json({ error: "Não foi possível criar a chave. Tente de novo." }, { status: 500 });

  await logAudit({ userId: c.id, userName: c.nome, action: "CREATE", entity: "profiles", entityId: c.id, ipAddress: c.ip,
    newData: { evento: "api_chave_criada", key_id: criada.id, nome: d.nome, prefixo, escopos: d.escopos, ips: faixas, expira_em: expira } });

  if (c.email) {
    enviarEmailHtml(c.email, "Chave de API criada na V3", emailHtml("Chave de API criada", [
      `A chave <b>${d.nome}</b> (${prefixo}…) foi criada na sua conta.`,
      `Permissões: ${d.escopos.join(", ")}. IPs permitidos: ${faixas.join(", ")}.`,
      `Validade: até ${new Date(expira).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}.`,
    ])).catch(() => {});
  }

  return NextResponse.json({ ok: true, id: criada.id, chave, prefixo, expira_em: expira });
}
