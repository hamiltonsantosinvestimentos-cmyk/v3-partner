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
}

export interface BacenScrData {
  score_pontuacao: unknown;
  score_faixa: unknown;
  credito_vencido_valor: unknown;
  credito_vencido_operacoes: BacenOperacao[];
  prejuizo_valor: unknown;
  prejuizo_operacoes: BacenOperacao[];
  consultado_em: string;
}

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
      (ops ?? []).map((o: any) => ({
        descricao: o.DESCRICAO ?? null,
        valor: o.VALOR ?? null,
        qtd_meses: o.QTD_MESES ?? null,
      }));
    return {
      ok: true,
      data: {
        score_pontuacao: scr.score?.pontuacao ?? null,
        score_faixa: scr.score?.faixa ?? null,
        credito_vencido_valor: consolidado.creditoVencido?.valor ?? null,
        credito_vencido_operacoes: mapOps(consolidado.creditoVencido?.operacoes),
        prejuizo_valor: consolidado.prejuizo?.valor ?? null,
        prejuizo_operacoes: mapOps(consolidado.prejuizo?.operacoes),
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
