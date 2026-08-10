/**
 * GOVERNANÇA DE NUMERAÇÃO V3 PARTNERS
 * Ponto único de emissão de código de operação e contrato no lado da aplicação.
 *
 * CONTEXTO
 *   Antes deste arquivo existiam 12 pontos no portal emitindo código, com 4
 *   algoritmos diferentes:
 *     COUNT(*)+1        colide assim que há vão na numeração
 *     Math.random()     destrói a sequência
 *     Date.now()        idem
 *     MAX+1 com retry   correto, mas aplicado em 1 lugar só
 *
 *   O COUNT(*)+1 derrubou o cadastro por link de captação em 31/07/2026 e o
 *   cadastro de deal do partner Jean Paulo em 05/08/2026. É o mesmo defeito
 *   reaparecendo porque a correção anterior nunca virou padrão.
 *
 * REGRA
 *   Nenhuma rota, componente ou script deste projeto emite código por conta
 *   própria. Toda emissão passa por issueV3Code(). A autoridade real está no
 *   banco, na função next_v3_code(), que é atômica. Este arquivo é só a porta
 *   de entrada tipada para ela.
 *
 * PRÉ-REQUISITO
 *   Migration 20260805a_v3_code_series.sql aplicada. Sem ela, issueV3Code()
 *   falha de forma explícita e ruidosa, nunca em silêncio, e nunca caindo de
 *   volta no gerador antigo: um código errado gravado é pior que um cadastro
 *   que falha, porque o errado só aparece semanas depois, dentro de contrato.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** Séries registradas em public.v3_code_series. */
export type V3Series =
  | "MA"        // M&A e Cross-Border
  | "CR"        // Crédito nacional
  | "CRI"       // Crédito internacional (modalidade, derivada do dicionário)
  | "BA"        // Bolsa de Ativos
  | "PR"        // Precatórios (usa esfera, não setor)
  | "CS"        // Consórcios
  | "V3C-ORG"   // Contrato de originação
  | "V3C-MAN"   // Contrato de mandato
  | "V3C-PAR"   // Adesão de partner
  | "V3C-CES"   // Contrato de cessão / compra-e-venda de ativo
  | "V3C-NDA"   // NDA
  | "V3C-LOI"   // Carta de Intenção (adicionada em 20260807b, nunca refletida aqui)
  | "V3C-FPA"   // Acordo de Proteção de Honorários (idem)
  | "V3C-FOR"   // Contrato de Fornecedor (idem)
  | "V3C-FUN";  // Contrato de Fundo (idem)

export type V3Esfera = "FED" | "EST" | "MUN";

function serviceClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * Emite um código V3. Server-side apenas: usa service_role.
 *
 * @param series  série registrada em v3_code_series
 * @param klass   setor de 3 letras (séries de setor), esfera (precatório),
 *                ou null (consórcio e contratos)
 *
 * Lança erro com mensagem do banco quando a regra da série é violada, por
 * exemplo setor fora do dicionário ou precatório sem esfera. Isso é
 * intencional: o código nunca deve afirmar o que o dado não sustenta.
 */
export async function issueV3Code(
  series: V3Series,
  klass: string | null = null,
  db?: SupabaseClient
): Promise<string> {
  const svc = db ?? serviceClient();

  const { data, error } = await svc.rpc("next_v3_code", {
    p_series: series,
    p_class: klass,
  });

  if (error) {
    throw new Error(
      `Falha ao emitir código da série ${series}` +
        (klass ? ` (${klass})` : "") +
        `: ${error.message}. ` +
        `Verifique se a migration 20260805a_v3_code_series.sql foi aplicada.`
    );
  }
  if (!data || typeof data !== "string") {
    throw new Error(
      `Emissor devolveu valor inesperado para a série ${series}: ${JSON.stringify(data)}`
    );
  }

  return data;
}

