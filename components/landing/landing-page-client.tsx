"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import {
  ChevronDown, ArrowRight, Check, Shield, Zap, TrendingUp,
  Building2, Users, DollarSign, BarChart3, Globe, BookOpen,
  ChevronRight, X, Menu, Star, Play, Calculator,
} from "lucide-react";

// ── Paleta ─────────────────────────────────────────────────────────────────
const G = "#C9A84C";
const G2 = "#E8C97A";
const N = "#09081A";
const N2 = "#111F35";
const N3 = "#162744";
const N4 = "#243A66";
const CR = "#F0ECE4";
const MT = "#7A8FA8";

// ── Animated Counter ───────────────────────────────────────────────────────
function Counter({ to, prefix = "", suffix = "", decimals = 0, duration = 2200 }: {
  to: number; prefix?: string; suffix?: string; decimals?: number; duration?: number;
}) {
  const [val, setVal] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const observer = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      observer.disconnect();
      const start = Date.now();
      const tick = () => {
        const p = Math.min((Date.now() - start) / duration, 1);
        const ease = 1 - Math.pow(1 - p, 4);
        setVal(parseFloat((to * ease).toFixed(decimals)));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, { threshold: 0.2 });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [to, duration, decimals]);
  return (
    <span ref={ref}>
      {prefix}{decimals > 0 ? val.toFixed(decimals) : val.toLocaleString("pt-BR")}{suffix}
    </span>
  );
}

// ── FAQ ────────────────────────────────────────────────────────────────────
function FAQ({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      onClick={() => setOpen(o => !o)}
      className="cursor-pointer rounded-2xl overflow-hidden transition-all duration-300"
      style={{ background: open ? N2 : "rgba(17,31,53,0.6)", border: `1px solid ${open ? G + "40" : N4}` }}
    >
      <div className="flex items-center justify-between px-7 py-5 gap-4">
        <p style={{ fontWeight: 600, fontSize: 15, color: CR, lineHeight: 1.4 }}>{q}</p>
        <div
          className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all"
          style={{ background: open ? `${G}20` : N3, border: `1px solid ${open ? G + "40" : N4}` }}
        >
          <ChevronDown size={14} color={open ? G : MT} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.3s" }} />
        </div>
      </div>
      {open && (
        <div className="px-7 pb-6 border-t" style={{ borderColor: N4 }}>
          <p style={{ fontSize: 14, color: MT, lineHeight: 1.8, marginTop: 16 }}>{a}</p>
        </div>
      )}
    </div>
  );
}

// ── Testimonial ────────────────────────────────────────────────────────────
function Testimonial({ name, role, text, initial }: { name: string; role: string; text: string; initial: string }) {
  return (
    <div className="rounded-2xl p-7 flex flex-col gap-4 h-full" style={{ background: N2, border: `1px solid ${N4}` }}>
      <div className="flex gap-1 mb-1">
        {Array(5).fill(0).map((_, i) => <Star key={i} size={13} fill={G} color={G} />)}
      </div>
      <p style={{ fontSize: 14, color: MT, lineHeight: 1.8, flex: 1 }}>"{text}"</p>
      <div className="flex items-center gap-3 pt-4" style={{ borderTop: `1px solid ${N4}` }}>
        <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
          style={{ background: `${G}20`, border: `1px solid ${G}40`, color: G }}>
          {initial}
        </div>
        <div>
          <p style={{ fontWeight: 700, fontSize: 13, color: CR }}>{name}</p>
          <p style={{ fontSize: 11, color: MT }}>{role}</p>
        </div>
      </div>
    </div>
  );
}

