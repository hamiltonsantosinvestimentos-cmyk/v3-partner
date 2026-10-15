"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft, ArrowRight, CalendarDays, Check, CheckCircle2, Copy, FileText, Loader2, Lock, MonitorPlay, QrCode, Ticket,
} from "lucide-react";
import { display, C, MOTION_CSS, Backdrop } from "@/components/quiz/partner-quiz-client";
import { maskPhone } from "@/components/quiz/wizard-ui";
import { trackPixel } from "@/components/quiz/meta-pixel";
import { maskCpfInput } from "@/lib/utils";

// Checkout do webinar (/webinar/checkout). Passo 1: nome + WhatsApp (o lead já entra na
// Prospecção e, se não pagar, recebe o link desta página no WhatsApp). Passo 2: CPF (a Cora exige)
// + Pix ou boleto. A página consulta o pagamento sozinha e mostra a confirmação.
// ?t=<token> retoma a inscrição (é o link da mensagem de recuperação). Ver lib/webinar.ts.

type Estado = {
  status: "aguardando" | "pago";
  abertas?: boolean;
  forma: "pix" | "boleto" | null;
  vencimento: string | null;
  pix_emv: string | null;
  pix_qr_code: string | null;
  boleto_barcode: string | null;
  boleto_pdf: string | null;
  tem_cpf?: boolean;
};

const input = "w-full rounded-xl border bg-[#09081A]/70 px-4 py-3.5 text-[15px] outline-none transition-colors focus:border-[#C9A84C]/70 placeholder:text-[#7A8FA8]/50";
const inputStyle = { color: C.cream, borderColor: "rgba(240,236,228,0.12)" } as const;

