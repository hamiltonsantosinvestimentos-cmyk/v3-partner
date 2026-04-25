"use client";

import { useState } from "react";
import {
  Users, CheckCircle2, XCircle, Clock, Eye,
  X, FileText, Download, AlertTriangle, UserPlus,
  ChevronDown, Building2, User, Search, Loader2, TableProperties,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Registration {
  id: string;
  plano: "PARTNER" | "PARTNER_PRO";
  tipo_pessoa: "PF" | "PJ";
  email: string;
  telefone: string;
  nome_completo?: string;
  cpf?: string;
  data_nascimento?: string;
  razao_social?: string;
  nome_fantasia?: string;
  cnpj?: string;
  cep?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  doc_identidade?: string[];
  doc_cnpj?: string[];
  doc_socio?: string[];
  status: "PENDENTE" | "APROVADO" | "REPROVADO" | "EM_ANALISE";
  observacao?: string;
  created_at: string;
}

const STATUS_CONFIG = {
  PENDENTE:   { label: "Pendente",    color: "#F59E0B", bg: "bg-amber-900/30 border-amber-700/40", icon: <Clock className="w-3.5 h-3.5" /> },
  EM_ANALISE: { label: "Em Análise",  color: "#3B82F6", bg: "bg-blue-900/30 border-blue-700/40",   icon: <Eye className="w-3.5 h-3.5" /> },
  APROVADO:   { label: "Aprovado",    color: "#10B981", bg: "bg-emerald-900/30 border-emerald-700/40", icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  REPROVADO:  { label: "Reprovado",   color: "#EF4444", bg: "bg-red-900/30 border-red-700/40",     icon: <XCircle className="w-3.5 h-3.5" /> },
};

function StatusBadge({ status }: { status: Registration["status"] }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span className={cn("inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded border", cfg.bg)} style={{ color: cfg.color }}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

function DocLink({ path, label }: { path: string; label: string }) {
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/partner-docs/${path}`;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-1.5 text-xs text-[#C9A84C] hover:text-[#E8C97A] transition-colors"
    >
      <FileText className="w-3 h-3" /> {label}
    </a>
  );
}

function ModalDetalhe({
  reg,
  onClose,
  onAcao,
}: {
  reg: Registration;
  onClose: () => void;
  onAcao: (id: string, acao: "APROVAR" | "REPROVAR" | "EM_ANALISE", obs?: string) => Promise<void>;
}) {
  const [obs, setObs] = useState(reg.observacao ?? "");
  const [loading, setLoading] = useState<string | null>(null);

  const acionar = async (acao: "APROVAR" | "REPROVAR" | "EM_ANALISE") => {
    setLoading(acao);
    await onAcao(reg.id, acao, obs);
    setLoading(null);
    onClose();
  };

  const nome = reg.tipo_pessoa === "PF" ? reg.nome_completo : reg.razao_social;
  const doc  = reg.tipo_pessoa === "PF" ? `CPF: ${reg.cpf}` : `CNPJ: ${reg.cnpj}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#111F35] border border-[#243A66] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-[#243A66]">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <StatusBadge status={reg.status} />
              <span className="text-[10px] text-muted-foreground">
                {new Date(reg.created_at).toLocaleDateString("pt-BR")}
              </span>
            </div>
            <h2 className="text-lg font-bold text-foreground">{nome}</h2>
            <p className="text-xs text-muted-foreground">{doc} · {reg.email}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Plano */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-[#C9A84C]/10 border border-[#C9A84C]/20">
            <UserPlus className="w-5 h-5 text-[#C9A84C]" />
            <div>
              <p className="text-xs font-semibold text-[#C9A84C]">Plano solicitado</p>
              <p className="text-sm font-bold text-foreground">
                {reg.plano === "PARTNER_PRO" ? "V3 Partner PRO — R$ 397/mês" : "V3 Partner — R$ 197/mês"}
              </p>
            </div>
          </div>

          {/* Dados */}
          <div>
            <p className="text-xs font-semibold text-[#C9A84C] uppercase tracking-wide mb-3">Dados Cadastrais</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2">
              {[
                ["Tipo", reg.tipo_pessoa === "PF" ? "Pessoa Física" : "Pessoa Jurídica"],
                ["E-mail", reg.email],
                ["Telefone", reg.telefone],
                ...(reg.tipo_pessoa === "PF"
                  ? [
                      ["Nome", reg.nome_completo ?? "—"],
                      ["CPF", reg.cpf ?? "—"],
                      ["Nascimento", reg.data_nascimento ? new Date(reg.data_nascimento).toLocaleDateString("pt-BR") : "—"],
                    ]
                  : [
                      ["Razão Social", reg.razao_social ?? "—"],
                      ["Nome Fantasia", reg.nome_fantasia ?? "—"],
                      ["CNPJ", reg.cnpj ?? "—"],
                    ]),
              ].map(([l, v]) => (
                <div key={l} className="flex flex-col border-b border-[#243A66]/50 pb-1.5">
                  <span className="text-[10px] text-muted-foreground">{l}</span>
                  <span className="text-xs font-semibold text-foreground">{v}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Endereço */}
          {reg.cidade && (
            <div>
              <p className="text-xs font-semibold text-[#C9A84C] uppercase tracking-wide mb-2">Endereço</p>
              <p className="text-xs text-muted-foreground">
                {reg.logradouro}{reg.numero ? `, ${reg.numero}` : ""}{reg.complemento ? ` - ${reg.complemento}` : ""}<br />
                {reg.bairro} · {reg.cidade}/{reg.estado} · CEP: {reg.cep}
              </p>
            </div>
          )}

          {/* Documentos */}
          <div>
            <p className="text-xs font-semibold text-[#C9A84C] uppercase tracking-wide mb-2">Documentos Anexados</p>
            <div className="space-y-1.5">
              {(reg.doc_identidade ?? []).map((p, i) => (
                <DocLink key={p} path={p} label={`Identidade ${i + 1}`} />
              ))}
              {(reg.doc_cnpj ?? []).map((p, i) => (
                <DocLink key={p} path={p} label={`Contrato Social ${i + 1}`} />
              ))}
              {(reg.doc_socio ?? []).map((p, i) => (
                <DocLink key={p} path={p} label={`Documento Sócio ${i + 1}`} />
              ))}
              {(reg.doc_identidade?.length ?? 0) + (reg.doc_cnpj?.length ?? 0) + (reg.doc_socio?.length ?? 0) === 0 && (
                <p className="text-xs text-muted-foreground">Nenhum documento anexado</p>
              )}
            </div>
          </div>

          {/* Observação */}
          <div>
            <p className="text-xs font-semibold text-[#C9A84C] uppercase tracking-wide mb-2">Observação (opcional)</p>
            <textarea
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              placeholder="Motivo da aprovação ou rejeição, pendências, etc."
              rows={3}
              className="w-full px-4 py-3 rounded-xl border border-[#243A66] bg-[#09081A] text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:border-[#C9A84C] transition-colors resize-none"
            />
          </div>

          {/* Ações */}
          {reg.status !== "APROVADO" && (
            <div className="flex gap-3 flex-wrap">
              <button
                onClick={() => acionar("APROVAR")}
                disabled={!!loading}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-semibold disabled:opacity-50 transition-colors"
              >
                {loading === "APROVAR" ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Aprovar e Criar Acesso
              </button>
              {reg.status !== "EM_ANALISE" && (
                <button
                  onClick={() => acionar("EM_ANALISE")}
                  disabled={!!loading}
                  className="px-4 py-3 rounded-xl border border-blue-700 text-blue-400 hover:bg-blue-900/20 text-sm font-semibold disabled:opacity-50 transition-colors"
                >
                  {loading === "EM_ANALISE" ? <Loader2 className="w-4 h-4 animate-spin" /> : "Em Análise"}
                </button>
              )}
              <button
                onClick={() => acionar("REPROVAR")}
                disabled={!!loading}
                className="px-4 py-3 rounded-xl border border-red-700 text-red-400 hover:bg-red-900/20 text-sm font-semibold disabled:opacity-50 transition-colors"
              >
                {loading === "REPROVAR" ? <Loader2 className="w-4 h-4 animate-spin" /> : <><XCircle className="w-4 h-4 inline mr-1" />Reprovar</>}
              </button>
            </div>
          )}
          {reg.status === "APROVADO" && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-900/20 border border-emerald-700/40 text-emerald-400 text-xs">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              Cadastro aprovado — acesso criado e convite enviado para <strong>{reg.email}</strong>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SetupBanner() {
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [msg, setMsg] = useState("");

  const runSetup = async () => {
    setStatus("loading");
    try {
      const res = await fetch("/api/setup/partner-registrations", { method: "POST" });
      const data = await res.json();
      if (data.ok) { setStatus("ok"); setMsg(data.message ?? "Configuração concluída!"); }
      else { setStatus("error"); setMsg(data.message ?? "Erro no setup"); }
    } catch { setStatus("error"); setMsg("Erro ao executar setup"); }
  };

  if (status === "ok") return (
    <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-900/20 border border-emerald-700/40 text-emerald-400 text-xs mb-4">
      <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> {msg}
    </div>
  );

  return (
    <div className="flex items-center justify-between p-4 rounded-xl bg-amber-900/20 border border-amber-700/40 mb-4">
      <div>
        <p className="text-xs font-semibold text-amber-400">Configuração necessária</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          {status === "error" ? msg : "Clique para criar a tabela de cadastros no banco de dados."}
        </p>
      </div>
      <button
        onClick={runSetup}
        disabled={status === "loading"}
        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-semibold disabled:opacity-50 transition-colors"
      >
        {status === "loading" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
        {status === "loading" ? "Configurando..." : "Configurar Banco"}
      </button>
    </div>
  );
}

function exportarCSV(regs: Registration[]) {
  const header = ["Nome/Razão Social", "E-mail", "Telefone", "Tipo", "Plano", "CPF/CNPJ", "Cidade", "Estado", "Status", "Data Cadastro"];
  const rows = regs.map(r => [
    r.tipo_pessoa === "PF" ? (r.nome_completo ?? "") : (r.razao_social ?? ""),
    r.email,
    r.telefone,
    r.tipo_pessoa === "PF" ? "Pessoa Física" : "Pessoa Jurídica",
    r.plano,
    r.tipo_pessoa === "PF" ? (r.cpf ?? "") : (r.cnpj ?? ""),
    r.cidade ?? "",
    r.estado ?? "",
    r.status,
    new Date(r.created_at).toLocaleDateString("pt-BR"),
  ]);
  const csv = [header, ...rows].map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `cadastros-partners-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function AdminCadastrosClient({
  registrations: initialRegs,
  statusAtivo,
  dbReady,
}: {
  registrations: Registration[];
  statusAtivo: string;
  adminName: string;
  dbReady?: boolean;
}) {
  const [regs, setRegs] = useState(initialRegs);
  const [showSetup, setShowSetup] = useState(!dbReady);
  const [filtroStatus, setFiltroStatus] = useState<string>(statusAtivo);
  const [busca, setBusca] = useState("");
  const [selecionado, setSelecionado] = useState<Registration | null>(null);

  const contadores = {
    PENDENTE:   regs.filter((r) => r.status === "PENDENTE").length,
    EM_ANALISE: regs.filter((r) => r.status === "EM_ANALISE").length,
    APROVADO:   regs.filter((r) => r.status === "APROVADO").length,
    REPROVADO:  regs.filter((r) => r.status === "REPROVADO").length,
  };

  const filtrados = regs.filter((r) => {
    const matchStatus = filtroStatus === "TODOS" || r.status === filtroStatus;
    const nome = (r.nome_completo ?? r.razao_social ?? "").toLowerCase();
    const matchBusca = busca === "" || nome.includes(busca.toLowerCase()) || r.email.includes(busca.toLowerCase());
    return matchStatus && matchBusca;
  });

  const handleAcao = async (id: string, acao: "APROVAR" | "REPROVAR" | "EM_ANALISE", obs?: string) => {
    const res = await fetch("/api/cadastro-partner/aprovar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, acao, observacao: obs }),
    });
    if (res.ok) {
      const novoStatus = acao === "APROVAR" ? "APROVADO" : acao === "REPROVAR" ? "REPROVADO" : "EM_ANALISE";
      setRegs((prev) => prev.map((r) => r.id === id ? { ...r, status: novoStatus as Registration["status"], observacao: obs } : r));
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {showSetup && <SetupBanner />}

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Cadastros de Parceiros</h1>
          <p className="text-sm text-muted-foreground mt-1">Revise e aprove os cadastros enviados pelo formulário público</p>
        </div>
        <button
          onClick={() => exportarCSV(filtrados)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[#243A66] text-[#C9A84C] hover:bg-[#C9A84C]/10 text-sm font-semibold transition-colors"
        >
          <TableProperties className="w-4 h-4" />
          Exportar CSV
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(["PENDENTE", "EM_ANALISE", "APROVADO", "REPROVADO"] as const).map((s) => {
          const cfg = STATUS_CONFIG[s];
          return (
            <button
              key={s}
              onClick={() => setFiltroStatus(s)}
              className={cn(
                "bg-[#111F35] border rounded-xl p-4 text-left transition-all",
                filtroStatus === s ? "border-[#C9A84C]" : "border-[#243A66] hover:border-[#C9A84C]/40"
              )}
            >
              <div className="flex items-center gap-2 mb-2" style={{ color: cfg.color }}>{cfg.icon}</div>
              <p className="text-2xl font-bold text-foreground">{contadores[s]}</p>
              <p className="text-xs text-muted-foreground">{cfg.label}</p>
            </button>
          );
        })}
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome ou email..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-[#243A66] bg-[#111F35] text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[#C9A84C] transition-colors"
          />
        </div>
        <select
          value={filtroStatus}
          onChange={(e) => setFiltroStatus(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-[#243A66] bg-[#111F35] text-sm text-foreground focus:outline-none focus:border-[#C9A84C] transition-colors"
        >
          <option value="TODOS">Todos</option>
          <option value="PENDENTE">Pendente</option>
          <option value="EM_ANALISE">Em Análise</option>
          <option value="APROVADO">Aprovado</option>
          <option value="REPROVADO">Reprovado</option>
        </select>
      </div>

      {/* Lista */}
      <div className="space-y-2">
        {filtrados.length === 0 && (
          <div className="text-center py-12 text-muted-foreground text-sm">
            Nenhum cadastro encontrado
          </div>
        )}
        {filtrados.map((reg) => {
          const nome = reg.tipo_pessoa === "PF" ? reg.nome_completo : reg.razao_social;
          const doc  = reg.tipo_pessoa === "PF" ? reg.cpf : reg.cnpj;
          return (
            <div
              key={reg.id}
              onClick={() => setSelecionado(reg)}
              className="flex items-center gap-4 p-4 bg-[#111F35] border border-[#243A66] rounded-xl cursor-pointer hover:border-[#C9A84C]/40 transition-all group"
            >
              {/* Avatar */}
              <div className="w-10 h-10 rounded-xl bg-[#243A66] flex items-center justify-center flex-shrink-0">
                {reg.tipo_pessoa === "PF"
                  ? <User className="w-5 h-5 text-[#C9A84C]" />
                  : <Building2 className="w-5 h-5 text-[#C9A84C]" />}
              </div>
              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-foreground truncate">{nome ?? "—"}</p>
                  <StatusBadge status={reg.status} />
                  <span className={cn(
                    "text-[9px] font-bold px-1.5 py-0.5 rounded",
                    reg.plano === "PARTNER_PRO" ? "bg-[#E8C97A]/20 text-[#E8C97A]" : "bg-[#C9A84C]/20 text-[#C9A84C]"
                  )}>
                    {reg.plano === "PARTNER_PRO" ? "PRO" : "PARTNER"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{reg.email} · {doc}</p>
              </div>
              {/* Data */}
              <div className="text-right flex-shrink-0">
                <p className="text-xs text-muted-foreground">{new Date(reg.created_at).toLocaleDateString("pt-BR")}</p>
                <p className="text-[10px] text-[#C9A84C] opacity-0 group-hover:opacity-100 transition-opacity mt-0.5">Ver detalhes →</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Link externo */}
      <div className="bg-[#111F35] border border-[#243A66] rounded-xl p-4 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-foreground">Link público de cadastro</p>
          <p className="text-xs text-muted-foreground mt-0.5 font-mono">
            {typeof window !== "undefined" ? window.location.origin : "https://v3-partner.vercel.app"}/cadastro-partner
          </p>
        </div>
        <button
          onClick={() => {
            const url = `${window.location.origin}/cadastro-partner`;
            navigator.clipboard.writeText(url);
          }}
          className="text-xs px-3 py-1.5 rounded-lg border border-[#C9A84C]/30 text-[#C9A84C] hover:bg-[#C9A84C]/10 transition-colors"
        >
          Copiar link
        </button>
      </div>

      {/* Modal de detalhe */}
      {selecionado && (
        <ModalDetalhe
          reg={selecionado}
          onClose={() => setSelecionado(null)}
          onAcao={handleAcao}
        />
      )}
    </div>
  );
}
