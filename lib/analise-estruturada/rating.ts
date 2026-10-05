// Rating V3 2.0 (MELHORIA DA CONSULTA, Fase 2 / entrega 1). Função pura: junta o cálculo da
// Fase 1 (capacidade, indicadores, cruzamentos, raio-X) com os dados de crédito já consultados
// pela plataforma (Serasa, SCR, processos, cadastro, CEIS) da empresa/titular e dos sócios.
// Pesos, faixas e travas abaixo são a proposta inicial do doc MELHORIA DA CONSULTA e ficam
// aqui para calibrar com a Mesa. Nada vem da IA.

import type { ResultadoCalculo } from "@/lib/analise-estruturada/calculo";

export type Faixa = "A" | "B" | "C" | "D" | "E";
export type Confianca = "alto" | "medio" | "baixo";

/** Recorte dos dados de crédito (CreditReportData) que o rating usa. */
export interface DadosCreditoParte {
  papel: "principal" | "socio" | "empresa_grupo";
  nome: string | null;
  serasa: {
    consultado: boolean; score: number | null; protestoCount: number; pefinCount: number; refinCount: number;
    dividaVencidaCount: number; chequeSemFundoCount: number; falenciaCount: number;
  } | null;
  bacenScr: { consultado: boolean; creditoVencidoValor: string | null; prejuizoValor: string | null } | null;
  processos: { hasData: boolean; totalPassivo: number; valorTotalPassivo: string | null } | null;
  cadastro: { situacao: string | null; dataAbertura: string | null } | null;
  ceis: { hasMatch: boolean; consultado: boolean } | null;
}

export const PESOS_PJ = { capacidade: 25, financeira: 20, comportamento: 20, juridico: 15, consistencia: 10, garantias: 5, perfil: 5 } as const;
export const PESOS_PF = { capacidade: 35, patrimonio: 15, comportamento: 30, juridico: 10, consistencia: 10 } as const;
const NOTA_MAXIMA_COM_TRAVA = 54; // trava limita a faixa D

export const FAIXAS: Array<{ faixa: Faixa; min: number; leitura: string }> = [
  { faixa: "A", min: 85, leitura: "Pronto para o mercado: bancos, FIDCs e securitizadoras, com taxas menores." },
  { faixa: "B", min: 70, leitura: "Apto, com ajustes pontuais que melhoram taxa e prazo." },
  { faixa: "C", min: 55, leitura: "Apto com garantia forte ou estrutura específica (recebíveis, imóvel)." },
  { faixa: "D", min: 40, leitura: "Ainda não apto: seguir o plano de ação antes de pedir crédito." },
  { faixa: "E", min: 0, leitura: "Reestruturação antes de qualquer pedido." },
];
export const faixaDaNota = (nota: number) => FAIXAS.find((f) => nota >= f.min)!;

// ── utilidades ──
export function lerValor(v: string | number | null | undefined): number | null {
  if (v == null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const t = v.replace(/[R$\s]/g, "");
  if (!t) return null;
  const normal = t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t;
  const x = Number(normal);
  return Number.isFinite(x) ? x : null;
}
function anosDesde(data: string | null): number | null {
  if (!data) return null;
  const m = data.match(/^(\d{2})\/(\d{2})\/(\d{4})/) ?? null;
  const d = m ? new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1])) : new Date(data);
  if (Number.isNaN(d.getTime())) return null;
  return (Date.now() - d.getTime()) / (365.25 * 864e5);
}
const escala = (v: number | null, faixas: Array<[number, number]>, senao: number): number | null => {
  if (v == null) return null;
  for (const [lim, nota] of faixas) if (v >= lim) return nota;
  return senao;
};
const limitar = (x: number) => Math.max(0, Math.min(100, Math.round(x)));

export interface Pilar { id: string; nome: string; peso: number; nota: number | null; motivos: string[] }

