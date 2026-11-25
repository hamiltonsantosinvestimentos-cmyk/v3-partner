import type { Metadata } from "next";
import { marcaDoHost, metadataDaMarca } from "@/lib/enterprise-marca-host";

// Link do e-mail de recuperação com a marca do Enterprise. Abrir a página NÃO usa o token
// (antivírus de e-mail fazem GET nos links): só o botão "Continuar" envia o POST que valida.
// BRIEF docs/briefs/2026-11-25_recuperar-senha-marca-enterprise.md
export async function generateMetadata(): Promise<Metadata> {
  const { marca, iconeUrl } = await marcaDoHost();
  return metadataDaMarca(marca, iconeUrl);
}

export default async function ConfirmarRecuperacaoPage({ searchParams }: { searchParams: Promise<{ token_hash?: string }> }) {
  const { marca, temaCss } = await marcaDoHost();
  const { token_hash } = await searchParams;
  const token = typeof token_hash === "string" ? token_hash.slice(0, 512) : "";

  return (
    <>
      {temaCss && <style id="tema-enterprise">{temaCss}</style>}
      <div className="min-h-screen bg-[#09081A] flex items-center justify-center p-4">
        <div className="relative w-full max-w-sm">
          <div className="flex flex-col items-center mb-8">
            <div className="w-20 h-20 rounded-2xl overflow-hidden mb-3 bg-[#111F35] flex items-center justify-center"
              style={{ boxShadow: "0 0 0 1px color-mix(in srgb, var(--wl-acento, #C9A84C) 25%, transparent), 0 8px 32px rgba(0,0,0,0.5)" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={marca?.logoUrl ?? "/logo.jpg"} alt={marca?.nome ?? "V3 Partners"} width={80} height={80} className="w-full h-full object-contain" />
            </div>
            <p className="text-[11px] font-bold tracking-[0.2em] text-[#C9A84C] uppercase">{marca?.nome ?? "V3 Partners"}</p>
          </div>

          <div className="bg-[#111F35] border border-[#243A66] rounded-2xl p-6 shadow-2xl">
            <h1 className="text-lg font-bold text-[#F0ECE4] mb-1">Criar nova senha</h1>
            {token ? (
              <>
                <p className="text-xs text-[#7A8FA8] mb-6">Clique em continuar para criar a nova senha da sua conta.</p>
                <form method="post" action="/api/public/recuperar-senha/confirmar">
                  <input type="hidden" name="token_hash" value={token} />
                  <button type="submit"
                    className="w-full h-10 rounded-lg bg-[#C9A84C] hover:bg-[#E8C97A] text-[#09081A] text-sm font-bold transition-colors">
                    Continuar
                  </button>
                </form>
              </>
            ) : (
              <p className="text-xs text-[#7A8FA8]">
                Link incompleto. <a href="/esqueci-senha" className="text-[#C9A84C] underline">Peça um novo link</a>.
              </p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
