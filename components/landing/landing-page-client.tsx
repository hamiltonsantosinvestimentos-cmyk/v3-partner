"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import { ChevronRight, X, Menu, Check, Plus, ArrowRight, TrendingUp, Shield, Zap } from "lucide-react";

// ── Paleta V3 ──────────────────────────────────────────────────────────────
const G  = "#C9A84C";
const G2 = "#E8C97A";
const N  = "#09081A";
const N2 = "#111F35";
const N3 = "#162744";
const N4 = "#243A66";
const CR = "#F0ECE4";
const MT = "#7A8FA8";

// ── useInView ──────────────────────────────────────────────────────────────
function useInView(threshold = 0.12, once = true) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setVisible(true); if (once) obs.disconnect(); }
      else if (!once) setVisible(false);
    }, { threshold });
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold, once]);
  return { ref, visible };
}

// ── Reveal ─────────────────────────────────────────────────────────────────
function Reveal({ children, delay = 0, direction = "up", className = "" }: {
  children: React.ReactNode; delay?: number;
  direction?: "up" | "left" | "right" | "none"; className?: string;
}) {
  const { ref, visible } = useInView();
  const transforms: Record<string, string> = {
    up: "translateY(36px)", left: "translateX(-36px)",
    right: "translateX(36px)", none: "none",
  };
  return (
    <div ref={ref} className={className} style={{
      opacity: visible ? 1 : 0,
      transform: visible ? "none" : transforms[direction],
      transition: `opacity 0.65s ease ${delay}ms, transform 0.65s cubic-bezier(.22,.68,0,1.2) ${delay}ms`,
    }}>{children}</div>
  );
}

// ── Counter ────────────────────────────────────────────────────────────────
function Counter({ to, prefix = "", suffix = "", duration = 1800 }: {
  to: number; prefix?: string; suffix?: string; duration?: number;
}) {
  const [val, setVal] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const obs = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return; obs.disconnect();
      const start = Date.now();
      const tick = () => {
        const p = Math.min((Date.now() - start) / duration, 1);
        setVal(Math.round(to * (1 - Math.pow(1 - p, 4))));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, { threshold: 0.3 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [to, duration]);
  return <span ref={ref}>{prefix}{val.toLocaleString("pt-BR")}{suffix}</span>;
}

// ── GoldLine ───────────────────────────────────────────────────────────────
function GoldLine() {
  const { ref, visible } = useInView(0.1);
  return <div ref={ref} style={{ width: visible ? 48 : 0, height: 2, background: G, transition: "width 0.55s ease", flexShrink: 0 }} />;
}

// ── SectionLabel ───────────────────────────────────────────────────────────
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

// ── CTABtn ─────────────────────────────────────────────────────────────────
function CTABtn({ onClick, children, outline = false, large = false, full = false }: {
  onClick: () => void; children: React.ReactNode;
  outline?: boolean; large?: boolean; full?: boolean;
}) {
  const [hov, setHov] = useState(false);
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      className={`inline-flex items-center justify-center gap-2 font-bold transition-all${full ? " w-full" : ""}`}
      style={{
        background: outline ? "transparent" : hov ? G2 : G,
        color: outline ? (hov ? G2 : G) : N,
        border: `2px solid ${hov ? G2 : G}`,
        padding: large ? "17px 48px" : "13px 32px",
        borderRadius: 3, fontSize: large ? 13 : 12,
        letterSpacing: 2.2, textTransform: "uppercase" as const,
        transform: hov ? "translateY(-2px)" : "none",
        boxShadow: hov && !outline ? `0 14px 36px ${G}45` : "none",
        transition: "all 0.22s ease",
      }}>
      {children} <ChevronRight size={14} />
    </button>
  );
}

// ── FAQItem ────────────────────────────────────────────────────────────────
function FAQItem({ n, q, a }: { n: number; q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div onClick={() => setOpen(o => !o)} style={{ borderBottom: `1px solid ${N4}`, cursor: "pointer" }}>
      <div className="flex items-start justify-between py-5 gap-4">
        <p style={{ fontWeight: 600, fontSize: 15, color: open ? G : CR, lineHeight: 1.45, transition: "color 0.2s" }}>
          {n}. {q}
        </p>
        <div className="flex-shrink-0 mt-0.5" style={{ color: G, transform: open ? "rotate(45deg)" : "none", transition: "transform 0.3s" }}>
          <Plus size={17} />
        </div>
      </div>
      <div style={{ maxHeight: open ? 420 : 0, overflow: "hidden", transition: "max-height 0.4s cubic-bezier(.4,0,.2,1)" }}>
        <p style={{ fontSize: 14, color: MT, lineHeight: 1.9, paddingBottom: 22 }}>{a}</p>
      </div>
    </div>
  );
}

// ── ParallaxOrb ────────────────────────────────────────────────────────────
function ParallaxOrb({ top, left, size, delay }: { top: string; left: string; size: number; delay: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = () => { if (ref.current) ref.current.style.transform = `translateY(${window.scrollY * 0.10 + delay}px)`; };
    window.addEventListener("scroll", h, { passive: true });
    return () => window.removeEventListener("scroll", h);
  }, [delay]);
  return (
    <div ref={ref} style={{
      position: "absolute", top, left, width: size, height: size,
      borderRadius: "50%", background: `radial-gradient(circle, ${G}0D 0%, transparent 70%)`,
      pointerEvents: "none",
    }} />
  );
}

// ── PainCard ───────────────────────────────────────────────────────────────
function PainCard({ icon, title, body, delay = 0 }: { icon: string; title: string; body: string; delay?: number }) {
  return (
    <Reveal delay={delay}>
      <div className="rounded-xl p-6 h-full" style={{ background: N3, border: `1px solid ${N4}` }}>
        <div className="text-2xl mb-4">{icon}</div>
        <p style={{ fontWeight: 700, fontSize: 14, color: CR, marginBottom: 8, lineHeight: 1.4 }}>{title}</p>
        <p style={{ fontSize: 13, color: MT, lineHeight: 1.75 }}>{body}</p>
      </div>
    </Reveal>
  );
}

// ── StepCard ───────────────────────────────────────────────────────────────
function StepCard({ n, title, body, delay = 0 }: { n: string; title: string; body: string; delay?: number }) {
  return (
    <Reveal delay={delay}>
      <div className="relative p-7 rounded-xl h-full" style={{ background: N2, border: `1px solid ${N4}` }}>
        <div style={{ fontSize: "clamp(52px, 6vw, 72px)", fontWeight: 900, color: `${G}18`, lineHeight: 1, marginBottom: 16, letterSpacing: -2 }}>{n}</div>
        <p style={{ fontWeight: 800, fontSize: 15, color: G, marginBottom: 8 }}>{title}</p>
        <p style={{ fontSize: 13, color: MT, lineHeight: 1.8 }}>{body}</p>
      </div>
    </Reveal>
  );
}

