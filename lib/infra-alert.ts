// Alerta de infraestrutura: crédito da API de IA esgotado (camada 1, reativa, 15/11/2026).
// Origem: entre 11 e 13/11/2026 a conta Anthropic usada pelo n8n ficou sem crédito e o W3 acumulou 173 mil falhas sem
// que ninguém fosse avisado. O n8n (W0, Error Catch) detecta "credit balance too low" e chama a rota
// /api/cron/alerta-credito-ia; esta função decide se avisa, manda o WhatsApp (OpenWA, o mesmo gateway dos avisos aos sócios)
// e devolve o assunto e o texto do e-mail, que o próprio n8n envia (e-mail de sistema sempre sai pelo n8n).
//
// Regras:
//  - chave `alerta_infra_credito_ia` desligada por padrão (sem linha em cm_feature_flags, getCmFlag devolve desligado);
//  - no máximo UM alerta por 24 horas, mesmo numa tempestade de erros: quem chega primeiro grava o marcador em audit_logs e
//    os demais só leem (sem gravar) e são suprimidos; entre chamadas simultâneas, vale o marcador mais antigo;
//  - os telefones vêm da variável de ambiente ALERTA_INFRA_WHATSAPP (separados por vírgula), nunca do código: o
//    repositório é público;
//  - nunca lança erro e nunca leva texto de erro, de documento ou de prompt: só o nome do workflow, limpo.
import type { SupabaseClient } from "@supabase/supabase-js";
import { getCmFlag } from "@/lib/cm-flags";
import { normalizePhone } from "@/lib/phone";
import { sendWhatsApp } from "@/lib/whatsapp/subscription-messages";

export const FLAG_ALERTA_CREDITO_IA = "alerta_infra_credito_ia";
export const ACAO_ALERTA_CREDITO_IA = "INFRA_ALERTA_CREDITO_IA";
export const JANELA_ALERTA_MS = 24 * 60 * 60 * 1000;

/** Telefones de destino a partir da variável de ambiente (vírgula ou ponto e vírgula), normalizados e sem repetição. */
export function destinatariosAlerta(bruto: string | undefined | null): string[] {
  const vistos = new Set<string>();
  for (const parte of (bruto ?? "").split(/[;,]/)) {
    const r = normalizePhone(parte);
    if (r.ok && r.e164) vistos.add(r.e164);
  }
  return [...vistos];
}

/** Nome do workflow de origem, limpo: só letras, números, espaço e pontuação simples, até 80 caracteres. */
export function origemSegura(bruto: unknown): string | null {
  if (typeof bruto !== "string") return null;
  const limpo = bruto.replace(/\s+/g, " ").replace(/[^\p{L}\p{N} _.,()\-]/gu, "").replace(/ +/g, " ").trim().slice(0, 80);
  return limpo.length > 0 ? limpo : null;
}

export type MensagemAlerta = { whatsapp: string; assunto: string; texto: string };

export function montarMensagemCreditoIa(origem: string | null): MensagemAlerta {
  const onde = origem ? ` Origem: ${origem}.` : "";
  const acao = "Recarregue em console.anthropic.com > Plans & Billing. Até a recarga, os workflows que usam IA continuam falhando.";
  return {
    whatsapp: `ALERTA V3: a API de IA (Anthropic) usada pelo n8n ficou sem crédito.${onde} ${acao} Aviso automático, no máximo um por dia.`,
    assunto: "[ALERTA V3] API de IA sem crédito (Anthropic)",
    texto: `A API de IA (Anthropic) usada pelo n8n ficou sem crédito.${onde}\n\n${acao}\n\nAviso automático, no máximo um por dia. https://n8n-514n.onrender.com`,
  };
}

export type ResultadoAlerta = {
  resultado: "desligado" | "suprimido" | "enviado" | "falhou";
  whatsapp_enviados: number;
  whatsapp_total: number;
  /** O n8n envia o e-mail só quando isto é true (primeiro alerta do dia). */
  email: boolean;
  assunto?: string;
  texto?: string;
};

