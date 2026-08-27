"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { Copy, Check, AlertCircle, AlertTriangle, Loader2, CreditCard, QrCode, FileText, Minus, Plus } from "lucide-react";
import { getStoredRefPartnerId, getStoredPropCode } from "@/lib/ref-tracking";
import { trackEvent } from "@/lib/analytics";
import { UNIT_PRICE_CENTS, clampSelection, calcTotalCents, buildModularTitle, legacyPlanoToSelection, getMinCounts, fmtBRL, type ModularSelection, type ProfileType, type CompanyStructure } from "@/lib/credit-analysis-pricing";

const N = "#09081A", N2 = "#13223A", N3 = "#162744", N4 = "#243A66";
const GO = "#C9A84C", GL = "#E8C97A", CR = "#F5F1E8", MU = "#9BAFC5";

type Step = "form" | "payment" | "success";
type PayMethod = "pix" | "boleto";

interface OrderResult {
  order_id: string;
  status: string;
  price_cents: number;
  pix_emv: string | null;
  pix_qr_code: string | null;
  boleto_barcode: string | null;
  boleto_pdf: string | null;
  intake_token: string | null;
}

const fmt = fmtBRL;

// Lê perfil/estrutura da URL (?perfil=PF|PJ&estrutura=UNIPESSOAL|MULTIPLOS_SOCIOS),
// propagados pelo configurador guiado de /analise-v2. Ausentes = link legado
// (bookmark antigo, /analise Variante A) — cai no fallback global de
// getMinCounts(null, null).
function profileFromParams(params: URLSearchParams): { profileType: ProfileType | null; companyStructure: CompanyStructure | null } {
  const perfil = params.get("perfil");
  const estrutura = params.get("estrutura");
  return {
    profileType: perfil === "PF" || perfil === "PJ" ? perfil : null,
    companyStructure: estrutura === "UNIPESSOAL" || estrutura === "MULTIPLOS_SOCIOS" ? estrutura : null,
  };
}

// Lê a seleção inicial da URL: ?cnpj=&cpf=&consultoria= (vindo do
// configurador de /analise-v2) ou ?plano= (legado, vindo de /analise
// Variante A, que não tem configurador — mapeado para 1 CNPJ + consultoria
// on/off conforme o pacote fixo antigo). `min` trava a seleção nos mínimos
// de negócio do perfil já escolhido na landing (ver getMinCounts).
function selectionFromParams(params: URLSearchParams, min: ReturnType<typeof getMinCounts>): ModularSelection {
  if (params.has("cnpj") || params.has("cpf") || params.has("consultoria")) {
    return clampSelection({
      cnpjCount: Number(params.get("cnpj") ?? min.minCnpj),
      cpfCount: Number(params.get("cpf") ?? min.minCpf),
      hasConsultancy: params.get("consultoria") === "1",
    }, min);
  }
  return legacyPlanoToSelection(params.get("plano"));
}

