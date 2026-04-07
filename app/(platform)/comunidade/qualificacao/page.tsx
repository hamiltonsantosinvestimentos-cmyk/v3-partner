import Link from "next/link";
import { Package, TrendingUp } from "lucide-react";

export default function QualificacaoPage() {
  return (
    <div className="min-h-screen bg-[#09081A]">
      <div className="max-w-4xl mx-auto px-6 py-14 space-y-10">

        {/* Header */}
        <div className="text-center space-y-3">
          <p
            className="text-[9px] font-bold uppercase tracking-widest"
            style={{ color: "#C9A84C" }}
          >
            Comunidade de Negócios · Qualificação
          </p>
          <h1 className="text-3xl font-bold" style={{ color: "#F0ECE4" }}>
            Como você quer participar?
          </h1>
          <p className="text-sm" style={{ color: "#7A8FA8" }}>
            Escolha seu perfil para iniciar o cadastro.
          </p>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Card Sell-side */}
          <div
            className="group rounded-2xl p-8 flex flex-col gap-6 min-h-[280px] border transition-all duration-200 hover:border-[#C9A84C]/50"
            style={{
              background: "#162744",
              border: "1px solid #243A66",
            }}
          >
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center"
              style={{
                background: "#C9A84C18",
                border: "1px solid #C9A84C33",
              }}
            >
              <Package className="w-6 h-6" style={{ color: "#C9A84C" }} />
            </div>
            <div className="space-y-2 flex-1">
              <h2 className="text-xl font-bold" style={{ color: "#F0ECE4" }}>
                Tenho um Ativo
              </h2>
              <p className="text-sm leading-relaxed" style={{ color: "#7A8FA8" }}>
                Quero estruturar a venda, captação ou parceria para um ativo que possuo.
              </p>
              <div className="flex gap-2 pt-2">
                <span
                  className="text-[8px] font-bold uppercase tracking-widest px-2 py-1 rounded-lg"
                  style={{ color: "#C9A84C", background: "#C9A84C18" }}
                >
                  Commodities
                </span>
                <span
                  className="text-[8px] font-bold uppercase tracking-widest px-2 py-1 rounded-lg"
                  style={{ color: "#C9A84C", background: "#C9A84C18" }}
                >
                  Mobilidade
                </span>
              </div>
            </div>
            <Link
              href="/comunidade/ativo"
              className="block text-center py-3 rounded-xl text-sm font-semibold transition-all duration-200"
              style={{
                background: "linear-gradient(135deg, #C9A84C, #E8C97A)",
                color: "#09081A",
              }}
            >
              Cadastrar Ativo
            </Link>
          </div>

          {/* Card Buy-side */}
          <div
            className="group rounded-2xl p-8 flex flex-col gap-6 min-h-[280px] border transition-all duration-200 hover:border-[#C9A84C]/50"
            style={{
              background: "#162744",
              border: "1px solid #243A66",
            }}
          >
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center"
              style={{
                background: "#7B5EA718",
                border: "1px solid #7B5EA733",
              }}
            >
              <TrendingUp className="w-6 h-6" style={{ color: "#A78BFA" }} />
            </div>
            <div className="space-y-2 flex-1">
              <h2 className="text-xl font-bold" style={{ color: "#F0ECE4" }}>
                Sou Investidor
              </h2>
              <p className="text-sm leading-relaxed" style={{ color: "#7A8FA8" }}>
                Busco ativos para adquirir, investir ou estabelecer parceria estratégica.
              </p>
              <div className="pt-2">
                <span
                  className="text-[8px] font-bold uppercase tracking-widest"
                  style={{ color: "#7A8FA8" }}
                >
                  Ticket mínimo: R$ 500K
                </span>
              </div>
            </div>
            <Link
              href="/comunidade/investidor"
              className="block text-center py-3 rounded-xl text-sm font-semibold border transition-all duration-200 hover:border-[#C9A84C]/60 hover:text-[#E8C97A]"
              style={{
                border: "1px solid #243A66",
                color: "#F0ECE4",
                background: "#111F35",
              }}
            >
              Cadastrar Perfil
            </Link>
          </div>

        </div>
      </div>
    </div>
  );
}
