import { Metadata } from "next";
import { MaCaptacaoForm } from "@/components/captacao/ma-captacao-form";
import Image from "next/image";

export const metadata: Metadata = {
  title: "Formulário M&A | V3 Partners",
  description: "Preencha os dados da sua empresa para que nossa equipe de M&A entre em contato e estruture a melhor operação para você.",
};

interface Props {
  params: Promise<{ token: string }>;
}

export default async function MaCaptacaoPage({ params }: Props) {
  const { token } = await params;

  let partnerName = "";
  let valid = true;
  let errorMsg = "";

  try {
    const { createClient } = await import("@supabase/supabase-js");
    const svc = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { data, error } = await svc
      .from("ma_captacao_links")
      .select("partner_name, active")
      .eq("token", token)
      .single();

    if (error || !data) { valid = false; errorMsg = "Link inválido ou não encontrado."; }
    else if (!data.active) { valid = false; errorMsg = "Este link foi desativado pelo parceiro."; }
    else { partnerName = data.partner_name; }
  } catch {
    valid = false;
    errorMsg = "Erro ao validar o link. Tente novamente.";
  }

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(135deg, #09081A 0%, #0E1A2D 50%, #09081A 100%)", fontFamily: "'DM Sans', sans-serif" }}>
      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 60% 40% at 50% 0%, rgba(201,168,76,0.06) 0%, transparent 70%)" }} />

      {/* Header */}
      <header className="relative border-b" style={{ borderColor: "rgba(201,168,76,0.12)", background: "rgba(9,8,26,0.9)", backdropFilter: "blur(12px)" }}>
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center gap-4">
          <div className="relative w-12 h-12 rounded-xl overflow-hidden flex-shrink-0"
            style={{ boxShadow: "0 0 0 1px rgba(201,168,76,0.25), 0 4px 16px rgba(0,0,0,0.5)" }}>
            <Image src="/logo.jpg" alt="V3 Partners" width={48} height={48} className="w-full h-full object-contain" priority />
          </div>
          <div>
            <p className="text-[10px] font-bold tracking-[0.2em] uppercase" style={{ color: "#C9A84C" }}>V3 Partners</p>
            <p className="text-[11px]" style={{ color: "#7A8FA8" }}>Mesa de M&A</p>
          </div>
          <div className="ml-auto hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full"
            style={{ background: "rgba(201,168,76,0.08)", border: "1px solid rgba(201,168,76,0.2)" }}>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#C9A84C" }} />
            <span className="text-[10px] font-bold tracking-wide" style={{ color: "#C9A84C" }}>M&A Seguro</span>
          </div>
        </div>
      </header>

      <main className="relative max-w-2xl mx-auto px-4 py-10">
        {!valid ? (
          <div className="text-center py-24">
            <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center"
              style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)" }}>
              <span className="text-2xl">⚠️</span>
            </div>
            <h2 className="text-xl font-bold mb-2" style={{ color: "#F0ECE4" }}>Link Inválido</h2>
            <p className="text-sm" style={{ color: "#7A8FA8" }}>{errorMsg}</p>
          </div>
        ) : (
          <>
            {/* Hero */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-4 text-xs font-semibold tracking-wide"
                style={{ background: "rgba(201,168,76,0.1)", border: "1px solid rgba(201,168,76,0.2)", color: "#C9A84C" }}>
                ✦ Parceiro: {partnerName}
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold mb-3" style={{ color: "#F0ECE4" }}>
                Formulário M&A
              </h1>
              <p className="text-sm leading-relaxed" style={{ color: "#7A8FA8" }}>
                Preencha os dados da sua empresa com segurança. Nossa equipe especializada em
                M&A analisará o perfil e entrará em contato para estruturar a melhor operação.
              </p>
            </div>

            <div style={{ background: "rgba(22,39,68,0.6)", border: "1px solid rgba(201,168,76,0.15)", borderRadius: 16, padding: "28px 24px", backdropFilter: "blur(8px)" }}>
              <MaCaptacaoForm token={token} partnerName={partnerName} />
            </div>
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="text-center py-8 px-4">
        <p className="text-[11px]" style={{ color: "#7A8FA8" }}>
          © 2026 V3 Partners Soluções Ltda · CNPJ 14.219.287/0001-50 · v3partners.com.br
        </p>
        <p className="text-[10px] mt-1" style={{ color: "#7A8FA8" }}>
          Dados protegidos pela Lei Geral de Proteção de Dados (LGPD · Lei nº 13.709/2018)
        </p>
      </footer>
    </div>
  );
}
