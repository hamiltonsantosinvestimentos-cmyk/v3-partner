// Visão do usuário da equipe Enterprise sobre a própria comissão (BRIEF 2026-11-23 enterprise-menu-enxuto-e-comissoes).
// Decisão do Hamilton: o usuário vê só a comissão dele. Valor do master, % e resumo por usuário são
// cortados aqui, no servidor, e não chegam ao navegador.
import type { RepasseLinha } from "@/lib/enterprise-repasses";

export interface MinhaComissaoLinha {
  id: string;
  criadoEm: string;
  operacao: string | null;
  valor: number;
  status: "PENDENTE" | "PAGO" | "CANCELADO";
  pagoEm: string | null;
}

export interface MinhaComissao {
  linhas: MinhaComissaoLinha[];
  totais: { total: number; pendente: number; pago: number };
}

export function visaoDoUsuario(dados: { linhas: RepasseLinha[]; totais: { total: number; pendente: number; pago: number } }): MinhaComissao {
  const linhas = [...dados.linhas]
    .sort((a, b) => (a.criadoEm < b.criadoEm ? 1 : a.criadoEm > b.criadoEm ? -1 : 0))
    .map((l) => ({ id: l.id, criadoEm: l.criadoEm, operacao: l.operacao ?? l.descricao ?? null, valor: l.valor, status: l.status, pagoEm: l.pagoEm }));
  return { linhas, totais: { total: dados.totais.total, pendente: dados.totais.pendente, pago: dados.totais.pago } };
}
