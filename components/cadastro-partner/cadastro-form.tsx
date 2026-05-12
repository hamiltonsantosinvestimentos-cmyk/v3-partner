"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import {
  User, Building2, CheckCircle2, ChevronRight, ChevronLeft,
  Upload, X, Star, Zap, Shield, ArrowRight, Phone,
  MapPin, FileText, Home, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmtCPF(v: string) {
  return v.replace(/\D/g, "").replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}
function fmtCNPJ(v: string) {
  return v.replace(/\D/g, "").replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
}
function fmtTel(v: string) {
  const d = v.replace(/\D/g, "");
  if (d.length <= 10) return d.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
  return d.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
}
function fmtCEP(v: string) {
  return v.replace(/\D/g, "").replace(/(\d{5})(\d{3})/, "$1-$2");
}

type Plano = "PARTNER" | "PARTNER_PRO";
type TipoPessoa = "PF" | "PJ";
type Step = 1 | 2 | 3 | 4 | 5;

const PLANOS = [
  {
    id: "PARTNER" as Plano,
    nome: "V3 Partner",
    preco: "R$ 197",
    periodo: "/mês",
    cor: "#C9A84C",
    icone: <Star className="w-6 h-6" />,
    comissao: "30%",
    descricao: "Ideal para assessores e correspondentes que querem ampliar sua carteira.",
    beneficios: [
      "Acesso à Mesa de Crédito N1 e N2",
      "Pipeline M&A completo",
      "30% de comissionamento",
      "V3 IA Partner",
      "Academy completo",
      "CRM integrado",
    ],
  },
  {
    id: "PARTNER_PRO" as Plano,
    nome: "V3 Partner PRO",
    preco: "R$ 397",
    periodo: "/mês",
    cor: "#E8C97A",
    icone: <Zap className="w-6 h-6" />,
    comissao: "50%",
    destaque: true,
    descricao: "Para profissionais experientes que buscam operações de maior ticket.",
    beneficios: [
      "Tudo do Partner +",
      "Mesa de Crédito N3 (High Ticket ≥ R$5M)",
      "50% de comissionamento",
      "Co-branding V3 Partners",
      "Academy M&A avançado",
      "Suporte dedicado",
    ],
  },
];

