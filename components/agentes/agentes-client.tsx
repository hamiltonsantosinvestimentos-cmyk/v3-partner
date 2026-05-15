"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Send, Plus, Bot, User, Copy, Check, Download, ChevronRight, Loader2, FileText, Briefcase } from "lucide-react";
import { DealIntakeModal } from "@/components/hub/deal-intake-modal";
import type { Squad } from "@/lib/squads";

interface Message { role: "user" | "assistant"; content: string; ts?: string; }
interface Session { id: string; squad_id: string; title: string; updated_at: string; }

interface Props {
  squads: Squad[];
  userRole: string;
  userName: string;
}

const SETOR_COLORS: Record<string, string> = {
  "analista-ma":        "border-[#C9A84C]",
  "deal-hunter":        "border-[#C9A84C]",
  "estrategista":       "border-[#C9A84C]",
  "monitor-regulatorio":"border-[#C9A84C]",
  "pesquisador":        "border-[#C9A84C]",
};

export function AgentesClient({ squads, userName }: Props) {
  const [activeSquad, setActiveSquad]     = useState<Squad>(squads[0]);
  const [messages, setMessages]           = useState<Message[]>([]);
  const [sessions, setSessions]           = useState<Session[]>([]);
  const [sessionId, setSessionId]         = useState<string | null>(null);
  const [input, setInput]                 = useState("");
  const [loading, setLoading]             = useState(false);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [copied, setCopied]               = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen]     = useState(false);
  const [exporting, setExporting]         = useState(false);
  const [exportDone, setExportDone]       = useState(false);
  const [showDealModal, setShowDealModal] = useState(false);
  const [scoutPrefill, setScoutPrefill]   = useState<Record<string, string>>({});
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Load sessions for active squad
  const loadSessions = useCallback(async () => {
    setLoadingSessions(true);
    try {
      const res = await fetch(`/api/agentes/sessions?squad_id=${activeSquad.id}`);
      const data = await res.json();
      setSessions(data.sessions ?? []);
    } catch { /* silencioso */ }
    setLoadingSessions(false);
  }, [activeSquad.id]);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  // Switch squad — new session
  function selectSquad(squad: Squad) {
    setActiveSquad(squad);
    setMessages([]);
    setSessionId(null);
    setInput("");
    setSidebarOpen(false);
  }

  // Load session history
  async function loadSession(sess: Session) {
    try {
      const res = await fetch(`/api/agentes/sessions?session_id=${sess.id}`);
      const data = await res.json();
      if (data.session?.messages) {
        setMessages(data.session.messages as Message[]);
      }
      setSessionId(sess.id);
      setSidebarOpen(false);
    } catch { /* silencioso */ }
  }

  // New session
  function newSession() {
    setMessages([]);
    setSessionId(null);
    setInput("");
  }

  // Send message
  async function send() {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = { role: "user", content: text, ts: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    try {
      const res = await fetch("/api/agentes/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          squad_id: activeSquad.id,
          message: text,
          session_id: sessionId,
          history: messages,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessages(prev => [...prev, {
          role: "assistant",
          content: `⚠️ Erro: ${data.error ?? "Falha na comunicação com o agente."}`,
        }]);
        return;
      }

      const assistantMsg: Message = {
        role: "assistant",
        content: data.response,
        ts: new Date().toISOString(),
      };
      setMessages(prev => [...prev, assistantMsg]);
      if (data.session_id && !sessionId) {
        setSessionId(data.session_id);
        loadSessions();
      }
    } catch {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "⚠️ Falha de conexão. Verifique sua internet e tente novamente.",
      }]);
    } finally {
      setLoading(false);
    }
  }

  // Copy message
  async function copyMsg(content: string, id: string) {
    await navigator.clipboard.writeText(content);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  }

  // Export last assistant message as deal
  async function exportAsDeal() {
    const last = [...messages].reverse().find(m => m.role === "assistant");
    if (!last) return;
    const res = await fetch("/api/hub/share-deal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dealId: sessionId ?? "novo",
        empresaNome: `[${activeSquad.nome}] ${messages[0]?.content?.substring(0, 40) ?? "Deal"}`,
        setor: "ma_cross_border",
        valorEstimado: 0,
        sugestaoTese: last.content,
        emails: [],
      }),
    });
    if (res.ok) alert("Sessão exportada com sucesso.");
  }

  // Passar output do Scout para o Executor de Deals
  function sendToExecutor() {
    const last = [...messages].reverse().find(m => m.role === "assistant");
    if (!last) return;
    const executor = squads.find(s => s.id === "executor-deals");
    if (!executor) return;
    const prefill = `Com base no mapa de mandatários abaixo gerado pelo Market Scout, crie o plano de ação completo com emails, follow-ups e scripts de abordagem:\n\n${last.content}`;
    setActiveSquad(executor);
    setMessages([]);
    setSessionId(null);
    setInput(prefill);
    setSidebarOpen(false);
    setTimeout(() => textareaRef.current?.focus(), 100);
  }

  // Criar deal a partir do Scout
  function openDealFromScout() {
    const last = [...messages].reverse().find(m => m.role === "assistant");
    if (!last) return;

    // Tenta extrair setor do conteúdo
    const content = last.content.toLowerCase();
    let setor = "ma_cross_border";
    if (content.includes("real estate") || content.includes("imóvel") || content.includes("imobil")) setor = "real_estate";
    else if (content.includes("mineração") || content.includes("commodity") || content.includes("diesel") || content.includes("petróleo") || content.includes("commodit")) setor = "mineracao_commodities";
    else if (content.includes("crédito") || content.includes("recebível") || content.includes("fidc") || content.includes("cri")) setor = "credito_recebiveis";

    setScoutPrefill({
      setor,
      origem_lead: "cold_outreach",
      observacoes: `Gerado pelo Market Scout V3.\n\n${last.content.substring(0, 400)}`,
    });
    setShowDealModal(true);
  }

  // Export as V3 HTML Report — usa toda a conversa consolidada
  async function exportAsV3Report() {
    const assistantMessages = messages.filter(m => m.role === "assistant");
    if (!assistantMessages.length || exporting) return;

    setExporting(true);
    setExportDone(false);

    const title = messages[0]?.content?.substring(0, 80) ?? "Relatório V3";

    // Consolida TODAS as respostas do assistente em ordem cronológica
    // (preserva refinamentos feitos ao longo da conversa)
    const consolidatedContent = assistantMessages
      .map((m, i) => assistantMessages.length > 1
        ? `### Análise ${i + 1}\n\n${m.content}`
        : m.content
      )
      .join("\n\n---\n\n");

    try {
      const res = await fetch("/api/agentes/export-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: consolidatedContent,
          squad_id: activeSquad.id,
          title,
          session_id: sessionId,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.html) throw new Error(data.error ?? "Falha");

      // Abrir HTML em nova aba
      const blob = new Blob([data.html], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 10000);

      setExportDone(true);
      setTimeout(() => setExportDone(false), 3000);
    } catch (err) {
      alert("Erro ao gerar relatório: " + (err instanceof Error ? err.message : "desconhecido"));
    } finally {
      setExporting(false);
    }
  }

  // Gerar Prompt de Apresentação para Claude
  const [promptCopied, setPromptCopied] = useState(false);
  const [showPromptModal, setShowPromptModal] = useState(false);
  const [generatedPrompt, setGeneratedPrompt] = useState("");

  function buildPresentationPrompt() {
    const assistantMsgs = messages.filter(m => m.role === "assistant");
    const userFirstMsg   = messages.find(m => m.role === "user")?.content ?? "";
    const sessionContent = assistantMsgs.map(m => m.content).join("\n\n---\n\n");
    const squadLabel     = activeSquad.nome;
    const date           = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

    return `Você é um designer editorial especialista em apresentações institucionais da V3 Partners.

Crie uma apresentação HTML completa, profissional e visualmente impactante com os slides abaixo, seguindo RIGOROSAMENTE a identidade visual V3 Partners.

════════════════════════════════════════
IDENTIDADE VISUAL V3 PARTNERS — OBRIGATÓRIA
════════════════════════════════════════

PALETA DE CORES (usar exatamente estes hex):
  Navy Profundo  #09081A  → fundo principal, body, slides escuros
  Navy Base      #111F35  → cards, seções internas
  Navy Card      #162744  → elementos de destaque
  Navy Médio     #243A66  → bordas, separadores
  Ouro V3        #C9A84C  → títulos, destaques, labels, badges, CTAs
  Ouro Claro     #E8C97A  → gradientes, hover, acento secundário
  Cream          #F0ECE4  → texto principal, títulos grandes
  Muted          #7A8FA8  → corpo de texto, subtítulos

REGRA 90/8/2: 90% navy · 8% cream/muted · 2% ouro
NUNCA: fundo branco, preto puro, azul, vermelho, verde, laranja fora de badges de status

TIPOGRAFIA:
  Fonte exclusiva: DM Sans (Google Fonts)
  Import: https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;0,9..40,800&display=swap
  Títulos de slide: 700-800 · 40-64px · #F0ECE4
  Subtítulos: 600 · 20-28px · #F0ECE4
  Corpo: 400 · 13-15px · #7A8FA8
  Labels/Tags: 700 CAPS · 8-10px · letter-spacing 3px · #C9A84C
  NUNCA: Inter, Montserrat, Bebas Neue, ou qualquer outra fonte

LOGO:
  <img src="https://app.v3partners.com.br/v3-logo-flat-gold-alpha.png" alt="V3 Partners" style="height:44px;width:auto;">
  Presente em TODOS os slides no canto superior esquerdo ou rodapé

════════════════════════════════════════
ESTRUTURA OBRIGATÓRIA DA APRESENTAÇÃO
════════════════════════════════════════

Crie slides como seções HTML rolável ou usando navegação por JS.
Cada slide: width 100vw / height 100vh (fullscreen), fundo navy, padding 60-80px.

SLIDES OBRIGATÓRIOS:

Slide 1 — CAPA
  Logo V3 Partners (canto superior esquerdo)
  Badge: "${squadLabel} · V3 Partners"
  Título principal grande: baseado no tema da sessão
  Subtítulo: descrição em 1 linha
  Data: ${date}
  Faixa dourada no rodapé

Slide 2 — CONTEXTO / BRIEFING
  O que motivou esta análise (baseado na primeira pergunta do usuário)
  3-4 pontos principais em cards navy-card

Slide 3 ao N — CONTEÚDO PRINCIPAL
  Adapte o número de slides ao conteúdo abaixo
  Cada seção vira um slide
  Use cards, badges, ícones SVG inline e tabelas quando cabível
  Bullets com ● (ponto dourado) em vez de hífen
  Dados numéricos em destaque com fonte grande e cor ouro

Último Slide — PRÓXIMOS PASSOS / CTA
  3-5 ações concretas
  Contato: João Lemos | Head de Ativos | +55 21 98993-7178 | v3partners.com.br
  Logo V3 grande centralizada

════════════════════════════════════════
REQUISITOS TÉCNICOS
════════════════════════════════════════

- DOCTYPE html + meta charset UTF-8 + viewport
- CSS @page print ready com -webkit-print-color-adjust: exact
- Navegação: botões Anterior/Próximo com setas ← → OU scroll snap
- Responsivo mas otimizado para 16:9 (1280×720px ou 1920×1080px)
- Cada slide com page-break-after: always para impressão
- Animações sutis de entrada (opacity + transform) opcionais
- Sem dependências externas além de Google Fonts
- HTML completo e autossuficiente, começando com <!DOCTYPE html>

════════════════════════════════════════
CONTEÚDO DA SESSÃO — ${squadLabel.toUpperCase()}
════════════════════════════════════════

Pergunta/tema original do usuário:
${userFirstMsg.substring(0, 300)}${userFirstMsg.length > 300 ? "..." : ""}

Análise e conteúdo gerado:
${sessionContent}

════════════════════════════════════════

IMPORTANTE:
- Retorne APENAS o HTML completo, começando com <!DOCTYPE html>
- Adapte o conteúdo para formato de slides — síntese visual, não texto corrido
- Cada ponto importante vira um elemento visual (card, badge, número em destaque)
- Tom: institucional, direto, premium — nível Pentagram/McKinsey para M&A
- Versão PT-BR, mas manter termos técnicos em inglês quando padrão de mercado`;
  }

  function openPromptModal() {
    const prompt = buildPresentationPrompt();
    setGeneratedPrompt(prompt);
    setShowPromptModal(true);
    setPromptCopied(false);
  }

  async function copyPrompt() {
    await navigator.clipboard.writeText(generatedPrompt);
    setPromptCopied(true);
    setTimeout(() => setPromptCopied(false), 3000);
  }

  // Export as text file
  function exportAsText() {
    const content = messages
      .map(m => `[${m.role === "user" ? userName || "Você" : activeSquad.nome}]\n${m.content}`)
      .join("\n\n---\n\n");
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `v3-${activeSquad.id}-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Auto-resize textarea
  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 160) + "px";
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  }

  return (
    <div className="flex h-[calc(100vh-64px)] bg-[#09081A] overflow-hidden">

      {/* ── Squad Sidebar ── */}
      <div className="w-64 shrink-0 bg-[#111F35] border-r border-[#243A66] flex flex-col">
        <div className="px-4 py-4 border-b border-[#243A66]">
          <span className="text-[#C9A84C] text-[9px] font-bold tracking-[2px] uppercase">Squads V3</span>
          <p className="text-[#7A8FA8] text-[10px] mt-0.5">Selecione um agente</p>
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          {squads.map(sq => (
            <button
              key={sq.id}
              onClick={() => selectSquad(sq)}
              className={`w-full text-left px-4 py-3 transition-colors border-l-2 ${
                activeSquad.id === sq.id
                  ? "bg-[#162744] border-[#C9A84C] text-[#F0ECE4]"
                  : "border-transparent text-[#7A8FA8] hover:bg-[#162744] hover:text-[#F0ECE4]"
              }`}
            >
              <div className="text-xs font-semibold">{sq.nome}</div>
              <div className="text-[10px] mt-0.5 opacity-70 leading-tight">{sq.descricao}</div>
            </button>
          ))}
        </div>

        {/* Session history */}
        <div className="border-t border-[#243A66] p-3">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="w-full flex items-center justify-between text-[10px] text-[#7A8FA8] hover:text-[#F0ECE4] transition-colors"
          >
            <span>Sessões anteriores ({sessions.length})</span>
            <ChevronRight className={`w-3 h-3 transition-transform ${sidebarOpen ? "rotate-90" : ""}`} />
          </button>
          {sidebarOpen && (
            <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
              {loadingSessions ? (
                <Loader2 className="w-3 h-3 animate-spin text-[#7A8FA8] mx-auto" />
              ) : sessions.length === 0 ? (
                <p className="text-[#7A8FA8] text-[10px] text-center py-2">Nenhuma sessão</p>
              ) : sessions.map(sess => (
                <button
                  key={sess.id}
                  onClick={() => loadSession(sess)}
                  className={`w-full text-left text-[10px] px-2 py-1.5 rounded transition-colors truncate ${
                    sessionId === sess.id
                      ? "bg-[#C9A84C]/20 text-[#C9A84C]"
                      : "text-[#7A8FA8] hover:bg-[#162744] hover:text-[#F0ECE4]"
                  }`}
                >
                  {sess.title}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Main Chat Area ── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-[#243A66] bg-[#111F35] shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <Bot className="w-4 h-4 text-[#C9A84C]" />
              <span className="text-[#F0ECE4] font-semibold text-sm">{activeSquad.nome}</span>
              <span className="text-[#C9A84C] text-[9px] font-bold tracking-[1px] uppercase bg-[#C9A84C]/10 px-2 py-0.5 rounded-full">
                {activeSquad.tag}
              </span>
            </div>
            <p className="text-[#7A8FA8] text-[10px] mt-0.5">{activeSquad.descricao}</p>
          </div>
          <div className="flex items-center gap-2">
            {messages.length > 0 && (
              <>
                <button
                  onClick={exportAsText}
                  className="flex items-center gap-1.5 text-[10px] text-[#7A8FA8] hover:text-[#F0ECE4] px-2.5 py-1.5 rounded-lg border border-[#243A66] hover:border-[#C9A84C] transition-colors"
                >
                  <Download className="w-3 h-3" />
                  .txt
                </button>
                <button
                  onClick={openPromptModal}
                  className="flex items-center gap-1.5 text-[10px] text-[#C9A84C] bg-[#C9A84C]/10 hover:bg-[#C9A84C]/20 font-semibold px-2.5 py-1.5 rounded-lg border border-[#C9A84C]/30 hover:border-[#C9A84C] transition-colors"
                  title="Gera prompt otimizado para criar apresentação V3 no Claude"
                >
                  <FileText className="w-3 h-3" />
                  Apresentação
                </button>
              </>
            )}
            <button
              onClick={newSession}
              className="flex items-center gap-1.5 text-[10px] text-[#09081A] bg-[#C9A84C] hover:bg-[#E8C97A] font-bold px-3 py-1.5 rounded-lg transition-colors"
            >
              <Plus className="w-3 h-3" />
              Nova sessão
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {messages.length === 0 ? (
            <WelcomeScreen squad={activeSquad} onSuggest={text => { setInput(text); textareaRef.current?.focus(); }} />
          ) : (
            messages.map((msg, i) => {
              const isLast = i === messages.length - 1 && msg.role === "assistant";
              return (
                <MessageBubble
                  key={i}
                  msg={msg}
                  squad={activeSquad}
                  userName={userName}
                  copied={copied}
                  onCopy={content => copyMsg(content, `msg-${i}`)}
                  copyId={`msg-${i}`}
                  isLastAssistant={isLast}
                  onExport={exportAsV3Report}
                  exporting={exporting}
                  exportDone={exportDone}
                  onCreateDeal={activeSquad.id === "market-scout" && isLast ? openDealFromScout : undefined}
                  onSendToExecutor={activeSquad.id === "market-scout" && isLast ? sendToExecutor : undefined}
                />
              );
            })
          )}
          {loading && <ThinkingIndicator squad={activeSquad} />}
          <div ref={bottomRef} />
        </div>

        {/* Modal Criar Deal — Market Scout */}
        {showDealModal && (
          <DealIntakeModal
            prefill={scoutPrefill}
            onClose={() => setShowDealModal(false)}
            onSuccess={() => setShowDealModal(false)}
          />
        )}

        {/* ── Modal Prompt de Apresentação ─────────────────────────────── */}
        {showPromptModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="w-full max-w-2xl bg-[#111F35] border border-[#243A66] rounded-xl shadow-2xl flex flex-col max-h-[85vh]">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-[#243A66]">
                <div>
                  <p className="text-[9px] font-bold tracking-[3px] uppercase text-[#C9A84C] mb-0.5">Prompt de Apresentação</p>
                  <h2 className="text-sm font-bold text-[#F0ECE4]">Copie e execute no Claude para gerar slides V3</h2>
                </div>
                <button onClick={() => setShowPromptModal(false)} className="text-[#7A8FA8] hover:text-[#F0ECE4] transition-colors text-lg leading-none">✕</button>
              </div>

              {/* Instrução */}
              <div className="px-6 py-3 bg-[#162744] border-b border-[#243A66]">
                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-[#C9A84C] flex items-center justify-center flex-shrink-0 text-[#09081A] font-bold text-[10px] mt-0.5">1</div>
                  <p className="text-[11px] text-[#7A8FA8]">Clique <strong className="text-[#F0ECE4]">Copiar Prompt</strong></p>
                </div>
                <div className="flex items-start gap-3 mt-2">
                  <div className="w-5 h-5 rounded-full bg-[#C9A84C] flex items-center justify-center flex-shrink-0 text-[#09081A] font-bold text-[10px] mt-0.5">2</div>
                  <p className="text-[11px] text-[#7A8FA8]">Abra <strong className="text-[#F0ECE4]">claude.ai</strong> → nova conversa → cole o prompt → envie</p>
                </div>
                <div className="flex items-start gap-3 mt-2">
                  <div className="w-5 h-5 rounded-full bg-[#C9A84C] flex items-center justify-center flex-shrink-0 text-[#09081A] font-bold text-[10px] mt-0.5">3</div>
                  <p className="text-[11px] text-[#7A8FA8]">Claude gera o HTML da apresentação completa → copie o código → abra no browser → Ctrl+P para PDF</p>
                </div>
              </div>

              {/* Prompt preview */}
              <div className="flex-1 overflow-y-auto px-6 py-4">
                <pre className="text-[10px] text-[#7A8FA8] leading-relaxed whitespace-pre-wrap font-mono bg-[#09081A] border border-[#243A66] rounded-lg p-4 max-h-64 overflow-y-auto">
                  {generatedPrompt.substring(0, 800)}...
                  {"\n\n[+ " + (generatedPrompt.length - 800).toLocaleString() + " caracteres de conteúdo da sessão]"}
                </pre>
              </div>

              {/* Actions */}
              <div className="px-6 py-4 border-t border-[#243A66] flex gap-3">
                <button
                  onClick={() => setShowPromptModal(false)}
                  className="flex-1 rounded-lg border border-[#243A66] text-[#7A8FA8] text-sm py-2.5 hover:text-[#F0ECE4] transition-colors"
                >
                  Fechar
                </button>
                <button
                  onClick={copyPrompt}
                  className={`flex-1 rounded-lg text-sm font-bold py-2.5 flex items-center justify-center gap-2 transition-all ${
                    promptCopied
                      ? "bg-emerald-500 text-white"
                      : "bg-[#C9A84C] hover:bg-[#E8C97A] text-[#09081A]"
                  }`}
                >
                  {promptCopied
                    ? <><Check className="w-4 h-4" />Copiado!</>
                    : <><Copy className="w-4 h-4" />Copiar Prompt Completo</>
                  }
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Input */}
        <div className="px-6 py-4 border-t border-[#243A66] bg-[#111F35] shrink-0">
          <div className="flex gap-3 items-end">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              placeholder={`Pergunte ao ${activeSquad.nome}… (Enter para enviar, Shift+Enter para nova linha)`}
              rows={1}
              className="flex-1 bg-[#09081A] border border-[#243A66] focus:border-[#C9A84C] rounded-xl px-4 py-3 text-sm text-[#F0ECE4] placeholder:text-[#7A8FA8] resize-none outline-none transition-colors leading-relaxed"
            />
            <button
              onClick={send}
              disabled={!input.trim() || loading}
              className="w-11 h-11 flex items-center justify-center bg-[#C9A84C] hover:bg-[#E8C97A] disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition-colors shrink-0"
            >
              {loading ? <Loader2 className="w-4 h-4 text-[#09081A] animate-spin" /> : <Send className="w-4 h-4 text-[#09081A]" />}
            </button>
          </div>
          <p className="text-[#7A8FA8] text-[10px] mt-2 text-center">
            Respostas geradas por IA · Valide informações críticas antes de agir · Sócio responsável: {activeSquad.id === "monitor-regulatorio" ? "Robson Lino" : "João Lemos"}
          </p>
        </div>
      </div>
    </div>
  );
}

function WelcomeScreen({ squad, onSuggest }: { squad: Squad; onSuggest: (t: string) => void }) {
  const SUGESTOES: Record<string, string[]> = {
    "executor-deals": [
      "Cole aqui o output do Market Scout e gere o plano de ação completo com emails e follow-ups",
      "Tenho 3 targets identificados no setor de frigoríficos no Nordeste — crie os emails de cold outreach",
      "Preciso de uma sequência de 5 follow-ups para um fundo de PE americano interessado em lítio brasileiro",
    ],
    "market-scout": [
      "Buyer Side: fundo de PE americano busca usinas de etanol no Brasil, ticket USD 50–200M",
      "Seller Side: quem são os mandatários de diesel EN-590 exportação nas Américas — USGC e Brasil",
      "Match request: investidor asiático quer minério de lítio brasileiro — mapeie vendedores e intermediários",
    ],
    "analista-ma": [
      "Analise uma distribuidora de alimentos com faturamento de R$ 20M e EBITDA de 8%",
      "Qual instrumento financeiro é mais adequado para antecipar recebíveis de uma construtora?",
      "Faça um checklist de due diligence para aquisição de uma usina sucroalcooleira",
    ],
    "deal-hunter": [
      "Mapeie frigoríficos no Nordeste com potencial de venda nos próximos 12 meses",
      "Identifique empresas familiares em processo de sucessão no setor de mineração",
      "Quais sinais indicam que uma empresa está disponível para M&A?",
    ],
    "estrategista": [
      "Estruture uma operação de SLB para um galpão logístico de R$ 8M",
      "Compare CRI vs FIDC para securitização de recebíveis imobiliários",
      "Calcule o fee V3 para uma operação de captação de R$ 15M",
    ],
    "monitor-regulatorio": [
      "Resuma as principais mudanças da CVM Resolução 88 para tokenização",
      "Quais são as obrigações PLD-FT para uma securitizadora em 2026?",
      "Como estruturar uma operação cross-border dentro da regulação do Banco Central?",
    ],
    "pesquisador": [
      "Faça um relatório do mercado de mineração de lítio no Brasil em 2026",
      "Mapeie os principais players do mercado de precatórios federais",
      "Analise o setor sucroalcooleiro: oportunidades e riscos para 2026/27",
    ],
  };

  const sugestoes = SUGESTOES[squad.id] ?? [];

  return (
    <div className="flex flex-col items-center justify-center h-full text-center py-12">
      <div className="w-16 h-16 rounded-2xl bg-[#111F35] border border-[#243A66] flex items-center justify-center mb-4">
        <Bot className="w-8 h-8 text-[#C9A84C]" />
      </div>
      <h2 className="text-[#F0ECE4] text-xl font-bold mb-1">{squad.nome}</h2>
      <p className="text-[#7A8FA8] text-sm mb-8 max-w-sm">{squad.descricao}</p>

      {sugestoes.length > 0 && (
        <div className="w-full max-w-lg space-y-2">
          <p className="text-[#7A8FA8] text-[10px] uppercase tracking-[2px] mb-3">Sugestões para começar</p>
          {sugestoes.map((s, i) => (
            <button
              key={i}
              onClick={() => onSuggest(s)}
              className="w-full text-left text-sm text-[#7A8FA8] hover:text-[#F0ECE4] bg-[#111F35] hover:bg-[#162744] border border-[#243A66] hover:border-[#C9A84C] rounded-xl px-4 py-3 transition-all"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function MessageBubble({ msg, squad, userName, copied, onCopy, copyId, isLastAssistant, onExport, exporting, exportDone, onCreateDeal, onSendToExecutor }: {
  msg: Message; squad: Squad; userName: string;
  copied: string | null; onCopy: (c: string) => void; copyId: string;
  isLastAssistant?: boolean; onExport?: () => void; exporting?: boolean; exportDone?: boolean;
  onCreateDeal?: () => void; onSendToExecutor?: () => void;
}) {
  const isUser = msg.role === "user";

  return (
    <div className={`flex gap-3 group ${isUser ? "flex-row-reverse" : ""}`}>
      {/* Avatar */}
      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
        isUser ? "bg-[#243A66]" : "bg-[#C9A84C]/20"
      }`}>
        {isUser
          ? <User className="w-4 h-4 text-[#7A8FA8]" />
          : <Bot className="w-4 h-4 text-[#C9A84C]" />
        }
      </div>

      {/* Bubble */}
      <div className={`flex flex-col max-w-[80%] ${isUser ? "items-end" : "items-start"}`}>
        <span className="text-[10px] text-[#7A8FA8] mb-1 px-1">
          {isUser ? (userName || "Você") : squad.nome}
        </span>
        <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
          isUser
            ? "bg-[#243A66] text-[#F0ECE4] rounded-tr-sm"
            : "bg-[#111F35] border border-[#243A66] text-[#F0ECE4] rounded-tl-sm"
        }`}>
          {msg.content}
        </div>

        {/* Actions: copy + export (última resposta do agente) */}
        {!isUser && (
          <div className="mt-2 flex items-center gap-2 px-1">
            <button
              onClick={() => onCopy(msg.content)}
              className="flex items-center gap-1 text-[10px] text-[#7A8FA8] hover:text-[#C9A84C] opacity-0 group-hover:opacity-100 transition-all"
            >
              {copied === copyId
                ? <><Check className="w-3 h-3" /> Copiado</>
                : <><Copy className="w-3 h-3" /> Copiar</>
              }
            </button>

            {/* Botão de exportar — só na última resposta */}
            {isLastAssistant && onExport && (
              <button
                onClick={onExport}
                disabled={exporting}
                className="flex items-center gap-1.5 text-[10px] font-semibold px-3 py-1.5 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-[#C9A84C] hover:bg-[#E8C97A] text-[#09081A]"
              >
                {exporting ? (
                  <><Loader2 className="w-3 h-3 animate-spin" /> Gerando relatório...</>
                ) : exportDone ? (
                  <><Check className="w-3 h-3" /> Relatório gerado!</>
                ) : (
                  <><FileText className="w-3 h-3" /> Gerar Relatório V3</>
                )}
              </button>
            )}

            {/* Botão Criar Deal — só no Market Scout, última resposta */}
            {isLastAssistant && onCreateDeal && (
              <button
                onClick={onCreateDeal}
                className="flex items-center gap-1.5 text-[10px] font-semibold px-3 py-1.5 rounded-lg transition-all bg-[#162744] hover:bg-[#243A66] border border-[#243A66] hover:border-[#C9A84C] text-[#F0ECE4]"
              >
                <Briefcase className="w-3 h-3 text-[#C9A84C]" />
                Criar Deal
              </button>
            )}

            {/* Botão Executor de Deals — passa output do Scout diretamente */}
            {isLastAssistant && onSendToExecutor && (
              <button
                onClick={onSendToExecutor}
                className="flex items-center gap-1.5 text-[10px] font-semibold px-3 py-1.5 rounded-lg transition-all bg-[#C9A84C]/15 hover:bg-[#C9A84C]/30 border border-[#C9A84C]/40 hover:border-[#C9A84C] text-[#C9A84C]"
              >
                <Send className="w-3 h-3" />
                Gerar Plano de Ação
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ThinkingIndicator({ squad }: { squad: Squad }) {
  const isScout = squad.id === "market-scout";
  return (
    <div className="flex gap-3">
      <div className="w-8 h-8 rounded-full bg-[#C9A84C]/20 flex items-center justify-center shrink-0">
        <Bot className="w-4 h-4 text-[#C9A84C]" />
      </div>
      <div className="bg-[#111F35] border border-[#243A66] rounded-2xl rounded-tl-sm px-4 py-3">
        <div className="flex gap-1 items-center">
          <span className="text-[#7A8FA8] text-xs">
            {isScout ? "Market Scout mapeando mandatários" : `${squad.nome} está pensando`}
          </span>
          <span className="flex gap-0.5">
            {[0,1,2].map(i => (
              <span key={i} className="w-1 h-1 rounded-full bg-[#C9A84C] animate-bounce"
                style={{ animationDelay: `${i * 150}ms` }} />
            ))}
          </span>
        </div>
        {isScout && (
          <p className="text-[#7A8FA8] text-[10px] mt-1">
            Pesquisando Buyer Side + Seller Side · Pode levar até 30s
          </p>
        )}
      </div>
    </div>
  );
}
