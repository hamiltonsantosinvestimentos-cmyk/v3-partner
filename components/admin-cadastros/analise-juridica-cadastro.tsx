"use client";

// Card "Análise jurídica (CheckTudo)" no modal do cadastro de partner
// (BRIEF docs/briefs/2026-11-10_analise-juridica-cadastro-partner.md). Consulta sob demanda, paga,
// com modal vermelho de confirmação. Mostra só os totais; CPF mascarado, CNPJ completo.

import { useEffect, useState } from "react";
import { Loader2, Scale, Info } from "lucide-react";
import { confirmar } from "@/lib/aviso";
import { cn } from "@/lib/utils";
import {
  AVISO_RECONSULTA_MS, dataHoraBR, documentosDoEscopo, resumoJuridico, temCpf,
  type CadastroJuridico, type TotaisJuridico,
} from "@/lib/analise-juridica-cadastro";

type Consulta = {
  id: string;
  doc_tipo: "cpf" | "cnpj";
  doc_mascarado: string;
  escopo: string;
  ok: boolean;
  resultado: TotaisJuridico | null;
  erro: string | null;
  consultado_por_nome: string | null;
  consultado_em: string;
};

export function AnaliseJuridicaCadastro({ registrationId, cadastro }: { registrationId: string; cadastro: CadastroJuridico }) {
  const isPJ = cadastro.tipo_pessoa === "PJ";
  const semCpf = !temCpf(cadastro);
  const [escopo, setEscopo] = useState<"PJ_PF" | "PF">(isPJ ? "PJ_PF" : "PF");
  const [consultas, setConsultas] = useState<Consulta[] | null>(null);
  const [rodando, setRodando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/admin/cadastros/analise-juridica?registration_id=${registrationId}`)
      .then((r) => r.json())
      .then((j) => setConsultas(j.consultas ?? []))
      .catch(() => setConsultas([]));
  }, [registrationId]);

  async function consultar() {
    if (rodando) return;
    setErro(null);
    const plano = documentosDoEscopo(cadastro, escopo);
    if (!plano.ok) { setErro(plano.erro); return; }
    // Trava antes do modal: dois cliques não abrem dois modais nem duas consultas pagas.
    setRodando(true);
    const lista = plano.documentos.map((d) => `${d.tipo === "cnpj" ? "CNPJ" : "CPF"} ${d.exibicao} (${d.nome})`).join(" e ");
    const recente = (consultas ?? []).find((c) => Date.now() - new Date(c.consultado_em).getTime() < AVISO_RECONSULTA_MS);
    const ok = await confirmar(
      `Cada documento é uma consulta cobrada pelo CheckTudo e fica registrada com o seu nome.\n\nSerão consultados: ${lista}.${recente ? `\n\nJá existe consulta deste cadastro em ${dataHoraBR(recente.consultado_em)}; o resultado está abaixo.` : ""}`,
      { perigo: true, titulo: "Consultar processos no CheckTudo", botao: "Consultar" },
    );
    if (!ok) { setRodando(false); return; }
    try {
      const res = await fetch("/api/admin/cadastros/analise-juridica", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registration_id: registrationId, escopo }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) setErro(j.error ?? "Não foi possível consultar.");
      else setConsultas((prev) => [...(j.consultas ?? []), ...(prev ?? [])]);
    } catch {
      setErro("Erro de conexão.");
    } finally {
      setRodando(false);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        <Scale className="w-3.5 h-3.5 text-[#C9A84C]" />
        <p className="text-xs font-semibold text-[#C9A84C] uppercase tracking-wide">Análise jurídica (CheckTudo)</p>
        <span title="Consulta processos judiciais em que a pessoa ou a empresa é ré ou autora, para apoiar a decisão de aprovar o partner. Não aprova nem reprova sozinha.">
          <Info className="w-3.5 h-3.5 text-muted-foreground" />
        </span>
      </div>

      <div className="p-3 rounded-lg bg-[#0D1929] border border-[#243A66] space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {isPJ && (
            <>
              <button
                type="button"
                onClick={() => setEscopo("PJ_PF")}
                className={cn("px-2.5 py-1.5 rounded-md text-[11px] font-semibold border", escopo === "PJ_PF" ? "bg-[#C9A84C]/15 border-[#C9A84C] text-[#C9A84C]" : "border-[#243A66] text-muted-foreground")}
              >
                {semCpf ? "Somente PJ" : "PJ + PF"}
              </button>
              <button
                type="button"
                onClick={() => setEscopo("PF")}
                disabled={semCpf}
                title={semCpf ? "Este cadastro não tem CPF do representante" : undefined}
                className={cn("px-2.5 py-1.5 rounded-md text-[11px] font-semibold border disabled:opacity-40", escopo === "PF" ? "bg-[#C9A84C]/15 border-[#C9A84C] text-[#C9A84C]" : "border-[#243A66] text-muted-foreground")}
              >
                Somente PF
              </button>
            </>
          )}
          <button
            type="button"
            onClick={consultar}
            disabled={rodando}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#C9A84C] hover:bg-[#E8C97A] text-[#09081A] text-[11px] font-bold disabled:opacity-50"
          >
            {rodando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Scale className="w-3.5 h-3.5" />}
            {isPJ ? "Consultar" : "Consultar CPF"}
          </button>
        </div>
        {isPJ && semCpf && <p className="text-[11px] text-muted-foreground">Este cadastro não tem CPF do representante.</p>}
        {erro && <p className="text-[11px] text-[#E24B4A]">{erro}</p>}

        {consultas === null ? (
          <p className="text-[11px] text-muted-foreground">Carregando...</p>
        ) : consultas.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">Nenhuma análise jurídica feita para este cadastro.</p>
        ) : (
          <div className="space-y-2">
            {consultas.map((c) => {
              const r = resumoJuridico(c.resultado);
              return (
                <div key={c.id} className="p-2.5 rounded-md bg-[#09081A] border border-[#162744] text-[11px] space-y-0.5">
                  <p className="font-semibold text-[#F0ECE4]">{c.doc_tipo === "cnpj" ? "CNPJ" : "CPF"} {c.doc_mascarado}</p>
                  {c.ok ? (
                    <>
                      <p className="text-[#7A8FA8]">Processos: <span className="text-[#F0ECE4]">{r.processos}</span></p>
                      <p className="text-[#7A8FA8]">Como réu: <span className="text-[#F0ECE4]">{r.reu}</span></p>
                      <p className="text-[#7A8FA8]">Como autor: <span className="text-[#F0ECE4]">{r.autor}</span></p>
                    </>
                  ) : (
                    <p className="text-[#E24B4A]">Não foi possível consultar: {c.erro ?? "motivo não informado"}</p>
                  )}
                  <p className="text-muted-foreground">Consultado em {dataHoraBR(c.consultado_em)}{c.consultado_por_nome ? ` por ${c.consultado_por_nome}` : ""}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
