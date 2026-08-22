"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  MessageSquare, Bot, Send, QrCode, Loader2, CheckCircle2, RefreshCw,
  Plus, Trash2, Play, Pause, Users as UsersIcon,
} from "lucide-react";

type MainTab = "conversas" | "conectar" | "automacao" | "campanhas";

const TABS: { id: MainTab; label: string; icon: React.ElementType }[] = [
  { id: "conversas", label: "Conversas", icon: MessageSquare },
  { id: "conectar", label: "Conectar WhatsApp", icon: QrCode },
  { id: "automacao", label: "Automação", icon: Bot },
  { id: "campanhas", label: "Envio em Massa", icon: Send },
];

function Tabs({ active, onChange }: { active: MainTab; onChange: (t: MainTab) => void }) {
  return (
    <div className="flex gap-1 border-b border-[#243A66] mb-5 overflow-x-auto">
      {TABS.map((t) => {
        const Icon = t.icon;
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors ${
              active === t.id
                ? "border-[#C9A84C] text-[#C9A84C]"
                : "border-transparent text-[#7A8FA8] hover:text-[#F0ECE4]"
            }`}
          >
            <Icon className="w-4 h-4" /> {t.label}
          </button>
        );
      })}
    </div>
  );
}

export function PartnerSdrClient() {
  const [tab, setTab] = useState<MainTab>("conversas");

  return (
    <div className="animate-fade-in">
      <div className="mb-1">
        <h1 className="text-2xl font-bold text-[#F0ECE4]">Atendimento IA no WhatsApp</h1>
        <p className="text-sm text-[#7A8FA8] mt-1">Seu número, sua IA, seus leads.</p>
      </div>
      <Tabs active={tab} onChange={setTab} />
      {tab === "conversas" && <ConversasTab />}
      {tab === "conectar" && <ConectarTab />}
      {tab === "automacao" && <AutomacaoTab />}
      {tab === "campanhas" && <CampanhasTab />}
    </div>
  );
}

// ── Conversas ────────────────────────────────────────────────────────────

type Lead = {
  phone: string; nome: string | null; status: string; humano_ativo: boolean;
  last_message_at: string; last_message_preview: string; message_count: number;
};
type Mensagem = { id: string; phone: string; role: "user" | "assistant"; content: string; created_at: string };

function ConversasTab() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const carregarLeads = useCallback(async () => {
    try {
      const res = await fetch("/api/partner/sdr/leads");
      const d = await res.json();
      setLeads(d.leads ?? []);
    } catch { /* silencioso */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    carregarLeads();
    const id = setInterval(carregarLeads, 15000);
    return () => clearInterval(id);
  }, [carregarLeads]);

  const carregarConversa = useCallback(async (phone: string) => {
    try {
      const res = await fetch(`/api/partner/sdr/conversas?phone=${encodeURIComponent(phone)}`);
      const d = await res.json();
      setMensagens(d.conversas ?? []);
    } catch { /* silencioso */ }
  }, []);

  useEffect(() => {
    if (!selected) return;
    carregarConversa(selected);
    const id = setInterval(() => carregarConversa(selected), 8000);
    return () => clearInterval(id);
  }, [selected, carregarConversa]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens]);

  async function togglePausarIa(lead: Lead) {
    await fetch("/api/partner/sdr/leads", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: lead.phone, humano_ativo: !lead.humano_ativo }),
    });
    carregarLeads();
  }

  async function enviar() {
    if (!selected || !texto.trim()) return;
    setEnviando(true);
    try {
      const res = await fetch("/api/partner/sdr/enviar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: selected, text: texto.trim() }),
      });
      if (res.ok) {
        setTexto("");
        carregarConversa(selected);
      }
    } catch { /* silencioso */ }
    setEnviando(false);
  }

  const leadSelecionado = leads.find((l) => l.phone === selected) ?? null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-[300px_1fr] gap-4 h-[65vh]">
      <div className="bg-[#111F35] border border-[#243A66] rounded-2xl overflow-y-auto">
        {loading ? (
          <div className="p-6 text-center text-[#7A8FA8] text-sm flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
          </div>
        ) : leads.length === 0 ? (
          <div className="p-6 text-center text-[#7A8FA8] text-sm">Nenhuma conversa ainda. Conecte seu WhatsApp e comece a receber mensagens.</div>
        ) : (
          leads.map((l) => (
            <button
              key={l.phone}
              onClick={() => setSelected(l.phone)}
              className={`w-full text-left px-4 py-3 border-b border-[#243A66]/60 hover:bg-[#162744] transition-colors ${selected === l.phone ? "bg-[#162744]" : ""}`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-[#F0ECE4] truncate">{l.nome || l.phone}</p>
                {l.humano_ativo && <span className="text-[9px] font-bold text-amber-400 bg-amber-500/15 px-1.5 py-0.5 rounded-full flex-shrink-0">PAUSADO</span>}
              </div>
              <p className="text-xs text-[#7A8FA8] truncate mt-0.5">{l.last_message_preview}</p>
            </button>
          ))
        )}
      </div>

      <div className="bg-[#111F35] border border-[#243A66] rounded-2xl flex flex-col overflow-hidden">
        {!selected ? (
          <div className="flex-1 flex items-center justify-center text-[#7A8FA8] text-sm">Selecione uma conversa</div>
        ) : (
          <>
            <div className="px-4 py-3 border-b border-[#243A66] flex items-center justify-between">
              <p className="text-sm font-bold text-[#F0ECE4]">{leadSelecionado?.nome || selected}</p>
              {leadSelecionado && (
                <button
                  onClick={() => togglePausarIa(leadSelecionado)}
                  className={`text-[10px] font-bold px-2.5 py-1 rounded-full border transition-colors ${
                    leadSelecionado.humano_ativo
                      ? "bg-amber-500/15 border-amber-500/30 text-amber-400"
                      : "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                  }`}
                >
                  {leadSelecionado.humano_ativo ? "IA pausada — retomar" : "IA ativa — pausar"}
                </button>
              )}
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {mensagens.map((m) => (
                <div key={m.id} className={`flex ${m.role === "assistant" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm ${
                    m.role === "assistant" ? "bg-[#C9A84C]/15 text-[#F0ECE4]" : "bg-[#243A66] text-[#F0ECE4]"
                  }`}>
                    {m.content}
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
            <div className="p-3 border-t border-[#243A66] flex gap-2">
              <input
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && enviar()}
                placeholder="Escreva uma mensagem..."
                className="flex-1 bg-[#0D1929] border border-[#243A66] rounded-xl px-3.5 py-2 text-sm text-[#F0ECE4] placeholder:text-[#7A8FA8] outline-none focus:border-[#C9A84C]/50"
              />
              <button
                onClick={enviar}
                disabled={enviando || !texto.trim()}
                className="px-4 py-2 rounded-xl bg-[#C9A84C] text-[#09081A] font-bold disabled:opacity-50"
              >
                {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Conectar WhatsApp ───────────────────────────────────────────────────

function ConectarTab() {
  const [status, setStatus] = useState<string>("desconectado");
  const [qrcode, setQrcode] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      const res = await fetch("/api/partner/sdr/connect");
      const d = await res.json();
      setStatus(d.status ?? "desconectado");
      setQrcode(d.qrcode ?? null);
      setPhone(d.phone ?? null);
    } catch { /* silencioso */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    carregar();
    const id = setInterval(carregar, 5000);
    return () => clearInterval(id);
  }, [carregar]);

  async function criarSessao() {
    setCriando(true);
    setErro(null);
    try {
      const res = await fetch("/api/partner/sdr/connect", { method: "POST" });
      const d = await res.json();
      if (!res.ok) setErro(d.error ?? "Não foi possível gerar o QR Code");
      await carregar();
    } catch {
      setErro("Não foi possível gerar o QR Code");
    }
    setCriando(false);
  }

  return (
    <div className="max-w-md">
      <div className="bg-[#111F35] border border-[#243A66] rounded-2xl p-6 text-center">
        {loading ? (
          <Loader2 className="w-6 h-6 animate-spin text-[#C9A84C] mx-auto" />
        ) : status === "conectado" ? (
          <>
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
            <p className="text-sm font-bold text-[#F0ECE4]">WhatsApp Conectado!</p>
            {phone && <p className="text-xs text-[#7A8FA8] mt-1">{phone}</p>}
          </>
        ) : qrcode ? (
          <>
            <p className="text-sm font-bold text-[#F0ECE4] mb-3">Escaneie com seu WhatsApp Business</p>
            <img src={`data:image/png;base64,${qrcode}`} alt="QR Code WhatsApp" className="w-48 h-48 mx-auto rounded-xl border border-[#243A66]" />
            <p className="text-xs text-[#7A8FA8] mt-3">Expira em instantes — atualiza automaticamente</p>
          </>
        ) : (
          <>
            <QrCode className="w-10 h-10 text-[#7A8FA8] mx-auto mb-3" />
            <p className="text-sm text-[#7A8FA8] mb-4">Nenhum WhatsApp conectado ainda.</p>
            <button
              onClick={criarSessao}
              disabled={criando}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#C9A84C] text-[#09081A] text-sm font-bold disabled:opacity-60"
            >
              {criando ? <Loader2 className="w-4 h-4 animate-spin" /> : <QrCode className="w-4 h-4" />}
              {criando ? "Gerando..." : "Gerar QR Code"}
            </button>
            {erro && <p className="text-xs text-red-400 mt-3">{erro}</p>}
          </>
        )}
        <button onClick={carregar} className="mt-4 inline-flex items-center gap-1.5 text-xs text-[#7A8FA8] hover:text-[#F0ECE4]">
          <RefreshCw className="w-3 h-3" /> Atualizar
        </button>
      </div>
    </div>
  );
}

// ── Automação ────────────────────────────────────────────────────────────

function AutomacaoTab() {
  const [form, setForm] = useState({ agente_nome: "", empresa_contexto: "", regras_comunicacao: "", ia_ativa_whatsapp: true });
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);

  useEffect(() => {
    fetch("/api/partner/sdr/automacao")
      .then((r) => r.json())
      .then((d) => setForm(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function salvar() {
    setSalvando(true);
    setSalvo(false);
    try {
      const res = await fetch("/api/partner/sdr/automacao", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) { setSalvo(true); setTimeout(() => setSalvo(false), 3000); }
    } catch { /* silencioso */ }
    setSalvando(false);
  }

  if (loading) return <Loader2 className="w-6 h-6 animate-spin text-[#C9A84C]" />;

  return (
    <div className="max-w-2xl space-y-4">
      <div className="bg-[#111F35] border border-[#243A66] rounded-2xl p-5 flex items-center justify-between">
        <div>
          <p className="text-sm font-bold text-[#F0ECE4]">IA automática</p>
          <p className="text-xs text-[#7A8FA8]">Quando desligada, ninguém recebe resposta automática — só você respondendo manualmente.</p>
        </div>
        <button
          onClick={() => setForm((f) => ({ ...f, ia_ativa_whatsapp: !f.ia_ativa_whatsapp }))}
          className={`w-12 h-7 rounded-full flex-shrink-0 transition-colors relative ${form.ia_ativa_whatsapp ? "bg-emerald-500" : "bg-[#243A66]"}`}
        >
          <span className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-transform ${form.ia_ativa_whatsapp ? "translate-x-6" : "translate-x-1"}`} />
        </button>
      </div>

      <div className="bg-[#111F35] border border-[#243A66] rounded-2xl p-5 space-y-4">
        <div>
          <label className="text-xs font-semibold text-[#7A8FA8] uppercase tracking-wide">Nome do agente</label>
          <input
            value={form.agente_nome}
            onChange={(e) => setForm((f) => ({ ...f, agente_nome: e.target.value }))}
            placeholder="Ex: Ana"
            className="w-full mt-1.5 bg-[#0D1929] border border-[#243A66] rounded-xl px-3.5 py-2 text-sm text-[#F0ECE4] outline-none focus:border-[#C9A84C]/50"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-[#7A8FA8] uppercase tracking-wide">Contexto da sua empresa</label>
          <textarea
            value={form.empresa_contexto}
            onChange={(e) => setForm((f) => ({ ...f, empresa_contexto: e.target.value }))}
            placeholder="Conte pra IA quem você é, o que vende, seu diferencial..."
            rows={4}
            className="w-full mt-1.5 bg-[#0D1929] border border-[#243A66] rounded-xl px-3.5 py-2 text-sm text-[#F0ECE4] outline-none focus:border-[#C9A84C]/50 resize-none"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-[#7A8FA8] uppercase tracking-wide">Regras de comunicação</label>
          <textarea
            value={form.regras_comunicacao}
            onChange={(e) => setForm((f) => ({ ...f, regras_comunicacao: e.target.value }))}
            placeholder="Uma regra por linha. Ex: nunca invente preços"
            rows={4}
            className="w-full mt-1.5 bg-[#0D1929] border border-[#243A66] rounded-xl px-3.5 py-2 text-sm text-[#F0ECE4] outline-none focus:border-[#C9A84C]/50 resize-none"
          />
        </div>
      </div>

      <button
        onClick={salvar}
        disabled={salvando}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#C9A84C] text-[#09081A] text-sm font-bold disabled:opacity-60"
      >
        {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : salvo ? <CheckCircle2 className="w-4 h-4" /> : null}
        {salvo ? "Salvo!" : salvando ? "Salvando..." : "Salvar"}
      </button>
    </div>
  );
}

// ── Campanhas ────────────────────────────────────────────────────────────

type Campanha = {
  id: string; nome: string; mensagem_template: string; intervalo_segundos: number;
  status: "rascunho" | "pronta_para_envio" | "pausada"; total_contatos: number;
};
type Contato = { id: string; phone: string; nome: string | null; status: string };

function CampanhasTab() {
  const [campanhas, setCampanhas] = useState<Campanha[]>([]);
  const [loading, setLoading] = useState(true);
  const [selecionada, setSelecionada] = useState<Campanha | null>(null);
  const [contatos, setContatos] = useState<Contato[]>([]);
  const [novoNome, setNovoNome] = useState("");
  const [pasteContatos, setPasteContatos] = useState("");
  const [disparando, setDisparando] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      const res = await fetch("/api/partner/sdr/campanhas");
      const d = await res.json();
      setCampanhas(d.campanhas ?? []);
    } catch { /* silencioso */ }
    setLoading(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  async function abrir(c: Campanha) {
    setSelecionada(c);
    setResultado(null);
    const res = await fetch(`/api/partner/sdr/campanhas/${c.id}`);
    const d = await res.json();
    setContatos(d.contatos ?? []);
  }

  async function criar() {
    if (!novoNome.trim()) return;
    const res = await fetch("/api/partner/sdr/campanhas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome: novoNome.trim() }),
    });
    const d = await res.json();
    setNovoNome("");
    await carregar();
    if (d.campanha) abrir(d.campanha);
  }

  async function salvarMensagem() {
    if (!selecionada) return;
    await fetch(`/api/partner/sdr/campanhas/${selecionada.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mensagem_template: selecionada.mensagem_template, intervalo_segundos: selecionada.intervalo_segundos }),
    });
    carregar();
  }

  async function adicionarContatos() {
    if (!selecionada || !pasteContatos.trim()) return;
    const linhas = pasteContatos.split("\n").map((l) => l.trim()).filter(Boolean);
    const contatosParsed = linhas.map((l) => {
      const [phone, ...resto] = l.split(",");
      return { phone: phone.trim(), nome: resto.join(",").trim() || undefined };
    });
    await fetch(`/api/partner/sdr/campanhas/${selecionada.id}/contatos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contatos: contatosParsed }),
    });
    setPasteContatos("");
    abrir(selecionada);
  }

  async function mudarStatus(status: Campanha["status"]) {
    if (!selecionada) return;
    await fetch(`/api/partner/sdr/campanhas/${selecionada.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setSelecionada({ ...selecionada, status });
    carregar();
  }

  async function disparar() {
    if (!selecionada) return;
    setDisparando(true);
    setResultado(null);
    try {
      const res = await fetch(`/api/partner/sdr/campanhas/${selecionada.id}/disparar`, { method: "POST" });
      const d = await res.json();
      if (res.ok) {
        setResultado(`Enviados: ${d.enviados} · Erros: ${d.erros} · Restantes: ${d.restantes}`);
        abrir(selecionada);
      } else {
        setResultado(d.error ?? "Erro ao disparar");
      }
    } catch {
      setResultado("Erro ao disparar");
    }
    setDisparando(false);
  }

  async function excluir(id: string) {
    await fetch(`/api/partner/sdr/campanhas/${id}`, { method: "DELETE" });
    setSelecionada(null);
    carregar();
  }

  if (loading) return <Loader2 className="w-6 h-6 animate-spin text-[#C9A84C]" />;

  return (
    <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-4">
      <div className="bg-[#111F35] border border-[#243A66] rounded-2xl p-4 space-y-3">
        <div className="flex gap-2">
          <input
            value={novoNome}
            onChange={(e) => setNovoNome(e.target.value)}
            placeholder="Nome da campanha"
            className="flex-1 bg-[#0D1929] border border-[#243A66] rounded-lg px-3 py-1.5 text-sm text-[#F0ECE4] outline-none focus:border-[#C9A84C]/50"
          />
          <button onClick={criar} className="px-3 py-1.5 rounded-lg bg-[#C9A84C] text-[#09081A]"><Plus className="w-4 h-4" /></button>
        </div>
        <div className="space-y-1.5">
          {campanhas.map((c) => (
            <button
              key={c.id}
              onClick={() => abrir(c)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${selecionada?.id === c.id ? "bg-[#243A66] text-[#F0ECE4]" : "text-[#7A8FA8] hover:bg-[#162744]"}`}
            >
              <p className="font-semibold truncate">{c.nome}</p>
              <p className="text-[10px]">{c.total_contatos} contatos · {c.status}</p>
            </button>
          ))}
          {campanhas.length === 0 && <p className="text-xs text-[#7A8FA8] px-1">Nenhuma campanha ainda.</p>}
        </div>
      </div>

      <div className="bg-[#111F35] border border-[#243A66] rounded-2xl p-5">
        {!selecionada ? (
          <p className="text-sm text-[#7A8FA8]">Selecione ou crie uma campanha.</p>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-[#F0ECE4]">{selecionada.nome}</p>
              <button onClick={() => excluir(selecionada.id)} className="text-red-400 hover:text-red-300"><Trash2 className="w-4 h-4" /></button>
            </div>

            <div>
              <label className="text-xs font-semibold text-[#7A8FA8] uppercase tracking-wide">Mensagem (use {"{{nome}}"} pra personalizar)</label>
              <textarea
                value={selecionada.mensagem_template}
                onChange={(e) => setSelecionada({ ...selecionada, mensagem_template: e.target.value })}
                onBlur={salvarMensagem}
                rows={3}
                className="w-full mt-1.5 bg-[#0D1929] border border-[#243A66] rounded-xl px-3.5 py-2 text-sm text-[#F0ECE4] outline-none focus:border-[#C9A84C]/50 resize-none"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-[#7A8FA8] uppercase tracking-wide flex items-center gap-1.5">
                <UsersIcon className="w-3.5 h-3.5" /> Adicionar contatos (um por linha: telefone,nome)
              </label>
              <textarea
                value={pasteContatos}
                onChange={(e) => setPasteContatos(e.target.value)}
                placeholder={"11999999999,João\n11988888888,Maria"}
                rows={3}
                className="w-full mt-1.5 bg-[#0D1929] border border-[#243A66] rounded-xl px-3.5 py-2 text-sm text-[#F0ECE4] outline-none focus:border-[#C9A84C]/50 resize-none"
              />
              <button onClick={adicionarContatos} className="mt-2 px-3 py-1.5 rounded-lg bg-[#243A66] text-[#F0ECE4] text-xs font-semibold">Adicionar</button>
            </div>

            <p className="text-xs text-[#7A8FA8]">{contatos.length} contatos na fila ({contatos.filter((c) => c.status === "pendente").length} pendentes)</p>

            <div className="flex items-center gap-2 pt-2 border-t border-[#243A66]">
              {selecionada.status !== "pronta_para_envio" ? (
                <button onClick={() => mudarStatus("pronta_para_envio")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
                  <Play className="w-3.5 h-3.5" /> Marcar pronta
                </button>
              ) : (
                <>
                  <button onClick={() => mudarStatus("pausada")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-semibold">
                    <Pause className="w-3.5 h-3.5" /> Pausar
                  </button>
                  <button
                    onClick={disparar}
                    disabled={disparando}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[#C9A84C] text-[#09081A] text-xs font-bold disabled:opacity-60"
                  >
                    {disparando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    {disparando ? "Disparando..." : "Disparar"}
                  </button>
                </>
              )}
            </div>
            {resultado && <p className="text-xs text-[#C9A84C]">{resultado}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
