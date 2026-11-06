// Autenticação das rotas /api/v1 por chave (BRIEF 2026-11-06). Ordem das conferências:
// IP bloqueado → formato da chave → chave existe/revogada/vencida → IP permitido → plano →
// termo vigente aceito → permissão da rota → limite por minuto. Toda chamada vai ao log.
import type { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getClientIp } from "@/lib/audit";
import {
  BLOQUEIO_MS, JANELA_TENTATIVAS_MS, TENTATIVAS_ANTES_DO_BLOQUEIO, type Escopo,
  hashChave, ipPermitido, lerBearer, normalizarIp, planoTemApi,
} from "@/lib/api-keys";
import { ErroApi } from "@/lib/api-v1/http";

export interface ContextoChave {
  keyId: string;
  partnerId: string;
  partnerNome: string | null;
  role: string | null;
  limitePropostasDia: number;
  ip: string | null;
}

type ChaveRow = {
  id: string; partner_id: string; escopos: string[]; ips_permitidos: string[]; expira_em: string;
  revogada_em: string | null; limite_por_minuto: number; limite_propostas_dia: number;
};

export async function registrarChamada(db: SupabaseClient, r: {
  keyId?: string | null; partnerId?: string | null; metodo: string; rota: string; status: number;
  codigoErro?: string | null; proposalId?: string | null; idempotencyKey?: string | null; ip?: string | null;
}): Promise<void> {
  const { error } = await db.from("partner_api_requests").insert({
    key_id: r.keyId ?? null,
    partner_id: r.partnerId ?? null,
    metodo: r.metodo,
    rota: r.rota,
    status_http: r.status,
    codigo_erro: r.codigoErro ?? null,
    proposal_id: r.proposalId ?? null,
    idempotency_key: r.idempotencyKey ?? null,
    ip: r.ip ?? null,
  });
  if (error) console.error("[api-v1] falha ao registrar chamada", error.message);
}

/** Termo vigente: a versão mais recente já em vigor. */
export async function termoVigente(db: SupabaseClient): Promise<{ versao: string; texto: string; hash: string; vigencia_inicio: string } | null> {
  const { data } = await db
    .from("partner_api_termos")
    .select("versao, texto, hash, vigencia_inicio")
    .lte("vigencia_inicio", new Date().toISOString())
    .order("vigencia_inicio", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as { versao: string; texto: string; hash: string; vigencia_inicio: string } | null) ?? null;
}

export async function aceitouTermo(db: SupabaseClient, partnerId: string, versao: string): Promise<boolean> {
  const { data } = await db
    .from("partner_api_termo_aceites")
    .select("id")
    .eq("partner_id", partnerId)
    .eq("versao", versao)
    .limit(1)
    .maybeSingle();
  return !!data;
}

async function contarFalhasRecentes(db: SupabaseClient, ip: string): Promise<number> {
  const { count } = await db
    .from("partner_api_requests")
    .select("id", { count: "exact", head: true })
    .eq("ip", ip)
    .eq("status_http", 401)
    .gte("created_at", new Date(Date.now() - JANELA_TENTATIVAS_MS).toISOString());
  return count ?? 0;
}

async function falhaDeChave(db: SupabaseClient, ip: string | null, rota: string, metodo: string, keyId: string | null, partnerId: string | null, codigo: "chave_invalida" | "chave_vencida", mensagem: string): Promise<never> {
  await registrarChamada(db, { keyId, partnerId, metodo, rota, status: 401, codigoErro: codigo, ip });
  if (ip && (await contarFalhasRecentes(db, ip)) >= TENTATIVAS_ANTES_DO_BLOQUEIO) {
    await db.from("partner_api_bloqueios").insert({
      ip, motivo: `${TENTATIVAS_ANTES_DO_BLOQUEIO} chamadas com chave inválida em 10 minutos`,
      ate: new Date(Date.now() + BLOQUEIO_MS).toISOString(),
    });
  }
  throw new ErroApi(401, codigo, mensagem);
}

/**
 * Confere a chave e devolve o contexto. Lança ErroApi (já registrado no log) quando recusa.
 * A rota registra a chamada bem-sucedida depois de responder (registrarChamada).
 */
