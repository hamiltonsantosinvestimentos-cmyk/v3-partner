"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import {
  ChevronDown, ArrowRight, Check, Star, Shield, Zap, TrendingUp,
  Building2, Users, DollarSign, Award, BookOpen, MessageSquare,
  BarChart3, Globe, Lock, ChevronRight, X, Menu,
} from "lucide-react";

// ── Helpers ────────────────────────────────────────────────────────────────
function formatCurrency(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

// ── Animated Counter ───────────────────────────────────────────────────────
function Counter({ to, prefix = "", suffix = "", duration = 2000 }: { to: number; prefix?: string; suffix?: string; duration?: number }) {
  const [val, setVal] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      const start = Date.now();
      const tick = () => {
        const elapsed = Date.now() - start;
        const progress = Math.min(elapsed / duration, 1);
        const ease = 1 - Math.pow(1 - progress, 3);
        setVal(Math.round(to * ease));
        if (progress < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, { threshold: 0.3 });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [to, duration]);
  return <span ref={ref}>{prefix}{val.toLocaleString("pt-BR")}{suffix}</span>;
}

// ── FAQ Item ───────────────────────────────────────────────────────────────
function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="border rounded-xl overflow-hidden transition-all cursor-pointer"
      style={{ borderColor: open ? "#C9A84C40" : "#243A66", background: open ? "#111F35" : "#0D1929" }}
      onClick={() => setOpen(o => !o)}
    >
      <div className="flex items-center justify-between px-6 py-4 gap-4">
        <p className="font-semibold text-sm" style={{ color: "#F0ECE4" }}>{q}</p>
        <ChevronDown
          className="flex-shrink-0 transition-transform"
          style={{ color: "#C9A84C", transform: open ? "rotate(180deg)" : "rotate(0)" }}
          size={18}
        />
      </div>
      {open && (
        <div className="px-6 pb-5 border-t" style={{ borderColor: "#243A66" }}>
          <p className="text-sm leading-relaxed mt-4" style={{ color: "#7A8FA8" }}>{a}</p>
        </div>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────
export function LandingPageClient() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [formData, setFormData] = useState({ nome: "", email: "", telefone: "", segmento: "", plano: "PARTNER" });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", handler);
    return () => window.removeEventListener("scroll", handler);
  }, []);

  function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    setMenuOpen(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.nome || !formData.email || !formData.telefone) {
      setFormError("Preencha nome, e-mail e telefone.");
      return;
    }
    setSending(true);
    setFormError("");
    try {
      const res = await fetch("/api/parceiro/cadastro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        setSent(true);
      } else {
        const d = await res.json();
        setFormError(d.error ?? "Erro ao enviar. Tente novamente.");
      }
    } catch {
      setFormError("Erro de conexão. Tente novamente.");
    } finally {
      setSending(false);
    }
  }

  const GOLD = "#C9A84C";
  const NAVY = "#09081A";
  const NAVY2 = "#111F35";
  const CREAM = "#F0ECE4";
  const MUTED = "#7A8FA8";

  return (
    <div style={{ background: NAVY, color: CREAM, fontFamily: "'DM Sans', sans-serif", overflowX: "hidden" }}>

      {/* ── Google Fonts ── */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />

      {/* ── NAVBAR ─────────────────────────────────────────────────────────── */}
      <nav
        className="fixed top-0 left-0 right-0 z-50 transition-all"
        style={{ background: scrolled ? "rgba(9,8,26,0.96)" : "transparent", backdropFilter: scrolled ? "blur(12px)" : "none", borderBottom: scrolled ? "1px solid #243A66" : "none" }}
      >
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image src="/logo.jpg" alt="V3 Partners" width={36} height={36} className="rounded-lg" />
            <span style={{ fontWeight: 800, fontSize: 16, color: GOLD, letterSpacing: 2 }}>V3 PARTNERS</span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            {[["O que é", "oque"], ["Benefícios", "beneficios"], ["Planos", "planos"], ["FAQ", "faq"]].map(([label, id]) => (
              <button key={id} onClick={() => scrollTo(id)} className="text-sm transition-colors hover:text-white" style={{ color: MUTED }}>{label}</button>
            ))}
          </div>
          <button
            onClick={() => scrollTo("cadastro")}
            className="hidden md:flex items-center gap-2 px-5 py-2 rounded-xl font-bold text-sm transition-all hover:opacity-90"
            style={{ background: GOLD, color: NAVY }}
          >
            Quero ser Partner <ArrowRight size={14} />
          </button>
          <button onClick={() => setMenuOpen(o => !o)} className="md:hidden" style={{ color: CREAM }}>
            {menuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
        {menuOpen && (
          <div className="md:hidden px-6 py-4 space-y-3" style={{ background: "rgba(9,8,26,0.98)", borderTop: "1px solid #243A66" }}>
            {[["O que é", "oque"], ["Benefícios", "beneficios"], ["Planos", "planos"], ["FAQ", "faq"], ["Quero ser Partner", "cadastro"]].map(([label, id]) => (
              <button key={id} onClick={() => scrollTo(id)} className="block w-full text-left py-2 text-sm" style={{ color: CREAM }}>{label}</button>
            ))}
          </div>
        )}
      </nav>

      {/* ── HERO ───────────────────────────────────────────────────────────── */}
      <section style={{ minHeight: "100vh", display: "flex", alignItems: "center", position: "relative", overflow: "hidden" }}>
        {/* Background gradient */}
        <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse 80% 60% at 50% 0%, rgba(201,168,76,0.08) 0%, transparent 70%)` }} />
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)` }} />

        <div className="max-w-6xl mx-auto px-6 py-32 w-full">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-8" style={{ background: "rgba(201,168,76,0.1)", border: "1px solid rgba(201,168,76,0.25)" }}>
              <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: GOLD }} />
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: GOLD }}>BOUTIQUE FINANCEIRA INSTITUCIONAL</span>
            </div>

            <h1 style={{ fontSize: "clamp(36px, 6vw, 72px)", fontWeight: 900, lineHeight: 1.1, marginBottom: 24, color: CREAM }}>
              Acesse operações de{" "}
              <span style={{ color: GOLD }}>alto ticket</span>{" "}
              com até{" "}
              <span style={{ color: GOLD }}>50% de comissionamento</span>
            </h1>

            <p style={{ fontSize: "clamp(16px, 2vw, 20px)", color: MUTED, lineHeight: 1.7, marginBottom: 48, maxWidth: 640, margin: "0 auto 48px" }}>
              A V3 Partners é uma boutique institucional multiproduto de securitização e estruturação financeira. Como Partner, você acessa crédito estruturado, M&A, real estate e commodities — com plataforma própria e suporte completo.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={() => scrollTo("cadastro")}
                className="flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-bold text-base transition-all hover:opacity-90 hover:scale-105"
                style={{ background: GOLD, color: NAVY }}
              >
                Quero ser Partner <ArrowRight size={18} />
              </button>
              <button
                onClick={() => scrollTo("planos")}
                className="flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-bold text-base transition-all hover:border-[#C9A84C]/60"
                style={{ border: "1px solid #243A66", color: CREAM }}
              >
                Ver planos e valores
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-20 max-w-4xl mx-auto">
            {[
              { label: "Comissionamento máximo", value: 50, suffix: "%" },
              { label: "Verticais de receita", value: 4, suffix: "" },
              { label: "Ticket mínimo M&A (R$)", value: 1000000, suffix: "" },
              { label: "Meses de operação", value: 36, suffix: "+" },
            ].map(({ label, value, suffix }) => (
              <div key={label} className="rounded-xl p-5 text-center" style={{ background: NAVY2, border: "1px solid #243A66" }}>
                <p style={{ fontSize: "clamp(24px, 4vw, 36px)", fontWeight: 900, color: GOLD }}>
                  <Counter to={value} suffix={suffix} />
                </p>
                <p style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce" style={{ color: MUTED }}>
          <ChevronDown size={24} />
        </div>
      </section>

      {/* ── O QUE É ────────────────────────────────────────────────────────── */}
      <section id="oque" className="py-24" style={{ background: "#070615" }}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: 3, color: GOLD, marginBottom: 16 }}>O QUE É A V3 PARTNERS</p>
              <h2 style={{ fontSize: "clamp(28px, 4vw, 42px)", fontWeight: 800, lineHeight: 1.2, marginBottom: 20, color: CREAM }}>
                Uma boutique que opera onde poucos têm acesso
              </h2>
              <p style={{ color: MUTED, lineHeight: 1.8, marginBottom: 24, fontSize: 15 }}>
                A V3 Partners estrutura operações financeiras de alto valor para empresas, investidores e patrimônios. Nossa rede de partners atua como ponte entre clientes e as melhores soluções do mercado institucional brasileiro.
              </p>
              <p style={{ color: MUTED, lineHeight: 1.8, fontSize: 15 }}>
                Com plataforma tecnológica própria, mesa de crédito especializada, squads de inteligência artificial e apoio jurídico e compliance, você opera com a estrutura de uma instituição — sem os custos dela.
              </p>
              <div className="mt-8 space-y-3">
                {[
                  "Operações a partir de R$200.000 em crédito estruturado",
                  "M&A com tickets entre R$1M e R$100M+",
                  "Securitização: CRI, FIDC, precatórios, CGI",
                  "Real estate: SLB, BTS, BTR e fundos imobiliários",
                  "Mineração, commodities e cross-border",
                ].map(item => (
                  <div key={item} className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center mt-0.5" style={{ background: "rgba(201,168,76,0.15)", border: "1px solid rgba(201,168,76,0.3)" }}>
                      <Check size={10} color={GOLD} />
                    </div>
                    <p style={{ fontSize: 14, color: MUTED }}>{item}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { icon: <Building2 size={24} color={GOLD} />, title: "Crédito Estruturado", desc: "CGI, home equity, FIDC, CRI e linhas corporativas" },
                { icon: <TrendingUp size={24} color={GOLD} />, title: "M&A", desc: "Pipeline completo com FORJA IA e Deal Rooms" },
                { icon: <Globe size={24} color={GOLD} />, title: "Cross-Border", desc: "Fundos asiáticos, americanos e OTC/cripto 24/7" },
                { icon: <BarChart3 size={24} color={GOLD} />, title: "Real Estate", desc: "Sale-leaseback, built-to-suit e tokenização" },
                { icon: <Shield size={24} color={GOLD} />, title: "Compliance", desc: "Suporte jurídico, KYC e trilha de auditoria" },
                { icon: <Zap size={24} color={GOLD} />, title: "Plataforma IA", desc: "7 squads de IA + assistente V3 Partner 24h" },
              ].map(({ icon, title, desc }) => (
                <div key={title} className="rounded-xl p-5" style={{ background: NAVY2, border: "1px solid #243A66" }}>
                  <div className="mb-3">{icon}</div>
                  <p style={{ fontWeight: 700, fontSize: 13, color: CREAM, marginBottom: 4 }}>{title}</p>
                  <p style={{ fontSize: 11, color: MUTED, lineHeight: 1.5 }}>{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── O QUE FAZ UM PARTNER ────────────────────────────────────────────── */}
      <section className="py-24" style={{ background: NAVY }}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: 3, color: GOLD, marginBottom: 12 }}>O QUE FAZ UM PARTNER V3</p>
            <h2 style={{ fontSize: "clamp(28px, 4vw, 42px)", fontWeight: 800, lineHeight: 1.2, color: CREAM }}>
              Você origina. A V3 estrutura e fecha.
            </h2>
            <p style={{ color: MUTED, marginTop: 16, maxWidth: 560, margin: "16px auto 0", fontSize: 15 }}>
              Seu papel é conectar clientes às soluções. Nossa equipe cuida de toda a estruturação, análise, compliance e fechamento.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { step: "01", title: "Você identifica a necessidade", desc: "Seu cliente precisa de crédito, quer vender a empresa, busca financiamento imobiliário ou quer diversificar patrimônio. Você traz o lead." },
              { step: "02", title: "A V3 estrutura a operação", desc: "Nossa mesa de crédito, equipe de M&A e IA analisam, estruturam e encaminham para as melhores instituições financeiras parceiras." },
              { step: "03", title: "Você recebe a comissão", desc: "Com o fechamento, você recebe entre 30% e 50% do resultado líquido da operação — rastreado e transparente na plataforma." },
            ].map(({ step, title, desc }) => (
              <div key={step} className="rounded-2xl p-8 relative overflow-hidden" style={{ background: NAVY2, border: "1px solid #243A66" }}>
                <div style={{ position: "absolute", top: -10, right: -10, fontSize: 80, fontWeight: 900, color: "rgba(201,168,76,0.05)", lineHeight: 1 }}>{step}</div>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-5" style={{ background: "rgba(201,168,76,0.1)", border: "1px solid rgba(201,168,76,0.2)" }}>
                  <span style={{ fontWeight: 900, fontSize: 13, color: GOLD }}>{step}</span>
                </div>
                <h3 style={{ fontWeight: 700, fontSize: 17, color: CREAM, marginBottom: 12 }}>{title}</h3>
                <p style={{ color: MUTED, fontSize: 14, lineHeight: 1.7 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── QUEM PODE SER ───────────────────────────────────────────────────── */}
      <section className="py-24" style={{ background: "#070615" }}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: 3, color: GOLD, marginBottom: 12 }}>QUEM PODE SER PARTNER</p>
            <h2 style={{ fontSize: "clamp(28px, 4vw, 42px)", fontWeight: 800, lineHeight: 1.2, color: CREAM }}>
              Você não precisa ser do mercado financeiro
            </h2>
            <p style={{ color: MUTED, marginTop: 16, maxWidth: 560, margin: "16px auto 0", fontSize: 15 }}>
              O único requisito é ter vontade de gerar negócios. A estrutura, o conhecimento e o suporte são nossos.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: <Users size={22} color={GOLD} />, title: "Consultores e assessores", desc: "Que querem expandir o portfólio de soluções para seus clientes" },
              { icon: <Building2 size={22} color={GOLD} />, title: "Contadores e advogados", desc: "Com acesso a empresas que precisam de crédito ou M&A" },
              { icon: <TrendingUp size={22} color={GOLD} />, title: "Corretores de imóveis", desc: "Que atuam com imóveis comerciais e conhecem o mercado" },
              { icon: <DollarSign size={22} color={GOLD} />, title: "Profissionais de crédito", desc: "Que querem operar com tickets maiores e mais estrutura" },
              { icon: <BarChart3 size={22} color={GOLD} />, title: "Gestores e executivos", desc: "Que têm acesso a tomadores de decisão em empresas" },
              { icon: <Globe size={22} color={GOLD} />, title: "Empreendedores", desc: "Que buscam uma nova fonte de renda de alto valor" },
              { icon: <Award size={22} color={GOLD} />, title: "Profissionais liberais", desc: "Com rede de relacionamento em setores empresariais" },
              { icon: <Zap size={22} color={GOLD} />, title: "Qualquer área", desc: "O requisito é simples: vontade de trazer novos negócios" },
            ].map(({ icon, title, desc }) => (
              <div key={title} className="rounded-xl p-5 transition-all hover:border-[#C9A84C]/40" style={{ background: NAVY2, border: "1px solid #243A66" }}>
                <div className="mb-3">{icon}</div>
                <p style={{ fontWeight: 700, fontSize: 13, color: CREAM, marginBottom: 6 }}>{title}</p>
                <p style={{ fontSize: 11, color: MUTED, lineHeight: 1.6 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── BENEFÍCIOS ──────────────────────────────────────────────────────── */}
      <section id="beneficios" className="py-24" style={{ background: NAVY }}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: 3, color: GOLD, marginBottom: 12 }}>O QUE VOCÊ RECEBE</p>
            <h2 style={{ fontSize: "clamp(28px, 4vw, 42px)", fontWeight: 800, lineHeight: 1.2, color: CREAM }}>
              Estrutura de boutique. Autonomia de empreendedor.
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: <Lock size={28} color={GOLD} />, title: "Plataforma exclusiva", items: ["Dashboard com KPIs em tempo real", "CRM integrado", "IA com 7 squads especializados", "Mesa de crédito dedicada", "Deal Rooms para M&A"] },
              { icon: <BookOpen size={28} color={GOLD} />, title: "Capacitação completa", items: ["V3 Academy com trilhas e certificações", "Reuniões semanais de capacitação", "Materiais de vendas prontos", "Scripts e pitch para clientes", "Suporte da mesa operacional"] },
              { icon: <MessageSquare size={28} color={GOLD} />, title: "Suporte e visibilidade", items: ["Chat direto com a mesa V3", "Notificações em tempo real", "Relatórios de performance", "Co-branding (Partner PRO)", "Rede de partners V3"] },
            ].map(({ icon, title, items }) => (
              <div key={title} className="rounded-2xl p-8" style={{ background: NAVY2, border: "1px solid #243A66" }}>
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-6" style={{ background: "rgba(201,168,76,0.1)", border: "1px solid rgba(201,168,76,0.2)" }}>
                  {icon}
                </div>
                <h3 style={{ fontWeight: 800, fontSize: 18, color: CREAM, marginBottom: 20 }}>{title}</h3>
                <div className="space-y-3">
                  {items.map(item => (
                    <div key={item} className="flex items-center gap-3">
                      <Check size={14} color={GOLD} className="flex-shrink-0" />
                      <p style={{ fontSize: 13, color: MUTED }}>{item}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PLANOS ──────────────────────────────────────────────────────────── */}
      <section id="planos" className="py-24" style={{ background: "#070615" }}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: 3, color: GOLD, marginBottom: 12 }}>PLANOS</p>
            <h2 style={{ fontSize: "clamp(28px, 4vw, 42px)", fontWeight: 800, lineHeight: 1.2, color: CREAM }}>
              Escolha o seu nível de atuação
            </h2>
            <p style={{ color: MUTED, marginTop: 16, maxWidth: 480, margin: "16px auto 0", fontSize: 15 }}>
              Dois planos desenhados para diferentes momentos da sua jornada como Partner V3.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">

            {/* Partner */}
            <div className="rounded-2xl p-8" style={{ background: NAVY2, border: "1px solid #243A66" }}>
              <div className="inline-block px-3 py-1 rounded-full text-xs font-bold mb-6" style={{ background: "rgba(201,168,76,0.1)", color: GOLD, border: "1px solid rgba(201,168,76,0.2)" }}>
                V3 PARTNER
              </div>
              <div className="mb-6">
                <span style={{ fontSize: 42, fontWeight: 900, color: CREAM }}>R$197</span>
                <span style={{ color: MUTED, fontSize: 14 }}>/mês</span>
              </div>
              <div className="space-y-3 mb-8">
                {[
                  "30% de comissionamento",
                  "Acesso à plataforma completa",
                  "Mesa de Crédito N1 e N2",
                  "CRM + IA com 7 squads",
                  "Academy completo",
                  "Chat direto com a mesa",
                  "Dashboard e relatórios",
                  "Consórcio e marketplace",
                ].map(item => (
                  <div key={item} className="flex items-center gap-3">
                    <Check size={14} color={GOLD} className="flex-shrink-0" />
                    <p style={{ fontSize: 13, color: MUTED }}>{item}</p>
                  </div>
                ))}
              </div>
              <button
                onClick={() => scrollTo("cadastro")}
                className="w-full py-3.5 rounded-xl font-bold text-sm transition-all hover:opacity-90"
                style={{ border: `1px solid ${GOLD}`, color: GOLD, background: "transparent" }}
              >
                Começar como Partner
              </button>
            </div>

            {/* Partner PRO */}
            <div className="rounded-2xl p-8 relative overflow-hidden" style={{ background: NAVY2, border: `2px solid ${GOLD}` }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${GOLD}, #E8C97A)` }} />
              <div className="flex items-center gap-2 mb-6">
                <div className="inline-block px-3 py-1 rounded-full text-xs font-bold" style={{ background: GOLD, color: NAVY }}>
                  V3 PARTNER PRO
                </div>
                <div className="inline-block px-2 py-1 rounded-full text-xs font-bold" style={{ background: "rgba(201,168,76,0.1)", color: GOLD, border: "1px solid rgba(201,168,76,0.3)" }}>
                  MAIS POPULAR
                </div>
              </div>
              <div className="mb-6">
                <span style={{ fontSize: 42, fontWeight: 900, color: CREAM }}>R$397</span>
                <span style={{ color: MUTED, fontSize: 14 }}>/mês</span>
              </div>
              <div className="space-y-3 mb-8">
                {[
                  "50% de comissionamento",
                  "Tudo do Partner +",
                  "Mesa de Crédito N3 (≥ R$5M)",
                  "Academy M&A avançado",
                  "Co-branding V3 Partners",
                  "Deal Rooms e VDR",
                  "Mesa M&A dedicada",
                  "Prioridade no atendimento",
                ].map((item, i) => (
                  <div key={item} className="flex items-center gap-3">
                    <Check size={14} color={GOLD} className="flex-shrink-0" />
                    <p style={{ fontSize: 13, color: i === 1 ? CREAM : MUTED, fontWeight: i === 1 ? 600 : 400 }}>{item}</p>
                  </div>
                ))}
              </div>
              <button
                onClick={() => { setFormData(f => ({ ...f, plano: "PARTNER_PRO" })); scrollTo("cadastro"); }}
                className="w-full py-3.5 rounded-xl font-bold text-sm transition-all hover:opacity-90"
                style={{ background: GOLD, color: NAVY }}
              >
                Quero ser Partner PRO
              </button>
            </div>
          </div>

          {/* Simulação de comissão */}
          <div className="mt-12 rounded-2xl p-8 max-w-3xl mx-auto" style={{ background: NAVY2, border: "1px solid #243A66" }}>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: 3, color: GOLD, marginBottom: 16 }}>SIMULAÇÃO DE COMISSÃO</p>
            <div className="grid sm:grid-cols-3 gap-6">
              {[
                { tipo: "Crédito CGI R$500K", taxa: "2%", partner: "R$3.000", pro: "R$5.000" },
                { tipo: "M&A R$5M", taxa: "3%", partner: "R$45.000", pro: "R$75.000" },
                { tipo: "FIDC R$20M", taxa: "2%", partner: "R$120.000", pro: "R$200.000" },
              ].map(({ tipo, taxa, partner, pro }) => (
                <div key={tipo} className="rounded-xl p-5" style={{ background: "#0D1929", border: "1px solid #243A66" }}>
                  <p style={{ fontWeight: 700, fontSize: 13, color: CREAM, marginBottom: 4 }}>{tipo}</p>
                  <p style={{ fontSize: 11, color: MUTED, marginBottom: 12 }}>Taxa de sucesso: {taxa}</p>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span style={{ fontSize: 11, color: MUTED }}>Partner (30%)</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: CREAM }}>{partner}</span>
                    </div>
                    <div className="flex justify-between">
                      <span style={{ fontSize: 11, color: GOLD }}>PRO (50%)</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: GOLD }}>{pro}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 11, color: MUTED, marginTop: 16, textAlign: "center" }}>* Valores ilustrativos. Comissões variam por tipo e estrutura da operação.</p>
          </div>
        </div>
      </section>

      {/* ── VERTICAIS DE NEGÓCIO ────────────────────────────────────────────── */}
      <section className="py-24" style={{ background: NAVY }}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: 3, color: GOLD, marginBottom: 12 }}>PRODUTOS QUE VOCÊ VAI OFERECER</p>
            <h2 style={{ fontSize: "clamp(28px, 4vw, 42px)", fontWeight: 800, lineHeight: 1.2, color: CREAM }}>
              Portfólio institucional completo
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { cat: "Crédito com Garantia Imobiliária", items: ["CGI Residencial (Home Equity)", "CGI PJ — Grandes Empresas", "CGI Consórcio", "Crédito para Construção"] },
              { cat: "Securitização", items: ["FIDC — Fundos de Recebíveis", "CRI — Certificado Recebíveis Imob.", "Precatórios e Ativos Judiciais", "Cessão de Crédito Estruturada"] },
              { cat: "M&A e Deal Structuring", items: ["Compra e venda de empresas", "Valuation e due diligence", "Teaser e CIM profissional", "Matching com investidores"] },
              { cat: "Real Estate", items: ["Sale-Leaseback (SLB)", "Built-to-Suit (BTS)", "Built-to-Rent (BTR)", "Fundos Imobiliários Estruturados"] },
              { cat: "Mineração e Commodities", items: ["Lítio e metais preciosos", "Ouro — operações cross-border", "Commodities agrícolas", "Financiamento de projetos"] },
              { cat: "Crédito Corporativo", items: ["Antecipação de recebíveis", "Capital de giro estruturado", "Financiamento de frotas", "Linhas internacionais"] },
            ].map(({ cat, items }) => (
              <div key={cat} className="rounded-xl p-6" style={{ background: NAVY2, border: "1px solid #243A66" }}>
                <p style={{ fontWeight: 700, fontSize: 13, color: GOLD, marginBottom: 14 }}>{cat}</p>
                <div className="space-y-2">
                  {items.map(item => (
                    <div key={item} className="flex items-center gap-2">
                      <ChevronRight size={12} color={GOLD} className="flex-shrink-0" />
                      <p style={{ fontSize: 12, color: MUTED }}>{item}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ─────────────────────────────────────────────────────────────── */}
      <section id="faq" className="py-24" style={{ background: "#070615" }}>
        <div className="max-w-3xl mx-auto px-6">
          <div className="text-center mb-16">
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: 3, color: GOLD, marginBottom: 12 }}>PERGUNTAS FREQUENTES</p>
            <h2 style={{ fontSize: "clamp(28px, 4vw, 42px)", fontWeight: 800, lineHeight: 1.2, color: CREAM }}>
              Tudo que você precisa saber
            </h2>
          </div>
          <div className="space-y-3">
            {[
              { q: "Preciso ter experiência no mercado financeiro?", a: "Não é obrigatório. A V3 Partners oferece capacitação completa pelo Academy, reuniões semanais e suporte da mesa operacional. Muitos de nossos partners mais produtivos vieram de áreas como direito, contabilidade e gestão." },
              { q: "Como funciona o processo de entrada?", a: "Você preenche o formulário de interesse → nossa equipe entra em contato em até 24h úteis → você recebe o acesso à plataforma → assina o contrato de parceria digitalmente → começa a operar." },
              { q: "Quanto tempo leva para receber a primeira comissão?", a: "Depende do tipo de operação. Em crédito estruturado, o ciclo médio é de 30 a 90 dias. Em M&A, pode levar de 3 a 12 meses. Operações de consórcio e antecipação de recebíveis tendem a ser mais rápidas." },
              { q: "Posso trabalhar em paralelo com minha profissão atual?", a: "Sim. Muitos partners atuam de forma complementar à sua atividade principal. A plataforma foi desenhada para ser usada de forma assíncrona — você opera no seu ritmo." },
              { q: "Como são calculadas e pagas as comissões?", a: "As comissões são calculadas sobre o resultado líquido de cada operação fechada. O percentual é de 30% para Partner e 50% para Partner PRO. O valor é rastreado em tempo real na plataforma e pago após a liquidação da operação." },
              { q: "Existe contrato de exclusividade?", a: "Não. A parceria V3 é não exclusiva. Você pode manter outras atividades profissionais e outros relacionamentos comerciais." },
              { q: "O que acontece se eu não fechar nenhuma operação em um mês?", a: "A mensalidade é cobrada independentemente de fechamentos. Por isso, recomendamos que o partner tenha ao menos 1-2 oportunidades em pipeline antes de iniciar." },
              { q: "Qual a diferença prática entre Partner e Partner PRO?", a: "Além do comissionamento maior (50% vs 30%), o Partner PRO tem acesso ao nível N3 (operações ≥ R$5M), à Mesa M&A dedicada, co-branding, Deal Rooms com VDR e Academy M&A avançado." },
            ].map(({ q, a }) => (
              <FAQItem key={q} q={q} a={a} />
            ))}
          </div>
        </div>
      </section>

      {/* ── FORMULÁRIO ──────────────────────────────────────────────────────── */}
      <section id="cadastro" className="py-24" style={{ background: NAVY }}>
        <div className="max-w-2xl mx-auto px-6">
          <div className="text-center mb-12">
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: 3, color: GOLD, marginBottom: 12 }}>GARANTA SUA VAGA</p>
            <h2 style={{ fontSize: "clamp(28px, 4vw, 42px)", fontWeight: 800, lineHeight: 1.2, color: CREAM }}>
              Comece sua jornada como Partner V3
            </h2>
            <p style={{ color: MUTED, marginTop: 16, fontSize: 15 }}>
              Preencha o formulário e nossa equipe entrará em contato em até 24 horas úteis.
            </p>
          </div>

          {sent ? (
            <div className="rounded-2xl p-10 text-center" style={{ background: NAVY2, border: `1px solid ${GOLD}40` }}>
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6" style={{ background: "rgba(201,168,76,0.1)", border: `1px solid ${GOLD}40` }}>
                <Check size={28} color={GOLD} />
              </div>
              <h3 style={{ fontWeight: 800, fontSize: 22, color: CREAM, marginBottom: 12 }}>Solicitação recebida!</h3>
              <p style={{ color: MUTED, fontSize: 15, lineHeight: 1.7 }}>
                Obrigado, <strong style={{ color: CREAM }}>{formData.nome}</strong>!{" "}
                Nossa equipe entrará em contato pelo e-mail <strong style={{ color: CREAM }}>{formData.email}</strong> em até 24 horas úteis.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="rounded-2xl p-8 space-y-5" style={{ background: NAVY2, border: "1px solid #243A66" }}>
              <div className="grid sm:grid-cols-2 gap-5">
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: MUTED, letterSpacing: 1, display: "block", marginBottom: 8 }}>NOME COMPLETO *</label>
                  <input
                    type="text"
                    value={formData.nome}
                    onChange={e => setFormData(f => ({ ...f, nome: e.target.value }))}
                    placeholder="Seu nome"
                    className="w-full px-4 py-3 rounded-xl text-sm transition-colors focus:outline-none"
                    style={{ background: "#0D1929", border: "1px solid #243A66", color: CREAM }}
                    required
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: MUTED, letterSpacing: 1, display: "block", marginBottom: 8 }}>E-MAIL *</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={e => setFormData(f => ({ ...f, email: e.target.value }))}
                    placeholder="seu@email.com"
                    className="w-full px-4 py-3 rounded-xl text-sm transition-colors focus:outline-none"
                    style={{ background: "#0D1929", border: "1px solid #243A66", color: CREAM }}
                    required
                  />
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-5">
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: MUTED, letterSpacing: 1, display: "block", marginBottom: 8 }}>TELEFONE / WHATSAPP *</label>
                  <input
                    type="tel"
                    value={formData.telefone}
                    onChange={e => setFormData(f => ({ ...f, telefone: e.target.value }))}
                    placeholder="(11) 99999-9999"
                    className="w-full px-4 py-3 rounded-xl text-sm transition-colors focus:outline-none"
                    style={{ background: "#0D1929", border: "1px solid #243A66", color: CREAM }}
                    required
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: MUTED, letterSpacing: 1, display: "block", marginBottom: 8 }}>SEGMENTO DE ATUAÇÃO</label>
                  <input
                    type="text"
                    value={formData.segmento}
                    onChange={e => setFormData(f => ({ ...f, segmento: e.target.value }))}
                    placeholder="Ex: Consultor financeiro, Advogado..."
                    className="w-full px-4 py-3 rounded-xl text-sm transition-colors focus:outline-none"
                    style={{ background: "#0D1929", border: "1px solid #243A66", color: CREAM }}
                  />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: MUTED, letterSpacing: 1, display: "block", marginBottom: 8 }}>PLANO DE INTERESSE</label>
                <div className="grid grid-cols-2 gap-3">
                  {[["PARTNER", "V3 Partner — R$197/mês (30%)"], ["PARTNER_PRO", "V3 Partner PRO — R$397/mês (50%)"]].map(([val, label]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setFormData(f => ({ ...f, plano: val }))}
                      className="py-3 px-4 rounded-xl text-xs font-bold transition-all text-left"
                      style={{
                        background: formData.plano === val ? "rgba(201,168,76,0.15)" : "#0D1929",
                        border: formData.plano === val ? `1px solid ${GOLD}` : "1px solid #243A66",
                        color: formData.plano === val ? GOLD : MUTED,
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              {formError && <p style={{ fontSize: 12, color: "#EF4444" }}>{formError}</p>}
              <button
                type="submit"
                disabled={sending}
                className="w-full py-4 rounded-xl font-bold text-base transition-all hover:opacity-90 flex items-center justify-center gap-2"
                style={{ background: GOLD, color: NAVY, opacity: sending ? 0.7 : 1 }}
              >
                {sending ? "Enviando..." : <>Quero ser Partner V3 <ArrowRight size={18} /></>}
              </button>
              <p style={{ fontSize: 11, color: MUTED, textAlign: "center" }}>
                Ao enviar, você concorda que nossa equipe entre em contato. Sem spam.
              </p>
            </form>
          )}
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────────────────────── */}
      <footer style={{ background: "#040310", borderTop: "1px solid #243A66" }}>
        <div className="max-w-6xl mx-auto px-6 py-12">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <Image src="/logo.jpg" alt="V3 Partners" width={32} height={32} className="rounded-lg" />
              <div>
                <p style={{ fontWeight: 800, fontSize: 14, color: GOLD, letterSpacing: 2 }}>V3 PARTNERS</p>
                <p style={{ fontSize: 10, color: MUTED }}>V3 Partners Soluções Ltda · CNPJ 14.219.287/0001-50</p>
              </div>
            </div>
            <div className="flex gap-8">
              {[["O que é", "oque"], ["Benefícios", "beneficios"], ["Planos", "planos"], ["FAQ", "faq"]].map(([label, id]) => (
                <button key={id} onClick={() => scrollTo(id)} style={{ fontSize: 12, color: MUTED }}>{label}</button>
              ))}
            </div>
          </div>
          <div className="mt-8 pt-8 text-center" style={{ borderTop: "1px solid #243A66" }}>
            <p style={{ fontSize: 11, color: "#3A4A5C" }}>
              © 2026 V3 Partners Soluções Ltda · Boutique institucional multiproduto de securitização e estruturação financeira · v3partners.com.br
            </p>
          </div>
        </div>
      </footer>

    </div>
  );
}
