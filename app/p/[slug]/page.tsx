import { notFound } from "next/navigation";
import { createClient as sc } from "@supabase/supabase-js";
import Image from "next/image";
import Link from "next/link";

export const dynamic = "force-dynamic";

function serviceClient() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export default async function CobrandingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const svc = serviceClient();

  const { data: profile } = await svc
    .from("profiles")
    .select("id, full_name, role, avatar_url, cobranding_bio, cobranding_whatsapp, cobranding_instagram, cobranding_slug")
    .eq("cobranding_slug", slug)
    .eq("is_active", true)
    .single();

  if (!profile || !["PARTNER_PRO"].includes(profile.role)) notFound();

  // Busca link de captação do partner
  const { data: link } = await svc
    .from("captacao_links")
    .select("token")
    .eq("partner_id", profile.id)
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  const captacaoUrl = link ? `/c/${link.token}` : null;
  const whatsappUrl = profile.cobranding_whatsapp
    ? `https://wa.me/55${profile.cobranding_whatsapp.replace(/\D/g, "")}`
    : null;

  return (
    <div className="min-h-screen bg-[#09081A] flex flex-col items-center justify-center p-6">
      {/* BG grid */}
      <div className="fixed inset-0 bg-grid-sidebar opacity-20 pointer-events-none" />

      <div className="relative w-full max-w-md">
        {/* Card */}
        <div className="bg-[#111F35] border border-[#243A66] rounded-2xl overflow-hidden shadow-2xl">

          {/* Header dourado */}
          <div className="h-2 bg-gradient-to-r from-[#C9A84C] via-[#E8C97A] to-[#C9A84C]" />

          <div className="p-8 text-center">
            {/* Logos */}
            <div className="flex items-center justify-center gap-4 mb-6">
              {/* Logo V3 */}
              <div className="w-16 h-16 rounded-xl overflow-hidden border border-[#243A66]"
                style={{ boxShadow: "0 0 0 1px rgba(201,168,76,0.2)" }}>
                <Image src="/logo.jpg" alt="V3 Partners" width={64} height={64} className="w-full h-full object-contain" />
              </div>

              {/* Divisor */}
              <div className="flex flex-col items-center gap-1">
                <div className="w-px h-6 bg-[#C9A84C]/40" />
                <span className="text-[9px] font-bold text-[#C9A84C] tracking-widest">×</span>
                <div className="w-px h-6 bg-[#C9A84C]/40" />
              </div>

              {/* Avatar do partner */}
              <div className="w-16 h-16 rounded-xl overflow-hidden border border-[#243A66] bg-gradient-to-br from-[#C9A84C]/30 to-[#243A66] flex items-center justify-center"
                style={{ boxShadow: "0 0 0 1px rgba(201,168,76,0.2)" }}>
                {profile.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profile.avatar_url} alt={profile.full_name ?? ""} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl font-black text-[#C9A84C]">
                    {(profile.full_name ?? "P")[0].toUpperCase()}
                  </span>
                )}
              </div>
            </div>

            {/* Badge Partner PRO */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#C9A84C]/15 border border-[#C9A84C]/30 mb-4">
              <div className="w-1.5 h-1.5 rounded-full bg-[#C9A84C]" />
              <span className="text-[10px] font-bold tracking-widest text-[#C9A84C] uppercase">Partner PRO · V3 Partners</span>
            </div>

            {/* Nome */}
            <h1 className="text-2xl font-bold text-[#F0ECE4] mb-2">
              {profile.full_name}
            </h1>

            {/* Bio */}
            {profile.cobranding_bio && (
              <p className="text-sm text-[#7A8FA8] leading-relaxed mb-6">
                {profile.cobranding_bio}
              </p>
            )}

            {/* Sobre V3 */}
            <div className="bg-[#09081A] border border-[#243A66] rounded-xl p-4 text-left mb-6">
              <p className="text-[10px] font-bold tracking-widest text-[#C9A84C] uppercase mb-2">Sobre a V3 Partners</p>
              <p className="text-xs text-[#7A8FA8] leading-relaxed">
                Boutique institucional multiproduto especializada em securitização, M&A, crédito estruturado, consórcio e soluções financeiras para empresas e pessoas físicas.
              </p>
            </div>

            {/* CTAs */}
            <div className="space-y-3">
              {captacaoUrl && (
                <Link
                  href={captacaoUrl}
                  className="flex items-center justify-center gap-2 w-full h-12 rounded-xl bg-[#C9A84C] hover:bg-[#E8C97A] text-[#09081A] font-bold text-sm transition-colors"
                >
                  Quero ser apresentado às soluções V3
                </Link>
              )}

              {whatsappUrl && (
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm transition-colors"
                >
                  {/* WhatsApp icon */}
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  Falar via WhatsApp
                </a>
              )}

              {profile.cobranding_instagram && (
                <a
                  href={`https://instagram.com/${profile.cobranding_instagram.replace("@", "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full h-10 rounded-xl border border-[#243A66] text-[#7A8FA8] hover:text-[#F0ECE4] hover:border-[#C9A84C]/40 text-sm transition-colors"
                >
                  @{profile.cobranding_instagram.replace("@", "")}
                </a>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="px-8 py-4 border-t border-[#243A66] text-center">
            <p className="text-[10px] text-[#7A8FA8]/50">
              Powered by{" "}
              <span className="text-[#C9A84C] font-semibold">V3 Partners</span>
              {" "}· v3partners.com.br
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
