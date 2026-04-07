import Link from "next/link";
import { Suspense } from "react";
import { Globe, Users, Handshake, DollarSign, Package, CheckCircle } from "lucide-react";
import { SuccessBanner } from "@/components/comunidade/success-banner";

const IS_DEMO =
  !process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL.includes("SEU_PROJETO");

const DEMO_KPIS = [
  { label: "Ativos na Vitrine", value: "12", icon: Package },
  { label: "Investidores Ativos", value: "47", icon: Users },
  { label: "Matches Realizados", value: "8", icon: Handshake },
  { label: "Volume Intermediado", value: "R$ 340MM", icon: DollarSign },
];

const COMO_FUNCIONA = [
  {
    step: "01",
    title: "Qualificação",
    desc: "Preencha o formulário do ativo ou perfil de investidor",
  },
  {
    step: "02",
    title: "Análise M&A",
    desc: "Nossa equipe cruza dados e identifica oportunidades",
  },
  {
    step: "03",
    title: "Match",
    desc: "Conectamos as partes com NDA assinado",
  },
];

const DEMO_ATIVOS = [
  {
    segmento: "Commodities · Minério de Ferro",
    valor: "R$ 45MM – R$ 60MM",
    localizacao: "Norte · Brasil",
    detalhe: "Reserva certificada 2,1MT",
  },
  {
    segmento: "Commodities · Ouro e Prata",
    valor: "R$ 8MM – R$ 12MM",
    localizacao: "Centro-Oeste · Brasil",
    detalhe: "Processo ANM ativo",
  },
  {
    segmento: "Mobilidade · Aeronaves",
    valor: "R$ 18MM – R$ 25MM",
    localizacao: "Sudeste · Brasil",
    detalhe: "Frota 3 aeronaves executivas",
  },
  {
    segmento: "Mobilidade · Embarcações",
    valor: "R$ 6MM – R$ 9MM",
    localizacao: "Sul · Brasil",
    detalhe: "Marina própria + frota 8 embarcações",
  },
];

