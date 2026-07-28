"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";

export default function QualificacaoIntakePage() {
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<"loading" | "ready" | "locked" | "error" | "success">("loading");
  const [data, setData] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [cpfCnpj, setCpfCnpj] = useState("");
  const [rg, setRg] = useState("");
  const [endereco, setEndereco] = useState("");
  const [banco, setBanco] = useState("");
  const [agencia, setAgencia] = useState("");
  const [conta, setConta] = useState("");
  const [tipoConta, setTipoConta] = useState("corrente");
  const [pixKey, setPixKey] = useState("");
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (!token) return;
    fetch(`/api/cm/qualificacao/${token}`)
      .then(async (res) => {
        const json = await res.json();
        if (res.status === 409) {
          setState("locked");
          setErrorMsg(json.message);
        } else if (!res.ok) {
          setState("error");
          setErrorMsg(json.error || "Link inválido");
        } else {
          setData(json);
          setState("ready");
        }
      })
      .catch(() => {
        setState("error");
        setErrorMsg("Erro de conexão");
      });
  }, [token]);

  const submit = async () => {
    setFormError("");
    if (!cpfCnpj.trim() || !rg.trim() || !endereco.trim()) {
      setFormError("CPF/CNPJ, RG e endereço completo são obrigatórios");
      return;
    }
    if (!pixKey.trim() && !banco.trim()) {
      setFormError("Informe ao menos dados bancários ou uma chave PIX");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/cm/qualificacao/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cpf_cnpj: cpfCnpj.trim(),
          rg: rg.trim(),
          endereco_completo: endereco.trim(),
          dados_bancarios: banco.trim() ? { banco: banco.trim(), agencia: agencia.trim(), conta: conta.trim(), tipo_conta: tipoConta } : null,
          pix_key: pixKey.trim() || null,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        setState("success");
      } else {
        setFormError(json.error ?? "Erro ao enviar qualificação");
      }
    } catch {
      setFormError("Erro de conexão");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#09081A]">
      <div className="border-b border-[#C9A84C]/20 bg-[#12112A]">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center gap-3">
          <img src="https://app.v3partners.com.br/v3-logo-flat-gold-alpha.png" alt="V3 Partners" className="h-8" />
          <div>
            <p className="text-sm font-bold text-[#F5F1E8]">Qualificação de Partes</p>
            <p className="text-[10px] text-[#9BAFC5]">Bolsa de Capitais, V3 Partners</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-10">
        {state === "loading" && (
          <div className="flex flex-col items-center justify-center min-h-[50vh]">
            <Loader2 className="w-8 h-8 animate-spin text-[#C9A84C] mb-4" />
            <p className="text-sm text-[#9BAFC5]">Carregando formulário</p>
          </div>
        )}

        {state === "error" && (
          <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
            <AlertTriangle className="w-12 h-12 text-red-400 mb-4" />
            <h2 className="text-xl font-bold text-[#F5F1E8] mb-2">Link inválido</h2>
            <p className="text-sm text-[#9BAFC5]">{errorMsg}</p>
            <p className="text-xs text-[#9BAFC5]/50 mt-6">Entre em contato: deal@v3partners.com.br</p>
          </div>
        )}

        {state === "locked" && (
          <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
            <div className="w-16 h-16 rounded-full bg-[#C9A84C]/10 flex items-center justify-center mb-6">
              <CheckCircle2 className="w-8 h-8 text-[#C9A84C]" />
            </div>
            <h2 className="text-xl font-bold text-[#F5F1E8] mb-2">Qualificação já enviada</h2>
            <p className="text-sm text-[#9BAFC5] max-w-md">{errorMsg}</p>
            <p className="text-xs text-[#9BAFC5]/50 mt-6">Entre em contato: deal@v3partners.com.br</p>
          </div>
        )}

        {state === "success" && (
          <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mb-6">
              <CheckCircle2 className="w-8 h-8 text-emerald-400" />
            </div>
            <h2 className="text-xl font-bold text-[#F5F1E8] mb-2">Qualificação enviada</h2>
            <p className="text-sm text-[#9BAFC5] max-w-md">Seus dados foram recebidos. A V3 Partners prosseguirá com a geração do documento assim que todos os envolvidos concluírem esta etapa.</p>
          </div>
        )}

        {state === "ready" && data && (
          <div className="space-y-5">
            <div className="bg-[#12112A] border border-[#9BAFC5]/10 rounded-lg p-4">
              <p className="text-[9px] text-[#C9A84C] font-bold uppercase mb-1">{data.document_type_label}{data.anonymous_id ? ` · ${data.anonymous_id}` : ""}</p>
              <p className="text-sm text-[#F5F1E8] font-semibold">{data.full_name}</p>
              <p className="text-[11px] text-[#9BAFC5]">{data.email}</p>
            </div>

            <p className="text-[12px] text-[#9BAFC5] leading-relaxed">
              Complete seus dados de qualificação abaixo. Eles serão usados exclusivamente para a elaboração do documento e, quando aplicável, para eventual repasse de comissão.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-[9px] text-[#9BAFC5] uppercase">CPF ou CNPJ *</label>
                <input value={cpfCnpj} onChange={(e) => setCpfCnpj(e.target.value)}
                  className="w-full bg-[#12112A] border border-[#9BAFC5]/15 rounded px-3 py-2 text-sm text-[#F5F1E8] mt-1" />
              </div>
              <div>
                <label className="text-[9px] text-[#9BAFC5] uppercase">RG *</label>
                <input value={rg} onChange={(e) => setRg(e.target.value)}
                  className="w-full bg-[#12112A] border border-[#9BAFC5]/15 rounded px-3 py-2 text-sm text-[#F5F1E8] mt-1" />
              </div>
              <div>
                <label className="text-[9px] text-[#9BAFC5] uppercase">Endereço completo *</label>
                <textarea value={endereco} onChange={(e) => setEndereco(e.target.value)} rows={2}
                  className="w-full bg-[#12112A] border border-[#9BAFC5]/15 rounded px-3 py-2 text-sm text-[#F5F1E8] mt-1" />
              </div>

              <div className="pt-2 border-t border-[#9BAFC5]/10">
                <p className="text-[10px] text-[#C9A84C] font-bold uppercase mb-2">Dados para repasse (ao menos um)</p>
                <label className="text-[9px] text-[#9BAFC5] uppercase">Chave PIX</label>
                <input value={pixKey} onChange={(e) => setPixKey(e.target.value)}
                  className="w-full bg-[#12112A] border border-[#9BAFC5]/15 rounded px-3 py-2 text-sm text-[#F5F1E8] mt-1 mb-3" />

                <div className="grid grid-cols-2 gap-2">
                  <input value={banco} onChange={(e) => setBanco(e.target.value)} placeholder="Banco"
                    className="w-full bg-[#12112A] border border-[#9BAFC5]/15 rounded px-3 py-2 text-sm text-[#F5F1E8]" />
                  <select value={tipoConta} onChange={(e) => setTipoConta(e.target.value)}
                    className="w-full bg-[#12112A] border border-[#9BAFC5]/15 rounded px-3 py-2 text-sm text-[#F5F1E8]">
                    <option value="corrente">Conta Corrente</option>
                    <option value="poupanca">Poupança</option>
                  </select>
                  <input value={agencia} onChange={(e) => setAgencia(e.target.value)} placeholder="Agência"
                    className="w-full bg-[#12112A] border border-[#9BAFC5]/15 rounded px-3 py-2 text-sm text-[#F5F1E8]" />
                  <input value={conta} onChange={(e) => setConta(e.target.value)} placeholder="Conta"
                    className="w-full bg-[#12112A] border border-[#9BAFC5]/15 rounded px-3 py-2 text-sm text-[#F5F1E8]" />
                </div>
              </div>
            </div>

            {formError && <p className="text-[11px] text-red-400">{formError}</p>}

            <button onClick={submit} disabled={submitting}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#C9A84C] text-[#09081A] rounded-lg text-sm font-bold hover:bg-[#E8C97A] transition disabled:opacity-50">
              {submitting ? <Loader2 size={16} className="animate-spin" /> : null} Enviar Qualificação
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
