// Alerta interno "cota estourada" (BRIEF 15/11/2026, alerta A). Avisa a Mesa e o Robson quando um usuário bate a
// cota de criação de operações. Não bloqueia ninguém e NUNCA leva IP.
//
// O e-mail NÃO sai daqui: esta função só chama o webhook de um workflow do n8n, que formata a mensagem, passa pelo
// Brand Guardian e envia só para endereços @v3partners.com.br (regra "e-mail V3 sempre via n8n"). O workflow é criado
// INATIVO e o segredo do cabeçalho fica numa credencial Header Auth do n8n; o mesmo valor vai na Vercel em
// N8N_ALERTA_COTA_SECRET (quem cadastra é o Hamilton) junto com N8N_ALERTA_COTA_URL.
//
// Tolerante por desenho: sem configuração, sem rede ou com erro do n8n, devolve o motivo e NUNCA lança nem atrasa a
// resposta 429 (a rota chama isto fora do caminho da resposta, com `after`).

export interface DadosAlertaCota {
  /** Nome do usuário que bateu a cota (dado pessoal; vai só ao n8n da V3, que é interno). */
  nomeUsuario: string | null;
  via: string;
  janela: "hora" | "dia";
  ocorridoEm?: Date;
}

export type ResultadoAlerta =
  | { enviado: true }
  | { enviado: false; motivo: "sem_configuracao" | "http" | "falha_de_rede" | "tempo_esgotado"; status?: number };

export interface AmbienteAlerta {
  url?: string;
  segredo?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export async function enviarAlertaCota(dados: DadosAlertaCota, amb?: AmbienteAlerta): Promise<ResultadoAlerta> {
  const url = amb?.url ?? process.env.N8N_ALERTA_COTA_URL;
  const segredo = amb?.segredo ?? process.env.N8N_ALERTA_COTA_SECRET;
  if (!url || !segredo) {
    console.warn("[creation-alert] N8N_ALERTA_COTA_URL ou N8N_ALERTA_COTA_SECRET ausente: alerta de cota não enviado");
    return { enviado: false, motivo: "sem_configuracao" };
  }

  const controle = new AbortController();
  const limite = setTimeout(() => controle.abort(), amb?.timeoutMs ?? 4000);
  try {
    const resp = await (amb?.fetchImpl ?? fetch)(url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-v3-secret": segredo },
      // Sem IP, sem e-mail do usuário, sem contagem exata: só o necessário para a Mesa saber quem e onde olhar.
      body: JSON.stringify({
        tipo: "cota_estourada",
        usuario: dados.nomeUsuario ?? "usuário sem nome",
        via: dados.via,
        janela: dados.janela,
        ocorrido_em: (dados.ocorridoEm ?? new Date()).toISOString(),
      }),
      signal: controle.signal,
    });
    if (!resp.ok) {
      console.error("[creation-alert] n8n recusou o alerta", { status: resp.status });
      return { enviado: false, motivo: "http", status: resp.status };
    }
    return { enviado: true };
  } catch (e) {
    const abortou = e instanceof Error && e.name === "AbortError";
    console.error("[creation-alert] falha ao chamar o n8n", { tipo: e instanceof Error ? e.name : "desconhecido" });
    return { enviado: false, motivo: abortou ? "tempo_esgotado" : "falha_de_rede" };
  } finally {
    clearTimeout(limite);
  }
}