/** Acesso ao banco isolado para o teste de unidade. */
export type RepoAlerta = {
  existeMarcadorRecente(desdeIso: string): Promise<boolean>;
  inserirMarcador(dados: Record<string, unknown>): Promise<string | null>;
  marcadorMaisAntigo(desdeIso: string): Promise<string | null>;
  atualizarMarcador(id: string, dados: Record<string, unknown>): Promise<void>;
};

export function repoAuditLogs(db: SupabaseClient): RepoAlerta {
  return {
    async existeMarcadorRecente(desdeIso) {
      const { data } = await db.from("audit_logs").select("id").eq("action", ACAO_ALERTA_CREDITO_IA).gte("created_at", desdeIso).limit(1);
      return !!data && data.length > 0;
    },
    async inserirMarcador(dados) {
      const { data, error } = await db.from("audit_logs")
        .insert({ action: ACAO_ALERTA_CREDITO_IA, entity: "infra_alert", entity_id: "credito_ia", new_data: dados })
        .select("id").single();
      return error ? null : ((data?.id as string | undefined) ?? null);
    },
    async marcadorMaisAntigo(desdeIso) {
      const { data } = await db.from("audit_logs").select("id").eq("action", ACAO_ALERTA_CREDITO_IA).gte("created_at", desdeIso)
        .order("created_at", { ascending: true }).order("id", { ascending: true }).limit(1);
      return (data?.[0]?.id as string | undefined) ?? null;
    },
    async atualizarMarcador(id, dados) {
      await db.from("audit_logs").update({ new_data: dados }).eq("id", id);
    },
  };
}

type Deps = {
  repo: RepoAlerta;
  flagLigada?: () => Promise<boolean>;
  enviar?: (telefone: string, texto: string) => Promise<boolean>;
  telefones?: string[];
  agora?: () => number;
};

/** Nunca lança. Chamar quando o n8n detectou erro de crédito da API de IA. */
export async function dispararAlertaCreditoIa(origemBruta: unknown, deps: Deps): Promise<ResultadoAlerta> {
  const vazio: ResultadoAlerta = { resultado: "desligado", whatsapp_enviados: 0, whatsapp_total: 0, email: false };
  try {
    const ligada = await (deps.flagLigada ?? (() => getCmFlag(FLAG_ALERTA_CREDITO_IA, false)))();
    if (!ligada) return vazio;

    const agora = (deps.agora ?? Date.now)();
    const desde = new Date(agora - JANELA_ALERTA_MS).toISOString();

    // Tempestade de erros: quem chega depois do primeiro só lê, não grava.
    if (await deps.repo.existeMarcadorRecente(desde)) return { ...vazio, resultado: "suprimido" };

    const origem = origemSegura(origemBruta);
    const telefones = deps.telefones ?? destinatariosAlerta(process.env.ALERTA_INFRA_WHATSAPP);
    const meuId = await deps.repo.inserirMarcador({ origem, destinatarios: telefones.length });
    if (!meuId) return { ...vazio, resultado: "falhou" }; // sem marcador não há como limitar: melhor não enviar do que enviar em loop

    // Chamadas simultâneas: vale o marcador mais antigo da janela.
    const vencedor = await deps.repo.marcadorMaisAntigo(desde);
    if (vencedor && vencedor !== meuId) return { ...vazio, resultado: "suprimido" };

    const msg = montarMensagemCreditoIa(origem);
    const enviar = deps.enviar ?? sendWhatsApp;
    const resultados = await Promise.all(
      telefones.map(async (t) => { try { return await enviar(t, msg.whatsapp); } catch { return false; } }),
    );
    const enviados = resultados.filter(Boolean).length;
    const resultado: ResultadoAlerta = {
      resultado: enviados > 0 ? "enviado" : "falhou",
      whatsapp_enviados: enviados,
      whatsapp_total: telefones.length,
      email: true, // o e-mail vai uma vez por dia mesmo que o WhatsApp falhe
      assunto: msg.assunto,
      texto: msg.texto,
    };
    try {
      await deps.repo.atualizarMarcador(meuId, { origem, destinatarios: telefones.length, whatsapp_enviados: enviados, resultado: resultado.resultado });
    } catch { /* o registro do resultado não derruba o alerta */ }
    return resultado;
  } catch (e) {
    console.error("[infra-alert] falhou:", e instanceof Error ? e.message : "erro");
    return { ...vazio, resultado: "falhou" };
  }
}