/**
 * Traduz um setor escrito em texto livre para o código de 3 letras do
 * dicionário deal_sector_codes.
 *
 * Por que isso é necessário: ma_deals.sector e o formulário de deal aceitam
 * texto livre ("Energia", "Saúde", "Real Estate"), enquanto o código exige a
 * sigla. Sem esta tradução, o setor do código seria escolhido no chute, que foi
 * como MAC e CRE acabaram emitidos fora do dicionário.
 *
 * O fallback é GRL, que existe no dicionário exatamente para "cross-vertical ou
 * sem classificação específica". É um valor legítimo e visível no código
 * emitido, não um silêncio: um deal marcado GRL sinaliza que a classificação
 * precisa de revisão humana, e isso é auditável por query.
 */
export async function resolveSectorCode(
  sector: string | null | undefined,
  db?: SupabaseClient
): Promise<string> {
  const raw = (sector ?? "").trim();
  if (!raw) return "GRL";

  // Já veio como sigla válida
  if (/^[A-Z]{3}$/.test(raw)) {
    const svc = db ?? serviceClient();
    const { data } = await svc
      .from("deal_sector_codes")
      .select("code")
      .eq("code", raw)
      .eq("active", true)
      .maybeSingle();
    if (data) return raw;
  }

  const svc = db ?? serviceClient();
  const { data: dict } = await svc
    .from("deal_sector_codes")
    .select("code, label, description")
    .eq("active", true);

  if (!dict || dict.length === 0) return "GRL";

  // Remove marcas de acentuação por código de caractere em vez de regex de
  // combining marks: a regex literal é frágil ao passar por editores e
  // ferramentas que normalizam o arquivo, e uma falha silenciosa aqui faria
  // "Saúde" deixar de casar com "Saude" no dicionário.
  const COMBINING_START = 0x0300;
  const COMBINING_END = 0x036f;
  const norm = (s: string) =>
    s
      .normalize("NFD")
      .split("")
      .filter((ch) => {
        const c = ch.charCodeAt(0);
        return c < COMBINING_START || c > COMBINING_END;
      })
      .join("")
      .toLowerCase()
      .trim();

  const target = norm(raw);

  // 1. label exato
  const exact = dict.find((d) => norm(String(d.label)) === target);
  if (exact) return String(exact.code);

  // 2. label contido no texto ou vice-versa
  const partial = dict.find((d) => {
    const l = norm(String(d.label));
    return l.length >= 3 && (target.includes(l) || l.includes(target));
  });
  if (partial) return String(partial.code);

  // 3. palavra-chave da descrição do dicionário
  const byKeyword = dict.find((d) =>
    norm(String(d.description ?? ""))
      .split(/[,;.]+/)
      .map((w) => w.trim())
      .filter((w) => w.length >= 4)
      .some((w) => target.includes(w))
  );
  if (byKeyword) return String(byKeyword.code);

  return "GRL";
}

/* ---------------------------------------------------------------------------
 * SÉRIES LEGADAS
 *
 * Nem toda numeração deste sistema é código de operação. crm_leads.code
 * (CRM-26-NNNN) identifica lead, não operação, e por isso fica fora da tabela
 * de nomenclatura V3: colocá-lo lá obrigaria a renomear a numeração do CRM
 * inteiro sem ganho de governança.
 *
 * O que ele precisa é apenas parar de colidir. As duas funções abaixo são a
 * mesma solução aplicada em 31/07/2026 em app/api/captacao/submit/route.ts,
 * que resolveu o incidente do link de captação: MAX real em vez de COUNT, mais
 * retry no 23505 para cobrir requisições concorrentes.
 *
 * DÍVIDA CONSCIENTE: captacao/submit/route.ts mantém a sua própria cópia destas
 * funções. Não a removi neste bloco porque aquele arquivo está funcionando em
 * produção e refatorá-lo aqui seria risco sem retorno. Unificar é item de
 * limpeza posterior, registrado no SOP de Governança de Numeração.
 * ------------------------------------------------------------------------- */

/**
 * Próximo código sequencial a partir do MAIOR número já usado, nunca de
 * COUNT(*). COUNT diverge do real assim que existe qualquer vão na tabela, e
 * foi essa divergência que derrubou o cadastro do partner em 05/08/2026.
 */
