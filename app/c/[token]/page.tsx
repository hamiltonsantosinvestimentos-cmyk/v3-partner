import { Metadata } from "next";
import { CaptacaoForm } from "@/components/captacao/captacao-form";
import Image from "next/image";

export const metadata: Metadata = {
  title: "Formulário de Interesse | V3 Partners",
  description: "Preencha seus dados para que nosso time entre em contato e estruture a melhor solução financeira para você.",
};

interface Props {
  params: Promise<{ token: string }>;
}

export default async function CaptacaoPage({ params }: Props) {
  const { token } = await params;

  // Valida token no servidor
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
      .from("captacao_links")
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
    <div className="min-h-screen" style={{ background: "linear-gradient(135deg, #09081A 0%, #0E1A2D 50%, #09081A 100%)" }}>
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
            <p className="text-[11px]" style={{ color: "#7A8FA8" }}>Plataforma Institucional</p>
          </div>
          <div className="ml-auto hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full"
            style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.25)" }}>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] font-bold text-emerald-400 tracking-wide">Formulário Seguro</span>
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
                Formulário de Interesse
              </h1>
              <p className="text-sm leading-relaxed" style={{ color: "#7A8FA8" }}>
                Preencha seus dados com segurança. Nossa equipe analisará seu perfil e
                entrará em contato com a melhor estrutura financeira para você.
              </p>
            </div>

            <CaptacaoForm token={token} partnerName={partnerName} />
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
