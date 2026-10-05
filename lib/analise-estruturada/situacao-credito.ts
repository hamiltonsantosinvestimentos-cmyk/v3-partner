import type { CreditReportData } from "@/lib/credit-report-data";

// Retrato da situação de crédito de cada parte do pedido (empresa/titular, sócios, CNPJs do
// grupo) para a seção "Situação de crédito" do parecer: Serasa, SCR do Banco Central,
// processos, cadastro e CEIS. Gravado junto do cálculo (_calculo.json) para o parecer
// mostrar exatamente as consultas que entraram no rating. Só copia e resume o que a
// plataforma já consultou; não consulta nada.

export interface ProcessoResumo { numero: string; tribunal: string | null; assunto: string | null; valor: string | null; valorNum: number | null }
export interface OperacaoScr { descricao: string | null; valor: string | null }

export interface SituacaoCreditoParte {
  papel: "principal" | "socio" | "empresa_grupo";
  tipo: "PF" | "PJ";
  nome: string;
  /** CNPJ completo; CPF mascarado (LGPD). */
  documento: string;
  consultadoEm: string | null;
  serasa: {
    consultado: boolean;
    score: number | null;
    protesto: { qtd: number; valor: string | null };
    pefin: { qtd: number; valor: string | null };
    refin: { qtd: number; valor: string | null };
    dividaVencida: { qtd: number; valor: string | null };
    chequeSemFundo: number;
    falencia: number;
  };
  scr: {
    consultado: boolean;
    consultadoEm: string | null;
    aVencer: string | null;
    vencido: string | null;
    prejuizo: string | null;
    limites: string | null;
    operacoesVencidas: OperacaoScr[];
    operacoesPrejuizo: OperacaoScr[];
  };
  processos: { consultado: boolean; total: number; passivo: number; valorPassivo: string | null; maiores: ProcessoResumo[] };
  cadastro: { situacao: string | null; dataAbertura: string | null };
  ceis: { consultado: boolean; sancao: boolean };
}

function mascararCpf(doc: string): string {
  const d = doc.replace(/\D/g, "");
  return d.length === 11 ? `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**` : doc;
}

export function situacaoDaParte(d: CreditReportData, papel: SituacaoCreditoParte["papel"]): SituacaoCreditoParte {
  const s = d.serasa;
  const scr = d.bacenScr;
  const passivos = d.processos.items.filter((p) => p.polo === "passivo");
  const ops = (lista: Array<{ descricao: string | null; valor: string | null }>) => lista.slice(0, 5).map((o) => ({ descricao: o.descricao, valor: o.valor }));
  return {
    papel,
    tipo: d.subjectType,
    nome: d.subjectName,
    documento: d.subjectType === "PF" ? mascararCpf(d.subjectCpfCnpj) : d.subjectCpfCnpj,
    consultadoEm: d.emittedAt,
    serasa: {
      consultado: s.consultado,
      score: s.score,
      protesto: { qtd: s.protestoCount, valor: s.protestoValor },
      pefin: { qtd: s.pefinCount, valor: s.pefinValor },
      refin: { qtd: s.refinCount, valor: s.refinValor },
      dividaVencida: { qtd: s.dividaVencidaCount, valor: s.dividaVencidaValor },
      chequeSemFundo: s.chequeSemFundoCount,
      falencia: s.falenciaCount,
    },
    scr: {
      consultado: scr.consultado,
      consultadoEm: scr.consultadoEm,
      aVencer: scr.creditoAVencerValor,
      vencido: scr.creditoVencidoValor,
      prejuizo: scr.prejuizoValor,
      limites: scr.limiteCreditoValor,
      operacoesVencidas: ops(scr.creditoVencidoOperacoes),
      operacoesPrejuizo: ops(scr.prejuizoOperacoes),
    },
    processos: {
      consultado: d.processos.hasData || d.sources.some((x) => x.consulted && (x.key === "cnj_datajud" || x.key === "escavador")),
      total: d.processos.total,
      passivo: d.processos.totalPassivo,
      valorPassivo: d.processos.valorTotalPassivo,
      maiores: [...passivos]
        .sort((a, b) => (b.valorCausaNum ?? 0) - (a.valorCausaNum ?? 0))
        .slice(0, 5)
        .map((p) => ({ numero: p.numeroCnj, tribunal: p.tribunal, assunto: p.assunto ?? p.classe, valor: p.valorCausa, valorNum: p.valorCausaNum })),
    },
    cadastro: { situacao: d.cadastro.situacao ?? s.situacaoCadastral, dataAbertura: d.cadastro.dataAbertura },
    ceis: { consultado: d.ceis.consultado, sancao: d.ceis.hasMatch },
  };
}