export default function ComunidadePage() {
  return (
    <div className="min-h-screen bg-[#09081A]">
      <div className="max-w-7xl mx-auto px-6 py-10 space-y-12">

        {/* Banner de sucesso pós-submit */}
        <Suspense fallback={null}>
          <SuccessBanner />
        </Suspense>

        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{
                background: "linear-gradient(135deg, #C9A84C22, #C9A84C44)",
                border: "1px solid #C9A84C44",
              }}
            >
              <Globe className="w-7 h-7" style={{ color: "#C9A84C" }} />
            </div>
          </div>
          <p
            className="text-[9px] font-bold uppercase tracking-widest"
            style={{ color: "#C9A84C" }}
          >
            Comunidade de Negócios
          </p>
          <h1
            className="text-4xl font-bold"
            style={{ color: "#F0ECE4" }}
          >
            Vitrine de Ativos e Investidores
          </h1>
          <p className="text-sm max-w-lg mx-auto" style={{ color: "#7A8FA8" }}>
            Conectamos quem tem ativos a quem tem capital. Commodities · Mobilidade.
          </p>
          <div className="flex justify-center gap-3 pt-2">
            <Link
              href="/comunidade/ativo"
              className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200"
              style={{
                background: "linear-gradient(135deg, #C9A84C, #E8C97A)",
                color: "#09081A",
              }}
            >
              Tenho um Ativo
            </Link>
            <Link
              href="/comunidade/investidor"
              className="px-5 py-2.5 rounded-xl text-sm font-semibold border transition-all duration-200 hover:border-[#C9A84C]/60"
              style={{
                border: "1px solid #243A66",
                color: "#F0ECE4",
                background: "#111F35",
              }}
            >
              Sou Investidor
            </Link>
          </div>
        </div>

        {/* KPIs */}
        {IS_DEMO && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {DEMO_KPIS.map((kpi) => {
              const Icon = kpi.icon;
              return (
                <div
                  key={kpi.label}
                  className="rounded-2xl p-5 flex flex-col gap-3"
                  style={{
                    background: "#162744",
                    border: "1px solid #243A66",
                  }}
                >
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center"
                    style={{ background: "#C9A84C18" }}
                  >
                    <Icon className="w-4 h-4" style={{ color: "#C9A84C" }} />
                  </div>
                  <div>
                    <p
                      className="text-2xl font-bold"
                      style={{ color: "#F0ECE4" }}
                    >
                      {kpi.value}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: "#7A8FA8" }}>
                      {kpi.label}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Como Funciona */}
        <div>
          <p
            className="text-[9px] font-bold uppercase tracking-widest mb-6"
            style={{ color: "#C9A84C" }}
          >
            Como Funciona
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {COMO_FUNCIONA.map((item) => (
              <div
                key={item.step}
                className="rounded-2xl p-6 space-y-3"
                style={{
                  background: "#162744",
                  border: "1px solid #243A66",
                }}
              >
                <span
                  className="text-[9px] font-bold uppercase tracking-widest"
                  style={{ color: "#C9A84C" }}
                >
                  {item.step}
                </span>
                <h3 className="text-base font-semibold" style={{ color: "#F0ECE4" }}>
                  {item.title}
                </h3>
                <p className="text-xs leading-relaxed" style={{ color: "#7A8FA8" }}>
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Vitrine de Ativos */}
        <div>
          <p
            className="text-[9px] font-bold uppercase tracking-widest mb-6"
            style={{ color: "#C9A84C" }}
          >
            Vitrine de Ativos
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {DEMO_ATIVOS.map((ativo, idx) => (
              <div
                key={idx}
                className="rounded-2xl p-5 flex flex-col gap-4 hover:border-[#C9A84C]/40 transition-all duration-200"
                style={{
                  background: "#111F35",
                  border: "1px solid #243A66",
                }}
              >
                <div>
                  <span
                    className="text-[8px] font-bold uppercase tracking-widest px-2 py-1 rounded-lg"
                    style={{
                      color: "#C9A84C",
                      background: "#C9A84C18",
                    }}
                  >
                    {ativo.segmento}
                  </span>
                </div>
                <div className="space-y-1">
                  <p className="text-base font-bold" style={{ color: "#F0ECE4" }}>
                    {ativo.valor}
                  </p>
                  <p className="text-xs" style={{ color: "#7A8FA8" }}>
                    {ativo.localizacao}
                  </p>
                  <p className="text-xs" style={{ color: "#7A8FA8" }}>
                    {ativo.detalhe}
                  </p>
                </div>
                <div
                  className="rounded-lg px-3 py-1.5 flex items-center gap-1.5"
                  style={{ background: "#C9A84C0D", border: "1px solid #C9A84C22" }}
                >
                  <CheckCircle className="w-3 h-3 flex-shrink-0" style={{ color: "#C9A84C" }} />
                  <span
                    className="text-[8px] font-bold uppercase tracking-widest"
                    style={{ color: "#C9A84C" }}
                  >
                    Confidencial · NDA Requerido
                  </span>
                </div>
                <Link
                  href="/comunidade/investidor"
                  className="mt-auto text-center py-2 rounded-xl text-xs font-semibold border transition-all duration-200 hover:border-[#C9A84C]/60 hover:text-[#E8C97A]"
                  style={{
                    border: "1px solid #243A66",
                    color: "#7A8FA8",
                  }}
                >
                  Manifestar Interesse
                </Link>
              </div>
            ))}
          </div>
        </div>

        {/* Banner Trial */}
        <div
          className="rounded-2xl p-8 flex flex-col md:flex-row items-center justify-between gap-6"
          style={{
            background: "linear-gradient(135deg, #162744, #111F35)",
            border: "1px solid #C9A84C33",
          }}
        >
          <div className="space-y-1 text-center md:text-left">
            <p className="text-sm font-semibold" style={{ color: "#F0ECE4" }}>
              Ainda não é partner?
            </p>
            <p className="text-xs" style={{ color: "#7A8FA8" }}>
              Cadastre-se para 30 dias gratuitos e submeta seu primeiro ativo.
            </p>
          </div>
          <Link
            href="/comunidade/cadastro"
            className="flex-shrink-0 px-6 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200"
            style={{
              background: "linear-gradient(135deg, #C9A84C, #E8C97A)",
              color: "#09081A",
            }}
          >
            Criar Conta Trial
          </Link>
        </div>

      </div>
    </div>
  );
}
