"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

interface ContratoVendaContext {
  deal_code: string;
  ativo_descricao: string;
  valor_liquido: string;
  prefill: { email: string };
}

const CAMPOS: { key: string; label: string; placeholder: string }[] = [
  { key: "razao_social_estaleiro", label: "Razão social do estaleiro/vendedor", placeholder: "Ex: Estaleiro Liessa Ltda" },
  { key: "cnpj_estaleiro", label: "CNPJ do estaleiro/vendedor", placeholder: "00.000.000/0000-00" },
  { key: "nome_representante", label: "Nome completo do representante legal assinante", placeholder: "Nome que constará na assinatura digital" },
  { key: "email", label: "Email do representante (recebe a assinatura digital)", placeholder: "email@empresa.com.br" },
  { key: "local", label: "Local de assinatura", placeholder: "Ex: Rio de Janeiro, RJ" },
];

export function ContratoVendaIntakeForm({ token, context }: { token: string; context: ContratoVendaContext }) {
  const [form, setForm] = useState<Record<string, string>>({ email: context.prefill.email ?? "" });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleChange = (key: string, value: string) => setForm(prev => ({ ...prev, [key]: value }));

  const handleSubmit = async () => {
    setError("");
    setSending(true);
    try {
      const res = await fetch(`/api/investor/contrato-venda-intake/${token}`, {
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
        <h2 className="text-xl font-bold text-[#F5F1E8] mb-3">Contrato de Venda enviado</h2>
        <p className="text-sm text-[#9BAFC5] max-w-md mx-auto">
          O Contrato de Compra e Venda foi gerado e enviado para assinatura digital no email {form.email}, via ClickSign.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="bg-[#162744] border-l-2 border-[#C9A84C] rounded-sm px-5 py-4 mb-8">
        <p className="text-[9px] font-bold tracking-widest uppercase text-[#E8C97A] mb-2">{context.deal_code}</p>
        <p className="text-sm text-[#9BAFC5] leading-relaxed">{context.ativo_descricao}, valor líquido ao vendedor: <strong className="text-[#F5F1E8]">{context.valor_liquido}</strong>.</p>
      </div>

      <p className="text-sm text-[#9BAFC5] mb-6">
        Preencha os dados legais do vendedor abaixo. Ao enviar, o Contrato de Compra e Venda é gerado e encaminhado para assinatura digital via ClickSign no email informado.
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
