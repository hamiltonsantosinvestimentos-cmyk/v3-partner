"use client";

import { Fragment, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, ChevronRight, Loader2, Send, Check } from "lucide-react";
import type { RelatorioMensal, RelatorioPartner } from "@/lib/relatorio-mensal-partners";

const brl = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

/** Últimos 12 meses (o atual incluído, parcial) para o seletor. */
function ultimosMeses(): { chave: string; label: string }[] {
  const out: { chave: string; label: string }[] = [];
  const d = new Date();
  for (let i = 0; i < 12; i++) {
    const x = new Date(d.getFullYear(), d.getMonth() - i, 15);
    out.push({
      chave: `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`,
      label: x.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }) + (i === 0 ? " (parcial)" : ""),
    });
  }
  return out;
}

function Kpi({ label, valor, sub }: { label: string; valor: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-border/50 bg-card p-4">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-xl font-bold text-white mt-1">{valor}</p>
      {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

function DetalhePartner({ r }: { r: RelatorioPartner }) {
  const m = r.mes;
  const c = r.comissao;
  const pct = (n: number) => (m.enviadas ? ` · ${Math.round((n / m.enviadas) * 100)}%` : "");
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Enviadas no mês" valor={String(m.enviadas)} sub={brl(m.valorTotal)} />
        <Kpi label="Foram para análise" valor={String(m.foramParaAnalise)} sub={`das enviadas${pct(m.foramParaAnalise)}`} />
        <Kpi label="Checklist completo" valor={String(m.checklistCompleto)} sub={`das enviadas${pct(m.checklistCompleto)}`} />
        <Kpi label="Ticket médio" valor={brl(m.ticketMedio)} />
        <Kpi label="Aprovadas" valor={String(m.aprovadas)} sub={m.emAprovacao ? `${m.emAprovacao} em aprovação` : undefined} />
        <Kpi label="Liberadas" valor={String(m.liberadas)} sub={m.liberadas ? `${brl(m.valorLiberado)} liberados` : undefined} />
        <Kpi label="Pendência de docs" valor={String(m.pendenciaDocs)} sub={m.recusadas ? `${m.recusadas} reprovada(s)/declinada(s)` : undefined} />
        <Kpi label="Conversão" valor={m.taxaConversao == null ? "—" : `${m.taxaConversao.toFixed(0)}%`} sub="liberadas / enviadas" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Kpi label="Comissão do mês" valor={brl(c.doMes)} sub={`${brl(c.doMesPaga)} paga · ${brl(c.doMesAReceber)} a receber`} />
        <Kpi
          label="Previsão de comissão (aprovadas)"
          valor={c.previsaoSemPercentual ? "A definir" : brl(c.previsaoAprovadas)}
          sub={`${c.propostasNaPrevisao} aprovada(s) a liberar${c.aprovadasSemPercentual ? ` · ${c.aprovadasSemPercentual} sem % de comissão` : ""}`}
        />
        <Kpi label="Comissão acumulada" valor={brl(c.acumulada)} sub={`${brl(c.acumuladaPaga)} paga · ${brl(c.acumuladaAReceber)} a receber`} />
      </div>

      <div className="rounded-xl border border-border/50 bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/50">
              {["Código", "Cliente", "Linha", "Valor", "Etapa", "Análise", "Checklist", "Enviada em"].map((h) => (
                <th key={h} className="text-left px-3 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {r.propostasMes.length === 0 && (
              <tr><td colSpan={8} className="px-3 py-6 text-center text-xs text-muted-foreground">Nenhuma proposta enviada neste mês.</td></tr>
            )}
            {r.propostasMes.map((p) => (
              <tr key={p.id} className="border-b border-border/30">
                <td className="px-3 py-2 font-mono text-xs text-[#C9A84C] whitespace-nowrap">{p.code ?? "—"}</td>
                <td className="px-3 py-2 text-foreground">{p.cliente}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{p.linha ?? "—"}</td>
                <td className="px-3 py-2 text-right font-semibold text-white whitespace-nowrap">{brl(p.valor)}</td>
                <td className="px-3 py-2 text-xs whitespace-nowrap">{p.estagioLabel}</td>
                <td className="px-3 py-2 text-xs">{p.foiParaAnalise ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : "—"}</td>
                <td className="px-3 py-2 text-xs">{p.checklistCompleto ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : "—"}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">{new Date(p.criadaEm).toLocaleDateString("pt-BR")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {r.carteira.porEstagio.length > 0 && (
        <div className="rounded-xl border border-border/50 bg-card p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Carteira em aberto (todas as propostas) · {r.carteira.emAberto} · {brl(r.carteira.valorEmAberto)}
          </p>
          <div className="flex flex-wrap gap-2">
            {r.carteira.porEstagio.map((e) => (
              <span key={e.estagio} className="text-xs rounded-lg border border-border/50 px-2.5 py-1 text-foreground">
                {e.label}: <strong>{e.qtd}</strong> <span className="text-muted-foreground">({brl(e.valor)})</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function RelatorioMensalClient({ rel, equipe, podeReenviar }: { rel: RelatorioMensal; equipe: boolean; podeReenviar: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const [aberto, setAberto] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const t = rel.totais;

  function trocarMes(chave: string) {
    const p = new URLSearchParams(params.toString());
    p.set("mes", chave);
    router.push(`/mesa-credito/relatorio-mensal?${p.toString()}`);
  }

  async function reenviar() {
    if (!window.confirm(`Enviar agora os e-mails de ${rel.periodo.label} para os partners e para os sócios?`)) return;
    setEnviando(true);
    setMsg(null);
    try {
      const res = await fetch("/api/mesa-credito/relatorio-mensal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mes: rel.periodo.chave }),
      });
      const j = await res.json();
      setMsg(res.ok ? `Enviado para ${j.partners} partner(s) e ${j.socios} sócio(s).` : j.error ?? "Falha ao enviar.");
    } catch {
      setMsg("Erro de conexão.");
    } finally {
      setEnviando(false);
    }
  }

  const meses = ultimosMeses();
  const unico = !equipe ? rel.partners[0] : null;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={rel.periodo.chave}
          onChange={(e) => trocarMes(e.target.value)}
          className="h-9 px-3 text-sm bg-secondary border border-border rounded-lg text-foreground capitalize"
        >
          {!meses.some((m) => m.chave === rel.periodo.chave) && <option value={rel.periodo.chave}>{rel.periodo.label}</option>}
          {meses.map((m) => <option key={m.chave} value={m.chave} className="capitalize">{m.label}</option>)}
        </select>
        {podeReenviar && (
          <button
            onClick={reenviar}
            disabled={enviando}
            className="h-9 px-3 rounded-lg border border-[#C9A84C]/40 text-[#C9A84C] text-xs font-semibold flex items-center gap-1.5 hover:bg-[#C9A84C]/10 disabled:opacity-50"
          >
            {enviando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            Enviar e-mails deste mês
          </button>
        )}
        {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
      </div>

      {!equipe && (unico ? <DetalhePartner r={unico} /> : <p className="text-sm text-muted-foreground">Sem dados para este mês.</p>)}

      {equipe && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Kpi label="Propostas enviadas" valor={String(t.enviadas)} sub={brl(t.valorTotal)} />
            <Kpi label="Partners com envio" valor={String(t.partnersAtivos)} sub={`${rel.partners.length} no relatório`} />
            <Kpi label="Foram para análise" valor={String(t.foramParaAnalise)} sub={`${t.checklistCompleto} com checklist completo`} />
            <Kpi label="Aprovadas / liberadas" valor={`${t.aprovadas} / ${t.liberadas}`} sub={t.liberadas ? `${brl(t.valorLiberado)} liberados` : undefined} />
            <Kpi label="Comissão do mês" valor={brl(t.comissaoMes)} />
            <Kpi label="Previsão (aprovadas)" valor={brl(t.previsaoAprovadas)} />
            <Kpi label="Comissão acumulada" valor={brl(t.comissaoAcumulada)} />
          </div>

          <div className="rounded-xl border border-border/50 bg-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50">
                  {["", "Partner", "Plano", "Enviadas", "Valor", "Análise", "Checklist", "Aprov./Lib.", "Comissão mês", "Previsão", "Acumulada"].map((h) => (
                    <th key={h} className="text-left px-3 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rel.partners.length === 0 && (
                  <tr><td colSpan={11} className="px-3 py-8 text-center text-xs text-muted-foreground">Nenhum partner com movimento.</td></tr>
                )}
                {rel.partners.map((r) => {
                  const open = aberto === r.partner.id;
                  return (
                    <Fragment key={r.partner.id}>
                      <tr
                        onClick={() => setAberto(open ? null : r.partner.id)}
                        className="border-b border-border/30 cursor-pointer hover:bg-secondary/40"
                      >
                        <td className="pl-3 py-2 text-muted-foreground">{open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}</td>
                        <td className="px-3 py-2 font-medium text-foreground">{r.partner.nome}</td>
                        <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">{r.partner.plano}</td>
                        <td className="px-3 py-2">{r.mes.enviadas}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{brl(r.mes.valorTotal)}</td>
                        <td className="px-3 py-2">{r.mes.foramParaAnalise}</td>
                        <td className="px-3 py-2">{r.mes.checklistCompleto}</td>
                        <td className="px-3 py-2">{r.mes.aprovadas}/{r.mes.liberadas}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{brl(r.comissao.doMes)}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{r.comissao.previsaoSemPercentual ? "a definir" : brl(r.comissao.previsaoAprovadas)}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{brl(r.comissao.acumulada)}</td>
                      </tr>
                      {open && (
                        <tr className="border-b border-border/30 bg-secondary/20">
                          <td colSpan={11} className="p-4"><DetalhePartner r={r} /></td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      <p className="text-[11px] text-muted-foreground">
        Previsão de comissão = créditos aprovados (botão Aprovar) com % de mandato e instituição preenchidos, ainda não liberados, pela regra do plano do partner.
        Comissão do mês/acumulada = comissões geradas (sem as canceladas). Checklist completo = "Docs/Checklist OK" confirmado pela Mesa Operacional.
      </p>
    </div>
  );
}
