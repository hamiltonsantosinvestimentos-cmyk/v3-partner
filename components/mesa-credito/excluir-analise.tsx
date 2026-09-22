"use client";

import { useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

// Botão "Excluir análise" (só ADMIN/GESTAO): apaga as análises da proposta (score, Serasa, BACEN,
// processos, restrições), os dossiês em PDF e o relatório/link do cliente. A comissão já gerada não
// é desfeita. Depois disso volta a aparecer "Rodar análise". Ver lib/credit-analysis-delete.ts.

interface Impacto {
  cliente: string | null;
  analises: { id: string }[];
  comissao_gerada: boolean;
  relatorio_entregue: boolean;
  relatorio_publicado: boolean;
}

export function ExcluirAnalise({
  proposalId,
  nome,
  onDeleted,
}: {
  proposalId: string;
  nome: string;
  onDeleted: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function excluir() {
    setBusy(true);
    setErro(null);
    try {
      // 1) Mostra o que será apagado (não altera nada)
      const prev = await fetch(`/api/credit-engine/analysis?proposal_id=${proposalId}`);
      const imp: Impacto & { error?: string } = await prev.json();
      if (!prev.ok) throw new Error(imp.error ?? "Não foi possível verificar a análise");

      const n = imp.analises.length;
      const linhas = [
        `Excluir a análise de "${nome}"?`,
        "",
        `Serão apagados: ${n} registro(s) de análise (score, Serasa, BACEN, processos e restrições) e os dossiês em PDF.`,
      ];
      if (imp.relatorio_publicado) {
        linhas.push(imp.relatorio_entregue
          ? "O relatório JÁ FOI ENVIADO ao cliente: o link dele deixará de funcionar."
          : "O link do relatório deixará de funcionar.");
      }
      if (imp.comissao_gerada) linhas.push("A comissão já gerada NÃO será desfeita (segue no fluxo de autorização).");
      linhas.push("", "Para ter a análise de novo será preciso rodar outra consulta, com o custo das fontes pagas.", "Esta ação não pode ser desfeita.");
      if (!window.confirm(linhas.join("\n"))) return;

      // 2) Exclui
      const res = await fetch(`/api/credit-engine/analysis?proposal_id=${proposalId}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Falha ao excluir a análise");
      onDeleted();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-1">
      <Button
        size="sm"
        variant="outline"
        disabled={busy}
        onClick={excluir}
        className="w-full border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300"
      >
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
        Excluir análise
      </Button>
      {erro && <p className="text-[11px] text-red-400">{erro}</p>}
    </div>
  );
}
