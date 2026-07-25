"use client";

import { useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";

interface Participante {
  nome: string;
  cpf_cnpj: string;
  email: string;
  bluepay_pix: string;
  valor_bruto: string;
}

function novoParticipante(): Participante {
  return { nome: "", cpf_cnpj: "", email: "", bluepay_pix: "", valor_bruto: "" };
}

export function FpaIntakeForm({
  token,
  apiPath,
  dealCode,
  withValor = false,
  withSignature = false,
  deducaoPercent,
}: {
  token: string;
  apiPath: "fpa-venda-intake" | "fpa-compra-intake";
  dealCode: string;
  withValor?: boolean;
  withSignature?: boolean;
  deducaoPercent?: number;
}) {
  const [participantes, setParticipantes] = useState<Participante[]>([novoParticipante()]);
  const [local, setLocal] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  function updateParticipante(idx: number, key: keyof Participante, value: string) {
    setParticipantes(prev => prev.map((p, i) => (i === idx ? { ...p, [key]: value } : p)));
  }

  function addParticipante() {
    setParticipantes(prev => [...prev, novoParticipante()]);
  }

  function removeParticipante(idx: number) {
    setParticipantes(prev => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev));
  }

  async function handleSubmit() {
    setError("");
    if (withValor && local.trim() === "") {
      setError("Campo obrigatório ausente: local de assinatura.");
      return;
    }
    setSending(true);
    try {
      const payload = withValor
        ? { participantes: participantes.map(p => ({ ...p, valor_bruto: Number(p.valor_bruto) })), local }
        : { participantes };
      const res = await fetch(`/api/investor/${apiPath}/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Erro ao enviar formulário");
        setSending(false);
        return;
      }
      setSuccess(true);
    } catch {
      setError("Erro de conexão");
    } finally {
      setSending(false);
    }
  }

  if (success) {
    return (
      <div className="text-center py-10">
        <h2 className="text-xl font-bold text-[#F5F1E8] mb-3">Cadastro enviado</h2>
        <p className="text-sm text-[#9BAFC5] max-w-md mx-auto">
          {withSignature
            ? "Os dados foram registrados e o documento foi encaminhado para assinatura digital via ClickSign, para o email de cada participante."
            : "O cadastro dos comissionados foi registrado com sucesso."}
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="bg-[#162744] border-l-2 border-[#C9A84C] rounded-sm px-5 py-4 mb-8">
        <p className="text-[9px] font-bold tracking-widest uppercase text-[#E8C97A] mb-2">{dealCode}</p>
        <p className="text-sm text-[#9BAFC5] leading-relaxed">
          Cadastre cada participante abaixo.
          {withValor && deducaoPercent != null && (
            <> Sobre o valor bruto de cada um incide dedução fixa de <strong className="text-[#F5F1E8]">{deducaoPercent}%</strong>.</>
          )}
        </p>
      </div>

      <div className="space-y-6">
        {participantes.map((p, idx) => (
          <div key={idx} className="bg-[#13223A] border border-[#243A66] rounded-md p-5 relative">
            {participantes.length > 1 && (
              <button
                onClick={() => removeParticipante(idx)}
                className="absolute top-3 right-3 text-[#9BAFC5] hover:text-red-400"
                aria-label="Remover participante"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <p className="text-[10px] font-bold tracking-wide uppercase text-[#E8C97A] mb-4">Participante {idx + 1}</p>
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold tracking-wide uppercase text-[#9BAFC5] mb-2">Nome completo</label>
                <input type="text" value={p.nome} onChange={e => updateParticipante(idx, "nome", e.target.value)}
                  className="w-full bg-[#09081A] border border-[#243A66] rounded-md px-4 py-2.5 text-sm text-[#F5F1E8] focus:outline-none focus:border-[#C9A84C]" />
              </div>
              <div>
                <label className="block text-[10px] font-bold tracking-wide uppercase text-[#9BAFC5] mb-2">CPF/CNPJ</label>
                <input type="text" value={p.cpf_cnpj} onChange={e => updateParticipante(idx, "cpf_cnpj", e.target.value)}
                  className="w-full bg-[#09081A] border border-[#243A66] rounded-md px-4 py-2.5 text-sm text-[#F5F1E8] focus:outline-none focus:border-[#C9A84C]" />
              </div>
              <div>
                <label className="block text-[10px] font-bold tracking-wide uppercase text-[#9BAFC5] mb-2">Email{withSignature && " (recebe assinatura digital)"}</label>
                <input type="text" value={p.email} onChange={e => updateParticipante(idx, "email", e.target.value)}
                  className="w-full bg-[#09081A] border border-[#243A66] rounded-md px-4 py-2.5 text-sm text-[#F5F1E8] focus:outline-none focus:border-[#C9A84C]" />
              </div>
              <div>
                <label className="block text-[10px] font-bold tracking-wide uppercase text-[#9BAFC5] mb-2">Chave PIX BluePay</label>
                <input type="text" value={p.bluepay_pix} onChange={e => updateParticipante(idx, "bluepay_pix", e.target.value)}
                  className="w-full bg-[#09081A] border border-[#243A66] rounded-md px-4 py-2.5 text-sm text-[#F5F1E8] focus:outline-none focus:border-[#C9A84C]" />
              </div>
              {withValor && (
                <div>
                  <label className="block text-[10px] font-bold tracking-wide uppercase text-[#9BAFC5] mb-2">Valor bruto (R$)</label>
                  <input type="number" value={p.valor_bruto} onChange={e => updateParticipante(idx, "valor_bruto", e.target.value)}
                    className="w-full bg-[#09081A] border border-[#243A66] rounded-md px-4 py-2.5 text-sm text-[#F5F1E8] focus:outline-none focus:border-[#C9A84C]" />
                  {deducaoPercent != null && Number(p.valor_bruto) > 0 && (
                    <p className="text-[11px] text-[#9BAFC5] mt-1.5">
                      Líquido após dedução de {deducaoPercent}%: R$ {(Number(p.valor_bruto) * (1 - deducaoPercent / 100)).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={addParticipante}
        className="flex items-center gap-2 text-sm text-[#C9A84C] font-semibold mt-4 hover:text-[#E8C97A]"
      >
        <Plus className="w-4 h-4" /> Adicionar participante
      </button>

      {withValor && (
        <div className="mt-6">
          <label className="block text-[10px] font-bold tracking-wide uppercase text-[#E8C97A] mb-2">Local de assinatura</label>
          <input type="text" value={local} onChange={e => setLocal(e.target.value)} placeholder="Ex: Rio de Janeiro, RJ"
            className="w-full bg-[#13223A] border border-[#243A66] rounded-md px-4 py-3 text-sm text-[#F5F1E8] placeholder:text-[#9BAFC5]/40 focus:outline-none focus:border-[#C9A84C]" />
        </div>
      )}

      {error && <p className="text-sm text-red-400 mt-6">{error}</p>}

      <button
        onClick={handleSubmit}
        disabled={sending}
        className="w-full mt-8 bg-[#C9A84C] text-[#09081A] font-bold text-sm py-3.5 rounded-md hover:bg-[#E8C97A] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {sending && <Loader2 className="w-4 h-4 animate-spin" />}
        {withSignature ? "Enviar para assinatura digital" : "Registrar cadastro"}
      </button>
    </div>
  );
}
