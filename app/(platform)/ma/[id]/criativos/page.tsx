import { notFound } from "next/navigation";
import { ArrowLeft, FileImage } from "lucide-react";
import Link from "next/link";
import { CriativosPanel } from "@/components/ma/criativos-panel";
import { DEMO_DEALS } from "@/lib/demo-data";

const IS_DEMO = false;
const ADMIN_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"];

export const dynamic = "force-dynamic";

export default async function CriativosPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let deal: any = null;
  let isAdmin = false;

  if (IS_DEMO) {
    deal = DEMO_DEALS.find((d) => d.id === id) ?? null;
  } else {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const [dealRes, userRes] = await Promise.all([
      supabase.from("ma_deals").select("id, code, title, target_company, sector, location, slug, asset_data").eq("id", id).single(),
      supabase.auth.getUser(),
    ]);
    deal = dealRes.data;

    if (userRes.data.user) {
      // Usa o cliente do próprio usuário para ler seu perfil (RLS: id = auth.uid())
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userRes.data.user.id)
        .single();
      isAdmin = ADMIN_ROLES.includes(profile?.role ?? "");
    }
  }

  if (!deal) notFound();

  const kitFilesAvailable = (deal.asset_data?.kit_files_available ?? {}) as Record<string, boolean>;

  return (
    <div className="space-y-5 animate-fade-in">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <Link href="/ma" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" />M&A Pipeline
        </Link>
        <span className="text-muted-foreground/40 text-xs">/</span>
        <Link href={`/ma/${deal.id}`} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
          {deal.target_company}
        </Link>
        <span className="text-muted-foreground/40 text-xs">/</span>
        <span className="text-xs text-foreground font-medium">Criativos</span>
      </div>

      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#C9A84C] to-[#E8C97A] flex items-center justify-center flex-shrink-0">
          <FileImage className="w-5 h-5 text-[#09081A]" />
        </div>
        <div>
          <p className="text-[10px] font-bold tracking-widest uppercase text-[#C9A84C] mb-0.5">
            {deal.code} · Kit de Divulgação
          </p>
          <h1 className="text-xl font-bold text-white">{deal.target_company}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            CIM · Teaser Cego · LinkedIn Post · LinkedIn Story — PT-BR e EN
          </p>
        </div>
      </div>

      {/* Guia de peças */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "CIM", desc: "6 páginas A4 · PDF", note: "PT-BR + EN" },
          { label: "Teaser Cego", desc: "1 página A4 · PDF + PNG", note: "PT-BR + EN" },
          { label: "LinkedIn Post", desc: "1080×1350px · JPG", note: "PT-BR + EN" },
          { label: "LinkedIn Story", desc: "1080×1920px · JPG", note: "PT-BR + EN" },
        ].map((p) => (
          <div key={p.label} className="bg-[#162744] border border-[#243A66] rounded-lg p-3 border-t-2 border-t-[#C9A84C]">
            <p className="text-xs font-bold text-white mb-0.5">{p.label}</p>
            <p className="text-[10px] text-muted-foreground">{p.desc}</p>
            <p className="text-[10px] font-semibold text-[#C9A84C] mt-1">{p.note}</p>
          </div>
        ))}
      </div>

      {/* Painel de criativos */}
      <CriativosPanel
        dealId={deal.id}
        dealName={deal.target_company}
        isDemo={IS_DEMO}
        isAdmin={isAdmin}
        kitFilesAvailable={kitFilesAvailable}
      />

      {/* Instrução engine */}
      <div className="text-[10px] text-muted-foreground/50 border border-[#162744] rounded p-3 leading-relaxed">
        <strong className="text-muted-foreground">Creative Engine:</strong> Os arquivos são gerados por um serviço Node.js + Puppeteer
        hospedado no Railway. Configure <code>NEXT_PUBLIC_CREATIVE_ENGINE_URL</code> no <code>.env.local</code> para ativar.
        Enquanto não configurado, os jobs são criados no banco mas não processados automaticamente.
      </div>

    </div>
  );
}
