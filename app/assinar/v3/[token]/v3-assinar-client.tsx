"use client";

import { useState } from "react";

interface ContratoV3 {
  id: string;
  status: string;
  client_name: string;
  client_cpf: string | null;
  client_email: string;
  commission_perc: number;
  deal_value: number | null;
  credit_line: string | null;
  proposal_code: string | null;
  signed_at: string | null;
  v3_signed_at: string | null;
  endereco: string | null;
  bairro: string | null;
  municipio: string | null;
  estado: string | null;
  cep: string | null;
  telefone: string | null;
}

const moeda = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const EXTENSO: Record<number, string> = {
  1:"um",2:"dois",3:"três",4:"quatro",5:"cinco",6:"seis",7:"sete",8:"oito",
  9:"nove",10:"dez",11:"onze",12:"doze",13:"treze",14:"quatorze",15:"quinze",
  16:"dezesseis",17:"dezessete",18:"dezoito",19:"dezenove",20:"vinte",25:"vinte e cinco",30:"trinta",
};
function percExtenso(v: number) {
  return EXTENSO[v] ? `${v}% (${EXTENSO[v]} por cento)` : `${v}%`;
}

export function V3AssinarClient({ token, contrato }: { token: string; contrato: ContratoV3 }) {
  const [nomeAssinatura, setNomeAssinatura] = useState("João Lemos Netto");
  const [leu, setLeu] = useState(false);
  const [saving, setSaving] = useState(false);
  const [assinado, setAssinado] = useState(contrato.status === "ASSINADO");
  const [error, setError] = useState("");

  // CPF / Receita Federal
  const [cpf, setCpf] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [address, setAddress] = useState("");
  const [cpfLoading, setCpfLoading] = useState(false);
  const [cpfResult, setCpfResult] = useState<{ tipo: string; nome: string; situacao: string; nomeCorrigido: boolean } | null>(null);
  const [cpfError, setCpfError] = useState("");

  function toTitleCase(s: string) {
    const minors = new Set(["da","de","do","das","dos","e","a","o","em"]);
    return s.toLowerCase().split(" ").map((w, i) =>
      i === 0 || !minors.has(w) ? w.charAt(0).toUpperCase() + w.slice(1) : w
    ).join(" ");
  }

  function normName(s: string) {
    return s.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
  }

  async function handleValidarCPF() {
    setCpfError("");
    setCpfResult(null);
    if (!cpf.trim()) { setCpfError("Informe o CPF."); return; }
    if (!birthDate && cpf.replace(/\D/g,"").length === 11) {
      setCpfError("Informe a data de nascimento antes de validar."); return;
    }
    setCpfLoading(true);
    try {
      const res = await fetch("/api/cpf-validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cpf, birthDate }),
      });
      const json = await res.json();
      if (!res.ok) { setCpfError(json.error ?? "Erro ao validar CPF."); return; }
      const rfNome: string = json.nome ?? "";
      const rfNomeTitle = toTitleCase(rfNome);
      const nomeAtual = nomeAssinatura.trim();
      const nomeCorrigido = nomeAtual !== "" && normName(rfNome) !== normName(nomeAtual);
      setNomeAssinatura(rfNomeTitle);
      setCpfResult({ tipo: json.tipo, nome: rfNome, situacao: json.situacao, nomeCorrigido });
    } catch {
      setCpfError("Erro de conexão. Tente novamente.");
    } finally {
      setCpfLoading(false);
    }
  }

  const hoje = new Date().toLocaleDateString("pt-BR");
  const clienteAssinou = contrato.signed_at
    ? new Date(contrato.signed_at).toLocaleString("pt-BR")
    : "—";
  const perc = percExtenso(contrato.commission_perc);

  const enderecoCliente = [contrato.endereco, contrato.bairro, contrato.municipio && contrato.estado ? `${contrato.municipio} – ${contrato.estado}` : contrato.municipio || contrato.estado, contrato.cep].filter(Boolean).join(", ");

  async function handleAssinar() {
    setError("");
    if (!nomeAssinatura.trim()) { setError("Digite o nome do representante."); return; }
    if (!cpfResult) { setError("Valide o CPF na Receita Federal antes de assinar."); return; }
    if (!leu) { setError("Confirme que revisou o contrato."); return; }
    if (contrato.status !== "AGUARDANDO_V3") {
      setError("Este contrato não está aguardando assinatura da V3."); return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/contratos/v3/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome_assinatura: nomeAssinatura, cpf, birthdate: birthDate, address }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Erro ao registrar assinatura."); return; }
      setAssinado(true);
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  if (assinado) {
    return (
      <div className="min-h-screen bg-[#09081A] flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-5">
          <div className="w-20 h-20 rounded-2xl bg-emerald-500/20 flex items-center justify-center mx-auto">
            <span className="text-4xl">✅</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Contrato Finalizado!</h1>
          <p className="text-[#7A8FA8] text-sm">
            Contra-assinatura registrada com sucesso. O cliente{" "}
            <strong className="text-white">{contrato.client_name}</strong> receberá
            o contrato finalizado por e-mail.
          </p>
          <div className="pt-4 border-t border-[#1B3050]">
            <span className="text-[11px] text-[#7A8FA8]">V3 Partners · {contrato.proposal_code}</span>
          </div>
        </div>
      </div>
    );
  }

  if (contrato.status !== "AGUARDANDO_V3") {
    return (
      <div className="min-h-screen bg-[#09081A] flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/20 flex items-center justify-center mx-auto">
            <span className="text-3xl">⚠️</span>
          </div>
          <h1 className="text-xl font-bold text-white">
            {contrato.status === "ASSINADO" ? "Contrato já finalizado" : "Link inválido"}
          </h1>
          <p className="text-[#7A8FA8] text-sm">
            {contrato.status === "ASSINADO"
              ? "Este contrato já foi assinado por ambas as partes."
              : "Este link não está disponível para assinatura."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#09081A] py-10 px-4">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#C9A84C] to-[#E8C97A] flex items-center justify-center">
            <span className="text-lg font-black text-[#09081A]">V3</span>
          </div>
          <div>
            <h1 className="text-base font-bold text-white">V3 PARTNERS — Contra-Assinatura</h1>
            <p className="text-[11px] text-[#7A8FA8]">Representante · {contrato.proposal_code}</p>
          </div>
        </div>

        {/* Status cliente */}
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-3 flex items-center gap-3">
          <span className="text-lg">✅</span>
          <div>
            <p className="text-xs font-semibold text-emerald-400">Cliente já assinou</p>
            <p className="text-[11px] text-[#7A8FA8]">{contrato.client_name} · {clienteAssinou}</p>
          </div>
        </div>

        {/* Contrato */}
        <div className="bg-[#0C1929] border border-[#1B3050] rounded-2xl overflow-hidden">
          <div className="px-6 py-5 border-b border-[#1B3050] bg-[#07101E] text-center">
            <h2 className="text-sm font-bold text-white tracking-widest uppercase">
              Contrato de Prestação de Serviços Financeiros
            </h2>
            <p className="text-[11px] text-[#7A8FA8] mt-1">Mandato de Representação · Revisão para Contra-Assinatura</p>
          </div>

          <div className="px-6 py-6 space-y-5 text-[12.5px] text-[#7A8FA8] leading-relaxed">

            {/* Partes */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">Das Partes</h3>
              <div className="bg-[#13243D] rounded-xl p-4">
                <p className="text-[11px] font-bold text-[#C9A84C] mb-1">CONTRATADA</p>
                <p><strong className="text-white">V3 PARTNERS SOLUÇÕES LTDA</strong>, CNPJ 14.219.287/0001-50, Rua Visconde de Pirajá, 414/Sala 718 – Ipanema – Rio de Janeiro – RJ.</p>
              </div>
              <div className="bg-[#13243D] rounded-xl p-4">
                <p className="text-[11px] font-bold text-[#C9A84C] mb-1">CONTRATANTE</p>
                <p>
                  <strong className="text-[#C9A84C]">{contrato.client_name}</strong>
                  {contrato.client_cpf && <span>, CPF/CNPJ: <strong className="text-white">{contrato.client_cpf}</strong></span>}
                  {contrato.telefone && <span>, Tel: <strong className="text-white">{contrato.telefone}</strong></span>}
                  , e-mail: <strong className="text-white">{contrato.client_email}</strong>
                  {enderecoCliente && <span>, <strong className="text-white">{enderecoCliente}</strong></span>}.
                </p>
              </div>
            </div>

            {/* Resumo */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">Resumo da Operação</h3>
              <div className="grid grid-cols-2 gap-2">
                {[
                  ["Linha de Crédito", contrato.credit_line ?? "—"],
                  ["Valor da Operação", contrato.deal_value ? moeda(contrato.deal_value) : "A definir"],
                  ["Remuneração de Sucesso", perc],
                  ["Código da Proposta", contrato.proposal_code ?? "—"],
                ].map(([label, value]) => (
                  <div key={label} className="bg-[#13243D] rounded-lg p-3">
                    <p className="text-[10px] text-[#7A8FA8]">{label}</p>
                    <p className="text-sm font-semibold text-white">{value}</p>
                  </div>
                ))}
              </div>
            </div>

            <p className="text-[11px] text-center text-[#7A8FA8]">
              Contrato integral disponível. Cláusulas 1 a 12 conforme instrumento assinado pelo cliente em {clienteAssinou}.
            </p>
            <p className="text-[11px] text-center">Rio de Janeiro, {hoje}</p>
          </div>
        </div>

        {/* Confirmação de identidade V3 */}
        <div className="bg-[#0C1929] border border-[#1B3050] rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-white">Identificação do Representante</h3>
            {cpfResult && <span className="text-[11px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-semibold">✓ Validado</span>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-[11px] font-semibold text-[#7A8FA8] mb-1">CPF do Representante *</label>
              <input value={cpf} onChange={(e) => { setCpf(e.target.value); setCpfResult(null); setCpfError(""); }}
                placeholder="000.000.000-00"
                className="w-full h-9 px-3 text-sm bg-[#13243D] border border-[#1B3050] rounded-lg text-white placeholder:text-[#7A8FA8] focus:outline-none focus:ring-1 focus:ring-[#C9A84C]/50" />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-[11px] font-semibold text-[#7A8FA8] mb-1">Data de Nascimento *</label>
              <input type="date" value={birthDate} onChange={(e) => { setBirthDate(e.target.value); setCpfResult(null); setCpfError(""); }}
                className="w-full h-9 px-3 text-sm bg-[#13243D] border border-[#1B3050] rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-[#C9A84C]/50" />
            </div>
            <div className="col-span-2">
              <label className="block text-[11px] font-semibold text-[#7A8FA8] mb-1">Endereço Completo *</label>
              <input value={address} onChange={(e) => setAddress(e.target.value)}
                placeholder="Rua, nº, Bairro, Cidade – UF, CEP"
                className="w-full h-9 px-3 text-sm bg-[#13243D] border border-[#1B3050] rounded-lg text-white placeholder:text-[#7A8FA8] focus:outline-none focus:ring-1 focus:ring-[#C9A84C]/50" />
            </div>
          </div>
          <button onClick={handleValidarCPF} disabled={cpfLoading || !cpf.trim()}
            className="w-full h-9 rounded-lg bg-[#13243D] border border-[#C9A84C]/40 hover:border-[#C9A84C] disabled:opacity-40 disabled:cursor-not-allowed text-[#C9A84C] font-semibold text-sm transition-colors flex items-center justify-center gap-2">
            {cpfLoading
              ? <><span className="w-3.5 h-3.5 rounded-full border-2 border-[#C9A84C] border-t-transparent animate-spin" />Consultando Receita Federal...</>
              : "🔍 Validar CPF na Receita Federal"}
          </button>
          {cpfResult && (
            <div className="space-y-2">
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 space-y-1">
                <p className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">✅ {cpfResult.tipo} Válido — Receita Federal</p>
                <p className="text-sm font-semibold text-white">{toTitleCase(cpfResult.nome)}</p>
                <p className="text-[11px] text-[#7A8FA8]">Situação: {cpfResult.situacao}</p>
              </div>
              {cpfResult.nomeCorrigido && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-2">
                  <p className="text-[11px] text-amber-400">⚠️ Nome corrigido conforme cadastro da Receita Federal.</p>
                </div>
              )}
            </div>
          )}
          {cpfError && (
            <div className="bg-red-500/15 border border-red-500/30 rounded-lg px-4 py-3 text-sm text-red-400">{cpfError}</div>
          )}
        </div>

        {/* Assinatura V3 */}
        <div className="bg-[#0C1929] border border-[#1B3050] rounded-2xl p-6 space-y-4">
          <h3 className="text-sm font-bold text-white">Contra-Assinatura — V3 Partners</h3>
          <div>
            <label className="block text-[11px] font-semibold text-[#7A8FA8] mb-1">Nome do Representante *</label>
            <input value={nomeAssinatura} onChange={(e) => setNomeAssinatura(e.target.value)}
              className="w-full h-10 px-3 text-sm bg-[#13243D] border border-[#1B3050] rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-[#C9A84C]/50" />
          </div>
          <label className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" checked={leu} onChange={(e) => setLeu(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-[#C9A84C] flex-shrink-0" />
            <span className="text-[12px] text-[#7A8FA8]">
              Declaro que revisei o Contrato de Prestação de Serviços Financeiros, confirmo a identidade
              do contratante e assino em nome da V3 Partners Soluções Ltda como representante autorizado.
            </span>
          </label>
          {error && (
            <div className="bg-red-500/15 border border-red-500/30 rounded-lg px-4 py-3 text-sm text-red-400">{error}</div>
          )}
          <button onClick={handleAssinar} disabled={saving || !leu || !nomeAssinatura.trim()}
            className="w-full h-11 rounded-xl bg-[#C9A84C] hover:bg-[#E8C97A] disabled:opacity-40 disabled:cursor-not-allowed text-[#09081A] font-bold text-sm transition-colors flex items-center justify-center gap-2">
            {saving ? (
              <><span className="w-4 h-4 rounded-full border-2 border-[#09081A] border-t-transparent animate-spin" />Registrando...</>
            ) : "✍️ Assinar como V3 Partners"}
          </button>
        </div>

        <div className="text-center pb-6">
          <span className="text-[11px] text-[#7A8FA8]">V3 Partners Soluções Ltda · CNPJ 14.219.287/0001-50</span>
        </div>
      </div>
    </div>
  );
}
