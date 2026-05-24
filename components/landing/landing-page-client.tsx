"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import { ChevronRight, X, Menu, Check, Plus, Minus, ArrowRight } from "lucide-react";

// ── Paleta V3 ──────────────────────────────────────────────────────────────
const G  = "#C9A84C";
const G2 = "#E8C97A";
const N  = "#09081A";
const N2 = "#111F35";
const N3 = "#162744";
const N4 = "#243A66";
const CR = "#F0ECE4";
const MT = "#7A8FA8";

// ── useInView hook ─────────────────────────────────────────────────────────
function useInView(threshold = 0.15, once = true) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        setVisible(true);
        if (once) obs.disconnect();
      } else if (!once) setVisible(false);
    }, { threshold });
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold, once]);
  return { ref, visible };
}

// ── Reveal wrapper ─────────────────────────────────────────────────────────
function Reveal({
  children,
  delay = 0,
  direction = "up",
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  direction?: "up" | "left" | "right" | "none";
  className?: string;
}) {
  const { ref, visible } = useInView();
  const transforms: Record<string, string> = {
    up: "translateY(40px)",
    left: "translateX(-40px)",
    right: "translateX(40px)",
    none: "none",
  };
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "none" : transforms[direction],
        transition: `opacity 0.7s ease ${delay}ms, transform 0.7s cubic-bezier(.22,.68,0,1.2) ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

// ── Animated Counter ───────────────────────────────────────────────────────
function Counter({ to, prefix = "", suffix = "", duration = 2000 }: {
  to: number; prefix?: string; suffix?: string; duration?: number;
}) {
  const [val, setVal] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      obs.disconnect();
      const start = Date.now();
      const tick = () => {
        const p = Math.min((Date.now() - start) / duration, 1);
        const ease = 1 - Math.pow(1 - p, 4);
        setVal(Math.round(to * ease));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, { threshold: 0.3 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [to, duration]);
  return <span ref={ref}>{prefix}{val.toLocaleString("pt-BR")}{suffix}</span>;
}

// ── Gold Line Reveal ───────────────────────────────────────────────────────
function GoldLine() {
  const { ref, visible } = useInView(0.1);
  return (
    <div ref={ref} style={{ width: visible ? 48 : 0, height: 2, background: G, transition: "width 0.6s ease", flexShrink: 0 }} />
  );
}

// ── Section Label ──────────────────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Reveal direction="left">
      <div className="flex items-center gap-3 mb-10">
        <GoldLine />
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 3.5, color: G, textTransform: "uppercase" as const }}>{children}</span>
      </div>
    </Reveal>
  );
}

// ── CTA Button ─────────────────────────────────────────────────────────────
function CTA({ onClick, children, outline = false, large = false }: {
  onClick: () => void; children: React.ReactNode; outline?: boolean; large?: boolean;
}) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      className="inline-flex items-center gap-2 font-bold transition-all"
      style={{
        background: outline ? "transparent" : hov ? G2 : G,
        color: outline ? (hov ? G2 : G) : N,
        border: `2px solid ${hov ? G2 : G}`,
        padding: large ? "16px 44px" : "13px 32px",
        borderRadius: 3,
        fontSize: large ? 13 : 12,
        letterSpacing: 2,
        textTransform: "uppercase" as const,
        transform: hov ? "translateY(-2px)" : "none",
        boxShadow: hov && !outline ? `0 12px 32px ${G}40` : "none",
        transition: "all 0.25s ease",
      }}
    >
      {children} <ChevronRight size={14} />
    </button>
  );
}

// ── FAQ Item ───────────────────────────────────────────────────────────────
function FAQItem({ n, q, a }: { n: number; q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div onClick={() => setOpen(o => !o)} style={{ borderBottom: `1px solid ${N4}`, cursor: "pointer" }}>
      <div className="flex items-center justify-between py-5 gap-4">
        <p style={{ fontWeight: 600, fontSize: 15, color: open ? G : CR, lineHeight: 1.4, transition: "color 0.2s" }}>
          {n}. {q}
        </p>
        <div className="flex-shrink-0 transition-transform" style={{ color: G, transform: open ? "rotate(45deg)" : "none", transition: "transform 0.3s" }}>
          <Plus size={18} />
        </div>
      </div>
      <div style={{ maxHeight: open ? 400 : 0, overflow: "hidden", transition: "max-height 0.4s cubic-bezier(.4,0,.2,1)" }}>
        <p style={{ fontSize: 14, color: MT, lineHeight: 1.85, paddingBottom: 20 }}>{a}</p>
      </div>
    </div>
  );
}

// ── Quem Pode Card ─────────────────────────────────────────────────────────
function QuemCard({ icon, bold, rest, delay = 0 }: { icon: string; bold: string; rest: string; delay?: number }) {
  return (
    <Reveal delay={delay}>
      <div className="flex items-start gap-4 py-5" style={{ borderBottom: `1px solid ${N4}` }}>
        <div className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-lg"
          style={{ background: `${G}12`, border: `1px solid ${G}22` }}>
          {icon}
        </div>
        <p style={{ fontSize: 14, color: MT, lineHeight: 1.75 }}>
          <strong style={{ color: CR }}>{bold}</strong> {rest}
        </p>
      </div>
    </Reveal>
  );
}

// ── Benefício Row ──────────────────────────────────────────────────────────
function BenRow({ icon, children, delay = 0 }: { icon: string; children: React.ReactNode; delay?: number }) {
  return (
    <Reveal delay={delay}>
      <div className="flex items-start gap-5 py-5" style={{ borderBottom: `1px solid ${N4}` }}>
        <div className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-lg"
          style={{ background: `${G}12`, border: `1px solid ${G}22` }}>
          {icon}
        </div>
        <p style={{ fontSize: 14, color: MT, lineHeight: 1.8 }}>{children}</p>
      </div>
    </Reveal>
  );
}

// ── Solução Card ───────────────────────────────────────────────────────────
function SolucaoCard({ titulo, desc, tags, delay = 0 }: { titulo: string; desc: string; tags: string; delay?: number }) {
  const [hov, setHov] = useState(false);
  return (
    <Reveal delay={delay}>
      <div
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        style={{
          borderBottom: `1px solid ${N4}`,
          paddingTop: 28, paddingBottom: 28,
          paddingLeft: hov ? 12 : 0,
          transition: "padding-left 0.25s ease",
        }}
      >
        <h3 style={{ fontWeight: 800, fontSize: 13, color: hov ? G : CR, textTransform: "uppercase" as const, letterSpacing: 1.5, marginBottom: 8, transition: "color 0.2s" }}>{titulo}</h3>
        <p style={{ fontSize: 13, color: MT, lineHeight: 1.7, marginBottom: 10 }}>{desc}</p>
        <p style={{ fontSize: 10, color: G, fontWeight: 700, letterSpacing: 0.5 }}>{tags}</p>
      </div>
    </Reveal>
  );
}

// ── Parallax Hero BG ───────────────────────────────────────────────────────
function ParallaxOrb({ top, left, size, delay }: { top: string; left: string; size: number; delay: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handle = () => {
      if (ref.current) {
        const y = window.scrollY * 0.12;
        ref.current.style.transform = `translateY(${y + delay}px)`;
      }
    };
    window.addEventListener("scroll", handle, { passive: true });
    return () => window.removeEventListener("scroll", handle);
  }, [delay]);
  return (
    <div ref={ref} style={{
      position: "absolute", top, left,
      width: size, height: size,
      borderRadius: "50%",
      background: `radial-gradient(circle, ${G}0E 0%, transparent 70%)`,
      pointerEvents: "none",
      transition: "transform 0.1s linear",
    }} />
  );
}

// ── Main ───────────────────────────────────────────────────────────────────
export function LandingPageClient() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [showSticky, setShowSticky] = useState(false);
  const [formData, setFormData] = useState({
    nome: "", email: "", telefone: "", instagram: "", linkedin: "", segmento: "", plano: "PARTNER_PRO",
  });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    const h = () => {
      setScrolled(window.scrollY > 40);
      setShowSticky(window.scrollY > 500);
    };
    window.addEventListener("scroll", h, { passive: true });
    return () => window.removeEventListener("scroll", h);
  }, []);

  const go = useCallback((id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    setMenuOpen(false);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.nome || !formData.email || !formData.telefone) {
      setFormError("Preencha nome, e-mail e telefone."); return;
    }
    setSending(true); setFormError("");
    try {
      const res = await fetch("/api/parceiro/cadastro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (res.ok) setSent(true);
      else { const d = await res.json(); setFormError(d.error ?? "Erro ao enviar."); }
    } catch { setFormError("Erro de conexão. Tente novamente."); }
    finally { setSending(false); }
  }

  return (
    <div style={{ background: N, color: CR, fontFamily: "'DM Sans', sans-serif", overflowX: "hidden" }}>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />

      {/* ── STICKY BAR ──────────────────────────────────────────────── */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 50,
        background: "rgba(9,8,26,0.97)", backdropFilter: "blur(20px)",
        borderTop: `1px solid ${N4}`,
        transform: showSticky ? "translateY(0)" : "translateY(100%)",
        transition: "transform 0.4s cubic-bezier(.4,0,.2,1)",
      }}>
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <p style={{ fontSize: 13, fontWeight: 600, color: CR, display: "none" }} className="sm:block">
            V3 Partners — <span style={{ color: G }}>até 50% de comissão</span> em operações high ticket
          </p>
          <button onClick={() => go("form")}
            className="flex items-center gap-2 font-bold ml-auto transition-all hover:opacity-85"
            style={{ background: G, color: N, padding: "10px 28px", borderRadius: 3, fontSize: 11, letterSpacing: 2, textTransform: "uppercase" }}>
            Quero ser Partner <ArrowRight size={13} />
          </button>
        </div>
      </div>

      {/* ── NAVBAR ──────────────────────────────────────────────────── */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 40,
        background: scrolled ? "rgba(9,8,26,0.96)" : "transparent",
        backdropFilter: scrolled ? "blur(20px)" : "none",
        borderBottom: scrolled ? `1px solid ${N4}` : "none",
        transition: "all 0.3s ease",
      }}>
        <div className="max-w-5xl mx-auto px-6 flex items-center justify-between" style={{ height: 72 }}>
          <div className="flex items-center gap-3">
            <Image src="/logo.jpg" alt="V3 Partners" width={34} height={34} className="rounded-lg" />
            <span style={{ fontWeight: 900, fontSize: 13, color: G, letterSpacing: 3.5 }}>V3 PARTNERS</span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            {[["O que é", "oque"], ["Planos", "planos"], ["Soluções", "solucoes"], ["FAQ", "faq"]].map(([l, id]) => (
              <button key={id} onClick={() => go(id)} style={{ fontSize: 12, fontWeight: 500, color: MT, letterSpacing: 0.5 }} className="hover:text-white transition-colors">{l}</button>
            ))}
          </div>
          <button onClick={() => go("form")} className="hidden md:block font-bold transition-all hover:opacity-85"
            style={{ background: G, color: N, padding: "9px 22px", borderRadius: 3, fontSize: 11, letterSpacing: 2, textTransform: "uppercase" }}>
            Licenciar-se
          </button>
          <button onClick={() => setMenuOpen(o => !o)} className="md:hidden" style={{ color: CR }}>
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
        {menuOpen && (
          <div className="md:hidden px-6 py-4 space-y-1" style={{ background: "rgba(9,8,26,0.99)", borderTop: `1px solid ${N4}` }}>
            {[["O que é", "oque"], ["Planos", "planos"], ["Soluções", "solucoes"], ["FAQ", "faq"], ["Quero ser Partner", "form"]].map(([l, id]) => (
              <button key={id} onClick={() => go(id)} className="block w-full text-left py-3 text-sm" style={{ color: CR, borderBottom: `1px solid ${N4}` }}>{l}</button>
            ))}
          </div>
        )}
      </nav>

      {/* ═══════════════════════════════════════════════════════════════
          01 · HERO
      ═══════════════════════════════════════════════════════════════ */}
      <section style={{ minHeight: "100vh", display: "flex", alignItems: "center", background: N, position: "relative", overflow: "hidden" }}>
        {/* Grid */}
        <div style={{ position: "absolute", inset: 0, backgroundImage: `linear-gradient(${N4}18 1px, transparent 1px), linear-gradient(to right, ${N4}18 1px, transparent 1px)`, backgroundSize: "64px 64px", opacity: 0.5 }} />
        {/* Top gold line */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${G}, transparent)` }} />
        {/* Parallax orbs */}
        <ParallaxOrb top="10%" left="60%" size={700} delay={0} />
        <ParallaxOrb top="50%" left="-10%" size={500} delay={20} />
        <ParallaxOrb top="70%" left="80%" size={300} delay={10} />
        {/* Vignette */}
        <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse 80% 80% at 50% 50%, transparent 40%, ${N} 100%)`, pointerEvents: "none" }} />

        <div className="max-w-5xl mx-auto px-6 relative w-full" style={{ paddingTop: 160, paddingBottom: 120 }}>
          {/* Eyebrow */}
          <Reveal direction="down">
            <div className="flex items-center gap-3 mb-8">
              <div style={{ width: 40, height: 2, background: G }} />
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 4, color: G }}>LICENCIAMENTO V3 PARTNERS</span>
              <div style={{ width: 40, height: 2, background: G }} />
            </div>
          </Reveal>

          {/* Title */}
          <div style={{ overflow: "hidden", marginBottom: 12 }}>
            <Reveal direction="up" delay={100}>
              <h1 style={{ fontSize: "clamp(52px, 9vw, 110px)", fontWeight: 900, lineHeight: 0.95, color: CR, letterSpacing: -2 }}>
                PARCEIRO
              </h1>
            </Reveal>
          </div>
          <div style={{ overflow: "hidden", marginBottom: 40 }}>
            <Reveal direction="up" delay={200}>
              <h1 style={{
                fontSize: "clamp(52px, 9vw, 110px)", fontWeight: 900, lineHeight: 0.95, letterSpacing: -2,
                background: `linear-gradient(135deg, ${G} 0%, ${G2} 50%, ${G} 100%)`,
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
              }}>
                V3 PARTNERS
              </h1>
            </Reveal>
          </div>

          <Reveal direction="up" delay={300}>
            <p style={{ fontSize: "clamp(16px, 1.8vw, 20px)", color: MT, lineHeight: 1.75, maxWidth: 620, marginBottom: 16 }}>
              Uma carreira exclusiva, meritocrática e altamente rentável no Mercado Financeiro Institucional.
            </p>
            <p style={{ fontSize: "clamp(15px, 1.6vw, 18px)", color: CR, lineHeight: 1.75, maxWidth: 640, marginBottom: 52, fontWeight: 500 }}>
              Torne-se um <strong style={{ color: G }}>Partner V3</strong> e atue na intermediação de operações high ticket, com{" "}
              <strong style={{ color: G }}>comissionamentos que podem chegar a R$400 mil por operação.</strong>
            </p>
          </Reveal>

          <Reveal direction="up" delay={400}>
            <div className="flex flex-wrap gap-4">
              <CTA onClick={() => go("form")} large>Quero ser Partner</CTA>
              <CTA onClick={() => go("oque")} outline large>Como funciona</CTA>
            </div>
          </Reveal>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-20">
            {[
              { n: 50, suf: "%", label: "comissão máxima" },
              { n: 4, suf: "", label: "verticais de negócio" },
              { n: 400, suf: "K+", pre: "R$", label: "por operação fechada" },
              { n: 36, suf: "+", label: "meses de operação" },
            ].map(({ n, suf, label, pre = "" }, i) => (
              <Reveal key={label} delay={500 + i * 80}>
                <div className="rounded-2xl p-6 text-center" style={{ background: "rgba(17,31,53,0.7)", border: `1px solid ${N4}`, backdropFilter: "blur(16px)" }}>
                  <p style={{ fontSize: "clamp(26px, 3.5vw, 38px)", fontWeight: 900, color: G, lineHeight: 1 }}>
                    <Counter to={n} prefix={pre} suffix={suf} />
                  </p>
                  <p style={{ fontSize: 11, color: MT, marginTop: 6, lineHeight: 1.4 }}>{label}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          02 · O QUE É
      ═══════════════════════════════════════════════════════════════ */}
      <section id="oque" style={{ background: N2, padding: "100px 0", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, ${G}40, transparent)` }} />
        <div className="max-w-5xl mx-auto px-6">
          <SectionLabel>O QUE É A V3 PARTNERS</SectionLabel>
          <div className="grid md:grid-cols-2 gap-16 items-start">
            <div>
              <Reveal direction="left">
                <p style={{ fontSize: "clamp(15px, 1.6vw, 17px)", color: MT, lineHeight: 1.9, marginBottom: 24 }}>
                  Somos uma boutique financeira institucional especializada em operações de crédito estruturado, M&A (fusões e aquisições), securitização e real estate. Trabalhamos com soluções financeiras de alto valor e tickets a partir de R$200.000.
                </p>
              </Reveal>
              <Reveal direction="left" delay={120}>
                <p style={{ fontSize: "clamp(15px, 1.6vw, 17px)", color: MT, lineHeight: 1.9, marginBottom: 40 }}>
                  Atuamos com infraestrutura white label <strong style={{ color: CR }}>Bloxs S.A.</strong> para tokenização, KYC e liquidação OTC/cripto 24/7, junto às melhores instituições financeiras e fundos de investimento do país.
                </p>
              </Reveal>
              <Reveal delay={200}>
                <CTA onClick={() => go("form")}>Descubra como funciona</CTA>
              </Reveal>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                ["🏛️", "Crédito Estruturado", "CGI, FIDC, CRI, Home Equity"],
                ["📈", "M&A & Deal Rooms", "FORJA IA, Teaser, CIM"],
                ["🌐", "Cross-Border 24/7", "OTC, cripto, liquidação"],
                ["🏗️", "Real Estate", "SLB, BTS, BTR, Fundos"],
                ["🤖", "Plataforma com IA", "7 squads especializados"],
                ["⚖️", "Compliance & KYC", "Auditoria, trilha, risco"],
              ].map(([icon, t, d], i) => (
                <Reveal key={t} delay={i * 70}>
                  <div className="rounded-xl p-5 h-full transition-all hover:border-[#C9A84C]/40"
                    style={{ background: N3, border: `1px solid ${N4}` }}>
                    <div className="text-xl mb-3">{icon}</div>
                    <p style={{ fontWeight: 700, fontSize: 13, color: CR, marginBottom: 4 }}>{t}</p>
                    <p style={{ fontSize: 11, color: MT, lineHeight: 1.5 }}>{d}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          03 · STATEMENT — O QUE FAZ UM PARTNER
      ═══════════════════════════════════════════════════════════════ */}
      <section style={{ background: N, padding: "120px 0", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse 60% 60% at 50% 50%, ${G}07 0%, transparent 70%)`, pointerEvents: "none" }} />
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, ${G}30, transparent)` }} />
        <div className="max-w-5xl mx-auto px-6 relative">
          <SectionLabel>O QUE FAZ UM PARTNER V3</SectionLabel>
          <Reveal direction="up">
            <h2 style={{ fontSize: "clamp(20px, 3.2vw, 38px)", fontWeight: 800, color: CR, lineHeight: 1.4, marginBottom: 32, maxWidth: 900 }}>
              O Partner V3 atua na intermediação de operações high ticket e é uma peça fundamental no processo financeiro corporativo. Uma carreira dinâmica, marcada por reuniões estratégicas e relacionamento direto com grandes empresas, executivos e instituições financeiras.
            </h2>
          </Reveal>
          <Reveal direction="up" delay={150}>
            <div className="rounded-2xl p-8 mb-12 relative overflow-hidden" style={{ background: N2, border: `1px solid ${G}35` }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${G}, ${G2}, ${G})` }} />
              <p style={{ fontSize: "clamp(18px, 2.8vw, 32px)", fontWeight: 800, color: G, lineHeight: 1.4, margin: 0 }}>
                É uma profissão meritocrática, escassa e altamente valorizada no Mercado Financeiro, com comissionamentos que podem ultrapassar{" "}
                <span style={{ background: `linear-gradient(135deg, ${G}, ${G2})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                  R$400.000,00 por operação.
                </span>
              </p>
            </div>
          </Reveal>
          <Reveal delay={250}>
            <CTA onClick={() => go("form")}>Quero ser Partner</CTA>
          </Reveal>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          04 · QUEM PODE SER
      ═══════════════════════════════════════════════════════════════ */}
      <section style={{ background: N2, padding: "100px 0", position: "relative" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, ${G}30, transparent)` }} />
        <div className="max-w-5xl mx-auto px-6">
          <SectionLabel>Quem pode ser um Partner V3</SectionLabel>
          <div className="grid md:grid-cols-2 gap-x-16 mb-12">
            <div style={{ borderTop: `1px solid ${N4}` }}>
              <QuemCard delay={0}   icon="💼" bold="Profissionais que desejam ingressar no mercado financeiro" rest="e empreender em uma área de alta valorização, com crédito estruturado, M&A e operações institucionais." />
              <QuemCard delay={60}  icon="📊" bold="Consultores, gestores, empresários e autônomos" rest="que desejam ampliar seu portfólio e oferecer soluções financeiras de alto valor para sua base de clientes." />
              <QuemCard delay={120} icon="💰" bold="Pessoas que buscam comissionamentos elevados," rest="crescimento acelerado e a possibilidade de operar em um mercado escasso e altamente rentável." />
              <QuemCard delay={180} icon="🏦" bold="Contadores, gestores financeiros e consultores empresariais" rest="com acesso direto à realidade financeira das empresas e oportunidades de crédito e M&A." />
            </div>
            <div style={{ borderTop: `1px solid ${N4}` }}>
              <QuemCard delay={0}   icon="⚖️" bold="Advogados empresariais, societários e tributários," rest="envolvidos em processos de expansão, aquisições, reestruturações e operações de M&A." />
              <QuemCard delay={60}  icon="🏛️" bold="Correspondentes bancários e profissionais de crédito" rest="que buscam liberdade operacional, produtos mais inteligentes e comissionamentos superiores." />
              <QuemCard delay={120} icon="🤝" bold="Consultores e profissionais autônomos" rest="que desejam ampliar o portfólio com soluções financeiras corporativas de alto valor agregado." />
              <QuemCard delay={180} icon="🏗️" bold="Corretores de imóveis comerciais e de alto padrão" rest="que atuam com empresários, investidores e operações de grande volume." />
            </div>
          </div>
          <Reveal>
            <div className="rounded-2xl px-8 py-6 mb-10" style={{ background: `${G}0C`, border: `1px solid ${G}25` }}>
              <p style={{ fontSize: "clamp(16px, 2vw, 20px)", color: CR, fontWeight: 600, lineHeight: 1.6 }}>
                A principal qualificação é{" "}
                <strong style={{ color: G }}>a disposição para trazer novos negócios</strong>{" "}
                à mesa de crédito e M&A.
              </p>
            </div>
          </Reveal>
          <Reveal delay={100}>
            <CTA onClick={() => go("form")}>Quero ser Partner</CTA>
          </Reveal>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          05 · MODELO DE NEGÓCIO
      ═══════════════════════════════════════════════════════════════ */}
      <section style={{ background: N, padding: "100px 0", position: "relative" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, ${G}30, transparent)` }} />
        <div className="max-w-5xl mx-auto px-6">
          <SectionLabel>Nosso modelo de negócio vai te dar acesso a:</SectionLabel>
          <div className="grid md:grid-cols-2 gap-x-16 mb-12">
            <div style={{ borderTop: `1px solid ${N4}` }}>
              <BenRow delay={0}   icon="💎">Comercializar operações financeiras exclusivas e high ticket, com <strong style={{ color: G }}>comissionamentos que podem ultrapassar R$400 mil por operação.</strong></BenRow>
              <BenRow delay={80}  icon="📚">Receber <strong style={{ color: CR }}>treinamentos e materiais comerciais personalizados</strong>, garantindo segurança e profissionalismo no atendimento.</BenRow>
              <BenRow delay={160} icon="📅">Participar de <strong style={{ color: CR }}>reuniões semanais de capacitação</strong>, focadas em estratégias comerciais e crescimento no mercado financeiro.</BenRow>
            </div>
            <div style={{ borderTop: `1px solid ${N4}` }}>
              <BenRow delay={0}   icon="🛡️">Contar com <strong style={{ color: CR }}>suporte especializado da equipe V3 Partners</strong> no acompanhamento de clientes, operações e ativos em M&A.</BenRow>
              <BenRow delay={80}  icon="🚀">Ter <strong style={{ color: CR }}>visibilidade e protagonismo conjunto</strong>, incluindo participação em eventos, fortalecendo imagem, autoridade e networking.</BenRow>
              <BenRow delay={160} icon="🌐">Ter a <strong style={{ color: CR }}>oportunidade de atuar como empreendedor no mercado financeiro institucional</strong>, construindo uma carreira escalável.</BenRow>
            </div>
          </div>
          <Reveal delay={200}>
            <CTA onClick={() => go("form")}>Comece sua jornada</CTA>
          </Reveal>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          06 · PLANOS
      ═══════════════════════════════════════════════════════════════ */}
      <section id="planos" style={{ background: N2, padding: "100px 0", position: "relative" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, ${G}40, transparent)` }} />
        <div className="max-w-5xl mx-auto px-6">
          <Reveal>
            <div className="text-center mb-14">
              <button onClick={() => go("form")}
                className="font-bold transition-all hover:opacity-85"
                style={{ background: G, color: N, padding: "15px 44px", borderRadius: 3, fontSize: 12, letterSpacing: 2.5, textTransform: "uppercase" }}>
                Quero garantir meu licenciamento
              </button>
            </div>
          </Reveal>
          <SectionLabel>Modelos de Licenciamento</SectionLabel>
          <div className="grid md:grid-cols-3 gap-5 mb-14">
            {[
              {
                titulo: "V3 Partner Entry",
                badge: null,
                desc: "Modelo de entrada com foco em rápida ativação comercial. Acesso às soluções mais demandadas do portfólio, crédito recorrente e split fiscal.",
                items: ["Crédito N1 e N2", "CRM + IA integrada", "Academy base", "Chat com a mesa", "30% de comissão"],
                d: 0,
              },
              {
                titulo: "V3 Partner",
                badge: "Mais indicado",
                desc: "Para quem deseja ingressar no mercado financeiro com estrutura completa. Acesso a diversas linhas de crédito e capacitação contínua.",
                items: ["Crédito N1, N2 e N3", "Mesa de crédito completa", "Relatórios e KPIs", "Consórcio corporativo", "30% de comissão"],
                d: 100,
              },
              {
                titulo: "V3 Partner PRO",
                badge: null,
                desc: "Para quem busca máxima rentabilidade. Crédito estruturado, M&A, benefícios exclusivos e co-branding para ampliar autoridade e resultados.",
                items: ["Tudo do Partner +", "Mesa M&A dedicada", "Deal Rooms e VDR", "Co-branding V3", "50% de comissão"],
                d: 200,
              },
            ].map(({ titulo, badge, desc, items, d }) => (
              <Reveal key={titulo} delay={d}>
                <div className="rounded-xl p-7 flex flex-col gap-4 h-full" style={{
                  background: badge ? `${G}0F` : N3,
                  border: `1px solid ${badge ? G + "50" : N4}`,
                  position: "relative",
                  overflow: "hidden",
                }}>
                  {badge && <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${G}, ${G2})` }} />}
                  {badge && (
                    <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, color: G, background: `${G}20`, border: `1px solid ${G}40`, padding: "4px 10px", borderRadius: 20, display: "inline-block", alignSelf: "flex-start" }}>{badge}</div>
                  )}
                  <h3 style={{ fontWeight: 900, fontSize: 18, color: badge ? G : CR }}>{titulo}</h3>
                  <p style={{ fontSize: 13, color: MT, lineHeight: 1.75 }}>{desc}</p>
                  <div className="space-y-2.5 pt-4 flex-1" style={{ borderTop: `1px solid ${N4}` }}>
                    {items.map(it => (
                      <div key={it} className="flex items-center gap-2.5">
                        <div className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: `${G}20`, border: `1px solid ${G}40` }}>
                          <Check size={9} color={G} />
                        </div>
                        <p style={{ fontSize: 12, color: it.includes("comissão") ? G : MT, fontWeight: it.includes("comissão") ? 700 : 400 }}>{it}</p>
                      </div>
                    ))}
                  </div>
                  <button onClick={() => go("form")} className="mt-4 w-full py-3 rounded-lg font-bold text-xs transition-all hover:opacity-85"
                    style={{ background: badge ? G : "transparent", color: badge ? N : G, border: `1px solid ${G}`, letterSpacing: 1.5, textTransform: "uppercase" }}>
                    Solicitar acesso
                  </button>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          07 · SOLUÇÕES
      ═══════════════════════════════════════════════════════════════ */}
      <section id="solucoes" style={{ background: N, padding: "100px 0", position: "relative" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, ${G}30, transparent)` }} />
        <div className="max-w-5xl mx-auto px-6">
          <SectionLabel>Algumas das nossas soluções financeiras</SectionLabel>
          <div className="grid md:grid-cols-2 gap-x-16 mb-14">
            <div style={{ borderTop: `1px solid ${N4}` }}>
              <SolucaoCard delay={0}   titulo="Crédito com Garantia Imobiliária" desc="Soluções estruturadas para capital de giro, alavancagem patrimonial e aquisição de imóveis." tags="Home Equity • CGI PJ • CRI • Giro Equity • Financiamentos" />
              <SolucaoCard delay={60}  titulo="Securitização de Recebíveis" desc="Transforme ativos em capital com estruturas de securitização ágeis e flexíveis." tags="FIDC • CRI • Precatórios • Cessão de Crédito • Notas Comerciais" />
              <SolucaoCard delay={120} titulo="M&A | Fusões e Aquisições" desc="Estruturação completa de compra, venda e fusão de empresas com IA proprietária FORJA." tags="Valuation • NDA • Teaser Cego • CIM • Deal Rooms • Matching IA" />
              <SolucaoCard delay={180} titulo="Crédito Corporativo" desc="Soluções completas para fortalecer caixa, adquirir ativos e escalar empresas." tags="Capital de Giro • Leasing • Consórcio Prime • Cash Collateral" />
              <SolucaoCard delay={240} titulo="Crédito Agro" desc="Soluções financeiras para produtores rurais e empresas do agronegócio." tags="CPR • Fundo Agro • Sale & Leaseback • Maquinários • Custeio" />
            </div>
            <div style={{ borderTop: `1px solid ${N4}` }}>
              <SolucaoCard delay={0}   titulo="Real Estate Estruturado" desc="Financiamento e estruturação para projetos e empreendimentos imobiliários." tags="SLB • BTS • BTR • Fundos Imobiliários • Incorporação" />
              <SolucaoCard delay={60}  titulo="Operações Internacionais" desc="Acesso a capital global e estruturas financeiras internacionais com Bloxs S.A." tags="ACC • ACE • Câmbio • Cross-Border OTC • Cripto 24/7" />
              <SolucaoCard delay={120} titulo="Mineração & Commodities" desc="Soluções para produtores e traders de commodities e metais preciosos." tags="Ouro • Lítio • Metais Preciosos • Financiamento de Projetos" />
              <SolucaoCard delay={180} titulo="Split Fiscal Inteligente" desc="Estrutura financeira com eficiência tributária que maximiza a margem líquida." tags="Split de Pagamentos • Conta Técnica • Compliance Tributário" />
              <SolucaoCard delay={240} titulo="Operações Distressed" desc="Alternativas para empresas em cenário crítico ou restritivo." tags="Fundo Estressado • Home Equity Distressed • Recebíveis Restritivos" />
            </div>
          </div>
          <Reveal delay={200}>
            <CTA onClick={() => go("form")}>Descubra como funciona</CTA>
          </Reveal>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          08 · SOBRE
      ═══════════════════════════════════════════════════════════════ */}
      <section style={{ background: N2, padding: "100px 0", position: "relative" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, ${G}30, transparent)` }} />
        <div className="max-w-5xl mx-auto px-6">
          <SectionLabel>Conheça a V3 Partners</SectionLabel>
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div>
              <Reveal direction="left">
                <p style={{ fontSize: 15, color: MT, lineHeight: 1.9, marginBottom: 20 }}>
                  A V3 Partners nasceu da visão de <strong style={{ color: CR }}>Hamilton Santos, João Lemos Netto e Robson Lino</strong>, que uniram expertise em finanças estruturadas, originação de negócios e compliance para transformar o acesso ao mercado financeiro institucional brasileiro.
                </p>
              </Reveal>
              <Reveal direction="left" delay={100}>
                <p style={{ fontSize: 15, color: MT, lineHeight: 1.9, marginBottom: 20 }}>
                  Com infraestrutura white label <strong style={{ color: CR }}>Bloxs S.A.</strong> para tokenização, KYC e liquidação OTC/cripto 24/7, operamos com o que há de mais avançado em fintech institucional no Brasil.
                </p>
              </Reveal>
              <Reveal direction="left" delay={180}>
                <p style={{ fontSize: 15, color: MT, lineHeight: 1.9 }}>
                  A história da V3 Partners é sobre <strong style={{ color: G }}>transformar profissionais em protagonistas do mercado financeiro</strong>, com estrutura, tecnologia e suporte de boutique institucional de alto padrão.
                </p>
              </Reveal>
            </div>
            {/* Metrics */}
            <div className="grid grid-cols-2 gap-4">
              {[
                { n: 57, suf: "", label: "tabelas de dados", desc: "estrutura robusta" },
                { n: 7,  suf: "", label: "squads de IA",    desc: "especializados" },
                { n: 10, suf: "+", label: "módulos",        desc: "na plataforma" },
                { n: 50, suf: "%", label: "de comissão",    desc: "Partner PRO" },
              ].map(({ n, suf, label, desc }, i) => (
                <Reveal key={label} delay={i * 80}>
                  <div className="rounded-2xl p-6 text-center" style={{ background: N3, border: `1px solid ${N4}` }}>
                    <p style={{ fontSize: "clamp(28px, 3vw, 36px)", fontWeight: 900, color: G, lineHeight: 1 }}>
                      <Counter to={n} suffix={suf} />
                    </p>
                    <p style={{ fontSize: 12, color: CR, fontWeight: 600, marginTop: 6 }}>{label}</p>
                    <p style={{ fontSize: 10, color: MT }}>{desc}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          09 · FAQ
      ═══════════════════════════════════════════════════════════════ */}
      <section id="faq" style={{ background: N, padding: "100px 0", position: "relative" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, ${G}30, transparent)` }} />
        <div className="max-w-5xl mx-auto px-6">
          <SectionLabel>FAQ</SectionLabel>
          <Reveal>
            <div style={{ borderTop: `1px solid ${N4}`, maxWidth: 860 }}>
              {[
                { q: "Como faço para me tornar um Partner V3?", a: "Preencha o formulário de interesse nesta página. Nossa equipe de Novos Negócios entrará em contato em até 24 horas úteis para apresentar o processo completo, tirar dúvidas e iniciar o onboarding." },
                { q: "Quais são os requisitos para ser um Partner V3?", a: "Não exigimos experiência prévia no mercado financeiro. A principal qualificação é a disposição para trazer novos negócios. A V3 oferece toda a capacitação técnica pelo Academy." },
                { q: "Quanto tempo leva para começar a atuar?", a: "Após aprovação e assinatura do contrato digital, o acesso à plataforma é liberado em até 24h. O onboarding guiado acontece nas primeiras semanas, com suporte da mesa operacional." },
                { q: "Quando receberei meus primeiros comissionamentos?", a: "Em crédito estruturado, o ciclo médio é de 30 a 90 dias. Em M&A, pode levar de 3 a 12 meses. Operações de split fiscal e antecipação de recebíveis tendem a ser mais rápidas." },
                { q: "Posso trabalhar em paralelo com minha profissão atual?", a: "Sim. A parceria V3 é não exclusiva. Você pode manter outras atividades profissionais sem restrição. A plataforma foi desenhada para uso assíncrono — você opera no seu ritmo." },
                { q: "Quais são os percentuais de comissão?", a: "O Partner recebe 30% do resultado líquido de cada operação fechada. O Partner PRO recebe 50%. Os valores são rastreados em tempo real na plataforma e pagos após a liquidação." },
                { q: "O que são operações mandatadas?", a: "São operações onde a V3 Partners atua como mandatária — responsável por toda a estruturação, análise, compliance e condução. O partner origina e a V3 executa, garantindo qualidade institucional." },
                { q: "Quero ser partner, mas não tenho network nem experiência com crédito. E agora?", a: "Comece pelo Academy V3. Nossa trilha é desenhada para profissionais de qualquer área. Você aprende o que precisa, constrói sua carteira gradualmente e conta com suporte em cada operação." },
                { q: "Qual a diferença entre Partner e Partner PRO?", a: "Além da comissão maior (50% vs 30%), o Partner PRO tem acesso ao crédito N3 (acima de R$5M), Mesa M&A dedicada, co-branding V3, Deal Rooms com VDR e Academy M&A avançado." },
                { q: "Como é a plataforma da V3 Partners?", a: "É uma plataforma SaaS proprietária com CRM, Mesa de Crédito (N1/N2/N3), Mesa M&A com IA FORJA, Deal Rooms, Academy, Chat, relatórios de comissões, marketplace e 7 squads de IA especializada." },
              ].map(({ q, a }, i) => <FAQItem key={q} n={i + 1} q={q} a={a} />)}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          10 · FORMULÁRIO
      ═══════════════════════════════════════════════════════════════ */}
      <section id="form" style={{ background: N2, padding: "100px 0", position: "relative" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${G}, transparent)` }} />
        <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse 50% 60% at 50% 0%, ${G}08 0%, transparent 70%)`, pointerEvents: "none" }} />
        <div className="max-w-3xl mx-auto px-6 relative">
          <SectionLabel>Solicitar Licenciamento</SectionLabel>

          {sent ? (
            <Reveal>
              <div className="rounded-2xl p-14 text-center" style={{ background: N3, border: `1px solid ${G}40` }}>
                <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6" style={{ background: `${G}15`, border: `1px solid ${G}35` }}>
                  <Check size={32} color={G} />
                </div>
                <h3 style={{ fontWeight: 900, fontSize: 26, color: CR, marginBottom: 14 }}>Solicitação recebida!</h3>
                <p style={{ color: MT, fontSize: 15, lineHeight: 1.85 }}>
                  Obrigado, <strong style={{ color: CR }}>{formData.nome}</strong>!{" "}
                  Nossa equipe de Novos Negócios entrará em contato pelo e-mail{" "}
                  <strong style={{ color: G }}>{formData.email}</strong> em até 24 horas úteis.
                </p>
              </div>
            </Reveal>
          ) : (
            <>
              <Reveal direction="up">
                <p style={{ fontSize: 15, color: MT, lineHeight: 1.8, marginBottom: 40 }}>
                  Preencha seus dados e nosso time de Novos Negócios entrará em contato para te mostrar como se tornar um Partner V3 Partners.
                </p>
              </Reveal>
              <Reveal direction="up" delay={100}>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label style={{ fontSize: 10, fontWeight: 700, color: MT, letterSpacing: 2, display: "block", marginBottom: 8 }}>NOME COMPLETO *</label>
                    <input type="text" value={formData.nome} onChange={e => setFormData(f => ({ ...f, nome: e.target.value }))}
                      placeholder="Seu nome completo" required
                      className="w-full px-5 py-4 text-sm focus:outline-none transition-all"
                      style={{ background: N3, border: `1px solid ${N4}`, borderRadius: 4, color: CR }} />
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label style={{ fontSize: 10, fontWeight: 700, color: MT, letterSpacing: 2, display: "block", marginBottom: 8 }}>E-MAIL *</label>
                      <input type="email" value={formData.email} onChange={e => setFormData(f => ({ ...f, email: e.target.value }))}
                        placeholder="seu@email.com" required
                        className="w-full px-5 py-4 text-sm focus:outline-none"
                        style={{ background: N3, border: `1px solid ${N4}`, borderRadius: 4, color: CR }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 10, fontWeight: 700, color: MT, letterSpacing: 2, display: "block", marginBottom: 8 }}>TELEFONE / WHATSAPP *</label>
                      <input type="tel" value={formData.telefone} onChange={e => setFormData(f => ({ ...f, telefone: e.target.value }))}
                        placeholder="(11) 99999-9999" required
                        className="w-full px-5 py-4 text-sm focus:outline-none"
                        style={{ background: N3, border: `1px solid ${N4}`, borderRadius: 4, color: CR }} />
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label style={{ fontSize: 10, fontWeight: 700, color: MT, letterSpacing: 2, display: "block", marginBottom: 8 }}>INSTAGRAM</label>
                      <input type="text" value={formData.instagram} onChange={e => setFormData(f => ({ ...f, instagram: e.target.value }))}
                        placeholder="@seuperfil"
                        className="w-full px-5 py-4 text-sm focus:outline-none"
                        style={{ background: N3, border: `1px solid ${N4}`, borderRadius: 4, color: CR }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 10, fontWeight: 700, color: MT, letterSpacing: 2, display: "block", marginBottom: 8 }}>LINKEDIN</label>
                      <input type="text" value={formData.linkedin} onChange={e => setFormData(f => ({ ...f, linkedin: e.target.value }))}
                        placeholder="linkedin.com/in/..."
                        className="w-full px-5 py-4 text-sm focus:outline-none"
                        style={{ background: N3, border: `1px solid ${N4}`, borderRadius: 4, color: CR }} />
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: 10, fontWeight: 700, color: MT, letterSpacing: 2, display: "block", marginBottom: 8 }}>RAMO DE ATUAÇÃO</label>
                    <input type="text" value={formData.segmento} onChange={e => setFormData(f => ({ ...f, segmento: e.target.value }))}
                      placeholder="Ex: Consultor financeiro, Advogado, Corretor..."
                      className="w-full px-5 py-4 text-sm focus:outline-none"
                      style={{ background: N3, border: `1px solid ${N4}`, borderRadius: 4, color: CR }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 10, fontWeight: 700, color: MT, letterSpacing: 2, display: "block", marginBottom: 10 }}>LICENCIAMENTO DE INTERESSE</label>
                    <div className="grid sm:grid-cols-3 gap-3">
                      {[
                        ["PARTNER_ENTRY", "V3 Partner Entry", "30% · Entrada"],
                        ["PARTNER",       "V3 Partner",       "30% · Completo"],
                        ["PARTNER_PRO",   "V3 Partner PRO",   "50% · Máximo"],
                      ].map(([val, label, sub]) => (
                        <button key={val} type="button" onClick={() => setFormData(f => ({ ...f, plano: val }))}
                          className="py-4 px-3 text-left transition-all"
                          style={{ background: formData.plano === val ? `${G}15` : N3, border: `1px solid ${formData.plano === val ? G + "60" : N4}`, borderRadius: 4 }}>
                          <p style={{ fontSize: 12, fontWeight: 700, color: formData.plano === val ? G : CR, marginBottom: 2 }}>{label}</p>
                          <p style={{ fontSize: 10, color: MT }}>{sub}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                  {formError && (
                    <p style={{ fontSize: 12, color: "#EF4444", padding: "10px 14px", borderRadius: 4, background: "#EF444412", border: "1px solid #EF444428" }}>{formError}</p>
                  )}
                  <button type="submit" disabled={sending}
                    className="w-full py-4 font-bold text-sm transition-all hover:opacity-85"
                    style={{ background: G, color: N, borderRadius: 4, fontSize: 12, letterSpacing: 2.5, textTransform: "uppercase", opacity: sending ? 0.7 : 1, marginTop: 8 }}>
                    {sending ? "ENVIANDO..." : "ENTRAR EM CONTATO"}
                  </button>
                  <p style={{ fontSize: 11, color: MT, textAlign: "center", lineHeight: 1.6, marginTop: 8 }}>
                    Ao enviar, você concorda que nossa equipe entre em contato. Sem spam, sem compromisso.
                  </p>
                </form>
              </Reveal>
            </>
          )}
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────────────── */}
      <footer style={{ background: N, borderTop: `1px solid ${N4}` }}>
        <div className="max-w-5xl mx-auto px-6 py-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <Image src="/logo.jpg" alt="V3 Partners" width={30} height={30} className="rounded-lg" />
            <div>
              <p style={{ fontWeight: 900, fontSize: 12, color: G, letterSpacing: 3.5 }}>V3 PARTNERS</p>
              <p style={{ fontSize: 10, color: MT, marginTop: 1 }}>V3 Partners Soluções Ltda · CNPJ 14.219.287/0001-50</p>
            </div>
          </div>
          <p style={{ fontSize: 11, color: MT }}>© 2026 V3 PARTNERS | Todos os direitos reservados.</p>
        </div>
      </footer>

    </div>
  );
}