// ── CompareRow ─────────────────────────────────────────────────────────────
function CompareRow({ label, bad, good, delay = 0 }: { label: string; bad: string; good: string; delay?: number }) {
  return (
    <Reveal delay={delay}>
      <div className="grid grid-cols-3 gap-2 py-4" style={{ borderBottom: `1px solid ${N4}` }}>
        <p style={{ fontSize: 12, color: MT, fontWeight: 600, display: "flex", alignItems: "center" }}>{label}</p>
        <div className="rounded-lg px-3 py-2 text-center" style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)" }}>
          <p style={{ fontSize: 12, color: "#EF4444", fontWeight: 500 }}>{bad}</p>
        </div>
        <div className="rounded-lg px-3 py-2 text-center" style={{ background: `${G}0E`, border: `1px solid ${G}30` }}>
          <p style={{ fontSize: 12, color: G, fontWeight: 700 }}>{good}</p>
        </div>
      </div>
    </Reveal>
  );
}

// ── SolucaoCard ────────────────────────────────────────────────────────────
function SolucaoCard({ titulo, desc, tags, delay = 0 }: { titulo: string; desc: string; tags: string; delay?: number }) {
  const [hov, setHov] = useState(false);
  return (
    <Reveal delay={delay}>
      <div onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
        style={{ borderBottom: `1px solid ${N4}`, paddingTop: 26, paddingBottom: 26, paddingLeft: hov ? 14 : 0, transition: "padding-left 0.22s ease" }}>
        <h3 style={{ fontWeight: 800, fontSize: 13, color: hov ? G : CR, textTransform: "uppercase" as const, letterSpacing: 1.5, marginBottom: 7, transition: "color 0.2s" }}>{titulo}</h3>
        <p style={{ fontSize: 13, color: MT, lineHeight: 1.7, marginBottom: 9 }}>{desc}</p>
        <p style={{ fontSize: 10, color: G, fontWeight: 700, letterSpacing: 0.5 }}>{tags}</p>
      </div>
    </Reveal>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════════════════
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
    const h = () => { setScrolled(window.scrollY > 40); setShowSticky(window.scrollY > 600); };
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
        method: "POST", headers: { "Content-Type": "application/json" },
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
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;0,9..40,800;0,9..40,900;1,9..40,400&display=swap" rel="stylesheet" />

      {/* ── STICKY BAR ──────────────────────────────────────────────────── */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 50,
        background: "rgba(9,8,26,0.97)", backdropFilter: "blur(20px)",
        borderTop: `1px solid ${N4}`,
        transform: showSticky ? "translateY(0)" : "translateY(100%)",
        transition: "transform 0.4s cubic-bezier(.4,0,.2,1)",
      }}>
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <p style={{ fontSize: 13, fontWeight: 600, color: CR }} className="hidden sm:block">
            Partners V3 ganham até <span style={{ color: G }}>50% por operação.</span> Vagas limitadas por região.
          </p>
          <button onClick={() => go("form")}
            className="flex items-center gap-2 font-bold ml-auto transition-all hover:opacity-85"
            style={{ background: G, color: N, padding: "10px 28px", borderRadius: 3, fontSize: 11, letterSpacing: 2, textTransform: "uppercase" }}>
            Garantir minha vaga <ArrowRight size={13} />
          </button>
        </div>
      </div>

      {/* ── NAVBAR ──────────────────────────────────────────────────────── */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 40,
        background: scrolled ? "rgba(9,8,26,0.97)" : "transparent",
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
            {[["Como funciona", "como"], ["Planos", "planos"], ["Soluções", "solucoes"], ["FAQ", "faq"]].map(([l, id]) => (
              <button key={id} onClick={() => go(id)} style={{ fontSize: 12, fontWeight: 500, color: MT, letterSpacing: 0.5 }} className="hover:text-white transition-colors">{l}</button>
            ))}
          </div>
          <button onClick={() => go("form")} className="hidden md:block font-bold transition-all hover:opacity-85"
            style={{ background: G, color: N, padding: "9px 22px", borderRadius: 3, fontSize: 11, letterSpacing: 2, textTransform: "uppercase" }}>
            Solicitar vaga
          </button>
          <button onClick={() => setMenuOpen(o => !o)} className="md:hidden" style={{ color: CR }}>
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
        {menuOpen && (
          <div className="md:hidden px-6 py-4 space-y-1" style={{ background: "rgba(9,8,26,0.99)", borderTop: `1px solid ${N4}` }}>
            {[["Como funciona", "como"], ["Planos", "planos"], ["Soluções", "solucoes"], ["FAQ", "faq"], ["Solicitar vaga", "form"]].map(([l, id]) => (
              <button key={id} onClick={() => go(id)} className="block w-full text-left py-3 text-sm" style={{ color: CR, borderBottom: `1px solid ${N4}` }}>{l}</button>
            ))}
          </div>
        )}
      </nav>

      {/* ═══════════════════════════════════════════════════════════════
          01 · HERO — Dor primeiro, solução depois
      ═══════════════════════════════════════════════════════════════ */}
      <section style={{ minHeight: "100vh", display: "flex", alignItems: "center", background: N, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: `linear-gradient(${N4}15 1px, transparent 1px), linear-gradient(to right, ${N4}15 1px, transparent 1px)`, backgroundSize: "72px 72px", opacity: 0.45 }} />
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${G}, transparent)` }} />
        <ParallaxOrb top="5%"  left="58%" size={800} delay={0}  />
        <ParallaxOrb top="55%" left="-8%" size={500} delay={18} />
        <ParallaxOrb top="75%" left="78%" size={320} delay={8}  />
        <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse 80% 80% at 50% 50%, transparent 30%, ${N} 100%)`, pointerEvents: "none" }} />

        <div className="max-w-5xl mx-auto px-6 relative w-full" style={{ paddingTop: 160, paddingBottom: 120 }}>

          {/* Badge */}
          <Reveal direction="none">
            <div className="inline-flex items-center gap-2 mb-8" style={{ background: `${G}12`, border: `1px solid ${G}30`, borderRadius: 40, padding: "6px 18px" }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: G }} />
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2.5, color: G }}>LICENCIAMENTO V3 PARTNERS</span>
            </div>
          </Reveal>

          {/* Headline */}
          <Reveal direction="up" delay={80}>
            <h1 style={{ fontSize: "clamp(38px, 7vw, 82px)", fontWeight: 900, lineHeight: 1.02, color: CR, letterSpacing: -1.5, marginBottom: 0, maxWidth: 900 }}>
              Enquanto você lê isso, um consultor está
            </h1>
          </Reveal>
          <Reveal direction="up" delay={160}>
            <h1 style={{
              fontSize: "clamp(38px, 7vw, 82px)", fontWeight: 900, lineHeight: 1.02, letterSpacing: -1.5, marginBottom: 32,
              background: `linear-gradient(125deg, ${G} 0%, ${G2} 55%, ${G} 100%)`,
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
            }}>
              embolsando R$400 mil em comissão.
            </h1>
          </Reveal>

          <Reveal direction="up" delay={240}>
            <p style={{ fontSize: "clamp(16px, 1.8vw, 20px)", color: MT, lineHeight: 1.8, maxWidth: 660, marginBottom: 14 }}>
              No V3 Partner Program, um único negócio fechado pode render até <strong style={{ color: CR }}>R$400.000 em comissão</strong> — com até 50% do resultado de cada operação indo direto para você.
            </p>
            <p style={{ fontSize: "clamp(15px, 1.6vw, 17px)", color: `${CR}90`, lineHeight: 1.75, maxWidth: 660, marginBottom: 52, fontStyle: "italic" }}>
              Enquanto isso, a maioria dos consultores ainda opera com 0,5% a 2% em produtos convencionais. Essa diferença é o nosso programa.
            </p>
          </Reveal>

          <Reveal direction="up" delay={320}>
            <div className="flex flex-wrap gap-4">
              <CTABtn onClick={() => go("form")} large>Quero garantir minha vaga</CTABtn>
              <CTABtn onClick={() => go("como")} outline large>Ver como funciona</CTABtn>
            </div>
          </Reveal>

          {/* Credibility numbers */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-20">
            {[
              { n: 50, suf: "%",  pre: "até ", label: "de comissão por operação" },
              { n: 4,  suf: "",              label: "verticais de alto ticket" },
              { n: 400, suf: "K+", pre: "R$", label: "por operação possível" },
              { n: 10,  suf: "+",            label: "módulos na plataforma" },
            ].map(({ n, suf, label, pre = "" }, i) => (
              <Reveal key={label} delay={420 + i * 70}>
                <div className="rounded-2xl p-6 text-center" style={{ background: "rgba(17,31,53,0.75)", border: `1px solid ${N4}`, backdropFilter: "blur(16px)" }}>
                  <p style={{ fontSize: "clamp(24px, 3.5vw, 36px)", fontWeight: 900, color: G, lineHeight: 1 }}>
                    {pre}<Counter to={n} suffix={suf} />
                  </p>
                  <p style={{ fontSize: 11, color: MT, marginTop: 6, lineHeight: 1.4 }}>{label}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          02 · CREDIBILITY BAR
      ═══════════════════════════════════════════════════════════════ */}
      <div style={{ background: N2, borderTop: `1px solid ${N4}`, borderBottom: `1px solid ${N4}`, padding: "20px 0" }}>
        <div className="max-w-5xl mx-auto px-6">
          <div className="flex flex-wrap items-center justify-center gap-8 md:gap-16">
            {[
              { icon: "🏛️", text: "Boutique institucional multiproduto" },
              { icon: "⚡", text: "Infraestrutura Bloxs S.A." },
              { icon: "🔒", text: "KYC, Compliance e RLS" },
              { icon: "🤖", text: "IA FORJA proprietária" },
              { icon: "📜", text: "CNPJ 14.219.287/0001-50" },
            ].map(({ icon, text }) => (
              <div key={text} className="flex items-center gap-2.5">
                <span style={{ fontSize: 16 }}>{icon}</span>
                <span style={{ fontSize: 11, color: MT, fontWeight: 500 }}>{text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          03 · DOR — Você se identifica?
      ═══════════════════════════════════════════════════════════════ */}
      <section style={{ background: N, padding: "110px 0", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, ${G}30, transparent)` }} />
        <div className="max-w-5xl mx-auto px-6">
          <SectionLabel>A realidade de quem está de fora</SectionLabel>
          <Reveal>
            <h2 style={{ fontSize: "clamp(22px, 3.5vw, 44px)", fontWeight: 800, color: CR, lineHeight: 1.25, marginBottom: 14, maxWidth: 780 }}>
              Você está no mercado financeiro — mas está sendo pago como deveria?
            </h2>
          </Reveal>
          <Reveal delay={100}>
            <p style={{ fontSize: 16, color: MT, lineHeight: 1.85, maxWidth: 680, marginBottom: 56 }}>
              A maioria dos profissionais de finanças opera com produtos limitados, comissões mínimas e sem acesso à mesa institucional. O resultado: clientes de alto padrão fecham com boutiques que você nunca vai conseguir concorrer — até agora.
            </p>
          </Reveal>
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4">
            <PainCard delay={0}   icon="😤" title="Clientes pedem o que você não tem"       body="Empresas precisam de crédito estruturado, M&A, FIDC — e você não tem onde encaminhar. Perde o negócio." />
            <PainCard delay={80}  icon="💸" title="Comissão de 1% enquanto outros levam 50%" body="Na mesma operação que você ganha R$5.000, um partner institucional embolsa R$200.000. A diferença é o produto." />
            <PainCard delay={160} icon="🏗️" title="Sem estrutura para fechar o grande"       body="Operação de R$5M exige análise, compliance, jurídico, IA. Sem infraestrutura, a oportunidade vai embora." />
            <PainCard delay={240} icon="📉" title="Sem credencial institucional"              body="Grandes empresas e investidores exigem boutique com track record. Você tem o relacionamento — falta o endosso." />
          </div>
          <Reveal delay={300}>
            <div className="rounded-2xl p-8 mt-12" style={{ background: `${G}0A`, border: `1px solid ${G}25` }}>
              <p style={{ fontSize: "clamp(17px, 2.2vw, 22px)", fontWeight: 700, color: CR, lineHeight: 1.55, margin: 0 }}>
                Esse problema tem solução. E ela não exige que você mude de carreira —{" "}
                <span style={{ color: G }}>só que você mude a prateleira de produtos que oferece.</span>
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          04 · SOLUÇÃO — O que é o programa
      ═══════════════════════════════════════════════════════════════ */}
      <section style={{ background: N2, padding: "110px 0", position: "relative" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, ${G}40, transparent)` }} />
        <div className="max-w-5xl mx-auto px-6">
          <SectionLabel>A solução</SectionLabel>
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div>
              <Reveal direction="left">
                <h2 style={{ fontSize: "clamp(26px, 4vw, 48px)", fontWeight: 900, color: CR, lineHeight: 1.2, marginBottom: 24 }}>
                  O V3 Partner Program coloca você dentro do mercado institucional.
                </h2>
              </Reveal>
              <Reveal direction="left" delay={100}>
                <p style={{ fontSize: 16, color: MT, lineHeight: 1.9, marginBottom: 20 }}>
                  A V3 Partners é uma boutique financeira institucional especializada em crédito estruturado, M&A, securitização e real estate. Você traz o relacionamento. Nós trazemos a estrutura, o compliance, a tecnologia e o endosso institucional.
                </p>
              </Reveal>
              <Reveal direction="left" delay={180}>
                <p style={{ fontSize: 16, color: MT, lineHeight: 1.9, marginBottom: 40 }}>
                  Com infraestrutura <strong style={{ color: CR }}>Bloxs S.A.</strong> para tokenização, KYC e liquidação OTC/cripto 24/7, você opera no mesmo nível das maiores boutiques do país — com o seu nome na frente.
                </p>
              </Reveal>
              <Reveal delay={240}>
                <CTABtn onClick={() => go("form")}>Quero fazer parte</CTABtn>
              </Reveal>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                ["🏛️", "Crédito Estruturado",   "CGI, FIDC, CRI, Home Equity"],
                ["📈", "M&A & Deal Rooms",       "IA FORJA, Teaser, CIM"],
                ["🌐", "Cross-Border 24/7",      "OTC, cripto, liquidação"],
                ["🏗️", "Real Estate",            "SLB, BTS, BTR, Fundos"],
                ["🤖", "7 Squads de IA",         "especializados por vertical"],
                ["⚖️", "Compliance & KYC",       "trilha, risco, auditoria"],
              ].map(([icon, t, d], i) => (
                <Reveal key={t} delay={i * 65}>
                  <div className="rounded-xl p-5 h-full" style={{ background: N3, border: `1px solid ${N4}` }}>
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
          05 · COMO FUNCIONA — 4 passos simples
      ═══════════════════════════════════════════════════════════════ */}
      <section id="como" style={{ background: N, padding: "110px 0", position: "relative" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, ${G}30, transparent)` }} />
        <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse 55% 55% at 50% 50%, ${G}06 0%, transparent 70%)`, pointerEvents: "none" }} />
        <div className="max-w-5xl mx-auto px-6 relative">
          <SectionLabel>Como funciona</SectionLabel>
          <Reveal>
            <h2 style={{ fontSize: "clamp(22px, 3.2vw, 38px)", fontWeight: 800, color: CR, lineHeight: 1.3, marginBottom: 56, maxWidth: 680 }}>
              Quatro passos. Do zero à primeira comissão.
            </h2>
          </Reveal>
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-5 mb-14">
            <StepCard delay={0}   n="01" title="Licencie-se"  body="Escolha seu plano, assine o contrato digitalmente e receba acesso à plataforma em até 24h." />
            <StepCard delay={90}  n="02" title="Capacite-se"  body="Complete o onboarding no Academy V3. Treinamentos, materiais e reuniões semanais com a mesa." />
            <StepCard delay={180} n="03" title="Origine"      body="Traga clientes. A V3 analisa, estrutura, conduz o compliance e fecha a operação com qualidade institucional." />
            <StepCard delay={270} n="04" title="Receba"       body="Sua comissão é rastreada em tempo real na plataforma e paga após a liquidação da operação." />
          </div>
          <Reveal delay={320}>
            <CTABtn onClick={() => go("form")}>Começar agora</CTABtn>
          </Reveal>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          06 · COMPARAÇÃO — V3 vs mercado convencional
      ═══════════════════════════════════════════════════════════════ */}
      <section style={{ background: N2, padding: "110px 0", position: "relative" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, ${G}40, transparent)` }} />
        <div className="max-w-5xl mx-auto px-6">
          <SectionLabel>Por que o V3 Partner Program é diferente</SectionLabel>
          <Reveal>
            <h2 style={{ fontSize: "clamp(22px, 3.2vw, 38px)", fontWeight: 800, color: CR, lineHeight: 1.3, marginBottom: 48, maxWidth: 680 }}>
              A diferença entre ganhar 1% e ganhar 50% é o produto que você carrega.
            </h2>
          </Reveal>

          {/* Comparison table */}
          <div className="rounded-2xl overflow-hidden mb-14" style={{ border: `1px solid ${N4}` }}>
            {/* Header */}
            <div className="grid grid-cols-3 gap-2 px-6 py-4" style={{ background: N3, borderBottom: `1px solid ${N4}` }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: MT, letterSpacing: 2 }}></p>
              <div className="text-center rounded-lg py-2" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: "#EF4444", letterSpacing: 1.5 }}>MERCADO CONVENCIONAL</p>
              </div>
              <div className="text-center rounded-lg py-2" style={{ background: `${G}10`, border: `1px solid ${G}35` }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: G, letterSpacing: 1.5 }}>V3 PARTNER</p>
              </div>
            </div>
            <div className="px-6">
              <CompareRow delay={0}   label="Comissão média"        bad="0,5% a 2%"              good="30% a 50%" />
              <CompareRow delay={60}  label="Ticket mínimo"         bad="R$5K a R$50K"           good="R$200.000+" />
              <CompareRow delay={120} label="Portfólio"             bad="CDB, seguros, fundos"   good="Crédito estruturado, M&A, FIDC" />
              <CompareRow delay={180} label="Suporte operacional"   bad="Nenhum"                 good="Mesa institucional dedicada" />
              <CompareRow delay={240} label="Tecnologia"            bad="Planilha ou CRM básico" good="SaaS próprio + 7 squads de IA" />
              <CompareRow delay={300} label="Credencial"            bad="Produto commodity"      good="Boutique institucional" />
              <CompareRow delay={360} label="Potencial por deal"    bad="R$500 a R$5.000"        good="R$10.000 a R$400.000+" />
            </div>
          </div>

          <Reveal delay={380}>
            <CTABtn onClick={() => go("form")}>Quero operar no nível institucional</CTABtn>
          </Reveal>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          07 · SOLUÇÕES — O que você distribui
      ═══════════════════════════════════════════════════════════════ */}
      <section id="solucoes" style={{ background: N, padding: "110px 0", position: "relative" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, ${G}30, transparent)` }} />
        <div className="max-w-5xl mx-auto px-6">
          <SectionLabel>Portfólio completo de soluções</SectionLabel>
          <Reveal>
            <h2 style={{ fontSize: "clamp(22px, 3.2vw, 38px)", fontWeight: 800, color: CR, lineHeight: 1.3, marginBottom: 16, maxWidth: 700 }}>
              Você vende o que as empresas realmente precisam.
            </h2>
          </Reveal>
          <Reveal delay={80}>
            <p style={{ fontSize: 16, color: MT, lineHeight: 1.8, maxWidth: 660, marginBottom: 52 }}>
              Produtos que os bancos de varejo não oferecem. Soluções que empresários pagam bem para ter acesso. Operações que mudam o tamanho do resultado de quem os origina.
            </p>
          </Reveal>
          <div className="grid md:grid-cols-2 gap-x-16">
            <div style={{ borderTop: `1px solid ${N4}` }}>
              <SolucaoCard delay={0}   titulo="Crédito com Garantia Imobiliária"   desc="Capital de giro, alavancagem patrimonial e aquisições com garantia real. Ticket médio R$800K a R$5M." tags="Home Equity · CGI PJ · CRI · Giro Equity · Financiamentos" />
              <SolucaoCard delay={60}  titulo="Securitização de Recebíveis"         desc="Transforme ativos futuros em capital imediato. Estruturas ágeis para empresas com recebíveis recorrentes." tags="FIDC · CRI · Precatórios · Cessão de Crédito · Notas Comerciais" />
              <SolucaoCard delay={120} titulo="M&A — Fusões e Aquisições"           desc="Compra, venda e fusão de empresas com análise estratégica via IA proprietária FORJA. Deals a partir de R$2M." tags="Valuation · NDA · Teaser Cego · CIM · Deal Rooms · Matching IA" />
              <SolucaoCard delay={180} titulo="Crédito Corporativo Estruturado"     desc="Soluções completas para fortalecer caixa, adquirir ativos e escalar empresas em crescimento acelerado." tags="Capital de Giro · Leasing · Consórcio Prime · Cash Collateral" />
              <SolucaoCard delay={240} titulo="Crédito Agro"                        desc="Soluções financeiras para produtores rurais e agroindústrias com volumes de R$300K a R$20M." tags="CPR · Fundo Agro · Sale & Leaseback · Maquinários · Custeio" />
            </div>
            <div style={{ borderTop: `1px solid ${N4}` }}>
              <SolucaoCard delay={0}   titulo="Real Estate Estruturado"             desc="Financiamento e estruturação para projetos imobiliários de alto padrão com retorno acima do mercado." tags="SLB · BTS · BTR · Fundos Imobiliários · Incorporação" />
              <SolucaoCard delay={60}  titulo="Operações Internacionais"            desc="Capital global e estruturas cross-border com liquidação OTC e cripto 24/7 via Bloxs S.A." tags="ACC · ACE · Câmbio · Cross-Border OTC · Cripto 24/7" />
              <SolucaoCard delay={120} titulo="Mineração & Commodities"             desc="Soluções para produtores e traders de metais preciosos e commodities com estrutura internacional." tags="Ouro · Lítio · Metais Preciosos · Financiamento de Projetos" />
              <SolucaoCard delay={180} titulo="Split Fiscal Inteligente"            desc="Eficiência tributária que maximiza a margem líquida sem mudar a operação da empresa." tags="Split de Pagamentos · Conta Técnica · Compliance Tributário" />
              <SolucaoCard delay={240} titulo="Operações Distressed"                desc="Alternativas reais para empresas com restrição. Onde o mercado fecha a porta, a V3 abre uma janela." tags="Fundo Estressado · Home Equity Distressed · Recebíveis Restritivos" />
            </div>
          </div>
          <Reveal delay={280}>
            <div className="mt-14">
              <CTABtn onClick={() => go("form")}>Quero distribuir essas soluções</CTABtn>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          08 · QUEM PODE SER
      ═══════════════════════════════════════════════════════════════ */}
      <section style={{ background: N2, padding: "110px 0", position: "relative" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, ${G}30, transparent)` }} />
        <div className="max-w-5xl mx-auto px-6">
          <SectionLabel>Este programa é para você se...</SectionLabel>
          <div className="grid md:grid-cols-2 gap-x-16">
            <div style={{ borderTop: `1px solid ${N4}` }}>
              {[
                ["💼", "Você quer entrar no mercado financeiro com estrutura real", "não com um curso e uma planilha — mas com mesa, produto, compliance e tecnologia de boutique."],
                ["📊", "Você já tem network de empresários e executivos", "e sabe que eles precisam de crédito, capital e estruturação que o banco não entrega."],
                ["💰", "Você quer comissões proporcionais ao seu esforço", "e está cansado de trabalhar duro por 1% em operações que valem milhões."],
                ["🏦", "Você é contador, gestor financeiro ou CFO", "e tem acesso direto à realidade financeira das empresas — e quer monetizar isso."],
              ].map(([icon, bold, rest], i) => (
                <Reveal key={bold} delay={i * 60}>
                  <div className="flex items-start gap-4 py-5" style={{ borderBottom: `1px solid ${N4}` }}>
                    <div className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-lg"
                      style={{ background: `${G}12`, border: `1px solid ${G}20` }}>{icon}</div>
                    <p style={{ fontSize: 14, color: MT, lineHeight: 1.8 }}>
                      <strong style={{ color: CR }}>{bold}</strong> {rest}
                    </p>
                  </div>
                </Reveal>
              ))}
            </div>
            <div style={{ borderTop: `1px solid ${N4}` }}>
              {[
                ["⚖️", "Você é advogado empresarial, societário ou tributário", "e lida com fusões, aquisições e reestruturações que envolvem capital e operações financeiras."],
                ["🏛️", "Você é correspondente bancário ou consultor de crédito", "e quer liberdade operacional, produtos mais inteligentes e comissões superiores."],
                ["🏗️", "Você é corretor de imóveis comerciais ou de alto padrão", "e seus clientes são empresários que precisam de estruturação, não só de financiamento."],
                ["🚀", "Você quer empreender no mercado financeiro", "sem abrir uma corretora do zero — usando a estrutura, a marca e a credencial da V3 como base."],
              ].map(([icon, bold, rest], i) => (
                <Reveal key={bold} delay={i * 60}>
                  <div className="flex items-start gap-4 py-5" style={{ borderBottom: `1px solid ${N4}` }}>
                    <div className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-lg"
                      style={{ background: `${G}12`, border: `1px solid ${G}20` }}>{icon}</div>
                    <p style={{ fontSize: 14, color: MT, lineHeight: 1.8 }}>
                      <strong style={{ color: CR }}>{bold}</strong> {rest}
                    </p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
          <Reveal delay={180}>
            <div className="rounded-2xl px-8 py-7 mt-12 mb-10" style={{ background: `${G}0C`, border: `1px solid ${G}25` }}>
              <p style={{ fontSize: "clamp(16px, 2vw, 20px)", color: CR, fontWeight: 700, lineHeight: 1.6, margin: 0 }}>
                A principal qualificação não é diploma ou experiência prévia.{" "}
                <span style={{ color: G }}>É a disposição de trazer negócios à mesa.</span>{" "}
                O resto a V3 ensina.
              </p>
            </div>
          </Reveal>
          <Reveal delay={220}>
            <CTABtn onClick={() => go("form")}>Esse sou eu — quero solicitar minha vaga</CTABtn>
          </Reveal>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          09 · PLANOS
      ═══════════════════════════════════════════════════════════════ */}
      <section id="planos" style={{ background: N, padding: "110px 0", position: "relative" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, ${G}40, transparent)` }} />
        <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse 60% 50% at 50% 50%, ${G}06 0%, transparent 70%)`, pointerEvents: "none" }} />
        <div className="max-w-5xl mx-auto px-6 relative">
          <SectionLabel>Modelos de licenciamento</SectionLabel>
          <Reveal>
            <h2 style={{ fontSize: "clamp(22px, 3.2vw, 38px)", fontWeight: 800, color: CR, lineHeight: 1.3, marginBottom: 16, maxWidth: 700 }}>
              Escolha o nível de operação que faz sentido para você agora.
            </h2>
          </Reveal>
          <Reveal delay={80}>
            <p style={{ fontSize: 16, color: MT, lineHeight: 1.8, maxWidth: 620, marginBottom: 52 }}>
              Você não precisa começar no topo. Mas precisa começar. Todo Partner pode evoluir de plano à medida que escala seus resultados.
            </p>
          </Reveal>

          <div className="grid md:grid-cols-3 gap-5 mb-14">
            {[
              {
                titulo: "V3 Partner Entry",
                comissao: "30%",
                badge: null,
                desc: "Para quem quer ativar rápido. Crédito N1 e N2, CRM, IA integrada e Academy base. A porta de entrada para o mercado institucional.",
                items: ["Crédito N1 e N2", "CRM + IA integrada", "Academy base", "Chat com a mesa", "Suporte semanal"],
                d: 0,
              },
              {
                titulo: "V3 Partner",
                comissao: "30%",
                badge: "Mais escolhido",
                desc: "Estrutura completa para operar com amplitude. Crédito N3, consórcio corporativo, relatórios e mesa de crédito completa.",
                items: ["Crédito N1, N2 e N3", "Mesa de crédito completa", "Relatórios e KPIs", "Consórcio corporativo", "Academy completo"],
                d: 100,
              },
              {
                titulo: "V3 Partner PRO",
                comissao: "50%",
                badge: null,
                desc: "Máxima rentabilidade e máxima credencial. M&A, Deal Rooms, co-branding e a maior comissão do mercado.",
                items: ["Tudo do Partner +", "Mesa M&A dedicada", "Deal Rooms e VDR", "Co-branding V3", "Academy M&A avançado"],
                d: 200,
              },
            ].map(({ titulo, comissao, badge, desc, items, d }) => (
              <Reveal key={titulo} delay={d}>
                <div className="rounded-xl flex flex-col gap-4 h-full overflow-hidden" style={{
                  background: badge ? `${G}0F` : N2,
                  border: `1px solid ${badge ? G + "55" : N4}`,
                  position: "relative",
                }}>
                  {badge && <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${G}, ${G2})` }} />}
                  <div className="p-7 flex flex-col gap-4 flex-1">
                    {badge && (
                      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, color: G, background: `${G}20`, border: `1px solid ${G}40`, padding: "4px 10px", borderRadius: 20, display: "inline-block", alignSelf: "flex-start" }}>{badge}</div>
                    )}
                    <div>
                      <h3 style={{ fontWeight: 900, fontSize: 17, color: badge ? G : CR, marginBottom: 6 }}>{titulo}</h3>
                      <div className="flex items-baseline gap-1.5">
                        <span style={{ fontSize: "clamp(28px, 3.5vw, 40px)", fontWeight: 900, color: G, lineHeight: 1 }}>{comissao}</span>
                        <span style={{ fontSize: 13, color: MT }}>de comissão por operação</span>
                      </div>
                    </div>
                    <p style={{ fontSize: 13, color: MT, lineHeight: 1.75 }}>{desc}</p>
                    <div className="space-y-2.5 pt-4 flex-1" style={{ borderTop: `1px solid ${N4}` }}>
                      {items.map(it => (
                        <div key={it} className="flex items-center gap-2.5">
                          <div className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: `${G}20`, border: `1px solid ${G}40` }}>
                            <Check size={9} color={G} />
                          </div>
                          <p style={{ fontSize: 12, color: MT }}>{it}</p>
                        </div>
                      ))}
                    </div>
                    <button onClick={() => go("form")} className="mt-4 w-full py-3.5 rounded-lg font-bold text-xs transition-all hover:opacity-85"
                      style={{ background: badge ? G : "transparent", color: badge ? N : G, border: `1px solid ${G}`, letterSpacing: 1.5, textTransform: "uppercase" }}>
                      Solicitar acesso
                    </button>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>

          {/* Scarcity note */}
          <Reveal delay={320}>
            <div className="rounded-xl p-6 flex items-start gap-4" style={{ background: N2, border: `1px solid ${N4}` }}>
              <div style={{ fontSize: 20, flexShrink: 0 }}>⚠️</div>
              <div>
                <p style={{ fontWeight: 700, fontSize: 13, color: CR, marginBottom: 4 }}>Vagas limitadas por região</p>
                <p style={{ fontSize: 13, color: MT, lineHeight: 1.7 }}>
                  O programa de licenciamento V3 é seletivo. Aceitamos um número controlado de Partners por praça para garantir exclusividade de território, qualidade no atendimento e resultado efetivo para todos os licenciados.
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          10 · SOBRE + NUMBERS
      ═══════════════════════════════════════════════════════════════ */}
      <section style={{ background: N2, padding: "110px 0", position: "relative" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, ${G}30, transparent)` }} />
        <div className="max-w-5xl mx-auto px-6">
          <SectionLabel>Quem está atrás da estrutura</SectionLabel>
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div>
              <Reveal direction="left">
                <h2 style={{ fontSize: "clamp(22px, 3.2vw, 38px)", fontWeight: 800, color: CR, lineHeight: 1.3, marginBottom: 24 }}>
                  Uma boutique construída para fazer você ganhar.
                </h2>
              </Reveal>
              <Reveal direction="left" delay={100}>
                <p style={{ fontSize: 15, color: MT, lineHeight: 1.9, marginBottom: 20 }}>
                  A V3 Partners nasceu da união de <strong style={{ color: CR }}>Hamilton Santos</strong> (finanças e cross-border), <strong style={{ color: CR }}>João Lemos Netto</strong> (originação e ativos) e <strong style={{ color: CR }}>Robson Lino</strong> (compliance e operações) — três especialistas que entenderam que o mercado precisava de uma boutique que trabalhasse para o partner, não contra ele.
                </p>
              </Reveal>
              <Reveal direction="left" delay={160}>
                <p style={{ fontSize: 15, color: MT, lineHeight: 1.9, marginBottom: 20 }}>
                  Operamos com infraestrutura <strong style={{ color: CR }}>Bloxs S.A.</strong> — a mesma base tecnológica de tokenização, KYC e liquidação OTC/cripto 24/7 usada pelas maiores fintechs institucionais do país.
                </p>
              </Reveal>
              <Reveal direction="left" delay={220}>
                <p style={{ fontSize: 15, color: MT, lineHeight: 1.9 }}>
                  Nossa missão é simples:{" "}
                  <strong style={{ color: G }}>transformar profissionais com relacionamento em protagonistas do mercado financeiro institucional.</strong>
                </p>
              </Reveal>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { n: 3,  suf: "",   label: "sócios especialistas",  desc: "finanças · originação · compliance" },
                { n: 7,  suf: "",   label: "squads de IA",          desc: "especializados por vertical" },
                { n: 10, suf: "+",  label: "módulos na plataforma", desc: "do CRM ao M&A" },
                { n: 50, suf: "%",  label: "comissão máxima",       desc: "Partner PRO" },
              ].map(({ n, suf, label, desc }, i) => (
                <Reveal key={label} delay={i * 75}>
                  <div className="rounded-2xl p-6 text-center" style={{ background: N3, border: `1px solid ${N4}` }}>
                    <p style={{ fontSize: "clamp(28px, 3vw, 38px)", fontWeight: 900, color: G, lineHeight: 1 }}>
                      <Counter to={n} suffix={suf} />
                    </p>
                    <p style={{ fontSize: 12, color: CR, fontWeight: 600, marginTop: 8 }}>{label}</p>
                    <p style={{ fontSize: 10, color: MT, marginTop: 3 }}>{desc}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          11 · QUOTE — Aspiracional
      ═══════════════════════════════════════════════════════════════ */}
      <section style={{ background: N, padding: "100px 0", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, ${G}30, transparent)` }} />
        <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse 60% 60% at 50% 50%, ${G}07 0%, transparent 70%)`, pointerEvents: "none" }} />
        <div className="max-w-4xl mx-auto px-6 text-center relative">
          <Reveal>
            <div style={{ fontSize: 56, color: `${G}40`, lineHeight: 1, marginBottom: 24, fontFamily: "Georgia, serif" }}>"</div>
            <p style={{ fontSize: "clamp(20px, 3vw, 34px)", fontWeight: 800, color: CR, lineHeight: 1.4, marginBottom: 24 }}>
              O mercado financeiro institucional sempre existiu. O que mudou é que agora você pode entrar nele sem ser um banco.
            </p>
            <div style={{ width: 48, height: 2, background: G, margin: "0 auto 24px" }} />
            <p style={{ fontSize: 13, color: MT, fontWeight: 600, letterSpacing: 1.5 }}>V3 PARTNERS · BOUTIQUE INSTITUCIONAL</p>
          </Reveal>
          <Reveal delay={150}>
            <div className="mt-14">
              <CTABtn onClick={() => go("form")} large>Quero entrar nesse mercado</CTABtn>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          12 · FAQ — Objeções respondidas
      ═══════════════════════════════════════════════════════════════ */}
      <section id="faq" style={{ background: N2, padding: "110px 0", position: "relative" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, ${G}30, transparent)` }} />
        <div className="max-w-5xl mx-auto px-6">
          <SectionLabel>Perguntas frequentes</SectionLabel>
          <div className="grid md:grid-cols-2 gap-16 items-start">
            <div>
              <Reveal>
                <h2 style={{ fontSize: "clamp(22px, 3.2vw, 36px)", fontWeight: 800, color: CR, lineHeight: 1.3, marginBottom: 20 }}>
                  Tudo que você quer saber antes de decidir.
                </h2>
              </Reveal>
              <Reveal delay={80}>
                <p style={{ fontSize: 15, color: MT, lineHeight: 1.85, marginBottom: 36 }}>
                  Respondemos aqui as dúvidas mais comuns. Se tiver alguma que não está na lista, nossa equipe responde em até 24h úteis após você preencher o formulário.
                </p>
              </Reveal>
              <Reveal delay={140}>
                <CTABtn onClick={() => go("form")}>Falar com a equipe</CTABtn>
              </Reveal>
            </div>
            <Reveal direction="right">
              <div style={{ borderTop: `1px solid ${N4}` }}>
                {[
                  { q: "Preciso de experiência no mercado financeiro para ser Partner?", a: "Não. A principal qualificação é a disposição de trazer negócios à mesa. A V3 oferece toda a capacitação técnica pelo Academy, com suporte prático da mesa operacional desde o primeiro dia." },
                  { q: "Qual é o potencial real de ganho como Partner?", a: "Depende do volume que você origina. Um partner ativo que fecha 2-3 operações por mês em crédito estruturado pode gerar R$30K a R$120K mensais. Em M&A, uma operação acima de R$10M pode gerar R$200K a R$400K em comissão única." },
                  { q: "Quanto tempo até receber a primeira comissão?", a: "Em crédito estruturado, o ciclo médio é de 30 a 90 dias. Em split fiscal e antecipação de recebíveis, pode ser mais rápido. Em M&A, de 3 a 12 meses. A plataforma rastreia o status de cada operação em tempo real." },
                  { q: "Posso manter minha profissão atual enquanto sou Partner?", a: "Sim. A parceria V3 é não exclusiva. Você pode manter todas as suas atividades profissionais. A plataforma foi desenhada para uso assíncrono — você opera no seu ritmo, no seu horário." },
                  { q: "Como funciona o processo de licenciamento?", a: "Você preenche o formulário nesta página. Nossa equipe entra em contato em até 24h úteis. Após alinhamento, você assina o contrato digitalmente e recebe acesso à plataforma em até 24h." },
                  { q: "Qual a diferença entre Partner e Partner PRO?", a: "Além da comissão maior (50% vs 30%), o PRO tem acesso ao crédito N3 (acima de R$5M), Mesa M&A dedicada, co-branding V3, Deal Rooms com VDR e Academy M&A avançado." },
                  { q: "A V3 me apoia nas negociações com os clientes?", a: "Sim. A mesa operacional da V3 acompanha cada operação. Você origina o cliente, participa das reuniões estratégicas e conta com o respaldo institucional da V3 em todas as etapas." },
                  { q: "Como são calculadas e pagas as comissões?", a: "Sua comissão é rastreada em tempo real na plataforma, por operação e por status. O pagamento é feito após a liquidação de cada operação, de forma transparente e auditável." },
                ].map(({ q, a }, i) => <FAQItem key={q} n={i + 1} q={q} a={a} />)}
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          13 · CTA FINAL — Urgência + fechamento
      ═══════════════════════════════════════════════════════════════ */}
      <section style={{ background: N, padding: "110px 0", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${G}, transparent)` }} />
        <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse 70% 70% at 50% 50%, ${G}08 0%, transparent 70%)`, pointerEvents: "none" }} />
        <ParallaxOrb top="0%"  left="10%"  size={600} delay={0} />
        <ParallaxOrb top="20%" left="75%"  size={400} delay={12} />
        <div className="max-w-3xl mx-auto px-6 text-center relative">
          <Reveal>
            <div className="inline-flex items-center gap-2 mb-8" style={{ background: `${G}12`, border: `1px solid ${G}30`, borderRadius: 40, padding: "6px 18px" }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: G, animation: "pulse 1.5s infinite" }} />
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2.5, color: G }}>VAGAS ABERTAS EM SELEÇÃO</span>
            </div>
          </Reveal>
          <Reveal delay={80}>
            <h2 style={{ fontSize: "clamp(28px, 5vw, 58px)", fontWeight: 900, color: CR, lineHeight: 1.1, marginBottom: 20, letterSpacing: -1 }}>
              A cadeira está disponível.
              <br />
              <span style={{ color: G }}>Por quanto tempo, não sabemos.</span>
            </h2>
          </Reveal>
          <Reveal delay={160}>
            <p style={{ fontSize: "clamp(15px, 1.8vw, 18px)", color: MT, lineHeight: 1.85, marginBottom: 44 }}>
              Toda semana, Partners V3 fecham operações que transformam seus resultados. O mercado não espera. As vagas na sua região são limitadas. O melhor momento para entrar foi ontem. O segundo melhor é agora.
            </p>
          </Reveal>
          <Reveal delay={240}>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <CTABtn onClick={() => go("form")} large>Garantir minha vaga agora</CTABtn>
            </div>
          </Reveal>
          <Reveal delay={300}>
            <p style={{ fontSize: 12, color: `${MT}80`, marginTop: 20 }}>
              Sem compromisso. Nossa equipe entra em contato em até 24h úteis.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          14 · FORMULÁRIO
      ═══════════════════════════════════════════════════════════════ */}
      <section id="form" style={{ background: N2, padding: "110px 0", position: "relative" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${G}, transparent)` }} />
        <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse 50% 60% at 50% 0%, ${G}08 0%, transparent 70%)`, pointerEvents: "none" }} />
        <div className="max-w-2xl mx-auto px-6 relative">
          <SectionLabel>Solicitar licenciamento</SectionLabel>

          {sent ? (
            <Reveal>
              <div className="rounded-2xl p-14 text-center" style={{ background: N3, border: `1px solid ${G}40` }}>
                <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6" style={{ background: `${G}15`, border: `1px solid ${G}35` }}>
                  <Check size={32} color={G} />
                </div>
                <h3 style={{ fontWeight: 900, fontSize: 26, color: CR, marginBottom: 14 }}>Solicitação recebida!</h3>
                <p style={{ color: MT, fontSize: 15, lineHeight: 1.85 }}>
                  Obrigado, <strong style={{ color: CR }}>{formData.nome}</strong>!{" "}
                  Nossa equipe de Novos Negócios vai entrar em contato pelo e-mail{" "}
                  <strong style={{ color: G }}>{formData.email}</strong> em até 24 horas úteis.
                </p>
              </div>
            </Reveal>
          ) : (
            <>
              <Reveal>
                <h2 style={{ fontSize: "clamp(22px, 3.2vw, 36px)", fontWeight: 800, color: CR, lineHeight: 1.3, marginBottom: 14 }}>
                  Preencha abaixo e nossa equipe entra em contato.
                </h2>
              </Reveal>
              <Reveal delay={80}>
                <p style={{ fontSize: 15, color: MT, lineHeight: 1.8, marginBottom: 40 }}>
                  Não é venda online. É um processo seletivo. Vamos entender seu perfil, apresentar o programa completo e alinhar expectativas antes de qualquer decisão.
                </p>
              </Reveal>
              <Reveal direction="up" delay={120}>
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
                      <label style={{ fontSize: 10, fontWeight: 700, color: MT, letterSpacing: 2, display: "block", marginBottom: 8 }}>WHATSAPP *</label>
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
                      placeholder="Ex: Consultor financeiro, Advogado, Corretor, Contador..."
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
                          style={{ background: formData.plano === val ? `${G}18` : N3, border: `1px solid ${formData.plano === val ? G + "70" : N4}`, borderRadius: 4 }}>
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
                    className="w-full py-5 font-bold transition-all hover:opacity-88 mt-2"
                    style={{ background: G, color: N, borderRadius: 4, fontSize: 12, letterSpacing: 2.5, textTransform: "uppercase", opacity: sending ? 0.7 : 1 }}>
                    {sending ? "ENVIANDO..." : "SOLICITAR MINHA VAGA"}
                  </button>
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-6 pt-2">
                    {[
                      [Shield, "Sem spam, jamais"],
                      [Zap, "Retorno em até 24h"],
                      [TrendingUp, "Sem compromisso inicial"],
                    ].map(([Icon, text]) => (
                      <div key={text as string} className="flex items-center gap-2">
                        <Icon size={13} color={G} />
                        <span style={{ fontSize: 11, color: MT }}>{text as string}</span>
                      </div>
                    ))}
                  </div>
                </form>
              </Reveal>
            </>
          )}
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────────────────── */}
      <footer style={{ background: N, borderTop: `1px solid ${N4}` }}>
        <div className="max-w-5xl mx-auto px-6 py-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <Image src="/logo.jpg" alt="V3 Partners" width={30} height={30} className="rounded-lg" />
            <div>
              <p style={{ fontWeight: 900, fontSize: 12, color: G, letterSpacing: 3.5 }}>V3 PARTNERS</p>
              <p style={{ fontSize: 10, color: MT, marginTop: 1 }}>V3 Partners Soluções Ltda · CNPJ 14.219.287/0001-50</p>
            </div>
          </div>
          <p style={{ fontSize: 11, color: `${MT}80` }}>© 2026 V3 Partners · Todos os direitos reservados.</p>
        </div>
      </footer>

    </div>
  );
}
