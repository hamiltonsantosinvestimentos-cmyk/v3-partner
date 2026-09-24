import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient as sc } from "@supabase/supabase-js";
import { buildCreditReportData } from "@/lib/credit-report-data";
import { buildExternalReportBodyHtml, CREDIT_REPORT_STYLE } from "@/lib/credit-report-template";
import { CAPA_CSS, capaBodyHtml, resolverPartesDoPedido, resumoDaParte } from "@/lib/credit-unified-pdf";

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

function LinkExpirado({ venceuEm }: { venceuEm: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#09081A] text-[#F5F1E8] px-6">
      <div className="max-w-md text-center">
        <p className="text-[#E8C97A] text-xs font-bold uppercase tracking-widest mb-3">V3 Partners</p>
        <h1 className="text-xl font-bold mb-2">Link expirado</h1>
        <p className="text-sm text-[#9BAFC5]">
          Este relatório venceu em {venceuEm}. Entre em contato com{" "}
          <a href="mailto:financeiro@v3partners.com.br" className="text-[#C9A84C]">financeiro@v3partners.com.br</a>{" "}
          para solicitar uma nova emissão.
        </p>
      </div>
    </div>
  );
}

export default async function RelatorioCreditoPage({ params }: PageProps) {
  const { token } = await params;
  const svc = serviceClient();

  const { data: order } = await svc
    .from("partner_service_orders")
    .select("id, credit_desk_proposal_id, report_public_token")
    .eq("report_public_token", token)
    .single();

  // Pedido com empresa + sócios/garantidores analisados: o cliente recebe UM relatório com todos
  // (resumo do grupo + o dossiê de cada parte). Documento adicional com token próprio e pedido de
  // uma parte só seguem no fluxo individual, mais abaixo.
  if (order) {
    const resolvido = await resolverPartesDoPedido(svc, order.id);
    if (resolvido.ok && resolvido.partes.length > 1) {
      const dados = await Promise.all(resolvido.partes.map((p) => buildCreditReportData(p.profileId)));
      if (dados.some((d) => !d)) notFound();
      const completos = dados as NonNullable<(typeof dados)[number]>[];

      // Um dossiê vencido invalida o conjunto: não mostramos ao cliente dado defasado de uma parte.
      const vencidos = completos.filter((d) => new Date(d.validUntilISO).getTime() < Date.now());
      if (vencidos.length) {
        const maisAntigo = vencidos.reduce((a, b) => (new Date(a.validUntilISO) <= new Date(b.validUntilISO) ? a : b));
        return <LinkExpirado venceuEm={maisAntigo.validUntil} />;
      }

      const maisRecente = completos.reduce((a, b) => (new Date(a.validUntilISO) >= new Date(b.validUntilISO) ? a : b));
      const capa = capaBodyHtml({
        // Capa com o nome oficial da empresa analisada; o digitado na compra vira "Solicitante".
        cliente: completos[0].subjectName || resolvido.order.client_name || "—",
        documentoCliente: completos[0].subjectCpfCnpj || resolvido.order.client_doc || "",
        solicitante: resolvido.order.client_name,
        partes: resolvido.partes.map((p, i) => resumoDaParte(p, i)),
        emitidoEm: maisRecente.emittedAt,
        mostrarPagina: false,
        rotulo: "relatório",
      });

      return (
        <>
          <style dangerouslySetInnerHTML={{ __html: CREDIT_REPORT_STYLE + CAPA_CSS }} />
          <div dangerouslySetInnerHTML={{ __html: capa }} />
          {completos.map((d, i) => (
            <div key={i} style={{ pageBreakBefore: "always" }} dangerouslySetInnerHTML={{ __html: buildExternalReportBodyHtml(d) }} />
          ))}
        </>
      );
    }
  }

  // Token pode ser do documento PRINCIPAL do pedido (partner_service_orders,
  // caso de sempre) ou de um documento ADICIONAL (sócio/garantidor CPF, 2º+
  // CNPJ — credit_consents, ver migration 20260911_credit_consents_multi_doc).
  let creditDeskProposalId = order?.credit_desk_proposal_id ?? null;
  if (!creditDeskProposalId) {
    const { data: consent } = await svc
      .from("credit_consents")
      .select("credit_desk_proposal_id")
      .eq("report_public_token", token)
      .single();
    creditDeskProposalId = consent?.credit_desk_proposal_id ?? null;
  }

  if (!creditDeskProposalId) notFound();

  const { data: proposal } = await svc
    .from("credit_desk_proposals")
    .select("credit_profile_id")
    .eq("id", creditDeskProposalId)
    .single();

  if (!proposal?.credit_profile_id) notFound();

  const reportData = await buildCreditReportData(proposal.credit_profile_id);
  if (!reportData) notFound();

  if (new Date(reportData.validUntilISO).getTime() < Date.now()) {
    return <LinkExpirado venceuEm={reportData.validUntil} />;
  }

  const bodyHtml = buildExternalReportBodyHtml(reportData);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CREDIT_REPORT_STYLE }} />
      <div dangerouslySetInnerHTML={{ __html: bodyHtml }} />
    </>
  );
}
