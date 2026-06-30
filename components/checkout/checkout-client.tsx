"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { Copy, Check, AlertCircle, Loader2, CreditCard, QrCode, FileText } from "lucide-react";

const N = "#09081A", N2 = "#13223A", N3 = "#162744", N4 = "#243A66";
const GO = "#C9A84C", GL = "#E8C97A", CR = "#F5F1E8", MU = "#9BAFC5";

type Step = "form" | "payment" | "success";
type PayMethod = "pix" | "boleto";

interface LinkData {
  title: string;
  service_type: string;
  description: string | null;
  price_cents: number;
  partner_name: string;
}

interface OrderResult {
  order_id: string;
  status: string;
  price_cents: number;
  pix_emv: string | null;
  pix_qr_code: string | null;
  boleto_barcode: string | null;
  boleto_pdf: string | null;
  intake_token: string | null;
  service_type: string;
}

const SERVICE_LABEL: Record<string, string> = {
  credit_analysis: "Análise de Crédito Empresarial",
  ma_intake: "Intake M&A — Venda de Empresa",
  due_diligence: "Due Diligence",
  captacao: "Formulário de Interesse",
};

const INTAKE_PATH: Record<string, string> = {
  credit_analysis: "/intake/cm",
  ma_intake: "/intake/bp",
  due_diligence: "/intake/cm",
  captacao: "/c",
};

