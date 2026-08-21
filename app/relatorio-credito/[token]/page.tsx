import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient as sc } from "@supabase/supabase-js";
import { buildCreditReportData } from "@/lib/credit-report-data";
import { buildExternalReportBodyHtml, CREDIT_REPORT_STYLE } from "@/lib/credit-report-template";

export const dynamic = "force-dynamic";

function serviceClient() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

interface PageProps { params: Promise<{ token: string }> }

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "V3 Partners · Relatório de Análise de Crédito",
    description: "Dossiê de informações cadastrais. Acesso restrito ao destinatário.",
    robots: "noindex, nofollow",
  };
}

export default async function RelatorioCreditoPage({ params }: PageProps) {
  const { token } = await params;
  const svc = serviceClient();

  const { data: order } = await svc
    .from("partner_service_orders")
    .select("id, credit_desk_proposal_id, report_public_token")
    .eq("report_public_token", token)
    .single();

  if (!order?.credit_desk_proposal_id) notFound();

  const { data: proposal } = await svc
    .from("credit_desk_proposals")
    .select("credit_profile_id")
    .eq("id", order.credit_desk_proposal_id)
    .single();

  if (!proposal?.credit_profile_id) notFound();

  const reportData = await buildCreditReportData(proposal.credit_profile_id);
  if (!reportData) notFound();

  if (new Date(reportData.validUntilISO).getTime() < Date.now()) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#09081A] text-[#F5F1E8] px-6">
        <div className="max-w-md text-center">
          <p className="text-[#E8C97A] text-xs font-bold uppercase tracking-widest mb-3">V3 Partners</p>
          <h1 className="text-xl font-bold mb-2">Link expirado</h1>
          <p className="text-sm text-[#9BAFC5]">
            Este relatório venceu em {reportData.validUntil}. Entre em contato com{" "}
            <a href="mailto:financeiro@v3partners.com.br" className="text-[#C9A84C]">financeiro@v3partners.com.br</a>{" "}
            para solicitar uma nova emissão.
          </p>
        </div>
      </div>
    );
  }

  const bodyHtml = buildExternalReportBodyHtml(reportData);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CREDIT_REPORT_STYLE }} />
      <div dangerouslySetInnerHTML={{ __html: bodyHtml }} />
    </>
  );
}
