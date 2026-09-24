import { checktudoLogin, checktudoSCR, type ChecktudoDocType } from "@/lib/checktudo";

// SCR do CheckTudo (BACEN) — 01/09/2026, decisão de João: fica como dado de
// REFERÊNCIA na tela da proposta, nunca entra no cálculo do Tier/score da V3
// (esse continua vindo só do que o n8n calcula). Roda direto no portal, nunca
// no n8n, mesmo padrão já estabelecido para o CheckTudo em 27/08/2026 (n8n não
// consegue injetar credencial com segurança num node httpRequest, confirmado
// por teste real então).
//
// Extraído de app/api/credit-engine/trigger/route.ts para ser reaproveitado pelo
// botão "Reanalisar" (lib/credit-reanalysis.ts), que precisa saber o MOTIVO da
// falha em vez de só receber null.

export interface BacenOperacao {
  descricao: string | null;
  valor: string | null;
  qtd_meses: number | string | null;
  /** Participação da operação no total do bloco (quando o CheckTudo devolve). */
  percentual?: string | null;
}

export interface BacenScrData {
  score_pontuacao: unknown;
  score_faixa: unknown;
  credito_vencido_valor: unknown;
  credito_vencido_operacoes: BacenOperacao[];
  prejuizo_valor: unknown;
  prejuizo_operacoes: BacenOperacao[];
  /** Carteira a vencer (tomado no mercado e em dia) — 23/09/2026. */
  credito_a_vencer_valor?: unknown;
  credito_a_vencer_percentual?: unknown;
  credito_a_vencer_operacoes?: BacenOperacao[];
  /** Limites de crédito concedidos (cheque especial, cartão etc.) — 23/09/2026. */
  limite_credito_valor?: unknown;
  limite_credito_percentual?: unknown;
  limite_credito_operacoes?: BacenOperacao[];
  /** Bloco "consolidado" bruto, para conferir/remapear sem pagar outra consulta. */
  consolidado_bruto?: unknown;
  consultado_em: string;
}

// Nomes exatos de "a vencer" e "limite" no consolidado não foram vistos num retorno
// real ainda (CheckTudo confirmou os campos, com valor e percentual, em 23/09/2026).
// Procura pela chave normalizada em vez de um nome fixo; consolidado_bruto guarda
// o bloco inteiro pra conferir.
const norm = (k: string) => k.normalize("NFD").replace(/[^a-z]/gi, "").toLowerCase(); // NFD + filtro remove acentos
function acharBloco(consolidado: Record<string, any>, match: (k: string) => boolean): any {
  const key = Object.keys(consolidado).find((k) => match(norm(k)));
  return key ? consolidado[key] : null;
}
function campo(obj: any, nomes: string[]): unknown {
  if (!obj || typeof obj !== "object") return null;
  for (const k of Object.keys(obj)) if (nomes.includes(norm(k))) return obj[k] ?? null;
  return null;
}
const PERCENTUAL = ["percentual", "porcentagem", "percentage", "perc", "pct"];
/** O bloco pode vir como objeto ({ valor, percentual, operacoes }) ou só o valor. */
const valorDe = (b: any): unknown => (b && typeof b === "object" ? campo(b, ["valor", "total"]) : b ?? null);

export type BacenResult = { ok: true; data: BacenScrData } | { ok: false; error: string };

/** Consulta o SCR no CheckTudo e devolve o dado ou o motivo da falha. Nunca lança. */
export async function consultarBacenScr(docType: ChecktudoDocType, docValue: string): Promise<BacenResult> {
  const username = process.env.CHECKTUDO_USERNAME;
  const password = process.env.CHECKTUDO_PASSWORD;
  if (!username || !password) return { ok: false, error: "Credenciais do CheckTudo não configuradas no portal" };

  try {
    const session = await checktudoLogin(username, password);
    const raw = await checktudoSCR(session, docType, docValue);
    const scr = (raw?.body as any)?.data?.scr ?? {};
    const consolidado = scr.consolidado ?? {};
    const mapOps = (ops: any[] | undefined): BacenOperacao[] =>
      (Array.isArray(ops) ? ops : []).map((o: any) => ({
        descricao: o.DESCRICAO ?? (campo(o, ["descricao", "modalidade"]) as string | null),
        valor: o.VALOR ?? (campo(o, ["valor"]) as string | null),
        qtd_meses: o.QTD_MESES ?? null,
        percentual: (campo(o, PERCENTUAL) as string | null) ?? null,
      }));
    const aVencer = acharBloco(consolidado, (k) => k.includes("avencer"));
    const limite = acharBloco(consolidado, (k) => k.includes("limite"));
    return {
      ok: true,
      data: {
        score_pontuacao: scr.score?.pontuacao ?? null,
        score_faixa: scr.score?.faixa ?? null,
        credito_vencido_valor: consolidado.creditoVencido?.valor ?? null,
        credito_vencido_operacoes: mapOps(consolidado.creditoVencido?.operacoes),
        prejuizo_valor: consolidado.prejuizo?.valor ?? null,
        prejuizo_operacoes: mapOps(consolidado.prejuizo?.operacoes),
        credito_a_vencer_valor: valorDe(aVencer),
        credito_a_vencer_percentual: campo(aVencer, PERCENTUAL),
        credito_a_vencer_operacoes: mapOps(aVencer?.operacoes),
        limite_credito_valor: valorDe(limite),
        limite_credito_percentual: campo(limite, PERCENTUAL),
        limite_credito_operacoes: mapOps(limite?.operacoes),
        consolidado_bruto: consolidado,
        consultado_em: new Date().toISOString(),
      },
    };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Versão best-effort usada pela análise principal: falha aqui nunca derruba a análise. */
export async function buscarBacenScr(docType: ChecktudoDocType, docValue: string): Promise<BacenScrData | null> {
  const r = await consultarBacenScr(docType, docValue);
  if (!r.ok) {
    console.error("CheckTudo SCR (BACEN) falhou, seguindo sem esse dado:", r.error);
    return null;
  }
  return r.data;
}