export function DirectCheckoutClient() {
  const searchParams = useSearchParams();
  const { profileType, companyStructure } = useMemo(() => profileFromParams(searchParams), [searchParams]);
  const min = useMemo(() => getMinCounts(profileType, companyStructure), [profileType, companyStructure]);
  const initialSelection = useMemo(() => selectionFromParams(searchParams, min), [searchParams, min]);

  const [selection, setSelection] = useState<ModularSelection>(initialSelection);
  const [step, setStep] = useState<Step>("form");
  const [payMethod, setPayMethod] = useState<PayMethod>("pix");
  const [form, setForm] = useState({ client_name: "", client_email: "", client_doc: "" });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [order, setOrder] = useState<OrderResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [polling, setPolling] = useState(false);

  const totalCents = calcTotalCents(selection);
  const title = buildModularTitle(selection);
  const totalAnalyses = selection.cnpjCount + selection.cpfCount;

  function setCnpjCount(n: number) {
    setSelection((p) => clampSelection({ ...p, cnpjCount: n }, min));
  }
  function setCpfCount(n: number) {
    setSelection((p) => clampSelection({ ...p, cpfCount: n }, min));
  }
  function toggleConsultancy() {
    setSelection((p) => ({ ...p, hasConsultancy: !p.hasConsultancy }));
  }

  const pollStatus = useCallback(async (orderId: string) => {
    if (polling) return;
    setPolling(true);
    const interval = setInterval(async () => {
      try {
        const r = await fetch(`/api/checkout/direct/status?order_id=${orderId}`);
        const d = await r.json() as { status?: string; intake_token?: string | null };
        if (d.status === "PAID") {
          clearInterval(interval);
          setOrder((prev) => prev ? { ...prev, status: "PAID", intake_token: d.intake_token ?? null } : prev);
          setStep("success");
          setPolling(false);
        }
      } catch {
        // segue tentando no próximo tick
      }
    }, 4000);
  }, [polling]);

  useEffect(() => {
    if (step === "payment" && payMethod === "pix" && order?.order_id) {
      pollStatus(order.order_id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, payMethod, order?.order_id]);

  useEffect(() => {
    trackEvent("InitiateCheckout", { value: calcTotalCents(initialSelection) / 100, currency: "BRL", content_name: buildModularTitle(initialSelection) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (step === "success" && order) {
      trackEvent("Purchase", { value: order.price_cents / 100, currency: "BRL", content_name: title, order_id: order.order_id });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    if (!form.client_name.trim()) { setFormError("Nome obrigatório"); return; }
    if (!form.client_email.trim()) { setFormError("Email obrigatório"); return; }
    if (!form.client_doc.replace(/\D/g, "")) { setFormError("CPF ou CNPJ obrigatório"); return; }

    setSubmitting(true);
    try {
      const refPartnerId = getStoredRefPartnerId();
      const propCode = searchParams.get("prop") ?? getStoredPropCode();
      const r = await fetch("/api/checkout/direct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          cnpj_count: selection.cnpjCount,
          cpf_count: selection.cpfCount,
          has_consultancy: selection.hasConsultancy,
          ref_partner_id: refPartnerId,
          prop_code: propCode,
          profile_type: profileType,
          company_structure: companyStructure,
        }),
      });
      const d = await r.json() as OrderResult & { error?: string };
      if (d.error) { setFormError(d.error); return; }
      setOrder(d);
      setStep("payment");
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

  return (
    <div style={{ background: N, minHeight: "100vh", fontFamily: "'DM Sans', sans-serif", padding: "40px 16px" }}>
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <Image src="/v3-logo-flat-gold-alpha.png" alt="V3 Partners" width={140} height={40} style={{ height: 40, width: "auto", margin: "0 auto" }} />
        </div>

        <div style={{ background: N2, border: `1px solid ${N4}`, borderRadius: 14, padding: 32 }}>
          <div style={{ display: "inline-block", background: "rgba(201,168,76,0.1)", border: `1px solid ${GO}`, color: GL, fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", padding: "4px 10px", borderRadius: 4, marginBottom: 14 }}>
            Análise de Crédito Empresarial · R$ 197,00 por análise
          </div>
          <div style={{ color: CR, fontSize: 15, fontWeight: 700, marginBottom: 4, lineHeight: 1.3 }}>{title}</div>
          <div style={{ color: GO, fontSize: 28, fontWeight: 800, marginTop: 12 }}>{fmt(totalCents)}</div>

          {step === "form" && (
            <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 12 }}>
              {profileType !== "PF" && (
                <CounterRow
                  label="Empresas do grupo (CNPJ)"
                  hint="Uma análise completa por empresa"
                  value={selection.cnpjCount}
                  min={min.minCnpj}
                  onChange={setCnpjCount}
                />
              )}
              <CounterRow
                label="Sócios ou garantidores (CPF)"
                hint="Inclua quem também compõe a operação"
                value={selection.cpfCount}
                min={min.minCpf}
                onChange={setCpfCount}
              />

              {companyStructure === "MULTIPLOS_SOCIOS" && (
                <div style={{ display: "flex", gap: 8, alignItems: "flex-start", background: "rgba(201,168,76,0.08)", border: "1px solid rgba(201,168,76,0.35)", borderRadius: 8, padding: 12 }}>
                  <AlertTriangle size={14} color={GO} style={{ flexShrink: 0, marginTop: 1 }} />
                  <span style={{ fontSize: 11, color: MU, lineHeight: 1.5 }}>
                    Para avaliação precisa de risco por fundos de investimento, é obrigatória a análise da empresa e de todos os sócios/garantidores.
                  </span>
                </div>
              )}

              <button
                type="button"
                onClick={toggleConsultancy}
                style={{
                  marginTop: 4, width: "100%", textAlign: "left", background: selection.hasConsultancy ? "rgba(201,168,76,0.08)" : N3,
                  border: `1px solid ${selection.hasConsultancy ? GO : N4}`, borderRadius: 8, padding: "14px", cursor: "pointer",
                  display: "flex", gap: 12, alignItems: "flex-start",
                }}
              >
                <Switch on={selection.hasConsultancy} />
                <span style={{ fontSize: 12, color: MU, lineHeight: 1.5 }}>
                  <strong style={{ color: CR }}>Consultoria Estratégica V3</strong> (+ {fmt(UNIT_PRICE_CENTS)}): reunião de 45 minutos com a mesa de crédito, com devolutiva completa dos relatórios e plano de ação prático.
                </span>
              </button>

              <div style={{ fontSize: 11, color: MU, textAlign: "right" }}>
                {totalAnalyses} análise{totalAnalyses !== 1 ? "s" : ""} selecionada{totalAnalyses !== 1 ? "s" : ""} · Consultoria {selection.hasConsultancy ? "incluída" : "não incluída"}
              </div>
            </div>
          )}

          <div style={{ height: 1, background: N4, margin: "24px 0" }} />

          {step === "form" && (
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: GL, marginBottom: 5, display: "block" }}>Nome completo</label>
                <input
                  value={form.client_name}
                  onChange={(e) => setForm((p) => ({ ...p, client_name: e.target.value }))}
                  placeholder="Seu nome"
                  style={{ width: "100%", background: N3, border: `1px solid ${N4}`, borderRadius: 8, padding: "10px 12px", color: CR, fontSize: 13, outline: "none" }}
                />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: GL, marginBottom: 5, display: "block" }}>Email</label>
                <input
                  type="email"
                  value={form.client_email}
                  onChange={(e) => setForm((p) => ({ ...p, client_email: e.target.value }))}
                  placeholder="seu@email.com"
                  style={{ width: "100%", background: N3, border: `1px solid ${N4}`, borderRadius: 8, padding: "10px 12px", color: CR, fontSize: 13, outline: "none" }}
                />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: GL, marginBottom: 5, display: "block" }}>CPF ou CNPJ</label>
                <input
                  value={form.client_doc}
                  onChange={(e) => setForm((p) => ({ ...p, client_doc: e.target.value }))}
                  placeholder="000.000.000-00 ou 00.000.000/0001-00"
                  style={{ width: "100%", background: N3, border: `1px solid ${N4}`, borderRadius: 8, padding: "10px 12px", color: CR, fontSize: 13, outline: "none" }}
                />
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: GL, marginBottom: 8, display: "block" }}>Forma de pagamento</label>
                <div style={{ display: "flex", gap: 10 }}>
                  <button type="button" onClick={() => setPayMethod("pix")}
                    style={{ flex: 1, background: payMethod === "pix" ? "rgba(201,168,76,0.08)" : N3, border: `1px solid ${payMethod === "pix" ? GO : N4}`, borderRadius: 8, padding: "12px 0", color: CR, fontWeight: 600, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                    <QrCode size={15} color={payMethod === "pix" ? GO : MU} /> Pix
                  </button>
                  <button type="button" onClick={() => setPayMethod("boleto")}
                    style={{ flex: 1, background: payMethod === "boleto" ? "rgba(201,168,76,0.08)" : N3, border: `1px solid ${payMethod === "boleto" ? GO : N4}`, borderRadius: 8, padding: "12px 0", color: CR, fontWeight: 600, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                    <FileText size={15} color={payMethod === "boleto" ? GO : MU} /> Boleto
                  </button>
                </div>
              </div>
              {formError && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#f87171", fontSize: 12, marginBottom: 14 }}>
                  <AlertCircle size={14} /> {formError}
                </div>
              )}
              <button type="submit" disabled={submitting}
                style={{ width: "100%", background: submitting ? N4 : GO, color: submitting ? MU : N, fontWeight: 700, fontSize: 14, padding: "14px 0", borderRadius: 8, border: "none", cursor: submitting ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                {submitting ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={16} />}
                {submitting ? "Processando..." : "Confirmar e Pagar"}
              </button>
            </form>
          )}

          {step === "payment" && payMethod === "pix" && order && (
            <div style={{ textAlign: "center" }}>
              <div style={{ color: CR, fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Pague com Pix</div>
              <div style={{ color: MU, fontSize: 12, lineHeight: 1.7, marginBottom: 16 }}>Copie o código abaixo no app do seu banco. A confirmação é automática.</div>
              {order.pix_emv && (
                <div style={{ background: N3, border: `1px solid ${N4}`, borderRadius: 8, padding: "10px 14px", fontSize: 11, color: MU, wordBreak: "break-all", marginBottom: 12 }}>{order.pix_emv}</div>
              )}
              <button onClick={copyPix}
                style={{ width: "100%", background: copied ? "rgba(74,222,128,0.1)" : N4, border: `1px solid ${copied ? "rgba(74,222,128,0.3)" : N4}`, color: copied ? "#4ade80" : CR, fontWeight: 600, fontSize: 13, padding: "11px 0", borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copiado" : "Copiar código Pix"}
              </button>
              <div style={{ marginTop: 16, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, color: MU, fontSize: 11 }}>
                <Loader2 size={12} className="animate-spin" /> Aguardando confirmação do pagamento
              </div>
            </div>
          )}

          {step === "payment" && payMethod === "boleto" && order && (
            <div>
              <div style={{ color: CR, fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Boleto gerado</div>
              <div style={{ color: MU, fontSize: 12, lineHeight: 1.7, marginBottom: 16 }}>O pagamento pode levar até 2 dias úteis para compensar. Você recebe o link de intake por email após a confirmação.</div>
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

          {step === "success" && (
            <div style={{ textAlign: "center", paddingTop: 8 }}>
              <div style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(74,222,128,0.12)", border: "1px solid rgba(74,222,128,0.3)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                <Check size={24} color="#4ade80" />
              </div>
              <div style={{ color: CR, fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Pagamento confirmado</div>
              <div style={{ color: MU, fontSize: 12, lineHeight: 1.7, marginBottom: 24 }}>
                Enviamos um link por email para <strong style={{ color: CR }}>{form.client_email}</strong>.<br />
                Nossa mesa entra em contato em até 24h úteis após o preenchimento dos dados.
              </div>
              {order?.intake_token && (
                <a href={`/intake/credit/${order.intake_token}`}
                  style={{ display: "block", background: GO, color: N, fontWeight: 700, fontSize: 14, padding: "13px 0", borderRadius: 8, textDecoration: "none" }}>
                  Preencher meus dados agora
                </a>
              )}
            </div>
          )}
        </div>

        <div style={{ color: MU, fontSize: 10, marginTop: 24, textAlign: "center" }}>
          V3 Partners Soluções Ltda · CNPJ 14.219.287/0001-50<br />
          <a href="mailto:financeiro@v3partners.com.br" style={{ color: MU }}>financeiro@v3partners.com.br</a>
        </div>
      </div>
    </div>
  );
}

// Contador +/- reutilizado para CNPJ e CPF no configurador modular.
function CounterRow({ label, hint, value, min, onChange }: { label: string; hint: string; value: number; min: number; onChange: (n: number) => void }) {
  return (
    <div style={{ background: N3, border: `1px solid ${N4}`, borderRadius: 8, padding: "12px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
      <div>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: CR }}>{label}</div>
        <div style={{ fontSize: 10.5, color: MU, marginTop: 2 }}>{hint}</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
        <button type="button" onClick={() => onChange(value - 1)} disabled={value <= min}
          style={{ width: 26, height: 26, borderRadius: 6, border: `1px solid ${N4}`, background: N2, color: value <= min ? N4 : CR, display: "flex", alignItems: "center", justifyContent: "center", cursor: value <= min ? "not-allowed" : "pointer" }}>
          <Minus size={13} />
        </button>
        <span style={{ minWidth: 16, textAlign: "center", fontSize: 14, fontWeight: 700, color: CR, fontVariantNumeric: "tabular-nums" }}>{value}</span>
        <button type="button" onClick={() => onChange(value + 1)}
          style={{ width: 26, height: 26, borderRadius: 6, border: `1px solid ${GO}`, background: N2, color: GO, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          <Plus size={13} />
        </button>
      </div>
    </div>
  );
}

// Switch visual para o upsell de Consultoria (estado controlado pelo pai via clique no card inteiro).
function Switch({ on }: { on: boolean }) {
  return (
    <span style={{
      flexShrink: 0, width: 34, height: 19, borderRadius: 10, background: on ? GO : N4,
      position: "relative", transition: "background 0.15s", marginTop: 1,
    }}>
      <span style={{
        position: "absolute", top: 2, left: on ? 17 : 2, width: 15, height: 15, borderRadius: "50%",
        background: N, transition: "left 0.15s",
      }} />
    </span>
  );
}
