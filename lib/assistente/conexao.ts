import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  apagarMapeamentosLid, apagarMensagensGuardadas, apagarSessaoPropria, pararSessaoPropria, statusSessaoPropria,
} from "@/lib/whatsapp/openwa-client";
import { usuarioAutorizado, variantesTelefone } from "./acesso";

// MY ASSISTANT IA: chave de serviço só depois da checagem de acesso, no webhook, no cron e nestas rotas.
export function svcAssistente(): SupabaseClient {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export type ConfigAssistente = {
  user_id: string;
  openwa_session_id: string | null;
  phone_e164: string | null;
  whatsapp_id: string | null;
  phone_verificado_em: string | null;
  ativo: boolean;
  ultima_limpeza_em: string | null;
  created_at: string;
};

const COLUNAS = "user_id, openwa_session_id, phone_e164, whatsapp_id, phone_verificado_em, ativo, ultima_limpeza_em, created_at";

/** Primeiro acesso cria a linha que libera as políticas do banco. Se o id voltou à lista, ativo volta a true. */
export async function garantirConfig(db: SupabaseClient, userId: string): Promise<ConfigAssistente> {
  if (!usuarioAutorizado(userId)) throw new Error("Usuário não autorizado");
  const { error: insertError } = await db.from("assistente_config")
    .upsert({ user_id: userId }, { onConflict: "user_id", ignoreDuplicates: true });
  if (insertError) throw new Error(`Falha ao criar config: ${insertError.code}`);
  const { data, error } = await db.from("assistente_config").select(COLUNAS).eq("user_id", userId).single();
  if (error || !data) throw new Error(`Falha ao ler config: ${error?.code}`);
  const config = data as ConfigAssistente;
  if (!config.ativo) {
    const { error: erroAtivo } = await db.from("assistente_config")
      .update({ ativo: true, updated_at: new Date().toISOString() }).eq("user_id", userId);
    if (erroAtivo) throw new Error(`Falha ao reativar config: ${erroAtivo.code}`);
    config.ativo = true;
  }
  return config;
}

/**
 * Desliga a sessão no gateway, nesta ordem: lê o número do chip, para, apaga arquivos e mensagens, apaga
 * mapeamentos, apaga a sessão. Só depois da confirmação limpa as colunas do banco V3. Falha em qualquer passo
 * lança erro e nada é limpo aqui, então repetir é seguro. Não altera `ativo`.
 */
export async function desconectarSessao(db: SupabaseClient, config: ConfigAssistente): Promise<void> {
  const sessionId = config.openwa_session_id;
  if (sessionId) {
    const status = await statusSessaoPropria(sessionId);
    await pararSessaoPropria(sessionId);
    const { pending } = await apagarMensagensGuardadas(sessionId, new Date().toISOString());
    if (pending > 0) throw new Error(`Limpeza incompleta: ${pending} pendente(s). Tente novamente.`);
    await apagarMapeamentosLid(sessionId, variantesTelefone([config.phone_e164, config.whatsapp_id, status?.phone]));
    await apagarSessaoPropria(sessionId);
  }
  const { error } = await db.from("assistente_config").update({
    openwa_session_id: null, whatsapp_id: null, phone_e164: null, phone_verificado_em: null,
    updated_at: new Date().toISOString(),
  }).eq("user_id", config.user_id);
  if (error) throw new Error(`Falha ao limpar a conexão: ${error.code}`);
}

/**
 * Revogação: quem saiu de ASSISTENTE_ALLOWED_USER_IDS perde `ativo` e tem a sessão desconectada. O ponteiro da
 * sessão fica até o gateway confirmar, e a próxima rodada tenta de novo. Os dados não são apagados.
 */
export async function aplicarRevogacoes(db: SupabaseClient): Promise<{ revogados: number; falhas: number }> {
  const { data, error } = await db.from("assistente_config").select(COLUNAS);
  if (error) throw new Error(`Falha ao ler configs: ${error.code}`);
  let revogados = 0;
  let falhas = 0;
  for (const config of (data ?? []) as ConfigAssistente[]) {
    if (usuarioAutorizado(config.user_id)) continue;
    if (config.ativo) {
      const { error: erroAtivo } = await db.from("assistente_config")
        .update({ ativo: false, updated_at: new Date().toISOString() }).eq("user_id", config.user_id);
      if (erroAtivo) { falhas += 1; continue; }
      revogados += 1;
    }
    if (config.openwa_session_id) {
      try {
        await desconectarSessao(db, config);
      } catch {
        falhas += 1;
      }
    }
  }
  return { revogados, falhas };
}
