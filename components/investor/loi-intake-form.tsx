"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

interface LoiIntakeContext {
  deal_code: string;
  investor_name: string;
  ativo_descricao: string;
  volume_descricao: string;
  condicao_comercial: string;
  escopo_logistico: string;
  valor_total: string;
  valor_total_extenso: string;
  prefill: { email: string };
}

const CAMPOS: { key: string; label: string; placeholder: string }[] = [
  { key: "nome_interessada", label: "Nome do interessado (representante)", placeholder: "Ex: Sidiney Dalmolin" },
  { key: "razao_social", label: "Razão social da empresa compradora", placeholder: "Ex: Dalmolin Recicláveis Ltda" },
  { key: "cnpj", label: "CNPJ da empresa", placeholder: "00.000.000/0000-00" },
  { key: "endereco_completo", label: "Endereço completo da sede", placeholder: "Rua, número, bairro, cidade, UF, CEP" },
  { key: "nome_completo_socio", label: "Nome completo do sócio assinante", placeholder: "Nome que constará na assinatura digital" },
  { key: "nacionalidade", label: "Nacionalidade", placeholder: "Ex: brasileiro" },
  { key: "profissao", label: "Profissão", placeholder: "Ex: empresário" },
  { key: "estado_civil", label: "Estado civil", placeholder: "Ex: casado" },
  { key: "cpf", label: "CPF do sócio assinante", placeholder: "000.000.000-00" },
  { key: "email", label: "Email do sócio assinante (recebe a assinatura digital)", placeholder: "email@empresa.com.br" },
  { key: "local", label: "Local de assinatura", placeholder: "Ex: Navegantes, SC" },
];

export function LoiIntakeForm({ token, context }: { token: string; context: LoiIntakeContext }) {
  const [form, setForm] = useState<Record<string, string>>({ email: context.prefill.email ?? "" });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleChange = (key: string, value: string) => setForm(prev => ({ ...prev, [key]: value }));

  const handleSubmit = async () => {
    setError("");
    setSending(true);
    try {
      const res = await fetch(`/api/investor/loi-intake/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
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
  };

  if (success) {
    return (
      <div className="text-center py-10">
        <h2 className="text-xl font-bold text-[#F5F1E8] mb-3">Carta de Intenção enviada</h2>
        <p className="text-sm text-[#9BAFC5] max-w-md mx-auto">
          A Carta de Intenção foi gerada e enviada para assinatura digital no email {form.email}, via ClickSign. Assim que a assinatura for confirmada, o acesso ao Deal Room é liberado automaticamente.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="bg-[#162744] border-l-2 border-[#C9A84C] rounded-sm px-5 py-4 mb-8">
        <p className="text-[9px] font-bold tracking-widest uppercase text-[#E8C97A] mb-2">{context.deal_code}</p>
        <p className="text-sm text-[#9BAFC5] leading-relaxed">{context.ativo_descricao}, no valor total de <strong className="text-[#F5F1E8]">{context.valor_total}</strong> ({context.valor_total_extenso}).</p>
      </div>

      <p className="text-sm text-[#9BAFC5] mb-6">
        Preencha os dados legais da empresa compradora abaixo. Ao enviar, a Carta de Intenção é gerada e encaminhada para assinatura digital via ClickSign no email informado.
      </p>

      <div className="space-y-5">
        {CAMPOS.map(campo => (
          <div key={campo.key}>
            <label className="block text-[10px] font-bold tracking-wide uppercase text-[#E8C97A] mb-2">{campo.label}</label>
            <input
              type="text"
              value={form[campo.key] ?? ""}
              onChange={e => handleChange(campo.key, e.target.value)}
              placeholder={campo.placeholder}
              className="w-full bg-[#13223A] border border-[#243A66] rounded-md px-4 py-3 text-sm text-[#F5F1E8] placeholder:text-[#9BAFC5]/40 focus:outline-none focus:border-[#C9A84C]"
            />
          </div>
        ))}
      </div>

      {error && <p className="text-sm text-red-400 mt-6">{error}</p>}

      <button
        onClick={handleSubmit}
        disabled={sending}
        className="w-full mt-8 bg-[#C9A84C] text-[#09081A] font-bold text-sm py-3.5 rounded-md hover:bg-[#E8C97A] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {sending && <Loader2 className="w-4 h-4 animate-spin" />}
        Enviar para assinatura digital
      </button>
    </div>
  );
}