function fmt(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

export function CheckoutClient({ token }: { token: string }) {
  const [linkData, setLinkData] = useState<LinkData | null>(null);
  const [linkError, setLinkError] = useState("");
  const [step, setStep] = useState<Step>("form");
  const [payMethod, setPayMethod] = useState<PayMethod>("pix");
  const [form, setForm] = useState({ client_name: "", client_email: "", client_doc: "" });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [order, setOrder] = useState<OrderResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [polling, setPolling] = useState(false);

  // Carrega dados do link
  useEffect(() => {
    fetch(`/api/checkout/${token}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) setLinkError(d.error);
        else setLinkData(d);
      })
      .catch(() => setLinkError("Erro ao carregar o link."));
  }, [token]);

  // Polling de status (Pix)
  const pollStatus = useCallback(async (orderId: string) => {
    if (polling) return;
    setPolling(true);
    const interval = setInterval(async () => {
      try {
        const r = await fetch(`/api/checkout/${token}/status?order_id=${orderId}`);
        const d = await r.json() as { status: string; intake_token: string | null };
        if (d.status === "PAID") {
          clearInterval(interval);
          setOrder(prev => prev ? { ...prev, status: "PAID", intake_token: d.intake_token } : prev);
          setStep("success");
        }
      } catch { /* silent */ }
    }, 5000);
    return () => clearInterval(interval);
  }, [token, polling]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    if (!form.client_name.trim()) { setFormError("Nome obrigatório"); return; }
    if (!form.client_email.trim()) { setFormError("Email obrigatório"); return; }
    if (!form.client_doc.replace(/\D/g, "")) { setFormError("CPF/CNPJ obrigatório"); return; }

    setSubmitting(true);
    try {
      const r = await fetch(`/api/checkout/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, payment_method: payMethod }),
      });
      const d = await r.json() as OrderResult & { error?: string };
      if (d.error) { setFormError(d.error); return; }

      setOrder(d);
      if (d.status === "PAID") {
        setStep("success");
      } else {
        setStep("payment");
        if (payMethod === "pix") pollStatus(d.order_id);
      }
    } catch {
      setFormError("Erro de rede. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  function copyPix() {
    if (!order?.pix_emv) return;
    navigator.clipboard.writeText(order.pix_emv);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const s: Record<string, React.CSSProperties> = {
    page:    { minHeight: "100vh", background: N, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px", fontFamily: "'DM Sans', sans-serif" },
    logo:    { marginBottom: 32, textAlign: "center" as const },
    card:    { background: N2, border: `1px solid ${N4}`, borderRadius: 12, padding: 32, width: "100%", maxWidth: 480 },
    label:   { fontSize: 8, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase" as const, color: GL, marginBottom: 6, display: "block" },
    input:   { width: "100%", background: N3, border: `1px solid ${N4}`, borderRadius: 8, padding: "10px 14px", color: CR, fontSize: 13, outline: "none" },
    btn:     { width: "100%", background: GO, color: N, fontWeight: 700, fontSize: 14, padding: "13px 0", borderRadius: 8, border: "none", cursor: "pointer", marginTop: 20 },
    btnDis:  { width: "100%", background: N4, color: MU, fontWeight: 700, fontSize: 14, padding: "13px 0", borderRadius: 8, border: "none", cursor: "not-allowed", marginTop: 20 },
    tag:     { fontSize: 8, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" as const, color: GL, background: `rgba(201,168,76,0.1)`, border: `1px solid rgba(201,168,76,0.2)`, padding: "3px 10px", borderRadius: 4, display: "inline-block", marginBottom: 12 },
    price:   { fontSize: 32, fontWeight: 800, color: GO, margin: "8px 0" },
    pixBox:  { background: N3, border: `1px solid ${N4}`, borderRadius: 10, padding: 24, textAlign: "center" as const, marginTop: 20 },
    copyBtn: { background: copied ? "#4ade80" : N4, color: CR, fontWeight: 700, fontSize: 12, padding: "10px 20px", borderRadius: 8, border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, margin: "12px auto 0" },
  };

  if (linkError) return (
    <div style={s.page}>
      <div style={{ ...s.card, textAlign: "center" }}>
        <AlertCircle size={40} color="#f87171" style={{ margin: "0 auto 16px" }} />
        <div style={{ color: "#f87171", fontSize: 15, fontWeight: 600 }}>{linkError}</div>
      </div>
    </div>
  );

  if (!linkData) return (
    <div style={s.page}>
      <Loader2 size={32} color={GO} className="animate-spin" />
    </div>
  );

  return (
    <div style={s.page}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />

      <div style={s.logo}>
        <Image src="/v3-logo-flat-gold-alpha.png" alt="V3 Partners" width={100} height={36} style={{ objectFit: "contain" }} />
      </div>

      <div style={s.card}>
        {/* Header do serviço */}
        <div style={s.tag}>{SERVICE_LABEL[linkData.service_type] ?? linkData.service_type}</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: CR, marginBottom: 6 }}>{linkData.title}</div>
        {linkData.description && <div style={{ fontSize: 12, color: MU, lineHeight: 1.7, marginBottom: 12 }}>{linkData.description}</div>}
        <div style={{ fontSize: 11, color: MU, marginBottom: 4 }}>Serviço oferecido via</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: CR, marginBottom: 20 }}>{linkData.partner_name} · V3 Partners</div>

        {linkData.price_cents > 0
          ? <div style={s.price}>{fmt(linkData.price_cents)}</div>
          : <div style={{ ...s.price, color: "#4ade80", fontSize: 22 }}>Gratuito</div>
        }

        <div style={{ height: 1, background: N4, margin: "20px 0" }} />

        {/* STEP: FORM */}
        {step === "form" && (
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 16 }}>
              <label style={s.label}>Nome completo</label>
              <input style={s.input} value={form.client_name} onChange={e => setForm(p => ({ ...p, client_name: e.target.value }))} placeholder="Seu nome" required />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={s.label}>Email</label>
              <input style={s.input} type="email" value={form.client_email} onChange={e => setForm(p => ({ ...p, client_email: e.target.value }))} placeholder="seu@email.com" required />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={s.label}>CPF ou CNPJ</label>
              <input style={s.input} value={form.client_doc} onChange={e => setForm(p => ({ ...p, client_doc: e.target.value }))} placeholder="000.000.000-00 ou 00.000.000/0001-00" required />
            </div>

            {linkData.price_cents > 0 && (
              <div style={{ marginBottom: 8 }}>
                <label style={s.label}>Forma de pagamento</label>
                <div style={{ display: "flex", gap: 10 }}>
                  {(["pix", "boleto"] as PayMethod[]).map(m => (
                    <button key={m} type="button" onClick={() => setPayMethod(m)}
                      style={{ flex: 1, background: payMethod === m ? `rgba(201,168,76,0.12)` : N3, border: `1px solid ${payMethod === m ? GO : N4}`, borderRadius: 8, padding: "10px 0", color: payMethod === m ? GO : MU, fontWeight: 600, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                      {m === "pix" ? <QrCode size={14} /> : <FileText size={14} />}
                      {m === "pix" ? "Pix" : "Boleto"}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {formError && <div style={{ color: "#f87171", fontSize: 12, marginTop: 8 }}>{formError}</div>}
            <button style={submitting ? s.btnDis : s.btn} type="submit" disabled={submitting}>
              {submitting ? <Loader2 size={16} className="animate-spin" style={{ display: "inline", marginRight: 8 }} /> : null}
              {linkData.price_cents > 0 ? "Confirmar e Pagar" : "Continuar"}
            </button>
          </form>
        )}

        {/* STEP: PAYMENT — Pix */}
        {step === "payment" && payMethod === "pix" && order && (
          <div style={s.pixBox}>
            <QrCode size={20} color={GO} style={{ margin: "0 auto 12px" }} />
            <div style={{ color: CR, fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Aguardando pagamento via Pix</div>
            <div style={{ color: MU, fontSize: 11, marginBottom: 16 }}>Confirmaremos automaticamente em alguns segundos após o pagamento.</div>
            {order.pix_qr_code && (
              <img src={order.pix_qr_code} alt="QR Code Pix" style={{ width: 160, height: 160, borderRadius: 8, margin: "0 auto 12px", display: "block", background: "#fff", padding: 4 }} />
            )}
            {order.pix_emv && (
              <div>
                <div style={{ background: N2, border: `1px solid ${N4}`, borderRadius: 6, padding: "8px 12px", fontSize: 10, color: MU, wordBreak: "break-all", margin: "0 0 8px" }}>{order.pix_emv.slice(0, 60)}...</div>
                <button style={s.copyBtn} onClick={copyPix}>
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                  {copied ? "Copiado!" : "Copiar código Pix"}
                </button>
              </div>
            )}
            <div style={{ color: MU, fontSize: 10, marginTop: 16 }}>Verificando pagamento a cada 5 segundos...</div>
          </div>
        )}

        {/* STEP: PAYMENT — Boleto */}
        {step === "payment" && payMethod === "boleto" && order && (
          <div style={{ marginTop: 20 }}>
            <div style={{ color: CR, fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Boleto gerado</div>
            <div style={{ color: MU, fontSize: 12, lineHeight: 1.7, marginBottom: 16 }}>O pagamento pode levar até 2 dias úteis para compensar. Você receberá o link de intake por email após a confirmação.</div>
            {order.boleto_barcode && (
              <div style={{ background: N3, border: `1px solid ${N4}`, borderRadius: 8, padding: "10px 14px", fontSize: 11, color: MU, wordBreak: "break-all", marginBottom: 12 }}>{order.boleto_barcode}</div>
            )}
            {order.boleto_pdf && (
              <a href={order.boleto_pdf} target="_blank" rel="noopener noreferrer"
                style={{ display: "block", textAlign: "center", background: N4, color: CR, fontWeight: 600, fontSize: 13, padding: "11px 0", borderRadius: 8, textDecoration: "none" }}>
                <FileText size={14} style={{ display: "inline", marginRight: 6 }} />
                Baixar PDF do Boleto
              </a>
            )}
          </div>
        )}

        {/* STEP: SUCCESS */}
        {step === "success" && (
          <div style={{ textAlign: "center", paddingTop: 8 }}>
            <div style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(74,222,128,0.12)", border: "1px solid rgba(74,222,128,0.3)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <Check size={24} color="#4ade80" />
            </div>
            <div style={{ color: CR, fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Pagamento confirmado!</div>
            <div style={{ color: MU, fontSize: 12, lineHeight: 1.7, marginBottom: 24 }}>
              Enviamos um link por email para <strong style={{ color: CR }}>{form.client_email}</strong>.<br />
              Nossa mesa entrará em contato em até 24h úteis após o preenchimento.
            </div>
            {order?.intake_token && (
              <a href={`${INTAKE_PATH[order.service_type] ?? "/c"}/${order.intake_token}`}
                style={{ display: "block", background: GO, color: N, fontWeight: 700, fontSize: 14, padding: "13px 0", borderRadius: 8, textDecoration: "none" }}>
                Preencher meus dados agora
              </a>
            )}
          </div>
        )}
      </div>

      <div style={{ color: MU, fontSize: 10, marginTop: 24, textAlign: "center" }}>
        V3 Partners Soluções Ltda · CNPJ 14.219.287/0001-50<br />
        <a href="mailto:operacoes@v3partners.com.br" style={{ color: MU }}>operacoes@v3partners.com.br</a>
      </div>
    </div>
  );
}