function dataBR(iso: string | null) {
  if (!iso) return "";
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

function Copiar({ texto, rotulo }: { texto: string; rotulo: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button type="button"
      onClick={async () => { try { await navigator.clipboard.writeText(texto); setOk(true); setTimeout(() => setOk(false), 2200); } catch { /* sem permissão */ } }}
      className="inline-flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold transition-colors hover:bg-[#C9A84C]/10"
      style={{ borderColor: `${C.gold}66`, color: C.gold }}>
      {ok ? <><Check className="w-4 h-4" /> Copiado</> : <><Copy className="w-4 h-4" /> {rotulo}</>}
    </button>
  );
}

export function WebinarCheckout() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tokenUrl = searchParams.get("t") ?? "";

  const tracking = useMemo(() => {
    const t: Record<string, string> = {};
    for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "fbclid", "gclid"]) {
      const v = searchParams.get(k);
      if (v) t[k] = v.slice(0, 200);
    }
    return Object.keys(t).length ? t : null;
  }, [searchParams]);

  const [token, setToken] = useState(tokenUrl);
  const [carregando, setCarregando] = useState(!!tokenUrl);
  const [estado, setEstado] = useState<Estado | null>(null);
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [consentimento, setConsentimento] = useState(false);
  const [cpf, setCpf] = useState("");
  const [forma, setForma] = useState<"pix" | "boleto">("pix");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [linkInvalido, setLinkInvalido] = useState(false);
  const comprouRef = useRef(false);

  const consultar = useCallback(async (t: string) => {
    const res = await fetch(`/api/public/webinar?t=${t}`, { cache: "no-store" }).catch(() => null);
    if (!res) return null;
    if (res.status === 404) { setLinkInvalido(true); return null; }
    const j = (await res.json().catch(() => null)) as Estado | null;
    if (j) {
      setEstado(j);
      if (j.forma) setForma(j.forma);
    }
    return j;
  }, []);

  // Retomada pelo link (?t=)
  useEffect(() => {
    if (!tokenUrl) return;
    consultar(tokenUrl).finally(() => setCarregando(false));
  }, [tokenUrl, consultar]);

  // Consulta o pagamento a cada 6 s enquanto há cobrança gerada e não paga.
  const temCobranca = !!(estado && (estado.pix_emv || estado.boleto_barcode));
  useEffect(() => {
    if (!token || !temCobranca || estado?.status === "pago") return;
    const id = setInterval(() => { consultar(token); }, 6000);
    return () => clearInterval(id);
  }, [token, temCobranca, estado?.status, consultar]);

  useEffect(() => {
    if (estado?.status === "pago" && !comprouRef.current) {
      comprouRef.current = true;
      trackPixel("Purchase", { content_name: "webinar_credito_estruturado", currency: "BRL", value: 27 });
    }
  }, [estado?.status]);

  async function enviarDados(e: React.FormEvent) {
    e.preventDefault();
    if (nome.trim().split(/\s+/).length < 2) { setErro("Informe seu nome e sobrenome."); return; }
    if (telefone.replace(/\D/g, "").length < 10) { setErro("Informe seu WhatsApp com DDD."); return; }
    if (!consentimento) { setErro("Marque a autorização de contato para continuar."); return; }
    setEnviando(true);
    setErro(null);
    try {
      const res = await fetch("/api/public/webinar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: nome.trim(), telefone, consentimento: true, tracking }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.token) { setErro(j.error ?? "Não foi possível continuar. Tente novamente."); return; }
      trackPixel("Lead", { content_name: "webinar_credito_estruturado", currency: "BRL", value: 27 });
      setToken(j.token);
      const q = new URLSearchParams(searchParams.toString());
      q.set("t", j.token);
      router.replace(`/webinar/checkout?${q.toString()}`, { scroll: false });
      await consultar(j.token);
    } catch {
      setErro("Falha de conexão. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  }

  async function gerarCobranca(e: React.FormEvent) {
    e.preventDefault();
    if (cpf.replace(/\D/g, "").length !== 11) { setErro("Informe um CPF válido."); return; }
    setEnviando(true);
    setErro(null);
    try {
      const res = await fetch("/api/public/webinar/cobranca", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ t: token, cpf, forma }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { setErro(j.error ?? "Não foi possível gerar a cobrança."); return; }
      trackPixel("AddPaymentInfo", { content_name: "webinar_credito_estruturado", currency: "BRL", value: 27 });
      setEstado((prev) => ({ ...(prev ?? { status: "aguardando" }), ...j }));
    } catch {
      setErro("Falha de conexão. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  }

  const passo: "dados" | "pagamento" | "cobranca" | "pago" =
    estado?.status === "pago" ? "pago" : !token || !estado ? "dados" : temCobranca ? "cobranca" : "pagamento";
  const encerrado = estado?.abertas === false && passo !== "pago";

  return (
    <main className="relative min-h-screen overflow-x-hidden" style={{ background: C.bg, color: C.cream }}>
      <style>{MOTION_CSS}</style>
      <Backdrop />

      <header className="relative z-10 mx-auto flex max-w-5xl items-center justify-between px-4 sm:px-6 py-5">
        <Link href="/webinar"><Image src="/v3-logo-flat-gold-alpha.png" alt="V3 Partners" width={72} height={44} className="h-10 w-auto object-contain" priority /></Link>
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: C.muted }}>
          <Lock className="w-3.5 h-3.5" style={{ color: C.gold }} /> Checkout seguro
        </p>
      </header>

      <div className="relative z-10 mx-auto grid max-w-5xl gap-6 px-4 sm:px-6 pb-16 pt-2 lg:grid-cols-[1fr_340px] lg:items-start">
        {/* Etapas */}
        <section className="q-rise rounded-3xl border p-6 sm:p-10 backdrop-blur-md" style={{ borderColor: C.line, background: "rgba(17,31,53,0.7)" }}>
          {passo !== "pago" && (
            <div className="mb-8 flex items-center gap-3 text-[10.5px] font-bold uppercase tracking-[0.22em]">
              {[{ k: "dados", l: "Seus dados" }, { k: "pagamento", l: "Pagamento" }].map((s, i) => {
                const ativo = (s.k === "dados" && passo === "dados") || (s.k === "pagamento" && passo !== "dados");
                const feito = s.k === "dados" && passo !== "dados";
                return (
                  <div key={s.k} className="flex items-center gap-3">
                    {i > 0 && <span className="h-px w-6 sm:w-10" style={{ background: C.line }} />}
                    <span className="flex items-center gap-2" style={{ color: ativo || feito ? C.gold : C.muted }}>
                      <span className="flex h-6 w-6 items-center justify-center rounded-full border text-[10px]"
                        style={{ borderColor: ativo || feito ? C.gold : C.lineSoft, background: feito ? C.gold : "transparent", color: feito ? C.bg : undefined }}>
                        {feito ? <Check className="w-3.5 h-3.5" /> : i + 1}
                      </span>
                      {s.l}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {carregando ? (
            <p className="flex items-center gap-2 text-sm" style={{ color: C.muted }}><Loader2 className="w-4 h-4 animate-spin" /> Carregando sua inscrição…</p>
          ) : linkInvalido ? (
            <div>
              <h1 className={`${display.className} text-3xl font-semibold`}>Link não encontrado</h1>
              <p className="mt-3 text-sm" style={{ color: C.muted }}>Este link de inscrição não é válido. Comece de novo, leva menos de 1 minuto.</p>
              <button onClick={() => { setLinkInvalido(false); setToken(""); router.replace("/webinar/checkout"); }}
                className="mt-6 inline-flex items-center gap-2 text-sm font-bold" style={{ color: C.gold }}>Fazer inscrição <ArrowRight className="w-4 h-4" /></button>
            </div>
          ) : encerrado ? (
            <div>
              <h1 className={`${display.className} text-3xl font-semibold`}>Inscrições encerradas</h1>
              <p className="mt-3 text-sm" style={{ color: C.muted }}>O webinar já aconteceu. Fique de olho no Instagram da V3 Partners para as próximas turmas.</p>
            </div>
          ) : passo === "dados" ? (
            <form onSubmit={enviarDados}>
              <h1 className={`${display.className} text-3xl sm:text-4xl font-semibold leading-tight`}>Garanta sua vaga no webinar.</h1>
              <p className="mt-2 text-sm" style={{ color: C.muted }}>É por esse WhatsApp que você recebe a confirmação e o link da sala.</p>
              <div className="mt-8 space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold" style={{ color: C.muted }}>Nome completo</label>
                  <input value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="name" placeholder="Seu nome e sobrenome" className={input} style={inputStyle} autoFocus />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold" style={{ color: C.muted }}>WhatsApp</label>
                  <input value={telefone} onChange={(e) => setTelefone(maskPhone(e.target.value))} autoComplete="tel" inputMode="tel" placeholder="(11) 99999-9999" className={input} style={inputStyle} />
                </div>
                <label className="flex cursor-pointer items-start gap-3 pt-1 text-xs leading-relaxed" style={{ color: C.muted }}>
                  <input type="checkbox" checked={consentimento} onChange={(e) => setConsentimento(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#C9A84C]" />
                  Autorizo a V3 Partners a me contatar pelo WhatsApp sobre este webinar e a tratar meus dados para a inscrição, conforme a LGPD.
                </label>
              </div>
              {erro && <p className="mt-5 rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-300">{erro}</p>}
              <button type="submit" disabled={enviando}
                className="q-btn mt-8 inline-flex w-full items-center justify-center gap-2.5 rounded-xl px-8 py-4 text-[15px] font-bold transition-all hover:brightness-110 disabled:opacity-50"
                style={{ background: `linear-gradient(135deg, ${C.goldLight}, ${C.gold})`, color: C.bg, boxShadow: `0 16px 44px -14px ${C.gold}` }}>
                {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Continuar para o pagamento <ArrowRight className="w-4 h-4" /></>}
              </button>
            </form>
          ) : passo === "pagamento" ? (
            <form onSubmit={gerarCobranca}>
              <h1 className={`${display.className} text-3xl sm:text-4xl font-semibold leading-tight`}>Como você prefere pagar?</h1>
              <div className="mt-7 grid grid-cols-2 gap-3">
                {([
                  { k: "pix", l: "Pix", d: "Confirmação na hora", icon: QrCode },
                  { k: "boleto", l: "Boleto", d: "Até 2 dias úteis", icon: FileText },
                ] as const).map((f) => (
                  <button type="button" key={f.k} onClick={() => setForma(f.k)}
                    className="rounded-2xl border p-4 text-left transition-all"
                    style={{ borderColor: forma === f.k ? C.gold : C.lineSoft, background: forma === f.k ? `${C.gold}12` : "rgba(9,8,26,0.5)" }}>
                    <f.icon className="w-5 h-5" style={{ color: forma === f.k ? C.gold : C.muted }} />
                    <p className="mt-3 font-bold">{f.l}</p>
                    <p className="text-xs" style={{ color: C.muted }}>{f.d}</p>
                  </button>
                ))}
              </div>
              <div className="mt-6">
                <label className="mb-1.5 block text-xs font-semibold" style={{ color: C.muted }}>CPF do pagador</label>
                <input value={cpf} onChange={(e) => setCpf(maskCpfInput(e.target.value))} inputMode="numeric" placeholder="000.000.000-00" className={input} style={inputStyle} autoFocus />
                <p className="mt-1.5 text-[11px]" style={{ color: C.muted }}>Exigido pelo banco para emitir a cobrança.</p>
              </div>
              {erro && <p className="mt-5 rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-300">{erro}</p>}
              <button type="submit" disabled={enviando}
                className="q-btn mt-8 inline-flex w-full items-center justify-center gap-2.5 rounded-xl px-8 py-4 text-[15px] font-bold transition-all hover:brightness-110 disabled:opacity-50"
                style={{ background: `linear-gradient(135deg, ${C.goldLight}, ${C.gold})`, color: C.bg, boxShadow: `0 16px 44px -14px ${C.gold}` }}>
                {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <>{forma === "pix" ? "Gerar Pix" : "Gerar boleto"} · R$ 27 <ArrowRight className="w-4 h-4" /></>}
              </button>
            </form>
          ) : passo === "cobranca" && estado ? (
            <div>
              <div className="flex items-center justify-between gap-3">
                <h1 className={`${display.className} text-3xl sm:text-4xl font-semibold leading-tight`}>{forma === "pix" ? "Pague com Pix" : "Pague o boleto"}</h1>
                <div className="flex rounded-lg border p-0.5 text-xs font-bold" style={{ borderColor: C.lineSoft }}>
                  {(["pix", "boleto"] as const).map((f) => (
                    <button key={f} onClick={() => setForma(f)} className="rounded-md px-3 py-1.5 transition-colors"
                      style={{ background: forma === f ? `${C.gold}22` : "transparent", color: forma === f ? C.gold : C.muted }}>{f === "pix" ? "Pix" : "Boleto"}</button>
                  ))}
                </div>
              </div>

              {forma === "pix" ? (
                <div className="mt-7">
                  {estado.pix_qr_code && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={estado.pix_qr_code} alt="QR Code Pix" className="mx-auto h-52 w-52 rounded-2xl bg-white p-3" />
                  )}
                  <p className="mt-5 text-center text-sm" style={{ color: C.muted }}>Escaneie o QR Code ou copie o código Pix e cole no app do seu banco.</p>
                  {estado.pix_emv && (
                    <div className="mt-5 space-y-3">
                      <p className="break-all rounded-xl border px-4 py-3 font-mono text-[11px] leading-relaxed" style={{ borderColor: C.lineSoft, color: C.muted, background: "rgba(9,8,26,0.6)" }}>{estado.pix_emv}</p>
                      <Copiar texto={estado.pix_emv} rotulo="Copiar código Pix" />
                    </div>
                  )}
                </div>
              ) : (
                <div className="mt-7 space-y-4">
                  <p className="text-sm" style={{ color: C.muted }}>Vencimento em <strong style={{ color: C.cream }}>{dataBR(estado.vencimento)}</strong>. A compensação leva até 2 dias úteis.</p>
                  {estado.boleto_barcode && (
                    <>
                      <p className="break-all rounded-xl border px-4 py-3 font-mono text-xs" style={{ borderColor: C.lineSoft, background: "rgba(9,8,26,0.6)" }}>{estado.boleto_barcode}</p>
                      <Copiar texto={estado.boleto_barcode} rotulo="Copiar linha digitável" />
                    </>
                  )}
                  {estado.boleto_pdf && (
                    <a href={estado.boleto_pdf} target="_blank" rel="noopener noreferrer"
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold"
                      style={{ background: `linear-gradient(135deg, ${C.goldLight}, ${C.gold})`, color: C.bg }}>
                      <FileText className="w-4 h-4" /> Abrir boleto em PDF
                    </a>
                  )}
                </div>
              )}

              <div className="mt-8 flex items-center gap-3 rounded-xl border px-4 py-3 text-xs" style={{ borderColor: C.line, background: `${C.gold}0D`, color: C.muted }}>
                <Loader2 className="w-4 h-4 flex-shrink-0 animate-spin" style={{ color: C.gold }} />
                Aguardando o pagamento. Assim que ele for identificado, esta página confirma sua vaga e você recebe a confirmação no WhatsApp.
              </div>
              <button onClick={() => setEstado((p) => p && { ...p, pix_emv: null, pix_qr_code: null, boleto_barcode: null, boleto_pdf: null })}
                className="mt-5 inline-flex items-center gap-1.5 text-xs" style={{ color: C.muted }}>
                <ArrowLeft className="w-3.5 h-3.5" /> Corrigir CPF
              </button>
            </div>
          ) : (
            <div className="py-4 text-center">
              <span className="q-seal-ring mx-auto flex h-20 w-20 items-center justify-center rounded-full" style={{ background: `${C.gold}1A`, border: `1px solid ${C.gold}66` }}>
                <CheckCircle2 className="h-10 w-10" style={{ color: C.gold }} />
              </span>
              <h1 className={`${display.className} mt-7 text-4xl sm:text-5xl font-semibold`}>Vaga garantida!</h1>
              <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed" style={{ color: C.muted }}>
                Pagamento confirmado. Mandamos a confirmação no seu WhatsApp, e o link da sala ao vivo chega no mesmo número no dia do evento.
              </p>
              <p className="mt-6 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm" style={{ borderColor: C.line }}>
                <CalendarDays className="w-4 h-4" style={{ color: C.gold }} /> 06/11 · 20h · ao vivo
              </p>
            </div>
          )}
        </section>

        {/* Resumo */}
        <aside className="q-rise rounded-3xl border p-6 backdrop-blur-md" style={{ borderColor: C.lineSoft, background: "rgba(22,39,68,0.55)", animationDelay: "120ms" }}>
          <p className="text-[10px] font-bold uppercase tracking-[0.24em]" style={{ color: C.gold }}>Seu pedido</p>
          <p className={`${display.className} mt-3 text-2xl font-semibold leading-tight`}>Webinar Crédito Estruturado com Garantia</p>
          <div className="mt-5 space-y-2.5 text-sm" style={{ color: C.muted }}>
            <p className="flex items-center gap-2.5"><CalendarDays className="w-4 h-4" style={{ color: C.gold }} /> 06/11, quinta, às 20h</p>
            <p className="flex items-center gap-2.5"><MonitorPlay className="w-4 h-4" style={{ color: C.gold }} /> Ao vivo e online</p>
            <p className="flex items-center gap-2.5"><Ticket className="w-4 h-4" style={{ color: C.gold }} /> 1 ingresso</p>
          </div>
          <div className="mt-6 flex items-end justify-between border-t pt-5" style={{ borderColor: C.lineSoft }}>
            <span className="text-sm" style={{ color: C.muted }}>Total</span>
            <span className={`${display.className} text-4xl font-semibold`} style={{ color: C.goldLight }}>R$ 27</span>
          </div>
          <p className="mt-5 text-[11px] leading-relaxed" style={{ color: C.muted }}>
            Pagamento direto à V3 Partners Soluções Ltda (CNPJ 14.219.287/0001-50), pelo Banco Cora.
          </p>
        </aside>
      </div>
    </main>
  );
}