function notaComportamento(parte: DadosCreditoParte | undefined, motivos: string[], semPenalidadesSanaveis = false): number | null {
  if (!parte) return null;
  const s = parte.serasa;
  const scr = parte.bacenScr;
  if (!s?.consultado && !scr?.consultado) return null;
  let nota = escala(s?.score ?? null, [[800, 100], [700, 85], [600, 70], [500, 50], [400, 35]], 15) ?? 70;
  if (s?.score != null) motivos.push(`Score ${s.score}`);
  if (!semPenalidadesSanaveis) {
    if ((s?.protestoCount ?? 0) > 0) { nota -= 20; motivos.push(`${s!.protestoCount} protesto(s)`); }
    if ((s?.pefinCount ?? 0) + (s?.refinCount ?? 0) > 0) { nota -= 15; motivos.push("Negativação (Pefin/Refin)"); }
    if ((s?.dividaVencidaCount ?? 0) > 0) { nota -= 15; motivos.push("Dívida vencida no Serasa"); }
    if ((s?.chequeSemFundoCount ?? 0) > 0) { nota -= 10; motivos.push("Cheque sem fundo"); }
    if ((lerValor(scr?.creditoVencidoValor) ?? 0) > 0) { nota -= 25; motivos.push(`Crédito vencido no SCR (${scr!.creditoVencidoValor})`); }
  }
  if ((lerValor(scr?.prejuizoValor) ?? 0) > 0) { nota = Math.min(nota, 10); motivos.push(`Prejuízo no SCR (${scr!.prejuizoValor})`); }
  return limitar(nota);
}

export interface EntradaRating {
  perfil: "PJ" | "PF";
  calculo: ResultadoCalculo;
  partes: DadosCreditoParte[];          // principal primeiro
  partesSemAnalise: number;             // sócios/empresas do pedido ainda sem consulta rodada
  obrigatoriosFaltando: number;
  temGarantia: boolean;
}