export async function nextLegacyCode(
  db: SupabaseClient,
  table: string,
  prefix: string,
  width = 4
): Promise<string> {
  const { data } = await db.from(table).select("code").like("code", `${prefix}-%`);
  const re = new RegExp(`^${prefix}-(\\d+)$`);
  let max = 0;
  for (const row of (data ?? []) as { code: string }[]) {
    const m = row.code?.match(re);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > max) max = n;
    }
  }
  return `${prefix}-${String(max + 1).padStart(width, "0")}`;
}

/**
 * Insere retentando com o próximo número em caso de unique_violation (23505).
 * Ler o MAX sozinho não elimina a corrida: duas requisições simultâneas leem o
 * mesmo MAX e calculam o mesmo próximo número. O retry fecha essa janela.
 */
export async function insertWithLegacyCode<T extends Record<string, unknown>>(
  db: SupabaseClient,
  table: string,
  prefix: string,
  buildRow: (code: string) => T,
  opts: { width?: number; maxAttempts?: number } = {}
): Promise<{
  data: Record<string, unknown> | null;
  error: { message: string; code?: string } | null;
}> {
  const { width = 4, maxAttempts = 5 } = opts;
  let lastError: { message: string; code?: string } | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const code = await nextLegacyCode(db, table, prefix, width);
    const { data, error } = await db.from(table).insert(buildRow(code)).select("*").single();
    if (!error) return { data, error: null };
    lastError = error;
    if (error.code !== "23505") return { data: null, error };
  }
  return { data: null, error: lastError };
}

/**
 * Emite o código de uma operação de crédito, decidindo entre CR e CRI.
 *
 * A modalidade internacional NÃO é escolha do operador: ela é lida do campo
 * escopo em regras_linhas_credito. Isso torna impossível carimbar uma operação
 * internacional como nacional, ou o contrário.
 *
 * As 8 linhas internacionais foram confirmadas por João Lemos em 05/08/2026:
 * op_int_garantia, op_int_cash, acc, ace, finimp, fin_exterior, cambio_pronto
 * e cash_collateral.
 *
 * Pré-requisito: migration 20260808a (coluna escopo em regras_linhas_credito),
 * aplicada em 08/08/2026. Wired de verdade em app/api/credit-proposals,
 * app/api/credit-engine/orders/[id]/link-proposal e app/api/captacao/submit
 * em 10/08/2026, sucedendo CRED-26-NNNNNN nos três pontos de emissão ao
 * mesmo tempo — migrar só um deles reproduziria o mesmo defeito que motivou
 * esta governança inteira (formatos convivendo, ver session-decisions.md).
 * Se a coluna escopo não existir por qualquer motivo, trata tudo como
 * nacional e registra aviso: fail-open, nunca bloqueia emissão de código.
 */
export async function issueCreditCode(
  creditLineId: string | null,
  sector: string | null | undefined,
  db?: SupabaseClient
): Promise<{ code: string; series: "CR" | "CRI"; escopo: string }> {
  const svc = db ?? serviceClient();
  const sectorCode = await resolveSectorCode(sector, svc);

  let escopo = "nacional";

  if (creditLineId) {
    const { data, error } = await svc
      .from("regras_linhas_credito")
      .select("escopo")
      .eq("id", creditLineId)
      .maybeSingle();

    if (error) {
      // A coluna escopo ainda não existe (migration 20260805e pendente).
      // Não é falha silenciosa: o aviso vai para o log do servidor e o
      // comportamento é o mesmo de hoje, sem regressão.
      console.warn(
        `[v3-codes] escopo indisponível para a linha ${creditLineId}: ${error.message}. Tratando como nacional.`
      );
    } else if (data?.escopo === "internacional") {
      escopo = "internacional";
    }
  }

  const series = escopo === "internacional" ? "CRI" : "CR";
  const code = await issueV3Code(series, sectorCode, svc);

  return { code, series, escopo };
}
