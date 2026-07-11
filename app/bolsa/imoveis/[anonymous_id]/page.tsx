"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2, AlertTriangle, MapPin, ShieldCheck, CheckCircle2 } from "lucide-react";

type Asset = {
  anonymous_id: string;
  asset_type: string;
  uf: string | null;
  municipio: string | null;
  natureza: string | null;
  valor_face: number;
  valor_atualizado: number | null;
  risk_score: number | null;
  gallery: { url: string; caption: string }[];
  listing_status: string;
  public_narrative?: string | null;
};

function formatBRL(v: number | null | undefined) {
  if (v === null || v === undefined) return "N/D";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

const NDA_SUMMARY =
  "Ao prosseguir, você concorda em manter sigilo sobre todas as informações do ativo recebidas da V3 Partners, " +
  "não as divulgar a terceiros e utilizá-las exclusivamente para avaliar esta oportunidade.";

const NCND_SUMMARY =
  "Você concorda em não contornar a intermediação da V3 Partners nesta operação: qualquer contato direto com o " +
  "vendedor, cedente ou demais intermediários fora do processo conduzido pela Mesa V3 é vedado. Eventuais disputas " +
  "decorrentes deste aceite serão submetidas a Câmara de Arbitragem institucional (CBMA/CAMARB, a definir), com a " +
  "V3 Partners atuando como parte neutra do processo.";

export default function BolsaImovelLandingPage() {
  const { anonymous_id } = useParams<{ anonymous_id: string }>();
  const [asset, setAsset] = useState<Asset | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [activeImage, setActiveImage] = useState(0);

  const [showForm, setShowForm] = useState(false);
  const [buyerName, setBuyerName] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [ndaAccepted, setNdaAccepted] = useState(false);
  const [ncndAccepted, setNcndAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<"ok" | "error" | null>(null);
  const [submitMessage, setSubmitMessage] = useState("");

  useEffect(() => {
    if (!anonymous_id) return;
    fetch(`/api/public/bolsa/imoveis/${anonymous_id}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Ativo não encontrado");
        setAsset(json);
        setState("ready");
      })
      .catch(() => setState("error"));
  }, [anonymous_id]);

  async function submitVistoria() {
    setSubmitting(true);
    setSubmitResult(null);
    try {
      const res = await fetch(`/api/public/bolsa/imoveis/${anonymous_id}/vistoria`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          buyer_name: buyerName,
          buyer_email: buyerEmail,
          buyer_phone: buyerPhone,
          nda_accepted: ndaAccepted,
          ncnd_accepted: ncndAccepted,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro ao enviar pedido");
      setSubmitResult("ok");
      setSubmitMessage(json.message);
    } catch (err) {
      setSubmitResult("error");
      setSubmitMessage(err instanceof Error ? err.message : "Erro ao enviar pedido");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#09081A]">
      <div className="border-b border-[#C9A84C]/20 bg-[#12112A]">
        <div className="max-w-5xl mx-auto px-6 py-5 flex items-center gap-3">
          <img src="https://app.v3partners.com.br/v3-logo-flat-gold-alpha.png" alt="V3 Partners" className="h-9" />
          <div>
            <p className="text-sm font-bold text-[#F5F1E8]">Bolsa de Grandes Ativos</p>
            <p className="text-[10px] text-[#9BAFC5]">Imóveis e Ativos Alternativos · V3 Partners</p>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-10">
        {state === "loading" && (
          <div className="flex flex-col items-center justify-center py-24">
            <Loader2 className="w-8 h-8 animate-spin text-[#C9A84C] mb-4" />
            <p className="text-sm text-[#9BAFC5]">Carregando ativo</p>
          </div>
        )}

        {state === "error" && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <AlertTriangle className="w-12 h-12 text-red-400 mb-4" />
            <p className="text-sm text-[#F5F1E8] font-bold mb-1">Ativo não encontrado</p>
            <p className="text-xs text-[#9BAFC5]">O link pode estar incorreto ou o ativo não está mais disponível na vitrine.</p>
          </div>
        )}

        {state === "ready" && asset && (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
            <div className="lg:col-span-3">
              <div className="aspect-[4/3] bg-[#162744] rounded-xl overflow-hidden mb-3">
                {asset.gallery.length > 0 ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={asset.gallery[activeImage]?.url}
                    alt={asset.anonymous_id}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[#9BAFC5]/40 text-xs uppercase tracking-wide">
                    Galeria em preparação
                  </div>
                )}
              </div>
              {asset.gallery.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {asset.gallery.map((img, i) => (
                    <button
                      key={i}
                      onClick={() => setActiveImage(i)}
                      className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition ${
                        i === activeImage ? "border-[#C9A84C]" : "border-transparent opacity-60"
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img.url} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="lg:col-span-2">
              <div className="flex items-center gap-1.5 text-[10px] text-[#9BAFC5] uppercase tracking-wide mb-2">
                <MapPin size={12} />
                {asset.municipio ? `${asset.municipio} · ${asset.uf ?? ""}` : asset.uf ?? "Localização a confirmar"}
              </div>
              <h1 className="text-2xl font-bold text-[#F5F1E8] mb-1">{formatBRL(asset.valor_face)}</h1>
              <p className="text-xs text-[#9BAFC5] mb-4">{asset.natureza ?? "Ativo alternativo"} · {asset.anonymous_id}</p>

              {asset.risk_score !== null && (
                <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-[#12112A] border border-[#C9A84C]/20 rounded-lg w-fit">
                  <ShieldCheck size={14} className="text-[#C9A84C]" />
                  <span className="text-[11px] text-[#C9A84C] font-bold">Score V3: {asset.risk_score}/100</span>
                </div>
              )}

              {asset.public_narrative && (
                <p className="text-[12px] text-[#9BAFC5] leading-relaxed mb-6 border-l-2 border-[#C9A84C]/30 pl-3">
                  {asset.public_narrative}
                </p>
              )}

              {!showForm && submitResult !== "ok" && (
                <button
                  onClick={() => setShowForm(true)}
                  className="w-full px-4 py-3 bg-[#C9A84C] text-[#09081A] rounded-lg text-xs font-bold hover:bg-[#E8C97A] transition"
                >
                  Solicitar Vistoria Técnica
                </button>
              )}

              {submitResult === "ok" && (
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-start gap-3">
                  <CheckCircle2 size={18} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-[#F5F1E8]">{submitMessage}</p>
                </div>
              )}

              {showForm && submitResult !== "ok" && (
                <div className="bg-[#12112A] border border-[#9BAFC5]/10 rounded-xl p-5 space-y-4">
                  <div>
                    <label className="text-[9px] text-[#9BAFC5] uppercase">Nome completo</label>
                    <input
                      value={buyerName}
                      onChange={(e) => setBuyerName(e.target.value)}
                      className="w-full bg-[#09081A] border border-[#9BAFC5]/15 rounded px-3 py-2 text-xs text-[#F5F1E8] mt-1 focus:border-[#C9A84C]/50 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-[#9BAFC5] uppercase">Email</label>
                    <input
                      type="email"
                      value={buyerEmail}
                      onChange={(e) => setBuyerEmail(e.target.value)}
                      className="w-full bg-[#09081A] border border-[#9BAFC5]/15 rounded px-3 py-2 text-xs text-[#F5F1E8] mt-1 focus:border-[#C9A84C]/50 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-[#9BAFC5] uppercase">Telefone (opcional)</label>
                    <input
                      value={buyerPhone}
                      onChange={(e) => setBuyerPhone(e.target.value)}
                      className="w-full bg-[#09081A] border border-[#9BAFC5]/15 rounded px-3 py-2 text-xs text-[#F5F1E8] mt-1 focus:border-[#C9A84C]/50 focus:outline-none"
                    />
                  </div>

                  <label className="flex items-start gap-2 cursor-pointer">
                    <input type="checkbox" checked={ndaAccepted} onChange={(e) => setNdaAccepted(e.target.checked)} className="mt-0.5" />
                    <span className="text-[10px] text-[#9BAFC5] leading-relaxed">
                      Li e aceito o <strong className="text-[#F5F1E8]">Acordo de Confidencialidade (NDA)</strong>. {NDA_SUMMARY}
                    </span>
                  </label>

                  <label className="flex items-start gap-2 cursor-pointer">
                    <input type="checkbox" checked={ncndAccepted} onChange={(e) => setNcndAccepted(e.target.checked)} className="mt-0.5" />
                    <span className="text-[10px] text-[#9BAFC5] leading-relaxed">
                      Li e aceito a <strong className="text-[#F5F1E8]">Cláusula de Não Circunvenção (NCND) e Arbitragem</strong>. {NCND_SUMMARY}
                    </span>
                  </label>

                  {submitResult === "error" && (
                    <p className="text-[10px] text-red-400">{submitMessage}</p>
                  )}

                  <button
                    onClick={submitVistoria}
                    disabled={submitting || !buyerName || !buyerEmail || !ndaAccepted || !ncndAccepted}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#C9A84C] text-[#09081A] rounded-lg text-xs font-bold hover:bg-[#E8C97A] transition disabled:opacity-40"
                  >
                    {submitting && <Loader2 size={14} className="animate-spin" />}
                    Confirmar Solicitação
                  </button>
                  <p className="text-[9px] text-[#9BAFC5]/70">
                    O agendamento da vistoria fica pendente até a Mesa V3 aprovar sua Prova de Fundos.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