function avaliar(e: EntradaRating, projetar: boolean) {
  const c = e.calculo;
  const cap = c.capacidade as Record<string, unknown>;
  const n = (k: string) => (typeof cap[k] === "number" ? (cap[k] as number) : null);
  const principal = e.partes.find((p) => p.papel === "principal");
  const socios = e.partes.filter((p) => p.papel !== "principal");
  const ultimo = c.indicadores.filter((i) => !i.parcial).slice(-1)[0] ?? null;
  const pilares: Pilar[] = [];
  const travas: string[] = [];

  // ── capacidade ──
  {
    const motivos: string[] = [];
    let nota: number | null;
    if (e.perfil === "PJ") {
      let caixa = n("caixaMensal");
      const servico = n("servicoDividaMensal") ?? 0;
      if (projetar && caixa != null && c.raioX) caixa += c.raioX.economiaAnualEstimada / 12;
      const icsd = caixa != null ? (servico > 0 ? caixa / servico : 3) : null;
      nota = escala(icsd, [[2, 100], [1.5, 85], [1.3, 70], [1, 45]], 15);
      if (icsd != null) motivos.push(servico > 0 ? `ICSD ${icsd.toFixed(2).replace(".", ",")}` : "Sem dívidas com parcelas");
      const est = (cap.estresse as Array<{ icsd: number | null }> | undefined)?.[2]?.icsd;
      if (nota != null && est != null && est < 1 && !projetar) { nota -= 15; motivos.push("ICSD abaixo de 1 no estresse"); }
    } else {
      const renda = n("rendaMensal");
      let parcelas = n("servicoDividaMensal") ?? 0;
      if (projetar && c.raioX) parcelas = Math.max(0, parcelas - c.raioX.economiaAnualEstimada / 12);
      const comp = renda ? parcelas / renda : null;
      nota = escala(comp == null ? null : -comp, [[-0.15, 100], [-0.25, 85], [-0.3, 70], [-0.4, 45]], 15);
      if (comp != null) motivos.push(`Comprometimento ${(comp * 100).toFixed(0)}% da renda`);
    }
    pilares.push({ id: "capacidade", nome: "Capacidade de pagamento", peso: e.perfil === "PJ" ? PESOS_PJ.capacidade : PESOS_PF.capacidade, nota: nota == null ? null : limitar(nota), motivos });
  }

  // ── saúde financeira (PJ) / patrimônio (PF) ──
  if (e.perfil === "PJ") {
    const motivos: string[] = [];
    const partes: Array<[number | null, number]> = [];
    if (ultimo) {
      const me = ultimo.margemEbitda;
      partes.push([escala(me, [[0.15, 100], [0.1, 80], [0.05, 60], [0, 40]], 10), 35]);
      if (me != null) motivos.push(`Margem EBITDA ${(me * 100).toFixed(1).replace(".", ",")}%`);
      partes.push([escala(ultimo.liquidezCorrente, [[1.5, 100], [1.2, 80], [1, 60], [0.8, 40]], 15), 25]);
      const dl = ultimo.dividaLiquidaEbitda;
      partes.push([ultimo.ebitda != null && ultimo.ebitda <= 0 ? 10 : escala(dl == null ? null : -dl, [[-1, 100], [-2, 85], [-3, 65], [-4, 40]], 15), 25]);
      if (dl != null) motivos.push(`Dívida líquida ${dl.toFixed(2).replace(".", ",")}× EBITDA`);
      partes.push([escala(c.crescimentoReceita, [[0.1, 100], [0, 75], [-0.1, 45]], 20), 15]);
    }
    const validas = partes.filter(([v]) => v != null) as Array<[number, number]>;
    const nota = validas.length ? validas.reduce((s, [v, p]) => s + v * p, 0) / validas.reduce((s, [, p]) => s + p, 0) : null;
    pilares.push({ id: "financeira", nome: "Saúde financeira", peso: PESOS_PJ.financeira, nota: nota == null ? null : limitar(nota), motivos });
  } else {
    const motivos: string[] = [];
    const pl = n("patrimonioLiquidoDeclarado");
    const renda = n("rendaMensal");
    const razao = pl != null && renda ? pl / (renda * 12) : null;
    const nota = escala(razao, [[3, 100], [1, 75], [0.5, 50]], 25);
    if (razao != null) motivos.push(`Patrimônio líquido de ${razao.toFixed(1).replace(".", ",")}× a renda anual`);
    pilares.push({ id: "patrimonio", nome: "Patrimônio", peso: PESOS_PF.patrimonio, nota, motivos });
  }

  // ── comportamento de crédito ──
  {
    const motivos: string[] = [];
    const notaPrincipal = notaComportamento(principal, motivos, projetar);
    const motivosSocios: string[] = [];
    const notasSocios = socios.map((s) => notaComportamento(s, motivosSocios, projetar)).filter((x): x is number => x != null);
    let nota = notaPrincipal;
    if (nota != null && notasSocios.length) {
      nota = limitar(nota * 0.7 + (notasSocios.reduce((a, b) => a + b, 0) / notasSocios.length) * 0.3);
      if (motivosSocios.some((m) => !m.startsWith("Score"))) motivos.push("Restrições em sócio(s)");
    }
    pilares.push({ id: "comportamento", nome: "Comportamento de crédito", peso: e.perfil === "PJ" ? PESOS_PJ.comportamento : PESOS_PF.comportamento, nota, motivos });
  }

  // ── jurídico e fiscal ──
  {
    const motivos: string[] = [];
    let nota: number | null = null;
    if (principal?.processos?.hasData || principal?.serasa?.consultado) {
      const valor = lerValor(principal?.processos?.valorTotalPassivo) ?? 0;
      const base = e.perfil === "PJ"
        ? (ultimo?.receitaLiquida ?? (c.faturamento?.total ?? null))
        : (n("rendaMensal") != null ? n("rendaMensal")! * 12 : null);
      const qtd = principal?.processos?.totalPassivo ?? 0;
      if (!qtd || valor === 0) { nota = qtd ? 80 : 100; motivos.push(qtd ? `${qtd} processo(s) no polo passivo, sem valor informado` : "Sem processos no polo passivo"); }
      else {
        const r = base ? valor / base : null;
        nota = escala(r == null ? null : -r, [[-0.01, 100], [-0.05, 80], [-0.15, 55], [-0.3, 30]], 10) ?? 50;
        motivos.push(`${qtd} processo(s) no polo passivo, ${principal!.processos!.valorTotalPassivo}${r != null ? ` (${(r * 100).toFixed(1).replace(".", ",")}% da ${e.perfil === "PJ" ? "receita" : "renda"} anual)` : ""}`);
      }
      if (nota != null && !projetar && c.alertas.some((a) => a.tema === "Fiscal")) { nota -= 15; motivos.push("Tributos a recolher crescendo"); }
    }
    pilares.push({ id: "juridico", nome: "Jurídico e fiscal", peso: e.perfil === "PJ" ? PESOS_PJ.juridico : PESOS_PF.juridico, nota: nota == null ? null : limitar(nota), motivos });
  }

  // ── consistência e governança ──
  {
    const motivos: string[] = [];
    const total = c.cruzamentos.filter((x) => x.ok != null).length;
    const ok = c.cruzamentos.filter((x) => x.ok === true).length;
    let nota: number | null = total ? (ok / total) * 100 : null;
    if (total) motivos.push(`${ok} de ${total} cruzamentos sem divergência`);
    if (projetar && nota != null) nota = 100;
    if (nota != null && e.obrigatoriosFaltando > 0 && !projetar) { nota -= 20 * e.obrigatoriosFaltando; motivos.push(`${e.obrigatoriosFaltando} documento(s) obrigatório(s) faltando`); }
    pilares.push({ id: "consistencia", nome: "Consistência e governança", peso: e.perfil === "PJ" ? PESOS_PJ.consistencia : PESOS_PF.consistencia, nota: nota == null ? null : limitar(nota), motivos });
  }

  if (e.perfil === "PJ") {
    pilares.push({ id: "garantias", nome: "Garantias", peso: PESOS_PJ.garantias, nota: e.temGarantia ? 70 : 40, motivos: [e.temGarantia ? "Documentos de garantia enviados (análise jurídica da garantia na próxima entrega)" : "Sem garantia informada"] });
    const anos = anosDesde(principal?.cadastro?.dataAbertura ?? null);
    const notaPerfil = escala(anos, [[10, 100], [5, 80], [2, 60]], 30);
    pilares.push({ id: "perfil", nome: "Perfil e setor", peso: PESOS_PJ.perfil, nota: notaPerfil, motivos: anos != null ? [`${Math.floor(anos)} ano(s) de empresa`] : [] });
  }

  // ── travas ──
  for (const p of e.partes) {
    const quem = p.papel === "principal" ? "" : ` (${p.nome ?? "sócio"})`;
    if ((lerValor(p.bacenScr?.prejuizoValor) ?? 0) > 0) travas.push(`Prejuízo registrado no SCR${quem}`);
    if ((p.serasa?.falenciaCount ?? 0) > 0) travas.push(`Falência ou recuperação judicial${quem}`);
    if (p.ceis?.hasMatch) travas.push(`Sanção no CEIS${quem}`);
  }
  const situacao = principal?.cadastro?.situacao;
  if (e.perfil === "PJ" && situacao && !/ATIVA/i.test(situacao)) travas.push(`Situação cadastral na Receita: ${situacao}`);

  const avaliados = pilares.filter((p) => p.nota != null);
  const pesoTotal = avaliados.reduce((s, p) => s + p.peso, 0);
  let nota = pesoTotal ? Math.round(avaliados.reduce((s, p) => s + p.nota! * p.peso, 0) / pesoTotal) : 0;
  if (travas.length) nota = Math.min(nota, NOTA_MAXIMA_COM_TRAVA);
  return { pilares, travas: [...new Set(travas)], nota, pilaresSemDado: pilares.filter((p) => p.nota == null).map((p) => p.nome) };
}

