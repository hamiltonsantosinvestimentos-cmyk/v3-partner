"use client";

import { useCallback, useEffect, useState } from "react";
import { dataBrParaIso, dataHoraBr, localBrasiliaParaIso, mascaraDataBr, mascaraHora, partesDataHoraBr } from "@/lib/assistente/formato";
import { chamarApi, classeBotao, classeBotaoPerigo, classeBotaoSecundario, classeCampo, classeRotulo, ModalPerigo } from "./ui";

type Compromisso = { id: string; titulo: string; inicio: string; fim: string | null; local: string | null; notas: string | null; origem: string };
type Formulario = { id: string | null; titulo: string; data: string; hora: string; dataFim: string; horaFim: string; local: string; notas: string };

const vazio: Formulario = { id: null, titulo: "", data: "", hora: "", dataFim: "", horaFim: "", local: "", notas: "" };

function paraIso(data: string, hora: string): string | null {
  const iso = dataBrParaIso(data);
  return iso ? localBrasiliaParaIso(`${iso}T${hora}`) : null;
}

export function AbaAgenda() {
  const [periodo, setPeriodo] = useState<"futuros" | "anteriores">("futuros");
  const [itens, setItens] = useState<Compromisso[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [form, setForm] = useState<Formulario | null>(null);
  const [erroForm, setErroForm] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState<Compromisso | null>(null);

  const carregar = useCallback(async () => {
    try {
      const d = await chamarApi<{ compromissos: Compromisso[] }>(`/api/assistente/compromissos?periodo=${periodo}`);
      setItens(d.compromissos);
      setErro(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao carregar.");
    }
  }, [periodo]);

  useEffect(() => { void carregar(); }, [carregar]);

  const salvar = async () => {
    if (!form) return;
    if (!form.titulo.trim()) { setErroForm("Informe o título."); return; }
    const inicio = paraIso(form.data, form.hora);
    if (!inicio) { setErroForm("Informe data em DD/MM/AAAA e horário em HH:mm."); return; }
    const temFim = !!(form.dataFim || form.horaFim);
    const fim = temFim ? paraIso(form.dataFim || form.data, form.horaFim) : null;
    if (temFim && !fim) { setErroForm("Confira a data e o horário de término."); return; }
    if (fim && new Date(fim) < new Date(inicio)) { setErroForm("O término não pode ser antes do início."); return; }
    setSalvando(true);
    setErroForm(null);
    try {
      await chamarApi("/api/assistente/compromissos", {
        method: form.id ? "PATCH" : "POST",
        body: JSON.stringify({ ...(form.id ? { id: form.id } : {}), titulo: form.titulo.trim(), inicio, fim, local: form.local.trim() || null, notas: form.notas.trim() || null }),
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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button type="button" className={classeBotaoSecundario} onClick={() => { setItens(null); setPeriodo(periodo === "futuros" ? "anteriores" : "futuros"); }}>
          {periodo === "futuros" ? "Ver anteriores" : "Ver futuros"}
        </button>
        <button type="button" className={classeBotao} onClick={() => { setErroForm(null); setForm({ ...vazio }); }}>Novo compromisso</button>
      </div>

      {erro && <p className="text-[12px] text-red-300" role="alert">{erro}</p>}

      {form && (
        <section className="rounded-xl border border-[#C9A84C]/40 bg-[#162744] p-4 space-y-3">
          <div>
            <label className={classeRotulo}>Título</label>
            <input className={classeCampo} maxLength={200} value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className={classeRotulo}>Data</label>
              <input className={classeCampo} inputMode="numeric" placeholder="DD/MM/AAAA" value={form.data} onChange={(e) => setForm({ ...form, data: mascaraDataBr(e.target.value) })} />
            </div>
            <div>
              <label className={classeRotulo}>Horário</label>
              <input className={classeCampo} inputMode="numeric" placeholder="HH:mm" value={form.hora} onChange={(e) => setForm({ ...form, hora: mascaraHora(e.target.value) })} />
            </div>
            <div>
              <label className={classeRotulo}>Data de término</label>
              <input className={classeCampo} inputMode="numeric" placeholder="DD/MM/AAAA" value={form.dataFim} onChange={(e) => setForm({ ...form, dataFim: mascaraDataBr(e.target.value) })} />
            </div>
            <div>
              <label className={classeRotulo}>Horário de término</label>
              <input className={classeCampo} inputMode="numeric" placeholder="HH:mm" value={form.horaFim} onChange={(e) => setForm({ ...form, horaFim: mascaraHora(e.target.value) })} />
            </div>
          </div>
          <div>
            <label className={classeRotulo}>Local (opcional)</label>
            <input className={classeCampo} maxLength={200} value={form.local} onChange={(e) => setForm({ ...form, local: e.target.value })} />
          </div>
          <div>
            <label className={classeRotulo}>Notas (opcional)</label>
            <textarea className={classeCampo} rows={2} maxLength={1000} value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} />
          </div>
          {erroForm && <p className="text-[12px] text-red-300" role="alert">{erroForm}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" className={classeBotaoSecundario} disabled={salvando} onClick={() => setForm(null)}>Cancelar</button>
            <button type="button" className={classeBotao} disabled={salvando} onClick={salvar}>{salvando ? "Salvando..." : "Salvar"}</button>
          </div>
        </section>
      )}

      {itens && itens.length === 0 && (
        <p className="text-[13px] text-[#7A8FA8]">
          {periodo === "futuros" ? "Nenhum compromisso futuro. Envie algo como: reunião com João terça às 15h." : "Nenhum compromisso anterior."}
        </p>
      )}
      <ul className="space-y-2">
        {(itens ?? []).map((c) => (
          <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#243A66] bg-[#111F35] px-3 py-2">
            <div className="min-w-0">
              <p className="text-[14px] text-[#F0ECE4]">{c.titulo}</p>
              <p className="text-[12px] text-[#7A8FA8] truncate">{dataHoraBr(c.inicio)}{c.fim ? ` até ${dataHoraBr(c.fim)}` : ""}{c.local ? `, ${c.local}` : ""}</p>
              {c.notas && <p className="text-[12px] text-[#7A8FA8]">{c.notas}</p>}
            </div>
            <div className="flex gap-2">
              <button type="button" className={classeBotaoSecundario} onClick={() => {
                const i = partesDataHoraBr(c.inicio);
                const f = c.fim ? partesDataHoraBr(c.fim) : null;
                setErroForm(null);
                setForm({ id: c.id, titulo: c.titulo, data: i.data, hora: i.hora, dataFim: f?.data ?? "", horaFim: f?.hora ?? "", local: c.local ?? "", notas: c.notas ?? "" });
              }}>Editar</button>
              <button type="button" className={classeBotaoPerigo} onClick={() => setExcluindo(c)}>Excluir</button>
            </div>
          </li>
        ))}
      </ul>

      {excluindo && (
        <ModalPerigo titulo="Excluir compromisso" botao="Excluir" onCancelar={() => setExcluindo(null)}
          onConfirmar={async () => {
            await chamarApi(`/api/assistente/compromissos?id=${excluindo.id}`, { method: "DELETE" });
            setExcluindo(null);
            await carregar();
          }}>
          <p>O compromisso &quot;{excluindo.titulo}&quot;, de {dataHoraBr(excluindo.inicio)}, será apagado. Não dá para desfazer.</p>
        </ModalPerigo>
      )}
    </div>
  );
}
