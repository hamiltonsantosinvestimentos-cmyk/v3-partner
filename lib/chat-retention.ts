// Núcleo da retenção de 36 meses do chat (BRIEF 07/11/2026). Sem acesso direto ao banco: tudo passa pela
// "porta" injetada, para o caminho de apagar ser testado com cliente falso (tests/unit/chat-retention.test.ts).
// Regras: simulação nunca apaga; no modo real a auditoria de INÍCIO é gravada antes do primeiro apagamento
// (sem ela, nada é apagado), cada lote apagado grava a própria linha, e o laço para antes do limite de tempo.

export const RETENCAO_MESES = 36; // fixo: nenhum parâmetro de requisição reduz o prazo

export type Anexo = { path?: string };
export type MensagemVencida = { id: string; anexos: Anexo[] | null };

export interface PortaRetencao {
  contarVencidas(corteIso: string): Promise<number | null>;
  lerLote(corteIso: string, limite: number): Promise<MensagemVencida[] | null>;
  removerAnexos(paths: string[]): Promise<boolean>;
  apagarMensagens(ids: string[]): Promise<boolean>;
  auditar(action: string, dados: Record<string, unknown>): Promise<boolean>;
}

export interface OpcoesRetencao {
  real: boolean;
  corteIso: string;
  tamanhoLote?: number;
  maxLotes?: number;
  orcamentoMs?: number;
  agora?: () => number;
}

export interface ResultadoRetencao {
  modo: "simulacao" | "real";
  prazo_meses: number;
  mensagens_vencidas: number;
  mensagens_apagadas: number;
  anexos_apagados: number;
  lotes_com_falha: number;
  interrompida_por_tempo: boolean;
  auditoria_lote_falhou: boolean;
}

export function mesesAtras(n: number, base = new Date()): string {
  const d = new Date(base.getTime());
  d.setUTCMonth(d.getUTCMonth() - n);
  return d.toISOString();
}

export async function executarRetencao(
  porta: PortaRetencao,
  op: OpcoesRetencao,
): Promise<{ resultado: ResultadoRetencao | null; erro?: string }> {
  const tamanho = op.tamanhoLote ?? 200;
  const maxLotes = op.maxLotes ?? 20;
  const orcamento = op.orcamentoMs ?? 45_000;
  const agora = op.agora ?? Date.now;
  const inicio = agora();

  const total = await porta.contarVencidas(op.corteIso);
  if (total === null) return { resultado: null, erro: "falha ao contar" };

  const r: ResultadoRetencao = {
    modo: op.real ? "real" : "simulacao",
    prazo_meses: RETENCAO_MESES,
    mensagens_vencidas: total,
    mensagens_apagadas: 0,
    anexos_apagados: 0,
    lotes_com_falha: 0,
    interrompida_por_tempo: false,
    auditoria_lote_falhou: false,
  };

  if (op.real && total > 0) {
    // Auditoria de início ANTES de apagar: sem ela nada é apagado.
    if (!(await porta.auditar("chat_retencao_inicio", { mensagens_vencidas: total, prazo_meses: RETENCAO_MESES }))) {
      return { resultado: null, erro: "falha ao gravar a auditoria de início" };
    }
    for (let i = 0; i < maxLotes; i++) {
      if (agora() - inicio >= orcamento) { r.interrompida_por_tempo = true; break; }
      const lote = await porta.lerLote(op.corteIso, tamanho);
      if (lote === null) { r.lotes_com_falha += 1; break; }
      if (lote.length === 0) break;

      const paths = lote.flatMap((m) => (m.anexos ?? []).map((a) => a?.path).filter((p): p is string => !!p));
      if (paths.length > 0 && !(await porta.removerAnexos(paths))) { r.lotes_com_falha += 1; break; }
      const ids = lote.map((m) => m.id);
      if (!(await porta.apagarMensagens(ids))) { r.lotes_com_falha += 1; break; }
      r.mensagens_apagadas += ids.length;
      r.anexos_apagados += paths.length;

      if (!(await porta.auditar("chat_retencao_lote", { mensagens: ids.length, anexos: paths.length }))) {
        // O lote já foi apagado e não tem linha própria: para, tenta registrar a linha final com o total e o
        // marcador auditoria_lote_falhou (a gestão enxerga a lacuna) e devolve erro.
        r.auditoria_lote_falhou = true;
        await porta.auditar("chat_retencao_execucao", { ...r });
        return { resultado: r, erro: "falha ao gravar a auditoria do lote" };
      }
      if (lote.length < tamanho) break;
    }
  }

  const acao = op.real ? "chat_retencao_execucao" : "chat_retencao_simulacao";
  if (!(await porta.auditar(acao, { ...r }))) return { resultado: r, erro: "falha ao gravar a auditoria final" };
  return { resultado: r };
}