export function calcularRating(e: EntradaRating) {
  const atual = avaliar(e, false);
  const projetado = avaliar(e, true);
  const faixa = faixaDaNota(atual.nota);
  const faixaProjetada = faixaDaNota(projetado.nota);

  const essenciaisSemDado = atual.pilares.filter((p) => p.nota == null && ["capacidade", "financeira", "comportamento"].includes(p.id)).length;
  const confianca: Confianca =
    essenciaisSemDado > 0 ? "baixo"
    : e.obrigatoriosFaltando > 0 || e.partesSemAnalise > 0 || atual.pilaresSemDado.length > 0 ? "medio"
    : "alto";
  const motivosConfianca: string[] = [];
  if (e.obrigatoriosFaltando) motivosConfianca.push(`${e.obrigatoriosFaltando} documento(s) obrigatório(s) faltando`);
  if (e.partesSemAnalise) motivosConfianca.push(`${e.partesSemAnalise} parte(s) do pedido sem consulta de crédito rodada`);
  if (atual.pilaresSemDado.length) motivosConfianca.push(`Sem dados para: ${atual.pilaresSemDado.join(", ")}`);

  return {
    versao: "2.0" as const,
    nota: atual.nota,
    faixa: faixa.faixa,
    leitura: faixa.leitura,
    confianca,
    motivosConfianca,
    travas: atual.travas,
    pilares: atual.pilares,
    notaProjetada: projetado.nota,
    faixaProjetada: faixaProjetada.faixa,
  };
}

export type ResultadoRating = ReturnType<typeof calcularRating>;
