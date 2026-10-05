import { ehCobranca, ehParcela } from "@/lib/analise-estruturada/esquemas";

// Leitor de OFX (extrato bancário padrão). Lido sem IA: os valores vêm exatos do banco,
// e o resultado tem o mesmo formato do extrato lido por IA (esquema "extrato").
// Funciona com OFX 1.x (SGML, tags sem fechamento) e 2.x (XML).

interface Lancamento { data: string; valor: number; descricao: string }

function tag(bloco: string, nome: string): string | null {
  const m = bloco.match(new RegExp(`<${nome}>([^<\\r\\n]*)`, "i"));
  return m ? m[1].trim() : null;
}

function dataOfx(v: string | null): string | null {
  if (!v) return null;
  const d = v.replace(/\D/g, "");
  return d.length >= 8 ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}` : null;
}

function numeroOfx(v: string | null): number | null {
  if (!v) return null;
  const limpo = v.includes(",") && !v.includes(".") ? v.replace(",", ".") : v.replace(/,/g, "");
  const x = Number(limpo);
  return Number.isFinite(x) ? x : null;
}

export function lerOfx(texto: string) {
  const blocos = texto.split(/<STMTTRN>/i).slice(1).map((b) => b.split(/<\/STMTTRN>/i)[0]);
  const lancamentos: Lancamento[] = [];
  for (const b of blocos) {
    const data = dataOfx(tag(b, "DTPOSTED"));
    const valor = numeroOfx(tag(b, "TRNAMT"));
    if (!data || valor == null) continue;
    const descricao = [tag(b, "MEMO"), tag(b, "NAME")].filter(Boolean).join(" · ") || "(sem descrição)";
    lancamentos.push({ data, valor, descricao });
  }
  lancamentos.sort((a, b) => a.data.localeCompare(b.data));

  const saldoFinal = numeroOfx(tag(texto, "BALAMT"));
  const somaTudo = lancamentos.reduce((s, l) => s + l.valor, 0);
  const saldoInicial = saldoFinal != null ? Math.round((saldoFinal - somaTudo) * 100) / 100 : null;

  // Agrega por mês e encadeia os saldos a partir do saldo final informado pelo banco.
  const porMes = new Map<string, { entradas: number; saidas: number }>();
  for (const l of lancamentos) {
    const mes = l.data.slice(0, 7);
    const m = porMes.get(mes) ?? { entradas: 0, saidas: 0 };
    if (l.valor >= 0) m.entradas += l.valor; else m.saidas += Math.abs(l.valor);
    porMes.set(mes, m);
  }
  let saldo = saldoInicial;
  const meses = [...porMes.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([mes, m]) => {
    const inicial = saldo;
    const final = inicial != null ? Math.round((inicial + m.entradas - m.saidas) * 100) / 100 : null;
    saldo = final;
    return { mes, saldo_inicial: inicial, entradas: Math.round(m.entradas * 100) / 100, saidas: Math.round(m.saidas * 100) / 100, saldo_final: final };
  });

  const debitos = lancamentos.filter((l) => l.valor < 0);
  return {
    banco: tag(texto, "ORG") ?? tag(texto, "BANKID"),
    agencia: tag(texto, "BRANCHID"),
    conta: tag(texto, "ACCTID"),
    titular: null,
    titular_documento: null,
    periodo_inicio: dataOfx(tag(texto, "DTSTART")) ?? lancamentos[0]?.data ?? null,
    periodo_fim: dataOfx(tag(texto, "DTEND")) ?? lancamentos[lancamentos.length - 1]?.data ?? null,
    saldo_inicial: saldoInicial,
    saldo_final: saldoFinal,
    meses,
    cobrancas: debitos.filter((l) => ehCobranca(l.descricao)).map((l) => ({ data: l.data, descricao: l.descricao, valor: Math.abs(l.valor) })),
    parcelas_dividas: debitos.filter((l) => !ehCobranca(l.descricao) && ehParcela(l.descricao)).map((l) => ({ data: l.data, descricao: l.descricao, valor: Math.abs(l.valor) })),
    entradas_mesma_titularidade: null,
    total_lancamentos: lancamentos.length,
    observacoes: lancamentos.length ? null : "Nenhum lançamento encontrado no arquivo OFX.",
  };
}
