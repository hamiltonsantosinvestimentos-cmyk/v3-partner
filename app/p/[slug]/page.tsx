import { notFound } from "next/navigation";
import { createClient as sc } from "@supabase/supabase-js";
import { Metadata } from "next";
import { PartnerSiteClient } from "@/components/partner-site/partner-site-client";

export const dynamic = "force-dynamic";

function serviceClient() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const svc = serviceClient();
  const { data } = await svc
    .from("profiles")
    .select("full_name, cobranding_bio")
    .eq("cobranding_slug", slug)
    .eq("is_active", true)
    .single();

  if (!data) return { title: "V3 Partners" };

  return {
    title: `${data.full_name} · V3 Partners`,
    description: data.cobranding_bio ?? "Boutique institucional multiproduto especializada em securitização e estruturação financeira.",
    openGraph: {
      title: `${data.full_name} · V3 Partners`,
      description: data.cobranding_bio ?? "Transformamos Ativos Reais em Capital Global.",
      siteName: "V3 Partners",
    },
  };
}

export default async function PartnerSitePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const svc = serviceClient();

  // Busca perfil — qualquer role ativo com cobranding_slug configurado
  const { data: profile } = await svc
    .from("profiles")
    .select("id, full_name, role, avatar_url, cobranding_bio, cobranding_whatsapp, cobranding_instagram, cobranding_slug")
    .eq("cobranding_slug", slug)
    .eq("is_active", true)
    .single();

  if (!profile) notFound();

  // Busca token de captação ativo do partner
  const { data: link } = await svc
    .from("captacao_links")
    .select("token")
    .eq("partner_id", profile.id)
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  return (
    <PartnerSiteClient
      profile={profile}
      captacaoToken={link?.token ?? null}
    />
  );
}
