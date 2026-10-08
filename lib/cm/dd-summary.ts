// Linhas de resumo de uma consulta de Due Diligence, compartilhadas pela aba (tela) e pelo relatorio (PDF).
// Nenhum resumo carrega nome ou CPF de socio. Falha de fonte nunca vira aprovacao.

export type DdSummaryTool = "receita" | "blacklist" | "escavador" | "datajud" | "scr_cnpj" | "scr_cpf";
export type DdSummaryStatus = "ok" | "sem_dados" | "nao_consultado";

// Ordem fixa de consulta, a mesma dos botoes da aba.
export const DD_REPORT_TOOL_ORDER: DdSummaryTool[] = ["receita", "blacklist", "escavador", "datajud", "scr_cnpj", "scr_cpf"];

export const DD_TOOL_TITLES: Record<DdSummaryTool, string> = {
  receita: "Receita / CNPJ",
  blacklist: "Black List V3",
  escavador: "Escavador",
  datajud: "Datajud",
  scr_cnpj: "SCR do CNPJ",
  scr_cpf: "SCR do CPF",
};

export const DD_STATUS_TITLES: Record<DdSummaryStatus, string> = {
  ok: "CONSULTADO",
  sem_dados: "SEM DADOS",
  nao_consultado: "NÃO CONSULTADO",
};

export function ddSummaryLines(tool: DdSummaryTool, status: DdSummaryStatus, summary: Record<string, any> | null | undefined): string[] {
  const s = summary ?? {};
  if (status === "nao_consultado") return [String(s.motivo ?? "A fonte não respondeu. Nenhum resultado foi obtido.")];
  switch (tool) {
    case "receita":
      return [`Situação cadastral: ${s.situacao_cadastral ?? "-"}`, `Razão social: ${s.razao_social ?? "-"}`, `Sócios no quadro: ${s.socios_qtd ?? 0}`];
    case "blacklist":
      return [s.encontrado ? `Consta na Black List V3 (${s.ocorrencias} ocorrência(s))` : "Não consta na Black List V3"];
    case "escavador":
      return [status === "sem_dados" ? "Nenhum processo encontrado" : `Processos encontrados: ${s.total_processos}`];
    case "datajud":
      return status === "sem_dados"
        ? ["Nenhum processo encontrado nos tribunais consultados"]
        : [
            `Processos encontrados: ${s.total_processos}`,
            ...(Array.isArray(s.tribunais) ? [(s.tribunais as { sigla: string; qtd: number }[]).map((t) => `${t.sigla} ${t.qtd}`).join(" · ")] : []),
          ];
    case "scr_cnpj":
    case "scr_cpf": {
      if (status === "sem_dados") return ["Sem dados para calcular no SCR (não é o mesmo que sem passivo)"];
      const passivo = [s.credito_vencido_valor, s.prejuizo_valor].some((v) => v && String(v).replace(/[^0-9]/g, "").replace(/^0+$/, ""));
      return [
        `Score: ${s.score_pontuacao ?? "-"} (${s.score_faixa ?? "-"})`,
        `Crédito vencido: ${s.credito_vencido_valor ?? "-"} · Prejuízo: ${s.prejuizo_valor ?? "-"}`,
        `A vencer: ${s.credito_a_vencer_valor ?? "-"} · Limite: ${s.limite_credito_valor ?? "-"}`,
        passivo ? "ATENÇÃO: há passivo registrado no SCR" : "SCR sem passivo vencido ou em prejuízo informado",
      ];
    }
  }
}
