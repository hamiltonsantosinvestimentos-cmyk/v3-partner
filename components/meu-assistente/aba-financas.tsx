"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CATEGORIAS, VALOR_MAX_CENTAVOS, VALOR_MIN_CENTAVOS, centavosDaMascara, dataBrParaIso, dataIsoParaBr, formatarReais, hojeBrasilia,
  mascaraDataBr, mascaraDeCentavos, mesesRecentes, rotuloMes,
} from "@/lib/assistente/formato";
import { chamarApi, classeBotao, classeBotaoPerigo, classeBotaoSecundario, classeCampo, classeRotulo, ModalPerigo } from "./ui";

type Lancamento = { id: string; tipo: "entrada" | "saida"; valor_centavos: number; categoria: string; descricao: string | null; data: string; origem: string };
type Formulario = { id: string | null; tipo: "entrada" | "saida"; valor: string; categoria: string; descricao: string; data: string };

const novoFormulario = (): Formulario => ({ id: null, tipo: "saida", valor: "", categoria: "Outros", descricao: "", data: dataIsoParaBr(hojeBrasilia()) });

export function AbaFinancas() {
  const meses = useMemo(() => mesesRecentes(24), []);
  const [mes, setMes] = useState(meses[0]);
  const [itens, setItens] = useState<Lancamento[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [form, setForm] = useState<Formulario | null>(null);
  const [erroForm, setErroForm] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState<Lancamento | null>(null);

  const carregar = useCallback(async () => {
    try {
      const d = await chamarApi<{ lancamentos: Lancamento[] }>(`/api/assistente/lancamentos?mes=${mes}`);
      setItens(d.lancamentos);
      setErro(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao carregar.");
    }
  }, [mes]);

  useEffect(() => { void carregar(); }, [carregar]);

  const totais = useMemo(() => {
    let entradas = 0;
    let saidas = 0;
    for (const i of itens ?? []) {
      if (i.tipo === "entrada") entradas += Number(i.valor_centavos);
      else saidas += Number(i.valor_centavos);
    }
    return { entradas, saidas, saldo: entradas - saidas };
  }, [itens]);

  const salvar = async () => {
    if (!form) return;
    const valor_centavos = centavosDaMascara(form.valor);
    if (valor_centavos < VALOR_MIN_CENTAVOS || valor_centavos > VALOR_MAX_CENTAVOS) {
      setErroForm("O valor precisa ficar entre R$ 0,01 e R$ 10.000.000,00.");
      return;
    }
    const data = dataBrParaIso(form.data);
    if (!data) {
      setErroForm("Informe a data em DD/MM/AAAA.");
      return;
    }
    setSalvando(true);
    setErroForm(null);
    try {
      await chamarApi("/api/assistente/lancamentos", {
        method: form.id ? "PATCH" : "POST",
        body: JSON.stringify({ ...(form.id ? { id: form.id } : {}), tipo: form.tipo, valor_centavos, categoria: form.categoria, descricao: form.descricao.trim() || null, data }),
      });
      setForm(null);
      await carregar();
    } catch (e) {
      setErroForm(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <label className={classeRotulo} htmlFor="assistente-mes">Mês</label>
          <select id="assistente-mes" className={classeCampo} value={mes} onChange={(e) => setMes(e.target.value)}>
            {meses.map((m) => <option key={m} value={m}>{rotuloMes(m)}</option>)}
          </select>
        </div>
        <button type="button" className={classeBotao} onClick={() => { setErroForm(null); setForm(novoFormulario()); }}>Novo lançamento</button>
      </div>

      {erro && <p className="text-[12px] text-red-300" role="alert">{erro}</p>}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[["Entradas", totais.entradas], ["Saídas", totais.saidas], ["Saldo", totais.saldo]].map(([rotulo, valor]) => (
          <div key={rotulo as string} className="rounded-xl border border-[#243A66] bg-[#162744] p-4">
            <p className={classeRotulo}>{rotulo}</p>
            <p className="text-[22px] font-semibold text-[#F0ECE4]">{formatarReais(valor as number)}</p>
          </div>
        ))}
      </div>

      {form && (
        <section className="rounded-xl border border-[#C9A84C]/40 bg-[#162744] p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={classeRotulo}>Tipo</label>
              <select className={classeCampo} value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value as Formulario["tipo"] })}>
                <option value="entrada">Entrada</option>
                <option value="saida">Saída</option>
              </select>
            </div>
            <div>
              <label className={classeRotulo}>Valor (R$)</label>
              <input className={classeCampo} inputMode="numeric" placeholder="0,00" value={form.valor}
                onChange={(e) => { const c = centavosDaMascara(e.target.value); setForm({ ...form, valor: c ? mascaraDeCentavos(c) : "" }); }} />
            </div>
            <div>
              <label className={classeRotulo}>Categoria</label>
              <select className={classeCampo} value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })}>
                {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className={classeRotulo}>Data</label>
              <input className={classeCampo} inputMode="numeric" placeholder="DD/MM/AAAA" value={form.data}
                onChange={(e) => setForm({ ...form, data: mascaraDataBr(e.target.value) })} />
            </div>
          </div>
          <div>
            <label className={classeRotulo}>Descrição (opcional)</label>
            <input className={classeCampo} maxLength={300} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
          </div>
          {erroForm && <p className="text-[12px] text-red-300" role="alert">{erroForm}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" className={classeBotaoSecundario} disabled={salvando} onClick={() => setForm(null)}>Cancelar</button>
            <button type="button" className={classeBotao} disabled={salvando} onClick={salvar}>{salvando ? "Salvando..." : "Salvar"}</button>
          </div>
        </section>
      )}

      {itens && itens.length === 0 && (
        <p className="text-[13px] text-[#7A8FA8]">Nenhum lançamento neste mês. Envie algo como: paguei 85 no mercado.</p>
      )}
      <ul className="space-y-2">
        {(itens ?? []).map((i) => (
          <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#243A66] bg-[#111F35] px-3 py-2">
            <div className="min-w-0">
              <p className="text-[14px] text-[#F0ECE4]">{i.tipo === "entrada" ? "Entrada" : "Saída"} de {formatarReais(Number(i.valor_centavos))} em {i.categoria}</p>
              <p className="text-[12px] text-[#7A8FA8] truncate">{dataIsoParaBr(i.data)}{i.descricao ? `, ${i.descricao}` : ""}{i.origem === "whatsapp" ? ", pelo WhatsApp" : ""}</p>
            </div>
            <div className="flex gap-2">
              <button type="button" className={classeBotaoSecundario} onClick={() => {
                setErroForm(null);
                setForm({ id: i.id, tipo: i.tipo, valor: mascaraDeCentavos(Number(i.valor_centavos)), categoria: i.categoria, descricao: i.descricao ?? "", data: dataIsoParaBr(i.data) });
              }}>Editar</button>
              <button type="button" className={classeBotaoPerigo} onClick={() => setExcluindo(i)}>Excluir</button>
            </div>
          </li>
        ))}
      </ul>

      {excluindo && (
        <ModalPerigo titulo="Excluir lançamento" botao="Excluir" onCancelar={() => setExcluindo(null)}
          onConfirmar={async () => {
            await chamarApi(`/api/assistente/lancamentos?id=${excluindo.id}`, { method: "DELETE" });
            setExcluindo(null);
            await carregar();
          }}>
          <p>O lançamento de {formatarReais(Number(excluindo.valor_centavos))} em {excluindo.categoria}, de {dataIsoParaBr(excluindo.data)}, será apagado e sai dos totais do mês. Não dá para desfazer.</p>
        </ModalPerigo>
      )}
    </div>
  );
}
