// POST /api/v1/propostas — cria proposta (mesma função do modal "Nova proposta").
// GET  /api/v1/propostas?referencia_externa= | ?atualizado_desde= — lista as do partner.
import type { NextRequest } from "next/server";
import { executar, partnerAccess, portfolioAtivo, propostaDoPartner } from "@/lib/api-v1/rota";
import { ErroApi } from "@/lib/api-v1/http";
import { camposDoZod, converterProposta, propostaSchema, validarRegras } from "@/lib/api-v1/proposta";
import { COLUNAS_VISAO, visaoDoPartner } from "@/lib/api-v1/visao-partner";
import { criarPropostaCredito } from "@/lib/credit-proposal-create";

export const dynamic = "force-dynamic";

const POR_PAGINA = 50;

function inicioDoDiaBrasilia(agora = Date.now()): string {
  const hoje = new Date(agora - 3 * 3600_000).toISOString().slice(0, 10);
  return new Date(`${hoje}T03:00:00.000Z`).toISOString();
}

export async function POST(req: NextRequest) {
  return executar(req, "propostas:criar", "POST /propostas", async (ctx, db) => {
    const idem = req.headers.get("idempotency-key")?.trim() ?? "";
    if (!idem || idem.length > 100) {
      throw new ErroApi(400, "idempotency_key_obrigatoria", "Envie o header Idempotency-Key com um valor único por proposta (até 100 caracteres).");
    }

    // Reenvio com a mesma chave: devolve a proposta já criada, sem duplicar.
    const { data: anterior } = await db
      .from("partner_api_requests")
      .select("proposal_id")
      .eq("key_id", ctx.keyId)
      .eq("idempotency_key", idem)
      .not("proposal_id", "is", null)
      .limit(1)
      .maybeSingle();
    if (anterior?.proposal_id) {
      const p = await propostaDoPartner(db, ctx, anterior.proposal_id as string, COLUNAS_VISAO);
      const visao = visaoDoPartner(p, { portfolio: await portfolioAtivo(db), access: await partnerAccess(db, ctx.partnerId) });
      return { status: 200, corpo: visao, headers: { "Idempotent-Replayed": "true" } };
    }

    let body: unknown;
    try { body = await req.json(); } catch { throw new ErroApi(400, "dados_invalidos", "O corpo precisa ser um JSON válido."); }
    const parsed = propostaSchema.safeParse(body);
    if (!parsed.success) throw new ErroApi(400, "dados_invalidos", "Confira os campos indicados.", camposDoZod(parsed.error));

    const regras = validarRegras(parsed.data);
    if (regras.estrangeiro) {
      throw new ErroApi(400, "documento_estrangeiro_nao_suportado", "Cliente sem CPF ou CNPJ ainda não é aceito pela API. Cadastre esta proposta pela plataforma V3.");
    }
    if (Object.keys(regras.campos).length) throw new ErroApi(400, "dados_invalidos", "Confira os campos indicados.", regras.campos);

    // Limite de propostas por dia (dia de Brasília), por chave.
    const { count } = await db
      .from("partner_api_requests")
      .select("id", { count: "exact", head: true })
      .eq("key_id", ctx.keyId)
      .eq("rota", "POST /propostas")
      .eq("status_http", 201)
      .gte("created_at", inicioDoDiaBrasilia());
    if ((count ?? 0) >= ctx.limitePropostasDia) {
      throw new ErroApi(429, "limite_excedido", `Limite de ${ctx.limitePropostasDia} propostas por dia atingido.`, undefined, { "Retry-After": "3600" });
    }

    const conv = converterProposta(parsed.data);
    const ref = parsed.data.referencia_externa ?? null;
    if (ref) {
      const { data: existente } = await db
        .from("credit_desk_proposals").select("id").eq("partner_id", ctx.partnerId).eq("referencia_externa", ref).maybeSingle();
      if (existente) throw new ErroApi(409, "referencia_repetida", "Já existe proposta com esta referencia_externa.", undefined, undefined, { id: existente.id });
    }

    const res = await criarPropostaCredito(db, {
      title: `${conv.linha} — ${conv.clientName}`,
      client_name: conv.clientName,
      client_cpf_cnpj: conv.documento,
      credit_line: conv.linha,
      requested_value: parsed.data.operacao.valor_solicitado,
      current_level: conv.nivel,
      metadata: conv.metadata,
      partnerId: ctx.partnerId,
      createdBy: ctx.partnerId,
      creatorRole: ctx.role,
      creatorName: ctx.partnerNome,
      origem: "api",
      referenciaExterna: ref,
    });
    if (!res.ok) {
      const codigo = res.codigo === "regra_de_credito" ? "regra_de_credito" : res.codigo === "sem_acesso" ? "sem_acesso" : res.codigo === "referencia_repetida" ? "referencia_repetida" : "erro_interno";
      throw new ErroApi(res.codigo === "regra_de_credito" ? 422 : res.status, codigo, res.error);
    }

    if (conv.pld) {
      const { error } = await db.from("credit_proposal_pld").insert({ proposal_id: res.proposal.id, ...conv.pld, informado_por_key: ctx.keyId });
      if (error) console.error("[api-v1 POST /propostas] falha ao gravar PLD", error.message);
    }

    const p = await propostaDoPartner(db, ctx, res.proposal.id, COLUNAS_VISAO);
    const visao = visaoDoPartner(p, { portfolio: await portfolioAtivo(db), access: await partnerAccess(db, ctx.partnerId) });
    return { status: 201, corpo: visao, proposalId: res.proposal.id, idempotencyKey: idem };
  });
}

export async function GET(req: NextRequest) {
  return executar(req, "propostas:ler", "GET /propostas", async (ctx, db) => {
    const sp = req.nextUrl.searchParams;
    const ref = sp.get("referencia_externa");
    const desde = sp.get("atualizado_desde");
    const cursor = sp.get("cursor");

    let q = db.from("credit_desk_proposals")
      .select(COLUNAS_VISAO)
      .eq("partner_id", ctx.partnerId)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .order("code", { ascending: false })
      .limit(POR_PAGINA + 1);
    if (ref) q = q.eq("referencia_externa", ref);
    if (desde) {
      const t = new Date(desde);
      if (Number.isNaN(t.getTime())) throw new ErroApi(400, "dados_invalidos", "atualizado_desde precisa ser data e hora ISO 8601.", { atualizado_desde: "Formato inválido." });
      q = q.gte("updated_at", t.toISOString());
    }
    if (cursor) {
      const t = new Date(Buffer.from(cursor, "base64url").toString("utf8"));
      if (Number.isNaN(t.getTime())) throw new ErroApi(400, "dados_invalidos", "cursor inválido.");
      q = q.lt("updated_at", t.toISOString());
    }
    const { data, error } = await q;
    if (error) throw error;
    const linhas = (data ?? []) as unknown as Record<string, unknown>[];
    const pagina = linhas.slice(0, POR_PAGINA);
    const portfolio = await portfolioAtivo(db);
    const access = await partnerAccess(db, ctx.partnerId);
    const proxima = linhas.length > POR_PAGINA ? Buffer.from(String(pagina[pagina.length - 1].updated_at)).toString("base64url") : null;
    return { corpo: { propostas: pagina.map((p) => visaoDoPartner(p, { portfolio, access })), proxima_pagina: proxima } };
  });
}