// ─── Campo Input ─────────────────────────────────────────────────────────────
function Field({
  label, required, children, error,
}: { label: string; required?: boolean; children: React.ReactNode; error?: string }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-[#7A8FA8] uppercase tracking-wide">
        {label}{required && <span className="text-[#C9A84C] ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="text-[10px] text-red-400">{error}</p>}
    </div>
  );
}

function Input({
  value, onChange, placeholder, type = "text", maxLength, className,
}: {
  value: string; onChange: (v: string) => void; placeholder?: string;
  type?: string; maxLength?: number; className?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      maxLength={maxLength}
      className={cn(
        "w-full px-4 py-3 rounded-xl border border-[#243A66] bg-[#0D1B2E] text-[#F0ECE4] text-sm",
        "placeholder:text-[#7A8FA8]/60 focus:outline-none focus:border-[#C9A84C] transition-colors",
        className
      )}
    />
  );
}

// ─── Upload de Arquivos ───────────────────────────────────────────────────────
function FileUpload({
  label, files, onChange, accept = ".pdf,.jpg,.jpeg,.png", multiple = true, hint,
}: {
  label: string; files: File[]; onChange: (f: File[]) => void;
  accept?: string; multiple?: boolean; hint?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
    onChange(multiple ? [...files, ...selected] : selected);
    if (ref.current) ref.current.value = "";
  };

  const remove = (i: number) => onChange(files.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-2">
      <label className="text-xs font-semibold text-[#7A8FA8] uppercase tracking-wide">{label}</label>
      <div
        onClick={() => ref.current?.click()}
        className="flex flex-col items-center justify-center gap-2 p-5 rounded-xl border-2 border-dashed border-[#243A66] hover:border-[#C9A84C]/50 cursor-pointer transition-colors bg-[#0D1B2E]"
      >
        <Upload className="w-5 h-5 text-[#C9A84C]" />
        <p className="text-xs text-[#7A8FA8]">Clique para selecionar</p>
        <p className="text-[10px] text-[#7A8FA8]/60">{hint ?? "PDF, JPG ou PNG · máx. 10MB por arquivo"}</p>
        <input ref={ref} type="file" accept={accept} multiple={multiple} onChange={handleFiles} className="hidden" />
      </div>
      {files.length > 0 && (
        <div className="space-y-1">
          {files.map((f, i) => (
            <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg bg-[#111F35] border border-[#243A66]">
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="w-3.5 h-3.5 text-[#C9A84C] flex-shrink-0" />
                <span className="text-xs text-[#F0ECE4] truncate">{f.name}</span>
                <span className="text-[10px] text-[#7A8FA8] flex-shrink-0">({(f.size / 1024).toFixed(0)} KB)</span>
              </div>
              <button onClick={() => remove(i)} className="text-[#7A8FA8] hover:text-red-400 transition-colors ml-2">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Barra de Progresso ───────────────────────────────────────────────────────
function StepBar({ step, total }: { step: Step; total: number }) {
  const labels = ["Plano", "Tipo", "Dados", "Endereço", "Documentos"];
  return (
    <div className="flex items-center gap-1 mb-8">
      {Array.from({ length: total }, (_, i) => i + 1).map((s) => (
        <div key={s} className="flex items-center gap-1 flex-1">
          <div className={cn(
            "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all",
            s < step ? "bg-[#C9A84C] text-white" :
            s === step ? "bg-[#C9A84C]/20 border-2 border-[#C9A84C] text-[#C9A84C]" :
            "bg-[#243A66] text-[#7A8FA8]"
          )}>
            {s < step ? <CheckCircle2 className="w-4 h-4" /> : s}
          </div>
          <div className="hidden sm:block">
            <p className={cn("text-[10px] font-semibold whitespace-nowrap",
              s <= step ? "text-[#C9A84C]" : "text-[#7A8FA8]"
            )}>{labels[s - 1]}</p>
          </div>
          {s < total && (
            <div className={cn(
              "h-0.5 flex-1 mx-1 rounded transition-all",
              s < step ? "bg-[#C9A84C]" : "bg-[#243A66]"
            )} />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Main Form ────────────────────────────────────────────────────────────────
export function CadastroPartnerForm() {
  const [step, setStep] = useState<Step>(1);
  const [plano, setPlano] = useState<Plano | null>(null);
  const [tipoPessoa, setTipoPessoa] = useState<TipoPessoa | null>(null);

  // Dados PF
  const [nomeCompleto, setNomeCompleto]   = useState("");
  const [cpf, setCpf]                     = useState("");
  const [dataNasc, setDataNasc]           = useState("");
  const [email, setEmail]                 = useState("");
  const [telefone, setTelefone]           = useState("");

  // Dados PJ
  const [razaoSocial, setRazaoSocial]     = useState("");
  const [nomeFantasia, setNomeFantasia]   = useState("");
  const [cnpj, setCnpj]                   = useState("");
  const [nomeSocio, setNomeSocio]         = useState("");
  const [cpfSocio, setCpfSocio]           = useState("");

  // Endereço
  const [cep, setCep]           = useState("");
  const [logradouro, setLogr]   = useState("");
  const [numero, setNumero]     = useState("");
  const [complemento, setComp]  = useState("");
  const [bairro, setBairro]     = useState("");
  const [cidade, setCidade]     = useState("");
  const [estado, setEstado]     = useState("");
  const [buscandoCep, setBuscandoCep] = useState(false);

  // Documentos
  const [docIdentidade, setDocIdentidade] = useState<File[]>([]);
  const [docCnpj, setDocCnpj]             = useState<File[]>([]);
  const [docSocio, setDocSocio]           = useState<File[]>([]);

  // Submit
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro]         = useState<string | null>(null);
  const [sucesso, setSucesso]   = useState(false);
  const [cobranca, setCobranca] = useState<{
    invoiceId?: string;
    pixEmv?: string;
    pixQrCode?: string;
    boletoPdf?: string;
    boletoBarcode?: string;
    paymentUrl?: string;
    valor?: number;
  } | null>(null);
  const [pixCopiado, setPixCopiado] = useState(false);

  // ─── Busca CEP ────────────────────────────────────────────────────────────
  const buscarCEP = async (cepVal: string) => {
    const digits = cepVal.replace(/\D/g, "");
    if (digits.length !== 8) return;
    setBuscandoCep(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setLogr(data.logradouro ?? "");
        setBairro(data.bairro ?? "");
        setCidade(data.localidade ?? "");
        setEstado(data.uf ?? "");
      }
    } catch { /* silencioso */ }
    finally { setBuscandoCep(false); }
  };

  // ─── Validações por etapa ────────────────────────────────────────────────
  const canNext = (): boolean => {
    if (step === 1) return !!plano;
    if (step === 2) return !!tipoPessoa;
    if (step === 3) {
      if (tipoPessoa === "PF") return !!(nomeCompleto && cpf && dataNasc && email && telefone);
      return !!(razaoSocial && cnpj && nomeSocio && cpfSocio && email && telefone);
    }
    if (step === 4) return !!(cep && logradouro && numero && cidade && estado);
    if (step === 5) {
      if (tipoPessoa === "PF") return docIdentidade.length > 0;
      return docCnpj.length > 0 && docSocio.length > 0;
    }
    return false;
  };

  const next = () => { if (canNext() && step < 5) setStep((s) => (s + 1) as Step); };
  const back = () => { if (step > 1) setStep((s) => (s - 1) as Step); };

  // ─── Submit ───────────────────────────────────────────────────────────────
  const submit = async () => {
    setEnviando(true);
    setErro(null);
    try {
      const fd = new FormData();
      fd.append("plano", plano!);
      fd.append("tipo_pessoa", tipoPessoa!);
      fd.append("email", email);
      fd.append("telefone", telefone);
      fd.append("cep", cep);
      fd.append("logradouro", logradouro);
      fd.append("numero", numero);
      fd.append("complemento", complemento);
      fd.append("bairro", bairro);
      fd.append("cidade", cidade);
      fd.append("estado", estado);

      if (tipoPessoa === "PF") {
        fd.append("nome_completo", nomeCompleto);
        fd.append("cpf", cpf.replace(/\D/g, ""));
        fd.append("data_nascimento", dataNasc);
      } else {
        fd.append("razao_social", razaoSocial);
        fd.append("nome_fantasia", nomeFantasia);
        fd.append("cnpj", cnpj.replace(/\D/g, ""));
        fd.append("nome_socio", nomeSocio);
        fd.append("cpf_socio", cpfSocio.replace(/\D/g, ""));
      }

      docIdentidade.forEach((f) => fd.append("doc_identidade", f));
      docCnpj.forEach((f)       => fd.append("doc_cnpj", f));
      docSocio.forEach((f)      => fd.append("doc_socio", f));

      const res = await fetch("/api/cadastro-partner", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao enviar");
      if (data.cobranca) setCobranca(data.cobranca);
      setSucesso(true);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setEnviando(false);
    }
  };

  // ─── Sucesso ──────────────────────────────────────────────────────────────
  if (sucesso) {
    const valorFmt = cobranca?.valor
      ? (cobranca.valor / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
      : plano === "PARTNER_PRO" ? "R$ 397,00" : "R$ 197,00";

    return (
      <div className="min-h-screen bg-[#09081A] py-8 px-4">
        <div className="max-w-lg w-full mx-auto space-y-6">
          {/* Header */}
          <div className="text-center space-y-3">
            <div className="w-16 h-16 rounded-full bg-[#C9A84C]/20 border-2 border-[#C9A84C] flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8 text-[#C9A84C]" />
            </div>
            <h1 className="text-2xl font-bold text-[#F0ECE4]">Cadastro Recebido!</h1>
            <p className="text-[#7A8FA8] text-sm">
              Para ativar seu acesso ao plano <strong className="text-[#C9A84C]">{plano === "PARTNER_PRO" ? "V3 Partner PRO" : "V3 Partner"}</strong>, realize o pagamento da adesão:
            </p>
          </div>

          {/* Cobrança Cora */}
          <div className="bg-[#111F35] border border-[#243A66] rounded-2xl overflow-hidden">
            {/* Valor */}
            <div className="px-6 py-4 border-b border-[#243A66] flex items-center justify-between">
              <div>
                <p className="text-xs text-[#7A8FA8]">Valor da adesão</p>
                <p className="text-2xl font-bold text-[#C9A84C]">{valorFmt}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-[#7A8FA8]">Vencimento</p>
                <p className="text-sm font-semibold text-[#F0ECE4]">
                  {new Date(Date.now() + 3 * 86400000).toLocaleDateString("pt-BR")}
                </p>
              </div>
            </div>

            {/* Pix */}
            {cobranca?.pixEmv ? (
              <div className="p-6 space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <span className="text-emerald-400 text-xs font-bold">₱</span>
                  </div>
                  <p className="text-sm font-bold text-white">Pague via Pix</p>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">Aprovação instantânea</span>
                </div>

                {/* QR Code */}
                {cobranca.pixQrCode && (
                  <div className="flex justify-center">
                    <div className="bg-white p-3 rounded-xl">
                      <img src={cobranca.pixQrCode} alt="QR Code Pix" className="w-48 h-48" />
                    </div>
                  </div>
                )}

                {/* Pix copia e cola */}
                <div>
                  <p className="text-xs text-[#7A8FA8] mb-2">Pix Copia e Cola</p>
                  <div className="flex gap-2">
                    <div className="flex-1 px-3 py-2 rounded-lg bg-[#0A1628] border border-[#243A66] text-xs text-[#7A8FA8] font-mono overflow-hidden">
                      <p className="truncate">{cobranca.pixEmv}</p>
                    </div>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(cobranca.pixEmv!);
                        setPixCopiado(true);
                        setTimeout(() => setPixCopiado(false), 3000);
                      }}
                      className={`flex-shrink-0 px-4 py-2 rounded-lg text-xs font-bold transition-colors ${
                        pixCopiado ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-[#C9A84C] hover:bg-[#E8C97A] text-[#09081A]"
                      }`}
                    >
                      {pixCopiado ? "Copiado!" : "Copiar"}
                    </button>
                  </div>
                </div>
              </div>
            ) : cobranca?.paymentUrl ? (
              <div className="p-6 text-center space-y-3">
                <p className="text-sm text-[#7A8FA8]">Clique para pagar via Pix ou Boleto:</p>
                <a
                  href={cobranca.paymentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#C9A84C] hover:bg-[#E8C97A] text-[#09081A] font-bold text-sm transition-colors"
                >
                  Ir para Pagamento <ArrowRight className="w-4 h-4" />
                </a>
              </div>
            ) : (
              <div className="p-6 text-center">
                <p className="text-sm text-[#7A8FA8]">Nossa equipe enviará o link de pagamento para <strong className="text-[#F0ECE4]">{email}</strong> em breve.</p>
              </div>
            )}

            {/* Boleto */}
            {cobranca?.boletoPdf && (
              <div className="px-6 pb-4 pt-0 border-t border-[#243A66]">
                <p className="text-xs text-[#7A8FA8] mt-4 mb-2">Ou pague com Boleto Bancário (compensação em até 3 dias úteis)</p>
                <div className="flex gap-2">
                  {cobranca.boletoBarcode && (
                    <div className="flex-1 px-3 py-2 rounded-lg bg-[#0A1628] border border-[#243A66] text-xs text-[#7A8FA8] font-mono truncate">
                      {cobranca.boletoBarcode}
                    </div>
                  )}
                  <a
                    href={cobranca.boletoPdf}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-shrink-0 px-4 py-2 rounded-lg border border-[#243A66] text-xs text-[#7A8FA8] hover:text-[#F0ECE4] transition-colors"
                  >
                    Ver Boleto
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* Próximos passos */}
          <div className="bg-[#111F35] border border-[#243A66] rounded-xl p-4 space-y-2">
            <p className="text-xs font-semibold text-[#C9A84C] uppercase tracking-wide mb-3">O que acontece depois do pagamento</p>
            {[
              "Pagamento confirmado automaticamente",
              "Nossa equipe analisa sua documentação (1-2 dias úteis)",
              "Acesso ativado e credenciais enviadas por e-mail",
              "Onboarding com nossa equipe",
            ].map((s, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-[#7A8FA8]">
                <div className="w-5 h-5 rounded-full bg-[#C9A84C]/20 text-[#C9A84C] text-[10px] font-bold flex items-center justify-center flex-shrink-0">{i + 1}</div>
                {s}
              </div>
            ))}
          </div>

          <p className="text-center text-xs text-[#7A8FA8]">
            Dúvidas? <strong className="text-[#F0ECE4]">contato@v3partners.com.br</strong>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#09081A] py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="relative w-10 h-10 overflow-hidden rounded-lg">
            <Image src="/logo.jpg" alt="V3 Partners" fill className="object-cover" />
          </div>
          <div>
            <p className="text-xs text-[#7A8FA8] font-semibold uppercase tracking-widest">V3 Partners</p>
            <p className="text-[10px] text-[#7A8FA8]/60">Cadastro de Parceiro</p>
          </div>
        </div>

        {/* Card principal */}
        <div className="bg-[#111F35] border border-[#243A66] rounded-2xl p-6 md:p-8">
          <StepBar step={step} total={5} />

          {/* ─── Step 1: Plano ─── */}
          {step === 1 && (
            <div className="space-y-5 animate-fade-in">
              <div>
                <h2 className="text-xl font-bold text-[#F0ECE4]">Escolha seu plano</h2>
                <p className="text-sm text-[#7A8FA8] mt-1">Selecione o plano que melhor se adapta ao seu perfil</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {PLANOS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setPlano(p.id)}
                    className={cn(
                      "relative text-left p-5 rounded-xl border-2 transition-all",
                      plano === p.id
                        ? "border-[#C9A84C] bg-[#C9A84C]/10"
                        : "border-[#243A66] bg-[#0D1B2E] hover:border-[#C9A84C]/40"
                    )}
                  >
                    {p.destaque && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#C9A84C] text-[#09081A] text-[9px] font-bold px-3 py-1 rounded-full uppercase tracking-wide">
                        Mais popular
                      </div>
                    )}
                    <div className="flex items-start justify-between mb-3">
                      <div style={{ color: p.cor }}>{p.icone}</div>
                      {plano === p.id && <CheckCircle2 className="w-5 h-5 text-[#C9A84C]" />}
                    </div>
                    <h3 className="font-bold text-[#F0ECE4] text-base">{p.nome}</h3>
                    <p className="text-xs text-[#7A8FA8] mt-1 mb-3">{p.descricao}</p>
                    <div className="flex items-baseline gap-1 mb-3">
                      <span className="text-2xl font-bold text-[#C9A84C]">{p.preco}</span>
                      <span className="text-xs text-[#7A8FA8]">{p.periodo}</span>
                    </div>
                    <div className="space-y-1.5">
                      {p.beneficios.map((b, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs text-[#7A8FA8]">
                          <CheckCircle2 className="w-3 h-3 text-[#C9A84C] flex-shrink-0" />
                          {b}
                        </div>
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ─── Step 2: Tipo de Pessoa ─── */}
          {step === 2 && (
            <div className="space-y-5 animate-fade-in">
              <div>
                <h2 className="text-xl font-bold text-[#F0ECE4]">Tipo de cadastro</h2>
                <p className="text-sm text-[#7A8FA8] mt-1">Você é pessoa física ou jurídica?</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { id: "PF" as TipoPessoa, label: "Pessoa Física", sub: "CPF", icon: <User className="w-8 h-8" /> },
                  { id: "PJ" as TipoPessoa, label: "Pessoa Jurídica", sub: "CNPJ", icon: <Building2 className="w-8 h-8" /> },
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTipoPessoa(t.id)}
                    className={cn(
                      "flex flex-col items-center gap-3 p-6 rounded-xl border-2 transition-all",
                      tipoPessoa === t.id
                        ? "border-[#C9A84C] bg-[#C9A84C]/10 text-[#C9A84C]"
                        : "border-[#243A66] bg-[#0D1B2E] text-[#7A8FA8] hover:border-[#C9A84C]/40"
                    )}
                  >
                    {t.icon}
                    <div className="text-center">
                      <p className="font-bold text-[#F0ECE4] text-sm">{t.label}</p>
                      <p className="text-xs text-[#7A8FA8]">{t.sub}</p>
                    </div>
                    {tipoPessoa === t.id && <CheckCircle2 className="w-5 h-5 text-[#C9A84C]" />}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ─── Step 3: Dados Pessoais ─── */}
          {step === 3 && tipoPessoa === "PF" && (
            <div className="space-y-4 animate-fade-in">
              <div>
                <h2 className="text-xl font-bold text-[#F0ECE4]">Dados pessoais</h2>
                <p className="text-sm text-[#7A8FA8] mt-1">Preencha seus dados conforme documento de identificação</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <Field label="Nome Completo" required>
                    <Input value={nomeCompleto} onChange={setNomeCompleto} placeholder="Como no documento de identidade" />
                  </Field>
                </div>
                <Field label="CPF" required>
                  <Input
                    value={cpf}
                    onChange={(v) => setCpf(fmtCPF(v))}
                    placeholder="000.000.000-00"
                    maxLength={14}
                  />
                </Field>
                <Field label="Data de Nascimento" required>
                  <Input value={dataNasc} onChange={setDataNasc} type="date" />
                </Field>
                <Field label="E-mail" required>
                  <Input value={email} onChange={setEmail} type="email" placeholder="seu@email.com" />
                </Field>
                <Field label="Telefone / WhatsApp" required>
                  <Input
                    value={telefone}
                    onChange={(v) => setTelefone(fmtTel(v))}
                    placeholder="(11) 99999-9999"
                    maxLength={15}
                  />
                </Field>
              </div>
            </div>
          )}

          {step === 3 && tipoPessoa === "PJ" && (
            <div className="space-y-4 animate-fade-in">
              <div>
                <h2 className="text-xl font-bold text-[#F0ECE4]">Dados da empresa</h2>
                <p className="text-sm text-[#7A8FA8] mt-1">Informações da pessoa jurídica e do sócio responsável</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <Field label="Razão Social" required>
                    <Input value={razaoSocial} onChange={setRazaoSocial} placeholder="Razão social conforme CNPJ" />
                  </Field>
                </div>
                <Field label="Nome Fantasia">
                  <Input value={nomeFantasia} onChange={setNomeFantasia} placeholder="Nome fantasia (opcional)" />
                </Field>
                <Field label="CNPJ" required>
                  <Input
                    value={cnpj}
                    onChange={(v) => setCnpj(fmtCNPJ(v))}
                    placeholder="00.000.000/0000-00"
                    maxLength={18}
                  />
                </Field>
                <Field label="E-mail Comercial" required>
                  <Input value={email} onChange={setEmail} type="email" placeholder="contato@empresa.com" />
                </Field>
                <Field label="Telefone / WhatsApp" required>
                  <Input
                    value={telefone}
                    onChange={(v) => setTelefone(fmtTel(v))}
                    placeholder="(11) 99999-9999"
                    maxLength={15}
                  />
                </Field>
                <div className="md:col-span-2 border-t border-[#243A66] pt-4">
                  <p className="text-xs font-semibold text-[#C9A84C] uppercase tracking-wide mb-3">Sócio Responsável</p>
                </div>
                <div className="md:col-span-2">
                  <Field label="Nome Completo do Sócio" required>
                    <Input value={nomeSocio} onChange={setNomeSocio} placeholder="Nome conforme RG/CNH" />
                  </Field>
                </div>
                <Field label="CPF do Sócio" required>
                  <Input
                    value={cpfSocio}
                    onChange={(v) => setCpfSocio(fmtCPF(v))}
                    placeholder="000.000.000-00"
                    maxLength={14}
                  />
                </Field>
              </div>
            </div>
          )}

          {/* ─── Step 4: Endereço ─── */}
          {step === 4 && (
            <div className="space-y-4 animate-fade-in">
              <div>
                <h2 className="text-xl font-bold text-[#F0ECE4]">Endereço</h2>
                <p className="text-sm text-[#7A8FA8] mt-1">Informe o CEP para preenchimento automático</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-1">
                  <Field label="CEP" required>
                    <div className="relative">
                      <Input
                        value={cep}
                        onChange={(v) => {
                          const fmt = fmtCEP(v);
                          setCep(fmt);
                          if (fmt.replace(/\D/g, "").length === 8) buscarCEP(fmt);
                        }}
                        placeholder="00000-000"
                        maxLength={9}
                      />
                      {buscandoCep && (
                        <Loader2 className="absolute right-3 top-3.5 w-4 h-4 text-[#C9A84C] animate-spin" />
                      )}
                    </div>
                  </Field>
                </div>
                <div className="md:col-span-2">
                  <Field label="Logradouro" required>
                    <Input value={logradouro} onChange={setLogr} placeholder="Rua, Avenida, etc." />
                  </Field>
                </div>
                <Field label="Número" required>
                  <Input value={numero} onChange={setNumero} placeholder="123" />
                </Field>
                <div className="md:col-span-2">
                  <Field label="Complemento">
                    <Input value={complemento} onChange={setComp} placeholder="Apto, Sala, etc." />
                  </Field>
                </div>
                <Field label="Bairro" required>
                  <Input value={bairro} onChange={setBairro} placeholder="Bairro" />
                </Field>
                <Field label="Cidade" required>
                  <Input value={cidade} onChange={setCidade} placeholder="Cidade" />
                </Field>
                <Field label="Estado" required>
                  <select
                    value={estado}
                    onChange={(e) => setEstado(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-[#243A66] bg-[#0D1B2E] text-[#F0ECE4] text-sm focus:outline-none focus:border-[#C9A84C] transition-colors"
                  >
                    <option value="">UF</option>
                    {["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"].map((uf) => (
                      <option key={uf} value={uf}>{uf}</option>
                    ))}
                  </select>
                </Field>
              </div>
            </div>
          )}

          {/* ─── Step 5: Documentos ─── */}
          {step === 5 && (
            <div className="space-y-5 animate-fade-in">
              <div>
                <h2 className="text-xl font-bold text-[#F0ECE4]">Documentos</h2>
                <p className="text-sm text-[#7A8FA8] mt-1">
                  {tipoPessoa === "PF"
                    ? "Anexe seu documento de identificação com foto"
                    : "Anexe o contrato social e documentos dos sócios"}
                </p>
              </div>

              {tipoPessoa === "PF" ? (
                <FileUpload
                  label="Documento de Identificação (RG ou CNH) *"
                  files={docIdentidade}
                  onChange={setDocIdentidade}
                  hint="Frente e verso — PDF, JPG ou PNG · máx. 10MB"
                />
              ) : (
                <>
                  <FileUpload
                    label="Contrato Social ou Requerimento de Empresário *"
                    files={docCnpj}
                    onChange={setDocCnpj}
                    hint="PDF · máx. 20MB"
                    accept=".pdf"
                  />
                  <FileUpload
                    label="Documentos do(s) Sócio(s) — RG ou CNH *"
                    files={docSocio}
                    onChange={setDocSocio}
                    hint="Frente e verso de cada sócio — PDF, JPG ou PNG · máx. 10MB"
                  />
                </>
              )}

              {/* Resumo */}
              <div className="bg-[#09081A] border border-[#243A66] rounded-xl p-4 space-y-2">
                <p className="text-xs font-semibold text-[#C9A84C] uppercase tracking-wide mb-2">Resumo do cadastro</p>
                {[
                  ["Plano", plano === "PARTNER_PRO" ? "V3 Partner PRO — R$ 397/mês" : "V3 Partner — R$ 197/mês"],
                  ["Tipo", tipoPessoa === "PF" ? "Pessoa Física" : "Pessoa Jurídica"],
                  ["Nome", tipoPessoa === "PF" ? nomeCompleto : razaoSocial],
                  ["Documento", tipoPessoa === "PF" ? cpf : cnpj],
                  ["E-mail", email],
                  ["Cidade", cidade ? `${cidade}/${estado}` : "—"],
                ].map(([l, v]) => (
                  <div key={l} className="flex justify-between text-xs">
                    <span className="text-[#7A8FA8]">{l}</span>
                    <span className="font-semibold text-[#F0ECE4] text-right max-w-[200px] truncate">{v}</span>
                  </div>
                ))}
              </div>

              {erro && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-red-900/20 border border-red-800/40 text-red-400 text-xs">
                  <X className="w-4 h-4 flex-shrink-0" />
                  {erro}
                </div>
              )}

              <p className="text-[10px] text-[#7A8FA8] text-center leading-relaxed">
                Ao enviar, você concorda com os <strong className="text-[#F0ECE4]">Termos de Parceria V3 Partners</strong> e
                autoriza o tratamento dos seus dados conforme a <strong className="text-[#F0ECE4]">LGPD (Lei 13.709/18)</strong>.
              </p>
            </div>
          )}

          {/* ─── Navegação ─── */}
          <div className={cn("flex mt-8 gap-3", step > 1 ? "justify-between" : "justify-end")}>
            {step > 1 && (
              <button
                onClick={back}
                className="flex items-center gap-2 px-5 py-3 rounded-xl border border-[#243A66] text-[#7A8FA8] hover:text-[#F0ECE4] hover:border-[#C9A84C]/50 transition-all text-sm font-semibold"
              >
                <ChevronLeft className="w-4 h-4" /> Voltar
              </button>
            )}
            {step < 5 ? (
              <button
                onClick={next}
                disabled={!canNext()}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[#C9A84C] hover:bg-[#E8C97A] text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                Continuar <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={submit}
                disabled={!canNext() || enviando}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[#C9A84C] hover:bg-[#E8C97A] text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                {enviando ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Enviando...</>
                ) : (
                  <><ArrowRight className="w-4 h-4" /> Enviar Cadastro</>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Rodapé */}
        <p className="text-center text-[10px] text-[#7A8FA8]/60 mt-6">
          V3 Partners Soluções Ltda · CNPJ 14.219.287/0001-50 · v3partners.com.br
        </p>
      </div>
    </div>
  );
}