export async function autenticar(db: SupabaseClient, req: NextRequest, escopo: Escopo | null, rota: string): Promise<ContextoChave> {
  const metodo = req.method;
  const ip = normalizarIp(getClientIp(req));

  if (ip) {
    const { data: bloqueio } = await db
      .from("partner_api_bloqueios")
      .select("ate")
      .eq("ip", ip)
      .gt("ate", new Date().toISOString())
      .order("ate", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (bloqueio) {
      const segundos = Math.max(1, Math.ceil((new Date((bloqueio as { ate: string }).ate).getTime() - Date.now()) / 1000));
      await registrarChamada(db, { metodo, rota, status: 429, codigoErro: "ip_bloqueado", ip });
      throw new ErroApi(429, "ip_bloqueado", "Este IP está bloqueado por excesso de chamadas com chave inválida. Tente de novo mais tarde.", undefined, { "Retry-After": String(segundos) });
    }
  }

  const chave = lerBearer(req.headers.get("authorization"));
  if (!chave) return falhaDeChave(db, ip, rota, metodo, null, null, "chave_invalida", "Envie a chave no header Authorization: Bearer v3_live_...");

  const { data: row } = await db
    .from("partner_api_keys")
    .select("id, partner_id, escopos, ips_permitidos, expira_em, revogada_em, limite_por_minuto, limite_propostas_dia")
    .eq("key_hash", hashChave(chave))
    .maybeSingle();
  const k = row as ChaveRow | null;
  if (!k || k.revogada_em) return falhaDeChave(db, ip, rota, metodo, k?.id ?? null, k?.partner_id ?? null, "chave_invalida", "Chave inválida ou revogada. Peça uma nova chave ao partner.");
  if (new Date(k.expira_em).getTime() <= Date.now()) return falhaDeChave(db, ip, rota, metodo, k.id, k.partner_id, "chave_vencida", "A chave passou da validade de 12 meses. O partner precisa criar uma nova na plataforma.");

  const recusa = async (status: number, codigo: "ip_nao_permitido" | "sem_acesso" | "termo_pendente" | "sem_permissao" | "limite_excedido", mensagem: string, headers?: Record<string, string>): Promise<never> => {
    await registrarChamada(db, { keyId: k.id, partnerId: k.partner_id, metodo, rota, status, codigoErro: codigo, ip });
    throw new ErroApi(status, codigo, mensagem, undefined, headers);
  };

  if (!ipPermitido(ip, k.ips_permitidos)) return recusa(403, "ip_nao_permitido", `A chamada saiu do IP ${ip ?? "desconhecido"}, que não está na lista desta chave.`);

  const { data: perfil } = await db.from("profiles").select("full_name, role").eq("id", k.partner_id).maybeSingle();
  const role = (perfil as { role?: string } | null)?.role ?? null;
  if (!planoTemApi(role)) return recusa(403, "sem_acesso", "O plano do partner não inclui a API. Disponível nos planos Partner PRO, Gold, Diamante e Enterprise.");

  const termo = await termoVigente(db);
  if (!termo || !(await aceitouTermo(db, k.partner_id, termo.versao))) {
    return recusa(403, "termo_pendente", "Há uma versão do Termo de Uso da API pendente de aceite. O partner precisa aceitar na plataforma.");
  }

  // escopo null: rota de referência (GET /linhas), liberada para qualquer permissão.
  if (escopo && !k.escopos.includes(escopo)) return recusa(403, "sem_permissao", `Esta chave não tem a permissão ${escopo}.`);

  const { count } = await db
    .from("partner_api_requests")
    .select("id", { count: "exact", head: true })
    .eq("key_id", k.id)
    .gte("created_at", new Date(Date.now() - 60_000).toISOString());
  if ((count ?? 0) >= k.limite_por_minuto) {
    return recusa(429, "limite_excedido", `Limite de ${k.limite_por_minuto} chamadas por minuto atingido.`, { "Retry-After": "60" });
  }

  // Último uso: best-effort, não atrasa a resposta em caso de falha.
  await db.from("partner_api_keys").update({ ultimo_uso_em: new Date().toISOString(), ultimo_ip: ip }).eq("id", k.id);

  return {
    keyId: k.id,
    partnerId: k.partner_id,
    partnerNome: (perfil as { full_name?: string } | null)?.full_name ?? null,
    role,
    limitePropostasDia: k.limite_propostas_dia,
    ip,
  };
}