// ── Commission Calculator ──────────────────────────────────────────────────
function CommissionCalc() {
  const [valor, setValor] = useState(1000000);
  const [taxa, setTaxa] = useState(2);
  const base = valor * (taxa / 100);
  const partner = base * 0.30;
  const pro = base * 0.50;
  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

  return (
    <div className="rounded-2xl p-8" style={{ background: N2, border: `1px solid ${N4}` }}>
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${G}15`, border: `1px solid ${G}30` }}>
          <Calculator size={18} color={G} />
        </div>
        <div>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, color: G }}>CALCULADORA INTERATIVA</p>
          <p style={{ fontSize: 14, fontWeight: 700, color: CR }}>Simule sua comissão</p>
        </div>
      </div>

      <div className="space-y-6 mb-8">
        <div>
          <div className="flex justify-between mb-3">
            <label style={{ fontSize: 11, fontWeight: 700, color: MT, letterSpacing: 1 }}>VALOR DA OPERAÇÃO</label>
            <span style={{ fontSize: 14, fontWeight: 800, color: G }}>{fmt(valor)}</span>
          </div>
          <input type="range" min={200000} max={20000000} step={100000} value={valor}
            onChange={e => setValor(Number(e.target.value))}
            className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
            style={{ accentColor: G, background: `linear-gradient(to right, ${G} ${((valor - 200000) / (20000000 - 200000)) * 100}%, ${N4} 0%)` }} />
          <div className="flex justify-between mt-1">
            <span style={{ fontSize: 10, color: MT }}>R$200K</span>
            <span style={{ fontSize: 10, color: MT }}>R$20M</span>
          </div>
        </div>

        <div>
          <div className="flex justify-between mb-3">
            <label style={{ fontSize: 11, fontWeight: 700, color: MT, letterSpacing: 1 }}>TAXA DE SUCESSO (%)</label>
            <span style={{ fontSize: 14, fontWeight: 800, color: G }}>{taxa}%</span>
          </div>
          <input type="range" min={1} max={5} step={0.5} value={taxa}
            onChange={e => setTaxa(Number(e.target.value))}
            className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
            style={{ accentColor: G, background: `linear-gradient(to right, ${G} ${((taxa - 1) / 4) * 100}%, ${N4} 0%)` }} />
          <div className="flex justify-between mt-1">
            <span style={{ fontSize: 10, color: MT }}>1%</span>
            <span style={{ fontSize: 10, color: MT }}>5%</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl p-5" style={{ background: "#0D1929", border: `1px solid ${N4}` }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: MT, letterSpacing: 1, marginBottom: 8 }}>PARTNER (30%)</p>
          <p style={{ fontSize: 24, fontWeight: 900, color: CR }}>{fmt(partner)}</p>
          <p style={{ fontSize: 10, color: MT, marginTop: 4 }}>por operação fechada</p>
        </div>
        <div className="rounded-xl p-5" style={{ background: `${G}10`, border: `1px solid ${G}40` }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: G, letterSpacing: 1, marginBottom: 8 }}>PARTNER PRO (50%)</p>
          <p style={{ fontSize: 24, fontWeight: 900, color: G }}>{fmt(pro)}</p>
          <p style={{ fontSize: 10, color: MT, marginTop: 4 }}>por operação fechada</p>
        </div>
      </div>

      <p style={{ fontSize: 11, color: MT, marginTop: 16, textAlign: "center" }}>
        * Simulação ilustrativa. Valores reais variam por operação.
      </p>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────
export function LandingPageClient() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [showBar, setShowBar] = useState(false);
  const [formData, setFormData] = useState({ nome: "", email: "", telefone: "", segmento: "", plano: "PARTNER_PRO" });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    const h = () => {
      setScrolled(window.scrollY > 40);
      setShowBar(window.scrollY > 600);
    };
    window.addEventListener("scroll", h);
    return () => window.removeEventListener("scroll", h);
  }, []);

  function go(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    setMenuOpen(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.nome || !formData.email || !formData.telefone) {
      setFormError("Preencha nome, e-mail e telefone.");
      return;
    }
    setSending(true); setFormError("");
    try {
      const res = await fetch("/api/parceiro/cadastro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (res.ok) { setSent(true); }
      else { const d = await res.json(); setFormError(d.error ?? "Erro ao enviar."); }
    } catch { setFormError("Erro de conexão. Tente novamente."); }
    finally { setSending(false); }
  }

  return (
    <div style={{ background: N, color: CR, fontFamily: "'DM Sans', sans-serif", overflowX: "hidden" }}>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;0,9..40,800;0,9..40,900;1,9..40,400&display=swap" rel="stylesheet" />

      {/* ── STICKY CTA BAR ──────────────────────────────────────────────── */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 transition-all duration-500"
        style={{ transform: showBar ? "translateY(0)" : "translateY(100%)", background: "rgba(9,8,26,0.97)", backdropFilter: "blur(20px)", borderTop: `1px solid ${N4}` }}
      >
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <div className="hidden sm:block">
            <p style={{ fontSize: 14, fontWeight: 700, color: CR }}>V3 Partners — Boutique Financeira Institucional</p>
            <p style={{ fontSize: 11, color: MT }}>Até 50% de comissionamento · Operações a partir de R$200K</p>
          </div>
          <button
            onClick={() => go("cadastro")}
            className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all hover:opacity-90 flex-shrink-0"
            style={{ background: G, color: N }}
          >
            Quero ser Partner <ArrowRight size={14} />
          </button>
        </div>
      </div>

      {/* ── NAVBAR ──────────────────────────────────────────────────────── */}
      <nav
        className="fixed top-0 left-0 right-0 z-40 transition-all duration-300"
        style={{
          background: scrolled ? "rgba(9,8,26,0.95)" : "transparent",
          backdropFilter: scrolled ? "blur(20px)" : "none",
          borderBottom: scrolled ? `1px solid ${N4}` : "none",
        }}
      >
        <div className="max-w-6xl mx-auto px-6 h-18 flex items-center justify-between" style={{ height: 72 }}>
          <div className="flex items-center gap-3">
            <Image src="/logo.jpg" alt="V3 Partners" width={38} height={38} className="rounded-xl" />
            <span style={{ fontWeight: 900, fontSize: 15, color: G, letterSpacing: 3 }}>V3 PARTNERS</span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            {[["Como funciona", "como"], ["Planos", "planos"], ["Portfólio", "portfolio"], ["FAQ", "faq"]].map(([l, id]) => (
              <button key={id} onClick={() => go(id)} className="text-sm font-medium transition-colors hover:text-white" style={{ color: MT }}>{l}</button>
            ))}
          </div>
          <div className="hidden md:flex items-center gap-3">
            <button
              onClick={() => go("cadastro")}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all hover:opacity-90"
              style={{ background: G, color: N }}
            >
              Quero ser Partner
            </button>
          </div>
          <button onClick={() => setMenuOpen(o => !o)} className="md:hidden" style={{ color: CR }}>
            {menuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
        {menuOpen && (
          <div className="md:hidden px-6 py-5 space-y-1" style={{ background: "rgba(9,8,26,0.99)", borderTop: `1px solid ${N4}` }}>
            {[["Como funciona", "como"], ["Planos", "planos"], ["Portfólio", "portfolio"], ["FAQ", "faq"], ["Quero ser Partner", "cadastro"]].map(([l, id]) => (
              <button key={id} onClick={() => go(id)} className="block w-full text-left py-3 text-sm font-medium border-b"
                style={{ color: CR, borderColor: N4 }}>{l}</button>
            ))}
          </div>
        )}
      </nav>

      {/* ── HERO ────────────────────────────────────────────────────────── */}
      <section style={{ minHeight: "100vh", display: "flex", alignItems: "center", position: "relative", overflow: "hidden", background: N }}>
        {/* Gradient orbs */}
        <div style={{ position: "absolute", width: 800, height: 800, borderRadius: "50%", background: `radial-gradient(circle, ${G}12 0%, transparent 70%)`, top: "50%", left: "50%", transform: "translate(-50%, -60%)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", width: 500, height: 500, borderRadius: "50%", background: `radial-gradient(circle, #1A4FC408 0%, transparent 70%)`, top: "20%", right: "-10%", pointerEvents: "none" }} />
        <div style={{ position: "absolute", width: 400, height: 400, borderRadius: "50%", background: `radial-gradient(circle, ${G}08 0%, transparent 70%)`, bottom: "10%", left: "-5%", pointerEvents: "none" }} />
        {/* Top line */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent 0%, ${G}60 50%, transparent 100%)` }} />
        {/* Grid bg */}
        <div style={{ position: "absolute", inset: 0, backgroundImage: `linear-gradient(${N4}18 1px, transparent 1px), linear-gradient(to right, ${N4}18 1px, transparent 1px)`, backgroundSize: "60px 60px", opacity: 0.4 }} />

        <div className="max-w-6xl mx-auto px-6 w-full relative" style={{ paddingTop: 140, paddingBottom: 80 }}>
          {/* Badge */}
          <div className="flex justify-center mb-8">
            <div className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full" style={{ background: `${G}12`, border: `1px solid ${G}30`, backdropFilter: "blur(10px)" }}>
              <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: G }} />
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2.5, color: G }}>BOUTIQUE FINANCEIRA INSTITUCIONAL</span>
            </div>
          </div>

          {/* Headline */}
          <h1 className="text-center mx-auto" style={{ fontSize: "clamp(38px, 6.5vw, 82px)", fontWeight: 900, lineHeight: 1.05, maxWidth: 900, marginBottom: 28 }}>
            <span style={{ color: CR }}>Ganhe até </span>
            <span style={{ background: `linear-gradient(135deg, ${G} 0%, ${G2} 50%, ${G} 100%)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
              50% de comissão
            </span>
            <br />
            <span style={{ color: CR }}>em operações </span>
            <span style={{ background: `linear-gradient(135deg, ${G2} 0%, ${G} 100%)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
              institucionais
            </span>
          </h1>

          <p className="text-center mx-auto" style={{ fontSize: "clamp(16px, 2vw, 20px)", color: MT, lineHeight: 1.75, maxWidth: 680, marginBottom: 52 }}>
            A V3 Partners estrutura operações de crédito, M&A, securitização e real estate. Você origina os negócios — nós cuidamos de tudo. Plataforma própria, mesa especializada e IA integrada.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-20">
            <button
              onClick={() => go("cadastro")}
              className="flex items-center justify-center gap-2 px-9 py-4.5 rounded-2xl font-bold text-base transition-all hover:scale-105 hover:shadow-2xl"
              style={{ background: `linear-gradient(135deg, ${G} 0%, ${G2} 100%)`, color: N, boxShadow: `0 0 40px ${G}40`, padding: "16px 36px", borderRadius: 16 }}
            >
              Quero ser Partner V3 <ArrowRight size={18} />
            </button>
            <button
              onClick={() => go("como")}
              className="flex items-center justify-center gap-2 rounded-2xl font-bold text-base transition-all hover:border-gold"
              style={{ border: `1px solid ${N4}`, color: CR, padding: "16px 36px", borderRadius: 16, backdropFilter: "blur(10px)", background: "rgba(22,39,68,0.4)" }}
            >
              <Play size={16} color={G} /> Ver como funciona
            </button>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
            {[
              { n: 50, suf: "%", label: "comissão máxima" },
              { n: 4, suf: "", label: "verticais de receita" },
              { n: 1, suf: "B+", label: "em operações estruturadas", pre: "R$" },
              { n: 36, suf: "+", label: "meses de operação" },
            ].map(({ n, suf, label, pre = "" }) => (
              <div key={label} className="rounded-2xl p-6 text-center" style={{ background: "rgba(17,31,53,0.7)", border: `1px solid ${N4}`, backdropFilter: "blur(16px)" }}>
                <p style={{ fontSize: "clamp(28px, 4vw, 40px)", fontWeight: 900, color: G, lineHeight: 1 }}>
                  <Counter to={n} prefix={pre} suffix={suf} />
                </p>
                <p style={{ fontSize: 11, color: MT, marginTop: 6, lineHeight: 1.4 }}>{label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce" style={{ color: MT, opacity: 0.5 }}>
          <ChevronDown size={22} />
        </div>
      </section>

      {/* ── TRUST BAR ───────────────────────────────────────────────────── */}
      <div style={{ background: N2, borderTop: `1px solid ${N4}`, borderBottom: `1px solid ${N4}` }}>
        <div className="max-w-6xl mx-auto px-6 py-5 flex flex-wrap items-center justify-center gap-8 md:gap-16">
          {[
            { icon: <Shield size={14} color={G} />, text: "Compliance & KYC" },
            { icon: <Building2 size={14} color={G} />, text: "Bloxs S.A. — White Label" },
            { icon: <Zap size={14} color={G} />, text: "Plataforma com IA integrada" },
            { icon: <Globe size={14} color={G} />, text: "Operações Cross-Border 24/7" },
            { icon: <TrendingUp size={14} color={G} />, text: "CRI · FIDC · M&A · CGI · SLB" },
          ].map(({ icon, text }) => (
            <div key={text} className="flex items-center gap-2">
              {icon}
              <span style={{ fontSize: 12, color: MT, fontWeight: 500 }}>{text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── COMO FUNCIONA ───────────────────────────────────────────────── */}
      <section id="como" className="py-28" style={{ background: N }}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-20">
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: 3, color: G, marginBottom: 14 }}>PROCESSO SIMPLES</p>
            <h2 style={{ fontSize: "clamp(30px, 4.5vw, 52px)", fontWeight: 900, lineHeight: 1.15, color: CR, marginBottom: 16 }}>
              Você origina.<br />
              <span style={{ background: `linear-gradient(135deg, ${G} 0%, ${G2} 100%)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                A V3 estrutura e fecha.
              </span>
            </h2>
            <p style={{ color: MT, fontSize: 16, maxWidth: 560, margin: "0 auto", lineHeight: 1.7 }}>
              Seu papel é conectar clientes às soluções. Nossa equipe cuida de toda a estruturação, análise, compliance e fechamento da operação.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 relative">
            {/* connector */}
            <div className="hidden md:block absolute top-14 left-1/3 right-1/3 h-px" style={{ background: `linear-gradient(90deg, ${G}50, ${G}50)` }} />

            {[
              {
                n: "01", icon: <Users size={26} color={G} />, title: "Você identifica",
                desc: "Seu cliente precisa de crédito, quer vender a empresa, busca financiamento imobiliário ou quer diversificar patrimônio. Você apresenta a V3.",
                items: ["Crédito estruturado CGI / FIDC", "M&A — venda ou aquisição", "Real estate comercial", "Patrimônio e commodities"],
              },
              {
                n: "02", icon: <Zap size={26} color={G} />, title: "A V3 estrutura",
                desc: "Nossa mesa especializada, IA FORJA e equipe de compliance analisam, estruturam e encaminham para as melhores instituições parceiras.",
                items: ["Análise IA em tempo real", "Mesa de crédito dedicada", "Compliance e KYC", "Deal Rooms com VDR"],
              },
              {
                n: "03", icon: <DollarSign size={26} color={G} />, title: "Você recebe",
                desc: "Com o fechamento, você recebe entre 30% e 50% do resultado líquido da operação — rastreado e transparente na plataforma V3.",
                items: ["30% plano Partner", "50% plano Partner PRO", "Rastreamento em tempo real", "Pagamento após liquidação"],
              },
            ].map(({ n, icon, title, desc, items }) => (
              <div key={n} className="rounded-2xl p-8 flex flex-col gap-5 relative" style={{ background: N2, border: `1px solid ${N4}` }}>
                <div style={{ position: "absolute", top: 20, right: 20, fontSize: 72, fontWeight: 900, color: `${G}08`, lineHeight: 1, userSelect: "none" }}>{n}</div>
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: `${G}12`, border: `1px solid ${G}25` }}>
                  {icon}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span style={{ fontSize: 10, fontWeight: 700, color: G, letterSpacing: 2 }}>PASSO {n}</span>
                  </div>
                  <h3 style={{ fontWeight: 800, fontSize: 20, color: CR, marginBottom: 10 }}>{title}</h3>
                  <p style={{ fontSize: 14, color: MT, lineHeight: 1.7 }}>{desc}</p>
                </div>
                <div className="space-y-2 pt-2 border-t" style={{ borderColor: N4 }}>
                  {items.map(i => (
                    <div key={i} className="flex items-center gap-2.5">
                      <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: G }} />
                      <p style={{ fontSize: 13, color: MT }}>{i}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── QUEM PODE SER ───────────────────────────────────────────────── */}
      <section className="py-28" style={{ background: "#06051A" }}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: 3, color: G, marginBottom: 14 }}>PERFIL DO PARTNER</p>
              <h2 style={{ fontSize: "clamp(30px, 4.5vw, 50px)", fontWeight: 900, lineHeight: 1.15, color: CR, marginBottom: 20 }}>
                Você não precisa ser do mercado financeiro
              </h2>
              <p style={{ fontSize: 15, color: MT, lineHeight: 1.8, marginBottom: 32 }}>
                O único requisito é ter vontade de gerar negócios. A estrutura, o conhecimento técnico e o suporte operacional são responsabilidade da V3. Você opera com a credencial de uma boutique institucional.
              </p>
              <button
                onClick={() => go("cadastro")}
                className="flex items-center gap-2 px-7 py-3.5 rounded-xl font-bold text-sm transition-all hover:opacity-90"
                style={{ background: G, color: N }}
              >
                Quero ser Partner <ArrowRight size={16} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: <Users size={18} color={G} />, title: "Consultores", desc: "Assessores e consultores que querem ampliar o portfólio" },
                { icon: <Building2 size={18} color={G} />, title: "Contadores & Advogados", desc: "Com acesso a empresas que precisam de crédito ou M&A" },
                { icon: <TrendingUp size={18} color={G} />, title: "Corretores", desc: "Que atuam com imóveis comerciais e transações de alto valor" },
                { icon: <DollarSign size={18} color={G} />, title: "Profissionais de crédito", desc: "Que querem operar com tickets maiores e mais estrutura" },
                { icon: <BarChart3 size={18} color={G} />, title: "Gestores & Executivos", desc: "Acesso a tomadores de decisão em empresas e fundos" },
                { icon: <Globe size={18} color={G} />, title: "Empreendedores", desc: "Que buscam uma nova fonte de renda de alto potencial" },
                { icon: <BookOpen size={18} color={G} />, title: "Profissionais liberais", desc: "Com rede de relacionamento em setores empresariais" },
                { icon: <Zap size={18} color={G} />, title: "Qualquer área", desc: "Se você tem rede de contatos, pode atuar como partner" },
              ].map(({ icon, title, desc }) => (
                <div key={title} className="rounded-xl p-5 transition-all hover:border-[#C9A84C]/30"
                  style={{ background: N2, border: `1px solid ${N4}` }}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-3" style={{ background: `${G}12` }}>
                    {icon}
                  </div>
                  <p style={{ fontWeight: 700, fontSize: 13, color: CR, marginBottom: 4 }}>{title}</p>
                  <p style={{ fontSize: 11, color: MT, lineHeight: 1.5 }}>{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── PLANOS ──────────────────────────────────────────────────────── */}
      <section id="planos" className="py-28" style={{ background: N }}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-20">
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: 3, color: G, marginBottom: 14 }}>INVESTIMENTO</p>
            <h2 style={{ fontSize: "clamp(30px, 4.5vw, 52px)", fontWeight: 900, lineHeight: 1.15, color: CR, marginBottom: 16 }}>
              Escolha o seu nível de atuação
            </h2>
            <p style={{ color: MT, fontSize: 16, maxWidth: 520, margin: "0 auto" }}>
              Dois planos desenhados para diferentes momentos da sua jornada como Partner V3.
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-6 items-start">
            {/* Partner */}
            <div className="rounded-2xl p-8 lg:mt-8" style={{ background: N2, border: `1px solid ${N4}` }}>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, color: G, marginBottom: 20 }}>V3 PARTNER</p>
              <div className="mb-2">
                <span style={{ fontSize: 48, fontWeight: 900, color: CR, lineHeight: 1 }}>R$197</span>
              </div>
              <p style={{ fontSize: 12, color: MT, marginBottom: 28 }}>por mês · 30% de comissão</p>
              <div className="space-y-3 mb-8">
                {["Acesso à plataforma completa", "CRM + IA com 7 squads", "Mesa de Crédito N1 e N2", "Academy completo", "Chat com a mesa", "Dashboard e relatórios", "Consórcio e marketplace"].map(i => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: `${G}15` }}>
                      <Check size={9} color={G} />
                    </div>
                    <p style={{ fontSize: 13, color: MT }}>{i}</p>
                  </div>
                ))}
              </div>
              <button
                onClick={() => { setFormData(f => ({ ...f, plano: "PARTNER" })); go("cadastro"); }}
                className="w-full py-3.5 rounded-xl font-bold text-sm transition-all hover:bg-opacity-80"
                style={{ border: `1px solid ${N4}`, color: CR, background: N3 }}
              >
                Começar como Partner
              </button>
            </div>

            {/* Partner PRO — destaque */}
            <div className="rounded-2xl p-8 relative overflow-hidden" style={{ background: N2, border: `1.5px solid ${G}` }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${G}, ${G2}, ${G})` }} />
              <div className="flex items-center justify-between mb-6">
                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, color: G }}>V3 PARTNER PRO</p>
                <div className="px-3 py-1 rounded-full text-xs font-bold" style={{ background: `${G}20`, color: G, border: `1px solid ${G}40` }}>
                  MAIS POPULAR
                </div>
              </div>
              <div className="mb-2">
                <span style={{ fontSize: 48, fontWeight: 900, color: CR, lineHeight: 1 }}>R$397</span>
              </div>
              <p style={{ fontSize: 12, color: G, marginBottom: 28, fontWeight: 600 }}>por mês · 50% de comissão</p>
              <div className="space-y-3 mb-8">
                {[
                  ["Tudo do Partner +", true],
                  ["Mesa de Crédito N3 (≥ R$5M)", false],
                  ["Academy M&A avançado", false],
                  ["Co-branding V3 Partners", false],
                  ["Deal Rooms com VDR", false],
                  ["Mesa M&A dedicada", false],
                  ["Prioridade no atendimento", false],
                  ["Acesso a operações cross-border", false],
                ].map(([i, bold]) => (
                  <div key={String(i)} className="flex items-center gap-3">
                    <div className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: `${G}25`, border: `1px solid ${G}40` }}>
                      <Check size={9} color={G} />
                    </div>
                    <p style={{ fontSize: 13, color: bold ? CR : MT, fontWeight: bold ? 700 : 400 }}>{String(i)}</p>
                  </div>
                ))}
              </div>
              <button
                onClick={() => { setFormData(f => ({ ...f, plano: "PARTNER_PRO" })); go("cadastro"); }}
                className="w-full py-4 rounded-xl font-bold text-sm transition-all hover:opacity-90"
                style={{ background: `linear-gradient(135deg, ${G} 0%, ${G2} 100%)`, color: N, boxShadow: `0 8px 24px ${G}30` }}
              >
                Quero ser Partner PRO
              </button>
            </div>

            {/* Calculadora */}
            <CommissionCalc />
          </div>
        </div>
      </section>

      {/* ── PORTFÓLIO ───────────────────────────────────────────────────── */}
      <section id="portfolio" className="py-28" style={{ background: "#06051A" }}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-20">
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: 3, color: G, marginBottom: 14 }}>PRODUTOS</p>
            <h2 style={{ fontSize: "clamp(30px, 4.5vw, 52px)", fontWeight: 900, lineHeight: 1.15, color: CR, marginBottom: 16 }}>
              Portfólio institucional completo
            </h2>
            <p style={{ color: MT, fontSize: 16, maxWidth: 540, margin: "0 auto" }}>
              6 verticais de negócio para você oferecer aos seus clientes com toda a estrutura da V3.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { icon: <Building2 size={22} color={G} />, cat: "Crédito com Garantia Imobiliária", items: ["CGI Residencial (Home Equity)", "CGI PJ — Grandes Empresas", "CGI Consórcio", "Crédito para Construção"], tag: "Até R$20M" },
              { icon: <BarChart3 size={22} color={G} />, cat: "Securitização de Recebíveis", items: ["FIDC — Fundos de Recebíveis", "CRI — Certificados Imobiliários", "Precatórios e Ativos Judiciais", "Cessão de Crédito Estruturada"], tag: "Alto ticket" },
              { icon: <TrendingUp size={22} color={G} />, cat: "M&A e Deal Structuring", items: ["Compra e venda de empresas", "Valuation e due diligence", "Teaser Cego e CIM profissional", "Matching com investidores"], tag: "R$1M+" },
              { icon: <Globe size={22} color={G} />, cat: "Real Estate Estruturado", items: ["Sale-Leaseback (SLB)", "Built-to-Suit (BTS)", "Built-to-Rent (BTR)", "Fundos Imobiliários Estruturados"], tag: "Institucional" },
              { icon: <DollarSign size={22} color={G} />, cat: "Mineração & Commodities", items: ["Lítio e metais preciosos", "Ouro — operações cross-border", "Commodities agrícolas", "Financiamento de projetos"], tag: "Cross-border" },
              { icon: <Zap size={22} color={G} />, cat: "Crédito Corporativo", items: ["Antecipação de recebíveis", "Capital de giro estruturado", "Financiamento de frotas", "Linhas internacionais"], tag: "PJ" },
            ].map(({ icon, cat, items, tag }) => (
              <div key={cat} className="rounded-2xl p-7 transition-all hover:border-[#C9A84C]/30 group" style={{ background: N2, border: `1px solid ${N4}` }}>
                <div className="flex items-start justify-between mb-5">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: `${G}12`, border: `1px solid ${G}20` }}>
                    {icon}
                  </div>
                  <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.5, color: G, background: `${G}12`, border: `1px solid ${G}25`, padding: "4px 10px", borderRadius: 20 }}>{tag}</span>
                </div>
                <h3 style={{ fontWeight: 800, fontSize: 15, color: CR, marginBottom: 14 }}>{cat}</h3>
                <div className="space-y-2">
                  {items.map(i => (
                    <div key={i} className="flex items-center gap-2.5">
                      <ChevronRight size={11} color={G} className="flex-shrink-0" />
                      <p style={{ fontSize: 12, color: MT }}>{i}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── BENEFÍCIOS PLATAFORMA ───────────────────────────────────────── */}
      <section className="py-28" style={{ background: N }}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-20">
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: 3, color: G, marginBottom: 14 }}>INFRAESTRUTURA</p>
            <h2 style={{ fontSize: "clamp(30px, 4.5vw, 52px)", fontWeight: 900, lineHeight: 1.15, color: CR }}>
              Estrutura de boutique.{" "}
              <span style={{ background: `linear-gradient(135deg, ${G} 0%, ${G2} 100%)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                Autonomia de empreendedor.
              </span>
            </h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { icon: <BarChart3 size={22} color={G} />, title: "Dashboard completo", desc: "KPIs em tempo real, pipeline de operações, comissões acumuladas e metas por período." },
              { icon: <Users size={22} color={G} />, title: "CRM integrado", desc: "Gerencie leads, clientes e follow-ups. Histórico completo e automações de contato." },
              { icon: <Zap size={22} color={G} />, title: "IA com 7 Squads", desc: "Assistentes especializados em crédito, M&A, jurídico, compliance, sales e mais." },
              { icon: <Shield size={22} color={G} />, title: "Compliance & KYC", desc: "Trilha de auditoria, KYC automatizado e suporte jurídico para cada operação." },
              { icon: <TrendingUp size={22} color={G} />, title: "Mesa de M&A com FORJA", desc: "Pipeline completo, Deal Rooms, teaser cego, CIM profissional e matching IA." },
              { icon: <BookOpen size={22} color={G} />, title: "Academy com certificação", desc: "Trilhas de aprendizado, provas, certificações e reuniões semanais de capacitação." },
            ].map(({ icon, title, desc }) => (
              <div key={title} className="rounded-2xl p-7 flex gap-5" style={{ background: N2, border: `1px solid ${N4}` }}>
                <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${G}12`, border: `1px solid ${G}20` }}>
                  {icon}
                </div>
                <div>
                  <h3 style={{ fontWeight: 700, fontSize: 15, color: CR, marginBottom: 6 }}>{title}</h3>
                  <p style={{ fontSize: 13, color: MT, lineHeight: 1.65 }}>{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── DEPOIMENTOS ─────────────────────────────────────────────────── */}
      <section className="py-28" style={{ background: "#06051A" }}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-20">
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: 3, color: G, marginBottom: 14 }}>NETWORK V3</p>
            <h2 style={{ fontSize: "clamp(30px, 4.5vw, 52px)", fontWeight: 900, lineHeight: 1.15, color: CR }}>
              O que dizem nossos partners
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            <Testimonial
              initial="RS"
              name="Rafael S."
              role="Consultor financeiro · SP"
              text="Em 4 meses como Partner PRO fechei 2 operações de CGI e recebi mais de R$18.000 em comissões. A plataforma é absurdamente boa e a mesa responde rápido."
            />
            <Testimonial
              initial="CM"
              name="Carla M."
              role="Advogada corporativa · RJ"
              text="Já indiquei 3 clientes que estavam precisando de crédito estruturado. O processo foi todo gerenciado pela equipe V3. Minha parte foi apenas a introdução. Simples assim."
            />
            <Testimonial
              initial="TP"
              name="Thiago P."
              role="Corretor de imóveis comerciais · MG"
              text="Tinha clientes com demanda de sale-leaseback e não sabia como estruturar. A V3 fez tudo. Recebi 30% sobre uma operação de R$3M. Não tem paralelo no mercado."
            />
          </div>
        </div>
      </section>

      {/* ── FAQ ─────────────────────────────────────────────────────────── */}
      <section id="faq" className="py-28" style={{ background: N }}>
        <div className="max-w-3xl mx-auto px-6">
          <div className="text-center mb-20">
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: 3, color: G, marginBottom: 14 }}>PERGUNTAS FREQUENTES</p>
            <h2 style={{ fontSize: "clamp(30px, 4.5vw, 52px)", fontWeight: 900, lineHeight: 1.15, color: CR }}>
              Tudo que você precisa saber
            </h2>
          </div>
          <div className="space-y-3">
            {[
              { q: "Preciso ter experiência no mercado financeiro?", a: "Não é obrigatório. A V3 Partners oferece capacitação completa pelo Academy, reuniões semanais e suporte da mesa operacional. Muitos de nossos partners mais produtivos vieram de áreas como direito, contabilidade e gestão." },
              { q: "Como funciona o processo de entrada?", a: "Você preenche o formulário → nossa equipe entra em contato em até 24h úteis → você recebe o acesso à plataforma → assina o contrato de parceria digitalmente → começa a operar." },
              { q: "Quanto tempo leva para receber a primeira comissão?", a: "Em crédito estruturado, o ciclo médio é de 30 a 90 dias. Em M&A, pode levar de 3 a 12 meses. Operações de consórcio e antecipação de recebíveis tendem a ser mais rápidas." },
              { q: "Posso trabalhar em paralelo com minha profissão atual?", a: "Sim. Muitos partners atuam de forma complementar à sua atividade principal. A plataforma foi desenhada para ser usada de forma assíncrona — você opera no seu ritmo." },
              { q: "Como são calculadas e pagas as comissões?", a: "As comissões são calculadas sobre o resultado líquido de cada operação fechada. O percentual é de 30% para Partner e 50% para Partner PRO. O valor é rastreado em tempo real na plataforma e pago após a liquidação." },
              { q: "Existe contrato de exclusividade?", a: "Não. A parceria V3 é não exclusiva. Você pode manter outras atividades profissionais e outros relacionamentos comerciais sem restrição." },
              { q: "Qual a diferença prática entre Partner e Partner PRO?", a: "Além do comissionamento maior (50% vs 30%), o Partner PRO tem acesso ao nível N3 (operações ≥ R$5M), Mesa M&A dedicada, co-branding, Deal Rooms com VDR e Academy M&A avançado." },
              { q: "O que é o FORJA e como me beneficia?", a: "FORJA é nossa IA proprietária de M&A. Ela analisa deals, gera narrativas, cria teasers cegos, CIM e faz matching com investidores — tudo dentro da plataforma. Como partner PRO você usa tudo isso nos seus deals." },
            ].map(({ q, a }) => (
              <FAQ key={q} q={q} a={a} />
            ))}
          </div>
        </div>
      </section>

      {/* ── FORMULÁRIO ──────────────────────────────────────────────────── */}
      <section id="cadastro" className="py-28 relative overflow-hidden" style={{ background: "#06051A" }}>
        <div style={{ position: "absolute", width: 600, height: 600, borderRadius: "50%", background: `radial-gradient(circle, ${G}08 0%, transparent 70%)`, top: "50%", left: "50%", transform: "translate(-50%, -50%)", pointerEvents: "none" }} />
        <div className="max-w-6xl mx-auto px-6 relative">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left side */}
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: 3, color: G, marginBottom: 14 }}>GARANTA SUA VAGA</p>
              <h2 style={{ fontSize: "clamp(30px, 4.5vw, 50px)", fontWeight: 900, lineHeight: 1.15, color: CR, marginBottom: 20 }}>
                Comece sua jornada como{" "}
                <span style={{ background: `linear-gradient(135deg, ${G} 0%, ${G2} 100%)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                  Partner V3
                </span>
              </h2>
              <p style={{ fontSize: 15, color: MT, lineHeight: 1.8, marginBottom: 32 }}>
                Preencha o formulário e nossa equipe entrará em contato em até 24 horas úteis. Sem compromisso, sem pressão.
              </p>
              <div className="space-y-4">
                {[
                  { icon: <Check size={14} color={G} />, text: "Acesso imediato à plataforma após onboarding" },
                  { icon: <Check size={14} color={G} />, text: "Suporte da mesa operacional desde o primeiro dia" },
                  { icon: <Check size={14} color={G} />, text: "Contrato digital em minutos via ClickSign" },
                  { icon: <Check size={14} color={G} />, text: "Sem exclusividade — opere em paralelo" },
                ].map(({ icon, text }) => (
                  <div key={text} className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: `${G}15`, border: `1px solid ${G}30` }}>{icon}</div>
                    <p style={{ fontSize: 14, color: MT }}>{text}</p>
                  </div>
                ))}
              </div>
              <div className="mt-10 p-5 rounded-2xl flex items-center gap-4" style={{ background: `${G}08`, border: `1px solid ${G}20` }}>
                <div className="w-2 h-12 rounded-full flex-shrink-0" style={{ background: G }} />
                <div>
                  <p style={{ fontSize: 11, fontWeight: 700, color: G, letterSpacing: 1, marginBottom: 4 }}>VAGAS LIMITADAS</p>
                  <p style={{ fontSize: 13, color: MT, lineHeight: 1.5 }}>A V3 Partners seleciona partners com critério. Preencha agora e garanta sua avaliação.</p>
                </div>
              </div>
            </div>

            {/* Form */}
            <div>
              {sent ? (
                <div className="rounded-2xl p-12 text-center" style={{ background: N2, border: `1px solid ${G}40` }}>
                  <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6" style={{ background: `${G}15`, border: `1px solid ${G}35` }}>
                    <Check size={32} color={G} />
                  </div>
                  <h3 style={{ fontWeight: 900, fontSize: 24, color: CR, marginBottom: 12 }}>Solicitação recebida!</h3>
                  <p style={{ color: MT, fontSize: 15, lineHeight: 1.8 }}>
                    Obrigado, <strong style={{ color: CR }}>{formData.nome}</strong>!{" "}
                    Nossa equipe entrará em contato pelo e-mail{" "}
                    <strong style={{ color: G }}>{formData.email}</strong> em até 24 horas úteis.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="rounded-2xl p-8 space-y-5" style={{ background: N2, border: `1px solid ${N4}` }}>
                  <div>
                    <p style={{ fontWeight: 800, fontSize: 18, color: CR, marginBottom: 6 }}>Solicitar acesso</p>
                    <p style={{ fontSize: 13, color: MT }}>Preencha os dados abaixo para iniciar o processo.</p>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    {[
                      { label: "NOME COMPLETO *", key: "nome", type: "text", placeholder: "Seu nome completo" },
                      { label: "E-MAIL *", key: "email", type: "email", placeholder: "seu@email.com" },
                    ].map(({ label, key, type, placeholder }) => (
                      <div key={key}>
                        <label style={{ fontSize: 10, fontWeight: 700, color: MT, letterSpacing: 1.5, display: "block", marginBottom: 8 }}>{label}</label>
                        <input type={type} value={formData[key as keyof typeof formData]}
                          onChange={e => setFormData(f => ({ ...f, [key]: e.target.value }))}
                          placeholder={placeholder} required
                          className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none transition-colors"
                          style={{ background: "#0A1220", border: `1px solid ${N4}`, color: CR }} />
                      </div>
                    ))}
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    {[
                      { label: "WHATSAPP *", key: "telefone", type: "tel", placeholder: "(11) 99999-9999" },
                      { label: "SEGMENTO", key: "segmento", type: "text", placeholder: "Ex: Consultor, Advogado..." },
                    ].map(({ label, key, type, placeholder }) => (
                      <div key={key}>
                        <label style={{ fontSize: 10, fontWeight: 700, color: MT, letterSpacing: 1.5, display: "block", marginBottom: 8 }}>{label}</label>
                        <input type={type} value={formData[key as keyof typeof formData]}
                          onChange={e => setFormData(f => ({ ...f, [key]: e.target.value }))}
                          placeholder={placeholder} required={key === "telefone"}
                          className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none transition-colors"
                          style={{ background: "#0A1220", border: `1px solid ${N4}`, color: CR }} />
                      </div>
                    ))}
                  </div>

                  <div>
                    <label style={{ fontSize: 10, fontWeight: 700, color: MT, letterSpacing: 1.5, display: "block", marginBottom: 10 }}>PLANO DE INTERESSE</label>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        ["PARTNER", "V3 Partner", "R$197/mês · 30%"],
                        ["PARTNER_PRO", "V3 Partner PRO", "R$397/mês · 50%"],
                      ].map(([val, label, sub]) => (
                        <button key={val} type="button"
                          onClick={() => setFormData(f => ({ ...f, plano: val }))}
                          className="py-4 px-4 rounded-xl text-left transition-all"
                          style={{
                            background: formData.plano === val ? `${G}15` : "#0A1220",
                            border: `1px solid ${formData.plano === val ? G + "60" : N4}`,
                          }}
                        >
                          <p style={{ fontSize: 12, fontWeight: 700, color: formData.plano === val ? G : CR, marginBottom: 2 }}>{label}</p>
                          <p style={{ fontSize: 11, color: MT }}>{sub}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {formError && <p style={{ fontSize: 12, color: "#EF4444", padding: "10px 14px", borderRadius: 8, background: "#EF444415", border: "1px solid #EF444430" }}>{formError}</p>}

                  <button type="submit" disabled={sending}
                    className="w-full py-4 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 hover:opacity-90"
                    style={{ background: `linear-gradient(135deg, ${G} 0%, ${G2} 100%)`, color: N, opacity: sending ? 0.7 : 1, boxShadow: `0 8px 24px ${G}25` }}
                  >
                    {sending ? "Enviando..." : <>Solicitar acesso à V3 Partners <ArrowRight size={16} /></>}
                  </button>

                  <p style={{ fontSize: 11, color: MT, textAlign: "center", lineHeight: 1.6 }}>
                    Ao enviar, você concorda que nossa equipe entre em contato. Sem spam, sem compromisso.
                  </p>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────────────────── */}
      <footer style={{ background: "#030210", borderTop: `1px solid ${N4}` }}>
        <div className="max-w-6xl mx-auto px-6 py-14">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8 mb-12">
            <div className="flex items-center gap-4">
              <Image src="/logo.jpg" alt="V3 Partners" width={44} height={44} className="rounded-xl" />
              <div>
                <p style={{ fontWeight: 900, fontSize: 15, color: G, letterSpacing: 3 }}>V3 PARTNERS</p>
                <p style={{ fontSize: 11, color: MT, marginTop: 2 }}>Boutique Financeira Institucional</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-x-10 gap-y-3">
              {[["Como funciona", "como"], ["Planos", "planos"], ["Portfólio", "portfolio"], ["FAQ", "faq"], ["Seja Partner", "cadastro"]].map(([l, id]) => (
                <button key={id} onClick={() => go(id)} style={{ fontSize: 13, color: MT, fontWeight: 500 }} className="hover:text-white transition-colors">{l}</button>
              ))}
            </div>
          </div>
          <div className="pt-8 flex flex-col md:flex-row items-center justify-between gap-4" style={{ borderTop: `1px solid ${N4}` }}>
            <p style={{ fontSize: 11, color: "#3A4A5C" }}>
              © 2026 V3 Partners Soluções Ltda · CNPJ 14.219.287/0001-50 · v3partners.com.br
            </p>
            <p style={{ fontSize: 11, color: "#3A4A5C" }}>
              Boutique institucional multiproduto de securitização e estruturação financeira
            </p>
          </div>
        </div>
      </footer>

    </div>
  );
}
